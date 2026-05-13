import { useMemo, useState, type CSSProperties, type ComponentProps } from "react";
import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { Field, PanelSection, PanelSectionRow, ScrollPanel } from "@decky/ui";
import { PlaceholderState } from "@ui/PlaceholderState";
import {
  initialDeckyGameDetailState,
  loadDeckyGameDetailState,
} from "./decky-app-services";
import { DeckyActionButtonItem } from "./decky-action-button-item";
import { DeckyCompletionProgressBar, getCompletionPercent } from "./decky-completion-progress-bar";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import {
  DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS,
  DECKY_FOCUS_ACTION_ROW_CLASS,
} from "./decky-focus-styles";
import { buildAchievementStatus, dedupeDistinctLabels, formatModeProgressSummary } from "./decky-achievement-detail-helpers";
import { TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { formatDeckyProviderLabel } from "./providers";

const FULL_SCREEN_INITIAL_ACHIEVEMENT_LIMIT = 12;
const FULL_SCREEN_ACHIEVEMENT_LOAD_STEP = 12;
const ACHIEVEMENT_FILTERS = ["all", "unlocked", "locked"] as const;

type AchievementFilter = (typeof ACHIEVEMENT_FILTERS)[number];

export interface DeckyFullScreenGamePageProps {
  readonly providerId: string | undefined;
  readonly gameId: string | undefined;
  readonly onOpenAchievementDetail: ((achievementId: string) => void) | undefined;
  readonly onBack: () => void;
  readonly backLabel?: string;
  readonly backDescription?: string;
  readonly backFooter?: string;
}

function formatTimestamp(epochMs: number | undefined): string {
  if (epochMs === undefined) {
    return "Unknown";
  }

  return new Date(epochMs).toLocaleString();
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatAchievementDescription(achievement: NormalizedAchievement): string {
  const parts = [buildAchievementStatus(achievement).value];

  if (achievement.points !== undefined) {
    parts.push(`${formatCount(achievement.points)} points`);
  }

  const unlockedAt = achievement.unlockedAt;
  if (unlockedAt !== undefined) {
    parts.push(`Date ${formatTimestamp(unlockedAt)}`);
  }

  return parts.join(", ");
}

function formatAchievementFilterLabel(filter: AchievementFilter): string {
  if (filter === "all") {
    return "All";
  }

  if (filter === "unlocked") {
    return "Unlocked";
  }

  return "Locked";
}

function matchesAchievementFilter(
  achievement: NormalizedAchievement,
  filter: AchievementFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "unlocked") {
    return achievement.isUnlocked;
  }

  return !achievement.isUnlocked;
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
  if (filter === "all") {
    return "No achievement entries were returned for this game.";
  }

  return `No ${formatAchievementFilterLabel(filter).toLowerCase()} achievements match this filter.`;
}

function formatAchievementStatusSummary(
  achievements: readonly NormalizedAchievement[],
): string {
  const unlockedCount = achievements.filter((achievement) => achievement.isUnlocked).length;
  const lockedCount = achievements.length - unlockedCount;

  return `Total ${formatCount(achievements.length)} · Unlocked ${formatCount(unlockedCount)} · Locked ${formatCount(lockedCount)}`;
}

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

function getGameSpotlightLayoutStyle(): CSSProperties {
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

function getFullScreenPageFrameStyle(): CSSProperties {
  return {
    padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px calc(env(safe-area-inset-bottom, 0px) + 12px)",
    boxSizing: "border-box",
  };
}

function getGameSpotlightHeroStyle(): CSSProperties {
  return {
    flex: "0 0 auto",
  };
}

function getGameSpotlightStatsStyle(): CSSProperties {
  return {
    flex: "1 1 280px",
    minWidth: 240,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };
}

function getAchievementBrowserStackStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };
}

function getGameSpotlightTitleBlockStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  };
}

function getGameSpotlightKickerStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getGameSpotlightTitleStyle(): CSSProperties {
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

function getGameSpotlightMetaRowStyle(): CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  };
}

function getGameSpotlightMetaPillStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: "0.82em",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  };
}

function getGameSpotlightSupportStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.84em",
    lineHeight: 1.3,
  };
}

function getProgressCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  };
}

function getProgressCardTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "0.72em",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getProgressStatGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 8,
  };
}

function getProgressStatStyle(): CSSProperties {
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

function getProgressStatLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "0.72em",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getProgressStatValueStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "0.98em",
    fontWeight: 700,
    lineHeight: 1.15,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "center",
  };
}

