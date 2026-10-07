import type { GameDetailSnapshot, NormalizedAchievement, ProgressSummary } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { getRetroAchievementsCompletionIndicatorState } from "./decky-retroachievements-completion-indicator";

type Mode = "hardcore" | "softcore";

export function isRetroAchievementsUnlockedInMode(achievement: NormalizedAchievement, mode: Mode): boolean {
  return mode === "hardcore"
    ? achievement.hardcoreUnlockedAt !== undefined || (achievement.isUnlocked && achievement.unlockMode === "hardcore")
    : achievement.softcoreUnlockedAt !== undefined || (achievement.isUnlocked && achievement.unlockMode === "softcore");
}

export function getRetroAchievementsModeSummary(snapshot: GameDetailSnapshot, mode: Mode): ProgressSummary {
  const supplied = mode === "hardcore" ? snapshot.game.hardcoreSummary : snapshot.game.softcoreSummary;
  if (supplied !== undefined) return supplied;
  return {
    unlockedCount: snapshot.achievements.filter((achievement) => isRetroAchievementsUnlockedInMode(achievement, mode)).length,
    ...(snapshot.game.summary.totalCount !== undefined ? { totalCount: snapshot.game.summary.totalCount } : {}),
  };
}

export function buildRetroAchievementsCompactGamePresentation(
  snapshot: GameDetailSnapshot,
  preference: RetroAchievementsAchievementMode,
) {
  const modes: readonly Mode[] = preference === "both" ? ["hardcore", "softcore"] : [preference];
  const achievements = snapshot.achievements.filter((achievement) =>
    preference === "both" ? achievement.isUnlocked : isRetroAchievementsUnlockedInMode(achievement, preference));
  const points = achievements.reduce((sum, achievement) => sum + (achievement.points ?? 0), 0);
  const retroPoints = achievements.reduce((sum, achievement) => {
    const value = Number(achievement.metrics.find((metric) => metric.key === "true-ratio")?.value);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const status = getRetroAchievementsCompletionIndicatorState(snapshot.game);
  return {
    modes: modes.map((mode) => ({ mode, summary: getRetroAchievementsModeSummary(snapshot, mode) })),
    summary: preference === "both" ? snapshot.game.summary : getRetroAchievementsModeSummary(snapshot, preference),
    points: achievements.some((achievement) => achievement.points !== undefined) ? points : undefined,
    retroPoints: achievements.some((achievement) => achievement.metrics.some((metric) => metric.key === "true-ratio")) ? retroPoints : undefined,
    completionStatus: status !== undefined && (preference === "both" || status.endsWith(preference)) ? status : undefined,
  } as const;
}
