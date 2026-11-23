import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GameDetailSnapshot } from "../src/core/domain";
import { DeckyPinnedAchievementCard, pinnedCompletionModeLabel } from "../src/platform/decky/decky-pinned-achievement-card";
import type { SteamHuntersEnrichedGameDetailSnapshot } from "../src/providers/steamhunters";
import { pinnedModalHarness } from "./helpers/pinned-modal-render";

const pin = { providerId: "retroachievements", gameId: "1", accountId: "test", achievementId: "a", completionMode: "hardcore" as const };
const snapshot: GameDetailSnapshot = {
  game: {
    providerId: "retroachievements", gameId: "1", title: "A game", platformLabel: "Nintendo 64", coverImageUrl: "game.png",
    status: "in_progress", summary: { unlockedCount: 0, totalCount: 1 }, metrics: [],
  },
  achievements: [{
    providerId: "retroachievements", gameId: "1", achievementId: "a", title: "An achievement",
    description: "Complete a task", badgeImageUrl: "achievement.png", isUnlocked: false, metrics: [],
  }],
};

function detailMetricPairs(section: string) {
  return [...section.matchAll(/<dt[^>]*>([^<]+)<\/dt><dd[^>]*>([^<]+)<\/dd>/gu)].map(([, label, value]) => [label, value]);
}

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

