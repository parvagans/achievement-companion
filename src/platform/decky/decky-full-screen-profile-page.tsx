import { useMemo, type CSSProperties } from "react";
import type { ResourceState } from "@core/cache";
import type { DashboardSnapshot, NormalizedMetric, RecentlyPlayedGame } from "@core/domain";
import { PanelSection, PanelSectionRow, ScrollPanel } from "@decky/ui";
import { PlaceholderState } from "@ui/PlaceholderState";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import { initialDeckyBootstrapState, loadDeckyDashboardState } from "./decky-app-services";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";

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

function getSectionBlockStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
}

function getSectionLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.7em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
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
}: {
  readonly label: string;
  readonly value: string;
  readonly secondary?: string;
}): JSX.Element {
  return (
    <div style={getStatCardStyle()}>
      <div style={getStatLabelStyle()}>{label}</div>
      <div style={getStatValueStyle()}>{value}</div>
      {secondary !== undefined ? <div style={getStatSecondaryStyle()}>{secondary}</div> : null}
    </div>
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
          <div style={getRecentGameMetaStyle()}>
            {playedLabel !== undefined ? `Played ${playedLabel}` : "Play time unavailable"}
          </div>
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
  const totalPoints = getProfileMetric({
    metrics: profile.metrics,
    keys: ["total-points", "Points"],
  });
  const softcorePoints = getProfileMetric({
    metrics: profile.metrics,
    keys: ["softcore-points", "Softcore"],
  });
  const truePoints = getProfileMetric({
    metrics: profile.metrics,
    keys: ["true-points", "True"],
  });
  const memberSince = formatShortDate(
    getProfileMetric({
      metrics: profile.metrics,
      keys: ["member-since", "Member Since"],
    }),
  );
  const richPresence = getProfileMetric({
    metrics: profile.metrics,
    keys: ["rich-presence", "Rich Presence"],
  });
  return (
    <ScrollPanel>
      <TopAlignedScrollViewport scrollKey={`full-screen-profile:${providerId ?? "missing"}`}>
        <div style={getPageFrameStyle()}>
          <PanelSection title="Navigation">
            <PanelSectionRow>
              <DeckyFullscreenActionRow>
                <DeckyFullscreenActionButton label="Back" onClick={onBack} />
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
            </PanelSectionRow>
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
                  <div style={getHeroLabelStyle()}>RetroAchievements profile</div>
                  <div style={getHeroNameStyle()}>{profile.identity.displayName}</div>
                  {profile.motto !== undefined ? (
                    <div style={getHeroMottoStyle()}>
                      <div style={getHeroMottoLabelStyle()}>Motto</div>
                      <div style={getHeroMottoTextStyle()}>{profile.motto}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Account stats">
            <PanelSectionRow>
              <div style={getStatsGridStyle()}>
                <ProfileStat label="Total points" value={totalPoints ?? "-"} />
                <ProfileStat label="Softcore points" value={softcorePoints ?? "-"} />
                <ProfileStat label="True points" value={truePoints ?? "-"} />
                <ProfileStat label="Member since" value={memberSince ?? "-"} />
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
