import { Focusable, GamepadButton, NavEntryPositionPreferences, useQuickAccessVisible, type GamepadEvent } from "@decky/ui";
import type { DashboardSnapshot, RecentUnlock, RecentlyPlayedGame } from "@core/domain";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type RefCallback,
  type ReactNode,
} from "react";
import type { SteamHuntersProfile } from "../../providers/steamhunters";
import { steamRecipes, steamTheme } from "./steam-theme";
import { DeckySteamHuntersIcon } from "./decky-steam-icons";
import { addProfileAvatarCacheBustParam } from "./decky-avatar-cache-busting";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { findDeckyScrollableAncestor } from "./decky-scroll-viewport";
import {
  formatProfileMemberSince,
  formatSteamPlaytimeMinutes,
  type SteamAccountProgressSummary,
} from "./decky-stat-helpers";
import { getSteamCompactGameArtworkUrl } from "./decky-steam-game-artwork";
import { getSteamCompactActionStyle, type DeckySteamCompactActionTone } from "./decky-steam-compact-action-styles";
import {
  getDeckySteamCompactFocusTargetKey,
  readDeckySteamCompactFocusRestoreRequest,
  readDeckySteamCompactFocusTarget,
  setDeckySteamCompactFocusTarget,
  subscribeToDeckySteamCompactFocusRestore,
  type DeckySteamCompactFocusTarget,
} from "./decky-steam-compact-focus-state";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";
import { buildSteamActivityStats } from "./decky-steam-activity-data";
import {
  buildSteamActivityCalendarModel,
  type SteamActivityCalendarIntensity,
  type SteamActivityCalendarWeeks,
} from "./decky-steam-activity-calendar-model";
import {
  buildSteamCompactActivityGamesForDay,
  filterSteamActivityEntriesForDay,
  getSteamActivityLocalDayTimestamp,
  STEAM_COMPACT_ACTIVITY_CALENDAR_WEEKS,
} from "./decky-steam-compact-activity-data";
import {
  readDeckySteamCompactActivityDay,
  setDeckySteamCompactActivityDay,
} from "./decky-steam-compact-activity-state";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import externalLinkIconUrl from "./assets/external-link.svg";
import masteredIconUrl from "./assets/mastered.svg";
import rankPointsIconUrl from "./assets/rank-points.svg";
import settingsIconUrl from "./assets/settings.svg";
import starIconUrl from "./assets/star.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";

export type { DeckySteamCompactActionTone } from "./decky-steam-compact-action-styles";
type SteamCompactIconTone = "blue" | "gold" | "purple";
interface CompactTargetProps {
  readonly elementRef?: RefCallback<HTMLDivElement>;
  readonly onActivated: (element: HTMLElement) => void;
  readonly onFocused: (element: HTMLElement) => void;
  readonly preferredFocus: boolean;
}

export interface DeckySteamCompactProfileProps {
  readonly profile: DashboardSnapshot["profile"];
  readonly steamAccountProgress: SteamAccountProgressSummary;
  readonly steamHuntersProfile: SteamHuntersProfile | undefined;
  readonly activityEntries: readonly RecentUnlock[];
  readonly activityKnownGames: readonly RecentlyPlayedGame[];
  readonly recentAchievements: readonly RecentUnlock[];
  readonly recentlyPlayedGames: readonly RecentlyPlayedGame[];
  readonly refreshedAt: number | undefined;
  readonly activityCalendarWeeks?: SteamActivityCalendarWeeks;
  readonly onOpenProfile: () => void;
  readonly onOpenAchievementHistory: () => void;
  readonly onOpenCompletionProgress: () => void;
  readonly onOpenAchievementDetail: (recentUnlock: RecentUnlock) => void;
  readonly onOpenGameDetail: (game: RecentlyPlayedGame) => void;
  readonly onOpenSettings: () => void;
  readonly onCancel: () => void;
}

function scrollCompactViewToTop(target: HTMLElement, isStillFocused: () => boolean): void {
  const scrollable = findDeckyScrollableAncestor(target);
  if (scrollable === null) {
    return;
  }

  const resetScroll = (): void => {
    if (target.isConnected && isStillFocused()) {
      scrollable.scrollTop = 0;
    }
  };

  resetScroll();
  // Decky may apply its own focus scroll after the focus callback.
  const ownerWindow = target.ownerDocument.defaultView;
  ownerWindow?.requestAnimationFrame(() => {
    ownerWindow.requestAnimationFrame(resetScroll);
  });
}

function scrollFocusedCompactAction(
  target: HTMLElement,
  scrollToTopOnFocus: boolean,
  isStillFocused: () => boolean,
): void {
  if (scrollToTopOnFocus) {
    scrollCompactViewToTop(target, isStillFocused);
    return;
  }

  // The QAM content lives in a different browser realm from the injected
  // plugin bundle, so shared `instanceof HTMLElement` guards cannot safely
  // identify this node. Use the node's own native scrolling method.
  target.scrollIntoView({ block: "center", inline: "nearest" });
}

function getRootStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
    minWidth: 0,
    padding: "0 16px 4px",
    boxSizing: "border-box",
    color: steamTheme.color.textPrimary,
    fontFamily: steamTheme.type.fontFamily,
  };
}

function getSectionStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    minWidth: 0,
  };
}

function getSectionHeaderStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    minHeight: 16,
    minWidth: 0,
  };
}

function getSectionTitleStyle(): CSSProperties {
  return {
    color: steamTheme.color.accent,
    fontSize: steamTheme.type.compact.heading,
    fontWeight: 850,
    letterSpacing: "0.055em",
    lineHeight: 1,
    textTransform: "uppercase",
  };
}

export function DeckySteamCompactAction({
  ariaLabel,
  children,
  onActivate,
  onActivated,
  onCancel,
  elementRef,
  onFocused,
  preferredFocus = false,
  scrollToTopOnFocus = false,
  style,
  tone = "row",
  dataAttributes,
}: {
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly onActivate: () => void;
  readonly onActivated?: ((target: HTMLElement) => void) | undefined;
  readonly onCancel: () => void;
  readonly elementRef?: RefCallback<HTMLDivElement> | undefined;
  readonly onFocused?: ((target: HTMLElement) => void) | undefined;
  readonly preferredFocus?: boolean | undefined;
  readonly scrollToTopOnFocus?: boolean;
  readonly style?: CSSProperties;
  readonly tone?: DeckySteamCompactActionTone;
  readonly dataAttributes?: Readonly<Record<string, string>>;
}): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const actionElementRef = useRef<HTMLDivElement | null>(null);
  const focusGeneration = useRef(0);
  const activate = (): void => {
    const target = actionElementRef.current;
    if (target !== null) {
      onActivated?.(target);
    }
    onActivate();
  };

  return (
    <Focusable
      noFocusRing
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      {...dataAttributes}
      ref={(node) => {
        actionElementRef.current = node;
        elementRef?.(node);
      }}
      preferredFocus={preferredFocus}
      onActivate={activate}
      onClick={activate}
      onCancel={onCancel}
      onFocus={(event) => {
        const generation = ++focusGeneration.current;
        setIsFocused(true);
        scrollFocusedCompactAction(event.currentTarget, scrollToTopOnFocus, () => focusGeneration.current === generation);
        onFocused?.(event.currentTarget);
      }}
      onGamepadFocus={(event) => {
        const generation = ++focusGeneration.current;
        setIsFocused(true);
        scrollFocusedCompactAction(event.currentTarget as HTMLElement, scrollToTopOnFocus, () => focusGeneration.current === generation);
        onFocused?.(event.currentTarget as HTMLElement);
      }}
      onBlur={() => {
        focusGeneration.current += 1;
        setIsFocused(false);
      }}
      style={{ ...getSteamCompactActionStyle(tone, isFocused), ...style }}
    >
      {children}
    </Focusable>
  );
}

function getIconStyle(size: number, tone: SteamCompactIconTone = "blue"): CSSProperties {
  return {
    display: "block",
    width: size,
    height: size,
    flexShrink: 0,
    filter: tone === "gold" ? steamTheme.iconFilter.reward : tone === "purple" ? steamTheme.iconFilter.rarityPurple : steamTheme.iconFilter.accent,
  };
}

function getProfileCardStyle(): CSSProperties {
  return {
    ...steamRecipes.card("compact", "raised"),
    display: "flex",
    flexDirection: "column",
    gap: 7,
    padding: 9,
    boxSizing: "border-box",
    boxShadow: "inset 0 1px 0 rgba(125, 211, 252, 0.035)",
  };
}

function getIdentityStyle(): CSSProperties {
  return { display: "flex", alignItems: "center", gap: 10, minWidth: 0 };
}

function getAvatarFrameStyle(): CSSProperties {
  return {
    width: 60,
    height: 60,
    flex: "0 0 60px",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    padding: 2,
    border: "2px solid #22bfff",
    borderRadius: 8,
    background: "linear-gradient(145deg, rgba(54, 185, 255, 0.2), rgba(5, 22, 34, 0.96))",
    boxShadow: "0 0 12px rgba(54, 185, 255, 0.22)",
    boxSizing: "border-box",
  };
}

function getAvatarFallbackStyle(): CSSProperties {
  return {
    display: "grid",
    placeItems: "center",
    width: "100%",
    height: "100%",
    color: "#f2f6fb",
    fontSize: 18,
    fontWeight: 850,
  };
}

function getIdentityTextStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 };
}

function getProfileNameStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#f4f8fb",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.1,
  };
}

function getProfileMetaStyle(): CSSProperties {
  return { ...steamRecipes.text("compact", "metadata"), color: steamTheme.color.textSecondary, lineHeight: 1.25 };
}

function getLevelRowStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    color: "#f2f6fb",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1,
  };
}

function getXpValueStyle(): CSSProperties {
  return { color: "#8ed7ff", fontWeight: 800 };
}

function getProgressTrackStyle(): CSSProperties {
  return {
    ...steamRecipes.progressTrack,
    height: 7,
    overflow: "hidden",
    borderRadius: 999,
    boxShadow: "inset 0 0 0 1px rgba(125, 211, 252, 0.05)",
  };
}

function getProgressFillStyle(percent: number): CSSProperties {
  return {
    width: `${Math.max(0, Math.min(100, percent))}%`,
    height: "100%",
    borderRadius: 999,
    background: steamRecipes.progressFill.xp,
  };
}

