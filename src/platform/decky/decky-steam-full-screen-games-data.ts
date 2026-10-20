import type { CompletionProgressSnapshot, NormalizedGame } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import type { CompletionProgressSort } from "./decky-completion-progress-grouping";
import { getRetroAchievementsCompletionIndicatorState } from "./decky-retroachievements-completion-indicator";
import { getRetroAchievementsModeGameUnlockedCount, hasUnavailableRetroAchievementsModeGameCounts } from "./decky-retroachievements-mode-progress";

export type SteamGamesFilter =
  | "all"
  | "played"
  | "unfinished"
  | "completed"
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
  readonly completionPercent?: number;
}

export function clampSteamGamesPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function getSteamGamesPercentage(part: number, whole: number): number {
  return whole > 0 ? clampSteamGamesPercent((part / whole) * 100) : 0;
}

export function formatSteamGamesActivityDate(
  game: Pick<NormalizedGame, "lastPlayedAt" | "lastUnlockAt">,
  providerId: string,
): string {
  const isRetroAchievements = providerId === "retroachievements";
  const epochMs = isRetroAchievements ? game.lastUnlockAt : game.lastPlayedAt;
  if (epochMs === undefined) return isRetroAchievements ? "Unavailable" : "Never";
  return new Date(epochMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function isSteamGamesPlayed(game: NormalizedGame): boolean {
  return (
    (game.playtimeForeverMinutes ?? 0) > 0 ||
    (game.playtimeTwoWeeksMinutes ?? 0) > 0 ||
    (game.playtimeDeckForeverMinutes ?? 0) > 0 ||
    game.summary.unlockedCount > 0
  );
}

export function matchesSteamGamesFilter(
  game: NormalizedGame,
  filter: SteamGamesFilter,
  mode: RetroAchievementsAchievementMode = "both",
): boolean {
  const isRetroAchievements = game.providerId === "retroachievements";
  if (filter === "all") {
    return true;
  }

  if (filter === "played") {
    return isRetroAchievements ? (getRetroAchievementsModeGameUnlockedCount(game, mode) ?? 0) > 0 : isSteamGamesPlayed(game);
  }

  if (isRetroAchievements && mode !== "both") {
    const unlocked = getRetroAchievementsModeGameUnlockedCount(game, mode) ?? 0;
    const award = getRetroAchievementsCompletionIndicatorState(game);
    const selectedAward = award?.endsWith(mode) === true ? award : undefined;
    if (filter === "unfinished") return unlocked > 0 && selectedAward === undefined;
    if (filter === "beaten") return selectedAward?.startsWith("beaten") === true;
    if (filter === "completed") return selectedAward !== undefined;
    return selectedAward === "mastered-hardcore";
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
      : game.scanStatus === "no-achievements";
  }

  if (filter === "completed") {
    return isRetroAchievements && (
      game.status === "beaten" || game.status === "completed" || game.status === "mastered"
    );
  }

  return game.status === "mastered";
}

export function summarizeSteamGamesDashboard(
  snapshot: CompletionProgressSnapshot,
  mode: RetroAchievementsAchievementMode = "both",
  achievementProgressGames: readonly NormalizedGame[] = snapshot.games,
): SteamGamesDashboardSummary {
  let unlockedAchievements = 0;
  let totalAchievements = 0;
  const isRetroAchievements = snapshot.providerId === "retroachievements";
  let hasCompleteRetroAchievementsTotals = !isRetroAchievements || !hasUnavailableRetroAchievementsModeGameCounts(achievementProgressGames, mode);

  for (const game of achievementProgressGames) {
    if (isRetroAchievements && (
      game.summary.totalCount === undefined || game.summary.unlockedCount > game.summary.totalCount
    )) {
      hasCompleteRetroAchievementsTotals = false;
    }
    if (game.summary.totalCount === undefined || (!isRetroAchievements && game.scanStatus !== "scanned")) {
      continue;
    }

    unlockedAchievements += isRetroAchievements
      ? getRetroAchievementsModeGameUnlockedCount(game, mode) ?? 0
      : game.summary.unlockedCount;
    totalAchievements += game.summary.totalCount;
  }

  return {
    trackedCount: snapshot.games.length,
    playedCount: snapshot.games.filter((game) => matchesSteamGamesFilter(game, "played", mode)).length,
    unfinishedCount: snapshot.games.filter((game) => matchesSteamGamesFilter(game, "unfinished", mode)).length,
    skippedCount: snapshot.games.filter((game) => matchesSteamGamesFilter(game, "beaten", mode)).length,
    perfectedCount: snapshot.games.filter((game) => matchesSteamGamesFilter(game, "mastered", mode)).length,
    unlockedAchievements,
    totalAchievements,
    ...(hasCompleteRetroAchievementsTotals
      ? { completionPercent: getSteamGamesPercentage(unlockedAchievements, totalAchievements) }
      : {}),
  };
}

export function selectSteamGames(args: {
  readonly games: readonly NormalizedGame[];
  readonly filter: SteamGamesFilter;
  readonly query: string;
  readonly sort: CompletionProgressSort;
  readonly mode?: RetroAchievementsAchievementMode;
}): readonly NormalizedGame[] {
  const normalizedQuery = args.query.trim().toLocaleLowerCase();
  const games = args.games.filter((game) => {
    if (!matchesSteamGamesFilter(game, args.filter, args.mode)) {
      return false;
    }

    return normalizedQuery.length === 0 || game.title.toLocaleLowerCase().includes(normalizedQuery);
  });

  return [...games].sort((left, right) => {
    if (args.sort === "title") {
      return left.title.localeCompare(right.title);
    }

    if (args.sort === "completion") {
      const percent = (game: NormalizedGame): number => {
        const unlocked = game.providerId === "retroachievements"
          ? getRetroAchievementsModeGameUnlockedCount(game, args.mode ?? "both")
          : game.summary.unlockedCount;
        const total = game.summary.totalCount;
        return unlocked !== undefined && total !== undefined && total > 0 ? unlocked / total : 0;
      };
      const percentDelta = percent(right) - percent(left);
      return percentDelta !== 0 ? percentDelta : left.title.localeCompare(right.title);
    }

    const recentAt = (game: NormalizedGame): number => {
      if (
        game.providerId === "retroachievements" &&
        (args.filter === "completed" || args.filter === "beaten" || args.filter === "mastered")
      ) {
        const awardDate = Number(game.metrics.find((metric) => metric.key === "highest-award-date")?.value);
        if (Number.isFinite(awardDate) && awardDate > 0) {
          return awardDate;
        }
      }
      return game.lastUnlockAt ?? game.lastPlayedAt ?? Number.NEGATIVE_INFINITY;
    };
    const leftRecentAt = recentAt(left);
    const rightRecentAt = recentAt(right);
    if (leftRecentAt !== rightRecentAt) {
      return rightRecentAt - leftRecentAt;
    }

    return left.title.localeCompare(right.title);
  });
}
