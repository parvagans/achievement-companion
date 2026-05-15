import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PanelSection, PanelSectionRow, useQuickAccessVisible } from "@decky/ui";
import type { ResourceState } from "@core/cache";
import type { DashboardSnapshot, GameDetailSnapshot, ProviderId } from "@core/domain";
import { PlaceholderState } from "@ui/PlaceholderState";
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
import {
  createDeckyFullscreenReturnContextForGame,
  createDeckyFullscreenReturnContextForProviderDashboard,
  clearDeckyFullscreenReturnContext,
  readDeckyFullscreenReturnContext,
  writeDeckyFullscreenReturnContext,
  restoreDeckyFullscreenSelectionFromContext,
  type DeckyFullscreenReturnContext,
} from "./decky-full-screen-return-context";
import {
  markNextFullScreenSettingsBackTarget,
  resolveFullScreenSettingsBackTarget,
} from "./decky-full-screen-navigation-state";
import { shouldRefreshDashboardOnEntry } from "./dashboard-refresh";
import { useDeckySettings } from "./decky-settings";
import {
  DeckyCompactPillActionGroup,
  DeckyCompactPillActionItem,
} from "./decky-compact-pill-action-item";
import { dispatchDeckyScrollReset, TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";
import {
  getDeckyProviderOptions,
  useDeckyProviderConfig,
  useDeckyProviderConfigs,
} from "./providers";
import {
  STEAM_PROVIDER_ID,
  type SteamProviderConfig,
  createDeckySteamLibraryScanDependencies,
  runAndCacheDeckySteamLibraryAchievementScan,
  useDeckySteamLibraryAchievementScanOverview,
} from "./providers/steam";
import { resolveProviderDashboardPreferences } from "@core/provider-dashboard-preferences";
import { DeckyFirstRunSetupScreen } from "./decky-first-run-setup-screen";
interface SelectedGame {
  readonly providerId: ProviderId;
  readonly gameId: string;
  readonly gameTitle: string;
}

interface SteamLibraryScanActionState {
  readonly status: "idle" | "scanning" | "success" | "error";
  readonly message?: string;
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

function getChooserActionRowStyle(): CSSProperties {
  return {
    display: "grid",
    placeItems: "center",
    width: "100%",
    minWidth: 0,
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

function getChooserProviderPillGroupStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    alignItems: "stretch",
    justifyItems: "stretch",
    width: "100%",
    minWidth: 0,
    gap: "8px 10px",
  };
}

function formatSteamLibraryScanUpdatedLabel(scannedAt: string | undefined): string | undefined {
  if (scannedAt === undefined) {
    return undefined;
  }

  const parsed = Date.parse(scannedAt);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  const elapsedMs = Date.now() - parsed;
  const absoluteMs = Math.abs(elapsedMs);
  const formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
  });

  if (absoluteMs < 60_000) {
    const value = Math.max(1, Math.round(absoluteMs / 1000));
    return formatter.format(elapsedMs >= 0 ? -value : value, "second");
  }

  if (absoluteMs < 3_600_000) {
    const value = Math.max(1, Math.round(absoluteMs / 60_000));
    return formatter.format(elapsedMs >= 0 ? -value : value, "minute");
  }

  if (absoluteMs < 86_400_000) {
    const value = Math.max(1, Math.round(absoluteMs / 3_600_000));
    return formatter.format(elapsedMs >= 0 ? -value : value, "hour");
  }

  const value = Math.max(1, Math.round(absoluteMs / 86_400_000));
  return formatter.format(elapsedMs >= 0 ? -value : value, "day");
}

