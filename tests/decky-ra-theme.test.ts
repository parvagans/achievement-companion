import assert from "node:assert/strict";
import test from "node:test";
import { raRecipes, raTheme } from "../src/platform/decky/ra-theme";
import { steamTheme } from "../src/platform/decky/steam-theme";
import { getQamPassiveCardFocusStyle } from "../src/platform/decky/decky-qam-theme";

test("RA shares Achievement Companion base surfaces and geometry with Steam", () => {
  assert.equal(raTheme.color.background, steamTheme.color.background);
  assert.equal(raTheme.color.accent, steamTheme.color.accent);
  assert.equal(raTheme.surface.card, steamTheme.surface.card);
  assert.equal(raTheme.surface.page, steamTheme.surface.page);
  assert.equal(raTheme.focus.border, steamTheme.focus.border);
  assert.equal(raTheme.radius.panel, steamTheme.radius.panel);
  assert.equal(raTheme.space.md, steamTheme.space.md);
});

test("RA semantic rewards and completion states remain distinct", () => {
  assert.notEqual(raTheme.color.points, raTheme.color.retroPoints);
  assert.notEqual(raRecipes.gameAward.beaten.color, raRecipes.gameAward.mastered.color);
  assert.notEqual(raTheme.color.hardcore, raTheme.color.softcore);
  assert.notEqual(raRecipes.achievementState.locked.color, raRecipes.achievementState.unlocked.color);
});

test("RA controller focus remains visually separate from selected filter state", () => {
  const focused = raRecipes.filter(false, true);
  const selected = raRecipes.filter(true, false);
  assert.ok(String(focused.border).includes(steamTheme.focus.compactBorder));
  assert.notEqual(focused.boxShadow, selected.boxShadow);
  assert.notEqual(focused.boxShadow, selected.boxShadow);
});

test("RA points and completion passive focus matches Steam game information cards", () => {
  assert.equal(raRecipes.compactProfile.focusableMetric(true).boxShadow, getQamPassiveCardFocusStyle(true).boxShadow);
  assert.notEqual(raRecipes.compactProfile.focusableMetric(true).boxShadow, steamTheme.focus.compactShadow);
  assert.equal(raRecipes.compactProfile.focusableMetric(false).boxShadow, "none");
  for (const kind of ["beaten", "mastered"] as const) {
    assert.equal(raRecipes.compactProfile.completionCard(kind).border, `2px solid ${raRecipes.gameAward[kind].border}`);
    assert.equal(raRecipes.compactProfile.recentGameArtwork(kind).border, `2px solid ${raRecipes.gameAward[kind].border}`);
  }
});
