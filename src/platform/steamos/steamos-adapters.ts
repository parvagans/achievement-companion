import type { ProviderId } from "@core/domain";
import { redactFrontendLogValue } from "@core/redaction";
import type {
  AuthenticatedProviderTransportFactory,
  DashboardSnapshotStore,
  DiagnosticLogger,
  PlatformCapabilities,
  ProviderConfigStore,
  SteamLibraryScanStore,
} from "@core/platform";
import {
  RETROACHIEVEMENTS_PROVIDER_ID,
  type RetroAchievementsProviderConfig,
  normalizeRetroAchievementsProviderConfig,
} from "../../providers/retroachievements/config";
import type {
  RetroAchievementsTransport,
  RetroAchievementsTransportRequest,
} from "../../providers/retroachievements/client/transport";
import { STEAM_PROVIDER_ID, type SteamProviderConfig, normalizeSteamProviderConfig } from "../../providers/steam/config";
import type { SteamTransport, SteamTransportRequest } from "../../providers/steam/client/transport";
import { createSteamOSLocalBackendClient, type SteamOSLocalBackendClient } from "./local-backend-client";

type CountValue = RetroAchievementsProviderConfig["recentAchievementsCount"];

export interface SteamOSRetroAchievementsConfigSave
  extends RetroAchievementsProviderConfig {
  readonly apiKeyDraft?: string;
}

export interface SteamOSSteamConfigSave extends SteamProviderConfig {
  readonly apiKeyDraft?: string;
}

export type SteamOSProviderConfigValue = SteamOSRetroAchievementsConfigSave | SteamOSSteamConfigSave;

export interface SteamOSDevShellRuntimeMetadataStatus {
  readonly present: boolean;
  readonly valid: boolean;
  readonly sizeBytes?: number;
  readonly mtimeMs?: number;
}

export interface SteamOSDevShellCacheStatus {
  readonly present: boolean;
  readonly valid: boolean;
  readonly sizeBytes?: number;
  readonly mtimeMs?: number;
  readonly refreshedAtMs?: number;
}

export interface SteamOSDevShellProviderStatus {
  readonly configured: boolean;
  readonly hasApiKey: boolean;
}

export interface SteamOSRetroAchievementsDevShellStatus extends SteamOSDevShellProviderStatus {
  readonly usernamePresent: boolean;
}

export interface SteamOSSteamDevShellStatus extends SteamOSDevShellProviderStatus {
  readonly steamId64Present: boolean;
}

export interface SteamOSDevShellDiagnosticsStatus {
  readonly ok: true;
  readonly backendReachable: true;
  readonly runtimeMetadata: SteamOSDevShellRuntimeMetadataStatus;
  readonly providerConfigFilePresent: boolean;
  readonly providerSecretsFilePresent: boolean;
  readonly retroAchievements: SteamOSRetroAchievementsDevShellStatus;
  readonly steam: SteamOSSteamDevShellStatus;
  readonly steamLibraryScanCache: SteamOSDevShellCacheStatus;
  readonly dashboardCache: {
    readonly retroAchievements: SteamOSDevShellCacheStatus;
    readonly steam: SteamOSDevShellCacheStatus;
  };
}

export interface SteamOSDiagnosticsStatusStore {
  load(): Promise<SteamOSDevShellDiagnosticsStatus>;
}

export interface SteamOSDiagnosticEventPayload {
  readonly event: string;
  readonly providerId?: string;
  readonly mode?: "initial" | "manual" | "background" | "unknown";
  readonly source?: "live" | "cache" | "unknown";
  readonly errorKind?: string;
  readonly durationMs?: number;
  readonly ownedGameCount?: number;
  readonly scannedGameCount?: number;
  readonly skippedGameCount?: number;
  readonly failedGameCount?: number;
  readonly gamesWithAchievements?: number;
  readonly totalAchievements?: number;
  readonly unlockedAchievements?: number;
  readonly perfectGames?: number;
  readonly completionPercent?: number;
  readonly apiKey?: string;
  readonly apiKeyDraft?: string;
  readonly Authorization?: string;
  readonly token?: string;
  readonly password?: string;
  readonly secret?: string;
  readonly y?: string;
  readonly key?: string;
}

