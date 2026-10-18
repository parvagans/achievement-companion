import type { NormalizedAchievement } from "@core/domain";
import type {
  SteamHuntersAchievement,
  SteamHuntersGameEnrichment,
  SteamHuntersObtainability,
} from "../../providers/steamhunters";

export interface DeckySteamHuntersProgressPoints {
  readonly earned: number;
  readonly total: number;
}

export interface DeckySteamHuntersCompletionHealth {
  readonly hasPaidDlc?: boolean;
  readonly unobtainableCount?: number;
  readonly conditionalCount?: number;
  readonly brokenButObtainableCount?: number;
}

export interface DeckySteamHuntersCommunitySummary {
  readonly perfectedPercentage?: number;
  readonly startedPlayers?: number;
  readonly perfectedPlayers?: number;
  readonly beatenPlayers?: number;
  readonly medianCompletionMinutes?: number;
  readonly fastestCompletionMinutes?: number;
  readonly totalPlayers?: number;
}

export interface DeckySteamHuntersRarityDistribution {
  readonly common: number;
  readonly uncommon: number;
  readonly rare: number;
  readonly veryRare: number;
  readonly total: number;
}

export interface DeckySteamHuntersGameViewModel {
  readonly enrichment: SteamHuntersGameEnrichment;
  readonly achievementSetMismatch?: { readonly steamCount: number; readonly steamHuntersCount: number };
  readonly progressPoints?: DeckySteamHuntersProgressPoints;
  readonly completionHealth: DeckySteamHuntersCompletionHealth;
  readonly communitySummary?: DeckySteamHuntersCommunitySummary;
  readonly rarityDistribution?: DeckySteamHuntersRarityDistribution;
  readonly hasCommunityStats: boolean;
}

function countObtainability(
  achievements: readonly SteamHuntersAchievement[],
  obtainability: SteamHuntersObtainability,
): number {
  return achievements.filter((achievement) => achievement.obtainability === obtainability).length;
}

function hasCompleteMatchedAchievementSet(args: {
  readonly achievements: readonly NormalizedAchievement[];
  readonly enrichment: SteamHuntersGameEnrichment;
}): boolean {
  const expectedCount = args.enrichment.app.achievementCount;
  const matchedAchievements = Object.values(args.enrichment.achievementsBySteamAchievementId);
  return (
    expectedCount !== undefined &&
    expectedCount === args.achievements.length &&
    matchedAchievements.length === args.achievements.length
  );
}

function buildProgressPoints(args: {
  readonly achievements: readonly NormalizedAchievement[];
  readonly enrichment: SteamHuntersGameEnrichment;
  readonly hasCompleteSet: boolean;
}): DeckySteamHuntersProgressPoints | undefined {
  if (!args.hasCompleteSet || args.enrichment.app.points === undefined) {
    return undefined;
  }

  let earned = 0;
  for (const achievement of args.achievements) {
    const points = args.enrichment.achievementsBySteamAchievementId[achievement.achievementId]?.points;
    if (points === undefined) {
      return undefined;
    }
    if (achievement.isUnlocked) {
      earned += points;
    }
  }

  return { earned, total: args.enrichment.app.points };
}

