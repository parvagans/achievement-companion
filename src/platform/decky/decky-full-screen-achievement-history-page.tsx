import { useMemo, useState, type CSSProperties, type ComponentProps, type FocusEventHandler } from "react";
import type { ResourceState } from "@core/cache";
import type { AchievementHistorySnapshot, NormalizedMetric, RecentUnlock } from "@core/domain";
import { Field, Focusable, PanelSection, PanelSectionRow, ScrollPanel } from "@decky/ui";
import { PlaceholderState } from "@ui/PlaceholderState";
import {
  initialDeckyAchievementHistoryState,
  loadDeckyAchievementHistoryState,
} from "./decky-app-services";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { addProfileAvatarCacheBustParam } from "./decky-avatar-cache-busting";
import { TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { buildAchievementStatus } from "./decky-achievement-detail-helpers";
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
    flexDirection: "column",
    gap: 14,
    padding: 18,
    borderRadius: 20,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.03))",
  };
}

function getHeroHeaderRowStyle(): CSSProperties {
  return {
    display: "flex",
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
    minWidth: 0,
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
  refreshedAt,
}: {
  readonly avatarUrl: string | undefined;
  readonly displayName: string;
  readonly refreshedAt: number | undefined;
}): JSX.Element {
  const renderedAvatarUrl = addProfileAvatarCacheBustParam(avatarUrl, refreshedAt);

  if (renderedAvatarUrl !== undefined) {
    return <DeckyGameArtwork compact src={renderedAvatarUrl} size={56} title={displayName} />;
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
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 12,
    alignItems: "flex-start",
    minWidth: 0,
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: 16,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.026))",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 2px 8px rgba(0, 0, 0, 0.15)",
  };
}

function getAchievementRowTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
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

function getAchievementRowGameStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.76)",
    fontSize: "0.84em",
    lineHeight: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getAchievementRowMetadataStackStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    minWidth: 0,
  };
}

function getAchievementHistoryStatusStyle(achievement: Pick<RecentUnlock["achievement"], "isUnlocked" | "unlockMode">): CSSProperties {
  const isHardcore = achievement.isUnlocked && achievement.unlockMode === "hardcore";
  const isSoftcore = achievement.isUnlocked && achievement.unlockMode === "softcore";

  return {
    color: isHardcore
      ? "rgba(232, 201, 102, 0.95)"
      : isSoftcore
        ? "rgba(220, 225, 233, 0.95)"
        : "rgba(255, 255, 255, 0.72)",
    fontSize: "0.8em",
    fontWeight: 800,
    lineHeight: 1.2,
  };
}

function getAchievementHistoryDetailStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.8em",
    lineHeight: 1.2,
  };
}

