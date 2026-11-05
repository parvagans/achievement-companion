import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createDeckyRouteRegistration } from "../src/platform/decky/decky-route-registration";

test("native adapter tolerates missing or throwing lifecycle methods and unwinds partial patches", () => {
  const fixture=readFileSync("tests/decky-native-steam-achievements.test.ts","utf8").split("const script = String.raw" + "`")[1]!.split("    const cleanup = ensureDeckyNativeSteamAchievementsRegistered();")[0]!;
  const variants=[
    "delete window.SteamClient",
    "delete window.SteamClient.GameSessions",
    "delete window.SteamClient.GameSessions.RegisterForAppLifetimeNotifications",
    "window.SteamClient.GameSessions.RegisterForAppLifetimeNotifications = 42",
    "window.SteamClient.GameSessions.RegisterForAppLifetimeNotifications = () => {throw Error('host')}",
    "window.SteamClient.GameSessions.RegisterForAppLifetimeNotifications = () => ({})",
    "window.SteamClient.GameSessions.RegisterForAppLifetimeNotifications = () => ({unregister(){throw Error('unregister')}})",
  ];
  for(const setup of variants){
    const script=fixture+setup+`;
      const cleanup=ensureDeckyNativeSteamAchievementsRegistered();
      assert.equal(detailsStore.GetAchievements(620),"original-details-620");
      cleanup();cleanup();
      assert.ok(patchRecords.every(p=>p.unpatched));
      assert.ok(routeRecords.every(p=>p.removed));
      ensureDeckyNativeSteamAchievementsRegistered()();
      assert.ok(patchRecords.every(p=>p.unpatched));
    `;
    const result=spawnSync(process.execPath,["--experimental-test-module-mocks","--import","tsx","--input-type=module","-e",script],{encoding:"utf8",timeout:30000});
    assert.equal(result.status,0,setup+"\n"+result.stdout+result.stderr);
  }
  const partial=fixture.replace('function patch(target, name, handler, kind) {','function patch(target, name, handler, kind) { if(patchRecords.length===3) throw Error("patch failed");')+`
    assert.throws(()=>ensureDeckyNativeSteamAchievementsRegistered(),/patch failed/);
    assert.ok(patchRecords.every(p=>p.unpatched));
    assert.ok(routeRecords.every(p=>p.removed));
  `;
  const result=spawnSync(process.execPath,["--experimental-test-module-mocks","--import","tsx","--input-type=module","-e",partial],{encoding:"utf8",timeout:30000});
  assert.equal(result.status,0,result.stdout+result.stderr);
});

test("route registration unwinds acquired routes and continues teardown after a host throws",()=>{
  const active=new Set<string>(), removed:string[]=[];
  let fail=true;
  const hook={addRoute(path:string){if(fail&&path==="/two")throw Error("add");active.add(path)},
    removeRoute(path:string){active.delete(path);removed.push(path);if(path==="/two")throw Error("remove")}};
  const registration=createDeckyRouteRegistration(hook as never,["/one","/two","/three"].map(path=>({path,component:()=>null})));
  assert.throws(()=>registration.register(),/add/);
  assert.equal(active.size,0);
  fail=false;registration.register();registration.unregister();
  assert.equal(active.size,0);assert.equal(registration.isRegistered(),false);
  registration.unregister();assert.deepEqual(removed,["/one","/three","/two","/one"]);
});

