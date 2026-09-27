import { Focusable, NavEntryPositionPreferences } from "@decky/ui";
import type { DashboardSnapshot, RecentUnlock, RecentlyPlayedGame } from "@core/domain";
import {
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { SteamHuntersProfile } from "../../providers/steamhunters";
import { addProfileAvatarCacheBustParam } from "./decky-avatar-cache-busting";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { findDeckyScrollableAncestor } from "./decky-scroll-viewport";
import {
  formatProfileMemberSince,
  formatSteamPlaytimeMinutes,
  type SteamAccountProgressSummary,
} from "./decky-stat-helpers";
import { getSteamCompactGameArtworkUrl } from "./decky-steam-game-artwork";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import externalLinkIconUrl from "./assets/external-link.svg";
import masteredIconUrl from "./assets/mastered.svg";
import rankPointsIconUrl from "./assets/rank-points.svg";
import settingsIconUrl from "./assets/settings.svg";
import starIconUrl from "./assets/star.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";

const BLUE_ICON_FILTER =
  "brightness(0) saturate(100%) invert(62%) sepia(84%) saturate(1250%) hue-rotate(165deg) brightness(101%) contrast(102%)";
const GOLD_ICON_FILTER =
  "brightness(0) saturate(100%) invert(78%) sepia(63%) saturate(754%) hue-rotate(350deg) brightness(102%) contrast(92%)";
const PURPLE_ICON_FILTER =
  "brightness(0) saturate(100%) invert(41%) sepia(93%) saturate(1444%) hue-rotate(249deg) brightness(95%) contrast(96%)";

export type DeckySteamCompactActionTone = "primary" | "row";
type SteamCompactIconTone = "blue" | "gold" | "purple";

export interface DeckySteamCompactProfileProps {
  readonly profile: DashboardSnapshot["profile"];
  readonly steamAccountProgress: SteamAccountProgressSummary;
  readonly steamHuntersProfile: SteamHuntersProfile | undefined;
  readonly recentAchievements: readonly RecentUnlock[];
  readonly recentlyPlayedGames: readonly RecentlyPlayedGame[];
  readonly refreshedAt: number | undefined;
  readonly onOpenProfile: () => void;
  readonly onOpenAchievementHistory: () => void;
  readonly onOpenCompletionProgress: () => void;
  readonly onOpenAchievementDetail: (recentUnlock: RecentUnlock) => void;
  readonly onOpenGameDetail: (game: RecentlyPlayedGame) => void;
  readonly onOpenSettings: () => void;
  readonly onCancel: () => void;
}

function scrollSteamCompactProfileToTop(target: HTMLElement, isStillFocused: () => boolean): void {
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
    scrollSteamCompactProfileToTop(target, isStillFocused);
    return;
  }

  scrollDeckyFocusTargetIntoView(target);
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
    color: "#f2f6fb",
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
    color: "#69cfff",
    fontSize: 12,
    fontWeight: 850,
    letterSpacing: "0.055em",
    lineHeight: 1,
    textTransform: "uppercase",
  };
}

function getActionStyle(tone: DeckySteamCompactActionTone, isFocused: boolean): CSSProperties {
  const isPrimary = tone === "primary";

  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    width: "100%",
    minWidth: 0,
    minHeight: isPrimary ? 38 : undefined,
    padding: isPrimary ? "8px 12px" : 0,
    border: isFocused
      ? "1px solid rgba(54, 185, 255, 0.92)"
      : isPrimary
        ? "1px solid rgba(54, 185, 255, 0.52)"
        : "1px solid rgba(54, 142, 191, 0.16)",
    borderRadius: isPrimary ? 8 : 9,
    background: isFocused
      ? "linear-gradient(180deg, rgba(17, 91, 139, 0.78), rgba(8, 53, 82, 0.9))"
      : isPrimary
        ? "linear-gradient(180deg, rgba(10, 63, 96, 0.82), rgba(7, 43, 67, 0.92))"
        : "linear-gradient(150deg, rgba(9, 35, 51, 0.88), rgba(7, 27, 41, 0.94))",
    boxShadow: isFocused
      ? "0 0 0 1px rgba(54, 185, 255, 0.72), 0 0 13px rgba(54, 185, 255, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
      : isPrimary
        ? "inset 0 1px 0 rgba(125, 211, 252, 0.08), 0 4px 12px rgba(0, 0, 0, 0.16)"
        : "inset 0 1px 0 rgba(255, 255, 255, 0.025)",
    boxSizing: "border-box",
    color: "#f2f6fb",
    cursor: "pointer",
    outline: "none",
    transition: "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
  };
}

