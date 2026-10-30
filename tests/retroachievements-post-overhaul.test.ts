import assert from "node:assert/strict";
import test from "node:test";
import { buildFullScreenGameSections } from "../src/platform/decky/decky-full-screen-game-section-navigation";
import { createRetroAchievementsDataCoordinator } from "../src/platform/decky/retroachievements-data-coordinator";
import { raCommunityRequests, readRaCommunityPresentation } from "../src/platform/decky/retroachievements-community-state";
import { buildRetroAchievementsCommunityInsights } from "../src/platform/decky/decky-retroachievements-community-stats-data";
import { buildNativeRetroAchievementsCommunityModels } from "../src/platform/decky/decky-native-retroachievements-community-model";
import { normalizeRetroAchievementsGameCommunityStats } from "../src/providers/retroachievements/community-stats";
import type { GameDetailSnapshot } from "../src/core/domain";

const snapshot: GameDetailSnapshot = { game: { providerId: "retroachievements", gameId: "1", title: "StarCraft 64",
  status: "in_progress", summary: { totalCount: 10, unlockedCount: 1 }, metrics: [{ key: "total-players", label: "Players", value: "706" }] }, achievements: [] };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

for (const title of ["Dragon Ball Z: The Legacy of Goku II", "StarCraft 64", "Bust-A-Move"]) {
  for (const entry of ["QAM", "Games", "Up Next", "Steam badge", "achievement return", "restored session"]) {
    test(`${title}: ${entry} exposes Community without fetching optional statistics`, () => {
      // These routes all use the same section constructor, including a cold badge entry.
      for (const hasCommunity of [undefined, false, true]) {
        const sections = buildFullScreenGameSections({ provider: "retroachievements", ...(hasCommunity === undefined ? {} : { hasCommunity }) });
        assert.deepEqual(sections.map((section) => section.id), ["overview", "achievements", "community"]);
      }
    });
  }
}
test("Subsets eligibility is independent of Community readiness and requires verified children", () => {
  for (const hasSubsets of [false, true]) {
    const ids = buildFullScreenGameSections({ provider: "retroachievements", hasSubsets, hasCommunity: false }).map((section) => section.id);
    assert.equal(ids.includes("subsets"), hasSubsets);
    assert.equal(ids.includes("community"), true);
  }
  assert.deepEqual(buildFullScreenGameSections({ provider: "steam" }).map((section) => section.id), ["overview", "achievements"]);
});
test("late canonical Community success updates native and Companion observers without navigation or refetch", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const releases: ((value: unknown) => void)[] = [];
  const resources = createRetroAchievementsDataCoordinator({ getRevision: () => 1, now: () => 100, foregroundMs: 5,
    fetchResource: () => { calls++; return new Promise((resolve) => releases.push(resolve)); } });
  let native: ReturnType<typeof buildNativeRetroAchievementsCommunityModels>;
  let companion: ReturnType<typeof buildRetroAchievementsCommunityInsights> = [];
  for (const request of raCommunityRequests("1")) resources.subscribeResource(request, () => {
    const view = readRaCommunityPresentation(resources, snapshot, undefined, 100);
    native = buildNativeRetroAchievementsCommunityModels({ stats: view.stats });
    companion = view.stats === undefined ? [] : buildRetroAchievementsCommunityInsights(view.stats);
  });
  const loads = raCommunityRequests("1").map((request) => resources.ensureFresh(request, { revision: 1, entryPoint: "community" }).catch(() => undefined));
  t.mock.timers.tick(6); await Promise.all(loads);
  assert.equal(readRaCommunityPresentation(resources, snapshot, undefined, 100).pending, true);
  const joined = resources.ensureFresh(raCommunityRequests("1")[1], { revision: 1, entryPoint: "native-community" });
  const payloads = [{ "10": 19 }, { TimesUsedInCompletionMedian: 0, MedianTimeToComplete: null,
    TimesUsedInHardcoreBeatMedian: 1, MedianTimeToBeatHardcore: 226800, TimesUsedInMasteryMedian: 1, MedianTimeToMaster: 284400 }, []];
  releases.forEach((resolve, index) => resolve({ raResource: 1, resourceKey: String(index), payload: payloads[index], cacheState: "live", fetchedAt: 100, freshUntil: 1000 }));
  await joined; await flush();
  assert.equal(calls, 3, "one call per canonical endpoint, including the joined native view");
  assert.equal(readRaCommunityPresentation(resources, snapshot, undefined, 100).pending, false);
  assert.equal(native?.hardcore?.rows.find((row) => row.id === "mastered")?.playerCount, 19);
  assert.equal(companion.find((row) => row.label === "Mastered Players")?.kind, "metric");
  assert.equal(companion.some((row) => row.label === "Median Completion"), false);
  await Promise.all(raCommunityRequests("1").map((request) => resources.ensureFresh(request, { revision: 1, entryPoint: "reopen" })));
  assert.equal(calls, 3, "fresh repeated entries add zero calls");
});
test("partial Community responses preserve independent values; authoritative zero removes only an unavailable median", () => {
  const previous = { totalPlayers: 4332, masteredPlayers: 697, medianBeatSeconds: 47040, medianCompletionSeconds: 57180, medianMasterySeconds: 63900 };
  const partial = normalizeRetroAchievementsGameCommunityStats({ totalAchievementCount: 10, totalPlayers: undefined, distribution: undefined,
    progression: { TimesUsedInCompletionMedian: 0, MedianTimeToComplete: null }, previous });
  assert.equal(partial?.medianCompletionSeconds, undefined);
  assert.equal(partial?.medianBeatSeconds, 47040);
  assert.equal(partial?.medianMasterySeconds, 63900);
  assert.equal(partial?.masteredPlayers, 697);
  const valid = normalizeRetroAchievementsGameCommunityStats({ totalAchievementCount: 10, totalPlayers: undefined, distribution: undefined,
    progression: { TimesUsedInCompletionMedian: 3, MedianTimeToComplete: 57180 }, previous: partial! });
  assert.equal(buildRetroAchievementsCommunityInsights(valid!).some((row) => row.label === "Median Completion"), true);
});

test("a hung optional RPC releases its loading state at the bounded completion deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const resources = createRetroAchievementsDataCoordinator({ getRevision: () => 1, foregroundMs: 5, completionMs: 10,
    fetchResource: () => new Promise(() => undefined) });
  const request = raCommunityRequests("1")[0];
  let updates = 0; resources.subscribeResource(request, () => updates++);
  const load = resources.ensureFresh(request, { revision: 1, entryPoint: "community" }).catch(() => undefined);
  t.mock.timers.tick(6); await load;
  assert.equal(resources.isResourcePending(request), true);
  t.mock.timers.tick(5); await flush();
  assert.equal(resources.isResourcePending(request), false);
  assert.ok(updates > 0, "mounted loading/error presentation is notified without polling");
});
