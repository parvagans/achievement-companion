import assert from "node:assert/strict";
import test from "node:test";
import type { GameDetailSnapshot, NormalizedAchievement } from "../src/core/domain";
import {
  composeSteamGameDetailWithSteamHunters,
  composeSteamGameDetailWithSteamHuntersWithinBudget,
  createSteamHuntersClient,
  createSteamHuntersService,
  matchSteamAchievements,
  normalizeSteamHuntersAchievement,
  normalizeSteamHuntersApp,
  normalizeSteamHuntersObtainability,
  SteamHuntersRequestError,
  type SteamHuntersClient,
} from "../src/providers/steamhunters";
import { buildDeckySteamHuntersGameViewModel } from "../src/platform/decky/decky-steam-hunters-view-model";
import {
  formatSteamHuntersCompletionDuration,
  formatSteamHuntersPercentage,
} from "../src/platform/decky/decky-steam-hunters-presentation";

function steamAchievement(achievementId: string, title = achievementId): NormalizedAchievement {
  return {
    providerId: "steam",
    achievementId,
    gameId: "1672970",
    title,
    isUnlocked: false,
    metrics: [],
  };
}

function steamGameDetailSnapshot(): GameDetailSnapshot {
  return {
    game: {
      providerId: "steam",
      appid: 1672970,
      gameId: "1672970",
      title: "Minecraft Dungeons",
      status: "in_progress",
      summary: { unlockedCount: 1, totalCount: 2, completionPercent: 50 },
      metrics: [],
    },
    achievements: [steamAchievement("API_ONE"), steamAchievement("API_TWO")],
  };
}

test("SteamHunters client uses credential-free AppID endpoint URLs", async () => {
  const requests: Request[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    requests.push(new Request(input, init));
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const client = createSteamHuntersClient({ fetchImpl, baseUrl: "https://example.test/api" });

  await client.loadApp(1672970);
  await client.loadAchievements(1672970);

  assert.deepEqual(requests.map((request) => request.url), [
    "https://example.test/api/apps/1672970",
    "https://example.test/api/apps/1672970/achievements",
  ]);
  assert.equal(requests[0]?.credentials, "omit");
  assert.equal(requests[0]?.headers.get("Accept"), "application/json");
});

test("SteamHunters client reports non-success responses and invalid JSON", async () => {
  const responseClient = createSteamHuntersClient({
    fetchImpl: async () => new Response("not found", { status: 404, statusText: "Not Found" }),
  });
  await assert.rejects(
    () => responseClient.loadApp(1),
    (error: unknown) => error instanceof SteamHuntersRequestError && error.category === "http" && error.statusCode === 404,
  );

  const malformedClient = createSteamHuntersClient({
    fetchImpl: async () => new Response("{", { status: 200 }),
  });
  await assert.rejects(
    () => malformedClient.loadApp(1),
    (error: unknown) => error instanceof SteamHuntersRequestError && error.category === "parse",
  );
});

test("SteamHunters client converts an aborted request into a timeout", async () => {
  const client = createSteamHuntersClient({
    timeoutMs: 1,
    fetchImpl: async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }),
  });

  await assert.rejects(
    () => client.loadApp(1),
    (error: unknown) => error instanceof SteamHuntersRequestError && error.category === "timeout",
  );
});

test("SteamHunters normalization accepts complete and partial app payloads", () => {
  assert.deepEqual(normalizeSteamHuntersApp({
    appId: 1672970,
    name: " Minecraft Dungeons ",
    achievementCount: 104,
    playersStartedCount: 4619,
    points: 18340,
    hasPaidDlc: true,
    tags: [{ tagId: 1720, name: "Dungeon Crawler" }],
  }), {
    appId: 1672970,
    name: "Minecraft Dungeons",
    achievementCount: 104,
    playersStartedCount: 4619,
    points: 18340,
    hasPaidDlc: true,
    tags: [{ id: 1720, name: "Dungeon Crawler" }],
  });
  assert.deepEqual(normalizeSteamHuntersApp({ appId: 1672970, achievementCount: null, tags: [null] }), {
    appId: 1672970,
    tags: [],
  });
  assert.equal(normalizeSteamHuntersApp({ appId: "1672970" }), undefined);
});

