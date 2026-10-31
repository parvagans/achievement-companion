import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readCompactCalendarExpanded, saveCompactCalendarExpanded } from "../src/platform/decky/decky-compact-calendar-preference";
import { createGameOverviewPreferencesStore, enumeratePinnedAchievements } from "../src/platform/decky/decky-game-overview-preferences";
import { createPinnedMetadataResolver, pinnedGamesNearViewport } from "../src/platform/decky/decky-pinned-achievements-model";
import { loadLocalComponent } from "./helpers/render-decky-component";
import type { GameDetailSnapshot } from "../src/core/domain";
import { pinnedModalHarness } from "./helpers/pinned-modal-render";

test("calendar is collapsed by default, persists per provider and tolerates unavailable storage", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  assert.equal(readCompactCalendarExpanded("steam", storage), false);
  saveCompactCalendarExpanded("steam", true, storage);
  assert.equal(readCompactCalendarExpanded("steam", storage), true);
  assert.equal(readCompactCalendarExpanded("retroachievements", storage), false);
  saveCompactCalendarExpanded("steam", false, storage);
  assert.equal(readCompactCalendarExpanded("steam", storage), false);
  assert.equal(readCompactCalendarExpanded("steam", { getItem: () => { throw Error(); } }), false);
});

test("calendar disclosure preserves hidden selection, exposes clear, and only mounts expanded content", () => {
  for (const providerId of ["steam", "retroachievements"]) for (const expanded of [false, true]) {
    const events: unknown[] = [];
    const { exports, controls } = loadLocalComponent("src/platform/decky/decky-compact-calendar-disclosure.tsx", {
      "./decky-compact-calendar-preference": { useCompactCalendarExpanded: () => [expanded, (value: boolean) => events.push(value)] },
      "./decky-focus-scroll": { scrollDeckyFocusTargetIntoView: () => {} },
      "./decky-steam-gamepad-focus": { requestDeckySteamGamepadFocusAfterMount: () => events.push("restore") },
    });
    const target = { preferredFocus: false, onActivated: () => {}, onFocused: () => {}, elementRef: () => {} };
    const html = renderToStaticMarkup(createElement(exports.DeckyCompactCalendarDisclosure, { providerId, weeks: 12, selectedDay: new Date(2026, 9, 25).getTime(), onClear: () => events.push("clear"), onCancel: () => events.push("back"), targetProps: target, clearTargetProps: target, children: createElement("div", { "data-calendar": true }, "calendar") }));
    assert.equal(html.includes("data-calendar="), expanded);
    assert.ok(html.includes("Filtered:"));
    assert.ok(html.includes("Clear date filter"));
    controls[0].onActivate();
    assert.deepEqual(events, [!expanded, "restore"]);
    controls[1].onActivate();
    assert.deepEqual(events.slice(2), ["clear", "restore"]);
    assert.doesNotMatch(html, /Press A to use/u);
  }
});

test("pin enumeration isolates providers/accounts and unpin keeps the authoritative store", () => {
  let text: string | null = null;
  const store = createGameOverviewPreferencesStore({ getItem: () => text, setItem: (_key, value) => { text = value; } });
  const steam = { providerId: "steam", gameId: "1", accountId: "current" };
  store.pinAchievement(steam, "a", "both");
  store.pinAchievement({ ...steam, accountId: "old" }, "secret");
  store.pinAchievement({ providerId: "retroachievements", gameId: "2", accountId: "ra" }, "b", "hardcore");
  const accounts = { steam: "current", retroachievements: "ra" };
  const pins = enumeratePinnedAchievements(store.read(), accounts);
  assert.deepEqual(pins.map((pin) => pin.achievementId), ["a", "b"]);
  assert.equal(pins[1]?.completionMode, "hardcore");
  assert.deepEqual(enumeratePinnedAchievements(store.read(), {}), []);
  store.unpinAchievement(steam, "a");
  assert.deepEqual(enumeratePinnedAchievements(store.read(), accounts).map((pin) => pin.achievementId), ["b"]);
  assert.equal(store.readPinnedAchievement({ ...steam, accountId: "old" })?.achievementId, "secret");
});

test("metadata hydration reuses canonical snapshots, bounds concurrency and discards cancelled/account-changed work", async () => {
  let calls = 0, running = 0, maximum = 0;
  const state = { status: "success" as const, data: {} as GameDetailSnapshot, isStale: false, isRefreshing: false };
  const resolve = createPinnedMetadataResolver({ read: (pin) => pin.gameId === "1" ? state : undefined,
    load: async () => { calls++; maximum = Math.max(maximum, ++running); await new Promise((done) => setTimeout(done, 2)); running--; return state; } });
  const pin = { providerId: "steam", gameId: "1", accountId: "current", achievementId: "a", completionMode: "both" as const };
  assert.equal(await resolve(pin, () => true), state);
  assert.equal(calls, 0);
  await Promise.all([resolve({ ...pin, gameId: "2" }, () => true), resolve({ ...pin, gameId: "3" }, () => true)]);
  assert.equal(maximum, 1);
  assert.equal(await resolve(pin, () => false), undefined);
  assert.equal(calls, 2);
  let current = true;
  const changing = createPinnedMetadataResolver({ read: () => undefined, load: async () => { current = false; return state; } });
  assert.equal(await changing(pin, () => current), undefined);
});

test("opening the viewer does not hydrate every offscreen pin", () => {
  const rows = Array.from({ length: 100 }, (_, index) => ({ gameId: String(index), top: index * 100, bottom: index * 100 + 90 }));
  assert.deepEqual(pinnedGamesNearViewport(rows, { top: 0, bottom: 220 }), ["0", "1", "2", "3"]);
  assert.deepEqual(pinnedGamesNearViewport(rows, { top: 5000, bottom: 5220 }), ["48", "49", "50", "51", "52", "53"]);
});