export interface SteamOSAdapterOptions {
  readonly client: SteamOSLocalBackendClient;
}

interface CacheHitResponse<TValue> {
  readonly hit: true;
  readonly value: TValue;
}

interface CacheMissResponse {
  readonly hit: false;
}

interface CacheClearResponse {
  readonly ok?: boolean;
  readonly cleared?: boolean;
}

const SECRET_QUERY_KEYS = new Set([
  "apikey",
  "apikeydraft",
  "authorization",
  "key",
  "password",
  "secret",
  "token",
  "y",
]);

export const steamosPlatformCapabilities: PlatformCapabilities = {
  supportsCompactNavigation: false,
  supportsFullscreenNavigation: false,
  supportsPersistentSettings: false,
  supportsSecretStorage: true,
  supportsAuthenticatedProviderTransport: true,
  supportsDiagnosticLogging: true,
  supportsSteamLibraryScan: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSupportedDashboardProviderId(providerId: ProviderId): providerId is typeof RETROACHIEVEMENTS_PROVIDER_ID | typeof STEAM_PROVIDER_ID {
  return providerId === RETROACHIEVEMENTS_PROVIDER_ID || providerId === STEAM_PROVIDER_ID;
}

function sanitizeQuery(
  query: Record<string, string | number | boolean | undefined> | undefined,
): Record<string, string | number | boolean | undefined> | undefined {
  if (query === undefined) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(query).filter(([key]) => !SECRET_QUERY_KEYS.has(key.trim().toLowerCase())),
  );
}

function coerceCount(value: CountValue | undefined): CountValue | undefined {
  return value !== undefined ? value : undefined;
}

function coerceHandledStatuses(value: readonly number[] | undefined): readonly number[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  const handledStatuses = value.filter((item) => Number.isInteger(item) && item >= 0);
  return handledStatuses.length > 0 ? handledStatuses : undefined;
}

function isSteamConfigSave(value: SteamOSProviderConfigValue): value is SteamOSSteamConfigSave {
  return "steamId64" in value;
}

function toRetroAchievementsSavePayload(config: SteamOSRetroAchievementsConfigSave): Record<string, unknown> {
  return {
    username: config.username,
    ...(config.apiKeyDraft !== undefined && config.apiKeyDraft.trim() !== "" ? { apiKeyDraft: config.apiKeyDraft } : {}),
    ...(coerceCount(config.recentAchievementsCount) !== undefined
      ? { recentAchievementsCount: config.recentAchievementsCount }
      : {}),
    ...(coerceCount(config.recentlyPlayedCount) !== undefined
      ? { recentlyPlayedCount: config.recentlyPlayedCount }
      : {}),
  };
}

function toSteamSavePayload(config: SteamOSSteamConfigSave): Record<string, unknown> {
  return {
    steamId64: config.steamId64,
    language: config.language,
    recentAchievementsCount: config.recentAchievementsCount,
    recentlyPlayedCount: config.recentlyPlayedCount,
    includePlayedFreeGames: config.includePlayedFreeGames,
    ...(config.apiKeyDraft !== undefined && config.apiKeyDraft.trim() !== "" ? { apiKeyDraft: config.apiKeyDraft } : {}),
  };
}

function normalizeLoadedConfig(providerId: ProviderId, payload: unknown): SteamOSProviderConfigValue | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
    return normalizeRetroAchievementsProviderConfig(payload);
  }

  if (providerId === STEAM_PROVIDER_ID) {
    return normalizeSteamProviderConfig(payload);
  }

  return undefined;
}

