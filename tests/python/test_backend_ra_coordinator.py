from __future__ import annotations

import asyncio
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

import _test_support  # noqa: F401
from backend.ra_coordinator import RaCoordinator, account_scope, resource_identity
from backend.ra_scheduler import RaScheduler, SchedulerPolicy
from backend.ra_state import RaStateStore


class CoordinatorTests(unittest.IsolatedAsyncioTestCase):
  def setUp(self):
    self.temp = tempfile.TemporaryDirectory()
    self.store = RaStateStore(Path(self.temp.name) / "ra.sqlite3")
    self.time = 1000
    self.scheduler = RaScheduler(policy=SchedulerPolicy(spacing_seconds=0, jitter_seconds=0), jitter=lambda: 0)
    self.coordinator = RaCoordinator(self.store, self.scheduler, now=lambda: self.time)
    self.calls = 0

  def tearDown(self):
    self.temp.cleanup()

  async def profile(self):
    self.calls += 1
    return {"User": "alice"}

  async def ensure(self, coordinator=None, scope="alice", **kwargs):
    return await (coordinator or self.coordinator).ensure("API_GetUserProfile.php", {}, scope, self.profile, **kwargs)

  async def test_fresh_repeat_and_restart_issue_zero_additional_http_requests(self):
    self.assertEqual((await self.ensure())["cacheState"], "live")
    self.assertEqual((await self.ensure())["cacheState"], "fresh")
    restarted = RaCoordinator(self.store, self.scheduler, now=lambda: self.time)
    self.assertEqual((await self.ensure(restarted))["cacheState"], "fresh")
    self.assertEqual(self.calls, 1)

  async def test_stale_network_failure_preserves_payload_and_success_checkpoint(self):
    original = await self.ensure()
    self.time += 601

    async def failure():
      return {"handledHttpError": True, "status": 401}

    result = await self.coordinator.ensure("API_GetUserProfile.php", {}, "alice", failure)
    self.assertEqual(result["cacheState"], "stale")
    self.assertEqual(result["payload"], original["payload"])
    self.assertEqual(result["fetchedAt"], original["fetchedAt"])
    persisted = self.store.resource(result["resourceKey"])
    self.assertEqual(persisted["payload"], original["payload"])

  async def test_concurrent_surfaces_join_one_canonical_fetch(self):
    results = await asyncio.gather(*(self.ensure() for _ in range(8)))
    self.assertEqual(self.calls, 1)
    self.assertEqual(len({result["resourceKey"] for result in results}), 1)

  async def test_concurrent_manual_refreshes_share_hydration_and_dispatch(self):
    await self.ensure()
    self.calls = 0
    await asyncio.gather(*(self.ensure(force=True) for _ in range(20)))
    self.assertEqual(self.calls, 1)

  async def test_credentials_and_request_variants_have_distinct_identities(self):
    first = account_scope("alice", "secret-one")
    second = account_scope("alice", "secret-two")
    a = await self.ensure(scope=first)
    b = await self.ensure(scope=second)
    self.assertNotEqual(a["resourceKey"], b["resourceKey"])
    self.assertEqual(self.calls, 2)
    x = resource_identity("API_GetGameInfoAndUserProgress.php", {"g": 1, "a": 1}, first)[0]
    y = resource_identity("API_GetGameInfoAndUserProgress.php", {"a": "1", "g": "1"}, first)[0]
    self.assertEqual(x, y)
    self.assertNotIn("secret", x)

  async def test_invalid_payload_cannot_replace_last_known_good(self):
    original = await self.ensure()
    self.time += 601

    async def invalid():
      return {"Error": "upstream failure"}

    result = await self.coordinator.ensure("API_GetUserProfile.php", {}, "alice", invalid)
    self.assertEqual(result["payload"], original["payload"])
    self.assertEqual(result["cacheState"], "stale")

  async def test_invalidation_rejects_late_network_result(self):
    started, release = asyncio.Event(), asyncio.Event()

    async def blocked():
      started.set()
      await release.wait()
      return {"User": "alice"}

    request = asyncio.create_task(self.coordinator.ensure("API_GetUserProfile.php", {}, "alice", blocked))
    await started.wait()
    await self.coordinator.invalidate("alice")
    release.set()
    self.assertEqual((await request)["category"], "invalidated")
    key = resource_identity("API_GetUserProfile.php", {}, "alice")[0]
    self.assertIsNone(self.store.resource(key))

  async def test_storage_failure_does_not_fail_live_content(self):
    original = self.store.save_resource
    self.store.save_resource = lambda record: False
    result = await self.ensure()
    self.assertEqual(result["payload"], {"User": "alice"})
    self.assertEqual(self.coordinator.counts["writeFailures"], 1)
    self.store.save_resource = original

  async def test_schema_expiry_and_corrupt_entries_rebuild_individually(self):
    first = await self.ensure()
    await self.ensure(scope="other-account")
    import sqlite3
    with closing(sqlite3.connect(self.store.path)) as connection, connection:
      connection.execute("UPDATE resources SET payload='broken' WHERE key=?", (first["resourceKey"],))
    restarted = RaCoordinator(self.store, self.scheduler, now=lambda: self.time)
    self.assertEqual((await self.ensure(restarted))["cacheState"], "live")
    self.assertEqual((await self.ensure(restarted, scope="other-account"))["cacheState"], "fresh")
    self.assertEqual(self.calls, 3)
    with closing(sqlite3.connect(self.store.path)) as connection, connection:
      connection.execute("UPDATE resources SET schema_version=0 WHERE key=?", (first["resourceKey"],))
    restarted = RaCoordinator(self.store, self.scheduler, now=lambda: self.time)
    self.assertEqual((await self.ensure(restarted))["cacheState"], "live")
    self.assertEqual(self.calls, 4)

  async def test_memory_and_persistent_retention_are_bounded(self):
    self.coordinator.memory_limit = 2
    for scope in ("one", "two", "three"):
      await self.ensure(scope=scope)
    self.assertEqual(len(self.coordinator.memory), 2)
    record = next(iter(self.coordinator.memory.values()))
    record = {**record, "key": "retention-test"}
    self.assertTrue(self.store.save_resource(record, max_records=2))
    self.assertEqual(self.store.diagnostics()["resources"], 2)

  async def test_presence_expiry_dispatches_only_lightweight_summary(self):
    counts = {"profile": 0, "summary": 0}
    async def profile():
      counts["profile"] += 1
      return {"User": "alice"}
    async def summary():
      counts["summary"] += 1
      return {"User": "alice", "LastGameID": 42, "RichPresenceMsgDate": "2026-10-29 12:00:00"}
    await self.coordinator.ensure("API_GetUserProfile.php", {}, "alice", profile)
    await self.coordinator.ensure("API_GetUserSummary.php", {"g": 0, "a": 0}, "alice", summary)
    self.time += 120
    results = await asyncio.gather(*(self.coordinator.ensure("API_GetUserSummary.php", {"g": 0, "a": 0}, "alice", summary) for _ in range(5)))
    await self.coordinator.ensure("API_GetUserProfile.php", {}, "alice", profile)
    self.assertEqual(counts, {"profile": 1, "summary": 2})
    self.assertEqual(len({result["resourceKey"] for result in results}), 1)
    self.assertLessEqual(results[0]["freshUntil"] - results[0]["fetchedAt"], 45000)

  async def test_community_rpc_keeps_late_success_observable_without_another_dispatch(self):
    started, release = asyncio.Event(), asyncio.Event()
    async def response():
      self.calls += 1
      started.set()
      await release.wait()
      return {"MedianTimeToComplete": 57180, "TimesUsedInCompletionMedian": 4}
    self.coordinator.foreground_seconds = 0
    task = asyncio.create_task(self.coordinator.ensure("API_GetGameProgression.php", {"i": 1, "h": 1}, "alice", response))
    await started.wait()
    await asyncio.sleep(0)
    self.assertFalse(task.done(), "optional RPC must retain the eventual response after its UI's entry wait")
    joined = asyncio.create_task(self.coordinator.ensure("API_GetGameProgression.php", {"i": 1, "h": 1}, "alice", response))
    release.set()
    results = await asyncio.gather(task, joined)
    self.assertTrue(all(result["payload"]["MedianTimeToComplete"] == 57180 for result in results))
    self.assertEqual(self.calls, 1)

  async def test_partial_community_response_preserves_fields_through_sqlite_restoration(self):
    async def complete():
      return {"MedianTimeToComplete": 57180, "TimesUsedInCompletionMedian": 4,
              "MedianTimeToMaster": 63900, "TimesUsedInMasteryMedian": 5}
    async def partial():
      return {"TimesUsedInCompletionMedian": 0, "MedianTimeToComplete": None}
    await self.coordinator.ensure("API_GetGameProgression.php", {"i": 1}, "alice", complete)
    await self.coordinator.ensure("API_GetGameProgression.php", {"i": 1}, "alice", partial, force=True)
    restarted = RaCoordinator(self.store, self.scheduler, now=lambda: self.time)
    result = await restarted.ensure("API_GetGameProgression.php", {"i": 1}, "alice", self.profile)
    self.assertEqual(result["cacheState"], "fresh")
    self.assertEqual(result["payload"]["MedianTimeToMaster"], 63900)
    self.assertEqual(result["payload"]["TimesUsedInMasteryMedian"], 5)
    self.assertIsNone(result["payload"]["MedianTimeToComplete"])
    self.assertEqual(result["payload"]["TimesUsedInCompletionMedian"], 0)

  async def test_initial_write_invalidation_is_durable_across_restart(self):
    import threading
    entered, release = threading.Event(), threading.Event()
    save = self.store.save_resource
    def delayed(record, **kwargs):
      entered.set()
      release.wait(5)
      return save(record, **kwargs)
    self.store.save_resource = delayed
    task = asyncio.create_task(self.ensure())
    self.assertTrue(await asyncio.to_thread(entered.wait, 5))
    await self.coordinator.invalidate_resource("API_GetUserProfile.php", {}, "alice")
    release.set()
    result = await task
    self.assertEqual(result["category"], "invalidated")
    self.store.save_resource = save
    restarted = RaCoordinator(self.store, self.scheduler, now=lambda: self.time)
    result = await self.ensure(restarted)
    self.assertEqual(self.calls, 2)
    self.assertEqual(result["cacheState"], "live")
    self.assertEqual((await self.ensure(restarted))["cacheState"], "fresh")

  async def test_active_community_success_after_scheduler_wait_is_persisted_and_shared(self):
    self.scheduler.policy = SchedulerPolicy(spacing_seconds=0, jitter_seconds=0, background_seconds=.01)
    started, release = asyncio.Event(), asyncio.Event()
    async def response():
      self.calls += 1
      started.set()
      await release.wait()
      return {"MedianTimeToMaster": 123}
    task = asyncio.create_task(self.coordinator.ensure("API_GetGameProgression.php", {"i":1}, "alice", response))
    await started.wait()
    await asyncio.sleep(.02)
    self.assertFalse(task.done())
    joined = asyncio.create_task(self.coordinator.ensure("API_GetGameProgression.php", {"i":1}, "alice", response))
    release.set()
    values = await asyncio.gather(task, joined)
    self.assertEqual(self.calls,1)
    self.assertTrue(all(v["payload"]["MedianTimeToMaster"] == 123 for v in values))
    self.assertIsNotNone(self.store.resource(values[0]["resourceKey"]))

  async def test_completion_collection_refresh_reorders_all_pages_and_keeps_previous_on_failure(self):
    ids = list(range(1,502))
    offsets = []
    fail = False
    async def page(offset):
      offsets.append(offset)
      if fail and offset == 500:
        return {"handledHttpError":True,"status":401}
      return {"Total":len(ids),"Results":[{"GameID":i,"NumAwarded":i,"MaxPossible":1000} for i in ids[offset:offset+500]]}
    async def load(force=False):
      return await self.coordinator.ensure_completion_collection({"u":"alice"},"alice",page,force=force)
    first = await load()
    self.assertEqual(offsets,[0,500,0])
    await load(); self.assertEqual(len(offsets),3)
    ids.insert(0,ids.pop())
    a,b = await asyncio.gather(load(True),load(True))
    games=a["payload"]["Results"]
    self.assertEqual(a,b)
    self.assertEqual(len({g["GameID"] for g in games}),501)
    self.assertEqual(games[0]["GameID"],501)
    self.assertEqual(len(offsets),6)
    fail=True
    failed = await load(True)
    self.assertEqual(failed["cacheState"],"stale")
    self.assertEqual(failed["payload"],a["payload"])

  async def test_mid_pagination_drift_is_bounded_and_never_publishes_a_mixture(self):
    calls=0
    async def page(offset):
      nonlocal calls
      calls+=1
      ids=list(range(1,502)) if offset==0 else [501]+list(range(1,501))
      return {"Total":501,"Results":[{"GameID":i} for i in ids[offset:offset+500]]}
    result=await self.coordinator.ensure_completion_collection({"u":"alice"},"alice",page)
    self.assertEqual(result["category"],"inconsistent_collection")
    self.assertEqual(calls,4)
    self.assertFalse(any(record["kind"]=="completion-library" for record in self.coordinator.memory.values()))

  async def test_durable_fence_rejects_concurrent_obsolete_writes_but_accepts_successor(self):
    from concurrent.futures import ThreadPoolExecutor
    first = await self.ensure()
    record = self.store.resource(first["resourceKey"])
    await self.coordinator.invalidate_resource("API_GetUserProfile.php", {}, "alice")
    with ThreadPoolExecutor(max_workers=2) as pool:
      self.assertEqual(list(pool.map(self.store.save_resource,[record,record])),[False,False])
    restored=RaCoordinator(self.store,self.scheduler,now=lambda:self.time)
    result=await self.ensure(restored)
    self.assertEqual(result["cacheState"],"live")
    self.assertEqual(self.calls,2)
    self.assertGreater(self.store.resource(first["resourceKey"])["generation"],record["generation"])

  async def test_completion_collection_identity_is_scoped_while_first_account_is_in_flight(self):
    entered,release=asyncio.Event(),asyncio.Event()
    calls=[]
    async def page_a(offset):
      calls.append("a");entered.set();await release.wait()
      return {"Total":1,"Results":[{"GameID":1}]}
    async def page_b(offset):
      calls.append("b");return {"Total":1,"Results":[{"GameID":2}]}
    a=asyncio.create_task(self.coordinator.ensure_completion_collection({"u":"a"},"a",page_a))
    await entered.wait()
    b=asyncio.create_task(self.coordinator.ensure_completion_collection({"u":"b"},"b",page_b))
    release.set()
    x,y=await asyncio.gather(a,b)
    self.assertNotEqual(x["resourceKey"],y["resourceKey"])
    self.assertEqual(x["payload"]["Results"],[{"GameID":1}])
    self.assertEqual(y["payload"]["Results"],[{"GameID":2}])
    self.assertEqual(calls,["a","b"])


  async def test_invalidation_during_history_reconciliation_cannot_publish_old_live_result(self):
    import threading
    entered, release = threading.Event(), threading.Event()
    reconcile = self.store.reconcile_history_game
    first = True
    def delayed(*args):
      nonlocal first
      if first:
        first = False
        entered.set()
        release.wait(5)
      return reconcile(*args)
    self.store.reconcile_history_game = delayed
    path, query = "API_GetGameInfoAndUserProgress.php", {"g":1,"a":1}
    calls = []
    def payload(n):
      return {"ID":1,"NumAchievements":2,"NumAwardedToUser":n,"NumAwardedToUserHardcore":n,
        "Achievements":{str(i):{"ID":i,**({"DateEarned":"1970-01-01 00:01:00","DateEarnedHardcore":"1970-01-01 00:01:00"} if i<=n else {})} for i in (1,2)}}
    async def old(): calls.append(1); return payload(1)
    async def new(): calls.append(2); return payload(2)
    a = asyncio.create_task(self.coordinator.ensure(path,query,"alice",old))
    self.assertTrue(await asyncio.to_thread(entered.wait,5))
    await self.coordinator.invalidate_resource(path,query,"alice")
    b = await self.coordinator.ensure(path,query,"alice",new)
    release.set()
    result = await a
    self.assertEqual(result["category"],"invalidated")
    key=b["resourceKey"]
    self.assertEqual(self.coordinator.memory[key]["payload"]["NumAwardedToUser"],2)
    self.assertEqual(self.store.resource(key)["payload"]["NumAwardedToUser"],2)
    self.assertEqual((await self.coordinator.ensure(path,query,"alice",new))["cacheState"],"fresh")
    self.assertEqual(calls,[1,2])

  async def test_bulk_invalidation_barrier_covers_existing_rows_and_concurrent_new_entries(self):
    import threading
    await self.ensure()
    await self.ensure(scope="bob")
    entered, release = threading.Event(), threading.Event()
    invalidate = self.store.invalidate_key
    def delayed(key):
      entered.set()
      release.wait(5)
      return invalidate(key)
    self.store.invalidate_key = delayed
    task=asyncio.create_task(self.coordinator.invalidate("alice","profile"))
    self.assertTrue(await asyncio.to_thread(entered.wait,5))
    registered=asyncio.Event()
    async def recent(): registered.set(); return {"User":"alice"}
    concurrent=asyncio.create_task(self.coordinator.ensure("API_GetUserProfile.php",{"u":"new-variant"},"alice",recent))
    # Event-loop barrier rather than a wall-clock sleep.
    await asyncio.get_running_loop().run_in_executor(None,lambda:None)
    self.assertFalse(registered.is_set())
    release.set();await task;await concurrent
    key=resource_identity("API_GetUserProfile.php",{},"alice")[0]
    self.assertEqual(self.store.resource(key)["fresh_until"],0)
    self.assertEqual((await self.ensure(scope="bob"))["cacheState"],"fresh")
    restarted=RaCoordinator(self.store,self.scheduler,now=lambda:self.time)
    self.assertEqual((await self.ensure(restarted))["cacheState"],"live")


  async def test_delayed_hydration_cannot_overwrite_same_generation_publication(self):
    import threading
    await self.ensure()
    c=RaCoordinator(self.store,self.scheduler,now=lambda:self.time)
    original=self.store.resource
    entered,release=threading.Event(),threading.Event()
    block=True
    def delayed(key):
      nonlocal block
      row=original(key)
      if block:
        block=False;entered.set();release.wait(5)
      return row
    self.store.resource=delayed
    calls=[]
    async def newer(): calls.append(1);return {"User":"alice","TotalPoints":200}
    a=asyncio.create_task(c.ensure("API_GetUserProfile.php",{},"alice",newer))
    self.assertTrue(await asyncio.to_thread(entered.wait,5))
    b=await c.ensure("API_GetUserProfile.php",{},"alice",newer,force=True)
    release.set();result=await a
    self.assertEqual(result["payload"],b["payload"])
    self.assertEqual(c.memory[b["resourceKey"]]["payload"]["TotalPoints"],200)
    self.assertEqual(original(b["resourceKey"])["payload"]["TotalPoints"],200)
    self.assertEqual((await c.ensure("API_GetUserProfile.php",{},"alice",newer))["payload"],b["payload"])
    self.assertEqual(calls,[1]);self.assertFalse(c.hydrations)

  async def test_hydration_revoked_by_invalidation_does_not_restore_fresh(self):
    import threading
    await self.ensure()
    c=RaCoordinator(self.store,self.scheduler,now=lambda:self.time)
    original=self.store.resource;entered,release=threading.Event(),threading.Event();block=True
    def delayed(key):
      nonlocal block
      row=original(key)
      if block:block=False;entered.set();release.wait(5)
      return row
    self.store.resource=delayed
    a=asyncio.create_task(self.ensure(c))
    self.assertTrue(await asyncio.to_thread(entered.wait,5))
    await c.invalidate_resource("API_GetUserProfile.php",{},"alice")
    release.set();result=await a
    self.assertEqual(result["cacheState"],"live");self.assertEqual(self.calls,2)
    self.assertFalse(c.hydrations)

  async def test_cancelled_bulk_caller_retains_barrier_until_all_fences_and_shutdown_complete(self):
    import threading
    for n in (1,2):await self.coordinator.ensure("API_GetUserProfile.php",{"v":n},"alice",self.profile)
    await self.ensure(scope="bob")
    entered,release=threading.Event(),threading.Event();original=self.store.invalidate_key;block=True
    def delayed(key):
      nonlocal block
      if block:block=False;entered.set();release.wait(5)
      return original(key)
    self.store.invalidate_key=delayed
    task=asyncio.create_task(self.coordinator.invalidate("alice","profile"))
    self.assertTrue(await asyncio.to_thread(entered.wait,5));task.cancel()
    with self.assertRaises(asyncio.CancelledError):await task
    self.assertTrue(self.coordinator.scope_locks["alice"].locked())
    entry=asyncio.create_task(self.ensure())
    self.assertEqual((await self.ensure(scope="bob"))["cacheState"],"fresh")
    close=asyncio.create_task(self.coordinator.close())
    self.assertFalse(entry.done());self.assertFalse(close.done())
    release.set();await close
    for n in (1,2):
      row=self.store.resource(resource_identity("API_GetUserProfile.php",{"v":n},"alice")[0])
      self.assertGreater(row["generation"],0);self.assertEqual(row["fresh_until"],0)
    await entry;self.assertFalse(self.coordinator.scope_locks["alice"].locked())
    self.assertFalse(self.coordinator.invalidations)
    restarted=RaCoordinator(self.store,self.scheduler,now=lambda:self.time)
    for n in (1,2):self.assertEqual((await restarted.ensure("API_GetUserProfile.php",{"v":n},"alice",self.profile))["cacheState"],"live")

  async def test_invalidation_failure_is_reported_and_releases_barrier(self):
    await self.ensure()
    original=self.store.invalidate_key
    def failed(key):raise OSError("simulated storage failure")
    self.store.invalidate_key=failed
    with self.assertRaises(OSError):await self.coordinator.invalidate("alice","profile")
    self.assertFalse(self.coordinator.scope_locks["alice"].locked())
    self.store.invalidate_key=original
    await self.coordinator.invalidate("alice","profile")
    self.assertEqual((await self.ensure())["cacheState"],"live")


  async def test_hydration_fencing_survives_eviction_and_isolates_accounts(self):
    import threading
    await self.ensure()
    c=RaCoordinator(self.store,self.scheduler,now=lambda:self.time,memory_limit=1)
    original=self.store.resource;entered,release=threading.Event(),threading.Event();block=True
    def delayed(key):
      nonlocal block
      row=original(key)
      if block:block=False;entered.set();release.wait(5)
      return row
    self.store.resource=delayed
    calls=[]
    async def updated():calls.append(1);return {"User":"alice","TotalPoints":200}
    a=asyncio.create_task(c.ensure("API_GetUserProfile.php",{},"alice",updated))
    self.assertTrue(await asyncio.to_thread(entered.wait,5))
    await c.ensure("API_GetUserProfile.php",{},"alice",updated,force=True)
    async def bob():return {"User":"bob","TotalPoints":300}
    await c.ensure("API_GetUserProfile.php",{},"bob",bob)
    release.set();result=await a
    self.assertEqual(result["payload"]["TotalPoints"],200);self.assertEqual(calls,[1])
    self.assertFalse(c.hydrations)
    restarted=RaCoordinator(self.store,self.scheduler,now=lambda:self.time)
    self.assertEqual((await restarted.ensure("API_GetUserProfile.php",{},"alice",updated))["payload"]["TotalPoints"],200)
    self.assertEqual(calls,[1])


  async def test_cancelled_repair_group_still_invalidates_later_kinds(self):
    import threading
    await self.ensure()
    async def recent():return []
    await self.coordinator.ensure("API_GetUserRecentlyPlayedGames.php",{},"alice",recent)
    entered,release=threading.Event(),threading.Event();original=self.store.invalidate_key;block=True
    def delayed(key):
      nonlocal block
      if block:block=False;entered.set();release.wait(5)
      return original(key)
    self.store.invalidate_key=delayed
    task=asyncio.create_task(self.coordinator.invalidate_kinds("alice",("profile","recent-games")))
    self.assertTrue(await asyncio.to_thread(entered.wait,5));task.cancel()
    with self.assertRaises(asyncio.CancelledError):await task
    release.set();await self.coordinator.close()
    for path in ("API_GetUserProfile.php","API_GetUserRecentlyPlayedGames.php"):
      self.assertEqual(self.store.resource(resource_identity(path,{},"alice")[0])["fresh_until"],0)

  async def test_admitted_refresh_waits_for_successor_durable_generation(self):
    import threading
    await self.ensure()
    entered, release, durable, finish = (threading.Event() for _ in range(4))
    read, invalidate = self.store.read, self.store.invalidate_key
    first = True
    def paused_read(key):
      nonlocal first
      value = read(key)
      if key.startswith("generation:") and first:
        first = False; entered.set(); release.wait(5)
      return value
    def paused_invalidate(key):
      durable.set(); finish.wait(5); return invalidate(key)
    self.store.read, self.store.invalidate_key = paused_read, paused_invalidate
    a = asyncio.create_task(self.ensure(force=True))
    self.assertTrue(await asyncio.to_thread(entered.wait,5))
    invalidating = asyncio.create_task(self.coordinator.invalidate("alice","profile"))
    self.assertTrue(await asyncio.to_thread(durable.wait,5))
    release.set()
    self.assertEqual((await self.ensure(scope="bob"))["cacheState"],"live")
    self.assertFalse(a.done())
    finish.set(); await invalidating; result = await a
    key = result["resourceKey"]
    self.assertEqual(self.coordinator.memory[key]["generation"], self.store.resource(key)["generation"])
    count = self.calls
    self.assertEqual((await self.ensure())["cacheState"],"fresh")
    self.assertEqual(self.calls,count)
    self.assertEqual(count,3) # alice population, unrelated bob, alice successor

  async def test_shutdown_drains_other_invalidation_after_failure_and_rejects_new_work(self):
    import threading
    await self.ensure(); await self.ensure(scope="bob")
    akey=resource_identity("API_GetUserProfile.php",{},"alice")[0]
    ea,eb,ra,rb=(threading.Event() for _ in range(4))
    original=self.store.invalidate_key
    def operation(key):
      if key==akey:
        ea.set();ra.wait(5);raise OSError("disk failure")
      eb.set();rb.wait(5);return original(key)
    self.store.invalidate_key=operation
    a=asyncio.create_task(self.coordinator.invalidate("alice"))
    b=asyncio.create_task(self.coordinator.invalidate("bob"))
    self.assertTrue(await asyncio.to_thread(ea.wait,5));self.assertTrue(await asyncio.to_thread(eb.wait,5))
    closing=asyncio.create_task(self.coordinator.close())
    await asyncio.sleep(0);ra.set()
    with self.assertRaises(OSError):await a
    self.assertFalse(closing.done());self.assertTrue(self.coordinator.scope_locks["bob"].locked())
    self.assertEqual((await self.ensure())["category"],"shutdown")
    with self.assertRaises(RuntimeError):await self.coordinator.invalidate("alice")
    rb.set();await b
    with self.assertRaises(OSError):await closing
    self.assertFalse(self.coordinator.invalidations)
    self.assertFalse(self.coordinator.scope_locks["bob"].locked())

  async def test_cancelled_shutdown_still_waits_for_durable_worker(self):
    import threading
    await self.ensure()
    entered,release=threading.Event(),threading.Event();original=self.store.invalidate_key
    def operation(key):entered.set();release.wait(5);return original(key)
    self.store.invalidate_key=operation
    work=asyncio.create_task(self.coordinator.invalidate("alice"))
    self.assertTrue(await asyncio.to_thread(entered.wait,5))
    closing=asyncio.create_task(self.coordinator.close());await asyncio.sleep(0);closing.cancel();await asyncio.sleep(0)
    self.assertFalse(closing.done());release.set();await work
    with self.assertRaises(asyncio.CancelledError):await closing
    self.assertFalse(self.coordinator.invalidations)

  async def test_shutdown_reports_both_failures_after_all_tasks_settle(self):
    entered = [asyncio.Event(),asyncio.Event()]; release = [asyncio.Event(),asyncio.Event()]
    async def operation(index):
      entered[index].set();await release[index].wait();raise OSError(str(index))
    tasks=[asyncio.create_task(self.coordinator._own_invalidation(operation(i))) for i in range(2)]
    await asyncio.gather(*(e.wait() for e in entered))
    closing=asyncio.create_task(self.coordinator.close());await asyncio.sleep(0)
    release[0].set()
    with self.assertRaises(OSError):await tasks[0]
    self.assertFalse(closing.done());release[1].set()
    with self.assertRaises(OSError):await tasks[1]
    with self.assertRaises(OSError):await closing
    self.assertFalse(self.coordinator.invalidations)

  async def test_empty_shutdown_and_repeated_close_are_safe(self):
    await self.coordinator.close();await self.coordinator.close()
    self.assertFalse(self.coordinator.invalidations)
