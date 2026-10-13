import { useMemo, useState, type CSSProperties, type ComponentProps } from "react";
import type { ResourceState } from "@core/cache";
import type { CompletionProgressSnapshot, NormalizedGame } from "@core/domain";
import { Field, PanelSection, PanelSectionRow, ScrollPanel } from "@decky/ui";
import { PlaceholderState } from "@ui/PlaceholderState";
import { DeckyActionButtonItem } from "./decky-action-button-item";
import {
  DeckyCompletionProgressBar,
  getCompletionPercent,
  type DeckyCompletionProgressBarTone,
} from "./decky-completion-progress-bar";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DeckyRetroAchievementsGameIcon } from "./decky-retroachievements-game-icon";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import {
  DeckyFullScreenFooterOverlay,
  RETROACHIEVEMENTS_PROFILE_FOOTER_NAVIGATION_ITEMS,
  STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS,
} from "./decky-full-screen-footer-overlay";
import {
  DeckyFullScreenLoadingState,
  getDeckyFullScreenLoadingPageStyle,
} from "./decky-full-screen-loading-state";
import {
  DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS,
  DECKY_FOCUS_ACTION_ROW_CLASS,
} from "./decky-focus-styles";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import {
  getDeckyCompletionProgressStateForFullScreenEntryInitial,
  initialDeckyCompletionProgressState,
  loadDeckyCompletionProgressStateForFullScreenEntry,
} from "./decky-app-services";
import { TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { formatDeckyProviderLabel } from "./providers";
import { STEAM_PROVIDER_ID } from "./providers/steam";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";
import {
  countCompletionProgressSubsetGames,
  buildRetroAchievementsCompletionCollection,
  filterCompletionProgressGamesBySubsetVisibility,
  formatCompletionProgressSubsetSummary as formatCompletionProgressSubsetSummaryFromGrouping,
  groupCompletionProgressGames,
  summarizeCompletionProgressSummaryBySubsetVisibility,
  type CompletionProgressGameGroup,
  sortCompletionProgressGroups,
  type CompletionProgressSort,
} from "./decky-completion-progress-grouping";
import {
  buildCompletionProgressSummaryCards,
  CompletionProgressSummaryCardGrid,
  type CompletionProgressSelectionFilter,
} from "./decky-completion-progress-summary-cards";
import { formatCompletionProgressSelectionLabelForProvider } from "./decky-completion-progress-summary-card-data";
import {
  formatCompletionProgressStatusLabel,
  formatSteamPlaytimeMinutes,
  getSteamCompletionProgressGameDetailId,
} from "./decky-stat-helpers";
import {
  getRetroAchievementsCompletionIndicatorState,
  RetroAchievementsCompletionIndicator,
} from "./decky-retroachievements-completion-indicator";
import { DeckySteamFullScreenGamesDashboard } from "./decky-steam-full-screen-games-dashboard";
import { achievementCompanionQamTheme as sharedTheme } from "./decky-qam-theme";

const COMPLETION_PROGRESS_INITIAL_GAME_LIMIT = 12;
const COMPLETION_PROGRESS_GAME_LOAD_STEP = 12;
const COMPLETION_PROGRESS_SORT_OPTIONS: readonly { readonly value: CompletionProgressSort; readonly label: string }[] = [
  { value: "recent", label: "Most Recent" },
  { value: "title", label: "Title" },
  { value: "completion", label: "Completion %" },
];

export interface DeckyFullScreenCompletionProgressPageProps {
  readonly providerId: string | undefined;
  readonly isActive?: boolean;
  readonly showSteamProfileFooter?: boolean;
  readonly initialFilter?: CompletionProgressSelectionFilter;
  readonly onBack: () => void;
  readonly onOpenProfile: () => void;
  readonly onOpenActivity: () => void;
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

const FULLSCREEN_COMPLETION_PROGRESS_BOTTOM_SCROLL_PADDING = 88;
const FULLSCREEN_COMPLETION_PROGRESS_TOP_PADDING = 42;

function getPageFrameStyle(): CSSProperties {
  return {
    padding: `calc(env(safe-area-inset-top, 0px) + ${FULLSCREEN_COMPLETION_PROGRESS_TOP_PADDING}px) 12px calc(env(safe-area-inset-bottom, 0px) + ${FULLSCREEN_COMPLETION_PROGRESS_BOTTOM_SCROLL_PADDING}px)`,
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
    background: sharedTheme.surface.contentCard,
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
    background: sharedTheme.surface.contentCard,
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
    fontSize: "1.05em",
    fontWeight: 700,
    lineHeight: 1.25,
  };
}

function getBrowserMetaStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.86em",
    lineHeight: 1.25,
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
    gap: 6,
    minHeight: 24,
    padding: "0 9px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: sharedTheme.surface.contentStat,
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

type FullScreenGamepadFocusHandler = NonNullable<ComponentProps<typeof Field>["onGamepadFocus"]>;

const scrollFocusedGamepadElementIntoView: FullScreenGamepadFocusHandler = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
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

  if (filter === "completed") {
    return gameGroup.representativeGame.status === "beaten"
      || gameGroup.representativeGame.status === "completed"
      || gameGroup.representativeGame.status === "mastered";
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

  return `No ${formatCompletionProgressSelectionLabelForProvider(filter, providerId).toLowerCase()} games match this filter.`;
}

function formatCompletionProgressSubsetSummary(
  group: CompletionProgressGameGroup,
  showSubsets: boolean,
): string | undefined {
  return showSubsets ? formatCompletionProgressSubsetSummaryFromGrouping(group) : undefined;
}

function getSortLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.6)", fontSize: "0.72em", fontWeight: 800,
    letterSpacing: "0.1em", lineHeight: 1.2, textTransform: "uppercase",
  };
}

function getBrowserBreakdownStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.88em",
    lineHeight: 1.35,
  };
}

function getBrowserViewContextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    paddingTop: 12,
    borderTop: "1px solid rgba(255, 255, 255, 0.07)",
  };
}

function getSortControlStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
    boxSizing: "border-box",
    marginBottom: 10,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255, 255, 255, 0.075)",
    background: sharedTheme.surface.contentCard,
  };
}

function formatBrowserSelectionSummary(args: {
  readonly filter: CompletionProgressSelectionFilter;
  readonly summary: CompletionProgressSnapshot["summary"];
  readonly providerId: string;
}): string {
  if (args.filter === "subsets") {
    return "Subset games are tracked separately from your played-game total.";
  }

  if (args.filter === "all") {
    return "Viewing all played games.";
  }

  const label = formatCompletionProgressSelectionLabelForProvider(
    args.filter,
    args.providerId,
  );
  const count = args.filter === "unfinished"
    ? args.summary.unfinishedCount
    : args.filter === "beaten"
      ? args.summary.beatenCount
      : args.filter === "completed"
        ? args.summary.beatenCount + args.summary.masteredCount
      : args.summary.masteredCount;
  return `${label} games: ${formatCount(count)}.`;
}

function getCompletionProgressRowTone(
  game: Pick<NormalizedGame, "providerId" | "metrics">,
): DeckyCompletionProgressBarTone {
  const completionIndicatorState = getRetroAchievementsCompletionIndicatorState(game);

  if (
    completionIndicatorState === "mastered-hardcore" ||
    completionIndicatorState === "mastered-softcore"
  ) {
    return "retroachievements-mastered";
  }

  if (
    completionIndicatorState === "beaten-hardcore" ||
    completionIndicatorState === "beaten-softcore"
  ) {
    return "retroachievements-beaten";
  }

  return "default";
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
  const progressTone = getCompletionProgressRowTone(game);
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
        providerId === STEAM_PROVIDER_ID
          ? game.coverImageUrl !== undefined
            ? <DeckyGameArtwork compact src={game.coverImageUrl} size={40} title={game.title} />
            : undefined
          : <DeckyRetroAchievementsGameIcon game={game} src={game.coverImageUrl} size={40} />
      }
      bottomSeparator="none"
      padding="compact"
      verticalAlignment="center"
      label={game.title}
      description={
        <div style={getGameRowDescriptionStyle()}>
          <div style={getGameRowMetaRowStyle()}>
            <span style={getStatusPillStyle()}>{game.platformLabel ?? formatDeckyProviderLabel(providerId)}</span>
            <span style={getStatusPillStyle()}>
              <RetroAchievementsCompletionIndicator game={game} />
              {formatCompletionProgressStatusLabel(game.status, providerId)}
            </span>
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
            <DeckyCompletionProgressBar compact percent={completionPercent} tone={progressTone} />
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
  sort,
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
  readonly sort: CompletionProgressSort;
}): JSX.Element {
  return (
    <div style={getBrowserCardStyle()}>
      <div style={getBrowserTitleStyle()}>Browse</div>
      <div style={getBrowserSummaryStyle()}>{`${formatCount(summary.playedCount)} games played`}</div>
      <div style={getBrowserBreakdownStyle()}>
        {`${formatCount(summary.unfinishedCount)} unfinished · ${formatCount(summary.beatenCount)} beaten · ${formatCount(summary.masteredCount)} mastered`}
      </div>
      <div style={getBrowserViewContextStyle()}>
        <div style={getBrowserMetaStyle()}>
          {formatBrowserSelectionSummary({ filter: currentFilter, summary, providerId })}
        </div>
        <div style={getBrowserMetaStyle()}>
          {`Showing ${formatCount(visibleGroups.length)} of ${formatCount(filteredGroupCount)} games · ${COMPLETION_PROGRESS_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Most Recent"} first`}
        </div>
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
  isActive = true,
  showSteamProfileFooter = true,
  initialFilter,
  onBack,
  onOpenProfile,
  onOpenActivity,
  onOpenGameDetail,
}: DeckyFullScreenCompletionProgressPageProps): JSX.Element {
  const [currentFilter, setCurrentFilter] = useState<CompletionProgressSelectionFilter>(
    initialFilter ?? "all",
  );
  const [visibleGameLimit, setVisibleGameLimit] = useState(COMPLETION_PROGRESS_INITIAL_GAME_LIMIT);
  const [isShowingAllGames, setIsShowingAllGames] = useState(false);
  const [sort, setSort] = useState<CompletionProgressSort>("recent");
  const loadSelectedCompletionProgress = useMemo(() => {
    if (providerId === undefined) {
      return () => Promise.resolve(initialDeckyCompletionProgressState);
    }

    return () => loadDeckyCompletionProgressStateForFullScreenEntry(providerId);
  }, [providerId]);
  const initialState = getDeckyCompletionProgressStateForFullScreenEntryInitial(providerId);
  const state = useAsyncResourceState(loadSelectedCompletionProgress, initialState);
  const hasRouteParameters = providerId !== undefined;

  if (!isRenderableCompletionProgressState(state)) {
    if (providerId === STEAM_PROVIDER_ID || providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
      const isRa = providerId === RETROACHIEVEMENTS_PROVIDER_ID;
      return (
        <>
          <div style={getDeckyFullScreenLoadingPageStyle()}>
            <DeckyFullScreenLoadingState
              providerId={providerId}
              {...(!isRa ? { useSteamTheme: true } : {})}
              description={state.error?.userMessage ?? (isRa
                ? "Loading your RetroAchievements progress collection."
                : "Refreshing your Steam account and loading your library achievement scan.")}
              isError={state.status === "error"}
              title={state.status === "error"
                ? `${isRa ? "RetroAchievements" : "Steam"} games unavailable`
                : `Loading ${isRa ? "RetroAchievements" : "Steam"} games...`}
            />
          </div>
          {showSteamProfileFooter ? <DeckyFullScreenFooterOverlay
            isActive={isActive}
            activeNavigationItemId="games"
            ariaLabel={`${isRa ? "RetroAchievements" : "Steam"} profile navigation`}
            navigationItems={isRa ? RETROACHIEVEMENTS_PROFILE_FOOTER_NAVIGATION_ITEMS : STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS}
            onNextNavigationItem={onOpenActivity}
            onPreviousNavigationItem={onOpenProfile}
          /> : null}
        </>
      );
    }

    return (
      <ScrollPanel>
        <TopAlignedScrollViewport scrollKey={`full-screen-completion-progress:${providerId ?? "missing"}`}>
          <div style={getPageFrameStyle()}>
            <PlaceholderState
              title="Full-screen completion progress"
              providerId={providerId}
              loadingBrandCompact={false}
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
  if (snapshot.providerId === STEAM_PROVIDER_ID || snapshot.providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
    const dashboardSnapshot = snapshot.providerId === RETROACHIEVEMENTS_PROVIDER_ID
      ? {
          ...snapshot,
          // RA subsets are navigable from their confirmed parent game page;
          // they are not standalone Games-tab entries.
          summary: summarizeCompletionProgressSummaryBySubsetVisibility(
            snapshot.summary,
            snapshot.games,
            false,
          ),
          games: filterCompletionProgressGamesBySubsetVisibility(
            snapshot.games,
            false,
          ),
        }
      : snapshot;
    return (
      <DeckySteamFullScreenGamesDashboard
        snapshot={dashboardSnapshot}
        {...(snapshot.providerId === RETROACHIEVEMENTS_PROVIDER_ID ? { achievementProgressGames: snapshot.games } : {})}
        isActive={isActive}
        initialFilter={currentFilter}
        showSteamProfileFooter={showSteamProfileFooter}
        onBack={onBack}
        onOpenProfile={onOpenProfile}
        onOpenActivity={onOpenActivity}
        onOpenGameDetail={onOpenGameDetail}
      />
    );
  }

  const visibleGames = filterCompletionProgressGamesBySubsetVisibility(
    snapshot.games,
    true,
  );
  const groupedGames = groupCompletionProgressGames(
    visibleGames,
    true,
  );
  const filteredGroups = sortCompletionProgressGroups(groupedGames.filter((gameGroup) =>
    matchesCompletionProgressFilter(gameGroup, currentFilter, true),
  ), sort);
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
  const displaySummary = summarizeCompletionProgressSummaryBySubsetVisibility(
    snapshot.summary,
    snapshot.games,
    true,
  );
  const retroAchievementsCollection = snapshot.providerId === STEAM_PROVIDER_ID
    ? undefined
    : buildRetroAchievementsCompletionCollection(snapshot);
  const subsetCount = retroAchievementsCollection?.subsetCount ?? countCompletionProgressSubsetGames(snapshot.games);
  const summaryCards = buildCompletionProgressSummaryCards({
    summary: retroAchievementsCollection ?? displaySummary,
    subsetCount,
    providerId: snapshot.providerId,
    currentFilter,
    showSubsets: true,
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
            <PanelSectionRow>
              <div style={getSortControlStyle()}>
                <div style={getSortLabelStyle()}>Sort by</div>
                <DeckyFullscreenActionRow>
                  {COMPLETION_PROGRESS_SORT_OPTIONS.map((option) => (
                    <DeckyFullscreenActionButton
                      key={option.value}
                      label={option.label}
                      selected={sort === option.value}
                      onClick={() => { setSort(option.value); }}
                    />
                  ))}
                </DeckyFullscreenActionRow>
              </div>
            </PanelSectionRow>
            <CompletionProgressBrowser
              currentFilter={currentFilter}
              showSubsets={true}
              summary={retroAchievementsCollection ?? displaySummary}
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
              sort={sort}
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
