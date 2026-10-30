import assert from "node:assert/strict";
import test from "node:test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { APPEARANCE_SETTING_KEYS, ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY as KEY, DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS as defaults, parseAchievementCompanionSettings, withDefaultAppearanceSettings } from "../src/core/settings";
import { createDeckySettingsStore, loadDeckySettings, readDeckySettings, resetDeckyAppearanceSettings } from "../src/platform/decky/decky-settings";
import { subscribeDeckyRaNativeAchievementInvalidation } from "../src/platform/decky/decky-ra-native-achievement-invalidation";
import { getAppearanceSettingsRowStyle, getCompactAppearanceValueLabel, getNativeAppearanceSettingsRowsCss } from "../src/platform/decky/decky-appearance-settings-layout";
import { components } from "./helpers/decky-component-declarations";

const changed = { ...defaults, theme: "ac-ember", showGamePageAchievementBadge: false, gamePageAchievementBadgeStyle: "minimal", gamePageAchievementBadgeSize: "large", gamePageAchievementBadgePosition: "bottom-right", gamePageUpNextPreview: "always", gamePageUpNextDescription: "hidden", gamePageAchievementBadgeColors: { perfected: "red", mastered: "blue", beaten: "gold", inProgress: "green", futureColor: "kept" }, retroAchievementsAchievementMode: "hardcore", recentAchievementsCount: 10, automaticUpdateChecks: false, futureSetting: { keep: [1, 2] } };

test("appearance defaults patch exactly its schema-owned fields and retains unrelated/unknown values", () => {
  const result = withDefaultAppearanceSettings(changed);
  for (const key of APPEARANCE_SETTING_KEYS) {
    if (key !== "gamePageAchievementBadgeColors") assert.deepEqual(result[key], defaults[key]);
  }
  assert.deepEqual(result.gamePageAchievementBadgeColors, { ...defaults.gamePageAchievementBadgeColors, futureColor: "kept" });
  for (const key of Object.keys(changed).filter((key) => !(APPEARANCE_SETTING_KEYS as readonly string[]).includes(key))) assert.deepEqual(result[key], changed[key as keyof typeof changed]);
  assert.deepEqual(withDefaultAppearanceSettings(result), result);
  assert.equal(withDefaultAppearanceSettings(undefined).gamePageAchievementBadgeSize, "small", "reset uses fresh defaults, not the old-record Large migration");
  assert.equal(changed.theme, "ac-ember", "does not mutate the current document");
});

test("confirmed reset persists through the actual store, preserves raw unknown fields after loading, and does not invalidate provider data", async () => {
  const previousLocal = globalThis.localStorage, previousSession = globalThis.sessionStorage;
  const records = new Map([[KEY, JSON.stringify(changed)], ["provider-credentials", "private sentinel"], ["achievement-companion:game-overview:v1", '{"pinnedAchievements":{"target":"kept"},"hiddenSuggestions":["kept"],"goals":"kept"}']]);
  const protectedBefore = [...records].filter(([key]) => key !== KEY);
  let writes = 0, invalidations = 0;
  const stop = subscribeDeckyRaNativeAchievementInvalidation(() => { invalidations++; });
  globalThis.localStorage = { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, text: string) => { writes++; records.set(key, text); } } as Storage;
  globalThis.sessionStorage = undefined as unknown as Storage;
  try {
    await loadDeckySettings(); // Its normalized in-memory cache omits futureSetting.
    records.set(KEY, JSON.stringify({ ...changed, recentAchievementsCount: 7 }));
    assert.equal(await resetDeckyAppearanceSettings(), true);
    const saved = JSON.parse(records.get(KEY)!);
    assert.deepEqual(saved, withDefaultAppearanceSettings({ ...changed, recentAchievementsCount: 7 }), "read latest raw data at confirmation time");
    assert.deepEqual(readDeckySettings(), parseAchievementCompanionSettings(records.get(KEY)));
    assert.equal((await loadDeckySettings()).gamePageUpNextDescription, "focus");
    assert.equal(await resetDeckyAppearanceSettings(), true);
    assert.equal(writes, 2); assert.equal(invalidations, 0);
    assert.deepEqual([...records].filter(([key]) => key !== KEY), protectedBefore, "credentials and game preferences are untouched");
  } finally { stop(); globalThis.localStorage = previousLocal; globalThis.sessionStorage = previousSession; }
});

