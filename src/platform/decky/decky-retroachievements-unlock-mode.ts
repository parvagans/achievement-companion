import type { NormalizedAchievement } from "@core/domain";

export type RetroAchievementsUnlockMode = "hardcore" | "softcore";

export function isRetroAchievementsUnlockedInMode(
  achievement: NormalizedAchievement,
  mode: RetroAchievementsUnlockMode,
): boolean {
  return mode === "hardcore"
    ? achievement.hardcoreUnlockedAt !== undefined || (achievement.isUnlocked && achievement.unlockMode === "hardcore")
    : achievement.softcoreUnlockedAt !== undefined || (achievement.isUnlocked && achievement.unlockMode === "softcore");
}
