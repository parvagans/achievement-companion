import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ACHIEVEMENT_COMPANION_THEME_OPTIONS } from "../src/core/settings";
import { DECKY_LOADING_COLORS, DECKY_LOADING_PAGE_BACKGROUND } from "../src/platform/decky/decky-brand-colors";
import { achievementCompanionQamTheme } from "../src/platform/decky/decky-qam-theme";
import { raRecipes, raTheme } from "../src/platform/decky/ra-theme";
import { steamTheme } from "../src/platform/decky/steam-theme";
import {
  AC_CARBON_THEME_VARIABLES,
  AC_EMBER_THEME_VARIABLES,
  AC_GROVE_THEME_VARIABLES,
  AC_NEON_THEME_VARIABLES,
  AC_PAPER_THEME_VARIABLES,
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

test("alternate themes cover every shared role without redefining provider status colors", () => {
  assert.deepEqual(ACHIEVEMENT_COMPANION_THEME_OPTIONS, ["ac-blue", "ac-carbon", "ac-ember", "ac-grove", "ac-neon", "ac-paper"]);
  const expectedKeys = Object.keys(AC_NEON_THEME_VARIABLES).sort();
  for (const variables of [AC_CARBON_THEME_VARIABLES, AC_EMBER_THEME_VARIABLES, AC_GROVE_THEME_VARIABLES, AC_PAPER_THEME_VARIABLES]) {
    assert.deepEqual(Object.keys(variables).sort(), expectedKeys);
    assert.equal(Object.hasOwn(variables, "--ac-hardcore"), false);
    assert.equal(Object.hasOwn(variables, "--ac-softcore"), false);
    assert.equal(Object.hasOwn(variables, "--ac-unlocked"), false);
  }
  assert.equal(AC_CARBON_THEME_VARIABLES["--ac-background"], "#08090b");
  assert.equal(AC_EMBER_THEME_VARIABLES["--ac-background"], "#120d0b");
  assert.equal(AC_GROVE_THEME_VARIABLES["--ac-background"], "#0b1511");
  assert.equal(AC_PAPER_THEME_VARIABLES["--ac-background"], "#15130f");
  assert.match(achievementCompanionQamTheme.surface.progressFill, /--ac-progress-fill/u);
  assert.match(achievementCompanionQamTheme.surface.xpFill, /--ac-xp-fill/u);
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
  applyAchievementCompanionTheme(ownerDocument, "ac-carbon");
  assert.equal(values.get("--ac-accent"), AC_CARBON_THEME_VARIABLES["--ac-accent"]);
  assert.equal(values.size, Object.keys(AC_CARBON_THEME_VARIABLES).length);
  assert.equal(dataset["acTheme"], "ac-carbon");
  applyAchievementCompanionTheme(ownerDocument, "ac-ember");
  assert.equal(values.get("--ac-accent"), AC_EMBER_THEME_VARIABLES["--ac-accent"]);
  assert.equal(values.get("--ac-progress-fill"), AC_EMBER_THEME_VARIABLES["--ac-progress-fill"]);
  assert.equal(dataset["acTheme"], "ac-ember");
  applyAchievementCompanionTheme(ownerDocument, "ac-grove");
  assert.equal(values.get("--ac-accent"), AC_GROVE_THEME_VARIABLES["--ac-accent"]);
  assert.equal(dataset["acTheme"], "ac-grove");
  applyAchievementCompanionTheme(ownerDocument, "ac-paper");
  assert.equal(values.get("--ac-loading-ring"), AC_PAPER_THEME_VARIABLES["--ac-loading-ring"]);
  assert.equal(dataset["acTheme"], "ac-paper");
  applyAchievementCompanionTheme(ownerDocument, "ac-blue");
  assert.equal(values.size, 0);
  assert.equal(dataset["acTheme"], "ac-blue");
  applyAchievementCompanionTheme(ownerDocument, "ac-carbon");
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

test("ordinary icon, avatar, progress, footer, and loading chrome use centralized palette roles", () => {
  const shared = achievementCompanionQamTheme;
  assert.match(shared.decorative.iconFilter, /--ac-icon-filter/u);
  assert.match(shared.decorative.avatarBackground, /--ac-avatar-background/u);
  assert.match(shared.decorative.footerBackground, /--ac-footer-background/u);
  assert.match(shared.decorative.settingsSaveBackground, /--ac-settings-save-background/u);
  assert.match(shared.loading.page, /--ac-loading-page/u);
  assert.match(shared.loading.ring, /--ac-loading-ring/u);
  assert.match(shared.loading.deckIconFilter, /--ac-loading-deck-icon-filter/u);
  assert.equal(raTheme.iconFilter.primary, shared.decorative.iconFilter);
  assert.equal(steamTheme.iconFilter.accent, shared.decorative.iconFilter);
  assert.equal(raRecipes.progressFill.completion, shared.surface.progressFill);
  assert.equal(raRecipes.progressFill.xp, shared.surface.xpFill);

  const loadingBrand = readFileSync("src/platform/decky/decky-loading-brand.tsx", "utf8");
  const fullscreenLoading = readFileSync("src/platform/decky/decky-full-screen-loading-state.tsx", "utf8");
  const compactLoading = readFileSync("src/platform/decky/decky-compact-loading-state.tsx", "utf8");
  assert.match(loadingBrand, /qamTheme\.loading\.ring/u);
  assert.match(loadingBrand, /qamTheme\.loading\.deckIconFilter/u);
  assert.match(fullscreenLoading, /qamTheme\.loading\.page/u);
  assert.match(compactLoading, /achievementCompanionQamTheme\.loading\.page/u);
  assert.notEqual(AC_CARBON_THEME_VARIABLES["--ac-loading-ring"], AC_NEON_THEME_VARIABLES["--ac-loading-ring"]);
  assert.notEqual(AC_EMBER_THEME_VARIABLES["--ac-loading-page"], AC_NEON_THEME_VARIABLES["--ac-loading-page"]);
  for (const theme of [AC_CARBON_THEME_VARIABLES, AC_EMBER_THEME_VARIABLES, AC_GROVE_THEME_VARIABLES, AC_PAPER_THEME_VARIABLES]) {
    assert.doesNotMatch(Object.values(theme).join(" "), /#(?:08d5f5|147bff|2bc3f2)|rgba\(54,\s*185,\s*255/u);
  }
});

test("achievement details and community panels use palette accents rather than fixed cyan", () => {
  const primaryAction = readFileSync("src/platform/decky/decky-compact-primary-action.tsx", "utf8");
  const compactDetail = readFileSync("src/platform/decky/decky-achievement-detail-view.tsx", "utf8");
  const fullscreenDetail = readFileSync("src/platform/decky/decky-full-screen-achievement-page.tsx", "utf8");
  const steamProfile = readFileSync("src/platform/decky/decky-steam-compact-profile.tsx", "utf8");
  const community = readFileSync("src/platform/decky/decky-steam-hunters-game-sections.tsx", "utf8");

  assert.match(primaryAction, /filter: qamTheme\.decorative\.iconFilter/u);
  assert.match(compactDetail, /filter: achievementCompanionQamTheme\.decorative\.iconFilter/u);
  assert.match(fullscreenDetail, /: sharedTheme\.decorative\.iconFilter/u);
  assert.match(steamProfile, /color: steamTheme\.color\.accent, fontWeight: 800/u);
  assert.match(community, /color: steamTheme\.color\.accent/u);
  assert.equal(raTheme.color.retroPoints, achievementCompanionQamTheme.color.accent);

  for (const source of [primaryAction, compactDetail, fullscreenDetail, steamProfile, community]) {
    assert.doesNotMatch(source, /#(?:3ab7ff|69cfff|8ed7ff)|hue-rotate\(16[0-9]deg\)/iu);
  }
});
