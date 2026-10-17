import type { GameCommunityMaster, GameCommunityStats, NormalizedAchievement } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";

export type NativeRetroAchievementsCommunityMilestone = "unlocked" | "beaten" | "completed" | "mastered";

export interface NativeRetroAchievementsCommunityRow {
  readonly id: NativeRetroAchievementsCommunityMilestone;
  readonly label: string;
  readonly playerCount?: number;
  readonly playerPercent?: number;
  readonly medianSeconds?: number;
}

export interface NativeRetroAchievementsCommunityModel {
  readonly modeLabel: "Casual" | "Hardcore";
  readonly rows: readonly NativeRetroAchievementsCommunityRow[];
  readonly achievementsAvailableSince?: string;
}

export interface NativeRetroAchievementsCommunityModels {
  readonly casual?: NativeRetroAchievementsCommunityModel;
  readonly hardcore?: NativeRetroAchievementsCommunityModel;
  readonly latestMasters: readonly GameCommunityMaster[];
}

function finiteNonNegative(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function finitePositive(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;
}

function playerPercent(playerCount: number | undefined, totalPlayers: number | undefined): number | undefined {
  return playerCount !== undefined && totalPlayers !== undefined && totalPlayers > 0
    ? Math.max(0, Math.min(100, (playerCount / totalPlayers) * 100))
    : undefined;
}

/** Earliest authoritative RA achievement creation date, kept as a calendar date. */
export function getRetroAchievementsAvailabilityDate(
  achievements: readonly NormalizedAchievement[],
): string | undefined {
  const dates = achievements.flatMap((achievement) => achievement.metrics
    .filter((metric) => metric.key === "date-created")
    .map((metric) => metric.value.match(/^(\d{4}-\d{2}-\d{2})/u)?.[1])
    .filter((value): value is string => value !== undefined));
  dates.sort((left, right) => left.localeCompare(right));
  return dates[0];
}

/** Maps RA's game-progression medians and distribution into the native Community recipe. */
export function buildNativeRetroAchievementsCommunityModel(args: {
  readonly stats: GameCommunityStats | undefined;
  readonly mode: Extract<RetroAchievementsAchievementMode, "softcore" | "hardcore">;
  readonly achievementsAvailableSince?: string;
}): NativeRetroAchievementsCommunityModel | undefined {
  const stats = args.stats;
  if (stats === undefined) return undefined;

  const hardcore = args.mode !== "softcore";
  const totalPlayers = finiteNonNegative(stats.totalPlayers);
  const beatPlayers = finiteNonNegative(hardcore ? stats.beatenHardcoreSamples : stats.beatenSamples);
  const finalPlayers = finiteNonNegative(hardcore
    ? stats.masteredPlayers ?? stats.masteredSamples
    : stats.completedSamples);
  const rows: NativeRetroAchievementsCommunityRow[] = [];

  if (totalPlayers !== undefined) {
    rows.push({ id: "unlocked", label: "Unlocked an achievement", playerCount: totalPlayers });
  }

  const beatMedian = finitePositive(hardcore ? stats.medianBeatSeconds : stats.medianBeatSoftcoreSeconds);
  if (beatPlayers !== undefined || beatMedian !== undefined) {
    rows.push({
      id: "beaten",
      label: "Beat the game",
      ...(beatPlayers !== undefined ? { playerCount: beatPlayers } : {}),
      ...(playerPercent(beatPlayers, totalPlayers) !== undefined
        ? { playerPercent: playerPercent(beatPlayers, totalPlayers)! }
        : {}),
      ...(beatMedian !== undefined ? { medianSeconds: beatMedian } : {}),
    });
  }

  const finalMedian = finitePositive(hardcore ? stats.medianMasterySeconds : stats.medianCompletionSeconds);
  if (finalPlayers !== undefined || finalMedian !== undefined) {
    const authoritativeMasteryPercent = hardcore
      ? finiteNonNegative(stats.masteryPercent)
      : undefined;
    rows.push({
      id: hardcore ? "mastered" : "completed",
      label: hardcore ? "Mastered" : "Completed",
      ...(finalPlayers !== undefined ? { playerCount: finalPlayers } : {}),
      ...(authoritativeMasteryPercent !== undefined
        ? { playerPercent: Math.min(100, authoritativeMasteryPercent) }
        : playerPercent(finalPlayers, totalPlayers) !== undefined
          ? { playerPercent: playerPercent(finalPlayers, totalPlayers)! }
          : {}),
      ...(finalMedian !== undefined ? { medianSeconds: finalMedian } : {}),
    });
  }

  if (rows.length === 0) return undefined;
  return {
    modeLabel: hardcore ? "Hardcore" : "Casual",
    rows,
    ...(args.achievementsAvailableSince !== undefined
      ? { achievementsAvailableSince: args.achievementsAvailableSince }
      : {}),
  };
}

/** Builds both independently sourced RA Community modes, regardless of the saved profile filter. */
export function buildNativeRetroAchievementsCommunityModels(args: {
  readonly stats: GameCommunityStats | undefined;
  readonly achievementsAvailableSince?: string;
}): NativeRetroAchievementsCommunityModels | undefined {
  const shared = {
    stats: args.stats,
    ...(args.achievementsAvailableSince !== undefined
      ? { achievementsAvailableSince: args.achievementsAvailableSince }
      : {}),
  };
  const casual = buildNativeRetroAchievementsCommunityModel({ ...shared, mode: "softcore" });
  const hardcore = buildNativeRetroAchievementsCommunityModel({ ...shared, mode: "hardcore" });
  const latestMasters = args.stats?.latestMasters ?? [];
  if (casual === undefined && hardcore === undefined && latestMasters.length === 0) return undefined;
  return {
    ...(casual !== undefined ? { casual } : {}),
    ...(hardcore !== undefined ? { hardcore } : {}),
    latestMasters,
  };
}
