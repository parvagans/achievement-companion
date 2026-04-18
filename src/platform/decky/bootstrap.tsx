import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PanelSection, PanelSectionRow, useQuickAccessVisible } from "@decky/ui";
import type { ResourceState } from "@core/cache";
import type { DashboardSnapshot, GameDetailSnapshot, ProviderId } from "@core/domain";
import { PlaceholderState } from "@ui/PlaceholderState";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";
import { createDeckyNavigationPort } from "./decky-navigation";
import {
  createDeckyPlatform,
  initialDeckyBootstrapState,
  initialDeckyGameDetailState,
  loadDeckyDashboardState,
  loadDeckyGameDetailState,
} from "./decky-app-services";
import {
  DeckyAchievementDetailView,
  type CompactAchievementTarget,
} from "./decky-achievement-detail-view";
import { DeckyDashboardView } from "./decky-dashboard-view";
import { DeckyGameDetailView } from "./decky-game-detail-view";
import { DeckyFocusStyles } from "./decky-focus-styles";
import { useDeckySettings } from "./decky-settings";
import {
  DeckyCompactPillActionGroup,
  DeckyCompactPillActionItem,
} from "./decky-compact-pill-action-item";
import { dispatchDeckyScrollReset, TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { getDeckyProviderOptions } from "./providers";
import { useDeckyProviderConfig } from "./providers/retroachievements/config";
import { DeckyFirstRunSetupScreen } from "./providers/retroachievements/setup-screen";
interface SelectedGame {
  readonly providerId: ProviderId;
  readonly gameId: string;
  readonly gameTitle: string;
}

function getChooserCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    boxSizing: "border-box",
  };
}

function getChooserHeaderStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "0.72em",
    fontWeight: 700,
    letterSpacing: "0.06em",
    lineHeight: 1.2,
    textTransform: "uppercase",
  };
}

function getChooserTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1.08em",
    fontWeight: 750,
    lineHeight: 1.15,
  };
}

function getChooserSupportStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.88em",
    lineHeight: 1.35,
  };
}

function getChooserStatusStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.82em",
    lineHeight: 1.2,
    textAlign: "center",
  };
}

function getChooserPillRowStyle(): CSSProperties {
  return {
    display: "grid",
    placeItems: "center",
    width: "100%",
    minWidth: 0,
  };
}

function getChooserPillGroupStyle(): CSSProperties {
  return {
    display: "inline-flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    marginInline: "auto",
    gap: "8px 10px",
  };
}

const platform = createDeckyPlatform(createDeckyNavigationPort());
const DASHBOARD_STALE_AFTER_MS = 3 * 60 * 1000;
let lastDeckyDashboardSettingsSignature: string | undefined;

function loadDashboardState(
  providerId: ProviderId,
  options?: {
    readonly forceRefresh?: boolean;
  },
): Promise<ResourceState<DashboardSnapshot>> {
  return loadDeckyDashboardState(providerId, options);
}

function loadGameDetailState(providerId: ProviderId, gameId: string): Promise<ResourceState<GameDetailSnapshot>> {
  return loadDeckyGameDetailState(providerId, gameId);
}

function isRenderableDashboardState(
  state: ResourceState<DashboardSnapshot>,
): state is ResourceState<DashboardSnapshot> & { readonly data: DashboardSnapshot } {
  return (state.status === "success" || state.status === "stale") && state.data !== undefined;
}

function isRenderableGameDetailState(
  state: ResourceState<GameDetailSnapshot>,
): state is ResourceState<GameDetailSnapshot> & { readonly data: GameDetailSnapshot } {
  return (state.status === "success" || state.status === "stale") && state.data !== undefined;
}

