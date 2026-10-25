import type { NormalizedAchievement } from "@core/domain";
import type { SteamHuntersAchievement, SteamHuntersAchievementGroup } from "../../providers/steamhunters/types";
import type { FullScreenGameAchievementSectionState } from "./decky-full-screen-game-section-state";
import { matchesAchievementFilter, matchesAchievementModeFilter, matchesAchievementGroupFilter, matchesAchievementAvailabilityFilter, matchesRetroAchievementsAchievementTypeFilter } from "./decky-full-screen-achievement-filters";

export type AchievementTargetFilters = Pick<FullScreenGameAchievementSectionState, "achievementFilter" | "achievementModeFilter" | "achievementGroupFilter" | "achievementAvailabilityFilter" | "achievementTypeFilter" | "achievementMissableOnly">;
export const FULLSCREEN_ACHIEVEMENT_RENDER_STEP = 36;
export function getFullScreenAchievementRenderLimit(achievements: readonly NormalizedAchievement[], achievementId: string | undefined): number {
  const index = achievements.findIndex((achievement) => achievement.achievementId === achievementId);
  return Math.max(FULLSCREEN_ACHIEVEMENT_RENDER_STEP, Math.ceil((index + 1) / FULLSCREEN_ACHIEVEMENT_RENDER_STEP) * FULLSCREEN_ACHIEVEMENT_RENDER_STEP);
}

/** Reconcile only conflicting filters, then reveal enough rows for the exact target. */
export function planFullScreenAchievementJump({ achievementId, achievements, filters, steamHuntersAchievements, steamHuntersGroups }: {
  readonly achievementId: string;
  readonly achievements: readonly NormalizedAchievement[];
  readonly filters: AchievementTargetFilters;
  readonly steamHuntersAchievements?: Readonly<Record<string, SteamHuntersAchievement>>;
  readonly steamHuntersGroups?: Readonly<Record<string, SteamHuntersAchievementGroup>>;
}) {
  const target = achievements.find((achievement) => achievement.achievementId === achievementId);
  if (!target) return undefined;
  const next: AchievementTargetFilters = {
    achievementFilter: matchesAchievementFilter(target, filters.achievementFilter) ? filters.achievementFilter : "all",
    achievementModeFilter: matchesAchievementModeFilter(target, filters.achievementModeFilter) ? filters.achievementModeFilter : "all",
    achievementGroupFilter: matchesAchievementGroupFilter(target, filters.achievementGroupFilter, steamHuntersGroups) ? filters.achievementGroupFilter : "all",
    achievementAvailabilityFilter: matchesAchievementAvailabilityFilter(target, filters.achievementAvailabilityFilter, steamHuntersAchievements) ? filters.achievementAvailabilityFilter : "all",
    achievementTypeFilter: matchesRetroAchievementsAchievementTypeFilter(target, filters.achievementTypeFilter, filters.achievementMissableOnly) ? filters.achievementTypeFilter : "all",
    achievementMissableOnly: filters.achievementMissableOnly && target.classification === "missable",
  };
  const visible = achievements.filter((achievement) => matchesAchievementFilter(achievement, next.achievementFilter)
    && matchesAchievementModeFilter(achievement, next.achievementModeFilter)
    && matchesAchievementGroupFilter(achievement, next.achievementGroupFilter, steamHuntersGroups)
    && matchesAchievementAvailabilityFilter(achievement, next.achievementAvailabilityFilter, steamHuntersAchievements)
    && matchesRetroAchievementsAchievementTypeFilter(achievement, next.achievementTypeFilter, next.achievementMissableOnly));
  return { filters: next, renderLimit: getFullScreenAchievementRenderLimit(visible, achievementId), targetIndex: visible.indexOf(target) };
}