function getXpCaptionStyle(): CSSProperties {
  return { ...steamRecipes.text("compact", "caption"), color: steamTheme.color.textMuted, lineHeight: 1.2 };
}

function getPrimaryActionLabelStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    width: "100%",
    minWidth: 0,
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1,
  };
}

function getMetricsGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 5,
    minWidth: 0,
  };
}

const COMPACT_ACTIVITY_CALENDAR_COLORS: Record<SteamActivityCalendarIntensity, string> = {
  0: "#1d3c51",
  1: "#21546f",
  2: "#267da9",
  3: "#2fb9ef",
  4: "#50d5ff",
};

function moveCompactCalendarFocus(event: GamepadEvent, target: HTMLElement | null | undefined): void {
  const source = event.currentTarget as HTMLElement;
  if (!takeDeckySteamGamepadFocus(target)) return;
  event.preventDefault();
  event.stopPropagation();
  if (target !== source) playDeckySteamNavigationSound(source.ownerDocument);
}

function handleCompactCalendarDirection(event: GamepadEvent): void {
  const source = event.currentTarget as HTMLElement;
  const root = source.closest<HTMLElement>("[data-achievement-companion-steam-compact-profile]");
  const cells = Array.from(root?.querySelectorAll<HTMLElement>("[data-steam-compact-activity-calendar-day='true']") ?? []);
  const index = cells.indexOf(source);
  const row = index % 7;
  const column = Math.floor(index / 7);
  const columns = Math.ceil(cells.length / 7);
  const button = event.detail.button;
  let target: HTMLElement | null | undefined;
  if (button === GamepadButton.DIR_UP) {
    target = row > 0
      ? cells[index - 1]
      : root?.querySelector<HTMLElement>("[data-steam-compact-profile-action='true']") ?? source;
  }
  else if (button === GamepadButton.DIR_DOWN) {
    target = row < 6
      ? cells[index + 1] ?? source
      : root?.querySelector<HTMLElement>("[data-steam-compact-recent-achievement='true']") ?? source;
  } else if (button === GamepadButton.DIR_LEFT) target = column > 0 ? cells[index - 7] : source;
  else if (button === GamepadButton.DIR_RIGHT) target = column < columns - 1 ? cells[index + 7] ?? source : source;
  if (target !== undefined) moveCompactCalendarFocus(event, target);
}

function CompactActivityCalendarDay({ day, count, intensity, current, selected, onSelect, onCancel, targetProps }: {
  readonly day: number;
  readonly count: number;
  readonly intensity: SteamActivityCalendarIntensity;
  readonly current: boolean;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onCancel: () => void;
  readonly targetProps: CompactTargetProps;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const dateLabel = new Date(day).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const activate = (): void => {
    if (elementRef.current !== null) targetProps.onActivated(elementRef.current);
    onSelect();
  };
  return (
    <Focusable
      noFocusRing
      role="button"
      tabIndex={0}
      aria-label={`${dateLabel}, ${count} unlock${count === 1 ? "" : "s"}`}
      aria-pressed={selected}
      ref={(node) => { elementRef.current = node; targetProps.elementRef?.(node); }}
      preferredFocus={targetProps.preferredFocus}
      data-steam-compact-activity-calendar-day="true"
      data-steam-compact-activity-calendar-current={current ? "true" : "false"}
      data-steam-compact-activity-calendar-selected={selected ? "true" : "false"}
      data-steam-compact-activity-calendar-count={count}
      data-steam-compact-activity-calendar-intensity={intensity}
      onActivate={activate}
      onClick={activate}
      onCancel={onCancel}
      onGamepadDirection={handleCompactCalendarDirection}
      onFocus={(event) => { setFocused(true); event.currentTarget.scrollIntoView({ block: "center", inline: "nearest" }); targetProps.onFocused(event.currentTarget); }}
      onGamepadFocus={(event) => { setFocused(true); (event.currentTarget as HTMLElement).scrollIntoView({ block: "center", inline: "nearest" }); targetProps.onFocused(event.currentTarget as HTMLElement); }}
      onBlur={() => setFocused(false)}
      style={{
        width: 22,
        height: 22,
        minWidth: 22,
        minHeight: 22,
        padding: 0,
        border: selected ? `2px solid ${steamTheme.color.textPrimary}` : "2px solid transparent",
        borderRadius: 4,
        outline: "none",
        background: COMPACT_ACTIVITY_CALENDAR_COLORS[intensity],
        boxShadow: focused ? steamTheme.focus.compactShadow : "none",
        boxSizing: "border-box",
      }}
    >{null}</Focusable>
  );
}

function getMetricStyle(): CSSProperties {
  return {
    ...steamRecipes.metricTile("compact"),
    display: "grid",
    gridTemplateColumns: "28px minmax(0, 1fr)",
    alignItems: "center",
    gap: 7,
    minHeight: 49,
    minWidth: 0,
    padding: "6px 8px",
    boxSizing: "border-box",
  };
}

function getMetricTextStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, minWidth: 0, textAlign: "center" };
}

function getMetricLabelStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflowWrap: "anywhere",
    whiteSpace: "normal",
    ...steamRecipes.text("compact", "metadata"),
    color: steamTheme.color.textSecondary,
    fontSize: 11,
    lineHeight: 1.12,
  };
}

function getMetricValueStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    ...steamRecipes.text("compact", "title"),
    color: steamTheme.color.textPrimary,
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.05,
  };
}

