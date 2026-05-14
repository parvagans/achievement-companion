import type { CSSProperties } from "react";
import type { ResourceState } from "@core/cache";
import type { DashboardSnapshot, RecentUnlock, RecentlyPlayedGame } from "@core/domain";
import { Field, Focusable, PanelSection, PanelSectionRow } from "@decky/ui";
import { PlaceholderState } from "@ui/PlaceholderState";
import {
  DeckyCompactPillActionGroup,
  DeckyCompactPillActionItem,
} from "./decky-compact-pill-action-item";
import { DeckyCompletionProgressBar, getCompletionPercent } from "./decky-completion-progress-bar";
import { DeckyGameArtwork } from "./decky-game-artwork";
import {
  DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS,
  DECKY_FOCUS_NAV_ROW_CLASS,
} from "./decky-focus-styles";
import { addProfileAvatarCacheBustParam } from "./decky-avatar-cache-busting";
import type { CompactAchievementTarget } from "./decky-achievement-detail-view";
import { buildAchievementStatus, formatAchievementUnlockModeLabel } from "./decky-achievement-detail-helpers";
import {
  buildProviderOverviewStats,
  buildRetroAchievementsProfileOverviewStatSections,
  type OverviewStatSection,
} from "./decky-overview-stats";
import {
  formatProfileMemberSince,
  getRetroAchievementsProfileSectionAccentStyle,
  getRetroAchievementsProfileSectionStyle,
  getRetroAchievementsProfileSectionTitleStyle,
  getSteamAccountProgressSummary,
} from "./decky-stat-helpers";
import { formatDeckyProviderLabel } from "./providers";
import { getDeckyProviderIconSrc } from "./providers/provider-branding";
import type { SteamLibraryAchievementScanOverview } from "./providers/steam";
import { STEAM_PROVIDER_ID } from "../../providers/steam/config";

export interface DeckyDashboardViewProps {
  readonly state: ResourceState<DashboardSnapshot>;
  readonly steamLibraryAchievementScanSummary?: SteamLibraryAchievementScanOverview;
  readonly steamLibraryScanAction?:
    | {
        readonly label: string;
        readonly statusLabel: string;
        readonly disabled: boolean;
        readonly onClick: () => void;
      }
    | undefined;
  readonly onOpenGameDetail: (providerId: string, gameId: string, gameTitle: string) => void;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
  readonly onOpenProfile: (providerId: string) => void;
  readonly onBackToProviders: () => void;
  readonly onOpenSettings: () => void;
  readonly onRefreshDashboard: () => void;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatRelativeTime(epochMs: number | undefined): string | undefined {
  if (epochMs === undefined) {
    return undefined;
  }

  const elapsedMs = Date.now() - epochMs;
  const absoluteMs = Math.abs(elapsedMs);
  const formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
  });

  if (absoluteMs < 60_000) {
    const value = Math.max(1, Math.round(absoluteMs / 1000));
    return formatter.format(elapsedMs >= 0 ? -value : value, "second");
  }

  if (absoluteMs < 3_600_000) {
    const value = Math.max(1, Math.round(absoluteMs / 60_000));
    return formatter.format(elapsedMs >= 0 ? -value : value, "minute");
  }

  if (absoluteMs < 86_400_000) {
    const value = Math.max(1, Math.round(absoluteMs / 3_600_000));
    return formatter.format(elapsedMs >= 0 ? -value : value, "hour");
  }

  const value = Math.max(1, Math.round(absoluteMs / 86_400_000));
  return formatter.format(elapsedMs >= 0 ? -value : value, "day");
}

function formatMiniProgressSummary(summary: RecentlyPlayedGame["summary"]): string {
  if (summary.totalCount !== undefined) {
    const parts = [`${formatCount(summary.unlockedCount)}/${formatCount(summary.totalCount)}`];

    if (summary.completionPercent !== undefined) {
      parts.push(`${formatCount(summary.completionPercent)}%`);
    }

    return parts.join(" | ");
  }

  const parts = [`${formatCount(summary.unlockedCount)} unlocked`];
  if (summary.completionPercent !== undefined) {
    parts.push(`${formatCount(summary.completionPercent)}%`);
  }

  return parts.join(" | ");
}

function getProfileAvatarInitials(displayName: string): string {
  const words = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "AC";
  }

  return (
    words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("")
    .trim() || "AC"
  );
}

function getOverviewCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    boxSizing: "border-box",
  };
}

function getOverviewHeaderStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    cursor: "pointer",
  };
}

function getProfileAvatarFrameStyle(): CSSProperties {
  return {
    width: 40,
    height: 40,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: 10,
    border: "1px solid rgba(255, 255, 255, 0.12)",
    background:
      "linear-gradient(160deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: "0.9em",
    fontWeight: 700,
    letterSpacing: "0.06em",
  };
}

function getProfileIdentityStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    gap: 2,
  };
}

function getProfileNameStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "1.05em",
    fontWeight: 700,
    lineHeight: 1.15,
  };
}

function getProfileMetaStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.86em",
    lineHeight: 1.2,
  };
}

function getProviderIdentityRowStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    padding: "0 2px",
  };
}

function getProviderIdentitySectionStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    padding: "2px 0 4px",
    width: "100%",
  };
}

function getProviderIdentityIconFrameStyle(): CSSProperties {
  return {
    width: 32,
    height: 32,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: 8,
    border: "1px solid rgba(255, 255, 255, 0.12)",
    background:
      "linear-gradient(160deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: "0.82em",
    fontWeight: 750,
    letterSpacing: "0.06em",
    boxSizing: "border-box",
  };
}

function getProviderIdentityIconStyle(): CSSProperties {
  return {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };
}

function getProviderIdentityTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    gap: 2,
  };
}

function getProviderIdentityEyebrowStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.68em",
    fontWeight: 700,
    letterSpacing: "0.08em",
    lineHeight: 1.15,
    textTransform: "uppercase",
  };
}

function getProviderIdentityLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.96)",
    fontSize: "1.02em",
    fontWeight: 750,
    lineHeight: 1.15,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getOverviewStatsGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  };
}

function getOverviewStatStyle(): CSSProperties {
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

function getOverviewStatLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "0.72em",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getOverviewStatValueStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.96)",
    fontSize: "1.02em",
    fontWeight: 750,
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getOverviewStatDetailStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.78em",
    lineHeight: 1.16,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getOverviewPillRowStyle(): CSSProperties {
  return {
    display: "grid",
    placeItems: "center",
    width: "100%",
    minWidth: 0,
  };
}

function getOverviewPrimaryActionRowStyle(): CSSProperties {
  return {
    display: "grid",
    width: "100%",
    minWidth: 0,
  };
}

function getOverviewPillGroupStyle(): CSSProperties {
  return {
    display: "inline-flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    marginInline: "auto",
    gap: "8px 10px",
  };
}

function getOverviewProgressBlockStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    boxSizing: "border-box",
  };
}

function getOverviewProgressTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "0.72em",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getOverviewProgressSubtitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: "0.9em",
    lineHeight: 1.25,
  };
}

function getCompactItemDescriptionStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    minWidth: 0,
  };
}

function getCompactItemPrimaryStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "rgba(255, 255, 255, 0.95)",
    fontSize: "0.95em",
    fontWeight: 600,
    lineHeight: 1.18,
  };
}

function getCompactItemSecondaryStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.82em",
    lineHeight: 1.16,
  };
}

type DashboardAchievementTone = "softcore" | "hardcore" | "locked" | "default";

function getDashboardAchievementTone(recentUnlock: RecentUnlock): DashboardAchievementTone {
  if (!recentUnlock.achievement.isUnlocked) {
    return "locked";
  }

  if (recentUnlock.achievement.unlockMode === "hardcore") {
    return "hardcore";
  }

  if (recentUnlock.achievement.unlockMode === "softcore") {
    return "softcore";
  }

  return "default";
}

function getDashboardCompactCardStyle(bottomSpacing = 0): CSSProperties {
  return {
    position: "relative",
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
    minWidth: 0,
    marginBottom: bottomSpacing,
    padding: "16px 16px 16px 20px",
    borderRadius: 14,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    boxSizing: "border-box",
    overflow: "hidden",
  };
}

function getDashboardCompactCardAccentStyle(tone: DashboardAchievementTone): CSSProperties {
  const background =
    tone === "hardcore"
      ? "linear-gradient(180deg, rgba(232, 201, 102, 0.92), rgba(214, 178, 74, 0.55))"
      : tone === "softcore"
        ? "linear-gradient(180deg, rgba(214, 221, 232, 0.82), rgba(214, 221, 232, 0.42))"
        : tone === "locked"
          ? "linear-gradient(180deg, rgba(148, 163, 184, 0.56), rgba(148, 163, 184, 0.26))"
          : "linear-gradient(180deg, rgba(125, 211, 252, 0.78), rgba(99, 179, 237, 0.42))";

  return {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 4,
    borderRadius: 999,
    background,
  };
}

