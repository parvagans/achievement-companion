#!/usr/bin/env node
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { networkInterfaces } from "node:os";
import { readCanonicalVersion } from "../version/version-lib.mjs";

const rootDir = process.cwd();
const outputDir = resolve(rootDir, ".local-update");
if (dirname(outputDir) !== rootDir) throw new Error("Refusing to prepare a local update outside the repository root.");

function runPackageScript(script) {
  const npmCli = resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  const result = spawnSync(process.execPath, [npmCli, "run", script], { cwd: rootDir, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`Package script ${script} failed.`);
}

if (!process.argv.includes("--no-build")) runPackageScript("build");
const python = process.env.AC_PYTHON?.trim() || (process.platform === "win32" ? "python.exe" : "python3");
for (const script of ["scripts/package_release.py", "scripts/check_release_artifact.py"]) {
  const result = spawnSync(python, [script], { cwd: rootDir, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${script} failed.`);
}

const version = readCanonicalVersion(rootDir);
const sourceArtifact = resolve(rootDir, "release", `achievement-companion-v${version}.zip`);
const artifactName = `achievement-companion-${version}.zip`;
const destinationArtifact = resolve(outputDir, artifactName);
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
copyFileSync(sourceArtifact, destinationArtifact);
const sha256 = createHash("sha256").update(readFileSync(destinationArtifact)).digest("hex");
const manifest = {
  schema: 1,
  version,
  channel: "stable",
  downloadUrl: `./${artifactName}`,
  sha256,
  releaseNotes: `Local Achievement Companion ${version} integration-test build.`,
};
writeFileSync(resolve(outputDir, "update-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
const addresses = Object.values(networkInterfaces())
  .flatMap((entries) => entries ?? [])
  .filter((entry) => entry.family === "IPv4" && !entry.internal)
  .map((entry) => entry.address);
console.log(`Prepared local update ${basename(destinationArtifact)} (${sha256}).`);
console.log("Available LAN addresses for AC_UPDATE_HOST:");
for (const address of addresses) console.log(`  ${address}`);
