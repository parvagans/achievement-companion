import assert from "node:assert/strict";
import test from "node:test";
import type { ResourceState } from "../src/core/cache";
import type { GameDetailSnapshot, NormalizedAchievement } from "../src/core/domain";
import {
  createNativeRetroAchievementsProjectionLoader,
  type NativeRetroAchievementsProjectionDependencies,
} from "../src/platform/decky/decky-native-retroachievements-projection";
import type { GamePageAchievementSummary } from "../src/platform/decky/decky-game-page-achievement-summary";
import type { DeckySteamShortcutMetadata } from "../src/platform/decky/decky-steam-shortcut-metadata";

const appId = "2874315920";
const raGameId = "12345";
const shortcut: DeckySteamShortcutMetadata = {
  appId,
  title: "Example ROM",
  platformTag: "SNES",
  exe: '"/usr/bin/retroarch"',
  startDir: '"/roms/SNES"',
};

const mappedSummary: GamePageAchievementSummary = {
  status: "ready",
  appId,
  provider: "retroachievements",
  gameId: raGameId,
  title: "Example ROM",
  earned: 2,
  total: 3,
  source: "backend",
};

function achievement(
  achievementId: string,
  extra: Partial<NormalizedAchievement> = {},
): NormalizedAchievement {
  return {
    providerId: "retroachievements",
    achievementId,
    gameId: raGameId,
    title: `Achievement ${achievementId}`,
    description: `Description ${achievementId}`,
    badgeImageUrl: `https://example.test/${achievementId}.png`,
    isUnlocked: false,
    metrics: [],
    ...extra,
  };
}

function detail(
  achievements: readonly NormalizedAchievement[] = [
    achievement("101", {
      title: "Hardcore Clear",
      isUnlocked: true,
      unlockedAt: 1_730_000_000_000,
      hardcoreUnlockedAt: 1_730_000_000_000,
      unlockMode: "hardcore",
      metrics: [{ key: "unlocked-count", label: "Unlocked", value: "25" }],
    }),
    achievement("102", {
      title: "Softcore Clear",
      isUnlocked: true,
      unlockedAt: 1_740_000_000_000,
      softcoreUnlockedAt: 1_740_000_000_000,
      unlockMode: "softcore",
    }),
    achievement("103", { title: "Locked" }),
  ],
): GameDetailSnapshot {
  return {
    game: {
      providerId: "retroachievements",
      gameId: raGameId,
      title: "Example ROM",
      status: "in_progress",
      summary: { unlockedCount: 2, totalCount: achievements.length },
      metrics: [{ key: "total-players", label: "Players", value: "100" }],
    },
    achievements,
    refreshedAt: 1_750_000_000_000,
  };
}

function successState(snapshot = detail()): ResourceState<GameDetailSnapshot> {
  return {
    status: "success",
    data: snapshot,
    isStale: false,
    isRefreshing: false,
  };
}

