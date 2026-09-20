import { useState, type CSSProperties } from "react";
import { Focusable } from "@decky/ui";
import type { NormalizedAchievement } from "@core/domain";
import {
  getSteamHuntersAchievementGroupKind,
  type SteamHuntersAchievement,
  type SteamHuntersAchievementGroup,
  type SteamHuntersAchievementGroupKind,
} from "../../providers/steamhunters";
import { DeckyCompletionProgressBar } from "./decky-completion-progress-bar";
import { DeckyFullScreenAchievementRow } from "./decky-full-screen-achievement-row";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { getSteamFullscreenGameArtworkUrl } from "./decky-steam-game-artwork";
import updateArtworkUrl from "./assets/providers/steam/update.png";

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

function getGroupCardStyle(isFocused: boolean, isExpanded: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    gridTemplateRows: "auto auto",
    columnGap: 16,
    rowGap: 8,
    alignItems: "center",
    width: "100%",
    minWidth: 0,
    padding: "12px 16px",
    border: `1px solid ${isFocused ? "rgba(0, 169, 255, 0.92)" : "rgba(255, 255, 255, 0.1)"}`,
    borderRadius: 16,
    boxSizing: "border-box",
    background: isExpanded
      ? "linear-gradient(180deg, rgba(12, 61, 95, 0.68), rgba(8, 31, 48, 0.78))"
      : "linear-gradient(180deg, rgba(13, 38, 55, 0.84), rgba(7, 25, 37, 0.88))",
    boxShadow: isFocused
      ? "0 0 0 2px rgba(0, 169, 255, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 10px rgba(0, 0, 0, 0.16)",
  };
}

function getGroupTextStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 };
}

function getGroupTitleStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.98)", fontSize: "1.08em", fontWeight: 800, lineHeight: 1.15 };
}

function getGroupCountStyle(): CSSProperties {
  return { color: "rgba(91, 211, 255, 0.98)", fontSize: "0.95em", fontWeight: 800, lineHeight: 1.15 };
}

function getGroupPercentStyle(): CSSProperties {
  return { color: "rgba(226, 242, 255, 0.96)", fontSize: "1.2em", fontWeight: 800, lineHeight: 1 };
}

function getGroupArtworkFallbackStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 260,
    height: 112,
    flexShrink: 0,
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    background: "linear-gradient(145deg, rgba(92, 55, 130, 0.68), rgba(17, 47, 70, 0.86))",
    color: "rgba(236, 221, 255, 0.94)",
    fontSize: "0.8em",
    fontWeight: 800,
    letterSpacing: "0.08em",
  };
}

function getExpandedAchievementsStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 8, padding: "4px 8px 10px" };
}

function getGroupExpansionIconStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    alignSelf: "stretch",
    color: "rgba(226, 242, 255, 0.92)",
    gridColumn: "3",
    gridRow: "2",
  };
}

