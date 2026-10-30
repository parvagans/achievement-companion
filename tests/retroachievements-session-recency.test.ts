import assert from "node:assert/strict";
import test from "node:test";
import { createRaPresenceCoordinator, type RaObservedSession } from "../src/platform/decky/retroachievements-presence-coordinator";
import { getRetroAchievementsActiveGameId } from "../src/platform/decky/decky-retroachievements-current-game";
import { selectDeckyCompactUpNextCandidates } from "../src/platform/decky/decky-compact-up-next-model";
import { buildRetroAchievementsFullScreenProfileModel } from "../src/platform/decky/decky-retroachievements-full-screen-profile-data";
import { DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS } from "../src/core/settings";
import type { DashboardSnapshot, RecentlyPlayedGame } from "../src/core/domain";

const game = (id: string, title: string, lastPlayedAt?: number): RecentlyPlayedGame => ({ providerId: "retroachievements", gameId: id, title,
  summary: { unlockedCount: 1, totalCount: 10 }, ...(lastPlayedAt === undefined ? {} : { lastPlayedAt }) });
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function fixture(saved: readonly RaObservedSession[] = []) {
  let now = 1_800_000_000_000, revision = 1, id = 2, heartbeat = now, recentCalls = 0, summaryCalls = 0;
  let failure = false, stored = saved;
  const old = game("1", "StarCraft 64", now - 120000), jetpack = game("2", "Jetpack Joyride");
  const snapshot: DashboardSnapshot = { profile: { providerId: "retroachievements", identity: { providerId: "retroachievements", accountId: "a", displayName: "A" },
    summary: { unlockedCount: 90 }, metrics: [] }, recentlyPlayedGames: [old], featuredGames: [], recentAchievements: [], recentUnlocks: [] };
  const coordinator = createRaPresenceCoordinator({ revision: () => revision, now: () => now, read: () => undefined,
    loadSessions: async () => stored, saveSessions: (sessions) => { stored = sessions; },
    fetchRecent: async () => { recentCalls++; if (failure) throw { status: 429 }; return [old]; },
    fetch: async () => { summaryCalls++; return { raResource: 1, resourceKey: "summary", cacheState: "live", fetchedAt: now, freshUntil: now + 45000,
      payload: { LastGameID: id, RichPresenceMsgDate: id === 0 ? null : new Date(heartbeat).toISOString() } }; },
    schedule() { return 1; }, cancel() {},
  });
  coordinator.rememberGame(jetpack);
  return { coordinator, snapshot, jetpack, old, stored: () => stored, calls: () => ({ recent: recentCalls, summary: summaryCalls }),
    advance(ms: number) { now += ms; }, now: () => now, failure() { failure = true; }, account() { revision++; coordinator.reset(); },
    presence(next: number) { id = next; heartbeat = now; } };
}

