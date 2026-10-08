import assert from "node:assert/strict";
import test from "node:test";
import type { NormalizedGame } from "../src/core/domain";
import {
  createRetroAchievementsClient,
  createRetroAchievementsProvider,
  type RetroAchievementsClient,
} from "../src/providers/retroachievements";
import type { RetroAchievementsProviderConfig } from "../src/providers/retroachievements/config";
import type {
  RawRetroAchievementsGameExtendedResponse,
  RawRetroAchievementsGameListEntry,
  RawRetroAchievementsUserProgressResponse,
} from "../src/providers/retroachievements/raw-types";
import type { RetroAchievementsTransport } from "../src/providers/retroachievements/client/transport";

const config: RetroAchievementsProviderConfig = {
  username: "alice",
  hasApiKey: true,
};

function baseClient(overrides: Partial<RetroAchievementsClient>): RetroAchievementsClient {
  return {
    async loadProfile() {
      return { User: "alice" };
    },
    async loadCompletionProgress() {
      return [];
    },
    async loadAchievementsEarnedBetween() {
      return [];
    },
    async loadRecentUnlocks() {
      return [];
    },
    async loadRecentlyPlayedGames() {
      return [];
    },
    async loadGameProgress() {
      throw new Error("not used");
    },
    ...overrides,
  };
}

function game(gameId: string, platformId: string, parentGameId?: string): NormalizedGame {
  return {
    providerId: "retroachievements",
    gameId,
    title: `Game ${gameId}`,
    platformId,
    ...(parentGameId !== undefined ? { parentGameId } : {}),
    status: "in_progress",
    summary: { unlockedCount: 0, totalCount: 10, completionPercent: 0 },
    metrics: [],
  };
}

function listEntry(gameId: string, title: string, platformId: string): RawRetroAchievementsGameListEntry {
  return { ID: gameId, Title: title, ConsoleID: platformId };
}

function extended(
  gameId: string,
  title: string,
  platformId: string,
  parentGameId?: string,
): RawRetroAchievementsGameExtendedResponse {
  return {
    ID: gameId,
    Title: title,
    ConsoleID: platformId,
    ConsoleName: platformId === "1" ? "NES" : "SNES",
    NumAchievements: 20,
    ...(parentGameId !== undefined ? { ParentGameID: parentGameId } : {}),
  };
}

test("RA subsets keep only verified children of the displayed parent and isolate consoles", async () => {
  const lists = new Map<string, readonly RawRetroAchievementsGameListEntry[]>([
    [
      "1",
      [
        listEntry("100", "Base Game", "1"),
        listEntry("101", "Base Game [Subset]", "1"),
        listEntry("102", "Base Game [Subset]", "1"),
        listEntry("103", "Base Game 2 [Subset]", "1"),
      ],
    ],
    ["2", [listEntry("200", "SNES Base", "2"), listEntry("201", "SNES Base [Subset]", "2")]],
  ]);
  const extendedById = new Map<string, RawRetroAchievementsGameExtendedResponse>([
    ["100", extended("100", "Base Game", "1")],
    ["101", extended("101", "Base Game [Subset]", "1", "100")],
    ["102", extended("102", "Base Game [Subset]", "1", "999")],
    ["103", extended("103", "Base Game 2 [Subset]", "1")],
    ["200", extended("200", "SNES Base", "2")],
    ["201", extended("201", "SNES Base [Subset]", "2", "200")],
  ]);
  const progressCalls: readonly string[][] = [];
  let listCalls = 0;
  let extendedCalls = 0;
  const client = baseClient({
    async loadGameList(_config, platformId) {
      listCalls += 1;
      return lists.get(platformId) ?? [];
    },
    async loadGameExtended(_config, gameId) {
      extendedCalls += 1;
      const value = extendedById.get(gameId);
      if (value === undefined) throw new Error(`missing extended metadata for ${gameId}`);
      return value;
    },
    async loadUserProgress(_config, gameIds): Promise<RawRetroAchievementsUserProgressResponse> {
      (progressCalls as string[][]).push([...gameIds]);
      return {
        "101": { NumPossibleAchievements: 20, NumAchieved: 7, NumAchievedHardcore: 5 },
      };
    },
  });
  const provider = createRetroAchievementsProvider({ client });

  const subsets = await provider.loadRelatedGames!(config, game("100", "1"));
  assert.deepEqual(subsets.map((subset) => subset.gameId), ["101"]);
  assert.equal(subsets[0]?.parentGameId, "100");
  assert.deepEqual(subsets[0]?.progress, { unlockedCount: 7, totalCount: 20, completionPercent: 35 });
  assert.deepEqual(subsets[0]?.hardcoreProgress, { unlockedCount: 5, totalCount: 20, completionPercent: 25 });
  assert.equal(extendedCalls, 4, "every console candidate is verified, including non-children");
  assert.deepEqual(progressCalls, [["101"]]);

  const cached = await provider.loadRelatedGames!(config, game("100", "1"));
  assert.deepEqual(cached.map((subset) => subset.gameId), ["101"]);
  assert.equal(listCalls, 1, "the per-console catalogue is cached");

  const otherConsole = await provider.loadRelatedGames!(config, game("200", "2"));
  assert.deepEqual(otherConsole.map((subset) => subset.gameId), ["201"]);
  assert.equal(listCalls, 2, "a different console gets an isolated catalogue");

  const childPage = await provider.loadRelatedGames!(config, game("101", "1", "100"));
  assert.deepEqual(childPage, [], "child pages never expose the parent-only Subsets tab");
});

