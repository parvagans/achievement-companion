import { useEffect, useMemo, useState, type CSSProperties, type ComponentProps } from "react";
import type { ResourceState } from "@core/cache";
import type { CompletionProgressSnapshot, NormalizedGame } from "@core/domain";
import { Field, PanelSection, PanelSectionRow, ScrollPanel } from "@decky/ui";
import { PlaceholderState } from "@ui/PlaceholderState";
import { DeckyActionButtonItem } from "./decky-action-button-item";
import { DeckyCompletionProgressBar, getCompletionPercent } from "./decky-completion-progress-bar";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import {
  DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS,
  DECKY_FOCUS_ACTION_ROW_CLASS,
} from "./decky-focus-styles";
import { initialDeckyCompletionProgressState, loadDeckyCompletionProgressState } from "./decky-app-services";
import { useDeckySettings } from "./decky-settings";
import { TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { formatDeckyProviderLabel } from "./providers";
import { STEAM_PROVIDER_ID } from "./providers/steam";
import {
  countCompletionProgressSubsetGames,
  filterCompletionProgressGamesBySubsetVisibility,
  formatCompletionProgressSubsetSummary as formatCompletionProgressSubsetSummaryFromGrouping,
  groupCompletionProgressGames,
  summarizeCompletionProgressSummaryBySubsetVisibility,
  type CompletionProgressGameGroup,
} from "./decky-completion-progress-grouping";
import {
  buildCompletionProgressSummaryCards,
  CompletionProgressSummaryCardGrid,
  type CompletionProgressSelectionFilter,
} from "./decky-completion-progress-summary-cards";
import {
  formatCompletionProgressFilterLabelForProvider,
  formatCompletionProgressStatusLabel,
  formatCompletionProgressSummary,
  formatSteamPlaytimeMinutes,
  getSteamCompletionProgressGameDetailId,
} from "./decky-stat-helpers";

const COMPLETION_PROGRESS_INITIAL_GAME_LIMIT = 12;
const COMPLETION_PROGRESS_GAME_LOAD_STEP = 12;

export interface DeckyFullScreenCompletionProgressPageProps {
  readonly providerId: string | undefined;
  readonly onBack: () => void;
  readonly onOpenGameDetail: (gameId: string) => void;
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

function getHeroTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
  };
}

function getHeroKickerStyle(): CSSProperties {
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
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.92em",
    lineHeight: 1.35,
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

function getFilterWrapStyle(): CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 4,
    width: "100%",
  };
}

function getFilterGroupStyle(): CSSProperties {
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

function getBrowserContinuationStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingTop: 2,
  };
}

function getStatusPillStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 24,
    padding: "0 9px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: "0.78em",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  };
}

function getGameRowMetaRowStyle(): CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  };
}

function getGameRowDescriptionStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  };
}

function getGameRowSummaryStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: "0.94em",
    lineHeight: 1.3,
    whiteSpace: "pre-wrap",
  };
}

function getGameRowSupportStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.84em",
    lineHeight: 1.25,
  };
}

