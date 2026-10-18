import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WHATS_NEW_SECTIONS } from "../src/platform/decky/decky-whats-new-content";

test("bundled What's New notes cover the update and remain readable offline", () => {
  assert.deepEqual(WHATS_NEW_SECTIONS, [
    {
      title: "Themes",
      items: [
        "Choose from 15 themes, including Aurora, Rosewood, Solarized, and more.",
        "Theme colors now carry through Quick Access, full-screen views, controls, charts, icons, footers, and loading screens.",
        "Steam and RetroAchievements progression states retain their distinct meanings across every theme.",
      ],
    },
    {
      title: "Interface & navigation",
      items: [
        "Plugin Settings now uses expandable, joined sections with a wider theme selector and aligned badge controls.",
        "Quick Access activity cards have consistent heights, game names are centered, and rank arrows persist across refreshes.",
        "The View Achievements action for RetroAchievements recently played and currently playing games now opens that game's Quick Access achievement list.",
        "What's New now fits within the Steam Deck viewport and supports controller scrolling.",
      ],
    },
    {
      title: "Steam game data",
      items: [
        "Steam game pages retain cached SteamHunters details when an optional request fails or returns incomplete data.",
        "A mismatch notice appears when cached SteamHunters data covers a different achievement count from Steam's current set.",
      ],
    },
  ]);
  for (const section of WHATS_NEW_SECTIONS) {
    assert.ok(section.items.length > 0);
    for (const item of section.items) {
      assert.ok(item.length > 20);
      assert.ok(item.length < 180);
    }
  }
  assert.match(WHATS_NEW_SECTIONS[1].items.join(" "), /Quick Access/u);
});

test("What's New keeps permanent support actions below fitted release notes", async () => {
  const [modalSource, contentSource, githubWhiteSource, githubBlackSource, kofiSource] = await Promise.all([
    readFile("src/platform/decky/decky-whats-new-modal.tsx", "utf8"),
    readFile("src/platform/decky/decky-whats-new-content.ts", "utf8"),
    readFile("src/platform/decky/assets/brand/github-invertocat-white.svg", "utf8"),
    readFile("src/platform/decky/assets/brand/github-invertocat-black.svg", "utf8"),
    readFile("src/platform/decky/assets/brand/kofi-symbol.svg", "utf8"),
  ]);

  assert.match(modalSource, /const GITHUB_URL = "https:\/\/github\.com\/parvagans\/achievement-companion";/u);
  assert.match(modalSource, /const KOFI_URL = "https:\/\/ko-fi\.com\/parvagans";/u);
  assert.match(modalSource, /closeModal\(\);\s*DeckyNavigation\.NavigateToExternalWeb\(url\);/u);
  assert.match(modalSource, /data-ac-whats-new-support="true"[\s\S]*flow-children="left-right"/u);
  assert.match(modalSource, /role="link"[\s\S]*tabIndex=\{0\}[\s\S]*onActivate=\{openExternalUrl\}[\s\S]*onClick=\{openExternalUrl\}/u);
  assert.match(modalSource, /label: "Star on GitHub"/u);
  assert.match(modalSource, /label: "Support on Ko-fi"/u);
  assert.ok(
    modalSource.indexOf("data-ac-whats-new-support=\"true\"")
      > modalSource.indexOf("data-ac-whats-new-notes=\"true\""),
  );
  assert.match(modalSource, /const NOTES_VIEWPORT_HEIGHT_PX = 120;/u);
  assert.match(modalSource, /height: NOTES_VIEWPORT_HEIGHT_PX,[\s\S]*overflowY: "auto"/u);
  assert.match(modalSource, /onGamepadDirection=\{\(event\) => handleTabDirection\(index, event\)\}/u);
  assert.match(modalSource, /GamepadButton\.DIR_LEFT \|\| button === GamepadButton\.DIR_RIGHT[\s\S]*data-ac-whats-new-tab/u);
  assert.match(modalSource, /notes\.scrollTop = Math\.max\([\s\S]*consumeDirection\(event\);/u);
  assert.match(modalSource, /data-ac-whats-new-support-action[\s\S]*focusAndConsume\(event, target\);/u);
  assert.match(modalSource, /takeDeckySteamGamepadFocus\(target\)/u);
  assert.match(modalSource, /notesRef\.current\.scrollTop = 0;/u);
  assert.doesNotMatch(modalSource, /data-ac-whats-new-scrollable-notes|bAllowFullSize/u);
  assert.doesNotMatch(contentSource, /github\.com|ko-fi\.com|Star on GitHub|Support on Ko-fi/iu);

  assert.match(githubWhiteSource, /viewBox="0 0 98 96"/u);
  assert.match(githubWhiteSource, /fill="white"/u);
  assert.match(githubBlackSource, /viewBox="0 0 98 96"/u);
  assert.match(githubBlackSource, /fill="black"/u);
  assert.match(kofiSource, /viewBox="0 0 241 194"/u);
  assert.match(kofiSource, /fill="#FF5A16"/u);
});
