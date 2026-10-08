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
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { Focusable, PanelSection, PanelSectionRow } from "@decky/ui";
import {
  initialDeckyGameDetailState,
  loadDeckyGameDetailState,
  loadDeckySteamHuntersEnrichedGameDetail,
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
  type AchievementAvailabilityFilter,
  type AchievementFilter,
  type AchievementGroupFilter,
  type AchievementModeFilter,
} from "./decky-full-screen-achievement-browser";
import type { DeckyFullScreenGameMetadataPill } from "./decky-full-screen-game-metadata-pills";
import { DeckyRetroAchievementsGameSpotlight } from "./decky-retroachievements-game-spotlight";
import { DeckySteamGameOverview } from "./decky-steam-game-overview";
import {
  DeckySteamGameSectionNavigation,
  getAdjacentSteamGameSectionId,
  type DeckySteamGameSection,
  type DeckySteamGameSectionId,
} from "./decky-steam-game-section-navigation";
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
  consumeSteamGameSectionRestoration,
  readSteamGameSectionPageState,
  requestSteamGameSectionRestoration,
  selectSteamAchievementRestorationTarget,
  updateSteamGameSectionPageState,
} from "./decky-steam-game-section-state";
import updateArtworkUrl from "./assets/providers/steam/update.png";
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
  readonly onOpenAchievementDetail: ((achievementId: string) => void) | undefined;
  readonly onBack: () => void;
  readonly backLabel?: string;
  readonly backFooter?: string;
}

function formatDateOnly(epochMs: number | undefined): string {
  if (epochMs === undefined) {
    return "Unknown";
  }

  return new Date(epochMs).toLocaleDateString();
}

