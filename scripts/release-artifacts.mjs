import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

export function calculateArtifactSha256(artifactPath) {
  return createHash("sha256").update(readFileSync(artifactPath)).digest("hex");
}

export function createUpdateManifest({ version, downloadUrl, sha256, releaseNotes }) {
  return {
    schema: 1,
    version,
    channel: "stable",
    downloadUrl,
    sha256,
    ...(releaseNotes !== undefined ? { releaseNotes } : {}),
  };
}

export function writeUpdateManifest(manifestPath, manifest) {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
