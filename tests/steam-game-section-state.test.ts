import assert from "node:assert/strict";
import test from "node:test";
import {
  readSteamGameSectionPageState,
  requestSteamGameSectionRestoration,
  resetSteamGameSectionPageStatesForTests,
  selectSteamAchievementRestorationTarget,
  updateSteamGameSectionPageState,
} from "../src/platform/decky/decky-steam-game-section-state";
import {
  handleSteamGameShoulderButtonDown,
  STEAM_GAMEPAD_UI_SHOULDER_BUTTON,
} from "../src/platform/decky/decky-steam-game-shoulder-navigation";

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
      achievementGroupFilter: "missable",
      achievementAvailabilityFilter: "unobtainable",
      visibleAchievementIds: ["API_36", "API_37", "API_38"],
    },
    "achievement-groups": {
      ...current["achievement-groups"],
      scrollTop: 320,
      expandedGroupIds: ["base-game", "dlc:123:1"],
      focusedGroupId: "dlc:123:1",
    },
  }));

  const state = readSteamGameSectionPageState("steam", "42");
  assert.equal(state.activeSection, "achievements");
  assert.equal(state.achievements.scrollTop, 760);
  assert.equal(state.achievements.focusedId, "API_37");
  assert.equal(state.achievements.achievementFilter, "locked");
  assert.equal(state.achievements.achievementGroupFilter, "missable");
  assert.equal(state.achievements.achievementAvailabilityFilter, "unobtainable");
  assert.equal(state["achievement-groups"].scrollTop, 320);
  assert.deepEqual(state["achievement-groups"].expandedGroupIds, ["base-game", "dlc:123:1"]);
  assert.equal(state["achievement-groups"].focusedGroupId, "dlc:123:1");
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

test("Steam shoulder section navigation consumes handled GamepadUI presses", () => {
  const navigations: string[] = [];
  const cancellations: string[] = [];
  const createEvent = (button: number, isRepeat = false) => ({
    detail: { button, source: 0, is_repeat: isRepeat },
    preventDefault: () => cancellations.push("default"),
    stopPropagation: () => cancellations.push("propagation"),
    stopImmediatePropagation: () => cancellations.push("immediate"),
  });
  const actions = {
    onPreviousSection: () => navigations.push("previous"),
    onNextSection: () => navigations.push("next"),
  };

  assert.equal(handleSteamGameShoulderButtonDown(
    createEvent(STEAM_GAMEPAD_UI_SHOULDER_BUTTON.right),
    actions,
  ), true);
  assert.equal(handleSteamGameShoulderButtonDown(
    createEvent(STEAM_GAMEPAD_UI_SHOULDER_BUTTON.left),
    actions,
  ), true);
  assert.equal(handleSteamGameShoulderButtonDown(
    createEvent(STEAM_GAMEPAD_UI_SHOULDER_BUTTON.right, true),
    actions,
  ), true);
  assert.deepEqual(navigations, ["next", "previous"]);
  assert.deepEqual(cancellations, [
    "default",
    "propagation",
    "immediate",
    "default",
    "propagation",
    "immediate",
    "default",
    "propagation",
    "immediate",
  ]);
});

test("Steam shoulder section navigation ignores unrelated GamepadUI presses", () => {
  const calls: string[] = [];
  const handled = handleSteamGameShoulderButtonDown({
    detail: { button: 1, source: 0 },
    preventDefault: () => calls.push("default"),
    stopPropagation: () => calls.push("propagation"),
    stopImmediatePropagation: () => calls.push("immediate"),
  }, {
    onPreviousSection: () => calls.push("previous"),
    onNextSection: () => calls.push("next"),
  });

  assert.equal(handled, false);
  assert.deepEqual(calls, []);
});
