import assert from "node:assert/strict";
import test from "node:test";
import {
  readDeckyActivityPageState,
  readDeckySteamActivityPageState,
  rememberDeckyActivityCalendarDay,
  rememberDeckyActivityFilter,
  rememberDeckyActivityFocusTarget,
  rememberDeckyActivityGame,
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
    selectedGameId: undefined,
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
    selectedGameId: undefined,
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
    selectedGameId: undefined,
    selectedCalendarDay: 1_780_272_000_000,
    scrollTop: 0,
    mode: "both",
  });

  rememberDeckySteamActivityFilter("recent");
  assert.equal(readDeckySteamActivityPageState().selectedCalendarDay, undefined);
});

test("Activity game selection is provider-specific and survives time-filter changes", () => {
  resetDeckyActivityPageState("retroachievements");
  resetDeckySteamActivityPageState();
  rememberDeckyActivityCalendarDay("retroachievements", 1_780_272_000_000);
  rememberDeckyActivityGame("retroachievements", "14402");
  assert.equal(readDeckyActivityPageState("retroachievements").filter, "all");
  assert.equal(readDeckyActivityPageState("retroachievements").selectedCalendarDay, 1_780_272_000_000);
  rememberDeckyActivityFilter("retroachievements", "year", "hardcore");
  assert.equal(readDeckyActivityPageState("retroachievements").selectedGameId, "14402");
  assert.equal(readDeckyActivityPageState("retroachievements").filter, "year");
  for (const filter of ["streak", "month", "recent"] as const) {
    rememberDeckyActivityFilter("retroachievements", filter, "hardcore");
    assert.equal(readDeckyActivityPageState("retroachievements").selectedGameId, "14402");
    assert.equal(readDeckyActivityPageState("retroachievements").filter, filter);
  }
  assert.equal(readDeckySteamActivityPageState().selectedGameId, undefined);

  rememberDeckyActivityFilter("steam", "month", "both");
  rememberDeckyActivityGame("steam", "2321470");
  assert.equal(readDeckySteamActivityPageState().filter, "month");
  rememberDeckyActivityCalendarDay("steam", 1_780_272_000_000);
  assert.equal(readDeckySteamActivityPageState().selectedGameId, "2321470");
  rememberDeckyActivityGame("steam", undefined);
  assert.equal(readDeckySteamActivityPageState().selectedGameId, undefined);
  assert.equal(readDeckySteamActivityPageState().selectedCalendarDay, 1_780_272_000_000);

  rememberDeckyActivityFilter("steam", "recent", "both");
  rememberDeckyActivityGame("steam", "2321470");
  assert.equal(readDeckySteamActivityPageState().filter, "recent");
  assert.equal(readDeckySteamActivityPageState().selectedGameId, "2321470");
  rememberDeckyActivityFilter("steam", "all", "both");
  assert.equal(readDeckySteamActivityPageState().selectedGameId, "2321470");
  assert.equal(readDeckySteamActivityPageState().filter, "all");
  rememberDeckyActivityGame("steam", undefined);
  assert.equal(readDeckySteamActivityPageState().selectedGameId, undefined);
  assert.equal(readDeckySteamActivityPageState().filter, "all");

  rememberDeckyActivityFilter("retroachievements", "all", "hardcore");
  assert.equal(readDeckyActivityPageState("retroachievements").selectedGameId, "14402");
  assert.equal(readDeckyActivityPageState("retroachievements").selectedCalendarDay, undefined);
});
