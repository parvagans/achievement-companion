import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../src/providers/retroachievements/config";
import { STEAM_PROVIDER_ID } from "../src/providers/steam/config";
import {
  createSteamOSAdapters,
  createSteamOSAuthenticatedProviderTransportFactory,
  createSteamOSDashboardSnapshotStore,
  createSteamOSDiagnosticLogger,
  createSteamOSDiagnosticsStatusStore,
  createSteamOSProviderConfigStore,
  createSteamOSSteamLibraryScanStore,
  steamosPlatformCapabilities,
  type SteamOSDiagnosticEventPayload,
  type SteamOSProviderConfigValue,
} from "../src/platform/steamos/steamos-adapters";
import {
  createSteamOSSteamLibraryScanOverview,
  loadSteamOSSteamLibraryScanOverview,
  runSteamOSSteamLibraryScan,
} from "../src/platform/steamos/steam-library-scan";
import {
  SteamOSLocalBackendClientError,
  createSteamOSLocalBackendClient,
} from "../src/platform/steamos/local-backend-client";

function createJsonResponse(status: number, payload: unknown, statusText = "OK"): Response {
  return new Response(JSON.stringify(payload), {
    status,
    statusText,
    headers: {
      "Content-Type": "application/json",
    },
  });
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

test("SteamOS local backend client sends bearer auth and JSON body without leaking token into the URL", async () => {
  const calls: Array<{ readonly url: string; readonly init?: RequestInit }> = [];
  const client = createSteamOSLocalBackendClient({
    baseUrl: "http://127.0.0.1:4123",
    token: "session-token",
    fetchImpl: async (input, init) => {
      calls.push({
        url: String(input),
        init,
      });
      return createJsonResponse(200, { ok: true });
    },
  });

  const response = await client.postJson<{ readonly ok: boolean }>("request_steam_json", {
    path: "IPlayerService/GetOwnedGames/v1/",
    query: {
      steamid: "76561198136628813",
    },
  });

  assert.deepStrictEqual(response, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "http://127.0.0.1:4123/request_steam_json");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal((calls[0]?.init?.headers as Record<string, string>)?.Authorization, "Bearer session-token");
  assert.equal((calls[0]?.init?.headers as Record<string, string>)?.["Content-Type"], "application/json");
  assert.match(String(calls[0]?.init?.body), /"path":"IPlayerService\/GetOwnedGames\/v1\/"/u);
  assert.doesNotMatch(calls[0]?.url ?? "", /session-token/u);
  assert.doesNotMatch(calls[0]?.url ?? "", /apiKey/u);
});

test("SteamOS local backend client surfaces non-2xx JSON errors safely", async () => {
  const client = createSteamOSLocalBackendClient({
    baseUrl: "http://127.0.0.1:4123",
    token: "session-token",
    fetchImpl: async () =>
      createJsonResponse(
        403,
        { ok: false, error: "provider_request_failed", errorCategory: "missing_secret" },
        "Forbidden",
      ),
  });

  await assert.rejects(
    () => client.postJson("request_retroachievements_json", { path: "API_GetUserProfile.php" }),
    (error: unknown) =>
      error instanceof SteamOSLocalBackendClientError &&
      error.status === 403 &&
      error.code === "provider_request_failed" &&
      error.category === "missing_secret" &&
      !error.message.includes("session-token"),
  );
});

test("SteamOS local backend client normalizes transport failures into safe backend-unavailable errors", async () => {
  const client = createSteamOSLocalBackendClient({
    baseUrl: "http://127.0.0.1:4123",
    token: "session-token",
    fetchImpl: async () => {
      throw new Error("Bearer session-token should not leak");
    },
  });

  await assert.rejects(
    () => client.postJson("diagnostics/steamos/status", {}),
    (error: unknown) =>
      error instanceof SteamOSLocalBackendClientError &&
      error.status === 0 &&
      error.code === "backend_unavailable" &&
      error.category === "network_error" &&
      !error.message.includes("session-token"),
  );
});

test("SteamOS provider transports post to local backend endpoints and strip secret-like query fields", async () => {
  const calls: Array<{ readonly url: string; readonly body: Record<string, unknown> }> = [];
  const client = createSteamOSLocalBackendClient({
    baseUrl: "http://127.0.0.1:4123",
    token: "session-token",
    fetchImpl: async (input, init) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      if (String(input).endsWith("/request_retroachievements_json")) {
        return createJsonResponse(200, { user: "sol88" });
      }
      return createJsonResponse(200, { response: { game_count: 2 } });
    },
  });
  const transportFactory = createSteamOSAuthenticatedProviderTransportFactory(client);
  const retroAchievementsTransport = transportFactory.create(RETROACHIEVEMENTS_PROVIDER_ID);
  const steamTransport = transportFactory.create(STEAM_PROVIDER_ID);

  const retroResponse = await retroAchievementsTransport.requestJson<{ readonly user: string }>({
    path: "API_GetUserProfile.php",
    query: {
      u: "sol88",
      y: "frontend-secret",
      key: "frontend-key",
      apiKey: "frontend-api-key",
    },
  });
  const steamResponse = await steamTransport.requestJson<{ readonly response: { readonly game_count: number } }>({
    path: "IPlayerService/GetOwnedGames/v1/",
    query: {
      steamid: "76561198136628813",
      key: "frontend-key",
      apiKey: "frontend-api-key",
      token: "frontend-token",
      password: "frontend-password",
    },
    handledHttpStatuses: [400, 403],
  });

  assert.deepStrictEqual(retroResponse, { user: "sol88" });
  assert.deepStrictEqual(steamResponse, { response: { game_count: 2 } });
  assert.equal(calls[0]?.url, "http://127.0.0.1:4123/request_retroachievements_json");
  assert.deepStrictEqual(calls[0]?.body, {
    path: "API_GetUserProfile.php",
    query: { u: "sol88" },
  });
  assert.equal(calls[1]?.url, "http://127.0.0.1:4123/request_steam_json");
  assert.deepStrictEqual(calls[1]?.body, {
    path: "IPlayerService/GetOwnedGames/v1/",
    query: { steamid: "76561198136628813" },
    handledHttpStatuses: [400, 403],
  });
});