export function DeckySteamCompactAction({
  ariaLabel,
  children,
  isNavigable = true,
  onActivate,
  onCancel,
  onFocused,
  preferredFocus = false,
  scrollToTopOnFocus = false,
  style,
  tone = "row",
}: {
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly isNavigable?: boolean;
  readonly onActivate: () => void;
  readonly onCancel: () => void;
  readonly onFocused?: () => void;
  readonly preferredFocus?: boolean;
  readonly scrollToTopOnFocus?: boolean;
  readonly style?: CSSProperties;
  readonly tone?: DeckySteamCompactActionTone;
}): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const focusGeneration = useRef(0);

  // Only the Full Screen action enters Decky's focus tree before the first controller move.
  if (!isNavigable) {
    return <div onClick={onActivate} style={{ ...getActionStyle(tone, false), ...style }}>{children}</div>;
  }

  return (
    <Focusable
      noFocusRing
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      preferredFocus={preferredFocus}
      onActivate={onActivate}
      onClick={onActivate}
      onCancel={onCancel}
      onFocus={(event) => {
        const generation = ++focusGeneration.current;
        setIsFocused(true);
        scrollFocusedCompactAction(event.currentTarget, scrollToTopOnFocus, () => focusGeneration.current === generation);
        onFocused?.();
      }}
      onGamepadFocus={(event) => {
        const generation = ++focusGeneration.current;
        setIsFocused(true);
        scrollFocusedCompactAction(event.currentTarget as HTMLElement, scrollToTopOnFocus, () => focusGeneration.current === generation);
        onFocused?.();
      }}
      onBlur={() => {
        focusGeneration.current += 1;
        setIsFocused(false);
      }}
      style={{ ...getActionStyle(tone, isFocused), ...style }}
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
    filter: tone === "gold" ? GOLD_ICON_FILTER : tone === "purple" ? PURPLE_ICON_FILTER : BLUE_ICON_FILTER,
  };
}

function getProfileCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    padding: 9,
    border: "1px solid rgba(54, 142, 191, 0.18)",
    borderRadius: 9,
    background: "linear-gradient(150deg, rgba(9, 35, 51, 0.9), rgba(7, 27, 41, 0.96))",
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
  return { color: "#8ebfe0", fontSize: 10, lineHeight: 1.2 };
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
    height: 7,
    overflow: "hidden",
    borderRadius: 999,
    background: "rgba(33, 78, 106, 0.78)",
    boxShadow: "inset 0 0 0 1px rgba(125, 211, 252, 0.05)",
  };
}

function getProgressFillStyle(percent: number): CSSProperties {
  return {
    width: `${Math.max(0, Math.min(100, percent))}%`,
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #139ee2, #20baff)",
  };
}

function getXpCaptionStyle(): CSSProperties {
  return { color: "#7fa7bf", fontSize: 9.5, lineHeight: 1.1 };
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

function getMetricStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "28px minmax(0, 1fr)",
    alignItems: "center",
    gap: 7,
    minHeight: 49,
    minWidth: 0,
    padding: "6px 8px",
    border: "1px solid rgba(54, 142, 191, 0.16)",
    borderRadius: 8,
    background: "linear-gradient(150deg, rgba(9, 35, 51, 0.88), rgba(7, 27, 41, 0.94))",
    boxSizing: "border-box",
  };
}

function getMetricTextStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 };
}

function getMetricLabelStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#88acd0",
    fontSize: 9,
    lineHeight: 1.05,
  };
}

function getMetricValueStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#f4f8fb",
    fontSize: 13,
    fontWeight: 850,
    lineHeight: 1.05,
  };
}

