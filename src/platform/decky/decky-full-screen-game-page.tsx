import { useMemo, useState, type CSSProperties, type ComponentProps, type FocusEventHandler } from "react";
import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { Field, Focusable, PanelSection, PanelSectionRow, ScrollPanel } from "@decky/ui";
import { PlaceholderState } from "@ui/PlaceholderState";
import {
  initialDeckyGameDetailState,
  loadDeckyGameDetailState,
} from "./decky-app-services";
import { DeckyCompletionProgressBar, getCompletionPercent } from "./decky-completion-progress-bar";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import {
  DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS,
} from "./decky-focus-styles";
import {
  buildAchievementStatus,
  dedupeDistinctLabels,
  formatModeProgressSummary,
  shouldRenderAchievementModeFilter,
} from "./decky-achievement-detail-helpers";
import { sortAchievementsForDisplay } from "./decky-game-detail-ordering";
import { TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { formatDeckyProviderLabel } from "./providers";

const ACHIEVEMENT_FILTERS = ["all", "unlocked", "locked"] as const;
const ACHIEVEMENT_MODE_FILTERS = ["all", "hardcore", "softcore"] as const;

type AchievementFilter = (typeof ACHIEVEMENT_FILTERS)[number];
type AchievementModeFilter = (typeof ACHIEVEMENT_MODE_FILTERS)[number];

export interface DeckyFullScreenGamePageProps {
  readonly providerId: string | undefined;
  readonly gameId: string | undefined;
  readonly onOpenAchievementDetail: ((achievementId: string) => void) | undefined;
  readonly onBack: () => void;
  readonly backLabel?: string;
  readonly backDescription?: string;
  readonly backFooter?: string;
}

function formatTimestamp(epochMs: number | undefined): string {
  if (epochMs === undefined) {
    return "Unknown";
  }

  return new Date(epochMs).toLocaleString();
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function getMetricValue(
  metrics: readonly { readonly key: string; readonly label: string; readonly value: string }[],
  key: string,
): string | undefined {
  return metrics.find((metric) => metric.key === key)?.value;
}

function formatAchievementDescription(achievement: NormalizedAchievement): string {
  const parts = [buildAchievementStatus(achievement).value];

  if (achievement.points !== undefined) {
    parts.push(`${formatCount(achievement.points)} points`);
  }

  const unlockedAt = achievement.unlockedAt;
  if (unlockedAt !== undefined) {
    parts.push(`Date ${formatTimestamp(unlockedAt)}`);
  }

  return parts.join(", ");
}

function formatAchievementFilterLabel(filter: AchievementFilter): string {
  if (filter === "all") {
    return "All";
  }

  if (filter === "unlocked") {
    return "Unlocked";
  }

  return "Locked";
}

function formatAchievementModeLabel(modeFilter: AchievementModeFilter): string {
  if (modeFilter === "all") {
    return "All";
  }

  return modeFilter === "hardcore" ? "Hardcore" : "Softcore";
}

function matchesAchievementFilter(
  achievement: NormalizedAchievement,
  filter: AchievementFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "unlocked") {
    return achievement.isUnlocked;
  }

  return !achievement.isUnlocked;
}

function matchesAchievementModeFilter(
  achievement: NormalizedAchievement,
  modeFilter: AchievementModeFilter,
): boolean {
  if (modeFilter === "all") {
    return true;
  }

  if (!achievement.isUnlocked) {
    return true;
  }

  if (modeFilter === "hardcore") {
    return achievement.unlockMode !== "softcore";
  }

  return achievement.unlockMode !== "hardcore";
}

function getAchievementModePoints(
  achievements: readonly NormalizedAchievement[],
  modeFilter: Exclude<AchievementModeFilter, "all">,
): number | undefined {
  let points = 0;
  let hasPoints = false;

  for (const achievement of achievements) {
    if (!achievement.isUnlocked || achievement.unlockMode !== modeFilter) {
      continue;
    }

    if (achievement.points !== undefined) {
      points += achievement.points;
      hasPoints = true;
    }
  }

  return hasPoints ? points : undefined;
}

function formatAchievementVisibilitySummary(
  visibleCount: number,
  totalCount: number,
  filter: AchievementFilter,
): string {
  const suffix = filter === "all" ? "achievements" : formatAchievementFilterLabel(filter).toLowerCase();
  return `Showing ${formatCount(visibleCount)} of ${formatCount(totalCount)} ${suffix}`;
}

interface GameMetadataPill {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

function buildGameMetadataPills(
  metrics: readonly { readonly key: string; readonly label: string; readonly value: string }[],
): readonly GameMetadataPill[] {
  const totalPlayers = getMetricValue(metrics, "total-players");
  const released = getMetricValue(metrics, "released");
  const points = getMetricValue(metrics, "points");
  const retroPoints = getMetricValue(metrics, "retro-points");

  return [
    ...(totalPlayers !== undefined
      ? [
          {
            key: "total-players",
            label: "Total players",
            value: totalPlayers,
          },
        ]
      : []),
    ...(released !== undefined
      ? [
          {
            key: "released",
            label: "Release date",
            value: released,
          },
        ]
      : []),
    ...(points !== undefined
      ? [
          {
            key: "points",
            label: "Points",
            value: points,
          },
        ]
      : []),
    ...(retroPoints !== undefined
      ? [
          {
            key: "retro-points",
            label: "RetroPoints",
            value: retroPoints,
          },
        ]
      : []),
  ];
}

function formatAchievementFilterEmptyMessage(filter: AchievementFilter): string {
  if (filter === "all") {
    return "No achievement entries were returned for this game.";
  }

  return `No ${formatAchievementFilterLabel(filter).toLowerCase()} achievements match this filter.`;
}

function formatAchievementStatusSummary(
  achievements: readonly NormalizedAchievement[],
): string {
  const unlockedCount = achievements.filter((achievement) => achievement.isUnlocked).length;
  const lockedCount = achievements.length - unlockedCount;

  return `Total ${formatCount(achievements.length)} · Unlocked ${formatCount(unlockedCount)} · Locked ${formatCount(lockedCount)}`;
}

type FullScreenGamepadFocusHandler = NonNullable<ComponentProps<typeof Field>["onGamepadFocus"]>;

const scrollFocusedGamepadElementIntoView: FullScreenGamepadFocusHandler = (event) => {
  const target = event.currentTarget;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  target.scrollIntoView({
    block: "nearest",
    inline: "nearest",
  });
};

const scrollFocusedElementIntoView: FocusEventHandler<HTMLElement> = (event) => {
  event.currentTarget.scrollIntoView({
    block: "nearest",
    inline: "nearest",
  });
};

function getGameSpotlightLayoutStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 12,
    width: "100%",
    alignItems: "stretch",
  };
}

