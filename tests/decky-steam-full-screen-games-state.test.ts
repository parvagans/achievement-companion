import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  readDeckyGamesPageState,
  readDeckySteamGamesPageState,
  rememberDeckyGamesControls,
  rememberDeckyGamesFocus,
  rememberDeckyGamesProfileShortcut,
  rememberDeckyGamesRenderLimit,
  rememberDeckySteamGamesControls,
  rememberDeckySteamGamesFocus,
  rememberDeckySteamGamesRenderLimit,
  rememberDeckyGamesScrollTop,
  rememberDeckyGamesSystem,
  rememberDeckyGamesSystemFilter,
  resetDeckyGamesPageState,
  resetDeckySteamGamesPageState,
} from "../src/platform/decky/decky-steam-full-screen-games-state";

test("Steam Games state preserves semantic child-route origin", () => {
  resetDeckySteamGamesPageState();
  rememberDeckySteamGamesControls("unfinished", "rock", "title");
  rememberDeckySteamGamesRenderLimit(36);
  rememberDeckySteamGamesFocus("2321470");
  rememberDeckyGamesScrollTop("steam", 420);
  assert.deepEqual(readDeckySteamGamesPageState(), {
    filter: "unfinished",
    focusGameId: "2321470",
    query: "rock",
    renderLimit: 36,
    scrollTop: 420,
    sort: "title",
    mode: "both",
    system: undefined,
  });
});

test("provider Games state isolates RA mode, controls, focus, render limit, and real scroll offset", () => {
  resetDeckyGamesPageState("retroachievements");
  resetDeckySteamGamesPageState();
  rememberDeckyGamesControls("retroachievements", "mastered", "mario", "completion", "hardcore");
  rememberDeckyGamesRenderLimit("retroachievements", 48);
  rememberDeckyGamesFocus("retroachievements", "14402");
  rememberDeckyGamesScrollTop("retroachievements", 736);

  assert.deepEqual(readDeckyGamesPageState("retroachievements"), {
    filter: "mastered",
    focusGameId: "14402",
    query: "mario",
    renderLimit: 48,
    scrollTop: 736,
    sort: "completion",
    mode: "hardcore",
    system: undefined,
  });
  assert.deepEqual(readDeckySteamGamesPageState(), {
    filter: "all",
    focusGameId: undefined,
    query: "",
    renderLimit: 12,
    scrollTop: 0,
    sort: "recent",
    mode: "both",
    system: undefined,
  });
});

test("RA system selection resets controls and survives game-detail restoration", () => {
  resetDeckyGamesPageState("retroachievements");
  rememberDeckyGamesControls("retroachievements", "mastered", "mario", "completion", "hardcore");
  rememberDeckyGamesSystem("retroachievements", { systemId: "7", title: "NES/Famicom" });
  rememberDeckyGamesFocus("retroachievements", "14402");
  assert.deepEqual(readDeckyGamesPageState("retroachievements"), {
    filter: "all",
    focusGameId: "14402",
    query: "",
    renderLimit: 12,
    scrollTop: 0,
    sort: "recent",
    mode: "hardcore",
    system: { systemId: "7", title: "NES/Famicom" },
  });
  rememberDeckyGamesSystem("retroachievements", undefined);
  assert.equal(readDeckyGamesPageState("retroachievements").system, undefined);
});

test("RA local system filtering preserves search, status and sort while resetting the list", () => {
  resetDeckyGamesPageState("retroachievements");
  rememberDeckyGamesControls("retroachievements", "remaining", "mario", "fewest_remaining", "hardcore");
  rememberDeckyGamesRenderLimit("retroachievements", 48);
  rememberDeckyGamesFocus("retroachievements", "14402");
  rememberDeckyGamesScrollTop("retroachievements", 736);

  rememberDeckyGamesSystemFilter("retroachievements", { systemId: "7", title: "NES/Famicom" });
  assert.deepEqual(readDeckyGamesPageState("retroachievements"), {
    filter: "remaining",
    focusGameId: undefined,
    query: "mario",
    renderLimit: 12,
    scrollTop: 0,
    sort: "fewest_remaining",
    mode: "hardcore",
    system: { systemId: "7", title: "NES/Famicom" },
  });

  rememberDeckyGamesSystemFilter("retroachievements", undefined);
  assert.equal(readDeckyGamesPageState("retroachievements").system, undefined);
  assert.equal(readDeckyGamesPageState("retroachievements").query, "mario");
  assert.equal(readDeckyGamesPageState("retroachievements").filter, "remaining");
  assert.equal(readDeckyGamesPageState("retroachievements").sort, "fewest_remaining");
});

