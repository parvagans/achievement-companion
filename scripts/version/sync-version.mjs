#!/usr/bin/env node
import {
  VERSION_CONTRACT,
  readCanonicalVersion,
  replaceJsonVersion,
  writeGeneratedFrontendVersion,
} from "./version-lib.mjs";

try {
  const rootDir = process.cwd();
  const version = readCanonicalVersion(rootDir);
  replaceJsonVersion(rootDir, VERSION_CONTRACT.packageJson, version);
  replaceJsonVersion(rootDir, VERSION_CONTRACT.pluginJson, version);
  writeGeneratedFrontendVersion(rootDir, version);
  console.log(`Synchronized Achievement Companion version ${version}.`);
} catch (error) {
  console.error(`Version synchronization FAILED\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
