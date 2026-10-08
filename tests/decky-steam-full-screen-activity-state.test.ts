import assert from "node:assert/strict";
import test from "node:test";
import {
  readDeckyActivityPageState,
  readDeckySteamActivityPageState,
  rememberDeckyActivityCalendarDay,
  rememberDeckyActivityFilter,
  rememberDeckyActivityFocusTarget,
  rememberDeckyActivityRenderLimit,
  rememberDeckySteamActivityCalendarDay,
  rememberDeckySteamActivityFilter,
  rememberDeckySteamActivityFocusTarget,
  rememberDeckySteamActivityRenderLimit,
  rememberDeckyActivityScrollTop,
  resetDeckyActivityPageState,
  resetDeckySteamActivityPageState,
} from "../src/platform/decky/decky-steam-full-screen-activity-state";

test("Steam activity state preserves semantic child-route origin", () => {
  resetDeckySteamActivityPageState();
  assert.equal(readDeckySteamActivityPageState().renderLimit, 24);
  rememberDeckySteamActivityFilter("year");
  rememberDeckySteamActivityRenderLimit(36);
  rememberDeckySteamActivityFocusTarget({ gameId: "2321470", achievementId: "survivor-2" });
  rememberDeckyActivityScrollTop("steam", 640);
  assert.deepEqual(readDeckySteamActivityPageState(), {
    filter: "year",
    focusTarget: { gameId: "2321470", achievementId: "survivor-2" },
    renderLimit: 36,
    selectedCalendarDay: undefined,
    scrollTop: 640,
    mode: "both",
  });
});

test("provider Activity state isolates RA mode-aware identity and real scroll offset", () => {
  resetDeckyActivityPageState("retroachievements");
  resetDeckySteamActivityPageState();
  rememberDeckyActivityFilter("retroachievements", "month", "softcore");
  rememberDeckyActivityCalendarDay("retroachievements", 1_780_272_000_000);
  rememberDeckyActivityRenderLimit("retroachievements", 72);
  rememberDeckyActivityFocusTarget("retroachievements", {
    gameId: "14402",
    achievementId: "76543",
    unlockMode: "softcore",
    unlockedAt: 1_780_272_000_000,
  });
  rememberDeckyActivityScrollTop("retroachievements", 912);

  assert.deepEqual(readDeckyActivityPageState("retroachievements"), {
    filter: "all",
    focusTarget: {
      gameId: "14402",
      achievementId: "76543",
      unlockMode: "softcore",
      unlockedAt: 1_780_272_000_000,
    },
    renderLimit: 72,
    selectedCalendarDay: 1_780_272_000_000,
    scrollTop: 912,
    mode: "softcore",
  });
  assert.equal(readDeckySteamActivityPageState().focusTarget, undefined);
});

test("Steam activity calendar selection replaces presets and survives achievement detail navigation", () => {
  resetDeckySteamActivityPageState();
  rememberDeckySteamActivityFilter("month");
  rememberDeckySteamActivityCalendarDay(1_780_272_000_000);
  rememberDeckySteamActivityFocusTarget({ gameId: "1", achievementId: "dated" });

  assert.deepEqual(readDeckySteamActivityPageState(), {
    filter: "all",
    focusTarget: { gameId: "1", achievementId: "dated" },
    renderLimit: 24,
    selectedCalendarDay: 1_780_272_000_000,
    scrollTop: 0,
    mode: "both",
  });

  rememberDeckySteamActivityFilter("recent");
  assert.equal(readDeckySteamActivityPageState().selectedCalendarDay, undefined);
});
