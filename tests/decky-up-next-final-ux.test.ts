import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement, Fragment, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { components } from "./helpers/decky-component-declarations";
import { DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS, loadAchievementCompanionSettings, normalizeAchievementCompanionSettings, saveAchievementCompanionSettings } from "../src/core/settings";
import { DeckyNativeUpNextPreviewCard } from "../src/platform/decky/decky-native-up-next-preview-card";
import { createNativeUpNextPreviewSession, measureNativeUpNextPreviewPlacement, nativeUpNextPresentation, placeNativeUpNextPreview, shouldShowNativeUpNextPreview } from "../src/platform/decky/decky-native-up-next-preview-model";
import { DeckyAchievementArtwork } from "../src/platform/decky/decky-achievement-artwork";
import { DeckyAchievementTypeBadge } from "../src/platform/decky/decky-achievement-type-badge";
import { DeckyUpNextPinIcon } from "../src/platform/decky/decky-up-next-pin-icon";
import { createUpNextPinAction } from "../src/platform/decky/decky-up-next-pin-action";
import { achievementCompanionQamTheme, achievementCompanionAchievementRowRecipes, getQamCompactFocusControlStyle } from "../src/platform/decky/decky-qam-theme";
import { steamRecipes, steamTheme } from "../src/platform/decky/steam-theme";
import type { GameDetailSnapshot, NormalizedAchievement } from "../src/core/domain";

const modes = ["focus", "always", "hidden"] as const;
const achievement: NormalizedAchievement = { providerId: "steam", gameId: "1", achievementId: "one", title: "First target", description: "Original complete description.\n" + "Additional description text. ".repeat(40), classification: "progression", isUnlocked: false, metrics: [], badgeImageUrl: "original.png" };

test("description default/migration and all saved modes use the existing settings store", async () => {
  assert.equal(DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.gamePageUpNextDescription, "focus");
  for (const value of [undefined, {}, { gamePageUpNextDescription: "invalid" }, { gamePageUpNextPreview: "always", theme: "ac-ember" }]) {
    assert.equal(normalizeAchievementCompanionSettings(value).gamePageUpNextDescription, "focus");
  }
  let disk: string | undefined;
  const store = { read: async () => disk, write: async (_key: string, value: string) => { disk = value; }, delete: async () => {} };
  for (const mode of modes) {
    const settings = { ...DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS, gamePageUpNextDescription: mode, gamePageUpNextPreview: "always" as const, theme: "ac-ember" as const, retroAchievementsAchievementMode: "hardcore" as const };
    assert.equal(await saveAchievementCompanionSettings(store, settings), true);
    assert.deepEqual(await loadAchievementCompanionSettings({ ...store }), settings, "a new store owner reads the saved mode and unrelated preferences");
  }
});

test("all nine display combinations separate preview eligibility from complete Steam/RA description visibility", () => {
  for (const preview of modes) for (const description of modes) for (const focused of [false, true]) for (const hovered of [false, true]) {
    const active = shouldShowNativeUpNextPreview(preview, focused, hovered, { pageVisible: true, badgeEnabled: true });
    assert.equal(active, preview === "always" || preview === "focus" && (focused || hovered));
    for (const providerId of ["steam", "retroachievements"]) for (const pinned of [false, true]) {
      const html = active ? renderToStaticMarkup(createElement(DeckyNativeUpNextPreviewCard, { target: { achievement: { ...achievement, providerId }, pinned }, presentation: nativeUpNextPresentation(description, focused, hovered) })) : "";
      const expanded = active && (description === "always" || description === "focus" && (focused || hovered));
      assert.equal(html.includes("data-ac-up-next-description"), expanded);
      if (expanded) {
        assert.ok(html.includes(achievement.description!));
        assert.doesNotMatch(html.slice(html.indexOf("data-ac-up-next-description")), /line-clamp|text-overflow|overflow:hidden|max-height/);
      }
      for (const missing of [undefined, "", "   "]) {
        const compact = renderToStaticMarkup(createElement(DeckyNativeUpNextPreviewCard, { target: { achievement: { ...achievement, description: missing }, pinned }, presentation: nativeUpNextPresentation(description, focused, hovered) }));
        assert.doesNotMatch(compact, /data-ac-up-next-description/);
      }
    }
  }
});