test("RA subset discovery de-duplicates in-flight verification and batches account progress", async () => {
  const candidates = Array.from({ length: 53 }, (_, index) => listEntry(String(300 + index), `Subset ${index}`, "3"));
  let listCalls = 0;
  let extendedCalls = 0;
  const progressCalls: number[] = [];
  const client = baseClient({
    async loadGameList() {
      listCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 1));
      return candidates;
    },
    async loadGameExtended(_config, gameId) {
      extendedCalls += 1;
      return extended(gameId, `Subset ${Number(gameId) - 300}`, "3", "299");
    },
    async loadUserProgress(_config, gameIds) {
      progressCalls.push(gameIds.length);
      return Object.fromEntries(gameIds.map((gameId) => [gameId, {
        NumPossibleAchievements: 20,
        NumAchieved: 1,
      }])) as RawRetroAchievementsUserProgressResponse;
    },
  });
  const provider = createRetroAchievementsProvider({ client });

  const [first, second] = await Promise.all([
    provider.loadRelatedGames!(config, game("299", "3")),
    provider.loadRelatedGames!(config, game("299", "3")),
  ]);
  assert.equal(first.length, 53);
  assert.equal(second.length, 53);
  assert.equal(listCalls, 1, "concurrent pages share one per-console catalogue request");
  assert.equal(extendedCalls, 53, "candidate verification is a single sequential queue");
  assert.deepEqual(progressCalls.sort((a, b) => a - b), [3, 3, 50, 50]);
});

test("RA subset verification paces live requests and retries rate limits", async () => {
  const delays: number[] = [];
  let extendedCalls = 0;
  const client = baseClient({
    async loadGameList() {
      return [listEntry("600", "Subset A", "6"), listEntry("601", "Subset B", "6")];
    },
    async loadGameExtended(_config, gameId) {
      extendedCalls += 1;
      if (gameId === "601" && extendedCalls === 2) {
        const error = new Error("rate limited") as Error & { statusCode: number };
        error.statusCode = 429;
        throw error;
      }
      return extended(gameId, `Subset ${gameId}`, "6", "599");
    },
  });
  const provider = createRetroAchievementsProvider({
    client,
    subsetVerificationIntervalMs: 25,
    subsetVerificationRetryDelayMs: 17,
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
    },
  });

  const subsets = await provider.loadRelatedGames!(config, game("599", "6"));
  assert.deepEqual(subsets.map((subset) => subset.gameId), ["600", "601"]);
  assert.equal(extendedCalls, 3);
  assert.ok(delays.includes(25), "the verification queue paces requests");
  assert.ok(delays.includes(17), "429 responses use bounded backoff");
});

test("RA subset catalogue failures are cached briefly and retried after the failure window", async () => {
  const originalNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  let extendedCalls = 0;
  try {
    const client = baseClient({
      async loadGameList() {
        return [listEntry("400", "Retry Subset", "4")];
      },
      async loadGameExtended() {
        extendedCalls += 1;
        throw new Error("temporary catalogue failure");
      },
    });
    const provider = createRetroAchievementsProvider({ client });
    await assert.rejects(provider.loadRelatedGames!(config, game("399", "4")), /temporary catalogue failure/);
    await assert.rejects(provider.loadRelatedGames!(config, game("399", "4")), /temporary catalogue failure/);
    assert.equal(extendedCalls, 1, "brief failure caching avoids a retry storm");

    now += 5 * 60 * 1000 + 1;
    await assert.rejects(provider.loadRelatedGames!(config, game("399", "4")), /temporary catalogue failure/);
    assert.equal(extendedCalls, 2, "expired failures can be retried");
  } finally {
    Date.now = originalNow;
  }
});

test("RA client uses the documented catalogue, extended metadata, and batched progress routes", async () => {
  const requests: Array<{ readonly path: string; readonly query: Record<string, unknown> }> = [];
  const transport: RetroAchievementsTransport = {
    async requestJson(request) {
      requests.push({ path: request.path, query: request.query });
      if (request.path === "API_GetGameList.php") return [];
      if (request.path === "API_GetGameExtended.php") return { ID: 1, Title: "Game" };
      return { "1": { NumPossibleAchievements: 1, NumAchieved: 0 } };
    },
  };
  const client = createRetroAchievementsClient(transport);
  await client.loadGameList!(config, "1");
  await client.loadGameExtended!(config, "10");
  await client.loadUserProgress!(config, ["10", "11"]);
  assert.deepEqual(requests, [
    { path: "API_GetGameList.php", query: { u: "alice", i: "1", f: 1, h: 1 } },
    { path: "API_GetGameExtended.php", query: { u: "alice", i: "10" } },
    { path: "API_GetUserProgress.php", query: { u: "alice", i: "10,11" } },
  ]);
});
