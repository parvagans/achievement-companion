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
import {
  matchesSteamGamesFilter,
  selectSteamGames,
  summarizeSteamGamesDashboard,
} from "../src/platform/decky/decky-steam-full-screen-games-data";
import { buildSteamActivityStats } from "../src/platform/decky/decky-steam-activity-data";
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
  assert.deepEqual(summary.achievements, { unlocked: 44, total: 100, perfectGames: 1, completionPercent: 44 });
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
      hasAchievements: false,
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
      summary: { unlockedCount: 0 },
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
    skippedCount: 2,
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
    "failed",
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

test("steam games route uses the fixed concept dashboard and shared profile footer", async () => {
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
  assert.match(dashboardSource, /repeat\(5, minmax\(0, 1fr\)\) minmax\(230px, 2\.2fr\)/u);
  assert.match(artworkSource, /STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH = 134;/u);
  assert.match(artworkSource, /STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT = 58;/u);
  assert.match(artworkSource, /STEAM_FULLSCREEN_GAME_ROW_HEIGHT = 70;/u);
  assert.match(dashboardSource, /minHeight: STEAM_FULLSCREEN_GAME_ROW_HEIGHT/u);
  assert.match(dashboardSource, /function getMetadataCellStyle[\s\S]*borderLeft: "1px solid rgba\(76, 148, 187, 0\.22\)"/u);
  assert.equal((dashboardSource.match(/style=\{getMetadataCellStyle\(\)\}/gu) ?? []).length, 2);
  assert.match(dashboardSource, /<img\s+alt=""\s+aria-hidden="true"\s+src=\{src\}/u);
  assert.match(dashboardSource, /filter: STEAM_GAMES_ICON_FILTERS\[tone\]/u);
  assert.doesNotMatch(dashboardSource, /MaskImage|IconMask/u);
  assert.doesNotMatch(dashboardSource, /checkCircleIconUrl|steamIconUrl|getPillStyle/u);
  assert.match(dashboardSource, /isRa \? "All" : "All Games"/u);
  assert.match(dashboardSource, /Played \(\$\{formatCount\(summary\.playedCount\)\}\)/u);
  assert.match(dashboardSource, /isRa \? "In Progress" : "Unfinished"/u);
  assert.match(dashboardSource, /isRa \? "Mastered" : "Perfected"/u);
  assert.match(dashboardSource, /isRa \? "Beaten" : "Skipped"/u);
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
    readFile(new URL("../src/platform/decky/decky-full-screen-achievement-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-loading-state.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(
    servicesSource,
    /async function createDeckyProviderFullScreenDataSession[\s\S]*forceRefresh: true[\s\S]*completionProgressPromise[\s\S]*achievementHistoryPromise[\s\S]*Promise\.all/u,
  );
  assert.match(servicesSource, /Steam's full library scan is a separate explicit operation[\s\S]*loadDeckyDashboardState/u);
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

test("steam full-screen profile uses the requested top-row and equal lower-row dashboard layout", async () => {
  const [pageSource, dashboardSource] = await Promise.all([
    readFile(
      new URL("../src/platform/decky/decky-full-screen-profile-page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/platform/decky/decky-steam-full-screen-profile-dashboard.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(pageSource, /if \(steamProfileSummary !== undefined\) \{[\s\S]*<SteamFullScreenProfileDashboard/u);
  const steamProfileBranch = pageSource.slice(
    pageSource.indexOf("if (steamProfileSummary !== undefined)"),
    pageSource.indexOf("const retroAchievementsCompletionCollection"),
  );
  assert.match(steamProfileBranch, /getSteamProfileViewportStyle\(\)/u);
  assert.match(steamProfileBranch, /getSteamProfileFrameStyle\(\)/u);
  assert.doesNotMatch(steamProfileBranch, /<ScrollPanel>/u);
  assert.ok(
    dashboardSource.includes(
      `gridTemplateAreas: '\"profile profile progress progress insights insights\" \"activity activity activity recent recent recent\"'`,
    ),
  );
  assert.match(
    dashboardSource,
    /gridTemplateColumns: "repeat\(6, minmax\(0, 1fr\)\)"/u,
  );
  assert.match(
    dashboardSource,
    /gridTemplateRows: "minmax\(210px, 0\.5fr\) minmax\(174px, 1fr\)"/u,
  );
  const dashboardGridSource = dashboardSource.slice(
    dashboardSource.indexOf("function getDashboardGridStyle"),
    dashboardSource.indexOf("function getPanelStyle"),
  );
  assert.match(dashboardGridSource, /flex: "1 1 auto"/u);
  assert.match(dashboardGridSource, /minHeight: 0/u);
  assert.match(dashboardSource, /data-steam-full-screen-profile-dashboard/u);
  assert.match(dashboardSource, /title="Your Progress \(Steam\)"/u);
  assert.match(dashboardSource, /title="SteamHunters Profile"/u);
  assert.match(dashboardSource, /label="Points"/u);
  assert.match(dashboardSource, /iconUrl=\{rankPointsIconUrl\}[\s\S]*label="Points"/u);
  assert.match(dashboardSource, /label="Avg\. completion"/u);
  assert.match(dashboardSource, /iconUrl=\{rankAchievementsIconUrl\}[\s\S]*label="Achievements"/u);
  assert.match(dashboardSource, /iconUrl=\{rankCompletedGamesIconUrl\}[\s\S]*label="Completed games"/u);
  assert.match(dashboardSource, /Rank improved/u);
  assert.match(dashboardSource, /Rank declined/u);
  assert.match(dashboardSource, /label="Legendary unlocks"/u);
  assert.doesNotMatch(dashboardSource, /label="Tracked games"/u);
  assert.doesNotMatch(dashboardSource, /label="Started games"|label="Epic unlocks"/u);
  assert.doesNotMatch(dashboardSource, /label="Unrestricted points"/u);
  assert.doesNotMatch(dashboardSource, /label="Obtainable completion"/u);
  assert.match(dashboardSource, /label="Owned"/u);
  assert.match(dashboardSource, /label="Played"/u);
  assert.match(dashboardSource, /label="In progress"/u);
  assert.match(dashboardSource, /label="Perfected"/u);
  assert.match(dashboardSource, /function formatSteamHuntersPercent/u);
  assert.match(dashboardSource, /maximumFractionDigits: 1/u);
  assert.match(dashboardSource, /value=\{formatSteamHuntersPercent\(steamHuntersProfile\?\.averageGameCompletion\)\}/u);
  assert.match(dashboardSource, /fontSize: "clamp\(1\.18rem, 2\.2vw, 1\.78rem\)"/u);
  assert.match(dashboardSource, /fontSize: "0\.53em"/u);
  assert.match(dashboardSource, /overflowWrap: "anywhere"/u);
  assert.doesNotMatch(
    dashboardSource.slice(
      dashboardSource.indexOf("function getMetricLabelStyle"),
      dashboardSource.indexOf("function getMetricValueStyle"),
    ),
    /textOverflow: "ellipsis"|whiteSpace: "nowrap"/u,
  );
  assert.match(dashboardSource, /function getSteamInsightsMetricsStyle/u);
  assert.match(dashboardSource, /title="Recent Activity"/u);
  assert.match(dashboardSource, /title="Recently Played"/u);
  assert.match(
    dashboardSource,
    /title="Recent Activity"[\s\S]*focusClassName=\{DASHBOARD_FOCUS_RING_ACTIVE_CLASS\}[\s\S]*label="View All"[\s\S]*onClick=\{onOpenAchievementHistory\}/u,
  );
  assert.match(
    dashboardSource,
    /title="Recently Played"[\s\S]*focusClassName=\{DASHBOARD_FOCUS_RING_ACTIVE_CLASS\}[\s\S]*label="View All"[\s\S]*onClick=\{onOpenCompletionProgress\}/u,
  );
  assert.match(
    dashboardSource,
    /<Focusable\s+flow-children="left-right"\s+noFocusRing[\s\S]*tabIndex=\{-1\}[\s\S]*style=\{getPanelHeaderStyle\(\)\}/u,
  );
  assert.match(
    dashboardSource,
    /GamepadUI dispatches route shoulder[\s\S]*takeDeckySteamGamepadFocus\(initialFocusTarget\)/u,
  );
  assert.match(
    dashboardSource,
    /data-steam-profile-panel='activity'[\s\S]*data-steam-profile-panel-header[\s\S]*\[role='button'\]/u,
  );
  assert.match(
    dashboardSource,
    /<Focusable flow-children="left-right" noFocusRing tabIndex=\{-1\} style=\{getDashboardGridStyle\(\)\}>/u,
  );
  assert.match(dashboardSource, /createDashboardHorizontalFocusHandler\("ArrowRight", \{ panelId: "recent" \}\)/u);
  assert.match(dashboardSource, /createDashboardHorizontalFocusHandler\("ArrowLeft", \{ panelId: "activity" \}\)/u);
  assert.match(dashboardSource, /data-steam-profile-row-index/u);
  assert.match(dashboardSource, /function SteamProfileDashboardFocusStyles\(\)/u);
  assert.match(dashboardSource, /outline: 2px solid \$\{steamTheme\.focus\.border\} !important/u);
  assert.match(dashboardSource, /<DashboardFocusableList>/u);
  assert.match(dashboardSource, /function getListArtworkSlotStyle\(\)/u);
  assert.match(dashboardSource, /const DASHBOARD_LIST_ARTWORK_SIZE = 40/u);
  assert.match(dashboardSource, /flex: `0 0 \$\{DASHBOARD_LIST_ARTWORK_SIZE\}px`/u);
  assert.doesNotMatch(dashboardSource, /label="View Steam Profile"|label="Provider Settings"/u);
  assert.doesNotMatch(dashboardSource, /Connected providers|label="Steam" state="Connected"|label="SteamHunters" state="Enrichment"/u);
  assert.doesNotMatch(
    dashboardSource,
    /Across all tracked games|SteamHunters totals, separate from your Steam library|Latest 3 achievement unlocks|Your latest Steam games/u,
  );
  assert.match(pageSource, /navigationItems=\{STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS\}/u);
  assert.match(pageSource, /activeNavigationItemId="profile"/u);
  assert.match(pageSource, /steamHuntersProfileState\.status === "idle"/u);
  assert.match(pageSource, /isSteamProfileLoading[\s\S]*state\.isRefreshing === true[\s\S]*steamHuntersProfileState\.status === "idle"/u);
  assert.match(pageSource, /<DeckyFullScreenLoadingState[\s\S]*title=\{state\.status === "error"/u);
  assert.match(pageSource, /Fetching the latest Steam profile and SteamHunters data\./u);
  assert.match(pageSource, /onNextNavigationItem=\{\(\) => \{\s*onOpenCompletionProgress\(profile\.providerId\);/u);
  assert.match(pageSource, /onPreviousNavigationItem=\{onOpenSettings\}/u);
  assert.doesNotMatch(dashboardSource, /aria-label="Profile navigation"/u);
  assert.doesNotMatch(dashboardSource, /label="Profile" selected/u);
  assert.match(dashboardSource, /<DeckyCompletionProgressBar breathe percent=\{completionPercent\}/u);
  assert.match(
    dashboardSource,
    /<DashboardArtwork\s+height=\{DASHBOARD_LIST_ARTWORK_SIZE\}\s+src=\{game\.artworkUrl\}\s+title=\{game\.title\}\s+width=\{DASHBOARD_LIST_ARTWORK_SIZE\}/u,
  );
  assert.match(dashboardSource, /recentUnlocks\.slice\(0, 3\)/u);
  assert.doesNotMatch(
    dashboardSource,
    /label="Steam level"|value="Enabled"/u,
  );
});

test("steam activity dashboard derives timeline metrics from timestamped unlock history without fabricating rarity", async () => {
  const [activitySource, historySource, activityDataSource, calendarModelSource, sharedCalendarModelSource] = await Promise.all([
    readFile(
      new URL("../src/platform/decky/decky-steam-full-screen-activity-dashboard.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/platform/decky/decky-full-screen-achievement-history-page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/platform/decky/decky-steam-activity-data.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/platform/decky/decky-steam-activity-calendar-model.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/platform/decky/decky-activity-calendar-model.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(historySource, /isSteamProvider \|\| snapshot\.providerId === RETROACHIEVEMENTS_PROVIDER_ID[\s\S]*DeckySteamFullScreenActivityDashboard/u);
  assert.match(activitySource, /data-steam-full-screen-activity-dashboard/u);
  assert.match(activityDataSource, /getCurrentStreak[\s\S]*getLongestStreak/u);
  assert.match(activitySource, /selectedLabel[\s\S]*Last \$\{weeks\} weeks/u);
  assert.match(calendarModelSource, /STEAM_ACTIVITY_CALENDAR_WEEK_OPTIONS = ACTIVITY_CALENDAR_WEEK_OPTIONS/u);
  assert.match(sharedCalendarModelSource, /nonzeroCounts[\s\S]*Math\.ceil\(nonzeroCounts\.length \* 0\.9\)/u);
  assert.match(activitySource, /Array\.from\(\{ length: 30 \}/u);
  assert.match(activitySource, /Last 30 days/u);
  assert.match(activitySource, /\["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"\]/u);
  assert.match(activitySource, /<span>Less<\/span>[\s\S]*<span>More<\/span>/u);
  assert.match(activitySource, /aria-pressed=\{selected\}[\s\S]*data-steam-activity-calendar-day="true"/u);
  assert.match(activitySource, /selectedCalendarDay[\s\S]*getLocalDayTimestamp\(timestamp\) === selectedCalendarDay/u);
  assert.match(activitySource, /gridTemplateRows: "repeat\(7, minmax\(0, 1fr\)\)"[\s\S]*height: "100%"[\s\S]*flex: "0 0 auto"/u);
  assert.doesNotMatch(activitySource, /aspectRatio: "1"/u);
  assert.doesNotMatch(activitySource, /Unlocks by day/u);
  assert.match(activitySource, /getSteamFullscreenGameArtworkUrlByGameId\(entry\.game\.gameId/u);
  assert.match(activitySource, /ACTIVITY_TOP_PADDING_PX = 43/u);
  assert.match(activitySource, /minHeight: STEAM_FULLSCREEN_GAME_ROW_HEIGHT[\s\S]*height=\{STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT\}[\s\S]*width=\{STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH\}/u);
  assert.match(activitySource, /getSteamCompactAchievementFilterStyle\(selected, focused\)[\s\S]*width: "auto"/u);
  assert.match(activitySource, /data-steam-activity-summary[\s\S]*<ActivityTrend stats=\{stats\}/u);
  assert.match(activitySource, /label=\{isRa \? "Unlocks in view" : "Total Unlocks"\}/u);
  assert.match(activitySource, /ACTIVITY INSIGHTS/u);
  assert.match(activitySource, /Longest Streak[\s\S]*Best Month[\s\S]*Most Active Day/u);
  assert.doesNotMatch(activitySource, /Most Active Game/u);
  assert.doesNotMatch(activityDataSource, /mostActiveGame/u);
  assert.match(activitySource, /streakIconUrl[\s\S]*activity-flame\.svg/u);
  assert.match(activitySource, /label="Current Streak"[\s\S]*iconTone="original"/u);
  assert.match(activitySource, /icon=\{unlockedLockIconUrl\} label="This Month"/u);
  assert.match(activitySource, /gridTemplateColumns: "minmax\(0, 1fr\)", gap: 4, marginTop: 5/u);
  assert.match(activitySource, /label="Current Streak"[\s\S]*iconSize=\{36\}/u);
  assert.match(activitySource, /gridTemplateColumns: "24px minmax\(0, 1fr\)", alignItems: "center"/u);
  assert.match(activitySource, /fontSize: 11\.5, fontWeight: 800/u);
  assert.doesNotMatch(activitySource, /emphasized|boxShadow: "0 0 17px/u);
  assert.match(activitySource, /recentThirtyDayCount/u);
  assert.doesNotMatch(activitySource, /ACTIVITY OVERVIEW/u);
  assert.match(activitySource, /All Unlocks \(\$\{formatCount\(isRa \? modeEntries\.length : snapshot\.summary\.unlockedCount\)\}\)/u);
  assert.match(activitySource, /data-steam-activity-filter-row[\s\S]*data-steam-activity-side-column/u);
  assert.match(activitySource, /flow-children="left-right"[\s\S]*flow-children="vertical"/u);
  assert.match(activitySource, /flow-children="vertical"[\s\S]*data-steam-activity-filter-row/u);
  assert.match(activitySource, /navEntryPreferPosition=\{NavEntryPositionPreferences\.PREFERRED_CHILD\}/u);
  assert.match(activitySource, /preferredFocus=\{selected\}/u);
  assert.match(activitySource, /takeDeckySteamGamepadFocus\(target\)/u);
  assert.match(activitySource, /GamepadButton\.DIR_DOWN[\s\S]*data-steam-activity-row/u);
  assert.match(activitySource, /GamepadButton\.DIR_UP[\s\S]*data-steam-activity-filter-selected/u);
  assert.doesNotMatch(activitySource, /createActivityFilterKeyDownHandler|onKeyDown=/u);
  assert.match(activitySource, /onPreviousNavigationItem=\{onOpenGames\}[\s\S]*onNextNavigationItem=\{isRa \? onOpenProfile \?\? onOpenGames : onOpenSettings\}/u);
  assert.doesNotMatch(activitySource, /Steam library history|RecentGames|RECENT GAMES WITH UNLOCKS/u);
  assert.doesNotMatch(activitySource, /rarity|Rare|Common|Very Rare/u);
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
  assert.equal(stats.recentThirtyDayCount, 5);
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
  assert.match(loadingSource, /<svg aria-hidden="true" viewBox="0 0 24 24"[\s\S]*<path[\s\S]*fill="#2bc3f2"/u);
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
  assert.match(loadingSource, /rgba\(218, 70, 241, 0\.28\)[\s\S]*rgba\(27, 161, 255, 0\.25\)[\s\S]*rgba\(0, 224, 239, 0\.16\)/u);
  assert.match(loadingSource, /\.\.\.getDeckyFullScreenLoadingPageStyle\(\)[\s\S]*useSteamTheme \?[\s\S]*\.\.\.getLoadingFrameStyle\(\)/u);
  assert.match(loadingSource, /!isError \|\| !useSteamTheme/u);
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
  assert.match(footerSource, /readonly isActive\?: boolean[\s\S]*if \(!isActive\)[\s\S]*isActive && !isOnScreenKeyboardOpen && portalTarget/u);
  assert.match(gamesDashboardSource, /STEAM_GAMES_INITIAL_RENDER_LIMIT[\s\S]*visibleGames\.slice\(0, renderLimit\)[\s\S]*Show \$\{Math\.min\(STEAM_GAMES_RENDER_STEP/u);
  assert.match(activityDashboardSource, /STEAM_ACTIVITY_INITIAL_RENDER_LIMIT[\s\S]*entries\.slice\(0, renderLimit\)[\s\S]*onRevealMore/u);
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

test("Steam settings use four filter tabs and move About/Updates to the shared provider footer", async () => {
  const [source, updateSource, footerSource, navigationSource, aboutSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-full-screen-settings-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-update-settings-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-footer-overlay.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-about-page.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(source, /Cache Management|DATA &amp; STORAGE|openCacheManagement|Persistent cache payload/u);
  assert.doesNotMatch(source, /RETROACHIEVEMENTS_PROVIDER_ID|RetroAchievements|clearRetroAchievementsAccount/u);
  assert.doesNotMatch(source, /<Heading>PROVIDERS<\/Heading>|Game Scanning|Notifications/u);
  assert.match(source, /<Heading>STEAM SETTINGS<\/Heading>/u);
  assert.doesNotMatch(source, /AC_main_logo|Manage Steam account settings on this device/u);
  assert.match(source, /type SteamSettingsSection = "account" \| "fullscreen" \| "compact" \| "data"/u);
  assert.match(source, /selectedSection, setSelectedSection\] = useState<SteamSettingsSection>\("account"\)/u);
  assert.match(source, /flow-children="left-right"[\s\S]*data-settings-section-tabs="true"/u);
  assert.match(source, /SteamSettingsSectionPill title="Account"[\s\S]*SteamSettingsSectionPill title="Full-Screen Settings"[\s\S]*SteamSettingsSectionPill title="Compact Settings"[\s\S]*SteamSettingsSectionPill title="Data"/u);
  assert.doesNotMatch(source, /SteamSettingsSectionPill title="Updates"|SteamSettingsSectionPill title="About"/u);
  assert.match(source, /DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS/u);
  assert.match(source, /getSteamCompactAchievementFilterStyle\(selected, focused\)/u);
  assert.match(source, /onFocus=\{\(\) => setFocused\(true\)\}[\s\S]*onGamepadFocus=\{\(\) => setFocused\(true\)\}[\s\S]*onBlur=\{\(\) => setFocused\(false\)\}/u);
  assert.doesNotMatch(source, /DECKY_ACHIEVEMENT_FILTER_GROUP_CLASS|DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS|DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS/u);
  assert.match(source, /<Styles \/><DeckyFocusStyles \/>/u);
  assert.match(source, /aria-pressed=\{selected\}[\s\S]*data-settings-section-pill="true"/u);
  assert.match(source, /return <DeckySettingsSection>\{children\}<\/DeckySettingsSection>/u);
  assert.doesNotMatch(source, /data-settings-column="left"|data-settings-column="right"/u);
  assert.match(source, /settingsScrollStyle/u);
  assert.doesNotMatch(source, /maxWidth: 560/u);
  assert.match(source, /handleDeckySettingsDirection\(pageRef\.current, event\)/u);
  assert.match(source, /data-settings-data-layout[\s\S]*data-settings-danger-zone/u);
  assert.match(source, /showSteamProfileFooter \|\| reserveSteamProfileFooter \? 50 : 10/u);
  assert.match(navigationSource, /<DeckyFullScreenSettingsPage[\s\S]*reserveSteamProfileFooter[\s\S]*onOpenProviderSettings/u);
  assert.match(source, /selectedSection === "account" \? <SteamSettingsContent><div[\s\S]*<SteamAccountFields/u);
  assert.match(source, /selectedSection === "fullscreen" \? <SteamSettingsContent><div[\s\S]*<SteamActivityCalendarWeeksPicker/u);
  assert.match(source, /selectedSection === "compact" \? <SteamCompactSettings/u);
  assert.match(source, /function SteamCompactSettings/u);
  assert.match(source, /ACHIEVEMENT_COMPANION_COUNT_OPTIONS\.map/u);
  assert.match(source, /steamCompactActivityCalendarWeeks/u);
  assert.doesNotMatch(source, /label="Show free games"/u);
  assert.match(aboutSource, /<DeckyUpdateSettingsPanel/u);
  assert.match(aboutSource, /<AboutLink title="Changelog"[\s\S]*<AboutLink title="GitHub"[\s\S]*<AboutLink title="Report Issue"/u);
  assert.match(aboutSource, /isRetroAchievements \? <AboutLink title="RetroAchievements"/u);
  assert.doesNotMatch(footerSource, /\{ id: "about", label: "About" \}/u);
  assert.match(source, /selectedSection === "data" \? <SteamSettingsContent>[\s\S]*<Heading>DATA &amp; SYNC<\/Heading>[\s\S]*<Heading>DANGEROUS ZONE<\/Heading>/u);
  assert.doesNotMatch(source, /SteamAccordionHeader|accountExpanded|fullscreenSettingsExpanded|updatesExpanded|aria-expanded=\{expanded\}/u);
  assert.match(source, /ACTIVITY_CALENDAR_WEEK_OPTIONS\.map/u);
  assert.match(source, /showContextMenu\([\s\S]*<Menu label="Activity Calendar weeks"/u);
  assert.match(source, /steamFullscreenActivityCalendarWeeks/u);
  assert.doesNotMatch(source, /title="Display Preferences"|SteamDisplayPreferences|displayExpanded/u);
  assert.doesNotMatch(source, /ac-settings-section-pill|steamRecipes\.filter\("fullscreen", selected\)/u);
  assert.match(source, /handleDeckySettingsDirection\(pageRef\.current, event\)/u);
  assert.match(source, /SteamID64: steamid\.io · Web API key: steamcommunity\.com\/dev\/apikey\./u);
  assert.doesNotMatch(source, /Weeks shown on the Activity tab/u);
  assert.match(source, /function CredentialStatusLabel/u);
  assert.match(source, /\^\\d\{17\}\$/u);
  assert.match(source, /\^\[0-9a-f\]\{32\}\$/u);
  assert.match(source, /steamTheme\.iconFilter\.success : steamTheme\.iconFilter\.danger/u);
  assert.match(source, /description=\{undefined\}/u);
  assert.doesNotMatch(source, /description=\{fields\.(?:steamId64|language)\.description\}/u);
  assert.doesNotMatch(source, /Connected to Steam|Test Connection|Clear Cached Data|DeckyFullscreenActionButton/u);
  assert.match(source, /DeckySettingsSection/u);
  assert.match(source, /writeValidatedDeckySteamProviderConfig/u);
  assert.match(source, /<Heading>DATA &amp; SYNC<\/Heading>/u);
  assert.match(source, /refreshDeckySteamHuntersProfileState/u);
  assert.match(source, /runDeckySteamFullLibraryScan/u);
  assert.match(source, /title=\{operation === "refreshing-library" \? "Running Full Library Scan…" : "Full Library Scan"\}/u);
  assert.match(source, /metadata=\{operation === "refreshing-library" \? "Scanning…" : fullScan === undefined \? "Never" : `\$\{fullScan\.date\} · \$\{fullScan\.time\}`\}/u);
  assert.match(source, /Refresh Steam & SteamHunters/u);
  assert.match(source, /success=\{fullScan !== undefined\} danger=\{fullScan === undefined\}/u);
  assert.doesNotMatch(source, /Cached Games|Refresh Steam Library/u);
  assert.doesNotMatch(updateSource, />UPDATES<|Installed Version|Check at most once every 24 hours/u);
  assert.match(updateSource, /Check daily and when your Deck reconnects to the internet\./u);
  assert.match(updateSource, /overflow: "hidden", paddingBottom: steamTheme\.space\.sm/u);
  assert.match(updateSource, /data-achievement-companion-update-variable-content[\s\S]*overflowY: "auto"/u);
  assert.match(updateSource, /data-achievement-companion-update-actions[\s\S]*flex: "0 0 auto"/u);
  assert.doesNotMatch(source, /active\.closest<HTMLElement>\("\[data-settings-column\]"\)|vgp_onbuttondown/u);
  assert.doesNotMatch(source, /SteamSettingsInput/u);
  assert.match(source, /DeckyCredentialTextField[\s\S]*onClick=.*markDeckyFullscreenOnScreenKeyboardOpen/u);
  assert.match(source, /handleDeckySettingsDirection\(pageRef\.current, event\)/u);
  assert.match(source, /useDeckyFullscreenOnScreenKeyboardLifecycle\(pageRef\)/u);
  assert.match(footerSource, /consumeDeckyFullscreenTransientCancel\(event, ownerWindow\.document\)/u);
  assert.match(footerSource, /consumeDeckyFullscreenOnScreenKeyboardCancel\(document\)/u);
  assert.match(footerSource, /cancel deliberately remains unconsumed/u);
  assert.match(source, /title=\{armedAction === "reset" \? "Press again to reset Steam data"/u);
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

test("QAM Provider Settings uses RA, Steam, About footer tabs without shrinking settings under the keyboard", async () => {
  const [navigationSource, steamSource, retroSource, credentialsSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-settings-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/providers/retroachievements/provider-settings-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/providers/retroachievements/credentials-form.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(navigationSource, /type ProviderSettingsTab = "retroachievements" \| "steam"/u);
  assert.match(navigationSource, /id: "retroachievements", label: "RetroAchievements"[\s\S]*id: "steam", label: "Steam"[\s\S]*id: "about", label: "About"/u);
  assert.match(navigationSource, /type ProviderSettingsFooterTab = ProviderSettingsTab \| "about"/u);
  assert.match(navigationSource, /let nextFullScreenSettingsProvider: ProviderSettingsTab = "retroachievements"/u);
  assert.match(navigationSource, /const initialProvider = nextFullScreenSettingsProvider[\s\S]*nextFullScreenSettingsProvider = "retroachievements"[\s\S]*return initialProvider/u);
  assert.match(navigationSource, /nextFullScreenSettingsProvider = target\.providerId === STEAM_PROVIDER_ID[\s\S]*\? "steam"[\s\S]*: "retroachievements"/u);
  assert.match(navigationSource, /useDeckyFullscreenOnScreenKeyboardLifecycle\(keyboardAnchorRef\)/u);
  assert.match(navigationSource, /reserveSteamProfileFooter[\s\S]*inProviderSwitcher[\s\S]*<DeckyFullScreenFooterOverlay/u);
  assert.match(navigationSource, /activeProvider === "about" \? <DeckyFullScreenAboutPage providerId=\{lastSelectedProvider\}/u);
  assert.match(navigationSource, /activeNavigationItemId=\{activeProvider\}[\s\S]*onPreviousNavigationItem=\{\(\) => selectFooterTab[\s\S]*onNextNavigationItem=\{\(\) => selectFooterTab/u);
  assert.match(steamSource, /height: pageHeight \?\? "100vh", flexShrink: 0/u);
  assert.match(retroSource, /!inProviderSwitcher \? <PanelSection title="Navigation">/u);
  assert.match(retroSource, /inProviderSwitcher \? 62 : 12/u);
  assert.match(retroSource, /height: viewportHeight \?\? "100vh"[\s\S]*overflow: "hidden"/u);
  assert.match(retroSource, /<DeckySettingsSection><div style=\{settingsScrollStyle\}>/u);
  assert.match(retroSource, /useSharedFullscreenFooter=\{inProviderSwitcher\}/u);
  assert.match(credentialsSource, /useSharedFullscreenFooter\) markDeckyFullscreenOnScreenKeyboardOpen\(event\.currentTarget\.ownerDocument\)/u);
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
  assert.match(footerSource, /isActive && !isOnScreenKeyboardOpen && portalTarget/u);
  assert.match(footerSource, /isDeckyFullscreenOnScreenKeyboardOpen\(ownerWindow\.document\)/u);
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
