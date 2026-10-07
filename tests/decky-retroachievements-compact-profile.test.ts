import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type {
  NormalizedProfile,
  RecentUnlock,
  RecentlyPlayedGame,
} from "../src/core/domain";
import { normalizeAchievementCompanionSettings } from "../src/core/settings";
import {
  normalizeRetroAchievementsProfile,
  normalizeRetroAchievementsRecentlyPlayedGames,
} from "../src/providers/retroachievements/mappers/normalize";
import {
  buildRetroAchievementsActivityCalendarModel,
} from "../src/platform/decky/decky-retroachievements-activity-calendar-model";
import { getDeckyActivityCalendarFocusDestination } from "../src/platform/decky/decky-activity-calendar-navigation";
import {
  achievementCompanionQamTheme,
  getQamActivityCalendarLegendCellStyle,
  getQamActivityCalendarLegendStyle,
  getQamCompactFocusControlStyle,
  qamActivityCalendarColors,
} from "../src/platform/decky/decky-qam-theme";
import { getSteamCompactActionStyle } from "../src/platform/decky/decky-steam-compact-action-styles";
import { steamTheme } from "../src/platform/decky/steam-theme";
import { raRecipes } from "../src/platform/decky/ra-theme";
import {
  filterRetroAchievementsUnlocksByMode,
  getRetroAchievementsPlayedGameProgress,
  getRetroAchievementsProfileOverviewMetrics,
  getRetroAchievementsProfileRanks,
  sortRetroAchievementsUnlocksNewestFirst,
} from "../src/platform/decky/decky-retroachievements-compact-profile-model";

function createProfile(metrics = [
  { key: "site-rank", label: "Site Rank", value: "12345" },
  { key: "casual-rank", label: "Casual Rank", value: "8421" },
  { key: "total-points", label: "Points", value: "4817" },
  { key: "softcore-points", label: "Softcore", value: "160" },
  { key: "true-points", label: "True", value: "11205" },
  { key: "retro-ratio", label: "Ratio", value: "2.33" },
]): NormalizedProfile {
  return {
    providerId: "retroachievements",
    identity: { providerId: "retroachievements", accountId: "test-user", displayName: "Test User" },
    summary: { unlockedCount: 100, totalCount: 200, completionPercent: 50 },
    metrics,
    hardcoreUnlockedCount: 80,
    softcoreUnlockedCount: 20,
    masteredCount: 12,
  };
}

function createUnlock(mode: "hardcore" | "softcore", unlockedAt: number): RecentUnlock {
  return {
    game: { providerId: "retroachievements", gameId: "1", title: "Test Game" },
    achievement: {
      providerId: "retroachievements",
      gameId: "1",
      achievementId: mode,
      title: `${mode} achievement`,
      isUnlocked: true,
      unlockMode: mode,
      unlockedAt,
      metrics: [],
    },
    unlockedAt,
  };
}

test("RetroAchievements presentation preferences migrate with useful defaults", () => {
  const migrated = normalizeAchievementCompanionSettings({});
  assert.equal(migrated.retroAchievementsRankDisplay, "site");
  assert.equal(migrated.retroAchievementsAchievementMode, "both");
  assert.equal(normalizeAchievementCompanionSettings({ retroAchievementsRankDisplay: "casual" }).retroAchievementsRankDisplay, "casual");
  assert.equal(normalizeAchievementCompanionSettings({ retroAchievementsAchievementMode: "softcore" }).retroAchievementsAchievementMode, "softcore");
  assert.equal(normalizeAchievementCompanionSettings({ retroAchievementsAchievementMode: "none" }).retroAchievementsAchievementMode, "both");
});

