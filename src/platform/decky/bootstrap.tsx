import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEventHandler,
  type RefCallback,
} from "react";
import {
  DropdownItem,
  Focusable,
  NavEntryPositionPreferences,
  type FocusableProps,
  PanelSection,
  PanelSectionRow,
  ToggleField,
  useQuickAccessVisible,
} from "@decky/ui";
import {
  GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_OPTIONS,
  type GamePageAchievementBadgePosition,
} from "@core/settings";
import type { ResourceState } from "@core/cache";
import type { DashboardSnapshot, GameDetailSnapshot, ProviderId } from "@core/domain";
import { PlaceholderState } from "@ui/PlaceholderState";
import { createDeckyNavigationPort } from "./decky-navigation";
import {
  createDeckyPlatform,
  initialDeckyBootstrapState,
  initialDeckyGameDetailState,
  initialDeckySteamHuntersProfileState,
  loadDeckyDashboardState,
  loadDeckyGameDetailState,
  loadDeckySteamHuntersProfileState,
  refreshDeckySteamHuntersProfileState,
} from "./decky-app-services";
import {
  DeckyAchievementDetailView,
  type CompactAchievementTarget,
} from "./decky-achievement-detail-view";
import {
  setDeckyCompactNavigation,
  useDeckyCompactNavigation,
  type DeckyCompactAchievementDestination,
  type DeckyCompactGameDestination,
} from "./decky-compact-navigation";
import { DeckyDashboardView } from "./decky-dashboard-view";
import { DeckyCompactLoadingState } from "./decky-compact-loading-state";
import { DeckyGameDetailView } from "./decky-game-detail-view";
import { DeckyFocusStyles } from "./decky-focus-styles";
import { shouldRefreshDashboardOnEntry } from "./dashboard-refresh";
import { useRetroAchievementsConnectionState } from "./providers/retroachievements/connection";
import { useSteamConnectionState } from "./providers/steam/connection";
import { readDeckySettings, saveDeckySettings, useDeckySettings } from "./decky-settings";
import {
  DeckyCompactPillActionGroup,
  DeckyCompactPillActionItem,
} from "./decky-compact-pill-action-item";
import { dispatchDeckyScrollReset, TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { updateSteamGameSectionPageState } from "./decky-steam-game-section-state";
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
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { readDeckyGamepadNavigationTrees } from "./decky-gamepad-navigation";
import {
  createDeckyProviderInitialFocusAttempt,
  requestDeckyProviderInitialFocus,
  shouldRequestDeckyProviderInitialFocus,
} from "./decky-provider-initial-focus";
interface SteamLibraryScanActionState {
  readonly status: "idle" | "scanning" | "success" | "error";
  readonly message?: string;
}

type ProviderLauncherTone = "connected" | "setup" | "neutral";

const GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_LABELS: Readonly<
  Record<GamePageAchievementBadgePosition, string>
> = {
  "top-left": "Top Left",
  "top-center": "Top Center",
  "top-right": "Top Right",
  "bottom-left": "Bottom Left",
  "bottom-center": "Bottom Center",
  "bottom-right": "Bottom Right",
};

const COMPACT_GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_OPTIONS = [
  "top-left",
  "top-center",
  "top-right",
  // "bottom-left",
  // "bottom-center",
  // "bottom-right",
] as const satisfies readonly GamePageAchievementBadgePosition[];

const GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_DROPDOWN_OPTIONS =
  COMPACT_GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_OPTIONS.map((position) => ({
    data: position,
    label: GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_LABELS[position],
  }));

function isGamePageAchievementBadgePosition(value: unknown): value is GamePageAchievementBadgePosition {
  return (
    typeof value === "string" &&
    GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_OPTIONS.includes(value as GamePageAchievementBadgePosition)
  );
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
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    minWidth: 0,
    minHeight: 62,
    padding: "9px 12px",
    borderRadius: 12,
    border: `1px solid ${
      isFocused
        ? tone === "setup"
          ? "rgba(245, 189, 82, 0.72)"
          : "rgba(125, 190, 255, 0.7)"
        : "rgba(86, 137, 173, 0.24)"
    }`,
    background: isFocused
      ? "linear-gradient(135deg, rgba(7, 78, 129, 0.94), rgba(10, 40, 62, 0.98))"
      : "linear-gradient(135deg, rgba(17, 38, 54, 0.98), rgba(11, 27, 39, 0.98))",
    boxShadow: isFocused
      ? tone === "setup"
        ? "0 0 0 1px rgba(245, 189, 82, 0.5), 0 0 14px rgba(245, 189, 82, 0.28)"
        : "0 0 0 1px rgba(54, 185, 255, 0.8), 0 0 15px rgba(54, 185, 255, 0.45)"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.045)",
    boxSizing: "border-box",
    cursor: "pointer",
    color: "rgba(255, 255, 255, 0.96)",
    transition:
      "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease, color 120ms ease, transform 120ms ease",
  };
}

