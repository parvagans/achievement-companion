import assert from "node:assert/strict";
import test from "node:test";
import type { GameDetailSnapshot } from "../src/core/domain";
import {
  buildSteamCompactAchievementListModel,
  getCompactAchievementUnlockTimestamp,
  getSupportedCompactAchievementSorts,
  matchesCompactAchievementSearch,
  normalizeCompactAchievementSearchText,
  sortCompactAchievementRows,
  type CompactAchievementRowViewModel,
} from "../src/platform/decky/decky-compact-achievement-model";
import { composeSteamGameDetailWithSteamHunters } from "../src/providers/steamhunters/compose-steam-game-detail";
import type { SteamHuntersGameData } from "../src/providers/steamhunters/types";

function row(
  achievementId: string,
  title: string,
  overrides: Partial<CompactAchievementRowViewModel> = {},
): CompactAchievementRowViewModel {
  const description = overrides.description;
  return {
    achievementId,
    title,
    ...(description !== undefined ? { description } : {}),
    isUnlocked: overrides.isUnlocked ?? false,
    statusText: overrides.statusText ?? "Locked",
    searchText: normalizeCompactAchievementSearchText(
      description === undefined ? title : `${title}\n${description}`,
    ),
    metadata: overrides.metadata ?? [],
    metadataPlacement: overrides.metadataPlacement ?? "rail",
    tone: overrides.tone ?? "locked",
    ...overrides,
  };
}

test("compact achievement search normalizes whitespace and matches titles or descriptions", () => {
  const target = row("portal", "Portal Scholar", {
    description: "Complete   Chapter 2 without taking damage.",
  });
  assert.equal(matchesCompactAchievementSearch(target, "  PORTAL "), true);
  assert.equal(matchesCompactAchievementSearch(target, "chapter 2"), true);
  assert.equal(matchesCompactAchievementSearch(target, "taking   damage"), true);
  assert.equal(matchesCompactAchievementSearch(target, ""), true);
  assert.equal(matchesCompactAchievementSearch(target, "speedrun"), false);
});

test("compact achievement sorting is stable and leaves missing metrics last", () => {
  const rows = [
    row("bravo", "Bravo", { rarityPercent: 30, pointsValue: 5 }),
    row("missing", "Missing"),
    row("alpha-high", "Alpha 10", { rarityPercent: 5, pointsValue: 20 }),
    row("alpha-low", "Alpha 2", { rarityPercent: 5, pointsValue: 20 }),
  ];

  assert.strictEqual(sortCompactAchievementRows(rows, "default"), rows);
  assert.deepEqual(sortCompactAchievementRows(rows, "name-asc").map(({ achievementId }) => achievementId), [
    "alpha-low", "alpha-high", "bravo", "missing",
  ]);
  assert.deepEqual(sortCompactAchievementRows(rows, "name-desc").map(({ achievementId }) => achievementId), [
    "missing", "bravo", "alpha-high", "alpha-low",
  ]);
  assert.deepEqual(sortCompactAchievementRows(rows, "rarity-asc").map(({ achievementId }) => achievementId), [
    "alpha-high", "alpha-low", "bravo", "missing",
  ]);
  assert.deepEqual(sortCompactAchievementRows(rows, "rarity-desc").map(({ achievementId }) => achievementId), [
    "bravo", "alpha-high", "alpha-low", "missing",
  ]);
  assert.deepEqual(sortCompactAchievementRows(rows, "points-desc").map(({ achievementId }) => achievementId), [
    "alpha-high", "alpha-low", "bravo", "missing",
  ]);
  assert.deepEqual(sortCompactAchievementRows(rows, "points-asc").map(({ achievementId }) => achievementId), [
    "bravo", "alpha-high", "alpha-low", "missing",
  ]);
});

