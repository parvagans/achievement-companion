import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SteamOSBootstrapStatus,
  SteamOSDevShellStatusPanel,
  autoMountSteamOSShell,
  bootstrapSteamOSShell,
  loadSteamOSDevShellDiagnosticsStatus,
} from "../src/platform/steamos/bootstrap";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../src/providers/retroachievements/config";
import { STEAM_PROVIDER_ID } from "../src/providers/steam/config";

interface FetchCall {
  readonly url: string;
  readonly init?: RequestInit;
}

const VALID_TOKEN = "abcdefghijklmnopqrstuvwxyz1234567890TOKEN";

type SteamOSRuntime = ReturnType<typeof import("../src/platform/steamos/create-steamos-app-runtime").createSteamOSAppRuntime>;

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

function createMockRuntime(
  configs: Record<string, unknown>,
): SteamOSRuntime {
  return {
    platform: {
      info: {
        platformId: "desktop",
        appName: "Achievement Companion",
      },
    },
    adapters: {
      providerConfigStore: {
        async load(providerId: string) {
          return configs[providerId];
        },
      },
    },
  } as SteamOSRuntime;
}

test("SteamOS bootstrap entrypoint renders loading and connected states without exposing tokens", async () => {
  const states: string[] = [];
  const calls: FetchCall[] = [];
  const createdRuntimes: Array<{ readonly baseUrl: string; readonly token: string }> = [];

  const result = await bootstrapSteamOSShell({
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), init });
      return createJsonResponse(200, {
        host: "127.0.0.1",
        port: 4123,
        pid: 123,
        token: VALID_TOKEN,
        startedAt: "2026-04-25T10:00:00.000Z",
      });
    },
    createRuntime: (config) => {
      createdRuntimes.push(config);
      return createMockRuntime({
        [RETROACHIEVEMENTS_PROVIDER_ID]: { hasApiKey: true },
        [STEAM_PROVIDER_ID]: { hasApiKey: false },
      });
    },
    renderState: (state) => {
      states.push(renderToStaticMarkup(<SteamOSBootstrapStatus state={state} />));
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "/__achievement_companion__/runtime");
  assert.equal(createdRuntimes.length, 1);
  assert.deepStrictEqual(createdRuntimes[0], {
    baseUrl: "http://127.0.0.1:4123",
    token: VALID_TOKEN,
  });
  assert.equal(result.state.phase, "connected");
  assert.equal(states.length, 2);
  assert.match(states[0] ?? "", /Loading SteamOS backend\.\.\./u);
  assert.match(states[1] ?? "", /Connected to SteamOS backend/u);
  assert.match(states[1] ?? "", /SteamOS dev shell/u);
  assert.match(states[1] ?? "", /RetroAchievements/u);
  assert.match(states[1] ?? "", /configured/u);
  assert.match(states[1] ?? "", /Steam/u);
  assert.match(states[1] ?? "", /not configured/u);
  assert.doesNotMatch(states.join("\n"), new RegExp(VALID_TOKEN, "u"));
  assert.doesNotMatch(calls[0]?.url ?? "", new RegExp(VALID_TOKEN, "u"));
});

test("SteamOS bootstrap entrypoint auto-mounts when a root element exists", async () => {
  const rootElement = { id: "root" } as Element;
  const mountCalls: Array<{ readonly rootElement?: Element; readonly document?: Document }> = [];

  const result = await autoMountSteamOSShell({
    document: {
      getElementById(id: string) {
        return id === "root" ? rootElement : null;
      },
    } as Document,
    mount: async (options) => {
      mountCalls.push({
        rootElement: options?.rootElement,
        document: options?.document,
      });
      return {
        state: {
          phase: "connected",
          message: "Connected to SteamOS backend",
        },
      };
    },
  });

  assert.equal(mountCalls.length, 1);
  assert.equal(mountCalls[0]?.rootElement, rootElement);
  assert.equal(result?.state.phase, "connected");
});