function formatCount(value: number): string {
  return value.toLocaleString();
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
    ...(includeReleased && released !== undefined
      ? [
          {
            key: "released",
            label: "Release date",
            value: released,
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
  useNativeFocus,
  useSteamTheme,
}: {
  readonly state: ResourceState<GameDetailSnapshot>;
  readonly hasRouteParameters: boolean;
  readonly backFooter: string;
  readonly onBack: () => void;
  readonly useNativeFocus: boolean;
  readonly useSteamTheme: boolean;
}): JSX.Element {
  const focusRef = useRef<HTMLDivElement>(null);
  const copy = getFullScreenLoadingCopy(state, hasRouteParameters, backFooter);

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
      onCancel={onBack}
      role={copy.isError ? "alert" : "status"}
      style={getDeckyFullScreenLoadingPageStyle()}
      tabIndex={0}
    >
      <DeckyFullScreenLoadingState
        description={copy.infoText}
        isError={copy.isError}
        title={copy.title}
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

function getSteamGameContentStyle(section: DeckySteamGameSectionId): CSSProperties {
  return {
    ...(section === "overview" ? { display: "flex", flexDirection: "column" } : {}),
    flex: "1 1 auto",
    minHeight: 0,
    // Overview is a single dashboard, not a focus-driven scroll surface.
    overflow: section === "overview" ? "clip" : "hidden auto",
  };
}

function getSteamGameContentFrameStyle(section: DeckySteamGameSectionId): CSSProperties {
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
  backLabel = "Back",
  backFooter = "Use Back to return to the compact side panel.",
}: DeckyFullScreenGamePageProps): JSX.Element {
  const settings = useDeckySettings();
  const sectionAnchorRef = useRef<HTMLDivElement>(null);
  const focusedRouteKeyRef = useRef<string | undefined>(undefined);
  const restoredSectionNonceRef = useRef(0);
  const [steamFooterHeight, setSteamFooterHeight] = useState(STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX);
  const initialSectionStateRef = useRef(providerId !== undefined && gameId !== undefined
    ? readSteamGameSectionPageState(providerId, gameId)
    : undefined);
  const initialSectionState = initialSectionStateRef.current;
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>(initialSectionState?.achievements.achievementFilter ?? "all");
  const [achievementModeFilter, setAchievementModeFilter] = useState<AchievementModeFilter>(initialSectionState?.achievements.achievementModeFilter ?? "all");
  const [achievementGroupFilter, setAchievementGroupFilter] = useState<AchievementGroupFilter>(initialSectionState?.achievements.achievementGroupFilter ?? "all");
  const [achievementAvailabilityFilter, setAchievementAvailabilityFilter] = useState<AchievementAvailabilityFilter>(initialSectionState?.achievements.achievementAvailabilityFilter ?? "all");
  const [expandedSteamAchievementGroupIds, setExpandedSteamAchievementGroupIds] = useState<readonly string[]>(
    initialSectionState?.["achievement-groups"].expandedGroupIds ?? [],
  );
  const [activeSteamSection, setActiveSteamSection] = useState<DeckySteamGameSectionId>(initialSectionState?.activeSection ?? "overview");
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
      forceRefresh: refreshNonce > 0 || initialSectionState?.restoreRequested !== true,
    });
  }, [gameId, initialSectionState?.restoreRequested, providerId, refreshNonce]);
  const state = useAsyncResourceState(loadSelectedGameDetail, initialDeckyGameDetailState);
  const hasRouteParameters = providerId !== undefined && gameId !== undefined;
  const loadedSnapshot = isRenderableGameDetailState(state) ? state.data : undefined;
  const isWaitingForSteamHuntersEnrichment = isDeckySteamFullscreenEnrichmentPending(
    loadedSnapshot,
    steamHuntersEnrichmentResult?.sourceSnapshot,
  );
  const displayedLoadedSnapshot =
    steamHuntersEnrichmentResult !== undefined && steamHuntersEnrichmentResult.sourceSnapshot === loadedSnapshot
      ? steamHuntersEnrichmentResult.enrichedSnapshot
      : loadedSnapshot;
  const loadedSteamHunters = displayedLoadedSnapshot !== undefined && displayedLoadedSnapshot.game.providerId === STEAM_PROVIDER_ID
    ? getSteamHuntersGameEnrichment(displayedLoadedSnapshot)
    : undefined;
  const loadedSteamHuntersViewModel = buildDeckySteamHuntersGameViewModel({
    achievements: displayedLoadedSnapshot?.achievements ?? [],
    enrichment: loadedSteamHunters,
  });
  const loadedSteamAchievementGroupSections = useMemo(
    () => buildDeckySteamAchievementGroupSections({
      achievements: displayedLoadedSnapshot?.achievements ?? [],
      groups: loadedSteamHunters?.achievementGroups ?? [],
    }),
    [displayedLoadedSnapshot?.achievements, loadedSteamHunters?.achievementGroups],
  );
  const hasLoadedSteamAchievementGroups = hasDeckySteamAchievementGroups(loadedSteamAchievementGroupSections);
  const raSectionListRef = useRef<{ readonly key: string; readonly sections: readonly DeckySteamGameSection[] }>();
  if (displayedLoadedSnapshot?.game.providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
    const key = `${displayedLoadedSnapshot.game.providerId}:${displayedLoadedSnapshot.game.gameId}`;
    if (raSectionListRef.current?.key !== key) {
      raSectionListRef.current = {
        key,
        sections: [
          { id: "overview", label: "Overview" },
          { id: "achievements", label: "Achievements" },
          ...(hasDisplayableRetroAchievementsCommunityStats(displayedLoadedSnapshot.game.communityStats)
            ? [{ id: "community" as const, label: "Community" }]
            : []),
        ],
      };
    }
  }
  const visibleGameSections = useMemo<readonly DeckySteamGameSection[]>(() => {
    if (displayedLoadedSnapshot?.game.providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
      return raSectionListRef.current?.sections ?? [
        { id: "overview", label: "Overview" },
        { id: "achievements", label: "Achievements" },
      ];
    }
    return [
      { id: "overview", label: "Overview" },
      { id: "achievements", label: "Achievements" },
      ...(hasLoadedSteamAchievementGroups
        ? [{ id: "achievement-groups" as const, label: "DLC / Groups" }]
        : []),
      ...(loadedSteamHuntersViewModel?.hasCommunityStats === true
        ? [{ id: "community" as const, label: "Community" }]
        : []),
    ];
  }, [displayedLoadedSnapshot?.game.providerId, hasLoadedSteamAchievementGroups, loadedSteamHuntersViewModel?.hasCommunityStats]);

  const persistSteamSectionState = useCallback((
    update: Parameters<typeof updateSteamGameSectionPageState>[2],
  ): void => {
    if (providerId !== undefined && gameId !== undefined) {
      updateSteamGameSectionPageState(providerId, gameId, update);
    }
  }, [gameId, providerId]);

  const saveCurrentSectionScroll = useCallback((
    section: DeckySteamGameSectionId = activeSteamSectionRef.current,
  ): void => {
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
  }, [persistSteamSectionState]);

  const selectSteamSection = (nextSection: DeckySteamGameSectionId): void => {
    const currentSection = activeSteamSectionRef.current;
    if (nextSection === currentSection) {
      return;
    }
    if (activeSteamSection === currentSection) {
      saveCurrentSectionScroll(currentSection);
    }
    persistSteamSectionState((current) => ({ ...current, activeSection: nextSection }));
    activeSteamSectionRef.current = nextSection;
    setActiveSteamSection(nextSection);
    setSectionRestoreNonce((current) => current + 1);
  };

  const selectAdjacentSteamSection = (direction: "previous" | "next"): void => {
    selectSteamSection(getAdjacentSteamGameSectionId(
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
    if (!visibleGameSections.some((section) => section.id === activeSteamSection)) {
      selectSteamSection("overview");
    }
  }, [activeSteamSection, isWaitingForSteamHuntersEnrichment, loadedSnapshot, visibleGameSections]);
  useLayoutEffect(() => {
    activeSteamSectionRef.current = activeSteamSection;
  }, [activeSteamSection]);
  useEffect(() => {
    if (
      loadedSnapshot === undefined ||
      loadedSnapshot.game.providerId !== STEAM_PROVIDER_ID ||
      getSteamHuntersGameEnrichment(loadedSnapshot) !== undefined
    ) {
      return;
    }

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
    if (providerId === undefined || gameId === undefined || displayedLoadedSnapshot === undefined) {
      return;
    }
    const anchor = sectionAnchorRef.current;
    const scrollContainer = anchor === null ? null : findDeckyScrollableAncestor(anchor);
    if (scrollContainer === null) {
      return;
    }
    const onScroll = (): void => {
      if (readSteamGameSectionPageState(providerId, gameId).restoreRequested) {
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
  const restorationShowModeFilter = restorationSnapshot?.game.providerId === RETROACHIEVEMENTS_PROVIDER_ID
    && settings.retroAchievementsAchievementMode === "both"
    && hasDistinctRetroAchievementsModes(restorationSnapshot.achievements);
  const restorationFilteredAchievements = useMemo(
    () => restorationSnapshot === undefined
      ? []
      : restorationOrderedAchievements.filter((achievement) =>
      matchesAchievementFilter(achievement, achievementFilter) &&
      matchesAchievementGroupFilter(
        achievement,
        restorationGroupFilter,
        restorationSteamHuntersEnrichment?.achievementGroupsBySteamAchievementId,
      ) &&
      matchesAchievementAvailabilityFilter(
        achievement,
        restorationAvailabilityFilter,
        restorationSteamHuntersEnrichment?.achievementsBySteamAchievementId,
      ) &&
      (restorationShowModeFilter ? matchesAchievementModeFilter(achievement, achievementModeFilter) : true),
      ),
    [
      achievementAvailabilityFilter,
      achievementFilter,
      achievementGroupFilter,
      achievementModeFilter,
      restorationAvailabilityFilter,
      restorationGroupFilter,
      restorationIsSteamProvider,
      restorationOrderedAchievements,
      restorationShowModeFilter,
      restorationSnapshot,
      restorationSteamHuntersEnrichment?.achievementGroupsBySteamAchievementId,
      restorationSteamHuntersEnrichment?.achievementsBySteamAchievementId,
    ],
  );
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
        })
      : undefined,
    [restorationIsSteamProvider, restorationOrderedAchievements, restorationSteamHuntersEnrichment],
  );
  const restorationSteamAchievementGroupSections = useMemo(
    () => buildDeckySteamAchievementGroupSections({
      achievements: restorationOrderedAchievements,
      groups: restorationSteamHuntersEnrichment?.achievementGroups ?? [],
    }),
    [restorationOrderedAchievements, restorationSteamHuntersEnrichment?.achievementGroups],
  );
  const handleAchievementFilterChange = useCallback((filter: AchievementFilter): void => {
    setAchievementFilter(filter);
  }, []);
  const handleAchievementModeFilterChange = useCallback((filter: AchievementModeFilter): void => {
    setAchievementModeFilter(filter);
  }, []);
  const handleAchievementGroupFilterChange = useCallback((filter: AchievementGroupFilter): void => {
    setAchievementGroupFilter(filter);
  }, []);
  const handleAchievementAvailabilityFilterChange = useCallback((filter: AchievementAvailabilityFilter): void => {
    setAchievementAvailabilityFilter(filter);
  }, []);
  const handleFocusAchievement = useCallback((achievementId: string): void => {
    persistSteamSectionState((current) => ({
      ...current,
      achievements: { ...current.achievements, focusedId: achievementId },
    }));
  }, [persistSteamSectionState]);
  const handleOpenAchievementDetail = useCallback((achievementId: string): void => {
    if (providerId !== undefined && gameId !== undefined) {
      saveCurrentSectionScroll();
      requestSteamGameSectionRestoration(providerId, gameId);
    }
    onOpenAchievementDetail?.(achievementId);
  }, [gameId, onOpenAchievementDetail, providerId, saveCurrentSectionScroll]);
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

  useEffect(() => {
    persistSteamSectionState((current) => ({
      ...current,
      achievements: {
        ...current.achievements,
        achievementFilter,
        achievementModeFilter,
        achievementGroupFilter,
        achievementAvailabilityFilter,
        visibleAchievementIds: restorationFilteredAchievements.map((achievement) => achievement.achievementId),
      },
    }));
  }, [achievementAvailabilityFilter, achievementFilter, achievementGroupFilter, achievementModeFilter, restorationFilteredAchievements, restorationIsSteamProvider]);

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

  useLayoutEffect(() => {
    if (restorationSnapshot === undefined || providerId === undefined || gameId === undefined) {
      return;
    }
    const routeKey = `${providerId}:${gameId}`;
    const shouldFocusInitialSection = focusedRouteKeyRef.current !== routeKey;
    const shouldRestoreChangedSection = restoredSectionNonceRef.current !== sectionRestoreNonce;
    const shouldRestoreDetailReturn = readSteamGameSectionPageState(providerId, gameId).restoreRequested;
    if (!shouldFocusInitialSection && !shouldRestoreChangedSection && !shouldRestoreDetailReturn) {
      return;
    }
    const anchor = sectionAnchorRef.current;
    const ownerWindow = anchor?.ownerDocument.defaultView;
    if (anchor === null || anchor === undefined || ownerWindow === null || ownerWindow === undefined) {
      return;
    }

    let cancelFocus: (() => void) | undefined;
    const frame = ownerWindow.requestAnimationFrame(() => {
      const currentState = readSteamGameSectionPageState(providerId, gameId);

      const activeSectionRoot = anchor.querySelector<HTMLElement>(
        `[data-steam-game-section='${activeSteamSection}']`,
      );
      let target: HTMLElement | null | undefined;
      if (activeSteamSection === "overview") {
        target = activeSectionRoot?.querySelector<HTMLElement>("[role='button']");
      } else if (activeSteamSection === "achievements") {
        const targetId = selectSteamAchievementRestorationTarget({
          focusedAchievementId: currentState.achievements.focusedId,
          previousVisibleAchievementIds: currentState.achievements.visibleAchievementIds,
          currentVisibleAchievementIds: restorationFilteredAchievements.map((achievement) => achievement.achievementId),
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
        consumeSteamGameSectionRestoration(providerId, gameId);
      }
      if (target !== null && target !== undefined) {
        cancelFocus = requestDeckySteamGamepadFocusAfterMount(target);
        const savedScrollTop = currentState[activeSteamSection].scrollTop;
        target.scrollIntoView({ block: "center", inline: "nearest" });
        ownerWindow.requestAnimationFrame(() => {
          const scrollContainer = findDeckyScrollableAncestor(target!);
          if (scrollContainer !== null) scrollContainer.scrollTop = savedScrollTop;
        });
      }
    });
    return () => { ownerWindow.cancelAnimationFrame(frame); cancelFocus?.(); };
  }, [activeSteamSection, gameId, providerId, restorationFilteredAchievements, restorationIsSteamProvider, restorationSnapshot, sectionRestoreNonce]);

  if (!isRenderableGameDetailState(state) || isWaitingForSteamHuntersEnrichment) {
    return (
      <DeckyFullScreenGameLoadingState
        state={state}
        hasRouteParameters={hasRouteParameters}
        backFooter={backFooter}
        onBack={onBack}
        useNativeFocus
        useSteamTheme={providerId === STEAM_PROVIDER_ID}
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
  const filteredAchievements = restorationFilteredAchievements;
  const filteredAchievementCount = filteredAchievements.length;
  const completionPercent = getCompletionPercent(snapshot.game.summary);
  const achievements = filteredAchievements;
  const rememberedAchievementId = readSteamGameSectionPageState(
    providerId ?? game.providerId,
    game.gameId,
  ).achievements.focusedId;
  const rememberedAchievementIndex = rememberedAchievementId === undefined
    ? -1 : achievements.findIndex((achievement) => achievement.achievementId === rememberedAchievementId);
  const initialAchievementRenderLimit = rememberedAchievementIndex < 0
    ? 36 : Math.ceil((rememberedAchievementIndex + 1) / 36) * 36;
  const refreshTimestamp = state.lastUpdatedAt ?? snapshot.refreshedAt;
  const totalAchievementCount = summary.totalCount ?? snapshot.achievements.length;
  const gameMetadataPills = buildGameMetadataPills(
    game.metrics,
    isSteamProvider,
    isSteamProvider,
  );
  const steamHuntersViewModel = restorationSteamHuntersViewModel;
  const steamAchievementGroupSections = restorationSteamAchievementGroupSections;
  const showRetroAchievementsModeFilter = !isSteamProvider
    && settings.retroAchievementsAchievementMode === "both"
    && hasDistinctRetroAchievementsModes(snapshot.achievements);

  const pageSections = (
    <>
          {isSteamProvider && activeSteamSection === "overview" ? (
            <div
              data-steam-game-section="overview"
            >
              <div style={getSteamOverviewSectionStyle()}>
                <MemoizedDeckySteamGameOverview
                  game={game}
                  achievements={orderedAchievements}
                  totalAchievementCount={totalAchievementCount}
                  completionPercent={completionPercent}
                  steamHuntersEnrichment={steamHuntersEnrichment}
                  updatedLabel={formatDateOnly(refreshTimestamp)}
                  refreshedAt={refreshTimestamp}
                />
              </div>
            </div>
          ) : null}

          {!isSteamProvider && activeSteamSection === "overview" ? <div data-steam-game-section="overview"><PanelSection title="Overview">
            <PanelSectionRow>
              <Focusable noFocusRing role="button" onActivate={() => {}} style={{ width: "100%" }}>
                <DeckyRetroAchievementsGameSpotlight
                  game={game}
                  achievements={snapshot.achievements}
                  metadataPills={gameMetadataPills}
                  backLabel={backLabel}
                  onBack={onBack}
                  onRefresh={() => {
                    setRefreshNonce((current) => current + 1);
                  }}
                  showActions={false}
                  showCommunityStats={false}
                />
              </Focusable>
            </PanelSectionRow>
          </PanelSection></div> : null}

          {activeSteamSection === "achievements" ? <div
            data-steam-game-section="achievements"
          ><PanelSection title="Achievements">
            <PanelSectionRow>
              <MemoizedDeckyFullScreenAchievementBrowser
                achievementFilter={achievementFilter}
                achievementModeFilter={achievementModeFilter}
                achievementGroupFilter={activeAchievementGroupFilter}
                achievementAvailabilityFilter={activeAchievementAvailabilityFilter}
                achievementSummary={achievementSummary}
                allAchievements={orderedAchievements}
                achievements={achievements}
                providerId={providerIdValue}
                filteredAchievementCount={filteredAchievementCount}
                initialRenderLimit={initialAchievementRenderLimit}
                showAchievementModeFilter={showRetroAchievementsModeFilter}
                onAchievementFilterChange={handleAchievementFilterChange}
                onAchievementModeFilterChange={handleAchievementModeFilterChange}
                onAchievementGroupFilterChange={handleAchievementGroupFilterChange}
                onAchievementAvailabilityFilterChange={handleAchievementAvailabilityFilterChange}
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
              <PanelSection title="DLC / Groups">
                <PanelSectionRow>
                  <MemoizedDeckySteamAchievementGroupsSection
                  sections={steamAchievementGroupSections}
                  gameArtworkUrl={getSteamFullscreenGameArtworkUrl(game)}
                  updateArtworkUrl={updateArtworkUrl}
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
                  <DeckyRetroAchievementsGameCommunitySection stats={game.communityStats} />
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
            restoreScrollTop={readSteamGameSectionPageState(
              providerId ?? game.providerId,
              game.gameId,
            )[activeSteamSection].scrollTop}
            scrollKey={`full-screen-game:${providerId ?? game.providerId}:${game.gameId}`}
          >
            <div ref={sectionAnchorRef} style={getSteamGameContentFrameStyle(activeSteamSection)}>{pageSections}</div>
          </TopAlignedScrollViewport>
        </div>
        <DeckySteamGameSectionNavigation
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
        />
      </div>
    );
}