test("confirmation Cancel/B makes no writes; OK performs one reset even when activated twice", async () => {
  let calls = 0, closed = 0;
  let finish!: (value: boolean) => void;
  const { AppearanceResetConfirmation } = await components("decky-reset-appearance-button.tsx", ["AppearanceResetConfirmation"], {
    createElement, ConfirmModal: "native-confirm", useState: () => [false, () => {}], useRef: (current: unknown) => ({ current }),
    resetDeckyAppearanceSettings: () => { calls++; return new Promise<boolean>((resolve) => { finish = resolve; }); },
  });
  const cancel = AppearanceResetConfirmation({ closeModal: () => { closed++; } });
  assert.equal(cancel.type, "native-confirm"); assert.equal(cancel.props.strCancelButtonText, "Cancel");
  assert.equal(cancel.props.strOKButtonText, "Reset to Defaults");
  cancel.props.onCancel(); assert.equal(calls, 0); assert.equal(closed, 1);
  const confirm = AppearanceResetConfirmation({ closeModal: () => { closed++; } });
  const first = confirm.props.onOK(); const repeated = confirm.props.onOK();
  assert.equal(calls, 1); finish(true); await Promise.all([first, repeated]); assert.equal(closed, 2);
});

test("failed persistence leaves stored appearance intact and keeps confirmation open", async () => {
  const previousLocal = globalThis.localStorage, previousSession = globalThis.sessionStorage;
  const raw = JSON.stringify(changed);
  globalThis.localStorage = { getItem: () => raw, setItem: () => { throw new Error("quota"); } } as unknown as Storage;
  globalThis.sessionStorage = undefined as unknown as Storage;
  try {
    await loadDeckySettings();
    const before = readDeckySettings();
    assert.equal(await resetDeckyAppearanceSettings(), false);
    assert.deepEqual(readDeckySettings(), before); assert.equal(localStorage.getItem(KEY), raw);
  } finally { globalThis.localStorage = previousLocal; globalThis.sessionStorage = previousSession; }
  let closed = 0;
  const errors: unknown[] = [];
  const { AppearanceResetConfirmation } = await components("decky-reset-appearance-button.tsx", ["AppearanceResetConfirmation"], {
    createElement, ConfirmModal: "native-confirm", useState: () => [false, (value: unknown) => errors.push(value)], useRef: (current: unknown) => ({ current }), resetDeckyAppearanceSettings: async () => false,
  });
  await AppearanceResetConfirmation({ closeModal: () => { closed++; } }).props.onOK();
  assert.equal(closed, 0); assert.ok(errors.includes(true));
});

test("the existing store notifies mounted settings subscribers after a reset without changing achievement mode", async () => {
  let raw = JSON.stringify(changed), notifications = 0, invalidations = 0;
  const store = await components("decky-settings.ts", ["deckySettingsRevision", "cachedDeckySettingsText", "deckySettingsListeners", "notifyDeckySettingsChanged", "subscribeDeckySettings", "readDeckySettingsText", "readDeckySettings", "createDeckySettingsStore", "resetDeckyAppearanceSettings"], {
    ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY: KEY, parseAchievementCompanionSettings, withDefaultAppearanceSettings,
    readDeckyStorageText: () => raw, writeDeckyStorageTextPreservingExisting: (_key: string, next: string) => { raw = next; return true; },
    publishDeckyRaNativeAchievementInvalidation: () => { invalidations++; },
  });
  const stop = store.subscribeDeckySettings(() => { notifications++; });
  await store.resetDeckyAppearanceSettings();
  assert.equal(notifications, 1); assert.equal(invalidations, 0);
  assert.equal(store.readDeckySettings().theme, defaults.theme);
  assert.equal(store.readDeckySettings().retroAchievementsAchievementMode, "hardcore");
  stop(); await store.resetDeckyAppearanceSettings(); assert.equal(notifications, 1);
});

