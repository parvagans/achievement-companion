import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { CompletionProgressSnapshot, DashboardSnapshot, GameDetailSnapshot, NormalizedGame } from "../src/core/domain";
import { DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS } from "../src/core/settings";
import {
  buildFullScreenGameSections,
  getAdjacentFullScreenGameSectionId,
} from "../src/platform/decky/decky-full-screen-game-section-navigation";
import {
  readFullScreenGameSectionPageState,
  resetFullScreenGameSectionPageStatesForTests,
  updateFullScreenGameSectionPageState,
} from "../src/platform/decky/decky-full-screen-game-section-state";
import {
  getAdjacentProviderFullScreenSessionTab,
  getProviderFullScreenSessionTabs,
} from "../src/platform/decky/decky-steam-full-screen-session-navigation";
import {
  hasDistinctRetroAchievementsModes,
  projectRetroAchievementsFullScreenAchievements,
} from "../src/platform/decky/decky-retroachievements-full-screen-achievement-data";
import {
  buildRetroAchievementsCommunityInsights,
  buildRetroAchievementsCommunityRarityDistribution,
  hasDisplayableRetroAchievementsCommunityStats,
} from "../src/platform/decky/decky-retroachievements-community-stats-data";
import {
  formatSteamGamesActivityDate,
  matchesSteamGamesFilter,
  selectSteamGames,
  summarizeSteamGamesDashboard,
} from "../src/platform/decky/decky-steam-full-screen-games-data";
import { filterCompletionProgressGamesBySubsetVisibility } from "../src/platform/decky/decky-completion-progress-grouping";
import { buildRetroAchievementsCompactAchievementListModel } from "../src/platform/decky/decky-compact-achievement-model";
import {
  cacheDeckyRetroAchievementsSubsetDetailState,
  readDeckyRetroAchievementsSubsetDetailStates,
  resetDeckyRetroAchievementsSubsetDetailCacheForTests,
} from "../src/platform/decky/decky-retroachievements-subset-detail-cache";
import { buildRetroAchievementsFullScreenProfileModel, filterRetroAchievementsGamesBySystem, getRetroAchievementsProfileSystems } from "../src/platform/decky/decky-retroachievements-full-screen-profile-data";
import { getRetroAchievementsModeUnlockedCount } from "../src/platform/decky/decky-retroachievements-mode-progress";
import { isRetroAchievementsUnlockedInMode } from "../src/platform/decky/decky-retroachievements-unlock-mode";
import { buildRetroAchievementsSystemsOverview } from "../src/platform/decky/decky-retroachievements-systems-data";
import { getRetroAchievementsRefreshActionPresentation } from "../src/platform/decky/providers/retroachievements/settings-view-model";

const game: NormalizedGame = {
  providerId: "retroachievements",
  gameId: "14402",
  title: "Mode Test",
  status: "in_progress",
  summary: { unlockedCount: 2, totalCount: 3, completionPercent: 67 },
  hardcoreSummary: { unlockedCount: 1, totalCount: 3, completionPercent: 33 },
  softcoreSummary: { unlockedCount: 1, totalCount: 3, completionPercent: 33 },
  lastUnlockAt: 300,
  metrics: [],
};

test("Games dates distinguish an unknown RA unlock date from no Steam playtime", () => {
  const missingUnlockDate = { ...game, lastUnlockAt: undefined, lastPlayedAt: 1_700_000_000_000 };
  assert.equal(formatSteamGamesActivityDate(missingUnlockDate, "retroachievements"), "Unavailable");
  assert.notEqual(formatSteamGamesActivityDate(missingUnlockDate, "steam"), "Never");
  assert.equal(formatSteamGamesActivityDate({ ...missingUnlockDate, lastPlayedAt: undefined }, "steam"), "Never");
  assert.notEqual(formatSteamGamesActivityDate(game, "retroachievements"), "Unavailable");
});

test("a missing RA mode count stays unavailable even when the other mode is known", () => {
  const profile = {
    summary: { unlockedCount: 12, totalCount: 14 },
    hardcoreUnlockedCount: 2,
  } as DashboardSnapshot["profile"];
  assert.equal(getRetroAchievementsModeUnlockedCount(profile, "softcore"), undefined);
  assert.equal(getRetroAchievementsModeUnlockedCount(profile, "hardcore"), 2);
  assert.equal(getRetroAchievementsModeUnlockedCount(profile, "both"), 12);
});

test("RA Games does not show an overall percentage from incomplete game totals", () => {
  const unknownTotalGame: NormalizedGame = {
    ...game,
    gameId: "unknown-total",
    summary: { unlockedCount: 1 },
  };
  const completion = {
    providerId: "retroachievements",
    games: [game, unknownTotalGame],
  } as CompletionProgressSnapshot;
  const summary = summarizeSteamGamesDashboard(completion);
  assert.equal(summary.completionPercent, undefined);
  assert.equal(summary.totalAchievements, 3);
});

test("RA mode dashboards leave progress unavailable when a game's mode split is missing", () => {
  const missingModeGame: NormalizedGame = {
    ...game,
    gameId: "missing-mode",
    platformId: "7",
    platformLabel: "NES",
    summary: { unlockedCount: 2, totalCount: 3 },
    hardcoreSummary: undefined,
    softcoreSummary: undefined,
  };
  const completion = {
    providerId: "retroachievements",
    games: [game, missingModeGame],
  } as CompletionProgressSnapshot;
  const profile = {
    summary: { unlockedCount: 4, totalCount: 6 },
    hardcoreUnlockedCount: 1,
    metrics: [],
  } as DashboardSnapshot["profile"];
  const dashboard = {
    profile,
    featuredGames: completion.games,
    recentAchievements: [],
    recentUnlocks: [],
    recentlyPlayedGames: [],
  } as DashboardSnapshot;
  const settings = { ...DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS, retroAchievementsAchievementMode: "hardcore" as const };
  const profileModel = buildRetroAchievementsFullScreenProfileModel({ snapshot: dashboard, completion, settings });

  assert.equal(summarizeSteamGamesDashboard(completion, "hardcore").completionPercent, undefined);
  assert.equal(buildRetroAchievementsSystemsOverview(profile, completion.games, "hardcore").systems, undefined);
  assert.equal(profileModel.systemsUnavailable, true);
  assert.deepEqual(profileModel.systems, []);
  assert.notEqual(summarizeSteamGamesDashboard(completion, "both").completionPercent, undefined);
  assert.notEqual(buildRetroAchievementsSystemsOverview(profile, completion.games, "both").systems, undefined);
});