test("profile rank display uses available ranks and reflows for each preference", () => {
  const profile = createProfile();
  assert.deepEqual(getRetroAchievementsProfileRanks(profile, "site"), [{ kind: "site", label: "Site Rank", value: `#${Number(12345).toLocaleString()}` }]);
  assert.deepEqual(getRetroAchievementsProfileRanks(profile, "casual"), [{ kind: "casual", label: "Casual Rank", value: `#${Number(8421).toLocaleString()}` }]);
  assert.deepEqual(getRetroAchievementsProfileRanks(profile, "both").map(({ kind }) => kind), ["site", "casual"]);
  assert.deepEqual(
    getRetroAchievementsProfileRanks(createProfile(profile.metrics.filter(({ key }) => key !== "casual-rank")), "both"),
    [
      { kind: "site", label: "Site Rank", value: `#${Number(12345).toLocaleString()}` },
      { kind: "casual", label: "Casual Rank", value: "Requires 250 points" },
    ],
  );
  assert.deepEqual(
    getRetroAchievementsProfileRanks(createProfile(profile.metrics.filter(({ key }) => !["casual-rank", "softcore-points"].includes(key))), "both").map(({ kind }) => kind),
    ["site"],
  );
  assert.deepEqual(getRetroAchievementsProfileRanks(profile, "casual").slice(0, 1).map(({ value }) => value), [`#${Number(8421).toLocaleString()}`]);
});

test("overview metrics honor Hardcore, Softcore, and Both without inventing missing values", () => {
  const profile = createProfile();
  assert.deepEqual(getRetroAchievementsProfileOverviewMetrics(profile, "hardcore").map(({ key }) => key), ["hardcore-points", "retro-points", "ratio"]);
  assert.deepEqual(getRetroAchievementsProfileOverviewMetrics(profile, "softcore").map(({ key }) => key), ["softcore-points", "retro-points", "ratio"]);
  assert.deepEqual(getRetroAchievementsProfileOverviewMetrics(profile, "both").map(({ key }) => key), ["hardcore-points", "softcore-points", "retro-points", "ratio"]);
  assert.equal(getRetroAchievementsProfileOverviewMetrics(createProfile([{ key: "retro-ratio", label: "Ratio", value: "2.33" }]), "hardcore").length, 1);
});

test("recent activity and recently played progress follow the selected mode", () => {
  const entries = [createUnlock("hardcore", 1), createUnlock("softcore", 2)];
  assert.equal(filterRetroAchievementsUnlocksByMode(entries, "both").length, 2);
  assert.deepEqual(filterRetroAchievementsUnlocksByMode(entries, "hardcore").map(({ achievement }) => achievement.unlockMode), ["hardcore"]);
  assert.deepEqual(filterRetroAchievementsUnlocksByMode(entries, "softcore").map(({ achievement }) => achievement.unlockMode), ["softcore"]);
  const game: RecentlyPlayedGame = {
    providerId: "retroachievements", gameId: "1", title: "Test Game",
    summary: { unlockedCount: 8, totalCount: 10, completionPercent: 80 },
    hardcoreSummary: { unlockedCount: 6, totalCount: 10, completionPercent: 60 },
    softcoreSummary: { unlockedCount: 2, totalCount: 10, completionPercent: 20 },
  };
  assert.equal(getRetroAchievementsPlayedGameProgress(game, "hardcore")?.completionPercent, 60);
  assert.equal(getRetroAchievementsPlayedGameProgress(game, "softcore")?.completionPercent, 20);
  assert.equal(getRetroAchievementsPlayedGameProgress(game, "both")?.completionPercent, 80);
  assert.equal(getRetroAchievementsPlayedGameProgress({ ...game, hardcoreSummary: undefined }, "hardcore"), undefined);
});

test("recent activity is ordered newest first before the compact limit is applied", () => {
  const entries = [createUnlock("hardcore", 1), createUnlock("softcore", 3), createUnlock("hardcore", 2)];
  assert.deepEqual(sortRetroAchievementsUnlocksNewestFirst(entries).map(({ unlockedAt }) => unlockedAt), [3, 2, 1]);
  assert.deepEqual(entries.map(({ unlockedAt }) => unlockedAt), [1, 3, 2]);
});

