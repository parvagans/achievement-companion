import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { CacheStore } from "../src/core/cache";
import { createAppRuntime } from "../src/core/app-runtime";
import { createProviderRegistry } from "../src/core/provider-registry";
import type {
  AuthenticatedProviderTransportFactory,
  DashboardSnapshotStore,
  DiagnosticLogger,
  PlatformCapabilities,
  PlatformServices,
  ProviderConfigStore,
  SteamLibraryScanStore,
} from "../src/core/platform";
import { createDeckyAppRuntime, deckyAuthenticatedProviderTransportFactory, deckyDashboardSnapshotStore, deckyDiagnosticLogger, deckyPlatformCapabilities } from "../src/platform/decky/decky-app-services";
import { deckyProviderConfigStore } from "../src/platform/decky/providers/provider-config-store";
import { deckySteamLibraryScanStore } from "../src/platform/decky/providers/steam/config";

function createMemoryCacheStore(): CacheStore {
  const entries = new Map<string, unknown>();

  return {
    async read<T>(key: string) {
      const value = entries.get(key);
      if (value === undefined) {
        return undefined;
      }

      return {
        key,
        value: value as T,
        storedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        version: 1,
      };
    },

    async write<T>(entry) {
      entries.set(entry.key, entry.value as unknown);
    },

    async delete(key: string) {
      entries.delete(key);
    },

    async clear(prefix?: string) {
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

test("core app runtime composes app services through a platform-neutral factory", () => {
  const providerRegistry = createProviderRegistry([]);
  const platform: PlatformServices = {
    info: {
      platformId: "desktop",
      appName: "Achievement Companion",
    },
  };
  const diagnosticLogger: DiagnosticLogger = {
    record: async () => {},
  };
  const providerConfigStore: ProviderConfigStore = {
    load: async () => undefined,
    save: async (_providerId, config) => config,
    clear: async () => false,
  };
  const authenticatedProviderTransportFactory: AuthenticatedProviderTransportFactory = {
    create: () => ({ transport: "mock" }),
  };
  const dashboardSnapshotStore: DashboardSnapshotStore = {
    read: async () => undefined,
    write: async () => {},
    clear: async () => false,
  };
  const steamLibraryScanStore: SteamLibraryScanStore = {
    readOverview: async () => undefined,
    writeOverview: async () => {},
    readSummary: async () => undefined,
    writeSummary: async () => {},
    clear: async () => false,
  };
  const platformCapabilities: PlatformCapabilities = {
    supportsCompactNavigation: false,
    supportsFullscreenNavigation: false,
    supportsPersistentSettings: false,
    supportsSecretStorage: false,
    supportsAuthenticatedProviderTransport: false,
    supportsDiagnosticLogging: false,
    supportsSteamLibraryScan: false,
  };
  const adapters = {
    diagnosticLogger,
    providerConfigStore,
    authenticatedProviderTransportFactory,
    dashboardSnapshotStore,
    steamLibraryScanStore,
    platformCapabilities,
  };

  const runtime = createAppRuntime({
    providerRegistry,
    platform,
    cacheStore: createMemoryCacheStore(),
    loadProviderConfig: async () => undefined,
    adapters,
  });

  assert.equal(runtime.providerRegistry, providerRegistry);
  assert.equal(runtime.platform, platform);
  assert.equal(runtime.adapters, adapters);
  assert.equal(runtime.adapters.diagnosticLogger, diagnosticLogger);
  assert.equal(runtime.adapters.providerConfigStore, providerConfigStore);
  assert.equal(runtime.adapters.authenticatedProviderTransportFactory, authenticatedProviderTransportFactory);
  assert.equal(runtime.adapters.dashboardSnapshotStore, dashboardSnapshotStore);
  assert.equal(runtime.adapters.steamLibraryScanStore, steamLibraryScanStore);
  assert.equal(runtime.adapters.platformCapabilities, platformCapabilities);
  assert.equal(typeof runtime.services.dashboard.loadDashboard, "function");
});

test("core app runtime source stays free of Decky imports", () => {
  const source = readFileSync(new URL("../src/core/app-runtime.ts", import.meta.url), "utf-8");

  assert.doesNotMatch(source, /platform\/decky/u);
  assert.doesNotMatch(source, /@decky/u);
});

test("decky app runtime passes through the shared platform adapters", () => {
  const runtime = createDeckyAppRuntime("live");

  assert.equal(runtime.adapters.diagnosticLogger, deckyDiagnosticLogger);
  assert.equal(runtime.adapters.providerConfigStore, deckyProviderConfigStore);
  assert.equal(runtime.adapters.authenticatedProviderTransportFactory, deckyAuthenticatedProviderTransportFactory);
  assert.equal(runtime.adapters.dashboardSnapshotStore, deckyDashboardSnapshotStore);
  assert.equal(runtime.adapters.steamLibraryScanStore, deckySteamLibraryScanStore);
  assert.equal(runtime.adapters.platformCapabilities, deckyPlatformCapabilities);
  assert.equal(typeof runtime.services.dashboard.loadDashboard, "function");
});

test("decky app services use the shared runtime factory composition path", () => {
  const source = readFileSync(new URL("../src/platform/decky/decky-app-services.ts", import.meta.url), "utf-8");

  assert.match(source, /createAppRuntime\(/u);
  assert.doesNotMatch(source, /createAppServices\(\{/u);
});
