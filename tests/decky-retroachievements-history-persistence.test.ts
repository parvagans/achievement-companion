import assert from "node:assert/strict";
import { test } from "node:test";
import type { CacheEntry } from "../src/core/cache";
import { CACHE_VERSION, createProviderAchievementHistoryCacheKey } from "../src/core/cache-keys";
import type { AchievementHistorySnapshot } from "../src/core/domain";
import { advanceDeckyAccountRevision } from "../src/platform/decky/decky-account-revision";
import {
  createDeckyRetroAchievementsHistoryCacheStore,
} from "../src/platform/decky/decky-retroachievements-history-cache";
import { createMemoryCacheStore } from "../src/platform/decky/memory-cache";

function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() { return entries.size; },
    clear() { entries.clear(); },
    getItem(key) { return entries.get(key) ?? null; },
    key(index) { return [...entries.keys()][index] ?? null; },
    removeItem(key) { entries.delete(key); },
    setItem(key, value) { entries.set(key, String(value)); },
  };
}

async function withStorage(run: () => Promise<void>): Promise<void> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: memoryStorage() });
  try { await run(); }
  finally {
    if (previous === undefined) delete (globalThis as { localStorage?: Storage }).localStorage;
    else Object.defineProperty(globalThis, "localStorage", previous);
  }
}

function historyEntry(key: string): CacheEntry<AchievementHistorySnapshot> {
  const now = Date.now();
  return {
    key,
    version: CACHE_VERSION,
    storedAt: now,
    expiresAt: now + 15 * 60 * 1000,
    value: {
      providerId: "retroachievements",
      profile: {
        providerId: "retroachievements",
        identity: { providerId: "retroachievements", accountId: "alice-ulid", displayName: "alice" },
        summary: { unlockedCount: 1, totalCount: 1 },
        metrics: [{ key: "member-since", label: "Member Since", value: "2020-01-02T00:00:00.000Z" }],
      },
      entries: [],
      summary: { unlockedCount: 0 },
      sourceLabel: "Member since Jan 2, 2020 -> now",
      refreshedAt: now,
      fullHistoryFetchedAt: now - 60_000,
    },
  };
}

test("complete RA history and its reconciliation checkpoint survive a new cache instance", async () => {
  await withStorage(async () => {
    let username = "alice";
    const key = `account:retroachievements:0:${createProviderAchievementHistoryCacheKey("retroachievements")}`;
    const first = createDeckyRetroAchievementsHistoryCacheStore(createMemoryCacheStore(), async () => username);
    await first.write(historyEntry(key));
    const reloaded = createDeckyRetroAchievementsHistoryCacheStore(createMemoryCacheStore(), async () => username);
    const restored = await reloaded.read<AchievementHistorySnapshot>(key);
    assert.equal(restored?.value.profile.identity.accountId, "alice-ulid");
    assert.ok(restored?.value.fullHistoryFetchedAt !== undefined);

    username = "bob";
    const otherAccount = createDeckyRetroAchievementsHistoryCacheStore(createMemoryCacheStore(), async () => username);
    assert.equal(await otherAccount.read(key), undefined);

    username = "alice";
    advanceDeckyAccountRevision("retroachievements");
    const afterRevision = createDeckyRetroAchievementsHistoryCacheStore(createMemoryCacheStore(), async () => username);
    assert.equal(await afterRevision.read(key), undefined);
  });
});
