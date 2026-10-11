import type { NormalizedAchievement } from "@core/domain";

export interface NativeRetroAchievementsActivityItem {
  readonly achievement: NormalizedAchievement;
  readonly unlockedAt: number;
}

/** The newest confirmed unlocks in the selected RA achievement mode. */
export function getNativeRetroAchievementsActivityItems(
  achievements: readonly NormalizedAchievement[],
  limit = 8,
): readonly NativeRetroAchievementsActivityItem[] {
  const seen = new Set<string>();
  return achievements
    .filter((achievement) => achievement.isUnlocked
      && typeof achievement.unlockedAt === "number"
      && Number.isFinite(achievement.unlockedAt)
      && achievement.unlockedAt > 0)
    .sort((left, right) => (right.unlockedAt ?? 0) - (left.unlockedAt ?? 0))
    .filter((achievement) => {
      if (seen.has(achievement.achievementId)) return false;
      seen.add(achievement.achievementId);
      return true;
    })
    .slice(0, Math.max(0, limit))
    .map((achievement) => ({ achievement, unlockedAt: achievement.unlockedAt! }));
}