function DeckyGroupExpansionIcon({ isExpanded }: { readonly isExpanded: boolean }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height="24"
      viewBox="0 0 24 24"
      width="24"
    >
      <path
        d={isExpanded ? "M12 19V8m0 0-7 7m7-7 7 7" : "M12 5v11m0 0-7-7m7 7 7-7"}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function getCompletionPercent(achievements: readonly NormalizedAchievement[]): number {
  if (achievements.length === 0) {
    return 0;
  }
  return Math.round((achievements.filter((achievement) => achievement.isUnlocked).length / achievements.length) * 100);
}

export function DeckySteamAchievementGroupsSection({
  sections,
  gameArtworkUrl,
  steamHuntersAchievementsBySteamAchievementId,
  expandedGroupIds,
  onExpandedGroupIdsChange,
  onFocusGroup,
  onFocusAchievement,
  onOpenAchievementDetail,
  onBack,
}: {
  readonly sections: readonly DeckySteamAchievementGroupSection[];
  readonly gameArtworkUrl: string | undefined;
  readonly steamHuntersAchievementsBySteamAchievementId: Readonly<Record<string, SteamHuntersAchievement>>;
  readonly expandedGroupIds: readonly string[];
  readonly onExpandedGroupIdsChange: (groupIds: readonly string[]) => void;
  readonly onFocusGroup: (groupId: string) => void;
  readonly onFocusAchievement: (groupId: string, achievementId: string) => void;
  readonly onOpenAchievementDetail: (achievementId: string) => void;
  readonly onBack: () => void;
}): JSX.Element {
  const groupArtworkWidth = 260;
  const groupArtworkHeight = 112;
  const [focusedGroupId, setFocusedGroupId] = useState<string | undefined>(undefined);
  const toggleGroup = (groupId: string): void => {
    onExpandedGroupIdsChange(
      expandedGroupIds.includes(groupId)
        ? expandedGroupIds.filter((currentGroupId) => currentGroupId !== groupId)
        : [...expandedGroupIds, groupId],
    );
  };
  const handleGroupFocus = (groupId: string, target: HTMLElement): void => {
    setFocusedGroupId(groupId);
    onFocusGroup(groupId);
    scrollDeckyFocusTargetIntoView(target);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sections.map((section) => {
        const isExpanded = expandedGroupIds.includes(section.id);
        const unlockedCount = section.achievements.filter((achievement) => achievement.isUnlocked).length;
        const completionPercent = getCompletionPercent(section.achievements);
        const artworkUrl = section.bannerUrl
          ?? (section.artworkAppId !== undefined
            ? getSteamFullscreenGameArtworkUrl({ appid: section.artworkAppId })
            : undefined)
          ?? (section.kind === "base-game"
            ? gameArtworkUrl
            : section.kind === "update" ? updateArtworkUrl : undefined);
        return (
          <div key={section.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Focusable
              className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
              noFocusRing
              role="button"
              aria-expanded={isExpanded}
              aria-label={`${section.title}, ${unlockedCount} of ${section.achievements.length} achievements, ${completionPercent}% complete. ${isExpanded ? "Collapse" : "Expand"}.`}
              data-achievement-companion-steam-group-id={section.id}
              onActivate={() => toggleGroup(section.id)}
              onClick={() => toggleGroup(section.id)}
              onFocus={(event) => handleGroupFocus(section.id, event.currentTarget)}
              onGamepadFocus={(event) => {
                if (event.currentTarget !== null) {
                  // The control is rendered in Gaming Mode's owner document,
                  // so a cross-window `instanceof HTMLElement` check is unsafe.
                  handleGroupFocus(section.id, event.currentTarget as HTMLElement);
                }
              }}
              onBlur={() => setFocusedGroupId((current) => current === section.id ? undefined : current)}
              style={getGroupCardStyle(focusedGroupId === section.id, isExpanded)}
            >
              {artworkUrl !== undefined ? (
                <DeckyGameArtwork
                  compact
                  height={groupArtworkHeight}
                  size={groupArtworkHeight}
                  src={artworkUrl}
                  title={section.title}
                  width={groupArtworkWidth}
                />
              ) : (
                <span aria-hidden="true" style={getGroupArtworkFallbackStyle()}>
                  {section.kind === "dlc" ? "DLC" : "UPDATE"}
                </span>
              )}
              <span style={getGroupTextStyle()}>
                <span style={getGroupTitleStyle()}>{section.title}</span>
                <span style={getGroupCountStyle()}>{unlockedCount.toLocaleString()} / {section.achievements.length.toLocaleString()}</span>
                <DeckyCompletionProgressBar percent={completionPercent} showCaption={false} />
              </span>
              <span style={getGroupPercentStyle()}>{completionPercent}%</span>
              <span aria-hidden="true" style={getGroupExpansionIconStyle()}>
                <DeckyGroupExpansionIcon isExpanded={isExpanded} />
              </span>
            </Focusable>
            {isExpanded ? (
              <div style={getExpandedAchievementsStyle()}>
                {section.achievements.map((achievement) => (
                  <DeckyFullScreenAchievementRow
                    key={achievement.achievementId}
                    achievement={achievement}
                    onBack={onBack}
                    onFocusAchievement={(achievementId) => onFocusAchievement(section.id, achievementId)}
                    onOpenAchievementDetail={onOpenAchievementDetail}
                    steamHuntersAchievement={steamHuntersAchievementsBySteamAchievementId[achievement.achievementId]}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
