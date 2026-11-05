import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishRelease } from "../scripts/publish-release.mjs";
import { releasePolicy, calculateArtifactSha256 } from "../scripts/release-artifacts.mjs";

test("publish plans keep the legacy Latest manifest stable and never overwrite a published tag", () => {
  const directory = mkdtempSync(join(tmpdir(), "ac-publish-"));
  try {
    for (const version of ["1.0.0-rc.1", "1.0.0"]) {
      const tag = "v" + version;
      const rc = version.includes("-rc.");
      const zip = "achievement-companion-" + tag + ".zip";
      const names = [zip, zip + ".sha256", rc ? "preview-manifest.json" : "update-manifest.json"];
      assert.equal(releasePolicy(version).manifestName, names[2]);
      const assets = names.map(name => {
        const path = join(directory,name);
        writeFileSync(path,name);
        return {name,digest:"sha256:" + calculateArtifactSha256(path)};
      });
      let existing = [];
      const mutations = [];
      const run = args => {
        if (args[1] === "list") return JSON.stringify(existing);
        if (args[1] === "view") return JSON.stringify({assets});
        mutations.push(args);
      };
      const options = {version, tag, directory, approvedDigest:assets[0].digest.slice(7), run};
      publishRelease(options);
      const [command] = mutations;
      assert.equal(command.includes("--prerelease"), rc);
      assert.equal(command.includes("--latest=false"), rc);
      assert.equal(command.includes("--latest"), !rc);
      assert.ok(command.includes(join(directory,names[2])));
      if (rc) assert.throws(() => publishRelease({...options,approvedDigest:undefined}), /approved/);
      existing = [{tagName:tag, isPrerelease:rc, isLatest:!rc, isDraft:false}];
      publishRelease(options);
      for (const bad of [{isDraft:true}, {isPrerelease:!rc}, ...(rc ? [{isLatest:true}] : [])]) {
        const saved = existing[0];
        existing[0] = {...saved,...bad};
        assert.throws(() => publishRelease(options), /classification/);
        existing[0] = saved;
      }
      assets[0].digest = "different";
      assert.throws(() => publishRelease(options), /replacement/);
      assert.equal(mutations.length,1);
    }
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