function getAchievementHistoryRowFocusStyle(focused: boolean): CSSProperties {
  return {
    outline: focused ? "2px solid rgba(69, 148, 255, 0.8)" : "none",
    outlineOffset: 1,
    boxShadow: focused
      ? "0 0 0 1px rgba(69, 148, 255, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 4px 14px rgba(0, 0, 0, 0.22)"
      : undefined,
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

function getAchievementHistoryRowTone(achievement: Pick<RecentUnlock["achievement"], "isUnlocked" | "unlockMode">): "hardcore" | "softcore" | "locked" {
  if (!achievement.isUnlocked) {
    return "locked";
  }

  if (achievement.unlockMode === "hardcore") {
    return "hardcore";
  }

  return "softcore";
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

  return `Showing ${formatCount(entryCount)} unlocked achievements, newest first.`;
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
  const [isFocused, setIsFocused] = useState(false);
  const openAchievementDetail = (): void => {
    onOpenAchievementDetail(recentUnlock.game.gameId, recentUnlock.achievement.achievementId);
  };
  const status = buildAchievementStatus(recentUnlock.achievement);
  const unlockedAt = recentUnlock.unlockedAt ?? recentUnlock.achievement.unlockedAt;
  const unlockRate = getMetricValue(recentUnlock.achievement.metrics, "true-ratio", "True Ratio");
  const rowTone = getAchievementHistoryRowTone(recentUnlock.achievement);
  const isHardcore = rowTone === "hardcore";
  const isSoftcore = rowTone === "softcore";

  const rowStyle: CSSProperties = {
    ...getAchievementRowStyle(),
    borderColor: isHardcore
      ? "rgba(214, 178, 74, 0.28)"
      : isSoftcore
        ? "rgba(214, 221, 232, 0.2)"
        : "rgba(255, 255, 255, 0.12)",
    borderLeftWidth: 4,
    borderLeftStyle: "solid",
    borderLeftColor: isHardcore
      ? "rgba(214, 178, 74, 0.8)"
      : isSoftcore
        ? "rgba(214, 221, 232, 0.72)"
        : "rgba(255, 255, 255, 0.12)",
    background: isHardcore
      ? "linear-gradient(180deg, rgba(214, 178, 74, 0.08), rgba(214, 178, 74, 0.03))"
      : isSoftcore
        ? "linear-gradient(180deg, rgba(214, 221, 232, 0.07), rgba(214, 221, 232, 0.03))"
        : "rgba(255, 255, 255, 0.03)",
    ...getAchievementHistoryRowFocusStyle(isFocused),
  };

  return (
    <Focusable
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      noFocusRing
      role="button"
      aria-label={`${recentUnlock.achievement.title} history detail`}
      onActivate={openAchievementDetail}
      onClick={openAchievementDetail}
      onGamepadFocus={(event) => {
        scrollFocusedGamepadElementIntoView(event);
        setIsFocused(true);
      }}
      onFocus={(event) => {
        setIsFocused(true);
        scrollFocusedElementIntoView(event);
      }}
      onBlur={() => {
        setIsFocused(false);
      }}
      onCancel={onBack}
      data-achievement-history-row-tone={rowTone}
      style={rowStyle}
    >
      <span style={getAchievementBadgeFrameStyle(recentUnlock.achievement.isUnlocked)}>
        {recentUnlock.achievement.badgeImageUrl !== undefined ? (
          <DeckyGameArtwork
            compact
            src={recentUnlock.achievement.badgeImageUrl}
            size={32}
            title={recentUnlock.achievement.title}
          />
        ) : (
          <span style={getFallbackBadgeStyle(32)}>{getFallbackInitials(recentUnlock.achievement.title)}</span>
        )}
      </span>

      <span style={getAchievementRowTextStyle()}>
        <span style={getAchievementRowTitleStyle()}>{recentUnlock.achievement.title}</span>
        <span style={getAchievementRowGameStyle()}>{recentUnlock.game.title}</span>
        <span style={getAchievementRowMetadataStackStyle()}>
          <span style={getAchievementHistoryStatusStyle(recentUnlock.achievement)}>{status.value}</span>
          <span style={getAchievementHistoryDetailStyle()}>
            {recentUnlock.achievement.points !== undefined
              ? `Points ${formatCount(recentUnlock.achievement.points)}`
              : "Points unavailable"}
          </span>
          <span style={getAchievementHistoryDetailStyle()}>
            {unlockRate !== undefined ? `Unlock rate ${unlockRate}` : "Unlock rate unavailable"}
          </span>
          {unlockedAt !== undefined ? (
            <span style={getAchievementHistoryDetailStyle()}>{`Unlocked ${formatTimestamp(unlockedAt)}`}</span>
          ) : null}
        </span>
      </span>
    </Focusable>
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
        ].join(" · ")}
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
          <PanelSection title="Achievement history">
            <PanelSectionRow>
              <div style={getHeroCardStyle()}>
                <div style={getHeroHeaderRowStyle()}>
                  <AchievementHistoryProfileAvatar
                    avatarUrl={profile.identity.avatarUrl}
                    displayName={profile.identity.displayName}
                    refreshedAt={refreshTimestamp}
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
                          : "Unlocked achievements, newest first."}
                      </div>
                      {memberSince !== undefined ? <div>{`Member since ${memberSince}.`}</div> : null}
                    </div>
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

                <DeckyFullscreenActionRow centered>
                  <DeckyFullscreenActionButton
                    label="Back"
                    isFullscreenBackAction
                    onClick={() => {
                      onBack();
                    }}
                  />
                </DeckyFullscreenActionRow>
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
