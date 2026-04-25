import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../src/providers/retroachievements/config";
import { STEAM_PROVIDER_ID } from "../src/providers/steam/config";
import {
  DEFAULT_STEAMOS_RUNTIME_METADATA_URL,
  SteamOSRuntimeBootstrapError,
  loadSteamOSBootstrapConfig,
} from "../src/platform/steamos/runtime-bootstrap";
import { createSteamOSAppRuntime } from "../src/platform/steamos/create-steamos-app-runtime";

interface FetchCall {
  readonly url: string;
  readonly init?: RequestInit;
  readonly body?: Record<string, unknown>;
}

const VALID_TOKEN = "abcdefghijklmnopqrstuvwxyz1234567890TOKEN";

function createJsonResponse(status: number, payload: unknown, contentType = "application/json"): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": contentType,
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

test("SteamOS bootstrap loads same-origin runtime metadata and returns client config without placing tokens in URLs", async () => {
  const calls: FetchCall[] = [];
  const config = await loadSteamOSBootstrapConfig({
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), init });
      return createJsonResponse(200, {
        host: "127.0.0.1",
        port: 4123,
        pid: 123,
        token: VALID_TOKEN,
        startedAt: "2026-04-25T10:00:00.000Z",
      }, "application/json; charset=utf-8");
    },
  });

  assert.deepStrictEqual(config, {
    baseUrl: "http://127.0.0.1:4123",
    token: VALID_TOKEN,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, DEFAULT_STEAMOS_RUNTIME_METADATA_URL);
  assert.equal(calls[0]?.init?.method, "GET");
  assert.equal(calls[0]?.init?.cache, "no-store");
  assert.equal((calls[0]?.init?.headers as Record<string, string> | undefined)?.Accept, "application/json");
  assert.doesNotMatch(calls[0]?.url ?? "", new RegExp(VALID_TOKEN, "u"));
  assert.doesNotMatch(config.baseUrl, new RegExp(VALID_TOKEN, "u"));
});

test("SteamOS bootstrap rejects unsafe metadata and non-same-origin bootstrap URLs", async () => {
  await assert.rejects(
    () =>
      loadSteamOSBootstrapConfig({
        bootstrapUrl: "http://127.0.0.1:4123/__achievement_companion__/runtime",
        fetchImpl: async () => createJsonResponse(200, {}),
      }),
    (error: unknown) =>
      error instanceof SteamOSRuntimeBootstrapError && error.code === "invalid_bootstrap_url",
  );

  await assert.rejects(
    () =>
      loadSteamOSBootstrapConfig({
        fetchImpl: async () =>
          createJsonResponse(200, {
            host: "localhost",
            port: 4123,
            pid: 123,
            token: VALID_TOKEN,
            startedAt: "2026-04-25T10:00:00.000Z",
          }),
      }),
    (error: unknown) =>
      error instanceof SteamOSRuntimeBootstrapError &&
      error.code === "invalid_metadata" &&
      !error.message.includes(VALID_TOKEN),
  );

  await assert.rejects(
    () =>
      loadSteamOSBootstrapConfig({
        fetchImpl: async () => createJsonResponse(200, { ok: true }, "text/plain"),
      }),
    (error: unknown) =>
      error instanceof SteamOSRuntimeBootstrapError && error.code === "invalid_content_type",
  );
});