function DashboardScreen({
  providerId,
  onOpenGameDetail,
  onOpenAchievementDetail,
  onOpenProfile,
  onOpenSettings,
}: {
  readonly providerId: ProviderId;
  readonly onOpenGameDetail: (providerId: ProviderId, gameId: string, gameTitle: string) => void;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
  readonly onOpenProfile: (providerId: string) => void;
  readonly onOpenSettings: () => void;
}): JSX.Element {
  const settings = useDeckySettings();
  const quickAccessVisible = useQuickAccessVisible();
  const [dashboardRefreshNonce, setDashboardRefreshNonce] = useState(0);
  const dashboardForceRefreshNextLoad = useRef(false);
  const previousQuickAccessVisible = useRef(quickAccessVisible);
  const dashboardSettingsSignature = `${settings.recentAchievementsCount}:${settings.recentlyPlayedCount}`;
  const requestDashboardReload = useCallback((forceRefresh: boolean) => {
    if (forceRefresh) {
      dashboardForceRefreshNextLoad.current = true;
    }

    setDashboardRefreshNonce((value) => value + 1);
  }, []);
  const dashboardLoader = useMemo(
    () => () => {
      const forceRefresh = dashboardForceRefreshNextLoad.current;
      dashboardForceRefreshNextLoad.current = false;

      return loadDashboardState(providerId, {
        forceRefresh,
      });
    },
    [dashboardRefreshNonce, providerId],
  );
  const state = useAsyncResourceState(dashboardLoader, initialDeckyBootstrapState);

  useEffect(() => {
    const previousSettingsSignature = lastDeckyDashboardSettingsSignature;
    lastDeckyDashboardSettingsSignature = dashboardSettingsSignature;

    if (previousSettingsSignature === undefined || previousSettingsSignature === dashboardSettingsSignature) {
      return;
    }

    requestDashboardReload(true);
  }, [dashboardSettingsSignature, requestDashboardReload]);

  useEffect(() => {
    const becameVisible = quickAccessVisible && !previousQuickAccessVisible.current;
    previousQuickAccessVisible.current = quickAccessVisible;

    if (!becameVisible) {
      return;
    }

    if (!isRenderableDashboardState(state)) {
      requestDashboardReload(true);
      return;
    }

    const refreshedAt = state.data.refreshedAt;
    if (refreshedAt !== undefined && Date.now() - refreshedAt >= DASHBOARD_STALE_AFTER_MS) {
      requestDashboardReload(true);
    }
  }, [quickAccessVisible, requestDashboardReload, state]);

  const visibleState = useMemo(() => {
    if (!isRenderableDashboardState(state)) {
      return state;
    }

    return {
      ...state,
      data: {
        ...state.data,
        recentAchievements: state.data.recentAchievements.slice(0, settings.recentAchievementsCount),
        recentUnlocks: state.data.recentUnlocks.slice(0, settings.recentAchievementsCount),
        recentlyPlayedGames: state.data.recentlyPlayedGames.slice(0, settings.recentlyPlayedCount),
      },
    };
  }, [settings.recentAchievementsCount, settings.recentlyPlayedCount, state]);

  return isRenderableDashboardState(visibleState) ? (
    <DeckyDashboardView
      state={visibleState}
      onOpenSettings={onOpenSettings}
      onRefreshDashboard={() => {
        requestDashboardReload(true);
      }}
      onOpenGameDetail={onOpenGameDetail}
      onOpenAchievementDetail={onOpenAchievementDetail}
      onOpenProfile={onOpenProfile}
    />
  ) : (
    <PlaceholderState
      title="Achievement Companion"
      description="Loading your selected provider dashboard."
      state={visibleState}
      footer={
        <span>The compact panel will show your overview, recent achievements, and recently played games when data is ready.</span>
      }
    />
  );
}

