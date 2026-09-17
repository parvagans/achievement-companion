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
import { PlaceholderState } from "@ui/PlaceholderState";
import {
  initialDeckyGameDetailState,
  loadDeckyGameDetailState,
  loadDeckySteamHuntersEnrichedGameDetail,
} from "./decky-app-services";
import { getCompletionPercent } from "./decky-completion-progress-bar";
import {
  DeckyFullScreenAchievementBrowser,
  matchesAchievementFilter,
  matchesAchievementModeFilter,
  type AchievementFilter,
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
import { DeckySteamHuntersCommunitySection } from "./decky-steam-hunters-game-sections";
import { buildDeckySteamHuntersGameViewModel } from "./decky-steam-hunters-view-model";
import { shouldRenderAchievementModeFilter } from "./decky-achievement-detail-helpers";
import { sortAchievementsForDisplay } from "./decky-game-detail-ordering";
import { findDeckyScrollableAncestor, TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { STEAM_PROVIDER_ID } from "./providers/steam";
import { getSteamHuntersGameEnrichment } from "../../providers/steamhunters";
import { useSteamGameShoulderNavigation } from "./use-steam-game-shoulder-navigation";
import {
  consumeSteamGameSectionRestoration,
  readSteamGameSectionPageState,
  requestSteamGameSectionRestoration,
  selectSteamAchievementRestorationTarget,
  updateSteamGameSectionPageState,
} from "./decky-steam-game-section-state";

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
            value: totalPlayers,
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
            value: points,
          },
        ]
      : []),
    ...(retroPoints !== undefined
      ? [
          {
            key: "retro-points",
            label: "RetroPoints",
            value: retroPoints,
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
function getFullScreenPageFrameStyle(): CSSProperties {
  return {
    padding: `calc(env(safe-area-inset-top, 0px) + ${FULLSCREEN_GAME_TOP_PADDING}px) 12px calc(env(safe-area-inset-bottom, 0px) + ${FULLSCREEN_GAME_BOTTOM_SCROLL_PADDING}px)`,
    boxSizing: "border-box",
  };
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
    flex: "1 1 auto",
    minHeight: 0,
    // Overview is a single dashboard, not a focus-driven scroll surface.
    overflow: section === "overview" ? "clip" : "hidden auto",
  };
}

function getSteamGameContentFrameStyle(): CSSProperties {
  return {
    padding: `calc(env(safe-area-inset-top, 0px) + ${FULLSCREEN_GAME_TOP_PADDING}px) 12px 0`,
    boxSizing: "border-box",
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
  const [steamFooterHeight, setSteamFooterHeight] = useState(STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX);
  const initialSectionState = providerId !== undefined && gameId !== undefined
    ? readSteamGameSectionPageState(providerId, gameId)
    : undefined;
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>(initialSectionState?.achievements.achievementFilter ?? "all");
  const [achievementModeFilter, setAchievementModeFilter] = useState<AchievementModeFilter>(initialSectionState?.achievements.achievementModeFilter ?? "all");
  const [activeSteamSection, setActiveSteamSection] = useState<DeckySteamGameSectionId>(initialSectionState?.activeSection ?? "overview");
  const [sectionRestoreNonce, setSectionRestoreNonce] = useState(0);
  const [backgroundEnrichment, setBackgroundEnrichment] = useState<{
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
    backgroundEnrichment !== undefined && backgroundEnrichment.sourceSnapshot === loadedSnapshot
      ? backgroundEnrichment.enrichedSnapshot
      : loadedSnapshot;
  const loadedSteamHunters = displayedLoadedSnapshot !== undefined && displayedLoadedSnapshot.game.providerId === STEAM_PROVIDER_ID
    ? getSteamHuntersGameEnrichment(displayedLoadedSnapshot)
    : undefined;
  const loadedSteamHuntersViewModel = buildDeckySteamHuntersGameViewModel({
    achievements: displayedLoadedSnapshot?.achievements ?? [],
    enrichment: loadedSteamHunters,
  });
  const visibleSteamSections = useMemo<readonly DeckySteamGameSection[]>(() => [
    { id: "overview", label: "Overview" },
    { id: "achievements", label: "Achievements" },
    ...(loadedSteamHuntersViewModel?.hasCommunityStats === true
      ? [{ id: "community" as const, label: "Community" }]
      : []),
  ], [loadedSteamHuntersViewModel?.hasCommunityStats]);

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
  useSteamGameShoulderNavigation({
    enabled: displayedLoadedSnapshot?.game.providerId === STEAM_PROVIDER_ID,
    onPreviousSection: () => {
      const currentIndex = visibleSteamSections.findIndex((section) => section.id === activeSteamSection);
      const previousIndex = currentIndex <= 0 ? visibleSteamSections.length - 1 : currentIndex - 1;
      selectSteamSection(visibleSteamSections[previousIndex]?.id ?? "overview");
    },
    onNextSection: () => {
      const currentIndex = visibleSteamSections.findIndex((section) => section.id === activeSteamSection);
      const nextIndex = currentIndex < 0 || currentIndex === visibleSteamSections.length - 1
        ? 0
        : currentIndex + 1;
      selectSteamSection(visibleSteamSections[nextIndex]?.id ?? "overview");
    },
  });

  useEffect(() => {
    if (
      loadedSnapshot === undefined ||
      loadedSnapshot.game.providerId !== STEAM_PROVIDER_ID ||
      getSteamHuntersGameEnrichment(loadedSnapshot) !== undefined
    ) {
      return;
    }

    let cancelled = false;
    void loadDeckySteamHuntersEnrichedGameDetail(loadedSnapshot).then((enrichedSnapshot) => {
      if (!cancelled && getSteamHuntersGameEnrichment(enrichedSnapshot) !== undefined) {
        setBackgroundEnrichment({ sourceSnapshot: loadedSnapshot, enrichedSnapshot });
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
    ? (backgroundEnrichment?.sourceSnapshot === state.data ? backgroundEnrichment.enrichedSnapshot : state.data)
    : undefined;
  const restorationIsSteamProvider = restorationSnapshot?.game.providerId === STEAM_PROVIDER_ID;
  const restorationProviderId = restorationSnapshot === undefined
    ? providerId
    : providerId ?? restorationSnapshot.game.providerId;
  const restorationFilteredAchievements = restorationSnapshot === undefined
    ? []
    : sortAchievementsForDisplay(restorationSnapshot.achievements).filter((achievement) =>
      matchesAchievementFilter(achievement, achievementFilter) &&
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
        visibleAchievementIds: restorationFilteredAchievements.map((achievement) => achievement.achievementId),
      },
    }));
  }, [achievementFilter, achievementModeFilter, restorationFilteredAchievements, restorationIsSteamProvider]);

  useLayoutEffect(() => {
    if (!restorationIsSteamProvider || providerId === undefined || gameId === undefined) {
      return;
    }
    const shouldRestore = sectionRestoreNonce > 0 || consumeSteamGameSectionRestoration(providerId, gameId);
    if (!shouldRestore) {
      return;
    }
    setSectionRestoreNonce(0);
    const currentState = readSteamGameSectionPageState(providerId, gameId);
    const sectionState = currentState[activeSteamSection];
    const frame = globalThis.requestAnimationFrame(() => {
      const anchor = sectionAnchorRef.current;
      const scrollContainer = anchor === null ? null : findDeckyScrollableAncestor(anchor);
      if (scrollContainer !== null) {
        scrollContainer.scrollTop = sectionState.scrollTop;
      }
      if (activeSteamSection !== "achievements") {
        return;
      }
      const targetId = selectSteamAchievementRestorationTarget({
        focusedAchievementId: currentState.achievements.focusedId,
        previousVisibleAchievementIds: currentState.achievements.visibleAchievementIds,
        currentVisibleAchievementIds: restorationFilteredAchievements.map((achievement) => achievement.achievementId),
      });
      const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-achievement-companion-steam-achievement-id]"));
      const target = targets.find((element) => element.dataset["achievementCompanionSteamAchievementId"] === targetId)
        ?? document.querySelector<HTMLElement>("[data-achievement-companion-steam-filter-control='true']");
      target?.focus();
    });
    return () => globalThis.cancelAnimationFrame(frame);
  }, [activeSteamSection, gameId, providerId, restorationFilteredAchievements, restorationIsSteamProvider, sectionRestoreNonce]);

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

  const snapshot =
    backgroundEnrichment?.sourceSnapshot === state.data
      ? backgroundEnrichment.enrichedSnapshot
      : state.data;
  const game = snapshot.game;
  const isSteamProvider = game.providerId === STEAM_PROVIDER_ID;
  const orderedAchievements = sortAchievementsForDisplay(snapshot.achievements);
  const achievementSummary = formatAchievementStatusSummary(orderedAchievements);
  const summary = snapshot.game.summary;
  const providerIdValue = providerId ?? game.providerId;
  const filteredAchievements = orderedAchievements.filter((achievement) =>
    matchesAchievementFilter(achievement, achievementFilter) &&
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
  const steamHuntersEnrichment = isSteamProvider ? getSteamHuntersGameEnrichment(snapshot) : undefined;
  const steamHuntersViewModel = buildDeckySteamHuntersGameViewModel({
    achievements: orderedAchievements,
    enrichment: steamHuntersEnrichment,
  });

  const pageSections = (
    <>
          {isSteamProvider && activeSteamSection === "overview" ? (
            <PanelSectionRow>
              <DeckySteamGameOverview
                game={game}
                achievements={orderedAchievements}
                totalAchievementCount={totalAchievementCount}
                completionPercent={completionPercent}
                steamHuntersEnrichment={steamHuntersEnrichment}
                updatedLabel={`${snapshotSourceLabel} · ${formatTimestamp(refreshTimestamp)}`}
              />
            </PanelSectionRow>
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
                achievementSummary={achievementSummary}
                achievements={achievements}
                providerId={providerIdValue}
                filteredAchievementCount={filteredAchievementCount}
                onAchievementFilterChange={(filter) => {
                  setAchievementFilter(filter);
                }}
                onAchievementModeFilterChange={(filter) => {
                  setAchievementModeFilter(filter);
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
                  ? { steamHuntersAchievementsBySteamAchievementId: steamHuntersEnrichment.achievementsBySteamAchievementId }
                  : {})}
              />
            </PanelSectionRow>
          </PanelSection> : null}

          {isSteamProvider && activeSteamSection === "community" && steamHuntersViewModel !== undefined ? (
            <PanelSection title="Community">
              <PanelSectionRow>
                <DeckySteamHuntersCommunitySection model={steamHuntersViewModel} />
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
            scrollKey={`full-screen-game:${providerId ?? game.providerId}:${game.gameId}`}
          >
            <div ref={sectionAnchorRef} style={getSteamGameContentFrameStyle()}>{pageSections}</div>
          </TopAlignedScrollViewport>
        </div>
        <DeckySteamGameSectionNavigation
          activeSection={activeSteamSection}
          sections={visibleSteamSections}
          onSelectSection={selectSteamSection}
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