function SteamHuntersMetric({
  icon,
  iconUrl,
  label,
  tone,
  value,
  rankTrend,
}: {
  readonly icon?: ReactNode;
  readonly iconUrl?: string;
  readonly label: string;
  readonly tone: SteamCompactIconTone;
  readonly value: string;
  readonly rankTrend?: SteamHuntersProfile["globalPointsRankTrend"];
}): JSX.Element {
  return (
    <div style={getMetricStyle()}>
      {icon ?? (iconUrl !== undefined ? <img alt="" src={iconUrl} style={getIconStyle(27, tone)} /> : null)}
      <div style={getMetricTextStyle()}>
        <div style={getMetricLabelStyle()}>{label}</div>
        <div style={getMetricValueStyle()}>
          {rankTrend === "up" || rankTrend === "down" ? <span aria-label={rankTrend === "up" ? "Rank improved" : "Rank declined"} style={{ color: rankTrend === "up" ? "#43dd7f" : "#ff5d5d", marginRight: 3 }}>{rankTrend === "up" ? "↑" : "↓"}</span> : null}
          {value}
        </div>
      </div>
    </div>
  );
}

function getListStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 };
}

function getListRowStyle(height: number): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 8,
    minHeight: height,
    padding: "5px 7px",
    boxSizing: "border-box",
  };
}

function getAchievementArtworkFrameStyle(): CSSProperties {
  return {
    width: 34,
    height: 34,
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    border: "1px solid rgba(255, 166, 39, 0.34)",
    borderRadius: 6,
    background: "rgba(6, 22, 33, 0.76)",
    boxSizing: "border-box",
  };
}

function getGameArtworkFallbackStyle(): CSSProperties {
  return {
    width: 34,
    height: 34,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    border: "1px solid rgba(54, 142, 191, 0.2)",
    borderRadius: 6,
    background: "rgba(8, 37, 55, 0.86)",
    color: "#86cfff",
    fontSize: 8,
    fontWeight: 800,
    boxSizing: "border-box",
  };
}

function getRowTextStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 };
}

function getRowTitleStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#f1f6fa",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.1,
  };
}

function getRowMetaStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#83a4bc",
    fontSize: 9,
    lineHeight: 1.1,
  };
}

function getRowTrailingStyle(): CSSProperties {
  return { display: "flex", alignItems: "center", gap: 6, flexShrink: 0, minWidth: 0 };
}

function getPlaytimeStyle(): CSSProperties {
  return {
    maxWidth: 62,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#75bde4",
    fontSize: 8.5,
    lineHeight: 1,
  };
}

function getSettingsIconFrameStyle(): CSSProperties {
  return {
    display: "grid",
    placeItems: "center",
    width: 28,
    height: 28,
    flex: "0 0 28px",
    borderRadius: 7,
    background: "rgba(73, 126, 158, 0.18)",
  };
}

function getSettingsLabelStyle(): CSSProperties {
  return { flex: "1 1 auto", minWidth: 0, fontSize: 11, fontWeight: 800 };
}

function formatCount(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString();
}

function formatRank(value: number | undefined): string {
  return value === undefined ? "—" : `#${value.toLocaleString()}`;
}

function formatRelativeTime(epochMs: number | undefined): string | undefined {
  if (epochMs === undefined) {
    return undefined;
  }

  const elapsedMs = Date.now() - epochMs;
  const absoluteMs = Math.abs(elapsedMs);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const formatValue = (value: number, unit: Intl.RelativeTimeFormatUnit): string =>
    formatter.format(elapsedMs >= 0 ? -value : value, unit);

  if (absoluteMs < 60_000) {
    return formatValue(Math.max(1, Math.round(absoluteMs / 1000)), "second");
  }
  if (absoluteMs < 3_600_000) {
    return formatValue(Math.max(1, Math.round(absoluteMs / 60_000)), "minute");
  }
  if (absoluteMs < 86_400_000) {
    return formatValue(Math.max(1, Math.round(absoluteMs / 3_600_000)), "hour");
  }

  return formatValue(Math.max(1, Math.round(absoluteMs / 86_400_000)), "day");
}

function formatAchievementTime(recentUnlock: RecentUnlock): string {
  const relativeTime = formatRelativeTime(recentUnlock.unlockedAt ?? recentUnlock.achievement.unlockedAt);
  return relativeTime === undefined ? "Unlocked" : `Unlocked · ${relativeTime}`;
}

function formatGameProgress(game: RecentlyPlayedGame): string {
  const count = game.summary.totalCount === undefined
    ? `${formatCount(game.summary.unlockedCount)} unlocked`
    : `${formatCount(game.summary.unlockedCount)} / ${formatCount(game.summary.totalCount)}`;
  return game.summary.completionPercent === undefined
    ? count
    : `${count} · ${game.summary.completionPercent}%`;
}

function isToday(epochMs: number | undefined): boolean {
  if (epochMs === undefined) {
    return false;
  }

  const value = new Date(epochMs);
  const today = new Date();
  return value.getFullYear() === today.getFullYear()
    && value.getMonth() === today.getMonth()
    && value.getDate() === today.getDate();
}