test("SteamOS dev shell diagnostics store uses the protected backend client and parses safe status responses", async () => {
  const calls: Array<{ readonly url: string; readonly body: Record<string, unknown> }> = [];
  const client = createSteamOSLocalBackendClient({
    baseUrl: "http://127.0.0.1:4123",
    token: "session-token",
    fetchImpl: async (input, init) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
      });
      return createJsonResponse(200, {
        ok: true,
        backendReachable: true,
        runtimeMetadata: {
          present: true,
          valid: true,
          sizeBytes: 128,
          mtimeMs: 1_710_000_000_000,
        },
        providerConfigFilePresent: true,
        providerSecretsFilePresent: true,
        retroAchievements: {
          configured: true,
          usernamePresent: true,
          hasApiKey: true,
        },
        steam: {
          configured: true,
          steamId64Present: true,
          hasApiKey: true,
        },
        steamLibraryScanCache: {
          present: false,
          valid: false,
        },
        dashboardCache: {
          retroAchievements: {
            present: true,
            valid: true,
            sizeBytes: 256,
            mtimeMs: 1_710_000_100_000,
            refreshedAtMs: 1_710_000_050_000,
          },
          steam: {
            present: true,
            valid: true,
            sizeBytes: 512,
            mtimeMs: 1_710_000_200_000,
            refreshedAtMs: 1_710_000_150_000,
          },
        },
      });
    },
  });
  const store = createSteamOSDiagnosticsStatusStore(client);

  const status = await store.load();

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "http://127.0.0.1:4123/diagnostics/steamos/status");
  assert.deepStrictEqual(calls[0]?.body, {});
  assert.equal(status.ok, true);
  assert.equal(status.backendReachable, true);
  assert.equal(status.runtimeMetadata.valid, true);
  assert.equal(status.retroAchievements.configured, true);
  assert.equal(status.steam.configured, true);
  assert.equal(status.steamLibraryScanCache.present, false);
  assert.equal(status.dashboardCache.retroAchievements.present, true);
  assert.equal(status.dashboardCache.steam.present, true);
  assert.doesNotMatch(JSON.stringify(status), /apiKey|Authorization|provider-secrets|token|sol88|steam-secret/u);
});

