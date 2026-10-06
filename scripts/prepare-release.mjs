#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  readCanonicalVersion,
  readGeneratedFrontendVersion,
  readJsonVersion,
  VERSION_CONTRACT,
} from "./version/version-lib.mjs";
import {
  calculateArtifactSha256,
  createUpdateManifest,
  writeUpdateManifest,
} from "./release-artifacts.mjs";

const rootDir = process.cwd();
const argumentsPassed = process.argv.slice(2);
const skipBuild = argumentsPassed.includes("--skip-build");
const unexpectedArguments = argumentsPassed.filter((argument) => argument !== "--skip-build");

if (unexpectedArguments.length > 0) {
  throw new Error(`Unsupported release preparation arguments: ${unexpectedArguments.join(", ")}`);
}

function run(command, argumentsToRun) {
  const useWindowsPnpmShim = process.platform === "win32" && command === "pnpm";
  if (useWindowsPnpmShim && argumentsToRun.some((argument) => !/^[A-Za-z0-9:._-]+$/u.test(argument))) {
    throw new Error("Refusing to pass an unsafe argument to the Windows pnpm command shim.");
  }
  const executable = useWindowsPnpmShim ? (process.env.ComSpec || "cmd.exe") : command;
  const resolvedArguments = useWindowsPnpmShim
    ? ["/d", "/s", "/c", `pnpm ${argumentsToRun.join(" ")}`]
    : argumentsToRun;
  const result = spawnSync(executable, resolvedArguments, {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
  });
  if (result.error !== undefined) {
    throw new Error(`${command} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${argumentsToRun.join(" ")} failed.`);
  }
}

function resolvePython() {
  return process.env.AC_PYTHON?.trim() || (process.platform === "win32" ? "python.exe" : "python3");
}

function resetReleaseDirectory() {
  const releaseDir = resolve(rootDir, "release");
  if (dirname(releaseDir) !== rootDir) {
    throw new Error("Refusing to prepare release artifacts outside the repository root.");
  }
  rmSync(releaseDir, { recursive: true, force: true });
  mkdirSync(releaseDir, { recursive: true });
  return releaseDir;
}

function assertReleaseContract(version, zipPath, checksumPath, manifestPath) {
  if (readJsonVersion(rootDir, VERSION_CONTRACT.packageJson) !== version) {
    throw new Error("package.json version does not match version.properties.");
  }
  if (readJsonVersion(rootDir, VERSION_CONTRACT.pluginJson) !== version) {
    throw new Error("plugin.json version does not match version.properties.");
  }
  if (readGeneratedFrontendVersion(rootDir) !== version) {
    throw new Error("Generated frontend version does not match version.properties.");
  }
  if (!existsSync(zipPath)) {
    throw new Error(`Release ZIP is missing: ${zipPath}`);
  }

  const artifactName = `achievement-companion-v${version}.zip`;
  if (!zipPath.endsWith(artifactName)) {
    throw new Error("Release ZIP filename does not match the canonical version.");
  }

  const checksum = calculateArtifactSha256(zipPath);
  const expectedChecksumFile = `${checksum}  ${artifactName}`;
  if (readFileSync(checksumPath, "utf8").trim() !== expectedChecksumFile) {
    throw new Error("Release checksum file does not match the ZIP.");
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (
    manifest.schema !== 1
    || manifest.version !== version
    || manifest.channel !== "stable"
    || manifest.sha256 !== checksum
    || manifest.downloadUrl !== `https://github.com/parvagans/achievement-companion/releases/download/v${version}/${artifactName}`
  ) {
    throw new Error("Release update manifest does not match the generated artifact.");
  }
}

try {
  run("pnpm", ["version:sync"]);
  run("pnpm", ["version:check"]);
  const releaseDir = resetReleaseDirectory();
  if (!skipBuild) run("pnpm", ["build"]);

  const python = resolvePython();
  run(python, ["scripts/package_release.py"]);
  run(python, ["scripts/check_release_artifact.py"]);

  const version = readCanonicalVersion(rootDir);
  const artifactName = `achievement-companion-v${version}.zip`;
  const zipPath = resolve(releaseDir, artifactName);
  const checksum = calculateArtifactSha256(zipPath);
  const checksumPath = resolve(releaseDir, `${artifactName}.sha256`);
  const manifestPath = resolve(releaseDir, "update-manifest.json");
  const manifest = createUpdateManifest({
    version,
    downloadUrl: `https://github.com/parvagans/achievement-companion/releases/download/v${version}/${artifactName}`,
    sha256: checksum,
  });

  writeFileSync(checksumPath, `${checksum}  ${artifactName}\n`, "utf8");
  writeUpdateManifest(manifestPath, manifest);
  assertReleaseContract(version, zipPath, checksumPath, manifestPath);
  rmSync(resolve(releaseDir, "staged"), { recursive: true, force: true });
  console.log(`Prepared local release artifacts for Achievement Companion v${version}.`);
  console.log(zipPath);
  console.log(checksumPath);
  console.log(manifestPath);
} catch (error) {
  console.error(`Release preparation FAILED\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
