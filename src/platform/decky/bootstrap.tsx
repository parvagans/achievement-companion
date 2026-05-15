import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentProps,
  type FocusEventHandler,
} from "react";
import { Focusable, PanelSection, PanelSectionRow, useQuickAccessVisible } from "@decky/ui";
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

type ProviderLauncherTone = "connected" | "setup" | "neutral";

const ACHIEVEMENT_COMPANION_VERSION = "0.2.3";

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

function getChooserVersionStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.44)",
    fontSize: "0.72em",
    fontWeight: 600,
    letterSpacing: "0.03em",
    lineHeight: 1.2,
    textAlign: "center",
  };
}

function getChooserFooterStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    alignItems: "center",
    width: "100%",
    minWidth: 0,
  };
}

function getChooserActionRowStyle(): CSSProperties {
  return {
    display: "flex",
    justifyContent: "center",
    width: "100%",
    minWidth: 0,
  };
}

function getChooserProviderListStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
    width: "100%",
    minWidth: 0,
  };
}

function getChooserProviderLauncherTone(
  providerId: ProviderId | "settings",
  connected: boolean,
): ProviderLauncherTone {
  if (providerId === "settings") {
    return "neutral";
  }

  return connected ? "connected" : "setup";
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

function getChooserProviderCardStyle(
  tone: ProviderLauncherTone,
  isFocused: boolean,
): CSSProperties {
  const accentColor =
    tone === "connected"
      ? "rgba(116, 176, 255, 0.82)"
      : tone === "setup"
        ? "rgba(214, 158, 46, 0.82)"
        : "rgba(255, 255, 255, 0.32)";

  return {
    display: "flex",
    alignItems: "stretch",
    gap: 12,
    width: "100%",
    minWidth: 0,
    padding: "12px 14px 12px 14px",
    borderRadius: 16,
    border: `1px solid ${
      isFocused
        ? tone === "setup"
          ? "rgba(245, 189, 82, 0.72)"
          : "rgba(125, 190, 255, 0.7)"
        : "rgba(255, 255, 255, 0.09)"
    }`,
    background: isFocused
      ? "linear-gradient(180deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.06))"
      : "linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.035))",
    boxShadow: isFocused
      ? tone === "setup"
        ? "0 0 0 1px rgba(245, 189, 82, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 2px 12px rgba(0, 0, 0, 0.24)"
        : "0 0 0 1px rgba(96, 165, 250, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 2px 12px rgba(0, 0, 0, 0.24)"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
    boxSizing: "border-box",
    overflow: "hidden",
    cursor: "pointer",
    color: "rgba(255, 255, 255, 0.96)",
    transition:
      "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease, color 120ms ease, transform 120ms ease",
  };
}

function getChooserProviderCardAccentStyle(tone: ProviderLauncherTone): CSSProperties {
  const accentColor =
    tone === "connected"
      ? "rgba(116, 176, 255, 0.82)"
      : tone === "setup"
        ? "rgba(214, 158, 46, 0.82)"
        : "rgba(255, 255, 255, 0.32)";

  return {
    width: 4,
    flexShrink: 0,
    marginBlock: 8,
    marginInlineStart: 3,
    borderRadius: 999,
    background: accentColor,
    boxShadow: `0 0 0 1px ${accentColor}`,
  };
}

function getChooserProviderCardBodyStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 6,
    minWidth: 0,
    flex: 1,
    padding: "0 0 0 2px",
  };
}

function getChooserProviderCardHeaderStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  };
}

function getChooserProviderCardIconFrameStyle(tone: ProviderLauncherTone): CSSProperties {
  const accentColor =
    tone === "connected"
      ? "rgba(116, 176, 255, 0.24)"
      : tone === "setup"
        ? "rgba(214, 158, 46, 0.24)"
        : "rgba(255, 255, 255, 0.18)";

  return {
    width: 28,
    height: 28,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: 8,
    border: `1px solid ${accentColor}`,
    background: "rgba(255, 255, 255, 0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function getChooserProviderCardIconStyle(): CSSProperties {
  return {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };
}

function getChooserProviderCardTitleStyle(): CSSProperties {
  return {
    flex: "1 1 auto",
    minWidth: 0,
    overflow: "visible",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    textOverflow: "clip",
    whiteSpace: "normal",
    fontSize: "0.98em",
    fontWeight: 750,
    lineHeight: 1.2,
  };
}

function getChooserProviderCardStatusStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.10)",
    background: "rgba(255, 255, 255, 0.07)",
    color: "rgba(255, 255, 255, 0.78)",
    fontSize: "11px",
    fontWeight: 750,
    letterSpacing: "0.04em",
    lineHeight: 1.15,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
}