function getGameRowTitleStyle(): CSSProperties {
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

function matchesCompletionProgressFilter(
  gameGroup: CompletionProgressGameGroup,
  filter: CompletionProgressSelectionFilter,
  showSubsets: boolean,
): boolean {
  if (filter === "subsets") {
    return showSubsets && gameGroup.isSubsetGame;
  }

  if (filter === "all") {
    return true;
  }

  if (filter === "unfinished") {
    return gameGroup.representativeGame.status === "in_progress";
  }

  if (filter === "beaten") {
    return gameGroup.representativeGame.status === "beaten";
  }

  return gameGroup.representativeGame.status === "mastered";
}

function formatCompletionProgressFilterEmptyMessage(
  filter: CompletionProgressSelectionFilter,
  providerId: string,
): string {
  if (filter === "all") {
    return "No completion progress entries were returned yet.";
  }

  if (filter === "subsets") {
    return "Enable Show subsets to browse subset games.";
  }

  return `No ${formatCompletionProgressFilterLabelForProvider(filter, providerId).toLowerCase()} games match this filter.`;
}

function formatProgressSummary(game: NormalizedGame): string {
  if (game.summary.totalCount !== undefined) {
    return `${formatCount(game.summary.unlockedCount)}/${formatCount(game.summary.totalCount)} achievements`;
  }

  return `${formatCount(game.summary.unlockedCount)} unlocked achievements`;
}


function formatCompletionProgressSubsetSummary(
  group: CompletionProgressGameGroup,
  showSubsets: boolean,
): string | undefined {
  return showSubsets ? formatCompletionProgressSubsetSummaryFromGrouping(group) : undefined;
}

function CompletionProgressGameRow({
  gameGroup,
  onOpenGameDetail,
  showSubsets,
  providerId,
}: {
  readonly gameGroup: CompletionProgressGameGroup;
  readonly onOpenGameDetail: (gameId: string) => void;
  readonly showSubsets: boolean;
  readonly providerId: string;
}): JSX.Element {
  const { representativeGame: game } = gameGroup;
  const completionPercent = getCompletionPercent(game.summary);
  const unlockedCount = formatCount(game.summary.unlockedCount);
  const totalCount = game.summary.totalCount !== undefined ? formatCount(game.summary.totalCount) : undefined;
  const subsetSummary = formatCompletionProgressSubsetSummary(gameGroup, showSubsets);
  const scanStatusLine =
    providerId === STEAM_PROVIDER_ID && game.scanStatus !== undefined && game.scanStatus !== "scanned"
      ? game.scanStatus === "no-achievements"
        ? "No achievements available"
        : "Scan failed for this game"
      : undefined;
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
    game.lastPlayedAt !== undefined ? `Last played ${formatTimestamp(game.lastPlayedAt)}` : undefined,
  ].filter((line): line is string => line !== undefined);

  return (
    <Field
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      focusable
      highlightOnFocus
      icon={
        game.coverImageUrl !== undefined ? (
          <DeckyGameArtwork compact src={game.coverImageUrl} size={40} title={game.title} />
        ) : undefined
      }
      bottomSeparator="none"
      padding="compact"
      verticalAlignment="center"
      label={game.title}
      description={
        <div style={getGameRowDescriptionStyle()}>
          <div style={getGameRowMetaRowStyle()}>
            <span style={getStatusPillStyle()}>{game.platformLabel ?? formatDeckyProviderLabel(providerId)}</span>
            <span style={getStatusPillStyle()}>{formatCompletionProgressStatusLabel(game.status, providerId)}</span>
          </div>

          <div style={getGameRowSummaryStyle()}>
            {totalCount !== undefined ? `${unlockedCount}/${totalCount} achievements` : `${unlockedCount} unlocked achievements`}
          </div>

          {scanStatusLine !== undefined ? <div style={getGameRowSupportStyle()}>{scanStatusLine}</div> : null}

          {playtimeLines.length > 0 ? <div style={getGameRowSupportStyle()}>{playtimeLines.join(" | ")}</div> : null}

          {subsetSummary !== undefined ? (
            <div style={getGameRowSupportStyle()}>{subsetSummary}</div>
          ) : null}

          {completionPercent !== undefined ? (
            <DeckyCompletionProgressBar compact percent={completionPercent} />
          ) : null}

          {game.lastUnlockAt !== undefined ? (
            <div style={getGameRowSupportStyle()}>{`Last unlock ${formatTimestamp(game.lastUnlockAt)}`}</div>
          ) : null}
        </div>
      }
      onActivate={() => {
        const gameDetailId = getSteamCompletionProgressGameDetailId(game);
        if (providerId === STEAM_PROVIDER_ID && game.appid !== undefined) {
          console.debug("[Achievement Companion][Steam]", {
            operation: "openCachedCompletionGame",
            appid: game.appid,
            title: game.title,
          });
        }
        onOpenGameDetail(gameDetailId);
      }}
      onClick={() => {
        onOpenGameDetail(getSteamCompletionProgressGameDetailId(game));
      }}
      onGamepadFocus={scrollFocusedGamepadElementIntoView}
    />
  );
}

