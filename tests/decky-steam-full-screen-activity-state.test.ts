import assert from "node:assert/strict";
import test from "node:test";
import {
  readDeckySteamActivityPageState,
  rememberDeckySteamActivityCalendarDay,
  rememberDeckySteamActivityFilter,
  rememberDeckySteamActivityFocusTarget,
  rememberDeckySteamActivityRenderLimit,
  resetDeckySteamActivityPageState,
} from "../src/platform/decky/decky-steam-full-screen-activity-state";

test("Steam activity state preserves semantic child-route origin", () => {
  resetDeckySteamActivityPageState();
  assert.equal(readDeckySteamActivityPageState().renderLimit, 24);
  rememberDeckySteamActivityFilter("year");
  rememberDeckySteamActivityRenderLimit(36);
  rememberDeckySteamActivityFocusTarget({ gameId: "2321470", achievementId: "survivor-2" });
  assert.deepEqual(readDeckySteamActivityPageState(), {
    filter: "year",
    focusTarget: { gameId: "2321470", achievementId: "survivor-2" },
    renderLimit: 36,
    selectedCalendarDay: undefined,
  });
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
  });

  rememberDeckySteamActivityFilter("recent");
  assert.equal(readDeckySteamActivityPageState().selectedCalendarDay, undefined);
});
