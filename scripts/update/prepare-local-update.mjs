#!/usr/bin/env node
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { networkInterfaces } from "node:os";
import { readCanonicalVersion } from "../version/version-lib.mjs";
import {
  calculateArtifactSha256,
  createUpdateManifest,
  writeUpdateManifest,
} from "../release-artifacts.mjs";

const rootDir = process.cwd();
const outputDir = resolve(rootDir, ".local-update");
if (dirname(outputDir) !== rootDir) throw new Error("Refusing to prepare a local update outside the repository root.");

function prepareSharedReleaseArtifacts() {
  const argumentsToRun = [resolve(rootDir, "scripts", "prepare-release.mjs")];
  if (process.argv.includes("--no-build")) argumentsToRun.push("--skip-build");
  const result = spawnSync(process.execPath, argumentsToRun, { cwd: rootDir, stdio: "inherit" });
  if (result.status !== 0) throw new Error("Shared release preparation failed.");
}

prepareSharedReleaseArtifacts();

const version = readCanonicalVersion(rootDir);
const sourceArtifact = resolve(rootDir, "release", `achievement-companion-v${version}.zip`);
const artifactName = `achievement-companion-${version}.zip`;
const destinationArtifact = resolve(outputDir, artifactName);
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
copyFileSync(sourceArtifact, destinationArtifact);
const sha256 = calculateArtifactSha256(destinationArtifact);
const manifest = createUpdateManifest({
  version,
  downloadUrl: `./${artifactName}`,
  sha256,
  releaseNotes: `Local Achievement Companion ${version} integration-test build.`,
});
writeUpdateManifest(resolve(outputDir, "update-manifest.json"), manifest);
const addresses = Object.values(networkInterfaces())
  .flatMap((entries) => entries ?? [])
  .filter((entry) => entry.family === "IPv4" && !entry.internal)
  .map((entry) => entry.address);
console.log(`Prepared local update ${basename(destinationArtifact)} (${sha256}).`);
console.log("Available LAN addresses for AC_UPDATE_HOST:");
for (const address of addresses) console.log(`  ${address}`);
