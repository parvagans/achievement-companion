import type { GameDetailSnapshot, NormalizedAchievement, NormalizedMetric } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { getSteamHuntersAchievementGroupKind } from "../../providers/steamhunters/achievement-groups";
import type { SteamHuntersGameData } from "../../providers/steamhunters/types";

export type RetroAchievementsGameGoal = "beat" | "master";

export interface GameOverviewSuggestion {
  readonly achievement: NormalizedAchievement;
  readonly rarityPercent?: number;
  readonly groupLabel?: string;
  readonly availabilityLabel?: string;
  readonly warning?: string;
}

export interface GameOverviewSuggestionOptions {
  /** Use the same achievement-mode projection as the full Achievements browser. */
  readonly snapshot: GameDetailSnapshot;
  readonly steamHunters?: SteamHuntersGameData;
  readonly hiddenAchievementIds?: readonly string[];
  readonly goal?: RetroAchievementsGameGoal;
  readonly achievementMode?: RetroAchievementsAchievementMode;
  readonly limit?: number;
}

function metricNumber(metrics: readonly NormalizedMetric[], key: string): number | undefined {
  const raw = metrics.find((metric) => metric.key === key)?.value;
  if (raw === undefined || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function percentage(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 100 ? value : undefined;
}

/** Awards are provider records, never inferred from a chosen goal or rounded percentage. */
export function isGameOverviewGoalComplete(
  snapshot: GameDetailSnapshot,
  goal: RetroAchievementsGameGoal = "master",
  achievementMode: RetroAchievementsAchievementMode = "both",
): boolean {
  if (snapshot.game.providerId !== "retroachievements") {
    const { totalCount, unlockedCount } = snapshot.game.summary;
    // Steam's player-achievement summary is authoritative for completion. The
    // normalized status and SteamHunters data can lag behind this snapshot, so
    // neither may turn an exact, non-empty 100% set back into "In Progress".
    return totalCount !== undefined
      && Number.isInteger(totalCount)
      && Number.isInteger(unlockedCount)
      && totalCount > 0
      && unlockedCount === totalCount;
  }
  const award = snapshot.game.metrics.find((metric) => metric.key === "highest-award-kind")?.value.trim().toLowerCase();
  if (!award) return false;
  const mastered = award.includes("mastered") || award.includes("completed");
  const beaten = award.includes("beaten");
  if (!mastered && !beaten) return false;
  // Match the existing RA award interpretation, including legacy unqualified values.
  const awardMode = award.includes("softcore") ? "softcore"
    : award.includes("hardcore") || award.includes("mastered") ? "hardcore" : "softcore";
  if (achievementMode !== "both" && achievementMode !== awardMode) return false;
  return mastered || goal === "beat";
}

/**
 * Conservative source-order recommendations. Source order is a sequencing hint,
 * never evidence of prerequisites or difficulty; browsing order is unaffected.
 */
export function selectGameOverviewSuggestions({
  snapshot, steamHunters, hiddenAchievementIds = [], goal = "master", achievementMode = "both", limit = 3,
}: GameOverviewSuggestionOptions): readonly GameOverviewSuggestion[] {
  if (isGameOverviewGoalComplete(snapshot, goal, achievementMode)) return [];
  const hidden = new Set(hiddenAchievementIds);
  const seen = new Set<string>();
  const isRetro = snapshot.game.providerId === "retroachievements";
  const steamById = new Map(steamHunters?.achievements.map((achievement) => [achievement.apiName, achievement]));
  const groups = new Map(steamHunters?.groups.flatMap((group) => group.achievementApiNames.map((id) => [id, group] as const)));
  const totalPlayers = metricNumber(snapshot.game.metrics, "total-players");
  const candidates = snapshot.achievements.flatMap((achievement, sourceIndex) => {
    if (achievement.isUnlocked || hidden.has(achievement.achievementId) || seen.has(achievement.achievementId)) return [];
    seen.add(achievement.achievementId);
    const steam = !isRetro ? steamById.get(achievement.achievementId) : undefined;
    if (steam?.obtainability === "unobtainable") return [];
    const group = !isRetro ? groups.get(achievement.achievementId) : undefined;
    const groupKind = group !== undefined ? getSteamHuntersAchievementGroupKind(group) : undefined;
    const unlockedCount = metricNumber(achievement.metrics, "unlocked-count");
    const rarityPercent = isRetro
      ? percentage(totalPlayers !== undefined && totalPlayers > 0 && unlockedCount !== undefined
        ? unlockedCount / totalPlayers * 100 : undefined)
      : percentage(steam?.steamPercentage) ?? percentage(metricNumber(achievement.metrics, "global-percent"));
    const groupLabel = group === undefined ? undefined : group.dlcAppName ?? group.name
      ?? (groupKind === "dlc" ? "DLC / Expansion" : "Base Game");
    const availabilityLabel = steam?.obtainability === "conditionally-obtainable" ? "Conditional"
      : steam?.obtainability === "broken-but-obtainable" ? "Broken but obtainable" : undefined;
    const suggestion: GameOverviewSuggestion = {
      achievement,
      ...(rarityPercent !== undefined ? { rarityPercent } : {}),
      ...(groupLabel !== undefined ? { groupLabel } : {}),
      ...(availabilityLabel !== undefined ? { availabilityLabel } : {}),
      ...(isRetro && achievement.classification === "missable" ? { warning: "Missable — check your current save" } : {}),
    };
    return [{
      suggestion,
      // Prefer the base set before add-ons without assuming that DLC is unowned.
      priority: isRetro
        ? goal === "beat" && achievement.classification !== "progression" && achievement.classification !== "win-condition" ? 1 : 0
        : groupKind === "dlc" ? 2 : groupKind === "update" ? 1 : 0,
      order: isRetro ? metricNumber(achievement.metrics, "display-order") ?? sourceIndex : sourceIndex,
      sourceIndex,
    }];
  });
  const count = Number.isFinite(limit) ? Math.max(0, Math.min(3, Math.trunc(limit))) : 3;
  return candidates.sort((a, b) => a.priority - b.priority || a.order - b.order || a.sourceIndex - b.sourceIndex)
    .slice(0, count).map(({ suggestion }) => suggestion);
}