const snapshot: GameDetailSnapshot = {
  game,
  achievements: [
    {
      providerId: "retroachievements",
      gameId: game.gameId,
      achievementId: "hardcore-only",
      title: "Hardcore only",
      isUnlocked: true,
      unlockedAt: 100,
      hardcoreUnlockedAt: 100,
      unlockMode: "hardcore",
      metrics: [],
    },
    {
      providerId: "retroachievements",
      gameId: game.gameId,
      achievementId: "softcore-only",
      title: "Softcore only",
      isUnlocked: true,
      unlockedAt: 200,
      softcoreUnlockedAt: 200,
      unlockMode: "softcore",
      metrics: [],
    },
    {
      providerId: "retroachievements",
      gameId: game.gameId,
      achievementId: "locked",
      title: "Locked",
      isUnlocked: false,
      metrics: [],
    },
  ],
};

test("RA full-screen game keeps one mode-aware progress bar and a status-only banner", async () => {
  const [overview, banner] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-retroachievements-game-overview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-retroachievements-game-status-banner.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(overview, /summary: presentation\.summary/u);
  assert.match(overview, /achievementMode,\s*\}\)/u);
  assert.match(overview, /getCompletionTone\(presentation\.completionStatus\)/u);
  assert.doesNotMatch(banner, /role="progressbar"|BannerProgressBar/u);
  assert.match(banner, /DeckyGameStatusIcon/u);
});

test("provider visit tab order hides Systems from the RA cycle", () => {
  const steamTabs = getProviderFullScreenSessionTabs("steam");
  const raTabs = getProviderFullScreenSessionTabs("retroachievements");

  assert.deepEqual(steamTabs, ["profile", "games", "activity", "settings"]);
  assert.deepEqual(raTabs, ["profile", "games", "activity", "settings"]);
  assert.equal(getAdjacentProviderFullScreenSessionTab(raTabs, "profile", "previous"), "settings");
  assert.equal(getAdjacentProviderFullScreenSessionTab(raTabs, "activity", "next"), "settings");
  assert.equal(getAdjacentProviderFullScreenSessionTab(raTabs, "settings", "next"), "profile");
});

test("RA Systems overview uses profile totals and only attributed game systems for its breakdown", () => {
  const profile = { summary: { unlockedCount: 975, totalCount: 5_789 } } as Parameters<typeof buildRetroAchievementsSystemsOverview>[0];
  const games: NormalizedGame[] = [
    { ...game, gameId: "nes", platformId: "7", platformLabel: "NES", summary: { unlockedCount: 6, totalCount: 10 }, metrics: [{ key: "highest-award-kind", label: "Award", value: "mastered-hardcore" }] },
    { ...game, gameId: "snes", platformId: "3", platformLabel: "SNES", summary: { unlockedCount: 3, totalCount: 10 }, metrics: [{ key: "highest-award-kind", label: "Award", value: "beaten-hardcore" }] },
    { ...game, gameId: "gba", platformId: "5", platformLabel: "Game Boy Advance", summary: { unlockedCount: 1, totalCount: 4 }, metrics: [] },
    { ...game, gameId: "unplayed", platformId: "21", platformLabel: "PlayStation 2", summary: { unlockedCount: 0, totalCount: 5 }, metrics: [] },
    { ...game, gameId: "unknown", summary: { unlockedCount: 20, totalCount: 30 }, metrics: [] },
  ];

  const overview = buildRetroAchievementsSystemsOverview(profile, games);
  assert.equal(overview.unlocked, 975);
  assert.equal(overview.total, 5_789);
  assert.equal(overview.completionPercent, 17);
  assert.equal(overview.systems?.systemsWithUnlocks, 3);
  assert.equal(overview.systems?.gamesWithUnlocks, 4);
  assert.equal(overview.systems?.masteredGames, 1);
  assert.equal(overview.systems?.beatenGames, 1);
  assert.equal(overview.systems?.attributedUnlocks, 10);
  assert.deepEqual(overview.systems?.breakdown.map((item) => [item.title, item.unlocked, item.sharePercent]), [
    ["NES", 6, 60], ["SNES", 3, 30], ["Game Boy Advance", 1, 10],
  ]);
  assert.equal(overview.systems?.topSystem?.title, "NES");
  assert.equal(buildRetroAchievementsSystemsOverview(profile, undefined).systems, undefined);
});

test("RA Systems award tiles count verified game awards, not consoles or softcore completions", () => {
  const profile = { summary: { unlockedCount: 30, totalCount: 60 } } as Parameters<typeof buildRetroAchievementsSystemsOverview>[0];
  const awardGame = (gameId: string, award: string): NormalizedGame => ({
    ...game,
    gameId,
    platformId: "7",
    platformLabel: "NES",
    summary: { unlockedCount: 5, totalCount: 10 },
    metrics: [{ key: "highest-award-kind", label: "Award", value: award }],
  });
  const overview = buildRetroAchievementsSystemsOverview(profile, [
    awardGame("mastered-1", "mastered-hardcore"),
    awardGame("mastered-2", "completed-hardcore"),
    awardGame("beaten-1", "beaten-hardcore"),
    awardGame("beaten-2", "beaten-softcore"),
    awardGame("completed-softcore", "completed-softcore"),
  ]);
  assert.equal(overview.systems?.systemsWithUnlocks, 1);
  assert.equal(overview.systems?.gamesWithUnlocks, 5);
  assert.equal(overview.systems?.masteredGames, 2);
  assert.equal(overview.systems?.beatenGames, 2);
});