export function createSteamOSRetroAchievementsTransport(
  client: SteamOSLocalBackendClient,
): RetroAchievementsTransport {
  return {
    requestJson<T>({ path, query }: RetroAchievementsTransportRequest): Promise<T> {
      return client.postJson<T>("request_retroachievements_json", {
        path,
        ...(sanitizeQuery(query) !== undefined ? { query: sanitizeQuery(query) } : {}),
      });
    },
  };
}

export function createSteamOSSteamTransport(client: SteamOSLocalBackendClient): SteamTransport {
  return {
    requestJson<T>({ path, query, handledHttpStatuses }: SteamTransportRequest): Promise<T> {
      return client.postJson<T>("request_steam_json", {
        path,
        ...(sanitizeQuery(query) !== undefined ? { query: sanitizeQuery(query) } : {}),
        ...(coerceHandledStatuses(handledHttpStatuses) !== undefined
          ? { handledHttpStatuses: coerceHandledStatuses(handledHttpStatuses) }
          : {}),
      });
    },
  };
}

export function createSteamOSProviderConfigStore(
  client: SteamOSLocalBackendClient,
): ProviderConfigStore<SteamOSProviderConfigValue> {
  return {
    async load(providerId) {
      const payload = await client.postJson<Record<string, unknown>>("get_provider_configs", {});
      if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
        return normalizeLoadedConfig(providerId, payload["retroAchievements"]);
      }

      if (providerId === STEAM_PROVIDER_ID) {
        return normalizeLoadedConfig(providerId, payload["steam"]);
      }

      return undefined;
    },
    async save(providerId, config) {
      if (providerId === RETROACHIEVEMENTS_PROVIDER_ID && !isSteamConfigSave(config)) {
        const response = await client.postJson<unknown>(
          "save_retroachievements_credentials",
          toRetroAchievementsSavePayload(config),
        );
        return normalizeRetroAchievementsProviderConfig(response);
      }

      if (providerId === STEAM_PROVIDER_ID && isSteamConfigSave(config)) {
        const response = await client.postJson<unknown>("save_steam_credentials", toSteamSavePayload(config));
        return normalizeSteamProviderConfig(response);
      }

      return undefined;
    },
    async clear(providerId) {
      if (providerId !== RETROACHIEVEMENTS_PROVIDER_ID && providerId !== STEAM_PROVIDER_ID) {
        return false;
      }

      const response = await client.postJson<{ readonly ok?: boolean; readonly cleared?: boolean }>(
        "clear_provider_credentials",
        { providerId },
      );
      return response.cleared === true;
    },
  };
}

export function createSteamOSDiagnosticLogger(
  client: SteamOSLocalBackendClient,
): DiagnosticLogger<SteamOSDiagnosticEventPayload> {
  return {
    async record(payload) {
      try {
        const redactedPayload = redactFrontendLogValue(payload);
        if (!isRecord(redactedPayload)) {
          return;
        }

        await client.postJson("record_diagnostic_event", redactedPayload);
      } catch {
        // Diagnostics should never break the app flow.
      }
    },
  };
}

export function createSteamOSDiagnosticsStatusStore(
  client: SteamOSLocalBackendClient,
): SteamOSDiagnosticsStatusStore {
  return {
    async load() {
      return await client.postJson<SteamOSDevShellDiagnosticsStatus>("diagnostics/steamos/status", {});
    },
  };
}

