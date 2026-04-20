import { useMemo, type CSSProperties, type ComponentProps, type FocusEventHandler } from "react";
import type { ResourceState } from "@core/cache";
import type { AchievementHistorySnapshot, NormalizedMetric, RecentUnlock } from "@core/domain";
import { Field, PanelSection, PanelSectionRow, ScrollPanel } from "@decky/ui";
import { PlaceholderState } from "@ui/PlaceholderState";
import {
  initialDeckyAchievementHistoryState,
  loadDeckyAchievementHistoryState,
} from "./decky-app-services";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { formatDeckyProviderLabel } from "./providers";
import { STEAM_PROVIDER_ID } from "./providers/steam";

export interface DeckyFullScreenAchievementHistoryPageProps {
  readonly providerId: string | undefined;
  readonly onBack: () => void;
  readonly onOpenAchievementDetail: (gameId: string, achievementId: string) => void;
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

function getMetricValue(metrics: readonly NormalizedMetric[], ...keys: string[]): string | undefined {
  for (const key of keys) {
    const match = metrics.find((metric) => metric.key === key || metric.label === key);
    if (match !== undefined) {
      return match.value;
    }
  }

  return undefined;
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

function getProfileAvatarInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);

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

function getProfileAvatarFrameStyle(): CSSProperties {
  return {
    width: 56,
    height: 56,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: 16,
    border: "1px solid rgba(255, 255, 255, 0.12)",
    background:
      "linear-gradient(160deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.04))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: "0.9em",
    fontWeight: 800,
    letterSpacing: "0.06em",
  };
}

function AchievementHistoryProfileAvatar({
  avatarUrl,
  displayName,
}: {
  readonly avatarUrl: string | undefined;
  readonly displayName: string;
}): JSX.Element {
  if (avatarUrl !== undefined) {
    return <DeckyGameArtwork compact src={avatarUrl} size={56} title={displayName} />;
  }

  return <span style={getProfileAvatarFrameStyle()}>{getProfileAvatarInitials(displayName)}</span>;
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

function getHeroTitleStyle(): CSSProperties {
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

function getHeroSupportStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.92em",
    lineHeight: 1.35,
  };
}

function getStatsGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
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

function getBrowserCardStyle(): CSSProperties {
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

function getBrowserTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getBrowserSummaryStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: "0.94em",
    lineHeight: 1.35,
  };
}

function getBrowserMetaStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.86em",
    lineHeight: 1.25,
  };
}

function getAchievementRowStyle(): CSSProperties {
  return {
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
    minWidth: 0,
  };
}

function getAchievementRowTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
    flex: "1 1 260px",
  };
}

function getAchievementRowTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1.05em",
    fontWeight: 800,
    lineHeight: 1.12,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getAchievementRowSummaryStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: "0.94em",
    lineHeight: 1.35,
    whiteSpace: "pre-wrap",
  };
}

function getAchievementRowSupportStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.84em",
    lineHeight: 1.25,
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

const scrollFocusedElementIntoView: FocusEventHandler<HTMLElement> = (event) => {
  event.currentTarget.scrollIntoView({
    block: "nearest",
    inline: "nearest",
  });
};

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

function isRenderableAchievementHistoryState(
  state: ResourceState<AchievementHistorySnapshot>,
): state is ResourceState<AchievementHistorySnapshot> & { readonly data: AchievementHistorySnapshot } {
  return (state.status === "success" || state.status === "stale") && state.data !== undefined;
}

function getAchievementHistoryPointsValue(achievement: RecentUnlock["achievement"]): string {
  return achievement.points !== undefined ? formatCount(achievement.points) : "-";
}

function getAchievementHistoryUnlockRateValue(achievement: RecentUnlock["achievement"]): string {
  return getMetricValue(achievement.metrics, "true-ratio", "True Ratio") ?? "-";
}

function getAchievementHistoryRowDescription(recentUnlock: RecentUnlock): JSX.Element {
  const unlockedAt = recentUnlock.unlockedAt ?? recentUnlock.achievement.unlockedAt;
  const points = getAchievementHistoryPointsValue(recentUnlock.achievement);
  const unlockRate = getAchievementHistoryUnlockRateValue(recentUnlock.achievement);
  const isSteamProvider = recentUnlock.achievement.providerId === STEAM_PROVIDER_ID;
  const summaryParts = [
    recentUnlock.game.title,
    ...(isSteamProvider ? [] : [`Points ${points}`]),
    `Unlock rate ${unlockRate}`,
  ];

  return (
    <div style={getAchievementRowTextStyle()}>
      <div style={getAchievementRowSummaryStyle()}>
        {summaryParts.join(" | ")}
      </div>
      <div style={getAchievementRowSupportStyle()}>
        {`Unlocked ${formatTimestamp(unlockedAt)}`}
      </div>
    </div>
  );
}

