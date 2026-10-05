import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getDeckyFullscreenActionStylesCss } from "../src/platform/decky/decky-full-screen-action-styles";
import { getDeckyFocusStylesCss } from "../src/platform/decky/decky-focus-styles";
import { getSteamActionStylesCss, steamRecipes, steamTheme } from "../src/platform/decky/steam-theme";
import { getCompletionBarFillStyle } from "../src/platform/decky/decky-completion-progress-bar";

test("Settings input overrides cannot reach another retained route", () => {
  const source = readFileSync("src/platform/decky/decky-full-screen-settings-page.tsx", "utf8");
  assert.match(source, /\.ac-steam-settings-page \.ac-steam-settings-input input\{/u);
  assert.doesNotMatch(source, /(?:^|[;}])\s*input\{height:/u);
  assert.match(source, /className="ac-steam-settings-page" data-ac-steam-theme="fullscreen"/u);
});

test("standalone action buttons own both their styles and stylesheet lifetime", () => {
  const css = getDeckyFullscreenActionStylesCss();
  assert.match(css, /\.achievement-companion-fullscreen-chip\s*\{[\s\S]*min-height: 40px/u);
  assert.doesNotMatch(css, /\.achievement-companion-fullscreen-action-controls\s*>\s*\.achievement-companion-fullscreen-chip/u);
  const source = readFileSync("src/platform/decky/decky-full-screen-action-controls.tsx", "utf8");
  const standalone = source.slice(source.indexOf("export function DeckyFullscreenActionButton"));
  assert.match(standalone, /<DeckyFullscreenActionStyles \/>/u);
  assert.match(source, /entry\.owners -= 1/u);
  assert.match(source, /if \(entry\.owners === 0\)/u);
});

test("Steam recipes share semantics with different physical density", () => {
  const compact = steamRecipes.card("compact");
  const fullscreen = steamRecipes.card("fullscreen");
  assert.equal(compact.background, fullscreen.background);
  assert.notEqual(compact.padding, fullscreen.padding);
  assert.ok(steamTheme.type.compact.body < steamTheme.type.fullscreen.body);
  assert.notEqual(steamTheme.color.success, steamTheme.color.rewardGold);
  assert.equal(steamRecipes.achievementState.locked.artworkFilter, "grayscale(1)");
  const detachedRow = steamRecipes.interactiveRow;
  assert.equal(detachedRow("compact").background, steamTheme.surface.interactive);
});

test("focus and selection stay distinct and Steam overrides require an owned root", () => {
  const css = getSteamActionStylesCss();
  assert.match(css, /\[data-ac-steam-theme\]/u);
  assert.ok(css.includes(steamTheme.surface.selected));
  assert.ok(css.includes(steamTheme.focus.shadow));
  assert.doesNotMatch(getDeckyFocusStylesCss(), /(?:^|\n)\.Panel\.Focusable\s*\{/u);
  assert.match(getDeckyFocusStylesCss(), /\[data-ac-steam-theme="fullscreen"\] \.Panel\.Focusable\[tabindex\]/u);
});

test("Steam completion uses the shared fill while high completion keeps its flame variant", () => {
  assert.equal(getCompletionBarFillStyle(50, "default", false, true).background, steamRecipes.progressFill.completion);
  assert.equal(getCompletionBarFillStyle(90, "default", true, true).background, getCompletionBarFillStyle(90, "default", true).background);
  assert.notEqual(getCompletionBarFillStyle(90, "default", true, true).background, steamRecipes.progressFill.completion);
});
