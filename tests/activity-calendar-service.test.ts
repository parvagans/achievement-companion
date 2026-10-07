import assert from "node:assert/strict";
import test from "node:test";
import type { CacheEntry, CacheStore } from "../src/core/cache";
import { createAppServices } from "../src/core/app-services";
import type { NormalizedProfile, RecentUnlock } from "../src/core/domain";
import type { AchievementProvider } from "../src/core/ports";
import { createProviderRegistry } from "../src/core/provider-registry";

function createHarness(rangeLoader: AchievementProvider["loadAchievementsEarnedBetween"]) {
  const entries = new Map<string, CacheEntry<unknown>>();
  const cacheStore: CacheStore = {
    async read<T>(key: string) { return entries.get(key) as CacheEntry<T> | undefined; },
    async write<T>(entry: CacheEntry<T>) { entries.set(entry.key, entry as CacheEntry<unknown>); },
    async delete(key) { entries.delete(key); },
    async clear(prefix) { for (const key of entries.keys()) if (prefix === undefined || key.startsWith(prefix)) entries.delete(key); },
  };
  let rangeCalls = 0;
  const profile: NormalizedProfile = {
    providerId: "retroachievements",
    identity: { providerId: "retroachievements", accountId: "user", displayName: "Player" },
    summary: { unlockedCount: 0 }, metrics: [],
  };
  const provider: AchievementProvider = {
    id: "retroachievements",
    capabilities: { requiresCredentials: false, profileSummary: true, completionProgress: false, recentUnlocks: true, gameProgress: true, rarityStats: false, search: false },
    async loadProfile() { return profile; },
    async loadRecentUnlocks() { return []; },
    async loadRecentlyPlayedGames() { return []; },
    async loadGameProgress() { throw new Error("unused"); },
    async loadAchievementsEarnedBetween(config, range) {
      rangeCalls += 1;
      return rangeLoader!(config, range);
    },
  };
  const services = createAppServices({
    providerRegistry: createProviderRegistry([provider]),
    cacheStore,
    platform: { info: { platformId: "decky", appName: "Achievement Companion" } },
    async loadProviderConfig() { return {}; },
  });
  return { services, getRangeCalls: () => rangeCalls };
}

test("dashboard profile resolves without waiting for its optional calendar range", async () => {
  const { services, getRangeCalls } = createHarness(async () => new Promise<readonly RecentUnlock[]>(() => {}));
  const result = await Promise.race([
    services.dashboard.loadDashboard("retroachievements"),
    new Promise<"timed-out">((resolve) => setTimeout(() => resolve("timed-out"), 250)),
  ]);

  assert.notEqual(result, "timed-out");
  assert.equal(result.status, "success");
  assert.equal(getRangeCalls(), 0);
});

test("activity calendar uses its own real 64-day range and cacheable service", async () => {
  let requestedRange: { readonly fromEpochSeconds: number; readonly toEpochSeconds: number } | undefined;
  const unlocks: readonly RecentUnlock[] = [];
  const { services, getRangeCalls } = createHarness(async (_config, range) => {
    requestedRange = range;
    return unlocks;
  });
  const before = Math.trunc(Date.now() / 1000);
  const result = await services.activityCalendar.loadActivityCalendarUnlocks("retroachievements");
  const after = Math.trunc(Date.now() / 1000);

  assert.equal(result.status, "success");
  assert.equal(result.data, unlocks);
  assert.equal(getRangeCalls(), 1);
  assert.ok(requestedRange !== undefined);
  assert.ok(requestedRange.fromEpochSeconds >= before - 64 * 24 * 60 * 60 - 1);
  assert.ok(requestedRange.fromEpochSeconds <= after - 64 * 24 * 60 * 60);
  assert.ok(requestedRange.toEpochSeconds >= before && requestedRange.toEpochSeconds <= after);
});