function getDashboardCompactArtworkFrameStyle(tone?: DashboardAchievementTone): CSSProperties {
  const borderColor =
    tone === "hardcore"
      ? "rgba(232, 201, 102, 0.2)"
      : tone === "softcore"
        ? "rgba(214, 221, 232, 0.18)"
        : tone === "locked"
          ? "rgba(148, 163, 184, 0.16)"
          : "rgba(255, 255, 255, 0.1)";
  const backgroundColor =
    tone === "hardcore"
      ? "rgba(214, 178, 74, 0.08)"
      : tone === "softcore"
        ? "rgba(214, 221, 232, 0.06)"
        : tone === "locked"
          ? "rgba(148, 163, 184, 0.05)"
          : "rgba(255, 255, 255, 0.04)";

  return {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 42,
    height: 42,
    padding: 3,
    borderRadius: 11,
    border: `1px solid ${borderColor}`,
    backgroundColor,
    boxSizing: "border-box",
    overflow: "hidden",
  };
}

function getDashboardCompactTextColumnStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    minWidth: 0,
    flex: "1 1 auto",
  };
}

function getDashboardCompactTitleStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "rgba(255, 255, 255, 0.97)",
    fontSize: "0.92em",
    fontWeight: 700,
    lineHeight: 1.15,
  };
}

function getDashboardCompactGameTitleStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "rgba(255, 255, 255, 0.78)",
    fontSize: "0.79em",
    lineHeight: 1.15,
  };
}

function getDashboardCompactMetaStackStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  };
}

function getDashboardAchievementStatusStyle(tone: DashboardAchievementTone): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color:
      tone === "hardcore"
        ? "rgba(232, 201, 102, 0.96)"
        : tone === "softcore"
          ? "rgba(220, 225, 233, 0.93)"
          : tone === "locked"
            ? "rgba(203, 213, 225, 0.62)"
            : "rgba(125, 211, 252, 0.92)",
    fontSize: "0.77em",
    fontWeight: 700,
    lineHeight: 1.12,
  };
}

function getDashboardCompactMetaLineStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "rgba(255, 255, 255, 0.64)",
    fontSize: "0.75em",
    lineHeight: 1.12,
  };
}

function getDashboardSystemPillStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    minHeight: 20,
    padding: "0 8px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: "0.68em",
    fontWeight: 700,
    letterSpacing: "0.06em",
    lineHeight: 1,
    textTransform: "uppercase",
    boxSizing: "border-box",
    whiteSpace: "nowrap",
  };
}

function getDashboardCompactProgressStackStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
  };
}

function getDashboardMiniProgressTrackStyle(): CSSProperties {
  return {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.05)",
  };
}

function getDashboardMiniProgressFillStyle(percent: number): CSSProperties {
  return {
    width: `${Math.max(0, Math.min(100, percent))}%`,
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, rgba(99, 179, 237, 0.92), rgba(125, 211, 252, 0.98))",
  };
}

function OverviewStat({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
}): JSX.Element {
  return (
    <div style={getOverviewStatStyle()}>
      <div style={getOverviewStatLabelStyle()}>{label}</div>
      <div style={getOverviewStatValueStyle()}>{value}</div>
      {detail !== undefined ? <div style={getOverviewStatDetailStyle()}>{detail}</div> : null}
    </div>
  );
}

