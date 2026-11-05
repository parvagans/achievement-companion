import test from "node:test";
import assert from "node:assert/strict";
import { loadDeckyDashboardState, loadDeckyGameDetailState, resetDeckyAppServicesForTests } from "../src/platform/decky/decky-app-services";
import { readDeckyDashboardSnapshotState, writeDeckyDashboardSnapshot } from "../src/platform/decky/decky-dashboard-snapshot-cache";
import type { DashboardSnapshot } from "../src/core/domain";
import { loadDeckyGamePageAchievementSummary, clearDeckyGamePageAchievementSummaryCacheForTests } from "../src/platform/decky/decky-game-page-achievement-summary";
import { readDeckySteamGameDetailCacheEntry, writeDeckySteamGameDetail } from "../src/platform/decky/decky-steam-game-detail-cache";
import { updateDeckyProviderConfigCache, clearDeckyProviderConfigCache } from "../src/platform/decky/providers/provider-config-store";
import { setDeckyBackendCallImplementationForTests } from "../src/platform/decky/decky-backend-bridge";
import { advanceDeckyAccountRevision } from "../src/platform/decky/decky-account-revision";
import { loadLocalComponent } from "./helpers/render-decky-component";

function storage(): Storage {
  const entries = new Map<string, string>();
  return { get length() { return entries.size; }, key: i => [...entries.keys()][i] ?? null,
    getItem: k => entries.get(k) ?? null, setItem: (k, v) => { entries.set(k, v); },
    removeItem: k => { entries.delete(k); }, clear: () => entries.clear() };
}
const config = (steamId64 = "76561198000000001") => ({ steamId64, hasApiKey: true, language: "english", recentlyPlayedCount: 5, recentAchievementsCount: 5 });

async function fixture(run: (f: { offline: boolean; unlocked: number; requests: string[]; restart: () => void }) => Promise<void>) {
  const local = globalThis.localStorage, session = globalThis.sessionStorage;
  globalThis.localStorage = storage(); globalThis.sessionStorage = storage();
  const f = { offline: false, unlocked: 1, requests: [] as string[], restart() {
    resetDeckyAppServicesForTests(); clearDeckyGamePageAchievementSummaryCacheForTests();
  } };
  f.restart(); updateDeckyProviderConfigCache("steam", config());
  setDeckyBackendCallImplementationForTests(async (method, payload) => {
    if (method === "get_provider_configs") return { version: 1, steam: config() };
    if (method === "record_diagnostic_event") return true;
    if (method === "get_steam_shortcut_metadata") return null;
    const path = (payload as { path?: string })?.path ?? method;
    f.requests.push(path);
    if (f.offline) throw new TypeError("Network is offline");
    if (path === "IPlayerService/GetRecentlyPlayedGames/v1/" || path === "IPlayerService/GetOwnedGames/v1/") return { response: { game_count: 0, games: [] } };
    if (path === "ISteamUserStats/GetPlayerAchievements/v1/") return { playerstats: { success: true, gameName: "Fixture Game", achievements: [
      { apiname: "ONE", achieved: f.unlocked >= 1 ? 1 : 0, unlocktime: 1700000000 },
      { apiname: "TWO", achieved: f.unlocked >= 2 ? 1 : 0, unlocktime: f.unlocked >= 2 ? 1700000001 : 0 },
    ] } };
    if (path === "ISteamUserStats/GetSchemaForGame/v2/") return { game: { gameName: "Fixture Game", availableGameStats: { achievements: [
      { name: "ONE", displayName: "First", description: "First goal" }, { name: "TWO", displayName: "Second", description: "Second goal" },
    ] } } };
    if (path === "ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/") return { achievementpercentages: { achievements: [] } };
    throw new Error(`Unexpected fixture request: ${method} ${path}`);
  });
  try { await run(f); } finally {
    f.restart(); clearDeckyProviderConfigCache("steam");
    setDeckyBackendCallImplementationForTests(undefined);
    globalThis.localStorage = local; globalThis.sessionStorage = session;
  }
}

