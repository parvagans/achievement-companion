import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function lifecycleScript() {
 const raw=readFileSync('tests/decky-native-steam-achievements.test.ts','utf8');
 let script=raw.split('const script = String.raw`')[1].split('    const cleanup = ensureDeckyNativeSteamAchievementsRegistered();')[0];
 const start=script.indexOf('    mock.module(pathToFileURL(resolve("src/platform/decky/decky-native-retroachievements-projection.ts"))');
 const end=script.indexOf('    mock.module(pathToFileURL(resolve("src/platform/decky/decky-native-retroachievements-activity.tsx"))',start);
 script=script.slice(0,start)+`
 let metadataWait; let metadata={appId:String(shortcutId),exe:'/usr/bin/retroarch',startDir:'/roms',launchOptions:'game99.rom'};
 mock.module(pathToFileURL(resolve('src/platform/decky/decky-backend-bridge.ts')).href,{exports:{callDeckyBackendMethod:async()=>metadataWait ? await metadataWait : metadata}});
 const realProjection=await import('./src/platform/decky/decky-native-retroachievements-projection.ts');
 const realLoader=realProjection.createNativeRetroAchievementsProjectionLoader({
 loadShortcutMetadata:async()=>metadata,loadSummary:async()=>({status:'ready',provider:'retroachievements',gameId:'99',appId:String(shortcutId)}),
 loadDetail:async()=>({status:'success',data:{game:{providerId:'retroachievements',gameId:'99',title:'Game',status:'in_progress',summary:{unlockedCount:0,totalCount:0},metrics:[]},achievements:[{providerId:"retroachievements",gameId:"99",achievementId:"1",title:"One",description:"Test",isUnlocked:false,metrics:[]}]},isStale:false,isRefreshing:false}),invalidateSummary(){}});
 mock.module(pathToFileURL(resolve('src/platform/decky/decky-native-retroachievements-projection.ts')).href,{exports:{
 ...realProjection,readDeckyNativeRetroAchievementsProjection:(id,mode)=>realLoader.read(id,mode),
 invalidateDeckyNativeRetroAchievementsProjection:(id,options)=>realLoader.invalidate(id,options),disposeDeckyNativeRetroAchievementsProjection:()=>realLoader.dispose()}});
 const {createRaPresenceCoordinator}=await import('./src/platform/decky/retroachievements-presence-coordinator.ts');
 const accounts=await import("./src/platform/decky/decky-account-revision.ts");
 let now=1800000000000,heartbeat=now,recent=0,game=99,presenceCalls=0;
 const presence=createRaPresenceCoordinator({revision:()=>accounts.getDeckyAccountRevision("retroachievements"),now:()=>now,read:()=>undefined,schedule:()=>0,cancel(){},fetchRecent:async()=>{recent++;return []},
 fetch:async()=>{presenceCalls++;return ({raResource:1,resourceKey:'p',cacheState:'live',fetchedAt:now,freshUntil:now+45000,payload:{LastGameID:game,RichPresenceMsgDate:new Date(heartbeat).toISOString()}})} });
 mock.module(pathToFileURL(resolve('src/platform/decky/decky-retroachievements-presence.ts')).href,{exports:{deckyRaPresence:presence,
 notifyDeckyRaPresenceLifecycle:(...args)=>presence.lifecycle(...args),corroborateDeckyRaPresenceLaunch:(...args)=>presence.corroborateLaunch(...args),stopDeckyRaPresence:()=>presence.dispose()}});
 `+script.slice(end);
 return script;
}

