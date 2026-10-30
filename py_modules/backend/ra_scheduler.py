"""One installation-wide HTTP safety boundary for RetroAchievements."""
from __future__ import annotations

import asyncio
import math
import random
import time
from collections import deque
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from backend.http import ProviderRequestError


@dataclass(frozen=True)
class SchedulerPolicy:
  spacing_seconds: float = 0.75
  jitter_seconds: float = 0.15
  startup_jitter_seconds: float = 2
  queue_limit: int = 128
  foreground_seconds: float = 8
  background_seconds: float = 60
  request_timeout_seconds: float = 20
  aging_seconds: float = 15
  max_attempts: int = 2
  backoff_seconds: float = 60
  max_backoff_seconds: float = 900


@dataclass
class _Job:
  key: str
  endpoint: str
  operation: Callable[[], Awaitable[Any]]
  priority: int
  created: float
  deadline: float
  future: asyncio.Future
  sequence: int
  attempts: int = 0
  eligible: float = 0


def unavailable(category: str, status: int = 503, retry_after_ms: int | None = None) -> dict:
  return {"handledHttpError": True, "status": status, "category": category,
          "message": "RetroAchievements is temporarily unavailable.",
          **({"retryAfterMs": retry_after_ms} if retry_after_ms is not None else {})}


