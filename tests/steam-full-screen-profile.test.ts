import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type {
  CompletionProgressSnapshot,
  NormalizedGame,
  NormalizedProfile,
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
  const [pageSource, dashboardSource, footerSource] = await Promise.all([
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
  ]);

  assert.match(pageSource, /snapshot\.providerId === STEAM_PROVIDER_ID[\s\S]*<DeckySteamFullScreenGamesDashboard/u);
  assert.match(dashboardSource, /data-steam-full-screen-games-dashboard/u);
  assert.match(dashboardSource, /height: "100%"[\s\S]*overflow: "hidden"/u);
  assert.match(dashboardSource, /repeat\(5, minmax\(0, 1fr\)\) minmax\(230px, 2\.2fr\)/u);
  assert.match(dashboardSource, /const STEAM_GAMES_ROW_ARTWORK_WIDTH = 134;/u);
  assert.match(dashboardSource, /const STEAM_GAMES_ROW_ARTWORK_HEIGHT = 58;/u);
  assert.match(dashboardSource, /const STEAM_GAMES_ROW_HEIGHT = 65;/u);
  assert.match(dashboardSource, /<img\s+alt=""\s+aria-hidden="true"\s+src=\{src\}/u);
  assert.match(dashboardSource, /filter: STEAM_GAMES_ICON_FILTERS\[tone\]/u);
  assert.doesNotMatch(dashboardSource, /MaskImage|IconMask/u);
  assert.doesNotMatch(dashboardSource, /checkCircleIconUrl|steamIconUrl|getPillStyle/u);
  assert.match(dashboardSource, /All Games \(\$\{formatCount\(summary\.trackedCount\)\}\)/u);
  assert.match(dashboardSource, /Played \(\$\{formatCount\(summary\.playedCount\)\}\)/u);
  assert.match(dashboardSource, /Unfinished \(\$\{formatCount\(summary\.unfinishedCount\)\}\)/u);
  assert.match(dashboardSource, /Perfected \(\$\{formatCount\(summary\.perfectedCount\)\}\)/u);
  assert.match(dashboardSource, /Skipped \(\$\{formatCount\(summary\.skippedCount\)\}\)/u);
  assert.match(dashboardSource, /<DeckyFullScreenFooterOverlay/u);
  assert.match(dashboardSource, /navigationItems=\{STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS\}/u);
  assert.match(dashboardSource, /activeNavigationItemId=\{activeNavigationItemId\}/u);
  assert.match(dashboardSource, /if \(filter === "mastered"\)[\s\S]*onOpenActivity\(\)/u);
  assert.match(dashboardSource, /if \(filter === "mastered"\)[\s\S]*setFilter\("all"\)/u);
  assert.match(footerSource, /export const STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS/u);
  assert.doesNotMatch(dashboardSource, /<ScrollPanel>/u);
});

test("Steam full-screen routes share one account refresh per visit and refresh game data on entry", async () => {
  const [servicesSource, navigationSource, profileSource, completionSource, historySource, gameSource, achievementSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-app-services.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-profile-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-completion-progress-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-achievement-history-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-game-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-achievement-page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(
    servicesSource,
    /export function loadDeckyDashboardStateForFullScreenEntry[\s\S]*deckySteamFullScreenDashboardRefreshSession/u,
  );
  assert.match(servicesSource, /mergeDeckySteamCompletionProgressWithDashboard\([\s\S]*readDeckyDashboardSnapshotState\(providerId\)\?\.data/u);
  assert.match(navigationSource, /beginDeckySteamFullScreenRefreshSession\(STEAM_PROVIDER_ID\)/u);
  assert.match(profileSource, /loadDeckyDashboardStateForFullScreenEntry\(providerId\)/u);
  assert.match(profileSource, /if \(providerId === STEAM_PROVIDER_ID\) \{[\s\S]*<DeckyFullScreenLoadingState/u);
  assert.match(completionSource, /await refreshDeckySteamDashboardOnFullScreenEntry\(providerId\)/u);
  assert.match(completionSource, /Refreshing your Steam account and loading your library achievement scan\./u);
  assert.match(historySource, /await refreshDeckySteamDashboardOnFullScreenEntry\(providerId\)/u);
  assert.match(historySource, /Refreshing your Steam account and loading achievement history\./u);
  assert.match(gameSource, /loadDeckyGameDetailState\(providerId, gameId, \{ forceRefresh: true \}\)/u);
  assert.match(achievementSource, /loadDeckyGameDetailState\(providerId, gameId, \{ forceRefresh: true \}\)/u);
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
  assert.doesNotMatch(dashboardSource, /initialFocusApplied|initialFocusTarget\.focus\(\)/u);
  assert.match(
    dashboardSource,
    /<Focusable flow-children="left-right" noFocusRing tabIndex=\{-1\} style=\{getDashboardGridStyle\(\)\}>/u,
  );
  assert.match(dashboardSource, /createDashboardHorizontalFocusHandler\("ArrowRight", \{ panelId: "recent" \}\)/u);
  assert.match(dashboardSource, /createDashboardHorizontalFocusHandler\("ArrowLeft", \{ panelId: "activity" \}\)/u);
  assert.match(dashboardSource, /data-steam-profile-row-index/u);
  assert.match(dashboardSource, /function SteamProfileDashboardFocusStyles\(\)/u);
  assert.match(dashboardSource, /outline: 2px solid rgba\(104, 193, 255, 0\.98\) !important/u);
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
  assert.match(pageSource, /<DeckyFullScreenLoadingState[\s\S]*title="Loading Steam profile\.\.\."/u);
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

test("perfected profile navigation carries a one-shot completion filter", () => {
  markNextFullScreenCompletionProgressFilter("mastered");

  assert.equal(consumeNextFullScreenCompletionProgressFilter(), "mastered");
  assert.equal(consumeNextFullScreenCompletionProgressFilter(), undefined);
});

test("profile summary memo runs before the loading-state early return", async () => {
  const source = await readFile(
    new URL("../src/platform/decky/decky-full-screen-profile-page.tsx", import.meta.url),
    "utf8",
  );
  const summaryMemoIndex = source.indexOf("const steamProfileSummary = useMemo");
  const loadingReturnIndex = source.indexOf("if (!isRenderableDashboardState(state))");

  assert.ok(summaryMemoIndex >= 0, "the Steam profile summary must remain memoized");
  assert.ok(loadingReturnIndex >= 0, "the profile page must retain its loading-state guard");
  assert.ok(
    summaryMemoIndex < loadingReturnIndex,
    "all profile hooks must run before the loading-state early return",
  );
});
