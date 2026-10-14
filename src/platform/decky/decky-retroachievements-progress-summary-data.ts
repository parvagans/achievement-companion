import type { NormalizedAchievement, ProgressSummary, UnixEpochMs } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { getCompletionPercent } from "./decky-completion-progress-bar";
import { isRetroAchievementsUnlockedInMode } from "./decky-retroachievements-unlock-mode";

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
  achievementMode = "both",
}: {
  readonly summary: ProgressSummary;
  readonly achievements: readonly NormalizedAchievement[];
  readonly achievementMode?: RetroAchievementsAchievementMode;
}): DeckyRetroAchievementsProgressSummaryData {
  const totalCount = normalizeCount(summary.totalCount, achievements.length);
  const unlockedCount = normalizeCount(summary.unlockedCount, 0);
  let earnedPoints = 0;
  let totalPoints = 0;
  let hasPointData = false;
  let lastUnlockAt: UnixEpochMs | undefined;

  for (const achievement of achievements) {
    const points = getAchievementPoints(achievement);
    const unlockedInMode = achievementMode === "both"
      ? achievement.isUnlocked
      : isRetroAchievementsUnlockedInMode(achievement, achievementMode);
    const unlockedAt = achievementMode === "hardcore"
      ? achievement.hardcoreUnlockedAt ?? (achievement.unlockMode === "hardcore" ? achievement.unlockedAt : undefined)
      : achievementMode === "softcore"
        ? achievement.softcoreUnlockedAt ?? (achievement.unlockMode === "softcore" ? achievement.unlockedAt : undefined)
        : achievement.unlockedAt;
    if (points !== undefined) {
      totalPoints += points;
      hasPointData = true;
      if (unlockedInMode) {
        earnedPoints += points;
      }
    }

    if (
      unlockedInMode &&
      unlockedAt !== undefined &&
      Number.isFinite(unlockedAt) &&
      (lastUnlockAt === undefined || unlockedAt > lastUnlockAt)
    ) {
      lastUnlockAt = unlockedAt;
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
