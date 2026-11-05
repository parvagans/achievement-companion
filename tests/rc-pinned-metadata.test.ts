import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { loadLocalComponent } from "./helpers/render-decky-component";

test("rate-limited pinned A keeps its data and still lets B read its own cached metadata",async()=>{
  const effects:Array<()=>unknown>=[],metadata:Record<string,any>={},loaded:string[]=[];
  const pins=["1","2","3"].map(gameId=>({providerId:"retroachievements",gameId,accountId:"alice",achievementId:"1",completionMode:"both"}));
  const own=(gameId:string)=>({status:"stale",data:{game:{providerId:"retroachievements",gameId,title:"Game "+gameId},achievements:[]},isStale:true,isRefreshing:false});
  const harness=loadLocalComponent("src/platform/decky/decky-pinned-achievements-modal.tsx",{
    "./decky-standard-modal":{getDeckyStandardModalContentStyle:()=>({}),getDeckyStandardModalTabStyle:()=>({})},
    "./decky-achievement-detail-modal":{},
    "./decky-steam-gamepad-focus":{},
    react:{...React,useEffect:(cb:()=>unknown)=>effects.push(cb),useLayoutEffect:()=>{},useRef:(current:unknown)=>({current}),useState:(initial:unknown)=>{
      if(Array.isArray(initial))return [["1","2"],()=>{}];
      if(typeof initial==="object")return [metadata,(fn:any)=>Object.assign(metadata,fn(metadata))];
      return [initial,()=>{}];
    }},
    "./decky-game-overview-preferences":{useSavedPinnedAchievements:()=>({pins,accounts:{retroachievements:"alice"}})},
    "./providers/provider-config-store":{readDeckyProviderConfigs:()=>({retroAchievements:{username:"alice"}})},
    "./decky-compact-session-resources":{
      readDeckyCompactGameState:(_provider:string,id:string)=>id==="2"?own(id):undefined,
      readDeckyCompactRecommendationGameState:()=>undefined,
      loadDeckyCompactRecommendationGameState:(_id:string,loader:()=>unknown)=>loader()
    },
    "./decky-app-services":{loadDeckyGameDetailState:async(_provider:string,id:string)=>{loaded.push(id);return {...own(id),error:{kind:"rate_limit",retryAfterMs:1000}}}}
  });
  harness.exports.PinnedAchievementsContent({initialProvider:"retroachievements",focusCloseButton:()=>true,onDetails:()=>{}});
  for(const effect of effects)effect();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(metadata['["retroachievements","alice","1"]'].data.game.gameId,"1");
  assert.equal(metadata['["retroachievements","alice","2"]'].data.game.gameId,"2");
  assert.equal(metadata['["retroachievements","alice","3"]'],undefined);
  assert.deepEqual(loaded,["1"]);
});