test("RA Systems breakdown percentages add to 100 after rounding", () => {
  const profile = { summary: { unlockedCount: 3, totalCount: 6 } } as Parameters<typeof buildRetroAchievementsSystemsOverview>[0];
  const games = [1, 2, 3].map((id): NormalizedGame => ({
    ...game, gameId: String(id), platformId: String(id), platformLabel: `System ${id}`,
    summary: { unlockedCount: 1, totalCount: 2 },
  }));
  const shares = buildRetroAchievementsSystemsOverview(profile, games).systems?.breakdown.map((item) => item.sharePercent);
  assert.deepEqual(shares, [34, 33, 33]);
});

test("RA Profile and Systems count subset achievements toward N64 without treating subsets as games", () => {
  const profile = { summary: { unlockedCount: 256, totalCount: 500 }, metrics: [] } as Parameters<typeof buildRetroAchievementsSystemsOverview>[0];
  const games: NormalizedGame[] = [
    { ...game, gameId: "n64-parent", title: "N64 Game", platformId: "2", platformLabel: "Nintendo 64", systemIconUrl: "n64.png", summary: { unlockedCount: 253, totalCount: 400 } },
    { ...game, gameId: "n64-subset", parentGameId: "n64-parent", title: "N64 Game [Subset - Bonus]", platformId: "2", platformLabel: "Nintendo 64", summary: { unlockedCount: 3, totalCount: 10 } },
  ];
  const snapshot = {
    profile, featuredGames: games, recentAchievements: [], recentUnlocks: [], recentlyPlayedGames: [],
  } as unknown as DashboardSnapshot;
  const completion = { games, summary: { unfinishedCount: 2, beatenCount: 0, masteredCount: 0 } } as CompletionProgressSnapshot;
  const profileModel = buildRetroAchievementsFullScreenProfileModel({
    snapshot, completion, settings: DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS,
  });
  const systems = buildRetroAchievementsSystemsOverview(profile, games);

  assert.equal(profileModel.systems[0]?.unlockedAchievements, 256);
  assert.equal(systems.systems?.topSystem?.unlockedAchievements, 256);
  assert.equal(systems.systems?.breakdown[0]?.unlocked, 256);
  assert.equal(systems.systems?.gamesWithUnlocks, 1);
  assert.equal(systems.systems?.attributedUnlocks, 256);
  assert.equal(profileModel.completion.gamesWithProgress, 1);
  assert.equal(buildRetroAchievementsFullScreenProfileModel({ snapshot, settings: DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS }).systems[0]?.unlockedAchievements, 256);
});

test("Profile system keys filter Games and their achievement subsets consistently", () => {
  const games: NormalizedGame[] = [
    { ...game, gameId: "n64", platformId: "2", platformLabel: "Nintendo 64" },
    { ...game, gameId: "n64-subset", parentGameId: "n64", platformId: "2", platformLabel: "Nintendo 64" },
    { ...game, gameId: "nes", platformId: "7", platformLabel: "NES/Famicom" },
  ];
  const systemId = getRetroAchievementsProfileSystems(games)[0]?.systemId;
  assert.equal(systemId, "2");
  assert.deepEqual(filterRetroAchievementsGamesBySystem(games, systemId).map((entry) => entry.gameId), ["n64", "n64-subset"]);
  assert.equal(filterRetroAchievementsGamesBySystem(games, undefined), games);
});

