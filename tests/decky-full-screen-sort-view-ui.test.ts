import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("full-screen achievement browser uses native Search and Sort & View controls", async () => {
  const [browser, controls, page, row] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-full-screen-achievement-browser.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-achievement-browser-controls.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-game-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-achievement-row.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(browser, /<DeckyFullScreenAchievementBrowserControls/u);
  assert.match(controls, /<MenuGroup label="SORT BY">/u);
  assert.match(controls, /<MenuGroup label="DISPLAY">/u);
  assert.match(controls, /registerDeckyFullscreenPopupCancel\(closeMenu\)/u);
  assert.match(controls, /requestDeckySteamGamepadFocusAfterMount\(triggerRef\.current\)/u);
  assert.match(controls, /markDeckyFullscreenOnScreenKeyboardOpen/u);
  assert.match(browser, /No achievements match your search/u);
  assert.match(browser, /aria-label="Clear achievement search"/u);
  assert.match(browser, /requestDeckySteamGamepadFocusAfterMount\(/u);
  assert.match(page, /matchesFullScreenAchievementSearch/u);
  assert.match(page, /sortFullScreenAchievements/u);
  assert.match(page, /query: achievementQuery/u);
  assert.match(page, /displayMode: achievementDisplayMode/u);
  assert.match(row, /FULLSCREEN_COMPACT_ACHIEVEMENT_ARTWORK_SIZE = 40/u);
  assert.match(row, /displayMode === "compact"/u);
});

test("full-screen Games combines chronology and display without clearing density", async () => {
  const source = await readFile(new URL("../src/platform/decky/decky-steam-full-screen-games-dashboard.tsx", import.meta.url), "utf8");
  assert.match(source, /<MenuGroup label="SORT BY">/u);
  assert.match(source, /<MenuGroup label="DISPLAY">/u);
  assert.match(source, /Last Played — Oldest First/u);
  assert.match(source, /Last Unlock — Oldest First/u);
  assert.match(source, /Name — Z to A/u);
  assert.doesNotMatch(source, /function GamesSortToggle/u);
  assert.match(source, /rememberDeckyGamesControls\(providerId, "all", "", "recent", mode, displayMode\)/u);
  assert.match(source, /displayMode === "compact"/u);
});
