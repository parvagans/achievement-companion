import type { GameCommunityStats } from "@core/domain";

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
