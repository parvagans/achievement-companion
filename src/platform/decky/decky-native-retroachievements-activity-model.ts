import type { NormalizedAchievement } from "@core/domain";

export interface NativeRetroAchievementsActivityItem {
  readonly achievement: NormalizedAchievement;
  readonly unlockedAt: number;
}

export interface NativeRetroAchievementsActivityDay {
  readonly dayKey: string;
  readonly items: readonly NativeRetroAchievementsActivityItem[];
}

/** Every dated unlock in the selected RA achievement mode, newest first. */
export function getNativeRetroAchievementsActivityItems(
  achievements: readonly NormalizedAchievement[],
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
    .map((achievement) => ({ achievement, unlockedAt: achievement.unlockedAt! }));
}

/** Group unlocks by the same local calendar dates shown on Steam's Activity page. */
export function groupNativeRetroAchievementsActivityItems(
  items: readonly NativeRetroAchievementsActivityItem[],
): readonly NativeRetroAchievementsActivityDay[] {
  const days = new Map<string, NativeRetroAchievementsActivityItem[]>();
  for (const item of [...items].sort((left, right) => right.unlockedAt - left.unlockedAt)) {
    const date = new Date(item.unlockedAt);
    const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const day = days.get(dayKey) ?? [];
    day.push(item);
    days.set(dayKey, day);
  }
  return [...days].map(([dayKey, dayItems]) => ({ dayKey, items: dayItems }));
}