test("description changes reuse a fresh canonical session and retain route/badge/Hidden guards", async () => {
  const snapshot: GameDetailSnapshot = { game: { providerId: "steam", gameId: "1", title: "Game", status: "in_progress", summary: { unlockedCount: 0, totalCount: 1 }, metrics: [] }, achievements: [achievement] };
  let requests = 0;
  const session = createNativeUpNextPreviewSession({ read: () => ({ status: "success", data: snapshot, isStale: false, isRefreshing: false }), load: async () => { requests++; throw new Error("unnecessary provider request"); } });
  for (const mode of ["focus", "always", "hidden", "always", "focus"] as const) {
    const state = await session.load();
    renderToStaticMarkup(createElement(DeckyNativeUpNextPreviewCard, { target: { achievement: state.data!.achievements[0]! }, presentation: nativeUpNextPresentation(mode, false, true) }));
    assert.equal(shouldShowNativeUpNextPreview("hidden", true, true), false);
    assert.equal(shouldShowNativeUpNextPreview("always", true, true, { pageVisible: false, badgeEnabled: true }), false);
    assert.equal(shouldShowNativeUpNextPreview("always", true, true, { pageVisible: true, badgeEnabled: false }), false);
  }
  assert.equal(requests, 0);
});

test("measured long-description fallback retries the same badge-relative placement and restores expansion after resize", () => {
  const description = { hidden: false };
  let expandedHeight = 600;
  const card = { querySelector: () => description, getBoundingClientRect: () => ({ width: 232, height: description.hidden ? 44 : expandedHeight }) } as unknown as HTMLElement;
  const badge = { left: 20, top: 20, right: 252, bottom: 78 };
  const hero = { left: 0, top: 0, right: 800, bottom: 350 };
  const viewport = { width: 800, height: 500 };
  const measure = () => measureNativeUpNextPreviewPlacement(card, (size) => placeNativeUpNextPreview(badge, hero, viewport, size, []));
  const compact = measure();
  assert.ok(compact); assert.equal(description.hidden, true); assert.equal(compact.right - compact.left, 232);
  expandedHeight = 110;
  const full = measure();
  assert.ok(full); assert.equal(description.hidden, false); assert.equal(full.bottom - full.top, 110);
  assert.equal(measureNativeUpNextPreviewPlacement(card, () => undefined), undefined, "only an unsafe compact card loses the entire indication");
  assert.equal(measureNativeUpNextPreviewPlacement({ querySelector: () => null, getBoundingClientRect: () => ({ width: 232, height: 44 }) } as unknown as HTMLElement, () => compact), compact);
});