function getChooserProviderCardStatusStyleForTone(tone: ProviderLauncherTone): CSSProperties {
  const accent =
    tone === "connected"
      ? {
          border: "1px solid rgba(125, 190, 255, 0.46)",
          background: "rgba(96, 165, 250, 0.12)",
          color: "rgba(226, 236, 255, 0.98)",
        }
      : tone === "setup"
        ? {
            border: "1px solid rgba(214, 158, 46, 0.52)",
            background: "rgba(214, 158, 46, 0.14)",
            color: "rgba(255, 244, 201, 0.98)",
          }
        : {
            border: "1px solid rgba(255, 255, 255, 0.10)",
            background: "rgba(255, 255, 255, 0.07)",
            color: "rgba(255, 255, 255, 0.78)",
          };

  return {
    ...getChooserProviderCardStatusStyle(),
    ...accent,
  };
}

const scrollFocusedLauncherElementIntoView: FocusEventHandler<HTMLElement> = (event) => {
  event.currentTarget.scrollIntoView({
    block: "nearest",
    inline: "nearest",
  });
};

type DeckyGamepadFocusHandler = NonNullable<ComponentProps<typeof Focusable>["onGamepadFocus"]>;

const scrollFocusedLauncherGamepadElementIntoView: DeckyGamepadFocusHandler = (event) => {
  const target = event.currentTarget;

  if (target instanceof HTMLElement) {
    target.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }
};

function ProviderLauncherCard({
  providerId,
  iconSrc,
  label,
  statusLabel,
  connected,
  ariaLabel,
  onClick,
}: {
  readonly providerId: ProviderId | "settings";
  readonly iconSrc: string | undefined;
  readonly label: string;
  readonly connected?: boolean;
  readonly statusLabel?: string;
  readonly ariaLabel: string;
  readonly onClick: () => void;
}): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const tone = getChooserProviderLauncherTone(providerId, connected === true);

  return (
    <Focusable
      noFocusRing
      role="button"
      aria-label={ariaLabel}
      tabIndex={0}
      onActivate={onClick}
      onClick={onClick}
      onFocus={(event) => {
        setIsFocused(true);
        scrollFocusedLauncherElementIntoView(event);
      }}
      onGamepadFocus={(event) => {
        setIsFocused(true);
        scrollFocusedLauncherGamepadElementIntoView(event);
      }}
      onBlur={() => {
        setIsFocused(false);
      }}
      style={getChooserProviderCardStyle(tone, isFocused)}
    >
      <span aria-hidden="true" style={getChooserProviderCardAccentStyle(tone)} />
      <span style={getChooserProviderCardBodyStyle()}>
        <span style={getChooserProviderCardHeaderStyle()}>
          {iconSrc !== undefined ? (
            <span aria-hidden="true" style={getChooserProviderCardIconFrameStyle(tone)}>
              <img alt={label} loading="lazy" src={iconSrc} style={getChooserProviderCardIconStyle()} />
            </span>
          ) : null}
          <span style={getChooserProviderCardTitleStyle()}>{label}</span>
        </span>
        {statusLabel !== undefined ? (
          <span style={getChooserProviderCardStatusStyleForTone(tone)}>{statusLabel}</span>
        ) : null}
      </span>
    </Focusable>
  );
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
                      Open a connected dashboard or update provider settings.
                    </div>

                    <div style={getChooserProviderListStyle()}>
                      {visibleProviders.map((provider) => (
                        <ProviderLauncherCard
                          key={provider.id}
                          providerId={provider.id}
                          iconSrc={provider.iconSrc}
                          label={provider.label}
                          connected={provider.connected}
                          ariaLabel={
                            provider.connected
                              ? `${provider.label} provider, connected`
                              : `${provider.label} provider, not connected`
                          }
                          statusLabel={provider.connected ? "CONNECTED" : "SET UP"}
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
                      <ProviderLauncherCard
                        providerId="settings"
                        iconSrc={undefined}
                        label="Provider Settings"
                        ariaLabel="Open provider settings"
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
                    </div>

                    <div style={getChooserFooterStyle()}>
                      {(() => {
                        const connectedCount = visibleProviders.filter((provider) => provider.connected).length;

                        if (connectedCount === 0) {
                          return (
                            <>
                              <div style={getChooserStatusStyle()}>No providers connected</div>
                              <div style={getChooserVersionStyle()}>
                                Achievement Companion v{ACHIEVEMENT_COMPANION_VERSION}
                              </div>
                            </>
                          );
                        }

                        if (connectedCount === 1) {
                          return (
                            <>
                              <div style={getChooserStatusStyle()}>1 provider connected</div>
                              <div style={getChooserVersionStyle()}>
                                Achievement Companion v{ACHIEVEMENT_COMPANION_VERSION}
                              </div>
                            </>
                          );
                        }

                        return (
                          <>
                            <div style={getChooserStatusStyle()}>{`${connectedCount} providers connected`}</div>
                            <div style={getChooserVersionStyle()}>
                              Achievement Companion v{ACHIEVEMENT_COMPANION_VERSION}
                            </div>
                          </>
                        );
                      })()}
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
