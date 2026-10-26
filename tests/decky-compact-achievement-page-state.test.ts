import assert from "node:assert/strict";
import test from "node:test";
import {
  clearDeckyCompactAchievementRevealRequest,
  readDeckyCompactAchievementPageState,
  readDeckyCompactAchievementRevealRequest,
  requestDeckyCompactAchievementReveal,
  resetDeckyCompactAchievementPageState,
  writeDeckyCompactAchievementPageState,
} from "../src/platform/decky/decky-compact-achievement-page-state";

test("compact achievement page state defaults to detailed default-order browsing", () => {
  resetDeckyCompactAchievementPageState();

  assert.deepEqual(readDeckyCompactAchievementPageState("steam", "game-a", 12), {
    filter: "all",
    modeFilter: "all",
    searchQuery: "",
    sort: "default",
    displayMode: "detailed",
    visibleCount: 12,
    focusedAchievementId: undefined,
    scrollTop: 0,
  });
});

test("compact achievement page state remains scoped by provider and game", () => {
  resetDeckyCompactAchievementPageState();
  writeDeckyCompactAchievementPageState("steam", "shared-id", {
    filter: "locked",
    modeFilter: "all",
    searchQuery: "slayer",
    sort: "rarity-asc",
    displayMode: "compact",
    visibleCount: 666,
    focusedAchievementId: "steam-achievement",
    scrollTop: 420,
  });
  writeDeckyCompactAchievementPageState("retroachievements", "shared-id", {
    filter: "unlocked",
    modeFilter: "hardcore",
    searchQuery: "portal",
    sort: "recently-unlocked",
    displayMode: "detailed",
    visibleCount: 25,
    focusedAchievementId: "ra-achievement",
    scrollTop: 84,
  });

  assert.equal(readDeckyCompactAchievementPageState("steam", "shared-id", 12).searchQuery, "slayer");
  assert.equal(readDeckyCompactAchievementPageState("steam", "shared-id", 12).displayMode, "compact");
  assert.equal(readDeckyCompactAchievementPageState("retroachievements", "shared-id", 12).searchQuery, "portal");
  assert.equal(readDeckyCompactAchievementPageState("retroachievements", "shared-id", 12).modeFilter, "hardcore");
});

test("legacy compact achievement checkpoints receive safe browser defaults", () => {
  resetDeckyCompactAchievementPageState();
  writeDeckyCompactAchievementPageState("steam", "legacy", {
    filter: "locked",
    modeFilter: "all",
    visibleCount: 20,
    focusedAchievementId: "achievement-20",
    scrollTop: 220,
  });

  assert.deepEqual(readDeckyCompactAchievementPageState("steam", "legacy", 12), {
    filter: "locked",
    modeFilter: "all",
    searchQuery: "",
    sort: "default",
    displayMode: "detailed",
    visibleCount: 20,
    focusedAchievementId: "achievement-20",
    scrollTop: 220,
  });
});

test("temporary achievement reveal requests do not overwrite remembered browsing state", () => {
  resetDeckyCompactAchievementPageState();
  writeDeckyCompactAchievementPageState("steam", "game-a", {
    filter: "unlocked",
    modeFilter: "all",
    searchQuery: "mastery",
    sort: "name-desc",
    displayMode: "compact",
    visibleCount: 198,
    focusedAchievementId: "previous-achievement",
    scrollTop: 310,
  });

  const first = requestDeckyCompactAchievementReveal("steam", "game-a", "locked-recommendation");
  assert.deepEqual(readDeckyCompactAchievementRevealRequest("steam", "game-a"), first);
  assert.equal(readDeckyCompactAchievementRevealRequest("steam", "game-b"), undefined);
  assert.equal(readDeckyCompactAchievementRevealRequest("retroachievements", "game-a"), undefined);
  assert.equal(readDeckyCompactAchievementPageState("steam", "game-a", 12).filter, "unlocked");
  assert.equal(readDeckyCompactAchievementPageState("steam", "game-a", 12).searchQuery, "mastery");

  const latest = requestDeckyCompactAchievementReveal("steam", "game-a", "newer-recommendation");
  clearDeckyCompactAchievementRevealRequest("steam", "game-a", first.requestId);
  assert.deepEqual(readDeckyCompactAchievementRevealRequest("steam", "game-a"), latest);

  clearDeckyCompactAchievementRevealRequest("steam", "game-a", latest.requestId);
  assert.equal(readDeckyCompactAchievementRevealRequest("steam", "game-a"), undefined);
  assert.equal(readDeckyCompactAchievementPageState("steam", "game-a", 12).focusedAchievementId, "previous-achievement");
});

test("reset clears remembered page state and pending reveal requests", () => {
  writeDeckyCompactAchievementPageState("steam", "game-a", {
    filter: "locked",
    modeFilter: "all",
    visibleCount: 1,
    focusedAchievementId: "achievement",
    scrollTop: 10,
  });
  requestDeckyCompactAchievementReveal("steam", "game-a", "achievement");

  resetDeckyCompactAchievementPageState();

  assert.equal(readDeckyCompactAchievementPageState("steam", "game-a", 12).filter, "all");
  assert.equal(readDeckyCompactAchievementRevealRequest("steam", "game-a"), undefined);
});
