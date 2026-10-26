import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WHATS_NEW_SECTIONS } from "../src/platform/decky/decky-whats-new-content";

test("bundled What's New notes cover the update and remain readable offline", () => {
  assert.ok(WHATS_NEW_SECTIONS.length > 0);
  assert.equal(new Set(WHATS_NEW_SECTIONS.map((section) => section.title)).size, WHATS_NEW_SECTIONS.length);
  for (const section of WHATS_NEW_SECTIONS) {
    assert.ok(section.title.length > 0);
    assert.ok(section.items.length > 0);
    for (const item of section.items) {
      assert.ok(item.length > 20);
      assert.ok(item.length < 220);
    }
  }
});

test("What's New preserves the game overhaul notes and adds game-page badges", () => {
  assert.deepEqual(
    WHATS_NEW_SECTIONS.map((section) => section.title),
    ["Overview", "Up Next", "RA Goals", "Insights", "Controls", "Game Page Badges"],
  );
  assert.ok(WHATS_NEW_SECTIONS.every((section) => section.title.length <= 16));

  const releaseCopy = WHATS_NEW_SECTIONS.flatMap((section) => section.items).join(" ");
  assert.match(releaseCopy, /non-scrolling Deck dashboard/u);
  assert.match(releaseCopy, /three achievements/u);
  assert.match(releaseCopy, /Choose Beat or Master/u);
  assert.match(releaseCopy, /SteamHunters obtainability/u);
  assert.match(releaseCopy, /fixed X, Y, A, and B positions/u);
  assert.match(releaseCopy, /compact Minimal style/u);
});

test("What's New places QAM-sized support actions beside the modal title and expands fitted release notes", async () => {
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
  assert.match(modalSource, /data-ac-whats-new-title="true"[\s\S]*data-ac-whats-new-support="true"[\s\S]*data-ac-whats-new-notes="true"/u);
  assert.match(modalSource, /data-ac-whats-new-title="true"[\s\S]*width: 268,[\s\S]*flex: "0 0 268px"/u);
  assert.match(modalSource, /renderTitle: \(closeModal\) =>/u);
  assert.match(modalSource, /const NOTES_VIEWPORT_HEIGHT_PX = 160;/u);
  assert.match(modalSource, /height: NOTES_VIEWPORT_HEIGHT_PX,[\s\S]*overflowY: "auto"/u);
  assert.match(modalSource, /onGamepadDirection=\{\(event\) => handleTabDirection\(index, event\)\}/u);
  assert.match(modalSource, /GamepadButton\.DIR_LEFT \|\| button === GamepadButton\.DIR_RIGHT[\s\S]*data-ac-whats-new-tab/u);
  assert.match(modalSource, /notes\.scrollTop = Math\.max\([\s\S]*consumeDirection\(event\);/u);
  assert.match(modalSource, /function handleSupportDirection|const handleSupportDirection/u);
  assert.match(modalSource, /data-ac-whats-new-support-action[\s\S]*onGamepadDirection=\{\(event\) => handleSupportDirection\(action\.key, event\)\}/u);
  assert.match(modalSource, /GamepadButton\.DIR_LEFT \|\| button === GamepadButton\.DIR_RIGHT[\s\S]*targetKey[\s\S]*data-ac-whats-new-support-action/u);
  assert.match(modalSource, /gridTemplateColumns: "22px minmax\(0, 1fr\)"[\s\S]*fontSize: steamTheme\.type\.compact\.body/u);
  assert.match(modalSource, /takeDeckySteamGamepadFocus\(target\)/u);
  assert.match(modalSource, /requestDeckySteamGamepadFocusAfterMount\(initialTabRef\.current\)/u);
  assert.match(modalSource, /ref=\{index === 0 \? initialTabRef : undefined\}[\s\S]*preferredFocus=\{index === 0\}/u);
  assert.match(modalSource, /flex: section\.title\.length > 12 \? "1\.6 1 0" : "1 1 0"/u);
  assert.match(modalSource, /whiteSpace: "nowrap"/u);
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

test("What's New and achievement details share the native modal shell", async () => {
  const [shell, whatsNew, achievement] = await Promise.all([
    readFile("src/platform/decky/decky-standard-modal.tsx", "utf8"),
    readFile("src/platform/decky/decky-whats-new-modal.tsx", "utf8"),
    readFile("src/platform/decky/decky-achievement-detail-modal.tsx", "utf8"),
  ]);
  assert.match(shell, /<ConfirmModal[\s\S]*bAlertDialog[\s\S]*onCancel=\{closeModal\}/u);
  assert.match(shell, /bHideMainWindowForPopouts: false/u);
  assert.match(shell, /min\(100%, 780px\)/u);
  assert.match(whatsNew, /openDeckyStandardModal\(/u);
  assert.match(achievement, /openDeckyStandardModal\(/u);
});
