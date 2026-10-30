import assert from "node:assert/strict";
import test from "node:test";
import type { NormalizedGame } from "../src/core/domain";
import {
  createRetroAchievementsClient,
  createRetroAchievementsProvider as createProvider,
  type RetroAchievementsSubsetRelationshipIndexState,
  type RetroAchievementsSubsetRelationshipIndexStore,
  type RetroAchievementsClient,
} from "../src/providers/retroachievements";
import type { RetroAchievementsProviderConfig } from "../src/providers/retroachievements/config";
import type {
  RawRetroAchievementsGameExtendedResponse,
  RawRetroAchievementsGameListEntry,
  RawRetroAchievementsUserProgressResponse,
} from "../src/providers/retroachievements/raw-types";
import type { RetroAchievementsTransport } from "../src/providers/retroachievements/client/transport";

// Simulate the canonical source freshness separately from the derived checkpoint.
function createRetroAchievementsProvider(options: Parameters<typeof createProvider>[0]) {
  return createProvider({ isResourceFresh: () => true, subsetBatchSize: 128, ...options });
}

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

function createRelationshipIndexStore(
  initial: readonly RetroAchievementsSubsetRelationshipIndexState[] = [],
): { readonly store: RetroAchievementsSubsetRelationshipIndexStore; readonly states: Map<string, RetroAchievementsSubsetRelationshipIndexState> } {
  const states = new Map(initial.map((state) => [state.consoleId, state]));
  return {
    states,
    store: {
      async read(consoleId) {
        return states.get(consoleId);
      },
      async write(state) {
        states.set(state.consoleId, state);
      },
      async clear() {
        states.clear();
      },
    },
  };
}

