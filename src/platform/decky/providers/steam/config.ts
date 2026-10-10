import { useMemo, useSyncExternalStore } from "react";
import type { SteamLibraryScanStore } from "@core/platform";
import {
  readDeckyStorageText,
  removeDeckyStorageText,
  removeDeckyStorageTextsByPrefix,
  writeDeckyStorageText,
  writeDeckyStorageTextPreservingExisting,
} from "../../storage";
import { clearDeckyDashboardSnapshot } from "../../decky-dashboard-snapshot-cache";
import { clearDeckySteamGameDetailCache } from "../../decky-steam-game-detail-cache";
import type { ProviderId } from "@core/domain";
import {
  STEAM_PROVIDER_ID,
  type SteamProviderConfig,
} from "../../../../providers/steam/config";
import { normalizeSteamArtworkUrl } from "../../../../providers/steam/artwork";
import type { RawSteamSchemaAchievement } from "../../../../providers/steam/raw-types";
import {
  clearDeckySteamAccountState as clearDeckySteamAccountStateFromStore,
  loadDeckyProviderConfig as loadDeckyProviderConfigFromStore,
  readDeckyProviderConfig as readDeckyProviderConfigFromStore,
  saveDeckySteamCredentials,
  type DeckyProviderConfigs,
  useDeckyProviderConfig as useDeckyProviderConfigFromStore,
  updateDeckyProviderConfigCache,
} from "../provider-config-store";
import {
  clearSteamConnectionState,
  readSteamConnectionState,
  validateAndSaveSteamConfiguration,
  type SteamCredentialSaveResult,
} from "./connection";

export type { SteamProviderConfig } from "../../../../providers/steam/config";
export type { DeckyProviderConfigs };
export type SteamLibraryAchievementScanSummary = import("../../../../providers/steam/library-scan").SteamLibraryAchievementScanSummary;
export type SteamLibraryAchievementScanOverview = Pick<
  SteamLibraryAchievementScanSummary,
  | "ownedGameCount"
  | "scannedGameCount"
  | "gamesWithAchievements"
  | "unlockedAchievements"
  | "totalAchievements"
  | "perfectGames"
  | "completionPercent"
  | "scannedAt"
  | "lastRecentActivityRefreshAt"
>;

const STEAM_LIBRARY_ACHIEVEMENT_SCAN_SUMMARY_STORAGE_KEY =
  "achievement-companion:decky:steam:library-achievement-scan-summary";
const STEAM_LIBRARY_ACHIEVEMENT_SCAN_OVERVIEW_STORAGE_KEY =
  "achievement-companion:decky:steam:library-achievement-scan-overview";
const LEGACY_STEAM_LIBRARY_ACHIEVEMENT_SCAN_SUMMARY_STORAGE_KEY =
  "achievement-companion:decky:steam:library-achievement-scan";
const DECKY_RECENT_ACHIEVEMENTS_STORAGE_KEY_PREFIX =
  "achievement-companion:decky:recent-achievements:steam:";
const DECKY_STEAM_ACHIEVEMENT_SCHEMA_CACHE_KEY_PREFIX =
  "achievement-companion:decky:steam:achievement-schema:";

type SteamLibraryAchievementScanSummaryListener = () => void;
type SteamLibraryAchievementScanOverviewListener = () => void;

let steamLibraryAchievementScanSummaryRevision = 0;
let cachedSteamLibraryAchievementScanSummary: SteamLibraryAchievementScanSummary | undefined;
const steamLibraryAchievementScanSummaryListeners = new Set<SteamLibraryAchievementScanSummaryListener>();
let steamLibraryAchievementScanOverviewRevision = 0;
let cachedSteamLibraryAchievementScanOverview: SteamLibraryAchievementScanOverview | undefined;
const steamLibraryAchievementScanOverviewListeners =
  new Set<SteamLibraryAchievementScanOverviewListener>();

function notifySteamLibraryAchievementScanSummaryChanged(): void {
  steamLibraryAchievementScanSummaryRevision += 1;

  for (const listener of steamLibraryAchievementScanSummaryListeners) {
    listener();
  }
}