test("SteamHunters normalization safely handles achievement fields and obtainability values", () => {
  assert.deepEqual(normalizeSteamHuntersAchievement({
    achievementId: 51,
    apiName: "SPINWHEEL_70",
    localPercentage: 6.5,
    steamPercentage: 1.4,
    points: 291,
    obtainability: 2,
  }), {
    achievementId: 51,
    apiName: "SPINWHEEL_70",
    localPercentage: 6.5,
    steamPercentage: 1.4,
    points: 291,
    obtainability: "conditionally-obtainable",
  });
  assert.equal(normalizeSteamHuntersAchievement({ name: "No stable ID" }), undefined);
  assert.deepEqual([0, 1, 2, 3, 99].map(normalizeSteamHuntersObtainability), [
    "obtainable",
    "broken-but-obtainable",
    "conditionally-obtainable",
    "unobtainable",
    "unknown",
  ]);
});

test("SteamHunters percentage presentation is concise", () => {
  assert.equal(formatSteamHuntersPercentage(6.507072905331882), "6.5%");
  assert.equal(formatSteamHuntersPercentage(12), "12%");
});

test("SteamHunters completion durations render whole API minutes as hours and minutes", () => {
  assert.equal(formatSteamHuntersCompletionDuration(5843), "97h 23m");
  assert.equal(formatSteamHuntersCompletionDuration(1802), "30h 2m");
  assert.equal(formatSteamHuntersCompletionDuration(42), "42m");
});

test("SteamHunters matching uses only exact stable API identifiers", () => {
  const steamAchievements = [steamAchievement("API_ONE", "Localized title"), steamAchievement("API_TWO", "Same title")];
  const matches = matchSteamAchievements(steamAchievements, [
    { apiName: "API_ONE", name: "Different localized title", obtainability: "obtainable" },
    { apiName: "NOT_API_TWO", name: "Same title", obtainability: "obtainable" },
  ]);

  assert.deepEqual(matches.map((match) => match.steamAchievementId), ["API_ONE"]);
});

test("SteamHunters matching omits ambiguous API identifiers", () => {
  const matches = matchSteamAchievements([steamAchievement("API_ONE")], [
    { apiName: "API_ONE", obtainability: "obtainable" },
    { apiName: "API_ONE", obtainability: "unobtainable" },
  ]);

  assert.deepEqual(matches, []);
});

test("SteamHunters service deduplicates concurrent requests, caches metadata, and degrades gracefully", async () => {
  let appCalls = 0;
  let achievementCalls = 0;
  const client: SteamHuntersClient = {
    async loadApp() {
      appCalls += 1;
      return { appId: 1672970, achievementCount: 1 };
    },
    async loadAchievements() {
      achievementCalls += 1;
      return [{ apiName: "API_ONE", obtainability: 0 }];
    },
  };
  const service = createSteamHuntersService({ client, cacheTtlMs: 60_000 });
  const [first, second] = await Promise.all([service.loadGameData(1672970), service.loadGameData(1672970)]);

  assert.deepEqual(first, second);
  assert.equal(appCalls, 1);
  assert.equal(achievementCalls, 1);
  await service.loadGameData(1672970);
  assert.equal(appCalls, 1);
  assert.equal(achievementCalls, 1);

  const unavailable = createSteamHuntersService({
    client: { loadApp: async () => { throw new Error("offline"); }, loadAchievements: async () => [] },
  });
  assert.equal(await unavailable.loadGameData(1672970), undefined);
});