test("native pinned list uses Steam buttons and the same account-scoped pins", () => {
  const accounts = { steam: "current", retroachievements: "test" };
  const pins = [pin, { ...pin, providerId: "steam", accountId: "current" }];
  const metadata = { '["retroachievements","test","1"]': { status: "success", data: snapshot } };
  const harness = pinnedModalHarness({ pins, accounts, metadata });
  const props = { initialProvider: "retroachievements", focusCloseButton: () => true, onDetails: () => {} };
  const native = renderToStaticMarkup(createElement(harness.exports.PinnedAchievementsContent, { ...props, native: true }));
  assert.match(native, /Steam \(1\)/u);
  assert.match(native, /RetroAchievements \(1\)/u);
  assert.match(native, /A game.*An achievement.*Complete a task/u);
  assert.match(native, /<button[^>]*>Details<\/button>.*<button[^>]*>Unpin<\/button>/u);
  assert.doesNotMatch(native, /var\(--ac-/u);
  const actions = harness.controls.filter((control) => control.children === "Details" || control.children === "Unpin");
  assert.deepEqual(actions.map(({ style }) => [style.width, style.minWidth, style.minHeight]), [["auto", 0, 36], ["auto", 0, 36]]);
  actions[1].onClick();
  assert.deepEqual(harness.removed, [[pin, "a"]]);

  const compact = renderToStaticMarkup(createElement(harness.exports.PinnedAchievementsContent, props));
  assert.match(compact, /var\(--ac-content-card/u);
  assert.doesNotMatch(compact, /<button/u);
});

test("native details group achievement and community metrics and return to the originating pin", () => {
  const harness = pinnedModalHarness({ pins: [pin], accounts: { retroachievements: "test" } });
  const achievement = snapshot.achievements[0]!;
  const detailSnapshot: GameDetailSnapshot = {
    game: { ...snapshot.game, metrics: [{ key: "total-players", label: "Total Players", value: "120" }] },
    achievements: [{ ...achievement, classification: "missable", points: 5, metrics: [
      { key: "author", label: "Author", value: "RA Author" },
      { key: "true-ratio", label: "RetroPoints", value: "17" },
      { key: "unlocked-count", label: "Players unlocked", value: "30" },
    ] }],
  };
  const compactOrigin = harness.navigation.readDeckyCompactNavigation();
  let restores = 0;
  harness.exports.openDeckyNativePinnedAchievementsModal({ providerId: "retroachievements", onClose: () => restores++ });
  const list = harness.opened[0];
  assert.equal(list.title, "Pinned Achievements");
  assert.equal(list.viewportSafe, true);
  assert.ok(!list.preserveCompactSession);
  const content = list.renderContent(() => list.onClose(), () => true);
  assert.equal(content.props.native, true);
  content.props.onDetails(pin, detailSnapshot);

  const details = harness.opened[1];
  assert.equal(details.title, "Achievement Details");
  assert.ok(!details.preserveCompactSession);
  assert.equal(harness.details.length, 0);
  assert.equal(restores, 0);
  const html = renderToStaticMarkup(details.renderContent(() => {}, () => true));
  assert.match(html, /An achievement.*Complete a task/u);
  assert.match(html, /<header[^>]*>.*?A game.*?Hardcore.*?<\/header>/u);
  assert.doesNotMatch(html, /Your Unlock|\bLocked\b|Not yet unlocked/iu);
  const sections = html.match(/<section[^>]*>.*?<\/section>/gu) ?? [];
  assert.equal(sections.length, 2);
  const [achievementInfo, community] = sections;
  assert.ok(achievementInfo && community);
  assert.match(achievementInfo, />Achievement<\/h3>/u);
  assert.match(community, /Community.*RetroAchievements/u);
  assert.deepEqual(detailMetricPairs(achievementInfo), [
    ["Type", "Missable"], ["Author", "RA Author"], ["Points", "5"], ["RetroPoints", "17"],
  ]);
  assert.deepEqual(detailMetricPairs(community), [["Unlock rate", "25.00%"], ["Players unlocked", "30"]]);

  details.onClose();
  const reopened = harness.opened[2];
  const returned = reopened.renderContent(() => {}, () => true);
  assert.equal(returned.props.initialProvider, "retroachievements");
  assert.equal(returned.props.focusGameId, pin.gameId);
  assert.equal(restores, 0);
  reopened.onClose();
  assert.equal(restores, 1);
  assert.equal(harness.popup.hasActiveDeckyCompactPopup(), false);
  assert.deepEqual(harness.navigation.readDeckyCompactNavigation(), compactOrigin);
});

test("Steam native details use one Community panel when achievement metadata is absent", () => {
  const steamPin = { ...pin, providerId: "steam", accountId: "current", completionMode: "both" as const };
  const achievement = snapshot.achievements[0]!;
  const steamSnapshot: SteamHuntersEnrichedGameDetailSnapshot = {
    game: { ...snapshot.game, providerId: "steam" },
    achievements: [{ ...achievement, providerId: "steam", metrics: [{ key: "global-percent", label: "Global Unlock Rate", value: "42.3" }] }],
    steamHunters: {
      source: "steamhunters", app: { appId: 1, playersQualifiedCount: 100, tags: [] },
      achievementsBySteamAchievementId: { a: { apiName: "a", localPercentage: 25, obtainability: "obtainable" } },
      achievementGroups: [], achievementGroupsBySteamAchievementId: {},
    },
  };
  const harness = pinnedModalHarness({ pins: [steamPin], accounts: { steam: "current" } });
  harness.exports.openDeckyNativePinnedAchievementsModal({ providerId: "steam", onClose: () => {} });
  const list = harness.opened[0];
  list.renderContent(() => list.onClose(), () => true).props.onDetails(steamPin, steamSnapshot);

  const html = renderToStaticMarkup(harness.opened[1].renderContent(() => {}, () => true));
  const sections = html.match(/<section[^>]*>.*?<\/section>/gu) ?? [];
  assert.equal(sections.length, 1);
  const [community] = sections;
  assert.ok(community);
  assert.match(community, /Community.*SteamHunters · Steam/u);
  assert.deepEqual(detailMetricPairs(community), [
    ["Qualified unlock rate", "25%"], ["Players unlocked", "25 / 100"], ["Steam global unlock rate", "42.3%"],
  ]);
  assert.doesNotMatch(html, /Your Unlock|\bLocked\b|Not yet unlocked/iu);
});
