import assert from "node:assert/strict";
import { test } from "node:test";
import type { GameDetailSnapshot } from "../src/core/domain";
import { advanceDeckyAccountRevision } from "../src/platform/decky/decky-account-revision";
import {
  invalidateDeckyRetroAchievementsMasteredGameDetail,
  readDeckyRetroAchievementsMasteredGameDetail,
  writeDeckyRetroAchievementsMasteredGameDetail,
} from "../src/platform/decky/decky-retroachievements-mastered-detail-cache";

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

function masteredDetail(gameId: string): GameDetailSnapshot {
  return {
    game: {
      providerId: "retroachievements",
      gameId,
      title: "Mastered Game",
      status: "mastered",
      summary: { unlockedCount: 1, totalCount: 1 },
      metrics: [{ key: "highest-award-kind", label: "Highest Award", value: "mastered-hardcore" }],
    },
    achievements: [{
      providerId: "retroachievements",
      gameId,
      achievementId: "1",
      title: "Achievement",
      isUnlocked: true,
      metrics: [],
    }],
  };
}

async function withStorage(run: () => Promise<void> | void): Promise<void> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: memoryStorage() });
  try {
    await run();
  } finally {
    invalidateDeckyRetroAchievementsMasteredGameDetail();
    if (previous === undefined) delete (globalThis as { localStorage?: Storage }).localStorage;
    else Object.defineProperty(globalThis, "localStorage", previous);
  }
}

test("verified mastery is reused for 24 hours and stays scoped to the account", async () => {
  await withStorage(() => {
    const snapshot = masteredDetail("100");
    const storedAt = 1_000_000;
    assert.equal(writeDeckyRetroAchievementsMasteredGameDetail("Alice", snapshot, storedAt), true);
    assert.deepEqual(readDeckyRetroAchievementsMasteredGameDetail("alice", "100", storedAt + 23 * 60 * 60 * 1000)?.data, snapshot);
    assert.equal(readDeckyRetroAchievementsMasteredGameDetail("bob", "100", storedAt + 1), undefined);
    assert.equal(readDeckyRetroAchievementsMasteredGameDetail("alice", "100", storedAt + 24 * 60 * 60 * 1000), undefined);
  });
});

test("incomplete or unverified detail is never persisted; game and account invalidation clear mastery", async () => {
  await withStorage(() => {
    const incomplete = { ...masteredDetail("200"), game: { ...masteredDetail("200").game, status: "beaten" as const } };
    assert.equal(writeDeckyRetroAchievementsMasteredGameDetail("alice", incomplete), false);
    assert.equal(readDeckyRetroAchievementsMasteredGameDetail("alice", "200"), undefined);

    assert.equal(writeDeckyRetroAchievementsMasteredGameDetail("alice", masteredDetail("200")), true);
    invalidateDeckyRetroAchievementsMasteredGameDetail("200");
    assert.equal(readDeckyRetroAchievementsMasteredGameDetail("alice", "200"), undefined);

    assert.equal(writeDeckyRetroAchievementsMasteredGameDetail("alice", masteredDetail("200")), true);
    advanceDeckyAccountRevision("retroachievements");
    assert.equal(readDeckyRetroAchievementsMasteredGameDetail("alice", "200"), undefined);
  });
});
