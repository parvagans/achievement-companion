import type { NormalizedAchievement, NormalizedMetric } from "@core/domain";

export function formatTimestamp(epochMs: number | undefined): string {
  if (epochMs === undefined) {
    return "Unknown";
  }

  return new Date(epochMs).toLocaleString();
}

export function formatCount(value: number): string {
  return value.toLocaleString();
}

export function formatPlatformBadgeLabel(platformLabel: string | undefined): string {
  if (platformLabel === undefined) {
    return "?";
  }

  const words = platformLabel
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3);
}

export function getMetricValue(
  metrics: readonly NormalizedMetric[],
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const match = metrics.find((metric) => metric.key === key || metric.label === key);
    if (match !== undefined) {
      return match.value;
    }
  }

  return undefined;
}

export function parseMetricNumber(
  metrics: readonly NormalizedMetric[],
  ...keys: string[]
): number | undefined {
  const rawValue = getMetricValue(metrics, ...keys);
  if (rawValue === undefined) {
    return undefined;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getUnlockRatePercent(
  achievement: Pick<NormalizedAchievement, "metrics">,
): number | undefined {
  const trueRatio = parseMetricNumber(achievement.metrics, "true-ratio", "True Ratio");
  if (trueRatio === undefined || trueRatio <= 0) {
    return undefined;
  }

  return Math.max(1, Math.min(100, Math.round(100 / trueRatio)));
}

export interface AchievementCounts {
  readonly softcoreUnlockCount?: number;
  readonly hardcoreUnlockCount?: number;
  readonly totalPlayers?: number;
}

export function getAchievementCounts(metrics: readonly NormalizedMetric[]): AchievementCounts {
  const totalPlayers = parseMetricNumber(metrics, "unlocked-count", "Total Players");
  const hardcoreUnlockCount = parseMetricNumber(metrics, "hardcore-unlocked-count", "Hardcore Unlocks");

  return {
    ...(totalPlayers !== undefined ? { totalPlayers } : {}),
    ...(hardcoreUnlockCount !== undefined ? { hardcoreUnlockCount } : {}),
    ...(totalPlayers !== undefined && hardcoreUnlockCount !== undefined
      ? { softcoreUnlockCount: Math.max(0, totalPlayers - hardcoreUnlockCount) }
      : {}),
  };
}

export function buildAchievementStatus(
  achievement: Pick<NormalizedAchievement, "isUnlocked" | "unlockedAt">,
): {
  readonly value: string;
  readonly secondary?: string;
} {
  if (!achievement.isUnlocked) {
    return { value: "Locked" };
  }

  const unlockedAt = achievement.unlockedAt;
  if (unlockedAt === undefined) {
    return { value: "Unlocked" };
  }

  return { value: "Unlocked", secondary: `Unlocked ${formatTimestamp(unlockedAt)}` };
}
