import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { Field, PanelSection, PanelSectionRow, ScrollPanel } from "@decky/ui";
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
  type DeckySteamGameSection,
  type DeckySteamGameSectionId,
} from "./decky-steam-game-section-navigation";
import { STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX } from "./decky-steam-game-footer-layout";
import { formatDeckyNumericText } from "./decky-number-format";
import { getSteamFullscreenGameArtworkUrl } from "./decky-steam-game-artwork";
import { isDeckySteamFullscreenEnrichmentPending } from "./decky-steam-fullscreen-enrichment";
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
import { shouldRenderAchievementModeFilter } from "./decky-achievement-detail-helpers";
import { sortAchievementsForDisplay } from "./decky-game-detail-ordering";
import { findDeckyScrollableAncestor, TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { STEAM_PROVIDER_ID } from "./providers/steam";
import { getSteamHuntersGameEnrichment } from "../../providers/steamhunters";
import {
  consumeSteamGameSectionRestoration,
  readSteamGameSectionPageState,
  requestSteamGameSectionRestoration,
  selectSteamAchievementRestorationTarget,
  updateSteamGameSectionPageState,
} from "./decky-steam-game-section-state";
import trophyIconUrl from "./assets/trophy.svg";
import infoIconUrl from "./assets/info.svg";
import updateArtworkUrl from "./assets/providers/steam/update.png";

export interface DeckyFullScreenGamePageProps {
  readonly providerId: string | undefined;
  readonly gameId: string | undefined;
  readonly onOpenAchievementDetail: ((achievementId: string) => void) | undefined;
  readonly onBack: () => void;
  readonly backLabel?: string;
  readonly backFooter?: string;
}

function formatTimestamp(epochMs: number | undefined): string {
  if (epochMs === undefined) {
    return "Unknown";
  }

  return new Date(epochMs).toLocaleString();
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
    ...(released !== undefined
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

// RetroAchievements retains its established independent scroll clearance.
const FULLSCREEN_GAME_BOTTOM_SCROLL_PADDING = 88;
const FULLSCREEN_GAME_TOP_PADDING = 42;
const STEAM_OVERVIEW_FRAME_INSET = 12;
function getFullScreenPageFrameStyle(): CSSProperties {
  return {
    padding: `calc(env(safe-area-inset-top, 0px) + ${FULLSCREEN_GAME_TOP_PADDING}px) 12px calc(env(safe-area-inset-bottom, 0px) + ${FULLSCREEN_GAME_BOTTOM_SCROLL_PADDING}px)`,
    boxSizing: "border-box",
  };
}

function getFullScreenLoadingFrameStyle(): CSSProperties {
  return {
    display: "flex",
    flex: "1 1 auto",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    minHeight: 0,
    padding: "clamp(82px, 15vh, 128px) clamp(18px, 8vw, 120px) 72px",
    boxSizing: "border-box",
    overflow: "hidden",
    position: "relative",
    color: "rgba(238, 246, 255, 0.96)",
    background:
      "radial-gradient(ellipse at 50% 28%, rgba(34, 102, 162, 0.26), transparent 42%), radial-gradient(circle at 12% 70%, rgba(44, 91, 139, 0.16), transparent 28%), linear-gradient(135deg, #07111c 0%, #0b1724 54%, #07101a 100%)",
  };
}

function getFullScreenLoadingContentStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    maxWidth: 760,
    gap: 28,
    textAlign: "center",
    position: "relative",
    zIndex: 1,
  };
}

function getFullScreenLoadingProgressStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: "clamp(142px, 22vw, 184px)",
    height: "clamp(142px, 22vw, 184px)",
    borderRadius: "50%",
    background: "rgba(8, 23, 37, 0.94)",
    boxShadow: "0 0 34px rgba(24, 174, 239, 0.22), inset 0 0 0 1px rgba(151, 225, 255, 0.18)",
  };
}

function getFullScreenLoadingSpinnerRingStyle(): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background:
      "conic-gradient(from -24deg, #1cbcf1 0deg, #18a9e4 76deg, rgba(37, 85, 151, 0.84) 77deg, rgba(27, 58, 107, 0.76) 360deg)",
  };
}

function getFullScreenLoadingIconWellStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    zIndex: 1,
    width: "calc(100% - 18px)",
    height: "calc(100% - 18px)",
    borderRadius: "50%",
    background: "radial-gradient(circle at 40% 30%, #112b42, #07131f 72%)",
    boxShadow: "inset 0 0 0 1px rgba(115, 192, 239, 0.18)",
  };
}

function getFullScreenLoadingIconStyle(): CSSProperties {
  return {
    width: "clamp(72px, 12vw, 102px)",
    height: "clamp(72px, 12vw, 102px)",
    objectFit: "contain",
    filter: "brightness(0) saturate(100%) invert(68%) sepia(79%) saturate(1428%) hue-rotate(161deg) brightness(101%) contrast(102%) drop-shadow(0 0 10px rgba(41, 196, 246, 0.36))",
  };
}

function getFullScreenLoadingTitleStyle(): CSSProperties {
  return {
    margin: 0,
    color: "rgba(247, 250, 255, 0.98)",
    fontSize: "clamp(1.8rem, 4vw, 3rem)",
    fontWeight: 750,
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
  };
}

function getFullScreenLoadingInfoCardStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "54px minmax(0, 1fr)",
    alignItems: "center",
    gap: 18,
    width: "100%",
    padding: "20px 24px",
    boxSizing: "border-box",
    border: "1px solid rgba(72, 155, 222, 0.28)",
    borderRadius: 18,
    textAlign: "left",
    background: "linear-gradient(135deg, rgba(17, 37, 57, 0.9), rgba(12, 27, 43, 0.78))",
    boxShadow: "inset 0 1px 0 rgba(185, 225, 255, 0.06), 0 8px 28px rgba(0, 0, 0, 0.18)",
  };
}

function getFullScreenLoadingInfoIconStyle(): CSSProperties {
  return {
    width: 38,
    height: 38,
    justifySelf: "center",
    opacity: 0.96,
    filter: "brightness(0) saturate(100%) invert(68%) sepia(79%) saturate(1428%) hue-rotate(161deg) brightness(101%) contrast(102%) drop-shadow(0 0 8px rgba(41, 196, 246, 0.3))",
  };
}

function getFullScreenLoadingInfoTitleStyle(): CSSProperties {
  return {
    margin: 0,
    color: "rgba(249, 252, 255, 0.96)",
    fontSize: "1.08rem",
    fontWeight: 700,
    lineHeight: 1.25,
  };
}

function getFullScreenLoadingInfoDescriptionStyle(): CSSProperties {
  return {
    margin: "6px 0 0",
    color: "rgba(183, 208, 231, 0.9)",
    fontSize: "0.96rem",
    lineHeight: 1.45,
  };
}

function getFullScreenLoadingFooterStyle(): CSSProperties {
  return {
    margin: "-8px 0 0",
    color: "rgba(183, 208, 231, 0.74)",
    fontSize: "0.86rem",
  };
}

interface FullScreenLoadingCopy {
  readonly title: string;
  readonly description: string;
  readonly infoTitle: string;
  readonly infoDescription: string;
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
      infoTitle: "Return to the game page",
      infoDescription: backFooter,
      isError: true,
    };
  }

  if (state.status === "error") {
    return {
      title: "Unable to load game details",
      description: state.error?.userMessage ?? "The game details could not be loaded.",
      infoTitle: "Try again from the game page",
      infoDescription: backFooter,
      isError: true,
    };
  }

  return {
    title: "Loading game details...",
    description: "Loading the full-screen game page from the existing game-detail service.",
    infoTitle: "Good things take a moment",
    infoDescription: "Hang tight — we’re loading everything you need for the best experience.",
    isError: false,
  };
}

function DeckyFullScreenGameLoadingState({
  state,
  hasRouteParameters,
  backFooter,
}: {
  readonly state: ResourceState<GameDetailSnapshot>;
  readonly hasRouteParameters: boolean;
  readonly backFooter: string;
}): JSX.Element {
  const copy = getFullScreenLoadingCopy(state, hasRouteParameters, backFooter);

  return (
    <section
      aria-busy={!copy.isError}
      aria-label={copy.title}
      aria-live="polite"
      data-state={state.status}
      role={copy.isError ? "alert" : "status"}
      style={getFullScreenLoadingFrameStyle()}
    >
      <div style={getFullScreenLoadingContentStyle()}>
        <DeckyFullScreenLoadingProgress />
        <h1 style={getFullScreenLoadingTitleStyle()}>{copy.title}</h1>
        <p style={{ display: "none" }}>{copy.description}</p>
        <div style={getFullScreenLoadingInfoCardStyle()}>
          <img alt="" aria-hidden="true" src={infoIconUrl} style={getFullScreenLoadingInfoIconStyle()} />
          <div>
            <p style={getFullScreenLoadingInfoTitleStyle()}>{copy.infoTitle}</p>
            <p style={getFullScreenLoadingInfoDescriptionStyle()}>{copy.infoDescription}</p>
          </div>
        </div>
        {copy.isError ? <p style={getFullScreenLoadingFooterStyle()}>{copy.description}</p> : null}
      </div>
    </section>
  );
}

