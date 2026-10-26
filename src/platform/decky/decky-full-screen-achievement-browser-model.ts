import type { NormalizedAchievement, NormalizedMetric } from "@core/domain";
import type { SteamHuntersAchievement } from "../../providers/steamhunters";
import { getAchievementDetailCounts } from "./decky-achievement-detail-helpers";
import { getSteamAchievementCommunityPercent } from "./decky-achievement-row-presentation";
import {
  getSupportedAchievementBrowserSorts,
  sortAchievementBrowserItems,
  type AchievementBrowserSort,
  type AchievementBrowserSortValues,
} from "./decky-achievement-browser-options";
import type { AchievementModeFilter } from "./decky-full-screen-achievement-browser";

function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

export function matchesFullScreenAchievementSearch(
  achievement: Pick<NormalizedAchievement, "title" | "description">,
  query: string,
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length === 0) return true;
  return normalizeSearchText(`${achievement.title}\n${achievement.description ?? ""}`).includes(normalizedQuery);
}

function getUnlockTimestamp(
  achievement: NormalizedAchievement,
  modeFilter: AchievementModeFilter,
): number | undefined {
  if (modeFilter === "hardcore") return achievement.hardcoreUnlockedAt
    ?? (achievement.unlockMode === "hardcore" ? achievement.unlockedAt : undefined);
  if (modeFilter === "softcore") return achievement.softcoreUnlockedAt
    ?? (achievement.unlockMode === "softcore" ? achievement.unlockedAt : undefined);
  const values = [achievement.unlockedAt, achievement.hardcoreUnlockedAt, achievement.softcoreUnlockedAt]
    .filter((value): value is number => value !== undefined && Number.isFinite(value));
  return values.length > 0 ? Math.max(...values) : undefined;
}

export function getFullScreenAchievementSortValues(
  achievement: NormalizedAchievement,
  gameMetrics: readonly NormalizedMetric[],
  modeFilter: AchievementModeFilter,
  steamHuntersAchievement?: SteamHuntersAchievement,
): AchievementBrowserSortValues {
  const rarityPercent = achievement.providerId === "steam"
    ? getSteamAchievementCommunityPercent(achievement, steamHuntersAchievement)
    : getAchievementDetailCounts(achievement.metrics, gameMetrics).unlockRatePercent;
  const pointsValue = achievement.providerId === "steam"
    ? steamHuntersAchievement?.points
    : achievement.points;
  const unlockedAt = getUnlockTimestamp(achievement, modeFilter);
  return {
    title: achievement.title,
    ...(rarityPercent !== undefined && Number.isFinite(rarityPercent) ? { rarityPercent } : {}),
    ...(pointsValue !== undefined && Number.isFinite(pointsValue) ? { pointsValue } : {}),
    ...(unlockedAt !== undefined && Number.isFinite(unlockedAt) ? { unlockedAt } : {}),
  };
}

export function getSupportedFullScreenAchievementSorts(
  achievements: readonly NormalizedAchievement[],
  gameMetrics: readonly NormalizedMetric[],
  modeFilter: AchievementModeFilter,
  steamHuntersAchievements?: Readonly<Record<string, SteamHuntersAchievement>>,
): readonly AchievementBrowserSort[] {
  return getSupportedAchievementBrowserSorts(achievements, (achievement) => getFullScreenAchievementSortValues(
    achievement,
    gameMetrics,
    modeFilter,
    steamHuntersAchievements?.[achievement.achievementId],
  ));
}

export function sortFullScreenAchievements(
  achievements: readonly NormalizedAchievement[],
  sort: AchievementBrowserSort,
  gameMetrics: readonly NormalizedMetric[],
  modeFilter: AchievementModeFilter,
  steamHuntersAchievements?: Readonly<Record<string, SteamHuntersAchievement>>,
): readonly NormalizedAchievement[] {
  return sortAchievementBrowserItems(achievements, sort, (achievement) => getFullScreenAchievementSortValues(
    achievement,
    gameMetrics,
    modeFilter,
    steamHuntersAchievements?.[achievement.achievementId],
  ));
}
