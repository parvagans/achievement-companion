import test from "node:test";
import assert from "node:assert/strict";
import { createGameOverviewPreferencesStore } from "../src/platform/decky/decky-game-overview-preferences";
import { writeDeckySteamGameDetail, readDeckySteamGameDetailCacheEntry } from "../src/platform/decky/decky-steam-game-detail-cache";
import { updateDeckyProviderConfigCache } from "../src/platform/decky/providers/provider-config-store";
import { advanceDeckyAccountRevision } from "../src/platform/decky/decky-account-revision";
import { loadDeckySteamHuntersEnrichedGameDetail } from "../src/platform/decky/decky-app-services";
import { setDeckyBackendCallImplementationForTests } from "../src/platform/decky/decky-backend-bridge";
import type { GameDetailSnapshot } from "../src/core/domain";

function storage() {
  const values = new Map<string,string>();
  return {values, failRead:false, failWrite:false, get length(){return values.size},
    key(i:number){return [...values.keys()][i] ?? null}, clear(){values.clear()},
    getItem(k:string){if(this.failRead) throw Error("read");return values.get(k)??null},
    setItem(k:string,v:string){if(this.failWrite)throw Error("quota");values.set(k,v)},
    removeItem(k:string){if(this.failWrite)throw Error("blocked");values.delete(k)}};
}
const snapshot:GameDetailSnapshot = {game:{providerId:"steam",gameId:"42",appid:42,title:"Game",
 status:"in_progress",summary:{unlockedCount:1,totalCount:2,completionPercent:50},metrics:[]},achievements:[]};
const account = (id:string) => updateDeckyProviderConfigCache("steam",{steamId64:id,hasApiKey:true,language:"english",recentlyPlayedCount:5,recentAchievementsCount:5});

test("failed preference reads or writes preserve all pins, goals and hides across restart", () => {
  const disk=storage(), store=createGameOverviewPreferencesStore(disk);
  const a={providerId:"steam",gameId:"1",accountId:"A"}, b={...a,accountId:"B"};
  store.pinAchievement(a,"one");store.pinAchievement(b,"two");
  store.hideSuggestion("steam","2","hidden");store.setRetroAchievementsGameGoal("3","beat");
  const before=store.read();
  disk.failRead=true;
  assert.equal(store.pinAchievement({...a,gameId:"4"},"new"),false);
  disk.failRead=false;disk.failWrite=true;
  assert.equal(store.unpinAchievement(a),false);
  disk.failWrite=false;
  assert.deepEqual(createGameOverviewPreferencesStore(disk).read(),before);
  for(const invalid of ["{", '{"version":9}', '[]', 'null', ""]) {
    disk.values.set("achievement-companion:game-overview:v1",invalid);
    assert.equal(store.pinAchievement(a,"new"),false);
    assert.equal(disk.values.get("achievement-companion:game-overview:v1"),invalid);
  }
});

test("offline detail survives quota failures and cannot cross Steam account owners", async () => {
  const oldLocal=globalThis.localStorage, oldSession=globalThis.sessionStorage;
  const disk=storage(), secondary=storage();
  globalThis.localStorage=disk;globalThis.sessionStorage=secondary;
  try {
    account("A");assert.equal(writeDeckySteamGameDetail(snapshot),true);
    disk.failWrite=true;
    assert.equal(writeDeckySteamGameDetail({...snapshot,game:{...snapshot.game,title:"New"}}),false);
    assert.equal(readDeckySteamGameDetailCacheEntry("42")?.snapshot.game.title,"Game");
    account("B");assert.equal(readDeckySteamGameDetailCacheEntry("42"),undefined);
    account("A");assert.equal(readDeckySteamGameDetailCacheEntry("42")?.snapshot.game.title,"Game");
    disk.failWrite=false;
    const owned=readDeckySteamGameDetailCacheEntry("42")!.snapshot;
    account("B");
    assert.equal(writeDeckySteamGameDetail(owned),false);
    await assert.rejects(loadDeckySteamHuntersEnrichedGameDetail(owned),/account/i);
    account("A");
    assert.equal(writeDeckySteamGameDetail({...snapshot,game:{...snapshot.game,title:"New"}}),true);
    assert.equal(readDeckySteamGameDetailCacheEntry("42")?.snapshot.game.title,"New");
  } finally {globalThis.localStorage=oldLocal;globalThis.sessionStorage=oldSession;updateDeckyProviderConfigCache("steam",undefined);}
});

test("late SteamHunters enrichment rejects account A after B replaces credentials", async () => {
  const oldLocal=globalThis.localStorage, oldSession=globalThis.sessionStorage;
  globalThis.localStorage=storage();globalThis.sessionStorage=globalThis.localStorage;
  let release!:()=>void; const pending=new Promise<void>(r=>release=r);
  setDeckyBackendCallImplementationForTests(async (_method,payload) => {
    await pending;
    return String((payload as {path:string}).path).endsWith("/42") ? {appId:42,achievementCount:2} : [];
  });
  try {
    account("A");
    const enrichment=loadDeckySteamHuntersEnrichedGameDetail(snapshot);
    advanceDeckyAccountRevision("steam");account("B");release();
    await assert.rejects(enrichment,/account/i);
    assert.equal(readDeckySteamGameDetailCacheEntry("42"),undefined);
  } finally {setDeckyBackendCallImplementationForTests(undefined);globalThis.localStorage=oldLocal;globalThis.sessionStorage=oldSession;updateDeckyProviderConfigCache("steam",undefined);}
});

