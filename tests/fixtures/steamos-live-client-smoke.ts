import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSteamOSLocalBackendClient } from "../../src/platform/steamos/local-backend-client";
import {
  createSteamOSLocalBackendClientConfig,
  parseSteamOSBackendRuntimeMetadata,
} from "../../src/platform/steamos/runtime-metadata";

const metadataPath = process.argv[2];
if (metadataPath === undefined) {
  throw new Error("Usage: steamos-live-client-smoke.ts <runtime-metadata-path>");
}

const metadata = parseSteamOSBackendRuntimeMetadata(
  JSON.parse(readFileSync(metadataPath, "utf-8")) as unknown,
);
assert.ok(metadata, "Expected valid SteamOS runtime metadata.");

const clientConfig = createSteamOSLocalBackendClientConfig(metadata);
assert.equal(clientConfig.baseUrl.includes(clientConfig.token), false);

const healthUrl = new URL("health", clientConfig.baseUrl.endsWith("/") ? clientConfig.baseUrl : `${clientConfig.baseUrl}/`);
assert.equal(String(healthUrl).includes(clientConfig.token), false);

const healthResponse = await fetch(healthUrl, {
  method: "GET",
  cache: "no-store",
});
assert.equal(healthResponse.status, 200);

const healthPayload = await healthResponse.json() as {
  readonly ok?: boolean;
  readonly service?: string;
  readonly capabilities?: readonly string[];
};
assert.equal(healthPayload.ok, true);
assert.equal(healthPayload.service, "achievement-companion");
assert.equal(healthPayload.capabilities?.includes("health"), true);
assert.equal(JSON.stringify(healthPayload).includes(clientConfig.token), false);

const client = createSteamOSLocalBackendClient(clientConfig);
const providerConfigs = await client.postJson<{ readonly version?: number }>("get_provider_configs", {});
assert.deepStrictEqual(providerConfigs, { version: 1 });

const diagnosticResponse = await client.postJson<{ readonly ok?: boolean; readonly recorded?: boolean }>(
  "record_diagnostic_event",
  {
    event: "dashboard_refresh_completed",
    providerId: "steam",
    mode: "manual",
    durationMs: 4,
  },
);
assert.deepStrictEqual(diagnosticResponse, { ok: true, recorded: true });

console.log(
  JSON.stringify({
    ok: true,
    baseUrl: clientConfig.baseUrl,
    endpoints: ["health", "get_provider_configs", "record_diagnostic_event"],
  }),
);