test("Steam detail loaded online restores from durable storage after restart; badge accepts stale data without dashboard/scan", async () => fixture(async f => {
  const online = await loadDeckyGameDetailState("steam", "42");
  assert.equal(online.status, "success");
  assert.equal(online.data?.achievements.length, 2);
  const stored = readDeckySteamGameDetailCacheEntry("42");
  assert.ok(stored);
  f.restart(); f.offline = true;
  const detail = await loadDeckyGameDetailState("steam", "42");
  assert.equal(detail.status, "stale"); assert.ok(detail.error);
  assert.equal(detail.data?.game.summary.unlockedCount, 1);
  assert.equal(detail.lastUpdatedAt, stored.storedAt);
  const badge = await loadDeckyGamePageAchievementSummary("42");
  assert.equal(badge.status, "ready");
  if (badge.status !== "ready") return;
  assert.equal(badge.earned, 1); assert.equal(badge.total, 2);
  assert.equal(badge.source, "cache"); assert.equal(badge.updatedAt, new Date(stored.storedAt).toISOString());
  const fromBadge = await loadDeckyGameDetailState(badge.provider, badge.gameId!);
  assert.equal(fromBadge.status, "stale"); assert.equal(fromBadge.data?.achievements.length, 2);
  assert.equal(readDeckySteamGameDetailCacheEntry("42")?.storedAt, stored.storedAt);
}));

test("cold Steam config hydration does not miss the account-owned durable detail on the first offline page", async () => fixture(async f => {
  const online = await loadDeckyGameDetailState("steam", "43"); assert.equal(online.status, "success");
  f.restart(); clearDeckyProviderConfigCache("steam"); f.offline = true;
  const restored = await loadDeckyGameDetailState("steam", "43");
  assert.equal(restored.status, "stale"); assert.equal(restored.data?.game.gameId, "43");
}));

test("a never-loaded offline game has no invented badge or achievements", async () => fixture(async f => {
  f.offline = true;
  const detail = await loadDeckyGameDetailState("steam", "44");
  assert.equal(detail.status, "error"); assert.equal(detail.data, undefined);
  assert.notEqual((await loadDeckyGamePageAchievementSummary("44")).status, "ready");
  assert.equal(readDeckySteamGameDetailCacheEntry("44"), undefined);
}));

test("Steam reconnect refresh replaces last-known-good progress; account B cannot read A for the same AppID", async () => fixture(async f => {
  const online = await loadDeckyGameDetailState("steam", "45"); assert.equal(online.status, "success");
  f.restart(); f.offline = true;
  assert.equal((await loadDeckyGameDetailState("steam", "45")).status, "stale");
  f.offline = false; f.unlocked = 2;
  const fresh = await loadDeckyGameDetailState("steam", "45", { forceRefresh: true });
  assert.equal(fresh.status, "success"); assert.equal(fresh.isStale, false);
  assert.equal(fresh.data?.game.summary.unlockedCount, 2);
  clearDeckyGamePageAchievementSummaryCacheForTests();
  assert.equal((await loadDeckyGamePageAchievementSummary("45")).earned, 2);
  advanceDeckyAccountRevision("steam"); updateDeckyProviderConfigCache("steam", config("76561198000000002"));
  f.offline = true;
  assert.equal(readDeckySteamGameDetailCacheEntry("45"), undefined);
  assert.equal((await loadDeckyGameDetailState("steam", "45")).data, undefined);
  assert.notEqual((await loadDeckyGamePageAchievementSummary("45")).status, "ready");
  assert.equal(writeDeckySteamGameDetail(fresh.data!), false);
}));

