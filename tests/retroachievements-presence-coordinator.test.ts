import assert from "node:assert/strict";
import test from "node:test";
import { createRaPresenceCoordinator, parseRaPresence, projectRaPresence } from "../src/platform/decky/retroachievements-presence-coordinator";
import { getRetroAchievementsActiveGameId } from "../src/platform/decky/decky-retroachievements-current-game";
import type { RaResourceResult } from "../src/platform/decky/retroachievements-data-coordinator";
import type { DashboardSnapshot } from "../src/core/domain";

const flush = async () => { for (let n = 0; n < 12; n += 1) await Promise.resolve(); };
function fixture() {
  let now = 1_800_000_000_000, revision = 1, calls = 0;
  let response: Record<string, unknown> = { LastGameID: 0, RichPresenceMsgDate: null };
  let cache: RaResourceResult<unknown> | undefined;
  let failure: unknown;
  const timers = new Set<{ at: number; callback: () => void }>();
  const triggers: string[] = [];
  const coordinator = createRaPresenceCoordinator({
    revision: () => revision, now: () => now, read: () => cache,
    fetch: async (trigger) => {
      calls += 1; triggers.push(trigger);
      if (failure !== undefined) throw failure;
      cache = { raResource: 1, resourceKey: "summary", payload: { ...response }, cacheState: "live", fetchedAt: now, freshUntil: now + 45000 };
      return cache;
    },
    schedule(callback, ms) { const timer = { at: now + ms, callback }; timers.add(timer); return timer; },
    cancel(timer) { timers.delete(timer as { at: number; callback: () => void }); },
  });
  return { coordinator, triggers, now: () => now, calls: () => calls,
    account() { revision += 1; }, failure(value: unknown) { failure = value; },
    game(id: number, date = now) { response = { LastGameID: id, RichPresenceMsgDate: new Date(date).toISOString() }; },
    response(value: Record<string, unknown>) { response = value; },
    async advance(ms: number) {
      const target = now + ms;
      for (;;) {
        const next = [...timers].filter((timer) => timer.at <= target).sort((a, b) => a.at - b.at)[0];
        if (next === undefined) break;
        now = next.at; timers.delete(next); next.callback(); await flush();
      }
      now = target; await flush();
    },
  };
}
const dashboard: DashboardSnapshot = {
  profile: { providerId: "retroachievements", identity: { providerId: "retroachievements", accountId: "a", displayName: "A" },
    summary: { unlockedCount: 9 }, metrics: [{ key: "rank", label: "Rank", value: "10" }] },
  featuredGames: [], recentlyPlayedGames: [], recentAchievements: [], recentUnlocks: [],
};