export function createSteamOSDashboardSnapshotStore<Snapshot extends object>(
  client: SteamOSLocalBackendClient,
): DashboardSnapshotStore<Snapshot> & { clear(providerId?: ProviderId): Promise<boolean> };
export function createSteamOSDashboardSnapshotStore<Snapshot extends object>(
  client: SteamOSLocalBackendClient,
): DashboardSnapshotStore<Snapshot> & { clear(providerId?: ProviderId): Promise<boolean> } {
  return {
    async read(providerId) {
      if (!isSupportedDashboardProviderId(providerId)) {
        return undefined;
      }

      const response = await client.postJson<CacheHitResponse<Snapshot> | CacheMissResponse>(
        "cache/dashboard/read",
        { providerId },
      );
      return response.hit === true ? response.value : undefined;
    },
    async write(providerId, snapshot) {
      if (!isSupportedDashboardProviderId(providerId)) {
        return;
      }

      await client.postJson("cache/dashboard/write", {
        providerId,
        value: snapshot,
      });
    },
    async clear(providerId) {
      if (providerId !== undefined && !isSupportedDashboardProviderId(providerId)) {
        return false;
      }

      const response = await client.postJson<CacheClearResponse>(
        "cache/dashboard/clear",
        providerId === undefined ? {} : { providerId },
      );
      return response.cleared === true;
    },
  };
}

export function createSteamOSSteamLibraryScanStore<Overview extends object, Summary extends object>(
  client: SteamOSLocalBackendClient,
): SteamLibraryScanStore<Overview, Summary> & { clear(providerId?: ProviderId): Promise<boolean> } {
  return {
    async readOverview(providerId) {
      if (providerId !== STEAM_PROVIDER_ID) {
        return undefined;
      }

      const response = await client.postJson<CacheHitResponse<Overview> | CacheMissResponse>(
        "cache/steam-scan/read-overview",
        {},
      );
      return response.hit === true ? response.value : undefined;
    },
    async writeOverview(providerId, overview) {
      if (providerId !== STEAM_PROVIDER_ID) {
        return;
      }

      await client.postJson("cache/steam-scan/write-overview", {
        value: overview,
      });
    },
    async readSummary(providerId) {
      if (providerId !== STEAM_PROVIDER_ID) {
        return undefined;
      }

      const response = await client.postJson<CacheHitResponse<Summary> | CacheMissResponse>(
        "cache/steam-scan/read-summary",
        {},
      );
      return response.hit === true ? response.value : undefined;
    },
    async writeSummary(providerId, summary) {
      if (providerId !== STEAM_PROVIDER_ID) {
        return;
      }

      await client.postJson("cache/steam-scan/write-summary", {
        value: summary,
      });
    },
    async clear(providerId) {
      if (providerId !== undefined && providerId !== STEAM_PROVIDER_ID) {
        return false;
      }

      const response = await client.postJson<CacheClearResponse>("cache/steam-scan/clear", {});
      return response.cleared === true;
    },
  };
}

export function createSteamOSAuthenticatedProviderTransportFactory(
  client: SteamOSLocalBackendClient,
): AuthenticatedProviderTransportFactory<RetroAchievementsTransport | SteamTransport> {
  return {
    create(providerId) {
      if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
        return createSteamOSRetroAchievementsTransport(client);
      }

      if (providerId === STEAM_PROVIDER_ID) {
        return createSteamOSSteamTransport(client);
      }

      throw new Error(`Unsupported SteamOS provider transport: ${providerId}`);
    },
  };
}

export function createSteamOSAdapters(options: SteamOSAdapterOptions) {
  return {
    client: options.client,
    diagnosticLogger: createSteamOSDiagnosticLogger(options.client),
    diagnosticsStatusStore: createSteamOSDiagnosticsStatusStore(options.client),
    providerConfigStore: createSteamOSProviderConfigStore(options.client),
    authenticatedProviderTransportFactory: createSteamOSAuthenticatedProviderTransportFactory(options.client),
    dashboardSnapshotStore: createSteamOSDashboardSnapshotStore(options.client),
    steamLibraryScanStore: createSteamOSSteamLibraryScanStore(options.client),
    platformCapabilities: steamosPlatformCapabilities,
  };
}

export function createSteamOSAdaptersFromClientOptions(
  options: Parameters<typeof createSteamOSLocalBackendClient>[0],
) {
  return createSteamOSAdapters({
    client: createSteamOSLocalBackendClient(options),
  });
}
