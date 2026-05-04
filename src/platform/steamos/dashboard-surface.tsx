import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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

interface SteamOSDashboardDetailSectionItem {
  readonly title: string;
  readonly metaLines: readonly string[];
  readonly achievementSelection?: SteamOSDashboardAchievementDetailSelection;
  readonly gameSelection?: SteamOSDashboardGameDetailSelection;
}

interface SteamOSDashboardDetailSection {
  readonly title: string;
  readonly emptyState: string;
  readonly items: readonly SteamOSDashboardDetailSectionItem[];
}

export interface SteamOSDashboardGameDetailSelection {
  readonly providerId: SteamOSDashboardProviderId;
  readonly gameId: string;
  readonly gameTitle: string;
}

export interface SteamOSDashboardAchievementDetailSelection {
  readonly providerId: SteamOSDashboardProviderId;
  readonly gameId: string;
  readonly gameTitle: string;
  readonly achievementId: string;
  readonly achievementTitle: string;
}

interface SteamOSDashboardGameDetailCard {
  readonly label: string;
  readonly value: string;
}

interface SteamOSDashboardGameDetail {
  readonly providerLabel: string;
  readonly title: string;
  readonly summaryCards: readonly SteamOSDashboardGameDetailCard[];
  readonly achievementTitle: string;
  readonly achievementEmptyState: string;
  readonly recentAchievements: readonly SteamOSDashboardDetailSectionItem[];
}

interface SteamOSDashboardAchievementDetailCard {
  readonly label: string;
  readonly value: string;
}

interface SteamOSDashboardAchievementDetail {
  readonly providerLabel: string;
  readonly gameTitle: string;
  readonly title: string;
  readonly summaryCards: readonly SteamOSDashboardAchievementDetailCard[];
  readonly descriptionTitle: string;
  readonly description: string;
  readonly achievementHistoryTitle: string;
  readonly recentAchievements: readonly SteamOSDashboardDetailSectionItem[];
}

export interface SteamOSSteamLibraryScanOverview {
  readonly ownedGameCount: number;
  readonly scannedGameCount: number;
  readonly gamesWithAchievements: number;
  readonly unlockedAchievements: number;
  readonly totalAchievements: number;
  readonly perfectGames: number;
  readonly completionPercent: number;
  readonly scannedAt: string;
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
  readonly initialSelectedGameDetail?: SteamOSDashboardGameDetailSelection;
  readonly initialSelectedAchievementDetail?: SteamOSDashboardAchievementDetailSelection;
  readonly initialProviderStates?: SteamOSDashboardProviderStates;
  readonly steamLibraryScanOverview?: SteamOSSteamLibraryScanOverview;
  readonly onScanSteamLibrary?: () => Promise<void> | void;
  readonly isSteamLibraryScanning?: boolean;
  readonly steamLibraryScanMessage?: string;
  readonly steamLibraryScanErrorMessage?: string;
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

const HEADER_ACTIONS_STYLE: CSSProperties = {
  display: "flex",
  gap: "0.65rem",
  flexWrap: "wrap",
  justifyContent: "flex-end",
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

const SCAN_NOTE_STYLE: CSSProperties = {
  margin: 0,
  color: "#d8e4f3",
  lineHeight: 1.55,
};

const SCAN_META_STYLE: CSSProperties = {
  margin: 0,
  color: "#9fb4ca",
  lineHeight: 1.5,
};

const DETAIL_GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "0.95rem",
};

const DETAIL_SECTION_STYLE: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.12)",
  borderRadius: "18px",
  background:
    "linear-gradient(180deg, rgba(15, 23, 42, 0.72) 0%, rgba(15, 23, 42, 0.62) 100%)",
  padding: "1rem",
  display: "grid",
  gap: "0.8rem",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.02)",
};

const DETAIL_TITLE_STYLE: CSSProperties = {
  margin: 0,
  color: "#f8fbff",
  fontSize: "1rem",
  fontWeight: 800,
};

const DETAIL_EMPTY_STYLE: CSSProperties = {
  margin: 0,
  color: "#9fb4ca",
  lineHeight: 1.5,
};

const DETAIL_LIST_STYLE: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

const DETAIL_CARD_STYLE: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.11)",
  borderRadius: "14px",
  background: "rgba(15, 23, 42, 0.68)",
  padding: "0.86rem",
  display: "grid",
  gap: "0.35rem",
};

const DETAIL_CARD_TITLE_STYLE: CSSProperties = {
  margin: 0,
  color: "#f8fbff",
  fontWeight: 800,
  fontSize: "0.95rem",
};

const DETAIL_CARD_META_STYLE: CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  lineHeight: 1.45,
  fontSize: "0.9rem",
};

const DETAIL_CARD_BUTTON_STYLE: CSSProperties = {
  ...DETAIL_CARD_STYLE,
  appearance: "none",
  width: "100%",
  border: "1px solid rgba(148, 163, 184, 0.16)",
  cursor: "pointer",
  textAlign: "left",
};

