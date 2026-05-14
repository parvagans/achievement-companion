import type { NormalizedAchievement } from "@core/domain";

export function sortAchievementsForDisplay(
  achievements: readonly NormalizedAchievement[],
): readonly NormalizedAchievement[] {
  return achievements
    .map((achievement, index) => ({
      achievement,
      index,
    }))
    .sort((left, right) => {
      if (left.achievement.isUnlocked !== right.achievement.isUnlocked) {
        return left.achievement.isUnlocked ? -1 : 1;
      }

      if (left.achievement.isUnlocked && right.achievement.isUnlocked) {
        const leftUnlockedAt = left.achievement.unlockedAt;
        const rightUnlockedAt = right.achievement.unlockedAt;

        if (leftUnlockedAt !== undefined && rightUnlockedAt !== undefined && leftUnlockedAt !== rightUnlockedAt) {
          return rightUnlockedAt - leftUnlockedAt;
        }

        if (leftUnlockedAt !== undefined && rightUnlockedAt === undefined) {
          return -1;
        }

        if (leftUnlockedAt === undefined && rightUnlockedAt !== undefined) {
          return 1;
        }
      }

      return left.index - right.index;
    })
    .map(({ achievement }) => achievement);
}
