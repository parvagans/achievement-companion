import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,writeFileSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UpdateService } from "./fixtures/legacy-0.40.0/update-service";
import { publishRelease } from "../scripts/publish-release.mjs";
import { createUpdateManifest,calculateArtifactSha256 } from "../scripts/release-artifacts.mjs";

test("released 0.40.0 updater still sees only the stable manifest after the RC publish plan",async()=>{
 const directory=mkdtempSync(join(tmpdir(),"ac-legacy-"));
 const rc="1.0.0-rc.1",zip="achievement-companion-v"+rc+".zip";
 let latest=createUpdateManifest({version:"0.40.0",downloadUrl:"https://example.com/stable.zip",sha256:"a".repeat(64)});
 const preview=createUpdateManifest({version:rc,downloadUrl:"https://example.com/rc.zip",sha256:"b".repeat(64)});
 try {
  for(const name of [zip,zip+".sha256","preview-manifest.json"])writeFileSync(join(directory,name),name);
  publishRelease({version:rc,tag:"v"+rc,directory,approvedDigest:calculateArtifactSha256(join(directory,zip)),run:(args:string[])=>{
   if(args[1]==="list")return "[]";
   assert.equal(args[1],"create");
   assert.ok(args.includes("--prerelease")&&args.includes("--latest=false"));
   assert.ok(!args.some(arg=>arg.endsWith("update-manifest.json")));
   if(args.includes("--latest"))latest=preview;
   return "";
  }});
  const service=new UpdateService({installedVersion:"0.40.0",resolveSource:()=>({kind:"production",loadManifest:async()=>latest}),verifier:{} as never,installer:{} as never});
  assert.equal((await service.checkForUpdate()).status,"upToDate");
  latest=preview;
  assert.equal((await service.checkForUpdate()).status,"updateAvailable","control: unmodified old client is vulnerable if Latest is incorrectly replaced");
 }finally{rmSync(directory,{recursive:true,force:true});}
});

