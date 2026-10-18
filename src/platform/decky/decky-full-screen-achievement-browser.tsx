import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ComponentProps, type FocusEventHandler } from "react";
import type { NormalizedAchievement, NormalizedMetric } from "@core/domain";
import {
  Field,
  Focusable,
  Menu,
  MenuItem,
  NavEntryPositionPreferences,
  PanelSectionRow,
  showContextMenu,
  type GamepadEvent,
} from "@decky/ui";
import { shouldRenderAchievementModeFilter } from "./decky-achievement-detail-helpers";
import { DeckyFullScreenAchievementRow } from "./decky-full-screen-achievement-row";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { registerDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";
import { getSteamHuntersAchievementGroupKind } from "../../providers/steamhunters";
import type {
  SteamHuntersAchievement,
  SteamHuntersAchievementGroup,
} from "../../providers/steamhunters";
import { steamRecipes, steamTheme } from "./steam-theme";
import { getSteamCompactAchievementFilterStyle } from "./decky-steam-compact-action-styles";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { getMetricValue } from "./decky-achievement-detail-helpers";
import { raRecipes, raTheme } from "./ra-theme";
import { achievementCompanionQamTheme as qamTheme } from "./decky-qam-theme";

const ACHIEVEMENT_FILTERS = ["all", "unlocked", "locked"] as const;
const STEAM_ACHIEVEMENT_RENDER_STEP = 36;
const ACHIEVEMENT_MODE_FILTERS = ["all", "hardcore", "softcore"] as const;
const ACHIEVEMENT_GROUP_FILTERS = ["all", "base-game", "dlc", "update"] as const;
const ACHIEVEMENT_AVAILABILITY_FILTERS = [
  "all",
  "obtainable",
  "broken-but-obtainable",
  "conditionally-obtainable",
  "unobtainable",
  "unknown",
] as const;
const ACHIEVEMENT_GROUP_FILTER_PREFIX = "group:";
const RETROACHIEVEMENTS_ACHIEVEMENT_TYPE_FILTERS = ["all", "regular", "progression", "win-condition"] as const;

export type AchievementFilter = (typeof ACHIEVEMENT_FILTERS)[number];
export type AchievementModeFilter = (typeof ACHIEVEMENT_MODE_FILTERS)[number];
export type AchievementGroupFilter = (typeof ACHIEVEMENT_GROUP_FILTERS)[number] | `${typeof ACHIEVEMENT_GROUP_FILTER_PREFIX}${string}`;
export type AchievementAvailabilityFilter = (typeof ACHIEVEMENT_AVAILABILITY_FILTERS)[number];
export type RetroAchievementsAchievementTypeFilter = (typeof RETROACHIEVEMENTS_ACHIEVEMENT_TYPE_FILTERS)[number];

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

function getAchievementGroupFilterValue(group: SteamHuntersAchievementGroup | undefined): `${typeof ACHIEVEMENT_GROUP_FILTER_PREFIX}${string}` {
  if (group === undefined || getSteamHuntersAchievementGroupKind(group) === "base-game") {
    return `${ACHIEVEMENT_GROUP_FILTER_PREFIX}base-game:Base%20Game`;
  }
  const kind = getSteamHuntersAchievementGroupKind(group);
  const identity = `${kind}|${group.dlcAppId ?? ""}|${group.dlcAppName ?? ""}|${group.name ?? ""}`;
  return `${ACHIEVEMENT_GROUP_FILTER_PREFIX}${encodeURIComponent(identity)}:${encodeURIComponent(getAchievementGroupTitle(group))}`;
}

function getAchievementGroupFilterLabel(groupFilter: AchievementGroupFilter): string | undefined {
  if (!groupFilter.startsWith(ACHIEVEMENT_GROUP_FILTER_PREFIX)) return undefined;
  try {
    return decodeURIComponent(groupFilter.slice(groupFilter.lastIndexOf(":") + 1));
  } catch {
    return undefined;
  }
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

export function getAchievementGroupFilterOptions(
  achievements: readonly NormalizedAchievement[],
  achievementGroupsBySteamAchievementId: Readonly<Record<string, SteamHuntersAchievementGroup>> | undefined,
  achievementGroups?: readonly SteamHuntersAchievementGroup[],
): readonly AchievementGroupFilter[] {
  const groups = achievementGroups ?? Object.values(achievementGroupsBySteamAchievementId ?? {});
  const availableFilters = new Set<AchievementGroupFilter>();
  const hasBaseGameAchievements = achievements.some((achievement) => {
    const group = achievementGroupsBySteamAchievementId?.[achievement.achievementId];
    return group === undefined || getSteamHuntersAchievementGroupKind(group) === "base-game";
  });
  if (hasBaseGameAchievements) availableFilters.add(getAchievementGroupFilterValue(undefined));

  for (const group of groups) {
    const hasAchievements = group.achievementApiNames.some((achievementId) =>
      achievements.some((achievement) => achievement.achievementId === achievementId),
    );
    if (hasAchievements) availableFilters.add(getAchievementGroupFilterValue(group));
  }

  return ["all", ...availableFilters];
}

export function getAchievementAvailabilityFilterOptions(
  achievements: readonly NormalizedAchievement[],
  steamHuntersAchievementsBySteamAchievementId: Readonly<Record<string, SteamHuntersAchievement>> | undefined,
): readonly AchievementAvailabilityFilter[] {
  return [
    "all",
    ...ACHIEVEMENT_AVAILABILITY_FILTERS.filter((filter) =>
      filter !== "all" && achievements.some((achievement) =>
        steamHuntersAchievementsBySteamAchievementId?.[achievement.achievementId]?.obtainability === filter,
      ),
    ),
  ];
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatAchievementFilterLabel(filter: AchievementFilter): string {
  return filter === "all" ? "All" : filter === "unlocked" ? "Unlocked" : "Locked";
}

function formatAchievementModeLabel(modeFilter: AchievementModeFilter): string {
  return modeFilter === "all" ? "All" : modeFilter === "hardcore" ? "Hardcore" : "Softcore";
}

function formatAchievementGroupLabel(groupFilter: AchievementGroupFilter): string {
  if (groupFilter === "all") return "All";
  const specificGroupLabel = getAchievementGroupFilterLabel(groupFilter);
  if (specificGroupLabel !== undefined) return specificGroupLabel;
  if (groupFilter === "base-game") return "Base Game";
  if (groupFilter === "dlc") return "DLC / Expansion";
  return "Update";
}

function formatAchievementAvailabilityLabel(availabilityFilter: AchievementAvailabilityFilter): string {
  if (availabilityFilter === "all") return "All";
  if (availabilityFilter === "broken-but-obtainable") return "Broken but obtainable";
  if (availabilityFilter === "conditionally-obtainable") return "Conditional";
  if (availabilityFilter === "unobtainable") return "Unobtainable";
  if (availabilityFilter === "obtainable") return "Obtainable";
  return "Unknown";
}

function formatRetroAchievementsTypeFilterLabel(typeFilter: RetroAchievementsAchievementTypeFilter): string {
  if (typeFilter === "win-condition") return "Win Condition";
  if (typeFilter === "progression") return "Progression";
  if (typeFilter === "regular") return "Regular";
  return "All";
}

function formatAchievementVisibilitySummary(
  visibleCount: number,
  totalCount: number,
  filter: AchievementFilter,
): string {
  const suffix = filter === "all" ? "achievements" : formatAchievementFilterLabel(filter).toLowerCase();
  return `Showing ${formatCount(visibleCount)} of ${formatCount(totalCount)} ${suffix}`;
}

function formatAchievementFilterEmptyMessage(filter: AchievementFilter): string {
  if (filter === "all") return "No achievement entries were returned for this game.";
  return `No ${formatAchievementFilterLabel(filter).toLowerCase()} achievements match this filter.`;
}

function formatRetroAchievementsFilterEmptyMessage(
  stateFilter: AchievementFilter,
  typeFilter: RetroAchievementsAchievementTypeFilter,
  missableOnly: boolean,
): string {
  const filters = [
    stateFilter === "all" ? undefined : formatAchievementFilterLabel(stateFilter).toLowerCase(),
    missableOnly
      ? "missable"
      : typeFilter === "all"
        ? undefined
        : formatRetroAchievementsTypeFilterLabel(typeFilter).toLowerCase(),
  ].filter((value): value is string => value !== undefined);
  return filters.length === 0
    ? "No achievement entries were returned for this game."
    : `No ${filters.join(" ")} achievements match these filters.`;
}

type FullScreenGamepadFocusHandler = NonNullable<ComponentProps<typeof Field>["onGamepadFocus"]>;

const scrollFocusedGamepadElementIntoView: FullScreenGamepadFocusHandler = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
};

const scrollFocusedElementIntoView: FocusEventHandler<HTMLElement> = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
};

function getAchievementBrowserStackStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 12 };
}

function getSteamAchievementFilterBarStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 0.72fr)) minmax(180px, 1.4fr) minmax(220px, 1.6fr)",
    gap: 8,
    width: "100%",
    minWidth: 0,
  };
}

function getAchievementFilterButtonStyle(selected: boolean, focused: boolean, disabled: boolean): CSSProperties {
  return {
    ...raRecipes.action("fullscreen", false, focused),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minWidth: 0,
    minHeight: 42,
    padding: "8px 12px",
    borderRadius: raTheme.radius.medium,
    border: `1px solid ${focused ? raTheme.focus.border : selected ? raTheme.selection.border : raTheme.color.borderSubtle}`,
    background: selected
      ? focused ? raTheme.surface.focusedSelectedContentCard : raTheme.surface.selectedContentCard
      : focused ? raTheme.surface.focusedContentCard : raTheme.surface.contentCard,
    color: selected ? raTheme.color.accentStrong : raTheme.color.textSecondary,
    fontSize: "0.9em",
    fontWeight: selected ? raTheme.type.weight.strong : raTheme.type.weight.medium,
    lineHeight: 1.1,
    textAlign: "center",
    whiteSpace: "nowrap",
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "default" : "pointer",
    boxShadow: selected ? qamTheme.selection.compactUnderline : undefined,
  };
}