for (const entry of ["qam-entry", "full-screen-entry"] as const) {
  test(`profile cached two minutes ago cannot suppress presence on ${entry}`, async () => {
    const f = fixture();
    await f.coordinator.ensure(entry);
    await f.advance(120000);
    f.game(42);
    const value = await f.coordinator.ensure(entry);
    assert.equal(f.calls(), 2);
    assert.equal(getRetroAchievementsActiveGameId(projectRaPresence(dashboard, value).profile, f.now()), "42");
    assert.equal(dashboard.profile.summary.unlockedCount, 9);
  });
}
test("QAM/full-screen entry share one request and repeated fresh entry sends none", async () => {
  const f = fixture(); f.game(42);
  await Promise.all([f.coordinator.ensure("qam-entry"), f.coordinator.ensure("full-screen-entry")]);
  await f.advance(30000);
  await f.coordinator.ensure("qam-entry");
  assert.equal(f.calls(), 1);
});
test("launch invalidates presence only and debounces repeated lifetime notifications", async () => {
  const f = fixture(); await f.coordinator.ensure("qam-entry"); f.game(42);
  f.coordinator.lifecycle("shortcut", true, "42");
  f.coordinator.lifecycle("shortcut", true, "42");
  await f.advance(250);
  assert.equal(f.calls(), 2);
  assert.equal(f.coordinator.read()?.gameId, "42");
  assert.equal(f.triggers.at(-1), "game-launch");
});
test("delayed launch heartbeat is recognized with two bounded follow-ups", async () => {
  const f = fixture(); await f.coordinator.ensure("qam-entry");
  f.coordinator.lifecycle("shortcut", true, "42"); await f.advance(250);
  await f.advance(15000); assert.equal(f.calls(), 3);
  f.game(42); await f.advance(30000);
  assert.equal(f.coordinator.read()?.gameId, "42");
  assert.equal(f.calls(), 4);
  await f.advance(300000); assert.equal(f.calls(), 4, "no hidden polling after the bounded launch checks");
});
test("a game that never supplies presence stops launch checks", async () => {
  const f = fixture(); f.coordinator.lifecycle("shortcut", true, "42"); await f.advance(250);
  await f.advance(300000); assert.equal(f.calls(), 3);
});
test("exit suppresses only the mapped old heartbeat and preserves newer remote activity", async () => {
  const f = fixture(); f.game(42); await f.coordinator.ensure("qam-entry");
  await f.advance(1000); f.coordinator.lifecycle("shortcut", false, "42"); await f.advance(250);
  assert.equal(f.coordinator.read()?.suppressed, true);
  assert.equal(getRetroAchievementsActiveGameId(projectRaPresence(dashboard, f.coordinator.read()).profile, f.now()), undefined);
  f.game(99); await f.advance(15000);
  assert.equal(f.coordinator.read()?.gameId, "99");
  assert.equal(f.coordinator.read()?.suppressed, undefined);
});
test("restarting the same game removes the prior local exit suppression", async () => {
  const f = fixture(); f.game(42); await f.coordinator.ensure("qam-entry");
  f.coordinator.lifecycle("shortcut", false, "42"); await f.advance(250);
  await f.advance(1000); f.game(42); f.coordinator.lifecycle("shortcut", true, "42"); await f.advance(250);
  assert.equal(f.coordinator.read()?.suppressed, undefined);
});
test("visible checks recognize emulator and remote game switching without process restarts", async () => {
  const f = fixture(); f.game(42);
  const stop = f.coordinator.visible("qam-entry"); await f.advance(250);
  f.game(99); await f.advance(60000);
  assert.equal(f.coordinator.read()?.gameId, "99");
  stop(); await f.advance(600000); assert.equal(f.calls(), 2);
});
test("429 preserves cached activity, suppresses follow-ups and honors shared eligibility", async () => {
  const f = fixture(); f.game(42); await f.coordinator.ensure("qam-entry");
  f.failure({ status: 429, retryAfterMs: 120000 });
  f.coordinator.lifecycle("shortcut", true, "99"); await f.advance(250);
  await f.advance(60000); await f.coordinator.ensure("qam-entry");
  assert.equal(f.calls(), 2);
  assert.equal(f.coordinator.read()?.gameId, "42");
});
test("presence merging preserves points, rank, collections, history and the original snapshot", async () => {
  const f = fixture(); f.game(42); const presence = await f.coordinator.ensure("qam-entry");
  const merged = projectRaPresence(dashboard, presence);
  assert.equal(merged.profile.summary, dashboard.profile.summary);
  assert.equal(merged.profile.metrics, dashboard.profile.metrics);
  assert.equal(merged.recentlyPlayedGames, dashboard.recentlyPlayedGames);
  assert.equal(merged.recentUnlocks, dashboard.recentUnlocks);
  assert.equal(dashboard.profile.richPresenceGameId, undefined);
});
test("all subscribers receive targeted successful presence changes", async () => {
  const f = fixture(); let qam = 0, full = 0;
  f.coordinator.subscribe(() => qam++); f.coordinator.subscribe(() => full++);
  f.game(42); await f.coordinator.ensure("qam-entry");
  f.game(99); f.coordinator.lifecycle("shortcut", true, "99"); await f.advance(250);
  assert.equal(qam, 2); assert.equal(full, 2);
});
test("stale, missing or invalid identity/date cannot borrow the other half of a pair", async () => {
  const f = fixture(); f.game(42, f.now() - 601000);
  let value = await f.coordinator.ensure("qam-entry");
  assert.equal(getRetroAchievementsActiveGameId(projectRaPresence(dashboard, value).profile, f.now()), undefined);
  f.response({ LastGameID: "invalid", RichPresenceMsgDate: new Date(f.now()).toISOString() });
  value = await f.coordinator.ensure("qam-entry", true); assert.equal(value?.gameId, undefined);
  f.response({ LastGameID: 42 });
  const result: RaResourceResult<unknown> = { raResource: 1, resourceKey: "s", payload: { LastGameID: 42 }, cacheState: "live", fetchedAt: 1, freshUntil: 2 };
  assert.equal(parseRaPresence(result), undefined);
});
test("old account results cannot publish after an account revision", async () => {
  let revision = 1, release!: (value: RaResourceResult<unknown>) => void;
  const coordinator = createRaPresenceCoordinator({ revision: () => revision, read: () => undefined,
    fetch: () => new Promise((resolve) => { release = resolve; }) });
  const pending = coordinator.ensure("qam-entry"); revision = 2; coordinator.reset();
  release({ raResource: 1, resourceKey: "s", payload: { LastGameID: 42, RichPresenceMsgDate: new Date().toISOString() }, cacheState: "live", fetchedAt: Date.now(), freshUntil: Date.now() + 45000 });
  await pending; assert.equal(coordinator.read(), undefined);
});

