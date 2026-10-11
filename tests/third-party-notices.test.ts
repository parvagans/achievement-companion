import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const normalizeLineEndings = (value: string): string => value.replace(/\r\n/gu, "\n");

test("bundled semver license and installed dependency versions appear in Decky notices", () => {
  const notice = normalizeLineEndings(readFileSync("THIRD_PARTY_NOTICES.md", "utf8"));
  const semverPackage = JSON.parse(readFileSync("node_modules/semver/package.json", "utf8")) as { version: string };
  const deckyUiPackage = JSON.parse(readFileSync("node_modules/@decky/ui/package.json", "utf8")) as { version: string };
  const semverLicense = normalizeLineEndings(readFileSync("node_modules/semver/LICENSE", "utf8"));

  assert.ok(notice.includes("| `semver` | `" + semverPackage.version + "` | `ISC` |"));
  assert.ok(notice.includes("| `@decky/ui` | `" + deckyUiPackage.version + "` |"));
  assert.ok(notice.includes(`\`\`\`text\n${semverLicense}\`\`\``));
});