const platform = createDeckyPlatform(createDeckyNavigationPort());
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
  onBackToProviders,
  onOpenSettings,
}: {
  readonly providerId: ProviderId;
  readonly onOpenGameDetail: (providerId: ProviderId, gameId: string, gameTitle: string) => void;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
  readonly onOpenProfile: (providerId: string) => void;
  readonly onBackToProviders: () => void;
  readonly onOpenSettings: () => void;
}): JSX.Element {
  const settings = useDeckySettings();
  const providerConfig = useDeckyProviderConfig(providerId);
  const quickAccessVisible = useQuickAccessVisible();
  const [dashboardRefreshNonce, setDashboardRefreshNonce] = useState(0);
  const [steamLibraryScanState, setSteamLibraryScanState] = useState<SteamLibraryScanActionState>({
    status: "idle",
  });
  const dashboardForceRefreshNextLoad = useRef(false);
  const previousQuickAccessVisible = useRef(quickAccessVisible);
  const dashboardPreferences = useMemo(
    () => resolveProviderDashboardPreferences(providerConfig, settings),
    [providerConfig, settings],
  );
  const steamLibraryAchievementScanSummary = useDeckySteamLibraryAchievementScanOverview(providerId);
  const dashboardSettingsSignature = `${providerId}:${dashboardPreferences.recentAchievementsCount}:${dashboardPreferences.recentlyPlayedCount}`;
  const requestDashboardReload = useCallback((forceRefresh: boolean) => {
    if (forceRefresh) {
      dashboardForceRefreshNextLoad.current = true;
    }

    setDashboardRefreshNonce((value) => value + 1);
  }, []);
  const requestSteamLibraryScan = useCallback(async () => {
    if (providerId !== STEAM_PROVIDER_ID || providerConfig === undefined || steamLibraryScanState.status === "scanning") {
      return;
    }

    const steamProviderConfig = providerConfig as SteamProviderConfig;
    setSteamLibraryScanState({ status: "scanning" });
    try {
      await runAndCacheDeckySteamLibraryAchievementScan(
        steamProviderConfig,
        createDeckySteamLibraryScanDependencies(),
      );
      setSteamLibraryScanState({ status: "success" });
    } catch {
      setSteamLibraryScanState({
        status: "error",
        message: "Steam library scan failed. Try again.",
      });
    }
  }, [providerConfig, providerId, steamLibraryScanState.status]);
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
  const dashboardReentryRefreshKey = `${providerId}:${state.status}:${state.data?.profile.providerId ?? "none"}:${state.error?.kind ?? "none"}:${state.error?.debugMessage ?? "none"}`;
  const lastDashboardReentryRefreshKey = useRef<string | undefined>(undefined);

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

    if (state.status === "success") {
      requestDashboardReload(true);
      return;
    }
  }, [quickAccessVisible, requestDashboardReload, state]);

  useEffect(() => {
    if (!shouldRefreshDashboardOnEntry({ providerId, state })) {
      lastDashboardReentryRefreshKey.current = undefined;
      return;
    }

    if (lastDashboardReentryRefreshKey.current === dashboardReentryRefreshKey) {
      return;
    }

    lastDashboardReentryRefreshKey.current = dashboardReentryRefreshKey;
    requestDashboardReload(true);
  }, [dashboardReentryRefreshKey, providerId, requestDashboardReload, state]);

  const visibleState = useMemo(() => {
    if (!isRenderableDashboardState(state)) {
      return state;
    }

    return {
      ...state,
      data: {
        ...state.data,
        recentAchievements: state.data.recentAchievements.slice(0, dashboardPreferences.recentAchievementsCount),
        recentUnlocks: state.data.recentUnlocks.slice(0, dashboardPreferences.recentAchievementsCount),
        recentlyPlayedGames: state.data.recentlyPlayedGames.slice(0, dashboardPreferences.recentlyPlayedCount),
      },
    };
  }, [dashboardPreferences.recentAchievementsCount, dashboardPreferences.recentlyPlayedCount, state]);

  const steamLibraryScanStatusLabel =
    providerId === STEAM_PROVIDER_ID
      ? steamLibraryScanState.status === "scanning"
        ? "Scanning library… this can take a few minutes"
        : steamLibraryScanState.status === "error"
          ? steamLibraryScanState.message
          : steamLibraryScanState.status === "success"
            ? "Library scan completed just now"
            : steamLibraryAchievementScanSummary !== undefined
              ? `Library scan updated ${formatSteamLibraryScanUpdatedLabel(steamLibraryAchievementScanSummary.scannedAt) ?? "just now"}`
              : "No full-library scan yet"
      : undefined;

  const steamLibraryScanButtonLabel =
    providerId === STEAM_PROVIDER_ID
      ? steamLibraryScanState.status === "scanning"
        ? "Scanning full Steam library…"
        : steamLibraryScanState.status === "success" || steamLibraryScanState.status === "error"
          ? "Scan full Steam library again"
          : steamLibraryAchievementScanSummary !== undefined
            ? "Scan full Steam library again"
            : "Scan full Steam library"
      : undefined;

  return isRenderableDashboardState(visibleState) ? (
    <DeckyDashboardView
      state={visibleState}
      {...(steamLibraryAchievementScanSummary !== undefined
        ? { steamLibraryAchievementScanSummary }
        : {})}
      onBackToProviders={onBackToProviders}
      onOpenSettings={onOpenSettings}
      onRefreshDashboard={() => {
        requestDashboardReload(true);
      }}
      onOpenGameDetail={onOpenGameDetail}
      onOpenAchievementDetail={onOpenAchievementDetail}
      onOpenProfile={onOpenProfile}
      {...(providerId === STEAM_PROVIDER_ID && steamLibraryScanButtonLabel !== undefined && steamLibraryScanStatusLabel !== undefined
        ? {
            steamLibraryScanAction: {
              label: steamLibraryScanButtonLabel,
              statusLabel: steamLibraryScanStatusLabel,
              disabled: providerConfig === undefined || steamLibraryScanState.status === "scanning",
              onClick: requestSteamLibraryScan,
            },
          }
        : {})}
    />
  ) : (
    <PlaceholderState
      title="Achievement Companion"
      description="Loading your selected provider dashboard."
      state={visibleState}
      footer={
        <div style={getChooserActionRowStyle()}>
          <DeckyCompactPillActionGroup style={getChooserPillGroupStyle()}>
            <DeckyCompactPillActionItem
              label="Back"
              ariaLabel="Return to provider chooser"
              onClick={onBackToProviders}
              onCancelButton={onBackToProviders}
            />
            <DeckyCompactPillActionItem
              label="Settings"
              onClick={onOpenSettings}
              onCancelButton={onBackToProviders}
            />
          </DeckyCompactPillActionGroup>
          <span>The compact panel will show your overview, recent achievements, and recently played games when data is ready.</span>
        </div>
      }
    />
  );
}