test("pinned viewer shows real provider counts, bounded content, metadata and isolated empty states", () => {
  const pin = { providerId: "steam", gameId: "1", accountId: "current", achievementId: "a", completionMode: "both" };
  const snapshot = { game: { providerId: "steam", gameId: "1", title: "Game One" }, achievements: [{ achievementId: "a", title: "Real achievement", description: "Actual description" }] };
  const harness = pinnedModalHarness({ pins: [pin], metadata: { '["steam","current","1"]': { status: "success", data: snapshot } } });
  const html = renderToStaticMarkup(createElement(harness.exports.PinnedAchievementsContent, { initialProvider: "steam", focusCloseButton: () => true, onDetails: () => {} }));
  assert.match(html, /Steam \(1\)/u);
  assert.match(html, /RetroAchievements \(0\)/u);
  assert.ok(html.includes("Game One") && html.includes("Real achievement") && html.includes("Actual description"));
  assert.match(html, /height:220px;overflow-y:auto/u);
  assert.doesNotMatch(html, />View in Achievements</u);
  harness.controls.find((control) => control.onOKActionDescription === "Unpin").onActivate();
  assert.deepEqual(harness.removed, [[pin, "a"]]);
  const single = pinnedModalHarness({ accounts: { steam: "current" } });
  const empty = renderToStaticMarkup(createElement(single.exports.PinnedAchievementsContent, { initialProvider: "steam", focusCloseButton: () => true, onDetails: () => {} }));
  assert.ok(empty.includes("No pinned achievements yet."));
  assert.doesNotMatch(empty, /role="tablist"/u);
});

test("Details handoff closes the pinned native modal before opening details and preserves QAM ownership", () => {
  const harness = pinnedModalHarness();
  let restores = 0;
  harness.exports.openDeckyPinnedAchievementsModal({ providerId: "steam", onClose: () => restores++ });
  const modal = harness.opened[0];
  assert.equal(modal.title, "Pinned Achievements");
  assert.equal(modal.preserveCompactSession, true);
  assert.equal(modal.viewportSafe, true);
  let closed = false;
  const content = modal.renderContent(() => { closed = true; modal.onClose(); }, () => true);
  const pin = { providerId: "steam", gameId: "1", accountId: "current", achievementId: "a" };
  content.props.onDetails(pin, { game: { providerId: "steam", gameId: "1" } });
  assert.equal(closed, true);
  assert.equal(restores, 0);
  assert.equal(harness.details.length, 1);
  assert.equal(harness.popup.hasActiveDeckyCompactPopup(), true);
  harness.details[0].compactContext.onDismiss();
  assert.equal(harness.opened.length, 2);
  assert.equal(harness.opened[1].renderContent(() => {}, () => true).props.focusGameId, "1");
  assert.equal(harness.popup.hasActiveDeckyCompactPopup(), false);
  harness.opened[1].onClose();
  assert.equal(restores, 1);
});

test("Details View Game opens QAM game overview, and Back reopens the originating pin modal", () => {
  const harness = pinnedModalHarness();
  const nav = harness.navigation;
  nav.resetDeckyCompactNavigationForTests();
  nav.setDeckyCompactNavigation({ kind: "provider-dashboard", providerId: "steam" });
  let restores = 0;
  harness.exports.openDeckyPinnedAchievementsModal({ providerId: "steam", onClose: () => restores++ });
  const modal = harness.opened[0];
  const content = modal.renderContent(() => modal.onClose(), () => true);
  const pin = { providerId: "retroachievements", gameId: "2", accountId: "ra", achievementId: "b" };
  content.props.onDetails(pin, { game: { providerId: "retroachievements", gameId: "2", title: "Game Two" } });
  harness.details[0].compactContext.onViewGame();
  assert.deepEqual(nav.readDeckyCompactNavigation(), { kind: "game", providerId: "retroachievements", gameId: "2", gameTitle: "Game Two" });
  assert.equal(restores, 0);
  // Follow the same parent-navigation function that handles real QAM Back.
  nav.returnFromDeckyCompactDestination(nav.readDeckyCompactNavigation());
  assert.deepEqual(nav.readDeckyCompactNavigation(), { kind: "provider-dashboard", providerId: "steam" });
  assert.equal(harness.opened.length, 2);
  const returned = harness.opened[1].renderContent(() => {}, () => true);
  assert.equal(returned.props.initialProvider, "retroachievements");
  assert.equal(returned.props.focusGameId, "2");
  harness.opened[1].onClose();
  assert.equal(restores, 1);
  assert.equal(harness.popup.hasActiveDeckyCompactPopup(), false);
});

test("closing the compact session cancels a pending pin-modal return", () => {
  const harness = pinnedModalHarness();
  const nav = harness.navigation;
  nav.resetDeckyCompactNavigationForTests();
  nav.setDeckyCompactNavigation({ kind: "provider-dashboard", providerId: "steam" });
  harness.exports.openDeckyPinnedAchievementsModal({ providerId: "steam", onClose: () => {} });
  const modal = harness.opened[0];
  modal.renderContent(() => modal.onClose(), () => true).props.onDetails(
    { providerId: "steam", gameId: "1", accountId: "current", achievementId: "a" },
    { game: { providerId: "steam", gameId: "1", title: "Game One" } });
  harness.details[0].compactContext.onViewGame();
  nav.resetDeckyCompactNavigation();
  nav.setDeckyCompactNavigation({ kind: "provider-dashboard", providerId: "steam" });
  assert.equal(harness.opened.length, 1);
});