function createHarness(overrides: Partial<NativeRetroAchievementsProjectionDependencies> = {}) {
  const calls = {
    metadata: [] as string[],
    summary: [] as string[],
    detail: [] as { gameId: string; forceRefresh: boolean }[],
    invalidated: [] as string[],
  };
  const dependencies: NativeRetroAchievementsProjectionDependencies = {
    async loadShortcutMetadata(id) {
      calls.metadata.push(id);
      return id === appId ? shortcut : undefined;
    },
    async loadSummary(id) {
      calls.summary.push(id);
      return mappedSummary;
    },
    async loadDetail(gameId, options) {
      calls.detail.push({ gameId, forceRefresh: options.forceRefresh });
      return successState();
    },
    invalidateSummary(id) {
      calls.invalidated.push(id);
    },
    ...overrides,
  };
  return { loader: createNativeRetroAchievementsProjectionLoader(dependencies), calls };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test("explicit shortcut metadata gates native RA projection before the shared resolver", async () => {
  const { loader, calls } = createHarness();
  const result = await loader.load("570", "both");
  assert.deepEqual(result, { status: "unavailable", appId: "570", reason: "not-shortcut" });
  assert.deepEqual(calls.summary, []);
  assert.deepEqual(calls.detail, []);
  assert.equal(loader.read("570", "both"), undefined);
});

test("mapped detail preserves RA identities and mode-projected row state", async () => {
  const { loader, calls } = createHarness();
  const both = await loader.load(appId, "both");
  assert.equal(both.status, "ready");
  if (both.status !== "ready") return;
  assert.equal(both.raGameId, raGameId);
  assert.equal(both.earned, 2);
  assert.equal(both.total, 3);
  assert.equal(both.totalPlayers, 100);
  assert.deepEqual(both.achievements.map((row) => row.achievementId), ["101", "102", "103"]);
  assert.equal(both.achievements[0]?.title, "Hardcore Clear");
  assert.equal(both.achievements[0]?.description, "Description 101");
  assert.equal(both.achievements[0]?.badgeImageUrl, "https://example.test/101.png");
  assert.equal(both.achievements[0]?.unlockedAt, 1_730_000_000_000);
  assert.equal(loader.read(appId, "both"), both);

  const hardcore = await loader.load(appId, "hardcore");
  assert.equal(hardcore.status, "ready");
  if (hardcore.status !== "ready") return;
  assert.equal(hardcore.earned, 1);
  assert.deepEqual(hardcore.achievements.map((row) => row.isUnlocked), [true, false, false]);
  assert.equal(hardcore.achievements[1]?.unlockedAt, undefined);
  assert.equal(loader.read(appId, "both"), undefined);

  const softcore = await loader.load(appId, "softcore");
  assert.equal(softcore.status, "ready");
  if (softcore.status !== "ready") return;
  assert.equal(softcore.earned, 1);
  assert.deepEqual(softcore.achievements.map((row) => row.isUnlocked), [false, true, false]);
  assert.equal(softcore.achievements[0]?.unlockedAt, undefined);
  assert.deepEqual(calls.summary, [appId, appId, appId]);
});

test("loading, ambiguous, unavailable, error, and Steam summaries never publish rows", async () => {
  const summaries: GamePageAchievementSummary[] = [
    { status: "loading", appId },
    { status: "unavailable", appId, reason: "ambiguous-retroachievements-shortcut-mapping" },
    { status: "unavailable", appId, reason: "rom-path-unavailable" },
    { status: "error", appId, message: "network failure" },
    { status: "ready", appId, provider: "steam", earned: 4, total: 10, source: "backend" },
  ];
  for (const summary of summaries) {
    const { loader, calls } = createHarness({ async loadSummary() { return summary; } });
    const result = await loader.load(appId, "both");
    assert.equal(result.status, "unavailable");
    assert.equal(loader.read(appId, "both"), undefined);
    assert.deepEqual(calls.detail, []);
  }
});

test("failed, stale, empty, and invalid detail never create a false zero-achievement game", async () => {
  const states: ResourceState<GameDetailSnapshot>[] = [
    { status: "error", isStale: false, isRefreshing: false },
    { status: "stale", data: detail(), isStale: true, isRefreshing: false },
    successState(detail([])),
    successState(detail([achievement("101"), achievement("101")])),
    successState({ ...detail(), game: { ...detail().game, gameId: "other" } }),
  ];
  for (const state of states) {
    const { loader } = createHarness({ async loadDetail() { return state; } });
    const result = await loader.load(appId, "both");
    assert.equal(result.status, "unavailable");
    assert.equal(loader.read(appId, "both"), undefined);
  }
});

test("per-app cache prevents late game A data from appearing under game B", async () => {
  const firstSummary = deferred<GamePageAchievementSummary>();
  const secondAppId = "2874315921";
  const { loader } = createHarness({
    async loadShortcutMetadata(id) { return { ...shortcut, appId: id, title: id }; },
    async loadSummary(id) { return id === appId ? firstSummary.promise : { ...mappedSummary, appId: id }; },
  });
  const a = loader.load(appId, "both");
  const b = loader.load(secondAppId, "both");
  const bResult = await b;
  assert.equal(bResult.status, "ready");
  assert.equal(loader.read(appId, "both"), undefined);
  firstSummary.resolve(mappedSummary);
  const aResult = await a;
  assert.equal(aResult.status, "ready");
  assert.equal(loader.read(appId, "both")?.appId, appId);
  assert.equal(loader.read(secondAppId, "both")?.appId, secondAppId);
});

test("invalidation and mode changes discard late detail responses", async () => {
  for (const invalidate of ["refresh", "mode", "dispose"] as const) {
    const pendingDetail = deferred<ResourceState<GameDetailSnapshot>>();
    const { loader } = createHarness({ async loadDetail() { return pendingDetail.promise; } });
    const oldRequest = loader.load(appId, "both");
    await Promise.resolve();
    await Promise.resolve();
    if (invalidate === "refresh") loader.invalidate(appId);
    if (invalidate === "mode") void loader.load(appId, "hardcore");
    if (invalidate === "dispose") loader.dispose();
    pendingDetail.resolve(successState());
    const oldResult = await oldRequest;
    assert.deepEqual(oldResult, { status: "unavailable", appId, reason: "stale-request" });
    assert.equal(loader.read(appId, "both"), undefined);
  }
});

test("force refresh clears shared summary mapping cache and reloads detail", async () => {
  const { loader, calls } = createHarness();
  assert.equal((await loader.load(appId, "both")).status, "ready");
  assert.equal((await loader.load(appId, "both")).status, "ready");
  assert.equal(calls.summary.length, 1);
  assert.equal((await loader.load(appId, "both", { forceRefresh: true })).status, "ready");
  assert.deepEqual(calls.invalidated, [appId, appId]);
  assert.deepEqual(calls.detail.map((call) => call.forceRefresh), [false, true]);
  loader.invalidate(appId);
  assert.equal((await loader.load(appId, "both")).status, "ready");
  assert.deepEqual(calls.detail.map((call) => call.forceRefresh), [false, true, true]);
});

test("shortcut path changes invalidate mapping and a mid-request edit blocks publication", async () => {
  let currentShortcut = shortcut;
  const { loader, calls } = createHarness({ async loadShortcutMetadata() { return currentShortcut; } });
  assert.equal((await loader.load(appId, "both")).status, "ready");
  currentShortcut = { ...shortcut, exe: '"/different/rom"' };
  assert.equal((await loader.load(appId, "both")).status, "ready");
  assert.deepEqual(calls.invalidated, [appId, appId]);

  const pendingDetail = deferred<ResourceState<GameDetailSnapshot>>();
  const race = createHarness({
    async loadShortcutMetadata() { return currentShortcut; },
    async loadDetail() { return pendingDetail.promise; },
  });
  const request = race.loader.load(appId, "both");
  await Promise.resolve();
  await Promise.resolve();
  currentShortcut = { ...shortcut, exe: '"/another/rom"' };
  pendingDetail.resolve(successState());
  assert.deepEqual(await request, { status: "unavailable", appId, reason: "stale-request" });
  assert.equal(race.loader.read(appId, "both"), undefined);
});

test("shortcut display-name changes preserve cached RA identity", async () => {
  let currentShortcut = shortcut;
  const { loader, calls } = createHarness({ async loadShortcutMetadata() { return currentShortcut; } });
  const first = await loader.load(appId, "both");
  assert.equal(first.status, "ready");
  for (const title of ["Wrong Name", "abcdef", "Completely Unrelated Title", ""]) {
    currentShortcut = { ...shortcut, title };
    assert.strictEqual(await loader.load(appId, "both"), first);
  }
  assert.equal(calls.summary.length, 1);
  assert.equal(calls.detail.length, 1);
  assert.deepEqual(calls.invalidated, [appId]);
});