const GAME_DETAIL_PANEL_STYLE: CSSProperties = {
  border: "1px solid rgba(96, 165, 250, 0.2)",
  borderRadius: "22px",
  background:
    "linear-gradient(180deg, rgba(11, 18, 32, 0.82) 0%, rgba(15, 23, 42, 0.9) 62%, rgba(11, 18, 32, 0.94) 100%)",
  padding: "1.1rem",
  display: "grid",
  gap: "1rem",
  boxShadow: "0 20px 40px rgba(2, 6, 23, 0.24)",
};

const GAME_DETAIL_HEADER_STYLE: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
};

const GAME_DETAIL_TITLE_ROW_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const GAME_DETAIL_TITLE_STYLE: CSSProperties = {
  margin: 0,
  color: "#f8fbff",
  fontSize: "1.2rem",
  fontWeight: 900,
};

const GAME_DETAIL_HELP_STYLE: CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  lineHeight: 1.5,
};

const GAME_DETAIL_BADGE_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  minHeight: "2rem",
  padding: "0.4rem 0.75rem",
  borderRadius: "999px",
  border: "1px solid rgba(125, 211, 252, 0.18)",
  backgroundColor: "rgba(15, 23, 42, 0.72)",
  color: "#dbeafe",
  fontSize: "0.86rem",
  fontWeight: 700,
};

const GAME_DETAIL_SUMMARY_GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "0.8rem",
};

const GAME_DETAIL_SUMMARY_CARD_STYLE: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.12)",
  borderRadius: "16px",
  background:
    "linear-gradient(180deg, rgba(15, 23, 42, 0.76) 0%, rgba(15, 23, 42, 0.62) 100%)",
  padding: "0.9rem",
  display: "grid",
  gap: "0.35rem",
};

const GAME_DETAIL_SUMMARY_LABEL_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "0.8rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#7dd3fc",
  fontWeight: 700,
};

const GAME_DETAIL_SUMMARY_VALUE_STYLE: CSSProperties = {
  margin: 0,
  color: "#f8fbff",
  lineHeight: 1.45,
};

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatOptionalCount(value: number | undefined): string {
  return value !== undefined ? formatCount(value) : "\u2014";
}

