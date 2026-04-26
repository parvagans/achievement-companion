import assert from "node:assert/strict";
import { createSteamOSAppRuntime } from "../../src/platform/steamos/create-steamos-app-runtime";
import { loadSteamOSBootstrapConfig } from "../../src/platform/steamos/runtime-bootstrap";
import { STEAM_PROVIDER_ID } from "../../src/providers/steam/config";

const shellUrlArg = process.argv[2];
if (shellUrlArg === undefined) {
  throw new Error("Usage: steamos-live-shell-bootstrap-smoke.ts <shell-url>");
}

const shellUrl = new URL(shellUrlArg);
assert.equal(shellUrl.hostname, "127.0.0.1");
assert.equal(shellUrl.protocol, "http:");

function resolveShellUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input === "string" && input.startsWith("/")) {
    return new URL(input, shellUrl);
  }

  return input;
}

async function fetchText(path: string): Promise<{ readonly response: Response; readonly text: string }> {
  const response = await fetch(new URL(path, shellUrl), {
    method: "GET",
    cache: "no-store",
  });
  const text = await response.text();
  return { response, text };
}

const html = await fetchText("/");
assert.equal(html.response.status, 200);
assert.match(html.response.headers.get("Content-Type") ?? "", /text\/html/u);
assert.match(html.text, /Achievement Companion SteamOS dev shell/u);
assert.match(html.text, /\/assets\/steamos-bootstrap\.js/u);

const asset = await fetchText("/assets/steamos-bootstrap.js");
assert.equal(asset.response.status, 200);
assert.match(asset.response.headers.get("Content-Type") ?? "", /application\/javascript|text\/javascript/u);
const forbiddenAssetMarkers = [
  "provider-secrets",
  "Authorization: Bearer",
  "local" + "Storage",
  "session" + "Storage",
];
for (const marker of forbiddenAssetMarkers) {
  assert.equal(asset.text.includes(marker), false);
}

const clientConfig = await loadSteamOSBootstrapConfig({
  fetchImpl: async (input, init) => fetch(resolveShellUrl(input), init),
});
assert.equal(clientConfig.baseUrl.includes(clientConfig.token), false);
assert.equal(String(shellUrl).includes(clientConfig.token), false);
assert.equal(html.text.includes(clientConfig.token), false);
assert.equal(asset.text.includes(clientConfig.token), false);

const runtime = createSteamOSAppRuntime(clientConfig);
assert.equal(runtime.platform.info.platformId, "desktop");
assert.equal(runtime.providerRegistry.list().length, 2);

const steamConfig = await runtime.adapters.providerConfigStore?.load(STEAM_PROVIDER_ID);
assert.equal(steamConfig, undefined);

await runtime.adapters.diagnosticLogger?.record({
  event: "dashboard_refresh_completed",
  providerId: STEAM_PROVIDER_ID,
  mode: "manual",
  durationMs: 3,
});

console.log(
  JSON.stringify({
    ok: true,
    endpoints: [
      "root",
      "assets/steamos-bootstrap.js",
      "__achievement_companion__/runtime",
      "get_provider_configs",
      "record_diagnostic_event",
    ],
    runtimeComposed: true,
  }),
);
