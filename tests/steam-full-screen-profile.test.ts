import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { NormalizedProfile, RecentlyPlayedGame } from "../src/core/domain";
import type { SteamLibraryAchievementScanSummary } from "../src/providers/steam/library-scan";
import { buildSteamFullScreenProfileSummary } from "../src/platform/decky/decky-steam-full-screen-profile-data";

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
  assert.deepEqual(summary.achievements, { unlocked: 44, perfectGames: 1, completionPercent: 44 });
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
  assert.equal(summary.achievements.perfectGames, undefined);
  assert.equal(summary.mostPlayedGame, undefined);
  assert.equal(summary.closestToPerfectGame, undefined);
  assert.deepEqual(summary.recentGames, []);
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
