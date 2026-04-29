import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ResourceState } from "@core/cache";
import type { DashboardSnapshot } from "@core/domain";
import {
  RETROACHIEVEMENTS_PROVIDER_ID,
} from "../../providers/retroachievements/config";
import { STEAM_PROVIDER_ID } from "../../providers/steam/config";

export type SteamOSDashboardProviderId =
  | typeof RETROACHIEVEMENTS_PROVIDER_ID
  | typeof STEAM_PROVIDER_ID;

export type SteamOSDashboardProviderStatus = "configured" | "not_configured" | "setup_incomplete" | "unavailable";

export interface SteamOSDashboardProviderStatusEntry {
  readonly label: string;
  readonly status: SteamOSDashboardProviderStatus;
}

export interface SteamOSDashboardProviderStatuses {
  readonly retroAchievements: SteamOSDashboardProviderStatusEntry;
  readonly steam: SteamOSDashboardProviderStatusEntry;
}

export type SteamOSDashboardCacheStatus = "setup_required" | "setup_incomplete" | "unavailable" | "not_loaded" | "cached";

export interface SteamOSDashboardProviderState {
  readonly status: SteamOSDashboardCacheStatus;
  readonly snapshot?: DashboardSnapshot;
  readonly errorMessage?: string;
  readonly isRefreshing: boolean;
}

export interface SteamOSDashboardProviderStates {
  readonly retroAchievements: SteamOSDashboardProviderState;
  readonly steam: SteamOSDashboardProviderState;
}

export interface SteamOSDashboardSummaryCard {
  readonly label: string;
  readonly value: string;
}

export interface SteamOSDashboardSurfaceProps {
  readonly providerStatuses?: SteamOSDashboardProviderStatuses;
  readonly readCachedSnapshot?: (providerId: SteamOSDashboardProviderId) => Promise<DashboardSnapshot | undefined>;
  readonly writeCachedSnapshot?: (
    providerId: SteamOSDashboardProviderId,
    snapshot: DashboardSnapshot,
  ) => Promise<void>;
  readonly refreshDashboard?: (
    providerId: SteamOSDashboardProviderId,
  ) => Promise<ResourceState<DashboardSnapshot>>;
  readonly selectedProviderId?: SteamOSDashboardProviderId;
  readonly onSelectedProviderIdChange?: (providerId: SteamOSDashboardProviderId) => void;
  readonly initialSelectedProviderId?: SteamOSDashboardProviderId;
  readonly initialProviderStates?: SteamOSDashboardProviderStates;
}

const DASHBOARD_REFRESH_CACHED_ERROR =
  "Showing cached dashboard data. Refresh failed. Try again when the backend is available.";
const DASHBOARD_REFRESH_EMPTY_ERROR =
  "No dashboard available yet. Refresh failed. Check setup or retry.";
const DASHBOARD_CACHE_READ_ERROR =
  "Cached dashboard unavailable. Try Refresh again.";

const SURFACE_STYLE: CSSProperties = {
  display: "grid",
  gap: "1.1rem",
};

const PANEL_STYLE: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.16)",
  borderRadius: "22px",
  background:
    "linear-gradient(180deg, rgba(15, 23, 42, 0.93) 0%, rgba(15, 23, 42, 0.8) 58%, rgba(11, 18, 32, 0.88) 100%)",
  padding: "1.2rem",
  boxShadow: "0 20px 42px rgba(2, 6, 23, 0.26)",
  display: "grid",
  gap: "1.05rem",
};

const SECTION_HEADER_STYLE: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const HEADER_ROW_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "1.15rem",
  color: "#f8fafc",
};

const EYEBROW_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "0.76rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#60a5fa",
};

const HELP_TEXT_STYLE: CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  lineHeight: 1.55,
};

const CHOOSER_PANEL_STYLE: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.14)",
  borderRadius: "18px",
  background: "rgba(15, 23, 42, 0.76)",
  padding: "1rem 1rem 1.05rem",
  display: "grid",
  gap: "0.85rem",
};

const CHOOSER_LABEL_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "0.9rem",
  fontWeight: 700,
  color: "#e2e8f0",
};

const CHOOSER_STYLE: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const BUTTON_BASE_STYLE: CSSProperties = {
  appearance: "none",
  borderRadius: "999px",
  padding: "0.9rem 1rem",
  minHeight: "50px",
  minWidth: "164px",
  fontWeight: 700,
  cursor: "pointer",
  justifyContent: "center",
};

