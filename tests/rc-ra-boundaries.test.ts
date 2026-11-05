import test from "node:test";
import assert from "node:assert/strict";
import { createRetroAchievementsDataCoordinator } from "../src/platform/decky/retroachievements-data-coordinator";

test("oversized successors revoke old payloads, provenance and accounting then allow small re-entry", async () => {
  const request={path:"API_GetGameList.php",query:{c:1,h:1}}, context={revision:1,entryPoint:"test"};
  let payload:unknown=[{ID:1,Hashes:[]}], publications=0, calls=0;
  const coordinator=createRetroAchievementsDataCoordinator({getRevision:()=>1,now:()=>100,
    fetchResource:async()=>{calls++;return {raResource:1,resourceKey:"catalogue",cacheState:"live",fetchedAt:100,freshUntil:1000,payload}}});
  coordinator.subscribeResource(request,()=>publications++);
  const first=await coordinator.ensureFresh(request,context);
  payload=[{ID:2,Hashes:[],Padding:"x".repeat(9*1024*1024)}];
  const large=await coordinator.refreshResource(request,context);
  assert.notEqual(first.sourceRevision,large.sourceRevision);
  assert.equal(coordinator.getResource(request),undefined);
  assert.equal(coordinator.getResourceRevision(request),undefined);
  assert.equal(coordinator.getResourceDiagnostics().memoryBytes,0);
  const before=publications;
  await coordinator.ensureFresh(request,context);
  assert.equal(calls,3);
  assert.ok(publications>before);
  payload=[{ID:3,Hashes:[]}];
  assert.deepEqual((await coordinator.ensureFresh(request,context)).payload,payload);
  assert.deepEqual(coordinator.getResource(request)?.payload,payload);
});

