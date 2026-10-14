import type { GamePageAchievementSummary } from "./decky-game-page-achievement-summary";

export type DeckyGamePageAchievementBadgeVariant =
  | "perfected"
  | "beaten"
  | "mastered"
  | "in-progress"
  | "loading";

export type DeckyGamePageAchievementBadgeProvider = "steam" | "retroachievements";

export interface DeckyGamePageAchievementBadgePresentation {
  readonly ariaLabel: string;
  readonly provider: DeckyGamePageAchievementBadgeProvider;
  readonly variant: DeckyGamePageAchievementBadgeVariant;
  readonly statusLabel: "PERFECTED" | "BEATEN" | "MASTERED" | "IN PROGRESS" | "PLEASE WAIT...";
  readonly countLabel: string;
  readonly progress: number;
}

function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function resolveDeckyGamePageAchievementBadgePresentation(
  summary: GamePageAchievementSummary | undefined,
): DeckyGamePageAchievementBadgePresentation | undefined {
  if (summary === undefined || summary.status === "loading") {
    return {
      ariaLabel: "Achievement Companion, please wait",
      provider: summary?.provider ?? "steam",
      variant: "loading",
      statusLabel: "PLEASE WAIT...",
      countLabel: "-- / --",
      progress: 0.18,
    };
  }

  if (summary.status !== "ready") {
    return undefined;
  }

  if (summary.provider === "retroachievements" && summary.completionStatus === undefined) {
    return {
      ariaLabel: "Achievement Companion, please wait",
      provider: "retroachievements",
      variant: "loading",
      statusLabel: "PLEASE WAIT...",
      countLabel: "-- / --",
      progress: 0.18,
    };
  }

  const provider = summary.provider;
  const progress = summary.total > 0 ? clampProgress(summary.earned / summary.total) : 0;
  const countLabel = `${String(summary.earned)} / ${String(summary.total)}`;

  if (provider === "steam" && summary.total > 0 && summary.earned >= summary.total) {
    return {
      ariaLabel: `Open Achievement Companion details for app ${summary.appId}, perfected, ${countLabel}`,
      provider,
      variant: "perfected",
      statusLabel: "PERFECTED",
      countLabel,
      progress: 1,
    };
  }

  if (provider === "retroachievements" && summary.completionStatus === "mastered") {
    return {
      ariaLabel: `Open Achievement Companion details for app ${summary.appId}, mastered, ${countLabel}`,
      provider,
      variant: "mastered",
      statusLabel: "MASTERED",
      countLabel,
      progress: 1,
    };
  }

  if (provider === "retroachievements" && summary.completionStatus === "beaten") {
    return {
      ariaLabel: `Open Achievement Companion details for app ${summary.appId}, beaten, ${countLabel}`,
      provider,
      variant: "beaten",
      statusLabel: "BEATEN",
      countLabel,
      progress,
    };
  }

  return {
    ariaLabel: `Open Achievement Companion details for app ${summary.appId}, in progress, ${countLabel}`,
    provider,
    variant: "in-progress",
    statusLabel: "IN PROGRESS",
    countLabel,
    progress,
  };
}