function formatMinutes(value: number | undefined): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  const roundedMinutes = Math.round(value);
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (hours === 0) {
    return `${roundedMinutes} min`;
  }

  if (minutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${minutes} min`;
}

function formatGameStatus(status: string): string {
  if (status === "mastered") {
    return "Mastered";
  }

  if (status === "completed") {
    return "Completed";
  }

  if (status === "beaten") {
    return "Beaten";
  }

  if (status === "in_progress") {
    return "In progress";
  }

  return "Locked";
}

function normalizeDisplayTitle(value: string | undefined, fallback: string): string {
  const normalized = value?.trim() ?? "";
  return normalized === "" ? fallback : normalized;
}

function isDefined(value: string | undefined): value is string {
  return value !== undefined;
}

function hasUsableCachedTitle(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
  steamLibraryScanOverview?: SteamOSSteamLibraryScanOverview,
): readonly SteamOSDashboardSummaryCard[] {
  if (snapshot.profile.providerId === STEAM_PROVIDER_ID) {
    return [
      {
        label: "Steam Level",
        value: snapshot.profile.steamLevel !== undefined ? formatCount(snapshot.profile.steamLevel) : "\u2014",
      },
      {
        label: "Owned Games",
        value: steamLibraryScanOverview !== undefined
          ? formatCount(steamLibraryScanOverview.ownedGameCount ?? steamLibraryScanOverview.scannedGameCount)
          : "\u2014",
      },
      {
        label: "Achievements Unlocked",
        value: formatCount(
          steamLibraryScanOverview?.unlockedAchievements ?? snapshot.profile.summary.unlockedCount,
        ),
      },
      {
        label: "Perfect Games",
        value: steamLibraryScanOverview !== undefined
          ? formatCount(steamLibraryScanOverview.perfectGames)
          : "\u2014",
      },
      {
        label: "Completion",
        value: steamLibraryScanOverview !== undefined
          ? `${formatCount(steamLibraryScanOverview.completionPercent)}%`
          : snapshot.profile.summary.completionPercent !== undefined
            ? `${formatCount(snapshot.profile.summary.completionPercent)}% (partial)`
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

function formatTimestampLabel(timestampMs: number | undefined): string | undefined {
  if (typeof timestampMs !== "number" || !Number.isFinite(timestampMs)) {
    return undefined;
  }

  const date = new Date(timestampMs);
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

function formatRefreshedAt(snapshot: DashboardSnapshot | undefined): string | undefined {
  return formatTimestampLabel(snapshot?.refreshedAt ?? snapshot?.profile.refreshedAt);
}

function formatScannedAt(scannedAt: string | undefined): string | undefined {
  if (typeof scannedAt !== "string" || scannedAt.trim() === "") {
    return undefined;
  }

  const parsedAt = Date.parse(scannedAt);
  return Number.isFinite(parsedAt) ? formatTimestampLabel(parsedAt) : undefined;
}

function buildRecentAchievementsSection(snapshot: DashboardSnapshot): SteamOSDashboardDetailSection {
  const recentUnlocks = snapshot.recentUnlocks.length > 0 ? snapshot.recentUnlocks : snapshot.recentAchievements;
  return {
    title: "Recent achievements / recent unlocks",
    emptyState: "No recent achievements in the cached snapshot.",
    items: recentUnlocks.slice(0, 3).map((recentUnlock) => {
      const achievementSelection = hasUsableCachedTitle(recentUnlock.game.title)
        && hasUsableCachedTitle(recentUnlock.achievement.title)
        ? {
          providerId: recentUnlock.achievement.providerId as SteamOSDashboardProviderId,
          gameId: recentUnlock.game.gameId,
          gameTitle: normalizeDisplayTitle(recentUnlock.game.title, "Unknown game"),
          achievementId: recentUnlock.achievement.achievementId,
          achievementTitle: normalizeDisplayTitle(recentUnlock.achievement.title, "Recent achievement"),
        }
        : undefined;
      const metaLines = [
        `Game: ${normalizeDisplayTitle(recentUnlock.game.title, "Unknown game")}`,
        recentUnlock.achievement.points !== undefined ? `${formatCount(recentUnlock.achievement.points)} points` : undefined,
        recentUnlock.unlockedAt !== undefined ? `Unlocked ${formatTimestampLabel(recentUnlock.unlockedAt)}` : undefined,
      ].filter(isDefined);
      const item: SteamOSDashboardDetailSectionItem = {
        title: normalizeDisplayTitle(recentUnlock.achievement.title, "Recent achievement"),
        metaLines,
      };
      return achievementSelection !== undefined ? { ...item, achievementSelection } : item;
    }),
  };
}

function buildRecentlyPlayedSection(snapshot: DashboardSnapshot): SteamOSDashboardDetailSection {
  return {
    title: "Recently played",
    emptyState: "No recently played games in the cached snapshot.",
    items: snapshot.recentlyPlayedGames.slice(0, 3).map((game) => {
      const gameSelection = hasUsableCachedTitle(game.title)
        ? {
          providerId: game.providerId as SteamOSDashboardProviderId,
          gameId: game.gameId,
          gameTitle: normalizeDisplayTitle(game.title, "Recently played game"),
        }
        : undefined;
      const metaLines = [
        game.summary.completionPercent !== undefined ? `Completion ${formatCount(game.summary.completionPercent)}%` : undefined,
        formatMinutes(game.playtimeForeverMinutes) !== undefined ? `Playtime ${formatMinutes(game.playtimeForeverMinutes)}` : undefined,
        game.lastPlayedAt !== undefined ? `Last played ${formatTimestampLabel(game.lastPlayedAt)}` : undefined,
      ].filter(isDefined);
      const item: SteamOSDashboardDetailSectionItem = {
        title: normalizeDisplayTitle(game.title, "Recently played game"),
        metaLines,
      };
      return gameSelection !== undefined ? { ...item, gameSelection } : item;
    }),
  };
}

export function buildSteamOSDashboardAchievementDetail(
  snapshot: DashboardSnapshot,
  selection: SteamOSDashboardAchievementDetailSelection,
): SteamOSDashboardAchievementDetail {
  const matchingRecentUnlocks = snapshot.recentUnlocks.filter(
    (recentUnlock) =>
      recentUnlock.game.providerId === selection.providerId
      && recentUnlock.game.gameId === selection.gameId
      && recentUnlock.achievement.achievementId === selection.achievementId,
  );
  const matchingRecentAchievements = matchingRecentUnlocks.length > 0
    ? matchingRecentUnlocks
    : snapshot.recentAchievements.filter(
      (recentUnlock) =>
        recentUnlock.game.providerId === selection.providerId
        && recentUnlock.game.gameId === selection.gameId
        && recentUnlock.achievement.achievementId === selection.achievementId,
    );
  const matchingRecentlyPlayed = snapshot.recentlyPlayedGames.find(
    (game) => game.providerId === selection.providerId && game.gameId === selection.gameId,
  );
  const matchingFeaturedGame = snapshot.featuredGames.find(
    (game) => game.providerId === selection.providerId && game.gameId === selection.gameId,
  );
  const matchingAchievement = matchingRecentAchievements[0]?.achievement;
  const title = normalizeDisplayTitle(
    matchingAchievement?.title ?? selection.achievementTitle,
    "Unknown achievement",
  );
  const description = matchingAchievement?.description?.trim() && matchingAchievement.description.trim().length > 0
    ? matchingAchievement.description.trim()
    : "No cached description.";
  const summaryCards: SteamOSDashboardAchievementDetailCard[] = [
    {
      label: "Provider",
      value: resolveSteamOSDashboardGameProviderLabel(selection.providerId),
    },
    {
      label: "Game",
      value: normalizeDisplayTitle(matchingRecentlyPlayed?.title ?? matchingFeaturedGame?.title ?? selection.gameTitle, "Unknown game"),
    },
    {
      label: "Points",
      value: matchingAchievement?.points !== undefined ? `${formatCount(matchingAchievement.points)} points` : "—",
    },
    {
      label: "Unlock time",
      value: formatTimestampLabel(matchingAchievement?.unlockedAt ?? matchingRecentAchievements[0]?.unlockedAt) ?? "Unlock time unavailable.",
    },
    {
      label: "Status",
      value: matchingAchievement !== undefined ? (matchingAchievement.isUnlocked ? "Unlocked" : "Locked") : "Status unavailable.",
    },
  ];

  return {
    providerLabel: resolveSteamOSDashboardGameProviderLabel(selection.providerId),
    gameTitle: normalizeDisplayTitle(matchingRecentlyPlayed?.title ?? matchingFeaturedGame?.title ?? selection.gameTitle, "Unknown game"),
    title,
    summaryCards,
    descriptionTitle: "Cached description",
    description,
    achievementHistoryTitle: "Cached achievements / unlocks",
    recentAchievements: matchingRecentAchievements.slice(0, 5).map((recentUnlock) => ({
      title: normalizeDisplayTitle(recentUnlock.achievement.title, "Recent achievement"),
      metaLines: [
        `Game: ${normalizeDisplayTitle(recentUnlock.game.title, "Unknown game")}`,
        recentUnlock.achievement.points !== undefined ? `${formatCount(recentUnlock.achievement.points)} points` : undefined,
        recentUnlock.unlockedAt !== undefined ? `Unlocked ${formatTimestampLabel(recentUnlock.unlockedAt)}` : undefined,
      ].filter(isDefined),
    })),
  };
}

function buildFeaturedGamesSection(snapshot: DashboardSnapshot): SteamOSDashboardDetailSection {
  return {
    title: "Featured / play next",
    emptyState: "No featured games in the cached snapshot.",
    items: snapshot.featuredGames.slice(0, 3).map((game) => {
      const gameSelection = hasUsableCachedTitle(game.title)
        ? {
          providerId: game.providerId as SteamOSDashboardProviderId,
          gameId: game.gameId,
          gameTitle: normalizeDisplayTitle(game.title, "Featured game"),
        }
        : undefined;
      const metaLines = [
        `Status ${formatGameStatus(game.status)}`,
        game.summary.completionPercent !== undefined ? `Completion ${formatCount(game.summary.completionPercent)}%` : undefined,
        game.lastPlayedAt !== undefined ? `Last played ${formatTimestampLabel(game.lastPlayedAt)}` : undefined,
      ].filter(isDefined);
      const item: SteamOSDashboardDetailSectionItem = {
        title: normalizeDisplayTitle(game.title, "Featured game"),
        metaLines,
      };
      return gameSelection !== undefined ? { ...item, gameSelection } : item;
    }),
  };
}

function buildSteamOSDashboardDetailSections(snapshot: DashboardSnapshot): readonly SteamOSDashboardDetailSection[] {
  return [
    buildRecentAchievementsSection(snapshot),
    buildRecentlyPlayedSection(snapshot),
    buildFeaturedGamesSection(snapshot),
  ];
}

function resolveSteamOSDashboardGameProviderLabel(providerId: SteamOSDashboardProviderId): string {
  return providerId === STEAM_PROVIDER_ID ? "Steam" : "RetroAchievements";
}

export function buildSteamOSDashboardGameDetail(
  snapshot: DashboardSnapshot,
  selection: SteamOSDashboardGameDetailSelection,
): SteamOSDashboardGameDetail {
  const matchingRecentUnlocks = snapshot.recentUnlocks.filter(
    (recentUnlock) =>
      recentUnlock.game.providerId === selection.providerId && recentUnlock.game.gameId === selection.gameId,
  );
  const matchingRecentAchievements = matchingRecentUnlocks.length > 0
    ? matchingRecentUnlocks
    : snapshot.recentAchievements.filter(
      (recentUnlock) =>
        recentUnlock.game.providerId === selection.providerId && recentUnlock.game.gameId === selection.gameId,
    );
  const matchingRecentlyPlayed = snapshot.recentlyPlayedGames.find(
    (game) => game.providerId === selection.providerId && game.gameId === selection.gameId,
  );
  const matchingFeaturedGame = snapshot.featuredGames.find(
    (game) => game.providerId === selection.providerId && game.gameId === selection.gameId,
  );
  const title = normalizeDisplayTitle(
    matchingRecentlyPlayed?.title ?? matchingFeaturedGame?.title ?? selection.gameTitle,
    "Unknown game",
  );
  const completionPercent = matchingRecentlyPlayed?.summary.completionPercent ?? matchingFeaturedGame?.summary.completionPercent;
  const playtimeMinutes = matchingRecentlyPlayed?.playtimeForeverMinutes ?? matchingFeaturedGame?.playtimeForeverMinutes;
  const lastPlayedAt = matchingRecentlyPlayed?.lastPlayedAt ?? matchingFeaturedGame?.lastPlayedAt;
  const summaryCards: SteamOSDashboardGameDetailCard[] = [
    {
      label: "Provider",
      value: resolveSteamOSDashboardGameProviderLabel(selection.providerId),
    },
    {
      label: "Completion",
      value: completionPercent !== undefined ? `${formatCount(completionPercent)}%` : "\u2014",
    },
    {
      label: "Playtime",
      value: formatMinutes(playtimeMinutes) ?? "No cached playtime for this game.",
    },
    {
      label: "Last played",
      value: formatTimestampLabel(lastPlayedAt) ?? "\u2014",
    },
    {
      label: "Status",
      value: matchingFeaturedGame !== undefined ? formatGameStatus(matchingFeaturedGame.status) : "\u2014",
    },
  ];

  return {
    providerLabel: resolveSteamOSDashboardGameProviderLabel(selection.providerId),
    title,
    summaryCards,
    achievementTitle: "Cached achievements / unlocks",
    achievementEmptyState: "No cached achievements for this game.",
    recentAchievements: matchingRecentAchievements.slice(0, 5).map((recentUnlock) => ({
      title: normalizeDisplayTitle(recentUnlock.achievement.title, "Recent achievement"),
      achievementSelection: {
        providerId: recentUnlock.achievement.providerId as SteamOSDashboardProviderId,
        gameId: recentUnlock.game.gameId,
        gameTitle: normalizeDisplayTitle(recentUnlock.game.title, "Unknown game"),
        achievementId: recentUnlock.achievement.achievementId,
        achievementTitle: normalizeDisplayTitle(recentUnlock.achievement.title, "Recent achievement"),
      },
      metaLines: [
        `Game: ${normalizeDisplayTitle(recentUnlock.game.title, "Unknown game")}`,
        recentUnlock.achievement.points !== undefined ? `${formatCount(recentUnlock.achievement.points)} points` : undefined,
        recentUnlock.unlockedAt !== undefined ? `Unlocked ${formatTimestampLabel(recentUnlock.unlockedAt)}` : undefined,
      ].filter(isDefined),
    })),
  };
}

function selectSteamOSDashboardGameDetail(
  snapshot: DashboardSnapshot | undefined,
  selection: SteamOSDashboardGameDetailSelection | undefined,
): SteamOSDashboardGameDetail | undefined {
  if (selection === undefined || snapshot === undefined) {
    return undefined;
  }

  return buildSteamOSDashboardGameDetail(snapshot, selection);
}

function selectSteamOSDashboardAchievementDetail(
  snapshot: DashboardSnapshot | undefined,
  selection: SteamOSDashboardAchievementDetailSelection | undefined,
): SteamOSDashboardAchievementDetail | undefined {
  if (selection === undefined || snapshot === undefined) {
    return undefined;
  }

  return buildSteamOSDashboardAchievementDetail(snapshot, selection);
}

function SteamOSDashboardGameDetailSurface({
  detail,
  onOpenAchievementDetail,
}: {
  readonly detail: SteamOSDashboardGameDetail;
  readonly onOpenAchievementDetail: (selection: SteamOSDashboardAchievementDetailSelection) => void;
}): JSX.Element {
  return (
    <section aria-label={`${detail.title} cached game detail`} style={GAME_DETAIL_PANEL_STYLE}>
      <div style={GAME_DETAIL_HEADER_STYLE}>
        <div style={GAME_DETAIL_TITLE_ROW_STYLE}>
          <div style={SECTION_HEADER_STYLE}>
            <p style={EYEBROW_STYLE}>Cached game detail</p>
            <h4 style={GAME_DETAIL_TITLE_STYLE}>{detail.title}</h4>
          </div>
          <span style={GAME_DETAIL_BADGE_STYLE}>{detail.providerLabel}</span>
        </div>
        <p style={GAME_DETAIL_HELP_STYLE}>
          Read-only detail built from the cached dashboard snapshot. Dashboard refresh and Steam scans stay explicit.
        </p>
      </div>
      <div style={GAME_DETAIL_SUMMARY_GRID_STYLE}>
        {detail.summaryCards.map((card) => (
          <article key={card.label} style={GAME_DETAIL_SUMMARY_CARD_STYLE}>
            <p style={GAME_DETAIL_SUMMARY_LABEL_STYLE}>{card.label}</p>
            <p style={GAME_DETAIL_SUMMARY_VALUE_STYLE}>{card.value}</p>
          </article>
        ))}
      </div>
      <article aria-label={detail.achievementTitle} style={DETAIL_SECTION_STYLE}>
        <h5 style={DETAIL_TITLE_STYLE}>{detail.achievementTitle}</h5>
        {detail.recentAchievements.length > 0 ? (
          <div style={DETAIL_LIST_STYLE}>
            {detail.recentAchievements.map((item) => (
              item.achievementSelection !== undefined ? (
                <button
                  key={`${item.title}:${item.metaLines.join("|")}`}
                  className="steamos-focus-target steamos-button-target"
                  type="button"
                  style={DETAIL_CARD_BUTTON_STYLE}
                  onClick={() => onOpenAchievementDetail(item.achievementSelection as SteamOSDashboardAchievementDetailSelection)}
                  aria-label={`Open ${item.title} achievement detail`}
                >
                  <p style={DETAIL_CARD_TITLE_STYLE}>{item.title}</p>
                  {item.metaLines.map((line) => (
                    <p key={`${item.title}:${line}`} style={DETAIL_CARD_META_STYLE}>
                      {line}
                    </p>
                  ))}
                </button>
              ) : (
                <article key={`${item.title}:${item.metaLines.join("|")}`} style={DETAIL_CARD_STYLE}>
                  <p style={DETAIL_CARD_TITLE_STYLE}>{item.title}</p>
                  {item.metaLines.map((line) => (
                    <p key={`${item.title}:${line}`} style={DETAIL_CARD_META_STYLE}>
                      {line}
                    </p>
                  ))}
                </article>
              )
            ))}
          </div>
        ) : (
          <p style={DETAIL_EMPTY_STYLE}>{detail.achievementEmptyState}</p>
        )}
      </article>
    </section>
  );
}

function SteamOSDashboardAchievementDetailSurface({
  detail,
}: {
  readonly detail: SteamOSDashboardAchievementDetail;
}): JSX.Element {
  return (
    <section aria-label={`${detail.title} cached achievement detail`} style={GAME_DETAIL_PANEL_STYLE}>
      <div style={GAME_DETAIL_HEADER_STYLE}>
        <div style={GAME_DETAIL_TITLE_ROW_STYLE}>
          <div style={SECTION_HEADER_STYLE}>
            <p style={EYEBROW_STYLE}>Cached achievement detail</p>
            <h4 style={GAME_DETAIL_TITLE_STYLE}>{detail.title}</h4>
          </div>
          <span style={GAME_DETAIL_BADGE_STYLE}>{detail.providerLabel}</span>
        </div>
        <p style={GAME_DETAIL_HELP_STYLE}>
          Read-only achievement detail built from the cached dashboard snapshot. Dashboard refresh and Steam scans stay explicit.
        </p>
      </div>
      <div style={GAME_DETAIL_SUMMARY_GRID_STYLE}>
        {detail.summaryCards.map((card) => (
          <article key={card.label} style={GAME_DETAIL_SUMMARY_CARD_STYLE}>
            <p style={GAME_DETAIL_SUMMARY_LABEL_STYLE}>{card.label}</p>
            <p style={GAME_DETAIL_SUMMARY_VALUE_STYLE}>{card.value}</p>
          </article>
        ))}
      </div>
      <article aria-label={detail.descriptionTitle} style={DETAIL_SECTION_STYLE}>
        <h5 style={DETAIL_TITLE_STYLE}>{detail.descriptionTitle}</h5>
        <p style={DETAIL_EMPTY_STYLE}>{detail.description}</p>
      </article>
      <article aria-label={detail.achievementHistoryTitle} style={DETAIL_SECTION_STYLE}>
        <h5 style={DETAIL_TITLE_STYLE}>{detail.achievementHistoryTitle}</h5>
        {detail.recentAchievements.length > 0 ? (
          <div style={DETAIL_LIST_STYLE}>
            {detail.recentAchievements.map((item) => (
              <article key={`${item.title}:${item.metaLines.join("|")}`} style={DETAIL_CARD_STYLE}>
                <p style={DETAIL_CARD_TITLE_STYLE}>{item.title}</p>
                {item.metaLines.map((line) => (
                  <p key={`${item.title}:${line}`} style={DETAIL_CARD_META_STYLE}>
                    {line}
                  </p>
                ))}
              </article>
            ))}
          </div>
        ) : (
          <p style={DETAIL_EMPTY_STYLE}>No cached achievements for this game.</p>
        )}
      </article>
    </section>
  );
}

function getSteamLibraryScanGuidance(
  steamLibraryScanOverview: SteamOSSteamLibraryScanOverview | undefined,
  snapshot: DashboardSnapshot | undefined,
): string {
  if (steamLibraryScanOverview === undefined) {
    if (snapshot?.profile.summary.completionPercent !== undefined) {
      return "Library scan not run yet. Run a Steam library scan to unlock Owned Games and Perfect Games. Completion can still come from dashboard refresh data until the scan completes.";
    }

    return "Library scan not run yet. Run a Steam library scan to unlock Owned Games and Perfect Games.";
  }

  const scannedAt = formatScannedAt(steamLibraryScanOverview.scannedAt);
  if (scannedAt !== undefined) {
    return `Library scan totals cached ${scannedAt}. Last dashboard refresh stays separate from library scans.`;
  }

  return "Library scan totals are cached locally. Last dashboard refresh stays separate from library scans.";
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
  const [selectedGameDetail, setSelectedGameDetail] = useState<SteamOSDashboardGameDetailSelection | undefined>(
    props.initialSelectedGameDetail,
  );
  const [selectedAchievementDetail, setSelectedAchievementDetail] = useState<SteamOSDashboardAchievementDetailSelection | undefined>(
    props.initialSelectedAchievementDetail,
  );
  const [selectedAchievementReturnToGame, setSelectedAchievementReturnToGame] = useState<
    SteamOSDashboardGameDetailSelection | undefined
  >(props.initialSelectedGameDetail);
  const selectedProviderIdRef = useRef<SteamOSDashboardProviderId>(selectedProviderId);
  const backToDashboardButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (props.selectedProviderId !== undefined) {
      setSelectedProviderId(props.selectedProviderId);
    }
  }, [props.selectedProviderId]);

  useEffect(() => {
    if (props.initialSelectedGameDetail !== undefined) {
      setSelectedGameDetail(props.initialSelectedGameDetail);
    }
  }, [props.initialSelectedGameDetail]);

  useEffect(() => {
    if (props.initialSelectedAchievementDetail !== undefined) {
      setSelectedAchievementDetail(props.initialSelectedAchievementDetail);
    }
  }, [props.initialSelectedAchievementDetail]);

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

  useEffect(() => {
    if (selectedProviderIdRef.current !== selectedProviderId) {
      selectedProviderIdRef.current = selectedProviderId;
      setSelectedGameDetail(undefined);
      setSelectedAchievementDetail(undefined);
      setSelectedAchievementReturnToGame(undefined);
    }
  }, [selectedProviderId]);

  const selectedStatusKey = mapProviderIdToStatusKey(selectedProviderId);
  const selectedStateKey = mapProviderIdToStateKey(selectedProviderId);
  const selectedProviderLabel = props.providerStatuses?.[selectedStatusKey].label
    ?? (selectedProviderId === STEAM_PROVIDER_ID ? "Steam" : "RetroAchievements");
  const selectedProviderState = providerStates[selectedStateKey];
  const isSteamProviderSelected = selectedProviderId === STEAM_PROVIDER_ID;
  const canScanSteamLibrary = isSteamProviderSelected && selectedProviderState.status !== "setup_required" && selectedProviderState.status !== "setup_incomplete" && selectedProviderState.status !== "unavailable";

  const summaryCards = useMemo(
    () => (
      selectedProviderState.snapshot !== undefined
        ? buildSteamOSDashboardSummaryCards(
          selectedProviderState.snapshot,
          isSteamProviderSelected ? props.steamLibraryScanOverview : undefined,
        )
        : []
    ),
    [isSteamProviderSelected, props.steamLibraryScanOverview, selectedProviderState.snapshot],
  );
  const detailSections = useMemo(
    () => (selectedProviderState.snapshot !== undefined ? buildSteamOSDashboardDetailSections(selectedProviderState.snapshot) : []),
    [selectedProviderState.snapshot],
  );
  const selectedGameDetailSnapshot = useMemo(
    () => selectSteamOSDashboardGameDetail(selectedProviderState.snapshot, selectedGameDetail),
    [selectedGameDetail, selectedProviderState.snapshot],
  );
  const selectedAchievementDetailSnapshot = useMemo(
    () => selectSteamOSDashboardAchievementDetail(selectedProviderState.snapshot, selectedAchievementDetail),
    [selectedAchievementDetail, selectedProviderState.snapshot],
  );

  useEffect(() => {
    if (selectedGameDetailSnapshot === undefined && selectedAchievementDetailSnapshot === undefined) {
      return;
    }

    backToDashboardButtonRef.current?.focus();
  }, [selectedAchievementDetailSnapshot, selectedGameDetailSnapshot]);

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

  function handleOpenGameDetail(selection: SteamOSDashboardGameDetailSelection): void {
    setSelectedProviderId(selection.providerId);
    setSelectedGameDetail(selection);
    setSelectedAchievementDetail(undefined);
    setSelectedAchievementReturnToGame(undefined);
    props.onSelectedProviderIdChange?.(selection.providerId);
  }

  function handleOpenAchievementDetail(selection: SteamOSDashboardAchievementDetailSelection): void {
    setSelectedProviderId(selection.providerId);
    setSelectedAchievementDetail(selection);
    setSelectedAchievementReturnToGame(selectedGameDetail);
    props.onSelectedProviderIdChange?.(selection.providerId);
  }

  function handleBackToDashboard(): void {
    if (selectedAchievementReturnToGame !== undefined) {
      setSelectedGameDetail(selectedAchievementReturnToGame);
    } else {
      setSelectedGameDetail(undefined);
    }

    setSelectedAchievementDetail(undefined);
    setSelectedAchievementReturnToGame(undefined);
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
          and Steam library scans are not triggered from this surface unless you ask for one explicitly.
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
            <div className="steamos-action-row" style={HEADER_ACTIONS_STYLE}>
              {selectedGameDetailSnapshot === undefined && selectedAchievementDetailSnapshot === undefined && canScanSteamLibrary && props.onScanSteamLibrary !== undefined ? (
                <button
                  className="steamos-focus-target steamos-button-target"
                  type="button"
                  style={UNSELECTED_PROVIDER_BUTTON_STYLE}
                  disabled={props.isSteamLibraryScanning === true}
                  onClick={() => void props.onScanSteamLibrary?.()}
                  aria-label="Scan Steam library"
                >
                  {props.isSteamLibraryScanning === true ? "Scanning Steam library..." : "Scan Steam library"}
                </button>
              ) : null}
              {selectedGameDetailSnapshot === undefined && selectedAchievementDetailSnapshot === undefined ? (
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
              ) : (
                <button
                  className="steamos-focus-target steamos-button-target"
                  type="button"
                  ref={backToDashboardButtonRef}
                  autoFocus
                  style={UNSELECTED_PROVIDER_BUTTON_STYLE}
                  onClick={handleBackToDashboard}
                  aria-label={selectedAchievementDetailSnapshot !== undefined && selectedAchievementReturnToGame !== undefined ? "Back to game" : "Back to dashboard"}
                >
                  {selectedAchievementDetailSnapshot !== undefined && selectedAchievementReturnToGame !== undefined ? "Back to game" : "Back to dashboard"}
                </button>
              )}
            </div>
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
            {isSteamProviderSelected && canScanSteamLibrary ? (
              <>
                <p style={SCAN_NOTE_STYLE}>
                  Run a Steam library scan to unlock Owned Games and Perfect Games. It may take longer than a dashboard refresh, and dashboard refresh stays scan-free.
                </p>
                <p style={SCAN_META_STYLE}>
                  {getSteamLibraryScanGuidance(props.steamLibraryScanOverview, selectedProviderState.snapshot)}
                </p>
                {props.steamLibraryScanMessage !== undefined ? (
                  <p role="status" aria-live="polite" style={SCAN_META_STYLE}>{props.steamLibraryScanMessage}</p>
                ) : null}
                {props.steamLibraryScanErrorMessage !== undefined ? (
                  <p role="alert" style={ERROR_TEXT_STYLE}>{props.steamLibraryScanErrorMessage}</p>
                ) : null}
              </>
            ) : null}
          </div>
          {selectedProviderState.status === "cached" ? (
            selectedAchievementDetailSnapshot !== undefined ? (
              <SteamOSDashboardAchievementDetailSurface detail={selectedAchievementDetailSnapshot} />
            ) : selectedGameDetailSnapshot !== undefined ? (
              <SteamOSDashboardGameDetailSurface
                detail={selectedGameDetailSnapshot}
                onOpenAchievementDetail={handleOpenAchievementDetail}
              />
            ) : (
            <>
              <p style={META_TEXT_STYLE}>
                {formatRefreshedAt(selectedProviderState.snapshot) !== undefined
                  ? `Last dashboard refresh ${formatRefreshedAt(selectedProviderState.snapshot)}`
                  : "Last dashboard refresh unavailable"}
              </p>
              <div style={SUMMARY_GRID_STYLE}>
                {summaryCards.map((card) => (
                  <article key={card.label} style={SUMMARY_CARD_STYLE}>
                    <p style={SUMMARY_LABEL_STYLE}>{card.label}</p>
                    <p style={SUMMARY_VALUE_STYLE}>{card.value}</p>
                  </article>
                ))}
              </div>
              <div style={DETAIL_GRID_STYLE}>
                {detailSections.map((section) => (
                  <article key={section.title} aria-label={section.title} style={DETAIL_SECTION_STYLE}>
                    <h4 style={DETAIL_TITLE_STYLE}>{section.title}</h4>
                    {section.items.length > 0 ? (
                      <div style={DETAIL_LIST_STYLE}>
                        {section.items.map((item) => (
                          item.achievementSelection !== undefined ? (
                            <button
                              key={`${section.title}:${item.title}:${item.metaLines.join("|")}`}
                              className="steamos-focus-target steamos-button-target"
                              type="button"
                              style={DETAIL_CARD_BUTTON_STYLE}
                              onClick={() => handleOpenAchievementDetail(item.achievementSelection as SteamOSDashboardAchievementDetailSelection)}
                              aria-label={`Open ${item.title} achievement detail`}
                            >
                              <p style={DETAIL_CARD_TITLE_STYLE}>{item.title}</p>
                              {item.metaLines.map((line) => (
                                <p key={`${section.title}:${item.title}:${line}`} style={DETAIL_CARD_META_STYLE}>
                                  {line}
                                </p>
                              ))}
                            </button>
                          ) : item.gameSelection !== undefined ? (
                            <button
                              key={`${section.title}:${item.title}:${item.metaLines.join("|")}`}
                              className="steamos-focus-target steamos-button-target"
                              type="button"
                              style={DETAIL_CARD_BUTTON_STYLE}
                              onClick={() => handleOpenGameDetail(item.gameSelection as SteamOSDashboardGameDetailSelection)}
                              aria-label={`Open ${item.title} cached game detail`}
                            >
                              <p style={DETAIL_CARD_TITLE_STYLE}>{item.title}</p>
                              {item.metaLines.map((line) => (
                                <p key={`${section.title}:${item.title}:${line}`} style={DETAIL_CARD_META_STYLE}>
                                  {line}
                                </p>
                              ))}
                            </button>
                          ) : (
                            <article key={`${section.title}:${item.title}:${item.metaLines.join("|")}`} style={DETAIL_CARD_STYLE}>
                              <p style={DETAIL_CARD_TITLE_STYLE}>{item.title}</p>
                              {item.metaLines.map((line) => (
                                <p key={`${section.title}:${item.title}:${line}`} style={DETAIL_CARD_META_STYLE}>
                                  {line}
                                </p>
                              ))}
                            </article>
                          )
                        ))}
                      </div>
                    ) : (
                      <p style={DETAIL_EMPTY_STYLE}>{section.emptyState}</p>
                    )}
                  </article>
                ))}
              </div>
            </>
            )
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
