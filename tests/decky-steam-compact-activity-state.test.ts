import assert from "node:assert/strict";
import test from "node:test";
import {
  readDeckySteamCompactActivityDay,
  resetDeckySteamCompactActivityState,
  setDeckySteamCompactActivityDay,
} from "../src/platform/decky/decky-steam-compact-activity-state";

test("compact Steam activity date persists until the compact session resets", () => {
  resetDeckySteamCompactActivityState();
  setDeckySteamCompactActivityDay(1_791_072_000_000);
  assert.equal(readDeckySteamCompactActivityDay(), 1_791_072_000_000);
  resetDeckySteamCompactActivityState();
  assert.equal(readDeckySteamCompactActivityDay(), undefined);
});