const SELECTED_PROVIDER_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  border: "1px solid rgba(59, 130, 246, 0.35)",
  background: "linear-gradient(180deg, rgba(37, 99, 235, 0.98) 0%, rgba(29, 78, 216, 0.94) 100%)",
  color: "#ffffff",
  boxShadow: "0 10px 24px rgba(37, 99, 235, 0.22)",
};

const UNSELECTED_PROVIDER_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  border: "1px solid rgba(148, 163, 184, 0.28)",
  backgroundColor: "rgba(15, 23, 42, 0.82)",
  color: "#e2e8f0",
};

const STATUS_BADGE_BASE_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "0.4rem 0.75rem",
  minHeight: "2rem",
  fontSize: "0.85rem",
  fontWeight: 700,
  letterSpacing: "0.01em",
  border: "1px solid transparent",
};

const CONTENT_CARD_STYLE: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.14)",
  borderRadius: "20px",
  background:
    "linear-gradient(180deg, rgba(17, 24, 39, 0.94) 0%, rgba(15, 23, 42, 0.88) 58%, rgba(11, 18, 32, 0.92) 100%)",
  padding: "1.15rem",
  display: "grid",
  gap: "1rem",
  boxShadow: "0 18px 34px rgba(2, 6, 23, 0.22)",
};

const CONTENT_HEADING_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "1.05rem",
  color: "#f8fafc",
};

const CONTENT_SUBTITLE_STYLE: CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  fontSize: "0.92rem",
  lineHeight: 1.45,
};

const META_TEXT_STYLE: CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  lineHeight: 1.55,
};

const META_GROUP_STYLE: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
};

const SUMMARY_GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "0.9rem",
};

const SUMMARY_CARD_STYLE: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.12)",
  borderRadius: "16px",
  background:
    "linear-gradient(180deg, rgba(15, 23, 42, 0.78) 0%, rgba(15, 23, 42, 0.66) 100%)",
  padding: "1rem",
  display: "grid",
  gap: "0.4rem",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.02)",
};

const SUMMARY_LABEL_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "0.88rem",
  color: "#9fb4ca",
};

const SUMMARY_VALUE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "1.28rem",
  fontWeight: 800,
  color: "#f8fbff",
};

const ERROR_TEXT_STYLE: CSSProperties = {
  margin: 0,
  color: "#fda4af",
  fontWeight: 700,
};

const REFRESH_STATUS_STYLE: CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  fontSize: "0.92rem",
  lineHeight: 1.5,
};

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatOptionalCount(value: number | undefined): string {
  return value !== undefined ? formatCount(value) : "\u2014";
}

function getMetricValue(snapshot: DashboardSnapshot, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const match = snapshot.profile.metrics.find((metric) => metric.key === key || metric.label === key);
    if (match !== undefined) {
      return match.value;
    }
  }

  return undefined;
}

function createProviderStateFromStatus(
  status: SteamOSDashboardProviderStatus | undefined,
): SteamOSDashboardProviderState {
  if (status === "configured") {
    return {
      status: "not_loaded",
      isRefreshing: false,
    };
  }

  if (status === "unavailable") {
    return {
      status: "unavailable",
      isRefreshing: false,
    };
  }

  if (status === "setup_incomplete") {
    return {
      status: "setup_incomplete",
      isRefreshing: false,
    };
  }

  return {
    status: "setup_required",
    isRefreshing: false,
  };
}

export function createSteamOSDashboardProviderStates(
  providerStatuses?: SteamOSDashboardProviderStatuses,
): SteamOSDashboardProviderStates {
  return {
    retroAchievements: createProviderStateFromStatus(providerStatuses?.retroAchievements.status),
    steam: createProviderStateFromStatus(providerStatuses?.steam.status),
  };
}

export function resolveInitialDashboardProviderId(
  providerStatuses?: SteamOSDashboardProviderStatuses,
): SteamOSDashboardProviderId {
  if (providerStatuses?.retroAchievements.status === "configured") {
    return RETROACHIEVEMENTS_PROVIDER_ID;
  }

  if (providerStatuses?.steam.status === "configured") {
    return STEAM_PROVIDER_ID;
  }

  return RETROACHIEVEMENTS_PROVIDER_ID;
}

function mapProviderIdToStateKey(
  providerId: SteamOSDashboardProviderId,
): keyof SteamOSDashboardProviderStates {
  return providerId === STEAM_PROVIDER_ID ? "steam" : "retroAchievements";
}

