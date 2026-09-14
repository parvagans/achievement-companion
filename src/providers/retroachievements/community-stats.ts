import type { GameCommunityStats } from "@core/domain";
import type {
  RawRetroAchievementsAchievementDistributionResponse,
  RawRetroAchievementsGameProgressionResponse,
} from "./raw-types";

function readNonNegativeInteger(value: unknown): number | undefined {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) && numeric >= 0 ? Math.trunc(numeric) : undefined;
}

function readPositiveDuration(value: unknown, sampleCount: unknown): number | undefined {
  const duration = readNonNegativeInteger(value);
  const samples = readNonNegativeInteger(sampleCount);
  return duration !== undefined && duration > 0 && samples !== undefined && samples > 0 ? duration : undefined;
}

/**
 * Converts the two game-level RA responses into a small UI-safe model. The progression
 * `TimesUsed...Median` values only establish that a timing is sampled; they are not player totals.
 */
export function normalizeRetroAchievementsGameCommunityStats(args: {
  readonly totalAchievementCount: number | undefined;
  readonly totalPlayers: number | undefined;
  readonly distribution: RawRetroAchievementsAchievementDistributionResponse | undefined;
  readonly progression: RawRetroAchievementsGameProgressionResponse | undefined;
}): GameCommunityStats | undefined {
  const masteredPlayers =
    args.totalAchievementCount !== undefined && args.totalAchievementCount > 0
      ? readNonNegativeInteger(args.distribution?.[String(args.totalAchievementCount)])
      : undefined;
  const progressionPlayers = readNonNegativeInteger(
    args.progression?.NumDistinctPlayers ?? args.progression?.numDistinctPlayers,
  );
  const totalPlayers = args.totalPlayers ?? progressionPlayers;
  const masteryPercent =
    totalPlayers !== undefined && totalPlayers > 0 && masteredPlayers !== undefined
      ? Math.max(0, Math.min(100, (masteredPlayers / totalPlayers) * 100))
      : undefined;
  const medianBeatSeconds = readPositiveDuration(
    args.progression?.MedianTimeToBeatHardcore ?? args.progression?.medianTimeToBeatHardcore,
    args.progression?.TimesUsedInHardcoreBeatMedian ?? args.progression?.timesUsedInHardcoreBeatMedian,
  );
  const medianMasterySeconds = readPositiveDuration(
    args.progression?.MedianTimeToMaster ?? args.progression?.medianTimeToMaster,
    args.progression?.TimesUsedInMasteryMedian ?? args.progression?.timesUsedInMasteryMedian,
  );

  if (
    totalPlayers === undefined && masteredPlayers === undefined && medianBeatSeconds === undefined &&
    medianMasterySeconds === undefined
  ) {
    return undefined;
  }

  return {
    ...(totalPlayers !== undefined ? { totalPlayers } : {}),
    ...(masteredPlayers !== undefined ? { masteredPlayers } : {}),
    ...(masteryPercent !== undefined ? { masteryPercent } : {}),
    ...(medianBeatSeconds !== undefined ? { medianBeatSeconds } : {}),
    ...(medianMasterySeconds !== undefined ? { medianMasterySeconds } : {}),
  };
}
