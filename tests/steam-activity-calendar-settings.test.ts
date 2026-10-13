import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS,
  parseAchievementCompanionSettings,
} from "../src/core/settings";

test("Steam compact and full-screen calendars preserve independent supported week totals", () => {
  const settings = parseAchievementCompanionSettings(JSON.stringify({
    steamCompactActivityCalendarWeeks: 10,
    steamFullscreenActivityCalendarWeeks: 6,
  }));

  assert.equal(settings.steamCompactActivityCalendarWeeks, 10);
  assert.equal(settings.steamFullscreenActivityCalendarWeeks, 6);
});

test("Steam calendar settings reject unsupported week totals", () => {
  const settings = parseAchievementCompanionSettings(JSON.stringify({
    steamCompactActivityCalendarWeeks: 5,
    steamFullscreenActivityCalendarWeeks: 52,
  }));

  assert.equal(
    settings.steamCompactActivityCalendarWeeks,
    DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.steamCompactActivityCalendarWeeks,
  );
  assert.equal(
    settings.steamFullscreenActivityCalendarWeeks,
    DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.steamFullscreenActivityCalendarWeeks,
  );
});

test("full-screen Recent Activity intervals persist independently and reject unknown values", () => {
  const selected = parseAchievementCompanionSettings(JSON.stringify({
    steamFullscreenRecentActivityInterval: "14d",
    retroAchievementsFullscreenRecentActivityInterval: "12w",
  }));
  assert.equal(selected.steamFullscreenRecentActivityInterval, "14d");
  assert.equal(selected.retroAchievementsFullscreenRecentActivityInterval, "12w");

  const invalid = parseAchievementCompanionSettings(JSON.stringify({
    steamFullscreenRecentActivityInterval: "60d",
    retroAchievementsFullscreenRecentActivityInterval: null,
  }));
  assert.equal(invalid.steamFullscreenRecentActivityInterval, "30d");
  assert.equal(invalid.retroAchievementsFullscreenRecentActivityInterval, "30d");
});