test("RA achievement mode keeps Profile, Systems, and Games counts aligned", () => {
  const profile = {
    summary: { unlockedCount: 7, totalCount: 12 },
    hardcoreUnlockedCount: 4,
    softcoreUnlockedCount: 3,
    metrics: [],
  } as unknown as DashboardSnapshot["profile"];
  const games: NormalizedGame[] = [
    { ...game, gameId: "n64", platformId: "2", platformLabel: "Nintendo 64", summary: { unlockedCount: 4, totalCount: 5 }, hardcoreSummary: { unlockedCount: 3, totalCount: 5 }, softcoreSummary: { unlockedCount: 1, totalCount: 5 }, metrics: [{ key: "highest-award-kind", label: "Award", value: "mastered-hardcore" }, { key: "highest-award-date", label: "Date", value: "100" }] },
    { ...game, gameId: "subset", parentGameId: "n64", platformId: "2", platformLabel: "Nintendo 64", summary: { unlockedCount: 2, totalCount: 3 }, hardcoreSummary: { unlockedCount: 1, totalCount: 3 }, softcoreSummary: { unlockedCount: 1, totalCount: 3 }, metrics: [] },
    { ...game, gameId: "nes", platformId: "7", platformLabel: "NES", summary: { unlockedCount: 1, totalCount: 4 }, hardcoreSummary: { unlockedCount: 0, totalCount: 4 }, softcoreSummary: { unlockedCount: 1, totalCount: 4 }, metrics: [{ key: "highest-award-kind", label: "Award", value: "beaten-softcore" }, { key: "highest-award-date", label: "Date", value: "200" }] },
  ];
  const dashboard = { profile, featuredGames: games, recentAchievements: [], recentUnlocks: [], recentlyPlayedGames: [] } as unknown as DashboardSnapshot;
  const completion = { providerId: "retroachievements", games, summary: { unfinishedCount: 0, beatenCount: 1, masteredCount: 1 } } as CompletionProgressSnapshot;
  const cases = [
    { mode: "both", unlocked: 7, n64: 6, attributed: 7, played: 2, beaten: 1, mastered: 1 },
    { mode: "hardcore", unlocked: 4, n64: 4, attributed: 4, played: 1, beaten: 0, mastered: 1 },
    { mode: "softcore", unlocked: 3, n64: 2, attributed: 3, played: 2, beaten: 1, mastered: 0 },
  ] as const;

  for (const expected of cases) {
    const settings = { ...DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS, retroAchievementsAchievementMode: expected.mode };
    const profileModel = buildRetroAchievementsFullScreenProfileModel({ snapshot: dashboard, completion, settings });
    const systems = buildRetroAchievementsSystemsOverview(profile, games, expected.mode);
    const gamesSummary = summarizeSteamGamesDashboard({ ...completion, games: [games[0]!, games[2]!] }, expected.mode, games);
    assert.equal(profileModel.progressByMode[expected.mode]?.unlockedCount, expected.unlocked);
    assert.equal(systems.unlocked, expected.unlocked);
    assert.equal(profileModel.systems[0]?.unlockedAchievements, expected.n64);
    assert.equal(systems.systems?.topSystem?.unlockedAchievements, expected.n64);
    assert.equal(systems.systems?.attributedUnlocks, expected.attributed);
    assert.equal(systems.systems?.gamesWithUnlocks, expected.played);
    assert.equal(profileModel.modeAwardCounts.beaten, expected.beaten);
    assert.equal(profileModel.modeAwardCounts.mastered, expected.mastered);
    assert.equal(systems.systems?.beatenGames, expected.beaten);
    assert.equal(systems.systems?.masteredGames, expected.mastered);
    assert.equal(gamesSummary.unlockedAchievements, expected.unlocked);
    assert.equal(gamesSummary.totalAchievements, 12);
    assert.equal(gamesSummary.playedCount, expected.played);
  }

  assert.equal(buildRetroAchievementsSystemsOverview({ ...profile, hardcoreUnlockedCount: undefined, softcoreUnlockedCount: undefined }, games, "hardcore").unlocked, undefined);
  assert.deepEqual(getRetroAchievementsProfileSystems([{ ...games[0]!, hardcoreSummary: undefined, softcoreSummary: undefined }], "hardcore"), []);
});

test("RA Profile shows the latest game for each distinct completion award", () => {
  const profile = { summary: { unlockedCount: 9, totalCount: 12 }, hardcoreUnlockedCount: 9, softcoreUnlockedCount: 0, metrics: [] } as unknown as DashboardSnapshot["profile"];
  const awardedGame = (id: string, award: string, date: number): NormalizedGame => ({
    ...game,
    gameId: id,
    lastUnlockAt: date > 0 ? date : 150,
    hardcoreSummary: { unlockedCount: 1, totalCount: 3 },
    softcoreSummary: { unlockedCount: 0, totalCount: 3 },
    metrics: [{ key: "highest-award-kind", label: "Award", value: award }, { key: "highest-award-date", label: "Date", value: String(date) }],
  });
  const games = [
    awardedGame("older-beaten", "beaten-hardcore", 100),
    awardedGame("mastered", "mastered", 0),
    awardedGame("newer-beaten", "beaten-hardcore", 300),
  ];
  const dashboard = { profile, featuredGames: games, recentAchievements: [], recentUnlocks: [], recentlyPlayedGames: [] } as unknown as DashboardSnapshot;
  const settings = { ...DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS, retroAchievementsAchievementMode: "hardcore" as const };
  const model = buildRetroAchievementsFullScreenProfileModel({ snapshot: dashboard, settings });

  assert.deepEqual(model.recentCompletions.map(({ game: completedGame, kind }) => [completedGame.gameId, kind]), [
    ["newer-beaten", "beaten"],
    ["mastered", "mastered"],
  ]);
  assert.deepEqual(model.completionAwardCounts, { beaten: 2, completed: 0, mastered: 1 });
  assert.equal(model.recentCompletions[1]?.dateKind, "unlock");

  const newerMasteredModel = buildRetroAchievementsFullScreenProfileModel({
    snapshot: { ...dashboard, featuredGames: [awardedGame("beaten", "beaten-hardcore", 100), awardedGame("newest-mastered", "mastered", 400)] },
    settings,
  });
  assert.deepEqual(newerMasteredModel.recentCompletions.map(({ kind }) => kind), ["beaten", "mastered"]);

  const singleMasteredModel = buildRetroAchievementsFullScreenProfileModel({
    snapshot: { ...dashboard, featuredGames: [awardedGame("only-mastered", "mastered", 400)] },
    settings,
  });
  assert.deepEqual(singleMasteredModel.recentCompletions.map(({ kind }) => kind), ["mastered"]);
});

test("RetroAchievements refresh success is represented by a green action label, not a success caption", () => {
  assert.deepEqual(getRetroAchievementsRefreshActionPresentation("idle"), {
    title: "Refresh RetroAchievements",
    success: false,
    danger: false,
  });
  assert.deepEqual(getRetroAchievementsRefreshActionPresentation("refreshing"), {
    title: "Refreshing RetroAchievements…",
    success: false,
    danger: false,
  });
  assert.deepEqual(getRetroAchievementsRefreshActionPresentation("refreshed"), {
    title: "RetroAchievements refreshed",
    success: true,
    danger: false,
  });
  assert.deepEqual(getRetroAchievementsRefreshActionPresentation("error"), {
    title: "Refresh failed — try again",
    success: false,
    danger: true,
  });
});

