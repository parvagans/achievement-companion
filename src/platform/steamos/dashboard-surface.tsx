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

export type SteamOSDashboardProviderStatus = "configured" | "not_configured" | "unavailable";

export interface SteamOSDashboardProviderStatusEntry {
  readonly label: string;
  readonly status: SteamOSDashboardProviderStatus;
}

export interface SteamOSDashboardProviderStatuses {
  readonly retroAchievements: SteamOSDashboardProviderStatusEntry;
  readonly steam: SteamOSDashboardProviderStatusEntry;
}

export type SteamOSDashboardCacheStatus = "setup_required" | "unavailable" | "not_loaded" | "cached";

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
  readonly refreshDashboard?: (
    providerId: SteamOSDashboardProviderId,
  ) => Promise<ResourceState<DashboardSnapshot>>;
  readonly initialSelectedProviderId?: SteamOSDashboardProviderId;
  readonly initialProviderStates?: SteamOSDashboardProviderStates;
}

const DASHBOARD_REFRESH_ERROR = "Could not refresh dashboard";

const SURFACE_STYLE: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const PANEL_STYLE: CSSProperties = {
  border: "1px solid #d7dde5",
  borderRadius: "16px",
  background: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
  padding: "1.1rem",
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: "0.9rem",
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
  fontSize: "1.1rem",
};

const HELP_TEXT_STYLE: CSSProperties = {
  margin: 0,
  color: "#5f6b7a",
  lineHeight: 1.5,
};

const CHOOSER_STYLE: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const BUTTON_BASE_STYLE: CSSProperties = {
  appearance: "none",
  borderRadius: "999px",
  padding: "0.65rem 1rem",
  fontWeight: 600,
  cursor: "pointer",
};

const SELECTED_PROVIDER_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  border: "none",
  backgroundColor: "#0f172a",
  color: "#ffffff",
};

const UNSELECTED_PROVIDER_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  border: "1px solid #c7d0db",
  backgroundColor: "#ffffff",
  color: "#1f2937",
};

const STATUS_BADGE_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "0.3rem 0.7rem",
  fontSize: "0.84rem",
  fontWeight: 700,
  backgroundColor: "#e2e8f0",
  color: "#334155",
};

const CONTENT_CARD_STYLE: CSSProperties = {
  border: "1px solid #dbe3ec",
  borderRadius: "14px",
  backgroundColor: "#ffffff",
  padding: "1rem",
  display: "grid",
  gap: "0.9rem",
};

const CONTENT_HEADING_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "1rem",
};

const META_TEXT_STYLE: CSSProperties = {
  margin: 0,
  color: "#5f6b7a",
  lineHeight: 1.5,
};

const SUMMARY_GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "0.75rem",
};

const SUMMARY_CARD_STYLE: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  backgroundColor: "#f8fafc",
  padding: "0.85rem",
  display: "grid",
  gap: "0.35rem",
};

const SUMMARY_LABEL_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "0.9rem",
  color: "#5f6b7a",
};

const SUMMARY_VALUE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "1.2rem",
  fontWeight: 700,
  color: "#0f172a",
};

