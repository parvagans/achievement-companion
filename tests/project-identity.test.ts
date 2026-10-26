import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const CONTACT_EMAIL = "achievement-companion@proton.me";

test("public project identity and contact stay canonical", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { author?: string };
  const pluginJson = JSON.parse(readFileSync("plugin.json", "utf8")) as { author?: string };
  const readme = readFileSync("README.md", "utf8");
  const aboutPage = readFileSync("src/platform/decky/decky-full-screen-about-page.tsx", "utf8");

  assert.equal(packageJson.author, `parvagans <${CONTACT_EMAIL}>`);
  assert.equal(pluginJson.author, "parvagans");
  assert.match(readme, new RegExp(`mailto:${CONTACT_EMAIL.replace(".", "\\.")}`, "u"));
  assert.match(aboutPage, new RegExp(CONTACT_EMAIL.replace(".", "\\."), "u"));
});
