import assert from "node:assert/strict";
import test from "node:test";
import { buildRetroAchievementsCompletionCollection } from "../src/platform/decky/decky-completion-progress-grouping";
import { formatRetroAchievementsCommunityDuration } from "../src/platform/decky/decky-retroachievements-community-stats-data";
import { buildDeckyRetroAchievementsProgressSummaryData } from "../src/platform/decky/decky-retroachievements-progress-summary-data";
import { normalizeRetroAchievementsGameCommunityStats } from "../src/providers/retroachievements/community-stats";
import type { CompletionProgressSnapshot, NormalizedAchievement, NormalizedGame } from "../src/core/domain";

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

function achievement({
  id,
  isUnlocked,
  points,
  unlockedAt,
  unlockMode,
  hardcoreUnlockedAt,
  softcoreUnlockedAt,
}: {
  readonly id: string;
  readonly isUnlocked: boolean;
  readonly points?: number;
  readonly unlockedAt?: number;
  readonly unlockMode?: "hardcore" | "softcore";
  readonly hardcoreUnlockedAt?: number;
  readonly softcoreUnlockedAt?: number;
}): NormalizedAchievement {
  return {
    providerId: "retroachievements",
    gameId: "game-1",
    achievementId: id,
    title: `Achievement ${id}`,
    isUnlocked,
    metrics: [],
    ...(points !== undefined ? { points } : {}),
    ...(unlockedAt !== undefined ? { unlockedAt } : {}),
    ...(unlockMode !== undefined ? { unlockMode } : {}),
    ...(hardcoreUnlockedAt !== undefined ? { hardcoreUnlockedAt } : {}),
    ...(softcoreUnlockedAt !== undefined ? { softcoreUnlockedAt } : {}),
  };
}

test("community stats use authoritative distribution counts and never expose median samples as player totals", () => {
  const stats = normalizeRetroAchievementsGameCommunityStats({
    totalAchievementCount: 12,
    totalPlayers: 2_916,
    distribution: { "12": 327 },
    progression: {
      TimesUsedInBeatMedian: 5_000,
      MedianTimeToBeat: 42_000,
      TimesUsedInHardcoreBeatMedian: 4_493,
      MedianTimeToBeatHardcore: 30_840,
      TimesUsedInCompletionMedian: 400,
      MedianTimeToComplete: 55_000,
      TimesUsedInMasteryMedian: 1_091,
      MedianTimeToMaster: 63_720,
    },
  });

  assert.deepEqual(stats, {
    totalPlayers: 2_916,
    masteredPlayers: 327,
    masteryPercent: 327 / 2_916 * 100,
    medianBeatSeconds: 30_840,
    medianBeatSoftcoreSeconds: 42_000,
    beatenSamples: 5_000,
    beatenHardcoreSamples: 4_493,
    completedSamples: 400,
    masteredSamples: 1_091,
    medianCompletionSeconds: 55_000,
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

test("full-screen RetroAchievements progress derives mode-neutral totals, points, and the latest unlock once", () => {
  const progress = buildDeckyRetroAchievementsProgressSummaryData({
    summary: { unlockedCount: 3, totalCount: 56, completionPercent: 5 },
    achievements: [
      achievement({ id: "a", isUnlocked: true, points: 5, unlockedAt: 1_700_000_000_000, unlockMode: "softcore" }),
      achievement({ id: "b", isUnlocked: true, points: 10, unlockedAt: 1_700_000_020_000, unlockMode: "hardcore" }),
      achievement({ id: "c", isUnlocked: false, points: 385 }),
    ],
  });

  assert.deepEqual(progress, {
    unlockedCount: 3,
    totalCount: 56,
    remainingCount: 53,
    completionPercent: 5,
    earnedPoints: 15,
    totalPoints: 400,
    lastUnlockAt: 1_700_000_020_000,
  });
});

test("full-screen RetroAchievements progress uses the selected mode for earned points and last unlock", () => {
  const achievements = [
    achievement({ id: "hardcore", isUnlocked: true, points: 5, unlockedAt: 100, hardcoreUnlockedAt: 100, unlockMode: "hardcore" }),
    achievement({ id: "softcore", isUnlocked: true, points: 10, unlockedAt: 200, softcoreUnlockedAt: 200, unlockMode: "softcore" }),
    achievement({ id: "locked", isUnlocked: false, points: 15 }),
  ];
  const hardcore = buildDeckyRetroAchievementsProgressSummaryData({
    summary: { unlockedCount: 1, totalCount: 3, completionPercent: 33 },
    achievements,
    achievementMode: "hardcore",
  });
  const softcore = buildDeckyRetroAchievementsProgressSummaryData({
    summary: { unlockedCount: 1, totalCount: 3, completionPercent: 33 },
    achievements,
    achievementMode: "softcore",
  });
  assert.equal(hardcore.earnedPoints, 5);
  assert.equal(hardcore.totalPoints, 30);
  assert.equal(hardcore.lastUnlockAt, 100);
  assert.equal(softcore.earnedPoints, 10);
  assert.equal(softcore.lastUnlockAt, 200);
});

test("full-screen RetroAchievements progress clamps malformed remaining counts and handles zero unlocks", () => {
  const progress = buildDeckyRetroAchievementsProgressSummaryData({
    summary: { unlockedCount: 5, totalCount: 3, completionPercent: -10 },
    achievements: [
      achievement({ id: "a", isUnlocked: false, points: 5 }),
      achievement({ id: "b", isUnlocked: false, points: 10 }),
      achievement({ id: "c", isUnlocked: false, points: 15 }),
    ],
  });

  assert.equal(progress.remainingCount, 0);
  assert.equal(progress.completionPercent, 0);
  assert.equal(progress.earnedPoints, 0);
  assert.equal(progress.totalPoints, 30);
  assert.equal(progress.lastUnlockAt, undefined);
});

test("full-screen RetroAchievements progress represents mastered sets with no remaining achievements", () => {
  const progress = buildDeckyRetroAchievementsProgressSummaryData({
    summary: { unlockedCount: 2, totalCount: 2, completionPercent: 100 },
    achievements: [
      achievement({ id: "a", isUnlocked: true, points: 200, unlockedAt: 1_700_000_000_000, unlockMode: "softcore" }),
      achievement({ id: "b", isUnlocked: true, points: 210, unlockedAt: 1_700_000_030_000, unlockMode: "hardcore" }),
    ],
  });

  assert.equal(progress.remainingCount, 0);
  assert.equal(progress.completionPercent, 100);
  assert.equal(progress.earnedPoints, 410);
  assert.equal(progress.totalPoints, 410);
});
