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

export interface AchievementSpotlightCounts extends AchievementCounts {
  readonly totalUnlockCount?: number;
  readonly unlockRatePercent?: number;
}

export function hasAchievementCounts(counts: AchievementCounts): boolean {
  return (
    counts.softcoreUnlockCount !== undefined ||
    counts.hardcoreUnlockCount !== undefined ||
    counts.totalPlayers !== undefined
  );
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

export function getAchievementSpotlightCounts(
  achievementMetrics: readonly NormalizedMetric[],
  gameMetrics: readonly NormalizedMetric[],
): AchievementSpotlightCounts {
  const totalUnlockCount = parseMetricNumber(achievementMetrics, "unlocked-count", "Total Players");
  const hardcoreUnlockCount = parseMetricNumber(achievementMetrics, "hardcore-unlocked-count", "Hardcore Unlocks");
  const totalPlayers = parseMetricNumber(gameMetrics, "total-players", "Total Players");
  const softcoreUnlockCount =
    totalUnlockCount !== undefined && hardcoreUnlockCount !== undefined
      ? Math.max(0, totalUnlockCount - hardcoreUnlockCount)
      : undefined;
  const unlockRatePercent =
    totalUnlockCount !== undefined && totalPlayers !== undefined && totalPlayers > 0
      ? (totalUnlockCount / totalPlayers) * 100
      : undefined;

  return {
    ...(softcoreUnlockCount !== undefined ? { softcoreUnlockCount } : {}),
    ...(hardcoreUnlockCount !== undefined ? { hardcoreUnlockCount } : {}),
    ...(totalPlayers !== undefined ? { totalPlayers } : {}),
    ...(totalUnlockCount !== undefined ? { totalUnlockCount } : {}),
    ...(unlockRatePercent !== undefined ? { unlockRatePercent } : {}),
  };
}

export function formatAchievementUnlockRatePercent(percent: number | undefined): string {
  return percent !== undefined ? `${percent.toFixed(2)}% unlock rate` : "Unlock rate unavailable";
}

export function formatAchievementUnlockRateValue(percent: number | undefined): string {
  return percent !== undefined ? `${percent.toFixed(2)}%` : "-";
}

export function dedupeDistinctLabels(
  labels: readonly (string | undefined)[],
): readonly string[] {
  const dedupedLabels: string[] = [];
  const seen = new Set<string>();

  for (const label of labels) {
    const normalizedLabel = label?.trim();
    if (normalizedLabel === undefined || normalizedLabel.length === 0) {
      continue;
    }

    const normalizedKey = normalizedLabel.toLocaleLowerCase();
    if (seen.has(normalizedKey)) {
      continue;
    }

    seen.add(normalizedKey);
    dedupedLabels.push(normalizedLabel);
  }

  return dedupedLabels;
}

export function buildAchievementStatus(
  achievement: Pick<NormalizedAchievement, "isUnlocked" | "unlockedAt" | "unlockMode">,
): {
  readonly value: string;
  readonly secondary?: string;
} {
  if (!achievement.isUnlocked) {
    return { value: "Locked" };
  }

  const unlockMode =
    achievement.unlockMode === "hardcore"
      ? "Hardcore unlocked"
      : achievement.unlockMode === "softcore"
        ? "Softcore unlocked"
        : "Unlocked";

  const unlockedAt = achievement.unlockedAt;
  if (unlockedAt === undefined) {
    return { value: unlockMode };
  }

  return {
    value: unlockMode,
    secondary: `${unlockMode} ${formatTimestamp(unlockedAt)}`,
  };
}

export function formatAchievementUnlockModeLabel(
  achievement: Pick<NormalizedAchievement, "isUnlocked" | "unlockMode">,
): string {
  if (!achievement.isUnlocked) {
    return "Locked";
  }

  if (achievement.unlockMode === "hardcore") {
    return "Hardcore unlocked";
  }

  if (achievement.unlockMode === "softcore") {
    return "Softcore unlocked";
  }

  return "Unlocked";
}

export function formatModeProgressSummary(
  summary: { readonly unlockedCount: number; readonly totalCount?: number; readonly completionPercent?: number } | undefined,
  modeLabel: string,
): string {
  if (summary === undefined) {
    return `No ${modeLabel.toLowerCase()} progress available.`;
  }

  const parts = [`${summary.unlockedCount.toLocaleString()} unlocked`];

  if (summary.totalCount !== undefined) {
    parts.push(`${summary.totalCount.toLocaleString()} total`);
  }

  if (summary.completionPercent !== undefined) {
    parts.push(`${summary.completionPercent.toLocaleString()}% complete`);
  }

  return parts.join(" · ");
}

export function shouldHideSteamAchievementDetailStats(providerId: string | undefined): boolean {
  return providerId === "steam";
}

export function getAchievementDescriptionText(description: string | undefined): string {
  return description ?? "No description was returned for this achievement.";
}