test("SteamOS app runtime composes shared services with local backend adapters without backend calls during construction", async () => {
  const calls: FetchCall[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const body = init?.body !== undefined
      ? (JSON.parse(String(init.body)) as Record<string, unknown>)
      : undefined;
    const url = String(input);
    calls.push({ url, init, body });

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

    if (url.endsWith("/cache/dashboard/write") || url.endsWith("/cache/steam-scan/write-overview")) {
      return createJsonResponse(200, { ok: true });
    }

    if (url.endsWith("/cache/dashboard/read")) {
      return createJsonResponse(200, {
        hit: true,
        value: { refreshedAt: 123 },
      });
    }

    if (url.endsWith("/cache/steam-scan/read-overview")) {
      return createJsonResponse(200, {
        hit: true,
        value: { scannedGameCount: 7 },
      });
    }

    if (url.endsWith("/record_diagnostic_event")) {
      return createJsonResponse(200, { ok: true, recorded: true });
    }

    throw new Error(`Unexpected SteamOS bootstrap route: ${url}`);
  };

  const runtime = createSteamOSAppRuntime(
    {
      baseUrl: "http://127.0.0.1:4123",
      token: VALID_TOKEN,
    },
    {
      fetchImpl,
    },
  );

  assert.equal(calls.length, 0);
  assert.equal(runtime.platform.info.platformId, "desktop");
  assert.equal(runtime.platform.info.appName, "Achievement Companion");
  assert.equal(runtime.providerRegistry.list().length, 2);

  const retroConfig = await runtime.adapters.providerConfigStore?.load(RETROACHIEVEMENTS_PROVIDER_ID);
  assert.deepStrictEqual(retroConfig, {
    username: "sol88",
    hasApiKey: true,
    recentAchievementsCount: 10,
    recentlyPlayedCount: 10,
  });

  await runtime.adapters.dashboardSnapshotStore?.write(RETROACHIEVEMENTS_PROVIDER_ID, {
    refreshedAt: 123,
  });
  assert.deepStrictEqual(await runtime.adapters.dashboardSnapshotStore?.read(RETROACHIEVEMENTS_PROVIDER_ID), {
    refreshedAt: 123,
  });

  await runtime.adapters.steamLibraryScanStore?.writeOverview(STEAM_PROVIDER_ID, {
    scannedGameCount: 7,
  });
  assert.deepStrictEqual(await runtime.adapters.steamLibraryScanStore?.readOverview(STEAM_PROVIDER_ID), {
    scannedGameCount: 7,
  });

  await runtime.adapters.diagnosticLogger?.record({
    event: "dashboard_refresh_completed",
    providerId: STEAM_PROVIDER_ID,
    apiKey: "raw-api-key",
    Authorization: "Bearer raw-token",
  });

  const routes = calls.map((call) => call.url.replace("http://127.0.0.1:4123/", ""));
  assert.deepStrictEqual(routes, [
    "get_provider_configs",
    "cache/dashboard/write",
    "cache/dashboard/read",
    "cache/steam-scan/write-overview",
    "cache/steam-scan/read-overview",
    "record_diagnostic_event",
  ]);

  for (const call of calls) {
    assert.equal((call.init?.headers as Record<string, string> | undefined)?.Authorization, `Bearer ${VALID_TOKEN}`);
    assert.doesNotMatch(call.url, new RegExp(VALID_TOKEN, "u"));
    assert.doesNotMatch(call.url, /apiKey|apiKeyDraft|password|secret|token|Authorization|\by\b/u);
  }

  const diagnosticBody = calls.at(-1)?.body;
  assert.doesNotMatch(JSON.stringify(diagnosticBody), /raw-api-key|raw-token/u);
});

test("SteamOS bootstrap and runtime helpers remain isolated from Decky and browser storage", () => {
  const steamosSource = readSourceTree(join(process.cwd(), "src", "platform", "steamos"));
  const coreSource = readSourceTree(join(process.cwd(), "src", "core"));
  const providerSource = readSourceTree(join(process.cwd(), "src", "providers"));
  const deckyEntrypoint = readFileSync(join(process.cwd(), "src", "index.tsx"), "utf-8");

  assert.doesNotMatch(steamosSource, /@decky|platform\/decky|platform\\decky/u);
  assert.doesNotMatch(steamosSource, /localStorage|sessionStorage/u);
  assert.doesNotMatch(steamosSource, /C:\\Users\\Arenn\\OneDrive/u);
  assert.doesNotMatch(deckyEntrypoint, /platform\/steamos|platform\\steamos|runtime-bootstrap|create-steamos-app-runtime/u);
  assert.doesNotMatch(coreSource, /platform\/steamos|platform\\steamos/u);
  assert.doesNotMatch(providerSource, /platform\/steamos|platform\\steamos/u);
});
