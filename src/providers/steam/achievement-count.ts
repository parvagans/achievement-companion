import type { RawSteamPlayerAchievement } from "./raw-types";

export interface SteamAchievementCounts {
  readonly total: number;
  readonly unlocked: number;
  readonly achievements: readonly RawSteamPlayerAchievement[];
}

function isSteamAchievementUnlocked(achieved: unknown): boolean {
  return achieved === 1 || achieved === true;
}

/**
 * Steam's player-achievement API names are the shared counting identity.
 * Schemas enrich these states, but never define a smaller count than the
 * player's returned achievement states.
 */
export function countSteamPlayerAchievements(
  achievements: readonly RawSteamPlayerAchievement[],
): SteamAchievementCounts | undefined {
  const byApiName = new Map<string, RawSteamPlayerAchievement>();

  for (const achievement of achievements) {
    const apiName = typeof achievement.apiname === "string" ? achievement.apiname.trim() : "";
    const achieved: unknown = achievement.achieved;
    if (
      apiName.length === 0 ||
      !(achieved === 0 || achieved === 1 || achieved === false || achieved === true)
    ) {
      return undefined;
    }

    const previous = byApiName.get(apiName);
    if (previous !== undefined) {
      const previousUnlocked = isSteamAchievementUnlocked(previous.achieved);
      const currentUnlocked = isSteamAchievementUnlocked(achieved);
      if (previousUnlocked !== currentUnlocked) {
        return undefined;
      }

      // Keep the richest duplicate record (usually the one with an unlock time).
      if ((previous.unlocktime ?? 0) >= (achievement.unlocktime ?? 0)) {
        continue;
      }
    }

    byApiName.set(apiName, achievement);
  }

  const normalizedAchievements = [...byApiName.values()];
  return {
    total: normalizedAchievements.length,
    unlocked: normalizedAchievements.filter(
      (achievement) => isSteamAchievementUnlocked(achievement.achieved),
    ).length,
    achievements: normalizedAchievements,
  };
}

export function getSteamSchemaAchievementApiNames(
  achievements: readonly { readonly name?: string }[],
): readonly string[] | undefined {
  const apiNames = new Set<string>();
  for (const achievement of achievements) {
    const apiName = typeof achievement.name === "string" ? achievement.name.trim() : "";
    if (apiName.length === 0) {
      return undefined;
    }
    apiNames.add(apiName);
  }
  return [...apiNames];
}
