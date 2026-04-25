import type { CacheEntry, CacheStore } from "@core/cache";
import type { PlatformServices } from "@core/platform";
import { createAppRuntime } from "@core/app-runtime";
import { createProviderRegistry } from "@core/provider-registry";
import { createRetroAchievementsProvider } from "../../providers/retroachievements";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements/config";
import { createSteamProvider } from "../../providers/steam";
import { STEAM_PROVIDER_ID } from "../../providers/steam/config";
import {
  createSteamOSAdapters,
  createSteamOSRetroAchievementsTransport,
  createSteamOSSteamTransport,
} from "./steamos-adapters";
import {
  createSteamOSLocalBackendClient,
  type SteamOSLocalBackendClient,
  type SteamOSLocalBackendFetch,
} from "./local-backend-client";
import type { SteamOSLocalBackendClientConfig } from "./runtime-metadata";

export interface SteamOSAppRuntimeOptions {
  readonly appName?: string;
  readonly buildVersion?: string;
  readonly cacheStore?: CacheStore;
  readonly fetchImpl?: SteamOSLocalBackendFetch;
}

function createSteamOSPlatform(options: SteamOSAppRuntimeOptions): PlatformServices {
  return {
    info: {
      platformId: "desktop",
      appName: options.appName ?? "Achievement Companion",
      ...(options.buildVersion !== undefined ? { buildVersion: options.buildVersion } : {}),
    },
  };
}

export function createSteamOSMemoryCacheStore(
  initialEntries: readonly CacheEntry<unknown>[] = [],
): CacheStore {
  const entries = new Map<string, CacheEntry<unknown>>();

  for (const entry of initialEntries) {
    entries.set(entry.key, entry);
  }

  return {
    async read<T>(key: string): Promise<CacheEntry<T> | undefined> {
      return entries.get(key) as CacheEntry<T> | undefined;
    },

    async write<T>(entry: CacheEntry<T>): Promise<void> {
      entries.set(entry.key, entry as CacheEntry<unknown>);
    },

    async delete(key: string): Promise<void> {
      entries.delete(key);
    },

    async clear(prefix?: string): Promise<void> {
      if (prefix === undefined) {
        entries.clear();
        return;
      }

      for (const key of [...entries.keys()]) {
        if (key.startsWith(prefix)) {
          entries.delete(key);
        }
      }
    },
  };
}

export function createSteamOSAppRuntimeFromClient(
  client: SteamOSLocalBackendClient,
  options: SteamOSAppRuntimeOptions = {},
) {
  const adapters = createSteamOSAdapters({ client });
  const providerRegistry = createProviderRegistry([
    createRetroAchievementsProvider({
      transport: createSteamOSRetroAchievementsTransport(client),
    }),
    createSteamProvider({
      transport: createSteamOSSteamTransport(client),
    }),
  ]);

  return createAppRuntime({
    providerRegistry,
    platform: createSteamOSPlatform(options),
    cacheStore: options.cacheStore ?? createSteamOSMemoryCacheStore(),
    loadProviderConfig: async (providerId) => adapters.providerConfigStore.load(providerId),
    adapters: {
      diagnosticLogger: adapters.diagnosticLogger,
      providerConfigStore: adapters.providerConfigStore,
      authenticatedProviderTransportFactory: adapters.authenticatedProviderTransportFactory,
      dashboardSnapshotStore: adapters.dashboardSnapshotStore,
      steamLibraryScanStore: adapters.steamLibraryScanStore,
      platformCapabilities: adapters.platformCapabilities,
    },
  });
}

export function createSteamOSAppRuntime(
  config: SteamOSLocalBackendClientConfig,
  options: SteamOSAppRuntimeOptions = {},
) {
  return createSteamOSAppRuntimeFromClient(
    createSteamOSLocalBackendClient({
      baseUrl: config.baseUrl,
      token: config.token,
      ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
    }),
    options,
  );
}
