import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { isRetroAchievementsUnlockedInMode } from "./decky-retroachievements-unlock-mode";

export function projectRetroAchievementsFullScreenAchievements(
  snapshot: GameDetailSnapshot | undefined,
  preference: RetroAchievementsAchievementMode,
): readonly NormalizedAchievement[] {
  if (snapshot === undefined || snapshot.game.providerId !== "retroachievements" || preference === "both") {
    return snapshot?.achievements ?? [];
  }

  return snapshot.achievements.map((achievement) => {
    const isUnlocked = isRetroAchievementsUnlockedInMode(achievement, preference);
    const unlockedAt = preference === "hardcore"
      ? achievement.hardcoreUnlockedAt
      : achievement.softcoreUnlockedAt;
    const { unlockMode: _unlockMode, unlockedAt: _unlockedAt, ...rest } = achievement;
    return {
      ...rest,
      isUnlocked,
      ...(isUnlocked ? { unlockMode: preference } : {}),
      ...(unlockedAt !== undefined ? { unlockedAt } : {}),
    };
  });
}

export function hasDistinctRetroAchievementsModes(achievements: readonly NormalizedAchievement[]): boolean {
  return achievements.some((achievement) => achievement.hardcoreUnlockedAt !== undefined)
    && achievements.some((achievement) => achievement.softcoreUnlockedAt !== undefined);
}
