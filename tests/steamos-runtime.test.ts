import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { CacheStore } from "../src/core/cache";
import { createAppRuntime } from "../src/core/app-runtime";
import type {
  DashboardSnapshot,
  GameDetailSnapshot,
  NormalizedGame,
  NormalizedProfile,
  ProviderCapabilities,
  RecentlyPlayedGame,
  RecentUnlock,
} from "../src/core/domain";
import type { AchievementProvider } from "../src/core/ports";
import { createProviderRegistry } from "../src/core/provider-registry";
import type { PlatformServices } from "../src/core/platform";
import {
  RETROACHIEVEMENTS_PROVIDER_ID,
  type RetroAchievementsProviderConfig,
} from "../src/providers/retroachievements/config";
import type { RetroAchievementsTransport } from "../src/providers/retroachievements/client/transport";
import { STEAM_PROVIDER_ID, type SteamProviderConfig } from "../src/providers/steam/config";
import {
  isSteamTransportHandledHttpErrorResponse,
  type SteamTransport,
} from "../src/providers/steam/client/transport";
import {
  createSteamOSAdapters,
  steamosPlatformCapabilities,
} from "../src/platform/steamos/steamos-adapters";
import { createSteamOSLocalBackendClient } from "../src/platform/steamos/local-backend-client";

interface FetchCall {
  readonly url: string;
  readonly body: Record<string, unknown>;
  readonly headers: Record<string, string>;
}

