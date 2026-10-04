import { useRef, useState, type CSSProperties, type ComponentProps, type FocusEventHandler } from "react";
import type { NormalizedAchievement } from "@core/domain";
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

const ACHIEVEMENT_FILTERS = ["all", "unlocked", "locked"] as const;
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

export type AchievementFilter = (typeof ACHIEVEMENT_FILTERS)[number];
export type AchievementModeFilter = (typeof ACHIEVEMENT_MODE_FILTERS)[number];
export type AchievementGroupFilter = (typeof ACHIEVEMENT_GROUP_FILTERS)[number] | `${typeof ACHIEVEMENT_GROUP_FILTER_PREFIX}${string}`;
export type AchievementAvailabilityFilter = (typeof ACHIEVEMENT_AVAILABILITY_FILTERS)[number];

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

function getAchievementBrowserCardStyle(): CSSProperties {
  return {
    display: "flex", flexDirection: "column", gap: 12, padding: 16, borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.026))",
  };
}

function getAchievementBrowserHeaderStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.58)", fontSize: "0.72em", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1.2 };
}

function getAchievementBrowserSectionLabelStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.58)", fontSize: "0.72em", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1.2 };
}

function getAchievementBrowserMetaStackStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 4 };
}

function getAchievementFilterGridStyle(): CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, width: "100%" };
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
    display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minWidth: 0,
    minHeight: 36, padding: "8px 10px", borderRadius: 16, boxSizing: "border-box",
    border: `1px solid ${focused ? "rgba(96, 165, 250, 0.82)" : selected ? "rgba(125, 190, 255, 0.72)" : "rgba(255, 255, 255, 0.08)"}`,
    background: focused
      ? selected ? "linear-gradient(180deg, rgba(96, 165, 250, 0.24), rgba(96, 165, 250, 0.12))" : "linear-gradient(180deg, rgba(96, 165, 250, 0.2), rgba(96, 165, 250, 0.1))"
      : selected ? "linear-gradient(180deg, rgba(125, 190, 255, 0.18), rgba(255, 255, 255, 0.055))" : "linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.02))",
    color: selected ? "rgba(255, 255, 255, 0.98)" : "rgba(255, 255, 255, 0.84)", fontSize: "0.84em", fontWeight: selected ? 700 : 600,
    lineHeight: 1.1, textAlign: "center", whiteSpace: "nowrap", opacity: disabled ? 0.6 : 1,
    cursor: disabled ? "default" : "pointer", outline: focused ? "2px solid rgba(96, 165, 250, 0.95)" : "none", outlineOffset: 1,
    boxShadow: focused
      ? selected ? "0 0 0 1px rgba(96, 165, 250, 0.82), inset 0 1px 0 rgba(255, 255, 255, 0.16), inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 4px 16px rgba(0, 0, 0, 0.26)" : "0 0 0 1px rgba(96, 165, 250, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 4px 14px rgba(0, 0, 0, 0.24)"
      : selected ? "inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 2px 10px rgba(0, 0, 0, 0.18)" : "none",
  };
}

function getAchievementFilterButtonLabelStyle(): CSSProperties {
  return { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
}

function getSteamAchievementFilterButtonStyle(selected: boolean, focused: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minWidth: 0,
    minHeight: 48,
    padding: "8px 12px",
    borderRadius: 14,
    boxSizing: "border-box",
    border: `1px solid ${focused ? "rgba(0, 169, 255, 0.96)" : selected ? "rgba(0, 156, 238, 0.88)" : "rgba(255, 255, 255, 0.11)"}`,
    background: focused
      ? "linear-gradient(180deg, rgba(0, 144, 218, 0.42), rgba(0, 77, 130, 0.36))"
      : selected
        ? "linear-gradient(180deg, rgba(0, 118, 190, 0.34), rgba(0, 69, 115, 0.3))"
        : "linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.025))",
    color: selected ? "rgba(255, 255, 255, 0.98)" : "rgba(255, 255, 255, 0.82)",
    fontSize: "0.9em",
    fontWeight: selected ? 800 : 700,
    lineHeight: 1.1,
    textAlign: "center",
    whiteSpace: "nowrap",
    cursor: "pointer",
    outline: focused ? "2px solid rgba(0, 169, 255, 0.98)" : "none",
    outlineOffset: 1,
    boxShadow: focused ? "0 0 0 1px rgba(0, 169, 255, 0.5), 0 4px 16px rgba(0, 0, 0, 0.28)" : "none",
  };
}

