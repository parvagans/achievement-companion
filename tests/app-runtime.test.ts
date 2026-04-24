import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { CacheStore } from "../src/core/cache";
import type {
  AuthenticatedProviderTransportFactory,
  DashboardSnapshotStore,
  DiagnosticLogger,
  PlatformCapabilities,
  PlatformServices,
  ProviderConfigStore,
  SteamLibraryScanStore,
} from "../src/core/platform";
import { createDeckyAppRuntime, deckyAuthenticatedProviderTransportFactory, deckyPlatformCapabilities } from "../src/platform/decky/decky-app-services";
import { deckyDashboardSnapshotStore } from "../src/platform/decky/decky-dashboard-snapshot-cache";
import { deckyDiagnosticLogger } from "../src/platform/decky/decky-diagnostic-logger";
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