test("eight-week RA activity calendar counts real unlocks and filters by mode", () => {
  const now = new Date(2026, 9, 6, 12).getTime();
  const yesterday = new Date(2026, 9, 5, 12).getTime();
  const entries = [createUnlock("hardcore", yesterday), createUnlock("softcore", yesterday)];
  const hardcore = buildRetroAchievementsActivityCalendarModel({ entries, achievementMode: "hardcore", now });
  const softcore = buildRetroAchievementsActivityCalendarModel({ entries, achievementMode: "softcore", now });
  const both = buildRetroAchievementsActivityCalendarModel({ entries, achievementMode: "both", now });
  assert.equal(hardcore.weeks, 8);
  assert.equal(hardcore.days.length, 56);
  assert.equal(hardcore.days.find(({ day }) => day === Date.UTC(2026, 9, 5))?.count, 1);
  assert.equal(softcore.days.find(({ day }) => day === Date.UTC(2026, 9, 5))?.count, 1);
  assert.equal(both.days.find(({ day }) => day === Date.UTC(2026, 9, 5))?.count, 2);
});

test("profile normalizer retains the real site and casual rank fields when present", () => {
  const profile = normalizeRetroAchievementsProfile(
    { User: "TestUser", ID: 1 },
    { unlockedCount: 0, totalCount: 0 },
    { username: "TestUser", hasApiKey: true },
    [],
    undefined,
    undefined,
    undefined,
    undefined,
    { Rank: 12345, CasualRank: 8421 },
  );
  assert.equal(profile.metrics.find(({ key }) => key === "site-rank")?.value, "12345");
  assert.equal(profile.metrics.find(({ key }) => key === "casual-rank")?.value, "8421");
});

test("recently played mapper derives mode progress from RA's real achievement counts", () => {
  const [game] = normalizeRetroAchievementsRecentlyPlayedGames([{
    GameID: 1,
    Title: "Test Game",
    NumAchieved: 8,
    NumAchievedHardcore: 6,
    AchievementsTotal: 10,
  }]);
  assert.equal(game?.hardcoreSummary?.unlockedCount, 6);
  assert.equal(game?.hardcoreSummary?.completionPercent, 60);
  assert.equal(game?.softcoreSummary?.unlockedCount, 2);
  assert.equal(game?.softcoreSummary?.completionPercent, 20);
});

