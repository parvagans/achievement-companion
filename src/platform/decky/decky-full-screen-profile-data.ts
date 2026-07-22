import type { DashboardSnapshot, NormalizedGame, RecentlyPlayedGame } from "@core/domain";
import { getRetroAchievementsCompletionIndicatorState } from "./decky-retroachievements-completion-indicator";

export interface RetroAchievementsSupplementaryProfileStat {
  readonly label: string;
  readonly value: string;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatRelativeTime(epochMs: number, now: number): string {
  const elapsedMs = now - epochMs;
  const absoluteMs = Math.abs(elapsedMs);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (absoluteMs < 60_000) {
    const value = Math.max(1, Math.round(absoluteMs / 1000));
    return formatter.format(elapsedMs >= 0 ? -value : value, "second");
  }

  if (absoluteMs < 3_600_000) {
    const value = Math.max(1, Math.round(absoluteMs / 60_000));
    return formatter.format(elapsedMs >= 0 ? -value : value, "minute");
  }

  if (absoluteMs < 86_400_000) {
    const value = Math.max(1, Math.round(absoluteMs / 3_600_000));
    return formatter.format(elapsedMs >= 0 ? -value : value, "hour");
  }

  const value = Math.max(1, Math.round(absoluteMs / 86_400_000));
  return formatter.format(elapsedMs >= 0 ? -value : value, "day");
}

function getLatestRetroAchievementsActivityAt(args: {
  readonly recentlyPlayedGames: readonly RecentlyPlayedGame[];
  readonly completionGames: readonly NormalizedGame[];
}): number | undefined {
  const timestamps = [
    ...args.recentlyPlayedGames.map((game) => game.lastPlayedAt),
    ...args.completionGames.map((game) => game.lastUnlockAt),
  ].filter((value): value is number => value !== undefined);

  return timestamps.length > 0 ? Math.max(...timestamps) : undefined;
}

export function getRetroAchievementsSupplementaryProfileStats(args: {
  readonly profile: DashboardSnapshot["profile"];
  readonly recentlyPlayedGames: readonly RecentlyPlayedGame[];
  readonly completionGames: readonly NormalizedGame[];
  readonly now?: number;
}): readonly RetroAchievementsSupplementaryProfileStat[] {
  const lastActivityAt = getLatestRetroAchievementsActivityAt(args);
  const completionPercent = args.profile.summary.completionPercent;

  return [
    ...(completionPercent !== undefined
      ? [
          {
            label: "Achievement completion",
            value: `${formatCount(completionPercent)}%`,
          },
        ]
      : []),
    ...(lastActivityAt !== undefined
      ? [
          {
            label: "Last activity",
            value: formatRelativeTime(lastActivityAt, args.now ?? Date.now()),
          },
        ]
      : []),
  ];
}

export function getRetroAchievementsProfileAwardStatus(
  game: NormalizedGame,
): "beaten" | "mastered" | undefined {
  const indicatorState = getRetroAchievementsCompletionIndicatorState(game);
  if (indicatorState?.startsWith("mastered") === true) {
    return "mastered";
  }

  if (indicatorState?.startsWith("beaten") === true) {
    return "beaten";
  }

  return undefined;
}

export interface RetroAchievementsGameAwardsSelection {
  readonly mode: "mastered" | "beaten" | "empty";
  readonly games: readonly NormalizedGame[];
  readonly subtitle: string;
}

function formatAwardCount(count: number, label: string): string {
  return `${count.toLocaleString()} ${label}${count === 1 ? "" : "s"}`;
}

export function selectRetroAchievementsGameAwards(
  games: readonly NormalizedGame[],
  limit = 3,
): RetroAchievementsGameAwardsSelection {
  const masteredGames = games.filter(
    (game) => getRetroAchievementsProfileAwardStatus(game) === "mastered",
  );
  if (masteredGames.length > 0) {
    return {
      mode: "mastered",
      games: masteredGames.slice(0, Math.max(0, limit)),
      subtitle: formatAwardCount(masteredGames.length, "mastered award"),
    };
  }

  const beatenGames = games.filter(
    (game) => getRetroAchievementsProfileAwardStatus(game) === "beaten",
  );
  if (beatenGames.length > 0) {
    return {
      mode: "beaten",
      games: beatenGames.slice(0, Math.max(0, limit)),
      subtitle: "No mastered awards yet",
    };
  }

  return {
    mode: "empty",
    games: [],
    subtitle: "No awards yet",
  };
}

export function getRetroAchievementsProfileGameCompletionPercent(
  game: NormalizedGame,
): number | undefined {
  const total = game.summary.totalCount;
  if (total === undefined || total <= 0) {
    return undefined;
  }

  return Math.max(0, Math.min(100, Math.round((game.summary.unlockedCount / total) * 100)));
}

export function selectRetroAchievementsCompletionProgressGames(
  games: readonly NormalizedGame[],
  limit = 3,
): readonly NormalizedGame[] {
  return games
    .map((game, sourceIndex) => ({ game, sourceIndex }))
    .filter(({ game }) => {
      if (
        getRetroAchievementsProfileAwardStatus(game) === "mastered" ||
        game.status === "mastered" ||
        game.status === "completed"
      ) {
        return false;
      }

      const total = game.summary.totalCount;
      return total !== undefined && total > 0 && game.summary.unlockedCount < total;
    })
    .sort((left, right) => {
      const leftTotal = left.game.summary.totalCount!;
      const rightTotal = right.game.summary.totalCount!;
      const leftRatio = left.game.summary.unlockedCount / leftTotal;
      const rightRatio = right.game.summary.unlockedCount / rightTotal;

      if (leftRatio !== rightRatio) {
        return rightRatio - leftRatio;
      }

      if (left.game.summary.unlockedCount !== right.game.summary.unlockedCount) {
        return right.game.summary.unlockedCount - left.game.summary.unlockedCount;
      }

      return left.sourceIndex - right.sourceIndex;
    })
    .slice(0, Math.max(0, limit))
    .map(({ game }) => game);
}
