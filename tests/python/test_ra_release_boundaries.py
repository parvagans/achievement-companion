import asyncio
import tempfile
import time
import unittest
from contextlib import closing
from pathlib import Path
from test_backend_runtime import load_main_module
from backend.ra_coordinator import RaCoordinator, valid_payload
from backend.ra_scheduler import RaScheduler, SchedulerPolicy
from backend.ra_state import RaStateStore
from backend.ra_history import RaHistorySynchronizer

class ReleaseBoundaries(unittest.IsolatedAsyncioTestCase):
  async def asyncSetUp(self):
    self.directory=tempfile.TemporaryDirectory()
    self.store=RaStateStore(Path(self.directory.name)/"ra.sqlite3")
    self.scheduler=RaScheduler(policy=SchedulerPolicy(spacing_seconds=0,jitter_seconds=0),jitter=lambda:0)
    self.coordinator=RaCoordinator(self.store,self.scheduler,now=lambda:1700000000)
  async def asyncTearDown(self):
    await self.coordinator.close()
    await self.scheduler.close()
    self.directory.cleanup()

  async def test_small_oversize_small_and_durable_limit(self):
    payload=[{"ID":1,"Hashes":[]}]
    async def fetch(): return payload
    async def read(force=False):
      return await self.coordinator.ensure("API_GetGameList.php",{"c":1,"h":1},"alice",fetch,force=force)
    await read()
    payload=[{"ID":2,"Hashes":[],"padding":"x"*(17*1024*1024)}]
    large=await read(True)
    self.assertEqual((await read())["payload"][0]["ID"],2)
    self.assertEqual(self.coordinator.memory_bytes,0)
    self.assertFalse(self.coordinator.memory_sizes)
    self.assertEqual(self.store.resource(large["resourceKey"])["payload"][0]["ID"],2)
    payload=[{"ID":3,"Hashes":[],"padding":"x"*(33*1024*1024)}]
    await read(True)
    self.assertEqual((await read())["payload"][0]["ID"],3)
    payload=[{"ID":4,"Hashes":[]}]
    self.assertEqual((await read())["payload"][0]["ID"],4)

  async def test_malformed_rows_preserve_verified_recent_games(self):
    async def good(): return [{"GameID":1}]
    async def bad(): return [None]
    original=await self.coordinator.ensure("API_GetUserRecentlyPlayedGames.php",{},"alice",good)
    result=await self.coordinator.ensure("API_GetUserRecentlyPlayedGames.php",{},"alice",bad,force=True)
    self.assertEqual(result["payload"],original["payload"])
    self.assertEqual(result["cacheState"],"stale")

  async def test_history_bad_rows_do_not_advance_checkpoint(self):
    sync=RaHistorySynchronizer(self.store,self.coordinator,now=lambda:1700000000)
    async def good(start,end): return []
    initial=await sync.ensure("alice",1600000000,"alice",good,max_ranges=1)
    async def bad(start,end): return [None]
    result=await sync.ensure("alice",1600000000,"alice",bad,max_ranges=1)
    self.assertEqual(result["history"]["through"],initial["history"]["through"])
    self.assertEqual(result["history"]["lastSuccessAt"],initial["history"]["lastSuccessAt"])

  async def test_validation_rejects_missing_or_wrong_account_identity(self):
    module=load_main_module(Path(self.directory.name))
    for value in (None,[],{"Success":False},{"User":"Bob"},{"User":7}):
      module._request_json=lambda **kwargs:value
      result=await module.Plugin().validate_retroachievements_credentials({"username":"Alice","apiKey":"test"})
      self.assertFalse(result["ok"],value)
    for key in ("User","user","Username","username"):
      module._request_json=lambda **kwargs:{key:"aLiCe"}
      self.assertTrue((await module.Plugin().validate_retroachievements_credentials({"username":"Alice","apiKey":"test"}))["ok"])

  async def test_failure_cleanup_preserves_active_cooldowns_and_generation_fences(self):
    now=time.time()
    for i in range(140):
      self.store.write_resource_state(str(i),0,"failure:"+str(i),None)
    self.store.write("generation:protected",7)
    for i in range(140):
      self.store.write_resource_state("active"+str(i),0,"failure:active"+str(i),{"until":now+300,"generation":0})
    self.assertFalse(self.store.write_resource_state("protected",6,"failure:protected",None))
    self.assertEqual(self.store.read("generation:protected"),7)
    with closing(self.store._connect()) as connection:
      rows=connection.execute("SELECT value FROM state WHERE key LIKE 'failure:%'").fetchall()
    self.assertEqual(len(rows),140)
    self.assertTrue(all(value!="null" for (value,) in rows))

  def test_row_validation_keeps_empty_collections_and_aliases(self):
    for kind in ("systems","recent-games","recent-achievements","history-range","community-masters"):
      self.assertTrue(valid_payload(kind,[],{"f":"0","t":"1"}))
      self.assertFalse(valid_payload(kind,[None],{"f":"0","t":"1"}))
    self.assertTrue(valid_payload("recent-games",[{"gameId":"1"}],{}))
    self.assertTrue(valid_payload("recent-achievements",[{"gameId":"1","achievementId":"2"}],{}))
    self.assertFalse(valid_payload("completion-library",{"Results":[None]},{}))
    self.assertFalse(valid_payload("game-progress",{"ID":1,"Achievements":{"2":None}},{"g":"1"}))

if __name__ == "__main__": unittest.main()