function CompletionProgressBrowser({
  currentFilter,
  showSubsets,
  summary,
  visibleGroups,
  filteredGroupCount,
  onLoadMoreGames,
  onShowAllGames,
  canLoadMoreGames,
  canShowAllGames,
  onOpenGameDetail,
  providerId,
}: {
  readonly currentFilter: CompletionProgressSelectionFilter;
  readonly showSubsets: boolean;
  readonly summary: CompletionProgressSnapshot["summary"];
  readonly visibleGroups: readonly CompletionProgressGameGroup[];
  readonly filteredGroupCount: number;
  readonly onLoadMoreGames: () => void;
  readonly onShowAllGames: () => void;
  readonly canLoadMoreGames: boolean;
  readonly canShowAllGames: boolean;
  readonly onOpenGameDetail: (gameId: string) => void;
  readonly providerId: string;
}): JSX.Element {
  return (
    <div style={getBrowserCardStyle()}>
      <div style={getBrowserTitleStyle()}>Browse</div>
      <div style={getBrowserSummaryStyle()}>{formatCompletionProgressSummary(summary, providerId)}</div>
      <div style={getBrowserMetaStyle()}>
        {`Showing ${formatCount(visibleGroups.length)} of ${formatCount(filteredGroupCount)} grouped games in this filter.`}
      </div>

      {visibleGroups.length > 0 ? (
        <>
          {visibleGroups.map((gameGroup) => (
            <PanelSectionRow key={gameGroup.groupKey}>
              <CompletionProgressGameRow
                gameGroup={gameGroup}
                onOpenGameDetail={onOpenGameDetail}
                showSubsets={showSubsets}
                providerId={providerId}
              />
            </PanelSectionRow>
          ))}
        </>
      ) : (
        <PanelSectionRow>
          <Field
            bottomSeparator="none"
            description={formatCompletionProgressFilterEmptyMessage(currentFilter, providerId)}
            label="Games"
          />
        </PanelSectionRow>
      )}

      {canLoadMoreGames || canShowAllGames ? (
        <div style={getBrowserContinuationStyle()}>
          {canLoadMoreGames ? (
              <DeckyActionButtonItem
                className={DECKY_FOCUS_ACTION_ROW_CLASS}
                focusClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
                focusWithinClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
                highlightOnFocus
                description={`Show the next ${formatCount(COMPLETION_PROGRESS_GAME_LOAD_STEP)} games below and keep your place in the list.`}
                label={`Show ${formatCount(COMPLETION_PROGRESS_GAME_LOAD_STEP)} more`}
                onClick={onLoadMoreGames}
              />
          ) : null}

          {canShowAllGames ? (
              <DeckyActionButtonItem
                className={DECKY_FOCUS_ACTION_ROW_CLASS}
                focusClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
                focusWithinClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
                highlightOnFocus
                description="Reveal the rest of the filtered games."
                label="Show all"
                onClick={onShowAllGames}
              />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function isRenderableCompletionProgressState(
  state: ResourceState<CompletionProgressSnapshot>,
): state is ResourceState<CompletionProgressSnapshot> & { readonly data: CompletionProgressSnapshot } {
  return (state.status === "success" || state.status === "stale") && state.data !== undefined;
}

export function DeckyFullScreenCompletionProgressPage({
  providerId,
  onBack,
  onOpenGameDetail,
}: DeckyFullScreenCompletionProgressPageProps): JSX.Element {
  const deckySettings = useDeckySettings();
  const [currentFilter, setCurrentFilter] = useState<CompletionProgressSelectionFilter>(
    deckySettings.defaultCompletionProgressFilter,
  );
  const [visibleGameLimit, setVisibleGameLimit] = useState(COMPLETION_PROGRESS_INITIAL_GAME_LIMIT);
  const [isShowingAllGames, setIsShowingAllGames] = useState(false);
  const loadSelectedCompletionProgress = useMemo(() => {
    if (providerId === undefined) {
      return () => Promise.resolve(initialDeckyCompletionProgressState);
    }

    return () => loadDeckyCompletionProgressState(providerId);
  }, [providerId]);
  const state = useAsyncResourceState(loadSelectedCompletionProgress, initialDeckyCompletionProgressState);
  const hasRouteParameters = providerId !== undefined;

  useEffect(() => {
    if (!deckySettings.showCompletionProgressSubsets && currentFilter === "subsets") {
      setCurrentFilter("all");
    }
  }, [currentFilter, deckySettings.showCompletionProgressSubsets]);

  if (!isRenderableCompletionProgressState(state)) {
    return (
      <ScrollPanel>
        <TopAlignedScrollViewport scrollKey={`full-screen-completion-progress:${providerId ?? "missing"}`}>
          <div style={getPageFrameStyle()}>
            <PlaceholderState
              title="Full-screen completion progress"
              description={
                hasRouteParameters
                  ? "Loading the full-screen completion progress page from the existing completion-progress service."
                  : "The full-screen completion progress page route is missing provider information."
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
  const visibleGames = filterCompletionProgressGamesBySubsetVisibility(
    snapshot.games,
    deckySettings.showCompletionProgressSubsets,
  );
  const groupedGames = groupCompletionProgressGames(
    visibleGames,
    deckySettings.showCompletionProgressSubsets,
  );
  const filteredGroups = groupedGames.filter((gameGroup) =>
    matchesCompletionProgressFilter(gameGroup, currentFilter, deckySettings.showCompletionProgressSubsets),
  );
  const filteredGroupCount = filteredGroups.length;
  const effectiveGameLimit = isShowingAllGames ? filteredGroupCount : visibleGameLimit;
  const canLoadMoreGames = !isShowingAllGames && effectiveGameLimit < filteredGroupCount;
  const nextGameLimit = Math.min(
    filteredGroupCount,
    effectiveGameLimit + COMPLETION_PROGRESS_GAME_LOAD_STEP,
  );
  const canShowAllGames =
    !isShowingAllGames && canLoadMoreGames && filteredGroupCount > nextGameLimit;
  const visibleGroups = filteredGroups.slice(0, effectiveGameLimit);
  const refreshTimestamp = state.lastUpdatedAt ?? snapshot.refreshedAt;
  const isCachedView = state.status === "stale";
  const snapshotSourceLabel = isCachedView ? "Cached snapshot" : "Live snapshot";
  const isSteamProvider = snapshot.providerId === STEAM_PROVIDER_ID;
  const hasSteamLibraryScan = isSteamProvider && snapshot.games.some((game) => game.scanStatus !== undefined);
  const displaySummary = summarizeCompletionProgressSummaryBySubsetVisibility(
    snapshot.summary,
    snapshot.games,
    deckySettings.showCompletionProgressSubsets,
  );
  const subsetCount = countCompletionProgressSubsetGames(snapshot.games);
  const summaryCards = buildCompletionProgressSummaryCards({
    summary: displaySummary,
    subsetCount,
    providerId: snapshot.providerId,
    currentFilter,
    showSubsets: deckySettings.showCompletionProgressSubsets,
  });

  return (
    <ScrollPanel>
      <TopAlignedScrollViewport scrollKey={`full-screen-completion-progress:${providerId ?? snapshot.providerId}`}>
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

          <PanelSection title="Completion progress">
            <PanelSectionRow>
              <div style={getHeroCardStyle()}>
                <div style={getHeroTextStyle()}>
                  <div style={getHeroKickerStyle()}>{`${formatDeckyProviderLabel(snapshot.providerId)} collection`}</div>
                  <div style={getHeroTitleStyle()}>Completion progress</div>
                  <div style={getHeroSupportStyle()}>
                    {isSteamProvider
                      ? "Browse Steam games grouped by progress tier."
                      : "Browse your started games by completion status."}
                    {isSteamProvider
                      ? " Steam completion uses cached library scan data when available."
                      : ""}
                  </div>
                </div>

                <CompletionProgressSummaryCardGrid
                  cards={summaryCards}
                  providerId={snapshot.providerId}
                  onSelectFilter={(filter) => {
                    setCurrentFilter(filter);
                  }}
                />
              </div>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Games">
            <CompletionProgressBrowser
              currentFilter={currentFilter}
              showSubsets={deckySettings.showCompletionProgressSubsets}
              summary={displaySummary}
              visibleGroups={visibleGroups}
              filteredGroupCount={filteredGroupCount}
              onLoadMoreGames={() => {
                setIsShowingAllGames(false);
                setVisibleGameLimit((current) =>
                  Math.min(filteredGroupCount, current + COMPLETION_PROGRESS_GAME_LOAD_STEP),
                );
              }}
              onOpenGameDetail={onOpenGameDetail}
              providerId={snapshot.providerId}
              onShowAllGames={() => {
                setIsShowingAllGames(true);
                setVisibleGameLimit(filteredGroupCount);
              }}
              canLoadMoreGames={canLoadMoreGames}
              canShowAllGames={canShowAllGames}
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
