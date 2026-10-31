import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement, createRef } from "react";
import { WHATS_NEW_SECTIONS } from "../src/platform/decky/decky-whats-new-content";
import { steamTheme } from "../src/platform/decky/steam-theme";
import { components } from "./helpers/decky-component-declarations";

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

test("What's New covers 0.39.1 while retaining the 0.39.0 highlights and earlier Up Next introduction", () => {
  assert.deepEqual(
    WHATS_NEW_SECTIONS.map((section) => section.title),
    ["Overview", "Up Next", "Pinned", "Game Page Badges", "Halloween"],
  );
  assert.ok(WHATS_NEW_SECTIONS.every((section) => section.title.length <= 16));

  const releaseCopy = WHATS_NEW_SECTIONS.flatMap((section) => section.items).join(" ");
  assert.deepEqual(WHATS_NEW_SECTIONS.find((section) => section.title === "Up Next")?.items.slice(0, 2), [
    "Up Next recommends three achievements using progression and available provider data, with community rarity and RetroAchievements classifications where supported.",
    "Open a recommendation's details, jump to it in Achievements, or hide it. Manage Suggestions can restore individual choices or every hidden suggestion.",
  ]);
  assert.match(releaseCopy, /thumbtack controls/u);
  assert.match(releaseCopy, /Y Pin\/Unpin/u);
  assert.match(releaseCopy, /separate for each account and game/u);
  assert.match(releaseCopy, /Removing or completing a pin/u);
  assert.match(releaseCopy, /without changing your Beat\/Master goals/u);
  assert.match(releaseCopy, /Hardcore\/Softcore/u);
  assert.match(releaseCopy, /both settings default to On Focus/u);
  assert.match(releaseCopy, /three equal-height recommendation cards/u);
  assert.match(releaseCopy, /two-line description summaries/u);
  assert.match(releaseCopy, /Happy Halloween/u);
  assert.match(releaseCopy, /orange accents, deep purple surfaces, and mint highlights/u);
  assert.match(releaseCopy, /Down again at the bottom to reach Close/u);
  assert.doesNotMatch(releaseCopy, /Provider cooldowns|emulator ROM switches|verified subsets/u);
});

test("actual What's New tab handlers scroll first, then hand off to native Close from every subject", async () => {
  const notes = { scrollTop: 0, scrollHeight: 320, clientHeight: 160 };
  const document = {};
  const targets = new Map<string, object>();
  const content = { ownerDocument: document, querySelector: (selector: string) => targets.get(selector) ?? null };
  let refIndex = 0, closeFocuses = 0, sounds = 0, closeAvailable = true;
  const refs = [content, notes, null];
  const focusedTargets: unknown[] = [];
  const { WhatsNewContent } = await components("decky-whats-new-modal.tsx", ["WhatsNewContent", "consumeDirection", "focusAndConsume"], {
    createElement, Focusable: "native-focusable", WHATS_NEW_SECTIONS, APP_VERSION: "0.39.1", steamTheme,
    NOTES_VIEWPORT_HEIGHT_PX: 160, NOTES_SCROLL_STEP_PX: 48, versionStyle: {}, noteRowStyle: {},
    useRef: () => ({ current: refs[refIndex++] }), useState: (initial: unknown) => [initial, () => {}],
    useEffect: () => {}, useLayoutEffect: () => {}, getDeckyStandardModalContentStyle: () => ({}), getDeckyStandardModalTabStyle: () => ({}),
    GamepadButton: { DIR_UP: 9, DIR_DOWN: 10, DIR_LEFT: 11, DIR_RIGHT: 12 },
    takeDeckySteamGamepadFocus: (target: unknown) => { focusedTargets.push(target); return true; },
    playDeckySteamNavigationSound: () => { sounds++; },
  });
  const tree = WhatsNewContent({ focusCloseButton: () => { closeFocuses++; return closeAvailable; } });
  const tabs: any[] = [];
  function visit(node: any): void {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (node === null || typeof node !== "object") return;
    if (node.props?.["data-ac-whats-new-tab"] !== undefined) tabs.push(node);
    visit(node.props?.children);
  }
  visit(tree);
  assert.equal(tabs.length, WHATS_NEW_SECTIONS.length);
  function press(tab: any, button: number): number {
    let consumed = 0;
    tab.props.onGamepadDirection({ detail: { button }, preventDefault: () => { consumed++; }, stopPropagation: () => { consumed++; }, stopImmediatePropagation: () => { consumed++; } });
    return consumed;
  }
  for (const tab of tabs) {
    notes.scrollTop = 0;
    const before = closeFocuses;
    assert.equal(press(tab, 10), 3);
    assert.equal(notes.scrollTop, 48);
    assert.equal(closeFocuses, before, "scrolling does not move controller focus");
    while (notes.scrollTop < 160) assert.equal(press(tab, 10), 3);
    assert.equal(press(tab, 10), 3);
    assert.equal(closeFocuses, before + 1, "one Down at the bottom requests native Close once");
    assert.equal(press(tab, 9), 3);
    assert.equal(notes.scrollTop, 112, "Up still scrolls back through notes");
  }
  notes.scrollHeight = notes.clientHeight;
  notes.scrollTop = 0;
  const before = closeFocuses;
  assert.equal(press(tabs[0], 10), 3);
  assert.equal(closeFocuses, before + 1, "short notes reach Close with one Down");
  closeAvailable = false;
  const previousSounds = sounds;
  assert.equal(press(tabs[0], 10), 0, "failed focus leaves Steam's default navigation available");
  assert.equal(sounds, previousSounds);
  assert.equal(press(tabs[0], 2), 0, "Back remains owned by the native modal");
  const nextTab = {};
  targets.set('[data-ac-whats-new-tab="1"]', nextTab);
  assert.equal(press(tabs[0], 12), 3);
  assert.equal(focusedTargets.at(-1), nextTab, "Left/Right still uses the existing subject handler");
});

