import assert from "node:assert/strict";
import test from "node:test";
import type { RecentUnlock, RecentlyPlayedGame } from "../src/core/domain";
import { buildCompactActivityGamesForDay, filterCompactActivityEntriesForDay } from "../src/platform/decky/decky-compact-activity-model";
import { getLocalActivityCalendarDayTimestamp } from "../src/platform/decky/decky-activity-calendar-model";

function unlock(gameId: string, achievementId: string, timestamp: number, unlockMode: "hardcore" | "softcore"): RecentUnlock {
  return {
    game: { providerId: "retroachievements", gameId, title: `Game ${gameId}` },
    achievement: {
      providerId: "retroachievements", gameId, achievementId, title: achievementId,
      isUnlocked: true, metrics: [], unlockedAt: timestamp, unlockMode,
    },
    unlockedAt: timestamp,
  };
}

test("shared compact activity model filters the selected local date and groups all real unlocks by game", () => {
  const dayStart = new Date(2026, 9, 4, 0, 0, 0).getTime();
  const nextDay = new Date(2026, 9, 5, 0, 0, 0).getTime();
  const entries = [
    unlock("1", "hardcore-first", dayStart + 1_000, "hardcore"),
    unlock("1", "softcore-second", dayStart + 2_000, "softcore"),
    unlock("2", "other-game", dayStart + 3_000, "hardcore"),
    unlock("1", "next-day", nextDay, "hardcore"),
  ];
  const selectedDate = filterCompactActivityEntriesForDay(entries, getLocalActivityCalendarDayTimestamp(dayStart));
  const games: readonly RecentlyPlayedGame[] = [{
    providerId: "retroachievements", gameId: "1", title: "Known game", summary: { unlockedCount: 10, totalCount: 20 },
  }];
  const grouped = buildCompactActivityGamesForDay(selectedDate, games);

  assert.deepEqual(selectedDate.map(({ achievement }) => achievement.achievementId), [
    "hardcore-first", "softcore-second", "other-game",
  ]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0]?.game, games[0]);
  assert.equal(grouped[0]?.unlockCount, 2);
  assert.equal(grouped[1]?.game.gameId, "2");
  assert.equal(grouped[1]?.unlockCount, 1);
});
