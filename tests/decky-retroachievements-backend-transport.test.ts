import assert from "node:assert/strict";
import test from "node:test";
import { advanceDeckyAccountRevision } from "../src/platform/decky/decky-account-revision";
import { setDeckyBackendCallImplementationForTests } from "../src/platform/decky/decky-backend-bridge";
import { createDeckyRetroAchievementsTransport, resetDeckyRetroAchievementsTransportForTests } from "../src/platform/decky/providers/retroachievements/backend-transport";
import { RetroAchievementsRequestError } from "../src/providers/retroachievements/client/transport";

const request = { path: "API_GetGameInfoAndUserProgress.php", query: { g: 1, a: 1 } };
function resource(payload: unknown) {
  const fetchedAt = Date.now();
  return { raResource: 1, resourceKey: "game", payload, cacheState: "live", fetchedAt, freshUntil: fetchedAt + 900000 };
}
async function isolated(run: () => Promise<void>) {
  resetDeckyRetroAchievementsTransportForTests();
  try { await run(); } finally {
    setDeckyBackendCallImplementationForTests(undefined);
    resetDeckyRetroAchievementsTransportForTests();
  }
}

test("QAM and native transports share canonical backend resources with one dispatch", async () => isolated(async () => {
  let calls = 0;
  setDeckyBackendCallImplementationForTests(async (_method, payload) => {
    if (_method === "record_diagnostic_event") return true;
    calls += 1;
    assert.equal((payload as { resourceProtocol?: number }).resourceProtocol, 1);
    return resource({ ID: 1 });
  });
  const qam = createDeckyRetroAchievementsTransport();
  const native = createDeckyRetroAchievementsTransport();
  const [a, b] = await Promise.all([qam.requestJson(request), native.requestJson(request)]);
  assert.deepEqual(a, b);
  await native.requestJson(request);
  assert.equal(calls, 1);
}));

test("explicit refresh joins running work and forwards intent to the backend safety boundary", async () => isolated(async () => {
  let calls = 0;
  setDeckyBackendCallImplementationForTests(async (_method, payload) => {
    if (_method === "record_diagnostic_event") return true;
    calls += 1;
    assert.equal((payload as { refreshIntent?: string }).refreshIntent, "explicit");
    return resource({ ID: 1 });
  });
  const transport = createDeckyRetroAchievementsTransport();
  await Promise.all([transport.requestJson({ ...request, refreshIntent: "explicit" }), transport.requestJson({ ...request, refreshIntent: "explicit" })]);
  assert.equal(calls, 1);
}));

test("backend cooldown metadata reaches the caller without a frontend retry loop", async () => isolated(async () => {
  let calls = 0;
  setDeckyBackendCallImplementationForTests(async (method) => {
    if (method === "record_diagnostic_event") return true;
    calls += 1;
    return { handledHttpError: true, status: 429, retryAfterMs: 120000, message: "Cooldown" };
  });
  await assert.rejects(createDeckyRetroAchievementsTransport().requestJson(request), (error) =>
    error instanceof RetroAchievementsRequestError && error.statusCode === 429 && error.retryAfterMs === 120000);
  assert.equal(calls, 1);
}));

test("credential changes discard the previous account's fresh resources", async () => isolated(async () => {
  let calls = 0;
  setDeckyBackendCallImplementationForTests(async (method) => method === "record_diagnostic_event" ? true : resource({ ID: ++calls }));
  const transport = createDeckyRetroAchievementsTransport();
  await transport.requestJson(request);
  advanceDeckyAccountRevision("retroachievements");
  await transport.requestJson(request);
  assert.equal(calls, 2);
}));

