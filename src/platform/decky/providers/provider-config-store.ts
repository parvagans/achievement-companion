import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { ProviderId } from "@core/domain";
import {
  RETROACHIEVEMENTS_PROVIDER_ID,
  type RetroAchievementsProviderConfig,
  normalizeRetroAchievementsProviderConfig,
} from "../../../providers/retroachievements/config";
import {
  STEAM_PROVIDER_ID,
  type SteamProviderConfig,
  normalizeSteamProviderConfig,
} from "../../../providers/steam/config";
import { readDeckyStorageText, removeDeckyStorageText } from "../storage";
import { callDeckyBackendMethod } from "../decky-backend-bridge";
import { clearDeckyDashboardSnapshot } from "../decky-dashboard-snapshot-cache";

const RETROACHIEVEMENTS_CONFIG_STORAGE_KEY = "achievement-companion:decky:retroachievements:config";
const STEAM_CONFIG_STORAGE_KEY = "achievement-companion:decky:steam:config";

export type DeckyProviderConfigs = Readonly<{
  readonly retroAchievements?: RetroAchievementsProviderConfig;
  readonly steam?: SteamProviderConfig;
}>;

interface LegacyRetroAchievementsConfigRecord {
  readonly username?: unknown;
  readonly apiKey?: unknown;
}

interface LegacySteamConfigRecord {
  readonly steamId64?: unknown;
  readonly apiKey?: unknown;
  readonly language?: unknown;
  readonly recentAchievementsCount?: unknown;
  readonly recentlyPlayedCount?: unknown;
  readonly includePlayedFreeGames?: unknown;
}

type DeckyProviderConfigListener = () => void;

let deckyProviderConfigRevision = 0;
let cachedDeckyProviderConfigs: DeckyProviderConfigs | undefined;
let deckyProviderConfigsLoadPromise: Promise<DeckyProviderConfigs> | undefined;
const deckyProviderConfigListeners = new Set<DeckyProviderConfigListener>();

function notifyDeckyProviderConfigsChanged(): void {
  deckyProviderConfigRevision += 1;

  for (const listener of deckyProviderConfigListeners) {
    listener();
  }
}

function subscribeDeckyProviderConfigs(listener: DeckyProviderConfigListener): () => void {
  deckyProviderConfigListeners.add(listener);
  return () => {
    deckyProviderConfigListeners.delete(listener);
  };
}

function readLegacyRetroAchievementsConfigRecord(): LegacyRetroAchievementsConfigRecord | undefined {
  const rawText = readDeckyStorageText(RETROACHIEVEMENTS_CONFIG_STORAGE_KEY);
  if (rawText === undefined) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return undefined;
    }

    return parsed as LegacyRetroAchievementsConfigRecord;
  } catch {
    return undefined;
  }
}

function readLegacySteamConfigRecord(): LegacySteamConfigRecord | undefined {
  const rawText = readDeckyStorageText(STEAM_CONFIG_STORAGE_KEY);
  if (rawText === undefined) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return undefined;
    }

    return parsed as LegacySteamConfigRecord;
  } catch {
    return undefined;
  }
}

function coerceDeckyProviderConfigs(value: unknown): DeckyProviderConfigs {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    ...(record["retroAchievements"] !== undefined
      ? { retroAchievements: normalizeRetroAchievementsProviderConfig(record["retroAchievements"]) }
      : {}),
    ...(record["steam"] !== undefined ? { steam: normalizeSteamProviderConfig(record["steam"]) } : {}),
  };
}

function cacheDeckyProviderConfigs(configs: DeckyProviderConfigs): void {
  cachedDeckyProviderConfigs = configs;
  notifyDeckyProviderConfigsChanged();
}

export function readDeckyProviderConfigs(): DeckyProviderConfigs {
  return cachedDeckyProviderConfigs ?? {};
}

export function readDeckyProviderConfig(
  providerId: ProviderId,
): RetroAchievementsProviderConfig | SteamProviderConfig | undefined {
  const configs = readDeckyProviderConfigs();

  if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
    return configs.retroAchievements;
  }

  if (providerId === STEAM_PROVIDER_ID) {
    return configs.steam;
  }

  return undefined;
}

