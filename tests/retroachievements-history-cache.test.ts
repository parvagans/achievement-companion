import assert from "node:assert/strict";
import { test } from "node:test";
import { createAppServices } from "../src/core/app-services";
import type { CacheEntry, CacheStore } from "../src/core/cache";
import { createProviderAchievementHistoryCacheKey } from "../src/core/cache-keys";
import type { NormalizedProfile, RecentUnlock } from "../src/core/domain";
import { createProviderRegistry } from "../src/core/provider-registry";
import type { AchievementProvider } from "../src/core/ports";

const MEMBER_SINCE = "2020-01-02T00:00:00.000Z";
const MEMBER_SINCE_EPOCH_SECONDS = Date.parse(MEMBER_SINCE) / 1000;

function profile(providerId: string, accountId = "alice"): NormalizedProfile {
  return {
    providerId,
    identity: { providerId, accountId, displayName: accountId },
    summary: { unlockedCount: 0, totalCount: 0 },
    metrics: [{ key: "member-since", label: "Member Since", value: MEMBER_SINCE }],
  };
}

function unlock(
  providerId: string,
  achievementId: string,
  unlockedAt: number,
  unlockMode: "hardcore" | "softcore" = "hardcore",
  title = achievementId,
): RecentUnlock {
  return {
    achievement: {
      providerId,
      gameId: "game-1",
      achievementId,
      title,
      isUnlocked: true,
      unlockedAt,
      unlockMode,
      metrics: [],
    },
    game: { providerId, gameId: "game-1", title: "Game One" },
    unlockedAt,
  };
}

function harness(
  providerId: string,
  loadProfile: () => Promise<NormalizedProfile>,
  loadHistory: NonNullable<AchievementProvider["loadAchievementsEarnedBetween"]>,
) {
  const entries = new Map<string, CacheEntry<unknown>>();
  let writes = 0;
  const cacheStore: CacheStore = {
    async read<T>(key: string) { return entries.get(key) as CacheEntry<T> | undefined; },
    async write<T>(entry: CacheEntry<T>) { writes += 1; entries.set(entry.key, entry); },
    async delete(key: string) { entries.delete(key); },
    async clear(prefix?: string) {
      for (const key of entries.keys()) {
        if (prefix === undefined || key.startsWith(prefix)) entries.delete(key);
      }
    },
  };
  const provider: AchievementProvider = {
    id: providerId,
    capabilities: {
      requiresCredentials: true,
      profileSummary: true,
      completionProgress: true,
      recentUnlocks: true,
      gameProgress: true,
      rarityStats: true,
      search: false,
    },
    loadProfile: async () => loadProfile(),
    loadAchievementsEarnedBetween: loadHistory,
    loadRecentUnlocks: async () => [],
    loadRecentlyPlayedGames: async () => [],
    loadGameProgress: async () => { throw new Error("unused in history test"); },
  };
  const services = createAppServices({
    providerRegistry: createProviderRegistry([provider]),
    platform: { info: { platformId: "decky", appName: "Achievement Companion" } },
    cacheStore,
    loadProviderConfig: async () => ({ username: "alice" }),
  });
  return { services, entries, getWrites: () => writes };
}

test("RetroAchievements history refreshes only the new interval and deduplicates overlap events", async () => {
  const providerId = "retroachievements";
  const requestRanges: { fromEpochSeconds: number; toEpochSeconds: number }[] = [];
  const older = unlock(providerId, "older", Date.parse(MEMBER_SINCE) + 1_000);
  const boundaryAt = Date.now() - 30_000;
  const boundary = unlock(providerId, "shared", boundaryAt, "softcore");
  const hardcore = unlock(providerId, "shared", boundaryAt + 5_000, "hardcore");
  const { services } = harness(providerId, async () => profile(providerId), async (_config, range) => {
    requestRanges.push(range);
    return requestRanges.length === 1
      ? [older, boundary]
      : [unlock(providerId, "shared", boundaryAt, "softcore", "Updated title"), hardcore];
  });

  const first = await services.achievementHistory.loadAchievementHistory(providerId, { forceRefresh: true });
  const second = await services.achievementHistory.loadAchievementHistory(providerId, { forceRefresh: true });

  assert.equal(first.status, "success");
  assert.equal(second.status, "success");
  assert.equal(requestRanges.length, 2);
  assert.equal(requestRanges[0]?.fromEpochSeconds, MEMBER_SINCE_EPOCH_SECONDS);
  assert.ok(requestRanges[1]!.fromEpochSeconds >= requestRanges[0]!.toEpochSeconds - 300);
  assert.ok(requestRanges[1]!.fromEpochSeconds <= requestRanges[0]!.toEpochSeconds);
  assert.ok(requestRanges[1]!.fromEpochSeconds > MEMBER_SINCE_EPOCH_SECONDS);
  assert.equal(second.data?.entries.length, 3);
  assert.equal(second.data?.summary.unlockedCount, 3);
  assert.deepEqual(second.data?.entries.map((entry) => entry.achievement.unlockMode), ["hardcore", "softcore", "hardcore"]);
  assert.equal(second.data?.entries[1]?.achievement.title, "Updated title");
});

