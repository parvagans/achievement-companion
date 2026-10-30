"""Canonical RA resources: freshness and persistence precede live scheduling."""
from __future__ import annotations

import asyncio
import hashlib
import json
import time
from collections import OrderedDict
from typing import Any

from backend.ra_scheduler import unavailable

SCHEMA_VERSION = 1
ACTIVE_GAME_FRESH_SECONDS = 120
# Seconds. Product policy defaults; these are not provider quotas or polling intervals.
RESOURCE_POLICY = {
  "completion-collection": ("completion-library", 1800),
  "history-checkpoint": ("history", 180),
  "API_GetUserProfile.php": ("profile", 600),
  "API_GetUserSummary.php": ("summary", 45),
  "API_GetUserRecentAchievements.php": ("recent-achievements", 180),
  "API_GetUserRecentlyPlayedGames.php": ("recent-games", 600),
  "API_GetUserCompletionProgress.php": ("completion-library", 1800),
  "API_GetGameInfoAndUserProgress.php": ("game-progress", 900),
  "API_GetUserProgress.php": ("specific-progress", 900),
  "API_GetGameExtended.php": ("game-metadata", 604800),
  "API_GetConsoleIDs.php": ("systems", 2592000),
  "API_GetGameList.php": ("catalogue", 2592000),
  "API_GetAchievementDistribution.php": ("community-distribution", 7200),
  "API_GetGameProgression.php": ("community-progression", 7200),
  "API_GetGameRankAndScore.php": ("community-masters", 7200),
  "API_GetAchievementsEarnedBetween.php": ("history-range", 600),
}
PUBLIC_KINDS = {"game-metadata", "systems", "catalogue", "community-distribution", "community-progression", "community-masters"}


def account_scope(username: str, secret: str) -> str:
  return hashlib.sha256(json.dumps([username.strip().casefold(), secret]).encode()).hexdigest()


def resource_identity(path: str, query: dict | None, scope: str) -> tuple[str, str, str, dict]:
  kind, _ = RESOURCE_POLICY[path]
  parameters = {key: str(value) for key, value in (query or {}).items() if value is not None and key not in ("y", "apiKey")}
  effective_scope = "public" if kind in PUBLIC_KINDS else scope
  if effective_scope == "public":
    parameters.pop("u", None)
  identity = ["retroachievements", effective_scope, SCHEMA_VERSION, path, sorted(parameters.items())]
  key = hashlib.sha256(json.dumps(identity, separators=(",", ":")).encode()).hexdigest()
  return key, kind, effective_scope, parameters


def valid_payload(kind: str, payload: Any, parameters: dict) -> bool:
  if isinstance(payload, dict) and (payload.get("handledHttpError") or any(payload.get(key) for key in ("Error", "error", "ErrorCode", "errorCode")) or payload.get("Success") is False):
    return False
  if kind in {"systems", "catalogue", "recent-achievements", "recent-games", "history-range", "community-masters"}:
    if not isinstance(payload, list):
      return False
    if kind == "catalogue":
      return bool(payload) and all(isinstance(row, dict) and (row.get("ID") or row.get("GameID")) and
        (parameters.get("h") != "1" or isinstance(row.get("Hashes"), list)) for row in payload)
    if kind == "history-range":
      from backend.ra_history import event_identity, event_timestamp
      try:
        return all(event_identity(row) and int(parameters["f"]) <= event_timestamp(row) <= int(parameters["t"]) for row in payload)
      except (ValueError, TypeError, KeyError, OverflowError):
        return False
    return True
  if not isinstance(payload, dict):
    return False
  if kind in {"game-progress", "game-metadata"}:
    game_id = payload.get("ID", payload.get("id"))
    expected = parameters.get("g", parameters.get("i"))
    achievements = payload.get("Achievements", payload.get("achievements"))
    count = payload.get("NumAchievements", payload.get("numAchievements"))
    return str(game_id) == expected and isinstance(achievements, (dict, list)) and (
      count is None or str(len(achievements)) == str(count))
  if kind == "completion-library":
    return isinstance(payload.get("Results", payload.get("results")), list)
  if kind == "profile":
    return bool(payload.get("User") or payload.get("user") or payload.get("Username") or payload.get("username"))
  if kind == "summary":
    return ("LastGameID" in payload or "lastGameId" in payload) and ("RichPresenceMsgDate" in payload or "richPresenceMsgDate" in payload)
  return bool(payload)


