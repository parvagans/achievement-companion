from __future__ import annotations

import asyncio
import tempfile
import unittest
import random
from pathlib import Path

import _test_support  # noqa: F401
from backend.http import ProviderRequestError, parse_retry_after_ms
from backend.ra_scheduler import RaScheduler, SchedulerPolicy
from backend.ra_state import RaStateStore


class Clock:
  def __init__(self):
    self.value = 1000.0

  def now(self):
    return self.value

  async def sleep(self, seconds):
    self.value += seconds
    await asyncio.sleep(0)


class SchedulerTests(unittest.IsolatedAsyncioTestCase):
  def make(self, **kwargs):
    self.clock = Clock()
    return RaScheduler(monotonic=self.clock.now, wall=self.clock.now,
                       sleep=self.clock.sleep, jitter=lambda: 0, **kwargs)

  async def test_spacing_single_flight_and_priority(self):
    scheduler = self.make()
    started, release = asyncio.Event(), asyncio.Event()
    calls = []

    async def first():
      calls.append(("first", self.clock.now()))
      started.set()
      await release.wait()
      return {"ok": True}

    async def run(name):
      calls.append((name, self.clock.now()))
      return {"name": name}

    a = asyncio.create_task(scheduler.submit("first", "profile", first))
    await started.wait()
    joined = asyncio.create_task(scheduler.submit("first", "profile", first))
    low = asyncio.create_task(scheduler.submit("low", "community", lambda: run("low"), priority=3))
    high = asyncio.create_task(scheduler.submit("high", "progress", lambda: run("high"), priority=0))
    await asyncio.sleep(0)
    release.set()
    results = await asyncio.gather(a, joined, low, high)
    self.assertEqual(results[0], results[1])
    self.assertEqual([name for name, _ in calls], ["first", "high", "low"])
    self.assertTrue(all(b[1] - a[1] >= .75 for a, b in zip(calls, calls[1:])))
    self.assertEqual(scheduler.counts["sent"], 3)
    self.assertEqual(scheduler.counts["joined"], 1)
    await scheduler.close()

  async def test_cooldown_persists_and_retry_cannot_dispatch(self):
    with tempfile.TemporaryDirectory() as directory:
      store = RaStateStore(Path(directory) / "ra.sqlite3")
      scheduler = self.make(store=store)
      calls = 0

      async def limit():
        nonlocal calls
        calls += 1
        return {"handledHttpError": True, "status": 429, "retryAfterMs": 120000}

      first = await scheduler.submit("one", "profile", limit)
      self.assertEqual(first["status"], 429)
      retry = await scheduler.submit("retry", "profile", limit)
      self.assertEqual(retry["category"], "rate_limit")
      self.assertEqual(calls, 1)
      restarted = RaScheduler(store=store, wall=self.clock.now)
      self.assertEqual((await restarted.submit("again", "profile", limit))["status"], 429)
      self.assertEqual(calls, 1)
      self.clock.value += 121
      await scheduler.submit("eligible", "profile", limit)
      self.assertEqual(calls, 2)
      await scheduler.close()
      await restarted.close()

  async def test_transient_attempts_are_bounded_but_auth_is_not_retried(self):
    scheduler = self.make()
    calls = 0

    async def fail(status):
      nonlocal calls
      calls += 1
      return {"handledHttpError": True, "status": status}

    await scheduler.submit("transient", "profile", lambda: fail(503))
    self.assertEqual(calls, 2)
    await scheduler.submit("auth", "profile", lambda: fail(401))
    self.assertEqual(calls, 3)

    async def invalid():
      raise ProviderRequestError(provider_id="retroachievements", provider_label="RA", path="profile",
                                 category="invalid_json", duration_ms=0)

    before = scheduler.counts["sent"]
    await scheduler.submit("invalid", "profile", invalid)
    self.assertEqual(scheduler.counts["sent"], before + 1)
    await scheduler.close()

  async def test_queue_bound_deadline_and_shutdown(self):
    scheduler = self.make(policy=SchedulerPolicy(queue_limit=1))
    started, release = asyncio.Event(), asyncio.Event()

    async def blocking():
      started.set()
      await release.wait()
      return {"ok": True}

    active = asyncio.create_task(scheduler.submit("active", "profile", blocking))
    await started.wait()
    queued = asyncio.create_task(scheduler.submit("queued", "profile", blocking))
    await asyncio.sleep(0)
    self.assertEqual((await scheduler.submit("overflow", "profile", blocking))["category"], "queue_full")
    await scheduler.close()
    self.assertEqual((await queued)["category"], "shutdown")
    self.assertEqual((await active)["category"], "shutdown")
    release.set()
    await scheduler.worker
    self.assertEqual(scheduler.counts["sent"], 1)

  def test_retry_after_seconds_dates_and_invalid_values(self):
    self.assertEqual(parse_retry_after_ms("2.5", 0), 2500)
    self.assertEqual(parse_retry_after_ms("Thu, 01 Jan 1970 00:01:00 GMT", 0), 60000)
    for value in (None, "bad", "nan", "inf", "-1"):
      self.assertIsNone(parse_retry_after_ms(value, 0))

  async def test_one_thousand_independent_client_schedules_have_jitter_and_no_duplicate_dispatch(self):
    starts = []
    for seed in range(1000):
      clock = Clock()
      scheduler = RaScheduler(monotonic=clock.now, wall=clock.now, sleep=clock.sleep,
                              jitter=random.Random(seed).random)
      calls = []
      async def operation():
        calls.append(clock.now())
        return {"ok": True}
      await asyncio.gather(scheduler.submit("game", "progress", operation), scheduler.submit("game", "progress", operation))
      self.assertEqual(len(calls), 1)
      starts.append(calls[0])
      await scheduler.close()
    self.assertGreater(len(set(round(value, 3) for value in starts)), 500)
    self.assertGreater(max(starts) - min(starts), 1.9)

  async def test_aging_allows_optional_work_before_new_foreground_work(self):
    scheduler = self.make()
    started, release = asyncio.Event(), asyncio.Event()
    calls = []
    async def blocker():
      started.set()
      await release.wait()
      return {}
    first = asyncio.create_task(scheduler.submit("block", "profile", blocker, foreground_seconds=100))
    await started.wait()
    async def run(name):
      calls.append(name)
      return {}
    low = asyncio.create_task(scheduler.submit("low", "community", lambda: run("low"), priority=3, foreground_seconds=100))
    await asyncio.sleep(0)
    self.clock.value += 46
    high = asyncio.create_task(scheduler.submit("high", "profile", lambda: run("high"), priority=0, foreground_seconds=100))
    await asyncio.sleep(0)
    release.set()
    await asyncio.gather(first, low, high)
    self.assertEqual(calls, ["low", "high"])
    await scheduler.close()
