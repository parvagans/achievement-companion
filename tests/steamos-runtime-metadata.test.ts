import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createSteamOSLocalBackendClient } from "../src/platform/steamos/local-backend-client";
import {
  createSteamOSLocalBackendClientConfig,
  isSafeLocalBackendHost,
  parseSteamOSBackendRuntimeMetadata,
} from "../src/platform/steamos/runtime-metadata";

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

test("SteamOS runtime metadata parses valid localhost handoff data into client config", () => {
  const metadata = parseSteamOSBackendRuntimeMetadata({
    host: "127.0.0.1",
    port: 43125,
    pid: 4321,
    token: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEF",
    startedAt: "2026-04-25T12:00:00+00:00",
  });

  assert.deepStrictEqual(metadata, {
    host: "127.0.0.1",
    port: 43125,
    pid: 4321,
    token: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEF",
    startedAt: "2026-04-25T12:00:00+00:00",
  });
  assert.deepStrictEqual(createSteamOSLocalBackendClientConfig(metadata!), {
    baseUrl: "http://127.0.0.1:43125",
    token: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEF",
  });
});

test("SteamOS runtime metadata rejects missing or weak tokens", () => {
  assert.equal(
    parseSteamOSBackendRuntimeMetadata({
      host: "127.0.0.1",
      port: 43125,
      pid: 4321,
      startedAt: "2026-04-25T12:00:00+00:00",
    }),
    null,
  );
  assert.equal(
    parseSteamOSBackendRuntimeMetadata({
      host: "127.0.0.1",
      port: 43125,
      pid: 4321,
      token: "",
      startedAt: "2026-04-25T12:00:00+00:00",
    }),
    null,
  );
  assert.equal(
    parseSteamOSBackendRuntimeMetadata({
      host: "127.0.0.1",
      port: 43125,
      pid: 4321,
      token: "too-short-token",
      startedAt: "2026-04-25T12:00:00+00:00",
    }),
    null,
  );
});

test("SteamOS runtime metadata rejects invalid ports and pid values", () => {
  const baseMetadata = {
    host: "127.0.0.1",
    pid: 4321,
    token: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEF",
    startedAt: "2026-04-25T12:00:00+00:00",
  };

  assert.equal(parseSteamOSBackendRuntimeMetadata({ ...baseMetadata, port: 0 }), null);
  assert.equal(parseSteamOSBackendRuntimeMetadata({ ...baseMetadata, port: 65536 }), null);
  assert.equal(parseSteamOSBackendRuntimeMetadata({ ...baseMetadata, port: 3.14 }), null);
  assert.equal(parseSteamOSBackendRuntimeMetadata({ ...baseMetadata, port: "43125" }), null);
  assert.equal(parseSteamOSBackendRuntimeMetadata({ ...baseMetadata, port: 43125, pid: 0 }), null);
});

test("SteamOS runtime metadata rejects unsafe hosts", () => {
  const unsafeHosts = [
    "0.0.0.0",
    "localhost",
    "192.168.1.5",
    "http://127.0.0.1",
    "127.0.0.1/path",
    "::1",
  ];

  for (const host of unsafeHosts) {
    assert.equal(
      parseSteamOSBackendRuntimeMetadata({
        host,
        port: 43125,
        pid: 4321,
        token: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEF",
        startedAt: "2026-04-25T12:00:00+00:00",
      }),
      null,
    );
    assert.equal(isSafeLocalBackendHost(host), false);
  }

  assert.equal(isSafeLocalBackendHost("127.0.0.1"), true);
});

test("SteamOS runtime metadata validates startedAt and keeps tokens out of baseUrl", async () => {
  const metadata = parseSteamOSBackendRuntimeMetadata({
    host: "127.0.0.1",
    port: 43125,
    pid: 4321,
    token: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEF",
    startedAt: "2026-04-25T12:00:00+00:00",
  });
  assert.ok(metadata);
  assert.equal(
    parseSteamOSBackendRuntimeMetadata({
      host: "127.0.0.1",
      port: 43125,
      pid: 4321,
      token: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEF",
      startedAt: "not-a-timestamp",
    }),
    null,
  );

  const clientConfig = createSteamOSLocalBackendClientConfig(metadata);
  assert.equal(clientConfig.baseUrl, "http://127.0.0.1:43125");
  assert.doesNotMatch(clientConfig.baseUrl, /abcdefghijklmnopqrstuvwxyz0123456789ABCDEF/u);

  const calls: Array<{ readonly url: string; readonly headers: Record<string, string> }> = [];
  const client = createSteamOSLocalBackendClient({
    ...clientConfig,
    fetchImpl: async (input, init) => {
      calls.push({
        url: String(input),
        headers: (init?.headers as Record<string, string>) ?? {},
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  await client.postJson("health-proxy", {});
  assert.equal(calls[0]?.url, "http://127.0.0.1:43125/health-proxy");
  assert.equal(calls[0]?.headers.Authorization, "Bearer abcdefghijklmnopqrstuvwxyz0123456789ABCDEF");
  assert.doesNotMatch(calls[0]?.url ?? "", /abcdefghijklmnopqrstuvwxyz0123456789ABCDEF/u);
});

test("SteamOS runtime metadata helpers stay free of Decky imports, browser storage, and old repo paths", () => {
  const steamosSource = readSourceTree("src/platform/steamos");

  assert.doesNotMatch(steamosSource, /platform\/decky/u);
  assert.doesNotMatch(steamosSource, /\bfrom\s+["']@decky\/[^"']+["']/u);
  assert.doesNotMatch(steamosSource, /localStorage/u);
  assert.doesNotMatch(steamosSource, /sessionStorage/u);
  assert.doesNotMatch(steamosSource, /OneDrive/u);
});
