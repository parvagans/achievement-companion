import assert from "node:assert/strict";
import test from "node:test";
import { setDeckyBackendCallImplementationForTests } from "../src/platform/decky/decky-backend-bridge";
import {
  markSteamAuthenticatedSuccess,
  markSteamCachedDashboardRestored,
  markSteamRefreshFailure,
  readSteamConnectionState,
  resetSteamConnectionStateForTests,
  validateAndSaveSteamConfiguration,
} from "../src/platform/decky/providers/steam/connection";

function storage(): Storage {
  const entries = new Map<string, string>();
  return { get length() { return entries.size; }, clear() { entries.clear(); }, getItem(key) { return entries.get(key) ?? null; }, key(index) { return [...entries.keys()][index] ?? null; }, removeItem(key) { entries.delete(key); }, setItem(key, value) { entries.set(key, value); } };
}

async function withStorage(callback: () => Promise<void>): Promise<void> {
  const globalObject = globalThis as typeof globalThis & { localStorage?: Storage; sessionStorage?: Storage };
  const oldLocal = globalObject.localStorage; const oldSession = globalObject.sessionStorage; const value = storage();
  globalObject.localStorage = value; globalObject.sessionStorage = value; resetSteamConnectionStateForTests();
  try { await callback(); } finally { setDeckyBackendCallImplementationForTests(undefined); resetSteamConnectionStateForTests(); if (oldLocal === undefined) delete globalObject.localStorage; else globalObject.localStorage = oldLocal; if (oldSession === undefined) delete globalObject.sessionStorage; else globalObject.sessionStorage = oldSession; }
}

const config = { steamId64: "12345678901234567", language: "english", recentAchievementsCount: 5 as const, recentlyPlayedCount: 5 as const, includePlayedFreeGames: false };

test("valid Steam configuration validates and saves as connected", async () => {
  await withStorage(async () => {
    setDeckyBackendCallImplementationForTests(async () => ({ ok: true })); let saves = 0;
    const result = await validateAndSaveSteamConfiguration({ config, apiKeyDraft: "new-key", save: async () => { saves += 1; return { ...config, hasApiKey: true }; } });
    assert.equal(result.saved, true); assert.equal(saves, 1); assert.equal(readSteamConnectionState().status, "connected");
  });
});

test("invalid key, account, privacy, and temporary Steam failures remain distinct", async () => {
  await withStorage(async () => {
    setDeckyBackendCallImplementationForTests(async () => ({ ok: false, failure: { statusCode: 401 } }));
    const invalidKey = await validateAndSaveSteamConfiguration({ config, apiKeyDraft: "bad", save: async () => { throw new Error("must not save"); } });
    assert.equal(invalidKey.connectionState.status, "authentication-required"); assert.match(invalidKey.userMessage, /Invalid Steam Web API key/);
    const invalidAccount = markSteamRefreshFailure({ category: "account" }, { isShowingCachedData: false });
    assert.equal(invalidAccount.status, "account-invalid");
    const privacy = markSteamRefreshFailure({ category: "privacy" }, { isShowingCachedData: true });
    assert.equal(privacy.status, "privacy-restricted");
    const temporary = markSteamRefreshFailure({ category: "network_error" }, { isShowingCachedData: true });
    assert.equal(temporary.status, "temporarily-unavailable");
  });
});

test("authentication failures preserve cached Steam freshness across storage reload", async () => {
  await withStorage(async () => {
    markSteamAuthenticatedSuccess(1_000); const failed = markSteamRefreshFailure({ statusCode: 401 }, { isShowingCachedData: true });
    assert.equal(failed.lastSuccessfulRefreshAt, 1_000); resetSteamConnectionStateForTests();
    assert.equal(readSteamConnectionState().status, "authentication-required"); assert.equal(readSteamConnectionState().lastSuccessfulRefreshAt, 1_000);
    assert.equal(markSteamCachedDashboardRestored(2_000).lastSuccessfulRefreshAt, 1_000);
  });
});

test("temporary and rate-limited failures never replace saved Steam configuration", async () => {
  await withStorage(async () => {
    let saves = 0; setDeckyBackendCallImplementationForTests(async () => ({ ok: false, failure: { statusCode: 429 } }));
    const result = await validateAndSaveSteamConfiguration({ config, apiKeyDraft: "replacement", save: async () => { saves += 1; return { ...config, hasApiKey: true }; } });
    assert.equal(result.saved, false); assert.equal(saves, 0); assert.equal(result.connectionState.status, "temporarily-unavailable");
  });
});