test("Steam badge memory hits expire after 30 seconds without losing the durable offline snapshot", async t => fixture(async f => {
  let now = Date.now(); t.mock.method(Date, "now", () => now);
  const first = await loadDeckyGamePageAchievementSummary("46"); assert.equal(first.status, "ready");
  const storedAt = readDeckySteamGameDetailCacheEntry("46")!.storedAt;
  const requests = f.requests.length; f.offline = true; now += 29_000;
  assert.deepEqual(await loadDeckyGamePageAchievementSummary("46"), first);
  assert.equal(f.requests.length, requests, "30-second memory hit makes no provider request");
  now += 24 * 60 * 60_000;
  const expired = await loadDeckyGamePageAchievementSummary("46");
  assert.equal(expired.status, "ready");
  assert.equal(expired.source, "cache");
  assert.ok(f.requests.length > requests, "expired detail still attempts the normal refresh");
  assert.equal(readDeckySteamGameDetailCacheEntry("46")!.storedAt, storedAt);
}));

test("a fresh memory read and optional enrichment do not advance the Steam verification timestamp", async t => fixture(async () => {
  let now = Date.now(); t.mock.method(Date, "now", () => now);
  const first = await loadDeckyGameDetailState("steam", "47"); assert.equal(first.status, "success");
  const storedAt = readDeckySteamGameDetailCacheEntry("47")!.storedAt;
  now += 5_000;
  const memory = await loadDeckyGameDetailState("steam", "47", { forceRefresh: false });
  assert.equal(memory.lastUpdatedAt, first.lastUpdatedAt);
  assert.equal(readDeckySteamGameDetailCacheEntry("47")!.storedAt, storedAt);
  assert.ok(writeDeckySteamGameDetail(memory.data!));
  assert.equal(readDeckySteamGameDetailCacheEntry("47")!.storedAt, storedAt);
}));

test("RA in-progress badge completion enrichment retains verified stale detail, as mastered badges already do", async () => {
  const detail = { status: "stale", isStale: true, isRefreshing: false,
    lastUpdatedAt: 1700000000000, error: { kind: "network", userMessage: "Offline", retryable: true },
    data: { game: { providerId: "retroachievements", gameId: "7", title: "RA game", status: "in_progress", metrics: [], summary: { unlockedCount: 1, totalCount: 2 } }, achievements: [] } };
  const summaryModule = loadLocalComponent("src/platform/decky/decky-game-page-achievement-summary.ts", {
    "./decky-app-services": { loadDeckyGameDetailState: async () => detail },
  });
  const summary = { status: "ready", appId: "3000000000", provider: "retroachievements", gameId: "7", earned: 1, total: 2, source: "cache", updatedAt: new Date(detail.lastUpdatedAt).toISOString() };
  const result = await summaryModule.exports.enrichDeckyGamePageAchievementSummaryCompletionStatus(summary);
  assert.equal(result.status, "ready"); assert.equal(result.completionStatus, "in-progress");
  assert.equal(result.updatedAt, summary.updatedAt);
});

test("cold native Steam badge hydrates saved settings before deciding that a provider is unconfigured", async () => fixture(async f => {
  assert.equal((await loadDeckyGameDetailState("steam", "48")).status, "success");
  f.restart(); clearDeckyProviderConfigCache("steam"); f.offline = true;
  const badge = await loadDeckyGamePageAchievementSummary("48");
  assert.equal(badge.status, "ready");
  assert.equal(badge.source, "cache");
}));

function savedSteamDashboard(): DashboardSnapshot {
  return { profile: { providerId: "steam", identity: { accountId: config().steamId64, displayName: "Fixture account" },
    summary: { unlockedCount: 1, totalCount: 2 }, metrics: [] }, recentlyPlayedGames: [], recentUnlocks: [] } as unknown as DashboardSnapshot;
}

test("cold QAM forced refresh failure retains the owned durable Steam dashboard", async () => fixture(async f => {
  assert.ok(writeDeckyDashboardSnapshot(savedSteamDashboard()));
  const saved = readDeckyDashboardSnapshotState("steam")!;
  f.restart(); clearDeckyProviderConfigCache("steam"); f.offline = true;
  const state = await loadDeckyDashboardState("steam", { forceRefresh: true });
  assert.equal(state.status, "stale"); assert.ok(state.error);
  assert.deepEqual(state.data, saved.data); assert.equal(state.lastUpdatedAt, saved.lastUpdatedAt);
  assert.equal(readDeckyDashboardSnapshotState("steam")?.lastUpdatedAt, saved.lastUpdatedAt);
}));

