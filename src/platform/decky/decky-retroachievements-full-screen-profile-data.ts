import type { CompletionProgressSnapshot, DashboardSnapshot, NormalizedGame } from "@core/domain";
import type { AchievementCompanionSettings, RetroAchievementsAchievementMode } from "@core/settings";
import {
  getRetroAchievementsPlayedGameProgress,
  getRetroAchievementsProfileOverviewMetrics,
  getRetroAchievementsProfileRanks,
  sortRetroAchievementsUnlocksNewestFirst,
} from "./decky-retroachievements-compact-profile-model";
import { getRetroAchievementsCompletionIndicatorState } from "./decky-retroachievements-completion-indicator";
import { getRetroAchievementsProfileStatValues } from "./decky-stat-helpers";

export interface RetroAchievementsProfileProgressSummary {
  readonly unlockedCount: number;
  readonly totalCount: number | undefined;
  readonly completionPercent: number | undefined;
  readonly remainingCount: number | undefined;
}

export interface RetroAchievementsProfileRecentCompletion {
  readonly game: NormalizedGame;
  readonly kind: "beaten" | "completed" | "mastered";
  readonly mode?: "hardcore" | "softcore";
  readonly awardedAt: number;
}

function getCompletionAwardKind(game: NormalizedGame): RetroAchievementsProfileRecentCompletion["kind"] | undefined {
  const rawKind = game.metrics.find((metric) => metric.key === "highest-award-kind")?.value.toLowerCase();
  if (rawKind?.includes("completed") === true) return "completed";
  if (rawKind?.includes("mastered") === true) return "mastered";
  if (rawKind?.includes("beaten") === true) return "beaten";
  return undefined;
}

function buildProgressSummary(
  unlockedCount: number | undefined,
  totalCount: number | undefined,
): RetroAchievementsProfileProgressSummary | undefined {
  if (unlockedCount === undefined || !Number.isFinite(unlockedCount)) return undefined;
  const unlocked = Math.max(0, Math.trunc(unlockedCount));
  const total = totalCount !== undefined && Number.isFinite(totalCount)
    ? Math.max(0, Math.trunc(totalCount))
    : undefined;
  return {
    unlockedCount: unlocked,
    totalCount: total,
    completionPercent: total !== undefined && total > 0
      ? Math.min(100, Math.round((unlocked / total) * 100))
      : undefined,
    remainingCount: total !== undefined ? Math.max(0, total - unlocked) : undefined,
  };
}

function getRecentCompletions(games: readonly NormalizedGame[]): readonly RetroAchievementsProfileRecentCompletion[] {
  return games.flatMap((game): RetroAchievementsProfileRecentCompletion[] => {
    const rawAwardKind = game.metrics.find((metric) => metric.key === "highest-award-kind")?.value.toLowerCase();
    const kind = getCompletionAwardKind(game);
    if (kind === undefined) return [];
    const mode = rawAwardKind?.includes("softcore") === true
      ? "softcore"
      : rawAwardKind?.includes("hardcore") === true
        ? "hardcore"
        : undefined;
    const rawDate = game.metrics.find((metric) => metric.key === "highest-award-date")?.value;
    const awardedAt = rawDate === undefined ? NaN : Number(rawDate);
    if (!Number.isFinite(awardedAt) || awardedAt <= 0) return [];
    return [{
      game,
      kind,
      ...(mode !== undefined ? { mode } : {}),
      awardedAt,
    }];
  }).sort((left, right) => right.awardedAt - left.awardedAt).slice(0, 2);
}

export interface RetroAchievementsProfileSystemSummary {
  readonly systemId: string;
  readonly title: string;
  readonly iconUrl?: string;
  readonly unlockedAchievements: number;
  readonly totalAchievements?: number;
  readonly completionPercent?: number;
}

interface SystemAccumulator {
  readonly systemId: string;
  title: string;
  iconUrl?: string;
  unlockedAchievements: number;
  totalAchievements: number;
  hasUnknownTotal: boolean;
}

function getSystemKey(game: NormalizedGame): { readonly systemId: string; readonly title: string } | undefined {
  const title = game.platformLabel?.trim();
  if (title === undefined || title.length === 0) return undefined;
  const systemId = game.platformId?.trim();
  return {
    systemId: systemId !== undefined && systemId.length > 0 ? systemId : `label:${title.toLowerCase()}`,
    title,
  };
}