function subscribeSteamLibraryAchievementScanSummary(
  listener: SteamLibraryAchievementScanSummaryListener,
): () => void {
  steamLibraryAchievementScanSummaryListeners.add(listener);
  return () => {
    steamLibraryAchievementScanSummaryListeners.delete(listener);
  };
}

function notifySteamLibraryAchievementScanOverviewChanged(): void {
  steamLibraryAchievementScanOverviewRevision += 1;

  for (const listener of steamLibraryAchievementScanOverviewListeners) {
    listener();
  }
}

function subscribeSteamLibraryAchievementScanOverview(
  listener: SteamLibraryAchievementScanOverviewListener,
): () => void {
  steamLibraryAchievementScanOverviewListeners.add(listener);
  return () => {
    steamLibraryAchievementScanOverviewListeners.delete(listener);
  };
}

function coerceSteamLibraryAchievementScanSummary(
  value: unknown,
): SteamLibraryAchievementScanSummary | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  return value as SteamLibraryAchievementScanSummary;
}

function readSteamLibraryAchievementScanSummaryFromStorage():
  | SteamLibraryAchievementScanSummary
  | undefined {
  const rawValue =
    readDeckyStorageText(STEAM_LIBRARY_ACHIEVEMENT_SCAN_SUMMARY_STORAGE_KEY) ??
    readDeckyStorageText(LEGACY_STEAM_LIBRARY_ACHIEVEMENT_SCAN_SUMMARY_STORAGE_KEY);
  if (rawValue === undefined) {
    return undefined;
  }

  try {
    const summary = coerceSteamLibraryAchievementScanSummary(JSON.parse(rawValue));
    if (summary !== undefined) {
      writeDeckyStorageText(
        STEAM_LIBRARY_ACHIEVEMENT_SCAN_SUMMARY_STORAGE_KEY,
        JSON.stringify(summary),
      );
      removeDeckyStorageText(LEGACY_STEAM_LIBRARY_ACHIEVEMENT_SCAN_SUMMARY_STORAGE_KEY);
    }

    return summary;
  } catch {
    return undefined;
  }
}

function cacheSteamLibraryAchievementScanSummary(
  summary: SteamLibraryAchievementScanSummary | undefined,
): void {
  cachedSteamLibraryAchievementScanSummary = summary;
  notifySteamLibraryAchievementScanSummaryChanged();
}

function cacheSteamLibraryAchievementScanOverview(
  overview: SteamLibraryAchievementScanOverview | undefined,
): void {
  cachedSteamLibraryAchievementScanOverview = overview;
  notifySteamLibraryAchievementScanOverviewChanged();
}

function clampCompletionPercent(unlockedAchievements: number, totalAchievements: number): number {
  if (totalAchievements <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round((unlockedAchievements / totalAchievements) * 100)),
  );
}

function normalizeSteamLibraryAchievementScanSummary(
  summary: SteamLibraryAchievementScanSummary,
): SteamLibraryAchievementScanSummary {
  const appIdByGameId = new Map<string, number>();
  const games = summary.games.map((game) => {
    const parsedAppId = Number.parseInt(game.gameId, 10);
    const inferredAppId = Number.isFinite(parsedAppId) ? parsedAppId : undefined;
    const appId = game.appid ?? inferredAppId;
    if (appId !== undefined) {
      appIdByGameId.set(game.gameId, appId);
    }

    const normalizedCompletionPercent = clampCompletionPercent(
      game.unlockedAchievements,
      game.totalAchievements,
    );
    const normalizedIconUrl = normalizeSteamArtworkUrl(game.iconUrl, appId);

    return {
      ...game,
      providerId: game.providerId ?? STEAM_PROVIDER_ID,
      ...(appId !== undefined ? { appid: appId } : {}),
      platformLabel: game.platformLabel ?? "Steam",
      ...(normalizedIconUrl !== undefined ? { iconUrl: normalizedIconUrl } : {}),
      completionPercent: normalizedCompletionPercent,
    };
  });

  const unlockedAchievementsList = summary.unlockedAchievementsList?.map((unlock) => {
    const normalizedGameIconUrl = normalizeSteamArtworkUrl(
      unlock.gameIconUrl,
      appIdByGameId.get(unlock.gameId),
    );

    return {
      ...unlock,
      providerId: unlock.providerId ?? STEAM_PROVIDER_ID,
      ...(normalizedGameIconUrl !== undefined ? { gameIconUrl: normalizedGameIconUrl } : {}),
    };
  });

  return {
    ...summary,
    completionPercent: clampCompletionPercent(
      summary.unlockedAchievements,
      summary.totalAchievements,
    ),
    games,
    ...(unlockedAchievementsList !== undefined ? { unlockedAchievementsList } : {}),
  };
}

