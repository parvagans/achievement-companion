import assert from "node:assert/strict";
import test from "node:test";
import {
  readDeckySteamGamesPageState,
  rememberDeckySteamGamesControls,
  rememberDeckySteamGamesFocus,
  rememberDeckySteamGamesRenderLimit,
  resetDeckySteamGamesPageState,
} from "../src/platform/decky/decky-steam-full-screen-games-state";

test("Steam Games state preserves semantic child-route origin", () => {
  resetDeckySteamGamesPageState();
  rememberDeckySteamGamesControls("unfinished", "rock", "title");
  rememberDeckySteamGamesRenderLimit(36);
  rememberDeckySteamGamesFocus("2321470");
  assert.deepEqual(readDeckySteamGamesPageState(), {
    filter: "unfinished",
    focusGameId: "2321470",
    query: "rock",
    renderLimit: 36,
    sort: "title",
  });
});
