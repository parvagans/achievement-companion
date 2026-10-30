import type { GameDetailSnapshot, NormalizedAchievement, NormalizedMetric } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { getSteamHuntersAchievementGroupKind } from "../../providers/steamhunters/achievement-groups";
import type { SteamHuntersGameData } from "../../providers/steamhunters/types";
import type { PinnedAchievement } from "./decky-game-overview-preferences";
import { projectRetroAchievementsFullScreenAchievements } from "./decky-retroachievements-full-screen-achievement-data";

export type RetroAchievementsGameGoal = "beat" | "master";

export interface GameOverviewSuggestion {
  readonly pinned?: boolean;
  readonly achievement: NormalizedAchievement;
  readonly rarityPercent?: number;
  readonly groupLabel?: string;
  readonly availabilityLabel?: string;
  readonly warning?: string;
}

export interface GameOverviewSuggestionOptions {
  readonly pinnedAchievement?: PinnedAchievement | undefined;
  /** Use the same achievement-mode projection as the full Achievements browser. */
  readonly snapshot: GameDetailSnapshot;
  readonly steamHunters?: SteamHuntersGameData;
  readonly hiddenAchievementIds?: readonly string[];
  readonly goal?: RetroAchievementsGameGoal;
  readonly achievementMode?: RetroAchievementsAchievementMode;
  readonly limit?: number;
}

/** Positive canonical row evidence only; missing rows and optional metrics prove nothing. */
export function isPinnedAchievementComplete(snapshot: GameDetailSnapshot, pin: PinnedAchievement): boolean {
  const row = snapshot.achievements.find((achievement) => achievement.achievementId === pin.achievementId
    && achievement.providerId === snapshot.game.providerId && achievement.gameId === snapshot.game.gameId);
  if (row === undefined) return false;
  return isAchievementCompleteForPin(row, pin.completionMode);
}

/** Hardcore requires its own unlock; a lower-restriction target also accepts Hardcore. */
export function isAchievementCompleteForPin(row: NormalizedAchievement, mode: RetroAchievementsAchievementMode): boolean {
  if (row.providerId !== "retroachievements") return row.isUnlocked;
  return mode === "hardcore"
    ? row.hardcoreUnlockedAt !== undefined || row.isUnlocked && row.unlockMode === "hardcore"
    : row.isUnlocked || row.hardcoreUnlockedAt !== undefined || row.softcoreUnlockedAt !== undefined;
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
  snapshot: sourceSnapshot, steamHunters, hiddenAchievementIds = [], goal = "master", achievementMode = "both", limit = 3, pinnedAchievement,
}: GameOverviewSuggestionOptions): readonly GameOverviewSuggestion[] {
  const achievements = projectRetroAchievementsFullScreenAchievements(sourceSnapshot, achievementMode);
  const snapshot = achievements === sourceSnapshot.achievements ? sourceSnapshot : { ...sourceSnapshot, achievements };
  const hidden = new Set(hiddenAchievementIds);
  const seen = new Set<string>();
  const isRetro = snapshot.game.providerId === "retroachievements";
  const steamById = new Map(steamHunters?.achievements.map((achievement) => [achievement.apiName, achievement]));
  const groups = new Map(steamHunters?.groups.flatMap((group) => group.achievementApiNames.map((id) => [id, group] as const)));
  const totalPlayers = metricNumber(snapshot.game.metrics, "total-players");
  const describe = (achievement: NormalizedAchievement): GameOverviewSuggestion => {
    const steam = !isRetro ? steamById.get(achievement.achievementId) : undefined;
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
      : steam?.obtainability === "broken-but-obtainable" ? "Broken but obtainable"
      : steam?.obtainability === "unobtainable" ? "Unobtainable" : undefined;
    return {
      achievement,
      ...(rarityPercent !== undefined ? { rarityPercent } : {}),
      ...(groupLabel !== undefined ? { groupLabel } : {}),
      ...(availabilityLabel !== undefined ? { availabilityLabel } : {}),
      ...(isRetro && achievement.classification === "missable" ? { warning: "Missable — check your current save" } : {}),
    };
  };
  const pinnedRow = pinnedAchievement === undefined || isPinnedAchievementComplete(sourceSnapshot, pinnedAchievement) ? undefined
    : sourceSnapshot.achievements.find((achievement) => achievement.achievementId === pinnedAchievement.achievementId
      && achievement.providerId === snapshot.game.providerId && achievement.gameId === snapshot.game.gameId);
  const pinned: readonly GameOverviewSuggestion[] = pinnedRow === undefined ? [] : [{ ...describe(pinnedRow), pinned: true }];
  const count = Number.isFinite(limit) ? Math.max(0, Math.min(3, Math.trunc(limit))) : 3;
  if (isGameOverviewGoalComplete(snapshot, goal, achievementMode)) return pinned.slice(0, count);
  const candidates = snapshot.achievements.flatMap((achievement, sourceIndex) => {
    if (achievement.isUnlocked || achievement.achievementId === pinnedRow?.achievementId || hidden.has(achievement.achievementId) || seen.has(achievement.achievementId)) return [];
    seen.add(achievement.achievementId);
    const steam = !isRetro ? steamById.get(achievement.achievementId) : undefined;
    if (steam?.obtainability === "unobtainable") return [];
    const group = !isRetro ? groups.get(achievement.achievementId) : undefined;
    const groupKind = group !== undefined ? getSteamHuntersAchievementGroupKind(group) : undefined;
    return [{
      suggestion: describe(achievement),
      // Prefer the base set before add-ons without assuming that DLC is unowned.
      priority: isRetro
        ? goal === "beat" && achievement.classification !== "progression" && achievement.classification !== "win-condition" ? 1 : 0
        : groupKind === "dlc" ? 2 : groupKind === "update" ? 1 : 0,
      order: isRetro ? metricNumber(achievement.metrics, "display-order") ?? sourceIndex : sourceIndex,
      sourceIndex,
    }];
  });
  return [...pinned, ...candidates.sort((a, b) => a.priority - b.priority || a.order - b.order || a.sourceIndex - b.sourceIndex)
    .map(({ suggestion }) => suggestion)].slice(0, count);
}
