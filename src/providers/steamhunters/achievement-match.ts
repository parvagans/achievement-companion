import type { NormalizedAchievement } from "@core/domain";
import type { SteamHuntersAchievement } from "./types";

export interface SteamHuntersAchievementMatch {
  readonly steamAchievementId: string;
  readonly steamHuntersAchievement: SteamHuntersAchievement;
}

/**
 * Steam schema/API identifiers are stable across localization. Display names
 * are intentionally never used as a fallback because they can collide/change.
 */
export function matchSteamAchievements(
  steamAchievements: readonly NormalizedAchievement[],
  steamHuntersAchievements: readonly SteamHuntersAchievement[],
): readonly SteamHuntersAchievementMatch[] {
  const candidatesByApiName = new Map<string, SteamHuntersAchievement[]>();
  for (const achievement of steamHuntersAchievements) {
    const candidates = candidatesByApiName.get(achievement.apiName) ?? [];
    candidates.push(achievement);
    candidatesByApiName.set(achievement.apiName, candidates);
  }

  const matches: SteamHuntersAchievementMatch[] = [];
  for (const achievement of steamAchievements) {
    const candidates = candidatesByApiName.get(achievement.achievementId);
    if (candidates?.length !== 1) {
      continue;
    }

    const steamHuntersAchievement = candidates[0];
    if (steamHuntersAchievement !== undefined) {
      matches.push({ steamAchievementId: achievement.achievementId, steamHuntersAchievement });
    }
  }

  return matches;
}