function normalizeSteamLibraryAchievementScanOverview(
  summary: SteamLibraryAchievementScanSummary,
): SteamLibraryAchievementScanOverview {
  return {
    ownedGameCount: summary.ownedGameCount,
    scannedGameCount: summary.scannedGameCount,
    gamesWithAchievements: summary.gamesWithAchievements,
    unlockedAchievements: summary.unlockedAchievements,
    totalAchievements: summary.totalAchievements,
    perfectGames: summary.perfectGames,
    completionPercent: summary.completionPercent,
    scannedAt: summary.scannedAt,
    ...(summary.lastRecentActivityRefreshAt !== undefined
      ? { lastRecentActivityRefreshAt: summary.lastRecentActivityRefreshAt }
      : {}),
  };
}

function readSteamLibraryAchievementScanOverviewFromStorage():
  | SteamLibraryAchievementScanOverview
  | undefined {
  const rawValue = readDeckyStorageText(STEAM_LIBRARY_ACHIEVEMENT_SCAN_OVERVIEW_STORAGE_KEY);
  if (rawValue === undefined) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return undefined;
    }

    const record = parsed as Record<string, unknown>;
    if (typeof record["scannedAt"] !== "string") {
      return undefined;
    }

    if (
      typeof record["ownedGameCount"] !== "number" ||
      typeof record["scannedGameCount"] !== "number" ||
      typeof record["gamesWithAchievements"] !== "number" ||
      typeof record["unlockedAchievements"] !== "number" ||
      typeof record["totalAchievements"] !== "number" ||
      typeof record["perfectGames"] !== "number" ||
      typeof record["completionPercent"] !== "number"
    ) {
      return undefined;
    }

    return {
      ownedGameCount: record["ownedGameCount"],
      scannedGameCount: record["scannedGameCount"],
      gamesWithAchievements: record["gamesWithAchievements"],
      unlockedAchievements: record["unlockedAchievements"],
      totalAchievements: record["totalAchievements"],
      perfectGames: record["perfectGames"],
      completionPercent: record["completionPercent"],
      scannedAt: record["scannedAt"],
      ...(typeof record["lastRecentActivityRefreshAt"] === "string"
        ? { lastRecentActivityRefreshAt: record["lastRecentActivityRefreshAt"] }
        : {}),
    };
  } catch {
    return undefined;
  }
}

function writeSteamLibraryAchievementScanOverview(
  overview: SteamLibraryAchievementScanOverview,
): void {
  const didWrite = writeDeckyStorageText(
    STEAM_LIBRARY_ACHIEVEMENT_SCAN_OVERVIEW_STORAGE_KEY,
    JSON.stringify(overview),
  );

  if (!didWrite) {
    removeDeckyStorageText(STEAM_LIBRARY_ACHIEVEMENT_SCAN_OVERVIEW_STORAGE_KEY);
  }
}

export const deckySteamLibraryScanStore: SteamLibraryScanStore<
  SteamLibraryAchievementScanOverview,
  SteamLibraryAchievementScanSummary
> = {
  async readOverview(providerId) {
    return readDeckySteamLibraryAchievementScanOverview(providerId);
  },
  async writeOverview(_providerId, overview) {
    writeSteamLibraryAchievementScanOverview(overview);
  },
  async readSummary(providerId) {
    return readDeckySteamLibraryAchievementScanSummary(providerId);
  },
  async writeSummary(_providerId, summary) {
    writeDeckySteamLibraryAchievementScanSummary(summary);
  },
  async clear(providerId) {
    return providerId !== STEAM_PROVIDER_ID ? false : clearDeckySteamLibraryAchievementScanSummary();
  },
};