test('registered Steam lifecycle verifies real retained projection identity before presence ownership',()=>{
 let script=lifecycleScript();
 script+=`
 const cleanup=ensureDeckyNativeSteamAchievementsRegistered();
 const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
 // Matching current launch: real lookup and verification authorize the mapped game.
 await realLoader.load(String(shortcutId),'both');
 lifetimeListener({unAppID:shortcutId,bRunning:true});await flush();now+=1000;heartbeat=now;await presence.ensure('qam-entry');
 assert.equal(presence.observedSessions()[0].localOwnership,'mapped');
 now+=1000;lifetimeListener({unAppID:shortcutId,bRunning:false});await flush();assert.equal(presence.read().suppressed,true);assert.equal(recent,1);
 // Revisit old page, then change launch arguments/target under the same app ID.
 await realLoader.load(String(shortcutId),'both');const retained=realLoader.read(String(shortcutId),'both');
 metadata={...metadata,launchOptions:'different.rom'};
 assert.equal(await realProjection.verifyNativeProjectionLaunch(retained),undefined);
 metadata={...metadata,exe:'/usr/bin/unrelated',launchOptions:''};
 assert.equal(await realProjection.verifyNativeProjectionLaunch(retained),undefined);
 assert.equal(realLoader.read(String(shortcutId),'both'),retained);
 const before=recent;now+=1000;lifetimeListener({unAppID:shortcutId,bRunning:true});await flush();
 now+=1000;heartbeat=now;await presence.ensure('qam-entry');now+=1000;lifetimeListener({unAppID:shortcutId,bRunning:false});await flush();
 assert.equal(presence.read().suppressed,undefined);assert.equal(recent,before);
 // A real emulator session can still follow ROM changes despite the old projection.
 metadata={...metadata,exe:'/usr/bin/retroarch',launchOptions:'game99.rom'};shortcut.display_name='RetroArch';
 await realLoader.load(String(shortcutId),'both');now+=1000;lifetimeListener({unAppID:shortcutId,bRunning:true});await flush();
 now+=1000;heartbeat=now;await presence.ensure('qam-entry');game=20;now+=1000;heartbeat=now;await presence.ensure('scheduled-validation',true);await flush();
 const reconciliations=recent;now+=1000;lifetimeListener({unAppID:shortcutId,bRunning:false});await flush();
 assert.equal(presence.read().gameId,'20');assert.equal(presence.read().suppressed,true);assert.equal(recent,reconciliations+1);
 heartbeat=now+1;now+=2;await presence.ensure('scheduled-validation',true);assert.equal(presence.read().suppressed,undefined);
 cleanup();
 `;
 const r=spawnSync(process.execPath,['--experimental-test-module-mocks','--import','tsx','--input-type=module','-e',script],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stdout+r.stderr);
});


for (const sequence of [[99], [99,20], [99,20,30], [99,20,99]]) {
 test(`delayed launch verification preserves corroborated ROM sequence ${sequence.join(' -> ')}`,()=>{
  const script=lifecycleScript()+`
 const cleanup=ensureDeckyNativeSteamAchievementsRegistered();
 const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve()};
 shortcut.display_name='RetroArch';await realLoader.load(String(shortcutId),'both');
 let release;metadataWait=new Promise(r=>release=r);
 lifetimeListener({unAppID:shortcutId,bRunning:true});
 for(const id of ${JSON.stringify(sequence)}){game=id;now+=1000;heartbeat=now;await presence.ensure('scheduled-validation',true);await flush()}
 const calls=presenceCalls,before=recent;
 release(metadata);await flush();assert.equal(presenceCalls,calls);
 now+=1000;lifetimeListener({unAppID:shortcutId,bRunning:false});await flush();
 assert.equal(presence.read().gameId,String(game));assert.equal(presence.read().suppressed,true);
 assert.ok(presence.observedSessions().find(s=>s.gameId===String(game)).endedAt);
 assert.equal(recent,before+1);assert.equal(presenceCalls,calls);
 lifetimeListener({unAppID:shortcutId,bRunning:false});await flush();assert.equal(recent,before+1);
 heartbeat=now+1;now+=2;await presence.ensure('scheduled-validation',true);
 assert.equal(presence.read().suppressed,undefined);
 cleanup();`;
  const r=spawnSync(process.execPath,['--experimental-test-module-mocks','--import','tsx','--input-type=module','-e',script],{encoding:'utf8',timeout:30000});
  assert.equal(r.status,0,r.stdout+r.stderr);
 });
}
for(const scenario of ['exit','relaunch','account','identity']){
 test(`delayed launch verification rejects ${scenario}`,()=>{
 const script=lifecycleScript()+`
 const cleanup=ensureDeckyNativeSteamAchievementsRegistered();
 const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve()};
 await realLoader.load(String(shortcutId),'both');
 const original={...metadata};let release;metadataWait=new Promise(r=>release=r);
 lifetimeListener({unAppID:shortcutId,bRunning:true});
 const scenario=${JSON.stringify(scenario)};
 if(scenario==='account')accounts.advanceDeckyAccountRevision('retroachievements');
 else if(scenario==='identity')metadata={...metadata,exe:'/usr/bin/unrelated'};
 else {now+=1000;lifetimeListener({unAppID:shortcutId,bRunning:false});
 if(scenario==='relaunch'){await realLoader.load(String(shortcutId),'both');metadata={...metadata,exe:'/usr/bin/unrelated'};metadataWait=undefined;now+=1000;lifetimeListener({unAppID:shortcutId,bRunning:true})}}
 release(scenario==='identity'?metadata:original);await flush();
 now+=1000;heartbeat=now;await presence.ensure('qam-entry');
 now+=1000;lifetimeListener({unAppID:shortcutId,bRunning:false});await flush();
 assert.equal(presence.read().suppressed,undefined);assert.equal(recent,0);
 assert.equal(presence.observedSessions()[0].localOwnership,undefined);
 cleanup();`;
 const r=spawnSync(process.execPath,['--experimental-test-module-mocks','--import','tsx','--input-type=module','-e',script],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stdout+r.stderr);
 });
}
