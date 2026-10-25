import type { NormalizedAchievement } from "@core/domain";
import type { SteamHuntersAchievement, SteamHuntersAchievementGroup } from "../../providers/steamhunters/types";
import { getSteamHuntersAchievementGroupKind } from "../../providers/steamhunters/achievement-groups";
import { getMetricValue } from "./decky-achievement-detail-helpers";
import type { AchievementFilter, AchievementModeFilter, AchievementGroupFilter, AchievementAvailabilityFilter, RetroAchievementsAchievementTypeFilter } from "./decky-full-screen-achievement-browser";
const ACHIEVEMENT_GROUP_FILTER_PREFIX = "group:";
export function matchesAchievementFilter(
  achievement: NormalizedAchievement,
  filter: AchievementFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "unlocked") return achievement.isUnlocked;
  return !achievement.isUnlocked;
}

export function matchesAchievementModeFilter(
  achievement: NormalizedAchievement,
  modeFilter: AchievementModeFilter,
): boolean {
  if (modeFilter === "all" || !achievement.isUnlocked) return true;
  return modeFilter === "hardcore"
    ? achievement.unlockMode !== "softcore"
    : achievement.unlockMode !== "hardcore";
}

export function matchesAchievementGroupFilter(
  achievement: NormalizedAchievement,
  groupFilter: AchievementGroupFilter,
  achievementGroupsBySteamAchievementId: Readonly<Record<string, SteamHuntersAchievementGroup>> | undefined,
): boolean {
  if (groupFilter === "all") {
    return true;
  }

  const group = achievementGroupsBySteamAchievementId?.[achievement.achievementId];
  if (groupFilter.startsWith(ACHIEVEMENT_GROUP_FILTER_PREFIX)) {
    return getAchievementGroupFilterValue(group) === groupFilter;
  }
  if (group === undefined) {
    return false;
  }

  return getSteamHuntersAchievementGroupKind(group) === groupFilter;
}

function getAchievementGroupTitle(group: SteamHuntersAchievementGroup | undefined): string {
  if (group === undefined || getSteamHuntersAchievementGroupKind(group) === "base-game") {
    return "Base Game";
  }
  return group.dlcAppName ?? group.name ?? (getSteamHuntersAchievementGroupKind(group) === "update" ? "Update" : "DLC / Expansion");
}

export function getAchievementGroupFilterValue(group: SteamHuntersAchievementGroup | undefined): `${typeof ACHIEVEMENT_GROUP_FILTER_PREFIX}${string}` {
  if (group === undefined || getSteamHuntersAchievementGroupKind(group) === "base-game") {
    return `${ACHIEVEMENT_GROUP_FILTER_PREFIX}base-game:Base%20Game`;
  }
  const kind = getSteamHuntersAchievementGroupKind(group);
  const identity = `${kind}|${group.dlcAppId ?? ""}|${group.dlcAppName ?? ""}|${group.name ?? ""}`;
  return `${ACHIEVEMENT_GROUP_FILTER_PREFIX}${encodeURIComponent(identity)}:${encodeURIComponent(getAchievementGroupTitle(group))}`;
}

export function matchesAchievementAvailabilityFilter(
  achievement: NormalizedAchievement,
  availabilityFilter: AchievementAvailabilityFilter,
  steamHuntersAchievementsBySteamAchievementId: Readonly<Record<string, SteamHuntersAchievement>> | undefined,
): boolean {
  if (availabilityFilter === "all") {
    return true;
  }

  return steamHuntersAchievementsBySteamAchievementId?.[achievement.achievementId]?.obtainability === availabilityFilter;
}

export function matchesRetroAchievementsAchievementTypeFilter(
  achievement: NormalizedAchievement,
  typeFilter: RetroAchievementsAchievementTypeFilter,
  missableOnly: boolean,
): boolean {
  if (missableOnly) {
    return achievement.classification === "missable";
  }
  if (typeFilter === "all") {
    return true;
  }
  if (typeFilter === "regular") {
    const sourceType = getMetricValue(achievement.metrics, "type", "Type")?.trim();
    return achievement.classification === undefined && (sourceType === undefined || sourceType.length === 0);
  }
  return achievement.classification === typeFilter;
}

