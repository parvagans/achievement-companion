import type { NormalizedAchievement } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";

/** Values consumed by Steam's own app-details achievement components. */
export interface NativeSteamAchievement {
  readonly strID: string;
  readonly strName: string;
  readonly strDescription: string;
  readonly strImage: string;
  readonly bAchieved: boolean;
  readonly bHidden: boolean;
  readonly rtUnlocked: number;
  readonly flMinProgress: number;
  readonly flCurrentProgress: number;
  readonly flMaxProgress: number;
  readonly flAchieved: number;
}

export interface NativeSteamAchievements {
  readonly nAchieved: number;
  readonly nTotal: number;
  readonly vecHighlight: readonly NativeSteamAchievement[];
  readonly vecAchievedHidden: readonly NativeSteamAchievement[];
  readonly vecUnachieved: readonly NativeSteamAchievement[];
}

function metricNumber(achievement: NormalizedAchievement, key: string): number | undefined {
  const value = Number(achievement.metrics.find((metric) => metric.key === key)?.value);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function globalPercentage(
  achievement: NormalizedAchievement,
  mode: RetroAchievementsAchievementMode,
  totalPlayers: number | undefined,
): number {
  if (totalPlayers === undefined || !Number.isFinite(totalPlayers) || totalPlayers <= 0) {
    return 0;
  }

  const key = mode === "hardcore"
    ? "hardcore-unlocked-count"
    : mode === "softcore"
      ? "softcore-unlocked-count"
      : "unlocked-count";
  const unlocks = metricNumber(achievement, key);
  return unlocks === undefined ? 0 : Math.min(100, Math.max(0, (unlocks / totalPlayers) * 100));
}

export function toNativeSteamAchievement(
  achievement: NormalizedAchievement,
  mode: RetroAchievementsAchievementMode,
  totalPlayers?: number,
): NativeSteamAchievement {
  return {
    strID: `ra:${achievement.achievementId}`,
    strName: achievement.title,
    strDescription: achievement.description ?? "",
    strImage: achievement.badgeImageUrl ?? "",
    bAchieved: achievement.isUnlocked,
    // The RA game-progress response does not supply a per-achievement hidden flag.
    bHidden: false,
    rtUnlocked: achievement.isUnlocked && achievement.unlockedAt !== undefined
      ? Math.floor(achievement.unlockedAt / 1000)
      : 0,
    flMinProgress: 0,
    flCurrentProgress: achievement.isUnlocked ? 1 : 0,
    flMaxProgress: 1,
    flAchieved: globalPercentage(achievement, mode, totalPlayers),
  };
}

export function toNativeSteamAchievements(
  achievements: readonly NormalizedAchievement[],
  mode: RetroAchievementsAchievementMode,
  totalPlayers?: number,
): NativeSteamAchievements {
  const rows = achievements.map((achievement) =>
    toNativeSteamAchievement(achievement, mode, totalPlayers));
  const unlocked = rows.filter((achievement) => achievement.bAchieved);
  return {
    nAchieved: unlocked.length,
    nTotal: rows.length,
    vecHighlight: unlocked,
    vecAchievedHidden: [],
    vecUnachieved: rows.filter((achievement) => !achievement.bAchieved),
  };
}
