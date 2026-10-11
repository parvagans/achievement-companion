#!/usr/bin/env node
import semver from "semver";
import { readVersionContract } from "./version-lib.mjs";

const DECKY_SUFFIX_FLAG = "--allow-decky-package-suffix";

function isDeckyPackageVersion(packageVersion, canonicalVersion) {
  if (!packageVersion.startsWith(`${canonicalVersion}-`)) {
    return false;
  }
  const suffix = packageVersion.slice(canonicalVersion.length + 1);
  // Decky appends a seven-character commit hash for review builds and may
  // append a positive numeric revision for forced builds of either kind.
  return /^(?:[0-9a-f]{7}(?:-[1-9][0-9]*)?|[1-9][0-9]*)$/u.test(suffix);
}

try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== DECKY_SUFFIX_FLAG)) {
    throw new Error(`Unknown version-check option: ${args.find((arg) => arg !== DECKY_SUFFIX_FLAG)}`);
  }
  const allowDeckyPackageSuffix = args.includes(DECKY_SUFFIX_FLAG);
  const versions = readVersionContract();
  const expected = versions["version.properties"];
  const isAllowedDeckyVersion = (label, value) =>
    label === "package.json" && allowDeckyPackageSuffix && isDeckyPackageVersion(value, expected);
  const invalid = Object.entries(versions).filter(
    ([label, value]) => semver.valid(value) === null && !isAllowedDeckyVersion(label, value),
  );
  const inconsistent = Object.entries(versions).filter(
    ([label, value]) => value !== expected && !isAllowedDeckyVersion(label, value),
  );
  if (invalid.length > 0 || inconsistent.length > 0) {
    console.error("Version consistency check FAILED\n");
    const width = Math.max(...Object.keys(versions).map((label) => label.length));
    for (const [label, value] of Object.entries(versions)) {
      console.error(`${`${label}:`.padEnd(width + 1)} ${value}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Version consistency check passed (${expected}).`);
  }
} catch (error) {
  console.error(`Version consistency check FAILED\n\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
