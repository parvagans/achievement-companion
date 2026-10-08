import type {
  DashboardSnapshot,
  NormalizedMetric,
  ProgressSummary,
  RecentUnlock,
  RecentlyPlayedGame,
} from "@core/domain";
import type {
  RetroAchievementsAchievementMode,
  RetroAchievementsRankDisplay,
} from "@core/settings";

type RetroAchievementsProfile = DashboardSnapshot["profile"];

export interface RetroAchievementsRankValue {
  readonly kind: "site" | "casual";
  readonly label: "Site Rank" | "Casual Rank";
  readonly value: string;
}

const RETROACHIEVEMENTS_CASUAL_RANK_MINIMUM_POINTS = 250;

export interface RetroAchievementsOverviewMetric {
  readonly key: "hardcore-points" | "softcore-points" | "retro-points" | "ratio";
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
  readonly mode?: "hardcore" | "softcore";
}

function findMetric(metrics: readonly NormalizedMetric[], ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = metrics.find((metric) => metric.key === key || metric.label === key)?.value;
    if (value !== undefined && value.trim().length > 0) return value;
  }
  return undefined;
}

function formatNumeric(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : value;
}

function formatCount(value: number | undefined): string | undefined {
  return value !== undefined && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value)).toLocaleString()
    : undefined;
}

export function getRetroAchievementsProfileRanks(
  profile: RetroAchievementsProfile,
  preference: RetroAchievementsRankDisplay,
): readonly RetroAchievementsRankValue[] {
  const candidates: Readonly<Record<RetroAchievementsRankValue["kind"], {
    readonly label: RetroAchievementsRankValue["label"];
    readonly value: string | undefined;
  }>> = {
    site: { label: "Site Rank", value: findMetric(profile.metrics, "site-rank", "Rank") },
    casual: {
      label: "Casual Rank",
      value: findMetric(profile.metrics, "casual-rank", "softcore-rank", "Casual Rank", "Softcore Rank")
        ?? (() => {
          const casualPoints = Number(findMetric(profile.metrics, "softcore-points", "Softcore"));
          return Number.isFinite(casualPoints) && casualPoints < RETROACHIEVEMENTS_CASUAL_RANK_MINIMUM_POINTS
            ? `Requires ${RETROACHIEVEMENTS_CASUAL_RANK_MINIMUM_POINTS.toLocaleString()} points`
            : undefined;
        })(),
    },
  };

  const rank = candidates[preference];
  const value = formatNumeric(rank.value);
  return value === undefined || value === "0"
    ? []
    : [{ kind: preference, label: rank.label, value: /^Requires\s/u.test(value) ? value : `#${value}` }];
}

export function sortRetroAchievementsUnlocksNewestFirst(
  entries: readonly RecentUnlock[],
): readonly RecentUnlock[] {
  return entries.slice().sort(
    (left, right) => (right.unlockedAt ?? right.achievement.unlockedAt ?? 0)
      - (left.unlockedAt ?? left.achievement.unlockedAt ?? 0),
  );
}

export function getRetroAchievementsProfileOverviewMetrics(
  profile: RetroAchievementsProfile,
  preference: RetroAchievementsAchievementMode,
): readonly RetroAchievementsOverviewMetric[] {
  const metrics: RetroAchievementsOverviewMetric[] = [];
  const modes: readonly ("hardcore" | "softcore")[] = preference === "both"
    ? ["hardcore", "softcore"]
    : [preference];

  for (const mode of modes) {
    const points = mode === "hardcore"
      ? findMetric(profile.metrics, "total-points", "Points")
      : findMetric(profile.metrics, "softcore-points", "Softcore");
    const unlockedCount = mode === "hardcore"
      ? formatCount(profile.hardcoreUnlockedCount)
      : formatCount(profile.softcoreUnlockedCount);
    const value = formatNumeric(points);
    if (value === undefined) continue;
    metrics.push({
      key: mode === "hardcore" ? "hardcore-points" : "softcore-points",
      label: mode === "hardcore" ? "Hardcore Points" : "Softcore Points",
      value,
      ...(unlockedCount !== undefined ? { detail: `${unlockedCount} unlocked` } : {}),
      mode,
    });
  }

  const retroPoints = formatNumeric(findMetric(profile.metrics, "true-points", "True", "RetroPoints"));
  const ratio = findMetric(profile.metrics, "retro-ratio", "RetroRatio", "Ratio");
  if (retroPoints !== undefined) {
    metrics.push({ key: "retro-points", label: "RetroPoints", value: retroPoints });
  }
  if (ratio !== undefined) {
    metrics.push({ key: "ratio", label: "Ratio", value: ratio });
  }
  return metrics;
}

export function filterRetroAchievementsUnlocksByMode(
  entries: readonly RecentUnlock[],
  preference: RetroAchievementsAchievementMode,
): readonly RecentUnlock[] {
  if (preference === "both") return entries;
  return entries.filter((entry) => entry.achievement.unlockMode === preference);
}

export function getRetroAchievementsPlayedGameProgress(
  game: RecentlyPlayedGame,
  preference: RetroAchievementsAchievementMode,
): ProgressSummary | undefined {
  if (preference === "hardcore") return game.hardcoreSummary;
  if (preference === "softcore") return game.softcoreSummary;
  return game.summary;
}
