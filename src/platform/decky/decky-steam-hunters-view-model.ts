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

export interface DeckySteamHuntersGameViewModel {
  readonly enrichment: SteamHuntersGameEnrichment;
  readonly progressPoints?: DeckySteamHuntersProgressPoints;
  readonly completionHealth: DeckySteamHuntersCompletionHealth;
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

export function buildDeckySteamHuntersGameViewModel(args: {
  readonly achievements: readonly NormalizedAchievement[];
  readonly enrichment: SteamHuntersGameEnrichment | undefined;
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
  const hasCommunityStats =
    app.playersPerfectedCount !== undefined ||
    app.playersStartedCount !== undefined ||
    app.playersCompletedCount !== undefined;

  return {
    enrichment,
    ...(progressPoints !== undefined ? { progressPoints } : {}),
    completionHealth: {
      ...(app.hasPaidDlc !== undefined ? { hasPaidDlc: app.hasPaidDlc } : {}),
      ...(app.unobtainableAchievementCount !== undefined
        ? { unobtainableCount: app.unobtainableAchievementCount }
        : {}),
      ...(conditionalCount !== undefined ? { conditionalCount } : {}),
      ...(brokenButObtainableCount !== undefined ? { brokenButObtainableCount } : {}),
    },
    hasCommunityStats,
  };
}