function GameDetailScreen({
  selectedGame,
  onBackToDashboard,
  onOpenAchievementDetail,
  onRequestScrollReset,
  scrollResetNonce,
}: {
  readonly selectedGame: SelectedGame;
  readonly onBackToDashboard: () => void;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
  readonly onRequestScrollReset: () => void;
  readonly scrollResetNonce: number;
}): JSX.Element {
  const loadSelectedGameDetail = useMemo(
    () => () => loadGameDetailState(selectedGame.providerId, selectedGame.gameId),
    [selectedGame.gameId, selectedGame.providerId],
  );
  const loader = useAsyncResourceState(loadSelectedGameDetail, initialDeckyGameDetailState);

  return (
    <TopAlignedScrollViewport
      resetNonce={scrollResetNonce}
      scrollKey={`game-detail:${selectedGame.providerId}:${selectedGame.gameId}`}
    >
      {isRenderableGameDetailState(loader) ? (
        <DeckyGameDetailView
          onBackToDashboard={onBackToDashboard}
          onOpenAchievementDetail={onOpenAchievementDetail}
          onOpenFullScreenPage={
            platform.navigation !== undefined
              ? () => {
                  onRequestScrollReset();
                  void platform.navigation?.go({
                    view: "game",
                    providerId: loader.data.game.providerId,
                    gameId: loader.data.game.gameId,
                    surface: "full-screen",
                  });
                }
              : undefined
          }
          state={loader}
        />
      ) : (
        <PlaceholderState
          title={selectedGame.gameTitle}
          description="Loading game details from the selected provider."
          state={loader}
          footer={<span>Use Back to return to the dashboard while the detail view loads.</span>}
        />
      )}
    </TopAlignedScrollViewport>
  );
}

