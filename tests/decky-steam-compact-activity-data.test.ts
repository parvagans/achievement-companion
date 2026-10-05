import assert from "node:assert/strict";
import test from "node:test";
import type { RecentUnlock, RecentlyPlayedGame } from "../src/core/domain";
import {
  buildSteamCompactActivityGamesForDay,
  filterSteamActivityEntriesForDay,
  getSteamActivityLocalDayTimestamp,
  STEAM_COMPACT_ACTIVITY_CALENDAR_WEEKS,
} from "../src/platform/decky/decky-steam-compact-activity-data";

function unlock(gameId: string, achievementId: string, timestamp: number): RecentUnlock {
  return {
    game: { providerId: "steam", gameId, title: `Game ${gameId}` },
    achievement: {
      providerId: "steam",
      gameId,
      achievementId,
      title: achievementId,
      isUnlocked: true,
      metrics: [],
      unlockedAt: timestamp,
    },
    unlockedAt: timestamp,
  };
}

test("compact Steam activity filters every unlock from the selected local day", () => {
  const selected = new Date(2026, 9, 4, 0, 0, 0).getTime();
  const nextDay = new Date(2026, 9, 5, 0, 0, 0).getTime();
  const entries = [
    unlock("1", "early", selected),
    unlock("1", "late", nextDay - 1),
    unlock("2", "next", nextDay),
  ];

  assert.equal(STEAM_COMPACT_ACTIVITY_CALENDAR_WEEKS, 4);
  assert.deepEqual(
    filterSteamActivityEntriesForDay(entries, getSteamActivityLocalDayTimestamp(selected))
      .map((entry) => entry.achievement.achievementId),
    ["early", "late"],
  );
});

test("compact Steam activity lists each game once with its selected-day unlock count", () => {
  const timestamp = new Date(2026, 9, 4, 12).getTime();
  const known: RecentlyPlayedGame = {
    providerId: "steam",
    gameId: "1",
    title: "Known Game",
    summary: { unlockedCount: 20, totalCount: 30 },
  };
  const games = buildSteamCompactActivityGamesForDay([
    unlock("1", "a", timestamp),
    unlock("2", "b", timestamp),
    unlock("1", "c", timestamp),
  ], [known]);

  assert.equal(games.length, 2);
  assert.equal(games[0]?.game, known);
  assert.equal(games[0]?.unlockCount, 2);
  assert.equal(games[1]?.game.gameId, "2");
  assert.equal(games[1]?.unlockCount, 1);
});
