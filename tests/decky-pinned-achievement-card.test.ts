import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GameDetailSnapshot } from "../src/core/domain";
import { DeckyPinnedAchievementCard, pinnedCompletionModeLabel } from "../src/platform/decky/decky-pinned-achievement-card";
import { pinnedModalHarness } from "./helpers/pinned-modal-render";

const pin = { providerId: "retroachievements", gameId: "1", accountId: "test", achievementId: "a", completionMode: "hardcore" as const };
const snapshot = {
  game: { providerId: "retroachievements", gameId: "1", title: "A game", platformLabel: "Nintendo 64", coverImageUrl: "game.png" },
  achievements: [{ achievementId: "a", title: "An achievement", description: "Complete a task", badgeImageUrl: "achievement.png" }],
} as GameDetailSnapshot;

test("card separates game identity from a wrapping achievement/action row, preserving text and artwork sizes", () => {
  const html = renderToStaticMarkup(createElement(DeckyPinnedAchievementCard, { pin, snapshot, loading: false, actions: createElement("button", null, "Details") }));
  assert.match(html, /data-ac-pin-achievement-row[^>]*flex-wrap:wrap/u);
  assert.match(html, /data-ac-pin-achievement-info[^>]*flex:1 1 240px/u);
  assert.match(html, /data-ac-pin-actions[^>]*flex:0 0 auto/u);
  assert.match(html, /width:32px;height:32px/u);
  assert.match(html, /width:40px;height:40px/u);
  assert.match(html, /font-size:14px/u);
  assert.match(html, /font-size:12px;line-height:1.3/u);
  assert.match(html, /Nintendo 64 · Hardcore/u);
  assert.equal((html.match(/-webkit-line-clamp:2/gu) ?? []).length, 3);
});

test("RA mode labels change presentation without changing saved values; Steam omits them", () => {
  for (const [completionMode, label] of [["hardcore", "Hardcore"], ["softcore", "Softcore"], ["both", "Both"]] as const) {
    assert.equal(pinnedCompletionModeLabel(completionMode), label);
    const html = renderToStaticMarkup(createElement(DeckyPinnedAchievementCard, { pin: { ...pin, completionMode }, snapshot, loading: false, actions: null }));
    assert.ok(html.includes(`Nintendo 64 · ${label}`));
  }
  const html = renderToStaticMarkup(createElement(DeckyPinnedAchievementCard, { pin: { ...pin, providerId: "steam" }, snapshot, loading: false, actions: null }));
  assert.doesNotMatch(html, /data-ac-pin-mode/u);
});

test("missing artwork and metadata keep useful content and existing actions", () => {
  for (const loading of [true, false]) {
    const html = renderToStaticMarkup(createElement(DeckyPinnedAchievementCard, { pin, snapshot: undefined, loading, actions: createElement("button", null, "Unpin") }));
    assert.match(html, /Game #1/u);
    assert.match(html, /Unpin/u);
    assert.ok(html.includes(loading ? "Loading pinned achievement" : "Your pin is saved"));
    assert.doesNotMatch(html, /<img/u);
  }
  const noArt = { ...snapshot, game: { ...snapshot.game, coverImageUrl: undefined }, achievements: [{ ...snapshot.achievements[0], badgeImageUrl: undefined }] } as unknown as GameDetailSnapshot;
  const html = renderToStaticMarkup(createElement(DeckyPinnedAchievementCard, { pin, snapshot: noArt, loading: false, actions: null }));
  assert.doesNotMatch(html, /<img/u);
  assert.match(html, /An achievement/u);
  assert.match(html, /Complete a task/u);
});

test("inline actions retain Details/Unpin order and the existing vertical row handoffs", () => {
  const pins = [pin, { ...pin, gameId: "2" }];
  const metadata = Object.fromEntries(pins.map((item) => [JSON.stringify([item.providerId, item.accountId, item.gameId]), { status: "success", data: snapshot }]));
  const harness = pinnedModalHarness({ pins, accounts: { retroachievements: "test" }, metadata });
  renderToStaticMarkup(createElement(harness.exports.PinnedAchievementsContent, { initialProvider: "retroachievements", focusCloseButton: () => true, onDetails: () => {} }));
  const actions = harness.controls.filter((item) => item.role === "button");
  assert.deepEqual(actions.map((item) => item.onOKActionDescription), ["Details", "Unpin", "Details", "Unpin"]);
  const first = {} as HTMLDivElement, second = {} as HTMLDivElement;
  actions[0].attach(first); actions[2].attach(second);
  const groups = harness.controls.filter((item) => item["flow-children"] === "left-right" && item.onGamepadDirection);
  assert.equal(groups.length, 2);
  let consumed = 0;
  const press = (button: number) => ({ detail: { button }, preventDefault: () => consumed++, stopPropagation: () => consumed++ });
  groups[0].onGamepadDirection(press(10));
  assert.equal(harness.focusedTargets.at(-1), second);
  groups[1].onGamepadDirection(press(9));
  assert.equal(harness.focusedTargets.at(-1), first);
  assert.equal(consumed, 4);
});
