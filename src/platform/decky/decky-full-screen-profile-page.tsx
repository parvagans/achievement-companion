import { useMemo, type CSSProperties } from "react";
import type { ResourceState } from "@core/cache";
import type { DashboardSnapshot, NormalizedMetric, RecentlyPlayedGame } from "@core/domain";
import { PanelSection, PanelSectionRow, ScrollPanel } from "@decky/ui";
import { PlaceholderState } from "@ui/PlaceholderState";
import { DeckyCompletionProgressBar } from "./decky-completion-progress-bar";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import { initialDeckyBootstrapState, loadDeckyDashboardState } from "./decky-app-services";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { formatDeckyProviderLabel } from "./providers";
import { STEAM_PROVIDER_ID, useDeckySteamLibraryAchievementScanOverview } from "./providers/steam";
import {
  formatProfileMemberSince,
  type ProfileStatSectionVariant,
  getRetroAchievementsProfileStatSections,
  getRetroAchievementsProfileSectionAccentStyle,
  getRetroAchievementsProfileSectionStyle,
  getRetroAchievementsProfileSectionTitleStyle,
  getSteamAccountProgressCards,
  getSteamAccountProgressSummary,
} from "./decky-stat-helpers";
import type { SteamLibraryAchievementScanOverview } from "./providers/steam";

export interface DeckyFullScreenProfilePageProps {
  readonly providerId: string | undefined;
  readonly onBack: () => void;
  readonly onOpenCompletionProgress: (providerId: string) => void;
  readonly onOpenAchievementHistory: (providerId: string) => void;
  readonly onOpenSettings: () => void;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatTimestamp(epochMs: number | undefined): string {
  if (epochMs === undefined) {
    return "Unknown";
  }

  return new Date(epochMs).toLocaleString();
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

export function formatSteamPlaytimeMinutes(minutes: number | undefined): string | undefined {
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

function getMetricValue(metrics: readonly NormalizedMetric[], ...keys: string[]): string | undefined {
  for (const key of keys) {
    const match = metrics.find((metric) => metric.key === key || metric.label === key);
    if (match !== undefined) {
      return match.value;
    }
  }

  return undefined;
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

function getFallbackInitials(title: string): string {
  const words = title
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

function getPageFrameStyle(): CSSProperties {
  return {
    padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px calc(env(safe-area-inset-bottom, 0px) + 12px)",
    boxSizing: "border-box",
  };
}

function getHeroCardStyle(): CSSProperties {
  return {
    display: "flex",
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
    padding: 18,
    borderRadius: 20,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.03))",
  };
}

function getHeroTextStyle(): CSSProperties {
  return {
    flex: "1 1 280px",
    minWidth: 240,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
}

function getHeroLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getHeroNameStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1.35em",
    fontWeight: 800,
    lineHeight: 1.1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getHeroSubtitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.95em",
    lineHeight: 1.25,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getHeroMottoStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    boxSizing: "border-box",
    minWidth: 0,
  };
}

function getHeroMottoLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.68em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getHeroMottoTextStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.86)",
    fontSize: "0.94em",
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
  };
}

function getAvatarFallbackStyle(size: number): CSSProperties {
  return {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.12)",
    background:
      "linear-gradient(160deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: "1em",
    fontWeight: 800,
    letterSpacing: "0.06em",
  };
}

function getSectionBlockStyle(variant: ProfileStatSectionVariant): CSSProperties {
  return getRetroAchievementsProfileSectionStyle(variant);
}

function getProgressCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.025))",
  };
}

function getProgressTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.7em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getProgressSubtitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: "0.96em",
    lineHeight: 1.3,
  };
}

function getStatsGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  };
}

function getStatCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    padding: "11px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    minWidth: 0,
    textAlign: "center",
  };
}

function getStatLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "0.72em",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getStatValueStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "0.98em",
    fontWeight: 700,
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "center",
  };
}

function getStatSecondaryStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.82em",
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "center",
  };
}

function getStatActionLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.74em",
    fontWeight: 700,
    letterSpacing: "0.05em",
    lineHeight: 1.2,
  };
}

function getInfoCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.025))",
  };
}

function getInfoCardTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "0.72em",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getInfoCardTextStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: "0.94em",
    lineHeight: 1.35,
    whiteSpace: "pre-wrap",
  };
}

function getRecentGameLayoutStyle(): CSSProperties {
  return {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    minWidth: 0,
  };
}

function getRecentGameTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  };
}

function getRecentGameTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1em",
    fontWeight: 800,
    lineHeight: 1.15,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getRecentGameMetaStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.86em",
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getRecentGamePresenceStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    paddingTop: 10,
    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
  };
}

function getRecentGamePresenceTextStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: "0.88em",
    lineHeight: 1.35,
    whiteSpace: "pre-wrap",
  };
}

function getFallbackBadgeStyle(size: number): CSSProperties {
  return {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: 10,
    border: "1px solid rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: "0.78em",
    fontWeight: 800,
    letterSpacing: "0.06em",
  };
}

function getProfileMetric({
  metrics,
  keys,
  fallback,
}: {
  readonly metrics: readonly NormalizedMetric[];
  readonly keys: readonly string[];
  readonly fallback?: string;
}): string | undefined {
  const value = getMetricValue(metrics, ...keys);
  if (value !== undefined) {
    return value;
  }

  return fallback;
}

function ProfileAvatar({
  avatarUrl,
  displayName,
  size,
}: {
  readonly avatarUrl: string | undefined;
  readonly displayName: string;
  readonly size: number;
}): JSX.Element {
  if (avatarUrl !== undefined) {
    return <DeckyGameArtwork src={avatarUrl} size={size} title={displayName} />;
  }

  return <span style={getAvatarFallbackStyle(size)}>{getFallbackInitials(displayName)}</span>;
}