function getChooserProviderCardSettingsIconStyle(): CSSProperties {
  return {
    width: 40,
    height: 40,
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    background: "rgba(102, 136, 160, 0.16)",
    color: "rgba(187, 211, 229, 0.9)",
    fontSize: 24,
    lineHeight: 1,
  };
}

function getChooserProviderCardBodyStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 3,
    minWidth: 0,
    flex: 1,
    padding: 0,
  };
}

function getChooserProviderCardDetailsStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
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
    width: 40,
    height: 40,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: 10,
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
    minWidth: 0,
    overflow: "visible",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    textOverflow: "clip",
    whiteSpace: "normal",
    fontSize: "0.82em",
    fontWeight: 750,
    lineHeight: 1.2,
  };
}

function getChooserProviderCardStatusStyle(tone: ProviderLauncherTone): CSSProperties {
  const isConfigured = tone === "connected";

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: isConfigured ? "rgba(194, 239, 210, 0.94)" : "rgba(255, 225, 159, 0.96)",
    fontSize: "0.70em",
    fontWeight: 600,
    lineHeight: 1.15,
    whiteSpace: "nowrap",
  };
}

function getChooserProviderCardStatusDotStyle(tone: ProviderLauncherTone): CSSProperties {
  return {
    width: 8,
    height: 8,
    flexShrink: 0,
    borderRadius: 999,
    background: tone === "connected" ? "#4FD17A" : "#F5C542",
    boxShadow: tone === "connected" ? "0 0 7px rgba(79, 209, 122, 0.68)" : "0 0 7px rgba(245, 197, 66, 0.54)",
  };
}

function getChooserProviderCardChevronStyle(tone: ProviderLauncherTone): CSSProperties {
  return {
    flexShrink: 0,
    color: tone === "setup" ? "rgba(245, 197, 66, 0.92)" : "rgba(54, 185, 255, 0.94)",
    fontSize: 28,
    fontWeight: 400,
    lineHeight: 1,
  };
}

function getGamePageBadgeLabelStyle(disabled = false): CSSProperties {
  return {
    color: disabled ? "rgba(125, 171, 198, 0.56)" : "rgba(125, 210, 255, 0.98)",
    fontSize: "0.9em",
    fontWeight: 700,
    lineHeight: 1.2,
  };
}

function getGamePageBadgeDescriptionStyle(disabled = false): CSSProperties {
  return {
    color: disabled ? "rgba(125, 171, 198, 0.42)" : "rgba(159, 204, 231, 0.82)",
    fontSize: "0.8em",
    lineHeight: 1.25,
  };
}

const scrollFocusedLauncherElementIntoView: FocusEventHandler<HTMLElement> = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
};

type DeckyGamepadFocusHandler = NonNullable<FocusableProps["onGamepadFocus"]>;

const scrollFocusedLauncherGamepadElementIntoView: DeckyGamepadFocusHandler = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
};