test("SteamOS bootstrap entrypoint auto-mount is safe when document or root is absent", async () => {
  const noDocumentResult = autoMountSteamOSShell({
    document: undefined,
    mount: async () => {
      throw new Error("mount should not run without document");
    },
  });
  assert.equal(noDocumentResult, undefined);

  const noRootResult = autoMountSteamOSShell({
    document: {
      getElementById() {
        return null;
      },
    } as Document,
    mount: async () => {
      throw new Error("mount should not run without root");
    },
  });
  assert.equal(noRootResult, undefined);
});

test("SteamOS bootstrap entrypoint renders provider status from frontend-safe config", async () => {
  const states: string[] = [];

  const result = await bootstrapSteamOSShell({
    loadBootstrapConfig: async () => ({
      baseUrl: "http://127.0.0.1:4123",
      token: VALID_TOKEN,
    }),
    createRuntime: () =>
      createMockRuntime({
        [RETROACHIEVEMENTS_PROVIDER_ID]: undefined,
        [STEAM_PROVIDER_ID]: { hasApiKey: true },
      }),
    renderState: (state) => {
      states.push(renderToStaticMarkup(<SteamOSBootstrapStatus state={state} />));
    },
  });

  assert.equal(result.state.phase, "connected");
  assert.equal(result.state.providerConfigStatus, "loaded");
  assert.equal(result.state.providers?.retroAchievements.status, "not_configured");
  assert.equal(result.state.providers?.steam.status, "configured");
  assert.match(states[1] ?? "", /RetroAchievements/u);
  assert.match(states[1] ?? "", /not configured/u);
  assert.match(states[1] ?? "", /Steam/u);
  assert.match(states[1] ?? "", /configured/u);
  assert.doesNotMatch(states.join("\n"), /apiKey|apiKeyDraft|Authorization|password|secret|\by\b/u);
  assert.doesNotMatch(states.join("\n"), new RegExp(VALID_TOKEN, "u"));
});

test("SteamOS dev shell diagnostics panel renders safe local status without exposing raw secrets", () => {
  const markup = renderToStaticMarkup(
    <SteamOSDevShellStatusPanel
      state={{
        phase: "loaded",
        message: "SteamOS dev shell status ready",
        snapshot: {
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
            configured: false,
            steamId64Present: false,
            hasApiKey: false,
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
              present: false,
              valid: false,
            },
          },
        },
      }}
      onRefresh={() => {}}
    />,
  );

  assert.match(markup, /SteamOS dev shell status/u);
  assert.match(markup, /Backend/u);
  assert.match(markup, /reachable/u);
  assert.match(markup, /Runtime metadata/u);
  assert.match(markup, /valid/u);
  assert.match(markup, /Provider config file/u);
  assert.match(markup, /Provider secrets file/u);
  assert.match(markup, /RetroAchievements/u);
  assert.match(markup, /configured/u);
  assert.match(markup, /Steam/u);
  assert.match(markup, /not configured/u);
  assert.match(markup, /RetroAchievements cache/u);
  assert.match(markup, /cached/u);
  assert.match(markup, /Steam cache/u);
  assert.match(markup, /missing/u);
  assert.match(markup, /Refresh status/u);
  assert.doesNotMatch(markup, /sol88|steam-secret|apiKeyDraft|Authorization|provider-secrets|76561198136628813/u);
});

test("SteamOS dev shell diagnostics load helper returns safe loading success and failure states", async () => {
  const loadedState = await loadSteamOSDevShellDiagnosticsStatus({
    async load() {
      return {
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
      };
    },
  });
  const failedState = await loadSteamOSDevShellDiagnosticsStatus({
    async load() {
      throw new Error("backend secret leak should not appear");
    },
  });

  assert.equal(loadedState.phase, "loaded");
  assert.equal(loadedState.message, "SteamOS dev shell status ready");
  assert.equal(loadedState.snapshot?.backendReachable, true);
  assert.equal(failedState.phase, "error");
  assert.equal(failedState.message, "Backend unavailable");
  assert.doesNotMatch(JSON.stringify(loadedState), /backend secret leak should not appear/u);
  assert.doesNotMatch(JSON.stringify(failedState), /backend secret leak should not appear/u);
});