test("standard modal exposes its existing native Close action without adding another focus target", async () => {
  let shown: any, focusClose: (() => boolean) | undefined, closes = 0, unregisters = 0;
  const targets: unknown[] = [];
  const { openDeckyStandardModal } = await components("decky-standard-modal.tsx", ["openDeckyStandardModal"], {
    createElement, createRef, ConfirmModal: "native-confirm",
    takeDeckySteamGamepadFocus: (target: unknown) => { targets.push(target); return target !== undefined; },
    showModal: (element: unknown) => { shown = element; return { Close: () => { closes++; } }; },
    registerDeckyFullscreenPopupCancel: () => () => { unregisters++; },
  });
  openDeckyStandardModal({ title: "Whats New", renderContent: (_close: unknown, focus: () => boolean) => { focusClose = focus; return "notes"; } });
  assert.equal(shown.type, "native-confirm");
  assert.equal(shown.props.children, "notes", "no new content wrapper or focus owner");
  const label = shown.props.strOKButtonText;
  assert.equal(label.type, "span");
  assert.equal(label.props.children, "Close");
  assert.equal(label.props.tabIndex, undefined);
  assert.equal(focusClose?.(), false, "unmounted action cannot take focus");
  const nativeButton = {};
  label.ref.current = { closest: (selector: string) => { assert.equal(selector, "button, [role='button'], [tabindex]"); return nativeButton; } };
  assert.equal(focusClose?.(), true);
  assert.equal(targets.at(-1), nativeButton);
  assert.equal(closes, 0, "moving focus never activates Close");
  assert.equal(shown.props.onOK, shown.props.onCancel);
  shown.props.onOK(); shown.props.onCancel();
  assert.equal(closes, 1); assert.equal(unregisters, 1);
});

test("What's New wires the native Close focus handoff through the shared shell", async () => {
  let options: any;
  const { openDeckyWhatsNewModal } = await components("decky-whats-new-modal.tsx", ["openDeckyWhatsNewModal"], {
    createElement, WhatsNewTitle: "title", WhatsNewContent: "content", openDeckyStandardModal: (value: unknown) => { options = value; },
  });
  openDeckyWhatsNewModal();
  assert.equal(options.stabilizeCloseFocus, true);
  const focusClose = () => true;
  assert.equal(options.renderContent(() => {}, focusClose).props.focusCloseButton, focusClose);
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
