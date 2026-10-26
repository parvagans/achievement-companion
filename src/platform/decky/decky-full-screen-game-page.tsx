import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot, NormalizedAchievement, NormalizedGame, RelatedGameSummary } from "@core/domain";
import { Focusable, PanelSection, PanelSectionRow } from "@decky/ui";
import {
  initialDeckyGameDetailState,
  loadDeckyGameDetailState,
  loadDeckySteamHuntersEnrichedGameDetail,
  loadDeckyRetroAchievementsRelatedGames,
} from "./decky-app-services";
import { getCompletionPercent } from "./decky-completion-progress-bar";
import {
  DeckyFullScreenAchievementBrowser,
  getAchievementAvailabilityFilterOptions,
  getAchievementGroupFilterOptions,
  matchesAchievementFilter,
  matchesAchievementAvailabilityFilter,
  matchesAchievementGroupFilter,
  matchesAchievementModeFilter,
  matchesRetroAchievementsAchievementTypeFilter,
  type AchievementAvailabilityFilter,
  type AchievementFilter,
  type AchievementGroupFilter,
  type AchievementModeFilter,
  type RetroAchievementsAchievementTypeFilter,
} from "./decky-full-screen-achievement-browser";
import type { DeckyFullScreenGameMetadataPill } from "./decky-full-screen-game-metadata-pills";
import { DeckyRetroAchievementsGameOverview } from "./decky-retroachievements-game-overview";
import { DeckyRetroAchievementsSubsetsSection } from "./decky-retroachievements-subsets-section";
import {
  cacheDeckyRetroAchievementsSubsetDetailState,
  readDeckyRetroAchievementsSubsetDetailStates,
} from "./decky-retroachievements-subset-detail-cache";
import { DeckySteamGameOverview } from "./decky-steam-game-overview";
import { useDeckyGameOverviewPreferences } from "./decky-game-overview-preferences";
import { selectGameOverviewSuggestions, isGameOverviewGoalComplete } from "./decky-game-overview-recommendations";
import type { DeckyGameOverviewActions } from "./decky-full-screen-game-overview-content";
import { openDeckyAchievementDetailModal } from "./decky-achievement-detail-modal";
import { getFullScreenAchievementRenderLimit } from "./decky-full-screen-achievement-target";
import {
  matchesFullScreenAchievementSearch,
  sortFullScreenAchievements,
} from "./decky-full-screen-achievement-browser-model";
import type { AchievementBrowserDisplayMode, AchievementBrowserSort } from "./decky-achievement-browser-options";
import {
  buildFullScreenGameSections,
  DeckyFullScreenGameSectionNavigation,
  getAdjacentFullScreenGameSectionId,
  type DeckyFullScreenGameSection,
  type DeckyFullScreenGameSectionId,
} from "./decky-full-screen-game-section-navigation";
import { STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX } from "./decky-steam-game-footer-layout";
import { formatDeckyNumericText } from "./decky-number-format";
import { getSteamFullscreenGameArtworkUrl } from "./decky-steam-game-artwork";
import { isDeckySteamFullscreenEnrichmentPending } from "./decky-steam-fullscreen-enrichment";
import {
  DeckyFullScreenLoadingState,
  getDeckyFullScreenLoadingPageStyle,
} from "./decky-full-screen-loading-state";
import {
  DeckySteamHuntersCommunitySection,
  STEAM_HUNTERS_COMMUNITY_SECTION_FOCUS_TARGET,
} from "./decky-steam-hunters-game-sections";
import {
  buildDeckySteamAchievementGroupSections,
  DeckySteamAchievementGroupsSection,
  hasDeckySteamAchievementGroups,
} from "./decky-steam-achievement-groups-section";
import { buildDeckySteamHuntersGameViewModel } from "./decky-steam-hunters-view-model";
import { sortAchievementsForDisplay } from "./decky-game-detail-ordering";
import { findDeckyScrollableAncestor, TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { STEAM_PROVIDER_ID } from "./providers/steam";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";
import { getSteamHuntersGameEnrichment } from "../../providers/steamhunters";
import { requestDeckySteamGamepadFocusAfterMount, takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import {
  consumeFullScreenGameSectionRestoration,
  readFullScreenGameSectionPageState,
  requestFullScreenGameSectionRestoration,
  selectFullScreenGameAchievementRestorationTarget,
  updateFullScreenGameSectionPageState,
} from "./decky-full-screen-game-section-state";
import { useDeckySettings } from "./decky-settings";
import {
  hasDistinctRetroAchievementsModes,
  projectRetroAchievementsFullScreenAchievements,
} from "./decky-retroachievements-full-screen-achievement-data";
import {
  DeckyRetroAchievementsGameCommunitySection,
  hasDisplayableRetroAchievementsCommunityStats,
  RETROACHIEVEMENTS_COMMUNITY_SECTION_FOCUS_TARGET,
} from "./decky-retroachievements-game-community-section";

const MemoizedDeckyFullScreenAchievementBrowser = memo(DeckyFullScreenAchievementBrowser);
const MemoizedDeckySteamGameOverview = memo(DeckySteamGameOverview);
const MemoizedDeckySteamAchievementGroupsSection = memo(DeckySteamAchievementGroupsSection);
const MemoizedDeckySteamHuntersCommunitySection = memo(DeckySteamHuntersCommunitySection);

export interface DeckyFullScreenGamePageProps {
  readonly providerId: string | undefined;
  readonly gameId: string | undefined;
  readonly onOpenAchievementDetail: ((achievementId: string, gameId?: string) => void) | undefined;
  readonly onBack: () => void;
  readonly backFooter?: string;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatGameReleaseDate(value: string, granularity: NormalizedGame["releaseDateGranularity"]): string {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/u.exec(value.trim());
  if (match === null) {
    return value;
  }

  const year = match[1];
  const month = match[2];
  const day = match[3];
  if (year === undefined) {
    return value;
  }

  if (granularity === "year" || month === undefined) {
    return year;
  }

  const monthNumber = Number(month);
  if (granularity === "month" || day === undefined) {
    return new Date(Number(year), monthNumber - 1, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }

  if (granularity === "day") {
    return new Date(Number(year), monthNumber - 1, Number(day)).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  // With unknown precision, show the API's date portion without implying a locale-adjusted exact date.
  return `${year}-${month}-${day}`;
}

function getMetricValue(
  metrics: readonly { readonly key: string; readonly label: string; readonly value: string }[],
  key: string,
): string | undefined {
  return metrics.find((metric) => metric.key === key)?.value;
}

function buildGameMetadataPills(
  metrics: readonly { readonly key: string; readonly label: string; readonly value: string }[],
  includeTotalPlayers: boolean,
  includeReleased: boolean,
  includeRetroAchievementsGameReleaseDate = false,
  releaseDateGranularity?: NormalizedGame["releaseDateGranularity"],
): readonly DeckyFullScreenGameMetadataPill[] {
  const totalPlayers = getMetricValue(metrics, "total-players");
  const released = getMetricValue(metrics, "released");
  const points = getMetricValue(metrics, "points");
  const retroPoints = getMetricValue(metrics, "retro-points");

  return [
    ...(includeTotalPlayers && totalPlayers !== undefined
      ? [
          {
            key: "total-players",
            label: "Total players",
            value: formatDeckyNumericText(totalPlayers),
          },
        ]
      : []),
    ...((includeReleased || includeRetroAchievementsGameReleaseDate) && released !== undefined
      ? [
          {
            key: "game-release-date",
            label: includeRetroAchievementsGameReleaseDate ? "Game release date" : "Release date",
            value: formatGameReleaseDate(released, releaseDateGranularity),
          },
        ]
      : []),
    ...(points !== undefined
      ? [
          {
            key: "points",
            label: "Points",
            value: formatDeckyNumericText(points),
          },
        ]
      : []),
    ...(retroPoints !== undefined
      ? [
          {
            key: "retro-points",
            label: "RetroPoints",
            value: formatDeckyNumericText(retroPoints),
          },
        ]
      : []),
  ];
}

function formatAchievementStatusSummary(
  achievements: readonly NormalizedAchievement[],
): string {
  const unlockedCount = achievements.filter((achievement) => achievement.isUnlocked).length;
  const lockedCount = achievements.length - unlockedCount;

  return `Total ${formatCount(achievements.length)} · Unlocked ${formatCount(unlockedCount)} · Locked ${formatCount(lockedCount)}`;
}

const STEAM_OVERVIEW_FRAME_INSET = 12;
const FULLSCREEN_GAME_TOP_PADDING = 42;

interface FullScreenLoadingCopy {
  readonly title: string;
  readonly description: string;
  readonly infoText: string;
  readonly isError: boolean;
}

function getFullScreenLoadingCopy(
  state: ResourceState<GameDetailSnapshot>,
  hasRouteParameters: boolean,
  backFooter: string,
  isWaitingForRetroAchievementsSubsets: boolean,
): FullScreenLoadingCopy {
  if (!hasRouteParameters) {
    return {
      title: "Game details unavailable",
      description: "The full-screen game page route is missing provider or game information.",
      infoText: backFooter,
      isError: true,
    };
  }

  if (state.status === "error") {
    return {
      title: "Unable to load game details",
      description: state.error?.userMessage ?? "The game details could not be loaded.",
      infoText: backFooter,
      isError: true,
    };
  }

  if (isWaitingForRetroAchievementsSubsets) {
    return {
      title: "Loading game subsets...",
      description: "Preparing the full-screen game page with its verified RetroAchievements subsets.",
      infoText: "Resolving the available subsets before showing the game page.",
      isError: false,
    };
  }

  return {
    title: "Loading game details...",
    description: "Loading the full-screen game page from the existing game-detail service.",
    infoText: "Fetching the latest game details and community data.",
    isError: false,
  };
}

function DeckyFullScreenGameLoadingState({
  state,
  hasRouteParameters,
  backFooter,
  onBack,
  providerId,
  useNativeFocus,
  useSteamTheme,
  isWaitingForRetroAchievementsSubsets = false,
}: {
  readonly state: ResourceState<GameDetailSnapshot>;
  readonly hasRouteParameters: boolean;
  readonly backFooter: string;
  readonly onBack: () => void;
  readonly providerId: string | undefined;
  readonly useNativeFocus: boolean;
  readonly useSteamTheme: boolean;
  readonly isWaitingForRetroAchievementsSubsets?: boolean;
}): JSX.Element {
  const focusRef = useRef<HTMLDivElement>(null);
  const copy = getFullScreenLoadingCopy(
    state,
    hasRouteParameters,
    backFooter,
    isWaitingForRetroAchievementsSubsets,
  );

  useLayoutEffect(() => {
    if (useNativeFocus) {
      takeDeckySteamGamepadFocus(focusRef.current);
      return;
    }
    focusRef.current?.focus({ preventScroll: true });
  }, [useNativeFocus]);

  return (
    <Focusable
      ref={focusRef}
      aria-busy={!copy.isError}
      aria-label={copy.title}
      aria-live="polite"
      data-state={state.status}
      noFocusRing
      onActivate={() => {}}
      // A full-screen loader is also a modal wait state. Do not let B abandon
      // an active request; retain its usual Back behavior only for an error.
      onCancel={copy.isError ? onBack : () => {}}
      role={copy.isError ? "alert" : "status"}
      style={getDeckyFullScreenLoadingPageStyle()}
      tabIndex={0}
    >
      <DeckyFullScreenLoadingState
        description={copy.infoText}
        isError={copy.isError}
        title={copy.title}
        providerId={providerId}
        useSteamTheme={useSteamTheme}
      />
    </Focusable>
  );
}

function getSteamGameShellStyle(footerHeight: number): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
    boxSizing: "border-box",
    paddingBottom: footerHeight,
  };
}

function getSteamGameContentStyle(section: DeckyFullScreenGameSectionId): CSSProperties {
  return {
    ...(section === "overview" ? { display: "flex", flexDirection: "column" } : {}),
    flex: "1 1 auto",
    minHeight: 0,
    // Overview is a single dashboard, not a focus-driven scroll surface.
    overflow: section === "overview" ? "clip" : "hidden auto",
  };
}

function getSteamGameContentFrameStyle(section: DeckyFullScreenGameSectionId): CSSProperties {
  if (section === "overview") {
    return {
      display: "flex",
      flexDirection: "column",
      flex: "1 1 auto",
      minHeight: 0,
      padding: `calc(env(safe-area-inset-top, 0px) + ${FULLSCREEN_GAME_TOP_PADDING + STEAM_OVERVIEW_FRAME_INSET}px) 12px ${STEAM_OVERVIEW_FRAME_INSET}px`,
      boxSizing: "border-box",
    };
  }

  return {
    padding: `calc(env(safe-area-inset-top, 0px) + ${FULLSCREEN_GAME_TOP_PADDING}px) 12px 0`,
    boxSizing: "border-box",
  };
}

function getSteamOverviewSectionStyle(): CSSProperties {
  return {
    flex: "1 1 auto",
    minHeight: 0,
  };
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
  backFooter = "Use Back to return to the compact side panel.",
}: DeckyFullScreenGamePageProps): JSX.Element {
  const settings = useDeckySettings();
  const overviewPreferences = useDeckyGameOverviewPreferences(providerId ?? "", gameId ?? "");
  const [focusedSuggestionId, setFocusedSuggestionId] = useState<string | null>(null);
  const pendingAchievementJumpRef = useRef<string>();
  const [temporaryAchievementTargetId, setTemporaryAchievementTargetId] = useState<string | undefined>();
  const dismissedSuggestionIndexRef = useRef<number>();
  const sectionAnchorRef = useRef<HTMLDivElement>(null);
  const focusedRouteKeyRef = useRef<string | undefined>(undefined);
  const restoredSectionNonceRef = useRef(0);
  const [steamFooterHeight, setSteamFooterHeight] = useState(STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX);
  const initialSectionStateRef = useRef(providerId !== undefined && gameId !== undefined
    ? readFullScreenGameSectionPageState(providerId, gameId)
    : undefined);
  const initialSectionState = initialSectionStateRef.current;
  const [relatedGamesState, setRelatedGamesState] = useState<ResourceState<readonly RelatedGameSummary[]>>({
    status: "idle",
    isStale: false,
    isRefreshing: false,
  });
  const [expandedRetroAchievementsSubsetIds, setExpandedRetroAchievementsSubsetIds] = useState<readonly string[]>(
    initialSectionState?.subsets.expandedSubsetIds ?? [],
  );
  const [retroAchievementsSubsetDetailStates, setRetroAchievementsSubsetDetailStates] = useState<
    Readonly<Record<string, ResourceState<GameDetailSnapshot>>>
  >(() => readDeckyRetroAchievementsSubsetDetailStates(providerId, gameId));
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>(initialSectionState?.achievements.achievementFilter ?? "all");
  const [achievementModeFilter, setAchievementModeFilter] = useState<AchievementModeFilter>(initialSectionState?.achievements.achievementModeFilter ?? "all");
  const [achievementGroupFilter, setAchievementGroupFilter] = useState<AchievementGroupFilter>(initialSectionState?.achievements.achievementGroupFilter ?? "all");
  const [achievementAvailabilityFilter, setAchievementAvailabilityFilter] = useState<AchievementAvailabilityFilter>(initialSectionState?.achievements.achievementAvailabilityFilter ?? "all");
  const [achievementTypeFilter, setAchievementTypeFilter] = useState<RetroAchievementsAchievementTypeFilter>(initialSectionState?.achievements.achievementTypeFilter ?? "all");
  const [achievementMissableOnly, setAchievementMissableOnly] = useState<boolean>(initialSectionState?.achievements.achievementMissableOnly ?? false);
  const [achievementQuery, setAchievementQuery] = useState(initialSectionState?.achievements.query ?? "");
  const [achievementSort, setAchievementSort] = useState<AchievementBrowserSort>(initialSectionState?.achievements.sort ?? "default");
  const [achievementDisplayMode, setAchievementDisplayMode] = useState<AchievementBrowserDisplayMode>(initialSectionState?.achievements.displayMode ?? "detailed");
  const [expandedSteamAchievementGroupIds, setExpandedSteamAchievementGroupIds] = useState<readonly string[]>(
    initialSectionState?.["achievement-groups"].expandedGroupIds ?? [],
  );
  const [activeSteamSection, setActiveSteamSection] = useState<DeckyFullScreenGameSectionId>(initialSectionState?.activeSection ?? "overview");
  const activeSteamSectionRef = useRef(activeSteamSection);
  const [sectionRestoreNonce, setSectionRestoreNonce] = useState(0);
  const [steamHuntersEnrichmentResult, setSteamHuntersEnrichmentResult] = useState<{
    readonly sourceSnapshot: GameDetailSnapshot;
    readonly enrichedSnapshot: GameDetailSnapshot;
  } | undefined>(undefined);
  const loadSelectedGameDetail = useMemo(() => {
    if (providerId === undefined || gameId === undefined) {
      return () => Promise.resolve(initialDeckyGameDetailState);
    }

    return () => loadDeckyGameDetailState(providerId, gameId, {
      forceRefresh: initialSectionState?.restoreRequested !== true,
    });
  }, [gameId, initialSectionState?.restoreRequested, providerId]);
  const state = useAsyncResourceState(loadSelectedGameDetail, initialDeckyGameDetailState);
  const hasRouteParameters = providerId !== undefined && gameId !== undefined;
  const loadedSnapshot = isRenderableGameDetailState(state) ? state.data : undefined;
  const isWaitingForSteamHuntersEnrichment = isDeckySteamFullscreenEnrichmentPending(
    loadedSnapshot,
    steamHuntersEnrichmentResult?.sourceSnapshot,
  );
  const isWaitingForRetroAchievementsSubsets = loadedSnapshot?.game.providerId === RETROACHIEVEMENTS_PROVIDER_ID
    && activeSteamSection === "subsets"
    && (relatedGamesState.status === "idle" || relatedGamesState.status === "loading");
  const displayedLoadedSnapshot =
    steamHuntersEnrichmentResult !== undefined && steamHuntersEnrichmentResult.sourceSnapshot === loadedSnapshot
      ? steamHuntersEnrichmentResult.enrichedSnapshot
      : loadedSnapshot;
  const loadedIsSteamProvider = displayedLoadedSnapshot?.game.providerId === STEAM_PROVIDER_ID;
  const loadedSteamHunters = displayedLoadedSnapshot !== undefined && displayedLoadedSnapshot.game.providerId === STEAM_PROVIDER_ID
    ? getSteamHuntersGameEnrichment(displayedLoadedSnapshot)
    : undefined;
  const loadedSteamHuntersViewModel = buildDeckySteamHuntersGameViewModel({
    achievements: displayedLoadedSnapshot?.achievements ?? [],
    enrichment: loadedSteamHunters,
    totalAchievementCount: displayedLoadedSnapshot?.game.summary.totalCount,
  });
  const loadedSteamAchievementGroupSections = useMemo(
    () => buildDeckySteamAchievementGroupSections({
      achievements: displayedLoadedSnapshot?.achievements ?? [],
      groups: loadedSteamHunters?.achievementGroups ?? [],
    }),
    [displayedLoadedSnapshot?.achievements, loadedSteamHunters?.achievementGroups],
  );
  const hasLoadedSteamAchievementGroups = hasDeckySteamAchievementGroups(loadedSteamAchievementGroupSections);
  const visibleGameSections = useMemo<readonly DeckyFullScreenGameSection[]>(() => buildFullScreenGameSections({
    provider: loadedIsSteamProvider ? "steam" : "retroachievements",
    hasAchievementGroups: hasLoadedSteamAchievementGroups,
    hasSubsets: (relatedGamesState.status === "success" || relatedGamesState.status === "stale")
      && relatedGamesState.data !== undefined
      && relatedGamesState.data.length > 0,
    hasCommunity: loadedIsSteamProvider
      ? loadedSteamHuntersViewModel?.hasCommunityStats === true
      : hasDisplayableRetroAchievementsCommunityStats(displayedLoadedSnapshot?.game.communityStats),
  }), [displayedLoadedSnapshot?.game.communityStats, hasLoadedSteamAchievementGroups, loadedIsSteamProvider, loadedSteamHuntersViewModel?.hasCommunityStats, relatedGamesState.data, relatedGamesState.status]);

  const persistSteamSectionState = useCallback((
    update: Parameters<typeof updateFullScreenGameSectionPageState>[2],
  ): void => {
    if (providerId !== undefined && gameId !== undefined) {
      updateFullScreenGameSectionPageState(providerId, gameId, update);
    }
  }, [gameId, providerId]);

  const saveCurrentSectionScroll = useCallback((
    section: DeckyFullScreenGameSectionId = activeSteamSectionRef.current,
  ): void => {
    if (section === "overview" && providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
      return;
    }
    const anchor = sectionAnchorRef.current;
    if (anchor === null) {
      return;
    }
    const scrollTop = findDeckyScrollableAncestor(anchor)?.scrollTop ?? 0;
    persistSteamSectionState((current) => ({
      ...current,
      [section]: {
        ...current[section],
        scrollTop,
      },
    }));
  }, [persistSteamSectionState, providerId]);

  const selectSteamSection = (nextSection: DeckyFullScreenGameSectionId): void => {
    const currentSection = activeSteamSectionRef.current;
    if (nextSection === currentSection) {
      return;
    }
    if (activeSteamSection === currentSection) {
      saveCurrentSectionScroll(currentSection);
    }
    persistSteamSectionState((current) => ({ ...current, activeSection: nextSection }));
    activeSteamSectionRef.current = nextSection;
    if (nextSection !== "achievements") setTemporaryAchievementTargetId(undefined);
    setFocusedSuggestionId(null);
    setActiveSteamSection(nextSection);
    setSectionRestoreNonce((current) => current + 1);
  };

  const selectAdjacentSteamSection = (direction: "previous" | "next"): void => {
    selectSteamSection(getAdjacentFullScreenGameSectionId(
      visibleGameSections,
      activeSteamSectionRef.current,
      direction,
    ));
  };
  const jumpSteamAchievementsToTop = useCallback((): void => {
    if (activeSteamSectionRef.current !== "achievements") {
      return;
    }

    const anchor = sectionAnchorRef.current;
    const activeSectionRoot = anchor?.querySelector<HTMLElement>("[data-steam-game-section='achievements']");
    const target = activeSectionRoot?.querySelector<HTMLElement>("[data-achievement-companion-steam-filter-control='true']");
    if (target === undefined || target === null) {
      return;
    }

    findDeckyScrollableAncestor(target)?.scrollTo({ top: 0, behavior: "auto" });
    takeDeckySteamGamepadFocus(target);
  }, []);

  useEffect(() => {
    if (loadedSnapshot === undefined || isWaitingForSteamHuntersEnrichment) {
      return;
    }
    if (
      loadedSnapshot.game.providerId === RETROACHIEVEMENTS_PROVIDER_ID
      && (relatedGamesState.status === "idle" || relatedGamesState.status === "loading")
    ) {
      return;
    }
    if (!visibleGameSections.some((section) => section.id === activeSteamSection)) {
      selectSteamSection("overview");
    }
  }, [activeSteamSection, isWaitingForSteamHuntersEnrichment, loadedSnapshot, relatedGamesState.status, visibleGameSections]);
  useLayoutEffect(() => {
    activeSteamSectionRef.current = activeSteamSection;
  }, [activeSteamSection]);
  useEffect(() => {
    if (loadedSnapshot === undefined || loadedSnapshot.game.providerId !== STEAM_PROVIDER_ID) {
      return;
    }
    const enrichment = getSteamHuntersGameEnrichment(loadedSnapshot);
    const steamCount = loadedSnapshot.game.summary.totalCount ?? loadedSnapshot.achievements.length;
    if (enrichment !== undefined && (
      enrichment.app.achievementCount === undefined ||
      enrichment.app.achievementCount === steamCount
    )) return;

    let cancelled = false;
    void loadDeckySteamHuntersEnrichedGameDetail(loadedSnapshot)
      .then((enrichedSnapshot) => {
        if (!cancelled) {
          setSteamHuntersEnrichmentResult({ sourceSnapshot: loadedSnapshot, enrichedSnapshot });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSteamHuntersEnrichmentResult({ sourceSnapshot: loadedSnapshot, enrichedSnapshot: loadedSnapshot });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadedSnapshot]);

  useEffect(() => {
    if (displayedLoadedSnapshot?.game.providerId !== RETROACHIEVEMENTS_PROVIDER_ID) {
      setRelatedGamesState({ status: "idle", isStale: false, isRefreshing: false });
      return;
    }

    let cancelled = false;
    setRelatedGamesState({ status: "loading", isStale: false, isRefreshing: true });
    void loadDeckyRetroAchievementsRelatedGames(displayedLoadedSnapshot.game)
      .then((nextState) => {
        if (!cancelled) setRelatedGamesState(nextState);
      })
      .catch(() => {
        if (!cancelled) setRelatedGamesState({ status: "error", isStale: false, isRefreshing: false });
      });
    return () => {
      cancelled = true;
    };
  }, [displayedLoadedSnapshot]);

  useEffect(() => {
    setExpandedRetroAchievementsSubsetIds(
      providerId !== undefined && gameId !== undefined
        ? readFullScreenGameSectionPageState(providerId, gameId).subsets.expandedSubsetIds
        : [],
    );
    setRetroAchievementsSubsetDetailStates(readDeckyRetroAchievementsSubsetDetailStates(providerId, gameId));
  }, [gameId, providerId]);

  useEffect(() => {
    if (providerId === undefined || gameId === undefined || displayedLoadedSnapshot === undefined) {
      return;
    }
    const anchor = sectionAnchorRef.current;
    const scrollContainer = anchor === null ? null : findDeckyScrollableAncestor(anchor);
    if (scrollContainer === null) {
      return;
    }
    const onScroll = (): void => {
      if (activeSteamSection === "overview" && providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
        return;
      }
      if (readFullScreenGameSectionPageState(providerId, gameId).restoreRequested) {
        return;
      }
      persistSteamSectionState((current) => ({
        ...current,
        [activeSteamSection]: { ...current[activeSteamSection], scrollTop: scrollContainer.scrollTop },
      }));
    };
    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener("scroll", onScroll);
    };
  }, [activeSteamSection, displayedLoadedSnapshot?.game.providerId, gameId, providerId]);

  const restorationSnapshot = isRenderableGameDetailState(state)
    ? (steamHuntersEnrichmentResult?.sourceSnapshot === state.data ? steamHuntersEnrichmentResult.enrichedSnapshot : state.data)
    : undefined;
  const restorationIsSteamProvider = restorationSnapshot?.game.providerId === STEAM_PROVIDER_ID;
  const restorationSteamHuntersEnrichment = restorationSnapshot === undefined
    ? undefined
    : getSteamHuntersGameEnrichment(restorationSnapshot);
  const restorationProjectedAchievements = useMemo(
    () => projectRetroAchievementsFullScreenAchievements(
      restorationSnapshot,
      settings.retroAchievementsAchievementMode,
    ),
    [restorationSnapshot, settings.retroAchievementsAchievementMode],
  );
  const restorationOrderedAchievements = useMemo(
    () => sortAchievementsForDisplay(restorationProjectedAchievements),
    [restorationProjectedAchievements],
  );
  const overviewSnapshot = useMemo(() => restorationSnapshot === undefined ? undefined : {
    ...restorationSnapshot, achievements: restorationProjectedAchievements,
  }, [restorationSnapshot, restorationProjectedAchievements]);
  const overviewSuggestions = useMemo(() => overviewSnapshot === undefined ? [] : selectGameOverviewSuggestions({
    snapshot: overviewSnapshot,
    hiddenAchievementIds: overviewPreferences.hiddenAchievementIds,
    goal: overviewPreferences.retroAchievementsGoal,
    achievementMode: settings.retroAchievementsAchievementMode,
    ...(restorationSteamHuntersEnrichment !== undefined ? { steamHunters: {
      app: restorationSteamHuntersEnrichment.app,
      achievements: Object.values(restorationSteamHuntersEnrichment.achievementsBySteamAchievementId),
      groups: restorationSteamHuntersEnrichment.achievementGroups,
    } } : {}),
  }), [overviewSnapshot, overviewPreferences.hiddenAchievementIds, overviewPreferences.retroAchievementsGoal, settings.retroAchievementsAchievementMode, restorationSteamHuntersEnrichment]);
  useLayoutEffect(() => {
    const index = dismissedSuggestionIndexRef.current;
    if (index === undefined || activeSteamSection !== "overview") return;
    dismissedSuggestionIndexRef.current = undefined;
    const root = sectionAnchorRef.current;
    const rows = Array.from(root?.querySelectorAll<HTMLElement>("[data-ac-up-next-id]") ?? []);
    const target = rows[Math.min(index, rows.length - 1)]
      ?? root?.querySelector<HTMLElement>("[aria-label='Manage Suggestions']");
    return requestDeckySteamGamepadFocusAfterMount(target);
  }, [overviewSuggestions, activeSteamSection]);
  const restorationGroupFilterOptions = getAchievementGroupFilterOptions(
    restorationOrderedAchievements,
    restorationSteamHuntersEnrichment?.achievementGroupsBySteamAchievementId,
    restorationSteamHuntersEnrichment?.achievementGroups,
  );
  const restorationAvailabilityFilterOptions = getAchievementAvailabilityFilterOptions(
    restorationOrderedAchievements,
    restorationSteamHuntersEnrichment?.achievementsBySteamAchievementId,
  );
  const restorationGroupFilter = restorationGroupFilterOptions.includes(achievementGroupFilter)
    ? achievementGroupFilter
    : "all";
  const restorationAvailabilityFilter = restorationAvailabilityFilterOptions.includes(achievementAvailabilityFilter)
    ? achievementAvailabilityFilter
    : "all";
  const restorationHasMissableAchievements = restorationOrderedAchievements.some((achievement) => achievement.classification === "missable");
  const restorationMissableOnly = restorationHasMissableAchievements && achievementMissableOnly;
  const restorationShowModeFilter = restorationSnapshot?.game.providerId === RETROACHIEVEMENTS_PROVIDER_ID
    && settings.retroAchievementsAchievementMode === "both"
    && hasDistinctRetroAchievementsModes(restorationSnapshot.achievements);
  const restorationFilteredAchievements = useMemo(
    () => restorationSnapshot === undefined
      ? []
      : restorationOrderedAchievements.filter((achievement) =>
      matchesAchievementFilter(achievement, achievementFilter) &&
      (restorationIsSteamProvider
        ? matchesAchievementGroupFilter(
            achievement,
            restorationGroupFilter,
            restorationSteamHuntersEnrichment?.achievementGroupsBySteamAchievementId,
          ) &&
          matchesAchievementAvailabilityFilter(
            achievement,
            restorationAvailabilityFilter,
            restorationSteamHuntersEnrichment?.achievementsBySteamAchievementId,
          )
        : restorationSnapshot?.game.providerId === RETROACHIEVEMENTS_PROVIDER_ID
          ? matchesRetroAchievementsAchievementTypeFilter(achievement, achievementTypeFilter, restorationMissableOnly)
          : true) &&
      (restorationShowModeFilter ? matchesAchievementModeFilter(achievement, achievementModeFilter) : true),
      ),
    [
      achievementAvailabilityFilter,
      achievementFilter,
      achievementGroupFilter,
      achievementMissableOnly,
      achievementModeFilter,
      achievementTypeFilter,
      restorationAvailabilityFilter,
      restorationGroupFilter,
      restorationMissableOnly,
      restorationIsSteamProvider,
      restorationOrderedAchievements,
      restorationShowModeFilter,
      restorationSnapshot,
      restorationSteamHuntersEnrichment?.achievementGroupsBySteamAchievementId,
      restorationSteamHuntersEnrichment?.achievementsBySteamAchievementId,
    ],
  );
  const restorationVisibleAchievements = useMemo(() => {
    const matching = restorationFilteredAchievements.filter((achievement) =>
      matchesFullScreenAchievementSearch(achievement, achievementQuery),
    );
    const withTemporaryTarget = temporaryAchievementTargetId === undefined
      || matching.some((achievement) => achievement.achievementId === temporaryAchievementTargetId)
      ? matching
      : [
          ...matching,
          ...restorationOrderedAchievements.filter((achievement) => achievement.achievementId === temporaryAchievementTargetId),
        ];
    return sortFullScreenAchievements(
      withTemporaryTarget,
      achievementSort,
      restorationSnapshot?.game.metrics ?? [],
      achievementModeFilter,
      restorationSteamHuntersEnrichment?.achievementsBySteamAchievementId,
    );
  }, [
    achievementModeFilter,
    achievementQuery,
    achievementSort,
    restorationFilteredAchievements,
    restorationOrderedAchievements,
    restorationSnapshot?.game.metrics,
    restorationSteamHuntersEnrichment?.achievementsBySteamAchievementId,
    temporaryAchievementTargetId,
  ]);
  useEffect(() => {
    if (!restorationShowModeFilter && achievementModeFilter !== "all") {
      setAchievementModeFilter("all");
    }
  }, [achievementModeFilter, restorationShowModeFilter]);
  const restorationSteamHuntersViewModel = useMemo(
    () => restorationIsSteamProvider
      ? buildDeckySteamHuntersGameViewModel({
          achievements: restorationOrderedAchievements,
          enrichment: restorationSteamHuntersEnrichment,
          totalAchievementCount: restorationSnapshot?.game.summary.totalCount,
        })
      : undefined,
    [restorationIsSteamProvider, restorationOrderedAchievements, restorationSteamHuntersEnrichment, restorationSnapshot?.game.summary.totalCount],
  );
  const restorationSteamAchievementGroupSections = useMemo(
    () => buildDeckySteamAchievementGroupSections({
      achievements: restorationOrderedAchievements,
      groups: restorationSteamHuntersEnrichment?.achievementGroups ?? [],
    }),
    [restorationOrderedAchievements, restorationSteamHuntersEnrichment?.achievementGroups],
  );
  const handleAchievementFilterChange = useCallback((filter: AchievementFilter): void => {
    setTemporaryAchievementTargetId(undefined);
    setAchievementFilter(filter);
  }, []);
  const handleAchievementModeFilterChange = useCallback((filter: AchievementModeFilter): void => {
    setTemporaryAchievementTargetId(undefined);
    setAchievementModeFilter(filter);
  }, []);
  const handleAchievementGroupFilterChange = useCallback((filter: AchievementGroupFilter): void => {
    setTemporaryAchievementTargetId(undefined);
    setAchievementGroupFilter(filter);
  }, []);
  const handleAchievementAvailabilityFilterChange = useCallback((filter: AchievementAvailabilityFilter): void => {
    setTemporaryAchievementTargetId(undefined);
    setAchievementAvailabilityFilter(filter);
  }, []);
  const handleAchievementTypeFilterChange = useCallback((filter: RetroAchievementsAchievementTypeFilter): void => {
    setTemporaryAchievementTargetId(undefined);
    setAchievementTypeFilter(filter);
    setAchievementMissableOnly(false);
  }, []);
  const handleAchievementMissableOnlyChange = useCallback((checked: boolean): void => {
    setTemporaryAchievementTargetId(undefined);
    setAchievementMissableOnly(checked);
    if (checked) setAchievementTypeFilter("all");
  }, []);
  const handleAchievementQueryChange = useCallback((query: string): void => {
    setTemporaryAchievementTargetId(undefined);
    setAchievementQuery(query);
  }, []);
  const handleAchievementSortChange = useCallback((sort: AchievementBrowserSort): void => {
    setTemporaryAchievementTargetId(undefined);
    setAchievementSort(sort);
  }, []);
  const handleAchievementDisplayModeChange = useCallback((displayMode: AchievementBrowserDisplayMode): void => {
    setAchievementDisplayMode(displayMode);
  }, []);
  const handleFocusAchievement = useCallback((achievementId: string): void => {
    persistSteamSectionState((current) => ({
      ...current,
      achievements: { ...current.achievements, focusedId: achievementId },
    }));
  }, [persistSteamSectionState]);
  const handleOpenAchievementDetail = useCallback((achievementId: string, achievementGameId?: string): void => {
    if (providerId !== undefined && gameId !== undefined) {
      saveCurrentSectionScroll();
      requestFullScreenGameSectionRestoration(providerId, gameId);
    }
    onOpenAchievementDetail?.(achievementId, achievementGameId);
  }, [gameId, onOpenAchievementDetail, providerId, saveCurrentSectionScroll]);
  const jumpToOverviewAchievement = (achievementId: string): void => {
    if (!restorationOrderedAchievements.some((achievement) => achievement.achievementId === achievementId)) return;
    setTemporaryAchievementTargetId(achievementId);
    pendingAchievementJumpRef.current = achievementId;
    persistSteamSectionState((current) => ({
      ...current,
      achievements: { ...current.achievements, focusedId: achievementId, scrollTop: 0 },
    }));
    selectSteamSection("achievements");
  };
  const focusOverviewSuggestion = useCallback((achievementId: string | null): void => {
    setFocusedSuggestionId(achievementId);
    if (achievementId !== null) persistSteamSectionState((current) => ({
      ...current, overview: { ...current.overview, focusedId: achievementId },
    }));
  }, [persistSteamSectionState]);
  const handleFocusAchievementGroup = useCallback((groupId: string): void => {
    persistSteamSectionState((current) => ({
      ...current,
      "achievement-groups": {
        ...current["achievement-groups"],
        focusedGroupId: groupId,
        focusedAchievementId: undefined,
      },
    }));
  }, [persistSteamSectionState]);
  const handleFocusGroupedAchievement = useCallback((groupId: string, achievementId: string): void => {
    persistSteamSectionState((current) => ({
      ...current,
      "achievement-groups": {
        ...current["achievement-groups"],
        focusedGroupId: groupId,
        focusedAchievementId: achievementId,
      },
    }));
  }, [persistSteamSectionState]);
  const handleFocusSubset = useCallback((subsetId: string): void => {
    persistSteamSectionState((current) => ({
      ...current,
      subsets: { ...current.subsets, focusedSubsetId: subsetId },
    }));
  }, [persistSteamSectionState]);
  const handleFocusSubsetAchievement = useCallback((subsetId: string, achievementId: string): void => {
    persistSteamSectionState((current) => ({
      ...current,
      subsets: {
        ...current.subsets,
        focusedSubsetId: subsetId,
        focusedAchievementId: achievementId,
      },
    }));
  }, [persistSteamSectionState]);
  const handleExpandedSubsetIdsChange = useCallback((subsetIds: readonly string[]): void => {
    setExpandedRetroAchievementsSubsetIds(subsetIds);
    persistSteamSectionState((current) => ({
      ...current,
      subsets: { ...current.subsets, expandedSubsetIds: subsetIds },
    }));
  }, [persistSteamSectionState]);
  const handleLoadSubsetAchievements = useCallback((subsetId: string): void => {
    const existing = retroAchievementsSubsetDetailStates[subsetId]
      ?? readDeckyRetroAchievementsSubsetDetailStates(providerId, gameId)[subsetId];
    if (existing !== undefined && (existing.status === "loading" || existing.status === "success" || existing.status === "stale")) {
      return;
    }
    setRetroAchievementsSubsetDetailStates((current) => ({
      ...current,
      [subsetId]: { status: "loading", isStale: false, isRefreshing: true },
    }));
    void loadDeckyGameDetailState(RETROACHIEVEMENTS_PROVIDER_ID, subsetId, { forceRefresh: false })
      .then((nextState) => {
        cacheDeckyRetroAchievementsSubsetDetailState(providerId, gameId, subsetId, nextState);
        setRetroAchievementsSubsetDetailStates((current) => ({ ...current, [subsetId]: nextState }));
      })
      .catch(() => {
        setRetroAchievementsSubsetDetailStates((current) => ({
          ...current,
          [subsetId]: { status: "error", isStale: false, isRefreshing: false },
        }));
      });
  }, [gameId, providerId, retroAchievementsSubsetDetailStates]);
  const handleOpenSubsetAchievementDetail = useCallback((subsetId: string, achievementId: string): void => {
    if (providerId !== undefined && gameId !== undefined) {
      saveCurrentSectionScroll("subsets");
      persistSteamSectionState((current) => ({
        ...current,
        activeSection: "subsets",
        subsets: {
          ...current.subsets,
          focusedSubsetId: subsetId,
          focusedAchievementId: achievementId,
          expandedSubsetIds: current.subsets.expandedSubsetIds.includes(subsetId)
            ? current.subsets.expandedSubsetIds
            : [...current.subsets.expandedSubsetIds, subsetId],
        },
      }));
    }
    requestFullScreenGameSectionRestoration(providerId ?? RETROACHIEVEMENTS_PROVIDER_ID, gameId ?? subsetId);
    onOpenAchievementDetail?.(achievementId, subsetId);
  }, [gameId, onOpenAchievementDetail, persistSteamSectionState, providerId, saveCurrentSectionScroll]);

  useEffect(() => {
    persistSteamSectionState((current) => ({
      ...current,
      achievements: {
        ...current.achievements,
        achievementFilter,
        achievementModeFilter,
        achievementGroupFilter,
        achievementAvailabilityFilter,
        achievementTypeFilter,
        achievementMissableOnly,
        query: achievementQuery,
        sort: achievementSort,
        displayMode: achievementDisplayMode,
        visibleAchievementIds: restorationVisibleAchievements.map((achievement) => achievement.achievementId),
      },
    }));
  }, [achievementAvailabilityFilter, achievementDisplayMode, achievementFilter, achievementGroupFilter, achievementMissableOnly, achievementModeFilter, achievementQuery, achievementSort, achievementTypeFilter, restorationVisibleAchievements, restorationIsSteamProvider]);

  useEffect(() => {
    if (!restorationIsSteamProvider) {
      return;
    }
    persistSteamSectionState((current) => ({
      ...current,
      "achievement-groups": {
        ...current["achievement-groups"],
        expandedGroupIds: expandedSteamAchievementGroupIds,
      },
    }));
  }, [expandedSteamAchievementGroupIds, restorationIsSteamProvider]);

  useEffect(() => {
    if (restorationIsSteamProvider) return;
    persistSteamSectionState((current) => ({
      ...current,
      subsets: {
        ...current.subsets,
        expandedSubsetIds: expandedRetroAchievementsSubsetIds,
      },
    }));
  }, [expandedRetroAchievementsSubsetIds, persistSteamSectionState, restorationIsSteamProvider]);

  useLayoutEffect(() => {
    if (restorationSnapshot === undefined || providerId === undefined || gameId === undefined) {
      return;
    }
    const routeKey = `${providerId}:${gameId}`;
    const shouldFocusInitialSection = focusedRouteKeyRef.current !== routeKey;
    const shouldRestoreChangedSection = restoredSectionNonceRef.current !== sectionRestoreNonce;
    const shouldRestoreDetailReturn = readFullScreenGameSectionPageState(providerId, gameId).restoreRequested;
    const shouldRestoreNewSubsetSection = activeSteamSection === "subsets"
      && visibleGameSections.some((section) => section.id === "subsets");
    if (!shouldFocusInitialSection && !shouldRestoreChangedSection && !shouldRestoreDetailReturn && !shouldRestoreNewSubsetSection) {
      return;
    }
    const anchor = sectionAnchorRef.current;
    const ownerWindow = anchor?.ownerDocument.defaultView;
    if (anchor === null || anchor === undefined || ownerWindow === null || ownerWindow === undefined) {
      return;
    }

    let cancelFocus: (() => void) | undefined;
    const frame = ownerWindow.requestAnimationFrame(() => {
      const currentState = readFullScreenGameSectionPageState(providerId, gameId);

      const activeSectionRoot = anchor.querySelector<HTMLElement>(
        `[data-steam-game-section='${activeSteamSection}']`,
      );
      let target: HTMLElement | null | undefined;
      if (activeSteamSection === "overview") {
        target = Array.from(activeSectionRoot?.querySelectorAll<HTMLElement>("[data-ac-up-next-id]") ?? [])
          .find((element) => element.dataset["acUpNextId"] === currentState.overview.focusedId)
          ?? activeSectionRoot?.querySelector<HTMLElement>("[role='button']");
      } else if (activeSteamSection === "achievements") {
        const targetId = selectFullScreenGameAchievementRestorationTarget({
          focusedAchievementId: currentState.achievements.focusedId,
          previousVisibleAchievementIds: currentState.achievements.visibleAchievementIds,
          currentVisibleAchievementIds: restorationVisibleAchievements.map((achievement) => achievement.achievementId),
        });
        const targets = Array.from(activeSectionRoot?.querySelectorAll<HTMLElement>("[data-achievement-companion-achievement-id]") ?? []);
        target = targets.find((element) => element.dataset["achievementCompanionAchievementId"] === targetId)
          ?? activeSectionRoot?.querySelector<HTMLElement>("[data-achievement-companion-steam-filter-control='true']");
      } else if (activeSteamSection === "achievement-groups") {
        target = currentState["achievement-groups"].focusedAchievementId === undefined
          ? undefined
          : Array.from(activeSectionRoot?.querySelectorAll<HTMLElement>("[data-achievement-companion-steam-achievement-id]") ?? [])
            .find((element) => element.dataset["achievementCompanionSteamAchievementId"] === currentState["achievement-groups"].focusedAchievementId);
        target ??= currentState["achievement-groups"].focusedGroupId === undefined
          ? undefined
          : Array.from(activeSectionRoot?.querySelectorAll<HTMLElement>("[data-achievement-companion-steam-group-id]") ?? [])
            .find((element) => element.dataset["achievementCompanionSteamGroupId"] === currentState["achievement-groups"].focusedGroupId);
        target ??= activeSectionRoot?.querySelector<HTMLElement>(
          "[data-achievement-companion-steam-group-id]",
        );
      } else if (activeSteamSection === "subsets") {
        const focusedSubsetId = currentState.subsets.focusedSubsetId;
        const focusedAchievementId = currentState.subsets.focusedAchievementId;
        target = focusedAchievementId === undefined
          ? undefined
          : Array.from(activeSectionRoot?.querySelectorAll<HTMLElement>("[data-achievement-companion-achievement-id]") ?? [])
            .find((element) => element.dataset["achievementCompanionAchievementId"] === focusedAchievementId);
        target = focusedSubsetId === undefined
          ? target
          : target ?? activeSectionRoot?.querySelector<HTMLElement>(
            `[data-achievement-companion-ra-subset-id='${focusedSubsetId}']`,
          );
        target ??= activeSectionRoot?.querySelector<HTMLElement>(
          "[data-achievement-companion-ra-subset-id]",
        );
      } else {
        const communityFocusTarget = restorationIsSteamProvider
          ? STEAM_HUNTERS_COMMUNITY_SECTION_FOCUS_TARGET
          : RETROACHIEVEMENTS_COMMUNITY_SECTION_FOCUS_TARGET;
        target = activeSectionRoot?.querySelector<HTMLElement>(
          `[data-achievement-companion-focus-target='${communityFocusTarget}']`,
        );
      }

      focusedRouteKeyRef.current = routeKey;
      restoredSectionNonceRef.current = sectionRestoreNonce;
      if (shouldRestoreDetailReturn) {
        consumeFullScreenGameSectionRestoration(providerId, gameId);
      }
      if (target !== null && target !== undefined) {
        if (shouldFocusInitialSection && activeSteamSection === "overview" && !restorationIsSteamProvider) {
          // Match the RA profile's entry behavior: take native controller focus
          // once the Overview controls are mounted so L1/R1 works immediately.
          if (!anchor.contains(anchor.ownerDocument.activeElement)) {
            takeDeckySteamGamepadFocus(target);
          }
        } else {
          cancelFocus = requestDeckySteamGamepadFocusAfterMount(target);
        }
        const savedScrollTop = currentState[activeSteamSection].scrollTop;
        const isAchievementJump = activeSteamSection === "achievements" && pendingAchievementJumpRef.current !== undefined;
        if (isAchievementJump) pendingAchievementJumpRef.current = undefined;
        target.scrollIntoView({ block: "center", inline: "nearest" });
        ownerWindow.requestAnimationFrame(() => {
          const scrollContainer = findDeckyScrollableAncestor(target!);
          if (scrollContainer !== null && !isAchievementJump) scrollContainer.scrollTop = activeSteamSection === "overview" ? 0 : savedScrollTop;
        });
      }
    });
    return () => { ownerWindow.cancelAnimationFrame(frame); cancelFocus?.(); };
  }, [activeSteamSection, gameId, providerId, restorationIsSteamProvider, restorationSnapshot, restorationVisibleAchievements, sectionRestoreNonce, visibleGameSections]);

  if (!isRenderableGameDetailState(state) || isWaitingForSteamHuntersEnrichment || isWaitingForRetroAchievementsSubsets) {
    return (
      <DeckyFullScreenGameLoadingState
        state={state}
        hasRouteParameters={hasRouteParameters}
        backFooter={backFooter}
        onBack={onBack}
        providerId={providerId}
        useNativeFocus
        useSteamTheme={providerId === STEAM_PROVIDER_ID}
        isWaitingForRetroAchievementsSubsets={isWaitingForRetroAchievementsSubsets}
      />
    );
  }

  const snapshot =
    steamHuntersEnrichmentResult?.sourceSnapshot === state.data
      ? steamHuntersEnrichmentResult.enrichedSnapshot
      : state.data;
  const game = snapshot.game;
  const isSteamProvider = game.providerId === STEAM_PROVIDER_ID;
  const orderedAchievements = restorationOrderedAchievements;
  const achievementSummary = formatAchievementStatusSummary(orderedAchievements);
  const summary = snapshot.game.summary;
  const providerIdValue = providerId ?? game.providerId;
  const steamHuntersEnrichment = isSteamProvider ? getSteamHuntersGameEnrichment(snapshot) : undefined;
  const achievementGroupFilterOptions = getAchievementGroupFilterOptions(
    orderedAchievements,
    steamHuntersEnrichment?.achievementGroupsBySteamAchievementId,
    steamHuntersEnrichment?.achievementGroups,
  );
  const achievementAvailabilityFilterOptions = getAchievementAvailabilityFilterOptions(
    orderedAchievements,
    steamHuntersEnrichment?.achievementsBySteamAchievementId,
  );
  const activeAchievementGroupFilter = achievementGroupFilterOptions.includes(achievementGroupFilter)
    ? achievementGroupFilter
    : "all";
  const activeAchievementAvailabilityFilter = achievementAvailabilityFilterOptions.includes(achievementAvailabilityFilter)
    ? achievementAvailabilityFilter
    : "all";
  const filteredAchievements = restorationVisibleAchievements;
  const completionPercent = getCompletionPercent(snapshot.game.summary);
  const achievements = filteredAchievements;
  const rememberedAchievementId = readFullScreenGameSectionPageState(
    providerId ?? game.providerId,
    game.gameId,
  ).achievements.focusedId;
  const initialAchievementRenderLimit = getFullScreenAchievementRenderLimit(achievements, rememberedAchievementId);
  const refreshTimestamp = state.lastUpdatedAt ?? snapshot.refreshedAt;
  const totalAchievementCount = summary.totalCount ?? snapshot.achievements.length;
  const gameMetadataPills = buildGameMetadataPills(
    game.metrics,
    isSteamProvider,
    isSteamProvider,
    !isSteamProvider,
    game.releaseDateGranularity,
  );
  const steamHuntersViewModel = restorationSteamHuntersViewModel;
  const steamAchievementGroupSections = restorationSteamAchievementGroupSections;
  const showRetroAchievementsModeFilter = !isSteamProvider
    && settings.retroAchievementsAchievementMode === "both"
    && hasDistinctRetroAchievementsModes(snapshot.achievements);

  const overviewActions: DeckyGameOverviewActions = {
    suggestions: overviewSuggestions,
    hiddenSuggestions: restorationProjectedAchievements.filter((achievement) => overviewPreferences.hiddenAchievementIds.includes(achievement.achievementId)),
    goalComplete: isGameOverviewGoalComplete(snapshot, overviewPreferences.retroAchievementsGoal, settings.retroAchievementsAchievementMode),
    onOpenAchievement: (achievementId, returnToOrigin) => {
      openDeckyAchievementDetailModal({ providerId: providerIdValue, gameId: game.gameId, achievementId, onClose: () => {
        if (returnToOrigin !== undefined) {
          returnToOrigin();
          return;
        }
        const root = sectionAnchorRef.current;
        const rows = Array.from(root?.querySelectorAll<HTMLElement>("[data-ac-up-next-id]") ?? []);
        requestDeckySteamGamepadFocusAfterMount(rows.find((row) => row.dataset["acUpNextId"] === achievementId) ?? rows[0]
          ?? root?.querySelector<HTMLElement>("[aria-label='Manage Suggestions']"));
      } });
    },
    onJumpToAchievement: jumpToOverviewAchievement,
    onDismissSuggestion: (achievementId) => {
      const focused = sectionAnchorRef.current?.querySelector<HTMLElement>("[data-ac-up-next-id].gpfocus");
      if (focused?.dataset["acUpNextId"] === achievementId) {
        dismissedSuggestionIndexRef.current = overviewSuggestions.findIndex((item) => item.achievement.achievementId === achievementId);
      }
      overviewPreferences.hideSuggestion(achievementId);
    },
    onRestoreSuggestion: overviewPreferences.restoreSuggestion,
    onRestoreAllSuggestions: overviewPreferences.restoreAllSuggestions,
    onFocusedSuggestionChange: focusOverviewSuggestion,
    ...(visibleGameSections.some((section) => section.id === "community") ? { onOpenCommunity: () => selectSteamSection("community") } : {}),
  };

  const pageSections = (
    <>
          {isSteamProvider && activeSteamSection === "overview" ? (
            <div
              data-steam-game-section="overview"
              style={{ ...getSteamOverviewSectionStyle(), display: "flex", flexDirection: "column" }}
            >
              <div style={getSteamOverviewSectionStyle()}>
                <MemoizedDeckySteamGameOverview
                  game={game}
                  achievements={orderedAchievements}
                  totalAchievementCount={totalAchievementCount}
                  completionPercent={completionPercent}
                  steamHuntersEnrichment={steamHuntersEnrichment}
                  refreshedAt={refreshTimestamp}
                  overviewActions={overviewActions}
                />
              </div>
            </div>
          ) : null}

          {!isSteamProvider && activeSteamSection === "overview" ? (
            <div data-steam-game-section="overview" style={getSteamOverviewSectionStyle()}>
              <DeckyRetroAchievementsGameOverview
                snapshot={snapshot}
                achievementMode={settings.retroAchievementsAchievementMode}
                metadataPills={gameMetadataPills}
                refreshedAt={refreshTimestamp}
                overviewActions={overviewActions}
                goal={overviewPreferences.retroAchievementsGoal}
                globalGoal={overviewPreferences.globalRetroAchievementsGoal}
                {...(overviewPreferences.retroAchievementsGoalOverride !== undefined ? { gameGoalOverride: overviewPreferences.retroAchievementsGoalOverride } : {})}
                onSetGlobalGoal={overviewPreferences.setGlobalRetroAchievementsGoal}
                onSetGameGoalOverride={overviewPreferences.setRetroAchievementsGameGoal}
              />
            </div>
          ) : null}

          {activeSteamSection === "achievements" ? <div
            data-steam-game-section="achievements"
          ><PanelSection title="Achievements">
            <PanelSectionRow>
              <MemoizedDeckyFullScreenAchievementBrowser
                achievementFilter={achievementFilter}
                achievementModeFilter={achievementModeFilter}
                achievementGroupFilter={activeAchievementGroupFilter}
                achievementAvailabilityFilter={activeAchievementAvailabilityFilter}
                achievementTypeFilter={achievementTypeFilter}
                achievementMissableOnly={restorationMissableOnly}
                achievementSummary={achievementSummary}
                allAchievements={orderedAchievements}
                achievements={achievements}
                gameMetrics={game.metrics}
                providerId={providerIdValue}
                initialRenderLimit={initialAchievementRenderLimit}
                query={achievementQuery}
                sort={achievementSort}
                displayMode={achievementDisplayMode}
                showAchievementModeFilter={showRetroAchievementsModeFilter}
                onAchievementFilterChange={handleAchievementFilterChange}
                onAchievementModeFilterChange={handleAchievementModeFilterChange}
                onAchievementGroupFilterChange={handleAchievementGroupFilterChange}
                onAchievementAvailabilityFilterChange={handleAchievementAvailabilityFilterChange}
                onAchievementTypeFilterChange={handleAchievementTypeFilterChange}
                onAchievementMissableOnlyChange={handleAchievementMissableOnlyChange}
                onQueryChange={handleAchievementQueryChange}
                onSortChange={handleAchievementSortChange}
                onDisplayModeChange={handleAchievementDisplayModeChange}
                onFocusAchievement={handleFocusAchievement}
                onOpenAchievementDetail={handleOpenAchievementDetail}
                onBack={onBack}
                onJumpToTop={jumpSteamAchievementsToTop}
                {...(steamHuntersEnrichment !== undefined
                  ? {
                    steamHuntersAchievementsBySteamAchievementId: steamHuntersEnrichment.achievementsBySteamAchievementId,
                    steamHuntersAchievementGroupsBySteamAchievementId: steamHuntersEnrichment.achievementGroupsBySteamAchievementId,
                    steamHuntersAchievementGroups: steamHuntersEnrichment.achievementGroups,
                  }
                  : {})}
              />
            </PanelSectionRow>
          </PanelSection></div> : null}

          {isSteamProvider && steamHuntersEnrichment !== undefined && activeSteamSection === "achievement-groups" ? (
            <div
              data-steam-game-section="achievement-groups"
            >
              <PanelSection title={steamHuntersViewModel?.achievementSetMismatch === undefined
                ? "DLC / Groups"
                : `DLC / Groups (SteamHunters set: ${steamHuntersViewModel.achievementSetMismatch.steamHuntersCount} of ${steamHuntersViewModel.achievementSetMismatch.steamCount})`}>
                <PanelSectionRow>
                  <MemoizedDeckySteamAchievementGroupsSection
                  sections={steamAchievementGroupSections}
                  gameArtworkUrl={getSteamFullscreenGameArtworkUrl(game)}
                  steamHuntersAchievementsBySteamAchievementId={steamHuntersEnrichment.achievementsBySteamAchievementId}
                  expandedGroupIds={expandedSteamAchievementGroupIds}
                  onExpandedGroupIdsChange={setExpandedSteamAchievementGroupIds}
                  onFocusGroup={handleFocusAchievementGroup}
                  onFocusAchievement={handleFocusGroupedAchievement}
                  onOpenAchievementDetail={handleOpenAchievementDetail}
                  onBack={onBack}
                  />
                </PanelSectionRow>
              </PanelSection>
            </div>
          ) : null}

          {!isSteamProvider
            && activeSteamSection === "subsets"
            && (relatedGamesState.status === "success" || relatedGamesState.status === "stale")
            && relatedGamesState.data !== undefined ? (
            <div data-steam-game-section="subsets">
              <PanelSection title="Subsets">
                <PanelSectionRow>
                  <DeckyRetroAchievementsSubsetsSection
                    achievementMode={settings.retroAchievementsAchievementMode}
                    expandedSubsetIds={expandedRetroAchievementsSubsetIds}
                    subsets={relatedGamesState.data}
                    subsetDetails={retroAchievementsSubsetDetailStates}
                    onExpandedSubsetIdsChange={handleExpandedSubsetIdsChange}
                    onLoadSubsetAchievements={handleLoadSubsetAchievements}
                    onBack={onBack}
                    onFocusSubset={handleFocusSubset}
                    onFocusSubsetAchievement={handleFocusSubsetAchievement}
                    onOpenSubsetAchievementDetail={handleOpenSubsetAchievementDetail}
                  />
                </PanelSectionRow>
              </PanelSection>
            </div>
          ) : null}

          {isSteamProvider && steamHuntersViewModel !== undefined && activeSteamSection === "community" ? (
            <div
              data-steam-game-section="community"
            >
              <PanelSection title="Community">
                <PanelSectionRow>
                  <MemoizedDeckySteamHuntersCommunitySection model={steamHuntersViewModel} sectionEntryFocusTarget />
                </PanelSectionRow>
              </PanelSection>
            </div>
          ) : null}

          {!isSteamProvider && game.communityStats !== undefined && activeSteamSection === "community" ? (
            <div data-steam-game-section="community">
              <PanelSection title="Community">
                <PanelSectionRow>
                  <DeckyRetroAchievementsGameCommunitySection stats={game.communityStats} snapshot={snapshot} />
                </PanelSectionRow>
              </PanelSection>
            </div>
          ) : null}

    </>
  );

  return (
      <div {...(isSteamProvider ? { "data-ac-steam-theme": "fullscreen" } : { "data-ac-ra-theme": "fullscreen" })} style={getSteamGameShellStyle(steamFooterHeight)}>
        <div style={getSteamGameContentStyle(activeSteamSection)}>
          <TopAlignedScrollViewport
            fillHeight={activeSteamSection === "overview"}
            restoreAfterLayout
            restoreScrollTop={activeSteamSection === "overview" && !isSteamProvider
              ? undefined
              : readFullScreenGameSectionPageState(
                providerId ?? game.providerId,
                game.gameId,
              )[activeSteamSection].scrollTop}
            scrollKey={`full-screen-game:${providerId ?? game.providerId}:${game.gameId}`}
          >
            <div ref={sectionAnchorRef} style={getSteamGameContentFrameStyle(activeSteamSection)}>{pageSections}</div>
          </TopAlignedScrollViewport>
        </div>
        <DeckyFullScreenGameSectionNavigation
          activeSection={activeSteamSection}
          sections={visibleGameSections}
          ariaLabel={`${isSteamProvider ? "Steam" : "RetroAchievements"} game sections`}
          onPreviousSection={() => {
            selectAdjacentSteamSection("previous");
          }}
          onNextSection={() => {
            selectAdjacentSteamSection("next");
          }}
          onHeightChange={setSteamFooterHeight}
          {...(activeSteamSection === "achievements" ? { secondaryActionLabel: "Top", onSecondaryAction: jumpSteamAchievementsToTop } : {})}
          {...(activeSteamSection === "overview" && focusedSuggestionId !== null ? {
            secondaryActionLabel: "Show", contextualXActionLabel: "Hide",
            onSecondaryAction: () => {
              const focused = sectionAnchorRef.current?.querySelector<HTMLElement>("[data-ac-up-next-id].gpfocus");
              const id = focused?.dataset["acUpNextId"];
              if (id !== undefined) jumpToOverviewAchievement(id);
            },
          } : {})}
        />
      </div>
    );
}
