import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type {
  CompletionProgressSnapshot,
  NormalizedGame,
  NormalizedProfile,
  RecentUnlock,
  RecentlyPlayedGame,
} from "../src/core/domain";
import type { SteamLibraryAchievementScanSummary } from "../src/providers/steam/library-scan";
import {
  consumeNextFullScreenCompletionProgressFilter,
  markNextFullScreenCompletionProgressFilter,
} from "../src/platform/decky/decky-full-screen-navigation-state";
import { buildSteamFullScreenProfileSummary } from "../src/platform/decky/decky-steam-full-screen-profile-data";
import { getSteamHeroArtworkSources } from "../src/platform/decky/decky-steam-game-artwork";
import { formatFullscreenLastSync } from "../src/platform/decky/decky-stat-helpers";
import {
  matchesSteamGamesFilter,
  selectSteamGames,
  summarizeSteamGamesDashboard,
} from "../src/platform/decky/decky-steam-full-screen-games-data";
import { buildRecentActivityTrend, buildSteamActivityStats } from "../src/platform/decky/decky-steam-activity-data";
import { getAdjacentSteamFullScreenSessionTab } from "../src/platform/decky/decky-steam-full-screen-session-navigation";
import {
  consumeDeckyFullscreenTransientCancel,
  isDeckyFullscreenOnScreenKeyboardOpen,
  markDeckyFullscreenOnScreenKeyboardOpen,
} from "../src/platform/decky/decky-full-screen-footer-overlay";

function createUnlock(gameId: string, gameTitle: string, unlockedAt?: number): RecentUnlock {
  return {
    achievement: {
      providerId: "steam",
      achievementId: `${gameId}-${unlockedAt ?? "undated"}`,
      gameId,
      title: "Test achievement",
      isUnlocked: true,
      metrics: [],
      ...(unlockedAt !== undefined ? { unlockedAt } : {}),
    },
    game: { providerId: "steam", gameId, title: gameTitle },
    ...(unlockedAt !== undefined ? { unlockedAt } : {}),
  };
}

test("Steam hero selection preserves the original header and provides alternate art only as fallback", () => {
  const header = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/42/header.jpg";
  const libraryHero = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/42/library_hero.jpg";
  assert.deepEqual(getSteamHeroArtworkSources({ appid: 42 }), { src: header, fallbackSrc: libraryHero });
  assert.deepEqual(getSteamHeroArtworkSources({ appid: 42 }, { storeHeaderUrl: "https://example.com/hashed.jpg" }), {
    src: header,
    fallbackSrc: "https://example.com/hashed.jpg",
  });
  assert.deepEqual(getSteamHeroArtworkSources({ appid: 42 }, { steamHuntersBannerUrl: "https://example.com/hunter.jpg" }), {
    src: header,
    fallbackSrc: libraryHero,
  });
});

function createProfile(): NormalizedProfile {
  return {
    providerId: "steam",
    identity: { providerId: "steam", accountId: "123", displayName: "Steam User" },
    summary: { unlockedCount: 12, totalCount: 120, completionPercent: 10 },
    metrics: [],
    steamLevel: 29,
    badgeCount: 9,
    playerXp: 5_794,
    ownedGameCount: 6,
  };
}

function createLibraryScan(): SteamLibraryAchievementScanSummary {
  return {
    scannedAt: "2026-09-14T10:00:00Z",
    ownedGameCount: 6,
    scannedGameCount: 6,
    gamesWithAchievements: 4,
    skippedGameCount: 1,
    failedGameCount: 0,
    totalAchievements: 100,
    unlockedAchievements: 44,
    perfectGames: 1,
    completionPercent: 44,
    games: [
      {
        appid: 1,
        id: "1",
        gameId: "1",
        title: "Perfect Game",
        providerId: "steam",
        totalAchievements: 10,
        unlockedAchievements: 10,
        completionPercent: 100,
        hasAchievements: true,
        scanStatus: "scanned",
        playtimeForeverMinutes: 600,
      },
      {
        appid: 2,
        id: "2",
        gameId: "2",
        title: "Closest Game",
        providerId: "steam",
        totalAchievements: 50,
        unlockedAchievements: 47,
        completionPercent: 94,
        hasAchievements: true,
        scanStatus: "scanned",
        playtimeForeverMinutes: 90,
        playtimeDeckForeverMinutes: 30,
        playtimeTwoWeeksMinutes: 15,
      },
      {
        appid: 3,
        id: "3",
        gameId: "3",
        title: "Progress Game",
        providerId: "steam",
        totalAchievements: 40,
        unlockedAchievements: 20,
        completionPercent: 50,
        hasAchievements: true,
        scanStatus: "scanned",
        playtimeForeverMinutes: 1_200,
        playtimeDeckForeverMinutes: 120,
      },
      {
        appid: 4,
        id: "4",
        gameId: "4",
        title: "No Achievement Game",
        providerId: "steam",
        totalAchievements: 0,
        unlockedAchievements: 0,
        completionPercent: 0,
        hasAchievements: false,
        scanStatus: "no-achievements",
        playtimeForeverMinutes: 40,
      },
      {
        appid: 5,
        id: "5",
        gameId: "5",
        title: "Unplayed Game",
        providerId: "steam",
        totalAchievements: 20,
        unlockedAchievements: 0,
        completionPercent: 0,
        hasAchievements: true,
        scanStatus: "scanned",
      },
      {
        appid: 6,
        id: "6",
        gameId: "6",
        title: "Unknown Game",
        providerId: "steam",
        totalAchievements: 0,
        unlockedAchievements: 0,
        completionPercent: 0,
        hasAchievements: false,
        scanStatus: "failed",
      },
    ],
  };
}

function recentGame(gameId: string, lastPlayedAt: number): RecentlyPlayedGame {
  return {
    providerId: "steam",
    gameId,
    title: `Recent ${gameId}`,
    summary: { unlockedCount: 5, totalCount: 10, completionPercent: 50 },
    lastPlayedAt,
  };
}

test("full-screen profiles use the same last-sync wording and local day", () => {
  const now = new Date(2026, 9, 12, 20, 15).getTime();
  assert.match(formatFullscreenLastSync(new Date(2026, 9, 12, 20, 10).getTime(), now) ?? "", /^Last sync • Today, /u);
  assert.match(formatFullscreenLastSync(new Date(2026, 9, 11, 23, 55).getTime(), now) ?? "", /^Last sync • Yesterday, /u);
  assert.equal(formatFullscreenLastSync(undefined, now), undefined);
});