test("a response started before a newer lifecycle generation cannot publish the old game", async () => {
  const now = 1_800_000_000_000;
  let release!: (value: RaResourceResult<unknown>) => void, calls = 0;
  let raw: RaResourceResult<unknown> | undefined;
  let fire: (() => void) | undefined;
  const observed: (string | undefined)[] = [];
  const result = (id: number): RaResourceResult<unknown> => ({ raResource: 1, resourceKey: "s",
    payload: { LastGameID: id, RichPresenceMsgDate: new Date(now).toISOString() }, cacheState: "live", fetchedAt: now, freshUntil: now + 45000 });
  const coordinator = createRaPresenceCoordinator({ revision: () => 1, now: () => now, read: () => raw,
    schedule(callback) { fire = callback; return 1; }, cancel() {},
    fetch: async () => {
      if (++calls === 1) return new Promise((resolve) => { release = (value) => { raw = value; resolve(value); }; });
      raw = result(42); return raw;
    },
  });
  coordinator.subscribe(() => observed.push(coordinator.read()?.gameId));
  const old = coordinator.ensure("qam-entry");
  coordinator.lifecycle("shortcut", true, "42");
  release(result(99)); await old; fire?.(); await flush();
  assert.equal(calls, 2);
  assert.deepEqual(observed, ["42"]);
  coordinator.dispose();
});

test("unmapped emulator exit uses the locally observed session and suppresses only its old heartbeat", async () => {
  let now = 1800000000000, recentCalls=0, calls=0;
  let heartbeat=now, gameId=42;
  const timers = new Set<{callback:()=>void,at:number}>();
  const c=createRaPresenceCoordinator({ revision:()=>1, now:()=>now, read:()=>undefined,
    fetch:async()=>{calls++;return {raResource:1,resourceKey:"p",cacheState:"live",fetchedAt:now,freshUntil:now+45000,payload:{LastGameID:gameId,RichPresenceMsgDate:new Date(heartbeat).toISOString()}}},
    fetchRecent:async()=>{recentCalls++;return []},schedule(callback,ms){const t={callback,at:now+ms};timers.add(t);return t},cancel(t){timers.delete(t as {callback:()=>void,at:number})}});
  c.lifecycle("123",true,undefined,"emulator"); now+=1000; heartbeat=now; await c.ensure("qam-entry");
  assert.equal(c.observedSessions()[0]?.localAppId,"123");
  c.lifecycle("123",false); now+=250;
  for(const timer of [...timers]) if(timer.at<=now){timers.delete(timer);timer.callback()}
  await flush(); assert.equal(c.read()?.suppressed,true); assert.equal(recentCalls,1);
  assert.equal(c.observedSessions()[0]?.endedAt !== undefined,true);
  heartbeat=now+1; now+=2; await c.ensure("scheduled-validation",true);
  assert.equal(c.read()?.suppressed,undefined);
  gameId=99; await c.ensure("scheduled-validation",true); assert.equal(c.read()?.gameId,"99");
  assert.equal(calls,4); c.dispose();
});

test("persisted local process association survives coordinator restart and an unmapped exit", async () => {
  let now=1800000000000;
  const c=createRaPresenceCoordinator({revision:()=>1,now:()=>now,read:()=>undefined,
    loadSessions:async()=>[{gameId:"42",observedAt:now-1000,heartbeatAt:now-1000,localAppId:"123",localOwnership:"emulator"}],
    fetch:async()=>({raResource:1,resourceKey:"p",payload:{LastGameID:42,RichPresenceMsgDate:new Date(now-1000).toISOString()},cacheState:"live",fetchedAt:now,freshUntil:now+45000}),
    schedule:()=>0,cancel:()=>undefined});
  await c.hydrate(); await c.ensure("qam-entry");
  now+=100; c.lifecycle("123",false);
  assert.equal(c.read()?.suppressed,true); assert.ok(c.observedSessions()[0]?.endedAt);
  c.dispose();
});