function ProgressStat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div style={getProgressStatStyle()}>
      <div style={getProgressStatLabelStyle()}>{label}</div>
      <div style={getProgressStatValueStyle()}>{value}</div>
    </div>
  );
}

function getAchievementBrowserCardStyle(): CSSProperties {
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

function getAchievementBrowserTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getAchievementBrowserSummaryStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: "0.94em",
    lineHeight: 1.35,
  };
}

function getAchievementBrowserMetaStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.86em",
    lineHeight: 1.25,
  };
}

function getAchievementBrowserContinuationStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingTop: 2,
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

function getAchievementFilterGroupStyle(): CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: "8px 10px",
    minWidth: 0,
    width: "100%",
  };
}

function getAchievementFilterWrapStyle(): CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 5,
    width: "100%",
  };
}

function AchievementFilterPills({
  currentFilter,
  onSelect,
  onBack,
}: {
  readonly currentFilter: AchievementFilter;
  readonly onSelect: (filter: AchievementFilter) => void;
  readonly onBack: () => void;
}): JSX.Element {
  return (
    <DeckyFullscreenActionRow>
      {ACHIEVEMENT_FILTERS.map((filter) => {
        const active = filter === currentFilter;

        return (
          <DeckyFullscreenActionButton
            key={filter}
            label={formatAchievementFilterLabel(filter)}
            onClick={() => {
              onSelect(filter);
            }}
            selected={active}
          />
        );
      })}
    </DeckyFullscreenActionRow>
  );
}

function AchievementBrowseRow({
  achievement,
  index,
  onOpenAchievementDetail,
  onBack,
}: {
  readonly achievement: NormalizedAchievement;
  readonly index: number;
  readonly onOpenAchievementDetail: ((achievementId: string) => void) | undefined;
  readonly onBack: () => void;
}): JSX.Element {
  const openAchievementDetail = (): void => {
    if (onOpenAchievementDetail !== undefined) {
      onOpenAchievementDetail(achievement.achievementId);
    }
  };

  return (
    <Field
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      focusable
      highlightOnFocus
      icon={
        achievement.badgeImageUrl !== undefined ? (
          <AchievementBadgeIcon achievement={achievement} />
        ) : undefined
      }
      bottomSeparator="none"
      verticalAlignment="center"
      description={formatAchievementDescription(achievement)}
      label={`${index + 1}. ${achievement.title}`}
      onActivate={openAchievementDetail}
      onClick={openAchievementDetail}
      onGamepadFocus={scrollFocusedGamepadElementIntoView}
    />
  );
}

function AchievementBadgeIcon({
  achievement,
}: {
  readonly achievement: NormalizedAchievement;
}): JSX.Element | null {
  if (achievement.badgeImageUrl === undefined) {
    return null;
  }

  return (
    <span style={getAchievementBadgeFrameStyle(achievement.isUnlocked)}>
      <DeckyGameArtwork compact src={achievement.badgeImageUrl} size={32} title={achievement.title} />
    </span>
  );
}

interface AchievementBrowserProps {
  readonly achievementFilter: AchievementFilter;
  readonly achievementSummary: string;
  readonly achievements: readonly NormalizedAchievement[];
  readonly canLoadMoreAchievements: boolean;
  readonly canShowAllAchievements: boolean;
  readonly filteredAchievementCount: number;
  readonly onAchievementFilterChange: (filter: AchievementFilter) => void;
  readonly onOpenAchievementDetail: ((achievementId: string) => void) | undefined;
  readonly onLoadMoreAchievements: () => void;
  readonly onShowAllAchievements: () => void;
  readonly onBack: () => void;
}

