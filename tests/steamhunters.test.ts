import assert from "node:assert/strict";
import test from "node:test";
import type { GameDetailSnapshot, NormalizedAchievement } from "../src/core/domain";
import {
  composeSteamGameDetailWithSteamHunters,
  composeSteamGameDetailWithSteamHuntersWithinBudget,
  createSteamHuntersClient,
  createSteamHuntersService,
  hasMeaningfulSteamHuntersProfile,
  matchSteamAchievements,
  normalizeSteamHuntersAchievement,
  normalizeSteamHuntersAchievementGroups,
  normalizeSteamHuntersApp,
  normalizeSteamHuntersProfile,
  normalizeSteamHuntersObtainability,
  SteamHuntersRequestError,
  type SteamHuntersClient,
} from "../src/providers/steamhunters";
import { buildDeckySteamHuntersGameViewModel } from "../src/platform/decky/decky-steam-hunters-view-model";
import { getSteamFullscreenGameArtworkUrl } from "../src/platform/decky/decky-steam-game-artwork";
import {
  buildDeckySteamAchievementGroupSections,
  getDeckySteamAchievementGroupArtworkUrl,
  hasDeckySteamAchievementGroups,
  sortDeckySteamAchievementGroupAchievements,
} from "../src/platform/decky/decky-steam-achievement-groups-model";
import {
  formatSteamHuntersCompletionDuration,
  formatSteamHuntersPercentage,
  formatSteamHuntersPlayersUnlocked,
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
  await client.loadGroups(1672970);
  await client.loadProfile("76561198000000000");

  assert.deepEqual(requests.map((request) => request.url), [
    "https://example.test/api/apps/1672970",
    "https://example.test/api/apps/1672970/achievements",
    "https://example.test/api/GetAchievementGroups/v1?appid=1672970",
    "https://example.test/api/steam-users/76561198000000000",
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

test("SteamHunters profile normalization keeps only SteamHunters profile totals", () => {
  assert.deepEqual(normalizeSteamHuntersProfile({
    globalPointsRank: 132_902,
    achievementUnlockCountRank: 124_887,
    completedGameCountRank: 125_182,
    previousPointsRank: 132_818,
    previousAchievementUnlockCountRank: 124_802,
    previousCompletedGameCountRank: 125_093,
    points: 17_207,
    unrestrictedPoints: 16_904,
    agc: 61.4,
    agcObtainable: 64.7,
    startedGameCount: 187,
    appCount: 187,
    perfectGameCount: 23,
    completedGameCount: 38,
    achievementUnlockCount: 7_842,
    epicAchievementUnlockCount: 27,
    legendaryAchievementUnlockCount: 12,
  }), {
    globalPointsRank: 132_902,
    globalAchievementsRank: 124_887,
    globalCompletedGamesRank: 125_182,
    globalPointsRankTrend: "down",
    globalAchievementsRankTrend: "down",
    globalCompletedGamesRankTrend: "down",
    points: 17_207,
    unrestrictedPoints: 16_904,
    averageGameCompletion: 61.4,
    obtainableAverageGameCompletion: 64.7,
    startedGames: 187,
    trackedGames: 187,
    perfectedGames: 23,
    completedGames: 38,
    achievements: 7_842,
    epicAchievements: 27,
    legendaryAchievements: 12,
  });
  assert.equal(normalizeSteamHuntersProfile({ points: "17,207" }), undefined);
  assert.deepEqual(normalizeSteamHuntersProfile({ epicAchievementCount: 15 }), { epicAchievements: 15 });
  assert.deepEqual(normalizeSteamHuntersProfile({ epicCount: 15 }), { epicAchievements: 15 });
});

test("SteamHunters treats a zero-only profile as unavailable personal data", async () => {
  const normalized = normalizeSteamHuntersProfile({
    points: 0,
    achievementUnlockCount: 0,
    completedGameCount: 0,
    startedGameCount: 12,
    appCount: 12,
  });
  assert.equal(hasMeaningfulSteamHuntersProfile(normalized === undefined ? undefined : {
    steamId: "76561198000000000",
    ...normalized,
  }), false);

  let profileCalls = 0;
  const service = createSteamHuntersService({ client: {
    loadApp: async () => ({}),
    loadAchievements: async () => [],
    loadGroups: async () => [],
    loadProfile: async () => { profileCalls += 1; return {
      points: 0,
      achievementUnlockCount: 0,
      completedGameCount: 0,
      startedGameCount: 12,
      appCount: 12,
    }; },
  } });
  assert.equal(await service.loadProfile("76561198000000000"), undefined);
  assert.equal(await service.loadProfile("76561198000000000"), undefined);
  assert.equal(profileCalls, 1);
});

test("SteamHunters caches an unindexed profile separately from community game data", async () => {
  let profileCalls = 0;
  let appCalls = 0;
  const service = createSteamHuntersService({ client: {
    loadApp: async () => { appCalls += 1; return { appId: 42, achievementCount: 1 }; },
    loadAchievements: async () => [{ apiName: "WIN", points: 100 }],
    loadGroups: async () => ({ groups: [] }),
    loadProfile: async () => {
      profileCalls += 1;
      throw new SteamHuntersRequestError("Not Found", "steam-users/76561198000000000", "http", 404);
    },
  } });

  assert.equal(await service.loadProfile("76561198000000000"), undefined);
  service.clearProfileCache(); // A new QAM profile session refreshes found profiles only.
  assert.equal(await service.loadProfile("76561198000000000"), undefined);
  assert.equal(profileCalls, 1);
  assert.equal((await service.loadGameData(42))?.app.appId, 42);
  assert.equal(appCalls, 1);

  service.clearProfileCache({ includeUnavailable: true });
  assert.equal(await service.loadProfile("76561198000000000"), undefined);
  assert.equal(profileCalls, 2);
  assert.equal((await service.loadGameData(42))?.app.appId, 42);
  assert.equal(appCalls, 1);
});

test("SteamHunters leaves transient personal profile failures retryable", async () => {
  let profileCalls = 0;
  const service = createSteamHuntersService({ client: {
    loadApp: async () => ({}),
    loadAchievements: async () => [],
    loadGroups: async () => [],
    loadProfile: async () => {
      profileCalls += 1;
      if (profileCalls === 1) throw new Error("offline");
      return { points: 25, achievementUnlockCount: 1 };
    },
  } });

  await assert.rejects(() => service.loadProfile("76561198000000000"), /offline/u);
  assert.equal((await service.loadProfile("76561198000000000"))?.points, 25);
  assert.equal(profileCalls, 2);
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

test("SteamHunters normalization accepts grouped achievement metadata", () => {
  assert.deepEqual(normalizeSteamHuntersAchievementGroups({
    groups: [
      {
        achievementApiNames: [" API_ONE ", "API_TWO"],
        dlcAppId: 123,
        dlcAppName: " Creeping Winter ",
        name: " Update 1 ",
        releaseDate: "2021-09-22",
      },
      { achievementApiNames: [] },
    ],
  }), [
    {
      achievementApiNames: ["API_ONE", "API_TWO"],
      dlcAppId: 123,
      dlcAppName: "Creeping Winter",
      name: "Update 1",
      releaseDate: "2021-09-22",
    },
  ]);
  assert.deepEqual(normalizeSteamHuntersAchievementGroups([]), []);
});

test("SteamHunters percentage presentation is concise", () => {
  assert.equal(formatSteamHuntersPercentage(6.507072905331882), "6.5%");
  assert.equal(formatSteamHuntersPercentage(12), "12%");
});

test("SteamHunters player ratio presents unlocked and qualified counts", () => {
  assert.equal(formatSteamHuntersPlayersUnlocked(25, 200), "50 / 200");
  assert.equal(formatSteamHuntersPlayersUnlocked(undefined, 200), "—");
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
  let groupCalls = 0;
  const client: SteamHuntersClient = {
    async loadApp() {
      appCalls += 1;
      return { appId: 1672970, achievementCount: 1 };
    },
    async loadAchievements() {
      achievementCalls += 1;
      return [{ apiName: "API_ONE", obtainability: 0 }];
    },
    async loadGroups() {
      groupCalls += 1;
      return { groups: [{ achievementApiNames: ["API_ONE"] }] };
    },
    async loadProfile() {
      return {};
    },
  };
  const service = createSteamHuntersService({ client, cacheTtlMs: 60_000 });
  const [first, second] = await Promise.all([service.loadGameData(1672970), service.loadGameData(1672970)]);

  assert.deepEqual(first, second);
  assert.equal(appCalls, 1);
  assert.equal(achievementCalls, 1);
  assert.equal(groupCalls, 1);
  await service.loadGameData(1672970);
  assert.equal(appCalls, 1);
  assert.equal(achievementCalls, 1);
  assert.equal(groupCalls, 1);

  const unavailable = createSteamHuntersService({
    client: {
      loadApp: async () => { throw new Error("offline"); },
      loadAchievements: async () => [],
      loadGroups: async () => [],
      loadProfile: async () => ({}),
    },
  });
  assert.equal(await unavailable.loadGameData(1672970), undefined);

  const partial = createSteamHuntersService({
    client: {
      loadApp: async () => ({ appId: 1672970, achievementCount: 1 }),
      loadAchievements: async () => [{ apiName: "API_ONE" }],
      loadGroups: async () => { throw new Error("groups timed out"); },
      loadProfile: async () => ({}),
    },
  });
  const partialData = await partial.loadGameData(1672970);
  assert.equal(partialData?.achievementsAvailable, true);
  assert.equal(partialData?.groupsAvailable, false);
  assert.deepEqual(partialData?.groups, []);
});

test("SteamHunters composition preserves Steam truth and enriches only exact matches", () => {
  const snapshot = steamGameDetailSnapshot();
  const composed = composeSteamGameDetailWithSteamHunters(snapshot, {
    app: { appId: 1672970, achievementCount: 2, tags: [] },
    achievements: [
      { apiName: "API_ONE", points: 42, obtainability: "obtainable" },
      { apiName: "NOT_API_TWO", points: 99, obtainability: "unobtainable" },
    ],
    groups: [{ achievementApiNames: ["API_ONE"], dlcAppId: 123, dlcAppName: "Creeping Winter" }],
  });

  assert.equal(composed.game, snapshot.game);
  assert.equal(composed.achievements, snapshot.achievements);
  assert.deepEqual(composed.steamHunters?.achievementsBySteamAchievementId, {
    API_ONE: { apiName: "API_ONE", points: 42, obtainability: "obtainable" },
  });
  assert.deepEqual(composed.steamHunters?.achievementGroupsBySteamAchievementId, {
    API_ONE: { achievementApiNames: ["API_ONE"], dlcAppId: 123, dlcAppName: "Creeping Winter" },
  });
  assert.deepEqual(composed.steamHunters?.achievementGroups, [
    { achievementApiNames: ["API_ONE"], dlcAppId: 123, dlcAppName: "Creeping Winter" },
  ]);
  assert.equal(composeSteamGameDetailWithSteamHunters(snapshot, undefined), snapshot);
});

test("SteamHunters fills only missing Steam achievement descriptions and provides base art", () => {
  const snapshot = steamGameDetailSnapshot();
  const described = { ...snapshot, achievements: [
    { ...snapshot.achievements[0]!, description: "No description was returned for this achievement." },
    { ...snapshot.achievements[1]!, description: "Steam description" },
  ] };
  const composed = composeSteamGameDetailWithSteamHunters(described, {
    app: { appId: 1672970, tags: [] },
    achievements: [
      { apiName: "API_ONE", description: "SteamHunters description", obtainability: "obtainable" },
      { apiName: "API_TWO", description: "Different description", obtainability: "obtainable" },
    ],
    groups: [{ achievementApiNames: ["API_ONE"], bannerUrl: "https://example.test/base.jpg" }],
  });
  assert.equal(composed.achievements[0]?.description, "SteamHunters description");
  assert.equal(composed.achievements[1]?.description, "Steam description");
  assert.equal(composed.steamHunters?.achievementGroups[0]?.bannerUrl, "https://example.test/base.jpg");
});

test("Steam achievement groups retain base, DLC, update, and ungrouped achievements", () => {
  const achievements = [
    { ...steamAchievement("BASE_ONE"), isUnlocked: true },
    steamAchievement("BASE_TWO"),
    steamAchievement("DLC_ONE"),
    steamAchievement("UPDATE_ONE"),
    steamAchievement("UNGROUPED"),
  ];
  const sections = buildDeckySteamAchievementGroupSections({
    achievements,
    groups: [
      { achievementApiNames: ["BASE_ONE", "BASE_TWO"] },
      { achievementApiNames: ["DLC_ONE"], dlcAppId: 123, dlcAppName: "Creeping Winter", bannerUrl: "https://example.test/dlc.jpg" },
      { achievementApiNames: ["UPDATE_ONE"], name: "Anniversary Update" },
    ],
  });

  assert.deepEqual(sections.map((section) => ({
    kind: section.kind,
    title: section.title,
    artworkAppId: section.artworkAppId,
    achievementIds: section.achievements.map((achievement) => achievement.achievementId),
  })), [
    { kind: "base-game", title: "Base Game", artworkAppId: undefined, achievementIds: ["BASE_ONE", "BASE_TWO", "UNGROUPED"] },
    { kind: "dlc", title: "Creeping Winter", artworkAppId: 123, achievementIds: ["DLC_ONE"] },
    { kind: "update", title: "Anniversary Update", artworkAppId: undefined, achievementIds: ["UPDATE_ONE"] },
  ]);
  assert.equal(hasDeckySteamAchievementGroups(sections), true);
  assert.equal(hasDeckySteamAchievementGroups(buildDeckySteamAchievementGroupSections({ achievements, groups: [] })), false);
});

test("Steam Update groups use the parent's banner when SteamHunters supplies no group art", () => {
  const parentBanner = getSteamFullscreenGameArtworkUrl({ appid: 1672970 });
  assert.equal(parentBanner, "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1672970/header.jpg");
  assert.equal(getDeckySteamAchievementGroupArtworkUrl({ kind: "update" }, parentBanner), parentBanner);
  assert.equal(getDeckySteamAchievementGroupArtworkUrl({ kind: "update", bannerUrl: "https://example.test/update.jpg" }, parentBanner), "https://example.test/update.jpg");
  assert.equal(getDeckySteamAchievementGroupArtworkUrl({ kind: "dlc", artworkAppId: 1672984 }, parentBanner), "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1672984/header.jpg");
  assert.equal(getDeckySteamAchievementGroupArtworkUrl({ kind: "dlc", artworkAppId: 1672984, bannerUrl: "https://example.test/dlc.jpg" }, parentBanner), "https://example.test/dlc.jpg");
  assert.equal(getDeckySteamAchievementGroupArtworkUrl({ kind: "dlc" }, parentBanner), undefined);
});

test("Steam achievement group lists put the newest unlocked achievements first", () => {
  const achievements = [
    { ...steamAchievement("LOCKED_ONE"), isUnlocked: false },
    { ...steamAchievement("UNLOCKED_OLD"), isUnlocked: true, unlockedAt: 100 },
    { ...steamAchievement("UNLOCKED_NEW"), isUnlocked: true, unlockedAt: 300 },
    { ...steamAchievement("LOCKED_TWO"), isUnlocked: false },
    { ...steamAchievement("UNLOCKED_UNKNOWN"), isUnlocked: true },
  ];

  assert.deepEqual(
    sortDeckySteamAchievementGroupAchievements(achievements).map((achievement) => achievement.achievementId),
    ["UNLOCKED_NEW", "UNLOCKED_OLD", "UNLOCKED_UNKNOWN", "LOCKED_ONE", "LOCKED_TWO"],
  );
});

test("SteamHunters composition returns Steam data when enrichment exceeds its wait budget", async () => {
  const snapshot = steamGameDetailSnapshot();
  const service: SteamHuntersClient = {
    loadApp: async () => new Promise(() => {}),
    loadAchievements: async () => [],
    loadGroups: async () => [],
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
      playersBaseGameCompletedCount: 100,
      playersQualifiedCount: 500,
      medianCompletionTime: 5843,
      fastestCompletionTime: 1802,
      tags: [],
    },
    achievements: [
      { apiName: "API_ONE", points: 20, localPercentage: 75, obtainability: "conditionally-obtainable" },
      { apiName: "API_TWO", points: 30, localPercentage: 3, obtainability: "broken-but-obtainable" },
    ],
    groups: [],
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
    startedPlayers: 500,
    perfectedPlayers: 25,
    beatenPlayers: 100,
    medianCompletionMinutes: 5843,
    fastestCompletionMinutes: 1802,
    totalPlayers: 500,
  });
  assert.deepEqual(model?.rarityDistribution, {
    common: 1,
    uncommon: 0,
    rare: 0,
    veryRare: 1,
    total: 2,
  });
  assert.equal(model?.achievementSetMismatch, undefined);
  assert.deepEqual(buildDeckySteamHuntersGameViewModel({
    achievements: snapshot.achievements,
    enrichment: composed.steamHunters,
    totalAchievementCount: 3,
  })?.achievementSetMismatch, { steamCount: 3, steamHuntersCount: 2 });

  const partial = composeSteamGameDetailWithSteamHunters(snapshot, {
    app: { appId: 1672970, achievementCount: 2, points: 50, tags: [] },
    achievements: [{ apiName: "API_ONE", points: 20, obtainability: "unobtainable" }],
    groups: [],
  });
  const partialModel = buildDeckySteamHuntersGameViewModel({
    achievements: snapshot.achievements,
    enrichment: partial.steamHunters,
  });
  assert.equal(partialModel?.progressPoints, undefined);
  assert.equal(partialModel?.completionHealth.conditionalCount, undefined);
  assert.equal(partialModel?.rarityDistribution, undefined);

  const completedOnly = composeSteamGameDetailWithSteamHunters(snapshot, {
    app: { appId: 1672970, playersCompletedCount: 12, tags: [] },
    achievements: [],
    groups: [],
  });
  assert.equal(
    buildDeckySteamHuntersGameViewModel({
      achievements: snapshot.achievements,
      enrichment: completedOnly.steamHunters,
    })?.hasCommunityStats,
    false,
  );
});