function ProviderLauncherCard({
  providerId,
  iconSrc,
  label,
  statusLabel,
  connected,
  ariaLabel,
  onClick,
  preferredFocus = false,
  elementRef,
}: {
  readonly providerId: ProviderId | "settings";
  readonly iconSrc: string | undefined;
  readonly label: string;
  readonly connected?: boolean;
  readonly statusLabel?: string;
  readonly ariaLabel: string;
  readonly onClick: () => void;
  readonly preferredFocus?: boolean;
  readonly elementRef?: RefCallback<HTMLDivElement>;
}): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const tone = getChooserProviderLauncherTone(providerId, connected === true);

  return (
    <Focusable
      noFocusRing
      role="button"
      aria-label={ariaLabel}
      tabIndex={0}
      preferredFocus={preferredFocus}
      ref={elementRef}
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
      {iconSrc !== undefined ? (
        <span aria-hidden="true" style={getChooserProviderCardIconFrameStyle(tone)}>
          <img alt="" loading="lazy" src={iconSrc} style={getChooserProviderCardIconStyle()} />
        </span>
      ) : (
        <span aria-hidden="true" style={getChooserProviderCardSettingsIconStyle()}>{"\u2699"}</span>
      )}
      <span style={getChooserProviderCardBodyStyle()}>
        <span style={getChooserProviderCardTitleStyle()}>{label}</span>
        {statusLabel !== undefined ? (
          <span style={getChooserProviderCardDetailsStyle()}>
            <span aria-hidden="true" style={getChooserProviderCardStatusDotStyle(tone)} />
            <span style={getChooserProviderCardStatusStyle(tone)}>{statusLabel}</span>
          </span>
        ) : null}
      </span>
      <span aria-hidden="true" style={getChooserProviderCardChevronStyle(tone)}>{"\u203a"}</span>
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
  onOpenAchievementHistory,
  onOpenCompletionProgress,
  onBackToProviders,
  onOpenSettings,
  isShowingSteamCompactSettings,
  onOpenSteamCompactSettings,
  onCloseSteamCompactSettings,
}: {
  readonly providerId: ProviderId;
  readonly onOpenGameDetail: (providerId: ProviderId, gameId: string, gameTitle: string) => void;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
  readonly onOpenProfile: (providerId: string) => void;
  readonly onOpenAchievementHistory: (providerId: string) => void;
  readonly onOpenCompletionProgress: (providerId: string) => void;
  readonly onBackToProviders: () => void;
  readonly onOpenSettings: () => void;
  readonly isShowingSteamCompactSettings: boolean;
  readonly onOpenSteamCompactSettings: () => void;
  readonly onCloseSteamCompactSettings: () => void;
}): JSX.Element {
  const settings = useDeckySettings();
  const providerConfig = useDeckyProviderConfig(providerId);
  const retroAchievementsConnectionState = useRetroAchievementsConnectionState();
  const steamConnectionState = useSteamConnectionState();
  const quickAccessVisible = useQuickAccessVisible();
  const [dashboardRefreshNonce, setDashboardRefreshNonce] = useState(0);
  const [steamLibraryScanState, setSteamLibraryScanState] = useState<SteamLibraryScanActionState>({
    status: "idle",
  });
  // A compact Steam visit mirrors the full-screen profile's fresh account
  // boundary. Cached dashboard data remains available to other surfaces, but
  // this view waits for the new bounded Steam and SteamHunters results.
  const dashboardForceRefreshNextLoad = useRef(providerId === STEAM_PROVIDER_ID);
  const steamHuntersForceRefreshNextLoad = useRef(providerId === STEAM_PROVIDER_ID);
  const previousQuickAccessVisible = useRef(quickAccessVisible);
  const dashboardPreferences = useMemo(
    () => resolveProviderDashboardPreferences(providerConfig, settings),
    [providerConfig, settings],
  );
  const steamLibraryAchievementScanSummary = useDeckySteamLibraryAchievementScanOverview(providerId);
  const dashboardIncludesPlayedFreeGames = providerId === STEAM_PROVIDER_ID
    ? (providerConfig as SteamProviderConfig | undefined)?.includePlayedFreeGames ?? false
    : false;
  const dashboardSettingsSignature = `${providerId}:${dashboardPreferences.recentAchievementsCount}:${dashboardPreferences.recentlyPlayedCount}:${dashboardIncludesPlayedFreeGames}`;
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
  const steamId = providerId === STEAM_PROVIDER_ID
    ? (providerConfig as SteamProviderConfig | undefined)?.steamId64.trim()
    : undefined;
  const steamHuntersProfileLoader = useMemo(
    () => () => {
      if (steamId === undefined || steamId.length === 0) {
        return Promise.resolve(initialDeckySteamHuntersProfileState);
      }

      const forceRefresh = steamHuntersForceRefreshNextLoad.current;
      steamHuntersForceRefreshNextLoad.current = false;
      return forceRefresh
        ? refreshDeckySteamHuntersProfileState(steamId)
        : loadDeckySteamHuntersProfileState(steamId);
    },
    [dashboardRefreshNonce, steamId],
  );
  const steamHuntersProfileState = useAsyncResourceState(
    steamHuntersProfileLoader,
    initialDeckySteamHuntersProfileState,
  );
  const steamHuntersProfile = steamHuntersProfileState.data?.steamId === steamId
    ? steamHuntersProfileState.data
    : undefined;
  const isSteamCompactProfileLoading =
    providerId === STEAM_PROVIDER_ID &&
    state.status !== "error" &&
    (!isRenderableDashboardState(state) ||
      state.isRefreshing === true ||
      steamHuntersProfileState.status === "idle" ||
      steamHuntersProfileState.status === "loading" ||
      steamHuntersProfileState.status === "refreshing");
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

  return isRenderableDashboardState(visibleState) && !isSteamCompactProfileLoading ? (
    <DeckyDashboardView
      state={visibleState}
      {...(steamLibraryAchievementScanSummary !== undefined
        ? { steamLibraryAchievementScanSummary }
        : {})}
      onBackToProviders={onBackToProviders}
      onOpenSettings={onOpenSettings}
      isShowingSteamCompactSettings={isShowingSteamCompactSettings}
      onOpenSteamCompactSettings={onOpenSteamCompactSettings}
      onCloseSteamCompactSettings={onCloseSteamCompactSettings}
      onRefreshDashboard={() => {
        requestDashboardReload(true);
      }}
      {...(providerId === "retroachievements"
        ? {
            retroAchievementsConnectionState,
            onUpdateRetroAchievementsCredentials: onOpenSettings,
          }
        : {})}
      {...(providerId === "steam" ? { steamConnectionState, onUpdateSteamCredentials: onOpenSettings } : {})}
      onOpenGameDetail={onOpenGameDetail}
      onOpenAchievementDetail={onOpenAchievementDetail}
      onOpenProfile={onOpenProfile}
      onOpenAchievementHistory={onOpenAchievementHistory}
      onOpenCompletionProgress={onOpenCompletionProgress}
      {...(steamHuntersProfile !== undefined ? { steamHuntersProfile } : {})}
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
  ) : providerId === STEAM_PROVIDER_ID ? (
    <DeckyCompactLoadingState
      description={state.error?.userMessage ?? "Fetching the latest Steam profile and SteamHunters data."}
      isError={state.status === "error"}
      title={state.status === "error" ? "Steam profile unavailable" : "Loading Steam profile..."}
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
  game,
  onOpenFullScreenGame,
  onOpenFullScreenAchievements,
  onBackToDashboard,
  onOpenAchievementDetail,
  onRequestScrollReset,
  scrollResetNonce,
}: {
  readonly game: DeckyCompactGameDestination;
  readonly onOpenFullScreenGame: (game: DeckyCompactGameDestination) => void;
  readonly onOpenFullScreenAchievements: (game: DeckyCompactGameDestination) => void;
  readonly onBackToDashboard: () => void;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
  readonly onRequestScrollReset: () => void;
  readonly scrollResetNonce: number;
}): JSX.Element {
  const loadSelectedGameDetail = useMemo(
    () => () => loadGameDetailState(game.providerId, game.gameId),
    [game.gameId, game.providerId],
  );
  const loader = useAsyncResourceState(loadSelectedGameDetail, initialDeckyGameDetailState);

  return (
    <TopAlignedScrollViewport
      resetNonce={scrollResetNonce}
      scrollKey={`game-detail:${game.providerId}:${game.gameId}`}
    >
      {isRenderableGameDetailState(loader) ? (
        <DeckyGameDetailView
          onBackToDashboard={onBackToDashboard}
          onOpenAchievementDetail={onOpenAchievementDetail}
          onOpenFullScreenPage={
            platform.navigation !== undefined
              ? () => {
                  onRequestScrollReset();
                  onOpenFullScreenGame(game);
                }
              : undefined
          }
          onOpenFullScreenAchievements={
            platform.navigation !== undefined && game.providerId === STEAM_PROVIDER_ID
              ? () => {
                  onRequestScrollReset();
                  onOpenFullScreenAchievements(game);
                }
              : undefined
          }
          state={loader}
        />
      ) : game.providerId === STEAM_PROVIDER_ID ? (
        <DeckyCompactLoadingState
          description={loader.error?.userMessage ?? "Fetching the latest Steam game and SteamHunters data."}
          isError={loader.status === "error"}
          title={loader.status === "error" ? "Steam game unavailable" : `Loading ${game.gameTitle}...`}
        />
      ) : (
        <PlaceholderState
          title={game.gameTitle}
          description="Loading game details from the selected provider."
          state={loader}
          footer={<span>Use Back to return to the dashboard while the detail view loads.</span>}
        />
      )}
    </TopAlignedScrollViewport>
  );
}