function DeckyBootstrapStateBridge(): JSX.Element {
  const providerConfig = useDeckyProviderConfig(RETROACHIEVEMENTS_PROVIDER_ID);
  const quickAccessVisible = useQuickAccessVisible();
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId | undefined>(undefined);
  const [setupProviderId, setSetupProviderId] = useState<ProviderId | undefined>(undefined);
  const [selectedGame, setSelectedGame] = useState<SelectedGame | undefined>(undefined);
  const [selectedAchievement, setSelectedAchievement] = useState<CompactAchievementTarget | undefined>(undefined);
  const [detailScrollResetNonce, setDetailScrollResetNonce] = useState(0);
  const enabledProviders = useMemo(() => getDeckyProviderOptions(providerConfig), [providerConfig]);
  const visibleProviders = useMemo(
    () => enabledProviders.filter((provider) => provider.enabled),
    [enabledProviders],
  );

  useEffect(() => {
    if (providerConfig !== undefined) {
      return;
    }

    setSelectedProviderId(undefined);
    setSelectedGame(undefined);
    setSelectedAchievement(undefined);
  }, [providerConfig]);

  useEffect(() => {
    if (providerConfig === undefined || setupProviderId === undefined) {
      return;
    }

    setSelectedProviderId(setupProviderId);
    setSetupProviderId(undefined);
  }, [providerConfig, setupProviderId]);

  useEffect(() => {
    if (selectedProviderId === undefined) {
      return;
    }

    if (visibleProviders.some((provider) => provider.id === selectedProviderId)) {
      return;
    }

    setSelectedProviderId(undefined);
  }, [selectedProviderId, visibleProviders]);

  useEffect(() => {
    if (quickAccessVisible) {
      return;
    }

    setSelectedProviderId(undefined);
    setSetupProviderId(undefined);
    setSelectedGame(undefined);
    setSelectedAchievement(undefined);
  }, [quickAccessVisible]);

  if (setupProviderId !== undefined) {
    return (
      <TopAlignedScrollViewport scrollKey="setup">
        <DeckyFirstRunSetupScreen
          providerId={setupProviderId}
          onBackToProviders={() => {
            setSetupProviderId(undefined);
          }}
        />
      </TopAlignedScrollViewport>
    );
  }

  return (
    <>
      {selectedAchievement !== undefined ? (
        <TopAlignedScrollViewport
          key={`achievement:${selectedAchievement.game.providerId}:${selectedAchievement.game.gameId}:${selectedAchievement.achievement.achievementId}`}
          scrollKey={`achievement:${selectedAchievement.game.providerId}:${selectedAchievement.game.gameId}:${selectedAchievement.achievement.achievementId}`}
        >
          <DeckyAchievementDetailView
            target={selectedAchievement}
            onBack={() => {
              setSelectedAchievement(undefined);
            }}
            onOpenFullScreenGame={
              platform.navigation !== undefined
                ? () => {
                    void platform.navigation?.go({
                      view: "game",
                      providerId: selectedAchievement.game.providerId,
                      gameId: selectedAchievement.game.gameId,
                      surface: "full-screen",
                    });
                  }
                : undefined
            }
          />
        </TopAlignedScrollViewport>
      ) : selectedGame !== undefined ? (
        <GameDetailScreen
          key={`${selectedGame.providerId}:${selectedGame.gameId}`}
          selectedGame={selectedGame}
          onBackToDashboard={() => {
            setSelectedAchievement(undefined);
            setSelectedGame(undefined);
          }}
          onOpenAchievementDetail={(target) => {
            setSelectedAchievement(target);
          }}
          onRequestScrollReset={() => {
            setDetailScrollResetNonce((value) => value + 1);
          }}
          scrollResetNonce={detailScrollResetNonce}
        />
      ) : (
        <>
          {selectedProviderId === undefined ? (
            <TopAlignedScrollViewport scrollKey="providers">
              <PanelSection title="Providers">
                <PanelSectionRow>
                  <div style={getChooserCardStyle()}>
                    <div style={getChooserHeaderStyle()}>Achievement Companion</div>
                    <div style={getChooserTitleStyle()}>Choose a provider</div>
                    <div style={getChooserSupportStyle()}>
                      Select a provider to connect it or open its dashboard.
                    </div>

                    <div style={getChooserPillRowStyle()}>
                      <DeckyCompactPillActionGroup style={getChooserPillGroupStyle()}>
                        {visibleProviders.map((provider) => (
                          <DeckyCompactPillActionItem
                            key={provider.id}
                            iconSrc={provider.iconSrc}
                            iconAlt={provider.label}
                            label={provider.label}
                            selected={provider.connected}
                            ariaLabel={
                              provider.connected
                                ? `${provider.label} provider, connected`
                                : `${provider.label} provider, not connected`
                            }
                            onClick={() => {
                              if (!provider.enabled) {
                                return;
                              }

                              setSelectedAchievement(undefined);
                              setSelectedGame(undefined);
                              if (providerConfig === undefined) {
                                setSetupProviderId(provider.id);
                                return;
                              }

                              setSetupProviderId(undefined);
                              setSelectedProviderId(provider.id);
                            }}
                          />
                        ))}
                      </DeckyCompactPillActionGroup>
                    </div>

                    <div style={getChooserStatusStyle()}>
                      {providerConfig !== undefined ? "Connected" : "Not connected"}
                    </div>
                  </div>
                </PanelSectionRow>
              </PanelSection>
            </TopAlignedScrollViewport>
          ) : (
            <TopAlignedScrollViewport scrollKey="dashboard">
              <DashboardScreen
                providerId={selectedProviderId}
                onOpenSettings={() => {
                  void platform.navigation?.go({
                    view: "settings",
                    surface: "full-screen",
                  });
                }}
                onOpenGameDetail={(providerId, gameId, gameTitle) => {
                  setSelectedAchievement(undefined);
                  setSelectedGame({
                    providerId,
                    gameId,
                    gameTitle,
                  });
                }}
                onOpenAchievementDetail={(target) => {
                  setSelectedGame(undefined);
                  setSelectedAchievement(target);
                }}
                onOpenProfile={(providerId) => {
                  setSelectedGame(undefined);
                  setSelectedAchievement(undefined);
                  dispatchDeckyScrollReset("dashboard");
                  void platform.navigation?.go({
                    view: "profile",
                    providerId,
                    surface: "full-screen",
                  });
                }}
              />
            </TopAlignedScrollViewport>
          )}
        </>
      )}
    </>
  );
}

export function DeckyBootstrap(): JSX.Element {
  return (
    <>
      <DeckyFocusStyles />
      <DeckyBootstrapStateBridge />
    </>
  );
}

export default DeckyBootstrap;