test("Games remembers the oldest-first toggle for each provider independently", () => {
  resetDeckySteamGamesPageState();
  resetDeckyGamesPageState("retroachievements");
  rememberDeckyGamesControls("steam", "all", "", "oldest", "both");

  assert.equal(readDeckyGamesPageState("steam").sort, "oldest");
  assert.equal(readDeckyGamesPageState("retroachievements").sort, "recent");

  rememberDeckyGamesControls("retroachievements", "all", "", "oldest", "hardcore");
  assert.equal(readDeckyGamesPageState("retroachievements").sort, "oldest");
  assert.equal(readDeckyGamesPageState("steam").sort, "oldest");
});

test("Profile Games shortcut is saved immediately and later visits retain Games refinements", () => {
  resetDeckySteamGamesPageState();
  rememberDeckySteamGamesControls("unfinished", "old search", "title");
  rememberDeckySteamGamesFocus("old-game");
  rememberDeckyGamesScrollTop("steam", 510);

  rememberDeckyGamesProfileShortcut("steam", "played");
  assert.deepEqual(readDeckySteamGamesPageState(), {
    filter: "played",
    focusGameId: undefined,
    query: "",
    renderLimit: 12,
    scrollTop: 0,
    sort: "recent",
    mode: "both",
    system: undefined,
  });

  rememberDeckySteamGamesControls("remaining", "craft", "fewest_remaining");
  rememberDeckySteamGamesFocus("new-game");
  rememberDeckyGamesScrollTop("steam", 275);
  assert.equal(readDeckySteamGamesPageState().filter, "remaining");
  assert.equal(readDeckySteamGamesPageState().query, "craft");
  assert.equal(readDeckySteamGamesPageState().sort, "fewest_remaining");
  assert.equal(readDeckySteamGamesPageState().focusGameId, "new-game");
  assert.equal(readDeckySteamGamesPageState().scrollTop, 275);
});

test("Profile collection shortcut clears an RA system while retaining the saved achievement mode", () => {
  resetDeckyGamesPageState("retroachievements");
  rememberDeckyGamesControls("retroachievements", "mastered", "mario", "completion", "hardcore");
  rememberDeckyGamesSystemFilter("retroachievements", { systemId: "7", title: "NES/Famicom" });

  rememberDeckyGamesProfileShortcut("retroachievements", "beaten");
  const next = readDeckyGamesPageState("retroachievements");
  assert.equal(next.filter, "beaten");
  assert.equal(next.system, undefined);
  assert.equal(next.mode, "hardcore");
  assert.equal(next.query, "");
});

test("session Games profile presets are one-shot and ordinary tab visits restore saved controls", async () => {
  const source = await readFile(new URL("../src/platform/decky/decky-navigation.tsx", import.meta.url), "utf8");
  const openGames = source.slice(source.indexOf("const openGames ="), source.indexOf("const openSystemGames ="));
  assert.match(openGames, /if \(initialFilter !== undefined && providerId !== undefined\)/u);
  assert.match(openGames, /rememberDeckyGamesProfileShortcut\(providerId, initialFilter === "subsets" \? "all" : initialFilter\)/u);
  assert.doesNotMatch(openGames, /rememberDeckyGamesSystem|setGamesInitialFilter/u);
  assert.doesNotMatch(source, /initialFilter=\{gamesInitialFilter\}/u);
});