test("steam full-screen profile summary derives account, library, playtime, and highlights from cached data", () => {
  const summary = buildSteamFullScreenProfileSummary({
    profile: createProfile(),
    libraryScan: createLibraryScan(),
    recentlyPlayedGames: [recentGame("old", 100), recentGame("new", 300), recentGame("middle", 200), recentGame("extra", 50)],
  });

  assert.deepEqual(summary.account, {
    level: 29,
    badges: 9,
    xp: 5_794,
    xpToNextLevel: 206,
    nextLevel: 30,
    xpProgressPercent: 31,
  });
  assert.deepEqual(summary.achievements, { scope: "library-scan", unlocked: 44, total: 100, perfectGames: 1, completionPercent: 44 });
  assert.deepEqual(summary.library, {
    ownedGames: 6,
    playedGames: 4,
    unplayedGames: 2,
    inProgressGames: 2,
    totalPlaytimeMinutes: 1_930,
    steamDeckPlaytimeMinutes: 150,
    lastTwoWeeksPlaytimeMinutes: 15,
    lastLibraryScanAt: Date.parse("2026-09-14T10:00:00Z"),
  });
  assert.equal(summary.mostPlayedGame?.gameId, "3");
  assert.equal(summary.closestToPerfectGame?.gameId, "2");
  assert.equal(summary.closestToPerfectGame?.achievementsRemaining, 3);
  assert.deepEqual(summary.recentGames.map((game) => game.gameId), ["new", "middle", "old"]);
});

test("steam full-screen profile omits unavailable library decoration without inventing progress", () => {
  const summary = buildSteamFullScreenProfileSummary({
    profile: createProfile(),
    recentlyPlayedGames: [],
  });

  assert.equal(summary.library.playedGames, undefined);
  assert.equal(summary.library.inProgressGames, undefined);
  assert.equal(summary.achievements.scope, "recent-games");
  assert.equal(summary.achievements.total, 120);
  assert.equal(summary.achievements.perfectGames, undefined);
  assert.equal(summary.mostPlayedGame, undefined);
  assert.equal(summary.closestToPerfectGame, undefined);
  assert.deepEqual(summary.recentGames, []);
});

test("steam full-screen profile uses Steam's native game icon for recently played games", () => {
  const summary = buildSteamFullScreenProfileSummary({
    profile: createProfile(),
    recentlyPlayedGames: [{
      providerId: "steam",
      appid: 70,
      gameId: "70",
      title: "Half-Life",
      summary: { unlockedCount: 5, totalCount: 10, completionPercent: 50 },
      coverImageUrl: "https://cdn.example.invalid/game-icon.jpg",
      boxArtImageUrl: "https://cdn.example.invalid/game-logo.jpg",
      lastPlayedAt: 100,
    }],
  });

  assert.equal(
    summary.recentGames[0]?.artworkUrl,
    "https://cdn.example.invalid/game-icon.jpg",
  );
});

test("steam games dashboard preserves scan semantics across summary, filters, search, and sorting", () => {
  const games = [
    {
      providerId: "steam",
      gameId: "perfect",
      title: "Perfect Game",
      status: "mastered",
      summary: { unlockedCount: 10, totalCount: 10, completionPercent: 100 },
      metrics: [],
      hasAchievements: true,
      scanStatus: "scanned",
      playtimeForeverMinutes: 600,
      lastPlayedAt: 100,
    },
    {
      providerId: "steam",
      gameId: "unfinished-played",
      title: "Alpha Adventure",
      status: "in_progress",
      summary: { unlockedCount: 30, totalCount: 50, completionPercent: 60 },
      metrics: [],
      hasAchievements: true,
      scanStatus: "scanned",
      playtimeForeverMinutes: 120,
      lastPlayedAt: 300,
    },
    {
      providerId: "steam",
      gameId: "unfinished-unplayed",
      title: "Zero Hour",
      status: "locked",
      summary: { unlockedCount: 0, totalCount: 20, completionPercent: 0 },
      metrics: [],
      hasAchievements: true,
      scanStatus: "scanned",
    },
    {
      providerId: "steam",
      gameId: "skipped",
      title: "Skipped Game",
      status: "locked",
      summary: { unlockedCount: 0 },
      metrics: [],
      hasAchievements: false,
      scanStatus: "no-achievements",
      playtimeForeverMinutes: 40,
      lastPlayedAt: 200,
    },
    {
      providerId: "steam",
      gameId: "failed",
      title: "Failed Scan",
      status: "locked",
      summary: { unlockedCount: 0, totalCount: 7 },
      metrics: [],
      hasAchievements: false,
      scanStatus: "failed",
    },
  ] satisfies readonly NormalizedGame[];
  const snapshot = {
    providerId: "steam",
    games,
    summary: {
      playedCount: 3,
      unfinishedCount: 2,
      beatenCount: 2,
      masteredCount: 1,
    },
  } satisfies CompletionProgressSnapshot;

  assert.deepEqual(summarizeSteamGamesDashboard(snapshot), {
    trackedCount: 5,
    playedCount: 3,
    unfinishedCount: 2,
    skippedCount: 1,
    perfectedCount: 1,
    unlockedAchievements: 40,
    totalAchievements: 80,
    completionPercent: 50,
  });
  assert.deepEqual(games.filter((game) => matchesSteamGamesFilter(game, "played")).map((game) => game.gameId), [
    "perfect",
    "unfinished-played",
    "skipped",
  ]);
  assert.deepEqual(games.filter((game) => matchesSteamGamesFilter(game, "unfinished")).map((game) => game.gameId), [
    "unfinished-played",
    "unfinished-unplayed",
  ]);
  assert.deepEqual(games.filter((game) => matchesSteamGamesFilter(game, "beaten")).map((game) => game.gameId), [
    "skipped",
  ]);
  assert.deepEqual(games.filter((game) => matchesSteamGamesFilter(game, "mastered")).map((game) => game.gameId), [
    "perfect",
  ]);
  assert.deepEqual(
    selectSteamGames({ games, filter: "all", query: "game", sort: "completion" }).map((game) => game.gameId),
    ["perfect", "skipped"],
  );
  assert.deepEqual(
    selectSteamGames({ games, filter: "all", query: "", sort: "recent" }).map((game) => game.gameId),
    ["unfinished-played", "skipped", "perfect", "failed", "unfinished-unplayed"],
  );
});

test("Steam counts an unlock without recorded playtime as played, but not an untouched achievement catalog", () => {
  const libraryScan = createLibraryScan();
  const profileSummary = buildSteamFullScreenProfileSummary({
    profile: createProfile(),
    recentlyPlayedGames: [],
    libraryScan: {
      ...libraryScan,
      games: libraryScan.games.map((game) => game.gameId === "5"
        ? { ...game, unlockedAchievements: 1 }
        : game),
    },
  });
  assert.equal(profileSummary.library.playedGames, 5);
  assert.equal(profileSummary.library.inProgressGames, 3);

  const snapshot: CompletionProgressSnapshot = {
    providerId: "steam",
    games: [{
      providerId: "steam",
      gameId: "unlock-only",
      title: "Unlock Only",
      status: "in_progress",
      summary: { unlockedCount: 1, totalCount: 3 },
      metrics: [],
      hasAchievements: true,
      scanStatus: "scanned",
    }],
    summary: { playedCount: 0, unfinishedCount: 0, beatenCount: 0, masteredCount: 0 },
  };
  assert.equal(summarizeSteamGamesDashboard(snapshot).playedCount, 1);
  assert.equal(matchesSteamGamesFilter(snapshot.games[0]!, "played"), true);
});

