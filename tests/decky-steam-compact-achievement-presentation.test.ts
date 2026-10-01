import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getSteamCompactActionStyle, getSteamCompactAchievementFilterStyle } from "../src/platform/decky/decky-steam-compact-action-styles";

test("Steam compact focus changes colors without changing action geometry", () => {
  for (const tone of ["row", "primary"] as const) {
    const rest = getSteamCompactActionStyle(tone, false);
    const focus = getSteamCompactActionStyle(tone, true);
    for (const key of ["width", "minWidth", "padding", "borderRadius", "boxSizing"] as const) {
      assert.equal(rest[key], focus[key]);
    }
    assert.notEqual(rest.background, focus.background);
    assert.match(String(focus.border), /54, 185, 255/u);
    assert.match(String(focus.boxShadow), /54, 185, 255/u);
  }
});

test("filter selection remains distinct from native focus and permits long counts to wrap", () => {
  const selected = getSteamCompactAchievementFilterStyle(true, false);
  const focused = getSteamCompactAchievementFilterStyle(false, true);
  const both = getSteamCompactAchievementFilterStyle(true, true);
  assert.match(String(selected.boxShadow), /inset 0 -3px/u);
  assert.doesNotMatch(String(focused.boxShadow), /inset 0 -3px/u);
  assert.match(String(both.boxShadow), /inset 0 -3px/u);
  assert.equal(selected.whiteSpace, "normal");
  assert.equal(selected.minWidth, 0);
});

test("shared list keeps legacy RA styling and uses native Steam focus without custom audio", () => {
  const list = readFileSync("src/platform/decky/decky-compact-achievement-list.tsx", "utf8");
  assert.match(list, /padding: embedded \? 0 : "0 16px 4px"/u);
  assert.match(list, /model\.metadataPlacement === "rail" \? undefined : DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS/u);
  assert.match(list, /getSteamCompactAchievementFilterStyle\(active, focusedControl === filter\)/u);
  assert.match(list, /model\.supportsModeFilter/u);
  assert.match(list, /pageStateRef\.current = next;[\s\S]*writeDeckyCompactAchievementPageState[\s\S]*setPageState\(next\)/u);
  assert.doesNotMatch(list, /onGamepadDirection|new Audio|Search achievements/u);
  assert.equal((list.match(/role="img"/gu) ?? []).length, 1);
});