function formatGamePlaytime(game: RecentlyPlayedGame): string | undefined {
  const playtime = formatSteamPlaytimeMinutes(
    game.playtimeTwoWeeksMinutes ?? game.playtimeDeckForeverMinutes ?? game.playtimeForeverMinutes,
  );
  if (playtime === undefined) {
    return undefined;
  }

  return isToday(game.lastPlayedAt) ? `${playtime} today` : playtime;
}

function formatRefreshTime(epochMs: number | undefined): string | undefined {
  if (epochMs === undefined || !Number.isFinite(epochMs)) {
    return undefined;
  }

  return new Date(epochMs).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRefreshTimestampStyle(): CSSProperties {
  return {
    width: "100%",
    paddingTop: 2,
    color: "#779bb4",
    fontSize: 8.5,
    lineHeight: 1.1,
    textAlign: "center",
  };
}

function getInitials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "AC";
}

function ProfileCard({
  profile,
  progress,
  refreshedAt,
}: Pick<DeckySteamCompactProfileProps, "profile" | "refreshedAt"> & {
  readonly progress: SteamAccountProgressSummary;
}): JSX.Element {
  const avatarUrl = addProfileAvatarCacheBustParam(profile.identity.avatarUrl, refreshedAt);
  const memberSince = formatProfileMemberSince(profile.metrics);

  return (
    <div style={getProfileCardStyle()}>
      <div style={getIdentityStyle()}>
        <div style={getAvatarFrameStyle()}>
          {avatarUrl !== undefined ? (
            <DeckyGameArtwork compact src={avatarUrl} size={54} title={profile.identity.displayName} />
          ) : (
            <span style={getAvatarFallbackStyle()}>{getInitials(profile.identity.displayName)}</span>
          )}
        </div>
        <div style={getIdentityTextStyle()}>
          <div style={getProfileNameStyle()}>{profile.identity.displayName}</div>
          <div style={getProfileMetaStyle()}>
            {memberSince === undefined ? "Member since unknown" : `Member since ${memberSince}`}
          </div>
        </div>
      </div>
      <div style={getLevelRowStyle()}>
        <span>{`Level ${progress.steamLevelValue}`}</span>
        <span style={getXpValueStyle()}>{progress.badgesSecondary ?? "XP unavailable"}</span>
      </div>
      <div
        aria-label="Steam level progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress.xpProgressPercent ?? 0}
        role="progressbar"
        style={getProgressTrackStyle()}
      >
        <div style={getProgressFillStyle(progress.xpProgressPercent ?? 0)} />
      </div>
      <div style={getXpCaptionStyle()}>{progress.xpProgressCaption}</div>
    </div>
  );
}

function SectionHeader({ title }: { readonly title: string }): JSX.Element {
  return (
    <div style={getSectionHeaderStyle()}>
      <div style={getSectionTitleStyle()}>{title}</div>
    </div>
  );
}