test("full-screen provider settings keep every control in one navigable pane", async () => {
  const [raSource, steamSource, generalSource, appearanceSource, sharedSectionSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/providers/retroachievements/provider-settings-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-settings-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-about-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-shared-appearance-settings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-settings-section.tsx", import.meta.url), "utf8"),
  ]);

  for (const source of [raSource, steamSource]) {
    assert.doesNotMatch(source, /data-settings-section-tabs|useDeckySettingsSectionTriggers/u);
    assert.match(source, /settingsScrollStyle/u);
    assert.match(source, /handleDeckySettingsDirection\(pageRef\.current, event\)/u);
  }
  assert.match(raSource, /SettingsGroup title="ACCOUNT"[\s\S]*SettingsGroup title="PROFILE"[\s\S]*SettingsGroup title="ACTIVITY"[\s\S]*SettingsGroup title="DATA & SYNC"/u);
  assert.match(raSource, /retroAchievementsRankDisplay[\s\S]*retroAchievementsAchievementMode[\s\S]*retroAchievementsFullscreenActivityCalendarWeeks[\s\S]*retroAchievementsCompactActivityCalendarWeeks/u);
  assert.match(raSource, /Recheck subset links on next game open[\s\S]*Sign Out of RetroAchievements/u);
  assert.match(steamSource, /aria-label="Steam account settings"[\s\S]*aria-label="SteamHunters settings"[\s\S]*aria-label="Steam activity settings"[\s\S]*aria-label="Steam data and sync"/u);
  assert.match(steamSource, /steamFullscreenActivityCalendarWeeks[\s\S]*steamCompactActivityCalendarWeeks[\s\S]*Clear Cached Data[\s\S]*Reset Steam Data/u);
  assert.match(generalSource, /DeckySharedAppearanceSettings[\s\S]*DeckyUpdateSettingsPanel[\s\S]*AboutLink title="Changelog"/u);
  assert.match(appearanceSource, /gamePageAchievementBadgeSize[\s\S]*gamePageAchievementBadgePosition[\s\S]*gamePageAchievementBadgeColors/u);
  assert.match(sharedSectionSource, /width: "100%", boxSizing: "border-box", overflow: "hidden"/u);
  assert.match(raSource, /<DeckySettingsSection themeVariant="ra"><div[\s\S]*<DeckySettingsGeneralLink onOpen=\{onOpenGeneralSettings\}/u);
  assert.match(steamSource, /<SteamSettingsContent><div[\s\S]*<DeckySettingsGeneralLink onOpen=\{onOpenGeneralSettings\}/u);
  assert.match(raSource, /fontFamily: steamTheme\.type\.fontFamily/u);
  assert.match(steamSource, /fontFamily: steamTheme\.type\.fontFamily/u);
  assert.match(raSource, /height: viewportHeight \?\? "100vh"[\s\S]*43px\) 12px 50px/u);
  assert.match(raSource, /<DeckySettingsSection themeVariant="ra">/u);
  assert.match(raSource, /className="ac-ra-fullscreen-settings-page" data-ac-steam-theme="fullscreen"/u);
  assert.doesNotMatch(raSource, /className="ac-ra-fullscreen-settings-page" data-ac-ra-theme="fullscreen"/u);
});

