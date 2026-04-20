import type { CSSProperties } from "react";
import type { ResourceState } from "@core/cache";
import type { DashboardSnapshot, RecentUnlock, RecentlyPlayedGame } from "@core/domain";
import { Field, Focusable, PanelSection, PanelSectionRow } from "@decky/ui";
import { PlaceholderState } from "@ui/PlaceholderState";
import {
  DeckyCompactPillActionGroup,
  DeckyCompactPillActionItem,
} from "./decky-compact-pill-action-item";
import { DeckyCompletionProgressBar } from "./decky-completion-progress-bar";
import { DeckyGameArtwork } from "./decky-game-artwork";
import {
  DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS,
  DECKY_FOCUS_NAV_ROW_CLASS,
} from "./decky-focus-styles";
import type { CompactAchievementTarget } from "./decky-achievement-detail-view";
import { buildProviderOverviewStats } from "./decky-overview-stats";
import { formatProfileMemberSince, getSteamAccountProgressSummary } from "./decky-stat-helpers";
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
    gap: 10,
    marginBottom: 8,
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

function ProfileAvatar({
  avatarUrl,
  displayName,
}: {
  readonly avatarUrl: string | undefined;
  readonly displayName: string;
}): JSX.Element {
  if (avatarUrl !== undefined) {
    return <DeckyGameArtwork compact src={avatarUrl} size={40} title={displayName} />;
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

function formatRecentAchievementSummary(recentUnlock: RecentUnlock): string | undefined {
  const parts: string[] = [];

  if (recentUnlock.achievement.points !== undefined) {
    parts.push(`${formatCount(recentUnlock.achievement.points)} pts`);
  }

  const when = formatRelativeTime(recentUnlock.unlockedAt ?? recentUnlock.achievement.unlockedAt);
  if (when !== undefined) {
    parts.push(when);
  }

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function formatRecentlyPlayedSummary(game: RecentlyPlayedGame): string {
  const parts: string[] = [];

  if (game.platformLabel !== undefined) {
    parts.push(game.platformLabel);
  }

  parts.push(formatMiniProgressSummary(game.summary));

  return parts.join(" · ");
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
  onOpenProfile,
  onCancel,
}: {
  readonly avatarUrl: string | undefined;
  readonly displayName: string;
  readonly memberSince: string | undefined;
  readonly providerId: string;
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
      <ProfileAvatar avatarUrl={avatarUrl} displayName={displayName} />

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
}: {
  readonly recentUnlock: RecentUnlock;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
  readonly onCancel: () => void;
}): JSX.Element {
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
          secondary={formatRecentAchievementSummary(recentUnlock)}
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

function RecentlyPlayedRow({
  game,
  onOpenGameDetail,
  onCancel,
}: {
  readonly game: RecentlyPlayedGame;
  readonly onOpenGameDetail: (providerId: string, gameId: string, gameTitle: string) => void;
  readonly onCancel: () => void;
}): JSX.Element {
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
  const overviewStats = buildProviderOverviewStats(profile, steamLibraryAchievementScanSummary);
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