test("retained QAM presentation rejects changed canonical content without another transport call", async () => isolated(async () => {
  const { writeDeckyCompactGameState, loadDeckyCompactGameState, readDeckyCompactGameState, clearDeckyCompactSessionResources } = await import("../src/platform/decky/decky-compact-session-resources");
  const { getDeckyRetroAchievementsDataCoordinator } = await import("../src/platform/decky/providers/retroachievements/backend-transport");
  const { getDeckyAccountRevision } = await import("../src/platform/decky/decky-account-revision");
  let calls = 0;
  setDeckyBackendCallImplementationForTests(async (method) => method === "record_diagnostic_event" ? true : resource({ ID:1, unlocked: ++calls }));
  const transport = createDeckyRetroAchievementsTransport();
  const initial = await transport.requestJson<{unlocked:number}>(request);
  const state = (count:number) => ({status:"success" as const,isStale:false,isRefreshing:false,data:{game:{providerId:"retroachievements" as const,gameId:"1",title:"Test",status:"in_progress" as const,summary:{unlockedCount:count,totalCount:3},metrics:[]},achievements:[]}});
  const old = state(initial.unlocked); writeDeckyCompactGameState("retroachievements","1",old);
  await transport.requestJson({...request,refreshIntent:"explicit"});
  assert.equal(readDeckyCompactGameState("retroachievements","1"),undefined);
  const next = await loadDeckyCompactGameState("retroachievements","1",async()=>state((await transport.requestJson<{unlocked:number}>(request)).unlocked));
  assert.equal(next.data?.game.summary.unlockedCount,2); assert.equal(old.data.game.summary.unlockedCount,1);
  assert.equal(calls,2);
  clearDeckyCompactSessionResources();
}));


test("overlapping transport provenance stays with its payload through normalization and compact re-entry", async () => isolated(async () => {
  const { normalizeRetroAchievementsGameDetail } = await import("../src/providers/retroachievements/mappers/normalize");
  const { readRetroAchievementsSource } = await import("../src/providers/retroachievements/client/transport");
  const { getDeckyRetroAchievementsGameResourceRevision } = await import("../src/platform/decky/providers/retroachievements/backend-transport");
  const { writeDeckyCompactGameState, loadDeckyCompactGameState, clearDeckyCompactSessionResources } = await import("../src/platform/decky/decky-compact-session-resources");
  // Sweep deterministic promise interleavings, including Astra's six-microtask reproduction.
  for (let delay=0; delay<12; delay++) {
    resetDeckyRetroAchievementsTransportForTests(); clearDeckyCompactSessionResources();
    let calls=0, release!: (value:unknown)=>void;
    const gate=new Promise(resolve=>{release=resolve});
    const raw=(n:number)=>resource({ID:1,Title:"Test",NumAchievements:2,NumAwardedToUser:n,NumAwardedToUserHardcore:n,
      Achievements:Object.fromEntries([1,2].map(i=>[i,{ID:i,Title:`Achievement ${i}`,Description:"Test",Points:5,
        ...(i<=n?{DateEarned:"2026-10-29 10:00:00",DateEarnedHardcore:"2026-10-29 10:00:00"}:{})}]))});
    setDeckyBackendCallImplementationForTests(async method=>method==="record_diagnostic_event"?true:++calls===1?raw(1):gate);
    const transport=createDeckyRetroAchievementsTransport();
    const initial=await transport.requestJson<object>(request), oldRevision=readRetroAchievementsSource(initial);
    const refreshing=transport.requestJson({...request,refreshIntent:"explicit"}); release(raw(2));
    for(let i=0;i<delay;i++) await Promise.resolve();
    const returned=await transport.requestJson<any>(request); await refreshing;
    const snapshot=normalizeRetroAchievementsGameDetail(returned);
    if(returned.NumAwardedToUser===1) assert.equal(snapshot.canonicalSourceRevision,oldRevision);
    writeDeckyCompactGameState("retroachievements","1",{status:"success",data:snapshot,isStale:false,isRefreshing:false});
    const next=await loadDeckyCompactGameState("retroachievements","1",async()=>({status:"success",isStale:false,isRefreshing:false,
      data:normalizeRetroAchievementsGameDetail(await transport.requestJson(request))}));
    assert.equal(next.data?.game.summary.unlockedCount,2);
    assert.equal(next.data?.canonicalSourceRevision,getDeckyRetroAchievementsGameResourceRevision("1"));
    assert.equal(calls,2);
  }
  clearDeckyCompactSessionResources();
}));