function OverviewStatSectionBlock({ section }: { readonly section: OverviewStatSection }): JSX.Element {
  return (
    <div
      data-profile-section-variant={section.variant}
      style={{
        ...getRetroAchievementsProfileSectionStyle(section.variant),
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div aria-hidden="true" style={getRetroAchievementsProfileSectionAccentStyle(section.variant)} />
      <div style={getRetroAchievementsProfileSectionTitleStyle(section.variant)}>{section.title}</div>
      <div style={getOverviewStatsGridStyle()}>
        {section.stats.map((stat) => (
          <OverviewStat
            key={`${section.title}:${stat.label}`}
            label={stat.label}
            value={stat.value}
            {...(stat.detail !== undefined ? { detail: stat.detail } : {})}
          />
        ))}
      </div>
    </div>
  );
}

function ProfileAvatar({
  avatarUrl,
  displayName,
  refreshedAt,
}: {
  readonly avatarUrl: string | undefined;
  readonly displayName: string;
  readonly refreshedAt: number | undefined;
}): JSX.Element {
  const renderedAvatarUrl = addProfileAvatarCacheBustParam(avatarUrl, refreshedAt);

  if (renderedAvatarUrl !== undefined) {
    return <DeckyGameArtwork compact src={renderedAvatarUrl} size={40} title={displayName} />;
  }

  return <span style={getProfileAvatarFrameStyle()}>{getProfileAvatarInitials(displayName)}</span>;
}

function CompactItemDescription({
  primary,
  secondary,
}: {
  readonly primary: string;
  readonly secondary: string | undefined;
}): JSX.Element {
  return (
    <div style={getCompactItemDescriptionStyle()}>
      <div style={getCompactItemPrimaryStyle()}>{primary}</div>
      {secondary !== undefined ? <div style={getCompactItemSecondaryStyle()}>{secondary}</div> : null}
    </div>
  );
}

function CompactDashboardProgressBar({ percent }: { readonly percent: number }): JSX.Element {
  return (
    <div
      aria-label="Completion progress"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={percent}
      aria-valuetext={`${percent}% complete`}
      role="progressbar"
      style={getDashboardMiniProgressTrackStyle()}
    >
      <div style={getDashboardMiniProgressFillStyle(percent)} />
    </div>
  );
}

function formatRecentAchievementSummary(recentUnlock: RecentUnlock): string | undefined {
  const parts: string[] = [formatAchievementUnlockModeLabel(recentUnlock.achievement)];

  if (recentUnlock.achievement.points !== undefined) {
    parts.push(`${formatCount(recentUnlock.achievement.points)} pts`);
  }

  const when = formatRelativeTime(recentUnlock.unlockedAt ?? recentUnlock.achievement.unlockedAt);
  if (when !== undefined) {
    parts.push(when);
  }

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function formatRecentAchievementTimestampLine(recentUnlock: RecentUnlock): string | undefined {
  const unlockedAt = recentUnlock.unlockedAt ?? recentUnlock.achievement.unlockedAt;
  if (unlockedAt === undefined) {
    return undefined;
  }

  const relative = formatRelativeTime(unlockedAt);
  if (relative !== undefined) {
    return `Unlocked ${relative}`;
  }

  return `Unlocked ${new Date(unlockedAt).toLocaleDateString()}`;
}

function formatRecentlyPlayedSummary(game: RecentlyPlayedGame): string {
  const parts: string[] = [];

  if (game.platformLabel !== undefined) {
    parts.push(game.platformLabel);
  }

  parts.push(formatMiniProgressSummary(game.summary));

  return parts.join(" · ");
}

function formatRecentlyPlayedProgressLine(game: RecentlyPlayedGame): string {
  if (game.summary.totalCount !== undefined) {
    const parts = [`${formatCount(game.summary.unlockedCount)}/${formatCount(game.summary.totalCount)} achievements`];

    if (game.summary.completionPercent !== undefined) {
      parts.push(`${formatCount(game.summary.completionPercent)}%`);
    }

    return parts.join(" / ");
  }

  const parts = [`${formatCount(game.summary.unlockedCount)} achievements`];
  if (game.summary.completionPercent !== undefined) {
    parts.push(`${formatCount(game.summary.completionPercent)}%`);
  }

  return parts.join(" / ");
}

function formatRecentlyPlayedLastPlayedText(game: RecentlyPlayedGame): string | undefined {
  const when = formatRelativeTime(game.lastPlayedAt);
  if (when !== undefined) {
    return `Last played ${when}`;
  }

  if (game.lastPlayedAt !== undefined) {
    return `Last played ${new Date(game.lastPlayedAt).toLocaleDateString()}`;
  }

  return undefined;
}

function formatRecentlyPlayedSecondary(game: RecentlyPlayedGame): string | undefined {
  const playtimeLines = [
    game.playtimeTwoWeeksMinutes !== undefined
      ? `Past 2 weeks: ${formatSteamPlaytimeMinutes(game.playtimeTwoWeeksMinutes) ?? "-"}`
      : undefined,
    game.playtimeDeckForeverMinutes !== undefined
      ? `Steam Deck: ${formatSteamPlaytimeMinutes(game.playtimeDeckForeverMinutes) ?? "-"}`
      : undefined,
    game.playtimeForeverMinutes !== undefined
      ? `Total playtime: ${formatSteamPlaytimeMinutes(game.playtimeForeverMinutes) ?? "-"}`
      : undefined,
  ].filter((line): line is string => line !== undefined);

  const when = formatRelativeTime(game.lastPlayedAt);
  if (when !== undefined) {
    return playtimeLines.length > 0 ? `Last played ${when} | ${playtimeLines.join(" | ")}` : `Last played ${when}`;
  }

  return playtimeLines.length > 0 ? playtimeLines.join(" | ") : undefined;
}

function formatSteamPlaytimeMinutes(minutes: number | undefined): string | undefined {
  if (minutes === undefined) {
    return undefined;
  }

  const normalizedMinutes = Math.max(0, Math.trunc(minutes));
  if (normalizedMinutes < 60) {
    return `${normalizedMinutes}m`;
  }

  const hours = Math.floor(normalizedMinutes / 60);
  const remainderMinutes = normalizedMinutes % 60;
  if (remainderMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainderMinutes}m`;
}

function isRenderableDashboardState(
  state: ResourceState<DashboardSnapshot>,
): state is ResourceState<DashboardSnapshot> & {
  readonly data: DashboardSnapshot;
} {
  return (state.status === "success" || state.status === "stale") && state.data !== undefined;
}

function OverviewProfileEntry({
  avatarUrl,
  displayName,
  memberSince,
  providerId,
  refreshedAt,
  onOpenProfile,
  onCancel,
}: {
  readonly avatarUrl: string | undefined;
  readonly displayName: string;
  readonly memberSince: string | undefined;
  readonly providerId: string;
  readonly refreshedAt: number | undefined;
  readonly onOpenProfile: (providerId: string) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  return (
    <Focusable
      className={DECKY_FOCUS_NAV_ROW_CLASS}
      focusClassName={DECKY_FOCUS_NAV_ROW_CLASS}
      focusWithinClassName={DECKY_FOCUS_NAV_ROW_CLASS}
      noFocusRing
      aria-label={`Open ${displayName} ${formatDeckyProviderLabel(providerId)} profile`}
      onActivate={() => {
        onOpenProfile(providerId);
      }}
      onClick={() => {
        onOpenProfile(providerId);
      }}
      onCancel={() => {
        onCancel();
      }}
      style={getOverviewHeaderStyle()}
    >
      <ProfileAvatar avatarUrl={avatarUrl} displayName={displayName} refreshedAt={refreshedAt} />

      <div style={getProfileIdentityStyle()}>
        <div style={getProfileNameStyle()}>{displayName}</div>
        <div style={getProfileMetaStyle()}>
          {memberSince !== undefined ? `Member since ${memberSince}` : "Member since unknown"}
        </div>
      </div>
    </Focusable>
  );
}

function ProviderIdentityRow({ providerId }: { readonly providerId: string }): JSX.Element {
  const label = formatDeckyProviderLabel(providerId);
  const iconSrc = getDeckyProviderIconSrc(providerId);
  const initials =
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "AC";

  return (
    <div style={getProviderIdentityRowStyle()}>
      {iconSrc !== undefined ? (
        <span aria-hidden="true" style={getProviderIdentityIconFrameStyle()}>
          <img alt={label} loading="lazy" src={iconSrc} style={getProviderIdentityIconStyle()} />
        </span>
      ) : (
        <span aria-hidden="true" style={getProviderIdentityIconFrameStyle()}>
          {initials}
        </span>
      )}

      <div style={getProviderIdentityTextStyle()}>
        <div style={getProviderIdentityEyebrowStyle()}>Provider</div>
        <div style={getProviderIdentityLabelStyle()}>{label}</div>
      </div>
    </div>
  );
}

function RecentAchievementRow({
  recentUnlock,
  onOpenAchievementDetail,
  onCancel,
  bottomSpacing,
}: {
  readonly recentUnlock: RecentUnlock;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
  readonly onCancel: () => void;
  readonly bottomSpacing?: number;
}): JSX.Element {
  if (recentUnlock.game.providerId === STEAM_PROVIDER_ID) {
    return (
      <Field
        className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
        focusable
        highlightOnFocus
        verticalAlignment="center"
        icon={
          recentUnlock.achievement.badgeImageUrl !== undefined ? (
            <DeckyGameArtwork
              compact
              src={recentUnlock.achievement.badgeImageUrl}
              size={32}
              title={recentUnlock.achievement.title}
            />
          ) : undefined
        }
        bottomSeparator="none"
        padding="compact"
        label={recentUnlock.achievement.title}
        description={
          <CompactItemDescription
            primary={recentUnlock.game.title}
            secondary={
              formatRecentAchievementSummary(recentUnlock) ??
              buildAchievementStatus(recentUnlock.achievement).value
            }
          />
        }
        onCancelButton={onCancel}
        onActivate={() => {
          onOpenAchievementDetail({
            game: recentUnlock.game,
            achievement: recentUnlock.achievement,
          });
        }}
        onClick={() => {
          onOpenAchievementDetail({
            game: recentUnlock.game,
            achievement: recentUnlock.achievement,
          });
        }}
      />
    );
  }

  const tone = getDashboardAchievementTone(recentUnlock);
  const statusLabel = formatAchievementUnlockModeLabel(recentUnlock.achievement);
  const timestampLine = formatRecentAchievementTimestampLine(recentUnlock);
  const pointsLine =
    recentUnlock.achievement.points !== undefined
      ? `${formatCount(recentUnlock.achievement.points)} pts`
      : undefined;
  const detailLine = [pointsLine, timestampLine].filter((value): value is string => value !== undefined).join(" / ");

  return (
    <Focusable
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      focusClassName={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      focusWithinClassName={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      noFocusRing
      role="button"
      data-dashboard-achievement-tone={tone}
      data-dashboard-row-type="recent-achievement"
      style={getDashboardCompactCardStyle(bottomSpacing)}
      onCancel={onCancel}
      onActivate={() => {
        onOpenAchievementDetail({
          game: recentUnlock.game,
          achievement: recentUnlock.achievement,
        });
      }}
      onClick={() => {
        onOpenAchievementDetail({
          game: recentUnlock.game,
          achievement: recentUnlock.achievement,
        });
      }}
    >
      <div aria-hidden="true" style={getDashboardCompactCardAccentStyle(tone)} />
      <div style={getDashboardCompactArtworkFrameStyle(tone)}>
        {recentUnlock.achievement.badgeImageUrl !== undefined ? (
          <DeckyGameArtwork
            compact
            src={recentUnlock.achievement.badgeImageUrl}
            size={34}
            title={recentUnlock.achievement.title}
          />
        ) : (
          <span style={getDashboardCompactGameTitleStyle()}>{statusLabel.slice(0, 1)}</span>
        )}
      </div>
      <div style={getDashboardCompactTextColumnStyle()}>
        <div style={getDashboardCompactTitleStyle()}>{recentUnlock.achievement.title}</div>
        <div style={getDashboardCompactGameTitleStyle()}>{recentUnlock.game.title}</div>
        <div style={getDashboardCompactMetaStackStyle()}>
          <div style={getDashboardAchievementStatusStyle(tone)}>{statusLabel}</div>
          {detailLine.length > 0 ? <div style={getDashboardCompactMetaLineStyle()}>{detailLine}</div> : null}
        </div>
      </div>
    </Focusable>
  );
}

function RecentlyPlayedRow({
  game,
  onOpenGameDetail,
  onCancel,
  bottomSpacing,
}: {
  readonly game: RecentlyPlayedGame;
  readonly onOpenGameDetail: (providerId: string, gameId: string, gameTitle: string) => void;
  readonly onCancel: () => void;
  readonly bottomSpacing?: number;
}): JSX.Element {
  if (game.providerId === STEAM_PROVIDER_ID) {
    return (
      <Field
        className={DECKY_FOCUS_NAV_ROW_CLASS}
        focusable
        highlightOnFocus
        icon={
          game.coverImageUrl !== undefined ? (
            <DeckyGameArtwork compact src={game.coverImageUrl} size={32} title={game.title} />
          ) : undefined
        }
        bottomSeparator="none"
        padding="compact"
        verticalAlignment="center"
        label={game.title}
        description={
          <CompactItemDescription
            primary={formatRecentlyPlayedSummary(game)}
            secondary={formatRecentlyPlayedSecondary(game)}
          />
        }
        onCancelButton={onCancel}
        onActivate={() => {
          onOpenGameDetail(game.providerId, game.gameId, game.title);
        }}
        onClick={() => {
          onOpenGameDetail(game.providerId, game.gameId, game.title);
        }}
      />
    );
  }

  const progressPercent = getCompletionPercent(game.summary);
  const progressLine = formatRecentlyPlayedProgressLine(game);
  const lastPlayedText = formatRecentlyPlayedLastPlayedText(game);

  return (
    <Focusable
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      focusClassName={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      focusWithinClassName={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      noFocusRing
      role="button"
      data-dashboard-row-type="recently-played"
      style={getDashboardCompactCardStyle(bottomSpacing)}
      onCancel={onCancel}
      onActivate={() => {
        onOpenGameDetail(game.providerId, game.gameId, game.title);
      }}
      onClick={() => {
        onOpenGameDetail(game.providerId, game.gameId, game.title);
      }}
    >
      <div aria-hidden="true" style={getDashboardCompactCardAccentStyle("default")} />
      <div style={getDashboardCompactArtworkFrameStyle()}>
        {game.coverImageUrl !== undefined ? (
          <DeckyGameArtwork compact src={game.coverImageUrl} size={34} title={game.title} />
        ) : (
          <span style={getDashboardCompactGameTitleStyle()}>{(game.platformLabel ?? game.title).slice(0, 1)}</span>
        )}
      </div>
      <div style={getDashboardCompactTextColumnStyle()}>
        <div style={getDashboardCompactTitleStyle()}>{game.title}</div>
        <span style={getDashboardSystemPillStyle()}>{game.platformLabel ?? "Unknown platform"}</span>
        <div style={getDashboardCompactProgressStackStyle()}>
          <div style={getDashboardCompactMetaLineStyle()}>{progressLine}</div>
          {lastPlayedText !== undefined ? (
            <div style={getDashboardCompactMetaLineStyle()}>{lastPlayedText}</div>
          ) : null}
          {progressPercent !== undefined ? <CompactDashboardProgressBar percent={progressPercent} /> : null}
        </div>
      </div>
    </Focusable>
  );
}

export function DeckyDashboardView({
  state,
  steamLibraryAchievementScanSummary,
  steamLibraryScanAction,
  onOpenGameDetail,
  onOpenAchievementDetail,
  onOpenProfile,
  onBackToProviders,
  onOpenSettings,
  onRefreshDashboard,
}: DeckyDashboardViewProps): JSX.Element {
  if (!isRenderableDashboardState(state)) {
    return (
      <PlaceholderState
        title="Achievement Companion"
        description="Loading your achievement dashboard."
        state={state}
        footer={
          <div>
            <div style={getOverviewPillRowStyle()}>
              <DeckyCompactPillActionGroup style={getOverviewPillGroupStyle()}>
                <DeckyCompactPillActionItem
                  label="Back"
                  onClick={onBackToProviders}
                  onCancelButton={onBackToProviders}
                />
                <DeckyCompactPillActionItem
                  label="Settings"
                  onClick={onOpenSettings}
                  onCancelButton={onBackToProviders}
                />
              </DeckyCompactPillActionGroup>
            </div>
            <span>
              The compact side panel will show overview, recent achievements, and recently played games once data is
              ready.
            </span>
          </div>
        }
      />
    );
  }

  const snapshot = state.data;
  const profile = snapshot.profile;
  const recentAchievements = snapshot.recentAchievements;
  const recentlyPlayedGames = snapshot.recentlyPlayedGames;
  const memberSince = formatProfileMemberSince(profile.metrics);
  const overviewStats =
    profile.providerId === STEAM_PROVIDER_ID
      ? buildProviderOverviewStats(profile, steamLibraryAchievementScanSummary)
      : [];
  const retroAchievementsOverviewStatSections =
    profile.providerId === STEAM_PROVIDER_ID ? [] : buildRetroAchievementsProfileOverviewStatSections(profile);
  const steamAccountProgress =
    profile.providerId === STEAM_PROVIDER_ID ? getSteamAccountProgressSummary({ profile }) : undefined;
  const refreshedAt = state.lastUpdatedAt ?? snapshot.refreshedAt;
  const refreshedLabel = refreshedAt !== undefined ? new Date(refreshedAt).toLocaleString() : undefined;
  const overviewCompletionPercent =
    profile.providerId === "steam" && steamLibraryAchievementScanSummary !== undefined
      ? steamLibraryAchievementScanSummary.completionPercent
      : profile.summary.completionPercent;
  return (
    <>
      <div style={getProviderIdentitySectionStyle()}>
        <ProviderIdentityRow providerId={profile.providerId} />
      </div>

      <PanelSection title="Overview">
        <PanelSectionRow>
          <div style={getOverviewCardStyle()}>
            <OverviewProfileEntry
              avatarUrl={profile.identity.avatarUrl}
              displayName={profile.identity.displayName}
              memberSince={memberSince}
              providerId={profile.providerId}
              refreshedAt={refreshedAt}
              onOpenProfile={onOpenProfile}
              onCancel={onBackToProviders}
            />

            {profile.providerId === STEAM_PROVIDER_ID && steamLibraryAchievementScanSummary === undefined ? (
              <div style={getProfileMetaStyle()}>
                Steam achievement totals are based on loaded games. Run a library scan in Steam settings for full-library totals.
              </div>
            ) : null}

            {steamAccountProgress !== undefined ? (
              <div style={getOverviewProgressBlockStyle()}>
                <div style={getOverviewProgressTitleStyle()}>Steam account progression</div>
                <div style={getOverviewProgressSubtitleStyle()}>{steamAccountProgress.accountSubtitle}</div>
                {steamAccountProgress.xpProgressPercent !== undefined ? (
                  <DeckyCompletionProgressBar
                    compact
                    percent={steamAccountProgress.xpProgressPercent}
                    caption={steamAccountProgress.xpProgressCaption}
                    captionPlacement="above"
                  />
                ) : (
                  <div style={getProfileMetaStyle()}>{steamAccountProgress.xpProgressCaption}</div>
                )}
                <div style={getOverviewStatsGridStyle()}>
                  <OverviewStat label="Steam Level" value={steamAccountProgress.steamLevelValue} />
                  <OverviewStat
                    label="Badges"
                    value={steamAccountProgress.badgesValue}
                    {...(steamAccountProgress.badgesSecondary !== undefined
                      ? { detail: steamAccountProgress.badgesSecondary }
                      : {})}
                  />
                </div>
              </div>
            ) : null}

            {overviewCompletionPercent !== undefined ? (
              <div style={getOverviewProgressBlockStyle()}>
                <div style={getOverviewProgressTitleStyle()}>Library completion</div>
                <DeckyCompletionProgressBar compact percent={overviewCompletionPercent} />
              </div>
            ) : null}

            {profile.providerId === STEAM_PROVIDER_ID ? (
              <div style={getOverviewStatsGridStyle()}>
                {overviewStats.map((stat) => (
                  <OverviewStat
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    {...(stat.detail !== undefined ? { detail: stat.detail } : {})}
                  />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {retroAchievementsOverviewStatSections.map((section) => (
                  <OverviewStatSectionBlock key={section.title} section={section} />
                ))}
              </div>
            )}

            <div style={getOverviewPrimaryActionRowStyle()}>
              <DeckyCompactPillActionItem
                emphasis="primary"
                label="Open full-screen"
                onClick={() => {
                  onOpenProfile(profile.providerId);
                }}
                onCancelButton={onBackToProviders}
                stretch
              />
            </div>

            <div style={getOverviewPillRowStyle()}>
              <DeckyCompactPillActionGroup style={getOverviewPillGroupStyle()}>
                <DeckyCompactPillActionItem
                  label="Back"
                  onClick={onBackToProviders}
                  onCancelButton={onBackToProviders}
                />
                <DeckyCompactPillActionItem
                  label="Refresh"
                  onClick={onRefreshDashboard}
                  onCancelButton={onBackToProviders}
                />
                <DeckyCompactPillActionItem
                  label="Settings"
                  onClick={onOpenSettings}
                  onCancelButton={onBackToProviders}
                />
              </DeckyCompactPillActionGroup>
            </div>

            {profile.providerId === STEAM_PROVIDER_ID && steamLibraryScanAction !== undefined ? (
              <div style={getOverviewProgressBlockStyle()}>
                <div style={getOverviewPrimaryActionRowStyle()}>
                  <DeckyCompactPillActionItem
                    emphasis="primary"
                    label={steamLibraryScanAction.label}
                    onClick={steamLibraryScanAction.onClick}
                    onCancelButton={onBackToProviders}
                    disabled={steamLibraryScanAction.disabled}
                    stretch
                  />
                </div>
                <div style={getProfileMetaStyle()}>{steamLibraryScanAction.statusLabel}</div>
              </div>
            ) : null}

            {refreshedLabel !== undefined ? <div style={getProfileMetaStyle()}>{`Updated ${refreshedLabel}`}</div> : null}
          </div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Recent Achievements">
        {recentAchievements.length > 0 ? (
          profile.providerId === STEAM_PROVIDER_ID ? (
            recentAchievements.map((recentUnlock) => (
              <PanelSectionRow key={`${recentUnlock.game.gameId}:${recentUnlock.achievement.achievementId}`}>
                <RecentAchievementRow
                  recentUnlock={recentUnlock}
                  onOpenAchievementDetail={onOpenAchievementDetail}
                  onCancel={onBackToProviders}
                />
              </PanelSectionRow>
            ))
          ) : (
            recentAchievements.map((recentUnlock, index) => (
              <PanelSectionRow key={`${recentUnlock.game.gameId}:${recentUnlock.achievement.achievementId}`}>
                <RecentAchievementRow
                  recentUnlock={recentUnlock}
                  onOpenAchievementDetail={onOpenAchievementDetail}
                  onCancel={onBackToProviders}
                  bottomSpacing={index === recentAchievements.length - 1 ? 0 : 12}
                />
              </PanelSectionRow>
            ))
          )
        ) : (
          <PanelSectionRow>
            <Field
              bottomSeparator="none"
              description="No recent achievements yet."
              label="Recent Achievements"
            />
          </PanelSectionRow>
        )}
      </PanelSection>

      <PanelSection title="Recently Played">
        {recentlyPlayedGames.length > 0 ? (
          profile.providerId === STEAM_PROVIDER_ID ? (
            recentlyPlayedGames.map((game) => (
              <PanelSectionRow key={game.gameId}>
                <RecentlyPlayedRow
                  game={game}
                  onOpenGameDetail={onOpenGameDetail}
                  onCancel={onBackToProviders}
                />
              </PanelSectionRow>
            ))
          ) : (
            recentlyPlayedGames.map((game, index) => (
              <PanelSectionRow key={game.gameId}>
                <RecentlyPlayedRow
                  game={game}
                  onOpenGameDetail={onOpenGameDetail}
                  onCancel={onBackToProviders}
                  bottomSpacing={index === recentlyPlayedGames.length - 1 ? 0 : 12}
                />
              </PanelSectionRow>
            ))
          )
        ) : (
          <PanelSectionRow>
            <Field
              bottomSeparator="none"
              description="No recently played games yet."
              label="Recently Played"
            />
          </PanelSectionRow>
        )}
      </PanelSection>
    </>
  );
}