test("RA QAM loading, focus scrolling, and calendar controls follow Steam compact behavior", async () => {
  const [profileSource, bootstrapSource, resourcesSource, raThemeSource, settingsSource, loadingSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-retroachievements-compact-profile.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/bootstrap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-compact-session-resources.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/ra-theme.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-retroachievements-compact-settings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-compact-loading-state.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(bootstrapSource, /isRetroAchievementsCompactProfileLoading[\s\S]*!isRenderableDashboardState\(state\) \|\| state\.isRefreshing === true/u);
  assert.match(bootstrapSource, /providerId === "retroachievements"[\s\S]*claimDeckyCompactRetroAchievementsDashboardRefresh\(\)/u);
  assert.match(resourcesSource, /export function claimDeckyCompactRetroAchievementsDashboardRefresh\(\)/u);
  assert.match(resourcesSource, /retroAchievementsDashboardRefreshClaimed = false/u);
  assert.match(bootstrapSource, /Loading RetroAchievements profile/u);
  assert.match(bootstrapSource, /isShowingRetroAchievementsCompactSettings=\{compactNavigation\.kind === "settings" && selectedProviderId === "retroachievements"\}/u);
  assert.match(bootstrapSource, /isShowingRetroAchievementsCompactSettings=\{isShowingRetroAchievementsCompactSettings\}/u);
  assert.doesNotMatch(bootstrapSource, /isShowingRetroAchievementsCompactSettings=\{providerId === "retroachievements" && isShowingSteamCompactSettings\}/u);
  assert.match(settingsSource, /<DropdownItem[\s\S]*menuLabel="Rank Display"[\s\S]*<DropdownItem[\s\S]*menuLabel="Achievement Mode"/u);
  assert.match(settingsSource, /registerCompactProviderCancelCallback\(surfaceRef\.current, onBack\)/u);
  assert.match(settingsSource, /autoFocus[\s\S]*preferredFocus/u);
  assert.doesNotMatch(settingsSource, /useQuickAccessVisible|requestDeckySteamGamepadFocusAfterMount/u);
  assert.match(profileSource, /scrollIntoView\(\{ block: "center", inline: "nearest" \}\)/u);
  assert.match(profileSource, /dataAttribute="profile" scrollToTopOnFocus/u);
  assert.match(profileSource, /aria-label=\{model === undefined \? "RetroAchievements activity calendar unavailable" : `Activity calendar, \$\{status\}\. Press A to use\.`\}/u);
  assert.match(profileSource, /data-ra-activity-calendar-day="true"[\s\S]*onGamepadDirection=\{handleCalendarDirection\}/u);
  assert.match(profileSource, /data-ra-activity-calendar-current=\{day === today \? "true" : "false"\}/u);
  assert.match(profileSource, /data-ra-activity-calendar-focused=\{day === focusDay \? "true" : "false"\}/u);
  assert.match(profileSource, /calendarCell\(intensity, isSelected, focusedCalendarDay === day\)/u);
  assert.match(profileSource, /onBlur=\{\(\) => setFocusedCalendarDay\(\(current\) => current === day \? undefined : current\)\}/u);
  assert.doesNotMatch(profileSource, /calendarCell\(intensity, isSelected, true\)/u);
  assert.match(profileSource, /onGamepadFocus=\{\(event\) => \{ const element = event\.currentTarget as HTMLElement; setFocusedCalendarDay\(day\); setLastFocusedDay\(day\)/u);
  assert.match(profileSource, /data-ra-profile-recent-game="true"/u);
  assert.match(profileSource, /buildCompactActivityGamesForDay\(selectedDateActivity, snapshot\.recentlyPlayedGames\)/u);
  assert.match(profileSource, /activityUnlockCount/u);
  assert.match(profileSource, /subscribeToDeckyCompactFocusRestore/u);
  assert.match(raThemeSource, /achievementCompanionQamTheme as qamTheme/u);
  assert.doesNotMatch(raThemeSource, /from "\.\/steam-theme"/u);
  assert.match(raThemeSource, /getQamFocusStylesCss\("data-ac-ra-theme"\)/u);
  assert.doesNotMatch(raThemeSource, /data-ac-ra-theme="compact"\] \.Panel\.Focusable\.gpfocus/u);
  assert.match(raThemeSource, /data-ac-ra-theme="fullscreen"\] \.Panel\.Focusable\.gpfocus/u);
  assert.match(raThemeSource, /getQamCompactFocusRingStyle\(focused\)/u);
  assert.match(profileSource, /onCancel=\{active \? exitCalendar : onCancel\}/u);
  assert.match(profileSource, /<span>Press<\/span>[\s\S]*calendarHintButton\}>A<\/span>[\s\S]*<span>to use<\/span>/u);
  assert.match(profileSource, /calendarLegendCell\(level\)/u);
  assert.doesNotMatch(profileSource, /calendarCell\(level, false, false\)/u);
  assert.match(profileSource, /<div style=\{raRecipes\.compactProfile\.footer\}>\{refreshText\}<\/div>/u);
  assert.match(profileSource, /sortRetroAchievementsUnlocksNewestFirst\([\s\S]*filterRetroAchievementsUnlocksByMode/u);
  assert.match(profileSource, /wide=\{isSingleModeOverview && metric\.mode !== undefined\}/u);
  assert.equal(raRecipes.compactProfile.metric("hardcore", true).gridColumn, "1 / -1");
  assert.equal(raRecipes.compactProfile.metric("softcore", true).gridColumn, "1 / -1");
  assert.equal(raRecipes.compactProfile.metric("shared").gridColumn, undefined);
  assert.doesNotMatch(profileSource, /CompactAction label=\{`Refresh RetroAchievements/u);
  assert.match(loadingSource, /achievementCompanionQamTheme/u);
  assert.match(loadingSource, /data-ac-ra-theme=\{!isSteam \? "compact" : undefined\}/u);
  assert.doesNotMatch(loadingSource, /rgba\(218, 70, 241/u);
});

test("Steam and RetroAchievements compact calendars share the same D-pad destination rules", async () => {
  const [steamSource, raSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-steam-compact-profile.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-retroachievements-compact-profile.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(steamSource, /getDeckyActivityCalendarFocusDestination\(index, cells\.length, direction\)/u);
  assert.match(raSource, /getDeckyActivityCalendarFocusDestination\(index, cells\.length, direction\)/u);
});

test("Steam and RetroAchievements compact controls share the same focus recipe and restrained calendar ring", () => {
  const shared = getQamCompactFocusControlStyle();
  const steam = getSteamCompactActionStyle("row", true);
  const ra = raRecipes.action("compact", false, true);
  assert.equal(shared.border, `1px solid ${achievementCompanionQamTheme.focus.compactBorder}`);
  assert.equal(steam.border, shared.border);
  assert.equal(ra.border, shared.border);
  assert.equal(steam.background, shared.background);
  assert.equal(ra.background, shared.background);
  assert.equal(steam.boxShadow, shared.boxShadow);
  assert.equal(ra.boxShadow, shared.boxShadow);
  assert.equal(steam.transition, shared.transition);
  assert.equal(ra.transition, shared.transition);
  assert.equal(raRecipes.compactProfile.calendar(true).boxShadow, shared.boxShadow);
  assert.equal(raRecipes.compactProfile.calendar(true).boxShadow, steamTheme.focus.compactShadow);
  assert.equal(raRecipes.compactProfile.calendarCell(3, false, true).boxShadow, shared.boxShadow);
  assert.equal(raRecipes.compactProfile.calendarCell(3, false, true).boxShadow, steamTheme.focus.compactShadow);
  assert.equal(raRecipes.compactProfile.calendarCell(3, false, false).boxShadow, "none");
  assert.deepEqual(raRecipes.compactProfile.calendarLegend, getQamActivityCalendarLegendStyle());
  for (const level of [0, 1, 2, 3, 4] as const) {
    const dayCell = raRecipes.compactProfile.calendarCell(level);
    const legendCell = raRecipes.compactProfile.calendarLegendCell(level);
    assert.deepEqual(legendCell, getQamActivityCalendarLegendCellStyle(level));
    assert.equal(legendCell.width, 10);
    assert.equal(legendCell.height, 10);
    assert.equal(legendCell.borderRadius, 2);
    assert.equal(dayCell.background, qamActivityCalendarColors[level]);
    assert.equal(legendCell.background, dayCell.background);
    assert.equal(legendCell.boxShadow, undefined);
  }
});

test("compact calendar D-pad moves through weekdays and weeks, then exits at shared vertical boundaries", () => {
  assert.deepEqual(getDeckyActivityCalendarFocusDestination(0, 56, "up"), { kind: "profile" });
  assert.deepEqual(getDeckyActivityCalendarFocusDestination(0, 56, "down"), { kind: "cell", index: 1 });
  assert.deepEqual(getDeckyActivityCalendarFocusDestination(0, 56, "left"), { kind: "stay" });
  assert.deepEqual(getDeckyActivityCalendarFocusDestination(0, 56, "right"), { kind: "cell", index: 7 });
  assert.deepEqual(getDeckyActivityCalendarFocusDestination(7, 56, "left"), { kind: "cell", index: 0 });
  assert.deepEqual(getDeckyActivityCalendarFocusDestination(10, 56, "right"), { kind: "cell", index: 17 });
  assert.deepEqual(getDeckyActivityCalendarFocusDestination(55, 56, "up"), { kind: "cell", index: 54 });
  assert.deepEqual(getDeckyActivityCalendarFocusDestination(55, 56, "down"), { kind: "activity" });
  assert.deepEqual(getDeckyActivityCalendarFocusDestination(55, 56, "right"), { kind: "stay" });
  assert.deepEqual(getDeckyActivityCalendarFocusDestination(52, 53, "down"), { kind: "stay" });
});