function getSteamAchievementSelectButtonStyle(focused: boolean): CSSProperties {
  return {
    ...getSteamAchievementFilterButtonStyle(false, focused),
    justifyContent: "space-between",
    gap: 8,
    paddingInline: 14,
    background: focused
      ? "linear-gradient(180deg, rgba(21, 64, 91, 0.9), rgba(12, 34, 53, 0.88))"
      : "linear-gradient(180deg, rgba(18, 36, 51, 0.9), rgba(11, 25, 38, 0.88))",
  };
}

function getSteamAchievementSelectLabelStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.76)", flexShrink: 0, whiteSpace: "nowrap" };
}

function getSteamAchievementSelectValueStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.96)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
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

function getSteamAchievementSelectedGroupStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    width: "100%",
    minWidth: 0,
    padding: "2px 4px 0",
    color: "rgba(255, 255, 255, 0.72)",
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
    color: "rgba(255, 255, 255, 0.98)",
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
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly string[];
  readonly formatValue: (value: string) => string;
  readonly onChange: (value: string) => void;
  readonly onCancel: () => void;
  readonly nativeDropdown?: boolean;
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
      if (activeMenuRef.current !== undefined || buttonRef.current === null) return;
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
        onActivate={openMenu}
        onClick={openMenu}
        onFocus={(event) => { setIsFocused(true); scrollFocusedElementIntoView(event); }}
        onGamepadFocus={(event) => { setIsFocused(true); scrollFocusedGamepadElementIntoView(event); }}
        onBlur={() => { setIsFocused(false); }}
        onCancel={() => {
          if (activeMenuRef.current !== undefined) closeMenu();
          else onCancel();
        }}
        style={getSteamAchievementSelectButtonStyle(isFocused)}
        data-achievement-companion-steam-filter-control="true"
      >
        <span style={getSteamAchievementSelectLabelStyle()}>{label}:</span>
        <span style={getSteamAchievementSelectValueStyle()}>{formatValue(value)}</span>
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
      onActivate={() => { onChange(nextValue); }}
      onClick={() => { onChange(nextValue); }}
      onFocus={(event) => { setIsFocused(true); scrollFocusedElementIntoView(event); }}
      onGamepadFocus={(event) => { setIsFocused(true); scrollFocusedGamepadElementIntoView(event); }}
      onBlur={() => { setIsFocused(false); }}
      onCancel={onCancel}
      style={getSteamAchievementSelectButtonStyle(isFocused)}
      data-achievement-companion-steam-filter-control="true"
    >
      <span style={getSteamAchievementSelectLabelStyle()}>{label}:</span>
      <span style={getSteamAchievementSelectValueStyle()}>{formatValue(value)}</span>
      <span aria-hidden="true" style={getSteamAchievementSelectChevronStyle()} />
    </Focusable>
  );
}

function getAchievementBrowserSummaryStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.92)", fontSize: "0.94em", lineHeight: 1.35 };
}

function getAchievementBrowserMetaStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.68)", fontSize: "0.86em", lineHeight: 1.25 };
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