export function getRetroAchievementsProfileSystems(
  games: readonly NormalizedGame[],
  limit?: number,
): readonly RetroAchievementsProfileSystemSummary[] {
  const systems = new Map<string, SystemAccumulator>();

  for (const game of games) {
    const key = getSystemKey(game);
    if (key === undefined) continue;

    const current = systems.get(key.systemId) ?? {
      systemId: key.systemId,
      title: key.title,
      unlockedAchievements: 0,
      totalAchievements: 0,
      hasUnknownTotal: false,
    } satisfies SystemAccumulator;
    current.title = current.title || key.title;
    if (current.iconUrl === undefined && game.systemIconUrl !== undefined) {
      current.iconUrl = game.systemIconUrl;
    }
    current.unlockedAchievements += Math.max(0, game.summary.unlockedCount);
    if (game.summary.totalCount === undefined) {
      current.hasUnknownTotal = true;
    } else {
      current.totalAchievements += Math.max(0, game.summary.totalCount);
    }
    systems.set(key.systemId, current);
  }

  const sortedSystems = [...systems.values()]
    .sort((left, right) => {
      if (left.unlockedAchievements !== right.unlockedAchievements) {
        return right.unlockedAchievements - left.unlockedAchievements;
      }
      return left.title.localeCompare(right.title);
    });
  const visibleSystems = limit === undefined
    ? sortedSystems
    : sortedSystems.slice(0, Math.max(0, limit));

  return visibleSystems
    .map((system) => {
      const totalAchievements = system.hasUnknownTotal ? undefined : system.totalAchievements;
      const completionPercent = totalAchievements !== undefined && totalAchievements > 0
        ? Math.min(100, Math.round((system.unlockedAchievements / totalAchievements) * 100))
        : undefined;
      return {
        systemId: system.systemId,
        title: system.title,
        ...(system.iconUrl !== undefined ? { iconUrl: system.iconUrl } : {}),
        unlockedAchievements: system.unlockedAchievements,
        ...(totalAchievements !== undefined ? { totalAchievements } : {}),
        ...(completionPercent !== undefined ? { completionPercent } : {}),
      };
    });
}

export function buildRetroAchievementsFullScreenProfileModel({
  snapshot,
  completion,
  settings,
}: {
  readonly snapshot: DashboardSnapshot;
  readonly completion?: CompletionProgressSnapshot;
  readonly settings: AchievementCompanionSettings;
}) {
  const games = completion?.games ?? snapshot.featuredGames;
  const systems = getRetroAchievementsProfileSystems(games);
  const recentUnlocks = sortRetroAchievementsUnlocksNewestFirst(
    snapshot.recentAchievements.length > 0 ? snapshot.recentAchievements : snapshot.recentUnlocks,
  );
  const awards = games.reduce((summary, game) => {
    const award = getRetroAchievementsCompletionIndicatorState(game);
    if (award?.startsWith("mastered")) summary.mastered += 1;
    else if (award?.startsWith("beaten")) summary.beaten += 1;
    return summary;
  }, { beaten: 0, mastered: 0 });
  const completionAwardCounts = games.reduce((counts, game) => {
    const kind = getCompletionAwardKind(game);
    if (kind !== undefined) counts[kind] += 1;
    return counts;
  }, { beaten: 0, completed: 0, mastered: 0 });

  return {
    profile: snapshot.profile,
    initialAchievementMode: settings.retroAchievementsAchievementMode,
    progressByMode: {
      both: buildProgressSummary(snapshot.profile.summary.unlockedCount, snapshot.profile.summary.totalCount),
      hardcore: buildProgressSummary(snapshot.profile.hardcoreUnlockedCount, snapshot.profile.summary.totalCount),
      softcore: buildProgressSummary(snapshot.profile.softcoreUnlockedCount, snapshot.profile.summary.totalCount),
    } satisfies Record<RetroAchievementsAchievementMode, RetroAchievementsProfileProgressSummary | undefined>,
    systems,
    ranks: getRetroAchievementsProfileRanks(snapshot.profile, settings.retroAchievementsRankDisplay),
    profileStats: getRetroAchievementsProfileStatValues({ profile: snapshot.profile }),
    overviewMetrics: getRetroAchievementsProfileOverviewMetrics(
      snapshot.profile,
      settings.retroAchievementsAchievementMode,
    ),
    recentUnlocks: recentUnlocks.slice(0, 3),
    recentCompletions: getRecentCompletions(games),
    completionAwardCounts,
    recentGames: snapshot.recentlyPlayedGames.slice(0, 3).map((game) => ({
      game,
      progress: getRetroAchievementsPlayedGameProgress(game, settings.retroAchievementsAchievementMode),
    })),
    completion: {
      gamesWithProgress: games.length,
      inProgress: completion?.summary.unfinishedCount ?? games.filter((game) => game.status === "in_progress").length,
      beaten: completion?.summary.beatenCount ?? awards.beaten,
      mastered: completion?.summary.masteredCount ?? awards.mastered,
    },
  } as const;
}
