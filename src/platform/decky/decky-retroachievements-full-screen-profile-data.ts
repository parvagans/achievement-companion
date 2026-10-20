import type { CompletionProgressSnapshot, DashboardSnapshot, NormalizedGame } from "@core/domain";
import type { AchievementCompanionSettings, RetroAchievementsAchievementMode } from "@core/settings";
import {
  getRetroAchievementsPlayedGameProgress,
  getRetroAchievementsProfileOverviewMetrics,
  getRetroAchievementsProfileRanks,
  sortRetroAchievementsUnlocksNewestFirst,
} from "./decky-retroachievements-compact-profile-model";
import { getRetroAchievementsCompletionIndicatorState } from "./decky-retroachievements-completion-indicator";
import { getRetroAchievementsModeGameUnlockedCount, getRetroAchievementsModeUnlockedCount, hasUnavailableRetroAchievementsModeGameCounts } from "./decky-retroachievements-mode-progress";
import { filterCompletionProgressGamesBySubsetVisibility } from "./decky-completion-progress-grouping";
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
  readonly awardedAt?: number;
  readonly dateKind: "award" | "unlock" | "unavailable";
}

function getCompletionAwardKind(game: NormalizedGame): RetroAchievementsProfileRecentCompletion["kind"] | undefined {
  const state = getRetroAchievementsCompletionIndicatorState(game);
  if (state === "mastered-hardcore") return "mastered";
  if (state === "mastered-softcore") return "completed";
  if (state === "beaten-hardcore" || state === "beaten-softcore") return "beaten";
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

function getRecentCompletions(
  games: readonly NormalizedGame[],
  mode: RetroAchievementsAchievementMode,
): readonly RetroAchievementsProfileRecentCompletion[] {
  const completions = games.flatMap((game): RetroAchievementsProfileRecentCompletion[] => {
    const awardState = getRetroAchievementsCompletionIndicatorState(game);
    const kind = getCompletionAwardKind(game);
    if (kind === undefined) return [];
    const awardMode = awardState?.endsWith("softcore") === true
      ? "softcore"
      : awardState?.endsWith("hardcore") === true
        ? "hardcore"
        : undefined;
    const rawDate = game.metrics.find((metric) => metric.key === "highest-award-date")?.value;
    const awardDate = rawDate === undefined ? undefined : Number(rawDate);
    const hasAwardDate = awardDate !== undefined && Number.isFinite(awardDate) && awardDate > 0;
    const lastUnlockAt = game.lastUnlockAt;
    const hasUnlockDate = lastUnlockAt !== undefined && Number.isFinite(lastUnlockAt) && lastUnlockAt > 0;
    return [{
      game,
      kind,
      ...(awardMode !== undefined ? { mode: awardMode } : {}),
      ...(hasAwardDate ? { awardedAt: awardDate } : hasUnlockDate ? { awardedAt: lastUnlockAt } : {}),
      dateKind: hasAwardDate ? "award" : hasUnlockDate ? "unlock" : "unavailable",
    }];
  }).filter((completion) => mode === "both" || completion.mode === mode)
    .sort((left, right) => (right.awardedAt ?? 0) - (left.awardedAt ?? 0));
  const selected: RetroAchievementsProfileRecentCompletion[] = [];
  const seenKinds = new Set<RetroAchievementsProfileRecentCompletion["kind"]>();
  for (const completion of completions) {
    if (seenKinds.has(completion.kind)) continue;
    selected.push(completion);
    seenKinds.add(completion.kind);
    if (selected.length === 2) break;
  }
  if (selected.length === 2 && seenKinds.has("beaten") && seenKinds.has("mastered")) {
    return selected.sort((left, right) => left.kind === "beaten" ? -1 : right.kind === "beaten" ? 1 : 0);
  }
  return selected;
}

export interface RetroAchievementsProfileSystemSummary {
  readonly systemId: string;
  readonly title: string;
  readonly iconUrl?: string;
  readonly unlockedAchievements: number;
  readonly totalAchievements?: number;
  readonly completionPercent?: number;
}

export function getRetroAchievementsBaseGames(games: readonly NormalizedGame[]): readonly NormalizedGame[] {
  return filterCompletionProgressGamesBySubsetVisibility(games, false);
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
  mode: RetroAchievementsAchievementMode = "both",
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
    const modeUnlockedCount = getRetroAchievementsModeGameUnlockedCount(game, mode);
    if (modeUnlockedCount === undefined) return [];
    current.unlockedAchievements += Math.max(0, modeUnlockedCount);
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
  const sourceGames = completion?.games ?? snapshot.featuredGames;
  const games = getRetroAchievementsBaseGames(sourceGames);
  const systemsUnavailable = hasUnavailableRetroAchievementsModeGameCounts(sourceGames, settings.retroAchievementsAchievementMode);
  const systems = systemsUnavailable
    ? []
    : getRetroAchievementsProfileSystems(sourceGames, settings.retroAchievementsAchievementMode);
  const recentUnlocks = sortRetroAchievementsUnlocksNewestFirst(
    snapshot.recentAchievements.length > 0 ? snapshot.recentAchievements : snapshot.recentUnlocks,
  ).filter((entry) => settings.retroAchievementsAchievementMode === "both"
    || entry.achievement.unlockMode === settings.retroAchievementsAchievementMode);
  const modeGames = games.filter((game) => (getRetroAchievementsModeGameUnlockedCount(game, settings.retroAchievementsAchievementMode) ?? 0) > 0);
  const completionAwardCounts = modeGames.reduce((counts, game) => {
    const award = getRetroAchievementsCompletionIndicatorState(game);
    if (settings.retroAchievementsAchievementMode !== "both" && !award?.endsWith(settings.retroAchievementsAchievementMode)) return counts;
    const kind = getCompletionAwardKind(game);
    if (kind !== undefined) counts[kind] += 1;
    return counts;
  }, { beaten: 0, completed: 0, mastered: 0 });
  return {
    profile: snapshot.profile,
    initialAchievementMode: settings.retroAchievementsAchievementMode,
    progressByMode: {
      both: buildProgressSummary(getRetroAchievementsModeUnlockedCount(snapshot.profile, "both"), snapshot.profile.summary.totalCount),
      hardcore: buildProgressSummary(getRetroAchievementsModeUnlockedCount(snapshot.profile, "hardcore"), snapshot.profile.summary.totalCount),
      softcore: buildProgressSummary(getRetroAchievementsModeUnlockedCount(snapshot.profile, "softcore"), snapshot.profile.summary.totalCount),
    } satisfies Record<RetroAchievementsAchievementMode, RetroAchievementsProfileProgressSummary | undefined>,
    systems,
    systemsUnavailable,
    ranks: getRetroAchievementsProfileRanks(snapshot.profile, settings.retroAchievementsRankDisplay),
    profileStats: getRetroAchievementsProfileStatValues({ profile: snapshot.profile }),
    modeAwardCounts: { beaten: completionAwardCounts.beaten, mastered: completionAwardCounts.mastered },
    overviewMetrics: getRetroAchievementsProfileOverviewMetrics(
      snapshot.profile,
      settings.retroAchievementsAchievementMode,
    ),
    recentUnlocks: recentUnlocks.slice(0, 3),
    recentCompletions: getRecentCompletions(modeGames, settings.retroAchievementsAchievementMode),
    completionAwardCounts,
    recentGames: snapshot.recentlyPlayedGames.slice(0, 3).map((game) => ({
      game,
      progress: getRetroAchievementsPlayedGameProgress(game, settings.retroAchievementsAchievementMode),
    })),
    completion: {
      gamesWithProgress: modeGames.length,
      inProgress: modeGames.filter((game) => {
        const award = getRetroAchievementsCompletionIndicatorState(game);
        return (settings.retroAchievementsAchievementMode !== "both" && award?.endsWith(settings.retroAchievementsAchievementMode) !== true)
          || (settings.retroAchievementsAchievementMode === "both" && award === undefined);
      }).length,
      beaten: completionAwardCounts.beaten,
      mastered: completionAwardCounts.mastered,
    },
  } as const;
}
