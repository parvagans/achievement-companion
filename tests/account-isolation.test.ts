import assert from "node:assert/strict";
import test from "node:test";
import { createAccountScopedServices } from "../src/core/account-scoped-services";
import { createMemoryCacheStore } from "../src/platform/decky/memory-cache";
import { createDeckySettingsStore, readDeckySettings } from "../src/platform/decky/decky-settings";
import { ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY } from "../src/core/settings";

test("credential revision separates active requests and ignores late account cache writes", async () => {
  let revision = 0;
  let finishOld!: (value: string) => void;
  const oldResult = new Promise<string>((resolve) => { finishOld = resolve; });
  const cacheStore = createMemoryCacheStore();
  const options = {
    providerRegistry: { get: () => undefined }, platform: { info: { platformId: "test", appName: "Test" }, settingsStore: { read: async () => undefined, write: async () => {}, delete: async () => {} } },
    cacheStore, loadProviderConfig: async () => undefined,
    getProviderAccountRevision: () => revision,
  } as Parameters<typeof createAccountScopedServices>[0];
  const services = createAccountScopedServices(options, ({cacheStore: scoped}) => ({
    dashboard: { async loadDashboard() {
      const value = revision === 0 ? await oldResult : "B";
      await scoped.write({ key: "dashboard", value, storedAt: 1, expiresAt: 1000, version: 1 });
      return { status: "success" as const, data: value as never, isStale: false, isRefreshing: false };
    } },
    activityCalendar: {} as never, achievementHistory: {} as never, completionProgress: {} as never,
    gameDetail: {} as never, relatedGames: {} as never,
  }));
  const old = services.dashboard.loadDashboard("steam");
  revision++;
  const next = await services.dashboard.loadDashboard("steam");
  finishOld("A");
  const stale = await old;
  assert.equal(next.data, "B");
  assert.equal(stale.status, "error");
  assert.equal((await cacheStore.read<string>("account:steam:1:dashboard"))?.value, "B");
  assert.equal(await cacheStore.read<string>("account:steam:0:dashboard"), undefined);
});

test("preferred settings storage failure preserves the prior in-memory value", async () => {
  const previous = globalThis.localStorage;
  const text = JSON.stringify({ theme: "neon" });
  globalThis.localStorage = {
    getItem: () => text, setItem: () => { throw new Error("quota"); },
    removeItem: () => { throw new Error("blocked"); },
  } as unknown as Storage;
  try {
    const store = createDeckySettingsStore();
    const before = readDeckySettings();
    await assert.rejects(store.write(ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY, JSON.stringify({ theme: "dune" })));
    assert.deepEqual(readDeckySettings(), before);
    await assert.rejects(store.delete(ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY));
    assert.deepEqual(readDeckySettings(), before);
  } finally { globalThis.localStorage = previous; }
});
