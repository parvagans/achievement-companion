import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import semver from "semver";

export function releasePolicy(version) {
  if (semver.valid(version) !== version) throw new Error("Expected a canonical release version.");
  const prerelease = semver.prerelease(version) !== null;
  return {
    prerelease,
    channel: prerelease ? "preview" : "stable",
    manifestName: prerelease ? "preview-manifest.json" : "update-manifest.json",
  };
}

export function calculateArtifactSha256(artifactPath) {
  return createHash("sha256").update(readFileSync(artifactPath)).digest("hex");
}

export function createUpdateManifest({ version, downloadUrl, sha256, releaseNotes }) {
  return {
    schema: 1,
    version,
    channel: releasePolicy(version).channel,
    downloadUrl,
    sha256,
    ...(releaseNotes !== undefined ? { releaseNotes } : {}),
  };
}

export function writeUpdateManifest(manifestPath, manifest) {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
