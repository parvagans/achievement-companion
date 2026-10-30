from __future__ import annotations

import json
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

import _test_support  # noqa: F401
from test_backend_runtime import load_main_module
from backend.ra_state import RaStateStore
from backend.ra_scheduler import RaScheduler, SchedulerPolicy
from backend.ra_coordinator import RaCoordinator, account_scope
from backend.ra_history import event_identity
from test_backend_ra_history import event


class DiagnosticsTests(unittest.IsolatedAsyncioTestCase):
  async def test_subset_candidate_diagnostics_keep_verification_distinct_from_transport_success(self):
    from backend.diagnostics import sanitize_diagnostic_event
    event = sanitize_diagnostic_event({"event": "subset_candidate", "providerId": "retroachievements", "consoleId": "21",
      "gameId": "45320", "previousStatus": "unresolved", "candidateStatus": "retry-later", "attempt": 1,
      "outcome": "invalid_metadata", "normalization": "rejected", "retryEligible": False, "retryAt": 1000,
      "apiKey": "sensitive-api-key", "url": "https://invalid.test/?y=secret", "payload": {"raw": "body"}})
    self.assertEqual(event["fields"]["outcome"], "invalid_metadata")
    self.assertEqual(event["fields"]["normalization"], "rejected")
    self.assertFalse(event["fields"]["retryEligible"])
    self.assertNotIn("apiKey", event["fields"])
    self.assertNotIn("url", event["fields"])
    self.assertNotIn("payload", event["fields"])

  async def asyncSetUp(self):
    self.directory = tempfile.TemporaryDirectory()
    self.root = Path(self.directory.name)
    self.module = load_main_module(self.root / "settings", self.root / "logs")
    self.module._load_provider_config = lambda key: {"username": "private-account"}
    self.module._load_secret_api_key = lambda key: "sensitive-api-key"
    self.plugin = self.module.Plugin()
    self.store = RaStateStore(self.root / "settings" / "retroachievements.sqlite3")
    self.scheduler = RaScheduler(store=self.store, policy=SchedulerPolicy(spacing_seconds=0, jitter_seconds=0))
    self.plugin._ra_requests = self.scheduler
    self.plugin._ra_resources = RaCoordinator(self.store, self.scheduler)

  async def asyncTearDown(self):
    await self.scheduler.close()
    self.directory.cleanup()

  async def test_export_contains_aggregate_counts_and_no_credentials_or_payloads(self):
    scope = account_scope("private-account", "sensitive-api-key")
    async def profile():
      return {"User": "private-account", "Details": "private-provider-body"}
    await self.plugin._ra_resources.ensure("API_GetUserProfile.php", {}, scope, profile)
    result = await self.plugin.export_retroachievements_diagnostics({})
    self.assertTrue(result["ok"])
    exported = (self.root / "logs" / "retroachievements-diagnostics.json").read_text()
    for secret in ("private-account", "sensitive-api-key", "private-provider-body", scope):
      self.assertNotIn(secret, exported)
    report = json.loads(exported)
    self.assertEqual(report["cache"]["resources"], 1)
    self.assertEqual(report["requests"]["sent"], 1)
    self.assertTrue(report["cache"]["healthy"])
    self.assertEqual((await self.plugin.get_retroachievements_diagnostics({}))["requests"]["sent"], 1)

  async def test_calendar_rpc_is_cache_only_and_account_scoped(self):
    scope = account_scope("private-account", "sensitive-api-key")
    self.assertIsNone(await self.plugin.read_retroachievements_calendar({}))
    import time
    now = int(time.time())
    award = event(now - 1)
    metadata = {"version": 1, "memberSince": now - 1000, "through": now, "complete": True,
                "pending": [], "lastSuccessAt": now}
    self.store.commit_history_batch(scope, metadata, [(event_identity(award), award)])
    calendar = await self.plugin.read_retroachievements_calendar({})
    self.assertEqual(calendar["entries"], [award])
    self.assertEqual(self.scheduler.counts["sent"], 0)
    self.module._load_provider_config = lambda key: {"username": "different-account"}
    self.assertIsNone(await self.plugin.read_retroachievements_calendar({}))

  async def test_targeted_recovery_keeps_other_resources_and_cooldown(self):
    scope = account_scope("private-account", "sensitive-api-key")
    async def profile(): return {"User": "private-account"}
    async def game(): return {"ID": 1, "Achievements": {}}
    a = await self.plugin._ra_resources.ensure("API_GetUserProfile.php", {}, scope, profile)
    b = await self.plugin._ra_resources.ensure("API_GetGameInfoAndUserProgress.php", {"g": 1, "a": 1, "u": "private-account"}, scope, game)
    self.store.write("ra-cooldown", {"until": 9999999999, "strikes": 1})
    result = await self.plugin.recover_retroachievements_resource({"target": "profile"})
    self.assertTrue(result["ok"])
    self.assertEqual(self.store.resource(a["resourceKey"])["fresh_until"], 0)
    self.assertGreater(self.store.resource(b["resourceKey"])["fresh_until"], 0)
    self.assertEqual(self.store.read("ra-cooldown")["until"], 9999999999)
    self.assertEqual(self.store.resource(a["resourceKey"])["payload"], {"User": "private-account"})

  async def test_corrupt_history_rebuild_retains_verified_events(self):
    scope = account_scope("private-account", "sensitive-api-key")
    award = event(1600000001)
    self.store.commit_history_batch(scope, {"version": 1}, [(event_identity(award), award)])
    with closing(self.store._connect()) as connection, connection:
      connection.execute("UPDATE history_sync SET metadata='invalid' WHERE scope=?", (scope,))
      connection.execute("INSERT INTO history_events VALUES (?,?,?,?,?)", (scope, "broken", "1", "invalid", 7))
    self.assertEqual(self.store.history(scope)["version"], 0)
    result = await self.plugin.recover_retroachievements_resource({"target": "history-checkpoint"})
    self.assertTrue(result["ok"])
    self.assertIsNone(self.store.history(scope))
    with closing(self.store._connect()) as connection:
      self.assertEqual(connection.execute("SELECT count(*) FROM history_events WHERE scope=?", (scope,)).fetchone()[0], 1)