function SteamHuntersMetric({
  iconUrl,
  label,
  tone,
  value,
}: {
  readonly iconUrl: string;
  readonly label: string;
  readonly tone: SteamCompactIconTone;
  readonly value: string;
}): JSX.Element {
  return (
    <div style={getMetricStyle()}>
      <img alt="" src={iconUrl} style={getIconStyle(27, tone)} />
      <div style={getMetricTextStyle()}>
        <div style={getMetricLabelStyle()}>{label}</div>
        <div style={getMetricValueStyle()}>{value}</div>
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

function ViewAllAction({
  ariaLabel,
  isNavigable,
  onActivate,
  onCancel,
}: {
  readonly ariaLabel: string;
  readonly isNavigable: boolean;
  readonly onActivate: () => void;
  readonly onCancel: () => void;
}): JSX.Element {
  return (
    <DeckySteamCompactAction
      ariaLabel={ariaLabel}
      isNavigable={isNavigable}
      onActivate={onActivate}
      onCancel={onCancel}
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
  isNavigable,
  recentUnlock,
  onActivate,
  onCancel,
}: {
  readonly isNavigable: boolean;
  readonly recentUnlock: RecentUnlock;
  readonly onActivate: () => void;
  readonly onCancel: () => void;
}): JSX.Element {
  return (
    <DeckySteamCompactAction
      ariaLabel={`Open ${recentUnlock.achievement.title}`}
      isNavigable={isNavigable}
      onActivate={onActivate}
      onCancel={onCancel}
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
  isNavigable,
  game,
  onActivate,
  onCancel,
}: {
  readonly isNavigable: boolean;
  readonly game: RecentlyPlayedGame;
  readonly onActivate: () => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const artworkUrl = getSteamCompactGameArtworkUrl(game);
  const playtime = formatGamePlaytime(game);

  return (
    <DeckySteamCompactAction
      ariaLabel={`Open ${game.title}`}
      isNavigable={isNavigable}
      onActivate={onActivate}
      onCancel={onCancel}
      style={getListRowStyle(50)}
    >
      {artworkUrl !== undefined ? (
        <DeckyGameArtwork compact src={artworkUrl} size={34} title={game.title} />
      ) : (
        <span style={getGameArtworkFallbackStyle()}>{getInitials(game.title)}</span>
      )}
      <span style={getRowTextStyle()}>
        <span style={getRowTitleStyle()}>{game.title}</span>
        <span style={getRowMetaStyle()}>{formatGameProgress(game)}</span>
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
  recentAchievements,
  recentlyPlayedGames,
  refreshedAt,
  onOpenProfile,
  onOpenAchievementHistory,
  onOpenCompletionProgress,
  onOpenAchievementDetail,
  onOpenGameDetail,
  onOpenSettings,
  onCancel,
}: DeckySteamCompactProfileProps): JSX.Element {
  const [hasEnteredActionNavigation, setHasEnteredActionNavigation] = useState(false);
  const refreshTime = formatRefreshTime(refreshedAt);

  return (
    <Focusable
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
          onActivate={onOpenProfile}
          onCancel={onCancel}
          onFocused={() => {
            setHasEnteredActionNavigation(true);
          }}
          preferredFocus
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
            iconUrl={trophyIconUrl}
            label="Points"
            tone="gold"
            value={formatCount(steamHuntersProfile?.points)}
          />
          <SteamHuntersMetric
            iconUrl={rankPointsIconUrl}
            label="Points Rank"
            tone="blue"
            value={formatRank(steamHuntersProfile?.globalPointsRank)}
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
        <SectionHeader title="Recent Activity" />
        <div style={getListStyle()}>
          {recentAchievements.length > 0 ? recentAchievements.map((recentUnlock) => (
            <RecentAchievementItem
              key={`${recentUnlock.game.gameId}:${recentUnlock.achievement.achievementId}`}
              isNavigable={hasEnteredActionNavigation}
              recentUnlock={recentUnlock}
              onActivate={() => onOpenAchievementDetail(recentUnlock)}
              onCancel={onCancel}
            />
          )) : <EmptyListRow label="No recent achievements yet." />}
        </div>
        <ViewAllAction
          ariaLabel="View all recent Steam achievements"
          isNavigable={hasEnteredActionNavigation}
          onActivate={onOpenAchievementHistory}
          onCancel={onCancel}
        />
      </section>

      <section style={getSectionStyle()}>
        <SectionHeader title="Recently Played" />
        <div style={getListStyle()}>
          {recentlyPlayedGames.length > 0 ? recentlyPlayedGames.map((game) => (
            <RecentlyPlayedItem
              key={game.gameId}
              isNavigable={hasEnteredActionNavigation}
              game={game}
              onActivate={() => onOpenGameDetail(game)}
              onCancel={onCancel}
            />
          )) : <EmptyListRow label="No recently played games yet." />}
        </div>
        <ViewAllAction
          ariaLabel="View all Steam games"
          isNavigable={hasEnteredActionNavigation}
          onActivate={onOpenCompletionProgress}
          onCancel={onCancel}
        />
      </section>

      <DeckySteamCompactAction
        ariaLabel="Open Steam profile settings"
        isNavigable={hasEnteredActionNavigation}
        onActivate={onOpenSettings}
        onCancel={onCancel}
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