for (const eligible of [false,true]) test(`exit ownership reconciles stale ROM projection; emulator=${eligible}`, async()=>{
  let now=1800000000000,game=10,heartbeat=now,recent=0,calls=0;
  const c=createRaPresenceCoordinator({revision:()=>1,now:()=>now,read:()=>undefined,schedule:()=>0,cancel:()=>{},
    fetch:async()=>{calls++;return {raResource:1,resourceKey:"p",cacheState:"live",fetchedAt:now,freshUntil:now+45000,
      payload:{LastGameID:game,RichPresenceMsgDate:new Date(heartbeat).toISOString()}}},fetchRecent:async()=>{recent++;return []}});
  c.lifecycle("123",true,undefined,eligible?"emulator":"unknown"); now+=1000;heartbeat=now;
  await c.ensure("qam-entry");
  if(eligible){game=20;now+=1000;heartbeat=now;await c.ensure("scheduled-validation",true);}
  await flush();const before=recent;now+=1000;c.lifecycle("123",false,eligible?"10":undefined);
  assert.equal(c.read()?.suppressed,eligible?true:undefined);
  assert.equal(recent,before+(eligible?1:0));
  assert.equal(c.observedSessions().find(s=>s.gameId===String(game))?.localAppId,eligible?"123":undefined);
  c.lifecycle("123",false,eligible?"10":undefined);assert.equal(recent,before+(eligible?1:0));
  heartbeat=now+1;now+=2;await c.ensure("scheduled-validation",true);assert.equal(c.read()?.suppressed,undefined);
  assert.equal(calls,eligible?3:2);c.dispose();
});


for (const legacy of [false,true]) test(`uncorroborated emulator activity and legacy association cannot suppress account presence; legacy=${legacy}`,async()=>{
 let now=1800000000000;
 const c=createRaPresenceCoordinator({revision:()=>1,now:()=>now,read:()=>undefined,schedule:()=>0,cancel:()=>{},
  loadSessions:async()=>legacy?[{gameId:"99",observedAt:now-1000,heartbeatAt:now-1000,localAppId:"123"}]:[],
  fetch:async()=>({raResource:1,resourceKey:"p",cacheState:"live",fetchedAt:now,freshUntil:now+45000,
   payload:{LastGameID:99,RichPresenceMsgDate:new Date(now).toISOString()}})});
 await c.ensure("qam-entry");
 if(!legacy){c.lifecycle("123",true,undefined,"emulator");now+=1000;await c.ensure("scheduled-validation",true);}
 c.lifecycle("123",false);assert.equal(c.read()?.suppressed,undefined);
 assert.equal(c.observedSessions()[0]?.localOwnership,undefined);c.dispose();
});


test("reused shortcut starts a new ownership session and cannot suppress remote game",async()=>{
 let now=1800000000000,id=10,heartbeat=now,recent=0;
 const c=createRaPresenceCoordinator({revision:()=>1,now:()=>now,read:()=>undefined,schedule:()=>0,cancel:()=>{},
  fetchRecent:async()=>{recent++;return []},fetch:async()=>({raResource:1,resourceKey:"p",cacheState:"live",fetchedAt:now,freshUntil:now+45000,
   payload:{LastGameID:id,RichPresenceMsgDate:new Date(heartbeat).toISOString()}})});
 c.lifecycle("123",true,undefined,"emulator");now+=1000;heartbeat=now;await c.ensure("qam-entry");
 assert.equal(c.observedSessions()[0]?.localOwnership,"emulator");c.lifecycle("123",false);
 await flush();const before=recent;
 now+=1000;c.lifecycle("123",true,undefined,"unknown");now+=1000;id=99;heartbeat=now;await c.ensure("qam-entry");
 assert.equal(c.observedSessions().find(s=>s.gameId==="99")?.localOwnership,undefined);
 now+=1000;c.lifecycle("123",false,undefined,"unknown");assert.equal(c.read()?.suppressed,undefined);assert.equal(recent,before);
 // A subsequent real emulator launch may establish new corroborated authority.
 now+=1000;c.lifecycle("123",true,undefined,"emulator");now+=1000;id=20;heartbeat=now;await c.ensure("qam-entry");
 assert.equal(c.observedSessions().find(s=>s.gameId==="20")?.localOwnership,"emulator");
 now+=1000;c.lifecycle("123",false);assert.equal(c.read()?.suppressed,true);c.dispose();
});
