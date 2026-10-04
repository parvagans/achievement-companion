import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("Steam Games moves native focus to the first appended row after Show more", async () => {
  const source = await readFile(
    new URL("../src/platform/decky/decky-steam-full-screen-games-dashboard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /appendedGameIdToFocus/u);
  assert.match(source, /const showMoreGames[\s\S]*visibleGames\[renderedGames\.length\]/u);
  assert.match(source, /takeDeckySteamGamepadFocus\(target\)[\s\S]*scrollDeckyFocusTargetIntoView\(target\)/u);
  assert.match(source, /handleSteamGamesToolbarDirection[\s\S]*GamepadButton\.DIR_LEFT[\s\S]*GamepadButton\.DIR_RIGHT/u);
  assert.match(source, /data-steam-games-toolbar-control[\s\S]*sourceIndex[\s\S]*takeDeckySteamGamepadFocus\(target\)/u);
  assert.match(source, /handleSteamGamesRowDirection[\s\S]*GamepadButton\.DIR_UP[\s\S]*GamepadButton\.DIR_DOWN/u);
  assert.match(source, /sourceIndex > 0[\s\S]*data-steam-games-toolbar-control='search'/u);
  assert.match(source, /rows\[sourceIndex \+ 1\][\s\S]*data-steam-games-show-more='true'/u);
  assert.match(source, /handleSteamGamesShowMoreDirection[\s\S]*rows\[rows\.length - 1\]/u);
  assert.doesNotMatch(source, /handleSteamGamesToolbarDirection[\s\S]*stopImmediatePropagation/u);
  assert.match(source, /onActivate=\{showMoreGames\}[\s\S]*onClick=\{showMoreGames\}/u);
});

test("Steam Games composes search, filters, and rows through GamepadUI focus primitives", async () => {
  const source = await readFile(
    new URL("../src/platform/decky/decky-steam-full-screen-games-dashboard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /flow-children="vertical"[\s\S]*flow-children="left-right"/u);
  assert.match(source, /navEntryPreferPosition=\{NavEntryPositionPreferences\.MAINTAIN_X\}/u);
  assert.match(source, /navEntryPreferPosition=\{NavEntryPositionPreferences\.PREFERRED_CHILD\}/u);
  assert.match(source, /preferredFocus=\{selected\}/u);
  assert.match(source, /onActivate=\{activateSearch\}/u);
  assert.match(source, /tabIndex=\{-1\}[\s\S]*value=\{query\}/u);
});