async function migrateLegacyRetroAchievementsConfig(
  backendConfig: RetroAchievementsProviderConfig | undefined,
): Promise<RetroAchievementsProviderConfig | undefined> {
  const legacyConfig = readLegacyRetroAchievementsConfigRecord();
  if (legacyConfig === undefined) {
    return backendConfig;
  }

  if (backendConfig?.hasApiKey === true) {
    removeDeckyStorageText(RETROACHIEVEMENTS_CONFIG_STORAGE_KEY);
    return backendConfig;
  }

  const username =
    typeof legacyConfig.username === "string" ? legacyConfig.username.trim() : "";
  const apiKey =
    typeof legacyConfig.apiKey === "string" ? legacyConfig.apiKey.trim() : "";

  if (username.length === 0 || apiKey.length === 0) {
    return backendConfig;
  }

  const migratedConfig = await callDeckyBackendMethod<RetroAchievementsProviderConfig | undefined>(
    "save_retroachievements_credentials",
    {
      username,
      apiKey,
    },
  );
  if (migratedConfig !== undefined) {
    removeDeckyStorageText(RETROACHIEVEMENTS_CONFIG_STORAGE_KEY);
    return migratedConfig;
  }

  return backendConfig;
}

async function migrateLegacySteamConfig(
  backendConfig: SteamProviderConfig | undefined,
): Promise<SteamProviderConfig | undefined> {
  const legacyConfig = readLegacySteamConfigRecord();
  if (legacyConfig === undefined) {
    return backendConfig;
  }

  if (backendConfig?.hasApiKey === true) {
    removeDeckyStorageText(STEAM_CONFIG_STORAGE_KEY);
    return backendConfig;
  }

  const steamId64 =
    typeof legacyConfig.steamId64 === "string" ? legacyConfig.steamId64.trim() : "";
  const apiKey = typeof legacyConfig.apiKey === "string" ? legacyConfig.apiKey.trim() : "";
  const language = typeof legacyConfig.language === "string" ? legacyConfig.language.trim() : "";

  if (steamId64.length === 0 || apiKey.length === 0) {
    return backendConfig;
  }

  const migratedConfig = await callDeckyBackendMethod<SteamProviderConfig | undefined>(
    "save_steam_credentials",
    {
      steamId64,
      apiKey,
      language,
      recentAchievementsCount: legacyConfig.recentAchievementsCount,
      recentlyPlayedCount: legacyConfig.recentlyPlayedCount,
      includePlayedFreeGames: legacyConfig.includePlayedFreeGames,
    },
  );

  if (migratedConfig !== undefined) {
    removeDeckyStorageText(STEAM_CONFIG_STORAGE_KEY);
    return migratedConfig;
  }

  return backendConfig;
}

async function loadDeckyProviderConfigsFromBackend(): Promise<DeckyProviderConfigs> {
  if (deckyProviderConfigsLoadPromise !== undefined) {
    return deckyProviderConfigsLoadPromise;
  }

  deckyProviderConfigsLoadPromise = (async () => {
    const backendConfigs = coerceDeckyProviderConfigs(
      await callDeckyBackendMethod<unknown>("get_provider_configs"),
    );

    const retroAchievements = await migrateLegacyRetroAchievementsConfig(backendConfigs.retroAchievements);
    const steam = await migrateLegacySteamConfig(backendConfigs.steam);

    const nextConfigs: DeckyProviderConfigs = {
      ...(retroAchievements !== undefined ? { retroAchievements } : {}),
      ...(steam !== undefined ? { steam } : {}),
    };

    cacheDeckyProviderConfigs(nextConfigs);
    return nextConfigs;
  })().finally(() => {
    deckyProviderConfigsLoadPromise = undefined;
  });

  return deckyProviderConfigsLoadPromise;
}

export async function loadDeckyProviderConfigs(): Promise<DeckyProviderConfigs> {
  if (cachedDeckyProviderConfigs !== undefined) {
    return cachedDeckyProviderConfigs;
  }

  return loadDeckyProviderConfigsFromBackend();
}

export async function loadDeckyProviderConfig(
  providerId: ProviderId,
): Promise<RetroAchievementsProviderConfig | SteamProviderConfig | undefined> {
  await loadDeckyProviderConfigs();
  return readDeckyProviderConfig(providerId);
}