function getAchievementFilterButtonLabelStyle(): CSSProperties {
  return { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
}

function getSteamAchievementFilterButtonStyle(selected: boolean, focused: boolean): CSSProperties {
  return {
    ...getSteamCompactAchievementFilterStyle(selected, focused),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minWidth: 0,
    minHeight: 34,
    padding: "6px 10px",
    borderRadius: steamTheme.radius.small,
    boxSizing: "border-box",
    fontSize: "0.9em",
    fontWeight: selected ? 800 : 700,
    lineHeight: 1.1,
    textAlign: "center",
    whiteSpace: "nowrap",
    cursor: "pointer",
  };
}

function getSteamAchievementSelectButtonStyle(focused: boolean): CSSProperties {
  return {
    ...getSteamAchievementFilterButtonStyle(false, focused),
    justifyContent: "space-between",
    gap: 8,
    paddingInline: 14,
    borderRadius: steamTheme.radius.medium,
    border: `1px solid ${focused ? steamTheme.focus.border : steamTheme.color.borderSubtle}`,
    background: focused ? steamTheme.surface.focusedContentCard : steamTheme.surface.contentCard,
  };
}

function getRaAchievementSelectButtonStyle(focused: boolean, disabled: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    width: "100%",
    minWidth: 0,
    minHeight: 42,
    padding: "8px 12px",
    gap: 8,
    borderRadius: raTheme.radius.medium,
    border: `1px solid ${focused ? raTheme.focus.border : raTheme.color.borderSubtle}`,
    background: focused ? raTheme.surface.focusedContentCard : raTheme.surface.contentCard,
    color: raTheme.color.textPrimary,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "default" : "pointer",
    boxSizing: "border-box",
  };
}

function getRaAchievementSelectLabelStyle(): CSSProperties {
  return { color: raTheme.color.textSecondary, flexShrink: 0, whiteSpace: "nowrap" };
}

function getRaAchievementSelectValueStyle(): CSSProperties {
  return { color: raTheme.color.textPrimary, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
}

function getSteamAchievementSelectLabelStyle(): CSSProperties {
  return { color: steamTheme.color.textSecondary, flexShrink: 0, whiteSpace: "nowrap" };
}

function getSteamAchievementSelectValueStyle(): CSSProperties {
  return { color: steamTheme.color.textPrimary, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
}

function getSteamAchievementSelectChevronStyle(): CSSProperties {
  return {
    width: 8,
    height: 8,
    flexShrink: 0,
    borderRight: "2px solid rgba(255, 255, 255, 0.9)",
    borderBottom: "2px solid rgba(255, 255, 255, 0.9)",
    transform: "rotate(45deg) translate(-2px, -2px)",
  };
}

function getRaAchievementFilterBarStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(90px, 0.72fr)) minmax(190px, 1.2fr) minmax(160px, 0.82fr)",
    gap: 8,
    width: "100%",
    minWidth: 0,
    alignItems: "stretch",
  };
}

function getRaAchievementFilterStackStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 10, width: "100%", minWidth: 0 };
}

function getRaAchievementModeLabelStyle(): CSSProperties {
  return {
    color: raTheme.color.textMuted,
    fontSize: "0.78em",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };
}

function getRaAchievementSummaryStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: 16,
    rowGap: 4,
    padding: "0 4px",
    color: raTheme.color.textSecondary,
    fontSize: "0.82em",
    lineHeight: 1.2,
  };
}

function getMissableSwitchStyle(selected: boolean, focused: boolean, disabled: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
    minWidth: 0,
    minHeight: 42,
    padding: "7px 12px",
    borderRadius: raTheme.radius.medium,
    border: `1px solid ${focused ? raTheme.focus.border : selected ? raTheme.selection.border : raTheme.color.borderSubtle}`,
    background: selected
      ? focused ? raTheme.surface.focusedSelectedContentCard : raTheme.surface.selectedContentCard
      : focused ? raTheme.surface.focusedContentCard : raTheme.surface.contentCard,
    color: selected ? raTheme.color.accentStrong : raTheme.color.textPrimary,
    fontSize: "0.9em",
    fontWeight: selected ? raTheme.type.weight.strong : raTheme.type.weight.medium,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "default" : "pointer",
    boxSizing: "border-box",
  };
}

