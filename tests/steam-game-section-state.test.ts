import assert from "node:assert/strict";
import test from "node:test";
import {
  readSteamGameSectionPageState,
  requestSteamGameSectionRestoration,
  resetSteamGameSectionPageStatesForTests,
  selectSteamAchievementRestorationTarget,
  updateSteamGameSectionPageState,
} from "../src/platform/decky/decky-steam-game-section-state";

test("Steam section state preserves filters and stable achievement ids by game", () => {
  resetSteamGameSectionPageStatesForTests();
  updateSteamGameSectionPageState("steam", "42", (current) => ({
    ...current,
    activeSection: "achievements",
    achievements: {
      ...current.achievements,
      scrollTop: 760,
      focusedId: "API_37",
      achievementFilter: "locked",
      visibleAchievementIds: ["API_36", "API_37", "API_38"],
    },
  }));

  const state = readSteamGameSectionPageState("steam", "42");
  assert.equal(state.activeSection, "achievements");
  assert.equal(state.achievements.scrollTop, 760);
  assert.equal(state.achievements.focusedId, "API_37");
  assert.equal(state.achievements.achievementFilter, "locked");
  assert.equal(readSteamGameSectionPageState("steam", "other").activeSection, "overview");
});

test("Steam restoration target prefers exact, then nearest previous id, then first current id", () => {
  assert.equal(selectSteamAchievementRestorationTarget({
    focusedAchievementId: "API_37",
    previousVisibleAchievementIds: ["API_36", "API_37", "API_38"],
    currentVisibleAchievementIds: ["API_36", "API_37"],
  }), "API_37");
  assert.equal(selectSteamAchievementRestorationTarget({
    focusedAchievementId: "API_37",
    previousVisibleAchievementIds: ["API_36", "API_37", "API_38"],
    currentVisibleAchievementIds: ["API_36", "API_38"],
  }), "API_36");
  assert.equal(selectSteamAchievementRestorationTarget({
    focusedAchievementId: "API_37",
    previousVisibleAchievementIds: ["API_36", "API_37", "API_38"],
    currentVisibleAchievementIds: ["API_99"],
  }), "API_99");
});

test("Steam detail return restoration is explicitly requested per game", () => {
  resetSteamGameSectionPageStatesForTests();
  requestSteamGameSectionRestoration("steam", "42");
  assert.equal(readSteamGameSectionPageState("steam", "42").restoreRequested, true);
});
