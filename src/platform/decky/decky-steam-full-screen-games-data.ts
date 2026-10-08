import type { CompletionProgressSnapshot, NormalizedGame } from "@core/domain";
import type { CompletionProgressSort } from "./decky-completion-progress-grouping";

export type SteamGamesFilter =
  | "all"
  | "played"
  | "unfinished"
  | "beaten"
  | "mastered";

export interface SteamGamesDashboardSummary {
  readonly trackedCount: number;
  readonly playedCount: number;
  readonly unfinishedCount: number;
  readonly skippedCount: number;
  readonly perfectedCount: number;
  readonly unlockedAchievements: number;
  readonly totalAchievements: number;
  readonly completionPercent: number;
}

export function clampSteamGamesPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function getSteamGamesPercentage(part: number, whole: number): number {
  return whole > 0 ? clampSteamGamesPercent((part / whole) * 100) : 0;
}

export function isSteamGamesPlayed(game: NormalizedGame): boolean {
  return (
    (game.playtimeForeverMinutes ?? 0) > 0 ||
    (game.playtimeTwoWeeksMinutes ?? 0) > 0 ||
    (game.playtimeDeckForeverMinutes ?? 0) > 0 ||
    game.hasAchievements === true
  );
}

export function matchesSteamGamesFilter(
  game: NormalizedGame,
  filter: SteamGamesFilter,
): boolean {
  const isRetroAchievements = game.providerId === "retroachievements";
  if (filter === "all") {
    return true;
  }

  if (filter === "played") {
    return isRetroAchievements ? game.summary.unlockedCount > 0 : isSteamGamesPlayed(game);
  }

  if (filter === "unfinished") {
    if (isRetroAchievements) {
      return game.status === "in_progress" || (
        game.summary.totalCount !== undefined &&
        game.summary.unlockedCount > 0 &&
        game.summary.unlockedCount < game.summary.totalCount &&
        game.status !== "beaten" &&
        game.status !== "completed" &&
        game.status !== "mastered"
      );
    }
    return (
      game.scanStatus === "scanned" &&
      game.summary.totalCount !== undefined &&
      game.summary.totalCount > 0 &&
      game.summary.unlockedCount < game.summary.totalCount
    );
  }

  if (filter === "beaten") {
    return isRetroAchievements
      ? game.status === "beaten" || game.status === "completed"
      : game.scanStatus !== undefined && game.scanStatus !== "scanned";
  }

  return game.status === "mastered";
}

export function summarizeSteamGamesDashboard(
  snapshot: CompletionProgressSnapshot,
): SteamGamesDashboardSummary {
  let unlockedAchievements = 0;
  let totalAchievements = 0;

  for (const game of snapshot.games) {
    if (game.summary.totalCount === undefined) {
      continue;
    }

    unlockedAchievements += game.summary.unlockedCount;
    totalAchievements += game.summary.totalCount;
  }

  return {
    trackedCount: snapshot.games.length,
    playedCount: snapshot.summary.playedCount,
    unfinishedCount: snapshot.summary.unfinishedCount,
    skippedCount: snapshot.summary.beatenCount,
    perfectedCount: snapshot.summary.masteredCount,
    unlockedAchievements,
    totalAchievements,
    completionPercent: getSteamGamesPercentage(unlockedAchievements, totalAchievements),
  };
}

export function selectSteamGames(args: {
  readonly games: readonly NormalizedGame[];
  readonly filter: SteamGamesFilter;
  readonly query: string;
  readonly sort: CompletionProgressSort;
}): readonly NormalizedGame[] {
  const normalizedQuery = args.query.trim().toLocaleLowerCase();
  const games = args.games.filter((game) => {
    if (!matchesSteamGamesFilter(game, args.filter)) {
      return false;
    }

    return normalizedQuery.length === 0 || game.title.toLocaleLowerCase().includes(normalizedQuery);
  });

  return [...games].sort((left, right) => {
    if (args.sort === "title") {
      return left.title.localeCompare(right.title);
    }

    if (args.sort === "completion") {
      const percentDelta = (right.summary.completionPercent ?? 0) - (left.summary.completionPercent ?? 0);
      return percentDelta !== 0 ? percentDelta : left.title.localeCompare(right.title);
    }

    const leftRecentAt = left.lastUnlockAt ?? left.lastPlayedAt ?? Number.NEGATIVE_INFINITY;
    const rightRecentAt = right.lastUnlockAt ?? right.lastPlayedAt ?? Number.NEGATIVE_INFINITY;
    if (leftRecentAt !== rightRecentAt) {
      return rightRecentAt - leftRecentAt;
    }

    return left.title.localeCompare(right.title);
  });
}