function getFullScreenPageFrameStyle(): CSSProperties {
  return {
    padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px calc(env(safe-area-inset-bottom, 0px) + 12px)",
    boxSizing: "border-box",
  };
}

function getGameSpotlightHeroStyle(): CSSProperties {
  return {
    display: "flex",
    justifyContent: "center",
    paddingTop: 4,
    width: "100%",
  };
}

function getGameSpotlightStatsStyle(): CSSProperties {
  return {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };
}

function getGameDetailSectionCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.02))",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 2px 10px rgba(0, 0, 0, 0.18)",
  };
}

function getGameDetailSectionHeaderStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: "0.8em",
    fontWeight: 800,
    letterSpacing: "0.12em",
    lineHeight: 1.1,
    textAlign: "center",
    textTransform: "uppercase",
  };
}

function getGameDetailSystemPillStyle(): CSSProperties {
  return {
    alignSelf: "center",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "rgba(255, 255, 255, 0.05)",
    color: "rgba(255, 255, 255, 0.74)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };
}

function getGameDetailOverviewLayoutStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    alignItems: "center",
    minWidth: 0,
  };
}

function getGameDetailOverviewTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
    width: "100%",
    alignItems: "center",
  };
}

function getGameDetailOverviewTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.95)",
    fontSize: "1.18em",
    fontWeight: 800,
    lineHeight: 1.15,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    textAlign: "center",
    whiteSpace: "normal",
  };
}

function getGameDetailMetaRowStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    width: "100%",
    alignItems: "stretch",
  };
}

function getGameDetailMetaPillStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    minHeight: 28,
    width: "100%",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: "0.74em",
    fontWeight: 700,
    lineHeight: 1.15,
    textAlign: "center",
    whiteSpace: "nowrap",
  };
}

function getGameDetailSupportStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.84em",
    lineHeight: 1.3,
    textAlign: "center",
  };
}

function getGameOverviewPillRowStyle(): CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  };
}

function getGameOverviewInfoPillStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: "0.82em",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  };
}

function getAchievementBrowserStackStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };
}

function getGameSpotlightTitleBlockStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  };
}

function getGameSpotlightKickerStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getGameSpotlightTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1.45em",
    fontWeight: 800,
    lineHeight: 1.08,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getGameSpotlightMetaRowStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    alignItems: "stretch",
    width: "100%",
  };
}

function getGameSpotlightMetaPillStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    width: "100%",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    color: "rgba(255, 255, 255, 0.82)",
    boxSizing: "border-box",
    fontSize: "0.76em",
    fontWeight: 700,
    lineHeight: 1.2,
    textAlign: "center",
    whiteSpace: "nowrap",
  };
}

function getGameSpotlightSupportStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.84em",
    lineHeight: 1.3,
  };
}

function getProgressCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  };
}

function getProgressCardTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "0.72em",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getProgressStatGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 8,
  };
}

function getProgressStatStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    padding: "10px 11px",
    borderRadius: 12,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    minWidth: 0,
    textAlign: "center",
  };
}

function getProgressStatLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "0.72em",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getProgressStatValueStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "0.98em",
    fontWeight: 700,
    lineHeight: 1.15,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "center",
  };
}

function ProgressStat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div style={getProgressStatStyle()}>
      <div style={getProgressStatLabelStyle()}>{label}</div>
    <div style={getProgressStatValueStyle()}>{value}</div>
  </div>
  );
}

function getModeProgressGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 10,
    alignItems: "stretch",
    minWidth: 0,
    width: "100%",
  };
}

function getModeProgressCardStyle(mode: Exclude<AchievementModeFilter, "all">): CSSProperties {
  const isHardcore = mode === "hardcore";

  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: 16,
    border: `1px solid ${isHardcore ? "rgba(214, 178, 74, 0.28)" : "rgba(214, 221, 232, 0.2)"}`,
    borderLeftWidth: 4,
    borderLeftStyle: "solid",
    borderLeftColor: isHardcore ? "rgba(214, 178, 74, 0.8)" : "rgba(214, 221, 232, 0.72)",
    background: isHardcore
      ? "linear-gradient(180deg, rgba(214, 178, 74, 0.08), rgba(214, 178, 74, 0.03))"
      : "linear-gradient(180deg, rgba(214, 221, 232, 0.07), rgba(214, 221, 232, 0.03))",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 8px rgba(0, 0, 0, 0.14)",
  };
}

function getModeProgressCardTitleStyle(mode: Exclude<AchievementModeFilter, "all">): CSSProperties {
  const isHardcore = mode === "hardcore";

  return {
    color: isHardcore ? "rgba(232, 201, 102, 0.95)" : "rgba(220, 225, 233, 0.95)",
    fontSize: "0.78em",
    fontWeight: 800,
    letterSpacing: "0.05em",
    lineHeight: 1.15,
    textTransform: "uppercase",
  };
}

function getModeProgressCardLineStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.86)",
    fontSize: "0.84em",
    lineHeight: 1.2,
  };
}

function getModeProgressCardPointsStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.8em",
    lineHeight: 1.2,
  };
}

function getAchievementBrowserCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.026))",
  };
}

function getAchievementBrowserHeaderStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getAchievementBrowserSectionLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getAchievementBrowserMetaStackStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };
}

function getAchievementFilterGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    width: "100%",
  };
}

