import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { calculateArtifactSha256, createUpdateManifest } from "../scripts/release-artifacts.mjs";

const syncScript = resolve("scripts/version/sync-version.mjs");
const checkScript = resolve("scripts/version/check-version.mjs");

function createFixture(version = "1.2.3"): string {
  const root = mkdtempSync(resolve(tmpdir(), "achievement-companion-version-"));
  mkdirSync(resolve(root, "src/generated"), { recursive: true });
  writeFileSync(resolve(root, "version.properties"), `version=${version}\n`);
  writeFileSync(resolve(root, "package.json"), '{\n  "name": "fixture",\n  "version": "0.0.1"\n}\n');
  writeFileSync(resolve(root, "plugin.json"), '{\n  "name": "Fixture",\n  "version": "0.0.2"\n}\n');
  writeFileSync(resolve(root, "src/generated/version.ts"), '// stale\nexport const APP_VERSION = "0.0.3" as const;\n');
  return root;
}

test("version synchronization updates only contractual outputs", () => {
  const root = createFixture();
  try {
    assert.equal(spawnSync(process.execPath, [syncScript], { cwd: root }).status, 0);
    assert.equal(JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version, "1.2.3");
    assert.equal(JSON.parse(readFileSync(resolve(root, "plugin.json"), "utf8")).version, "1.2.3");
    assert.match(readFileSync(resolve(root, "src/generated/version.ts"), "utf8"), /APP_VERSION = "1\.2\.3"/u);
    assert.equal(spawnSync(process.execPath, [checkScript], { cwd: root }).status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("version consistency fails on stale metadata and invalid SemVer", () => {
  const staleRoot = createFixture();
  const invalidRoot = createFixture("1.2");
  try {
    assert.notEqual(spawnSync(process.execPath, [checkScript], { cwd: staleRoot }).status, 0);
    assert.notEqual(spawnSync(process.execPath, [syncScript], { cwd: invalidRoot }).status, 0);
  } finally {
    rmSync(staleRoot, { recursive: true, force: true });
    rmSync(invalidRoot, { recursive: true, force: true });
  }
});

test("release artifact helpers generate the updater's stable manifest schema and exact SHA-256", () => {
  const root = mkdtempSync(resolve(tmpdir(), "achievement-companion-release-helper-"));
  const artifactPath = resolve(root, "achievement-companion-v1.2.3.zip");
  try {
    writeFileSync(artifactPath, "deterministic artifact fixture", "utf8");
    const sha256 = calculateArtifactSha256(artifactPath);
    assert.equal(sha256, "7beaa4a6dd71964263f97d45fd9f4428f5865a970075f015522e1a2ae7cfb7e6");
    assert.deepEqual(
      createUpdateManifest({
        version: "1.2.3",
        downloadUrl: "https://github.com/parvagans/achievement-companion/releases/download/v1.2.3/achievement-companion-v1.2.3.zip",
        sha256,
      }),
      {
        schema: 1,
        version: "1.2.3",
        channel: "stable",
        downloadUrl: "https://github.com/parvagans/achievement-companion/releases/download/v1.2.3/achievement-companion-v1.2.3.zip",
        sha256,
      },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