test("Steam Games reveals batches on Down or scrolling and transfers native focus only for Down", async () => {
  const source = await readFile(
    new URL("../src/platform/decky/decky-steam-full-screen-games-dashboard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /appendedGameIdToFocus/u);
  assert.match(source, /const revealMoreGames[\s\S]*renderedGames\.length >= visibleGames\.length[\s\S]*visibleGames\[renderedGames\.length\]/u);
  assert.match(source, /focusAppendedRow && firstAppendedGame !== undefined[\s\S]*setAppendedGameIdToFocus\(firstAppendedGame\.gameId\)/u);
  assert.match(source, /takeDeckySteamGamepadFocus\(target\)[\s\S]*scrollDeckyFocusTargetIntoView\(target, listRef\.current, \(\) => target\.isConnected &&/u);
  assert.match(source, /target\.ownerDocument\.activeElement === target \|\| target\.classList\.contains\("gpfocus"\)/u);
  assert.match(source, /rowIndex === 0[\s\S]*scrollDeckyFocusTargetToTop\(rowRef\.current \?\? element, isStillFocused, listRef\.current\)[\s\S]*rememberDeckyGamesScrollTop\(providerId, 0\)/u);
  assert.match(source, /scrollDeckyFocusTargetIntoView\(rowRef\.current \?\? element, listRef\.current, isStillFocused\)/u);
  assert.match(source, /onBlur=\{\(\) => \{ focusGeneration\.current \+= 1; \}\}[\s\S]*onGamepadBlur=\{\(\) => \{ focusGeneration\.current \+= 1; \}\}/u);
  assert.match(source, /GamepadButton\.DIR_DOWN && onRevealMore\?\.\(\)[\s\S]*event\.preventDefault\(\)[\s\S]*event\.stopPropagation\(\)/u);
  assert.match(source, /rowIndex === renderedGames\.length - 1[\s\S]*onRevealMore: \(\) => revealMoreGames\(true\)/u);
  assert.match(source, /list\.scrollTop \+ list\.clientHeight >= list\.scrollHeight - STEAM_FULLSCREEN_GAME_ROW_HEIGHT\) revealMoreGames\(false\)/u);
  assert.doesNotMatch(source, /data-steam-games-show-more|handleSteamGamesShowMoreDirection|Show \$\{Math\.min\(STEAM_GAMES_RENDER_STEP/u);
  assert.match(source, /handleSteamGamesToolbarDirection[\s\S]*GamepadButton\.DIR_LEFT[\s\S]*GamepadButton\.DIR_RIGHT/u);
  assert.match(source, /data-steam-games-toolbar-control[\s\S]*sourceIndex[\s\S]*takeDeckySteamGamepadFocus\(target\)/u);
  assert.match(source, /handleSteamGamesRowDirection[\s\S]*GamepadButton\.DIR_UP[\s\S]*GamepadButton\.DIR_DOWN/u);
  assert.match(source, /sourceIndex > 0[\s\S]*data-steam-games-toolbar-control='search'/u);
  assert.match(source, /rows\[sourceIndex \+ 1\] \?\? source/u);
  assert.doesNotMatch(source, /handleSteamGamesToolbarDirection[\s\S]*stopImmediatePropagation/u);
});

test("Steam Games composes search, filters, and rows through GamepadUI focus primitives", async () => {
  const source = await readFile(
    new URL("../src/platform/decky/decky-steam-full-screen-games-dashboard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /flow-children="vertical"[\s\S]*flow-children="left-right"/u);
  assert.match(source, /navEntryPreferPosition=\{NavEntryPositionPreferences\.MAINTAIN_X\}/u);
  assert.match(source, /navEntryPreferPosition=\{NavEntryPositionPreferences\.FIRST\}/u);
  assert.match(source, /<SteamGamesStatusButton/u);
  assert.match(source, /<SteamGamesSortButton/u);
  assert.match(source, /<GamesSortToggle/u);
  assert.match(source, /aria-label="Clear Games filters"/u);
  assert.match(source, /<RetroAchievementsSystemButton/u);
  assert.match(source, /data-steam-games-toolbar-control="system"/u);
  assert.match(source, /data-steam-games-toolbar-control="sort"/u);
  assert.doesNotMatch(source, /Title A[-–]Z|Achievement mode:|<h1[^>]*>Games<\/h1>/u);
  assert.match(source, /<Menu label="Filter games by status"[\s\S]*<MenuItem[\s\S]*selected=\{option\.value === value\}/u);
  assert.match(source, /registerDeckyFullscreenPopupCancel\(closeMenu\)/u);
  assert.match(source, /<SteamGamesSearchField[\s\S]*value=\{query\}[\s\S]*onChange=\{\(event\) => \{ setQuery\(event\.currentTarget\.value\); \}\}/u);
  assert.doesNotMatch(source, /activateSearch|input\.click\(\)/u);
});
