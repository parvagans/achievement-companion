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
  supportsSteamLibraryScan: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

export function createInMemoryDashboardSnapshotStore<Snapshot>(): DashboardSnapshotStore<Snapshot> {
  const entries = new Map<ProviderId, Snapshot>();

  return {
    async read(providerId) {
      return entries.get(providerId);
    },
    async write(providerId, snapshot) {
      entries.set(providerId, snapshot);
    },
    async clear(providerId) {
      return entries.delete(providerId);
    },
  };
}

export function createInMemorySteamLibraryScanStore<Overview, Summary>(): SteamLibraryScanStore<Overview, Summary> {
  const overviewEntries = new Map<ProviderId, Overview>();
  const summaryEntries = new Map<ProviderId, Summary>();

  return {
    async readOverview(providerId) {
      return overviewEntries.get(providerId);
    },
    async writeOverview(providerId, overview) {
      overviewEntries.set(providerId, overview);
    },
    async readSummary(providerId) {
      return summaryEntries.get(providerId);
    },
    async writeSummary(providerId, summary) {
      summaryEntries.set(providerId, summary);
    },
    async clear(providerId) {
      const removedOverview = overviewEntries.delete(providerId);
      const removedSummary = summaryEntries.delete(providerId);
      return removedOverview || removedSummary;
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
    providerConfigStore: createSteamOSProviderConfigStore(options.client),
    authenticatedProviderTransportFactory: createSteamOSAuthenticatedProviderTransportFactory(options.client),
    dashboardSnapshotStore: createInMemoryDashboardSnapshotStore(),
    steamLibraryScanStore: createInMemorySteamLibraryScanStore(),
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
