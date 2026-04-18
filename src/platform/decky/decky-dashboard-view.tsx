import type { CSSProperties } from "react";
import type { ResourceState } from "@core/cache";
import type {
  DashboardSnapshot,
  NormalizedMetric,
  RecentUnlock,
  RecentlyPlayedGame,
} from "@core/domain";
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

export interface DeckyDashboardViewProps {
  readonly state: ResourceState<DashboardSnapshot>;
  readonly onOpenGameDetail: (providerId: string, gameId: string, gameTitle: string) => void;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
  readonly onOpenProfile: (providerId: string) => void;
  readonly onOpenSettings: () => void;
  readonly onRefreshDashboard: () => void;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatShortDate(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function getMetricValue(metrics: readonly NormalizedMetric[], ...keys: string[]): string | undefined {
  for (const key of keys) {
    const match = metrics.find((metric) => metric.key === key || metric.label === key);
    if (match !== undefined) {
      return match.value;
    }
  }

  return undefined;
}

function getProfileAvatarInitials(displayName: string): string {
  const words = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "RA";
  }

  return (
    words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("")
      .trim() || "RA"
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

function getOverviewPillRowStyle(): CSSProperties {
  return {
    display: "grid",
    placeItems: "center",
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
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div style={getOverviewStatStyle()}>
      <div style={getOverviewStatLabelStyle()}>{label}</div>
      <div style={getOverviewStatValueStyle()}>{value}</div>
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
  const when = formatRelativeTime(game.lastPlayedAt);
  return when !== undefined ? `Last played ${when}` : undefined;
}

function formatOverviewMemberSince(metrics: readonly NormalizedMetric[]): string | undefined {
  const rawValue = getMetricValue(metrics, "member-since", "Member Since");
  return formatShortDate(rawValue);
}

function formatOverviewPoints(metrics: readonly NormalizedMetric[]): string | undefined {
  return getMetricValue(metrics, "total-points", "Points");
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
}: {
  readonly avatarUrl: string | undefined;
  readonly displayName: string;
  readonly memberSince: string | undefined;
  readonly providerId: string;
  readonly onOpenProfile: (providerId: string) => void;
}): JSX.Element {
  return (
    <Focusable
      className={DECKY_FOCUS_NAV_ROW_CLASS}
      focusClassName={DECKY_FOCUS_NAV_ROW_CLASS}
      focusWithinClassName={DECKY_FOCUS_NAV_ROW_CLASS}
      noFocusRing
      aria-label={`Open ${displayName} profile`}
      onActivate={() => {
        onOpenProfile(providerId);
      }}
      onClick={() => {
        onOpenProfile(providerId);
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

function RecentAchievementRow({
  recentUnlock,
  onOpenAchievementDetail,
}: {
  readonly recentUnlock: RecentUnlock;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
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
}: {
  readonly game: RecentlyPlayedGame;
  readonly onOpenGameDetail: (providerId: string, gameId: string, gameTitle: string) => void;
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
  onOpenGameDetail,
  onOpenAchievementDetail,
  onOpenProfile,
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
          <span>
            The compact side panel will show overview, recent achievements, and recently played games once data is
            ready.
          </span>
        }
      />
    );
  }

  const snapshot = state.data;
  const profile = snapshot.profile;
  const recentAchievements = snapshot.recentAchievements;
  const recentlyPlayedGames = snapshot.recentlyPlayedGames;
  const memberSince = formatOverviewMemberSince(profile.metrics);
  const totalPoints = formatOverviewPoints(profile.metrics);
  const gamesBeaten = getMetricValue(profile.metrics, "games-beaten", "Games Beaten");
  const retroRatio = getMetricValue(profile.metrics, "retro-ratio", "RetroRatio");
  const refreshedAt = state.lastUpdatedAt ?? snapshot.refreshedAt;
  const refreshedLabel = refreshedAt !== undefined ? new Date(refreshedAt).toLocaleString() : undefined;
  return (
    <>
      <PanelSection title="Overview">
        <PanelSectionRow>
          <div style={getOverviewCardStyle()}>
            <OverviewProfileEntry
              avatarUrl={profile.identity.avatarUrl}
              displayName={profile.identity.displayName}
              memberSince={memberSince}
              providerId={profile.providerId}
              onOpenProfile={onOpenProfile}
            />

            {profile.summary.completionPercent !== undefined ? (
              <DeckyCompletionProgressBar compact percent={profile.summary.completionPercent} />
            ) : null}

            <div style={getOverviewStatsGridStyle()}>
              <OverviewStat label="Points" value={totalPoints ?? "-"} />
              <OverviewStat
                label="Achievements Unlocked"
                value={formatCount(profile.summary.unlockedCount)}
              />
              <OverviewStat label="Games Beaten" value={gamesBeaten ?? "-"} />
              <OverviewStat label="RetroRatio" value={retroRatio ?? "-"} />
            </div>

            <div style={getOverviewPillRowStyle()}>
              <DeckyCompactPillActionGroup style={getOverviewPillGroupStyle()}>
                <DeckyCompactPillActionItem label="Refresh" onClick={onRefreshDashboard} />
                <DeckyCompactPillActionItem label="Settings" onClick={onOpenSettings} />
              </DeckyCompactPillActionGroup>
            </div>

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
              <RecentlyPlayedRow game={game} onOpenGameDetail={onOpenGameDetail} />
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
