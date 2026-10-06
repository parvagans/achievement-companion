#!/usr/bin/env node
import { readCanonicalVersion } from "./version-lib.mjs";

try {
  process.stdout.write(`${readCanonicalVersion()}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
