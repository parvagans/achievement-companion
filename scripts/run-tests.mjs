#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const options = process.argv.slice(2);
if (options.length > 1 || (options[0] !== undefined && !["--node-only", "--python-only"].includes(options[0]))) {
  console.error("Usage: node scripts/run-tests.mjs [--node-only|--python-only]");
  process.exit(2);
}

function run(label, command, args) {
  console.log(`\nRunning ${label} tests...`);
  const result = spawnSync(command, args, { cwd: rootDir, stdio: "inherit", shell: false });
  if (result.error !== undefined) {
    console.error(`${label} tests could not start: ${result.error.message}`);
    return false;
  }
  return result.status === 0;
}

let passed = true;
if (options[0] !== "--python-only") {
  const testDir = join(rootDir, "tests");
  const files = readdirSync(testDir)
    .filter((name) => /\.test\.(?:ts|mjs)$/u.test(name))
    .sort()
    .map((name) => relative(rootDir, join(testDir, name)));
  if (files.length === 0) {
    console.error("No Node test files were found.");
    passed = false;
  } else {
    console.log(`Discovered ${files.length} Node test files.`);
    passed = run("Node", process.execPath, ["--import", "tsx", "--test", ...files]) && passed;
  }
}

if (options[0] !== "--node-only") {
  const python = process.env.AC_PYTHON?.trim() || (process.platform === "win32" ? "python.exe" : "python3");
  passed = run("Python", python, ["scripts/run-python-tests-offline.py"]) && passed;
}

process.exitCode = passed ? 0 : 1;