class RaScheduler:
  def __init__(self, *, store=None, policy: SchedulerPolicy | None = None,
               monotonic=time.monotonic, wall=time.time, sleep=asyncio.sleep,
               jitter=random.random, log=None) -> None:
    self.policy = policy or SchedulerPolicy()
    self.store, self.now, self.wall, self.sleep, self.jitter, self.log = store, monotonic, wall, sleep, jitter, log
    state = store.read("ra-cooldown") if store else None
    self.cooldown_until = 0.0
    self.strikes = 0
    if isinstance(state, dict):
      until = state.get("until", 0)
      if isinstance(until, (int, float)) and math.isfinite(until):
        self.cooldown_until = max(0, until)
      strikes = state.get("strikes", 0)
      if isinstance(strikes, (int, float)) and math.isfinite(strikes):
        self.strikes = min(10, max(0, int(strikes)))
    self.queue: list[_Job] = []
    self.jobs: dict[str, _Job] = {}
    self.worker: asyncio.Task | None = None
    self.closed = False
    self.next_start = self.now() + self.jitter() * self.policy.startup_jitter_seconds
    self.sequence = 0
    self.active = 0
    self.counts = {"sent": 0, "joined": 0, "failed": 0, "rateLimited": 0}
    self.recent_errors = deque(maxlen=12)
    self.last_failure = None

  def _event(self, event: str, job: _Job | None = None, **fields) -> None:
    if self.log:
      try:
        self.log("info", event, providerId="retroachievements",
                 **({"correlationId": job.key[:16], "path": job.endpoint, "attempt": job.attempts} if job else {}), **fields)
      except Exception:
        pass

  def _cooldown(self) -> dict | None:
    remaining = self.cooldown_until - self.wall()
    if remaining > 0:
      return unavailable("rate_limit", 429, math.ceil(remaining * 1000))
    if self.cooldown_until:
      self.cooldown_until = 0
      self._event("rate_limit_expired")
    return None

  async def submit(self, key: str, endpoint: str, operation: Callable[[], Awaitable[Any]],
                   *, priority: int = 1, foreground_seconds: float | None = None, retain_operation: bool = False) -> Any:
    if self.closed:
      return unavailable("shutdown")
    cooldown = self._cooldown()
    if cooldown:
      self._event("retry_suppressed")
      return cooldown
    wait = self.policy.foreground_seconds if foreground_seconds is None else max(0, foreground_seconds)
    job = self.jobs.get(key)
    if job is None:
      if len(self.queue) >= self.policy.queue_limit:
        return unavailable("queue_full")
      self.sequence += 1
      job = _Job(key, endpoint, operation, max(0, min(3, priority)), self.now(), self.now() + wait,
                 asyncio.get_running_loop().create_future(), self.sequence)
      self.jobs[key] = job
      self.queue.append(job)
      self._event("request_queued", job)
    else:
      self.counts["joined"] += 1
      job.priority = min(job.priority, max(0, min(3, priority)))
      self._event("request_joined", job)
    if self.worker is None or self.worker.done():
      self.worker = asyncio.create_task(self._drain())
    try:
      # A disappearing view cannot cancel another consumer's shared HTTP request.
      return await asyncio.shield(job.future) if retain_operation else await asyncio.wait_for(asyncio.shield(job.future), wait)
    except asyncio.TimeoutError:
      return unavailable("foreground_deadline")

  def promote(self, key: str, priority: int) -> None:
    job = self.jobs.get(key)
    if job:
      job.priority = min(job.priority, max(0, min(3, priority)))

  def _finish(self, job: _Job, result: Any) -> None:
    if not job.future.done():
      job.future.set_result(result)
    if self.jobs.get(job.key) is job:
      self.jobs.pop(job.key, None)

  def _activate_cooldown(self, response: dict) -> None:
    self.strikes = min(10, self.strikes + 1)
    delay = response.get("retryAfterMs")
    if not isinstance(delay, (int, float)) or not math.isfinite(delay) or delay <= 0:
      delay = min(self.policy.max_backoff_seconds,
                  self.policy.backoff_seconds * 2 ** (self.strikes - 1)) * (1 + self.jitter() * .2) * 1000
    self.cooldown_until = max(self.cooldown_until, self.wall() + delay / 1000)
    if self.store and not self.store.write("ra-cooldown", {"until": self.cooldown_until, "strikes": self.strikes}):
      self._event("cache_write_failed")
    self.counts["rateLimited"] += 1
    self._event("rate_limit_activated", nextEligibleAt=round(self.cooldown_until * 1000))

  async def _drain(self) -> None:
    while self.queue and not self.closed:
      now = self.now()
      for job in list(self.queue):
        if job.deadline <= now:
          self.queue.remove(job)
          self._finish(job, unavailable("foreground_deadline"))
      if not self.queue:
        break
      cooldown = self._cooldown()
      if cooldown:
        for job in self.queue:
          self._finish(job, cooldown)
        self.queue.clear()
        break
      ready = [job for job in self.queue if job.eligible <= now]
      if not ready:
        await self.sleep(max(0, min(job.eligible for job in self.queue) - now))
        continue
      # Aging prevents optional work from starving behind an endless foreground stream.
      job = min(ready, key=lambda item: (max(0, item.priority - int((now - item.created) / self.policy.aging_seconds)), item.sequence))
      delay = self.next_start - self.now()
      if delay > 0:
        await self.sleep(delay)
        continue
      self.queue.remove(job)
      job.attempts += 1
      self.active = 1
      self.next_start = self.now() + self.policy.spacing_seconds + self.jitter() * self.policy.jitter_seconds
      self.counts["sent"] += 1
      started_at = self.now()
      self._event("request_started", job)
      retryable = True
      try:
        # HTTP has its own socket timeout. Do not cancel to_thread and accidentally
        # dispatch another HTTP request while its worker is still running.
        result = await job.operation()
      except Exception as error:
        transient = isinstance(error, (TimeoutError, OSError)) or (
          isinstance(error, ProviderRequestError) and (error.category == "network_error" or
          error.status_code in (408, 425, 500, 502, 503, 504)))
        retryable = transient
        result = unavailable("network" if transient else getattr(error, "category", "provider_error"))
      finally:
        self.active = 0
      status = result.get("status") if isinstance(result, dict) and result.get("handledHttpError") else None
      if status == 429:
        self._activate_cooldown(result)
      transient = retryable and status in (408, 425, 500, 502, 503, 504)
      if transient and job.attempts < self.policy.max_attempts and self.now() + 1 < job.deadline:
        job.eligible = self.now() + 1 + self.jitter()
        self.queue.append(job)
        self._event("retry_scheduled", job)
        continue
      if status:
        self.counts["failed"] += 1
        self.last_failure = round(self.wall() * 1000)
        self.recent_errors.append({"at": self.last_failure, "endpoint": job.endpoint, "status": status})
        if self.store:
          await asyncio.to_thread(self.store.write, "ra-last-failure", {"at": self.last_failure, "endpoint": job.endpoint, "status": status})
        self._event("request_failed", job, status=status, durationMs=round((self.now() - started_at) * 1000))
      else:
        self._event("request_completed", job, durationMs=round((self.now() - started_at) * 1000))
      self._finish(job, result)

  def diagnostics(self) -> dict:
    return {"pending": len(self.queue), "active": self.active,
            "cooldownUntil": round(self.cooldown_until * 1000), "lastFailureAt": self.last_failure,
            "recentErrors": list(self.recent_errors), **self.counts}

  async def close(self) -> None:
    self.closed = True
    for job in list(self.jobs.values()):
      self._finish(job, unavailable("shutdown"))
    self.queue.clear()
    # Active HTTP is bounded by its socket timeout; it cannot dispatch more work.