export function readDeckyProviderConfig(providerId: ProviderId): SteamProviderConfig | undefined {
  return providerId === STEAM_PROVIDER_ID
    ? (readDeckyProviderConfigFromStore(providerId) as SteamProviderConfig | undefined)
    : undefined;
}

export function useDeckyProviderConfig(
  providerId: ProviderId | undefined,
): SteamProviderConfig | undefined {
  return providerId === STEAM_PROVIDER_ID
    ? (useDeckyProviderConfigFromStore(providerId) as SteamProviderConfig | undefined)
    : undefined;
}

export async function loadDeckyProviderConfig(
  providerId: ProviderId,
): Promise<SteamProviderConfig | undefined> {
  return providerId === STEAM_PROVIDER_ID
    ? (await loadDeckyProviderConfigFromStore(providerId)) as SteamProviderConfig | undefined
    : undefined;
}

export async function writeDeckySteamProviderConfig(
  config: Omit<SteamProviderConfig, "hasApiKey">,
  apiKeyDraft: string,
): Promise<boolean> {
  return (await writeValidatedDeckySteamProviderConfig(config, apiKeyDraft)).saved;
}

export async function writeValidatedDeckySteamProviderConfig(
  config: Omit<SteamProviderConfig, "hasApiKey">,
  apiKeyDraft: string,
): Promise<SteamCredentialSaveResult> {
  const previousSteamConfig = await loadDeckyProviderConfigFromStore(STEAM_PROVIDER_ID) as SteamProviderConfig | undefined;
  let result: SteamCredentialSaveResult;
  if (apiKeyDraft.trim().length === 0) {
    const saved = await saveDeckySteamCredentials({
      steamId64: config.steamId64,
      language: config.language,
      recentAchievementsCount: config.recentAchievementsCount,
      recentlyPlayedCount: config.recentlyPlayedCount,
      apiKeyDraft,
    });
    result = {
      saved: saved !== undefined,
      userMessage: saved !== undefined ? "Provider settings saved." : "Unable to save provider settings right now.",
      connectionState: readSteamConnectionState(),
    };
  } else {
    result = await validateAndSaveSteamConfiguration({ config, apiKeyDraft, save: saveDeckySteamCredentials });
  }
  if (result.saved) {
    clearDeckySteamGameDetailCache();
    if (
      previousSteamConfig?.steamId64 !== undefined &&
      previousSteamConfig.steamId64 !== config.steamId64
    ) {
      clearDeckySteamLibraryAchievementScanSummary();
      clearDeckyDashboardSnapshot(STEAM_PROVIDER_ID);
      removeDeckyStorageTextsByPrefix(DECKY_RECENT_ACHIEVEMENTS_STORAGE_KEY_PREFIX);
      clearDeckySteamAchievementSchemaCache();
    }
  }
  return result;
}

export async function clearDeckySteamProviderConfig(): Promise<boolean> {
  const cleared = await clearDeckySteamAccountStateFromStore();
  if (cleared) {
    clearSteamConnectionState();
    clearDeckySteamLibraryAchievementScanSummary();
    removeDeckyStorageTextsByPrefix(DECKY_RECENT_ACHIEVEMENTS_STORAGE_KEY_PREFIX);
    clearDeckyDashboardSnapshot(STEAM_PROVIDER_ID);
    clearDeckySteamGameDetailCache();
  }

  return cleared;
}

export async function clearDeckySteamAccountState(): Promise<boolean> {
  const cleared = await clearDeckySteamAccountStateFromStore();
  if (cleared) {
    clearSteamConnectionState();
    clearDeckySteamLibraryAchievementScanSummary();
    removeDeckyStorageTextsByPrefix(DECKY_RECENT_ACHIEVEMENTS_STORAGE_KEY_PREFIX);
    clearDeckyDashboardSnapshot(STEAM_PROVIDER_ID);
    clearDeckySteamGameDetailCache();
  }

  return cleared;
}

