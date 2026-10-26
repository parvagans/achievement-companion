import assert from "node:assert/strict";
import test from "node:test";
import type { NormalizedAchievement } from "../src/core/domain";
import {
  getSupportedFullScreenAchievementSorts,
  matchesFullScreenAchievementSearch,
  sortFullScreenAchievements,
} from "../src/platform/decky/decky-full-screen-achievement-browser-model";

function achievement(
  achievementId: string,
  title: string,
  overrides: Partial<NormalizedAchievement> = {},
): NormalizedAchievement {
  return {
    providerId: "retroachievements",
    achievementId,
    gameId: "100",
    title,
    isUnlocked: false,
    metrics: [],
    ...overrides,
  };
}

test("full-screen achievement search composes title and description case-insensitively", () => {
  const row = achievement("chapter", "Chapter Two", { description: "Complete the portal speedrun." });
  assert.equal(matchesFullScreenAchievementSearch(row, " CHAPTER "), true);
  assert.equal(matchesFullScreenAchievementSearch(row, "portal speedrun"), true);
  assert.equal(matchesFullScreenAchievementSearch(row, "companion cube"), false);
});

test("full-screen achievement sorting shares stable missing-last semantics", () => {
  const rows = [
    achievement("bravo", "Bravo", { points: 5, unlockedAt: 200, metrics: [{ key: "unlock-rate", label: "Unlock Rate", value: "30" }] }),
    achievement("missing", "Missing"),
    achievement("alpha-10", "Alpha 10", { points: 20, unlockedAt: 400, metrics: [{ key: "unlock-rate", label: "Unlock Rate", value: "5" }] }),
    achievement("alpha-2", "Alpha 2", { points: 20, unlockedAt: 300, metrics: [{ key: "unlock-rate", label: "Unlock Rate", value: "5" }] }),
  ];
  const ids = (sort: Parameters<typeof sortFullScreenAchievements>[1]) =>
    sortFullScreenAchievements(rows, sort, [], "all").map(({ achievementId }) => achievementId);
  assert.strictEqual(sortFullScreenAchievements(rows, "default", [], "all"), rows);
  assert.deepEqual(ids("name-asc"), ["alpha-2", "alpha-10", "bravo", "missing"]);
  assert.deepEqual(ids("points-desc"), ["alpha-10", "alpha-2", "bravo", "missing"]);
  assert.deepEqual(ids("recently-unlocked"), ["alpha-10", "alpha-2", "bravo", "missing"]);
  assert.equal(getSupportedFullScreenAchievementSorts(rows, [], "all").includes("points-desc"), true);
  assert.equal(getSupportedFullScreenAchievementSorts(rows, [], "all").includes("recently-unlocked"), true);
});

test("full-screen Steam sorting exposes points only when SteamHunters provides them", () => {
  const rows = [achievement("steam-one", "One", {
    providerId: "steam",
    gameId: "123",
    metrics: [{ key: "global-percent", label: "Global Unlock Rate", value: "25" }],
  })];
  assert.equal(getSupportedFullScreenAchievementSorts(rows, [], "all").includes("points-desc"), false);
  assert.equal(getSupportedFullScreenAchievementSorts(rows, [], "all", {
    "steam-one": { apiName: "steam-one", points: 12, obtainability: "obtainable" },
  }).includes("points-desc"), true);
});
