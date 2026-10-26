import type { GameDetailSnapshot, NormalizedAchievement, RecentlyPlayedGame } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { getSteamHuntersGameEnrichment } from "../../providers/steamhunters";
import { projectRetroAchievementsFullScreenAchievements } from "./decky-retroachievements-full-screen-achievement-data";
import {
  isGameOverviewGoalComplete,
  selectGameOverviewSuggestions,
  type GameOverviewSuggestion,
  type RetroAchievementsGameGoal,
} from "./decky-game-overview-recommendations";

export const DECKY_COMPACT_UP_NEXT_CANDIDATE_LIMIT = 5;

export type DeckyCompactUpNextOutcome =
  | { readonly kind: "suggestion"; readonly suggestion: GameOverviewSuggestion }
  | { readonly kind: "all-hidden" }
  | { readonly kind: "completed" }
  | { readonly kind: "empty" };

export interface DeckyCompactUpNextModel {
  readonly snapshot: GameDetailSnapshot;
  readonly outcome: DeckyCompactUpNextOutcome;
  readonly suggestions: readonly GameOverviewSuggestion[];
  readonly hiddenAchievements: readonly NormalizedAchievement[];
}

export function shouldAdvanceDeckyCompactUpNextCandidate(args: {
  readonly providerId: string;
  readonly activeGameId?: string;
  readonly currentGameId?: string;
  readonly outcomeKind?: DeckyCompactUpNextOutcome["kind"];
  readonly hasFatalError: boolean;
  readonly hasNextCandidate: boolean;
}): boolean {
  if (args.providerId !== "steam" || !args.hasNextCandidate || args.currentGameId === args.activeGameId) {
    return false;
  }

  return args.outcomeKind === "completed"
    || args.outcomeKind === "empty"
    || args.hasFatalError;
}

function isSteamGameCompleted(game: RecentlyPlayedGame): boolean {
  const { totalCount, unlockedCount } = game.summary;
  return totalCount !== undefined && totalCount > 0 && unlockedCount === totalCount;
}

export function selectDeckyCompactUpNextCandidates(args: {
  readonly providerId: string;
  readonly games: readonly RecentlyPlayedGame[];
  readonly activeGameId?: string;
  readonly limit?: number;
}): readonly RecentlyPlayedGame[] {
  const limit = Math.max(1, Math.trunc(args.limit ?? DECKY_COMPACT_UP_NEXT_CANDIDATE_LIMIT));
  const unique = new Map<string, RecentlyPlayedGame>();
  const active = args.activeGameId === undefined
    ? undefined
    : args.games.find((game) => game.gameId === args.activeGameId);
  if (active !== undefined) unique.set(active.gameId, active);
  for (const game of args.games) unique.set(game.gameId, game);
  const ordered = [...unique.values()];
  const eligible = args.providerId === "steam"
    ? ordered.filter((game) => !isSteamGameCompleted(game))
    : ordered;
  return (eligible.length > 0 ? eligible : ordered.slice(0, 1)).slice(0, limit);
}

function getSteamHuntersSelectionData(snapshot: GameDetailSnapshot) {
  const enrichment = getSteamHuntersGameEnrichment(snapshot);
  return enrichment === undefined ? undefined : {
    app: enrichment.app,
    achievements: Object.values(enrichment.achievementsBySteamAchievementId),
    groups: enrichment.achievementGroups,
  };
}

export function buildDeckyCompactUpNextModel(args: {
  readonly snapshot: GameDetailSnapshot;
  readonly hiddenAchievementIds: readonly string[];
  readonly goal: RetroAchievementsGameGoal;
  readonly achievementMode: RetroAchievementsAchievementMode;
  readonly limit?: number;
}): DeckyCompactUpNextModel {
  const achievements = projectRetroAchievementsFullScreenAchievements(args.snapshot, args.achievementMode);
  const snapshot = achievements === args.snapshot.achievements
    ? args.snapshot
    : { ...args.snapshot, achievements };
  const steamHunters = snapshot.game.providerId === "steam"
    ? getSteamHuntersSelectionData(snapshot)
    : undefined;
  const selection = {
    snapshot,
    goal: args.goal,
    achievementMode: args.achievementMode,
    limit: Math.max(1, Math.trunc(args.limit ?? 1)),
    ...(steamHunters !== undefined ? { steamHunters } : {}),
  };
  const allSuggestions = selectGameOverviewSuggestions(selection);
  const visibleSuggestions = selectGameOverviewSuggestions({
    ...selection,
    hiddenAchievementIds: args.hiddenAchievementIds,
  });
  const hidden = new Set(args.hiddenAchievementIds);
  const hiddenAchievements = achievements.filter((achievement) =>
    !achievement.isUnlocked && hidden.has(achievement.achievementId),
  );
  const completed = isGameOverviewGoalComplete(snapshot, args.goal, args.achievementMode);
  const outcome: DeckyCompactUpNextOutcome = completed
    ? { kind: "completed" }
    : visibleSuggestions[0] !== undefined
      ? { kind: "suggestion", suggestion: visibleSuggestions[0] }
      : allSuggestions.length > 0
        ? { kind: "all-hidden" }
        : { kind: "empty" };
  return { snapshot, outcome, suggestions: visibleSuggestions, hiddenAchievements };
}