export function readDeckySteamLibraryAchievementScanSummary(
  providerId: ProviderId,
): SteamLibraryAchievementScanSummary | undefined {
  if (providerId !== STEAM_PROVIDER_ID) {
    return undefined;
  }

  if (cachedSteamLibraryAchievementScanSummary !== undefined) {
    return cachedSteamLibraryAchievementScanSummary;
  }

  const loadedSummary = readSteamLibraryAchievementScanSummaryFromStorage();
  if (loadedSummary !== undefined) {
    cachedSteamLibraryAchievementScanSummary = normalizeSteamLibraryAchievementScanSummary(loadedSummary);
    const normalizedOverview = normalizeSteamLibraryAchievementScanOverview(
      cachedSteamLibraryAchievementScanSummary,
    );
    cachedSteamLibraryAchievementScanOverview = normalizedOverview;
    writeSteamLibraryAchievementScanOverview(normalizedOverview);
  }

  return cachedSteamLibraryAchievementScanSummary;
}

export function readDeckySteamLibraryAchievementScanOverview(
  providerId: ProviderId,
): SteamLibraryAchievementScanOverview | undefined {
  if (providerId !== STEAM_PROVIDER_ID) {
    return undefined;
  }

  if (cachedSteamLibraryAchievementScanOverview !== undefined) {
    return cachedSteamLibraryAchievementScanOverview;
  }

  const loadedOverview = readSteamLibraryAchievementScanOverviewFromStorage();
  if (loadedOverview !== undefined) {
    cachedSteamLibraryAchievementScanOverview = loadedOverview;
  }

  return cachedSteamLibraryAchievementScanOverview;
}

export function useDeckySteamLibraryAchievementScanSummary(
  providerId: ProviderId | undefined,
): SteamLibraryAchievementScanSummary | undefined {
  const revision = useSyncExternalStore(
    subscribeSteamLibraryAchievementScanSummary,
    () => steamLibraryAchievementScanSummaryRevision,
    () => steamLibraryAchievementScanSummaryRevision,
  );

  return useMemo(() => {
    if (providerId !== STEAM_PROVIDER_ID) {
      return undefined;
    }

    const summary = readDeckySteamLibraryAchievementScanSummary(providerId);
    return summary;
  }, [providerId, revision]);
}

export function useDeckySteamLibraryAchievementScanOverview(
  providerId: ProviderId | undefined,
): SteamLibraryAchievementScanOverview | undefined {
  const revision = useSyncExternalStore(
    subscribeSteamLibraryAchievementScanOverview,
    () => steamLibraryAchievementScanOverviewRevision,
    () => steamLibraryAchievementScanOverviewRevision,
  );

  return useMemo(() => {
    if (providerId !== STEAM_PROVIDER_ID) {
      return undefined;
    }

    return readDeckySteamLibraryAchievementScanOverview(providerId);
  }, [providerId, revision]);
}

export function writeDeckySteamLibraryAchievementScanSummary(
  summary: SteamLibraryAchievementScanSummary,
): boolean {
  const normalizedSummary = normalizeSteamLibraryAchievementScanSummary(summary);
  const normalizedOverview = normalizeSteamLibraryAchievementScanOverview(normalizedSummary);
  const persistedSummary = stripSteamLibraryAchievementSchemas(normalizedSummary);
  const didWrite = writeDeckyStorageTextPreservingExisting(
    STEAM_LIBRARY_ACHIEVEMENT_SCAN_SUMMARY_STORAGE_KEY,
    JSON.stringify(persistedSummary),
  );

  if (!didWrite) {
    console.warn("[Achievement Companion][Steam] Unable to persist library summary; previous cache retained");
    return false;
  }

  writeSteamLibraryAchievementScanOverview(normalizedOverview);

  removeDeckyStorageText(LEGACY_STEAM_LIBRARY_ACHIEVEMENT_SCAN_SUMMARY_STORAGE_KEY);

  cacheSteamLibraryAchievementScanSummary(persistedSummary);
  cacheSteamLibraryAchievementScanOverview(normalizedOverview);
  return true;
}