function getMissableSwitchTrackStyle(selected: boolean): CSSProperties {
  return {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
    width: 38,
    height: 22,
    borderRadius: 999,
    background: selected ? raTheme.color.accentStrong : "rgba(143, 169, 189, 0.34)",
    boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.16)",
    transition: "background 120ms ease",
  };
}

function getMissableSwitchKnobStyle(selected: boolean): CSSProperties {
  return {
    position: "absolute",
    top: 3,
    left: selected ? 19 : 3,
    width: 16,
    height: 16,
    borderRadius: "50%",
    background: "#f2f7fb",
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.36)",
    transition: "left 120ms ease",
  };
}

function getSteamAchievementSelectedGroupStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    width: "100%",
    minWidth: 0,
    padding: "2px 4px 0",
    color: steamTheme.color.textSecondary,
    fontSize: "0.86em",
    lineHeight: 1.25,
  };
}

function getSteamAchievementSelectedGroupValueStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: steamTheme.color.textPrimary,
    fontWeight: 800,
  };
}

interface AchievementFilterButtonProps {
  readonly label: string;
  readonly selected: boolean;
  readonly disabled?: boolean;
  readonly variant?: "default" | "steam";
  readonly onActivate: () => void;
  readonly onCancel: () => void;
}

function AchievementFilterButton({ label, selected, disabled = false, variant = "default", onActivate, onCancel }: AchievementFilterButtonProps): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const isSteamVariant = variant === "steam";
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
      onFocus={(event) => { setIsFocused(true); scrollFocusedElementIntoView(event); }}
      onGamepadFocus={(event) => { setIsFocused(true); scrollFocusedGamepadElementIntoView(event); }}
      onBlur={() => { setIsFocused(false); }}
      onCancel={onCancel}
      style={isSteamVariant
        ? getSteamAchievementFilterButtonStyle(selected, isFocused)
        : getAchievementFilterButtonStyle(selected, isFocused, disabled)}
      data-achievement-filter-selected={selected ? "true" : "false"}
      data-achievement-filter-disabled={disabled ? "true" : "false"}
      data-achievement-companion-steam-filter-control="true"
    >
      <span style={getAchievementFilterButtonLabelStyle()}>{label}</span>
    </Focusable>
  );
}

function AchievementSelectButton({
  label,
  value,
  options,
  formatValue,
  onChange,
  onCancel,
  nativeDropdown,
  variant = "steam",
  disabled = false,
  dataFilterControl,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly string[];
  readonly formatValue: (value: string) => string;
  readonly onChange: (value: string) => void;
  readonly onCancel: () => void;
  readonly nativeDropdown?: boolean;
  readonly variant?: "steam" | "ra";
  readonly disabled?: boolean;
  readonly dataFilterControl?: string;
}): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const activeMenuRef = useRef<ReturnType<typeof showContextMenu> | undefined>(undefined);
  const unregisterMenuCancelRef = useRef<(() => void) | undefined>(undefined);
  const currentIndex = Math.max(0, options.indexOf(value));
  const nextValue = options[(currentIndex + 1) % Math.max(options.length, 1)] ?? value;

  if (nativeDropdown) {
    const closeMenu = (): void => {
      activeMenuRef.current?.Hide();
      activeMenuRef.current = undefined;
      unregisterMenuCancelRef.current?.();
      unregisterMenuCancelRef.current = undefined;
    };
    const openMenu = (): void => {
      if (disabled || activeMenuRef.current !== undefined || buttonRef.current === null) return;
      const menu = showContextMenu(
        <Menu label={label} onCancel={closeMenu}>
          {options.map((option) => (
            <MenuItem
              key={option}
              selected={option === value}
              onClick={() => {
                onChange(option);
                closeMenu();
              }}
            >
              {formatValue(option)}
            </MenuItem>
          ))}
        </Menu>,
        buttonRef.current,
        { bModal: true, bMatchWidth: true },
      );
      activeMenuRef.current = menu;
      unregisterMenuCancelRef.current = registerDeckyFullscreenPopupCancel(closeMenu);
    };

    return (
      <Focusable
        ref={buttonRef}
        className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
        noFocusRing
        role="button"
        aria-label={`${label}: ${formatValue(value)}`}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : undefined}
        onActivate={disabled ? () => undefined : openMenu}
        onClick={disabled ? () => undefined : openMenu}
        onFocus={(event) => { setIsFocused(true); scrollFocusedElementIntoView(event); }}
        onGamepadFocus={(event) => { setIsFocused(true); scrollFocusedGamepadElementIntoView(event); }}
        onBlur={() => { setIsFocused(false); }}
        onCancel={() => {
          if (activeMenuRef.current !== undefined) closeMenu();
          else onCancel();
        }}
        style={variant === "ra"
          ? getRaAchievementSelectButtonStyle(isFocused, disabled)
          : { ...getSteamAchievementSelectButtonStyle(isFocused), opacity: disabled ? 0.5 : 1 }}
        data-achievement-companion-steam-filter-control="true"
        data-ra-game-achievement-filter-control={dataFilterControl}
      >
        <span style={variant === "ra" ? getRaAchievementSelectLabelStyle() : getSteamAchievementSelectLabelStyle()}>{label}:</span>
        <span style={variant === "ra" ? getRaAchievementSelectValueStyle() : getSteamAchievementSelectValueStyle()}>{formatValue(value)}</span>
        <span aria-hidden="true" style={getSteamAchievementSelectChevronStyle()} />
      </Focusable>
    );
  }

  return (
    <Focusable
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      noFocusRing
      role="button"
      aria-label={`${label}: ${formatValue(value)}`}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      onActivate={disabled ? () => undefined : () => { onChange(nextValue); }}
      onClick={disabled ? () => undefined : () => { onChange(nextValue); }}
      onFocus={(event) => { setIsFocused(true); scrollFocusedElementIntoView(event); }}
      onGamepadFocus={(event) => { setIsFocused(true); scrollFocusedGamepadElementIntoView(event); }}
      onBlur={() => { setIsFocused(false); }}
      onCancel={onCancel}
      style={variant === "ra"
        ? getRaAchievementSelectButtonStyle(isFocused, disabled)
        : { ...getSteamAchievementSelectButtonStyle(isFocused), opacity: disabled ? 0.5 : 1 }}
      data-achievement-companion-steam-filter-control="true"
      data-ra-game-achievement-filter-control={dataFilterControl}
    >
      <span style={variant === "ra" ? getRaAchievementSelectLabelStyle() : getSteamAchievementSelectLabelStyle()}>{label}:</span>
      <span style={variant === "ra" ? getRaAchievementSelectValueStyle() : getSteamAchievementSelectValueStyle()}>{formatValue(value)}</span>
      <span aria-hidden="true" style={getSteamAchievementSelectChevronStyle()} />
    </Focusable>
  );
}

function getAchievementRowsLayoutStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 8 };
}

function SteamAchievementFilterBar({
  achievementFilter,
  achievementGroupFilter,
  achievementAvailabilityFilter,
  groupOptions,
  availabilityOptions,
  onAchievementFilterChange,
  onAchievementGroupFilterChange,
  onAchievementAvailabilityFilterChange,
  onBack,
}: {
  readonly achievementFilter: AchievementFilter;
  readonly achievementGroupFilter: AchievementGroupFilter;
  readonly achievementAvailabilityFilter: AchievementAvailabilityFilter;
  readonly groupOptions: readonly AchievementGroupFilter[];
  readonly availabilityOptions: readonly AchievementAvailabilityFilter[];
  readonly onAchievementFilterChange: (filter: AchievementFilter) => void;
  readonly onAchievementGroupFilterChange: (filter: AchievementGroupFilter) => void;
  readonly onAchievementAvailabilityFilterChange: (filter: AchievementAvailabilityFilter) => void;
  readonly onBack: () => void;
}): JSX.Element {
  return (
    <Focusable flow-children="left-right" tabIndex={-1} style={getSteamAchievementFilterBarStyle()}>
      {ACHIEVEMENT_FILTERS.map((filter) => (
        <AchievementFilterButton
          key={filter}
          label={formatAchievementFilterLabel(filter)}
          selected={filter === achievementFilter}
          variant="steam"
          onActivate={() => { onAchievementFilterChange(filter); }}
          onCancel={onBack}
        />
      ))}
      <AchievementSelectButton
        label="Group"
        value={achievementGroupFilter}
        options={groupOptions}
        formatValue={(value) => formatAchievementGroupLabel(value as AchievementGroupFilter)}
        onChange={(value) => { onAchievementGroupFilterChange(value as AchievementGroupFilter); }}
        onCancel={onBack}
        nativeDropdown
      />
      <AchievementSelectButton
        label="Availability"
        value={achievementAvailabilityFilter}
        options={availabilityOptions}
        formatValue={(value) => formatAchievementAvailabilityLabel(value as AchievementAvailabilityFilter)}
        onChange={(value) => { onAchievementAvailabilityFilterChange(value as AchievementAvailabilityFilter); }}
        onCancel={onBack}
        nativeDropdown
      />
    </Focusable>
  );
}