export interface DeckyFullScreenAchievementBrowserProps {
  readonly achievementFilter: AchievementFilter;
  readonly achievementModeFilter: AchievementModeFilter;
  readonly achievementGroupFilter: AchievementGroupFilter;
  readonly achievementAvailabilityFilter: AchievementAvailabilityFilter;
  readonly achievementSummary: string;
  readonly allAchievements: readonly NormalizedAchievement[];
  readonly achievements: readonly NormalizedAchievement[];
  readonly providerId: string | undefined;
  readonly filteredAchievementCount: number;
  readonly onAchievementFilterChange: (filter: AchievementFilter) => void;
  readonly onAchievementModeFilterChange: (filter: AchievementModeFilter) => void;
  readonly onAchievementGroupFilterChange: (filter: AchievementGroupFilter) => void;
  readonly onAchievementAvailabilityFilterChange: (filter: AchievementAvailabilityFilter) => void;
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
  achievementSummary, allAchievements, achievements, providerId,
  filteredAchievementCount, onAchievementFilterChange, onAchievementModeFilterChange,
  onAchievementGroupFilterChange, onAchievementAvailabilityFilterChange,
  onOpenAchievementDetail, onBack, onJumpToTop, onFocusAchievement, steamHuntersAchievementsBySteamAchievementId,
  steamHuntersAchievementGroupsBySteamAchievementId, steamHuntersAchievementGroups,
}: DeckyFullScreenAchievementBrowserProps): JSX.Element {
  const showAchievementModeFilter = shouldRenderAchievementModeFilter(providerId);
  const isSteamProvider = providerId === "steam";
  const groupOptions = getAchievementGroupFilterOptions(allAchievements, steamHuntersAchievementGroupsBySteamAchievementId, steamHuntersAchievementGroups);
  const availabilityOptions = getAchievementAvailabilityFilterOptions(allAchievements, steamHuntersAchievementsBySteamAchievementId);
  const visibleGroupFilter = groupOptions.includes(achievementGroupFilter) ? achievementGroupFilter : "all";
  const visibleAvailabilityFilter = availabilityOptions.includes(achievementAvailabilityFilter) ? achievementAvailabilityFilter : "all";
  return (
    <Focusable
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
        <div style={getAchievementBrowserCardStyle()}>
          <div style={getAchievementBrowserHeaderStyle()}>Filtered view</div>
          <div style={getAchievementBrowserSummaryStyle()}>{achievementSummary}</div>
          <div style={getAchievementBrowserMetaStyle()}>
            {formatAchievementVisibilitySummary(achievements.length, filteredAchievementCount, achievementFilter)}
          </div>
          <div style={getAchievementBrowserMetaStackStyle()}>
            {showAchievementModeFilter ? (
              <>
                <div style={getAchievementBrowserSectionLabelStyle()}>Mode / State</div>
                <Focusable
                  flow-children="left-right"
                  tabIndex={-1}
                  style={getAchievementFilterGridStyle()}
                >
                  {ACHIEVEMENT_MODE_FILTERS.map((filter) => (
                    <AchievementFilterButton key={`mode-${filter}`} label={formatAchievementModeLabel(filter)} selected={filter === achievementModeFilter} onActivate={() => onAchievementModeFilterChange(filter)} onCancel={onBack} />
                  ))}
                  {ACHIEVEMENT_FILTERS.map((filter) => (
                    <AchievementFilterButton key={`state-${filter}`} label={formatAchievementFilterLabel(filter)} selected={filter === achievementFilter} onActivate={() => onAchievementFilterChange(filter)} onCancel={onBack} />
                  ))}
                </Focusable>
              </>
            ) : (
              <>
                <div style={getAchievementBrowserSectionLabelStyle()}>State</div>
                <Focusable
                  flow-children="left-right"
                  tabIndex={-1}
                  style={getAchievementFilterGridStyle()}
                >
                  {ACHIEVEMENT_FILTERS.map((filter) => (
                    <AchievementFilterButton key={filter} label={formatAchievementFilterLabel(filter)} selected={filter === achievementFilter} onActivate={() => onAchievementFilterChange(filter)} onCancel={onBack} />
                  ))}
                </Focusable>
              </>
            )}
          </div>
        </div>
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
          {achievements.map((achievement) => (
            <PanelSectionRow key={achievement.achievementId}>
              <DeckyFullScreenAchievementRow
                achievement={achievement}
                onOpenAchievementDetail={onOpenAchievementDetail}
                onBack={onBack}
                {...(onJumpToTop !== undefined ? { onJumpToTop } : {})}
                {...(onFocusAchievement !== undefined ? { onFocusAchievement } : {})}
                steamHuntersAchievement={steamHuntersAchievementsBySteamAchievementId?.[achievement.achievementId]}
              />
            </PanelSectionRow>
          ))}
        </Focusable>
      ) : (
        <PanelSectionRow>
          <Field bottomSeparator="none" description={formatAchievementFilterEmptyMessage(achievementFilter)} label="Achievements" />
        </PanelSectionRow>
      )}
    </Focusable>
  );
}
