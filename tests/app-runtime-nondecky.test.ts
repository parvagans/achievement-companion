import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { CacheStore } from "../src/core/cache";
import { createAppRuntime } from "../src/core/app-runtime";
import { createProviderRegistry } from "../src/core/provider-registry";
import type {
  AchievementProvider,
  DashboardSnapshotStore,
  DiagnosticLogger,
  PlatformCapabilities,
  PlatformServices,
  ProviderConfigStore,
  SteamLibraryScanStore,
} from "../src/core/platform";
import type { DashboardSnapshot, GameDetailSnapshot, NormalizedGame, NormalizedProfile, ProviderCapabilities, RecentlyPlayedGame, RecentUnlock } from "../src/core/domain";

interface MockTransport {
  readonly providerId: string;
}

interface MockProviderConfig {
  readonly username: string;
}

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

function createMemoryDashboardSnapshotStore(): DashboardSnapshotStore<DashboardSnapshot> {
  const entries = new Map<string, DashboardSnapshot>();

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

function createMemorySteamLibraryScanStore(): SteamLibraryScanStore<
  { readonly providerId: string },
  { readonly providerId: string }
> {
  const overviewEntries = new Map<string, { readonly providerId: string }>();
  const summaryEntries = new Map<string, { readonly providerId: string }>();

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

function createDashboardSnapshot(): DashboardSnapshot {
  return {
    profile: createProfile(),
    recentAchievements: [createRecentUnlock("ach-1")],
    recentlyPlayedGames: [createRecentlyPlayedGame("game-1")],
    recentUnlocks: [createRecentUnlock("ach-1")],
    featuredGames: [createGame("game-1")],
    refreshedAt: 1_700_000_000_000,
  };
}

function createProfile(): NormalizedProfile {
  return {
    providerId: "mock-provider",
    identity: {
      providerId: "mock-provider",
      accountId: "mock-account",
      displayName: "Mock Player",
    },
    summary: {
      unlockedCount: 4,
      totalCount: 10,
      completionPercent: 40,
    },
    metrics: [],
    featuredGames: [createGame("game-1")],
    refreshedAt: 1_700_000_000_000,
  };
}

function createGame(gameId: string): NormalizedGame {
  return {
    providerId: "mock-provider",
    gameId,
    title: `Mock Game ${gameId}`,
    status: "in_progress",
    summary: {
      unlockedCount: 1,
      totalCount: 1,
      completionPercent: 100,
    },
    metrics: [],
  };
}

function createRecentlyPlayedGame(gameId: string): RecentlyPlayedGame {
  return {
    providerId: "mock-provider",
    gameId,
    title: `Mock Game ${gameId}`,
    summary: {
      unlockedCount: 1,
      totalCount: 1,
      completionPercent: 100,
    },
    lastPlayedAt: 1_700_000_000_500,
  };
}

function createRecentUnlock(achievementId: string): RecentUnlock {
  return {
    achievement: {
      providerId: "mock-provider",
      achievementId,
      gameId: "game-1",
      title: `Achievement ${achievementId}`,
      isUnlocked: true,
      unlockedAt: 1_700_000_000_000,
      metrics: [],
    },
    game: {
      providerId: "mock-provider",
      gameId: "game-1",
      title: "Mock Game 1",
    },
    unlockedAt: 1_700_000_000_000,
  };
}

function createMockProvider(transport: MockTransport): AchievementProvider<MockProviderConfig> {
  const providerCapabilities: ProviderCapabilities = {
    requiresCredentials: false,
    profileSummary: true,
    completionProgress: false,
    recentUnlocks: true,
    gameProgress: true,
    rarityStats: false,
    search: false,
  };

  return {
    id: "mock-provider",
    capabilities: providerCapabilities,
    async loadProfile(config) {
      assert.equal(config.username, "mock-user");
      assert.equal(transport.providerId, "mock-provider");
      return createProfile();
    },
    async loadRecentUnlocks(config) {
      assert.equal(config.username, "mock-user");
      return [createRecentUnlock("ach-1")];
    },
    async loadRecentlyPlayedGames(config) {
      assert.equal(config.username, "mock-user");
      return [createRecentlyPlayedGame("game-1")];
    },
    async loadGameProgress(config, gameId) {
      assert.equal(config.username, "mock-user");
      return {
        game: createGame(gameId),
        achievements: [],
        refreshedAt: 1_700_000_000_000,
      };
    },
  };
}

test("non-decky runtime composes app services with mock in-memory adapters", async () => {
  const diagnosticEvents: unknown[] = [];
  const providerConfigStore: ProviderConfigStore<MockProviderConfig> = {
    async load() {
      return { username: "mock-user" };
    },
    async save(_providerId, config) {
      return config;
    },
    async clear() {
      return true;
    },
  };
  const dashboardSnapshotStore = createMemoryDashboardSnapshotStore();
  const steamLibraryScanStore = createMemorySteamLibraryScanStore();
  const transportFactory = {
    create(providerId: string): MockTransport {
      return { providerId };
    },
  };
  const transport = transportFactory.create("mock-provider");
  const providerRegistry = createProviderRegistry([createMockProvider(transport)]);
  const runtime = createAppRuntime({
    providerRegistry,
    platform: {
      info: {
        platformId: "desktop",
        appName: "Achievement Companion",
      },
    } satisfies PlatformServices,
    cacheStore: createMemoryCacheStore(),
    loadProviderConfig: async () => providerConfigStore.load("mock-provider"),
    adapters: {
      diagnosticLogger: {
        record(payload) {
          diagnosticEvents.push(payload);
        },
      } satisfies DiagnosticLogger,
      providerConfigStore,
      authenticatedProviderTransportFactory: transportFactory,
      dashboardSnapshotStore,
      steamLibraryScanStore,
      platformCapabilities: {
        supportsCompactNavigation: false,
        supportsFullscreenNavigation: false,
        supportsPersistentSettings: false,
        supportsSecretStorage: false,
        supportsAuthenticatedProviderTransport: false,
        supportsDiagnosticLogging: false,
        supportsSteamLibraryScan: false,
      } satisfies PlatformCapabilities,
    },
  });

  const state = await runtime.services.dashboard.loadDashboard("mock-provider");

  assert.equal(state.status, "success");
  assert.equal(state.error, undefined);
  assert.equal(state.data?.profile.identity.displayName, "Mock Player");
  assert.equal(state.data?.recentAchievements.length, 1);
  assert.equal(state.data?.recentlyPlayedGames.length, 1);

  const snapshot = createDashboardSnapshot();
  await dashboardSnapshotStore.write("mock-provider", snapshot);
  assert.deepStrictEqual(await dashboardSnapshotStore.read("mock-provider"), snapshot);

  await steamLibraryScanStore.writeOverview("mock-provider", { providerId: "mock-provider" });
  await steamLibraryScanStore.writeSummary("mock-provider", { providerId: "mock-provider" });
  assert.deepStrictEqual(await steamLibraryScanStore.readOverview("mock-provider"), { providerId: "mock-provider" });
  assert.deepStrictEqual(await steamLibraryScanStore.readSummary("mock-provider"), { providerId: "mock-provider" });

  runtime.adapters.diagnosticLogger?.record({
    providerId: "mock-provider",
    operation: "dashboard",
    message: "completed",
  });
  assert.equal(diagnosticEvents.length, 1);
});

test("non-decky runtime source stays free of Decky imports", () => {
  const source = readFileSync(new URL("./app-runtime-nondecky.test.ts", import.meta.url), "utf-8");
  const backendCallPattern = new RegExp(["call", "Decky", "Backend", "Method"].join(""));

  assert.doesNotMatch(source, /platform\/decky/u);
  assert.doesNotMatch(source, backendCallPattern);
});