function AchievementBrowser({
  achievementFilter,
  achievementSummary,
  achievements,
  canLoadMoreAchievements,
  canShowAllAchievements,
  filteredAchievementCount,
  onAchievementFilterChange,
  onOpenAchievementDetail,
  onLoadMoreAchievements,
  onShowAllAchievements,
  onBack,
}: AchievementBrowserProps): JSX.Element {
  return (
    <div style={getAchievementBrowserStackStyle()}>
      <div style={getAchievementBrowserCardStyle()}>
        <div style={getAchievementBrowserTitleStyle()}>Filtered view</div>

        <div style={getAchievementBrowserSummaryStyle()}>{achievementSummary}</div>

        <div style={getAchievementBrowserMetaStyle()}>
          {formatAchievementVisibilitySummary(
            achievements.length,
            filteredAchievementCount,
            achievementFilter,
          )}
        </div>

        <AchievementFilterPills
          currentFilter={achievementFilter}
          onSelect={onAchievementFilterChange}
          onBack={onBack}
        />
      </div>

      {achievements.length > 0 ? (
        <>
          {achievements.map((achievement, index) => (
            <PanelSectionRow key={achievement.achievementId}>
              <AchievementBrowseRow
                achievement={achievement}
                index={index}
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
            description={formatAchievementFilterEmptyMessage(achievementFilter)}
            label="Achievements"
          />
        </PanelSectionRow>
      )}

      {canLoadMoreAchievements || canShowAllAchievements ? (
        <div style={getAchievementBrowserContinuationStyle()}>
          {canLoadMoreAchievements ? (
              <DeckyActionButtonItem
                className={DECKY_FOCUS_ACTION_ROW_CLASS}
                focusClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
                focusWithinClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
                highlightOnFocus
                description={`Show the next ${formatCount(FULL_SCREEN_ACHIEVEMENT_LOAD_STEP)} achievements below and keep your place in the list.`}
                label={`Show ${formatCount(FULL_SCREEN_ACHIEVEMENT_LOAD_STEP)} more`}
                onClick={onLoadMoreAchievements}
              />
          ) : null}

          {canShowAllAchievements ? (
              <DeckyActionButtonItem
                className={DECKY_FOCUS_ACTION_ROW_CLASS}
                focusClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
                focusWithinClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
                highlightOnFocus
                description="Reveal the rest of the filtered achievements."
                label="Show all"
                onClick={onShowAllAchievements}
              />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function isRenderableGameDetailState(
  state: ResourceState<GameDetailSnapshot>,
): state is ResourceState<GameDetailSnapshot> & { readonly data: GameDetailSnapshot } {
  return (state.status === "success" || state.status === "stale") && state.data !== undefined;
}

export function DeckyFullScreenGamePage({
  providerId,
  gameId,
  onOpenAchievementDetail,
  onBack,
  backLabel = "Back",
  backDescription = "Return to the compact side panel.",
  backFooter = "Use Back to return to the compact side panel.",
}: DeckyFullScreenGamePageProps): JSX.Element {
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>("all");
  const [visibleAchievementLimit, setVisibleAchievementLimit] = useState(FULL_SCREEN_INITIAL_ACHIEVEMENT_LIMIT);
  const [isShowingAllAchievements, setIsShowingAllAchievements] = useState(false);
  const loadSelectedGameDetail = useMemo(() => {
    if (providerId === undefined || gameId === undefined) {
      return () => Promise.resolve(initialDeckyGameDetailState);
    }

    return () => loadDeckyGameDetailState(providerId, gameId);
  }, [gameId, providerId]);
  const state = useAsyncResourceState(loadSelectedGameDetail, initialDeckyGameDetailState);
  const hasRouteParameters = providerId !== undefined && gameId !== undefined;

  if (!isRenderableGameDetailState(state)) {
    return (
      <ScrollPanel>
        <TopAlignedScrollViewport
          scrollKey={`full-screen-game:${providerId ?? "missing"}:${gameId ?? "missing"}`}
        >
          <div style={getFullScreenPageFrameStyle()}>
            <PlaceholderState
              title="Full-screen game page"
              description={
                hasRouteParameters
                  ? "Loading the full-screen game page from the existing game-detail service."
                  : "The full-screen game page route is missing provider or game information."
              }
              state={state}
              footer={<span>{backFooter}</span>}
            />
          </div>
        </TopAlignedScrollViewport>
      </ScrollPanel>
    );
  }

  const snapshot = state.data;
  const game = snapshot.game;
  const heroArtworkUrl = game.boxArtImageUrl ?? game.coverImageUrl;
  const achievementSummary = formatAchievementStatusSummary(snapshot.achievements);
  const summary = snapshot.game.summary;
  const filteredAchievements = snapshot.achievements.filter((achievement) =>
    matchesAchievementFilter(achievement, achievementFilter),
  );
  const filteredAchievementCount = filteredAchievements.length;
  const effectiveAchievementLimit = isShowingAllAchievements
    ? filteredAchievementCount
    : visibleAchievementLimit;
  const completionPercent = getCompletionPercent(snapshot.game.summary);
  const canLoadMoreAchievements = !isShowingAllAchievements && effectiveAchievementLimit < filteredAchievementCount;
  const nextAchievementLimit = Math.min(
    filteredAchievementCount,
    effectiveAchievementLimit + FULL_SCREEN_ACHIEVEMENT_LOAD_STEP,
  );
  const canShowAllAchievements =
    !isShowingAllAchievements && canLoadMoreAchievements && filteredAchievementCount > nextAchievementLimit;
  const achievements = filteredAchievements.slice(0, effectiveAchievementLimit);
  const providerLabel = formatDeckyProviderLabel(providerId ?? game.providerId);
  const isCachedView = state.status === "stale";
  const snapshotSourceLabel = isCachedView ? "Cached snapshot" : "Live snapshot";
  const refreshTimestamp = state.lastUpdatedAt ?? snapshot.refreshedAt;
  const totalAchievementCount = summary.totalCount ?? snapshot.achievements.length;
  const heroMetaPills = dedupeDistinctLabels([game.platformLabel ?? "Unknown platform", providerLabel]);

  return (
    <ScrollPanel>
      <TopAlignedScrollViewport
        scrollKey={`full-screen-game:${providerId ?? game.providerId}:${game.gameId}`}
      >
        <div style={getFullScreenPageFrameStyle()}>
          <PanelSection title="Navigation">
            <DeckyFullscreenActionRow>
              <DeckyFullscreenActionButton
                label={backLabel}
                isFullscreenBackAction
                onClick={() => {
                  onBack();
                }}
              />
            </DeckyFullscreenActionRow>
          </PanelSection>

          <PanelSection title="Game spotlight">
            <PanelSectionRow>
              <div style={getGameSpotlightLayoutStyle()}>
                {heroArtworkUrl !== undefined ? (
                  <div style={getGameSpotlightHeroStyle()}>
                    <DeckyGameArtwork src={heroArtworkUrl} size={160} title={game.title} />
                  </div>
                ) : null}

                <div style={getGameSpotlightStatsStyle()}>
                  <div style={getGameSpotlightTitleBlockStyle()}>
                    <div style={getGameSpotlightKickerStyle()}>Selected game</div>
                    <div style={getGameSpotlightTitleStyle()}>{game.title}</div>
                    <div style={getGameSpotlightMetaRowStyle()}>
                      {heroMetaPills.map((label) => (
                        <span key={label} style={getGameSpotlightMetaPillStyle()}>
                          {label}
                        </span>
                      ))}
                    </div>
                    {game.lastUnlockAt !== undefined ? (
                      <div style={getGameSpotlightSupportStyle()}>
                        {`Last played ${formatTimestamp(game.lastUnlockAt)}`}
                      </div>
                    ) : null}
                  </div>

                  <div style={getProgressCardStyle()}>
                    <div style={getProgressCardTitleStyle()}>Progress summary</div>
                    {completionPercent !== undefined ? (
                      <DeckyCompletionProgressBar percent={completionPercent} />
                    ) : null}
                    <div style={getProgressStatGridStyle()}>
                      <ProgressStat label="Unlocked" value={formatCount(summary.unlockedCount)} />
                      <ProgressStat label="Total" value={formatCount(totalAchievementCount)} />
                      <ProgressStat
                        label="Completion"
                        value={completionPercent !== undefined ? `${formatCount(completionPercent)}%` : "-"}
                      />
                    </div>
                  </div>

                  {game.hardcoreSummary !== undefined || game.softcoreSummary !== undefined ? (
                    <div style={getProgressCardStyle()}>
                      <div style={getProgressCardTitleStyle()}>Mode progress</div>
                      <div style={getProgressStatGridStyle()}>
                        <ProgressStat
                          label="Hardcore progress"
                          value={formatModeProgressSummary(game.hardcoreSummary, "Hardcore")}
                        />
                        <ProgressStat
                          label="Softcore progress"
                          value={formatModeProgressSummary(game.softcoreSummary, "Softcore")}
                        />
                      </div>
                    </div>
                  ) : null}

                </div>
              </div>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Achievements">
              <AchievementBrowser
                achievementFilter={achievementFilter}
                achievementSummary={achievementSummary}
                achievements={achievements}
                canLoadMoreAchievements={canLoadMoreAchievements}
                canShowAllAchievements={canShowAllAchievements}
                filteredAchievementCount={filteredAchievementCount}
                onAchievementFilterChange={(filter) => {
                  setAchievementFilter(filter);
                }}
                onLoadMoreAchievements={() => {
                  setIsShowingAllAchievements(false);
                  setVisibleAchievementLimit((current) =>
                    Math.min(filteredAchievementCount, current + FULL_SCREEN_ACHIEVEMENT_LOAD_STEP),
                  );
                }}
                onOpenAchievementDetail={onOpenAchievementDetail}
                onShowAllAchievements={() => {
                  setIsShowingAllAchievements(true);
                  setVisibleAchievementLimit(filteredAchievementCount);
                }}
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