function DeckyFullScreenLoadingProgress(): JSX.Element {
  const spinnerRingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const spinnerRing = spinnerRingRef.current;
    const ownerWindow = spinnerRing?.ownerDocument.defaultView;
    if (spinnerRing === null || ownerWindow === null || ownerWindow === undefined) {
      return;
    }

    const reducedMotion = ownerWindow.matchMedia("(prefers-reduced-motion: reduce)");
    let animation: Animation | undefined;
    const updateAnimation = (): void => {
      animation?.cancel();
      animation = reducedMotion.matches
        ? undefined
        : spinnerRing.animate(
          [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
          { duration: 1_450, easing: "linear", iterations: Infinity },
        );
    };

    updateAnimation();
    reducedMotion.addEventListener("change", updateAnimation);
    return () => {
      reducedMotion.removeEventListener("change", updateAnimation);
      animation?.cancel();
    };
  }, []);

  return (
    <div aria-hidden="true" style={getFullScreenLoadingProgressStyle()}>
      <div ref={spinnerRingRef} style={getFullScreenLoadingSpinnerRingStyle()} />
      <div style={getFullScreenLoadingIconWellStyle()}>
        <img alt="" src={trophyIconUrl} style={getFullScreenLoadingIconStyle()} />
      </div>
    </div>
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
  const sectionAnchorRef = useRef<HTMLDivElement>(null);
  const focusedRouteKeyRef = useRef<string | undefined>(undefined);
  const restoredSectionNonceRef = useRef(0);
  const [steamFooterHeight, setSteamFooterHeight] = useState(STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX);
  const initialSectionState = providerId !== undefined && gameId !== undefined
    ? readSteamGameSectionPageState(providerId, gameId)
    : undefined;
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>(initialSectionState?.achievements.achievementFilter ?? "all");
  const [achievementModeFilter, setAchievementModeFilter] = useState<AchievementModeFilter>(initialSectionState?.achievements.achievementModeFilter ?? "all");
  const [achievementGroupFilter, setAchievementGroupFilter] = useState<AchievementGroupFilter>(initialSectionState?.achievements.achievementGroupFilter ?? "all");
  const [achievementAvailabilityFilter, setAchievementAvailabilityFilter] = useState<AchievementAvailabilityFilter>(initialSectionState?.achievements.achievementAvailabilityFilter ?? "all");
  const [expandedSteamAchievementGroupIds, setExpandedSteamAchievementGroupIds] = useState<readonly string[]>(
    initialSectionState?.["achievement-groups"].expandedGroupIds ?? [],
  );
  const [activeSteamSection, setActiveSteamSection] = useState<DeckySteamGameSectionId>(initialSectionState?.activeSection ?? "overview");
  const [sectionRestoreNonce, setSectionRestoreNonce] = useState(0);
  const [steamHuntersEnrichmentResult, setSteamHuntersEnrichmentResult] = useState<{
    readonly sourceSnapshot: GameDetailSnapshot;
    readonly enrichedSnapshot: GameDetailSnapshot;
  } | undefined>(undefined);
  const loadSelectedGameDetail = useMemo(() => {
    if (providerId === undefined || gameId === undefined) {
      return () => Promise.resolve(initialDeckyGameDetailState);
    }

    return () => loadDeckyGameDetailState(providerId, gameId);
  }, [gameId, providerId, refreshNonce]);
  const state = useAsyncResourceState(loadSelectedGameDetail, initialDeckyGameDetailState);
  const hasRouteParameters = providerId !== undefined && gameId !== undefined;
  const loadedSnapshot = isRenderableGameDetailState(state) ? state.data : undefined;
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
  const visibleSteamSections = useMemo<readonly DeckySteamGameSection[]>(() => [
    { id: "overview", label: "Overview" },
    { id: "achievements", label: "Achievements" },
    ...(hasLoadedSteamAchievementGroups
      ? [{ id: "achievement-groups" as const, label: "DLC / Groups" }]
      : []),
    ...(loadedSteamHuntersViewModel?.hasCommunityStats === true
      ? [{ id: "community" as const, label: "Community" }]
      : []),
  ], [hasLoadedSteamAchievementGroups, loadedSteamHuntersViewModel?.hasCommunityStats]);

  const persistSteamSectionState = (
    update: Parameters<typeof updateSteamGameSectionPageState>[2],
  ): void => {
    if (providerId !== undefined && gameId !== undefined) {
      updateSteamGameSectionPageState(providerId, gameId, update);
    }
  };

  const saveCurrentSectionScroll = (): void => {
    const anchor = sectionAnchorRef.current;
    if (anchor === null) {
      return;
    }
    const scrollTop = findDeckyScrollableAncestor(anchor)?.scrollTop ?? 0;
    persistSteamSectionState((current) => ({
      ...current,
      [activeSteamSection]: {
        ...current[activeSteamSection],
        scrollTop,
      },
    }));
  };

  const selectSteamSection = (nextSection: DeckySteamGameSectionId): void => {
    if (nextSection === activeSteamSection) {
      return;
    }
    saveCurrentSectionScroll();
    persistSteamSectionState((current) => ({ ...current, activeSection: nextSection }));
    setActiveSteamSection(nextSection);
    setSectionRestoreNonce((current) => current + 1);
  };

  useEffect(() => {
    if (!visibleSteamSections.some((section) => section.id === activeSteamSection)) {
      selectSteamSection("overview");
    }
  }, [activeSteamSection, visibleSteamSections]);
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
    if (providerId === undefined || gameId === undefined || displayedLoadedSnapshot?.game.providerId !== STEAM_PROVIDER_ID) {
      return;
    }
    const anchor = sectionAnchorRef.current;
    const scrollContainer = anchor === null ? null : findDeckyScrollableAncestor(anchor);
    if (scrollContainer === null) {
      return;
    }
    const onScroll = (): void => {
      persistSteamSectionState((current) => ({
        ...current,
        [activeSteamSection]: { ...current[activeSteamSection], scrollTop: scrollContainer.scrollTop },
      }));
    };
    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      onScroll();
      scrollContainer.removeEventListener("scroll", onScroll);
    };
  }, [activeSteamSection, displayedLoadedSnapshot?.game.providerId, gameId, providerId]);

  const restorationSnapshot = isRenderableGameDetailState(state)
    ? (steamHuntersEnrichmentResult?.sourceSnapshot === state.data ? steamHuntersEnrichmentResult.enrichedSnapshot : state.data)
    : undefined;
  const restorationIsSteamProvider = restorationSnapshot?.game.providerId === STEAM_PROVIDER_ID;
  const restorationProviderId = restorationSnapshot === undefined
    ? providerId
    : providerId ?? restorationSnapshot.game.providerId;
  const restorationSteamHuntersEnrichment = restorationSnapshot === undefined
    ? undefined
    : getSteamHuntersGameEnrichment(restorationSnapshot);
  const restorationGroupFilterOptions = getAchievementGroupFilterOptions(
    restorationSnapshot?.achievements ?? [],
    restorationSteamHuntersEnrichment?.achievementGroupsBySteamAchievementId,
    restorationSteamHuntersEnrichment?.achievementGroups,
  );
  const restorationAvailabilityFilterOptions = getAchievementAvailabilityFilterOptions(
    restorationSnapshot?.achievements ?? [],
    restorationSteamHuntersEnrichment?.achievementsBySteamAchievementId,
  );
  const restorationGroupFilter = restorationGroupFilterOptions.includes(achievementGroupFilter)
    ? achievementGroupFilter
    : "all";
  const restorationAvailabilityFilter = restorationAvailabilityFilterOptions.includes(achievementAvailabilityFilter)
    ? achievementAvailabilityFilter
    : "all";
  const restorationFilteredAchievements = restorationSnapshot === undefined
    ? []
    : sortAchievementsForDisplay(restorationSnapshot.achievements).filter((achievement) =>
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
      (shouldRenderAchievementModeFilter(restorationProviderId) ? matchesAchievementModeFilter(achievement, achievementModeFilter) : true),
    );

  useEffect(() => {
    if (!restorationIsSteamProvider) {
      return;
    }
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
    if (!restorationIsSteamProvider || providerId === undefined || gameId === undefined) {
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

    const frame = ownerWindow.requestAnimationFrame(() => {
      const currentState = readSteamGameSectionPageState(providerId, gameId);
      const sectionState = currentState[activeSteamSection];
      const scrollContainer = findDeckyScrollableAncestor(anchor);
      if (scrollContainer !== null) {
        scrollContainer.scrollTop = sectionState.scrollTop;
      }

      let target: HTMLElement | null | undefined;
      if (activeSteamSection === "overview") {
        target = anchor.querySelector<HTMLElement>("[role='button'][aria-label='Play Game']");
      } else if (activeSteamSection === "achievements") {
        const targetId = selectSteamAchievementRestorationTarget({
          focusedAchievementId: currentState.achievements.focusedId,
          previousVisibleAchievementIds: currentState.achievements.visibleAchievementIds,
          currentVisibleAchievementIds: restorationFilteredAchievements.map((achievement) => achievement.achievementId),
        });
        const targets = Array.from(anchor.querySelectorAll<HTMLElement>("[data-achievement-companion-steam-achievement-id]"));
        target = targets.find((element) => element.dataset["achievementCompanionSteamAchievementId"] === targetId)
          ?? anchor.querySelector<HTMLElement>("[data-achievement-companion-steam-filter-control='true']");
      } else if (activeSteamSection === "achievement-groups") {
        target = currentState["achievement-groups"].focusedAchievementId === undefined
          ? undefined
          : Array.from(anchor.querySelectorAll<HTMLElement>("[data-achievement-companion-steam-achievement-id]"))
            .find((element) => element.dataset["achievementCompanionSteamAchievementId"] === currentState["achievement-groups"].focusedAchievementId);
        target ??= currentState["achievement-groups"].focusedGroupId === undefined
          ? undefined
          : Array.from(anchor.querySelectorAll<HTMLElement>("[data-achievement-companion-steam-group-id]"))
            .find((element) => element.dataset["achievementCompanionSteamGroupId"] === currentState["achievement-groups"].focusedGroupId);
        target ??= anchor.querySelector<HTMLElement>(
          "[data-achievement-companion-steam-group-id]",
        );
      } else {
        target = anchor.querySelector<HTMLElement>(
          `[data-achievement-companion-focus-target='${STEAM_HUNTERS_COMMUNITY_SECTION_FOCUS_TARGET}']`,
        );
      }

      focusedRouteKeyRef.current = routeKey;
      restoredSectionNonceRef.current = sectionRestoreNonce;
      if (shouldRestoreDetailReturn) {
        consumeSteamGameSectionRestoration(providerId, gameId);
      }
      target?.focus();
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, [activeSteamSection, gameId, providerId, restorationFilteredAchievements, restorationIsSteamProvider, sectionRestoreNonce]);

  const isWaitingForSteamHuntersEnrichment = isDeckySteamFullscreenEnrichmentPending(
    loadedSnapshot,
    steamHuntersEnrichmentResult?.sourceSnapshot,
  );

  if (!isRenderableGameDetailState(state) || isWaitingForSteamHuntersEnrichment) {
    return (
      <ScrollPanel>
        <TopAlignedScrollViewport
          fillHeight
          scrollKey={`full-screen-game:${providerId ?? "missing"}:${gameId ?? "missing"}`}
        >
          <DeckyFullScreenGameLoadingState
            state={state}
            hasRouteParameters={hasRouteParameters}
            backFooter={backFooter}
          />
        </TopAlignedScrollViewport>
      </ScrollPanel>
    );
  }

  const snapshot =
    steamHuntersEnrichmentResult?.sourceSnapshot === state.data
      ? steamHuntersEnrichmentResult.enrichedSnapshot
      : state.data;
  const game = snapshot.game;
  const isSteamProvider = game.providerId === STEAM_PROVIDER_ID;
  const orderedAchievements = sortAchievementsForDisplay(snapshot.achievements);
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
  const filteredAchievements = orderedAchievements.filter((achievement) =>
    matchesAchievementFilter(achievement, achievementFilter) &&
    matchesAchievementGroupFilter(
      achievement,
      activeAchievementGroupFilter,
      steamHuntersEnrichment?.achievementGroupsBySteamAchievementId,
    ) &&
    matchesAchievementAvailabilityFilter(
      achievement,
      activeAchievementAvailabilityFilter,
      steamHuntersEnrichment?.achievementsBySteamAchievementId,
    ) &&
    (shouldRenderAchievementModeFilter(providerIdValue) ? matchesAchievementModeFilter(achievement, achievementModeFilter) : true),
  );
  const filteredAchievementCount = filteredAchievements.length;
  const completionPercent = getCompletionPercent(snapshot.game.summary);
  const achievements = filteredAchievements;
  const isCachedView = state.status === "stale";
  const snapshotSourceLabel = isCachedView ? "Cached snapshot" : "Live snapshot";
  const refreshTimestamp = state.lastUpdatedAt ?? snapshot.refreshedAt;
  const totalAchievementCount = summary.totalCount ?? snapshot.achievements.length;
  const gameMetadataPills = buildGameMetadataPills(
    game.metrics,
    isSteamProvider || game.communityStats === undefined,
  );
  const steamHuntersViewModel = buildDeckySteamHuntersGameViewModel({
    achievements: orderedAchievements,
    enrichment: steamHuntersEnrichment,
  });
  const steamAchievementGroupSections = buildDeckySteamAchievementGroupSections({
    achievements: orderedAchievements,
    groups: steamHuntersEnrichment?.achievementGroups ?? [],
  });

  const pageSections = (
    <>
          {isSteamProvider && activeSteamSection === "overview" ? (
            <div style={getSteamOverviewSectionStyle()}>
              <DeckySteamGameOverview
                game={game}
                achievements={orderedAchievements}
                totalAchievementCount={totalAchievementCount}
                completionPercent={completionPercent}
                steamHuntersEnrichment={steamHuntersEnrichment}
                updatedLabel={formatDateOnly(refreshTimestamp)}
              />
            </div>
          ) : null}

          {!isSteamProvider ? <PanelSection title="Game Spotlight">
            <PanelSectionRow>
              {
                <DeckyRetroAchievementsGameSpotlight
                  game={game}
                  achievements={snapshot.achievements}
                  metadataPills={gameMetadataPills}
                  backLabel={backLabel}
                  onBack={onBack}
                  onRefresh={() => {
                    setRefreshNonce((current) => current + 1);
                  }}
                />
              }
            </PanelSectionRow>
          </PanelSection> : null}

          {(!isSteamProvider || activeSteamSection === "achievements") ? <PanelSection title="Achievements">
            <PanelSectionRow>
              <DeckyFullScreenAchievementBrowser
                achievementFilter={achievementFilter}
                achievementModeFilter={achievementModeFilter}
                achievementGroupFilter={activeAchievementGroupFilter}
                achievementAvailabilityFilter={activeAchievementAvailabilityFilter}
                achievementSummary={achievementSummary}
                allAchievements={orderedAchievements}
                achievements={achievements}
                providerId={providerIdValue}
                filteredAchievementCount={filteredAchievementCount}
                onAchievementFilterChange={(filter) => {
                  setAchievementFilter(filter);
                }}
                onAchievementModeFilterChange={(filter) => {
                  setAchievementModeFilter(filter);
                }}
                onAchievementGroupFilterChange={(filter) => {
                  setAchievementGroupFilter(filter);
                }}
                onAchievementAvailabilityFilterChange={(filter) => {
                  setAchievementAvailabilityFilter(filter);
                }}
                onFocusAchievement={(achievementId) => {
                  persistSteamSectionState((current) => ({
                    ...current,
                    achievements: { ...current.achievements, focusedId: achievementId },
                  }));
                }}
                onOpenAchievementDetail={(achievementId) => {
                  if (isSteamProvider && providerId !== undefined && gameId !== undefined) {
                    saveCurrentSectionScroll();
                    requestSteamGameSectionRestoration(providerId, gameId);
                  }
                  onOpenAchievementDetail?.(achievementId);
                }}
                onBack={onBack}
                {...(steamHuntersEnrichment !== undefined
                  ? {
                    steamHuntersAchievementsBySteamAchievementId: steamHuntersEnrichment.achievementsBySteamAchievementId,
                    steamHuntersAchievementGroupsBySteamAchievementId: steamHuntersEnrichment.achievementGroupsBySteamAchievementId,
                    steamHuntersAchievementGroups: steamHuntersEnrichment.achievementGroups,
                  }
                  : {})}
              />
            </PanelSectionRow>
          </PanelSection> : null}

          {isSteamProvider && activeSteamSection === "achievement-groups" && steamHuntersEnrichment !== undefined ? (
            <PanelSection title="DLC / Groups">
              <PanelSectionRow>
                <DeckySteamAchievementGroupsSection
                  sections={steamAchievementGroupSections}
                  gameArtworkUrl={getSteamFullscreenGameArtworkUrl(game)}
                  updateArtworkUrl={updateArtworkUrl}
                  steamHuntersAchievementsBySteamAchievementId={steamHuntersEnrichment.achievementsBySteamAchievementId}
                  expandedGroupIds={expandedSteamAchievementGroupIds}
                  onExpandedGroupIdsChange={setExpandedSteamAchievementGroupIds}
                  onFocusGroup={(groupId) => {
                    persistSteamSectionState((current) => ({
                      ...current,
                      "achievement-groups": { ...current["achievement-groups"], focusedGroupId: groupId, focusedAchievementId: undefined },
                    }));
                  }}
                  onFocusAchievement={(groupId, achievementId) => {
                    persistSteamSectionState((current) => ({
                      ...current,
                      "achievement-groups": { ...current["achievement-groups"], focusedGroupId: groupId, focusedAchievementId: achievementId },
                    }));
                  }}
                  onOpenAchievementDetail={(achievementId) => {
                    if (providerId !== undefined && gameId !== undefined) {
                      saveCurrentSectionScroll();
                      requestSteamGameSectionRestoration(providerId, gameId);
                    }
                    onOpenAchievementDetail?.(achievementId);
                  }}
                  onBack={onBack}
                />
              </PanelSectionRow>
            </PanelSection>
          ) : null}

          {isSteamProvider && activeSteamSection === "community" && steamHuntersViewModel !== undefined ? (
            <PanelSection title="Community">
              <PanelSectionRow>
                <DeckySteamHuntersCommunitySection model={steamHuntersViewModel} sectionEntryFocusTarget />
              </PanelSectionRow>
            </PanelSection>
          ) : null}

          {!isSteamProvider ? <PanelSection title="Snapshot">
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
          </PanelSection> : null}

    </>
  );

  if (isSteamProvider) {
    return (
      <div style={getSteamGameShellStyle(steamFooterHeight)}>
        <div style={getSteamGameContentStyle(activeSteamSection)}>
          <TopAlignedScrollViewport
            fillHeight={activeSteamSection === "overview"}
            scrollKey={`full-screen-game:${providerId ?? game.providerId}:${game.gameId}`}
          >
            <div ref={sectionAnchorRef} style={getSteamGameContentFrameStyle(activeSteamSection)}>{pageSections}</div>
          </TopAlignedScrollViewport>
        </div>
        <DeckySteamGameSectionNavigation
          activeSection={activeSteamSection}
          sections={visibleSteamSections}
          onPreviousSection={() => {
            const currentIndex = visibleSteamSections.findIndex((section) => section.id === activeSteamSection);
            const previousIndex = currentIndex <= 0 ? visibleSteamSections.length - 1 : currentIndex - 1;
            selectSteamSection(visibleSteamSections[previousIndex]?.id ?? "overview");
          }}
          onNextSection={() => {
            const currentIndex = visibleSteamSections.findIndex((section) => section.id === activeSteamSection);
            const nextIndex = currentIndex < 0 || currentIndex === visibleSteamSections.length - 1
              ? 0
              : currentIndex + 1;
            selectSteamSection(visibleSteamSections[nextIndex]?.id ?? "overview");
          }}
          onBack={onBack}
          onHeightChange={setSteamFooterHeight}
        />
      </div>
    );
  }

  return (
    <ScrollPanel>
      <TopAlignedScrollViewport
        scrollKey={`full-screen-game:${providerId ?? game.providerId}:${game.gameId}`}
      >
        <div ref={sectionAnchorRef} style={getFullScreenPageFrameStyle()}>{pageSections}</div>
      </TopAlignedScrollViewport>
    </ScrollPanel>
  );
}
