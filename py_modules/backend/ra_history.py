"""Resumable low-priority history import over canonical scheduled date ranges."""
from __future__ import annotations

import asyncio
import hashlib
import json
import time
from datetime import datetime, timezone

from backend.ra_scheduler import unavailable

HISTORY_BATCH_SECONDS = 31 * 24 * 60 * 60
HISTORY_OVERLAP_SECONDS = 300
HISTORY_MAX_RANGES_PER_RUN = 64


def event_timestamp(event: dict) -> int:
  date = event.get("Date", event.get("date"))
  if not isinstance(date, str):
    raise ValueError("Invalid history date")
  parsed = datetime.fromisoformat(date.replace("Z", "+00:00"))
  if parsed.tzinfo is None:
    parsed = parsed.replace(tzinfo=timezone.utc)
  return int(parsed.timestamp())


def event_identity(event: dict) -> str:
  achievement = event.get("AchievementID", event.get("achievementId"))
  game = event.get("GameID", event.get("gameId"))
  date = event.get("Date", event.get("date"))
  mode = event.get("HardcoreMode", event.get("hardcoreMode"))
  if not str(achievement).isdigit() or not str(game).isdigit() or not isinstance(date, str):
    raise ValueError("Invalid history identity")
  timestamp = event_timestamp(event)
  if str(mode).lower() not in ("1", "0", "true", "false"):
    raise ValueError("Invalid history mode")
  hardcore = str(mode).lower() in ("1", "true")
  return hashlib.sha256(json.dumps([str(game), str(achievement), hardcore, timestamp]).encode()).hexdigest()


def game_progress_proof(raw: dict) -> dict | None:
  """Only a complete schema with verified unlock counts can remove old awards."""
  achievements = raw.get("Achievements", raw.get("achievements"))
  game_id = raw.get("ID", raw.get("id"))
  if not isinstance(achievements, dict):
    return None
  try:
    if int(raw.get("NumAchievements", raw.get("numAchievements"))) != len(achievements):
      return None
    allowed, ids = [], []
    counts = [0, 0]
    for key, achievement in achievements.items():
      achievement_id = str(achievement.get("ID", achievement.get("id", key)))
      ids.append(achievement_id)
      for mode, names in enumerate((("DateEarned", "dateEarned"), ("DateEarnedHardcore", "dateEarnedHardcore"))):
        date = achievement.get(names[0], achievement.get(names[1]))
        if date:
          allowed.append(event_identity({"GameID": game_id, "AchievementID": achievement_id, "HardcoreMode": mode, "Date": date}))
          counts[mode] += 1
    if counts != [int(raw.get("NumAwardedToUser", raw.get("numAwardedToUser"))), int(raw.get("NumAwardedToUserHardcore", raw.get("numAwardedToUserHardcore")))]:
      return None
    return {"achievementIds": ids, "allowedEvents": allowed}
  except (ValueError, TypeError, AttributeError, OverflowError):
    return None