test("recently unlocked sorting uses the selected RetroAchievements mode timestamp", () => {
  const rows = [
    row("first", "First", {
      isUnlocked: true,
      unlockMode: "hardcore",
      unlockedAt: 100,
      hardcoreUnlockedAt: 400,
      softcoreUnlockedAt: 200,
    }),
    row("second", "Second", {
      isUnlocked: true,
      unlockMode: "softcore",
      unlockedAt: 300,
      hardcoreUnlockedAt: 250,
      softcoreUnlockedAt: 500,
    }),
    row("locked", "Locked"),
  ];

  assert.equal(getCompactAchievementUnlockTimestamp(rows[0]!, "hardcore"), 400);
  assert.equal(getCompactAchievementUnlockTimestamp(rows[0]!, "softcore"), 200);
  assert.deepEqual(sortCompactAchievementRows(rows, "recently-unlocked", "hardcore").map(({ achievementId }) => achievementId), [
    "first", "second", "locked",
  ]);
  assert.deepEqual(sortCompactAchievementRows(rows, "recently-unlocked", "softcore").map(({ achievementId }) => achievementId), [
    "second", "first", "locked",
  ]);
  assert.deepEqual(sortCompactAchievementRows(rows, "recently-unlocked", "all").map(({ achievementId }) => achievementId), [
    "second", "first", "locked",
  ]);
});

test("supported sort options follow real SteamHunters enrichment", () => {
  const snapshot: GameDetailSnapshot = {
    game: {
      providerId: "steam",
      appid: 123,
      gameId: "123",
      title: "Test Game",
      platformLabel: "Steam",
      status: "in_progress",
      summary: { unlockedCount: 0, totalCount: 1, completionPercent: 0 },
      metrics: [],
    },
    achievements: [{
      providerId: "steam",
      achievementId: "ACH_ONE",
      gameId: "123",
      title: "One",
      isUnlocked: false,
      metrics: [{ key: "global-percent", label: "Global Unlock Rate", value: "25" }],
    }],
    achievementStateIsComplete: true,
  };
  const withoutEnrichment = buildSteamCompactAchievementListModel(snapshot);
  assert.equal(getSupportedCompactAchievementSorts(withoutEnrichment.rows).includes("points-desc"), false);
  assert.equal(getSupportedCompactAchievementSorts(withoutEnrichment.rows).includes("rarity-asc"), true);

  const steamHunters: SteamHuntersGameData = {
    app: { appId: 123, tags: [] },
    achievements: [{ apiName: "ACH_ONE", points: 12, obtainability: "obtainable" }],
    groups: [],
  };
  const withEnrichment = buildSteamCompactAchievementListModel(
    composeSteamGameDetailWithSteamHunters(snapshot, steamHunters),
  );
  assert.equal(withEnrichment.rows[0]?.pointsValue, 12);
  assert.equal(getSupportedCompactAchievementSorts(withEnrichment.rows).includes("points-desc"), true);
});

test("large compact achievement collections search and sort entirely in memory", () => {
  const rows = Array.from({ length: 666 }, (_, index) => row(
    `achievement-${index}`,
    index < 12 ? `Imp Slayer ${index + 1}` : `Achievement ${index + 1}`,
    {
      description: index < 12 ? "Kill imps in one run." : "Complete an objective.",
      ...(index % 7 === 0 ? {} : { rarityPercent: (index % 100) + 0.5 }),
    },
  ));

  const matches = rows.filter((candidate) => matchesCompactAchievementSearch(candidate, "  SLAYER "));
  assert.equal(matches.length, 12);

  const sorted = sortCompactAchievementRows(rows, "rarity-asc");
  assert.equal(sorted.length, 666);
  assert.equal(rows[0]?.achievementId, "achievement-0");
  const firstMissingIndex = sorted.findIndex(({ rarityPercent }) => rarityPercent === undefined);
  assert.ok(firstMissingIndex > 0);
  assert.equal(sorted.slice(firstMissingIndex).every(({ rarityPercent }) => rarityPercent === undefined), true);
});
