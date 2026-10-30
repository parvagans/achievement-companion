import assert from "node:assert/strict";
import { test } from "node:test";
import { createRetroAchievementsDataCoordinator } from "../src/platform/decky/retroachievements-data-coordinator";

const request = { path: "API_GetGameInfoAndUserProgress.php", query: { g: 1, a: 1 } };
const context = { revision: 1, entryPoint: "test" };

test("all surfaces share fresh resources and receive immutable presentation copies", async () => {
  let calls = 0;
  const coordinator = createRetroAchievementsDataCoordinator({
    getRevision: () => 1, now: () => 100,
    fetchResource: async () => {
      calls += 1;
      return { raResource: 1, resourceKey: "game", payload: { unlocked: 1 }, cacheState: "live", fetchedAt: 100, freshUntil: 1000 };
    },
  });
  const a = await coordinator.ensureFresh<{ unlocked: number }>(request, context);
  a.payload.unlocked = 99;
  const b = await coordinator.ensureFresh<{ unlocked: number }>(request, { ...context, entryPoint: "native" });
  assert.equal(b.payload.unlocked, 1);
  assert.equal(calls, 1);
  assert.equal(b.cacheState, "fresh");
});

test("concurrent route entries share one operation and ordinary updates do not mutate opened snapshots", async () => {
  let calls = 0;
  const coordinator = createRetroAchievementsDataCoordinator({
    getRevision: () => 1, now: () => 100,
    fetchResource: async () => ({ raResource: 1, resourceKey: "game", payload: { revision: ++calls }, cacheState: "live", fetchedAt: 100, freshUntil: 1000 }),
  });
  const [a, b] = await Promise.all([coordinator.ensureFresh(request, context), coordinator.ensureFresh(request, context)]);
  assert.equal(calls, 1);
  await coordinator.refreshResource(request, context);
  assert.deepEqual(a.payload, { revision: 1 });
  assert.deepEqual(b.payload, { revision: 1 });
  assert.equal(calls, 2);
});

test("a rate limit preserves last-known-good data without another attempted fetch on the same entry", async () => {
  let calls = 0;
  const coordinator = createRetroAchievementsDataCoordinator({
    getRevision: () => 1, now: () => 100,
    fetchResource: async () => {
      if (++calls === 2) throw { handledHttpError: true, status: 429, retryAfterMs: 60000 };
      return { raResource: 1, resourceKey: "game", payload: { unlocked: 1 }, cacheState: "live", fetchedAt: 100, freshUntil: 1000 };
    },
  });
  await coordinator.ensureFresh(request, context);
  const fallback = await coordinator.refreshResource(request, context);
  assert.equal(fallback.cacheState, "stale");
  assert.deepEqual(fallback.payload, { unlocked: 1 });
  assert.equal(calls, 2);
});

test("credential revisions reject a late response without leaking it to another account", async () => {
  let revision = 1;
  let release: (value: unknown) => void = () => undefined;
  const response = new Promise((resolve) => { release = resolve; });
  const coordinator = createRetroAchievementsDataCoordinator({ getRevision: () => revision, fetchResource: () => response });
  const pending = coordinator.ensureFresh(request, context);
  revision = 2;
  release({ raResource: 1, payload: { old: true }, resourceKey: "old", fetchedAt: 100, freshUntil: 1000 });
  await assert.rejects(pending, /identity changed/);
  assert.equal(coordinator.getResource(request), undefined);
});

test("hung entry calls reach a finite foreground boundary", async () => {
  const coordinator = createRetroAchievementsDataCoordinator({
    getRevision: () => 1, foregroundMs: 5,
    fetchResource: () => new Promise(() => undefined),
  });
  await assert.rejects(coordinator.ensureFresh(request, context), (error: unknown) =>
    (error as { category?: string }).category === "foreground_deadline");
  assert.equal(coordinator.getResourceDiagnostics().pending, 1, "the transport remains single-flight until it settles");
});

test("superseded completion cannot publish over a successor; authoritative late completion still publishes", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const releases: ((value: unknown) => void)[] = [];
  const c = createRetroAchievementsDataCoordinator({ getRevision: () => 1, now: () => 100, foregroundMs: 5, completionMs: 10,
    fetchResource: () => new Promise((resolve) => releases.push(resolve)) });
  const values: unknown[] = [];
  c.subscribeResource(request, () => { const v = c.getResource(request)?.payload; if (v !== undefined) values.push(v); });
  const result = (value: number) => ({ raResource: 1, resourceKey: "x", payload: value, cacheState: "live", fetchedAt: 100, freshUntil: 1000 });
  const first = c.ensureFresh(request, context).catch(() => undefined);
  t.mock.timers.tick(11); await first; for (let i=0;i<20;i++) await Promise.resolve();
  const second = c.ensureFresh(request, context);
  releases[1]!(result(2)); await second;
  releases[0]!(result(1)); for (let i=0;i<20;i++) await Promise.resolve();
  assert.equal(c.getResource(request)?.payload, 2);
  assert.ok(!values.includes(1));
  const third = c.refreshResource(request, context).catch(() => undefined);
  t.mock.timers.tick(11); await third;
  releases[2]!(result(3)); for (let i=0;i<20;i++) await Promise.resolve();
  assert.equal(c.getResource(request)?.payload, 3);
  assert.equal(releases.length, 3);
});


test("revision retention is bounded and cleared owners cannot revive after successor publication",async()=>{
 let account=1,calls=0,release!: (v:unknown)=>void;
 const response=(id:number)=>({raResource:1 as const,resourceKey:"g",payload:{id},cacheState:"live" as const,fetchedAt:100,freshUntil:10000});
 const c=createRetroAchievementsDataCoordinator({getRevision:()=>account,now:()=>100,
  fetchResource:async request=>{calls++;return response(Number(request.query?.g))}});
 const req=(g:number)=>({path:"API_GetGameInfoAndUserProgress.php",query:{g,a:1}});
 for(let g=1;g<=2000;g++)await c.ensureFresh(req(g),{revision:1,entryPoint:"test"});
 assert.equal(c.getResourceDiagnostics().resources,128);assert.equal(c.getResourceDiagnostics().revisions,128);
 assert.equal(c.getResourceDiagnostics().owners,0);assert.equal(c.getResourceRevision(req(1)),undefined);
 c.clear();assert.equal(c.getResourceDiagnostics().revisions,0);assert.equal(calls,2000);
 for(const switchAccount of [false,true]){
  let next=0;
  const pendingCoordinator=createRetroAchievementsDataCoordinator({getRevision:()=>account,now:()=>100,
   fetchResource:()=>++next===1?new Promise(resolve=>{release=resolve}):Promise.resolve(response(2))});
  const old=pendingCoordinator.ensureFresh(req(1),{revision:account,entryPoint:"old"}).catch(()=>undefined);
  pendingCoordinator.clear();if(switchAccount)account++;
  const newer=await pendingCoordinator.ensureFresh(req(1),{revision:account,entryPoint:"new"});
  release(response(1));await old;
  assert.deepEqual(pendingCoordinator.getResource(req(1))?.payload,newer.payload);
  assert.equal(pendingCoordinator.getResourceDiagnostics().owners,0);
 }
});
