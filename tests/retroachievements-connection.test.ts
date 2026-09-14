import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRetroAchievementsConnectionFailure,
  getRetroAchievementsConnectionBanner,
  markRetroAchievementsAuthenticatedSuccess,
  markRetroAchievementsCachedDashboardRestored,
  markRetroAchievementsRefreshFailure,
  readRetroAchievementsConnectionState,
  resetRetroAchievementsConnectionStateForTests,
  validateAndSaveRetroAchievementsCredentials,
} from "../src/platform/decky/providers/retroachievements/connection";
import { setDeckyBackendCallImplementationForTests } from "../src/platform/decky/decky-backend-bridge";

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key) { return values.get(key) ?? null; },
    key(index) { return [...values.keys()][index] ?? null; },
    removeItem(key) { values.delete(key); },
    setItem(key, value) { values.set(key, value); },
  };
}

async function withStorage(callback: () => Promise<void>): Promise<void> {
  const globalObject = globalThis as typeof globalThis & { localStorage?: Storage; sessionStorage?: Storage };
  const previousLocalStorage = globalObject.localStorage;
  const previousSessionStorage = globalObject.sessionStorage;
  const storage = createStorage();
  globalObject.localStorage = storage;
  globalObject.sessionStorage = storage;
  resetRetroAchievementsConnectionStateForTests();
  try {
    await callback();
  } finally {
    setDeckyBackendCallImplementationForTests(undefined);
    resetRetroAchievementsConnectionStateForTests();
    if (previousLocalStorage === undefined) delete globalObject.localStorage;
    else globalObject.localStorage = previousLocalStorage;
    if (previousSessionStorage === undefined) delete globalObject.sessionStorage;
    else globalObject.sessionStorage = previousSessionStorage;
  }
}

test("validated initial credentials save only after authentication succeeds", async () => {
  await withStorage(async () => {
    let saveCalls = 0;
    setDeckyBackendCallImplementationForTests(async (route) => {
      assert.equal(route, "validate_retroachievements_credentials");
      return { ok: true };
    });
    const result = await validateAndSaveRetroAchievementsCredentials({
      username: " alice ",
      apiKeyDraft: " replacement-key ",
      save: async (config) => {
        saveCalls += 1;
        assert.equal(config.username, "alice");
        assert.equal(config.apiKeyDraft, "replacement-key");
        return { username: "alice", hasApiKey: true };
      },
    });
    assert.equal(result.saved, true);
    assert.equal(saveCalls, 1);
    assert.equal(readRetroAchievementsConnectionState().status, "connected");
  });
});

test("invalid initial credentials are not saved and return the credential-specific message", async () => {
  await withStorage(async () => {
    let saveCalls = 0;
    setDeckyBackendCallImplementationForTests(async () => ({ ok: false, failure: { statusCode: 401 } }));
    const result = await validateAndSaveRetroAchievementsCredentials({
      username: "alice",
      apiKeyDraft: "invalid-key",
      save: async () => { saveCalls += 1; return { username: "alice", hasApiKey: true }; },
    });
    assert.equal(result.saved, false);
    assert.equal(saveCalls, 0);
    assert.equal(result.userMessage, "Invalid RetroAchievements username or API key. Please check your credentials and try again.");
    assert.equal(result.connectionState.status, "authentication-required");
  });
});

test("definitive invalid usernames, but not temporary validation failures, are credential failures", async () => {
  await withStorage(async () => {
    assert.equal(classifyRetroAchievementsConnectionFailure({ statusCode: 404 }), "authentication");
    setDeckyBackendCallImplementationForTests(async () => ({ ok: false, failure: { category: "network_error" } }));
    const result = await validateAndSaveRetroAchievementsCredentials({
      username: "alice",
      apiKeyDraft: "new-key",
      save: async () => { throw new Error("must not save"); },
    });
    assert.equal(result.saved, false);
    assert.equal(result.userMessage, "Unable to contact RetroAchievements. Please try again.");
    assert.equal(result.connectionState.status, "temporarily-unavailable");
  });
});

test("authentication failure preserves the last successful refresh and survives storage reload", async () => {
  await withStorage(async () => {
    markRetroAchievementsAuthenticatedSuccess(1_000);
    const failed = markRetroAchievementsRefreshFailure({ statusCode: 401 }, { isShowingCachedData: true });
    assert.equal(failed.status, "authentication-required");
    assert.equal(failed.lastSuccessfulRefreshAt, 1_000);
    assert.match(getRetroAchievementsConnectionBanner(failed) ?? "", /Showing cached data/);
    resetRetroAchievementsConnectionStateForTests();
    const restored = readRetroAchievementsConnectionState();
    assert.equal(restored.status, "authentication-required");
    assert.equal(restored.lastSuccessfulRefreshAt, 1_000);
    const cached = markRetroAchievementsCachedDashboardRestored(2_000);
    assert.equal(cached.status, "authentication-required");
    assert.equal(cached.lastSuccessfulRefreshAt, 1_000);
  });
});

test("network and server failures remain temporary and never advance the successful refresh timestamp", async () => {
  await withStorage(async () => {
    markRetroAchievementsAuthenticatedSuccess(1_000);
    const networkFailure = markRetroAchievementsRefreshFailure({ category: "network_error" }, { isShowingCachedData: true });
    assert.equal(networkFailure.status, "temporarily-unavailable");
    assert.equal(networkFailure.lastSuccessfulRefreshAt, 1_000);
    const serverFailure = markRetroAchievementsRefreshFailure({ statusCode: 503 }, { isShowingCachedData: true });
    assert.equal(serverFailure.status, "temporarily-unavailable");
    assert.equal(serverFailure.lastSuccessfulRefreshAt, 1_000);
  });
});

test("successful replacement credentials recover an authentication-required connection without persisting the API key", async () => {
  await withStorage(async () => {
    markRetroAchievementsAuthenticatedSuccess(1_000);
    markRetroAchievementsRefreshFailure({ statusCode: 401 }, { isShowingCachedData: true });
    setDeckyBackendCallImplementationForTests(async () => ({ ok: true }));
    const result = await validateAndSaveRetroAchievementsCredentials({
      username: "alice",
      apiKeyDraft: "replacement-key",
      save: async () => ({ username: "alice", hasApiKey: true }),
    });
    assert.equal(result.saved, true);
    assert.equal(readRetroAchievementsConnectionState().status, "connected");
    assert.doesNotMatch(JSON.stringify(readRetroAchievementsConnectionState()), /replacement-key/);
  });
});