function formatAchievementHistoryHeroCountLabel(providerId: string, sourceLabel: string): string {
  if (providerId === STEAM_PROVIDER_ID) {
    return sourceLabel.toLowerCase().includes("library unlock") ? "Library unlocks" : "Loaded unlocks";
  }

  return "Unlocked";
}

function formatAchievementHistoryBrowserSummary(
  providerId: string,
  sourceLabel: string,
  entryCount: number,
): string {
  if (providerId === STEAM_PROVIDER_ID) {
    return sourceLabel.toLowerCase().includes("library unlock")
      ? `Showing ${formatCount(entryCount)} library unlocks newest first.`
      : `Showing ${formatCount(entryCount)} loaded unlocks newest first.`;
  }

  return `Showing ${formatCount(entryCount)} unlocked achievements newest first.`;
}

function AchievementHistoryRow({
  recentUnlock,
  onOpenAchievementDetail,
  onBack,
}: {
  readonly recentUnlock: RecentUnlock;
  readonly onOpenAchievementDetail: (gameId: string, achievementId: string) => void;
  readonly onBack: () => void;
}): JSX.Element {
  const openAchievementDetail = (): void => {
    onOpenAchievementDetail(recentUnlock.game.gameId, recentUnlock.achievement.achievementId);
  };

  return (
    <Field
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      focusable
      highlightOnFocus
      icon={
        recentUnlock.achievement.badgeImageUrl !== undefined ? (
          <span style={getAchievementBadgeFrameStyle(recentUnlock.achievement.isUnlocked)}>
            <DeckyGameArtwork
              compact
              src={recentUnlock.achievement.badgeImageUrl}
              size={32}
              title={recentUnlock.achievement.title}
            />
          </span>
        ) : (
          <span style={getFallbackBadgeStyle(32)}>{getFallbackInitials(recentUnlock.achievement.title)}</span>
        )
      }
      bottomSeparator="none"
      verticalAlignment="center"
      label={recentUnlock.achievement.title}
      description={getAchievementHistoryRowDescription(recentUnlock)}
      onActivate={openAchievementDetail}
      onClick={openAchievementDetail}
      onGamepadFocus={scrollFocusedGamepadElementIntoView}
    />
  );
}

function AchievementHistoryBrowser({
  entries,
  onOpenAchievementDetail,
  providerId,
  sourceLabel,
  onBack,
}: {
  readonly entries: readonly RecentUnlock[];
  readonly onOpenAchievementDetail: (gameId: string, achievementId: string) => void;
  readonly providerId: string;
  readonly sourceLabel: string;
  readonly onBack: () => void;
}): JSX.Element {
  const newestUnlockedAt = entries[0]?.unlockedAt ?? entries[0]?.achievement.unlockedAt;
  const oldestUnlockedAt = entries[entries.length - 1]?.unlockedAt ?? entries[entries.length - 1]?.achievement.unlockedAt;

  return (
    <div style={getBrowserCardStyle()}>
      <div style={getBrowserTitleStyle()}>Browse</div>
      <div style={getBrowserSummaryStyle()}>
        {formatAchievementHistoryBrowserSummary(providerId, sourceLabel, entries.length)}
      </div>
      <div style={getBrowserMetaStyle()}>
        {[
          newestUnlockedAt !== undefined ? `Newest ${formatTimestamp(newestUnlockedAt)}` : "Newest unavailable",
          oldestUnlockedAt !== undefined ? `Oldest ${formatTimestamp(oldestUnlockedAt)}` : "Oldest unavailable",
        ].join(" | ")}
      </div>

      {entries.length > 0 ? (
        <>
          {entries.map((recentUnlock) => (
            <PanelSectionRow
              key={`${recentUnlock.game.gameId}:${recentUnlock.achievement.achievementId}:${recentUnlock.unlockedAt ?? recentUnlock.achievement.unlockedAt ?? "unknown"}`}
            >
              <AchievementHistoryRow
                recentUnlock={recentUnlock}
                onOpenAchievementDetail={onOpenAchievementDetail}
                onBack={onBack}
              />
            </PanelSectionRow>
          ))}
        </>
      ) : (
        <PanelSectionRow>
          <Field
            bottomSeparator="none"
            description="No unlocked achievements were returned yet."
            label="Achievement history"
          />
        </PanelSectionRow>
      )}
    </div>
  );
}