function CompactActivityCalendar({ dayCounts, weeks, selectedDay, onSelectDay, onCancel, targetProps }: {
  readonly dayCounts: ReadonlyMap<number, number>;
  readonly weeks: SteamActivityCalendarWeeks;
  readonly selectedDay: number | undefined;
  readonly onSelectDay: (day: number) => void;
  readonly onCancel: () => void;
  readonly targetProps: (day: number) => CompactTargetProps;
}): JSX.Element {
  const model = useMemo(() => buildSteamActivityCalendarModel(dayCounts, weeks), [dayCounts, weeks]);
  const today = getSteamActivityLocalDayTimestamp(Date.now());
  const start = model.days[0]?.day ?? 0;
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const status = selectedDay === undefined
    ? `Last ${weeks} weeks`
    : new Date(selectedDay).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <div
      data-steam-compact-activity-calendar
      data-steam-compact-activity-calendar-weeks={weeks}
      style={{ ...steamRecipes.card("compact"), padding: 8, minWidth: 0 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <span style={{ color: steamTheme.color.textPrimary, fontSize: 10, fontWeight: 800 }}>ACTIVITY CALENDAR</span>
        <span style={{ color: selectedDay === undefined ? steamTheme.color.textMuted : steamTheme.color.accent, fontSize: 9, fontWeight: selectedDay === undefined ? 600 : 800 }}>{status}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `18px repeat(${weeks}, 22px)`, gridTemplateRows: "repeat(7, 22px)", justifyContent: "center", gap: 3, marginTop: 7 }}>
        {labels.map((label, row) => <span key={`${label}:${row}`} style={{ gridColumn: 1, gridRow: row + 1, alignSelf: "center", color: steamTheme.color.textMuted, fontSize: 8 }}>{label}</span>)}
        {model.days.map(({ day, count, intensity }) => {
          const offset = Math.floor((day - start) / 86_400_000);
          return (
            <div key={day} style={{ gridColumn: Math.floor(offset / 7) + 2, gridRow: offset % 7 + 1 }}>
              {today !== undefined && day <= today ? <CompactActivityCalendarDay
                day={day}
                count={count}
                intensity={intensity}
                current={day === today}
                selected={day === selectedDay}
                onSelect={() => onSelectDay(day)}
                onCancel={onCancel}
                targetProps={targetProps(day)}
              /> : <span aria-hidden="true" style={{ display: "block", width: 22, height: 22, borderRadius: 4, background: COMPACT_ACTIVITY_CALENDAR_COLORS[0] }} />}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 7, color: steamTheme.color.textMuted, fontSize: 8 }}>
        <span>Less</span>
        {([0, 1, 2, 3, 4] as const).map((level) => <span key={level} style={{ width: 10, height: 10, borderRadius: 2, background: COMPACT_ACTIVITY_CALENDAR_COLORS[level] }} />)}
        <span>More</span>
      </div>
    </div>
  );
}

function ViewAllAction({
  ariaLabel,
  elementRef,
  onActivate,
  onActivated,
  onCancel,
  onFocused,
  preferredFocus,
}: {
  readonly ariaLabel: string;
  readonly elementRef?: RefCallback<HTMLDivElement> | undefined;
  readonly onActivate: () => void;
  readonly onActivated?: ((target: HTMLElement) => void) | undefined;
  readonly onCancel: () => void;
  readonly onFocused?: ((target: HTMLElement) => void) | undefined;
  readonly preferredFocus?: boolean | undefined;
}): JSX.Element {
  return (
    <DeckySteamCompactAction
      ariaLabel={ariaLabel}
      elementRef={elementRef}
      onActivate={onActivate}
      onActivated={onActivated}
      onCancel={onCancel}
      onFocused={onFocused}
      preferredFocus={preferredFocus}
      style={{ minHeight: 30, padding: "5px 8px" }}
    >
      <span style={{ flex: "1 1 auto", color: "#69cfff", fontSize: 10, fontWeight: 800, textAlign: "center" }}>
        View All
      </span>
      <img alt="" src={chevronRightIconUrl} style={getIconStyle(15)} />
    </DeckySteamCompactAction>
  );
}

function RecentAchievementItem({
  elementRef,
  recentUnlock,
  onActivate,
  onActivated,
  onCancel,
  onFocused,
  preferredFocus,
}: {
  readonly elementRef?: RefCallback<HTMLDivElement> | undefined;
  readonly recentUnlock: RecentUnlock;
  readonly onActivate: () => void;
  readonly onActivated?: ((target: HTMLElement) => void) | undefined;
  readonly onCancel: () => void;
  readonly onFocused?: ((target: HTMLElement) => void) | undefined;
  readonly preferredFocus?: boolean | undefined;
}): JSX.Element {
  return (
    <DeckySteamCompactAction
      ariaLabel={`Open ${recentUnlock.achievement.title}`}
      dataAttributes={{ "data-steam-compact-recent-achievement": "true" }}
      elementRef={elementRef}
      onActivate={onActivate}
      onActivated={onActivated}
      onCancel={onCancel}
      onFocused={onFocused}
      preferredFocus={preferredFocus}
      style={getListRowStyle(46)}
    >
      <span style={getAchievementArtworkFrameStyle()}>
        {recentUnlock.achievement.badgeImageUrl !== undefined ? (
          <DeckyGameArtwork
            compact
            src={recentUnlock.achievement.badgeImageUrl}
            size={32}
            title={recentUnlock.achievement.title}
          />
        ) : (
          <img alt="" src={trophyIconUrl} style={getIconStyle(21, "gold")} />
        )}
      </span>
      <span style={getRowTextStyle()}>
        <span style={getRowTitleStyle()}>{recentUnlock.achievement.title}</span>
        <span style={getRowMetaStyle()}>{formatAchievementTime(recentUnlock)}</span>
      </span>
      <img alt="" src={chevronRightIconUrl} style={getIconStyle(17)} />
    </DeckySteamCompactAction>
  );
}

function RecentlyPlayedItem({
  elementRef,
  game,
  activityUnlockCount,
  onActivate,
  onActivated,
  onCancel,
  onFocused,
  preferredFocus,
}: {
  readonly elementRef?: RefCallback<HTMLDivElement> | undefined;
  readonly game: RecentlyPlayedGame;
  readonly activityUnlockCount?: number;
  readonly onActivate: () => void;
  readonly onActivated?: ((target: HTMLElement) => void) | undefined;
  readonly onCancel: () => void;
  readonly onFocused?: ((target: HTMLElement) => void) | undefined;
  readonly preferredFocus?: boolean | undefined;
}): JSX.Element {
  const artworkUrl = getSteamCompactGameArtworkUrl(game);
  const playtime = activityUnlockCount === undefined ? formatGamePlaytime(game) : undefined;
  const progress = activityUnlockCount === undefined
    ? formatGameProgress(game)
    : `${activityUnlockCount.toLocaleString()} achievement${activityUnlockCount === 1 ? "" : "s"} unlocked`;

  return (
    <DeckySteamCompactAction
      ariaLabel={`Open ${game.title}`}
      elementRef={elementRef}
      onActivate={onActivate}
      onActivated={onActivated}
      onCancel={onCancel}
      onFocused={onFocused}
      preferredFocus={preferredFocus}
      style={getListRowStyle(50)}
    >
      {artworkUrl !== undefined ? (
        <DeckyGameArtwork compact src={artworkUrl} size={34} title={game.title} />
      ) : (
        <span style={getGameArtworkFallbackStyle()}>{getInitials(game.title)}</span>
      )}
      <span style={getRowTextStyle()}>
        <span style={getRowTitleStyle()}>{game.title}</span>
        <span style={getRowMetaStyle()}>{progress}</span>
      </span>
      <span style={getRowTrailingStyle()}>
        {playtime !== undefined ? <span style={getPlaytimeStyle()}>{playtime}</span> : null}
        <img alt="" src={chevronRightIconUrl} style={getIconStyle(17)} />
      </span>
    </DeckySteamCompactAction>
  );
}

function EmptyListRow({ label }: { readonly label: string }): JSX.Element {
  return (
    <div style={{ ...getListRowStyle(42), gridTemplateColumns: "minmax(0, 1fr)" }}>
      <span style={getRowMetaStyle()}>{label}</span>
    </div>
  );
}

export function DeckySteamCompactProfile({
  profile,
  steamAccountProgress,
  steamHuntersProfile,
  activityEntries,
  activityKnownGames,
  recentAchievements,
  recentlyPlayedGames,
  refreshedAt,
  activityCalendarWeeks = STEAM_COMPACT_ACTIVITY_CALENDAR_WEEKS,
  onOpenProfile,
  onOpenAchievementHistory,
  onOpenCompletionProgress,
  onOpenAchievementDetail,
  onOpenGameDetail,
  onOpenSettings,
  onCancel,
}: DeckySteamCompactProfileProps): JSX.Element {
  const isQuickAccessVisible = useQuickAccessVisible();
  const restorationRequest = useSyncExternalStore(
    subscribeToDeckySteamCompactFocusRestore,
    readDeckySteamCompactFocusRestoreRequest,
    readDeckySteamCompactFocusRestoreRequest,
  );
  const handledRestorationRequest = useRef(restorationRequest);
  const restorationTarget = useRef(readDeckySteamCompactFocusTarget()).current;
  const restorationKey = getDeckySteamCompactFocusTargetKey(restorationTarget);
  const restorationElementRef = useRef<HTMLDivElement | null>(null);
  const refreshTime = formatRefreshTime(refreshedAt);
  const [selectedActivityDay, setSelectedActivityDay] = useState(readDeckySteamCompactActivityDay);
  const activityStats = useMemo(() => buildSteamActivityStats(activityEntries), [activityEntries]);
  const visibleAchievements = useMemo(
    () => selectedActivityDay === undefined
      ? recentAchievements
      : filterSteamActivityEntriesForDay(activityEntries, selectedActivityDay),
    [activityEntries, recentAchievements, selectedActivityDay],
  );
  const filteredActivityGames = useMemo(
    () => selectedActivityDay === undefined
      ? undefined
      : buildSteamCompactActivityGamesForDay(visibleAchievements, activityKnownGames),
    [activityKnownGames, selectedActivityDay, visibleAchievements],
  );
  const visibleGames = filteredActivityGames?.map(({ game }) => game) ?? recentlyPlayedGames;
  const activityUnlockCounts = useMemo(
    () => new Map(filteredActivityGames?.map(({ game, unlockCount }) => [game.gameId, unlockCount]) ?? []),
    [filteredActivityGames],
  );
  const selectActivityDay = (day: number): void => {
    const nextDay = selectedActivityDay === day ? undefined : day;
    setSelectedActivityDay(nextDay);
    setDeckySteamCompactActivityDay(nextDay);
  };
  const targetProps = (target: DeckySteamCompactFocusTarget): {
    readonly elementRef?: RefCallback<HTMLDivElement>;
    readonly onActivated: (element: HTMLElement) => void;
    readonly onFocused: (element: HTMLElement) => void;
    readonly preferredFocus: boolean;
  } => {
    const key = getDeckySteamCompactFocusTargetKey(target);
    return {
      ...(key === restorationKey
        ? { elementRef: (node) => { restorationElementRef.current = node; } }
        : {}),
      onActivated: (element) => {
        const scrollTop = findDeckyScrollableAncestor(element)?.scrollTop ?? 0;
        setDeckySteamCompactFocusTarget(target, scrollTop);
      },
      onFocused: (element) => {
        const scrollTop = findDeckyScrollableAncestor(element)?.scrollTop ?? 0;
        setDeckySteamCompactFocusTarget(target, scrollTop);
      },
      preferredFocus: key === restorationKey,
    };
  };

  useLayoutEffect(() => {
    if (!isQuickAccessVisible) {
      return;
    }
    return requestDeckySteamGamepadFocusAfterMount(restorationElementRef.current);
  }, [isQuickAccessVisible, restorationKey]);

  useLayoutEffect(() => {
    if (
      !isQuickAccessVisible
      || handledRestorationRequest.current === restorationRequest
    ) {
      return;
    }
    handledRestorationRequest.current = restorationRequest;
    const target = restorationElementRef.current;
    if (target === null) {
      return;
    }
    return requestDeckySteamGamepadFocusAfterMount(target);
  }, [isQuickAccessVisible, restorationRequest]);

  useLayoutEffect(() => {
    if (selectedActivityDay === undefined) {
      return;
    }
    const isVisible = buildSteamActivityCalendarModel(activityStats.dayCounts, activityCalendarWeeks)
      .days.some(({ day }) => day === selectedActivityDay);
    if (!isVisible) {
      setSelectedActivityDay(undefined);
      setDeckySteamCompactActivityDay(undefined);
    }
  }, [activityCalendarWeeks, activityStats.dayCounts, selectedActivityDay]);

  return (
    <Focusable
      data-ac-steam-theme="compact"
      data-achievement-companion-steam-compact-profile
      navEntryPreferPosition={NavEntryPositionPreferences.PREFERRED_CHILD}
      preferredFocus
      style={getRootStyle()}
    >
      <section style={getSectionStyle()}>
        <SectionHeader title="Profile" />
        <ProfileCard profile={profile} progress={steamAccountProgress} refreshedAt={refreshedAt} />
        <DeckySteamCompactAction
          ariaLabel="Open Steam profile full-screen"
          dataAttributes={{ "data-steam-compact-profile-action": "true" }}
          onActivate={onOpenProfile}
          onCancel={onCancel}
          {...targetProps({ kind: "profile" })}
          scrollToTopOnFocus
          tone="primary"
        >
          <span style={getPrimaryActionLabelStyle()}>
            <img alt="" src={externalLinkIconUrl} style={getIconStyle(17)} />
            <span>Open Profile Full-Screen</span>
          </span>
        </DeckySteamCompactAction>
      </section>

      <section style={getSectionStyle()}>
        <SectionHeader title="SteamHunters Profile" />
        <div style={getMetricsGridStyle()}>
          <SteamHuntersMetric
            icon={<DeckySteamHuntersIcon color={steamTheme.color.accent} size={27} />}
            label="Points"
            tone="gold"
            value={formatCount(steamHuntersProfile?.points)}
          />
          <SteamHuntersMetric
            iconUrl={rankPointsIconUrl}
            label="Points Rank"
            tone="blue"
            value={formatRank(steamHuntersProfile?.globalPointsRank)}
            rankTrend={steamHuntersProfile?.globalPointsRankTrend}
          />
          <SteamHuntersMetric
            iconUrl={masteredIconUrl}
            label="Legendary Unlocks"
            tone="gold"
            value={formatCount(steamHuntersProfile?.legendaryAchievements)}
          />
          <SteamHuntersMetric
            iconUrl={starIconUrl}
            label="Completed Games"
            tone="gold"
            value={formatCount(steamHuntersProfile?.completedGames)}
          />
        </div>
      </section>

      <section style={getSectionStyle()}>
        <CompactActivityCalendar
          dayCounts={activityStats.dayCounts}
          weeks={activityCalendarWeeks}
          selectedDay={selectedActivityDay}
          onSelectDay={selectActivityDay}
          onCancel={onCancel}
          targetProps={(day) => targetProps({ kind: "calendar", day })}
        />
      </section>

      <section style={getSectionStyle()}>
        <SectionHeader title="Recent Activity" />
        <div data-steam-compact-recent-activity-count={visibleAchievements.length} style={getListStyle()}>
          {visibleAchievements.length > 0 ? visibleAchievements.map((recentUnlock) => (
            <RecentAchievementItem
              key={`${recentUnlock.game.gameId}:${recentUnlock.achievement.achievementId}`}
              recentUnlock={recentUnlock}
              onActivate={() => onOpenAchievementDetail(recentUnlock)}
              onCancel={onCancel}
              {...targetProps({
                kind: "achievement",
                gameId: recentUnlock.game.gameId,
                achievementId: recentUnlock.achievement.achievementId,
              })}
            />
          )) : <EmptyListRow label={selectedActivityDay === undefined ? "No recent achievements yet." : "No achievements unlocked on this date."} />}
        </div>
        <ViewAllAction
          ariaLabel="View all recent Steam achievements"
          onActivate={onOpenAchievementHistory}
          onCancel={onCancel}
          {...targetProps({ kind: "activity" })}
        />
      </section>

      <section style={getSectionStyle()}>
        <SectionHeader title="Recently Played" />
        <div data-steam-compact-recently-played-count={visibleGames.length} style={getListStyle()}>
          {visibleGames.length > 0 ? visibleGames.map((game) => (
            <RecentlyPlayedItem
              key={game.gameId}
              game={game}
              {...(activityUnlockCounts.has(game.gameId)
                ? { activityUnlockCount: activityUnlockCounts.get(game.gameId)! }
                : {})}
              onActivate={() => onOpenGameDetail(game)}
              onCancel={onCancel}
              {...targetProps({ kind: "game", gameId: game.gameId })}
            />
          )) : <EmptyListRow label={selectedActivityDay === undefined ? "No recently played games yet." : "No games with achievements on this date."} />}
        </div>
        <ViewAllAction
          ariaLabel="View all Steam games"
          onActivate={onOpenCompletionProgress}
          onCancel={onCancel}
          {...targetProps({ kind: "games" })}
        />
      </section>

      <DeckySteamCompactAction
        ariaLabel="Open Steam profile settings"
        onActivate={onOpenSettings}
        onCancel={onCancel}
        {...targetProps({ kind: "settings" })}
        style={{ minHeight: 40, padding: "5px 8px" }}
      >
        <span style={getSettingsIconFrameStyle()}>
          <img alt="" src={settingsIconUrl} style={getIconStyle(18)} />
        </span>
        <span style={getSettingsLabelStyle()}>Steam Settings</span>
        <img alt="" src={chevronRightIconUrl} style={getIconStyle(17)} />
      </DeckySteamCompactAction>
      {refreshTime === undefined ? null : (
        <div style={getRefreshTimestampStyle()}>{`Steam and SteamHunters refreshed ${refreshTime}`}</div>
      )}
    </Focusable>
  );
}
