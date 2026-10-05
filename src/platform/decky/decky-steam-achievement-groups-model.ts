import type { NormalizedAchievement } from "@core/domain";
import {
  getSteamHuntersAchievementGroupKind,
  type SteamHuntersAchievementGroup,
  type SteamHuntersAchievementGroupKind,
} from "../../providers/steamhunters";

export interface DeckySteamAchievementGroupSection {
  readonly id: string;
  readonly kind: SteamHuntersAchievementGroupKind;
  readonly title: string;
  readonly bannerUrl?: string;
  readonly artworkAppId?: number;
  readonly achievements: readonly NormalizedAchievement[];
}

function getGroupId(group: SteamHuntersAchievementGroup, index: number): string {
  const identity = group.dlcAppId ?? group.dlcAppName ?? group.name ?? "base-game";
  return `${getSteamHuntersAchievementGroupKind(group)}:${identity}:${index}`;
}

function getGroupTitle(group: SteamHuntersAchievementGroup): string {
  const kind = getSteamHuntersAchievementGroupKind(group);
  if (kind === "dlc") {
    return group.dlcAppName ?? group.name ?? "DLC / Expansion";
  }
  return kind === "update" ? group.name ?? "Update" : "Base Game";
}

/**
 * Builds mutually-exclusive groups from SteamHunters' stable achievement API
 * identifiers. Achievements omitted by the optional group endpoint remain in
 * Base Game, so the tab never hides known Steam achievements.
 */
export function buildDeckySteamAchievementGroupSections({
  achievements,
  groups,
}: {
  readonly achievements: readonly NormalizedAchievement[];
  readonly groups: readonly SteamHuntersAchievementGroup[];
}): readonly DeckySteamAchievementGroupSection[] {
  const achievementsById = new Map(achievements.map((achievement) => [achievement.achievementId, achievement]));
  const groupByAchievementId = new Map<string, SteamHuntersAchievementGroup>();
  for (const group of groups) {
    for (const achievementId of group.achievementApiNames) {
      if (achievementsById.has(achievementId) && !groupByAchievementId.has(achievementId)) {
        groupByAchievementId.set(achievementId, group);
      }
    }
  }

  const baseGameAchievements = achievements.filter((achievement) => {
    const group = groupByAchievementId.get(achievement.achievementId);
    return group === undefined || getSteamHuntersAchievementGroupKind(group) === "base-game";
  });
  const baseGameGroup = groups.find((group) => getSteamHuntersAchievementGroupKind(group) === "base-game");
  const sections: DeckySteamAchievementGroupSection[] = baseGameAchievements.length === 0
    ? []
    : [{
      id: "base-game",
      kind: "base-game",
      title: "Base Game",
      ...(baseGameGroup?.bannerUrl !== undefined ? { bannerUrl: baseGameGroup.bannerUrl } : {}),
      achievements: baseGameAchievements,
    }];

  groups.forEach((group, index) => {
    const kind = getSteamHuntersAchievementGroupKind(group);
    if (kind === "base-game") {
      return;
    }
    const groupAchievements = group.achievementApiNames.flatMap((achievementId) => {
      const achievement = achievementsById.get(achievementId);
      return groupByAchievementId.get(achievementId) === group && achievement !== undefined ? [achievement] : [];
    });
    if (groupAchievements.length > 0) {
      sections.push({
        id: getGroupId(group, index),
        kind,
        title: getGroupTitle(group),
        ...(group.bannerUrl !== undefined ? { bannerUrl: group.bannerUrl } : {}),
        ...(group.dlcAppId !== undefined ? { artworkAppId: group.dlcAppId } : {}),
        achievements: groupAchievements,
      });
    }
  });

  return sections;
}

export function hasDeckySteamAchievementGroups(
  sections: readonly DeckySteamAchievementGroupSection[],
): boolean {
  return sections.some((section) => section.kind !== "base-game");
}

export function sortDeckySteamAchievementGroupAchievements(
  achievements: readonly NormalizedAchievement[],
): readonly NormalizedAchievement[] {
  return achievements
    .map((achievement, index) => ({ achievement, index }))
    .sort((left, right) => {
      if (left.achievement.isUnlocked !== right.achievement.isUnlocked) {
        return left.achievement.isUnlocked ? -1 : 1;
      }

      if (!left.achievement.isUnlocked) {
        return left.index - right.index;
      }

      const leftUnlockedAt = left.achievement.unlockedAt;
      const rightUnlockedAt = right.achievement.unlockedAt;
      if (leftUnlockedAt === undefined && rightUnlockedAt !== undefined) {
        return 1;
      }
      if (leftUnlockedAt !== undefined && rightUnlockedAt === undefined) {
        return -1;
      }
      if (leftUnlockedAt !== undefined && rightUnlockedAt !== undefined && leftUnlockedAt !== rightUnlockedAt) {
        return rightUnlockedAt - leftUnlockedAt;
      }

      return left.index - right.index;
    })
    .map(({ achievement }) => achievement);
}

