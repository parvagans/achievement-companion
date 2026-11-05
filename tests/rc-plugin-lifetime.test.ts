import test from "node:test";
import assert from "node:assert/strict";
import { loadLocalComponent } from "./helpers/render-decky-component";

test("plugin initialization isolates optional setup failure and teardown continues through throwing hosts",()=>{
  for(const failure of ["native","routes",undefined]){
    const released:string[]=[],started:string[]=[];
    const start=(name:string)=>()=>{started.push(name);if(name===failure)throw Error(name);return ()=>{released.push(name);if(name==="updates")throw Error("host");}};
    const {exports}=loadLocalComponent("src/index.tsx",{
      "@decky/api":{definePlugin:(factory:()=>unknown)=>factory},
      "@platform/decky/bootstrap":{DeckyBootstrap:()=>null},
      "@platform/decky/decky-compact-session":{DeckyCompactSession:()=>null},
      "@platform/decky/decky-full-screen-cancel-bridge":{removeDeckyCompactCancelBridges:()=>released.push("bridges")},
      "@platform/decky/decky-compact-navigation":{resetDeckyCompactNavigation:()=>released.push("navigation")},
      "@platform/decky/decky-compact-achievement-page-state":{resetDeckyCompactAchievementPageState:()=>released.push("page")},
      "@platform/decky/decky-game-page-achievement-bubble":{ensureDeckyGamePageAchievementRoutePatchRegistered:start("badge")},
      "@platform/decky/decky-native-steam-achievements":{ensureDeckyNativeSteamAchievementsRegistered:start("native")},
      "@platform/decky/decky-navigation":{registerDeckyFullScreenRoutes:start("routes"),closeDeckyFullScreenSettingsOnDismount:()=>released.push("settings"),clearDeckyCompactOriginFullScreenSession:()=>released.push("session"),openDeckyUpdatesFromNotification:()=>{}},
      "@platform/decky/decky-runtime-debug":{installAchievementCompanionRuntimeDebug:start("debug"),removeAchievementCompanionRuntimeDebug:()=>released.push("debug")},
      "@platform/decky/decky-qam-theme":{achievementCompanionQamTheme:{color:{},type:{compact:{},weight:{}}}},
      "@platform/decky/decky-theme-palette":{clearAchievementCompanionThemes:()=>released.push("themes")},
      "./platform/decky/decky-update-service":{initializeDeckyUpdateSystem:start("updates")}
    });
    const plugin=exports.default();
    assert.equal(plugin.name,"Achievement Companion");assert.ok(plugin.content);
    plugin.onDismount();plugin.onDismount();
    for (const name of ["badge","debug","themes","settings","bridges","navigation","page","session","updates"]) {
      assert.equal(released.filter(item=>item===name).length,1,name);
    }
    if(failure!=="routes")assert.equal(released.filter(item=>item==="routes").length,1);
    if(failure!=="native")assert.equal(released.filter(item=>item==="native").length,1);
    assert.equal(released.filter(item=>item==="badge").length,1);
    assert.ok(started.includes("updates"));
  }
});

