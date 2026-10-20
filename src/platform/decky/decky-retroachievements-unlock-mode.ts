import type { NormalizedAchievement } from "@core/domain";

export type RetroAchievementsUnlockMode = "hardcore" | "softcore";

export function isRetroAchievementsUnlockedInMode(
  achievement: NormalizedAchievement,
  mode: RetroAchievementsUnlockMode,
): boolean {
  if (!achievement.isUnlocked) return false;
  const currentMode = achievement.unlockMode
    ?? (achievement.hardcoreUnlockedAt !== undefined
      ? "hardcore"
      : achievement.softcoreUnlockedAt !== undefined ? "softcore" : undefined);
  return currentMode === mode;
}