function CompactAchievementDetailScreen({
  destination,
  onBack,
  onOpenFullScreenGame,
}: {
  readonly destination: DeckyCompactAchievementDestination;
  readonly onBack: () => void;
  readonly onOpenFullScreenGame: () => void;
}): JSX.Element {
  const loadAchievementGameDetail = useMemo(
    () => () => loadGameDetailState(destination.providerId, destination.gameId),
    [destination.gameId, destination.providerId],
  );
  const loader = useAsyncResourceState(loadAchievementGameDetail, initialDeckyGameDetailState);
  const target = isRenderableGameDetailState(loader)
    ? (() => {
        const achievement = loader.data.achievements.find(
          (candidate) => candidate.achievementId === destination.achievementId,
        );
        return achievement === undefined
          ? undefined
          : {
              game: {
                providerId: loader.data.game.providerId,
                gameId: loader.data.game.gameId,
                title: loader.data.game.title,
                platformLabel: loader.data.game.platformLabel,
                coverImageUrl: loader.data.game.coverImageUrl,
                metrics: loader.data.game.metrics,
              },
              achievement,
            } satisfies CompactAchievementTarget;
      })()
    : undefined;

  return (
    <TopAlignedScrollViewport
      key={`achievement:${destination.providerId}:${destination.gameId}:${destination.achievementId}`}
      scrollKey={`achievement:${destination.providerId}:${destination.gameId}:${destination.achievementId}`}
    >
      {target !== undefined ? (
        <DeckyAchievementDetailView
          target={target}
          onBack={onBack}
          onOpenFullScreenGame={platform.navigation === undefined ? undefined : onOpenFullScreenGame}
        />
      ) : (
        <PlaceholderState
          title="Achievement"
          description="Loading achievement details from the selected provider."
          state={loader}
          footer={<span>Use Back to return to the previous compact view while details load.</span>}
        />
      )}
    </TopAlignedScrollViewport>
  );
}