test("failed RetroAchievements incremental refresh keeps the complete cached history and its checkpoint", async () => {
  const providerId = "retroachievements";
  const requests: { fromEpochSeconds: number; toEpochSeconds: number }[] = [];
  let shouldFail = false;
  const { services, getWrites } = harness(providerId, async () => profile(providerId), async (_config, range) => {
    requests.push(range);
    if (shouldFail) throw new Error("temporary failure");
    return [unlock(providerId, "older", Date.parse(MEMBER_SINCE) + 1_000)];
  });

  const initial = await services.achievementHistory.loadAchievementHistory(providerId, { forceRefresh: true });
  shouldFail = true;
  const failed = await services.achievementHistory.loadAchievementHistory(providerId, { forceRefresh: true });
  shouldFail = false;
  const recovered = await services.achievementHistory.loadAchievementHistory(providerId, { forceRefresh: true });

  assert.equal(failed.data, initial.data);
  assert.ok(failed.error !== undefined);
  assert.equal(getWrites(), 2);
  assert.equal(recovered.status, "success");
  assert.equal(recovered.data?.summary.unlockedCount, 1);
  assert.equal(requests[1]?.fromEpochSeconds, requests[2]?.fromEpochSeconds);
});

test("RetroAchievements does a full history load when the cached account identity changes", async () => {
  const providerId = "retroachievements";
  let accountId = "alice";
  const fromValues: number[] = [];
  const { services } = harness(providerId, async () => profile(providerId, accountId), async (_config, range) => {
    fromValues.push(range.fromEpochSeconds);
    return [];
  });

  await services.achievementHistory.loadAchievementHistory(providerId, { forceRefresh: true });
  accountId = "bob";
  await services.achievementHistory.loadAchievementHistory(providerId, { forceRefresh: true });

  assert.deepEqual(fromValues, [MEMBER_SINCE_EPOCH_SECONDS, MEMBER_SINCE_EPOCH_SECONDS]);
});

test("RetroAchievements reconciles the full history after seven days and removes reset awards", async () => {
  const providerId = "retroachievements";
  const older = unlock(providerId, "reset-later", Date.parse(MEMBER_SINCE) + 1_000);
  const retained = unlock(providerId, "retained", Date.parse(MEMBER_SINCE) + 2_000);
  const requestRanges: number[] = [];
  const { services, entries } = harness(providerId, async () => profile(providerId), async (_config, range) => {
    requestRanges.push(range.fromEpochSeconds);
    return requestRanges.length === 1 ? [older, retained] : [retained];
  });

  const first = await services.achievementHistory.loadAchievementHistory(providerId, { forceRefresh: true });
  assert.equal(first.data?.entries.length, 2);
  const key = createProviderAchievementHistoryCacheKey(providerId);
  const cached = entries.get(key) as CacheEntry<import("../src/core/domain").AchievementHistorySnapshot>;
  entries.set(key, {
    ...cached,
    value: { ...cached.value, fullHistoryFetchedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 },
  });

  const reconciled = await services.achievementHistory.loadAchievementHistory(providerId, { forceRefresh: true });
  assert.deepEqual(requestRanges, [MEMBER_SINCE_EPOCH_SECONDS, MEMBER_SINCE_EPOCH_SECONDS]);
  assert.deepEqual(reconciled.data?.entries.map((entry) => entry.achievement.achievementId), ["retained"]);
  assert.ok((reconciled.data?.fullHistoryFetchedAt ?? 0) > Date.now() - 60_000);
});

test("other providers retain the existing full history refresh behavior", async () => {
  const providerId = "steam";
  const fromValues: number[] = [];
  const { services } = harness(providerId, async () => profile(providerId), async (_config, range) => {
    fromValues.push(range.fromEpochSeconds);
    return [];
  });

  await services.achievementHistory.loadAchievementHistory(providerId, { forceRefresh: true });
  await services.achievementHistory.loadAchievementHistory(providerId, { forceRefresh: true });

  assert.deepEqual(fromValues, [MEMBER_SINCE_EPOCH_SECONDS, MEMBER_SINCE_EPOCH_SECONDS]);
});