test("native appearance dropdowns and toggles retain their primitives, guard and existing accordion hierarchy", async () => {
  const [bootstrap, shared] = await Promise.all(["bootstrap.tsx", "decky-shared-appearance-settings.tsx"].map((file) => readFile(new URL(`../src/platform/decky/${file}`, import.meta.url), "utf8")));
  assert.match(bootstrap, /label="Theme Settings"[\s\S]*label="Game Badge Settings"/);
  assert.match(bootstrap, /<DeckyAppearanceSettingsRow><ToggleField/);
  assert.match(bootstrap, /<DeckyResetAppearanceButton compact \/>[\s\S]*<\/div>\s*<\/PanelSection>/);
  assert.doesNotMatch(bootstrap, /width: 124px|<select/);
  assert.match(shared, /<DeckySettingsDropdown appearance/);
  let guardCalls = 0;
  const guard = () => { guardCalls++; };
  const { GamePageUpNextDisplayDropdown } = await components("bootstrap.tsx", ["GamePageUpNextDisplayDropdown", "getGamePageBadgeLabelStyle", "getGamePageBadgeDescriptionStyle"], {
    createElement, DeckyAppearanceSettingsRow: "appearance-row", DropdownItem: "native-dropdown-item", renderAppearanceDropdownValue: (value: unknown) => value,
    useDeckyCompactDropdownPopupGuard: () => guard, steamTheme: { color: {} }, GAME_PAGE_UP_NEXT_PREVIEW_OPTIONS: ["focus", "always", "hidden"],
  });
  const control = GamePageUpNextDisplayDropdown({ mode: "always", disabled: false, setting: "gamePageUpNextPreview", label: "Up Next Preview" }).props.children;
  assert.equal(control.type, "native-dropdown-item"); assert.equal(control.props.selectedOption, "always");
  assert.equal(control.props.childrenContainerWidth, "max", "native grow avoids QAM's 270px fixed preset and 50% narrow cap");
  assert.equal(control.props.rgOptions[1].label, "Always Show"); control.props.onMenuWillOpen(); assert.equal(guardCalls, 1);
  assert.equal(getCompactAppearanceValueLabel("Always Show"), "Always");
  assert.equal(getCompactAppearanceValueLabel("Blue (Default)"), "Blue");
});

test("native reset modal uses compact-session protection and releases ownership once on Cancel", async () => {
  let releases = 0, closes = 0, unregisters = 0;
  let shown: any, registered: (() => void) | undefined;
  const { openAppearanceResetConfirmation } = await components("decky-reset-appearance-button.tsx", ["openAppearanceResetConfirmation"], {
    createElement, AppearanceResetConfirmation: "native-confirm-wrapper", beginDeckyCompactPopup: () => () => { releases++; },
    registerDeckyFullscreenPopupCancel: (callback: () => void) => { registered = callback; return () => { unregisters++; }; },
    showModal: (element: unknown, parent: unknown, options: any) => {
      assert.equal(parent, undefined, "let Steam resolve its native modal window; never pass a button element");
      assert.equal(options.bHideMainWindowForPopouts, false);
      shown = element; return { Close: () => { closes++; } };
    },
  });
  openAppearanceResetConfirmation(true);
  shown.props.closeModal(); registered?.();
  assert.equal(releases, 1); assert.equal(closes, 1); assert.equal(unregisters, 1);
});

test("reset remains a native button and joins the existing fullscreen control traversal", async () => {
  const direction = () => {};
  let opened = 0;
  const { DeckyResetAppearanceButton } = await components("decky-reset-appearance-button.tsx", ["DeckyResetAppearanceButton"], {
    createElement, DialogButton: "native-dialog-button", useRef: () => ({ current: null }), steamTheme: { color: {} },
    openAppearanceResetConfirmation: () => { opened++; },
  });
  const button = DeckyResetAppearanceButton({ onGamepadDirection: direction });
  assert.equal(button.type, "native-dialog-button"); assert.equal(button.props.className, "ac-settings-action");
  assert.equal(button.props.style.color, undefined, "native focus foreground must not be overridden by a light inline color");
  assert.equal(button.props.tabIndex, undefined, "native DialogButton owns its tab stop"); assert.equal(button.props.onGamepadDirection, direction);
  assert.equal(button.props.onActivate, undefined, "one native activation path"); button.props.onClick(); assert.equal(opened, 1);
});