const ERROR_TEXT_STYLE: CSSProperties = {
  margin: 0,
  color: "#b42318",
  fontWeight: 600,
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
        errorMessage: "Cached dashboard unavailable",
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
  if (state.status === "setup_required" || state.status === "unavailable") {
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
  readonly refreshDashboard?: (
    providerId: SteamOSDashboardProviderId,
  ) => Promise<ResourceState<DashboardSnapshot>>;
}): Promise<SteamOSDashboardProviderState> {
  if (
    args.refreshDashboard === undefined
    || args.currentState.status === "setup_required"
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
      return {
        status: "cached",
        snapshot: result.data,
        isRefreshing: false,
        ...(result.error !== undefined ? { errorMessage: DASHBOARD_REFRESH_ERROR } : {}),
      };
    }

    return {
      ...args.currentState,
      isRefreshing: false,
      ...(result.error !== undefined ? { errorMessage: DASHBOARD_REFRESH_ERROR } : {}),
    };
  } catch {
    return {
      ...args.currentState,
      isRefreshing: false,
      errorMessage: DASHBOARD_REFRESH_ERROR,
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

  if (status === "unavailable") {
    return "Unavailable";
  }

  return "Setup required";
}

function formatRefreshedAt(snapshot: DashboardSnapshot | undefined): string | undefined {
  const refreshedAt = snapshot?.refreshedAt ?? snapshot?.profile.refreshedAt;
  if (typeof refreshedAt !== "number" || !Number.isFinite(refreshedAt)) {
    return undefined;
  }

  return new Date(refreshedAt).toLocaleString();
}

function canRefreshDashboardState(state: SteamOSDashboardProviderState): boolean {
  return state.status === "cached" || state.status === "not_loaded";
}

export function SteamOSDashboardSurface(props: SteamOSDashboardSurfaceProps): JSX.Element {
  const [selectedProviderId, setSelectedProviderId] = useState<SteamOSDashboardProviderId>(
    props.initialSelectedProviderId ?? resolveInitialDashboardProviderId(props.providerStatuses),
  );
  const [providerStates, setProviderStates] = useState<SteamOSDashboardProviderStates>(
    props.initialProviderStates ?? createSteamOSDashboardProviderStates(props.providerStatuses),
  );

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
      ...(props.refreshDashboard !== undefined ? { refreshDashboard: props.refreshDashboard } : {}),
    });

    setProviderStates((currentStates) => ({
      ...currentStates,
      [selectedStateKey]: nextState,
    }));
  }

  return (
    <section aria-label="SteamOS cached dashboard" style={SURFACE_STYLE}>
      <section style={PANEL_STYLE}>
        <div style={HEADER_ROW_STYLE}>
          <h2 style={TITLE_STYLE}>Read-only dashboard</h2>
          <span style={STATUS_BADGE_STYLE}>{formatDashboardStateLabel(selectedProviderState.status)}</span>
        </div>
        <p style={HELP_TEXT_STYLE}>
          Cached dashboard snapshots are shown first. Live provider refresh only happens when you click Refresh,
          and Steam scans stay out of scope here.
        </p>
        <div aria-label="Dashboard provider chooser" style={CHOOSER_STYLE}>
          <button
            type="button"
            style={selectedProviderId === RETROACHIEVEMENTS_PROVIDER_ID ? SELECTED_PROVIDER_BUTTON_STYLE : UNSELECTED_PROVIDER_BUTTON_STYLE}
            onClick={() => setSelectedProviderId(RETROACHIEVEMENTS_PROVIDER_ID)}
          >
            RetroAchievements
          </button>
          <button
            type="button"
            style={selectedProviderId === STEAM_PROVIDER_ID ? SELECTED_PROVIDER_BUTTON_STYLE : UNSELECTED_PROVIDER_BUTTON_STYLE}
            onClick={() => setSelectedProviderId(STEAM_PROVIDER_ID)}
          >
            Steam
          </button>
        </div>
        <section aria-label={`${selectedProviderLabel} dashboard`} style={CONTENT_CARD_STYLE}>
          <div style={HEADER_ROW_STYLE}>
            <h3 style={CONTENT_HEADING_STYLE}>{selectedProviderLabel}</h3>
            <button
              type="button"
              style={UNSELECTED_PROVIDER_BUTTON_STYLE}
              disabled={!canRefreshDashboardState(selectedProviderState) || selectedProviderState.isRefreshing}
              onClick={() => void handleRefresh()}
            >
              {selectedProviderState.isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {selectedProviderState.status === "setup_required" ? (
            <p style={META_TEXT_STYLE}>Set up this provider before loading a dashboard snapshot.</p>
          ) : null}
          {selectedProviderState.status === "unavailable" ? (
            <p style={META_TEXT_STYLE}>Provider config unavailable.</p>
          ) : null}
          {selectedProviderState.status === "not_loaded" ? (
            <p style={META_TEXT_STYLE}>No cached dashboard snapshot yet. Refresh when you are ready.</p>
          ) : null}
          {selectedProviderState.status === "cached" ? (
            <>
              {formatRefreshedAt(selectedProviderState.snapshot) !== undefined ? (
                <p style={META_TEXT_STYLE}>
                  Last updated {formatRefreshedAt(selectedProviderState.snapshot)}
                </p>
              ) : null}
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
            <p role="alert" style={ERROR_TEXT_STYLE}>{selectedProviderState.errorMessage}</p>
          ) : null}
        </section>
      </section>
    </section>
  );
}
