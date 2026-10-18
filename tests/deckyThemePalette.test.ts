import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DECKY_LOADING_COLORS, DECKY_LOADING_PAGE_BACKGROUND } from "../src/platform/decky/decky-brand-colors";
import { achievementCompanionQamTheme } from "../src/platform/decky/decky-qam-theme";
import {
  AC_NEON_THEME_VARIABLES,
  applyAchievementCompanionTheme,
  clearAchievementCompanionThemes,
} from "../src/platform/decky/decky-theme-palette";

test("AC Neon uses the loading brand while provider semantics stay outside the shared palette", () => {
  assert.equal(AC_NEON_THEME_VARIABLES["--ac-page"], DECKY_LOADING_PAGE_BACKGROUND);
  assert.equal(AC_NEON_THEME_VARIABLES["--ac-accent"], DECKY_LOADING_COLORS.cyan);
  assert.equal(AC_NEON_THEME_VARIABLES["--ac-accent-strong"], DECKY_LOADING_COLORS.magenta);
  assert.match(achievementCompanionQamTheme.color.accent, /#2bc3f2/u);
  assert.equal(Object.hasOwn(AC_NEON_THEME_VARIABLES, "--ac-success"), false);
  assert.equal(Object.hasOwn(AC_NEON_THEME_VARIABLES, "--ac-hardcore"), false);
});

test("theme switching applies and removes only AC variables", () => {
  const values = new Map<string, string>();
  const dataset: Record<string, string> = {};
  const ownerDocument = {
    documentElement: {
      dataset,
      style: {
        setProperty(name: string, value: string) { values.set(name, value); },
        removeProperty(name: string) { values.delete(name); },
      },
    },
  } as unknown as Document;

  applyAchievementCompanionTheme(ownerDocument, "ac-neon");
  assert.equal(values.get("--ac-accent-strong"), DECKY_LOADING_COLORS.magenta);
  assert.equal(dataset["acTheme"], "ac-neon");
  applyAchievementCompanionTheme(ownerDocument, "ac-blue");
  assert.equal(values.size, 0);
  assert.equal(dataset["acTheme"], "ac-blue");
  applyAchievementCompanionTheme(ownerDocument, "ac-neon");
  clearAchievementCompanionThemes();
  assert.equal(values.size, 0);
  assert.equal(dataset["acTheme"], undefined);
});

test("neon focus, activity, and calendar colors flow through shared theme roles", () => {
  assert.equal(AC_NEON_THEME_VARIABLES["--ac-calendar-4"], DECKY_LOADING_COLORS.magenta);
  assert.match(achievementCompanionQamTheme.focus.primaryBorder, /--ac-focus-primary-border/u);
  assert.match(achievementCompanionQamTheme.focus.calendarDayShadow, /--ac-focus-calendar-day-shadow/u);
  assert.match(achievementCompanionQamTheme.surface.activityTrendFill, /--ac-activity-trend-fill/u);
  assert.match(achievementCompanionQamTheme.color.primaryActionBorder, /--ac-primary-action-border/u);

  const activitySource = readFileSync("src/platform/decky/decky-steam-full-screen-activity-dashboard.tsx", "utf8");
  const achievementRowSource = readFileSync("src/platform/decky/decky-full-screen-achievement-row.tsx", "utf8");
  const actionCssSource = readFileSync("src/platform/decky/decky-full-screen-action-styles.ts", "utf8");
  assert.match(activitySource, /ACTIVITY_CALENDAR_COLORS: Record<SteamActivityCalendarIntensity, string> = qamActivityCalendarColors/u);
  assert.match(activitySource, /steamTheme\.surface\.activityTrendFill/u);
  assert.match(activitySource, /steamTheme\.focus\.shadow/u);
  assert.match(achievementRowSource, /steamTheme\.focus\.border/u);
  assert.match(actionCssSource, /qamTheme\.focus\.primaryBorder/u);
  assert.doesNotMatch(actionCssSource, /border-color: rgba\(255, 255, 255, 0\.98\)/u);
});