class RaHistorySynchronizer:
  def __init__(self, store, coordinator, *, now=time.time, foreground_seconds=8):
    self.store, self.coordinator, self.now = store, coordinator, now
    self.foreground_seconds = foreground_seconds
    self.loads: dict[str, asyncio.Task] = {}

  def _result(self, checkpoint, error=None):
    from backend.ra_coordinator import RESOURCE_POLICY
    if not isinstance(checkpoint.get("lastSuccessAt"), (int, float)):
      return error or unavailable("history_import_pending")
    partial = not checkpoint["complete"] or bool(checkpoint.get("pending"))
    fresh_until = 0 if partial or error else checkpoint["lastSuccessAt"] + RESOURCE_POLICY["history-checkpoint"][1]
    return {"history": checkpoint, "partial": partial, "freshUntil": fresh_until * 1000,
            **({"error": error} if error else {})}

  async def ensure(self, scope: str, member_since: int, username: str, fetch_range, *, max_ranges=HISTORY_MAX_RANGES_PER_RUN):
    checkpoint = await asyncio.to_thread(self.store.history, scope)
    if checkpoint is not None and (checkpoint.get("version") != 1 or
        not isinstance(checkpoint.get("through"), int) or not isinstance(checkpoint.get("complete"), bool) or
        not isinstance(checkpoint.get("pending"), list) or
        any(not isinstance(span, list) or len(span) != 2 or
            any(not isinstance(value, int) for value in span) or span[0] > span[1] or span[0] < member_since
            for span in checkpoint.get("pending", []))):
      return unavailable("corrupt_history_checkpoint")
    if checkpoint is not None and checkpoint.get("memberSince") != member_since:
      # A different identity must not be merged into an old account's coverage.
      return unavailable("history_identity", 409)
    if checkpoint and checkpoint["complete"] and not checkpoint.get("pending"):
      fresh = self._result(checkpoint)
      if fresh["freshUntil"] > self.now() * 1000:
        return fresh
    task = self.loads.get(scope)
    if task is None:
      task = asyncio.create_task(self._run(scope, member_since, username, fetch_range, checkpoint, max_ranges))
      self.loads[scope] = task
      task.add_done_callback(lambda done: self.loads.pop(scope, None) if self.loads.get(scope) is done else None)
    try:
      return await asyncio.wait_for(asyncio.shield(task), self.foreground_seconds)
    except asyncio.TimeoutError:
      saved = await asyncio.to_thread(self.store.history, scope)
      return self._result(saved, unavailable("foreground_deadline")) if saved else unavailable("foreground_deadline")

  async def _run(self, scope, member_since, username, fetch_range, checkpoint, max_ranges):
    target = int(self.now())
    if checkpoint is None:
      state = {"version": 1, "memberSince": member_since, "through": member_since - 1,
               "complete": False, "pending": [], "lastSuccessAt": None}
    else:
      state = {key: value for key, value in checkpoint.items() if key != "entries"}
    if state.get("complete") and not state.get("pending"):
      # Refresh the recent boundary, preserving the proven complete older import.
      state["pending"] = [[max(member_since, state["through"] - HISTORY_OVERLAP_SECONDS), target]]
    error = None
    for _ in range(max(0, min(HISTORY_MAX_RANGES_PER_RUN, max_ranges))):
      if not state["pending"]:
        if state["through"] >= target:
          state["complete"] = True
          break
        start = state["through"] + 1
        state["pending"] = [[start, min(target, start + HISTORY_BATCH_SECONDS - 1)]]
      start, end = state["pending"][0]
      query = {"u": username, "f": start, "t": end}
      result = await self.coordinator.ensure("API_GetAchievementsEarnedBetween.php", query, scope,
        lambda: fetch_range(start, end), priority=3)
      if not isinstance(result, dict) or result.get("raResource") != 1 or result.get("cacheState") == "stale":
        error = result
        break
      rows = result.get("payload")
      if not isinstance(rows, list):
        error = unavailable("invalid_history", 502)
        break
      if len(rows) >= 500:
        if start >= end:
          error = unavailable("history_range_saturated", 502)
          break
        midpoint = start + (end - start) // 2
        candidate = {**state, "pending": [[start, midpoint], [midpoint + 1, end], *state["pending"][1:]]}
        if not await asyncio.to_thread(self.store.commit_history_batch, scope, candidate, []):
          error = unavailable("cache_write_failed")
          break
        state = candidate
        continue
      try:
        entries = [(event_identity(row), row) for row in rows]
      except (TypeError, ValueError, OverflowError):
        error = unavailable("invalid_history", 502)
        break
      candidate = {**state, "through": max(state["through"], end), "pending": state["pending"][1:],
                   "lastSuccessAt": self.now()}
      candidate["complete"] = candidate["through"] >= target and not candidate["pending"]
      if not await asyncio.to_thread(self.store.commit_history_batch, scope, candidate, entries):
        error = unavailable("cache_write_failed")
        break
      state = candidate
      if state["complete"]:
        break
    saved = await asyncio.to_thread(self.store.history, scope)
    if error:
      await asyncio.to_thread(self.store.write, "ra-last-history-error", {"at": self.now() * 1000,
        "status": error.get("status", 503), "category": str(error.get("category", "history_unavailable"))[:64]})
    if saved is None:
      return error or unavailable("history_unavailable")
    return self._result(saved, error)

  async def close(self):
    tasks = list(self.loads.values())
    for task in tasks:
      task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    self.loads.clear()
