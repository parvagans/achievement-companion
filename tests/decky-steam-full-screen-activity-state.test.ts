import assert from "node:assert/strict";
import test from "node:test";
import {
  readDeckySteamActivityPageState,
  rememberDeckySteamActivityFilter,
  rememberDeckySteamActivityFocusTarget,
  rememberDeckySteamActivityRenderLimit,
  resetDeckySteamActivityPageState,
} from "../src/platform/decky/decky-steam-full-screen-activity-state";

test("Steam activity state preserves semantic child-route origin", () => {
  resetDeckySteamActivityPageState();
  rememberDeckySteamActivityFilter("year");
  rememberDeckySteamActivityRenderLimit(36);
  rememberDeckySteamActivityFocusTarget({ gameId: "2321470", achievementId: "survivor-2" });
  assert.deepEqual(readDeckySteamActivityPageState(), {
    filter: "year",
    focusTarget: { gameId: "2321470", achievementId: "survivor-2" },
    renderLimit: 36,
  });
});