function ProfileStat({
  label,
  value,
  secondary,
  actionLabel,
  onClick,
}: {
  readonly label: string;
  readonly value: string;
  readonly secondary?: string;
  readonly actionLabel?: string;
  readonly onClick?: () => void;
}): JSX.Element {
  const content = (
    <>
      <div style={getStatLabelStyle()}>{label}</div>
      <div style={getStatValueStyle()}>{value}</div>
      {secondary !== undefined ? <div style={getStatSecondaryStyle()}>{secondary}</div> : null}
      {actionLabel !== undefined ? <div style={getStatActionLabelStyle()}>{actionLabel}</div> : null}
    </>
  );

  if (onClick !== undefined) {
    return (
      <button
        type="button"
        className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
        style={{
          ...getStatCardStyle(),
          appearance: "none",
          width: "100%",
          cursor: "pointer",
          textAlign: "center",
        }}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div style={getStatCardStyle()}>{content}</div>;
}

interface ProfileStatDescriptor {
  readonly label: string;
  readonly value: string;
  readonly secondary?: string;
}

export function getSteamProfileStats(args: {
  readonly profile: DashboardSnapshot["profile"];
  readonly steamLibraryAchievementScanSummary?: SteamLibraryAchievementScanOverview;
}): readonly ProfileStatDescriptor[] {
  const { profile, steamLibraryAchievementScanSummary } = args;
  const steamLevel =
    getProfileMetric({
      metrics: profile.metrics,
      keys: ["steam-level", "Steam Level"],
    }) ?? profile.steamLevel?.toString();
  const ownedGames =
    steamLibraryAchievementScanSummary?.ownedGameCount ??
    profile.ownedGameCount ??
    getProfileMetric({
      metrics: profile.metrics,
      keys: ["owned-games", "Owned Games"],
    });
  const badges = profile.badgeCount;
  const badgeXp = profile.playerXp;
  const achievementsUnlocked =
    steamLibraryAchievementScanSummary?.unlockedAchievements ??
    profile.summary.unlockedCount;
  const perfectGames =
    steamLibraryAchievementScanSummary?.perfectGames ??
    Number(
      getProfileMetric({
        metrics: profile.metrics,
        keys: ["games-beaten", "Perfect Games", "Games Beaten"],
      }) ?? "0",
    );
  const completionPercent =
    steamLibraryAchievementScanSummary?.completionPercent ??
    profile.summary.completionPercent;
  const parsedLastLibraryScan =
    steamLibraryAchievementScanSummary !== undefined
      ? Date.parse(steamLibraryAchievementScanSummary.scannedAt)
      : undefined;
  const lastLibraryScan =
    parsedLastLibraryScan !== undefined && Number.isFinite(parsedLastLibraryScan)
      ? formatRelativeTime(parsedLastLibraryScan)
      : undefined;

  return [
    {
      label: "Steam Level",
      value: steamLevel ?? "-",
    },
    {
      label: "Owned Games",
      value: ownedGames !== undefined ? ownedGames.toString() : "-",
    },
    {
      label: "Achievements Unlocked",
      value: formatCount(achievementsUnlocked),
    },
    {
      label: "Perfect Games",
      value: formatCount(perfectGames),
    },
    {
      label: "Completion",
      value: completionPercent !== undefined ? `${formatCount(completionPercent)}%` : "-",
    },
    {
      label: "Badges",
      value: badges !== undefined ? formatCount(badges) : "-",
      ...(badgeXp !== undefined ? { secondary: `${formatCount(badgeXp)} XP` } : {}),
    },
    ...(lastLibraryScan !== undefined
      ? [
          {
            label: "Last Library Scan",
            value: lastLibraryScan,
          },
        ]
      : []),
  ];
}

export function getDeckyProfileStats(args: {
  readonly profile: DashboardSnapshot["profile"];
  readonly steamLibraryAchievementScanSummary?: SteamLibraryAchievementScanOverview;
}): readonly ProfileStatDescriptor[] {
  if (args.profile.providerId === STEAM_PROVIDER_ID) {
    return getSteamProfileStats(args);
  }

  return getRetroAchievementsProfileStatSections({
    profile: args.profile,
  }).flatMap((section) =>
    section.stats.map((stat) => ({
      label:
        section.title === "RetroAchievements"
          ? `RA ${stat.label}`
          : section.title === "Softcore" || section.title === "Hardcore"
            ? `${section.title} ${stat.label}`
            : stat.label,
      value: stat.value,
      ...(stat.secondary !== undefined ? { secondary: stat.secondary } : {}),
    })),
  );
}

function RecentGameCard({
  game,
  richPresence,
}: {
  readonly game: RecentlyPlayedGame | undefined;
  readonly richPresence: string | undefined;
}): JSX.Element {
  if (game === undefined) {
    return (
      <div style={getInfoCardStyle()}>
        <div style={getInfoCardTitleStyle()}>Most recently played</div>
        <div style={getInfoCardTextStyle()}>No recently played games were returned yet.</div>
        {richPresence !== undefined ? (
          <div style={getRecentGamePresenceStyle()}>
            <div style={getRecentGamePresenceTextStyle()}>{richPresence}</div>
          </div>
        ) : null}
      </div>
    );
  }

  const playedLabel = formatRelativeTime(game.lastPlayedAt);
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

  return (
    <div style={getInfoCardStyle()}>
      <div style={getInfoCardTitleStyle()}>Most recently played</div>
      <div style={getRecentGameLayoutStyle()}>
        {game.coverImageUrl !== undefined ? (
          <DeckyGameArtwork compact src={game.coverImageUrl} size={56} title={game.title} />
        ) : (
          <span style={getFallbackBadgeStyle(56)}>{getFallbackInitials(game.title)}</span>
        )}

        <div style={getRecentGameTextStyle()}>
          <div style={getRecentGameTitleStyle()}>{game.title}</div>
          <div style={getRecentGameMetaStyle()}>{game.platformLabel ?? "Unknown platform"}</div>
          <div style={getRecentGameMetaStyle()}>{formatMiniProgressSummary(game.summary)}</div>
          {playedLabel !== undefined ? (
            <div style={getRecentGameMetaStyle()}>{`Played ${playedLabel}`}</div>
          ) : null}
          {playtimeLines.length > 0 ? (
            <div style={getRecentGameMetaStyle()}>{playtimeLines.join(" | ")}</div>
          ) : playedLabel === undefined ? (
            <div style={getRecentGameMetaStyle()}>Play time unavailable</div>
          ) : null}
        </div>
      </div>

      {richPresence !== undefined ? (
        <div style={getRecentGamePresenceStyle()}>
          <div style={getRecentGamePresenceTextStyle()}>{richPresence}</div>
        </div>
      ) : null}
    </div>
  );
}

function isRenderableDashboardState(
  state: ResourceState<DashboardSnapshot>,
): state is ResourceState<DashboardSnapshot> & {
  readonly data: DashboardSnapshot;
} {
  return (state.status === "success" || state.status === "stale") && state.data !== undefined;
}

export function DeckyFullScreenProfilePage({
  providerId,
  onBack,
  onOpenCompletionProgress,
  onOpenAchievementHistory,
  onOpenSettings,
}: DeckyFullScreenProfilePageProps): JSX.Element {
  const loadSelectedProfile = useMemo(() => {
    if (providerId === undefined) {
      return () => Promise.resolve(initialDeckyBootstrapState);
    }

    return () => loadDeckyDashboardState(providerId);
  }, [providerId]);
  const state = useAsyncResourceState(loadSelectedProfile, initialDeckyBootstrapState);
  const hasRouteParameters = providerId !== undefined;
  const steamLibraryAchievementScanSummary = useDeckySteamLibraryAchievementScanOverview(providerId);

  if (!isRenderableDashboardState(state)) {
    return (
      <ScrollPanel>
        <TopAlignedScrollViewport scrollKey={`full-screen-profile:${providerId ?? "missing"}`}>
          <div style={getPageFrameStyle()}>
            <PlaceholderState
              title="Full-screen profile page"
              description={
                hasRouteParameters
                  ? "Loading the full-screen profile page from the existing dashboard snapshot."
                  : "The full-screen profile page route is missing provider information."
              }
              state={state}
              footer={<span>Use Back to return to the compact dashboard.</span>}
            />
          </div>
        </TopAlignedScrollViewport>
      </ScrollPanel>
    );
  }

  const snapshot = state.data;
  const profile = snapshot.profile;
  const recentGame = snapshot.recentlyPlayedGames[0];
  const memberSince = formatProfileMemberSince(profile.metrics);
  const richPresence = getProfileMetric({
    metrics: profile.metrics,
    keys: ["rich-presence", "Rich Presence"],
  });
  const steamAccountProgress =
    profile.providerId === STEAM_PROVIDER_ID ? getSteamAccountProgressSummary({ profile }) : undefined;
  const steamAccountCards =
    profile.providerId === STEAM_PROVIDER_ID ? getSteamAccountProgressCards({ profile }) : undefined;
  const steamLibraryCompletionPercent =
    profile.providerId === STEAM_PROVIDER_ID
      ? steamLibraryAchievementScanSummary?.completionPercent ?? profile.summary.completionPercent
      : profile.summary.completionPercent;
  const profileStats = getDeckyProfileStats({
    profile,
    ...(steamLibraryAchievementScanSummary !== undefined
      ? { steamLibraryAchievementScanSummary }
      : {}),
  });
  const retroAchievementsProfileStatSections =
    profile.providerId === STEAM_PROVIDER_ID
      ? undefined
      : getRetroAchievementsProfileStatSections({
          profile,
        });
  return (
    <ScrollPanel>
      <TopAlignedScrollViewport scrollKey={`full-screen-profile:${providerId ?? "missing"}`}>
        <div style={getPageFrameStyle()}>
          <PanelSection title="Navigation">
            <DeckyFullscreenActionRow centered>
              <DeckyFullscreenActionButton
                label="Back"
                isFullscreenBackAction
                onClick={() => {
                  onBack();
                }}
              />
              <DeckyFullscreenActionButton
                label="Completion Progress"
                onClick={() => {
                  onOpenCompletionProgress(profile.providerId);
                }}
              />
              <DeckyFullscreenActionButton
                label="Achievement History"
                onClick={() => {
                  onOpenAchievementHistory(profile.providerId);
                }}
              />
              <DeckyFullscreenActionButton
                label="Settings"
                onClick={() => {
                  onOpenSettings();
                }}
              />
            </DeckyFullscreenActionRow>
          </PanelSection>

          <PanelSection title="Profile">
            <PanelSectionRow>
              <div style={getHeroCardStyle()}>
                <ProfileAvatar
                  avatarUrl={profile.identity.avatarUrl}
                  displayName={profile.identity.displayName}
                  size={112}
                />

                <div style={getHeroTextStyle()}>
                  <div style={getHeroLabelStyle()}>{`${formatDeckyProviderLabel(profile.providerId)} profile`}</div>
                  <div style={getHeroNameStyle()}>{profile.identity.displayName}</div>
                  {profile.providerId === STEAM_PROVIDER_ID && memberSince !== undefined ? (
                    <div style={getHeroSubtitleStyle()}>{`Member since ${memberSince}`}</div>
                  ) : null}
                  {profile.motto !== undefined ? (
                    <div style={getHeroMottoStyle()}>
                      <div style={getHeroMottoLabelStyle()}>Motto</div>
                      <div style={getHeroMottoTextStyle()}>{profile.motto}</div>
                    </div>
                  ) : null}
                  {profile.providerId !== STEAM_PROVIDER_ID && memberSince !== undefined ? (
                    <div style={getHeroSubtitleStyle()}>{`Member since ${memberSince}`}</div>
                  ) : null}
                </div>
              </div>
            </PanelSectionRow>
          </PanelSection>

          {steamAccountProgress !== undefined ? (
            <PanelSection title="Steam Account">
              <PanelSectionRow>
                <div style={getProgressCardStyle()}>
                  <div style={getProgressTitleStyle()}>Steam Account</div>
                  <div style={getProgressSubtitleStyle()}>{steamAccountProgress.accountSubtitle}</div>
                  {steamAccountProgress.xpProgressPercent !== undefined ? (
                    <DeckyCompletionProgressBar
                      compact
                      percent={steamAccountProgress.xpProgressPercent}
                      caption={steamAccountProgress.xpProgressCaption}
                      captionPlacement="above"
                    />
                  ) : (
                    <div style={getProgressSubtitleStyle()}>{steamAccountProgress.xpProgressCaption}</div>
                  )}
                  <div style={getStatsGridStyle()}>
                    {steamAccountCards?.map((card) => (
                      <ProfileStat
                        key={card.label}
                        label={card.label}
                        value={card.value}
                        {...(card.secondary !== undefined ? { secondary: card.secondary } : {})}
                      />
                    ))}
                  </div>
                </div>
              </PanelSectionRow>
            </PanelSection>
          ) : null}

            <PanelSection title={profile.providerId === STEAM_PROVIDER_ID ? "Library Progress" : "Account stats"}>
              <PanelSectionRow>
              <div style={getSectionBlockStyle("default")}>
                {profile.providerId === STEAM_PROVIDER_ID ? (
                  <>
                    {steamLibraryCompletionPercent !== undefined ? (
                      <DeckyCompletionProgressBar
                        compact
                        percent={steamLibraryCompletionPercent}
                        caption={`${formatCount(steamLibraryCompletionPercent)}% complete`}
                      />
                    ) : null}
                    <div style={getStatsGridStyle()}>
                      {profileStats.map((stat) => (
                        <ProfileStat
                          key={stat.label}
                          label={stat.label}
                          value={stat.value}
                          {...(stat.secondary !== undefined ? { secondary: stat.secondary } : {})}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    {retroAchievementsProfileStatSections?.map((section) => (
                      <div
                        key={section.title}
                        data-profile-section-variant={section.variant}
                        style={{
                          ...getSectionBlockStyle(section.variant),
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <div aria-hidden="true" style={getRetroAchievementsProfileSectionAccentStyle(section.variant)} />
                        <div style={getRetroAchievementsProfileSectionTitleStyle(section.variant)}>{section.title}</div>
                        <div style={getStatsGridStyle()}>
                          {section.stats.map((stat) => (
                            <ProfileStat
                              key={`${section.title}:${stat.label}`}
                              label={stat.label}
                              value={stat.value}
                              {...(stat.secondary !== undefined ? { secondary: stat.secondary } : {})}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Recent activity">
            <PanelSectionRow>
              <RecentGameCard game={recentGame} richPresence={richPresence} />
            </PanelSectionRow>
          </PanelSection>
        </div>
      </TopAlignedScrollViewport>
    </ScrollPanel>
  );
}