test("RA settings use Steam's native modal dropdown interaction and separate calendar values", async () => {
  const [dropdownSource, historySource, compactSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-settings-dropdown.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-achievement-history-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-retroachievements-compact-profile.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dropdownSource, /showContextMenu\([\s\S]*<Menu label=\{label\} onCancel=\{closeMenu\}>[\s\S]*<MenuItem[\s\S]*bModal: true, bMatchWidth: true/u);
  assert.match(dropdownSource, /registerDeckyFullscreenPopupCancel\(closeMenu\)/u);
  assert.match(dropdownSource, /requestDeckySteamGamepadFocusAfterMount\(triggerRef\.current\)/u);
  assert.match(historySource, /providerId === RETROACHIEVEMENTS_PROVIDER_ID[\s\S]*settings\.retroAchievementsFullscreenActivityCalendarWeeks[\s\S]*settings\.steamFullscreenActivityCalendarWeeks/u);
  assert.match(compactSource, /weeks=\{settings\.retroAchievementsCompactActivityCalendarWeeks\}/u);
});

test("compact RA counts follow saved preferences and settings no longer hide subsets", async () => {
  const [compactSource, settingsSource, completionSource, aboutSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-retroachievements-compact-profile.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/providers/retroachievements/provider-settings-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-completion-progress-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-about-page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(compactSource, /modeFilteredActivity\.slice\(0, recentAchievementsCount\)/u);
  assert.match(compactSource, /snapshot\.recentlyPlayedGames\.slice\(0, recentlyPlayedCount\)/u);
  assert.doesNotMatch(settingsSource, /label="Show subsets"|label="Default Completion Progress filter"/u);
  assert.match(completionSource, /showSubsets=\{true\}/u);
  assert.match(aboutSource, /GENERAL SETTINGS[\s\S]*APPEARANCE · SHARED[\s\S]*HELP &amp; LINKS/u);
  assert.doesNotMatch(aboutSource, /AC_decky_compact_logo\.png/u);
});

test("full-screen game tabs keep RA Subsets conditional and before Community", () => {
  assert.deepEqual(
    buildFullScreenGameSections({ provider: "retroachievements" }).map((section) => section.label),
    ["Overview", "Achievements"],
  );
  const withBoth = buildFullScreenGameSections({
    provider: "retroachievements",
    hasSubsets: true,
    hasCommunity: true,
  });
  assert.deepEqual(withBoth.map((section) => section.label), ["Overview", "Achievements", "Subsets", "Community"]);
  assert.equal(getAdjacentFullScreenGameSectionId(withBoth, "community", "next"), "overview");
  assert.equal(getAdjacentFullScreenGameSectionId(withBoth, "overview", "previous"), "community");
  assert.deepEqual(
    buildFullScreenGameSections({ provider: "steam", hasAchievementGroups: true, hasCommunity: true }).map((section) => section.label),
    ["Overview", "Achievements", "DLC / Groups", "Community"],
  );
});

test("subset focus and scroll state are isolated per game and survive child return", () => {
  resetFullScreenGameSectionPageStatesForTests();
  updateFullScreenGameSectionPageState("retroachievements", "100", (current) => ({
    ...current,
    activeSection: "subsets",
    subsets: {
      scrollTop: 480,
      expandedSubsetIds: ["101"],
      focusedSubsetId: "101",
      focusedAchievementId: "achievement-1",
    },
  }));
  assert.deepEqual(readFullScreenGameSectionPageState("retroachievements", "100").subsets, {
    scrollTop: 480,
    expandedSubsetIds: ["101"],
    focusedSubsetId: "101",
    focusedAchievementId: "achievement-1",
  });
  assert.equal(readFullScreenGameSectionPageState("retroachievements", "101").activeSection, "overview");
});

test("loaded RA subset achievements stay cached across child-detail return", () => {
  resetDeckyRetroAchievementsSubsetDetailCacheForTests();
  const loadedState = {
    status: "success",
    data: snapshot,
    isStale: false,
    isRefreshing: false,
  } as const;

  cacheDeckyRetroAchievementsSubsetDetailState("retroachievements", "14402", "subset-101", loadedState);

  assert.equal(
    readDeckyRetroAchievementsSubsetDetailStates("retroachievements", "14402")["subset-101"],
    loadedState,
  );
  assert.deepEqual(
    readDeckyRetroAchievementsSubsetDetailStates("retroachievements", "other-game"),
    {},
    "subset detail cache is isolated per parent game",
  );
  resetDeckyRetroAchievementsSubsetDetailCacheForTests();
});

test("RA full-screen achievement projection uses the selected mode and retains locked rows", () => {
  const hardcore = projectRetroAchievementsFullScreenAchievements(snapshot, "hardcore");
  const softcore = projectRetroAchievementsFullScreenAchievements(snapshot, "softcore");
  const both = projectRetroAchievementsFullScreenAchievements(snapshot, "both");

  assert.equal(hardcore.find((entry) => entry.achievementId === "hardcore-only")?.isUnlocked, true);
  assert.equal(hardcore.find((entry) => entry.achievementId === "softcore-only")?.isUnlocked, false);
  assert.equal(hardcore.find((entry) => entry.achievementId === "softcore-only")?.unlockedAt, undefined);
  assert.equal(softcore.find((entry) => entry.achievementId === "hardcore-only")?.isUnlocked, false);
  assert.equal(softcore.find((entry) => entry.achievementId === "softcore-only")?.unlockedAt, 200);
  assert.equal(hardcore.find((entry) => entry.achievementId === "locked")?.isUnlocked, false);
  assert.equal(both, snapshot.achievements);
  assert.equal(hasDistinctRetroAchievementsModes(snapshot.achievements), true);
});

test("a Softcore achievement upgraded to Hardcore belongs only to Hardcore", () => {
  const upgraded = {
    ...snapshot.achievements[0]!,
    achievementId: "upgraded",
    isUnlocked: true,
    unlockMode: "hardcore" as const,
    softcoreUnlockedAt: 100,
    hardcoreUnlockedAt: 300,
    unlockedAt: 300,
  };
  const upgradedSnapshot = { ...snapshot, achievements: [upgraded] };

  assert.equal(isRetroAchievementsUnlockedInMode(upgraded, "hardcore"), true);
  assert.equal(isRetroAchievementsUnlockedInMode(upgraded, "softcore"), false);
  assert.equal(hasDistinctRetroAchievementsModes([upgraded]), false);
  assert.equal(projectRetroAchievementsFullScreenAchievements(upgradedSnapshot, "hardcore")[0]?.unlockedAt, 300);
  assert.equal(projectRetroAchievementsFullScreenAchievements(upgradedSnapshot, "softcore")[0]?.isUnlocked, false);
  assert.equal(projectRetroAchievementsFullScreenAchievements(upgradedSnapshot, "softcore")[0]?.unlockedAt, undefined);
  assert.equal(buildRetroAchievementsCompactAchievementListModel(upgradedSnapshot, "softcore").rows[0]?.isUnlocked, false);
});

test("RA Games uses award/status semantics and recent unlock ordering", () => {
  const mastered: NormalizedGame = {
    ...game,
    gameId: "mastered",
    title: "Mastered",
    status: "mastered",
    lastUnlockAt: 100,
    metrics: [{ key: "highest-award-kind", label: "Highest Award", value: "mastered-hardcore" }],
  };
  const beaten: NormalizedGame = {
    ...game,
    gameId: "beaten",
    title: "Beaten",
    status: "beaten",
    lastUnlockAt: 200,
    metrics: [{ key: "highest-award-kind", label: "Highest Award", value: "beaten-hardcore" }],
  };

  assert.equal(matchesSteamGamesFilter(mastered, "mastered"), true);
  assert.equal(matchesSteamGamesFilter(beaten, "beaten"), true);
  assert.equal(matchesSteamGamesFilter(game, "unfinished"), true);
  assert.deepEqual(
    selectSteamGames({ games: [mastered, game, beaten], filter: "all", query: "", sort: "recent" })
      .map((entry) => entry.gameId),
    [game.gameId, beaten.gameId, mastered.gameId],
  );
});

test("RA full-screen Games excludes subset rows; parent game pages own subset navigation", () => {
  const subset: NormalizedGame = {
    ...game,
    gameId: "subset",
    title: "Mode Test [Subset - Bonus]",
  };
  const visible = filterCompletionProgressGamesBySubsetVisibility([game, subset], false);
  assert.deepEqual(visible.map((entry) => entry.gameId), [game.gameId]);
});

test("RA full-screen Profile keeps identity compact and uses saved-mode progress", async () => {
  const source = await readFile(new URL("../src/platform/decky/decky-retroachievements-full-screen-profile-dashboard.tsx", import.meta.url), "utf8");
  assert.match(source, /"profile profile profile profile profile profile"/u);
  assert.match(source, /"progress progress" "systems completions"/u);
  assert.match(source, /width: 70, height: 70/u);
  assert.match(source, /data-ra-profile-avatar-link="true"/u);
  assert.doesNotMatch(source, /label="View RA profile"/u);
  assert.doesNotMatch(source, /Saved mode:/u);
  assert.match(source, /allowModeSelection=\{model\.initialAchievementMode === "both"\}/u);
  assert.match(source, /<ModeChip mode="hardcore"[\s\S]*<ModeChip mode="softcore"[\s\S]*<ModeChip mode="both"/u);
  assert.match(source, /<DeckyCompletionProgressBar percent=\{progress\.completionPercent\} showCaption=\{false\}/u);
  assert.match(source, /const onOpen = \(\): void => onOpenCompletionProgress\(kind\)/u);
  assert.match(source, /onClick=\{\(\) => onOpenExternalUrl\(profileUrl\)\}/u);
});
test("RA full-screen profile systems aggregate unlocked achievements by console and keep the top three", () => {
  const systems = getRetroAchievementsProfileSystems([
    { ...game, gameId: "nes-1", platformId: "7", platformLabel: "NES", systemIconUrl: "nes.png", summary: { unlockedCount: 200, totalCount: 400 } },
    { ...game, gameId: "nes-2", platformId: "7", platformLabel: "NES", summary: { unlockedCount: 112, totalCount: 200 } },
    { ...game, gameId: "snes-1", platformId: "3", platformLabel: "SNES", systemIconUrl: "snes.png", summary: { unlockedCount: 428, totalCount: 900 } },
    { ...game, gameId: "gba-1", platformId: "5", platformLabel: "Game Boy Advance", summary: { unlockedCount: 287, totalCount: 500 } },
    { ...game, gameId: "ps2-1", platformId: "21", platformLabel: "PlayStation 2", summary: { unlockedCount: 999, totalCount: 1200 } },
  ], "both", 3);

  assert.deepEqual(systems.map((system) => [system.title, system.unlockedAchievements]), [
    ["PlayStation 2", 999],
    ["SNES", 428],
    ["NES", 312],
  ]);
  assert.equal(systems[2]?.iconUrl, "nes.png");
  assert.equal(systems[2]?.completionPercent, 52);
});

test("RA Profile shows three compact system links into Games", async () => {
  const source = await readFile(new URL("../src/platform/decky/decky-retroachievements-full-screen-profile-dashboard.tsx", import.meta.url), "utf8");
  assert.match(source, /model\.systems\.slice\(0, 3\)\.map/u);
  assert.match(source, /flow-children="vertical"[\s\S]*style=\{systemsRailStyle\(\)\}/u);
  assert.match(source, /gridTemplateRows: "repeat\(3, minmax\(0, 1fr\)\)"/u);
  assert.match(source, /onActivate=\{\(\) => onOpenSystem\(system\)\}/u);
  assert.match(source, /data-ra-profile-system=\{system\.systemId\}/u);
  assert.match(source, /querySelector<HTMLElement>\("\[data-ra-profile-system\]"\)/u);
});

test("RA Profile navigates both card columns vertically and opens completion filters in Games", async () => {
  const [dashboard, page] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-retroachievements-full-screen-profile-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-profile-page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /const moveWithinSystems = [\s\S]*index \+ offset[\s\S]*focusAvatarLinkWithSound\(event\)/u);
  assert.match(dashboard, /const moveWithinCompletions = [\s\S]*index \+ offset[\s\S]*focusAvatarLinkWithSound\(event\)/u);
  assert.match(dashboard, /onOpenCompletionProgress\(kind\)/u);
  assert.match(page, /onOpenCompletionProgress=\{\(filter\) => onOpenCompletionProgress\(profile\.providerId, filter\)\}/u);
});

test("RA profile system aggregation can return the complete sorted system rail", () => {
  const systems = getRetroAchievementsProfileSystems([
    { ...game, gameId: "nes", platformId: "7", platformLabel: "NES", summary: { unlockedCount: 20, totalCount: 40 } },
    { ...game, gameId: "snes", platformId: "3", platformLabel: "SNES", summary: { unlockedCount: 30, totalCount: 60 } },
    { ...game, gameId: "gba", platformId: "5", platformLabel: "Game Boy Advance", summary: { unlockedCount: 10, totalCount: 20 } },
    { ...game, gameId: "ps2", platformId: "21", platformLabel: "PlayStation 2", summary: { unlockedCount: 40, totalCount: 80 } },
  ]);

  assert.deepEqual(systems.map((system) => system.title), ["PlayStation 2", "SNES", "NES", "Game Boy Advance"]);
});

test("RA Subsets mirrors Steam group expansion with square set art and child achievement rows", async () => {
  const source = await readFile(
    new URL("../src/platform/decky/decky-retroachievements-subsets-section.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /aria-expanded=\{isExpanded\}/u);
  assert.match(source, /onActivate=\{\(\) => toggleSubset\(subset\.gameId\)\}/u);
  assert.match(source, /projectRetroAchievementsFullScreenAchievements/u);
  assert.match(source, /<DeckyFullScreenAchievementRow/u);
  assert.match(source, /return subset\.coverImageUrl \?\? subset\.boxArtImageUrl/u);
  assert.match(source, /title=\{subset\.title\}/u);
  assert.match(source, /getSubsetCountStyle/u);
  assert.match(source, /\{completionPercent\}%/u);
  assert.match(source, /Loading subset achievements/u);
  assert.match(source, /Subset achievements unavailable/u);
});

test("Steam and RA full-screen achievement rows share the neutral card and collective progress treatment", async () => {
  const [rowSource, themeSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-full-screen-achievement-row.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-qam-theme.ts", import.meta.url), "utf8"),
  ]);

  assert.equal((rowSource.match(/<AchievementRowRail/g) ?? []).length, 2);
  assert.match(rowSource, /const accentColor = achievement\.isUnlocked \? steamTheme\.color\.unlocked : steamTheme\.color\.locked/u);
  assert.doesNotMatch(rowSource, /achievement\.isUnlocked \? steamTheme\.color\.rewardGold/u);
  assert.match(rowSource, /achievementCompanionAchievementRowRecipes\.surface\("fullscreen", accentColor\)/u);
  assert.doesNotMatch(rowSource, /const accentSurface = isHardcore/u);
  assert.match(rowSource, /const rarityPercent = counts\.unlockRatePercent/u);
  assert.match(rowSource, /getSteamAchievementCommunityPercent\(achievement, steamHuntersAchievement\)/u);
  assert.match(rowSource, /achievementCompanionAchievementRowRecipes\.rarity\.fill\(rarityPercent\)/u);
  assert.match(rowSource, /`\$\{Math\.round\(rarityPercent\)\}% players`/u);
  assert.match(themeSource, /achievementCompanionAchievementRowRecipes = \{[\s\S]*height: density === "compact" \? 3 : 4[\s\S]*background: achievementCompanionQamTheme\.color\.accent/u);
});

test("RA full-screen game keeps the loading gate up until subset discovery settles", async () => {
  const source = await readFile(
    new URL("../src/platform/decky/decky-full-screen-game-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /isWaitingForRetroAchievementsSubsets/u);
  assert.match(source, /activeSteamSection === "subsets"[\s\S]*relatedGamesState\.status === "idle"/u);
  assert.match(source, /relatedGamesState\.status === "idle" \|\| relatedGamesState\.status === "loading"/u);
  assert.match(source, /title: "Loading game subsets\.\.\."/u);
  assert.match(source, /isWaitingForSteamHuntersEnrichment \|\| isWaitingForRetroAchievementsSubsets/u);
});

test("RA Community requires displayable real metrics and rejects sample-only or denominator-free rates", () => {
  assert.equal(hasDisplayableRetroAchievementsCommunityStats(undefined), false);
  assert.equal(hasDisplayableRetroAchievementsCommunityStats({ beatenSamples: 20, masteredSamples: 4 }), false);
  assert.equal(hasDisplayableRetroAchievementsCommunityStats({ masteryPercent: 10 }), false);
  assert.equal(hasDisplayableRetroAchievementsCommunityStats({ totalPlayers: 100 }), true);
  assert.equal(hasDisplayableRetroAchievementsCommunityStats({ totalPlayers: 100, masteredPlayers: 10, masteryPercent: 10 }), true);
  assert.equal(hasDisplayableRetroAchievementsCommunityStats({ medianMasterySeconds: 3_600 }), true);
});

test("RA Community combines Hardcore and Softcore beat medians into one of six insights", () => {
  const insights = buildRetroAchievementsCommunityInsights({
    totalPlayers: 2372,
    masteredPlayers: 101,
    masteryPercent: 4.3,
    medianBeatSeconds: 20 * 3600 + 2 * 60,
    medianBeatSoftcoreSeconds: 11 * 3600 + 17 * 60,
    medianCompletionSeconds: 23 * 3600 + 31 * 60,
    medianMasterySeconds: 28 * 3600,
  });
  assert.deepEqual(insights.map((insight) => insight.label), [
    "Players", "Mastered Players", "Mastery", "Median Beat", "Median Completion", "Median Mastery",
  ]);
  assert.deepEqual(insights[3], { kind: "beat", label: "Median Beat", hardcore: "20h 2m", softcore: "11h 17m" });
  assert.deepEqual(buildRetroAchievementsCommunityInsights({ medianBeatSoftcoreSeconds: 3600 }), [
    { kind: "beat", label: "Median Beat", softcore: "1h" },
  ]);
});

test("RA rarity uses all earned players and Steam's category boundaries", () => {
  const achievements: GameDetailSnapshot["achievements"] = [50, 20, 5, 4, 0].map((earned, index) => ({
    providerId: "retroachievements",
    achievementId: String(index),
    gameId: game.gameId,
    title: `Achievement ${index}`,
    isUnlocked: false,
    metrics: [{ key: "unlocked-count", label: "Total Players", value: String(earned) }],
  }));
  const snapshot: GameDetailSnapshot = {
    game: { ...game, summary: { unlockedCount: 0, totalCount: achievements.length }, metrics: [{ key: "total-players", label: "Total Players", value: "100" }] },
    achievements,
    reportedAchievementCount: achievements.length,
  };
  assert.deepEqual(buildRetroAchievementsCommunityRarityDistribution(snapshot), {
    common: 1, uncommon: 1, rare: 1, veryRare: 2, total: 5,
  });
  assert.equal(buildRetroAchievementsCommunityRarityDistribution({ ...snapshot, reportedAchievementCount: undefined }), undefined);
  assert.equal(buildRetroAchievementsCommunityRarityDistribution({ ...snapshot, reportedAchievementCount: 6 }), undefined);
  assert.equal(buildRetroAchievementsCommunityRarityDistribution({ ...snapshot, achievements: achievements.slice(0, -1) }), undefined);
  assert.equal(buildRetroAchievementsCommunityRarityDistribution({ ...snapshot, achievements: [...achievements.slice(0, -1), { ...achievements[4]!, metrics: [] }] }), undefined);
  assert.equal(buildRetroAchievementsCommunityRarityDistribution({ ...snapshot, achievements: [...achievements.slice(0, -1), { ...achievements[4]!, metrics: [{ key: "unlocked-count", label: "Total Players", value: "101" }] }] }), undefined);
  assert.equal(buildRetroAchievementsCommunityRarityDistribution({ ...snapshot, game: { ...snapshot.game, metrics: [] } }), undefined);
});