function DeckyBootstrapStateBridge(): JSX.Element {
  const providerConfigs = useDeckyProviderConfigs();
  const settings = useDeckySettings();
  const compactNavigation = useDeckyCompactNavigation();
  const [detailScrollResetNonce, setDetailScrollResetNonce] = useState(0);
  const providerInitialFocusTargetRef = useRef<HTMLDivElement | null>(null);
  const initialProviderFocusRequested = useRef(shouldRequestDeckyProviderInitialFocus(compactNavigation));
  const providerConfigsSignature = `${providerConfigs.retroAchievements?.username ?? ""}:${providerConfigs.retroAchievements?.hasApiKey ? 1 : 0}:${providerConfigs.steam?.steamId64 ?? ""}:${providerConfigs.steam?.hasApiKey ? 1 : 0}`;
  const enabledProviders = useMemo(() => getDeckyProviderOptions(providerConfigs), [providerConfigs]);
  const visibleProviders = useMemo(
    () => enabledProviders.filter((provider) => provider.enabled),
    [enabledProviders],
  );
  const selectedProviderId = compactNavigation.kind === "provider-dashboard" || compactNavigation.kind === "settings"
    ? compactNavigation.providerId
    : undefined;
  const setupProviderId = compactNavigation.kind === "provider-setup"
    ? compactNavigation.providerId
    : undefined;
  const selectedGame = compactNavigation.kind === "game" ? compactNavigation : undefined;
  const selectedAchievement = compactNavigation.kind === "achievement" ? compactNavigation : undefined;
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

  const setProviderInitialFocusTarget = useCallback((node: HTMLDivElement | null) => {
    providerInitialFocusTargetRef.current = node;
  }, []);

  useLayoutEffect(() => {
    if (!initialProviderFocusRequested.current || providerInitialFocusTargetRef.current === null) {
      return;
    }

    const attempt = createDeckyProviderInitialFocusAttempt({
      requestAnimationFrame: window.requestAnimationFrame.bind(window),
      cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
      requestFocus: (target) => requestDeckyProviderInitialFocus(target, {
        getNavigationTrees: readDeckyGamepadNavigationTrees,
      }),
    });
    attempt.start(providerInitialFocusTargetRef.current);

    return () => {
      attempt.cancel();
    };
  }, []);

  const openProviderFullScreenView = useCallback((
    providerId: string,
    view: "profile" | "achievement-history" | "completion-progress",
  ) => {
    dispatchDeckyScrollReset("dashboard");
    void platform.navigation?.go({
      view,
      providerId,
      surface: "full-screen",
    });
  }, []);

  useEffect(() => {
    const previousSignature = lastProviderConfigsSignature.current;
    lastProviderConfigsSignature.current = providerConfigsSignature;

    if (previousSignature === undefined || previousSignature === providerConfigsSignature) {
      return;
    }

    setDeckyCompactNavigation({ kind: "provider-chooser" });
  }, [providerConfigsSignature]);

  useEffect(() => {
    if (setupProviderId === undefined || setupProviderConfig === undefined) {
      return;
    }

    setDeckyCompactNavigation({ kind: "provider-dashboard", providerId: setupProviderId });
  }, [setupProviderConfig, setupProviderId]);

  useEffect(() => {
    if (selectedProviderId === undefined || selectedProviderConfig !== undefined) {
      return;
    }

    setDeckyCompactNavigation({ kind: "provider-chooser" });
  }, [selectedProviderConfig, selectedProviderId]);

  if (setupProviderId !== undefined) {
    return (
      <TopAlignedScrollViewport scrollKey="setup">
        <DeckyFirstRunSetupScreen
          providerId={setupProviderId}
          onBackToProviders={() => {
            setDeckyCompactNavigation({ kind: "provider-chooser" });
          }}
        />
      </TopAlignedScrollViewport>
    );
  }

  return (
    <>
      {selectedAchievement !== undefined ? (
        <CompactAchievementDetailScreen
          destination={selectedAchievement}
          onBack={() => {
            setDeckyCompactNavigation(
              selectedAchievement.parent === "game"
                ? {
                    kind: "game",
                    providerId: selectedAchievement.providerId,
                    gameId: selectedAchievement.gameId,
                    gameTitle: selectedAchievement.gameTitle,
                  }
                : { kind: "provider-dashboard", providerId: selectedAchievement.providerId },
            );
          }}
          onOpenFullScreenGame={() => {
            void platform.navigation?.go({
              view: "game",
              providerId: selectedAchievement.providerId,
              gameId: selectedAchievement.gameId,
              surface: "full-screen",
            });
          }}
        />
      ) : selectedGame !== undefined ? (
        <>
          <GameDetailScreen
            key={`${selectedGame.providerId}:${selectedGame.gameId}`}
            game={selectedGame}
            onOpenFullScreenGame={(game) => {
              void platform.navigation?.go({
                view: "game",
                providerId: game.providerId,
                gameId: game.gameId,
                surface: "full-screen",
              });
            }}
            onOpenFullScreenAchievements={(game) => {
              updateSteamGameSectionPageState(game.providerId, game.gameId, (current) => ({
                ...current,
                activeSection: "achievements",
                achievements: {
                  ...current.achievements,
                  scrollTop: 0,
                },
              }));
              void platform.navigation?.go({
                view: "game",
                providerId: game.providerId,
                gameId: game.gameId,
                surface: "full-screen",
              });
            }}
            onBackToDashboard={() => {
              setDeckyCompactNavigation({
                kind: "provider-dashboard",
                providerId: selectedGame.providerId,
              });
            }}
            onOpenAchievementDetail={(target) => {
              setDeckyCompactNavigation({
                kind: "achievement",
                providerId: target.game.providerId,
                gameId: target.game.gameId,
                achievementId: target.achievement.achievementId,
                gameTitle: target.game.title,
                parent: "game",
              });
            }}
            onRequestScrollReset={() => {
              setDetailScrollResetNonce((value) => value + 1);
            }}
            scrollResetNonce={detailScrollResetNonce}
          />
        </>
  ) : (
        <>
          {selectedProviderId === undefined ? (
            <TopAlignedScrollViewport scrollKey="providers">
              <>
                <PanelSection>
                  <PanelSectionRow>
                    <Focusable
                      navEntryPreferPosition={NavEntryPositionPreferences.PREFERRED_CHILD}
                      preferredFocus
                      style={getChooserProviderListStyle()}
                    >
                      {visibleProviders.map((provider, index) => (
                        <ProviderLauncherCard
                          key={provider.id}
                          providerId={provider.id}
                          iconSrc={provider.iconSrc}
                          label={provider.label}
                          connected={provider.connected}
                          ariaLabel={
                            provider.connected
                              ? `${provider.label} provider, configured`
                              : `${provider.label} provider, needs setup`
                          }
                          statusLabel={provider.connected ? "Configured" : "Set up"}
                          preferredFocus={index === 0}
                          {...(index === 0 ? { elementRef: setProviderInitialFocusTarget } : {})}
                          onClick={() => {
                            if (!provider.enabled) {
                              return;
                            }

                            if (
                              (provider.id === "retroachievements" && providerConfigs.retroAchievements === undefined) ||
                              (provider.id === "steam" && providerConfigs.steam === undefined)
                            ) {
                              setDeckyCompactNavigation({ kind: "provider-setup", providerId: provider.id });
                              return;
                            }

                            setDeckyCompactNavigation({ kind: "provider-dashboard", providerId: provider.id });
                          }}
                        />
                      ))}
                      <ProviderLauncherCard
                        providerId="settings"
                        iconSrc={undefined}
                        label="Provider Settings"
                        ariaLabel="Open provider settings"
                        preferredFocus={visibleProviders.length === 0}
                        {...(visibleProviders.length === 0 ? { elementRef: setProviderInitialFocusTarget } : {})}
                        onClick={() => {
                          void platform.navigation?.go({
                            view: "settings",
                            surface: "full-screen",
                          });
                        }}
                      />
                    </Focusable>
                  </PanelSectionRow>
                </PanelSection>

                <PanelSection title="Game Page Badge">
                  <PanelSectionRow>
                    <ToggleField
                      label={<span style={getGamePageBadgeLabelStyle()}>Show game page badge</span>}
                      description={
                        <span style={getGamePageBadgeDescriptionStyle()}>
                          Show achievement progress on Steam and non-Steam game pages.
                        </span>
                      }
                      checked={settings.showGamePageAchievementBadge}
                      highlightOnFocus
                      onChange={(showGamePageAchievementBadge) => {
                        void saveDeckySettings({
                          ...readDeckySettings(),
                          showGamePageAchievementBadge,
                        });
                      }}
                    />
                  </PanelSectionRow>

                  <DropdownItem
                    label={
                      <span style={getGamePageBadgeLabelStyle(!settings.showGamePageAchievementBadge)}>
                        Badge position
                      </span>
                    }
                    description={
                      <span style={getGamePageBadgeDescriptionStyle(!settings.showGamePageAchievementBadge)}>
                        Choose where the game page badge is anchored.
                      </span>
                    }
                    disabled={!settings.showGamePageAchievementBadge}
                    menuLabel="Game Page Badge Position"
                    rgOptions={GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_DROPDOWN_OPTIONS}
                    selectedOption={settings.gamePageAchievementBadgePosition}
                    onChange={(option) => {
                      if (!isGamePageAchievementBadgePosition(option.data)) {
                        return;
                      }

                      void saveDeckySettings({
                        ...readDeckySettings(),
                        gamePageAchievementBadgePosition: option.data,
                      });
                    }}
                  />
                </PanelSection>
              </>
            </TopAlignedScrollViewport>
          ) : (
            <TopAlignedScrollViewport scrollKey="dashboard">
              <DashboardScreen
                providerId={selectedProviderId}
                onBackToProviders={() => {
                  setDeckyCompactNavigation({ kind: "provider-chooser" });
                  dispatchDeckyScrollReset("providers");
                }}
                onOpenSettings={() => {
                  void platform.navigation?.go({
                    view: "settings",
                    surface: "full-screen",
                  });
                }}
                isShowingSteamCompactSettings={compactNavigation.kind === "settings"}
                onOpenSteamCompactSettings={() => {
                  setDeckyCompactNavigation({ kind: "settings", providerId: STEAM_PROVIDER_ID });
                }}
                onCloseSteamCompactSettings={() => {
                  setDeckyCompactNavigation({ kind: "provider-dashboard", providerId: STEAM_PROVIDER_ID });
                }}
                onOpenGameDetail={(providerId, gameId, gameTitle) => {
                  setDeckyCompactNavigation({
                    kind: "game",
                    providerId,
                    gameId,
                    gameTitle,
                  });
                }}
                onOpenAchievementDetail={(target) => {
                  setDeckyCompactNavigation({
                    kind: "achievement",
                    providerId: target.game.providerId,
                    gameId: target.game.gameId,
                    achievementId: target.achievement.achievementId,
                    gameTitle: target.game.title,
                    parent: "provider-dashboard",
                  });
                }}
                onOpenProfile={(providerId) => {
                  openProviderFullScreenView(providerId, "profile");
                }}
                onOpenAchievementHistory={(providerId) => {
                  openProviderFullScreenView(providerId, "achievement-history");
                }}
                onOpenCompletionProgress={(providerId) => {
                  openProviderFullScreenView(providerId, "completion-progress");
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
  useEffect(() => {
    console.debug("[Achievement Companion] Decky bootstrap mounted");
  }, []);

  return (
    <>
      <DeckyFocusStyles />
      <DeckyBootstrapStateBridge />
    </>
  );
}

export default DeckyBootstrap;
