import assert from "node:assert/strict";
import test from "node:test";
import { buildRetroAchievementsCompletionCollection } from "../src/platform/decky/decky-completion-progress-grouping";
import { formatRetroAchievementsCommunityDuration } from "../src/platform/decky/decky-retroachievements-community-stats-data";
import { normalizeRetroAchievementsGameCommunityStats } from "../src/providers/retroachievements/community-stats";
import type { CompletionProgressSnapshot, NormalizedGame } from "../src/core/domain";

function game(id: string, status: NormalizedGame["status"], parentGameId?: string): NormalizedGame {
  return {
    providerId: "retroachievements",
    gameId: id,
    title: `Game ${id}`,
    status,
    summary: { unlockedCount: 1, totalCount: 2 },
    metrics: [],
    ...(parentGameId !== undefined ? { parentGameId } : {}),
  };
}

test("community stats use authoritative distribution counts and never expose median samples as player totals", () => {
  const stats = normalizeRetroAchievementsGameCommunityStats({
    totalAchievementCount: 12,
    totalPlayers: 2_916,
    distribution: { "12": 327 },
    progression: {
      TimesUsedInHardcoreBeatMedian: 4_493,
      MedianTimeToBeatHardcore: 30_840,
      TimesUsedInMasteryMedian: 1_091,
      MedianTimeToMaster: 63_720,
    },
  });

  assert.deepEqual(stats, {
    totalPlayers: 2_916,
    masteredPlayers: 327,
    masteryPercent: 327 / 2_916 * 100,
    medianBeatSeconds: 30_840,
    medianMasterySeconds: 63_720,
  });
  assert.equal((stats as Record<string, unknown>).beatenPlayers, undefined);
  assert.equal(formatRetroAchievementsCommunityDuration(stats?.medianBeatSeconds), "8h 34m");
  assert.equal(formatRetroAchievementsCommunityDuration(stats?.medianMasterySeconds), "17h 42m");
});

test("missing community responses remain optional and cannot break a game view", () => {
  assert.equal(
    normalizeRetroAchievementsGameCommunityStats({
      totalAchievementCount: 12,
      totalPlayers: undefined,
      distribution: undefined,
      progression: undefined,
    }),
    undefined,
  );
});

test("profile and completion progress share the same normalized collection counts", () => {
  const snapshot: CompletionProgressSnapshot = {
    providerId: "retroachievements",
    summary: { playedCount: 89, unfinishedCount: 70, beatenCount: 7, masteredCount: 12 },
    games: [game("1", "in_progress"), game("2", "mastered"), game("3", "in_progress", "1")],
  };

  assert.deepEqual(buildRetroAchievementsCompletionCollection(snapshot), {
    playedCount: 89,
    unfinishedCount: 70,
    beatenCount: 7,
    masteredCount: 12,
    subsetCount: 1,
  });
});