function MissableAchievementSwitch({
  checked,
  disabled,
  onChange,
  onCancel,
}: {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <Focusable
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      noFocusRing
      role="switch"
      aria-label="Missable only"
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      onActivate={disabled ? () => undefined : () => { onChange(!checked); }}
      onClick={disabled ? () => undefined : () => { onChange(!checked); }}
      onFocus={(event) => { setIsFocused(true); scrollFocusedElementIntoView(event); }}
      onGamepadFocus={(event) => { setIsFocused(true); scrollFocusedGamepadElementIntoView(event); }}
      onBlur={() => { setIsFocused(false); }}
      onCancel={onCancel}
      style={getMissableSwitchStyle(checked, isFocused, disabled)}
      data-achievement-companion-steam-filter-control="true"
      data-ra-game-achievement-filter-control="missable"
      data-achievement-filter-selected={checked ? "true" : "false"}
      data-achievement-filter-disabled={disabled ? "true" : "false"}
    >
      <span>Missable</span>
      <span aria-hidden="true" style={getMissableSwitchTrackStyle(checked)}>
        <span style={getMissableSwitchKnobStyle(checked)} />
      </span>
    </Focusable>
  );
}

function RetroAchievementsFilterBar({
  achievementFilter,
  achievementModeFilter,
  achievementTypeFilter,
  achievementMissableOnly,
  achievementSummary,
  allAchievements,
  visibleAchievementCount,
  showAchievementModeFilter,
  hasMissableAchievements,
  onAchievementFilterChange,
  onAchievementModeFilterChange,
  onAchievementTypeFilterChange,
  onAchievementMissableOnlyChange,
  onBack,
}: {
  readonly achievementFilter: AchievementFilter;
  readonly achievementModeFilter: AchievementModeFilter;
  readonly achievementTypeFilter: RetroAchievementsAchievementTypeFilter;
  readonly achievementMissableOnly: boolean;
  readonly achievementSummary: string;
  readonly allAchievements: readonly NormalizedAchievement[];
  readonly visibleAchievementCount: number;
  readonly showAchievementModeFilter: boolean;
  readonly hasMissableAchievements: boolean;
  readonly onAchievementFilterChange: (filter: AchievementFilter) => void;
  readonly onAchievementModeFilterChange: (filter: AchievementModeFilter) => void;
  readonly onAchievementTypeFilterChange: (filter: RetroAchievementsAchievementTypeFilter) => void;
  readonly onAchievementMissableOnlyChange: (checked: boolean) => void;
  readonly onBack: () => void;
}): JSX.Element {
  return (
    <div style={getRaAchievementFilterStackStyle()}>
      <Focusable flow-children="left-right" tabIndex={-1} style={getRaAchievementFilterBarStyle()}>
        {ACHIEVEMENT_FILTERS.map((filter) => (
          <AchievementFilterButton
            key={filter}
            label={formatAchievementFilterLabel(filter)}
            selected={filter === achievementFilter}
            onActivate={() => { onAchievementFilterChange(filter); }}
            onCancel={onBack}
          />
        ))}
        <AchievementSelectButton
          label="Type"
          value={achievementTypeFilter}
          options={RETROACHIEVEMENTS_ACHIEVEMENT_TYPE_FILTERS}
          formatValue={(value) => formatRetroAchievementsTypeFilterLabel(value as RetroAchievementsAchievementTypeFilter)}
          onChange={(value) => { onAchievementTypeFilterChange(value as RetroAchievementsAchievementTypeFilter); }}
          onCancel={onBack}
          nativeDropdown
          variant="ra"
          dataFilterControl="type"
        />
        <MissableAchievementSwitch
          checked={achievementMissableOnly}
          disabled={!hasMissableAchievements}
          onChange={onAchievementMissableOnlyChange}
          onCancel={onBack}
        />
      </Focusable>
      {showAchievementModeFilter ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={getRaAchievementModeLabelStyle()}>Mode</span>
          <Focusable flow-children="left-right" tabIndex={-1} style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(110px, 150px))", gap: 8, minWidth: 0 }}>
            {ACHIEVEMENT_MODE_FILTERS.map((filter) => (
              <AchievementFilterButton
                key={`mode-${filter}`}
                label={formatAchievementModeLabel(filter)}
                selected={filter === achievementModeFilter}
                onActivate={() => { onAchievementModeFilterChange(filter); }}
                onCancel={onBack}
              />
            ))}
          </Focusable>
        </div>
      ) : null}
      <div style={getRaAchievementSummaryStyle()}>
        <span>{achievementSummary}</span>
        <span>{formatAchievementVisibilitySummary(visibleAchievementCount, allAchievements.length, achievementFilter)}</span>
      </div>
    </div>
  );
}