function relationshipState(
  consoleId: string,
  candidates: RetroAchievementsSubsetRelationshipIndexState["candidates"],
  options: { readonly complete?: boolean; readonly catalogueFetchedAt?: number } = {},
): RetroAchievementsSubsetRelationshipIndexState {
  return {
    consoleId,
    catalogueFetchedAt: options.catalogueFetchedAt ?? Date.now(),
    candidates,
    complete: options.complete ?? true,
  };
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
    ParentGameID: parentGameId ?? null,
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
        ...Array.from({ length: 200 }, (_, index) => listEntry(String(1_000 + index), `Normal Game ${index}`, "1")),
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
  assert.equal(extendedCalls, 3, "only subset-tagged catalogue candidates are verified");
  assert.deepEqual(progressCalls, [["101"]]);

  const cached = await provider.loadRelatedGames!(config, game("100", "1"));
  assert.deepEqual(cached.map((subset) => subset.gameId), ["101"]);
  assert.equal(listCalls, 1, "the per-console catalogue is cached");

  const otherConsole = await provider.loadRelatedGames!(config, game("200", "2"));
  assert.deepEqual(otherConsole.map((subset) => subset.gameId), ["201"]);
  assert.equal(listCalls, 2, "a different console gets an isolated catalogue");

  const childPage = await provider.loadRelatedGames!(config, game("101", "1", "100"));
  assert.deepEqual(childPage, [], "child pages never expose the parent-only Subsets tab");
  const unrelatedRoot = await provider.loadRelatedGames!(config, game("103", "1"));
  assert.deepEqual(unrelatedRoot, [], "a complete index with no verified children keeps Subsets hidden");
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

test("RA subset discovery does not narrow candidates by the root title", async () => {
  const client = baseClient({
    async loadGameList() {
      return [listEntry("250", "Completely Different [Subset - Challenge]", "2")];
    },
    async loadGameExtended(_config, gameId) {
      return extended(gameId, "Completely Different [Subset - Challenge]", "2", "249");
    },
  });
  const provider = createRetroAchievementsProvider({ client });

  const subsets = await provider.loadRelatedGames!(config, game("249", "2"));
  assert.deepEqual(subsets.map((subset) => subset.gameId), ["250"]);
});

test("RA subset progress refresh reuses the verified relationship index", async () => {
  let extendedCalls = 0;
  let progressCalls = 0;
  const client = baseClient({
    async loadGameList() {
      return [listEntry("700", "Base Game [Subset]", "7")];
    },
    async loadGameExtended(_config, gameId) {
      extendedCalls += 1;
      return extended(gameId, "Base Game [Subset]", "7", "699");
    },
    async loadUserProgress() {
      progressCalls += 1;
      return progressCalls === 1
        ? { "700": { NumPossibleAchievements: 20, NumAchieved: 2, NumAchievedHardcore: 1 } }
        : { "700": { NumPossibleAchievements: 20, NumAchieved: 3, NumAchievedHardcore: 2 } };
    },
  });
  const provider = createRetroAchievementsProvider({ client });
  const parent = game("699", "7");

  const initial = await provider.loadRelatedGames!(config, parent);
  const refreshed = await provider.loadRelatedGameProgress!(config, parent, initial);

  assert.equal(extendedCalls, 1, "progress refresh does not re-verify relationship metadata");
  assert.equal(progressCalls, 2, "progress refresh asks the account endpoint again");
  assert.deepEqual(refreshed[0]?.progress, { unlockedCount: 3, totalCount: 20, completionPercent: 15 });
  assert.deepEqual(refreshed[0]?.hardcoreProgress, { unlockedCount: 2, totalCount: 20, completionPercent: 10 });
  assert.equal(refreshed[0]?.title, initial[0]?.title, "cached relationship metadata is retained");
});

test("RA subset progress refresh clears unavailable progress instead of fabricating zero", async () => {
  let progressCalls = 0;
  const client = baseClient({
    async loadGameList() {
      return [listEntry("710", "Base Game [Subset]", "7")];
    },
    async loadGameExtended(_config, gameId) {
      return extended(gameId, "Base Game [Subset]", "7", "709");
    },
    async loadUserProgress() {
      progressCalls += 1;
      return progressCalls === 1
        ? { "710": { NumPossibleAchievements: 10, NumAchieved: 1 } }
        : {};
    },
  });
  const provider = createRetroAchievementsProvider({ client });
  const parent = game("709", "7");

  const initial = await provider.loadRelatedGames!(config, parent);
  const refreshed = await provider.loadRelatedGameProgress!(config, parent, initial);

  assert.equal(initial[0]?.progress?.unlockedCount, 1);
  assert.equal(refreshed[0]?.progress, undefined);
  assert.equal(refreshed[0]?.hardcoreProgress, undefined);
});

test("RA subset index can be explicitly cleared for a deliberate rebuild", async () => {
  let extendedCalls = 0;
  const client = baseClient({
    async loadGameList() {
      return [listEntry("720", "Base Game [Subset]", "7")];
    },
    async loadGameExtended(_config, gameId) {
      extendedCalls += 1;
      return extended(gameId, "Base Game [Subset]", "7", "719");
    },
  });
  const provider = createRetroAchievementsProvider({ client });
  const parent = game("719", "7");

  await provider.loadRelatedGames!(config, parent);
  await provider.loadRelatedGames!(config, parent);
  assert.equal(extendedCalls, 1);

  provider.clearRelatedGameIndex!();
  await provider.loadRelatedGames!(config, parent);
  assert.equal(extendedCalls, 2, "the explicit rebuild invalidates the catalogue cache");
});

test("RA verified relationship index survives provider recreation", async () => {
  const { store } = createRelationshipIndexStore();
  let extendedCalls = 0;
  const client = baseClient({
    async loadGameList() {
      return [listEntry("730", "Base Game [Subset]", "7")];
    },
    async loadGameExtended(_config, gameId) {
      extendedCalls += 1;
      return extended(gameId, "Base Game [Subset]", "7", "729");
    },
  });
  const parent = game("729", "7");
  await createRetroAchievementsProvider({ client, subsetRelationshipIndexStore: store }).loadRelatedGames!(config, parent);
  await createRetroAchievementsProvider({ client, subsetRelationshipIndexStore: store }).loadRelatedGames!(config, parent);
  assert.equal(extendedCalls, 1, "a persisted complete index avoids re-verification after provider recreation");
});

test("RA subset verification delegates rate-limit retry to the backend", async () => {
  let calls = 0;
  const provider = createRetroAchievementsProvider({
    client: baseClient({
      async loadGameList() { return [listEntry("600", "Game [Subset]", "6")]; },
      async loadGameExtended() { calls += 1; throw Object.assign(new Error("rate limited"), { statusCode: 429 }); },
    }),
  });
  assert.deepEqual(await provider.loadRelatedGames!(config, game("599", "6")), []);
  assert.equal(provider.getSubsetDiscoveryStatus("6")?.failureCategory, "rate_limit");
  assert.equal(calls, 1, "no nested retry amplification");
});

test("RA subset discovery resumes only unresolved candidates after a rate limit", async () => {
  const { store, states } = createRelationshipIndexStore();
  let shouldRateLimit = true;
  let now = 1_800_000_000_000;
  const extendedCalls: string[] = [];
  const client = baseClient({
    async loadGameList() {
      return [
        listEntry("800", "Game [Subset - A]", "8"),
        listEntry("801", "Game [Subset - B]", "8"),
        listEntry("802", "Game [Subset - C]", "8"),
      ];
    },
    async loadGameExtended(_config, gameId) {
      extendedCalls.push(gameId);
      if (gameId === "801" && shouldRateLimit) {
        const error = new Error("rate limited") as Error & { statusCode: number };
        error.statusCode = 429;
        throw error;
      }
      return extended(gameId, `Game [Subset - ${gameId}]`, "8", "799");
    },
  });
  const provider = createRetroAchievementsProvider({
    client,
    subsetRelationshipIndexStore: store,
    now: () => now,
  });

  assert.deepEqual((await provider.loadRelatedGames!(config, game("799", "8"))).map((entry) => entry.gameId), ["800"]);
  assert.deepEqual(extendedCalls, ["800", "801"]);
  assert.deepEqual(
    states.get("8")?.candidates.map((candidate) => [candidate.gameId, candidate.status]),
    [["800", "verified-parent"], ["801", "retry-later"], ["802", "unresolved"]],
  );

  shouldRateLimit = false;
  now += 30001;
  const subsets = await provider.loadRelatedGames!(config, game("799", "8"));
  assert.deepEqual(subsets.map((subset) => subset.gameId), ["800", "801", "802"]);
  assert.deepEqual(extendedCalls, ["800", "801", "801", "802"], "verified candidates are not repeated");
  assert.equal(states.get("8")?.complete, true);
});

test("RA stale relationships stay visible when background catalogue refresh fails", async () => {
  const cachedState = relationshipState("9", [
    {
      gameId: "901",
      title: "Game [Subset - Known]",
      platformId: "9",
      status: "verified-parent",
      parentGameId: "899",
    },
  ], { catalogueFetchedAt: 0 });
  const { store, states } = createRelationshipIndexStore([cachedState]);
  let progressCalls = 0;
  const client = baseClient({
    async loadGameList() {
      return [
        listEntry("901", "Game [Subset - Known]", "9"),
        listEntry("902", "Game [Subset - Broken Refresh]", "9"),
      ];
    },
    async loadGameExtended() {
      throw new Error("extended metadata unavailable");
    },
    async loadUserProgress() {
      progressCalls += 1;
      return { "901": { NumPossibleAchievements: 10, NumAchieved: 4 } };
    },
  });
  const provider = createRetroAchievementsProvider({ client, subsetRelationshipIndexStore: store, isResourceFresh: (path) => path === "API_GetGameExtended.php" });

  const subsets = await provider.loadRelatedGames!(config, game("899", "9"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(subsets.map((subset) => subset.gameId), ["901"]);
  assert.equal(progressCalls, 1);
  assert.equal(states.get("9")?.complete, false);
  assert.deepEqual(
    states.get("9")?.lastKnownGoodCandidates?.map((candidate) => candidate.gameId),
    ["901"],
    "last-known-good relationships remain persisted while the refresh is incomplete",
  );
  assert.equal(states.get("9")?.candidates.find((candidate) => candidate.gameId === "902")?.status, "retry-later");
});

test("RA stale catalogue refresh adds only new subset candidates", async () => {
  const cachedState = relationshipState("10", [
    {
      gameId: "1001",
      title: "Game [Subset - Known]",
      platformId: "10",
      status: "verified-parent",
      parentGameId: "999",
    },
  ], { catalogueFetchedAt: 0 });
  const { store, states } = createRelationshipIndexStore([cachedState]);
  const extendedCalls: string[] = [];
  let releaseNewVerification: (() => void) | undefined;
  let newVerificationStartedResolve: (() => void) | undefined;
  const newVerificationStarted = new Promise<void>((resolve) => {
    newVerificationStartedResolve = resolve;
  });
  const client = baseClient({
    async loadGameList() {
      return [listEntry("1001", "Game [Subset - Known]", "10"), listEntry("1002", "Game [Subset - New]", "10")];
    },
    async loadGameExtended(_config, gameId) {
      extendedCalls.push(gameId);
      if (gameId === "1002") {
        newVerificationStartedResolve?.();
        await new Promise<void>((resolve) => {
          releaseNewVerification = resolve;
        });
      }
      return extended(gameId, `Game [Subset - ${gameId}]`, "10", "999");
    },
    async loadUserProgress() {
      return {};
    },
  });
  const provider = createRetroAchievementsProvider({ client, subsetRelationshipIndexStore: store, isResourceFresh: (path) => path === "API_GetGameExtended.php" });

  const known = await provider.loadRelatedGames!(config, game("999", "10"));
  assert.deepEqual(known.map((subset) => subset.gameId), ["1001"]);

  await newVerificationStarted;
  assert.deepEqual(extendedCalls, ["1002"], "only the newly discovered candidate is verified");
  const whileUnresolved = await provider.loadRelatedGames!(config, game("999", "10"));
  assert.deepEqual(whileUnresolved.map((subset) => subset.gameId), ["1001"], "A remains usable while B is unresolved");
  assert.equal(states.get("10")?.complete, false);
  assert.deepEqual(
    states.get("10")?.lastKnownGoodCandidates?.map((candidate) => candidate.gameId),
    ["1001"],
    "the active last-known-good relationship set is not replaced by partial work",
  );

  releaseNewVerification?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(states.get("10")?.complete, true);
  assert.deepEqual(states.get("10")?.candidates.map((candidate) => candidate.gameId), ["1001", "1002"]);
  assert.deepEqual(states.get("10")?.lastKnownGoodCandidates?.map((candidate) => candidate.gameId), ["1001", "1002"]);
});

test("RA catalogue eligibility is delegated to the canonical transport", async () => {
  const originalNow = Date.now;
  let now = 1_000_000;
  let catalogueCalls = 0;
  Date.now = () => now;
  try {
    const provider = createRetroAchievementsProvider({
      client: baseClient({
        async loadGameList() {
          catalogueCalls += 1;
          throw new Error("temporary catalogue failure");
        },
        async loadGameExtended() {
          throw new Error("must not verify after catalogue failure");
        },
      }),
    });
    await assert.rejects(provider.loadRelatedGames!(config, game("1099", "11")), /temporary catalogue failure/);
    await assert.rejects(provider.loadRelatedGames!(config, game("1099", "11")), /temporary catalogue failure/);
    assert.equal(catalogueCalls, 2, "the provider adds no competing failure TTL; transport owns eligibility");

    now += 5 * 60 * 1000 + 1;
    await assert.rejects(provider.loadRelatedGames!(config, game("1099", "11")), /temporary catalogue failure/);
    assert.equal(catalogueCalls, 3, "each semantic read consults the canonical transport");
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

test("RA subset verification persists each success without exceeding one write per success plus boundary checkpoints", async () => {
  const writes: RetroAchievementsSubsetRelationshipIndexState[] = [];
  const candidates = Array.from({ length: 100 }, (_, index) => listEntry(String(index + 2000), `Set ${index} [Subset]`, "1"));
  const provider = createRetroAchievementsProvider({
    client: baseClient({
      async loadGameList() { return candidates; },
      async loadGameExtended(_config, id) { return extended(id, `Set ${id} [Subset]`, "1", "100"); },
    }),
    subsetRelationshipIndexStore: {
      async read() { return undefined; },
      async write(state) { writes.push(state); },
      async clear() {},
    },
  });
  assert.equal((await provider.loadRelatedGames!(config, game("100", "1"))).length, 100);
  assert.ok(writes.length <= 102);
  assert.equal(writes[0]?.candidates.filter((candidate) => candidate.status === "unresolved").length, 100);
  assert.equal(writes[1]?.candidates.filter((candidate) => candidate.status === "verified-parent").length, 1);
  assert.equal(writes.at(-1)?.complete, true);
  assert.equal(writes.at(-1)?.lastKnownGoodCandidates?.length, 100);
});

test("RA subset failure persists the partial checkpoint and resumes only the failed candidate onward", async () => {
  const { store, states } = createRelationshipIndexStore();
  let fail = true;
  let now = 1_800_000_000_000;
  const calls: string[] = [];
  const client = baseClient({
    async loadGameList() {
      return Array.from({ length: 25 }, (_, index) => listEntry(String(index + 3000), `Set ${index} [Subset]`, "1"));
    },
    async loadGameExtended(_config, id) {
      calls.push(id);
      if (id === "3014" && fail) throw new Error("offline");
      return extended(id, `Set ${id} [Subset]`, "1", "100");
    },
  });
  await createRetroAchievementsProvider({ client, subsetRelationshipIndexStore: store, now: () => now }).loadRelatedGames!(config, game("100", "1"));
  const interrupted = states.get("1")!;
  assert.equal(interrupted.candidates.filter((candidate) => candidate.status === "verified-parent").length, 24);
  assert.equal(interrupted.candidates[14]?.status, "retry-later");
  fail = false;
  now += 30001;
  calls.length = 0;
  assert.equal((await createRetroAchievementsProvider({ client, subsetRelationshipIndexStore: store, now: () => now }).loadRelatedGames!(config, game("100", "1"))).length, 25);
  assert.deepEqual(calls, ["3014"]);
});

test("bounded subset batches expose verified children and resume without an empty/error page", async () => {
  const { store } = createRelationshipIndexStore();
  const calls: string[] = [];
  const provider = createRetroAchievementsProvider({ subsetRelationshipIndexStore: store, subsetBatchSize: 2,
    client: baseClient({
      async loadGameList() { return Array.from({ length: 5 }, (_, i) => listEntry(String(i + 4000), `Game [Subset ${i}]`, "1")); },
      async loadGameExtended(_config, id) { calls.push(id); return extended(id, "Game [Subset]", "1", "100"); },
    }),
  });
  const first = await provider.loadRelatedGames(config, game("100", "1"));
  assert.equal(first.length, 2);
  assert.deepEqual(provider.getSubsetDiscoveryStatus("1"), { complete: false, verified: 2, total: 5,
    unsupported: 0, remaining: 3, running: false, checkpointSaved: true });
  assert.equal((await provider.loadRelatedGames(config, game("100", "1"))).length, 4);
  assert.equal((await provider.loadRelatedGames(config, game("100", "1"))).length, 5);
  assert.equal(calls.length, 5);
  assert.equal(provider.getSubsetDiscoveryStatus("1")?.complete, true);
});

test("subset visibility reads only verified relationships, retains partial positives, and publishes discovery without a detail refresh", async () => {
  const { store } = createRelationshipIndexStore();
  let metadataCalls = 0, updates = 0;
  const provider = createRetroAchievementsProvider({ subsetRelationshipIndexStore: store, subsetBatchSize: 1,
    client: baseClient({
      async loadGameList() { return [listEntry("10", "Other [Subset]", "1"), listEntry("11", "Actual [Subset]", "1")]; },
      async loadGameExtended(_config, id) { metadataCalls++; return extended(id, "Subset", "1", id === "10" ? "999" : "100"); },
    }),
  });
  const parent = game("100", "1");
  assert.deepEqual(await provider.readVerifiedRelatedGames(parent), []);
  assert.equal(metadataCalls, 0, "navigation eligibility never invokes metadata HTTP");
  const stop = provider.subscribeSubsetRelationships(() => updates++);
  await provider.loadRelatedGames(config, parent);
  assert.deepEqual(await provider.readVerifiedRelatedGames(parent), [], "partial discovery without a matching verified parent does not show Subsets");
  await provider.loadRelatedGames(config, parent);
  assert.deepEqual((await provider.readVerifiedRelatedGames(parent)).map((entry) => entry.gameId), ["11"]);
  assert.equal(metadataCalls, 2);
  assert.ok(updates > 0);
  stop();
  assert.deepEqual(await provider.readVerifiedRelatedGames(game("777", "1")), [], "verified zero has no tab");
  const restored = createRetroAchievementsProvider({ subsetRelationshipIndexStore: store, client: baseClient({}) });
  assert.deepEqual((await restored.readVerifiedRelatedGames(parent)).map((entry) => entry.gameId), ["11"]);
});

test("a failed recheck cannot erase a verified relationship from an incomplete catalogue", async () => {
  const state = relationshipState("1", [
    { gameId: "11", title: "Actual [Subset]", platformId: "1", parentGameId: "100", status: "verified-parent" },
    { gameId: "12", title: "Unknown [Subset]", platformId: "1", status: "unresolved" },
  ], { complete: false });
  const { store } = createRelationshipIndexStore([state]);
  const provider = createRetroAchievementsProvider({ subsetRelationshipIndexStore: store, isResourceFresh: () => false,
    client: baseClient({
      async loadGameList() { return [listEntry("11", "Actual [Subset]", "1"), listEntry("12", "Unknown [Subset]", "1")]; },
      async loadGameExtended() { throw new Error("temporary outage"); },
    }),
  });
  assert.deepEqual((await provider.loadRelatedGames(config, game("100", "1"))).map((entry) => entry.gameId), ["11"]);
  assert.deepEqual((await provider.readVerifiedRelatedGames(game("100", "1"))).map((entry) => entry.gameId), ["11"]);
});

test("99/101 legacy checkpoint resumes only two unresolved candidates despite 99 missing or stale expiries", async () => {
  const known = Array.from({ length: 99 }, (_, i) => ({ gameId: String(1000 + i), title: `Known ${i} [Subset]`, platformId: "21",
    parentGameId: "2993", status: "verified-parent" as const, ...(i % 2 ? { metadataFreshUntil: 1 } : {}) }));
  const remaining = ["45076", "45320"].map((gameId) => ({ gameId, title: `New ${gameId} [Subset]`, platformId: "21", status: "unresolved" as const }));
  const { store, states } = createRelationshipIndexStore([relationshipState("21", [...known, ...remaining], { complete: false })]);
  const calls: string[] = [], events: Record<string, string | number | boolean>[] = [];
  const provider = createRetroAchievementsProvider({ subsetRelationshipIndexStore: store, subsetBatchSize: 5, now: () => 10000,
    subsetDiagnostic(event, fields) { events.push({ event, ...fields }); },
    client: baseClient({
      async loadGameList() { return [...known, ...remaining].map((entry) => listEntry(entry.gameId, entry.title, "21")); },
      async loadGameExtended(_config, id) { calls.push(id); return extended(id, "Verified subset", "21", id === "45076" ? "2721" : "2983"); },
    }),
  });
  const completed = await provider.resumeSubsetDiscovery(config, "21");
  assert.deepEqual(calls, ["45076", "45320"]);
  assert.equal(completed.complete, true);
  assert.equal(provider.getSubsetDiscoveryStatus("21")?.verified, 101);
  assert.equal(states.get("21")?.complete, true);
  assert.equal(events.filter((event) => event.event === "subset_candidate" && event.outcome === "verified").length, 2);
  assert.ok(events.some((event) => event.event === "subset_checkpoint" && event.verified === 100));
  const restored = createRetroAchievementsProvider({ subsetRelationshipIndexStore: store, client: baseClient({}) });
  assert.equal((await restored.readVerifiedRelatedGames(game("2993", "21"))).length, 99);
});

test("rapid continuation joins one operation and a zero-work deferred continuation makes no metadata calls", async () => {
  let now = 10000, calls = 0, release!: () => void;
  const { store } = createRelationshipIndexStore();
  const provider = createRetroAchievementsProvider({ subsetRelationshipIndexStore: store, now: () => now,
    client: baseClient({
      async loadGameList() { return [listEntry("44", "Game [Subset]", "1")]; },
      async loadGameExtended() { calls++; await new Promise<void>((resolve) => { release = resolve; }); throw Object.assign(new Error("rate limited"), { status: 429, retryAfterMs: 60000 }); },
    }),
  });
  const operations = Array.from({ length: 4 }, () => provider.resumeSubsetDiscovery(config, "1"));
  for (let i = 0; i < 30; i++) await Promise.resolve();
  assert.equal(calls, 1); release(); await Promise.all(operations);
  assert.equal(provider.getSubsetDiscoveryStatus("1")?.retryAt, 70000);
  await provider.resumeSubsetDiscovery(config, "1"); assert.equal(calls, 1);
  now = 70001;
  const retry = provider.resumeSubsetDiscovery(config, "1");
  for (let i = 0; i < 30; i++) await Promise.resolve();
  assert.equal(calls, 2); release(); await retry;
});

test("HTTP success with invalid metadata is retryable, explicit 404 is terminal unsupported, valid no-parent is verified", async () => {
  const { store, states } = createRelationshipIndexStore();
  const provider = createRetroAchievementsProvider({ subsetRelationshipIndexStore: store, now: () => 10000,
    client: baseClient({
      async loadGameList() { return ["40", "41", "42"].map((id) => listEntry(id, "Game [Subset]", "1")); },
      async loadGameExtended(_config, id) {
        if (id === "40") return { ID: "40", ConsoleID: "2", NumAchievements: 1 };
        if (id === "41") throw Object.assign(new Error("not found"), { statusCode: 404 });
        return extended(id, "Game [Subset]", "1");
      },
    }),
  });
  await provider.resumeSubsetDiscovery(config, "1");
  assert.deepEqual(states.get("1")?.candidates.map((c) => c.status), ["retry-later", "unsupported", "verified-no-parent"]);
  assert.equal(provider.getSubsetDiscoveryStatus("1")?.complete, false);
  assert.equal(provider.getSubsetDiscoveryStatus("1")?.failureCategory, "invalid_metadata");
  assert.equal(provider.getSubsetDiscoveryStatus("1")?.verified, 1);
  assert.equal(provider.getSubsetDiscoveryStatus("1")?.unsupported, 1);
});

test("interrupted verifying state resumes and a failed checkpoint write is reported rather than claimed saved", async () => {
  const checkpoint = relationshipState("1", [{ gameId: "44", title: "Game [Subset]", platformId: "1", status: "verifying" }], { complete: false });
  const provider = createRetroAchievementsProvider({
    subsetRelationshipIndexStore: { async read() { return checkpoint; }, async write() { throw new Error("quota"); }, async clear() {} },
    client: baseClient({ async loadGameList() { return [listEntry("44", "Game [Subset]", "1")]; },
      async loadGameExtended() { return extended("44", "Game [Subset]", "1", "99"); } }),
  });
  await provider.resumeSubsetDiscovery(config, "1");
  assert.equal(provider.getSubsetDiscoveryStatus("1")?.verified, 1);
  assert.equal(provider.getSubsetDiscoveryStatus("1")?.complete, true);
  assert.equal(provider.getSubsetDiscoveryStatus("1")?.checkpointSaved, false);
});

test("a console cooldown defers unattempted candidates too and survives provider recreation", async () => {
  const { store } = createRelationshipIndexStore();
  let calls = 0;
  const options = { subsetRelationshipIndexStore: store, now: () => 10000, client: baseClient({
    async loadGameList() { return ["40", "41", "42"].map((id) => listEntry(id, "Game [Subset]", "1")); },
    async loadGameExtended() { calls++; throw Object.assign(new Error("rate limited"), { status: 429, retryAfterMs: 60000 }); },
  }) };
  const provider = createRetroAchievementsProvider(options);
  await provider.resumeSubsetDiscovery(config, "1");
  assert.equal(provider.getSubsetDiscoveryStatus("1")?.retryAt, 70000);
  assert.equal(calls, 1, "stop the batch on the shared cooldown response");
  await createRetroAchievementsProvider(options).resumeSubsetDiscovery(config, "1");
  assert.equal(calls, 1, "pending candidates cannot create ineffective RPC retries during the console deferral");
});

test("partial or invalid parent metadata cannot remove verified relationships; explicit null can", async () => {
  for (const parent of [undefined, "invalid", -1, 1.5, null, "200"]) {
    const {store,states}=createRelationshipIndexStore([relationshipState("1",[{gameId:"11",title:"Game [Subset]",platformId:"1",parentGameId:"100",status:"verified-parent",metadataFreshUntil:1}])]);
    let calls=0;
    const p=createRetroAchievementsProvider({subsetRelationshipIndexStore:store,now:()=>10000,resourceFreshUntil:()=>20000,
      client:baseClient({async loadGameList(){return [listEntry("11","Game [Subset]","1")]},async loadGameExtended(){calls++; const value = {...extended("11","Game [Subset]","1"), ParentGameID:parent}; if(parent===undefined) delete value.ParentGameID; return value as RawRetroAchievementsGameExtendedResponse}})});
    await Promise.all([p.resumeSubsetDiscovery(config,"1"),p.resumeSubsetDiscovery(config,"1")]);
    const candidate=states.get("1")!.candidates[0]!;
    assert.equal(candidate.parentGameId,parent===null?undefined:parent==="200"?"200":"100");
    assert.equal(candidate.status,parent===null?"verified-no-parent":"verified-parent");
    assert.equal(calls,1);
  }
});