function GameDetailScreen({
  selectedGame,
  onOpenFullScreenGame,
  onBackToDashboard,
  onOpenAchievementDetail,
  onRequestScrollReset,
  scrollResetNonce,
}: {
  readonly selectedGame: SelectedGame;
  readonly onOpenFullScreenGame: (game: SelectedGame) => void;
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
                  onOpenFullScreenGame(selectedGame);
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
  const providerConfigs = useDeckyProviderConfigs();
  const quickAccessVisible = useQuickAccessVisible();
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId | undefined>(undefined);
  const [setupProviderId, setSetupProviderId] = useState<ProviderId | undefined>(undefined);
  const [selectedGame, setSelectedGame] = useState<SelectedGame | undefined>(undefined);
  const [selectedAchievement, setSelectedAchievement] = useState<CompactAchievementTarget | undefined>(undefined);
  const [detailScrollResetNonce, setDetailScrollResetNonce] = useState(0);
  const [dashboardEntryNonce, setDashboardEntryNonce] = useState(0);
  const [fullscreenReturnContext, setFullscreenReturnContext] = useState<DeckyFullscreenReturnContext | undefined>(
    undefined,
  );
  const providerConfigsSignature = `${providerConfigs.retroAchievements?.username ?? ""}:${providerConfigs.retroAchievements?.hasApiKey ? 1 : 0}:${providerConfigs.steam?.steamId64 ?? ""}:${providerConfigs.steam?.hasApiKey ? 1 : 0}`;
  const enabledProviders = useMemo(() => getDeckyProviderOptions(providerConfigs), [providerConfigs]);
  const visibleProviders = useMemo(
    () => enabledProviders.filter((provider) => provider.enabled),
    [enabledProviders],
  );
  const selectedProviderConfig =
    selectedProviderId === "retroachievements"
      ? providerConfigs.retroAchievements
      : selectedProviderId === "steam"
        ? providerConfigs.steam
        : undefined;
  const setupProviderConfig =
    setupProviderId === "retroachievements"
      ? providerConfigs.retroAchievements
      : setupProviderId === "steam"
        ? providerConfigs.steam
        : undefined;
  const lastProviderConfigsSignature = useRef<string | undefined>(undefined);

  useEffect(() => {
    const previousSignature = lastProviderConfigsSignature.current;
    lastProviderConfigsSignature.current = providerConfigsSignature;

    if (previousSignature === undefined || previousSignature === providerConfigsSignature) {
      return;
    }

    setSelectedProviderId(undefined);
    setSelectedGame(undefined);
    setSelectedAchievement(undefined);
  }, [providerConfigsSignature]);

  useEffect(() => {
    if (setupProviderId === undefined || setupProviderConfig === undefined) {
      return;
    }

    setSelectedProviderId(setupProviderId);
    setSetupProviderId(undefined);
  }, [setupProviderConfig, setupProviderId]);

  useEffect(() => {
    if (selectedProviderId === undefined || selectedProviderConfig !== undefined) {
      return;
    }

    setSelectedProviderId(undefined);
    setSelectedGame(undefined);
    setSelectedAchievement(undefined);
  }, [selectedProviderConfig, selectedProviderId]);

  useEffect(() => {
    const persistedFullscreenReturnContext = readDeckyFullscreenReturnContext();

    if (quickAccessVisible) {
      if (persistedFullscreenReturnContext?.returnRequested === true) {
        const restoredSelection = restoreDeckyFullscreenSelectionFromContext(persistedFullscreenReturnContext);
        setSelectedProviderId(restoredSelection.selectedProviderId);
        setSelectedGame(restoredSelection.selectedGame);
        setSelectedAchievement(undefined);
        setSetupProviderId(undefined);
        setFullscreenReturnContext(undefined);
        clearDeckyFullscreenReturnContext();
      }

      return;
    }

    if (fullscreenReturnContext !== undefined || persistedFullscreenReturnContext !== undefined) {
      return;
    }

    setSelectedProviderId(undefined);
    setSetupProviderId(undefined);
    setSelectedGame(undefined);
    setSelectedAchievement(undefined);
  }, [fullscreenReturnContext, quickAccessVisible]);

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
          onOpenFullScreenGame={(game) => {
            const fullscreenContext = createDeckyFullscreenReturnContextForGame({
              providerId: game.providerId,
              gameId: game.gameId,
              gameTitle: game.gameTitle,
            });
            setFullscreenReturnContext(fullscreenContext);
            writeDeckyFullscreenReturnContext(fullscreenContext);
            void platform.navigation?.go({
              view: "game",
              providerId: game.providerId,
              gameId: game.gameId,
              surface: "full-screen",
            });
          }}
          onBackToDashboard={() => {
            setSelectedAchievement(undefined);
            setSelectedGame(undefined);
            setFullscreenReturnContext(undefined);
            clearDeckyFullscreenReturnContext();
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
                      <DeckyCompactPillActionGroup style={getChooserProviderPillGroupStyle()}>
                        {visibleProviders.map((provider) => (
                          <DeckyCompactPillActionItem
                            key={provider.id}
                            iconSrc={provider.iconSrc}
                            iconAlt={provider.label}
                            label={provider.label}
                            stretch
                            ariaLabel={
                              provider.connected
                                ? `${provider.label} provider, connected`
                                : `${provider.label} provider, not connected`
                            }
                            statusLabel={provider.connected ? "Connected" : undefined}
                          onClick={() => {
                            if (!provider.enabled) {
                              return;
                            }

                            setSelectedAchievement(undefined);
                            setSelectedGame(undefined);
                            setFullscreenReturnContext(undefined);
                            clearDeckyFullscreenReturnContext();
                          if (
                            (provider.id === "retroachievements" && providerConfigs.retroAchievements === undefined) ||
                            (provider.id === "steam" && providerConfigs.steam === undefined)
                          ) {
                            setSetupProviderId(provider.id);
                                return;
                              }

                              setSetupProviderId(undefined);
                              setSelectedProviderId(provider.id);
                              setDashboardEntryNonce((value) => value + 1);
                            }}
                          />
                        ))}
                      </DeckyCompactPillActionGroup>
                    </div>

                    <div style={getChooserActionRowStyle()}>
                      <DeckyCompactPillActionGroup style={getChooserPillGroupStyle()}>
                <DeckyCompactPillActionItem
                  label="Settings"
                  ariaLabel="Open Settings"
                  onClick={() => {
                    markNextFullScreenSettingsBackTarget(
                      resolveFullScreenSettingsBackTarget("compact-panel"),
                    );
                    void platform.navigation?.go({
                      view: "settings",
                      surface: "full-screen",
                    });
                  }}
                        />
                      </DeckyCompactPillActionGroup>
                    </div>

                    <div style={getChooserStatusStyle()}>
                      {visibleProviders.some((provider) => provider.connected) ? "Connected" : "Not connected"}
                    </div>
                  </div>
                </PanelSectionRow>
              </PanelSection>
            </TopAlignedScrollViewport>
          ) : (
            <TopAlignedScrollViewport scrollKey="dashboard">
              <DashboardScreen
                key={`${selectedProviderId}:${dashboardEntryNonce}`}
                providerId={selectedProviderId}
                onBackToProviders={() => {
                  setSelectedAchievement(undefined);
                  setSelectedGame(undefined);
                  setSelectedProviderId(undefined);
                  setFullscreenReturnContext(undefined);
                  clearDeckyFullscreenReturnContext();
                  setDashboardEntryNonce((value) => value + 1);
                  dispatchDeckyScrollReset("providers");
                }}
                onOpenSettings={() => {
                  markNextFullScreenSettingsBackTarget(
                    resolveFullScreenSettingsBackTarget("compact-panel"),
                  );
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
                  const fullscreenContext = createDeckyFullscreenReturnContextForProviderDashboard(providerId);
                  setFullscreenReturnContext(fullscreenContext);
                  writeDeckyFullscreenReturnContext(fullscreenContext);
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