for (const entry of ["qam-entry", "full-screen-entry"] as const) {
  test(`${entry}: Jetpack exit retains a newer observed session over cached StarCraft without duplicate entries`, async () => {
    const f = fixture(); await f.coordinator.ensure(entry);
    assert.equal(getRetroAchievementsActiveGameId(f.coordinator.project(f.snapshot).profile, f.now()), "2");
    f.advance(1000); f.coordinator.lifecycle("shortcut", false, "2"); await flush();
    const view = f.coordinator.project(f.snapshot);
    assert.equal(getRetroAchievementsActiveGameId(view.profile, f.now()), undefined);
    assert.deepEqual(view.recentlyPlayedGames.map((game) => game.gameId), ["2", "1"]);
    assert.equal(view.recentlyPlayedGames[0]?.lastPlayedAt, undefined, "no fabricated provider timestamp");
    assert.equal(view.recentlyPlayedGames[0]?.observedSessionAt, f.now() - 1000);
    assert.equal(selectDeckyCompactUpNextCandidates({ providerId: "retroachievements", games: view.recentlyPlayedGames })[0]?.gameId, "2");
    assert.equal(buildRetroAchievementsFullScreenProfileModel({ snapshot: view, settings: DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS }).recentGames[0]?.game.gameId, "2");
    assert.equal(f.calls().recent, 1);
    for (let n = 0; n < 5; n++) { f.coordinator.project(f.snapshot); await f.coordinator.ensure(entry); }
    assert.equal(f.calls().recent, 1, "navigation does not force Recently Played again");
    assert.equal(view.profile.summary, f.snapshot.profile.summary);
    assert.deepEqual(f.snapshot.recentlyPlayedGames, [f.old], "retained dashboard remains immutable");
  });
}
test("authoritative LastPlayed reconciles the observation; newer remote activity legitimately takes priority", async () => {
  const f = fixture(); await f.coordinator.ensure("qam-entry"); f.advance(1000);
  f.coordinator.lifecycle("shortcut", false, "2"); await flush();
  const remote = game("3", "Another device", f.now() + 1);
  f.coordinator.updateRecent([remote, { ...f.jetpack, lastPlayedAt: f.now() }, f.old]);
  const view = f.coordinator.project(f.snapshot);
  assert.deepEqual(view.recentlyPlayedGames.map((entry) => entry.gameId), ["3", "2", "1"]);
  assert.equal(view.recentlyPlayedGames[1]?.observedSessionAt, undefined);
  assert.equal(new Set(view.recentlyPlayedGames.map((entry) => entry.gameId)).size, 3);
});
test("429 or Recently Played failure retains the observed session and never retries from repeated projections", async () => {
  const f = fixture(); f.failure(); await f.coordinator.ensure("qam-entry"); f.advance(1000);
  f.coordinator.lifecycle("shortcut", false, "2"); await flush();
  for (let n = 0; n < 20; n++) assert.equal(f.coordinator.project(f.snapshot).recentlyPlayedGames[0]?.gameId, "2");
  assert.equal(f.calls().recent, 1);
});
test("plugin restart restores session ordering and old-heartbeat exit suppression from bounded account-scoped evidence", async () => {
  const first = fixture(); await first.coordinator.ensure("qam-entry"); first.advance(1000);
  first.coordinator.lifecycle("shortcut", false, "2"); await flush();
  const second = fixture(first.stored()); await second.coordinator.ensure("full-screen-entry");
  const view = second.coordinator.project(second.snapshot);
  assert.equal(getRetroAchievementsActiveGameId(view.profile, second.now()), undefined);
  assert.equal(view.recentlyPlayedGames[0]?.gameId, "2");
  assert.equal(second.calls().recent, 0, "restoring an ended session does not start another synchronization");
});
test("missing game metadata retains identity for a later canonical lookup and account switching removes observations", async () => {
  const f = fixture([{ gameId: "9", observedAt: 1_799_999_999_999, heartbeatAt: 1_799_999_999_000, endedAt: 1_800_000_000_000 }]);
  f.presence(0); await f.coordinator.ensure("qam-entry");
  assert.equal(f.coordinator.preferredGameId(f.snapshot), "9");
  assert.equal(f.coordinator.project(f.snapshot).recentlyPlayedGames[0]?.gameId, "1");
  f.coordinator.rememberGame(game("9", "Verified cached metadata"));
  assert.equal(f.coordinator.project(f.snapshot).recentlyPlayedGames[0]?.gameId, "9");
  f.account(); assert.equal(f.coordinator.observedSessions().length, 0);
  assert.equal(f.coordinator.project(f.snapshot).recentlyPlayedGames[0]?.gameId, "1");
});
test("same-emulator game switch and restart record separate transitions without overwriting user preference storage", async () => {
  const f = fixture(); const preferences = Object.freeze({ pinnedAchievementIds: ["a"], selectedAchievementId: "b", mode: "hardcore" });
  await f.coordinator.ensure("qam-entry"); f.advance(1000); f.presence(3);
  f.coordinator.rememberGame(game("3", "New ROM")); await f.coordinator.ensure("scheduled-validation", true); await flush();
  assert.equal(f.coordinator.project(f.snapshot).recentlyPlayedGames[0]?.gameId, "3");
  assert.equal(f.calls().recent, 1);
  f.advance(1000); f.coordinator.lifecycle("emulator", false, "3"); await flush();
  f.advance(1000); f.presence(3); await f.coordinator.ensure("scheduled-validation", true);
  assert.equal(getRetroAchievementsActiveGameId(f.coordinator.project(f.snapshot).profile, f.now()), "3");
  assert.equal(f.coordinator.observedSessions().find((entry) => entry.gameId === "3")?.endedAt, undefined);
  assert.deepEqual(preferences, { pinnedAchievementIds: ["a"], selectedAchievementId: "b", mode: "hardcore" });
});