export interface DeckyFullScreenAchievementBrowserProps {
  readonly achievementFilter: AchievementFilter;
  readonly achievementModeFilter: AchievementModeFilter;
  readonly achievementGroupFilter: AchievementGroupFilter;
  readonly achievementAvailabilityFilter: AchievementAvailabilityFilter;
  readonly achievementTypeFilter: RetroAchievementsAchievementTypeFilter;
  readonly achievementMissableOnly: boolean;
  readonly achievementSummary: string;
  readonly allAchievements: readonly NormalizedAchievement[];
  readonly achievements: readonly NormalizedAchievement[];
  readonly gameMetrics: readonly NormalizedMetric[];
  readonly providerId: string | undefined;
  readonly initialRenderLimit?: number;
  readonly showAchievementModeFilter?: boolean;
  readonly onAchievementFilterChange: (filter: AchievementFilter) => void;
  readonly onAchievementModeFilterChange: (filter: AchievementModeFilter) => void;
  readonly onAchievementGroupFilterChange: (filter: AchievementGroupFilter) => void;
  readonly onAchievementAvailabilityFilterChange: (filter: AchievementAvailabilityFilter) => void;
  readonly onAchievementTypeFilterChange: (filter: RetroAchievementsAchievementTypeFilter) => void;
  readonly onAchievementMissableOnlyChange: (checked: boolean) => void;
  readonly onOpenAchievementDetail: ((achievementId: string) => void) | undefined;
  readonly onBack: () => void;
  readonly onJumpToTop?: () => void;
  readonly onFocusAchievement?: (achievementId: string) => void;
  readonly steamHuntersAchievementsBySteamAchievementId?: Readonly<Record<string, SteamHuntersAchievement>>;
  readonly steamHuntersAchievementGroupsBySteamAchievementId?: Readonly<Record<string, SteamHuntersAchievementGroup>>;
  readonly steamHuntersAchievementGroups?: readonly SteamHuntersAchievementGroup[];
}

