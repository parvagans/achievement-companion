import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const normalizeLineEndings = (value: string): string => value.replace(/\r\n/gu, "\n");

test("documented frontend dependency versions and bundled licenses remain current", () => {
  const notice = normalizeLineEndings(readFileSync("THIRD_PARTY_NOTICES.md", "utf8"));
  const documentedPackages = [
    "@decky/api",
    "semver",
    "@decky/ui",
    "react",
    "react-dom",
    "react-router",
    "@decky/rollup",
    "rollup",
    "tsx",
    "typescript",
  ] as const;
  for (const packageName of documentedPackages) {
    const installedPackage = JSON.parse(readFileSync(`node_modules/${packageName}/package.json`, "utf8")) as { version: string };
    assert.ok(
      notice.includes(`| \`${packageName}\` | \`${installedPackage.version}\` |`),
      `${packageName} ${installedPackage.version} is missing from THIRD_PARTY_NOTICES.md`,
    );
  }

  const semverPackage = JSON.parse(readFileSync("node_modules/semver/package.json", "utf8")) as { version: string };
  const semverLicense = normalizeLineEndings(readFileSync("node_modules/semver/LICENSE", "utf8"));

  assert.ok(notice.includes("| `semver` | `" + semverPackage.version + "` | `ISC` |"));
  assert.ok(notice.includes(`\`\`\`text\n${semverLicense}\`\`\``));
});

test("Steam icon attribution remains documented without adding an in-app settings action", () => {
  const notice = normalizeLineEndings(readFileSync("THIRD_PARTY_NOTICES.md", "utf8"));
  const readme = normalizeLineEndings(readFileSync("README.md", "utf8"));
  const steamIcon = normalizeLineEndings(readFileSync("src/platform/decky/assets/steam.svg", "utf8"));
  const aboutPage = normalizeLineEndings(readFileSync("src/platform/decky/decky-full-screen-about-page.tsx", "utf8"));

  assert.match(notice, /Streamline.*https:\/\/streamlinehq\.com\//u);
  assert.match(readme, /Steam provider uses an icon from \[Streamline\]\(https:\/\/streamlinehq\.com\/\)/u);
  assert.match(steamIcon, /Steam Streamline Icon: https:\/\/streamlinehq\.com/u);
  assert.doesNotMatch(aboutPage, /Steam Icon · Streamline|streamlinehq\.com/u);
});
