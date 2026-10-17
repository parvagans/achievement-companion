import type { NormalizedAchievement } from "@core/domain";
import type { SteamHuntersAchievement } from "../../providers/steamhunters";
import { getMetricValue } from "./decky-achievement-detail-helpers";

/** Prefer SteamHunters' qualified-player rate, then fall back to Steam's global unlock rate. */
export function getSteamAchievementCommunityPercent(
  achievement: Pick<NormalizedAchievement, "metrics">,
  steamHuntersAchievement: SteamHuntersAchievement | undefined,
): number | undefined {
  const percentage = steamHuntersAchievement?.localPercentage
    ?? Number(getMetricValue(achievement.metrics, "global-percent", "Global Unlock Rate"));
  return Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : undefined;
}