function mapProviderIdToStatusKey(
  providerId: SteamOSDashboardProviderId,
): keyof SteamOSDashboardProviderStatuses {
  return providerId === STEAM_PROVIDER_ID ? "steam" : "retroAchievements";
}

export async function loadSteamOSDashboardProviderStates(args: {
  readonly providerStatuses?: SteamOSDashboardProviderStatuses;
  readonly readCachedSnapshot?: (
    providerId: SteamOSDashboardProviderId,
  ) => Promise<DashboardSnapshot | undefined>;
}): Promise<SteamOSDashboardProviderStates> {
  let retroAchievementsState = createProviderStateFromStatus(args.providerStatuses?.retroAchievements.status);
  let steamState = createProviderStateFromStatus(args.providerStatuses?.steam.status);

  if (args.readCachedSnapshot === undefined || args.providerStatuses === undefined) {
    return {
      retroAchievements: retroAchievementsState,
      steam: steamState,
    };
  }

  for (const providerId of [RETROACHIEVEMENTS_PROVIDER_ID, STEAM_PROVIDER_ID] as const) {
    const statusKey = mapProviderIdToStatusKey(providerId);
    if (args.providerStatuses[statusKey].status !== "configured") {
      continue;
    }

    try {
      const snapshot = await args.readCachedSnapshot(providerId);
      if (snapshot !== undefined) {
        const nextState: SteamOSDashboardProviderState = {
          status: "cached",
          snapshot,
          isRefreshing: false,
        };
        if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
          retroAchievementsState = nextState;
        } else {
          steamState = nextState;
        }
      }
    } catch {
      const nextState: SteamOSDashboardProviderState = {
        ...(providerId === RETROACHIEVEMENTS_PROVIDER_ID ? retroAchievementsState : steamState),
        errorMessage: DASHBOARD_CACHE_READ_ERROR,
      };
      if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
        retroAchievementsState = nextState;
      } else {
        steamState = nextState;
      }
    }
  }

  return {
    retroAchievements: retroAchievementsState,
    steam: steamState,
  };
}

export function beginRefreshingSteamOSDashboardProviderState(
  state: SteamOSDashboardProviderState,
): SteamOSDashboardProviderState {
  if (state.status === "setup_required" || state.status === "setup_incomplete" || state.status === "unavailable") {
    return state;
  }

  return {
    ...state,
    isRefreshing: true,
  };
}

export async function refreshSteamOSDashboardProviderState(args: {
  readonly providerId: SteamOSDashboardProviderId;
  readonly currentState: SteamOSDashboardProviderState;
  readonly writeCachedSnapshot?: (
    providerId: SteamOSDashboardProviderId,
    snapshot: DashboardSnapshot,
  ) => Promise<void>;
  readonly refreshDashboard?: (
    providerId: SteamOSDashboardProviderId,
  ) => Promise<ResourceState<DashboardSnapshot>>;
}): Promise<SteamOSDashboardProviderState> {
  if (
    args.refreshDashboard === undefined
    || args.currentState.status === "setup_required"
    || args.currentState.status === "setup_incomplete"
    || args.currentState.status === "unavailable"
  ) {
    return {
      ...args.currentState,
      isRefreshing: false,
    };
  }

  try {
    const result = await args.refreshDashboard(args.providerId);
    if (result.data !== undefined) {
      if (args.writeCachedSnapshot !== undefined && result.error === undefined) {
        await args.writeCachedSnapshot(args.providerId, result.data);
      }

      return {
        status: "cached",
        snapshot: result.data,
        isRefreshing: false,
        ...(result.error !== undefined ? { errorMessage: DASHBOARD_REFRESH_CACHED_ERROR } : {}),
      };
    }

    return {
      ...args.currentState,
      isRefreshing: false,
      ...(result.error !== undefined ? { errorMessage: DASHBOARD_REFRESH_EMPTY_ERROR } : {}),
    };
  } catch {
    return {
      ...args.currentState,
      isRefreshing: false,
      errorMessage: args.currentState.snapshot !== undefined ? DASHBOARD_REFRESH_CACHED_ERROR : DASHBOARD_REFRESH_EMPTY_ERROR,
    };
  }
}

