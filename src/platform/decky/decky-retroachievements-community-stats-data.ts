import type { GameCommunityStats, GameDetailSnapshot } from "@core/domain";
import { countDeckyCommunityRarityBands, type DeckyCommunityRarityDistribution } from "./decky-community-rarity";
import { parseMetricNumber } from "./decky-achievement-detail-helpers";

export type RetroAchievementsCommunityInsight =
  | { readonly kind: "metric"; readonly label: string; readonly value: string }
  | { readonly kind: "beat"; readonly label: "Median Beat"; readonly hardcore?: string; readonly softcore?: string };

export function buildRetroAchievementsCommunityInsights(
  stats: GameCommunityStats,
): readonly RetroAchievementsCommunityInsight[] {
  const hasValidMasteryRate = stats.masteryPercent !== undefined
    && Number.isFinite(stats.masteryPercent)
    && stats.totalPlayers !== undefined
    && stats.totalPlayers > 0
    && stats.masteredPlayers !== undefined;
  const hardcoreBeat = formatRetroAchievementsCommunityDuration(stats.medianBeatSeconds);
  const softcoreBeat = formatRetroAchievementsCommunityDuration(stats.medianBeatSoftcoreSeconds);
  const medianCompletion = formatRetroAchievementsCommunityDuration(stats.medianCompletionSeconds);
  const medianMastery = formatRetroAchievementsCommunityDuration(stats.medianMasterySeconds);

  return [
    ...(stats.totalPlayers !== undefined && Number.isFinite(stats.totalPlayers)
      ? [{ kind: "metric" as const, label: "Players", value: stats.totalPlayers.toLocaleString() }] : []),
    ...(stats.masteredPlayers !== undefined && Number.isFinite(stats.masteredPlayers)
      ? [{ kind: "metric" as const, label: "Mastered Players", value: stats.masteredPlayers.toLocaleString() }] : []),
    ...(hasValidMasteryRate
      ? [{ kind: "metric" as const, label: "Mastery", value: `${stats.masteryPercent!.toFixed(stats.masteryPercent! < 10 ? 1 : 0)}%` }] : []),
    ...(hardcoreBeat !== undefined || softcoreBeat !== undefined
      ? [{ kind: "beat" as const, label: "Median Beat" as const,
        ...(hardcoreBeat !== undefined ? { hardcore: hardcoreBeat } : {}),
        ...(softcoreBeat !== undefined ? { softcore: softcoreBeat } : {}) }] : []),
    ...(medianCompletion !== undefined
      ? [{ kind: "metric" as const, label: "Median Completion", value: medianCompletion }] : []),
    ...(medianMastery !== undefined
      ? [{ kind: "metric" as const, label: "Median Mastery", value: medianMastery }] : []),
  ];
}

export function buildRetroAchievementsCommunityRarityDistribution(
  snapshot: GameDetailSnapshot,
): DeckyCommunityRarityDistribution | undefined {
  const expectedCount = snapshot.reportedAchievementCount;
  const totalPlayers = parseMetricNumber(snapshot.game.metrics, "total-players");
  if (snapshot.game.providerId !== "retroachievements"
    || !Number.isSafeInteger(expectedCount) || expectedCount === undefined || expectedCount <= 0
    || expectedCount !== snapshot.achievements.length
    || !Number.isSafeInteger(totalPlayers) || totalPlayers === undefined || totalPlayers <= 0) {
    return undefined;
  }

  const percentages: number[] = [];
  const achievementIds = new Set<string>();
  for (const achievement of snapshot.achievements) {
    const earnedPlayers = parseMetricNumber(achievement.metrics, "unlocked-count");
    if (achievement.providerId !== "retroachievements"
      || achievement.gameId !== snapshot.game.gameId
      || achievementIds.has(achievement.achievementId)
      || !Number.isSafeInteger(earnedPlayers) || earnedPlayers === undefined
      || earnedPlayers < 0 || earnedPlayers > totalPlayers) {
      return undefined;
    }
    achievementIds.add(achievement.achievementId);
    percentages.push((earnedPlayers / totalPlayers) * 100);
  }
  return countDeckyCommunityRarityBands(percentages);
}

export function hasDisplayableRetroAchievementsCommunityStats(stats: GameCommunityStats | undefined): boolean {
  if (stats === undefined) return false;
  const hasValidMasteryRate = stats.masteryPercent !== undefined
    && Number.isFinite(stats.masteryPercent)
    && stats.totalPlayers !== undefined
    && Number.isFinite(stats.totalPlayers)
    && stats.totalPlayers > 0
    && stats.masteredPlayers !== undefined
    && Number.isFinite(stats.masteredPlayers);
  return [
    stats.totalPlayers,
    stats.masteredPlayers,
    stats.medianBeatSeconds,
    stats.medianBeatSoftcoreSeconds,
    stats.medianCompletionSeconds,
    stats.medianMasterySeconds,
  ].some((value) => value !== undefined && Number.isFinite(value)) || hasValidMasteryRate;
}

export function formatRetroAchievementsCommunityDuration(seconds: number | undefined): string | undefined {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }

  const minutes = Math.round(seconds / 60);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  return `${Math.max(1, remainingMinutes)}m`;
}