function createJsonResponse(status: number, payload: unknown, statusText = "OK"): Response {
  return new Response(JSON.stringify(payload), {
    status,
    statusText,
    headers: {
      "Content-Type": "application/json",
    },
  });
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
    async delete(key) {
      entries.delete(key);
    },
    async clear(prefix) {
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

function collectSourceFiles(rootDir: string): readonly string[] {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(entryPath));
      continue;
    }

    if (entry.isFile() && /\.(ts|tsx)$/u.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

function readSourceTree(rootDir: string): string {
  return collectSourceFiles(rootDir)
    .map((filePath) => readFileSync(filePath, "utf-8"))
    .join("\n");
}

function createRecentUnlock(achievementId: string, gameId: string, gameTitle: string): RecentUnlock {
  return {
    achievement: {
      providerId: RETROACHIEVEMENTS_PROVIDER_ID,
      achievementId,
      gameId,
      title: `Achievement ${achievementId}`,
      isUnlocked: true,
      unlockedAt: 1_700_000_000_000,
      metrics: [],
    },
    game: {
      providerId: RETROACHIEVEMENTS_PROVIDER_ID,
      gameId,
      title: gameTitle,
    },
    unlockedAt: 1_700_000_000_000,
  };
}

function createRecentlyPlayedGame(
  providerId: typeof RETROACHIEVEMENTS_PROVIDER_ID | typeof STEAM_PROVIDER_ID,
  gameId: string,
  title: string,
): RecentlyPlayedGame {
  return {
    providerId,
    gameId,
    title,
    summary: {
      unlockedCount: 1,
      totalCount: 2,
      completionPercent: 50,
    },
    lastPlayedAt: 1_700_000_000_500,
  };
}

function createProfile(
  providerId: typeof RETROACHIEVEMENTS_PROVIDER_ID | typeof STEAM_PROVIDER_ID,
  displayName: string,
  gameId: string,
  gameTitle: string,
): NormalizedProfile {
  return {
    providerId,
    identity: {
      providerId,
      accountId: `${providerId}-account`,
      displayName,
    },
    summary: {
      unlockedCount: 4,
      totalCount: 10,
      completionPercent: 40,
    },
    metrics: [],
    featuredGames: [
      {
        providerId,
        gameId,
        title: gameTitle,
        status: "in_progress",
        summary: {
          unlockedCount: 1,
          totalCount: 2,
          completionPercent: 50,
        },
        metrics: [],
      },
    ],
    refreshedAt: 1_700_000_000_000,
  };
}

function createGameDetailSnapshot(
  providerId: typeof RETROACHIEVEMENTS_PROVIDER_ID | typeof STEAM_PROVIDER_ID,
  gameId: string,
  title: string,
): GameDetailSnapshot {
  return {
    game: {
      providerId,
      gameId,
      title,
      status: "in_progress",
      summary: {
        unlockedCount: 1,
        totalCount: 2,
        completionPercent: 50,
      },
      metrics: [],
    },
    achievements: [],
    refreshedAt: 1_700_000_000_000,
  };
}

function createRetroAchievementsProvider(
  transport: RetroAchievementsTransport,
): AchievementProvider<RetroAchievementsProviderConfig> {
  const capabilities: ProviderCapabilities = {
    requiresCredentials: true,
    profileSummary: true,
    completionProgress: false,
    recentUnlocks: true,
    gameProgress: true,
    rarityStats: false,
    search: false,
  };

  return {
    id: RETROACHIEVEMENTS_PROVIDER_ID,
    capabilities,
    async loadProfile(config) {
      const payload = await transport.requestJson<{ readonly user: string }>({
        path: "API/API_GetUserProfile.php",
        query: {
          u: config.username,
          y: "frontend-secret-should-be-dropped",
        },
      });

      return createProfile(RETROACHIEVEMENTS_PROVIDER_ID, payload.user, "retro-game-1", "Retro Game");
    },
    async loadRecentUnlocks(config, options) {
      const payload = await transport.requestJson<{
        readonly entries: ReadonlyArray<{
          readonly achievementId: string;
          readonly gameId: string;
          readonly gameTitle: string;
        }>;
      }>({
        path: "API/API_GetUserRecentlyUnlockedAchievements.php",
        query: {
          u: config.username,
          count: options?.limit ?? 10,
          key: "frontend-key-should-be-dropped",
        },
      });

      return payload.entries.map((entry) =>
        createRecentUnlock(entry.achievementId, entry.gameId, entry.gameTitle)
      );
    },
    async loadRecentlyPlayedGames(config, options) {
      const payload = await transport.requestJson<{
        readonly entries: ReadonlyArray<{
          readonly gameId: string;
          readonly title: string;
        }>;
      }>({
        path: "API/API_GetUserRecentlyPlayedGames.php",
        query: {
          u: config.username,
          count: options?.count ?? 10,
          apiKey: "frontend-api-key-should-be-dropped",
        },
      });

      return payload.entries.map((entry) =>
        createRecentlyPlayedGame(RETROACHIEVEMENTS_PROVIDER_ID, entry.gameId, entry.title)
      );
    },
    async loadGameProgress(_config, gameId) {
      return createGameDetailSnapshot(RETROACHIEVEMENTS_PROVIDER_ID, gameId, "Retro Game");
    },
  };
}

function createSteamProvider(transport: SteamTransport): AchievementProvider<SteamProviderConfig> {
  const capabilities: ProviderCapabilities = {
    requiresCredentials: true,
    profileSummary: true,
    completionProgress: false,
    recentUnlocks: false,
    gameProgress: true,
    rarityStats: false,
    search: false,
  };

  return {
    id: STEAM_PROVIDER_ID,
    capabilities,
    async loadProfile(config) {
      const payload = await transport.requestJson<{ readonly playerName: string }>({
        path: "ISteamUserStats/GetPlayerAchievements/v1/",
        query: {
          steamid: config.steamId64,
          l: config.language,
          token: "frontend-token-should-be-dropped",
        },
      });

      return createProfile(STEAM_PROVIDER_ID, payload.playerName, "steam-game-1", "Steam Game");
    },
    async loadRecentUnlocks() {
      return [];
    },
    async loadRecentlyPlayedGames(config, options) {
      const payload = await transport.requestJson<unknown>({
        path: "IPlayerService/GetRecentlyPlayedGames/v1/",
        query: {
          steamid: config.steamId64,
          count: options?.count ?? 10,
          password: "frontend-password-should-be-dropped",
        },
        handledHttpStatuses: [400, 403],
      });

      if (isSteamTransportHandledHttpErrorResponse(payload)) {
        return [];
      }

      return (payload as { readonly response: { readonly games: ReadonlyArray<{ readonly appid: string; readonly name: string }> } })
        .response
        .games
        .map((game) => createRecentlyPlayedGame(STEAM_PROVIDER_ID, game.appid, game.name));
    },
    async loadGameProgress(_config, gameId) {
      return createGameDetailSnapshot(STEAM_PROVIDER_ID, gameId, "Steam Game");
    },
  };
}

test("SteamOS runtime composes with local-backend adapters and mocked backend calls", async () => {
  const fetchCalls: FetchCall[] = [];
  const client = createSteamOSLocalBackendClient({
    baseUrl: "http://127.0.0.1:4123",
    token: "session-token",
    fetchImpl: async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      fetchCalls.push({
        url,
        body,
        headers: (init?.headers as Record<string, string>) ?? {},
      });

      if (url.endsWith("/get_provider_configs")) {
        return createJsonResponse(200, {
          version: 1,
          retroAchievements: {
            username: "sol88",
            hasApiKey: true,
            recentAchievementsCount: 10,
            recentlyPlayedCount: 10,
          },
          steam: {
            steamId64: "76561198136628813",
            hasApiKey: true,
            language: "english",
            recentAchievementsCount: 3,
            recentlyPlayedCount: 3,
            includePlayedFreeGames: true,
          },
        });
      }

      if (url.endsWith("/request_retroachievements_json")) {
        const path = body["path"];
        if (path === "API/API_GetUserProfile.php") {
          return createJsonResponse(200, { user: "Retro Player" });
        }
        if (path === "API/API_GetUserRecentlyUnlockedAchievements.php") {
          return createJsonResponse(200, {
            entries: [
              {
                achievementId: "ra-ach-1",
                gameId: "retro-game-1",
                gameTitle: "Retro Game",
              },
            ],
          });
        }
        if (path === "API/API_GetUserRecentlyPlayedGames.php") {
          return createJsonResponse(200, {
            entries: [
              {
                gameId: "retro-game-1",
                title: "Retro Game",
              },
            ],
          });
        }
      }

      if (url.endsWith("/request_steam_json")) {
        const path = body["path"];
        if (path === "ISteamUserStats/GetPlayerAchievements/v1/") {
          return createJsonResponse(200, { playerName: "Steam Player" });
        }
        if (path === "IPlayerService/GetRecentlyPlayedGames/v1/") {
          return createJsonResponse(200, {
            handledHttpError: true,
            status: 403,
            statusText: "Forbidden",
            message: "private profile",
          });
        }
      }

      if (url.endsWith("/record_diagnostic_event")) {
        return createJsonResponse(200, { ok: true, recorded: true });
      }

      throw new Error(`Unexpected route in SteamOS runtime harness: ${url}`);
    },
  });

  const adapters = createSteamOSAdapters({ client });
  const providerRegistry = createProviderRegistry([
    createRetroAchievementsProvider(
      adapters.authenticatedProviderTransportFactory.create(RETROACHIEVEMENTS_PROVIDER_ID),
    ),
    createSteamProvider(adapters.authenticatedProviderTransportFactory.create(STEAM_PROVIDER_ID)),
  ]);

  const runtime = createAppRuntime({
    providerRegistry,
    platform: {
      info: {
        platformId: "desktop",
        appName: "Achievement Companion",
      },
    } satisfies PlatformServices,
    cacheStore: createMemoryCacheStore(),
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

  const retroState = await runtime.services.dashboard.loadDashboard(RETROACHIEVEMENTS_PROVIDER_ID, {
    forceRefresh: true,
  });
  const steamState = await runtime.services.dashboard.loadDashboard(STEAM_PROVIDER_ID, {
    forceRefresh: true,
  });

  assert.equal(runtime.platform.info.platformId, "desktop");
  assert.deepStrictEqual(runtime.adapters.platformCapabilities, steamosPlatformCapabilities);

  assert.equal(retroState.status, "success");
  assert.equal(retroState.data?.profile.identity.displayName, "Retro Player");
  assert.equal(retroState.data?.recentAchievements.length, 1);
  assert.equal(retroState.data?.recentlyPlayedGames.length, 1);

  assert.equal(steamState.status, "success");
  assert.equal(steamState.data?.profile.identity.displayName, "Steam Player");
  assert.equal(steamState.data?.recentAchievements.length, 0);
  assert.equal(steamState.data?.recentlyPlayedGames.length, 0);

  const loadedRetroConfig = await runtime.adapters.providerConfigStore?.load(RETROACHIEVEMENTS_PROVIDER_ID);
  const loadedSteamConfig = await runtime.adapters.providerConfigStore?.load(STEAM_PROVIDER_ID);

  assert.deepStrictEqual(loadedRetroConfig, {
    username: "sol88",
    hasApiKey: true,
    recentAchievementsCount: 10,
    recentlyPlayedCount: 10,
  });
  assert.deepStrictEqual(loadedSteamConfig, {
    steamId64: "76561198136628813",
    hasApiKey: true,
    language: "english",
    recentAchievementsCount: 3,
    recentlyPlayedCount: 3,
    includePlayedFreeGames: true,
  });
  assert.doesNotMatch(JSON.stringify(loadedRetroConfig), /apiKey/u);
  assert.doesNotMatch(JSON.stringify(loadedSteamConfig), /apiKey/u);

  await runtime.adapters.diagnosticLogger?.record({
    event: "dashboard_refresh_completed",
    providerId: STEAM_PROVIDER_ID,
    apiKey: "should-not-leak",
    Authorization: "Bearer should-not-leak",
  });

  await runtime.adapters.dashboardSnapshotStore?.write(RETROACHIEVEMENTS_PROVIDER_ID, {
    refreshedAt: 1,
  } satisfies Pick<DashboardSnapshot, "refreshedAt">);
  await runtime.adapters.steamLibraryScanStore?.writeOverview(STEAM_PROVIDER_ID, { count: 1 });
  await runtime.adapters.steamLibraryScanStore?.writeSummary(STEAM_PROVIDER_ID, { count: 2 });

  assert.deepStrictEqual(
    await runtime.adapters.dashboardSnapshotStore?.read(RETROACHIEVEMENTS_PROVIDER_ID),
    { refreshedAt: 1 },
  );
  assert.deepStrictEqual(await runtime.adapters.steamLibraryScanStore?.readOverview(STEAM_PROVIDER_ID), { count: 1 });
  assert.deepStrictEqual(await runtime.adapters.steamLibraryScanStore?.readSummary(STEAM_PROVIDER_ID), { count: 2 });

  const backendRoutes = fetchCalls.map((call) => call.url.replace("http://127.0.0.1:4123/", ""));
  assert.deepStrictEqual(
    backendRoutes,
    [
      "get_provider_configs",
      "request_retroachievements_json",
      "request_retroachievements_json",
      "request_retroachievements_json",
      "get_provider_configs",
      "request_steam_json",
      "request_steam_json",
      "get_provider_configs",
      "get_provider_configs",
      "record_diagnostic_event",
    ],
  );

  const steamRecentlyPlayedRequest = fetchCalls.find(
    (call) => call.body["path"] === "IPlayerService/GetRecentlyPlayedGames/v1/",
  );
  assert.deepStrictEqual(steamRecentlyPlayedRequest?.body, {
    path: "IPlayerService/GetRecentlyPlayedGames/v1/",
    query: {
      steamid: "76561198136628813",
      count: 3,
    },
    handledHttpStatuses: [400, 403],
  });

  const diagnosticRequest = fetchCalls.find((call) => call.url.endsWith("/record_diagnostic_event"));
  assert.deepStrictEqual(diagnosticRequest?.body, {
    event: "dashboard_refresh_completed",
    providerId: STEAM_PROVIDER_ID,
    apiKey: "[redacted]",
    Authorization: "[redacted]",
  });
  assert.equal(diagnosticRequest?.headers.Authorization, "Bearer session-token");

  for (const call of fetchCalls) {
    assert.doesNotMatch(call.url, /session-token/u);
    assert.doesNotMatch(call.url, /should-not-leak/u);
    assert.doesNotMatch(call.url, /apiKey/u);
  }
});

test("SteamOS runtime harness sources stay free of Decky imports and browser storage", () => {
  const steamosSource = readSourceTree("src/platform/steamos");
  const coreSource = readSourceTree("src/core");
  const providersSource = readSourceTree("src/providers");
  const deckySource = readSourceTree("src/platform/decky");

  assert.doesNotMatch(steamosSource, /platform\/decky/u);
  assert.doesNotMatch(steamosSource, /\bfrom\s+["']@decky\/[^"']+["']/u);
  assert.doesNotMatch(steamosSource, /localStorage/u);
  assert.doesNotMatch(steamosSource, /sessionStorage/u);
  assert.doesNotMatch(steamosSource, /OneDrive/u);
  assert.doesNotMatch(coreSource, /platform\/steamos/u);
  assert.doesNotMatch(providersSource, /platform\/steamos/u);
  assert.doesNotMatch(deckySource, /platform\/steamos/u);
});