test("Steam dashboard durable fallback cannot show another account in either refresh mode", async () => fixture(async f => {
  updateDeckyProviderConfigCache("steam", config("76561198000000002"));
  // Isolated retained-disk fixture: never mutate a real account to induce this case.
  assert.ok(writeDeckyDashboardSnapshot(savedSteamDashboard())); f.offline = true;
  assert.equal((await loadDeckyDashboardState("steam", { forceRefresh: true })).data, undefined);
  assert.equal((await loadDeckyDashboardState("steam", { forceRefresh: false })).data, undefined);
}));

test("RA full detail restores backend-owned stale progress after frontend restart and refreshes on reconnect", async t => fixture(async () => {
  let offline = false, account = "alice", unlocked = 1;
  let now = Date.now(), fetchedAt = now;
  t.mock.method(Date, "now", () => now);
  const saved = new Map<string, unknown>();
  const requests: string[] = [];
  updateDeckyProviderConfigCache("retroachievements", { username: account, hasApiKey: true });
  setDeckyBackendCallImplementationForTests(async (method, payload) => {
    if (method === "record_diagnostic_event") return true;
    if (method !== "request_retroachievements_json") throw new Error(`Unexpected ${method}`);
    const request = payload as { path: string; query: { g: string } };
    assert.equal(request.path, "API_GetGameInfoAndUserProgress.php");
    const key = `${account}:${request.query.g}`; requests.push(key);
    if (offline) {
      if (!saved.has(key)) throw new TypeError("Offline with no owned resource");
      return { raResource: 1, resourceKey: key, payload: saved.get(key), cacheState: "stale", fetchedAt,
        freshUntil: fetchedAt, error: { message: "Offline", statusCode: 503 } };
    }
    const response = { ID: request.query.g, Title: "RA fixture", ConsoleName: "NES", NumAchievements: 2,
      NumAwardedToUser: unlocked, Achievements: {
        "1": { ID: 1, Title: "First", Description: "First", Points: 5, DateEarned: "2023-11-14 00:00:00" },
        "2": { ID: 2, Title: "Second", Description: "Second", Points: 5, ...(unlocked === 2 ? { DateEarned: "2023-11-15 00:00:00" } : {}) },
      } };
    saved.set(key, response);
    fetchedAt = now;
    return { raResource: 1, resourceKey: key, payload: response, cacheState: "live", fetchedAt, freshUntil: fetchedAt + 900000 };
  });
  try {
    const online = await loadDeckyGameDetailState("retroachievements", "7");
    assert.equal(online.status, "success"); assert.equal(online.data?.achievements.length, 2);
    resetDeckyAppServicesForTests(); offline = true; now += 24 * 60 * 60_000;
    const stale = await loadDeckyGameDetailState("retroachievements", "7");
    assert.equal(stale.status, "stale"); assert.equal(stale.isStale, true); assert.ok(stale.error);
    assert.equal(stale.lastUpdatedAt, fetchedAt); assert.equal(stale.data?.game.summary.unlockedCount, 1);
    assert.equal((await loadDeckyGameDetailState("retroachievements", "8")).data, undefined);
    offline = false; unlocked = 2;
    const fresh = await loadDeckyGameDetailState("retroachievements", "7", { forceRefresh: true });
    assert.equal(fresh.status, "success"); assert.equal(fresh.isStale, false);
    assert.equal(fresh.data?.game.summary.unlockedCount, 2); assert.ok(fresh.lastUpdatedAt! > stale.lastUpdatedAt!);
    advanceDeckyAccountRevision("retroachievements"); account = "bob";
    updateDeckyProviderConfigCache("retroachievements", { username: account, hasApiKey: true }); offline = true;
    assert.equal((await loadDeckyGameDetailState("retroachievements", "7")).data, undefined);
    assert.deepEqual(requests, ["alice:7", "alice:7", "alice:8", "alice:7", "bob:7"]);
  } finally { clearDeckyProviderConfigCache("retroachievements"); }
}));
