import type { NormalizedAchievement, ProgressSummary, UnixEpochMs } from "@core/domain";
import { getCompletionPercent } from "./decky-completion-progress-bar";

export interface DeckyRetroAchievementsProgressSummaryData {
  readonly unlockedCount: number;
  readonly totalCount: number;
  readonly remainingCount: number;
  readonly completionPercent: number;
  readonly earnedPoints: number | undefined;
  readonly totalPoints: number | undefined;
  readonly lastUnlockAt: UnixEpochMs | undefined;
}

function normalizeCount(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(value));
}

function getAchievementPoints(achievement: NormalizedAchievement): number | undefined {
  if (achievement.points === undefined || !Number.isFinite(achievement.points)) {
    return undefined;
  }

  return Math.max(0, achievement.points);
}

export function buildDeckyRetroAchievementsProgressSummaryData({
  summary,
  achievements,
}: {
  readonly summary: ProgressSummary;
  readonly achievements: readonly NormalizedAchievement[];
}): DeckyRetroAchievementsProgressSummaryData {
  const totalCount = normalizeCount(summary.totalCount, achievements.length);
  const unlockedCount = normalizeCount(summary.unlockedCount, 0);
  let earnedPoints = 0;
  let totalPoints = 0;
  let hasPointData = false;
  let lastUnlockAt: UnixEpochMs | undefined;

  for (const achievement of achievements) {
    const points = getAchievementPoints(achievement);
    if (points !== undefined) {
      totalPoints += points;
      hasPointData = true;
      if (achievement.isUnlocked) {
        earnedPoints += points;
      }
    }

    if (
      achievement.isUnlocked &&
      achievement.unlockedAt !== undefined &&
      Number.isFinite(achievement.unlockedAt) &&
      (lastUnlockAt === undefined || achievement.unlockedAt > lastUnlockAt)
    ) {
      lastUnlockAt = achievement.unlockedAt;
    }
  }

  const completionPercent = getCompletionPercent({ ...summary, totalCount }) ?? 0;

  return {
    unlockedCount,
    totalCount,
    remainingCount: Math.max(0, totalCount - unlockedCount),
    completionPercent,
    earnedPoints: hasPointData ? earnedPoints : undefined,
    totalPoints: hasPointData ? totalPoints : undefined,
    lastUnlockAt,
  };
}
