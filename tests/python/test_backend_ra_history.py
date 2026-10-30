from __future__ import annotations

import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import _test_support  # noqa: F401
from backend.ra_coordinator import RaCoordinator
from backend.ra_scheduler import RaScheduler, SchedulerPolicy
from backend.ra_state import RaStateStore
from backend.ra_history import RaHistorySynchronizer, HISTORY_BATCH_SECONDS


def event(timestamp, mode=1):
  return {"GameID": 1, "AchievementID": 1, "HardcoreMode": mode,
          "Date": datetime.fromtimestamp(timestamp, timezone.utc).isoformat(), "Title": "Verified"}


class HistoryTests(unittest.IsolatedAsyncioTestCase):
  async def asyncSetUp(self):
    self.directory = tempfile.TemporaryDirectory()
    self.store = RaStateStore(Path(self.directory.name) / "ra.sqlite3")
    self.start = 1600000000
    self.now = self.start + HISTORY_BATCH_SECONDS * 3
    self.scheduler = RaScheduler(policy=SchedulerPolicy(spacing_seconds=0, jitter_seconds=0))
    self.coordinator = RaCoordinator(self.store, self.scheduler, now=lambda: self.now)
    self.sync = RaHistorySynchronizer(self.store, self.coordinator, now=lambda: self.now)
    self.calls = []

  async def asyncTearDown(self):
    await self.scheduler.close()
    self.directory.cleanup()

  async def fetch(self, start, end):
    self.calls.append((start, end))
    return [event(start)]

  async def test_restart_resumes_checkpoint_without_reloading_imported_ranges(self):
    partial = await self.sync.ensure("account", self.start, "alice", self.fetch, max_ranges=1)
    self.assertTrue(partial["partial"])
    first_through = partial["history"]["through"]
    restarted = RaHistorySynchronizer(self.store, self.coordinator, now=lambda: self.now)
    complete = await restarted.ensure("account", self.start, "alice", self.fetch)
    self.assertFalse(complete["partial"])
    self.assertEqual(self.calls[1][0], first_through + 1)
    self.assertEqual(len(self.calls), 4)
    self.assertEqual(len(complete["history"]["entries"]), 4)

  async def test_incremental_overlap_deduplicates_and_retains_softcore_hardcore(self):
    self.now = self.start + 100
    records = [event(self.start + 50, 0), event(self.start + 50, 1)]

    async def awards(start, end):
      self.calls.append((start, end))
      return records

    first = await self.sync.ensure("account", self.start, "alice", awards)
    self.now += 100
    fresh = await self.sync.ensure("account", self.start, "alice", awards)
    self.assertEqual(fresh["history"]["through"], first["history"]["through"])
    self.assertEqual(len(self.calls), 1, "fresh history entry performs no HTTP request")
    self.now += 181
    second = await self.sync.ensure("account", self.start, "alice", awards)
    self.assertEqual(len(first["history"]["entries"]), 2)
    self.assertEqual(len(second["history"]["entries"]), 2)
    self.assertEqual(self.calls[-1][0], self.start)
    self.assertEqual(second["history"]["through"], self.now)

  async def test_failed_atomic_write_never_advances_checkpoint(self):
    original = self.store.commit_history_batch
    self.store.commit_history_batch = lambda *args: False
    failed = await self.sync.ensure("account", self.start, "alice", self.fetch, max_ranges=1)
    self.assertEqual(failed["category"], "cache_write_failed")
    self.assertIsNone(self.store.history("account"))
    self.store.commit_history_batch = original
    recovered = await self.sync.ensure("account", self.start, "alice", self.fetch, max_ranges=1)
    self.assertEqual(recovered["history"]["through"], self.start + HISTORY_BATCH_SECONDS - 1)
    self.assertEqual(len(self.calls), 1, "validated canonical range survives a failed checkpoint write")

  async def test_saturated_one_second_range_is_never_reported_complete(self):
    self.now = self.start

    async def saturated(start, end):
      return [event(start)] * 500

    result = await self.sync.ensure("account", self.start, "alice", saturated)
    self.assertEqual(result["category"], "history_range_saturated")
    self.assertIsNone(self.store.history("account"))

  async def test_rate_limit_preserves_the_last_committed_checkpoint(self):
    partial = await self.sync.ensure("account", self.start, "alice", self.fetch, max_ranges=1)

    async def limit(start, end):
      return {"handledHttpError": True, "status": 429, "retryAfterMs": 60000}

    failed = await self.sync.ensure("account", self.start, "alice", limit)
    self.assertEqual(failed["history"]["through"], partial["history"]["through"])
    self.assertEqual(failed["error"]["status"], 429)

  async def test_verified_game_reset_removes_old_awards_and_blocks_late_reimport(self):
    from backend.ra_history import event_identity
    old = event(self.start + 1)
    retired = {**old, "AchievementID": 2}
    metadata = {"version": 1, "memberSince": self.start, "through": self.now,
                "complete": True, "pending": [], "lastSuccessAt": self.now}
    self.assertTrue(self.store.commit_history_batch("account", metadata, [(event_identity(old), old), (event_identity(retired), retired)]))

    async def reset_progress():
      return {"ID": 1, "NumAchievements": 1, "NumAwardedToUser": 0, "NumAwardedToUserHardcore": 0,
              "Achievements": {"1": {"ID": 1, "Title": "Reset"}}}

    await self.coordinator.ensure("API_GetGameInfoAndUserProgress.php", {"g": 1, "a": 1}, "account", reset_progress)
    remaining = self.store.history("account")["entries"]
    self.assertEqual([row["AchievementID"] for row in remaining], [2], "retired metadata alone cannot prove a reset")
    reenarned = event(self.now + 10)
    self.store.commit_history_batch("account", metadata, [(event_identity(old), old), (event_identity(reenarned), reenarned)])
    remaining = self.store.history("account")["entries"]
    self.assertEqual(len(remaining), 2)
    self.assertTrue(any(row["Date"] == reenarned["Date"] for row in remaining))
    self.assertFalse(any(row["AchievementID"] == 1 and row["Date"] == old["Date"] for row in remaining))

  async def test_incomplete_unlock_evidence_cannot_remove_history(self):
    from backend.ra_history import event_identity
    old = event(self.start + 1)
    metadata = {"version": 1, "memberSince": self.start, "through": self.now,
                "complete": True, "pending": [], "lastSuccessAt": self.now}
    self.store.commit_history_batch("account", metadata, [(event_identity(old), old)])

    async def incomplete_progress():
      return {"ID": 1, "NumAchievements": 1, "NumAwardedToUser": 1, "NumAwardedToUserHardcore": 1,
              "Achievements": {"1": {"ID": 1, "Title": "Missing dates"}}}

    await self.coordinator.ensure("API_GetGameInfoAndUserProgress.php", {"g": 1, "a": 1}, "account", incomplete_progress)
    self.assertEqual(len(self.store.history("account")["entries"]), 1)