function getAchievementFilterButtonStyle(
  selected: boolean,
  focused: boolean,
  disabled: boolean,
): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minWidth: 0,
    minHeight: 36,
    padding: "8px 10px",
    borderRadius: 16,
    boxSizing: "border-box",
    border: `1px solid ${
      focused
        ? "rgba(96, 165, 250, 0.82)"
        : selected
          ? "rgba(125, 190, 255, 0.72)"
          : "rgba(255, 255, 255, 0.08)"
    }`,
    background: focused
      ? selected
        ? "linear-gradient(180deg, rgba(96, 165, 250, 0.24), rgba(96, 165, 250, 0.12))"
        : "linear-gradient(180deg, rgba(96, 165, 250, 0.2), rgba(96, 165, 250, 0.1))"
      : selected
        ? "linear-gradient(180deg, rgba(125, 190, 255, 0.18), rgba(255, 255, 255, 0.055))"
        : "linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.02))",
    color: selected ? "rgba(255, 255, 255, 0.98)" : "rgba(255, 255, 255, 0.84)",
    fontSize: "0.84em",
    fontWeight: selected ? 700 : 600,
    lineHeight: 1.1,
    textAlign: "center",
    whiteSpace: "nowrap",
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? "default" : "pointer",
    outline: focused ? "2px solid rgba(96, 165, 250, 0.95)" : "none",
    outlineOffset: 1,
    boxShadow: focused
      ? selected
        ? "0 0 0 1px rgba(96, 165, 250, 0.82), inset 0 1px 0 rgba(255, 255, 255, 0.16), inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 4px 16px rgba(0, 0, 0, 0.26)"
        : "0 0 0 1px rgba(96, 165, 250, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 4px 14px rgba(0, 0, 0, 0.24)"
      : selected
        ? "inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 2px 10px rgba(0, 0, 0, 0.18)"
        : "none",
  };
}

function getAchievementFilterButtonLabelStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

interface AchievementFilterButtonProps {
  readonly label: string;
  readonly selected: boolean;
  readonly disabled?: boolean;
  readonly onActivate: () => void;
  readonly onCancel: () => void;
}

function AchievementFilterButton({
  label,
  selected,
  disabled = false,
  onActivate,
  onCancel,
}: AchievementFilterButtonProps): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Focusable
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      noFocusRing
      role="button"
      aria-label={label}
      aria-pressed={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      onActivate={disabled ? () => undefined : onActivate}
      onClick={disabled ? () => undefined : onActivate}
      onFocus={(event) => {
        setIsFocused(true);
        scrollFocusedElementIntoView(event);
      }}
      onGamepadFocus={(event) => {
        setIsFocused(true);
        scrollFocusedGamepadElementIntoView(event);
      }}
      onBlur={() => {
        setIsFocused(false);
      }}
      onCancel={onCancel}
      style={getAchievementFilterButtonStyle(selected, isFocused, disabled)}
      data-achievement-filter-selected={selected ? "true" : "false"}
      data-achievement-filter-disabled={disabled ? "true" : "false"}
    >
      <span style={getAchievementFilterButtonLabelStyle()}>{label}</span>
    </Focusable>
  );
}

function getAchievementBrowserSummaryStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: "0.94em",
    lineHeight: 1.35,
  };
}

function getAchievementBrowserMetaStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.86em",
    lineHeight: 1.25,
  };
}

function getAchievementBrowserContinuationStyle(hasBothActions: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: hasBothActions ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
    gap: 10,
    paddingTop: 2,
  };
}

function getAchievementBadgeFrameStyle(isUnlocked: boolean): CSSProperties {
  return {
    display: "inline-flex",
    flexShrink: 0,
    lineHeight: 0,
    opacity: isUnlocked ? 1 : 0.94,
    filter: isUnlocked ? "none" : "grayscale(1) contrast(1.12) brightness(0.92)",
  };
}

function getAchievementCardStyle(achievement: NormalizedAchievement): CSSProperties {
  const isHardcore = achievement.isUnlocked && achievement.unlockMode === "hardcore";
  const isSoftcore = achievement.isUnlocked && achievement.unlockMode === "softcore";
  const accentColor = isHardcore
    ? "rgba(214, 178, 74, 0.78)"
    : isSoftcore
      ? "rgba(214, 221, 232, 0.72)"
      : "rgba(255, 255, 255, 0.12)";
  const accentBackground = isHardcore
    ? "linear-gradient(180deg, rgba(214, 178, 74, 0.08), rgba(214, 178, 74, 0.03))"
    : isSoftcore
      ? "linear-gradient(180deg, rgba(214, 221, 232, 0.07), rgba(214, 221, 232, 0.03))"
      : "rgba(255, 255, 255, 0.03)";

  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 12,
    minWidth: 0,
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: 16,
    border: `1px solid ${accentColor}`,
    borderLeftWidth: 4,
    borderLeftStyle: "solid",
    borderLeftColor: accentColor,
    background: accentBackground,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 8px rgba(0, 0, 0, 0.15)",
  };
}

function getAchievementRowTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  };
}

function getAchievementRowTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.96)",
    fontSize: "0.95em",
    fontWeight: 800,
    lineHeight: 1.2,
  };
}

function getAchievementRowMetadataStackStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    minWidth: 0,
  };
}

function getAchievementRowStatusStyle(achievement: NormalizedAchievement): CSSProperties {
  const isHardcore = achievement.isUnlocked && achievement.unlockMode === "hardcore";
  const isSoftcore = achievement.isUnlocked && achievement.unlockMode === "softcore";

  return {
    color: isHardcore
      ? "rgba(232, 201, 102, 0.95)"
      : isSoftcore
        ? "rgba(220, 225, 233, 0.95)"
        : "rgba(255, 255, 255, 0.7)",
    fontSize: "0.8em",
    fontWeight: 800,
    lineHeight: 1.2,
  };
}

function getAchievementRowDetailStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.8em",
    lineHeight: 1.2,
  };
}

function getAchievementRowIconStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: 2,
  };
}

function getAchievementRowsLayoutStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };
}

function AchievementModeButtons({
  currentModeFilter,
  onSelect,
  onCancel,
}: {
  readonly currentModeFilter: AchievementModeFilter;
  readonly onSelect: (filter: AchievementModeFilter) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  return (
    <div aria-label="Achievement mode" role="group" style={getAchievementFilterGridStyle()}>
      {ACHIEVEMENT_MODE_FILTERS.map((filter) => {
        const selected = filter === currentModeFilter;

        return (
          <AchievementFilterButton
            key={filter}
            label={formatAchievementModeLabel(filter)}
            selected={selected}
            onActivate={() => {
              onSelect(filter);
            }}
            onCancel={onCancel}
          />
        );
      })}
    </div>
  );
}

function AchievementStateButtons({
  currentFilter,
  onSelect,
  onCancel,
}: {
  readonly currentFilter: AchievementFilter;
  readonly onSelect: (filter: AchievementFilter) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  return (
    <div aria-label="Achievement state" role="group" style={getAchievementFilterGridStyle()}>
      {ACHIEVEMENT_FILTERS.map((filter) => {
        const selected = filter === currentFilter;

        return (
          <AchievementFilterButton
            key={filter}
            label={formatAchievementFilterLabel(filter)}
            selected={selected}
            onActivate={() => {
              onSelect(filter);
            }}
            onCancel={onCancel}
          />
        );
      })}
    </div>
  );
}

function AchievementRowCard({
  achievement,
  onOpenAchievementDetail,
  onBack,
}: {
  readonly achievement: NormalizedAchievement;
  readonly onOpenAchievementDetail: ((achievementId: string) => void) | undefined;
  readonly onBack: () => void;
}): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const status = buildAchievementStatus(achievement);
  const unlockedAt = achievement.unlockedAt;
  const openAchievementDetail = (): void => {
    if (onOpenAchievementDetail !== undefined) {
      onOpenAchievementDetail(achievement.achievementId);
    }
  };

  return (
    <Focusable
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      noFocusRing
      role="button"
      aria-label={`${achievement.title} achievement detail`}
      onActivate={openAchievementDetail}
      onClick={openAchievementDetail}
      onCancel={onBack}
      onFocus={(event) => {
        setIsFocused(true);
        scrollFocusedElementIntoView(event);
      }}
      onGamepadFocus={(event) => {
        setIsFocused(true);
        scrollFocusedGamepadElementIntoView(event);
      }}
      onBlur={() => {
        setIsFocused(false);
      }}
      style={{
        ...getAchievementCardStyle(achievement),
        outline: isFocused ? "2px solid rgba(69, 148, 255, 0.8)" : "none",
        outlineOffset: 1,
        boxShadow: isFocused
          ? "inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 0 1px rgba(69, 148, 255, 0.55), 0 4px 14px rgba(0, 0, 0, 0.22)"
          : undefined,
      }}
    >
      <span style={getAchievementRowIconStyle()}>
        {achievement.badgeImageUrl !== undefined ? <AchievementBadgeIcon achievement={achievement} /> : null}
      </span>

      <span style={getAchievementRowTextStyle()}>
        <span style={getAchievementRowTitleStyle()}>{achievement.title}</span>
        <span style={getAchievementRowMetadataStackStyle()}>
          <span style={getAchievementRowStatusStyle(achievement)}>{status.value}</span>
          <span style={getAchievementRowDetailStyle()}>
            {achievement.points !== undefined ? `${formatCount(achievement.points)} points` : "Points unavailable"}
          </span>
          {unlockedAt !== undefined ? (
            <span style={getAchievementRowDetailStyle()}>Unlocked {formatTimestamp(unlockedAt)}</span>
          ) : null}
        </span>
      </span>
    </Focusable>
  );
}

function AchievementBadgeIcon({
  achievement,
}: {
  readonly achievement: NormalizedAchievement;
}): JSX.Element | null {
  if (achievement.badgeImageUrl === undefined) {
    return null;
  }

  return (
    <span style={getAchievementBadgeFrameStyle(achievement.isUnlocked)}>
      <DeckyGameArtwork compact src={achievement.badgeImageUrl} size={32} title={achievement.title} />
    </span>
  );
}

interface AchievementBrowserProps {
  readonly achievementFilter: AchievementFilter;
  readonly achievementModeFilter: AchievementModeFilter;
  readonly achievementSummary: string;
  readonly achievements: readonly NormalizedAchievement[];
  readonly providerId: string | undefined;
  readonly filteredAchievementCount: number;
  readonly onAchievementFilterChange: (filter: AchievementFilter) => void;
  readonly onAchievementModeFilterChange: (filter: AchievementModeFilter) => void;
  readonly onOpenAchievementDetail: ((achievementId: string) => void) | undefined;
  readonly onBack: () => void;
}

function AchievementBrowser({
  achievementFilter,
  achievementModeFilter,
  achievementSummary,
  achievements,
  providerId,
  filteredAchievementCount,
  onAchievementFilterChange,
  onAchievementModeFilterChange,
  onOpenAchievementDetail,
  onBack,
}: AchievementBrowserProps): JSX.Element {
  const showAchievementModeFilter = shouldRenderAchievementModeFilter(providerId);

  return (
    <div style={getAchievementBrowserStackStyle()}>
      <div style={getAchievementBrowserCardStyle()}>
        <div style={getAchievementBrowserHeaderStyle()}>Filtered view</div>

        <div style={getAchievementBrowserSummaryStyle()}>{achievementSummary}</div>

        <div style={getAchievementBrowserMetaStyle()}>
          {formatAchievementVisibilitySummary(
            achievements.length,
            filteredAchievementCount,
            achievementFilter,
          )}
        </div>

        <div style={getAchievementBrowserMetaStackStyle()}>
          {showAchievementModeFilter ? (
            <>
              <div style={getAchievementBrowserSectionLabelStyle()}>Mode</div>
              <AchievementModeButtons
                currentModeFilter={achievementModeFilter}
                onSelect={onAchievementModeFilterChange}
                onCancel={onBack}
              />
            </>
          ) : null}

          <div style={getAchievementBrowserSectionLabelStyle()}>State</div>
          <AchievementStateButtons
            currentFilter={achievementFilter}
            onSelect={onAchievementFilterChange}
            onCancel={onBack}
          />
        </div>
      </div>

      {achievements.length > 0 ? (
        <div style={getAchievementRowsLayoutStyle()}>
          {achievements.map((achievement) => (
            <PanelSectionRow key={achievement.achievementId}>
              <AchievementRowCard
                achievement={achievement}
                onOpenAchievementDetail={onOpenAchievementDetail}
                onBack={onBack}
              />
            </PanelSectionRow>
          ))}
        </div>
      ) : (
        <PanelSectionRow>
          <Field
            bottomSeparator="none"
            description={formatAchievementFilterEmptyMessage(achievementFilter)}
            label="Achievements"
          />
        </PanelSectionRow>
      )}

    </div>
  );
}

function isRenderableGameDetailState(
  state: ResourceState<GameDetailSnapshot>,
): state is ResourceState<GameDetailSnapshot> & { readonly data: GameDetailSnapshot } {
  return (state.status === "success" || state.status === "stale") && state.data !== undefined;
}

export function DeckyFullScreenGamePage({
  providerId,
  gameId,
  onOpenAchievementDetail,
  onBack,
  backLabel = "Back",
  backDescription = "Return to the compact side panel.",
  backFooter = "Use Back to return to the compact side panel.",
}: DeckyFullScreenGamePageProps): JSX.Element {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>("all");
  const [achievementModeFilter, setAchievementModeFilter] = useState<AchievementModeFilter>("all");
  const loadSelectedGameDetail = useMemo(() => {
    if (providerId === undefined || gameId === undefined) {
      return () => Promise.resolve(initialDeckyGameDetailState);
    }

    return () => loadDeckyGameDetailState(providerId, gameId);
  }, [gameId, providerId, refreshNonce]);
  const state = useAsyncResourceState(loadSelectedGameDetail, initialDeckyGameDetailState);
  const hasRouteParameters = providerId !== undefined && gameId !== undefined;

  if (!isRenderableGameDetailState(state)) {
    return (
      <ScrollPanel>
        <TopAlignedScrollViewport
          scrollKey={`full-screen-game:${providerId ?? "missing"}:${gameId ?? "missing"}`}
        >
          <div style={getFullScreenPageFrameStyle()}>
            <PlaceholderState
              title="Full-screen game page"
              description={
                hasRouteParameters
                  ? "Loading the full-screen game page from the existing game-detail service."
                  : "The full-screen game page route is missing provider or game information."
              }
              state={state}
              footer={<span>{backFooter}</span>}
            />
          </div>
        </TopAlignedScrollViewport>
      </ScrollPanel>
    );
  }

  const snapshot = state.data;
  const game = snapshot.game;
  const heroArtworkUrl = game.boxArtImageUrl ?? game.coverImageUrl;
  const orderedAchievements = sortAchievementsForDisplay(snapshot.achievements);
  const achievementSummary = formatAchievementStatusSummary(orderedAchievements);
  const summary = snapshot.game.summary;
  const providerIdValue = providerId ?? game.providerId;
  const filteredAchievements = orderedAchievements.filter((achievement) =>
    matchesAchievementFilter(achievement, achievementFilter) &&
    (shouldRenderAchievementModeFilter(providerIdValue) ? matchesAchievementModeFilter(achievement, achievementModeFilter) : true),
  );
  const filteredAchievementCount = filteredAchievements.length;
  const completionPercent = getCompletionPercent(snapshot.game.summary);
  const achievements = filteredAchievements;
  const providerLabel = formatDeckyProviderLabel(providerId ?? game.providerId);
  const isCachedView = state.status === "stale";
  const snapshotSourceLabel = isCachedView ? "Cached snapshot" : "Live snapshot";
  const refreshTimestamp = state.lastUpdatedAt ?? snapshot.refreshedAt;
  const totalAchievementCount = summary.totalCount ?? snapshot.achievements.length;
  const heroMetaPills = dedupeDistinctLabels([providerLabel, snapshotSourceLabel]);
  const gameMetadataPills = buildGameMetadataPills(game.metrics);
  const hardcoreModePoints = getAchievementModePoints(snapshot.achievements, "hardcore");
  const softcoreModePoints = getAchievementModePoints(snapshot.achievements, "softcore");

  return (
    <ScrollPanel>
      <TopAlignedScrollViewport
        scrollKey={`full-screen-game:${providerId ?? game.providerId}:${game.gameId}`}
      >
        <div style={getFullScreenPageFrameStyle()}>
          <PanelSection title="Game Spotlight">
            <PanelSectionRow>
              <div style={getGameSpotlightLayoutStyle()}>
                <div style={getGameDetailSectionCardStyle()}>
                  <div style={getGameDetailSectionHeaderStyle()}>Game Overview</div>
                  <div style={getGameDetailOverviewLayoutStyle()}>
                    <div style={getGameDetailOverviewTextStyle()}>
                      <div style={getGameDetailOverviewTitleStyle()}>{game.title}</div>
                      <div style={getGameOverviewPillRowStyle()}>
                        {heroMetaPills.map((label) => (
                          <span key={label} style={getGameOverviewInfoPillStyle()}>
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>

                    {heroArtworkUrl !== undefined ? (
                      <div style={getGameSpotlightHeroStyle()}>
                        <DeckyGameArtwork src={heroArtworkUrl} size={256} title={game.title} />
                      </div>
                    ) : null}

                    <DeckyFullscreenActionRow centered>
                      <DeckyFullscreenActionButton
                        label={backLabel}
                        isFullscreenBackAction
                        onClick={() => {
                          onBack();
                        }}
                      />
                      <DeckyFullscreenActionButton
                        label="Refresh"
                        onClick={() => {
                          setRefreshNonce((current) => current + 1);
                        }}
                      />
                    </DeckyFullscreenActionRow>
                  </div>
                </div>

                <div style={getGameDetailSectionCardStyle()}>
                  <div style={getGameDetailSectionHeaderStyle()}>Progress Summary</div>
                  {completionPercent !== undefined ? (
                    <DeckyCompletionProgressBar percent={completionPercent} />
                  ) : null}
                  <div style={getProgressStatGridStyle()}>
                    <ProgressStat label="Unlocked" value={formatCount(summary.unlockedCount)} />
                    <ProgressStat label="Total" value={formatCount(totalAchievementCount)} />
                  </div>

                  {gameMetadataPills.length > 0 ? (
                    <div style={getGameDetailMetaRowStyle()}>
                      {gameMetadataPills.map((pill) => (
                        <span key={pill.key} style={getGameDetailMetaPillStyle()}>
                          {`${pill.label}: ${pill.value}`}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {game.hardcoreSummary !== undefined || game.softcoreSummary !== undefined ? (
                    <div style={getModeProgressGridStyle()}>
                      {game.hardcoreSummary !== undefined ? (
                        <div style={getModeProgressCardStyle("hardcore")}>
                          <div style={getModeProgressCardTitleStyle("hardcore")}>Hardcore</div>
                          <div style={getModeProgressCardLineStyle()}>
                            {formatModeProgressSummary(game.hardcoreSummary, "Hardcore")}
                          </div>
                          {hardcoreModePoints !== undefined ? (
                            <div style={getModeProgressCardPointsStyle()}>
                              {`Points ${formatCount(hardcoreModePoints)}`}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {game.softcoreSummary !== undefined ? (
                        <div style={getModeProgressCardStyle("softcore")}>
                          <div style={getModeProgressCardTitleStyle("softcore")}>Softcore</div>
                          <div style={getModeProgressCardLineStyle()}>
                            {formatModeProgressSummary(game.softcoreSummary, "Softcore")}
                          </div>
                          {softcoreModePoints !== undefined ? (
                            <div style={getModeProgressCardPointsStyle()}>
                              {`Points ${formatCount(softcoreModePoints)}`}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Achievements">
            <PanelSectionRow>
              <AchievementBrowser
                achievementFilter={achievementFilter}
                achievementModeFilter={achievementModeFilter}
                achievementSummary={achievementSummary}
                achievements={achievements}
                providerId={providerIdValue}
                filteredAchievementCount={filteredAchievementCount}
                onAchievementFilterChange={(filter) => {
                  setAchievementFilter(filter);
                }}
                onAchievementModeFilterChange={(filter) => {
                  setAchievementModeFilter(filter);
                }}
                onOpenAchievementDetail={onOpenAchievementDetail}
                onBack={onBack}
              />
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Snapshot">
            {state.error ? (
              <PanelSectionRow>
                <Field bottomSeparator="none" description={state.error.userMessage} label="Snapshot note" />
              </PanelSectionRow>
            ) : null}

            <PanelSectionRow>
              <Field
                bottomSeparator="none"
                description={`${snapshotSourceLabel} • ${formatTimestamp(refreshTimestamp)}`}
                label="Updated"
              />
            </PanelSectionRow>
          </PanelSection>
        </div>
      </TopAlignedScrollViewport>
    </ScrollPanel>
  );
}