// Execute the actual component declarations with a native Focusable boundary stub.
// This exercises emitted rows/handlers without loading Steam's unavailable runtime;
// native directional focus resolution and physical scroll still require Deck testing.
test("three actual fullscreen rows omit source labels and keep their native focus tree, metadata and pin slots stable", async () => {
  const Focusable = ({ children, style, ...props }: any) => createElement("div", { style, "aria-label": props["aria-label"], "aria-pressed": props["aria-pressed"] }, children);
  const deps = { createElement, Fragment, useState: () => [false, () => {}], Focusable, DeckyUpNextPinIcon, theme: achievementCompanionQamTheme, getQamCompactFocusControlStyle };
  const { DeckyUpNextPinButton } = await components("decky-up-next-pin-button.tsx", ["DeckyUpNextPinButton"], deps);
  const { SuggestionRow, DeckyOverviewCompanion } = await components("decky-full-screen-game-overview-content.tsx", ["SuggestionRow", "DeckyOverviewCompanion"], {
    ...deps, DeckyUpNextPinButton, createUpNextPinAction, DeckyAchievementArtwork, DeckyAchievementTypeBadge,
    NavEntryPositionPreferences: { FIRST: 1 }, achievementCompanionAchievementRowRecipes, steamTheme, steamRecipes,
    overviewMetadataStyle: steamRecipes.text("fullscreen", "metadata"), overviewPanelStyle: {},
    buildDeckyManageSuggestionsMenuItems: () => [], DeckyOverviewMenuButton: () => null,
  });
  let pinned = false;
  const focused: unknown[] = [], opened: string[] = [], hidden: string[] = [], jumped: string[] = [];
  const suggestions = [0, 1, 2].map((i) => ({ achievement: { ...achievement, achievementId: String(i), title: `Target ${i}` }, rarityPercent: 12, groupLabel: "Base game" }));
  const actions = { suggestions, hiddenSuggestions: [], goal: "master", onTogglePin: () => { pinned = !pinned; }, onFocusedSuggestionChange: (id: unknown) => focused.push(id), onFocusedPinChange: (id: unknown) => focused.push(id), onOpenAchievement: (id: string) => opened.push(id), onJumpToAchievement: (id: string) => jumped.push(id), onDismissSuggestion: (id: string) => hidden.push(id) };
  const section = DeckyOverviewCompanion({ actions, completed: false, history: null });
  const rows = section.props.children[1];
  assert.equal(rows.props["flow-children"], "column");
  assert.equal(rows.props.children.length, 3);
  assert.deepEqual(rows.props.children.map((e: ReactElement) => e.key), ["0", "1", "2"]);
  const html = renderToStaticMarkup(section);
  assert.doesNotMatch(html, /UP NEXT|data-ac-up-next-label/);
  assert.match(html, /Up Next/); assert.match(html, /Progression/); assert.match(html, /12% players/);
  for (const suggestion of suggestions) {
    const before = SuggestionRow({ suggestion, actions });
    assert.equal(before.props["flow-children"], "left-right");
    const row = before.props.children[0], pinElement = before.props.children[1];
    const pinControl = DeckyUpNextPinButton(pinElement.props);
    row.props.onGamepadFocus(); row.props.onActivate();
    const event = { preventDefault() {}, stopPropagation() {}, detail: { is_repeat: false } };
    row.props.onSecondaryButton(event); row.props.onOptionsButton(event);
    pinControl.props.onGamepadFocus(); pinControl.props.onActivate(); assert.equal(pinned, true);
    const after = SuggestionRow({ suggestion: { ...suggestion, pinned }, actions });
    assert.equal(after.type, before.type); assert.deepEqual(after.props.style, before.props.style);
    assert.equal(after.props.children[0].type, row.type); assert.equal(after.props.children[1].type, pinElement.type);
    assert.equal(renderToStaticMarkup(after.props.children[0]), renderToStaticMarkup(row), "achievement content geometry is identical across pin states");
    const unpinControl = DeckyUpNextPinButton(after.props.children[1].props);
    assert.equal(unpinControl.props.onOKActionDescription, "Unpin");
    assert.equal(unpinControl.props["aria-pressed"], true);
    for (const key of ["width", "height", "padding", "minHeight"]) assert.equal(unpinControl.props.style[key], pinControl.props.style[key]);
    unpinControl.props.onActivate(); assert.equal(pinned, false);
    assert.equal(DeckyUpNextPinButton(SuggestionRow({ suggestion, actions }).props.children[1].props).props.onOKActionDescription, "Pin");
  }
  assert.deepEqual(opened, ["0", "1", "2"]); assert.deepEqual(hidden, opened); assert.deepEqual(jumped, opened);
  assert.deepEqual(focused, ["0", "0", "1", "1", "2", "2"]);
});

test("both existing appearance surfaces expose the reactive description setting directly after preview", async () => {
  const [shared, bootstrap, preview] = await Promise.all(["decky-shared-appearance-settings.tsx", "bootstrap.tsx", "decky-native-up-next-preview.tsx"].map((file) => readFile(new URL(`../src/platform/decky/${file}`, import.meta.url), "utf8")));
  assert.match(shared, /label="Up Next Preview"[^\n]+\n\s*<DeckySettingsDropdown label="Achievement Description" value=\{settings.gamePageUpNextDescription\}/);
  assert.match(bootstrap, /label="Up Next Preview"[^\n]+\n\s*<GamePageUpNextDisplayDropdown label="Achievement Description" setting="gamePageUpNextDescription"/);
  assert.match(preview, /nativeUpNextPresentation\(settings.gamePageUpNextDescription, focused, hovered\)/);
  assert.match(preview, /\[active, presentation, target\?\.achievement, badge,/);
  assert.doesNotMatch(preview, /useQuickAccessVisible|createPortal|document\.body|setInterval/);
});