function buildCommunitySummary(
  app: SteamHuntersGameEnrichment["app"],
): DeckySteamHuntersCommunitySummary | undefined {
  const startedPlayers = app.playersStartedCount ?? app.playersQualifiedCount;
  const totalPlayers = app.playerCount ?? app.playersStartedCount ?? app.playersQualifiedCount ?? app.userCount;
  const perfectedPercentage =
    app.playersPerfectedCount !== undefined &&
    app.playersQualifiedCount !== undefined &&
    app.playersQualifiedCount > 0
      ? (app.playersPerfectedCount / app.playersQualifiedCount) * 100
      : undefined;
  const summary = {
    ...(startedPlayers !== undefined ? { startedPlayers } : {}),
    ...(perfectedPercentage !== undefined ? { perfectedPercentage } : {}),
    ...(app.playersPerfectedCount !== undefined ? { perfectedPlayers: app.playersPerfectedCount } : {}),
    ...(app.playersBaseGameCompletedCount !== undefined ? { beatenPlayers: app.playersBaseGameCompletedCount } : {}),
    ...(app.medianCompletionTime !== undefined ? { medianCompletionMinutes: app.medianCompletionTime } : {}),
    ...(app.fastestCompletionTime !== undefined ? { fastestCompletionMinutes: app.fastestCompletionTime } : {}),
    ...(totalPlayers !== undefined ? { totalPlayers } : {}),
  };
  return Object.keys(summary).length > 0 ? summary : undefined;
}

function buildRarityDistribution(args: {
  readonly achievements: readonly SteamHuntersAchievement[];
  readonly hasCompleteSet: boolean;
}): DeckySteamHuntersRarityDistribution | undefined {
  if (!args.hasCompleteSet || args.achievements.some((achievement) => achievement.localPercentage === undefined)) {
    return undefined;
  }

  let common = 0;
  let uncommon = 0;
  let rare = 0;
  let veryRare = 0;
  for (const achievement of args.achievements) {
    const percentage = achievement.localPercentage!;
    if (percentage >= 50) common += 1;
    else if (percentage >= 20) uncommon += 1;
    else if (percentage >= 5) rare += 1;
    else veryRare += 1;
  }

  return { common, uncommon, rare, veryRare, total: args.achievements.length };
}

export function buildDeckySteamHuntersGameViewModel(args: {
  readonly achievements: readonly NormalizedAchievement[];
  readonly enrichment: SteamHuntersGameEnrichment | undefined;
  readonly totalAchievementCount?: number | undefined;
}): DeckySteamHuntersGameViewModel | undefined {
  const enrichment = args.enrichment;
  if (enrichment === undefined) {
    return undefined;
  }

  const hasCompleteSet = hasCompleteMatchedAchievementSet({ achievements: args.achievements, enrichment });
  const matchedAchievements = Object.values(enrichment.achievementsBySteamAchievementId);
  const conditionalCount = hasCompleteSet
    ? countObtainability(matchedAchievements, "conditionally-obtainable")
    : undefined;
  const brokenButObtainableCount = hasCompleteSet
    ? countObtainability(matchedAchievements, "broken-but-obtainable")
    : undefined;
  const progressPoints = buildProgressPoints({ achievements: args.achievements, enrichment, hasCompleteSet });
  const app = enrichment.app;
  const steamCount = args.totalAchievementCount ?? args.achievements.length;
  const achievementSetMismatch = app.achievementCount !== undefined &&
    steamCount > 0 && app.achievementCount !== steamCount
    ? { steamCount, steamHuntersCount: app.achievementCount }
    : undefined;
  const communitySummary = buildCommunitySummary(app);
  const rarityDistribution = buildRarityDistribution({ achievements: matchedAchievements, hasCompleteSet });

  return {
    enrichment,
    ...(achievementSetMismatch !== undefined ? { achievementSetMismatch } : {}),
    ...(progressPoints !== undefined ? { progressPoints } : {}),
    ...(communitySummary !== undefined ? { communitySummary } : {}),
    ...(rarityDistribution !== undefined ? { rarityDistribution } : {}),
    completionHealth: {
      ...(app.hasPaidDlc !== undefined ? { hasPaidDlc: app.hasPaidDlc } : {}),
      ...(app.unobtainableAchievementCount !== undefined
        ? { unobtainableCount: app.unobtainableAchievementCount }
        : {}),
      ...(conditionalCount !== undefined ? { conditionalCount } : {}),
      ...(brokenButObtainableCount !== undefined ? { brokenButObtainableCount } : {}),
    },
    hasCommunityStats: communitySummary !== undefined,
  };
}