test("SteamOS provider config store talks to the credential endpoints and keeps returned config apiKey-free", async () => {
  const calls: Array<{ readonly url: string; readonly body: Record<string, unknown> }> = [];
  const client = createSteamOSLocalBackendClient({
    baseUrl: "http://127.0.0.1:4123",
    token: "session-token",
    fetchImpl: async (input, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({
        url: String(input),
        body,
      });

      const route = String(input);
      if (route.endsWith("/get_provider_configs")) {
        return createJsonResponse(200, {
          version: 1,
          retroAchievements: {
            username: "sol88",
            hasApiKey: true,
            recentAchievementsCount: 10,
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
      if (route.endsWith("/save_retroachievements_credentials")) {
        return createJsonResponse(200, {
          username: "sol88",
          hasApiKey: true,
          recentAchievementsCount: 10,
        });
      }
      if (route.endsWith("/save_steam_credentials")) {
        return createJsonResponse(200, {
          steamId64: "76561198136628813",
          hasApiKey: true,
          language: "english",
          recentAchievementsCount: 3,
          recentlyPlayedCount: 3,
          includePlayedFreeGames: true,
        });
      }
      if (route.endsWith("/clear_provider_credentials")) {
        return createJsonResponse(200, { ok: true, cleared: true });
      }
      throw new Error(`Unexpected route: ${route}`);
    },
  });
  const providerConfigStore = createSteamOSProviderConfigStore(client);

  const loadedRetroAchievements = await providerConfigStore.load(RETROACHIEVEMENTS_PROVIDER_ID);
  const savedRetroAchievements = await providerConfigStore.save(RETROACHIEVEMENTS_PROVIDER_ID, {
    username: "sol88",
    hasApiKey: false,
    apiKeyDraft: "retro-secret",
    recentAchievementsCount: 10,
  } satisfies SteamOSProviderConfigValue);
  const savedSteam = await providerConfigStore.save(STEAM_PROVIDER_ID, {
    steamId64: "76561198136628813",
    hasApiKey: false,
    apiKeyDraft: "steam-secret",
    language: "english",
    recentAchievementsCount: 3,
    recentlyPlayedCount: 3,
    includePlayedFreeGames: true,
  } satisfies SteamOSProviderConfigValue);
  const cleared = await providerConfigStore.clear(STEAM_PROVIDER_ID);

  assert.deepStrictEqual(loadedRetroAchievements, {
    username: "sol88",
    hasApiKey: true,
    recentAchievementsCount: 10,
  });
  assert.deepStrictEqual(savedRetroAchievements, {
    username: "sol88",
    hasApiKey: true,
    recentAchievementsCount: 10,
  });
  assert.deepStrictEqual(savedSteam, {
    steamId64: "76561198136628813",
    hasApiKey: true,
    language: "english",
    recentAchievementsCount: 3,
    recentlyPlayedCount: 3,
    includePlayedFreeGames: true,
  });
  assert.equal(cleared, true);
  assert.deepStrictEqual(calls[1]?.body, {
    username: "sol88",
    apiKeyDraft: "retro-secret",
    recentAchievementsCount: 10,
  });
  assert.deepStrictEqual(calls[2]?.body, {
    steamId64: "76561198136628813",
    apiKeyDraft: "steam-secret",
    language: "english",
    recentAchievementsCount: 3,
    recentlyPlayedCount: 3,
    includePlayedFreeGames: true,
  });
  assert.deepStrictEqual(calls[3]?.body, {
    providerId: STEAM_PROVIDER_ID,
  });
  assert.doesNotMatch(JSON.stringify(savedRetroAchievements), /apiKey/u);
  assert.doesNotMatch(JSON.stringify(savedSteam), /apiKey/u);
});

test("SteamOS diagnostic logger redacts payloads and swallows backend failures", async () => {
  const calls: Array<{ readonly url: string; readonly body: Record<string, unknown> }> = [];
  const successClient = createSteamOSLocalBackendClient({
    baseUrl: "http://127.0.0.1:4123",
    token: "session-token",
    fetchImpl: async (input, init) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return createJsonResponse(200, { ok: true, recorded: true });
    },
  });
  const logger = createSteamOSDiagnosticLogger(successClient);

  await assert.doesNotReject(async () => {
    await logger.record({
      event: "dashboard_refresh_completed",
      providerId: "steam",
      durationMs: 12,
      apiKey: "secret",
      apiKeyDraft: "draft",
      Authorization: "Bearer token",
      key: "steam-secret",
    } satisfies SteamOSDiagnosticEventPayload);
  });

  assert.equal(calls[0]?.url, "http://127.0.0.1:4123/record_diagnostic_event");
  assert.deepStrictEqual(calls[0]?.body, {
    event: "dashboard_refresh_completed",
    providerId: "steam",
    durationMs: 12,
    apiKey: "[redacted]",
    apiKeyDraft: "[redacted]",
    Authorization: "[redacted]",
    key: "[redacted]",
  });

  const failingLogger = createSteamOSDiagnosticLogger(
    createSteamOSLocalBackendClient({
      baseUrl: "http://127.0.0.1:4123",
      token: "session-token",
      fetchImpl: async () => createJsonResponse(500, { ok: false, error: "boom" }, "Server Error"),
    }),
  );

  await assert.doesNotReject(async () => {
    await failingLogger.record({
      event: "dashboard_refresh_failed",
      providerId: "steam",
      errorKind: "network",
      token: "session-token",
    });
  });
});

test("SteamOS dashboard cache store uses backend cache endpoints and maps misses safely", async () => {
  const calls: Array<{ readonly url: string; readonly body: Record<string, unknown> }> = [];
  const client = createSteamOSLocalBackendClient({
    baseUrl: "http://127.0.0.1:4123",
    token: "session-token",
    fetchImpl: async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push({ url, body });

      if (url.endsWith("/cache/dashboard/read")) {
        return createJsonResponse(200, body["providerId"] === STEAM_PROVIDER_ID
          ? { hit: true, value: { refreshedAt: 12 } }
          : { hit: false });
      }

      if (url.endsWith("/cache/dashboard/write")) {
        return createJsonResponse(200, { ok: true });
      }

      if (url.endsWith("/cache/dashboard/clear")) {
        return createJsonResponse(200, {
          ok: true,
          cleared: body["providerId"] !== RETROACHIEVEMENTS_PROVIDER_ID,
        });
      }

      throw new Error(`Unexpected route: ${url}`);
    },
  });
  const store = createSteamOSDashboardSnapshotStore<{ readonly refreshedAt: number }>(client);

  assert.deepStrictEqual(await store.read(STEAM_PROVIDER_ID), { refreshedAt: 12 });
  assert.equal(await store.read(RETROACHIEVEMENTS_PROVIDER_ID), undefined);
  await store.write(STEAM_PROVIDER_ID, {
    refreshedAt: 12,
    profile: {
      metrics: [
        {
          key: "games-beaten",
          label: "Perfect Games",
          value: "3",
        },
      ],
    },
  });
  assert.equal(await store.clear(STEAM_PROVIDER_ID), true);
  assert.equal(await store.clear(), true);
  assert.equal(await store.clear("mock-provider"), false);

  assert.deepStrictEqual(calls.map((call) => call.url), [
    "http://127.0.0.1:4123/cache/dashboard/read",
    "http://127.0.0.1:4123/cache/dashboard/read",
    "http://127.0.0.1:4123/cache/dashboard/write",
    "http://127.0.0.1:4123/cache/dashboard/clear",
    "http://127.0.0.1:4123/cache/dashboard/clear",
  ]);
  assert.deepStrictEqual(calls[0]?.body, { providerId: STEAM_PROVIDER_ID });
  assert.deepStrictEqual(calls[1]?.body, { providerId: RETROACHIEVEMENTS_PROVIDER_ID });
  assert.deepStrictEqual(calls[2]?.body, {
    providerId: STEAM_PROVIDER_ID,
    value: {
      refreshedAt: 12,
      profile: {
        metrics: [
          {
            key: "games-beaten",
            label: "Perfect Games",
            value: "3",
          },
        ],
      },
    },
  });
  assert.deepStrictEqual(calls[3]?.body, { providerId: STEAM_PROVIDER_ID });
  assert.deepStrictEqual(calls[4]?.body, {});

  for (const call of calls) {
    assert.doesNotMatch(JSON.stringify(call.body), /apiKey/u);
    assert.doesNotMatch(JSON.stringify(call.body), /token/u);
  }
});

test("SteamOS steam scan cache store uses backend cache endpoints and keeps cache payloads out of URLs", async () => {
  const calls: Array<{ readonly url: string; readonly body: Record<string, unknown> }> = [];
  const client = createSteamOSLocalBackendClient({
    baseUrl: "http://127.0.0.1:4123",
    token: "session-token",
    fetchImpl: async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push({ url, body });

      if (url.endsWith("/cache/steam-scan/read-overview")) {
        return createJsonResponse(200, { hit: true, value: { count: 1 } });
      }
      if (url.endsWith("/cache/steam-scan/read-summary")) {
        return createJsonResponse(200, { hit: false });
      }
      if (url.endsWith("/cache/steam-scan/write-overview") || url.endsWith("/cache/steam-scan/write-summary")) {
        return createJsonResponse(200, { ok: true });
      }
      if (url.endsWith("/cache/steam-scan/clear")) {
        return createJsonResponse(200, { ok: true, cleared: true });
      }

      throw new Error(`Unexpected route: ${url}`);
    },
  });
  const store = createSteamOSSteamLibraryScanStore<{ readonly count: number }, { readonly count: number }>(client);

  assert.deepStrictEqual(await store.readOverview(STEAM_PROVIDER_ID), { count: 1 });
  assert.equal(await store.readOverview(RETROACHIEVEMENTS_PROVIDER_ID), undefined);
  assert.equal(await store.readSummary(STEAM_PROVIDER_ID), undefined);
  await store.writeOverview(STEAM_PROVIDER_ID, { count: 1 });
  await store.writeSummary(STEAM_PROVIDER_ID, { count: 2 });
  assert.equal(await store.clear(STEAM_PROVIDER_ID), true);
  assert.equal(await store.clear(), true);
  assert.equal(await store.clear(RETROACHIEVEMENTS_PROVIDER_ID), false);

  assert.deepStrictEqual(calls.map((call) => call.url), [
    "http://127.0.0.1:4123/cache/steam-scan/read-overview",
    "http://127.0.0.1:4123/cache/steam-scan/read-summary",
    "http://127.0.0.1:4123/cache/steam-scan/write-overview",
    "http://127.0.0.1:4123/cache/steam-scan/write-summary",
    "http://127.0.0.1:4123/cache/steam-scan/clear",
    "http://127.0.0.1:4123/cache/steam-scan/clear",
  ]);
  assert.deepStrictEqual(calls[0]?.body, {});
  assert.deepStrictEqual(calls[1]?.body, {});
  assert.deepStrictEqual(calls[2]?.body, { value: { count: 1 } });
  assert.deepStrictEqual(calls[3]?.body, { value: { count: 2 } });
  assert.deepStrictEqual(calls[4]?.body, {});
  assert.deepStrictEqual(calls[5]?.body, {});

  for (const call of calls) {
    assert.doesNotMatch(call.url, /session-token/u);
    assert.doesNotMatch(call.url, /apiKey/u);
    assert.doesNotMatch(JSON.stringify(call.body), /apiKey/u);
    assert.doesNotMatch(JSON.stringify(call.body), /token/u);
  }
});

test("SteamOS steam scan overview loader ignores legacy summaries when no overview exists", async () => {
  const writes: Array<{ readonly providerId: string; readonly overview: ReturnType<typeof createSteamOSSteamLibraryScanOverview> }> = [];
  const summary = {
    scannedAt: "2026-04-30T08:30:00.000Z",
    ownedGameCount: 4,
    scannedGameCount: 4,
    gamesWithAchievements: 3,
    skippedGameCount: 1,
    failedGameCount: 0,
    totalAchievements: 20,
    unlockedAchievements: 10,
    perfectGames: 1,
    completionPercent: 50,
    games: [],
  } as const;

  const overview = await loadSteamOSSteamLibraryScanOverview({
    async readOverview() {
      return undefined;
    },
    async writeOverview(providerId, value) {
      writes.push({ providerId, overview: value });
    },
    async readSummary() {
      return summary;
    },
    async writeSummary() {},
    async clear() {
      return true;
    },
  });

  assert.equal(overview, undefined);
  assert.deepStrictEqual(writes, []);
});

test("SteamOS steam library scan only runs on explicit invocation and writes safe aggregate overview", async () => {
  const requestBodies: Array<Record<string, unknown>> = [];
  const writtenOverviews: unknown[] = [];
  const runtime = {
    adapters: {
      client: createSteamOSLocalBackendClient({
        baseUrl: "http://127.0.0.1:4123",
        token: "session-token",
        fetchImpl: async (input, init) => {
          const route = String(input);
          const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
          requestBodies.push(body);

          if (!route.endsWith("/request_steam_json")) {
            throw new Error(`Unexpected route: ${route}`);
          }

          const path = body["path"];
          if (path === "IPlayerService/GetOwnedGames/v1/") {
            return createJsonResponse(200, {
              response: {
                game_count: 1,
                games: [
                  {
                    appid: 10,
                    name: "Half-Life",
                    playtime_forever: 120,
                  },
                ],
              },
            });
          }

          if (path === "ISteamUserStats/GetPlayerAchievements/v1/") {
            return createJsonResponse(200, {
              playerstats: {
                success: true,
                achievements: [
                  {
                    apiname: "ACH_WIN_ONE",
                    achieved: 1,
                    unlocktime: 1_710_000_000,
                  },
                ],
              },
            });
          }

          if (path === "ISteamUserStats/GetSchemaForGame/v2/") {
            return createJsonResponse(200, {
              game: {
                availableGameStats: {
                  achievements: [
                    {
                      name: "ACH_WIN_ONE",
                      displayName: "Win One",
                      description: "Finish the opener.",
                      icon: "icon.png",
                    },
                  ],
                },
              },
            });
          }

          throw new Error(`Unexpected Steam path: ${String(path)}`);
        },
      }),
      steamLibraryScanStore: {
        async readOverview() {
          return undefined;
        },
        async writeOverview(_providerId, value) {
          writtenOverviews.push(value);
        },
        async readSummary() {
          return undefined;
        },
        async writeSummary() {
          throw new Error("summary write should not be called");
        },
        async clear() {
          return true;
        },
      },
    },
  } as const;

  assert.equal(requestBodies.length, 0);

  const overview = await runSteamOSSteamLibraryScan({
    runtime: runtime as never,
    config: {
      steamId64: "76561198136628813",
      hasApiKey: true,
      language: "english",
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
      includePlayedFreeGames: false,
    },
  });

  assert.equal(requestBodies.length, 3);
  assert.deepStrictEqual(overview, {
    ownedGameCount: 1,
    scannedGameCount: 1,
    gamesWithAchievements: 1,
    unlockedAchievements: 1,
    totalAchievements: 1,
    perfectGames: 1,
    completionPercent: 100,
    scannedAt: overview.scannedAt,
  });
  assert.equal(writtenOverviews.length, 1);
  assert.doesNotMatch(JSON.stringify(writtenOverviews[0]), /steamId64|apiKey|Authorization|token/u);
});

test("SteamOS adapter bundle exposes cache-backed stores and honest platform capabilities", async () => {
  const calls: Array<{ readonly url: string; readonly body: Record<string, unknown> }> = [];
  const client = createSteamOSLocalBackendClient({
    baseUrl: "http://127.0.0.1:4123",
    token: "session-token",
    fetchImpl: async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push({ url, body });

      if (url.endsWith("/cache/dashboard/write") || url.endsWith("/cache/steam-scan/write-overview") || url.endsWith("/cache/steam-scan/write-summary")) {
        return createJsonResponse(200, { ok: true });
      }
      if (url.endsWith("/cache/dashboard/read")) {
        return createJsonResponse(200, { hit: true, value: { refreshedAt: 1 } });
      }
      if (url.endsWith("/cache/steam-scan/read-overview")) {
        return createJsonResponse(200, { hit: true, value: { count: 1 } });
      }
      if (url.endsWith("/cache/steam-scan/read-summary")) {
        return createJsonResponse(200, { hit: true, value: { count: 2 } });
      }

      return createJsonResponse(200, {});
    },
  });
  const adapters = createSteamOSAdapters({ client });

  await adapters.dashboardSnapshotStore.write("steam", { refreshedAt: 1 });
  await adapters.steamLibraryScanStore.writeOverview("steam", { count: 1 });
  await adapters.steamLibraryScanStore.writeSummary("steam", { count: 2 });

  assert.deepStrictEqual(await adapters.dashboardSnapshotStore.read("steam"), { refreshedAt: 1 });
  assert.deepStrictEqual(await adapters.steamLibraryScanStore.readOverview("steam"), { count: 1 });
  assert.deepStrictEqual(await adapters.steamLibraryScanStore.readSummary("steam"), { count: 2 });
  assert.deepStrictEqual(calls.map((call) => call.url), [
    "http://127.0.0.1:4123/cache/dashboard/write",
    "http://127.0.0.1:4123/cache/steam-scan/write-overview",
    "http://127.0.0.1:4123/cache/steam-scan/write-summary",
    "http://127.0.0.1:4123/cache/dashboard/read",
    "http://127.0.0.1:4123/cache/steam-scan/read-overview",
    "http://127.0.0.1:4123/cache/steam-scan/read-summary",
  ]);
  for (const call of calls) {
    assert.doesNotMatch(JSON.stringify(call.body), /apiKey/u);
    assert.doesNotMatch(JSON.stringify(call.body), /token/u);
  }
  assert.deepStrictEqual(steamosPlatformCapabilities, {
    supportsCompactNavigation: false,
    supportsFullscreenNavigation: false,
    supportsPersistentSettings: false,
    supportsSecretStorage: true,
    supportsAuthenticatedProviderTransport: true,
    supportsDiagnosticLogging: true,
    supportsSteamLibraryScan: true,
  });
});

test("SteamOS adapter sources stay free of Decky imports and browser storage", () => {
  const steamosSource = readSourceTree("src/platform/steamos");
  const coreSource = readSourceTree("src/core");
  const providersSource = readSourceTree("src/providers");

  assert.doesNotMatch(steamosSource, /platform\/decky/u);
  assert.doesNotMatch(steamosSource, /\bfrom\s+["']@decky\/[^"']+["']/u);
  assert.doesNotMatch(steamosSource, /localStorage/u);
  assert.doesNotMatch(steamosSource, /sessionStorage/u);
  assert.doesNotMatch(steamosSource, /OneDrive/u);
  assert.doesNotMatch(coreSource, /platform\/steamos/u);
  assert.doesNotMatch(providersSource, /platform\/steamos/u);
});
