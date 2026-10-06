import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import semver from "semver";

export const VERSION_CONTRACT = Object.freeze({
  properties: "version.properties",
  packageJson: "package.json",
  pluginJson: "plugin.json",
  generatedFrontend: "src/generated/version.ts",
});

export function readCanonicalVersion(rootDir = process.cwd()) {
  const source = readFileSync(resolve(rootDir, VERSION_CONTRACT.properties), "utf8");
  const entries = source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  const versionEntries = entries.filter((line) => line.startsWith("version="));
  if (versionEntries.length !== 1) {
    throw new Error("version.properties must contain exactly one version=<SemVer> entry.");
  }
  const version = versionEntries[0].slice("version=".length).trim();
  if (semver.valid(version) === null) {
    throw new Error(`Invalid semantic version in version.properties: ${version || "<empty>"}`);
  }
  return version;
}

export function readJsonVersion(rootDir, relativePath) {
  const parsed = JSON.parse(readFileSync(resolve(rootDir, relativePath), "utf8"));
  if (typeof parsed.version !== "string") {
    throw new Error(`${relativePath} does not contain a string version field.`);
  }
  return parsed.version;
}

export function readGeneratedFrontendVersion(rootDir = process.cwd()) {
  const source = readFileSync(resolve(rootDir, VERSION_CONTRACT.generatedFrontend), "utf8");
  const match = source.match(/export const APP_VERSION = "([^"]+)" as const;/u);
  if (match === null) {
    throw new Error(`${VERSION_CONTRACT.generatedFrontend} does not contain APP_VERSION.`);
  }
  return match[1];
}

export function replaceJsonVersion(rootDir, relativePath, version) {
  const path = resolve(rootDir, relativePath);
  const source = readFileSync(path, "utf8");
  let replaced = false;
  const nextSource = source.replace(
    /("version"\s*:\s*)"[^"]*"/u,
    (_match, prefix) => {
      replaced = true;
      return `${prefix}"${version}"`;
    },
  );
  if (!replaced) {
    throw new Error(`${relativePath} does not contain a version field to synchronize.`);
  }
  if (nextSource !== source) {
    writeFileSync(path, nextSource, "utf8");
  }
}

export function writeGeneratedFrontendVersion(rootDir, version) {
  const path = resolve(rootDir, VERSION_CONTRACT.generatedFrontend);
  const source = `// GENERATED FILE — DO NOT EDIT\nexport const APP_VERSION = "${version}" as const;\n`;
  writeFileSync(path, source, "utf8");
}

export function readVersionContract(rootDir = process.cwd()) {
  return {
    "version.properties": readCanonicalVersion(rootDir),
    "package.json": readJsonVersion(rootDir, VERSION_CONTRACT.packageJson),
    "plugin.json": readJsonVersion(rootDir, VERSION_CONTRACT.pluginJson),
    "generated/version": readGeneratedFrontendVersion(rootDir),
  };
}
