import type { SteamHuntersAchievementGroup } from "./types";

export type SteamHuntersAchievementGroupKind = "base-game" | "dlc" | "update";

/**
 * SteamHunters exposes DLC linkage directly. Remaining groups are either the
 * base game or a named achievement update.
 */
export function getSteamHuntersAchievementGroupKind(
  group: SteamHuntersAchievementGroup,
): SteamHuntersAchievementGroupKind {
  if (group.dlcAppId !== undefined || group.dlcAppName !== undefined) {
    return "dlc";
  }

  const normalizedName = group.name?.trim().toLowerCase();
  return normalizedName === undefined
    || normalizedName === "base"
    || normalizedName === "base game"
    || normalizedName === "base-game"
    ? "base-game"
    : "update";
}
