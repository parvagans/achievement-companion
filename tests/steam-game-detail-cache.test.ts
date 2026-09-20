import assert from "node:assert/strict";
import test from "node:test";
import type { GameDetailSnapshot } from "../src/core/domain";
import {
  clearDeckySteamGameDetailCache,
  readDeckySteamGameDetailCacheEntry,
  readDeckySteamGameDetailState,
  writeDeckySteamGameDetail,
} from "../src/platform/decky/decky-steam-game-detail-cache";
import {
  composeSteamGameDetailWithSteamHunters,
  getSteamHuntersGameEnrichment,
} from "../src/providers/steamhunters";

function createStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key) {
      return entries.get(key) ?? null;
    },
    key(index) {
      return [...entries.keys()][index] ?? null;
    },
    removeItem(key) {
      entries.delete(key);
    },
    setItem(key, value) {
      entries.set(key, value);
    },
  };
}

async function withMockDeckyStorage(callback: () => Promise<void> | void): Promise<void> {
  const globalObject = globalThis as typeof globalThis & {
    localStorage?: Storage;
    sessionStorage?: Storage;
  };
  const previousLocalStorage = globalObject.localStorage;
  const previousSessionStorage = globalObject.sessionStorage;
  const storage = createStorage();
  globalObject.localStorage = storage;
  globalObject.sessionStorage = storage;

  try {
    await callback();
  } finally {
    if (previousLocalStorage === undefined) delete globalObject.localStorage;
    else globalObject.localStorage = previousLocalStorage;
    if (previousSessionStorage === undefined) delete globalObject.sessionStorage;
    else globalObject.sessionStorage = previousSessionStorage;
  }
}

test("Steam game detail cache preserves SteamHunters enrichment for offline restoration", async () => {
  await withMockDeckyStorage(() => {
    const snapshot: GameDetailSnapshot = {
      game: {
        providerId: "steam",
        gameId: "1672970",
        appid: 1672970,
        title: "Minecraft Dungeons",
        status: "in_progress",
        summary: { unlockedCount: 1, totalCount: 2, completionPercent: 50 },
        metrics: [],
      },
      achievements: [],
    };
    const enrichedSnapshot = composeSteamGameDetailWithSteamHunters(snapshot, {
      app: { appId: 1672970, achievementCount: 2, tags: [] },
      achievements: [],
      groups: [{ achievementApiNames: [], name: "Anniversary Update" }],
    });

    assert.equal(writeDeckySteamGameDetail(enrichedSnapshot), true);
    const cachedEntry = readDeckySteamGameDetailCacheEntry("1672970");
    assert.ok(cachedEntry !== undefined);
    assert.ok(getSteamHuntersGameEnrichment(cachedEntry.snapshot) !== undefined);
    assert.equal(readDeckySteamGameDetailState("1672970")?.status, "stale");
    assert.equal(clearDeckySteamGameDetailCache(), true);
    assert.equal(readDeckySteamGameDetailCacheEntry("1672970"), undefined);
  });
});