test("responsive native appearance rows align controls and show full selected values without overflow", { skip: !process.env.AC_LAYOUT_BROWSER }, async () => {
  const output = resolve(".tmp/up-next-pins/appearance-layout"); await mkdir(output, { recursive: true });
  const rows = [
    ["Theme", "", "Blue (Default)"], ["Show game page badge", "Show achievement progress on game pages.", "toggle"],
    ["Up Next Preview", "When to display your next achievement.", "Always Show"], ["Achievement Description", "When to show the achievement requirement.", "Always Show"],
    ["Badge style", "", "Minimal"], ["Badge size", "", "Large"], ["Badge position", "", "Bottom Center"],
    ["Beschreibung der nächsten Errungenschaft", "Längere übersetzte Beschreibung der Einstellung.", "Immer anzeigen"],
  ];
  const field = (label: string, description: string, value: string) => `<div data-ac-appearance-row><div class="native-field${value === "toggle" ? "" : " native-grow"}"><div><div>${label}</div>${description ? `<small>${description}</small>` : ""}</div><div><div class="native-inner"><div>${value === "toggle" ? '<span class="toggle" data-control></span>' : `<button data-control role="combobox"><span class="DialogDropDown_CurrentDisplay"><span class="ac-appearance-value">${getCompactAppearanceValueLabel(value)}</span></span><span>▾</span></button>`}</div></div></div></div></div>`;
  const sections = [220, 246.67, 300, 700].map((width) => `<section data-width="${width}" style="width:${width}px">${rows.map((row) => field(...row as [string, string, string])).join("")}</section>`).join("");
  const html = `<!doctype html><style>body{font:16px Arial}section{margin-bottom:20px}button{font:inherit;padding:10px 16px;display:flex;gap:8px;align-items:center;justify-content:space-between}.DialogDropDown_CurrentDisplay{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}small{display:block;line-height:1.25}.toggle{display:block;width:40px;height:24px;background:gray}
    .native-field:not(.native-grow).native-field:not(.below) > :last-child {max-width:50%}
    #QuickAccess-Menu .native-field.native-fixed .native-inner {min-width:270px}
    ${getNativeAppearanceSettingsRowsCss("native-field")}</style><div id="QuickAccess-Menu">${sections}</div><pre id="measurements"></pre><script>
    const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height}};
    document.getElementById('measurements').textContent=JSON.stringify([...document.querySelectorAll('section')].map(s=>({width:Number(s.dataset.width),overflow:s.scrollWidth-s.clientWidth,rows:[...s.querySelectorAll('[data-ac-appearance-row]')].map(r=>({label:rect(r.firstElementChild.firstElementChild),field:rect(r.firstElementChild),control:rect(r.querySelector('[data-control]')),value:r.querySelector('.DialogDropDown_CurrentDisplay')?{scroll:r.querySelector('.DialogDropDown_CurrentDisplay').scrollWidth,client:r.querySelector('.DialogDropDown_CurrentDisplay').clientWidth}:null}))})));
  </script>`;
  const file = resolve(output, "rows.html"); await writeFile(file, html);
  const result = spawnSync(process.env.AC_LAYOUT_BROWSER!, ["--headless", "--disable-gpu", "--disable-extensions", "--disable-background-networking", "--no-first-run", `--user-data-dir=${resolve(output, "browser-profile")}`, "--virtual-time-budget=1000", "--dump-dom", pathToFileURL(file).href], { encoding: "utf8", timeout: 45000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr.slice(-500));
  const reports = JSON.parse(/<pre id="measurements">([^<]+)<\/pre>/.exec(result.stdout)![1]!);
  await writeFile(resolve(output, "measurements.json"), JSON.stringify(reports, null, 2));
  for (const report of reports) {
    assert.ok(report.overflow <= 1);
    for (const row of report.rows) {
      assert.ok(Math.abs(row.label.left - report.rows[0].label.left) < 1);
      assert.ok(Math.abs(row.control.right - report.rows[0].control.right) < 1);
      if (row.value) assert.ok(row.value.scroll <= row.value.client + 1, "selected values wrap rather than truncate");
    }
    if (report.width <= 300) assert.ok(report.rows[3].field.height > report.rows[4].field.height, "wrapped supporting text may increase row height");
  }
  assert.equal(getAppearanceSettingsRowStyle().display, "grid");
});
