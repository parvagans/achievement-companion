import type { CompletionProgressSnapshot, DashboardSnapshot, NormalizedGame } from "@core/domain";
import type { AchievementCompanionSettings } from "@core/settings";
import {
  filterRetroAchievementsUnlocksByMode,
  getRetroAchievementsPlayedGameProgress,
  getRetroAchievementsProfileOverviewMetrics,
  getRetroAchievementsProfileRanks,
  sortRetroAchievementsUnlocksNewestFirst,
} from "./decky-retroachievements-compact-profile-model";
import { getRetroAchievementsCompletionIndicatorState } from "./decky-retroachievements-completion-indicator";
import { getRetroAchievementsProfileStatValues } from "./decky-stat-helpers";

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
    filterRetroAchievementsUnlocksByMode(
      snapshot.recentAchievements.length > 0 ? snapshot.recentAchievements : snapshot.recentUnlocks,
      settings.retroAchievementsAchievementMode,
    ),
  );
  const awards = games.reduce((summary, game) => {
    const award = getRetroAchievementsCompletionIndicatorState(game);
    if (award?.startsWith("mastered")) summary.mastered += 1;
    else if (award?.startsWith("beaten")) summary.beaten += 1;
    return summary;
  }, { beaten: 0, mastered: 0 });

  return {
    profile: snapshot.profile,
    systems,
    ranks: getRetroAchievementsProfileRanks(snapshot.profile, settings.retroAchievementsRankDisplay),
    profileStats: getRetroAchievementsProfileStatValues({ profile: snapshot.profile }),
    overviewMetrics: getRetroAchievementsProfileOverviewMetrics(
      snapshot.profile,
      settings.retroAchievementsAchievementMode,
    ),
    recentUnlocks: recentUnlocks.slice(0, 3),
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
