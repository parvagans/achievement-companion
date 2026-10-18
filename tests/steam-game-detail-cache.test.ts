import assert from "node:assert/strict";
import test from "node:test";
import type { GameDetailSnapshot } from "../src/core/domain";
import {
  clearDeckySteamGameDetailCache,
  preserveCachedSteamHuntersEnrichment,
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

test("Steam refresh keeps the last complete SteamHunters snapshot without reverting Steam's count", async () => {
  await withMockDeckyStorage(() => {
    const snapshot: GameDetailSnapshot = {
      game: {
        providerId: "steam", gameId: "2218750", appid: 2218750,
        title: "Halls of Torment", status: "in_progress",
        summary: { unlockedCount: 198, totalCount: 500, completionPercent: 40 }, metrics: [],
      },
      achievements: [],
    };
    const enriched = composeSteamGameDetailWithSteamHunters(snapshot, {
      app: { appId: 2218750, achievementCount: 500, playersStartedCount: 10439, tags: [] },
      achievements: [],
      groups: [{ achievementApiNames: [], name: "Base Game" }],
    });
    assert.equal(writeDeckySteamGameDetail(enriched), true);

    const refreshed: GameDetailSnapshot = {
      ...snapshot,
      game: { ...snapshot.game, summary: { unlockedCount: 198, totalCount: 600, completionPercent: 33 } },
    };
    const rendered = preserveCachedSteamHuntersEnrichment(refreshed, enriched);
    assert.equal(rendered.game.summary.totalCount, 600);
    assert.equal(getSteamHuntersGameEnrichment(rendered)?.app.achievementCount, 500);
    assert.equal(writeDeckySteamGameDetail(refreshed), true);
    assert.equal(readDeckySteamGameDetailCacheEntry("2218750")?.snapshot.game.summary.totalCount, 600);
    assert.equal(getSteamHuntersGameEnrichment(readDeckySteamGameDetailCacheEntry("2218750")!.snapshot)?.achievementGroups.length, 1);

    const partial = composeSteamGameDetailWithSteamHunters(refreshed, {
      app: { appId: 2218750, achievementCount: 600, tags: [] },
      achievements: [], groups: [],
    });
    assert.equal(writeDeckySteamGameDetail(partial), true);
    assert.equal(getSteamHuntersGameEnrichment(readDeckySteamGameDetailCacheEntry("2218750")!.snapshot)?.app.achievementCount, 500);

    const recovered = composeSteamGameDetailWithSteamHunters(refreshed, {
      app: { appId: 2218750, achievementCount: 600, tags: [] },
      achievements: [],
      groups: [{ achievementApiNames: [], name: "Base Game" }, { achievementApiNames: [], name: "New Content" }],
    });
    assert.equal(writeDeckySteamGameDetail(recovered), true);
    assert.equal(getSteamHuntersGameEnrichment(readDeckySteamGameDetailCacheEntry("2218750")!.snapshot)?.app.achievementCount, 600);
  });
});

test("a failed groups endpoint cannot erase cached groups, but a valid empty response can", async () => {
  await withMockDeckyStorage(() => {
    const snapshot: GameDetailSnapshot = {
      game: {
        providerId: "steam", gameId: "1672970", appid: 1672970,
        title: "Example", status: "in_progress",
        summary: { unlockedCount: 0, totalCount: 1, completionPercent: 0 }, metrics: [],
      },
      achievements: [{ providerId: "steam", gameId: "1672970", achievementId: "API_ONE", title: "One", isUnlocked: false, metrics: [] }],
    };
    const old = composeSteamGameDetailWithSteamHunters(snapshot, {
      app: { appId: 1672970, achievementCount: 1, tags: [] },
      achievements: [{ apiName: "API_ONE" }],
      groups: [{ name: "Base Game", achievementApiNames: ["API_ONE"] }],
    });
    writeDeckySteamGameDetail(old);

    const groupFailure = composeSteamGameDetailWithSteamHunters(snapshot, {
      app: { appId: 1672970, achievementCount: 1, tags: [] },
      achievements: [{ apiName: "API_ONE" }], groups: [], groupsAvailable: false,
    });
    writeDeckySteamGameDetail(groupFailure);
    assert.equal(getSteamHuntersGameEnrichment(readDeckySteamGameDetailCacheEntry("1672970")!.snapshot)?.achievementGroups.length, 1);

    const validEmptyGroups = composeSteamGameDetailWithSteamHunters(snapshot, {
      app: { appId: 1672970, achievementCount: 1, tags: [] },
      achievements: [{ apiName: "API_ONE" }], groups: [], groupsAvailable: true,
    });
    writeDeckySteamGameDetail(validEmptyGroups);
    assert.equal(getSteamHuntersGameEnrichment(readDeckySteamGameDetailCacheEntry("1672970")!.snapshot)?.achievementGroups.length, 0);
  });
});
