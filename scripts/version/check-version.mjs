#!/usr/bin/env node
import semver from "semver";
import { readVersionContract } from "./version-lib.mjs";

try {
  const versions = readVersionContract();
  const expected = versions["version.properties"];
  const invalid = Object.entries(versions).filter(([, value]) => semver.valid(value) === null);
  const inconsistent = Object.entries(versions).filter(([, value]) => value !== expected);
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