export function DeckyFullScreenAchievementHistoryPage({
  providerId,
  onBack,
  onOpenAchievementDetail,
}: DeckyFullScreenAchievementHistoryPageProps): JSX.Element {
  const loadSelectedAchievementHistory = useMemo(() => {
    if (providerId === undefined) {
      return () => Promise.resolve(initialDeckyAchievementHistoryState);
    }

    return () => loadDeckyAchievementHistoryState(providerId);
  }, [providerId]);
  const state = useAsyncResourceState(loadSelectedAchievementHistory, initialDeckyAchievementHistoryState);
  const hasRouteParameters = providerId !== undefined;

  if (!isRenderableAchievementHistoryState(state)) {
    return (
      <ScrollPanel>
        <TopAlignedScrollViewport scrollKey={`full-screen-achievement-history:${providerId ?? "missing"}`}>
          <div style={getPageFrameStyle()}>
            <PlaceholderState
              title="Full-screen achievement history"
              description={
                hasRouteParameters
                  ? "Loading the full-screen achievement history page from the existing history service."
                  : "The full-screen achievement history page route is missing provider information."
              }
              state={state}
              footer={<span>Use Back to return to the full-screen profile page.</span>}
            />
          </div>
        </TopAlignedScrollViewport>
      </ScrollPanel>
    );
  }

  const snapshot = state.data;
  const profile = snapshot.profile;
  const memberSince = formatShortDate(getMetricValue(profile.metrics, "member-since", "Member Since"));
  const newestUnlockedAt = snapshot.summary.newestUnlockedAt;
  const oldestUnlockedAt = snapshot.summary.oldestUnlockedAt;
  const refreshTimestamp = state.lastUpdatedAt ?? snapshot.refreshedAt;
  const snapshotSourceLabel = snapshot.sourceLabel;
  const isSteamProvider = snapshot.providerId === STEAM_PROVIDER_ID;
  const heroCountLabel = formatAchievementHistoryHeroCountLabel(snapshot.providerId, snapshotSourceLabel);
  const isLibraryUnlockHistory = isSteamProvider && snapshotSourceLabel.toLowerCase().includes("library unlock");

  return (
    <ScrollPanel>
      <TopAlignedScrollViewport
        scrollKey={`full-screen-achievement-history:${providerId ?? snapshot.providerId}`}
      >
        <div style={getPageFrameStyle()}>
          <PanelSection title="Navigation">
            <DeckyFullscreenActionRow>
              <DeckyFullscreenActionButton
                label="Back"
                isFullscreenBackAction
                onClick={() => {
                  onBack();
                }}
              />
            </DeckyFullscreenActionRow>
          </PanelSection>

          <PanelSection title="Achievement history">
            <PanelSectionRow>
              <div style={getHeroCardStyle()}>
                <AchievementHistoryProfileAvatar
                  avatarUrl={profile.identity.avatarUrl}
                  displayName={profile.identity.displayName}
                />

                <div style={getHeroTextStyle()}>
                    <div style={getHeroLabelStyle()}>{`${formatDeckyProviderLabel(snapshot.providerId)} profile`}</div>
                    <div style={getHeroTitleStyle()}>{profile.identity.displayName}</div>
                    <div style={getHeroSupportStyle()}>
                      <div>
                      {isSteamProvider
                        ? isLibraryUnlockHistory
                          ? "Browsing library unlocks newest first."
                          : "Browsing loaded unlocked achievements newest first."
                        : "Browsing unlocked achievements newest first."}
                    </div>
                    {memberSince !== undefined ? <div>{`Member since ${memberSince}.`}</div> : null}
                  </div>
                </div>

                <div style={getStatsGridStyle()}>
                  <div style={getStatCardStyle()}>
                    <div style={getStatLabelStyle()}>{heroCountLabel}</div>
                    <div style={getStatValueStyle()}>{formatCount(snapshot.summary.unlockedCount)}</div>
                  </div>
                  <div style={getStatCardStyle()}>
                    <div style={getStatLabelStyle()}>Newest</div>
                    <div style={getStatValueStyle()}>{newestUnlockedAt !== undefined ? formatTimestamp(newestUnlockedAt) : "-"}</div>
                  </div>
                  <div style={getStatCardStyle()}>
                    <div style={getStatLabelStyle()}>Oldest</div>
                    <div style={getStatValueStyle()}>{oldestUnlockedAt !== undefined ? formatTimestamp(oldestUnlockedAt) : "-"}</div>
                  </div>
                </div>
              </div>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="History">
            <AchievementHistoryBrowser
              entries={snapshot.entries}
              onOpenAchievementDetail={onOpenAchievementDetail}
              providerId={snapshot.providerId}
              sourceLabel={snapshotSourceLabel}
              onBack={onBack}
            />
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
