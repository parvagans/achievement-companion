import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS } from "../src/core/settings";
import { loadDeckyDashboardState, resetDeckyAppServicesForTests } from "../src/platform/decky/decky-app-services";
import { setDeckyBackendCallImplementationForTests } from "../src/platform/decky/decky-backend-bridge";
import {
  subscribeDeckyRaNativeAchievementInvalidation,
  type DeckyRaNativeAchievementInvalidationReason,
} from "../src/platform/decky/decky-ra-native-achievement-invalidation";
import { createDeckySettingsStore, saveDeckySettings } from "../src/platform/decky/decky-settings";
import { clearDeckyRuntimeMode, writeDeckyRuntimeMode } from "../src/platform/decky/runtime-mode";
import {
  clearDeckyRetroAchievementsAccountState,
  deckyProviderConfigStore,
  saveDeckyRetroAchievementsCredentials,
  updateDeckyProviderConfigCache,
} from "../src/platform/decky/providers/provider-config-store";

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

async function withStorage(run: () => Promise<void>): Promise<void> {
  const globals = globalThis as typeof globalThis & { localStorage?: Storage; sessionStorage?: Storage };
  const previousLocalStorage = globals.localStorage;
  const previousSessionStorage = globals.sessionStorage;
  globals.localStorage = createStorage();
  globals.sessionStorage = globals.localStorage;
  await createDeckySettingsStore().delete("achievement-companion:settings");
  try {
    await run();
  } finally {
    setDeckyBackendCallImplementationForTests(undefined);
    clearDeckyRuntimeMode();
    resetDeckyAppServicesForTests();
    await createDeckySettingsStore().delete("achievement-companion:settings");
    if (previousLocalStorage === undefined) delete globals.localStorage;
    else globals.localStorage = previousLocalStorage;
    if (previousSessionStorage === undefined) delete globals.sessionStorage;
    else globals.sessionStorage = previousSessionStorage;
  }
}

test("RA mode changes invalidate once, while unrelated settings and unsubscribed writes do not", async () => {
  await withStorage(async () => {
    const reasons: DeckyRaNativeAchievementInvalidationReason[] = [];
    const unsubscribe = subscribeDeckyRaNativeAchievementInvalidation((event) => reasons.push(event.reason));
    try {
      await saveDeckySettings({ ...DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS, recentAchievementsCount: 7 });
      assert.deepEqual(reasons, []);

      await saveDeckySettings({ ...DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS, retroAchievementsAchievementMode: "hardcore" });
      await saveDeckySettings({ ...DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS, retroAchievementsAchievementMode: "hardcore" });
      assert.deepEqual(reasons, ["achievement-mode-changed"]);

      await createDeckySettingsStore().delete("achievement-companion:settings");
      assert.deepEqual(reasons, ["achievement-mode-changed", "achievement-mode-changed"]);
    } finally {
      unsubscribe();
    }

    await saveDeckySettings({ ...DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS, retroAchievementsAchievementMode: "softcore" });
    assert.equal(reasons.length, 2);
  });
});

test("RA account replacement and sign out invalidate; count edits and Steam config do not", async () => {
  await withStorage(async () => {
    updateDeckyProviderConfigCache("retroachievements", { username: "alice", hasApiKey: true });
    const reasons: DeckyRaNativeAchievementInvalidationReason[] = [];
    const unsubscribe = subscribeDeckyRaNativeAchievementInvalidation((event) => reasons.push(event.reason));
    setDeckyBackendCallImplementationForTests(async (route) => {
      if (route === "save_retroachievements_credentials") {
        return { username: "alice", hasApiKey: true };
      }
      if (route === "clear_provider_credentials") {
        return true;
      }
      if (route === "save_steam_credentials") {
        return { steamId64: "123", hasApiKey: true, language: "en", recentAchievementsCount: 5, recentlyPlayedCount: 5, includePlayedFreeGames: false };
      }
      throw new Error(`Unexpected backend route: ${route}`);
    });
    try {
      await saveDeckyRetroAchievementsCredentials({ username: "alice", apiKeyDraft: "", recentAchievementsCount: 7 });
      assert.deepEqual(reasons, []);

      await saveDeckyRetroAchievementsCredentials({ username: "alice", apiKeyDraft: "replacement-key" });
      assert.deepEqual(reasons, ["account-changed"]);

      await deckyProviderConfigStore.save("steam", { steamId64: "123", hasApiKey: true, language: "en", recentAchievementsCount: 5, recentlyPlayedCount: 5, includePlayedFreeGames: false });
      assert.equal(reasons.length, 1);

      assert.equal(await clearDeckyRetroAchievementsAccountState(), true);
      assert.deepEqual(reasons, ["account-changed", "account-changed"]);
    } finally {
      unsubscribe();
    }
  });
});

test("completed RA dashboard load invalidates the native projection", async () => {
  await withStorage(async () => {
    assert.equal(writeDeckyRuntimeMode("fresh"), true);
    const reasons: DeckyRaNativeAchievementInvalidationReason[] = [];
    const unsubscribe = subscribeDeckyRaNativeAchievementInvalidation((event) => reasons.push(event.reason));
    try {
      const state = await loadDeckyDashboardState("retroachievements", {
        skipRecentAchievementHistoryBackfill: true,
      });
      assert.equal(state.status, "success");
      assert.deepEqual(reasons, ["provider-refreshed"]);
    } finally {
      unsubscribe();
    }
  });
});