export function useDeckyProviderConfigs(): DeckyProviderConfigs {
  const revision = useSyncExternalStore(
    subscribeDeckyProviderConfigs,
    () => deckyProviderConfigRevision,
    () => deckyProviderConfigRevision,
  );

  useEffect(() => {
    void loadDeckyProviderConfigs();
  }, []);

  return useMemo(() => readDeckyProviderConfigs(), [revision]);
}

export function useDeckyProviderConfig(
  providerId: ProviderId | undefined,
): RetroAchievementsProviderConfig | SteamProviderConfig | undefined {
  const configs = useDeckyProviderConfigs();

  if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
    return configs.retroAchievements;
  }

  if (providerId === STEAM_PROVIDER_ID) {
    return configs.steam;
  }

  return undefined;
}

export function updateDeckyProviderConfigCache(
  providerId: ProviderId,
  config: RetroAchievementsProviderConfig | SteamProviderConfig | undefined,
): void {
  const current = readDeckyProviderConfigs();
  const nextConfigs: DeckyProviderConfigs = {
    ...(providerId === RETROACHIEVEMENTS_PROVIDER_ID
      ? config !== undefined
        ? { retroAchievements: config as RetroAchievementsProviderConfig }
        : {}
      : current.retroAchievements !== undefined
        ? { retroAchievements: current.retroAchievements }
        : {}),
    ...(providerId === STEAM_PROVIDER_ID
      ? config !== undefined
        ? { steam: config as SteamProviderConfig }
        : {}
      : current.steam !== undefined
        ? { steam: current.steam }
        : {}),
  };

  cacheDeckyProviderConfigs(nextConfigs);
}

export function clearDeckyProviderConfigCache(_providerId: ProviderId): void {
  // Clearing a provider cache must invalidate the aggregate cache so a later load
  // can rehydrate from the backend again. Keeping an empty object here would make
  // loadDeckyProviderConfigs() think the cache is already loaded and skip the backend.
  cachedDeckyProviderConfigs = undefined;
  notifyDeckyProviderConfigsChanged();
}

export async function saveDeckyRetroAchievementsCredentials(args: {
  readonly username: string;
  readonly apiKeyDraft: string;
  readonly recentAchievementsCount?: RetroAchievementsProviderConfig["recentAchievementsCount"];
  readonly recentlyPlayedCount?: RetroAchievementsProviderConfig["recentlyPlayedCount"];
}): Promise<RetroAchievementsProviderConfig | undefined> {
  const savedConfig = await callDeckyBackendMethod<RetroAchievementsProviderConfig | undefined>(
    "save_retroachievements_credentials",
    args,
  );

  if (savedConfig !== undefined) {
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, savedConfig);
    clearDeckyDashboardSnapshot(RETROACHIEVEMENTS_PROVIDER_ID);
  }

  return savedConfig;
}

export async function saveDeckySteamCredentials(args: {
  readonly steamId64: string;
  readonly apiKeyDraft: string;
  readonly language: string;
  readonly recentAchievementsCount: SteamProviderConfig["recentAchievementsCount"];
  readonly recentlyPlayedCount: SteamProviderConfig["recentlyPlayedCount"];
  readonly includePlayedFreeGames: boolean;
}): Promise<SteamProviderConfig | undefined> {
  const savedConfig = await callDeckyBackendMethod<SteamProviderConfig | undefined>(
    "save_steam_credentials",
    args,
  );

  if (savedConfig !== undefined) {
    updateDeckyProviderConfigCache(STEAM_PROVIDER_ID, savedConfig);
    clearDeckyDashboardSnapshot(STEAM_PROVIDER_ID);
  }

  return savedConfig;
}

export async function clearDeckyRetroAchievementsAccountState(): Promise<boolean> {
  const cleared = await callDeckyBackendMethod<boolean>("clear_provider_credentials", {
    providerId: RETROACHIEVEMENTS_PROVIDER_ID,
  });

  if (cleared) {
    clearDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID);
    clearDeckyDashboardSnapshot(RETROACHIEVEMENTS_PROVIDER_ID);
  }

  return cleared;
}

export async function clearDeckySteamAccountState(): Promise<boolean> {
  const cleared = await callDeckyBackendMethod<boolean>("clear_provider_credentials", {
    providerId: STEAM_PROVIDER_ID,
  });

  if (cleared) {
    clearDeckyProviderConfigCache(STEAM_PROVIDER_ID);
    clearDeckyDashboardSnapshot(STEAM_PROVIDER_ID);
  }

  return cleared;
}