test("Steam and RA Games use a single toolbar and list with the shared profile footer", async () => {
  const [pageSource, dashboardSource, footerSource, artworkSource] = await Promise.all([
    readFile(
      new URL("../src/platform/decky/decky-full-screen-completion-progress-page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/platform/decky/decky-steam-full-screen-games-dashboard.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/platform/decky/decky-full-screen-footer-overlay.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/platform/decky/decky-steam-game-artwork.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(pageSource, /snapshot\.providerId === STEAM_PROVIDER_ID[\s\S]*<DeckySteamFullScreenGamesDashboard/u);
  assert.match(dashboardSource, /data-steam-full-screen-games-dashboard/u);
  assert.match(dashboardSource, /height: "100%"[\s\S]*overflow: "hidden"/u);
  assert.doesNotMatch(dashboardSource, /SteamGamesSummaryCards|OverallProgressCard|function MetricCard/u);
  assert.match(dashboardSource, /<SteamGamesStatusButton/u);
  assert.match(dashboardSource, /<SteamGamesSortButton/u);
  assert.match(dashboardSource, /<GamesSortToggle/u);
  assert.match(dashboardSource, /aria-label="Clear Games filters"/u);
  assert.match(dashboardSource, /↓ Newest/u);
  assert.match(dashboardSource, /↑ Oldest/u);
  assert.doesNotMatch(dashboardSource, /Title A[-–]Z|Achievement mode:|<h1[^>]*>Games<\/h1>/u);
  assert.match(dashboardSource, /value: "recent", label: "Last played"/u);
  assert.match(dashboardSource, /value: "recent", label: "Last unlock"/u);
  assert.match(dashboardSource, /value: "completion", label: "Highest completion"/u);
  assert.match(dashboardSource, /value: "fewest_remaining", label: "Fewest remaining"/u);
  assert.match(dashboardSource, /<RetroAchievementsSystemButton/u);
  assert.match(dashboardSource, /formatCount\(visibleGames\.length\)[\s\S]*formatCount\(snapshot\.games\.length\)/u);
  assert.match(artworkSource, /STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH = 134;/u);
  assert.match(artworkSource, /STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT = 58;/u);
  assert.match(artworkSource, /STEAM_FULLSCREEN_GAME_ROW_HEIGHT = 70;/u);
  assert.match(dashboardSource, /minHeight: STEAM_FULLSCREEN_GAME_ROW_HEIGHT/u);
  assert.match(dashboardSource, /context\.length > 0[\s\S]*getSecondaryMetaStyle\(\)[\s\S]*\{context\}/u);
  assert.doesNotMatch(dashboardSource, /getMetadataCellStyle|Total Time Played|Total Playtime/u);
  assert.match(dashboardSource, /<img\s+alt=""\s+aria-hidden="true"\s+src=\{src\}/u);
  assert.match(dashboardSource, /filter: STEAM_GAMES_ICON_FILTERS\[tone\]/u);
  assert.doesNotMatch(dashboardSource, /MaskImage|IconMask/u);
  assert.doesNotMatch(dashboardSource, /checkCircleIconUrl|steamIconUrl|getPillStyle/u);
  assert.match(dashboardSource, /value: "all", label: "All games"/u);
  assert.match(dashboardSource, /value: "played", label: "Played"/u);
  assert.match(dashboardSource, /isRa \? "In Progress" : "Unfinished"/u);
  assert.match(dashboardSource, /value: "completed" as const, label: "Any award"/u);
  assert.match(dashboardSource, /value: "mastered" as const, label: "Mastered"/u);
  assert.match(dashboardSource, /value: "mastered" as const, label: "Perfected"/u);
  assert.match(dashboardSource, /value: "beaten" as const, label: "No achievements"/u);
  assert.match(dashboardSource, /<DeckyFullScreenFooterOverlay/u);
  assert.match(dashboardSource, /navigationItems=\{isRa \? RETROACHIEVEMENTS_PROFILE_FOOTER_NAVIGATION_ITEMS : STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS\}/u);
  assert.match(dashboardSource, /activeNavigationItemId="games"/u);
  assert.match(
    dashboardSource,
    /visible action must own GamepadUI[\s\S]*\[data-steam-games-row='true'\][\s\S]*takeDeckySteamGamepadFocus\(initialFocusTarget\)/u,
  );
  assert.match(dashboardSource, /activeNavigationItemId="games"/u);
  assert.match(dashboardSource, /onNextNavigationItem=\{onOpenActivity\}/u);
  assert.match(dashboardSource, /onPreviousNavigationItem=\{onOpenProfile\}/u);
  assert.match(footerSource, /export const STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS/u);
  assert.doesNotMatch(dashboardSource, /<ScrollPanel>/u);
});

test("provider full-screen routes load Profile, Games, and Activity once per visit", async () => {
  const [servicesSource, navigationSource, profileSource, completionSource, historySource, gameSource, achievementSource, loadingSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-app-services.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-profile-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-completion-progress-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-achievement-history-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-game-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-achievement-detail-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-loading-state.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(
    servicesSource,
    /async function createDeckyProviderFullScreenDataSession[\s\S]*forceRefresh: true[\s\S]*completionProgressPromise[\s\S]*achievementHistoryPromise[\s\S]*Promise\.all/u,
  );
  assert.match(servicesSource, /export async function runDeckySteamFullLibraryScan/u);
  assert.doesNotMatch(
    servicesSource.slice(
      servicesSource.indexOf("async function createDeckyProviderFullScreenDataSession"),
      servicesSource.indexOf("/** Starts a fresh provider-wide data session"),
    ),
    /refreshDeckySteamLibraryForExplicitRefresh|runDeckySteamFullLibraryScan/u,
  );
  assert.match(servicesSource, /buildRetroAchievementsCompletionProgressFromDashboard\(dashboard\)/u);
  assert.match(servicesSource, /profile: dashboard\.data\.profile, dashboard/u);
  assert.match(navigationSource, /beginDeckyProviderFullScreenDataSession\(target\.providerId\)/u);
  assert.match(navigationSource, /endDeckyProviderFullScreenDataSession\(providerId\)[\s\S]*resetDeckyProviderFullScreenSessionState/u);
  assert.match(navigationSource, /subscribeDeckyProviderFullScreenDataSession[\s\S]*getDeckyProviderFullScreenDataSessionRevision/u);
  assert.match(profileSource, /loadDeckyDashboardStateForFullScreenEntry\(providerId\)/u);
  assert.match(profileSource, /if \(providerId === STEAM_PROVIDER_ID\) \{[\s\S]*<DeckyFullScreenLoadingState/u);
  assert.doesNotMatch(profileSource, /progressSteps=|useDeckyFullScreenLoadingProgress/u);
  assert.doesNotMatch(loadingSource, /LoadingProgressSteps|DashboardRefreshProgressEvent/u);
  assert.match(completionSource, /loadDeckyCompletionProgressStateForFullScreenEntry\(providerId\)/u);
  assert.match(
    completionSource,
    /getDeckyCompletionProgressStateForFullScreenEntryInitial\(providerId\)[\s\S]*useAsyncResourceState\(loadSelectedCompletionProgress, initialState\)/u,
  );
  assert.match(completionSource, /Refreshing your Steam account and loading your library achievement scan\./u);
  assert.match(historySource, /loadDeckyAchievementHistoryStateForFullScreenEntry\(providerId\)/u);
  assert.match(
    historySource,
    /getDeckyAchievementHistoryStateForFullScreenEntryInitial\(providerId\)[\s\S]*useAsyncResourceState\(loadSelectedAchievementHistory, initialState\)/u,
  );
  assert.match(
    servicesSource,
    /export function getDeckyCompletionProgressStateForFullScreenEntryInitial[\s\S]*getDeckyProviderFullScreenDataSessionSnapshot\(providerId\)\?\.completionProgress/u,
  );
  assert.match(
    servicesSource,
    /export function getDeckyAchievementHistoryStateForFullScreenEntryInitial[\s\S]*getDeckyProviderFullScreenDataSessionSnapshot\(providerId\)\?\.achievementHistory/u,
  );
  assert.match(historySource, /Refreshing your Steam account and loading achievement history\./u);
  assert.match(gameSource, /forceRefresh: initialSectionState\?\.restoreRequested !== true/u);
  assert.match(achievementSource, /loadDeckyGameDetailState\(providerId, gameId, \{ forceRefresh: false \}\)/u);
});

test("steam full-screen Profile is a compact launchpad with working destinations", async () => {
  const [page, dashboard] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-full-screen-profile-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-steam-full-screen-profile-dashboard.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /"profile profile profile profile profile profile"/u);
  assert.match(dashboard, /"progress progress progress insights insights insights"/u);
  assert.match(dashboard, /"activity activity activity recent recent recent"/u);
  assert.match(dashboard, /recentUnlocks\.slice\(0, 2\)/u);
  assert.match(dashboard, /summary\.recentGames\.slice\(0, 2\)/u);
  assert.match(dashboard, /title="Latest Unlocks"[\s\S]*label="Open Activity"/u);
  assert.match(dashboard, /title="Continue Playing"[\s\S]*label="See Played Games"/u);
  assert.match(dashboard, /onOpenAchievementDetail\(recentUnlock\.game\.gameId, recentUnlock\.achievement\.achievementId\)/u);
  assert.match(dashboard, /onOpenGameDetail\(game\.gameId\)/u);
  assert.match(page, /onOpenRecentlyPlayedGames=\{\(\) => \{\s*onOpenCompletionProgress\(profile\.providerId, "played"\);/u);
  assert.match(dashboard, /takeDeckySteamGamepadFocus\(initialFocusTarget\)/u);
});
test("steam activity dashboard shares filtered Activity and Analytics without changing native rows or footer tabs", async () => {
  const read = (name: string) => readFile(new URL(`../src/platform/decky/${name}`, import.meta.url), "utf8");
  const [dashboard, analytics, controls, model, history] = await Promise.all([
    read("decky-steam-full-screen-activity-dashboard.tsx"), read("decky-full-screen-activity-analytics.tsx"),
    read("decky-full-screen-activity-controls.tsx"), read("decky-full-screen-activity-model.ts"), read("decky-full-screen-achievement-history-page.tsx"),
  ]);
  assert.match(history, /isSteamProvider \|\| snapshot\.providerId === RETROACHIEVEMENTS_PROVIDER_ID[\s\S]*DeckySteamFullScreenActivityDashboard/u);
  assert.match(dashboard, /useSyncExternalStore\(subscribeDeckyActivityPageState/u);
  assert.match(dashboard, /label="Activity" subview="activity"[\s\S]*label="Analytics" subview="analytics"/u);
  assert.match(dashboard, /data-activity-date-group=\{group\.key\}/u);
  assert.match(dashboard, /minHeight: STEAM_FULLSCREEN_GAME_ROW_HEIGHT/u);
  assert.match(dashboard, /getSteamFullscreenGameArtworkUrlByGameId\(entry\.game\.gameId/u);
  assert.match(dashboard, /rowIndex=\{rowIndex\}[\s\S]*onOpenAchievementDetail=\{onOpenAchievementDetail\}/u);
  assert.match(dashboard, /<ActivityAnalytics stats=\{stats\} unlockCount=\{effectiveEntries\.length\}/u);
  assert.match(model, /stats: buildSteamActivityStats\(effectiveEntries, now\)/u);
  assert.match(analytics, /data-steam-activity-summary/u);
  assert.match(analytics, /title="Current Streak"[\s\S]*title="Longest Streak"[\s\S]*title="Best Month"[\s\S]*title="Most Active Day"/u);
  assert.match(analytics, /onSelectPeriod\(\{ startDay: bar\.startDay, endDayExclusive: bar\.endDayExclusive/u);
  assert.match(analytics, /qamActivityCalendarColors/u);
  assert.match(analytics, /Selected Date \/ Period/u);
  assert.match(controls, /showContextMenu[\s\S]*registerDeckyFullscreenPopupCancel/u);
  assert.match(controls, /aria-disabled=\{disabled\}[\s\S]*if \(!disabled\) onClick\(\)/u);
  assert.match(dashboard, /activeNavigationItemId="activity"/u);
  assert.doesNotMatch(dashboard, /data-steam-activity-side-column|selectedDayIsVisible/u);
  assert.doesNotMatch(dashboard + analytics, /Most Active Game|onKeyDown=|rarity/u);
});

test("Steam activity insights rank timestamped unlock history and compare real 30-day windows", () => {
  const now = new Date(2026, 8, 25, 12).getTime();
  const entries = [
    createUnlock("1", "Halls of Torment", new Date(2026, 8, 22, 10).getTime()),
    createUnlock("1", "Halls of Torment", new Date(2026, 8, 23, 10).getTime()),
    createUnlock("1", "Halls of Torment", new Date(2026, 8, 24, 10).getTime()),
    createUnlock("1", "Halls of Torment", new Date(2026, 8, 25, 10).getTime()),
    createUnlock("2", "Balatro", new Date(2026, 8, 24, 11).getTime()),
    createUnlock("2", "Balatro", new Date(2026, 7, 20, 11).getTime()),
    createUnlock("3", "Undated history", undefined),
  ];

  const stats = buildSteamActivityStats(entries, now);
  const busiestLocalDay = new Date(2026, 8, 24, 12);
  const busiestDayKey = Date.UTC(busiestLocalDay.getFullYear(), busiestLocalDay.getMonth(), busiestLocalDay.getDate());

  assert.equal(stats.gameCount, 3);
  assert.equal(stats.thisMonthCount, 5);
  assert.equal(stats.currentStreak, 4);
  assert.equal(stats.longestStreak, 4);
  assert.equal(buildRecentActivityTrend(stats.dayCounts, "30d", now).total, 5);
  assert.match(stats.bestMonth.value, /2026/u);
  assert.equal(stats.bestMonth.detail, "5 unlocks");
  assert.equal(stats.mostActiveDay.detail, "2 unlocks");
  assert.equal(stats.dayCounts.get(busiestDayKey), 2);
});

test("completion filters can still carry a one-shot perfected selection without a footer tab", () => {
  markNextFullScreenCompletionProgressFilter("mastered");

  assert.equal(consumeNextFullScreenCompletionProgressFilter(), "mastered");
  assert.equal(consumeNextFullScreenCompletionProgressFilter(), undefined);
});

test("Steam full-screen shoulder navigation moves exactly one tab in either direction", () => {
  assert.equal(getAdjacentSteamFullScreenSessionTab("profile", "next"), "games");
  assert.equal(getAdjacentSteamFullScreenSessionTab("games", "next"), "activity");
  assert.equal(getAdjacentSteamFullScreenSessionTab("activity", "next"), "settings");
  assert.equal(getAdjacentSteamFullScreenSessionTab("settings", "next"), "profile");

  assert.equal(getAdjacentSteamFullScreenSessionTab("profile", "previous"), "settings");
  assert.equal(getAdjacentSteamFullScreenSessionTab("settings", "previous"), "activity");
  assert.equal(getAdjacentSteamFullScreenSessionTab("activity", "previous"), "games");
  assert.equal(getAdjacentSteamFullScreenSessionTab("games", "previous"), "profile");
});

test("Steam activity loading state owns the Activity footer and renders its trophy inline", async () => {
  const [historySource, loadingSource, footerSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-full-screen-achievement-history-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-loading-state.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-footer-overlay.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(historySource, /title=\{state\.status === "error"[\s\S]*activeNavigationItemId="activity"/u);
  assert.match(historySource, /onPreviousNavigationItem=\{onOpenGames\}[\s\S]*onNextNavigationItem=\{onOpenSettings\}/u);
  assert.match(loadingSource, /<DeckyLoadingBrandMark isLoading=\{!isError\} providerId=\{loadingProviderId\} \/>/u);
  assert.match(footerSource, /if \(!isTopFooterOverlayOwner\(owner\)\) return;/u);
});

test("full-screen loading screens retain simple provider-specific loading states", async () => {
  const [profileSource, historySource, loadingSource, terminalBackSource, appServicesSource, deckyServicesSource, serviceTypesSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-full-screen-profile-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-achievement-history-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-loading-state.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-terminal-back.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/core/app-services.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-app-services.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/core/services.ts", import.meta.url), "utf8"),
  ]);

  assert.match(profileSource, /loadDeckyDashboardStateForFullScreenEntry\(providerId\)/u);
  assert.match(profileSource, /loadDeckySteamHuntersProfileStateForFullScreenEntry\(providerId\)/u);
  assert.match(historySource, /return \(\) => loadDeckyAchievementHistoryStateForFullScreenEntry\(providerId\)/u);
  assert.doesNotMatch(profileSource, /progressSteps=|useDeckyFullScreenLoadingProgress|STEAM_PROFILE_LOADING_STEP_DEFINITIONS/u);
  assert.doesNotMatch(historySource, /progressSteps=|useDeckyFullScreenLoadingProgress|STEAM_ACHIEVEMENT_HISTORY_LOADING_STEPS/u);
  assert.doesNotMatch(loadingSource, /LoadingProgressSteps|DashboardRefreshProgressEvent|useDeckyFullScreenLoadingProgress/u);
  assert.match(loadingSource, /FULL_SCREEN_LOADING_FONT_FAMILY/u);
  assert.match(loadingSource, /FULL_SCREEN_LOADING_TITLE_FONT_SIZE/u);
  assert.match(loadingSource, /loading frame below is the sole vertical-positioning authority[\s\S]*padding: 0/u);
  assert.match(loadingSource, /background: qamTheme\.loading\.page/u);
  assert.match(loadingSource, /getDeckyLoadingProviderId\(providerId\) \?\? \(useSteamTheme \? "steam" : undefined\)/u);
  assert.match(loadingSource, /style=\{\{ \.\.\.getDeckyFullScreenLoadingPageStyle\(\), \.\.\.getLoadingFrameStyle\(\) \}\}/u);
  assert.match(loadingSource, /data-achievement-companion-full-screen-loading-state="true"/u);
  assert.match(terminalBackSource, /full-screen-loading-state="true"\]\[aria-busy="true"\][\s\S]*if \(activeLoader !== null\) \{[\s\S]*return;/u);
  assert.match(appServicesSource, /async function refreshActivityCalendarUnlocks/u);
  assert.match(appServicesSource, /const \[profile, recentAchievements, recentlyPlayedGames\] = await Promise\.all/u);
  assert.doesNotMatch(appServicesSource.slice(appServicesSource.indexOf("async function loadDashboardSnapshot"), appServicesSource.indexOf("function deriveRecentlyPlayedGamesFromRecentUnlocks")), /activityCalendarUnlocksPromise/u);
  assert.match(serviceTypesSource, /DashboardRefreshProgressStepId[\s\S]*recent-games[\s\S]*recent-achievements[\s\S]*finalize/u);
  assert.match(deckyServicesSource, /if \(activeRefresh !== undefined\)[\s\S]*subscribeToDeckyDashboardProgress\(providerId, options\.onProgress\)[\s\S]*return await activeRefresh/u);
  assert.match(deckyServicesSource, /onProgress: \(event\) => publishDeckyDashboardProgress\(providerId, event\)/u);
  assert.match(deckyServicesSource, /stepId: "steam-hunters", status: "failed"[\s\S]*status: "error"[\s\S]*isRefreshing: false/u);
});

test("shared compact and full-screen loading mark keeps the provider icon while busy", async () => {
  const source = await readFile(new URL("../src/platform/decky/decky-loading-brand.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /import infoIconUrl from "\.\/assets\/info\.svg"/u);
  assert.match(source, /const providerIconUrl = knownProvider === "steam"\s*\? steamIconUrl/u);
  assert.match(source, /knownProvider === "retroachievements"\s*\? retroAchievementsIconUrl/u);
});

test("Games footer moves directly between Profile and Activity without a Perfected tab", async () => {
  const [dashboardSource, completionSource, navigationSource, footerSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-steam-full-screen-games-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-completion-progress-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-footer-overlay.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(dashboardSource, /onNextNavigationItem=\{onOpenActivity\}[\s\S]*onPreviousNavigationItem=\{onOpenProfile\}/u);
  assert.match(completionSource, /onNextNavigationItem=\{onOpenActivity\}[\s\S]*onPreviousNavigationItem=\{onOpenProfile\}/u);
  assert.doesNotMatch(footerSource, /\{ id: "perfected", label: "Perfected" \}/u);
  assert.match(navigationSource, /<DeckyFullScreenCompletionProgressPage[\s\S]*onOpenProfile=\{\(\) => \{[\s\S]*buildFullScreenProfileRoute/u);
});

test("provider full-screen tabs share one session while details retain route history", async () => {
  const [navigationSource, gamesDashboardSource, activityDashboardSource, footerSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-steam-full-screen-games-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-steam-full-screen-activity-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-footer-overlay.tsx", import.meta.url), "utf8"),
  ]);
  const sessionStart = navigationSource.indexOf("function DeckyProviderFullScreenSession");
  const sessionEnd = navigationSource.indexOf("function DeckyFullScreenProfileRoute", sessionStart);
  const sessionSource = navigationSource.slice(sessionStart, sessionEnd);

  assert.ok(sessionStart >= 0, "providers must render their footer tabs inside one session shell");
  assert.match(navigationSource, /type ProviderFullScreenSessionTab,[\s\S]*decky-steam-full-screen-session-navigation/u);
  assert.match(sessionSource, /onOpenProfile=\{\(\) => selectTab\("profile"\)\}/u);
  assert.match(sessionSource, /onOpenActivity=\{\(\) => selectTab\("activity"\)\}/u);
  assert.match(sessionSource, /providerId === STEAM_PROVIDER_ID \|\| providerId === RETROACHIEVEMENTS_PROVIDER_ID[\s\S]*selectTab\("settings"\)/u);
  assert.match(sessionSource, /activeTab === "settings" && providerId === RETROACHIEVEMENTS_PROVIDER_ID[\s\S]*DeckyRetroAchievementsProviderSettingsPage/u);
  assert.doesNotMatch(sessionSource, /activeTab === "about"/u);
  assert.match(sessionSource, /retroAchievementsSettingsRootRef[\s\S]*takeDeckySteamGamepadFocus\(firstControl\)/u);
  assert.match(sessionSource, /onBack=\{exitSession\}/u);
  assert.match(sessionSource, /resetDeckyProviderFullScreenSessionState\(providerId\);[\s\S]*onBack\(\);/u);
  assert.match(
    sessionSource,
    /return \(\) => \{\s*unsubscribe\(\);[\s\S]*activeProviderFullScreenSessionId = undefined;[\s\S]*\};/u,
    "child-route unmounts must preserve the active provider tab",
  );
  assert.match(sessionSource, /navigateToFullScreenGame\(providerId, gameId\)/u);
  assert.match(sessionSource, /navigateToFullScreenAchievement\(providerId, gameId, achievementId\)/u);
  assert.doesNotMatch(sessionSource, /DeckyNavigation\.Navigate\(.*completion-progress/u);
  assert.doesNotMatch(sessionSource, /DeckyNavigation\.Navigate\(.*achievement-history/u);
  assert.doesNotMatch(sessionSource, /visitedTabs|display: activeTab/u);
  assert.match(sessionSource, /activeTab === "profile"[\s\S]*activeTab === "games"[\s\S]*activeTab === "activity"[\s\S]*activeTab === "settings"/u);
  assert.match(sessionSource, /isActive=\{activeTab === "activity"\}/u);
  assert.match(sessionSource, /showSteamProfileFooter=\{false\}[\s\S]*activeNavigationItemId=\{activeTab\}/u);
  assert.match(sessionSource, /activeTab === "games" \|\| activeTab === "activity"[\s\S]*secondaryActionLabel: "Top"[\s\S]*jumpDeckySteamProfileTabToTop/u);
  assert.match(footerSource, /DECKY_FULLSCREEN_FOOTER_TOP_BUTTON[\s\S]*onSecondaryActionRef\.current\(ownerWindow\.document\)/u);
  assert.equal(
    (sessionSource.match(/<DeckyFullScreenFooterOverlay/gu) ?? []).length,
    1,
    "the retained Steam session must have one stable global footer/input owner",
  );
  assert.match(footerSource, /readonly isActive\?: boolean[\s\S]*if \(!isActive \|\| isSteamFullScreenVideoOverlayVisible\)[\s\S]*isActive && !isSteamFullScreenVideoOverlayVisible && !isOnScreenKeyboardOpen && portalTarget/u);
  assert.match(gamesDashboardSource, /STEAM_GAMES_INITIAL_RENDER_LIMIT[\s\S]*visibleGames\.slice\(0, renderLimit\)[\s\S]*const revealMoreGames[\s\S]*current \+ STEAM_GAMES_RENDER_STEP/u);
  assert.match(gamesDashboardSource, /onRevealMore: \(\) => revealMoreGames\(true\)/u);
  assert.doesNotMatch(gamesDashboardSource, /data-steam-games-show-more|Show \$\{Math\.min\(STEAM_GAMES_RENDER_STEP/u);
  assert.match(activityDashboardSource, /STEAM_ACTIVITY_RENDER_STEP[\s\S]*pageActivityGroups\(allGroups, renderLimit\)[\s\S]*onRevealMore/u);
  assert.doesNotMatch(activityDashboardSource, /data-steam-activity-show-more|Show \$\{Math\.min\(STEAM_ACTIVITY_RENDER_STEP/u);

  const navigationPortStart = navigationSource.indexOf("export function createDeckyNavigationPort");
  const navigationPortSource = navigationSource.slice(navigationPortStart);
  assert.match(navigationPortSource, /activeProviderFullScreenSessionId === target\.providerId[\s\S]*setProviderFullScreenSessionTab\(providerSessionTab\)/u);
  assert.match(navigationPortSource, /resetDeckyProviderFullScreenSessionState\(target\.providerId\)/u);
  assert.match(navigationPortSource, /target\.providerId === STEAM_PROVIDER_ID \|\| target\.providerId === RETROACHIEVEMENTS_PROVIDER_ID[\s\S]*beginDeckyProviderFullScreenDataSession\(target\.providerId\)/u);
});

test("compact dashboard Profile navigation uses the native route before closing QAM", async () => {
  const navigationSource = await readFile(
    new URL("../src/platform/decky/decky-navigation.tsx", import.meta.url),
    "utf8",
  );
  const navigationPortIndex = navigationSource.indexOf("export function createDeckyNavigationPort()");
  const profileRouteIndex = navigationSource.indexOf("const profileRoute = buildFullScreenProfileRoute(target)", navigationPortIndex);
  const navigateIndex = navigationSource.indexOf("DeckyNavigation.Navigate(profileRoute);", profileRouteIndex);
  const closeSideMenusIndex = navigationSource.indexOf("DeckyNavigation.CloseSideMenus();", navigateIndex);

  assert.ok(navigationPortIndex >= 0, "the Decky navigation port must exist");
  assert.ok(profileRouteIndex > navigationPortIndex, "compact full-screen navigation must handle Profile");
  assert.ok(navigateIndex > profileRouteIndex, "Profile navigation must enter the Decky route");
  assert.ok(
    closeSideMenusIndex > navigateIndex,
    "Profile navigation must close QAM only after entering the Decky route",
  );
});

test("Steam settings keep account, activity, and data controls in one scroll pane", async () => {
  const [source, updateSource, footerSource, navigationSource, generalSource, appearanceSource, controlsSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-full-screen-settings-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-update-settings-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-footer-overlay.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-about-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-shared-appearance-settings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-settings-controls.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(source, /<Heading>STEAM SETTINGS<\/Heading>/u);
  assert.doesNotMatch(source, /data-settings-section-tabs|useDeckySettingsSectionTriggers/u);
  assert.match(source, /aria-label="Steam account settings"[\s\S]*aria-label="SteamHunters settings"[\s\S]*aria-label="Steam activity settings"[\s\S]*aria-label="Steam data and sync"/u);
  assert.match(source, /<SteamAccountFields[\s\S]*<SteamHuntersPersonalDataToggle[\s\S]*<SteamCompactSettings/u);
  assert.match(source, /steamFullscreenActivityCalendarWeeks[\s\S]*steamCompactActivityCalendarWeeks/u);
  assert.match(source, /Clear Cached Data[\s\S]*Reset Steam Data/u);
  assert.match(source, /const RECENT_CACHE_PREFIX = "achievement-companion:decky:recent-achievements:steam:"/u);
  assert.match(source, /connected && accountMismatch/u);
  assert.match(source, /const dataOperationBusy = operation === "refreshing-steam" \|\| operation === "resetting" \|\| libraryScanState === "scanning"/u);
  assert.match(source, /subtitle="Clear cache, local data, and Steam settings" disabled=\{dataOperationBusy\}/u);
  assert.match(source, /writeValidatedDeckySteamProviderConfig/u);
  assert.match(source, /startSteamFullLibraryScan/u);
  assert.match(source, /refreshDeckySteamHuntersProfileState/u);
  assert.match(source, /steamHuntersWebReturnPending[\s\S]*steamHuntersOpenRef/u);
  assert.match(source, /DeckyCredentialTextField[\s\S]*markDeckyFullscreenOnScreenKeyboardOpen/u);
  assert.match(source, /useDeckyFullscreenOnScreenKeyboardLifecycle\(pageRef\)/u);
  assert.match(source, /handleDeckySettingsDirection\(pageRef\.current, event\)/u);
  assert.match(source, /showSteamProfileFooter \|\| reserveSteamProfileFooter \? 50 : 10/u);
  assert.match(navigationSource, /<DeckyFullScreenSettingsPage[\s\S]*reserveSteamProfileFooter/u);
  assert.match(navigationSource, /const openGeneralSettings = \(\): void => \{[\s\S]*nextFullScreenSettingsProvider = "about";[\s\S]*DeckyNavigation\.Navigate\(buildDeckyFullScreenSettingsRoute\(\)\)/u);
  assert.match(navigationSource, /onOpenGeneralSettings=\{openGeneralSettings\}/u);
  assert.match(source, /<DeckySettingsGeneralLink onOpen=\{onOpenGeneralSettings\}/u);
  assert.match(controlsSource, /data-settings-general-link="true"/u);
  assert.match(controlsSource, /<Toggle value=\{checked\} onChange=\{onChange\}/u);
  assert.doesNotMatch(source, /ToggleField/u);
  assert.match(updateSource, /if \(compact\) return <ToggleField[\s\S]*return <DeckySettingsToggleRow/u);
  assert.doesNotMatch(appearanceSource, /ToggleField/u);

  assert.match(navigationSource, /id: "about", label: "General"/u);
  assert.match(generalSource, /DeckySharedAppearanceSettings[\s\S]*DeckyUpdateSettingsPanel[\s\S]*AboutLink title="Changelog"/u);
  assert.match(generalSource, /addEventListener\("popstate", restore\)[\s\S]*addEventListener\("visibilitychange", restore\)/u);
  assert.match(appearanceSource, /showGamePageAchievementBadge[\s\S]*gamePageAchievementBadgeSize[\s\S]*gamePageAchievementBadgePosition/u);
  assert.match(updateSource, /automaticUpdateChecks[\s\S]*Check for Updates[\s\S]*DEVELOPER UPDATES/u);
  assert.match(footerSource, /consumeDeckyFullscreenTransientCancel\(event, ownerWindow\.document\)/u);
  assert.match(footerSource, /consumeDeckyFullscreenOnScreenKeyboardCancel\(document\)/u);
});

test("full-screen text entry yields the first B to Steam, then returns normal Back ownership", () => {
  const attributes = new Map<string, string>();
  const document = {
    documentElement: {
      getAttribute: (name: string) => attributes.get(name) ?? null,
      removeAttribute: (name: string) => attributes.delete(name),
      setAttribute: (name: string, value: string) => attributes.set(name, value),
    },
  } as unknown as Document;
  const keyboardCancel = {} as Event;

  markDeckyFullscreenOnScreenKeyboardOpen(document);
  assert.equal(isDeckyFullscreenOnScreenKeyboardOpen(document), true);
  assert.equal(consumeDeckyFullscreenTransientCancel(keyboardCancel, document), true);
  assert.equal(isDeckyFullscreenOnScreenKeyboardOpen(document), false);
  assert.equal(consumeDeckyFullscreenTransientCancel(keyboardCancel, document), true);
  assert.equal(consumeDeckyFullscreenTransientCancel({} as Event, document), false);
});

test("QAM Provider Settings uses RA, Steam, General footer tabs without shrinking settings under the keyboard", async () => {
  const [navigationSource, steamSource, retroSource, credentialsSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-settings-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/providers/retroachievements/provider-settings-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/providers/retroachievements/credentials-form.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(navigationSource, /type ProviderSettingsTab = "retroachievements" \| "steam"/u);
  assert.match(navigationSource, /id: "retroachievements", label: "RetroAchievements"[\s\S]*id: "steam", label: "Steam"[\s\S]*id: "about", label: "General"/u);
  assert.match(navigationSource, /type ProviderSettingsFooterTab = ProviderSettingsTab \| "about"/u);
  assert.match(navigationSource, /let nextFullScreenSettingsProvider: ProviderSettingsFooterTab = "retroachievements"/u);
  assert.match(navigationSource, /const initialProvider = nextFullScreenSettingsProvider[\s\S]*nextFullScreenSettingsProvider = "retroachievements"[\s\S]*return initialProvider/u);
  assert.match(navigationSource, /nextFullScreenSettingsProvider = target\.providerId === STEAM_PROVIDER_ID[\s\S]*\? "steam"[\s\S]*: "retroachievements"/u);
  assert.match(navigationSource, /useDeckyFullscreenOnScreenKeyboardLifecycle\(keyboardAnchorRef\)/u);
  assert.match(navigationSource, /reserveSteamProfileFooter[\s\S]*inProviderSwitcher[\s\S]*<DeckyFullScreenFooterOverlay/u);
  assert.match(
    navigationSource,
    /activeProvider === "about" \? <DeckyFullScreenAboutPage onOpenExternalUrl=\{\(url\) => \{[\s\S]*nextFullScreenSettingsProvider = "about";[\s\S]*DeckyNavigation\.NavigateToExternalWeb\(url\);[\s\S]*\}\} \/>/u,
  );
  assert.match(navigationSource, /activeNavigationItemId=\{activeProvider\}[\s\S]*onPreviousNavigationItem=\{\(\) => selectFooterTab[\s\S]*onNextNavigationItem=\{\(\) => selectFooterTab/u);
  assert.match(steamSource, /height: pageHeight \?\? "100vh", flexShrink: 0/u);
  assert.match(retroSource, /!inProviderSwitcher \? <PanelSection title="Navigation">/u);
  assert.match(retroSource, /inProviderSwitcher \? 62 : 12/u);
  assert.match(retroSource, /height: viewportHeight \?\? "100vh"[\s\S]*overflow: "hidden"/u);
  assert.match(retroSource, /<DeckySettingsSection themeVariant="ra"><div style=\{\{ \.\.\.settingsScrollStyle, display: "flex", flexDirection: "column" \}\}>/u);
  assert.match(retroSource, /useSharedFullscreenFooter=\{inProviderSwitcher\}/u);
  assert.match(credentialsSource, /useSharedFullscreenFooter\) markDeckyFullscreenOnScreenKeyboardOpen\(event\.currentTarget\.ownerDocument\)/u);
});

test("update notifications open the General tab of shared Provider Settings", async () => {
  const [indexSource, navigationSource] = await Promise.all([
    readFile(new URL("../src/index.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-navigation.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(indexSource, /initializeDeckyUpdateSystem\(openDeckyUpdatesFromNotification\)/u);
  assert.match(
    navigationSource,
    /export function openDeckyUpdatesFromNotification\(\): void \{[\s\S]*if \(selectActiveFullScreenSettingsTab !== undefined\) \{[\s\S]*selectActiveFullScreenSettingsTab\("about"\);[\s\S]*return;[\s\S]*nextFullScreenSettingsProvider = "about";[\s\S]*DeckyNavigation\.Navigate\(buildDeckyFullScreenSettingsRoute\(\)\);/u,
  );
  assert.match(
    navigationSource,
    /selectActiveFullScreenSettingsTab = selectFooterTab;[\s\S]*selectActiveFullScreenSettingsTab = undefined;/u,
  );
});

test("Games Search and Settings keep the footer on focus and yield it only to Steam keyboard ownership", async () => {
  const [gamesSource, settingsSource, footerSource, raCredentialsSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-steam-full-screen-games-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-settings-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-footer-overlay.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/providers/retroachievements/credentials-form.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(gamesSource, /useDeckyFullscreenOnScreenKeyboardLifecycle\(dashboardRef\)/u);
  assert.match(gamesSource, /Search your games[\s\S]*onClick=\{\(event\) => \{[\s\S]*markDeckyFullscreenOnScreenKeyboardOpen/u);
  assert.match(settingsSource, /useDeckyFullscreenOnScreenKeyboardLifecycle\(pageRef\)/u);
  assert.match(settingsSource, /DeckyCredentialTextField[\s\S]*onBlur=\{\(event\) => clearDeckyFullscreenOnScreenKeyboardOpen/u);
  assert.match(settingsSource, /data-ac-settings-tone=\{saveSucceeded \? "success" : undefined\}/u);
  assert.match(settingsSource, /setAccountMessage\(isError \? \{ message, isError: true \} : undefined\)/u);
  assert.match(raCredentialsSource, /DeckyCredentialTextField[\s\S]*onBlur=\{\(event\) => clearDeckyFullscreenOnScreenKeyboardOpen/u);
  assert.match(raCredentialsSource, /data-ac-settings-tone=\{showSaveMessage && !saveMessageIsError \? "success" : undefined\}/u);
  assert.match(raCredentialsSource, /showSaveMessage && saveMessageIsError \? <div role="status"/u);
  assert.match(footerSource, /RegisterForUserDismissKeyboardMessages/u);
  assert.doesNotMatch(footerSource, /isTextEntryFocused|!isTextEntryFocused/u);
  assert.match(footerSource, /isActive && !isSteamFullScreenVideoOverlayVisible && !isOnScreenKeyboardOpen && portalTarget/u);
  assert.match(footerSource, /isDeckyFullscreenOnScreenKeyboardOpen\(ownerWindow\.document\)/u);
});

test("full-screen footer yields to Steam's suspend video overlay", async () => {
  const footerSource = await readFile(
    new URL("../src/platform/decky/decky-full-screen-footer-overlay.tsx", import.meta.url),
    "utf8",
  );

  assert.match(footerSource, /STEAM_FULL_SCREEN_VIDEO_OVERLAY_SELECTOR = "\.FullModalOverlay video"/u);
  assert.match(footerSource, /MutationObserver\(updateSteamFullScreenVideoOverlayState\)[\s\S]*attributeFilter: \["class", "style"\]/u);
  assert.match(footerSource, /overlayVisible && !targetIsHidden[\s\S]*target\.style\.setProperty\("display", "none", "important"\)/u);
  assert.match(footerSource, /!overlayVisible && targetIsHidden[\s\S]*target\.style\.removeProperty\("display"\)[\s\S]*updateLayout\(\)/u);
  assert.match(footerSource, /if \(!isActive \|\| isSteamFullScreenVideoOverlayVisible\)[\s\S]*vgp_onbuttondown/u);
  assert.doesNotMatch(footerSource, /RegisterForOnSuspendRequest|RegisterForOnResumeFromSuspend|isSuspendPending|isDocumentSettled|addEventListener\("suspend"/u);
});

test("profile summary memo runs before the loading-state early return", async () => {
  const source = await readFile(
    new URL("../src/platform/decky/decky-full-screen-profile-page.tsx", import.meta.url),
    "utf8",
  );
  const summaryMemoIndex = source.indexOf("const steamProfileSummary = useMemo");
  const loadingReturnIndex = source.indexOf("if (isSteamProfileLoading || !isRenderableDashboardState(state))");

  assert.ok(summaryMemoIndex >= 0, "the Steam profile summary must remain memoized");
  assert.ok(loadingReturnIndex >= 0, "the profile page must retain its loading-state guard");
  assert.ok(
    summaryMemoIndex < loadingReturnIndex,
    "all profile hooks must run before the loading-state early return",
  );
});

test("Steam Perfected glyphs use the combined crown-laurel asset", async () => {
  const [statusIconSource, profileSource, gamesSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-game-status-icon.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-steam-full-screen-profile-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-steam-full-screen-games-dashboard.tsx", import.meta.url), "utf8"),
  ]);

  for (const source of [statusIconSource, gamesSource]) {
    assert.match(source, /assets\/achievement-badge\/crown-laurel\.svg/u);
    assert.doesNotMatch(source, /assets\/achievement-badge\/(?:crown|laurel)\.svg|assets\/crown\.svg/u);
  }
  assert.match(profileSource, /perfected/u);
  assert.match(statusIconSource, /kind === "mastered" \|\| kind === "perfected"/u);
});
