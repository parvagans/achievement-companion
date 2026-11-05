import test from "node:test";
import assert from "node:assert/strict";
import { runDeckySteamFullLibraryScan } from "../src/platform/decky/decky-app-services";
import { setDeckyBackendCallImplementationForTests } from "../src/platform/decky/decky-backend-bridge";
import { updateDeckyProviderConfigCache } from "../src/platform/decky/providers/provider-config-store";
import { writeDeckySteamLibraryAchievementScanSummary, readDeckySteamLibraryAchievementScanSummary } from "../src/platform/decky/providers/steam/config";

test("a failed owned-games request reports the failed attempt and retains the last scan",async()=>{
 const previous=globalThis.localStorage;
 const entries=new Map<string,string>();
 globalThis.localStorage={getItem:(key:string)=>entries.get(key)??null,setItem:(key:string,value:string)=>entries.set(key,value),removeItem:(key:string)=>entries.delete(key)} as unknown as Storage;
 const config={steamId64:"76561198000000001",hasApiKey:true,language:"english",recentAchievementsCount:5,recentlyPlayedCount:5};
 setDeckyBackendCallImplementationForTests(async method=>{if(method==="get_provider_configs")return {version:1,steam:config};if(method==="record_diagnostic_event")return true;throw Error("owned-games offline")});
 try {
  updateDeckyProviderConfigCache("steam",config);
  writeDeckySteamLibraryAchievementScanSummary({steamId64:config.steamId64,scannedAt:"2026-10-01T00:00:00Z",ownedGameCount:0,scannedGameCount:0,gamesWithAchievements:0,skippedGameCount:0,failedGameCount:0,totalAchievements:0,unlockedAchievements:0,perfectGames:0,completionPercent:0,games:[]});
  const before=readDeckySteamLibraryAchievementScanSummary("steam");
  assert.ok(before);
  const outcome=await runDeckySteamFullLibraryScan();
  assert.equal(outcome?.status,"error");
  assert.deepEqual(outcome?.summary,before);
  assert.deepEqual(readDeckySteamLibraryAchievementScanSummary("steam"),before);
  let partial=true;
  setDeckyBackendCallImplementationForTests(async (method,payload)=>{
    if(method==="get_provider_configs")return {version:1,steam:config};
    if(method==="record_diagnostic_event")return true;
    const path=(payload as {path:string}).path;
    if(path==="IPlayerService/GetOwnedGames/v1/")return {response:{game_count:1,games:[{appid:220,name:"Half-Life 2"}]}};
    if(partial)throw Error("game unavailable");
    if(path==="ISteamUserStats/GetPlayerAchievements/v1/")return {playerstats:{success:true,achievements:[{apiname:"WIN",achieved:1,unlocktime:1700000000}]}};
    if(path==="ISteamUserStats/GetSchemaForGame/v2/")return {game:{availableGameStats:{achievements:[{name:"WIN",displayName:"Win"}]}}};
    throw Error("unexpected "+path);
  });
  assert.equal((await runDeckySteamFullLibraryScan()).status,"partial");
  partial=false;
  assert.equal((await runDeckySteamFullLibraryScan()).status,"completed");
 } finally {setDeckyBackendCallImplementationForTests(undefined);updateDeckyProviderConfigCache("steam",undefined);globalThis.localStorage=previous;}
});