test("SteamHunters composition preserves Steam truth and enriches only exact matches", () => {
  const snapshot = steamGameDetailSnapshot();
  const composed = composeSteamGameDetailWithSteamHunters(snapshot, {
    app: { appId: 1672970, achievementCount: 2, tags: [] },
    achievements: [
      { apiName: "API_ONE", points: 42, obtainability: "obtainable" },
      { apiName: "NOT_API_TWO", points: 99, obtainability: "unobtainable" },
    ],
  });

  assert.equal(composed.game, snapshot.game);
  assert.equal(composed.achievements, snapshot.achievements);
  assert.deepEqual(composed.steamHunters?.achievementsBySteamAchievementId, {
    API_ONE: { apiName: "API_ONE", points: 42, obtainability: "obtainable" },
  });
  assert.equal(composeSteamGameDetailWithSteamHunters(snapshot, undefined), snapshot);
});

test("SteamHunters composition returns Steam data when enrichment exceeds its wait budget", async () => {
  const snapshot = steamGameDetailSnapshot();
  const service: SteamHuntersClient = {
    loadApp: async () => new Promise(() => {}),
    loadAchievements: async () => [],
  };
  const result = await composeSteamGameDetailWithSteamHuntersWithinBudget({
    snapshot,
    service: createSteamHuntersService({ client: service }),
    waitMs: 1,
  });

  assert.equal(result, snapshot);
});

test("SteamHunters full-screen view model shows only complete-set points and health counts", () => {
  const baseSnapshot = steamGameDetailSnapshot();
  const snapshot: GameDetailSnapshot = {
    ...baseSnapshot,
    achievements: [{ ...baseSnapshot.achievements[0]!, isUnlocked: true }, baseSnapshot.achievements[1]!],
  };
  const composed = composeSteamGameDetailWithSteamHunters(snapshot, {
    app: {
      appId: 1672970,
      achievementCount: 2,
      points: 50,
      hasPaidDlc: true,
      unobtainableAchievementCount: 0,
      playersPerfectedCount: 25,
      playersQualifiedCount: 500,
      medianCompletionTime: 5843,
      fastestCompletionTime: 1802,
      tags: [],
    },
    achievements: [
      { apiName: "API_ONE", points: 20, obtainability: "conditionally-obtainable" },
      { apiName: "API_TWO", points: 30, obtainability: "broken-but-obtainable" },
    ],
  });
  const model = buildDeckySteamHuntersGameViewModel({
    achievements: snapshot.achievements,
    enrichment: composed.steamHunters,
  });

  assert.deepEqual(model?.progressPoints, { earned: 20, total: 50 });
  assert.deepEqual(model?.completionHealth, {
    hasPaidDlc: true,
    unobtainableCount: 0,
    conditionalCount: 1,
    brokenButObtainableCount: 1,
  });
  assert.equal(model?.hasCommunityStats, true);
  assert.deepEqual(model?.communitySummary, {
    perfectedPercentage: 5,
    qualifiedPlayers: 500,
    medianCompletionMinutes: 5843,
    fastestCompletionMinutes: 1802,
  });

  const partial = composeSteamGameDetailWithSteamHunters(snapshot, {
    app: { appId: 1672970, achievementCount: 2, points: 50, tags: [] },
    achievements: [{ apiName: "API_ONE", points: 20, obtainability: "unobtainable" }],
  });
  const partialModel = buildDeckySteamHuntersGameViewModel({
    achievements: snapshot.achievements,
    enrichment: partial.steamHunters,
  });
  assert.equal(partialModel?.progressPoints, undefined);
  assert.equal(partialModel?.completionHealth.conditionalCount, undefined);

  const completedOnly = composeSteamGameDetailWithSteamHunters(snapshot, {
    app: { appId: 1672970, playersCompletedCount: 12, tags: [] },
    achievements: [],
  });
  assert.equal(
    buildDeckySteamHuntersGameViewModel({
      achievements: snapshot.achievements,
      enrichment: completedOnly.steamHunters,
    })?.hasCommunityStats,
    false,
  );
});
