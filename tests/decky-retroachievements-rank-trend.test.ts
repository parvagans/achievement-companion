import assert from "node:assert/strict";
import test from "node:test";
import type { NormalizedProfile } from "../src/core/domain";
import {
  getDeckyRetroAchievementsRankTrend,
  updateDeckyRetroAchievementsRankTrends,
} from "../src/platform/decky/decky-retroachievements-rank-trend";

function createProfile(siteRank?: number, casualRank?: number): NormalizedProfile {
  return {
    providerId: "retroachievements",
    identity: { providerId: "retroachievements", accountId: "rank-test-user", displayName: "Rank Test User" },
    summary: { unlockedCount: 0, totalCount: 0, completionPercent: 0 },
    metrics: [
      ...(siteRank === undefined ? [] : [{ key: "site-rank", label: "Site Rank", value: String(siteRank) }]),
      ...(casualRank === undefined ? [] : [{ key: "casual-rank", label: "Casual Rank", value: String(casualRank) }]),
    ],
  };
}

test("RA rank arrows persist across unchanged or incomplete dashboard refreshes", () => {
  const entries = new Map<string, string>();
  const storage: Storage = {
    get length() { return entries.size; },
    clear() { entries.clear(); },
    getItem(key) { return entries.get(key) ?? null; },
    key(index) { return [...entries.keys()][index] ?? null; },
    removeItem(key) { entries.delete(key); },
    setItem(key, value) { entries.set(key, value); },
  };
  const globalObject = globalThis as typeof globalThis & { localStorage?: Storage; sessionStorage?: Storage };
  const previousLocalStorage = globalObject.localStorage;
  const previousSessionStorage = globalObject.sessionStorage;
  globalObject.localStorage = storage;
  globalObject.sessionStorage = storage;
  try {
    updateDeckyRetroAchievementsRankTrends(createProfile(100, 200));
    assert.equal(getDeckyRetroAchievementsRankTrend("rank-test-user", "site"), undefined);

    updateDeckyRetroAchievementsRankTrends(createProfile(110, 190));
    assert.equal(getDeckyRetroAchievementsRankTrend("rank-test-user", "site"), "down");
    assert.equal(getDeckyRetroAchievementsRankTrend("rank-test-user", "casual"), "up");

    updateDeckyRetroAchievementsRankTrends(createProfile(110, 190));
    updateDeckyRetroAchievementsRankTrends(createProfile());
    assert.equal(getDeckyRetroAchievementsRankTrend("rank-test-user", "site"), "down");
    assert.equal(getDeckyRetroAchievementsRankTrend("rank-test-user", "casual"), "up");

    updateDeckyRetroAchievementsRankTrends(createProfile(90, 220));
    assert.equal(getDeckyRetroAchievementsRankTrend("rank-test-user", "site"), "up");
    assert.equal(getDeckyRetroAchievementsRankTrend("rank-test-user", "casual"), "down");
  } finally {
    if (previousLocalStorage === undefined) delete globalObject.localStorage;
    else globalObject.localStorage = previousLocalStorage;
    if (previousSessionStorage === undefined) delete globalObject.sessionStorage;
    else globalObject.sessionStorage = previousSessionStorage;
  }
});