class RaCoordinator:
  def __init__(self, store, scheduler, *, now=time.time, memory_limit=128, foreground_seconds=8, log=None):
    self.store, self.scheduler, self.now, self.memory_limit = store, scheduler, now, memory_limit
    self.foreground_seconds, self.log = foreground_seconds, log
    self.memory: OrderedDict[str, dict] = OrderedDict()
    self.loads: dict[str, asyncio.Task] = {}
    self.evaluations: dict[tuple, asyncio.Task] = {}
    self.generations: dict[str, int] = {}
    self.identities: dict[str, tuple[str, str]] = {}
    self.counts = {"hits": 0, "misses": 0, "writes": 0, "writeFailures": 0}
    self.failures: OrderedDict[str, dict] = OrderedDict()
    self.memory_sizes: dict[str, int] = {}
    self.memory_bytes = 0
    self.scope_locks: dict[str, asyncio.Lock] = {}
    self.hydrations: dict[str, set] = {}
    self.invalidations: set[asyncio.Task] = set()
    self.closing = False
    self.close_task = None

  def _event(self, event, key, **fields):
    if self.log:
      try:
        self.log("info", event, providerId="retroachievements", resource=key, correlationId=key[:16], **fields)
      except Exception:
        pass

  def _remember(self, key, record):
    self.hydrations.pop(key, None)
    size = len(json.dumps(record["payload"], separators=(",", ":")).encode())
    if size > 16 * 1024 * 1024:
      return
    self.memory_bytes -= self.memory_sizes.get(key, 0)
    self.memory.pop(key, None)
    self.memory[key] = record
    self.memory_sizes[key] = size
    self.memory_bytes += size
    while len(self.memory) > self.memory_limit or self.memory_bytes > 32 * 1024 * 1024:
      oldest, _ = self.memory.popitem(last=False)
      self.memory_bytes -= self.memory_sizes.pop(oldest, 0)

  def _result(self, record, state, error=None):
    return {"raResource": 1, "payload": record["payload"], "resourceKey": record["key"],
            "cacheState": state, "fetchedAt": record["fetched_at"] * 1000,
            "freshUntil": min(record["fresh_until"], record["fetched_at"] + RESOURCE_POLICY["API_GetUserSummary.php"][1] if record["kind"] == "summary" else record["fresh_until"]) * 1000,
            **({"activeFreshUntil": (record["fetched_at"] + ACTIVE_GAME_FRESH_SECONDS) * 1000} if record["kind"] == "game-progress" else {}),
            **({"error": error} if error else {})}

  async def _restore(self, key):
    while True:
      current = self.memory.get(key)
      if current is not None:
        return current
      token = object()
      guards = self.hydrations.setdefault(key, set())
      guards.add(token)
      try:
        record = await asyncio.to_thread(self.store.resource, key)
        authorized = token in self.hydrations.get(key, ())
      finally:
        guards.discard(token)
        if self.hydrations.get(key) is guards and not guards:
          self.hydrations.pop(key, None)
      if authorized:
        return record
      # A publication or invalidation revoked this read. Prefer memory, or
      # reread SQLite if that newer publication has already been evicted.

  async def _own_invalidation(self, operation):
    if self.closing:
      operation.close()
      raise RuntimeError("RA coordinator is shutting down")
    task = asyncio.create_task(operation)
    self.invalidations.add(task)
    def completed(done):
      self.invalidations.discard(done)
      if not done.cancelled() and done.exception() is not None:
        self._event("cache_write_failed", "invalidation", reason="durability-failed")
    task.add_done_callback(completed)
    return await asyncio.shield(task)

  async def close(self):
    self.closing = True
    if self.close_task is None:
      async def drain():
        errors = []
        while self.invalidations:
          results = await asyncio.gather(*tuple(self.invalidations), return_exceptions=True)
          errors.extend(value for value in results if isinstance(value, BaseException))
        if errors:
          raise errors[0]
      self.close_task = asyncio.create_task(drain())
    try:
      await asyncio.shield(self.close_task)
    except asyncio.CancelledError:
      try:
        await asyncio.shield(self.close_task)
      finally:
        raise

  async def ensure(self, path, query, scope, operation, *, force=False, active=False, priority=1, entry_point="provider"):
    if self.closing:
      return unavailable("shutdown")
    key = resource_identity(path, query, scope)[0]
    identity = (key, force, active)
    task = self.evaluations.get(identity)
    if task is None:
      task = asyncio.create_task(self._ensure(path, query, scope, operation, force=force,
        active=active, priority=priority, entry_point=entry_point))
      self.evaluations[identity] = task
      task.add_done_callback(lambda done: self.evaluations.pop(identity, None) if self.evaluations.get(identity) is done else None)
    else:
      self._event("request_joined", key, entryPoint=entry_point)
      self.scheduler.promote(f"{key}:{self.generations.get(key, 0)}", priority)
    return await asyncio.shield(task)

  async def _ensure(self, path, query, scope, operation, *, force=False, active=False, priority=1, entry_point="provider"):
    key, kind, scope, parameters = resource_identity(path, query, scope)
    self._event("refresh_evaluated", key, path=path, entryPoint=entry_point, reason="explicit" if force else "policy", activeViewing=active)
    # Entries arriving during bulk invalidation become successors after its durable fence.
    async with self.scope_locks.setdefault(scope, asyncio.Lock()):
      if self.closing:
        return unavailable("shutdown")
      self.identities[key] = (scope, kind)
      admitted_generation = self.generations.get(key, 0)
    durable_generation = await asyncio.to_thread(self.store.read, "generation:" + key)
    if admitted_generation != self.generations.get(key, 0):
      return await self._ensure(path, query, scope, operation, force=force, active=active, priority=priority, entry_point=entry_point)
    self.generations[key] = max(self.generations.get(key, 0), durable_generation if isinstance(durable_generation, int) else 0)
    admitted_generation = self.generations[key]
    record = self.memory.get(key)
    if record is None:
      record = await self._restore(key)
      if record is not None:
        self._event("cache_restored", key)
    if admitted_generation != self.generations.get(key, 0):
      return await self._ensure(path, query, scope, operation, force=force, active=active, priority=priority, entry_point=entry_point)
    if record and (record["schema_version"] != SCHEMA_VERSION or not valid_payload(kind, record["payload"], parameters)):
      self._event("cache_invalidated", key, reason="schema-or-corrupt")
      record = None
    if record and record["generation"] < self.generations.get(key, 0):
      record = {**record, "fresh_until": 0}
    if record:
      self.generations[key] = max(self.generations.get(key, 0), record["generation"])
      self._remember(key, record)
    ttl = ACTIVE_GAME_FRESH_SECONDS if active and kind == "game-progress" else RESOURCE_POLICY[path][1]
    if record and not force and record["fetched_at"] <= self.now() < min(record["fresh_until"], record["fetched_at"] + ttl):
      self.counts["hits"] += 1
      self._event("cache_hit", key)
      return self._result(record, "fresh")
    failure = self.failures.get(key)
    if failure is None:
      failure = await asyncio.to_thread(self.store.read, f"failure:{key}")
    if admitted_generation != self.generations.get(key, 0):
      return await self._ensure(path, query, scope, operation, force=force, active=active, priority=priority, entry_point=entry_point)
    # Hydration/storage reads yield. Another consumer may have completed the
    # shared refresh during them, including before its task callback removed it.
    latest = self.memory.get(key)
    if latest is not None and (not force or latest is not record) and latest["fetched_at"] <= self.now() < min(latest["fresh_until"], latest["fetched_at"] + ttl):
      self.counts["hits"] += 1
      self._event("cache_hit", key)
      return self._result(latest, "fresh")
    if isinstance(failure, dict) and failure.get("generation", 0) == self.generations.get(key, 0) and isinstance(failure.get("until"), (int, float)) and failure["until"] > self.now():
      self._event("retry_suppressed", key)
      error = failure.get("error", unavailable("retry_ineligible"))
      return self._result(record, "stale", error) if record else error
    self.counts["misses"] += 1
    self._event("cache_stale" if record else "cache_miss", key)
    priority = 0 if record is None and priority < 3 else priority
    task = self.loads.get(key)
    if task is None:
      task = asyncio.create_task(self._refresh(key, kind, scope, path, parameters, operation, ttl, priority, admitted_generation))
      self.loads[key] = task
      task.add_done_callback(lambda completed: self.loads.pop(key, None) if self.loads.get(key) is completed else None)
    else:
      self._event("request_joined", key)
      self.scheduler.promote(f"{key}:{self.generations.get(key, 0)}", priority)
    try:
      # Optional mounted Community views observe the same RPC's late completion.
      # Their frontend entry wait remains bounded independently; no second HTTP
      # request or polling bridge is needed to publish a queued success.
      wait = self.scheduler.policy.background_seconds if kind.startswith("community-") else self.foreground_seconds
      result = await asyncio.shield(task) if kind.startswith("community-") else await asyncio.wait_for(asyncio.shield(task), wait)
    except asyncio.TimeoutError:
      result = unavailable("foreground_deadline")
    if isinstance(result, dict) and result.get("raResource") == 1:
      return result
    if record:
      return self._result(record, "stale", result)
    return result

  async def ensure_completion_collection(self, query, scope, fetch_page, *, force=False, entry_point="provider"):
    """One durable complete collection; page responses are never independent authorities.

    RA has no snapshot token. Validate total/coverage/uniqueness and re-read the
    first page as a change detector, with at most one full reconciliation pass.
    This detects observable pagination drift, not server transactional isolation.
    """
    async def collect():
      collection_key = resource_identity("completion-collection", {"u": query.get("u")}, scope)[0]
      owner = self.generations.get(collection_key, 0)
      for attempt in range(2):
        entries, total = [], None
        first = None
        for page in range(512):
          offset = len(entries)
          async def operation(offset=offset):
            return await fetch_page(offset)
          response = await self.scheduler.submit(f"completion:{scope}:{owner}:{attempt}:{offset}",
            "API_GetUserCompletionProgress.php", operation, retain_operation=True,
            foreground_seconds=self.scheduler.policy.background_seconds)
          if not valid_payload("completion-library", response, {}):
            return response if isinstance(response, dict) and response.get("handledHttpError") else unavailable("invalid_collection", 502)
          rows = response.get("Results", response.get("results"))
          try:
            count = int(response.get("Total", response.get("total")))
          except (TypeError, ValueError):
            break
          if total is None:
            total, first = count, response
          if count != total or len(rows) > 500 or (not rows and len(entries) < total):
            break
          entries.extend(rows)
          ids = [str(row.get("GameID", row.get("gameId", ""))) if isinstance(row, dict) else "" for row in entries]
          if any(not value.isdigit() or int(value) <= 0 for value in ids) or len(set(ids)) != len(ids) or len(entries) > total:
            break
          if len(entries) == total:
            if page:
              check = await self.scheduler.submit(f"completion:{scope}:{owner}:{attempt}:verify", "API_GetUserCompletionProgress.php",
                lambda: fetch_page(0), retain_operation=True, foreground_seconds=self.scheduler.policy.background_seconds)
              if isinstance(check, dict) and check.get("handledHttpError"):
                return check
              if check != first:
                break
            return {"Total": total, "Count": len(entries), "Results": entries}
          if len(rows) < 500:
            break
      return unavailable("inconsistent_collection", 502)
    return await self.ensure("completion-collection", {"u": query.get("u")}, scope, collect,
      force=force, entry_point=entry_point)

  async def _refresh(self, key, kind, scope, path, parameters, operation, ttl, priority, generation):
    if generation != self.generations.get(key, 0) or self.closing:
      return unavailable("invalidated")
    started_at = self.now()
    # The entry waiter is bounded separately. Let already-requested work finish
    # and populate durable cache after the foreground has fallen back.
    result = await operation() if path == "completion-collection" else await self.scheduler.submit(f"{key}:{generation}", path, operation, priority=priority,
      foreground_seconds=self.scheduler.policy.background_seconds, retain_operation=True)
    if generation != self.generations.get(key, 0):
      return unavailable("invalidated")
    if not valid_payload(kind, result, parameters):
      category = result.get("category", "provider_http") if isinstance(result, dict) else "invalid_payload"
      retry_after = result.get("retryAfterMs", 0) if isinstance(result, dict) else 0
      if not isinstance(retry_after, (int, float)) or not 0 <= retry_after < float("inf"):
        retry_after = 0
      await asyncio.to_thread(self.store.failed_attempt, key, self.now(), category,
                              self.now() + max(0, retry_after) / 1000)
      error = result if isinstance(result, dict) and result.get("handledHttpError") else unavailable("invalid_payload", 502)
      status = error.get("status")
      delay = retry_after / 1000 if status == 429 and retry_after > 0 else 900 if status in (401, 403) else 300 if status == 404 else 30
      failure = {"until": self.now() + delay, "error": error, "generation": generation}
      await asyncio.to_thread(self.store.write_resource_state, key, generation, f"failure:{key}", failure)
      if generation != self.generations.get(key, 0):
        return unavailable("invalidated")
      self.failures[key] = failure
      while len(self.failures) > 128:
        self.failures.popitem(last=False)
      return error
    if generation != self.generations.get(key, 0):
      return unavailable("invalidated")
    now = self.now()
    if kind in {"community-progression", "community-distribution"}:
      previous = self.memory.get(key) or await asyncio.to_thread(self.store.resource, key)
      if previous and isinstance(previous["payload"], dict):
        # Absent optional fields are not authoritative removals. Explicit null
        # and zero remain provider evidence and replace their previous values.
        result = {**previous["payload"], **result}
    record = {"key": key, "scope": scope, "kind": kind, "schema_version": SCHEMA_VERSION,
              "payload": result, "fetched_at": now, "fresh_until": now + RESOURCE_POLICY[path][1],
              "last_attempt_at": started_at, "generation": generation}
    persisted = await asyncio.to_thread(self.store.save_resource, record)
    if not persisted:
      fence = await asyncio.to_thread(self.store.read, "generation:" + key)
      if isinstance(fence, int) and fence > generation:
        return unavailable("invalidated")
    if generation != self.generations.get(key, 0):
      return unavailable("invalidated")
    if kind == "game-progress":
      from backend.ra_history import game_progress_proof
      proof = game_progress_proof(result)
      if proof is not None:
        reconciled = await asyncio.to_thread(self.store.reconcile_history_game, scope, parameters["g"], proof, started_at, key, generation)
        self._event("cache_reconciliation" if reconciled else "cache_write_failed", key)
    await asyncio.to_thread(self.store.write_resource_state, key, generation, f"failure:{key}", None)
    # No await between this final ownership check, publication and live return.
    if generation != self.generations.get(key, 0):
      return unavailable("invalidated")
    self._remember(key, record)
    self.failures.pop(key, None)
    self.counts["writes" if persisted else "writeFailures"] += 1
    self._event("cache_write" if persisted else "cache_write_failed", key)
    return self._result(record, "live")

  async def invalidate_kinds(self, scope, kinds):
    async def operation():
      for kind in tuple(kinds):
        await self._invalidate(scope, kind)
    return await self._own_invalidation(operation())

  async def invalidate(self, scope, kind=None):
    return await self._own_invalidation(self._invalidate(scope, kind))

  async def _invalidate(self, scope, kind=None):
    # Stable targets and an account-scoped entry barrier. Existing operations are
    # fenced synchronously; new entries wait until SQLite covers persisted keys.
    async with self.scope_locks.setdefault(scope, asyncio.Lock()):
      targets = [key for key, (account, resource_kind) in self.identities.items()
                 if account == scope and (kind is None or resource_kind == kind)]
      for key in targets:
        self.hydrations.pop(key, None)
        self.generations[key] = self.generations.get(key, 0) + 1
        self.loads.pop(key, None)
        for identity in list(self.evaluations):
          if identity[0] == key:
            self.evaluations.pop(identity, None)
      for key, record in list(self.memory.items()):
        if record["scope"] == scope and (kind is None or record["kind"] == kind):
          self.memory[key] = {**record, "fresh_until": 0}
          self._event("cache_invalidated", key)
      for key in targets:
        await asyncio.to_thread(self.store.invalidate_key, key)
      await asyncio.to_thread(self.store.invalidate, scope=scope, kind=kind, exclude=targets)

  async def invalidate_resource(self, path, query, scope):
    return await self._own_invalidation(self._invalidate_resource(path, query, scope))

  async def _invalidate_resource(self, path, query, scope):
    async with self.scope_locks.setdefault(scope, asyncio.Lock()):
      key, _, _, _ = resource_identity(path, query, scope)
      self.hydrations.pop(key, None)
      self.generations[key] = self.generations.get(key, 0) + 1
      self.loads.pop(key, None)
      for identity in list(self.evaluations):
        if identity[0] == key:
          self.evaluations.pop(identity, None)
      cached = self.memory.get(key)
      if cached:
        self.memory[key] = {**cached, "fresh_until": 0}
      self._event("cache_invalidated", key, reason="targeted-event")
      await asyncio.to_thread(self.store.invalidate_key, key)