export function buildSteamOSDashboardSummaryCards(
  snapshot: DashboardSnapshot,
): readonly SteamOSDashboardSummaryCard[] {
  if (snapshot.profile.providerId === STEAM_PROVIDER_ID) {
    const perfectGames = Number(
      getMetricValue(snapshot, "games-beaten", "Perfect Games", "Games Beaten") ?? "0",
    );

    return [
      {
        label: "Steam Level",
        value: snapshot.profile.steamLevel !== undefined ? formatCount(snapshot.profile.steamLevel) : "\u2014",
      },
      {
        label: "Owned Games",
        value: formatOptionalCount(snapshot.profile.ownedGameCount),
      },
      {
        label: "Achievements Unlocked",
        value: formatCount(snapshot.profile.summary.unlockedCount),
      },
      {
        label: "Perfect Games",
        value: formatCount(Number.isFinite(perfectGames) ? perfectGames : 0),
      },
      {
        label: "Completion",
        value:
          snapshot.profile.summary.completionPercent !== undefined
            ? `${formatCount(snapshot.profile.summary.completionPercent)}%`
            : "\u2014",
      },
    ];
  }

  return [
    {
      label: "Points",
      value: getMetricValue(snapshot, "total-points", "Points") ?? "\u2014",
    },
    {
      label: "Achievements Unlocked",
      value: formatCount(snapshot.profile.summary.unlockedCount),
    },
    {
      label: "Games Beaten",
      value: getMetricValue(snapshot, "games-beaten", "Games Beaten") ?? "\u2014",
    },
    {
      label: "Unlock rate",
      value: getMetricValue(snapshot, "retro-ratio", "unlock-rate", "Unlock Rate") ?? "\u2014",
    },
  ];
}

function formatDashboardStateLabel(status: SteamOSDashboardCacheStatus): string {
  if (status === "cached") {
    return "Cached";
  }

  if (status === "not_loaded") {
    return "Not loaded yet";
  }

  if (status === "setup_incomplete") {
    return "Setup incomplete";
  }

  if (status === "unavailable") {
    return "Unavailable";
  }

  return "Setup required";
}

function getDashboardStateBadgeStyle(
  status: SteamOSDashboardCacheStatus,
  hasRefreshError: boolean,
  isRefreshing: boolean,
): CSSProperties {
  if (isRefreshing) {
    return {
      ...STATUS_BADGE_BASE_STYLE,
      backgroundColor: "#dbeafe",
      color: "#1d4ed8",
    };
  }

  if (hasRefreshError) {
    return {
      ...STATUS_BADGE_BASE_STYLE,
      backgroundColor: "#fee2e2",
      color: "#b42318",
    };
  }

  if (status === "cached") {
    return {
      ...STATUS_BADGE_BASE_STYLE,
      backgroundColor: "#dcfce7",
      color: "#166534",
    };
  }

  if (status === "not_loaded") {
    return {
      ...STATUS_BADGE_BASE_STYLE,
      backgroundColor: "#fef3c7",
      color: "#92400e",
    };
  }

  if (status === "unavailable") {
    return {
      ...STATUS_BADGE_BASE_STYLE,
      backgroundColor: "#e5e7eb",
      color: "#475569",
    };
  }

  if (status === "setup_incomplete") {
    return {
      ...STATUS_BADGE_BASE_STYLE,
      backgroundColor: "#fef3c7",
      color: "#92400e",
    };
  }

  return {
    ...STATUS_BADGE_BASE_STYLE,
    backgroundColor: "#ede9fe",
    color: "#6d28d9",
  };
}

function getDashboardStateDescription(status: SteamOSDashboardCacheStatus): string {
  if (status === "cached") {
    return "Showing the most recent cached snapshot until you request a manual refresh.";
  }

  if (status === "not_loaded") {
    return "This provider is configured, but no cached dashboard snapshot has been loaded yet.";
  }

  if (status === "setup_incomplete") {
    return "Saved setup is incomplete locally. Open setup, save the provider credentials again, then retry.";
  }

  if (status === "unavailable") {
    return "Provider config is temporarily unavailable, so dashboard data cannot be read right now.";
  }

  return "Finish provider setup first, then use Refresh when you want to load dashboard data.";
}

function formatRefreshedAt(snapshot: DashboardSnapshot | undefined): string | undefined {
  const refreshedAt = snapshot?.refreshedAt ?? snapshot?.profile.refreshedAt;
  if (typeof refreshedAt !== "number" || !Number.isFinite(refreshedAt)) {
    return undefined;
  }

  const date = new Date(refreshedAt);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const now = new Date();
  const timeText = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (date.toDateString() === now.toDateString()) {
    return `today at ${timeText}`;
  }

  return `${date.toLocaleDateString()} at ${timeText}`;
}