test("SteamOS bootstrap entrypoint keeps backend connected when provider config is unavailable", async () => {
  const states: string[] = [];

  const result = await bootstrapSteamOSShell({
    loadBootstrapConfig: async () => ({
      baseUrl: "http://127.0.0.1:4123",
      token: VALID_TOKEN,
    }),
    createRuntime: () =>
      ({
        platform: {
          info: {
            platformId: "desktop",
            appName: "Achievement Companion",
          },
        },
        adapters: {
          providerConfigStore: {
            async load() {
              throw new Error(`config failure ${VALID_TOKEN}`);
            },
          },
        },
      }) as SteamOSRuntime,
    renderState: (state) => {
      states.push(renderToStaticMarkup(<SteamOSBootstrapStatus state={state} />));
    },
  });

  assert.equal(result.state.phase, "connected");
  assert.equal(result.state.providerConfigStatus, "unavailable");
  assert.match(states[1] ?? "", /Connected to SteamOS backend/u);
  assert.match(states[1] ?? "", /Provider config unavailable/u);
  assert.match(states[1] ?? "", /RetroAchievements/u);
  assert.match(states[1] ?? "", /unavailable/u);
  assert.match(states[1] ?? "", /Steam/u);
  assert.doesNotMatch(states.join("\n"), /config failure/u);
  assert.doesNotMatch(states.join("\n"), new RegExp(VALID_TOKEN, "u"));
});

test("SteamOS bootstrap entrypoint renders a safe error state for metadata failures", async () => {
  const states: string[] = [];

  const result = await bootstrapSteamOSShell({
    loadBootstrapConfig: async () => {
      throw new Error(`bad metadata ${VALID_TOKEN}`);
    },
    renderState: (state) => {
      states.push(renderToStaticMarkup(<SteamOSBootstrapStatus state={state} />));
    },
  });

  assert.equal(result.state.phase, "error");
  assert.equal(result.runtime, undefined);
  assert.equal(states.length, 2);
  assert.match(states[0] ?? "", /Loading SteamOS backend\.\.\./u);
  assert.match(states[1] ?? "", /SteamOS backend unavailable/u);
  assert.doesNotMatch(states.join("\n"), new RegExp(VALID_TOKEN, "u"));
  assert.doesNotMatch(states.join("\n"), /bad metadata/u);
});

test("SteamOS bootstrap entrypoint stays isolated from Decky, browser storage, and release payload changes", () => {
  const steamosSource = readSourceTree(join(process.cwd(), "src", "platform", "steamos"));
  const coreSource = readSourceTree(join(process.cwd(), "src", "core"));
  const providerSource = readSourceTree(join(process.cwd(), "src", "providers"));
  const deckyEntrypoint = readFileSync(join(process.cwd(), "src", "index.tsx"), "utf-8");
  const packageRelease = readFileSync(join(process.cwd(), "scripts", "package_release.py"), "utf-8");
  const checkRelease = readFileSync(join(process.cwd(), "scripts", "check_release_artifact.py"), "utf-8");

  assert.doesNotMatch(steamosSource, /@decky|platform\/decky|platform\\decky/u);
  assert.doesNotMatch(steamosSource, /localStorage|sessionStorage/u);
  assert.doesNotMatch(steamosSource, /C:\\Users\\Arenn\\OneDrive/u);
  assert.doesNotMatch(deckyEntrypoint, /platform\/steamos\/bootstrap|platform\\steamos\\bootstrap/u);
  assert.doesNotMatch(coreSource, /platform\/steamos\/bootstrap|platform\\steamos\\bootstrap/u);
  assert.doesNotMatch(providerSource, /platform\/steamos\/bootstrap|platform\\steamos\\bootstrap/u);
  assert.doesNotMatch(packageRelease, /src\/platform\/steamos\/bootstrap\.tsx|src\\platform\\steamos\\bootstrap\.tsx/u);
  assert.doesNotMatch(checkRelease, /src\/platform\/steamos\/bootstrap\.tsx|src\\platform\\steamos\\bootstrap\.tsx/u);
});
