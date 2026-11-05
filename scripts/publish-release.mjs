import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { calculateArtifactSha256, releasePolicy } from "./release-artifacts.mjs";
import { readCanonicalVersion } from "./version/version-lib.mjs";

// A retry may confirm identical assets but cannot reclassify an older release.
export function publishRelease({ version, tag, directory, approvedDigest, run }) {
  if (tag !== "v" + version) throw Error("Tag does not match the canonical version.");
  const policy = releasePolicy(version);
  const zip = "achievement-companion-" + tag + ".zip";
  const names = [zip, zip + ".sha256", policy.manifestName];
  const paths = names.map(name => resolve(directory, name));
  const digests = paths.map(calculateArtifactSha256);
  if (policy.prerelease && approvedDigest !== digests[0]) throw Error("RC ZIP differs from the approved SHA-256.");
  const existing = JSON.parse(run(["release", "list", "--limit", "1000", "--json", "tagName,isPrerelease,isDraft,isLatest"])).find(r => r.tagName === tag);
  if (existing) {
    if (existing.isDraft || existing.isPrerelease !== policy.prerelease || (policy.prerelease && existing.isLatest)) throw Error("Existing release classification differs. Inspect it manually.");
    const {assets} = JSON.parse(run(["release", "view", tag, "--json", "assets"]));
    if (assets.length !== names.length || names.some((name,i) => !assets.some(a => a.name === name && a.digest === "sha256:" + digests[i]))) throw Error("Published release assets differ. Refusing replacement.");
    return;
  }
  const notes = resolve("audits", version, "release-notes.md");
  run(["release", "create", tag, ...paths, "--verify-tag", "--title", "Achievement Companion " + tag,
    ...(policy.prerelease ? ["--prerelease", "--latest=false", "--notes-file", notes] : ["--latest", "--generate-notes"])]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  publishRelease({version: readCanonicalVersion(), tag: process.env.GITHUB_REF_NAME, directory: "release",
    approvedDigest: process.env.APPROVED_RC_SHA256, run: args => execFileSync("gh", args, {encoding:"utf8"})});
}