function canRefreshDashboardState(state: SteamOSDashboardProviderState): boolean {
  return state.status === "cached" || state.status === "not_loaded";
}

export function SteamOSDashboardSurface(props: SteamOSDashboardSurfaceProps): JSX.Element {
  const [selectedProviderId, setSelectedProviderId] = useState<SteamOSDashboardProviderId>(
    props.selectedProviderId ?? props.initialSelectedProviderId ?? resolveInitialDashboardProviderId(props.providerStatuses),
  );
  const [providerStates, setProviderStates] = useState<SteamOSDashboardProviderStates>(
    props.initialProviderStates ?? createSteamOSDashboardProviderStates(props.providerStatuses),
  );

  useEffect(() => {
    if (props.selectedProviderId !== undefined) {
      setSelectedProviderId(props.selectedProviderId);
    }
  }, [props.selectedProviderId]);

  useEffect(() => {
    let disposed = false;

    const loadStatesArgs = {
      ...(props.providerStatuses !== undefined ? { providerStatuses: props.providerStatuses } : {}),
      ...(props.readCachedSnapshot !== undefined ? { readCachedSnapshot: props.readCachedSnapshot } : {}),
    };

    void loadSteamOSDashboardProviderStates(loadStatesArgs).then((nextStates) => {
      if (disposed) {
        return;
      }

      setProviderStates(nextStates);
    });

    return () => {
      disposed = true;
    };
  }, [props.providerStatuses, props.readCachedSnapshot]);

  const selectedStatusKey = mapProviderIdToStatusKey(selectedProviderId);
  const selectedStateKey = mapProviderIdToStateKey(selectedProviderId);
  const selectedProviderLabel = props.providerStatuses?.[selectedStatusKey].label
    ?? (selectedProviderId === STEAM_PROVIDER_ID ? "Steam" : "RetroAchievements");
  const selectedProviderState = providerStates[selectedStateKey];

  const summaryCards = useMemo(
    () => (
      selectedProviderState.snapshot !== undefined
        ? buildSteamOSDashboardSummaryCards(selectedProviderState.snapshot)
        : []
    ),
    [selectedProviderState.snapshot],
  );

  async function handleRefresh(): Promise<void> {
    const currentState = providerStates[selectedStateKey];
    if (!canRefreshDashboardState(currentState)) {
      return;
    }

    setProviderStates((currentStates) => ({
      ...currentStates,
      [selectedStateKey]: beginRefreshingSteamOSDashboardProviderState(currentStates[selectedStateKey]),
    }));

    const nextState = await refreshSteamOSDashboardProviderState({
      providerId: selectedProviderId,
      currentState,
      ...(props.writeCachedSnapshot !== undefined ? { writeCachedSnapshot: props.writeCachedSnapshot } : {}),
      ...(props.refreshDashboard !== undefined ? { refreshDashboard: props.refreshDashboard } : {}),
    });

    setProviderStates((currentStates) => ({
      ...currentStates,
      [selectedStateKey]: nextState,
    }));
  }

  return (
    <section id="steamos-dashboard-surface" aria-label="SteamOS cached dashboard" style={SURFACE_STYLE}>
      <section style={PANEL_STYLE}>
        <div style={SECTION_HEADER_STYLE}>
          <p style={EYEBROW_STYLE}>Dashboard</p>
          <div style={HEADER_ROW_STYLE}>
            <h2 style={TITLE_STYLE}>Read-only dashboard</h2>
            <span
              aria-live="polite"
              style={getDashboardStateBadgeStyle(
                selectedProviderState.status,
                selectedProviderState.errorMessage !== undefined,
                selectedProviderState.isRefreshing,
              )}
            >
              {selectedProviderState.isRefreshing
                ? "Refreshing"
                : selectedProviderState.errorMessage !== undefined
                  ? "Refresh failed"
                  : formatDashboardStateLabel(selectedProviderState.status)}
            </span>
          </div>
        </div>
        <p style={HELP_TEXT_STYLE}>
          Dashboard snapshots load from cache first. Live provider refresh only happens when you click Refresh,
          and Steam library scans are not triggered from this surface.
        </p>
        <section aria-label="Dashboard provider chooser" data-steamos-focus-group="true" style={CHOOSER_PANEL_STYLE}>
          <p style={CHOOSER_LABEL_STYLE}>Choose a provider dashboard</p>
          <div className="steamos-dashboard-chooser steamos-action-row" style={CHOOSER_STYLE}>
            <button
              className="steamos-focus-target steamos-button-target"
              type="button"
              aria-pressed={selectedProviderId === RETROACHIEVEMENTS_PROVIDER_ID}
              style={selectedProviderId === RETROACHIEVEMENTS_PROVIDER_ID ? SELECTED_PROVIDER_BUTTON_STYLE : UNSELECTED_PROVIDER_BUTTON_STYLE}
              onClick={() => {
              setSelectedProviderId(RETROACHIEVEMENTS_PROVIDER_ID);
              props.onSelectedProviderIdChange?.(RETROACHIEVEMENTS_PROVIDER_ID);
            }}
            >
              RetroAchievements
            </button>
            <button
              className="steamos-focus-target steamos-button-target"
              type="button"
              aria-pressed={selectedProviderId === STEAM_PROVIDER_ID}
              style={selectedProviderId === STEAM_PROVIDER_ID ? SELECTED_PROVIDER_BUTTON_STYLE : UNSELECTED_PROVIDER_BUTTON_STYLE}
              onClick={() => {
              setSelectedProviderId(STEAM_PROVIDER_ID);
              props.onSelectedProviderIdChange?.(STEAM_PROVIDER_ID);
            }}
            >
              Steam
            </button>
          </div>
        </section>
        <section aria-label={`${selectedProviderLabel} dashboard`} data-steamos-focus-group="true" style={CONTENT_CARD_STYLE}>
          <div style={HEADER_ROW_STYLE}>
            <div style={SECTION_HEADER_STYLE}>
              <h3 style={CONTENT_HEADING_STYLE}>{selectedProviderLabel}</h3>
              <p style={CONTENT_SUBTITLE_STYLE}>{getDashboardStateDescription(selectedProviderState.status)}</p>
            </div>
            <button
              className="steamos-focus-target steamos-button-target"
              type="button"
              style={UNSELECTED_PROVIDER_BUTTON_STYLE}
              disabled={!canRefreshDashboardState(selectedProviderState) || selectedProviderState.isRefreshing}
              onClick={() => void handleRefresh()}
              aria-label={`Refresh ${selectedProviderLabel} dashboard`}
            >
              {selectedProviderState.isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div style={META_GROUP_STYLE}>
            {selectedProviderState.status === "setup_required" ? (
              <p style={META_TEXT_STYLE}>Set up this provider before loading a dashboard snapshot.</p>
            ) : null}
            {selectedProviderState.status === "setup_incomplete" ? (
              <p style={META_TEXT_STYLE}>
                Saved setup is incomplete locally. Open setup and save this provider again before refreshing.
              </p>
            ) : null}
            {selectedProviderState.status === "unavailable" ? (
              <p style={META_TEXT_STYLE}>Provider config unavailable.</p>
            ) : null}
            {selectedProviderState.status === "not_loaded" ? (
              <p style={META_TEXT_STYLE}>No cached dashboard snapshot yet. Refresh when you are ready.</p>
            ) : null}
            {selectedProviderState.isRefreshing ? (
              <p aria-live="polite" role="status" style={REFRESH_STATUS_STYLE}>
                Refreshing the cached dashboard view. This shell still avoids automatic refreshes and Steam scans.
              </p>
            ) : null}
          </div>
          {selectedProviderState.status === "cached" ? (
            <>
              <p style={META_TEXT_STYLE}>
                {formatRefreshedAt(selectedProviderState.snapshot) !== undefined
                  ? `Last updated ${formatRefreshedAt(selectedProviderState.snapshot)}`
                  : "Last updated unavailable"}
              </p>
              <div style={SUMMARY_GRID_STYLE}>
                {summaryCards.map((card) => (
                  <article key={card.label} style={SUMMARY_CARD_STYLE}>
                    <p style={SUMMARY_LABEL_STYLE}>{card.label}</p>
                    <p style={SUMMARY_VALUE_STYLE}>{card.value}</p>
                  </article>
                ))}
              </div>
            </>
          ) : null}
          {selectedProviderState.errorMessage !== undefined ? (
            <div role="alert" style={{ display: "grid", gap: "0.35rem" }}>
              <p style={ERROR_TEXT_STYLE}>{selectedProviderState.errorMessage}</p>
              <p style={META_TEXT_STYLE}>
                {selectedProviderState.snapshot !== undefined
                  ? "Try Refresh again. If it keeps failing, check setup or restart start:steamos."
                  : "Retry Refresh after checking setup or restarting start:steamos."}
              </p>
            </div>
          ) : null}
        </section>
      </section>
    </section>
  );
}