export function getDeckySteamLibraryAchievementScanRevision(): number {
  return steamLibraryAchievementScanSummaryRevision;
}

export function writeDeckySteamLibraryAchievementScanSummaryIfRevisionMatches(
  expectedRevision: number,
  summary: SteamLibraryAchievementScanSummary,
): boolean {
  if (steamLibraryAchievementScanSummaryRevision !== expectedRevision) {
    return false;
  }
  const activeSteamConfig = readDeckyProviderConfigFromStore(STEAM_PROVIDER_ID) as SteamProviderConfig | undefined;
  if (
    activeSteamConfig?.steamId64 !== undefined &&
    summary.steamId64 !== undefined &&
    summary.steamId64 !== activeSteamConfig.steamId64
  ) {
    return false;
  }
  return writeDeckySteamLibraryAchievementScanSummary(summary);
}

function stripSteamLibraryAchievementSchemas(
  summary: SteamLibraryAchievementScanSummary,
): SteamLibraryAchievementScanSummary {
  return {
    ...summary,
    games: summary.games.map((game) => {
      if (game.achievementSchema === undefined) {
        return game;
      }
      const { achievementSchema: _schema, ...lightweightGame } = game;
      return lightweightGame;
    }),
  };
}

function getSteamAchievementSchemaCacheKey(steamId64: string, appId: number): string {
  return `${DECKY_STEAM_ACHIEVEMENT_SCHEMA_CACHE_KEY_PREFIX}${steamId64}:${String(appId)}`;
}

export function readDeckySteamAchievementSchemaCache(
  steamId64: string,
  appId: number,
): readonly RawSteamSchemaAchievement[] | undefined {
  const rawValue = readDeckyStorageText(getSteamAchievementSchemaCacheKey(steamId64, appId));
  if (rawValue === undefined) {
    return undefined;
  }
  try {
    const value = JSON.parse(rawValue) as unknown;
    if (
      !Array.isArray(value) ||
      !value.every((entry) =>
        typeof entry === "object" && entry !== null && typeof (entry as Record<string, unknown>)["name"] === "string")
    ) {
      return undefined;
    }
    return value as readonly RawSteamSchemaAchievement[];
  } catch {
    return undefined;
  }
}

export function writeDeckySteamAchievementSchemaCache(
  steamId64: string,
  appId: number,
  achievements: readonly RawSteamSchemaAchievement[],
): boolean {
  const didWrite = writeDeckyStorageTextPreservingExisting(
    getSteamAchievementSchemaCacheKey(steamId64, appId),
    JSON.stringify(achievements),
  );
  if (!didWrite) {
    console.warn("[Achievement Companion][Steam] Unable to persist static achievement schema", {
      appId,
    });
  }
  return didWrite;
}

export function clearDeckySteamAchievementSchemaCache(): boolean {
  return removeDeckyStorageTextsByPrefix(DECKY_STEAM_ACHIEVEMENT_SCHEMA_CACHE_KEY_PREFIX);
}

export function clearDeckySteamLibraryAchievementScanSummary(): boolean {
  cachedSteamLibraryAchievementScanSummary = undefined;
  notifySteamLibraryAchievementScanSummaryChanged();
  cachedSteamLibraryAchievementScanOverview = undefined;
  notifySteamLibraryAchievementScanOverviewChanged();
  const removedCurrent = removeDeckyStorageText(STEAM_LIBRARY_ACHIEVEMENT_SCAN_SUMMARY_STORAGE_KEY);
  const removedOverview = removeDeckyStorageText(STEAM_LIBRARY_ACHIEVEMENT_SCAN_OVERVIEW_STORAGE_KEY);
  const removedLegacy = removeDeckyStorageText(
    LEGACY_STEAM_LIBRARY_ACHIEVEMENT_SCAN_SUMMARY_STORAGE_KEY,
  );
  return removedCurrent || removedOverview || removedLegacy;
}

export const readDeckySteamProviderConfig = readDeckyProviderConfig;
export const useDeckySteamProviderConfig = useDeckyProviderConfig;
export const loadDeckySteamProviderConfig = loadDeckyProviderConfig;

export { updateDeckyProviderConfigCache };