export function DeckyFullScreenAchievementBrowser({
  achievementFilter, achievementModeFilter, achievementGroupFilter, achievementAvailabilityFilter,
  achievementTypeFilter, achievementMissableOnly, achievementSummary, allAchievements, achievements,
  gameMetrics, providerId, initialRenderLimit,
  showAchievementModeFilter: showAchievementModeFilterOverride,
  onAchievementFilterChange, onAchievementModeFilterChange,
  onAchievementGroupFilterChange, onAchievementAvailabilityFilterChange,
  onAchievementTypeFilterChange, onAchievementMissableOnlyChange,
  onOpenAchievementDetail, onBack, onJumpToTop, onFocusAchievement, steamHuntersAchievementsBySteamAchievementId,
  steamHuntersAchievementGroupsBySteamAchievementId, steamHuntersAchievementGroups,
}: DeckyFullScreenAchievementBrowserProps): JSX.Element {
  const showAchievementModeFilter = showAchievementModeFilterOverride
    ?? shouldRenderAchievementModeFilter(providerId);
  const isSteamProvider = providerId === "steam";
  const isRetroAchievementsProvider = providerId === "retroachievements";
  const browserRef = useRef<HTMLDivElement>(null);
  const [renderLimit, setRenderLimit] = useState(Math.max(STEAM_ACHIEVEMENT_RENDER_STEP, initialRenderLimit ?? 0));
  const [revealedAchievementId, setRevealedAchievementId] = useState<string | undefined>(undefined);
  const hasMountedFilters = useRef(false);
  useEffect(() => {
    if (!hasMountedFilters.current) { hasMountedFilters.current = true; return; }
    setRenderLimit(STEAM_ACHIEVEMENT_RENDER_STEP);
  }, [achievementFilter, achievementGroupFilter, achievementAvailabilityFilter, achievementTypeFilter, achievementMissableOnly]);
  useLayoutEffect(() => {
    if (revealedAchievementId === undefined) return;
    const target = Array.from(browserRef.current?.querySelectorAll<HTMLElement>("[data-achievement-companion-achievement-id]") ?? [])
      .find((element) => element.dataset["achievementCompanionAchievementId"] === revealedAchievementId);
    if (target === undefined) return;
    target.scrollIntoView({ block: "center", inline: "nearest" });
    return requestDeckySteamGamepadFocusAfterMount(target);
  }, [renderLimit, revealedAchievementId]);
  const renderedAchievements = achievements.slice(0, renderLimit);
  const groupOptions = getAchievementGroupFilterOptions(allAchievements, steamHuntersAchievementGroupsBySteamAchievementId, steamHuntersAchievementGroups);
  const availabilityOptions = getAchievementAvailabilityFilterOptions(allAchievements, steamHuntersAchievementsBySteamAchievementId);
  const hasMissableAchievements = isRetroAchievementsProvider && allAchievements.some((achievement) => achievement.classification === "missable");
  const visibleMissableOnly = hasMissableAchievements && achievementMissableOnly;
  const visibleGroupFilter = groupOptions.includes(achievementGroupFilter) ? achievementGroupFilter : "all";
  const visibleAvailabilityFilter = availabilityOptions.includes(achievementAvailabilityFilter) ? achievementAvailabilityFilter : "all";
  return (
    <Focusable
      ref={browserRef}
      flow-children="vertical"
      navEntryPreferPosition={NavEntryPositionPreferences.FIRST}
      noFocusRing
      {...(onJumpToTop !== undefined
        ? {
            onOptionsActionDescription: "Top",
            onOptionsButton: (event: GamepadEvent): void => {
              event.preventDefault();
              event.stopPropagation();
              onJumpToTop();
            },
          }
        : {})}
      tabIndex={-1}
      {...(isSteamProvider ? { "data-ac-steam-theme": "fullscreen" } : {})}
      style={getAchievementBrowserStackStyle()}
    >
      {isSteamProvider ? (
        <SteamAchievementFilterBar
          achievementFilter={achievementFilter}
          achievementGroupFilter={visibleGroupFilter}
          achievementAvailabilityFilter={visibleAvailabilityFilter}
          groupOptions={groupOptions}
          availabilityOptions={availabilityOptions}
          onAchievementFilterChange={onAchievementFilterChange}
          onAchievementGroupFilterChange={onAchievementGroupFilterChange}
          onAchievementAvailabilityFilterChange={onAchievementAvailabilityFilterChange}
          onBack={onBack}
        />
      ) : (
        <RetroAchievementsFilterBar
          achievementFilter={achievementFilter}
          achievementModeFilter={achievementModeFilter}
          achievementTypeFilter={achievementTypeFilter}
          achievementMissableOnly={visibleMissableOnly}
          achievementSummary={achievementSummary}
          allAchievements={allAchievements}
          visibleAchievementCount={achievements.length}
          showAchievementModeFilter={showAchievementModeFilter}
          hasMissableAchievements={hasMissableAchievements}
          onAchievementFilterChange={onAchievementFilterChange}
          onAchievementModeFilterChange={onAchievementModeFilterChange}
          onAchievementTypeFilterChange={onAchievementTypeFilterChange}
          onAchievementMissableOnlyChange={onAchievementMissableOnlyChange}
          onBack={onBack}
        />
      )}
      {isSteamProvider ? (
        <div style={getSteamAchievementSelectedGroupStyle()}>
          <span>Group:</span>
          <span style={getSteamAchievementSelectedGroupValueStyle()}>{formatAchievementGroupLabel(visibleGroupFilter)}</span>
        </div>
      ) : null}
      {achievements.length > 0 ? (
        <Focusable
          flow-children="vertical"
          navEntryPreferPosition={NavEntryPositionPreferences.FIRST}
          noFocusRing
          tabIndex={-1}
          style={getAchievementRowsLayoutStyle()}
        >
          {renderedAchievements.map((achievement) => (
            <PanelSectionRow key={achievement.achievementId}>
              <DeckyFullScreenAchievementRow
                achievement={achievement}
                onOpenAchievementDetail={onOpenAchievementDetail}
                onBack={onBack}
                {...(onJumpToTop !== undefined ? { onJumpToTop } : {})}
                {...(onFocusAchievement !== undefined ? { onFocusAchievement } : {})}
                steamHuntersAchievement={steamHuntersAchievementsBySteamAchievementId?.[achievement.achievementId]}
                gameMetrics={gameMetrics}
                retroAchievementsPresentation={isRetroAchievementsProvider ? "steam-shaped" : "default"}
              />
            </PanelSectionRow>
          ))}
          {renderedAchievements.length < achievements.length ? <Focusable
            noFocusRing role="button" data-steam-achievements-show-more="true"
            aria-label={`Show ${Math.min(STEAM_ACHIEVEMENT_RENDER_STEP, achievements.length - renderedAchievements.length)} more achievements`}
            onActivate={() => { setRevealedAchievementId(achievements[renderLimit]?.achievementId); setRenderLimit((current) => current + STEAM_ACHIEVEMENT_RENDER_STEP); }}
            onClick={() => { setRevealedAchievementId(achievements[renderLimit]?.achievementId); setRenderLimit((current) => current + STEAM_ACHIEVEMENT_RENDER_STEP); }}
            onCancel={onBack}
            style={{ ...steamRecipes.action("fullscreen"), display: "grid", placeItems: "center", width: "100%", borderRadius: steamTheme.radius.medium }}
          >{`Show ${Math.min(STEAM_ACHIEVEMENT_RENDER_STEP, achievements.length - renderedAchievements.length)} more achievements`}</Focusable> : null}
        </Focusable>
      ) : (
        <PanelSectionRow>
          <Field
            bottomSeparator="none"
            description={isRetroAchievementsProvider
              ? formatRetroAchievementsFilterEmptyMessage(achievementFilter, achievementTypeFilter, visibleMissableOnly)
              : formatAchievementFilterEmptyMessage(achievementFilter)}
            label="Achievements"
          />
        </PanelSectionRow>
      )}
    </Focusable>
  );
}
