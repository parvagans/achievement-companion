import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeckyNativeUpNextPreviewCard, NATIVE_UP_NEXT_PREVIEW_LAYOUT } from "../src/platform/decky/decky-native-up-next-preview-card";
import { isNativeGamePageSurfaceVisible, subscribeNativeGamePageVisibility } from "../src/platform/decky/decky-native-game-page-visibility";
import { createUpNextPinAction } from "../src/platform/decky/decky-up-next-pin-action";
import { DeckyUpNextPinIcon } from "../src/platform/decky/decky-up-next-pin-icon";
import { getAchievementCompanionThemeVariables } from "../src/platform/decky/decky-theme-palette";
import { DeckyAchievementArtwork } from "../src/platform/decky/decky-achievement-artwork";
import { NATIVE_BADGE_SURFACE } from "../src/platform/decky/decky-native-badge-surface";
import { resolveDeckyUpNextLabel } from "../src/platform/decky/decky-up-next-label";
import { normalizeSteamGameDetail } from "../src/providers/steam/mappers/normalize";
import { normalizeRetroAchievementsGameDetail } from "../src/providers/retroachievements/mappers/normalize";
import assert from "node:assert/strict";
import test from "node:test";
import type { GameDetailSnapshot, NormalizedAchievement } from "../src/core/domain";
import type { ResourceState } from "../src/core/cache";
import { normalizeAchievementCompanionSettings } from "../src/core/settings";
import { createGameOverviewPreferencesStore, gameOverviewPreferenceKey, parseGameOverviewPreferences, pinnedAchievementPreferenceKey, pinAchievement, readPinnedAchievement, subscribeToPinnedAchievementChanges, type PinnedAchievementScope } from "../src/platform/decky/decky-game-overview-preferences";
import { updateDeckyProviderConfigCache } from "../src/platform/decky/providers/provider-config-store";
import { publishDeckyGameDetail } from "../src/platform/decky/decky-game-detail-publication";
import { isPinnedAchievementComplete, selectGameOverviewSuggestions } from "../src/platform/decky/decky-game-overview-recommendations";
import { buildDeckyCompactUpNextModel, selectDeckyCompactUpNextCandidates } from "../src/platform/decky/decky-compact-up-next-model";
import { createNativeUpNextPreviewSession, nativeUpNextIdentity, placeNativeUpNextPreview, shouldShowNativeUpNextPreview, type PreviewRect } from "../src/platform/decky/decky-native-up-next-preview-model";
import { buildDeckyManageSuggestionsMenuItems } from "../src/platform/decky/decky-overview-menu-model";
import { createRetroAchievementsProvider } from "../src/providers/retroachievements/retroachievements.provider";
import { createDeckyRetroAchievementsTransport, resetDeckyRetroAchievementsTransportForTests } from "../src/platform/decky/providers/retroachievements/backend-transport";
import { setDeckyBackendCallImplementationForTests } from "../src/platform/decky/decky-backend-bridge";
import { createSteamProvider } from "../src/providers/steam/steam.provider";
import { createDeckySteamTransport } from "../src/platform/decky/providers/steam/backend-transport";
import { createAppServices } from "../src/core/app-services";
import { createProviderRegistry } from "../src/core/provider-registry";
import { createMemoryCacheStore } from "../src/platform/decky/memory-cache";
import type { PlatformServices } from "../src/core/platform";

const scope: PinnedAchievementScope = { providerId: "steam", gameId: "1", accountId: "76561198000000001" };
function storage(text?: string) {
  let value = text ?? null;
  return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
}
function row(id: string, patch: Partial<NormalizedAchievement> = {}): NormalizedAchievement {
  return { providerId: "steam", gameId: "1", achievementId: id, title: id, isUnlocked: false, metrics: [], ...patch };
}
function snapshot(achievements = [row("automatic"), row("manual")], providerId = "steam"): GameDetailSnapshot {
  return { game: { providerId, gameId: "1", title: "Game", status: "in_progress", summary: { unlockedCount: 0, totalCount: 50 }, metrics: [] }, achievements, achievementStateIsComplete: true };
}
const pin = { achievementId: "manual", completionMode: "both" as const };
const success = (data: GameDetailSnapshot): ResourceState<GameDetailSnapshot> => ({ status: "success", data, isStale: false, isRefreshing: false });

test("page ownership survives native overlays but rejects game changes, leaving the route and unmount", () => {
  const document = { visibilityState: "visible", location: { href: "https://steamloopback.host/routes/library/app/1" } };
  const badge = { isConnected: true, ownerDocument: document };
  const read = () => isNativeGamePageSurfaceVisible(badge as unknown as HTMLElement, "1");
  assert.equal(read(), true);
  // A native overlay can obscure its underlying browser view. That is not a route exit.
  document.visibilityState = "hidden"; assert.equal(read(), true); document.visibilityState = "visible";
  for (const route of ["/routes/library/app/2", "/achievement-companion/full-screen/game/steam/1", "/routes/settings"]) {
    document.location.href = "https://steamloopback.host" + route; assert.equal(read(), false);
  }
  document.location.href = "https://steamloopback.host/routes/library/home";
  assert.equal(isNativeGamePageSurfaceVisible(badge as unknown as HTMLElement, "1", "https://steamloopback.host/routes/library/app/1"), true, "shared router owns retained-view identity");
  document.location.href = "https://steamloopback.host/routes/library/app/1";
  badge.isConnected = false; assert.equal(read(), false);
});

test("native context subscriptions rebind and unregister without polling or permanent listeners", () => {
  const callbacks = () => { const listeners = new Set<() => void>(); return { Register: (fn: () => void) => { listeners.add(fn); return { Unregister: () => { listeners.delete(fn); } }; }, fire: () => listeners.forEach((fn) => fn()), count: () => listeners.size }; };
  const contextChanges = callbacks(), focus = callbacks(), trees = callbacks();
  const navigation = { ContextSetChangedCallbacks: contextChanges, m_rgAllContexts: [{ FocusChangedCallbacks: focus, NavTreeActivatedOrReactivatedCallbacks: trees }] };
  let updates = 0;
  const stop = subscribeNativeGamePageVisibility(navigation, () => { updates++; });
  assert.equal(updates, 1); focus.fire(); trees.fire(); assert.equal(updates, 3);
  contextChanges.fire(); assert.equal(focus.count(), 1); assert.equal(trees.count(), 1);
  stop(); assert.equal(contextChanges.count() + focus.count() + trees.count(), 0);
  const before = updates; focus.fire(); trees.fire(); assert.equal(updates, before);
});

test("display modes follow actual badge focus while menus do not independently veto Always Show", () => {
  for (const mode of ["focus", "always", "hidden"] as const) {
    assert.equal(shouldShowNativeUpNextPreview(mode, true, true, { pageVisible: false, badgeEnabled: true }), false);
    assert.equal(shouldShowNativeUpNextPreview(mode, true, true, { pageVisible: true, badgeEnabled: false }), false);
  }
  for (let i = 0; i < 10; i++) {
    const surface = { pageVisible: true, badgeEnabled: true };
    assert.equal(shouldShowNativeUpNextPreview("always", false, false, surface), true);
    assert.equal(shouldShowNativeUpNextPreview("focus", i % 2 === 0, false, surface), i % 2 === 0);
    assert.equal(shouldShowNativeUpNextPreview("hidden", true, true, surface), false);
  }
});

test("focused preview includes bounded canonical description while resting companion remains compact", () => {
  const target = { achievement: row("a", { title: "A long achievement title that needs two lines", description: "A long description for the tooltip only" }), pinned: true };
  const preview = renderToStaticMarkup(createElement(DeckyNativeUpNextPreviewCard, { target, presentation: "preview" }));
  const companion = renderToStaticMarkup(createElement(DeckyNativeUpNextPreviewCard, { target, presentation: "companion" }));
  assert.match(preview, /tooltip only/); assert.doesNotMatch(companion, /tooltip only/);
  assert.match(preview, /white-space:pre-wrap/);
  const descriptionMarkup = preview.slice(preview.indexOf("data-ac-up-next-description"));
  assert.doesNotMatch(descriptionMarkup, /line-clamp|text-overflow|overflow:hidden|max-height/);
  for (const html of [preview, companion]) {
    assert.match(html, /UP NEXT/); assert.match(html, /aria-label="Pinned"/); assert.match(html, /-webkit-line-clamp:2/); assert.match(html, /data-ac-up-next-artwork-fallback/);
    assert.doesNotMatch(html, /tabindex|role="button"|position:fixed/);
    assert.match(html, /pointer-events:none/);
  }
  const automatic = renderToStaticMarkup(createElement(DeckyNativeUpNextPreviewCard, { target: { achievement: row("a") }, presentation: "preview" }));
  assert.doesNotMatch(automatic, /PINNED/);
  const themed = renderToStaticMarkup(createElement(DeckyNativeUpNextPreviewCard, { target, presentation: "preview", style: getAchievementCompanionThemeVariables("ac-ember") }));
  assert.ok(themed.includes(NATIVE_BADGE_SURFACE.background));
  assert.doesNotMatch(preview, /var\(--ac-/, "native chrome does not use plugin theme colors");
  const tack = renderToStaticMarkup(createElement(DeckyUpNextPinIcon));
  assert.match(tack, /aria-label="Pinned"/); assert.doesNotMatch(tack, /tabindex|role="button"/);
  assert.match(preview, /width:100%/);
  assert.deepEqual(NATIVE_UP_NEXT_PREVIEW_LAYOUT.preview, NATIVE_UP_NEXT_PREVIEW_LAYOUT.companion);
});

test("real Steam schema and RA fixtures preserve full descriptions through selection and preview rendering", () => {
  const description = "First line of the original description.\n" + "Complete every objective without losing a unit. ".repeat(24).trim();
  const steam = normalizeSteamGameDetail({ appId: 1, rawGameName: "Steam fixture", rawGameIcon: undefined, rawGameBoxArt: undefined,
    playerAchievements: [{ apiname: "manual", achieved: 0, unlocktime: 0 }], schemaAchievements: [{ name: "manual", displayName: "Schema title", description }],
    globalAchievementPercentages: new Map(), playtimeForever: undefined, playtimeTwoWeeks: undefined, playtimeDeckForever: undefined });
  const ra = normalizeRetroAchievementsGameDetail({ ID: 1, Title: "RA fixture", NumAchievements: 1,
    Achievements: { "1": { ID: 1, Title: "RA title", Description: description, Points: 5 } } });
  for (const snapshot of [steam, ra]) for (const pinned of [false, true]) {
    const id = snapshot.achievements[0]!.achievementId;
    const target = selectGameOverviewSuggestions({ snapshot, ...(pinned ? { pinnedAchievement: { achievementId: id, completionMode: "both" as const } } : {}) })[0]!;
    assert.equal(target.achievement.description, description);
    const focused = renderToStaticMarkup(createElement(DeckyNativeUpNextPreviewCard, { target, presentation: "preview" }));
    assert.ok(focused.includes(description), "complete text survives render without ellipsis");
    assert.doesNotMatch(focused.slice(focused.indexOf("data-ac-up-next-description")), /line-clamp|text-overflow|overflow:hidden|max-height/);
    const resting = renderToStaticMarkup(createElement(DeckyNativeUpNextPreviewCard, { target, presentation: "companion" }));
    assert.doesNotMatch(resting, /data-ac-up-next-description/);
  }
});

test("manual selection label follows the same resolved target as its thumbtack without changing goals", () => {
  const store = createGameOverviewPreferencesStore(storage());
  store.setGlobalRetroAchievementsGoal("beat"); store.setRetroAchievementsGameGoal("1", "master");
  for (const providerId of ["steam", "retroachievements"]) for (const goal of ["beat", "master"] as const) {
    const source = snapshot([row("automatic", { providerId }), row("manual", { providerId })], providerId);
    const identity = { ...scope, providerId };
    const resolve = () => selectGameOverviewSuggestions({ snapshot: source, goal, pinnedAchievement: store.readPinnedAchievement(identity) })[0];
    const automaticLabel = providerId === "steam" ? "UP NEXT" : `UP NEXT · ${goal.toUpperCase()}`;
    assert.equal(resolveDeckyUpNextLabel(resolve(), providerId, goal), automaticLabel);
    store.pinAchievement(identity, "manual");
    const pinned = resolve();
    assert.equal(createUpNextPinAction(pinned, "both", () => {})?.pinned, true);
    assert.equal(resolveDeckyUpNextLabel(pinned, providerId, goal), "UP NEXT · PINNED");
    const completed = { ...source, achievements: source.achievements.map((a) => a.achievementId === "manual" ? { ...a, isUnlocked: true } : a) };
    assert.equal(resolveDeckyUpNextLabel(selectGameOverviewSuggestions({ snapshot: completed, goal, pinnedAchievement: store.readPinnedAchievement(identity) })[0], providerId, goal), automaticLabel);
    store.unpinAchievement(identity);
    assert.equal(resolveDeckyUpNextLabel(resolve(), providerId, goal), automaticLabel);
  }
  assert.equal(store.read().globalRetroAchievementsGoal, "beat");
  assert.equal(store.read().retroAchievementsGameGoals["1"], "master");
});

test("Steam and RA focused descriptions are optional canonical content for pinned and automatic targets", () => {
  for (const providerId of ["steam", "retroachievements"]) for (const pinned of [false, true]) {
    for (const description of [undefined, "", "   ", "Canonical description ".repeat(80)]) {
      const achievement = row("a", { providerId, ...(description !== undefined ? { description } : {}) });
      const render = (presentation: "preview" | "companion") => renderToStaticMarkup(createElement(DeckyNativeUpNextPreviewCard, { target: { achievement, pinned }, presentation }));
      assert.equal(render("preview").includes("data-ac-up-next-description"), Boolean(description?.trim()));
      assert.doesNotMatch(render("companion"), /data-ac-up-next-description/);
      assert.doesNotMatch(render("preview"), /tabindex|role="button"|position:fixed/);
    }
  }
});

test("thumbtack state preserves geometry and achievement artwork retains its full square canvas", () => {
  const outline = renderToStaticMarkup(createElement(DeckyUpNextPinIcon, { filled: false }));
  const filled = renderToStaticMarkup(createElement(DeckyUpNextPinIcon, { filled: true }));
  for (const html of [outline, filled]) assert.match(html, /width="16" height="16" viewBox="0 0 24 24"/);
  assert.match(outline, /fill="none"/); assert.match(filled, /fill="currentColor"/);
  const artwork = renderToStaticMarkup(createElement(DeckyAchievementArtwork, { src: "original-achievement.png", size: 48 }));
  assert.match(artwork, /object-fit:contain/); assert.match(artwork, /border-radius:0/);
  assert.doesNotMatch(artwork, /overflow:hidden|object-fit:cover|clip-path|mask:/);
});

test("Classic and Minimal preview content stays inside the neutral rounded surface at supported widths and scales", () => {
  const radius = NATIVE_BADGE_SURFACE.radius;
  // The content rectangle begins after a 1px border plus shared card padding.
  // Verify its four corners against the actual circular excluded corner regions,
  // independently of Classic's much larger shell/capsule radius.
  const inset = 1 + NATIVE_UP_NEXT_PREVIEW_LAYOUT.preview.padding;
  let cases = 0;
  for (const widths of [[232, 264, 292], [168, 188, 208]]) for (const width of widths) for (const scale of [.75, 1, 1.5, 2]) {
    for (const position of ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"]) {
      for (const height of [36, 64, 180, 400]) {
        const outerWidth = width * scale, outerHeight = height * scale, r = radius * scale, safe = inset * scale;
        for (const [x, y] of [[safe, safe], [outerWidth - safe, safe], [safe, outerHeight - safe], [outerWidth - safe, outerHeight - safe]]) {
          const cx = x! < r ? r : outerWidth - r;
          const cy = y! < r ? r : outerHeight - r;
          assert.ok(Math.hypot(x! - cx, y! - cy) <= r, `${position}/${width}/${scale}/${height}`);
        }
        cases++;
      }
    }
  }
  assert.equal(cases, 576);
  for (const title of ["Short", "A long achievement title ".repeat(8)]) for (const pinned of [false, true]) for (const description of ["", "Line one\nLine two", "Long description ".repeat(100)]) {
    const html = renderToStaticMarkup(createElement(DeckyNativeUpNextPreviewCard, { target: { achievement: row("a", { title, description, badgeImageUrl: "original.png" }), pinned }, presentation: "preview" }));
    assert.match(html, /border-radius:8px/);
    assert.match(html, /data-ac-achievement-artwork/);
    assert.match(html, /object-fit:contain/);
    const descriptionMarkup = html.slice(html.indexOf("data-ac-up-next-description"));
    if (description) assert.doesNotMatch(descriptionMarkup, /line-clamp|overflow:hidden|text-overflow|max-height/);
  }
});

test("overlay lifecycle wakes route eligibility without dropping Always Show or reloading its canonical session", async () => {
  const callbacks = () => { const listeners = new Set<() => void>(); return { Register: (fn: () => void) => { listeners.add(fn); return { Unregister: () => { listeners.delete(fn); } }; }, fire: () => listeners.forEach((fn) => fn()) }; };
  const focus = callbacks();
  const document = { location: { href: "https://steamloopback.host/routes/library/app/1" } };
  const badge = { isConnected: true, ownerDocument: document };
  let updates = 0, loads = 0;
  const session = createNativeUpNextPreviewSession({ read: () => undefined, load: async () => { loads++; return success(snapshot()); } });
  const mounted = () => shouldShowNativeUpNextPreview("always", false, false, { pageVisible: isNativeGamePageSurfaceVisible(badge as unknown as HTMLElement, "1"), badgeEnabled: true });
  const stop = subscribeNativeGamePageVisibility({ m_rgAllContexts: [{ FocusChangedCallbacks: focus }] }, () => { updates++; });
  await session.load();
  for (const overlay of ["QAM", "main menu", "modal", "QAM", "main menu"]) {
    focus.fire(); assert.equal(mounted(), true, `${overlay} does not leave the underlying game`);
    focus.fire(); assert.equal(mounted(), true);
  }
  assert.equal(loads, 1); assert.ok(updates > 1);
  document.location.href = "https://steamloopback.host/routes/library/app/2"; focus.fire(); assert.equal(mounted(), false);
  badge.isConnected = false; assert.equal(mounted(), false);
  stop(); const previous = updates; focus.fire(); assert.equal(updates, previous);
});

test("the native Y handler pins once, unpins once, updates shared state, and ignores held repeats", () => {
  const store = createGameOverviewPreferencesStore(storage());
  const source = snapshot();
  let consumed = 0;
  const event = { detail: { is_repeat: false }, preventDefault: () => { consumed++; }, stopPropagation: () => { consumed++; } };
  const action = () => createUpNextPinAction(selectGameOverviewSuggestions({ snapshot: source, pinnedAchievement: store.readPinnedAchievement(scope) })[0], "both", (id) => {
    if (store.readPinnedAchievement(scope)?.achievementId === id) store.unpinAchievement(scope); else store.pinAchievement(scope, id);
  })!;
  assert.equal(action().label, "Pin"); action().onOptionsButton(event);
  assert.equal(action().label, "Unpin"); assert.equal(store.readPinnedAchievement(scope)?.achievementId, "automatic");
  action().onOptionsButton({ ...event, detail: { is_repeat: true } }); assert.ok(store.readPinnedAchievement(scope));
  action().onOptionsButton(event); assert.equal(store.readPinnedAchievement(scope), undefined); assert.equal(action().label, "Pin");
  assert.equal(consumed, 6);
  assert.equal(createUpNextPinAction({ achievement: row("complete", { isUnlocked: true }) }, "both", () => assert.fail()), undefined);
});

test("pins persist across recreation, replace exactly one per provider/game/account, and unpin independently", () => {
  const disk = storage(); const store = createGameOverviewPreferencesStore(disk);
  const scopes = [scope, { ...scope, gameId: "2" }, { ...scope, providerId: "retroachievements" }, { ...scope, accountId: "another-account" }];
  for (const [index, identity] of scopes.entries()) assert.equal(store.pinAchievement(identity, String(index + 1), "hardcore"), true);
  assert.equal(store.pinAchievement(scope, "replacement"), true);
  const restarted = createGameOverviewPreferencesStore(disk);
  assert.deepEqual(restarted.readPinnedAchievement(scope), { achievementId: "replacement", completionMode: "both" });
  assert.equal(Object.keys(restarted.read().pinnedAchievements).length, 4);
  restarted.unpinAchievement(scope, "old-response");
  assert.equal(restarted.readPinnedAchievement(scope)?.achievementId, "replacement", "late completion cannot remove a replacement");
  restarted.unpinAchievement(scope);
  assert.equal(restarted.readPinnedAchievement(scope), undefined);
  for (const identity of scopes.slice(1)) assert.ok(restarted.readPinnedAchievement(identity));
});

test("v1 migration and malformed pin records preserve hidden suggestions and Beat/Master overrides", () => {
  const key = gameOverviewPreferenceKey("steam", "1");
  const good = pinnedAchievementPreferenceKey(scope);
  const parsed = parseGameOverviewPreferences(JSON.stringify({ version: 1, globalRetroAchievementsGoal: "beat", retroAchievementsGameGoals: { "1": "master" }, hiddenSuggestions: { [key]: ["manual", "other"] }, pinnedAchievements: { [good]: pin, broken: pin, '["steam","1",""]': pin, '["fake","1","a"]': pin, '["steam","2","a"]': { achievementId: {}, completionMode: "both" }, '["steam","3","a"]': { achievementId: "x", completionMode: "invalid" } } }));
  assert.deepEqual(Object.values(parsed.pinnedAchievements), [pin]);
  assert.equal(parsed.globalRetroAchievementsGoal, "beat"); assert.equal(parsed.retroAchievementsGameGoals["1"], "master");
  assert.deepEqual(parsed.hiddenSuggestions[key], ["manual", "other"]);
  assert.deepEqual(parseGameOverviewPreferences('{"version":1}').pinnedAchievements, {});
  assert.deepEqual(parseGameOverviewPreferences("malformed").pinnedAchievements, {});
});

test("pinning restores only the selected hidden suggestion and never changes game goals", () => {
  const store = createGameOverviewPreferencesStore(storage());
  store.hideSuggestion("steam", "1", "manual"); store.hideSuggestion("steam", "1", "other");
  store.setGlobalRetroAchievementsGoal("beat"); store.setRetroAchievementsGameGoal("1", "master");
  store.pinAchievement(scope, "manual");
  assert.deepEqual(store.read().hiddenSuggestions[gameOverviewPreferenceKey("steam", "1")], ["other"]);
  assert.equal(store.read().globalRetroAchievementsGoal, "beat"); assert.equal(store.read().retroAchievementsGameGoals["1"], "master");
  assert.equal(createGameOverviewPreferencesStore(undefined).pinAchievement(scope, "manual"), false);
  assert.equal(store.pinAchievement({ ...scope, gameId: "Game title" }, "manual"), false);
  assert.equal(store.pinAchievement({ ...scope, accountId: "" }, "manual"), false);
  assert.equal(store.pinAchievement(scope, ""), false);
  store.hideSuggestion("steam", "1", "manual", scope.accountId);
  assert.equal(store.readPinnedAchievement(scope), undefined, "Skip retires the current account's pin in the same preference write");
  assert.deepEqual(store.read().hiddenSuggestions[gameOverviewPreferenceKey("steam", "1")], ["other", "manual"]);
});

test("shared target resolution prioritizes a pin across hidden filters, source order, and compact/full-screen limits", () => {
  for (const rows of [[row("automatic"), row("manual")], [row("manual"), row("automatic")]]) for (const limit of [1, 3]) {
    const source = snapshot(rows);
    const model = buildDeckyCompactUpNextModel({ snapshot: source, pinnedAchievement: pin, hiddenAchievementIds: ["manual"], goal: "master", achievementMode: "both", limit });
    assert.equal(model.suggestions[0]?.achievement.achievementId, "manual"); assert.equal(model.suggestions[0]?.pinned, true);
    assert.equal(model.outcome.kind, "suggestion");
    assert.equal(selectGameOverviewSuggestions({ snapshot: source })[0]?.pinned, undefined);
    assert.equal(source.achievements.length, 2, "browser search and sorting never mutate the canonical source");
  }
  assert.deepEqual(selectGameOverviewSuggestions({ snapshot: snapshot(), pinnedAchievement: pin, limit: 0 }), []);
});

test("manual target remains active after a recorded Beat goal without modifying that goal", () => {
  const source = snapshot([row("manual", { providerId: "retroachievements" })], "retroachievements");
  const beaten = { ...source, game: { ...source.game, metrics: [{ key: "highest-award-kind", label: "Award", value: "beaten-hardcore" }] } };
  assert.equal(selectGameOverviewSuggestions({ snapshot: beaten, goal: "beat", achievementMode: "hardcore" }).length, 0);
  const model = buildDeckyCompactUpNextModel({ snapshot: beaten, pinnedAchievement: pin, goal: "beat", achievementMode: "hardcore", hiddenAchievementIds: [] });
  assert.equal(model.outcome.kind, "suggestion"); assert.equal(model.suggestions[0]?.pinned, true);
});

test("RA pin completion mode is fixed at selection across Hardcore, Softcore, and Both displays", () => {
  const source = snapshot([row("manual", { providerId: "retroachievements", isUnlocked: true, unlockMode: "softcore", softcoreUnlockedAt: 100 }), row("automatic", { providerId: "retroachievements" })], "retroachievements");
  for (const achievementMode of ["hardcore", "softcore", "both"] as const) {
    const model = buildDeckyCompactUpNextModel({ snapshot: source, pinnedAchievement: { ...pin, completionMode: "hardcore" }, achievementMode, goal: "master", hiddenAchievementIds: [] });
    assert.equal(model.suggestions[0]?.pinned, true, achievementMode);
    assert.equal(model.suggestions[0]?.achievement.achievementId, "manual");
    assert.equal(buildDeckyCompactUpNextModel({ snapshot: source, pinnedAchievement: { ...pin, completionMode: "softcore" }, achievementMode, goal: "master", hiddenAchievementIds: [] }).suggestions[0]?.pinned, undefined);
  }
  assert.equal(isPinnedAchievementComplete(source, pin), true);
  assert.equal(isPinnedAchievementComplete(source, { ...pin, completionMode: "hardcore" }), false);
  const hardcore = { ...source, achievements: [row("manual", { providerId: "retroachievements", isUnlocked: true, hardcoreUnlockedAt: 200, unlockMode: "hardcore" })] };
  assert.equal(isPinnedAchievementComplete(hardcore, { ...pin, completionMode: "hardcore" }), true);
  assert.equal(isPinnedAchievementComplete(hardcore, { ...pin, completionMode: "softcore" }), true, "a Hardcore unlock also satisfies a Softcore target");
});

test("canonical unlock retires active selection; missing, partial, and rounded information never proves completion", () => {
  const completed = snapshot([row("automatic"), row("manual", { isUnlocked: true })]);
  assert.equal(isPinnedAchievementComplete(completed, pin), true);
  assert.equal(selectGameOverviewSuggestions({ snapshot: completed, pinnedAchievement: pin })[0]?.achievement.achievementId, "automatic");
  const missing = snapshot([row("automatic")]);
  assert.equal(isPinnedAchievementComplete(missing, pin), false);
  assert.equal(selectGameOverviewSuggestions({ snapshot: missing, pinnedAchievement: pin })[0]?.achievement.achievementId, "automatic");
  assert.equal(isPinnedAchievementComplete({ ...snapshot(), game: { ...snapshot().game, summary: { totalCount: 100, unlockedCount: 99, completionPercent: 100 } } }, pin), false);
  assert.equal(isPinnedAchievementComplete(snapshot([row("manual", { providerId: "retroachievements", isUnlocked: true })]), pin), false, "foreign provider rows cannot satisfy a pin");
  assert.equal(isPinnedAchievementComplete(snapshot([row("manual", { gameId: "2", isUnlocked: true })]), pin), false);
  assert.deepEqual(selectGameOverviewSuggestions({ snapshot: snapshot([]), pinnedAchievement: pin }), []);
});

test("pin selection preserves SteamHunters rarity, add-on context, and obtainability", () => {
  const steamHunters = { app: { appId: 1, tags: [] }, achievements: [{ apiName: "manual", steamPercentage: 5, obtainability: "conditionally-obtainable" as const }], groups: [{ dlcAppId: 2, dlcAppName: "Expansion", achievementApiNames: ["manual"] }] };
  const result = selectGameOverviewSuggestions({ snapshot: snapshot(), pinnedAchievement: pin, steamHunters });
  assert.equal(result[0]?.pinned, true); assert.equal(result[0]?.rarityPercent, 5); assert.equal(result[0]?.groupLabel, "Expansion"); assert.equal(result[0]?.availabilityLabel, "Conditional");
  const unavailable = { ...steamHunters, achievements: [{ apiName: "manual", obtainability: "unobtainable" as const }] };
  assert.equal(selectGameOverviewSuggestions({ snapshot: snapshot(), hiddenAchievementIds: ["automatic"], steamHunters: unavailable }).length, 0, "automatic recommendations still exclude confirmed unobtainable rows");
  assert.equal(selectGameOverviewSuggestions({ snapshot: snapshot(), pinnedAchievement: pin, steamHunters: unavailable })[0]?.availabilityLabel, "Unobtainable", "an explicit user choice retains its availability warning");
});

test("pin preferences do not alter QAM current game candidate selection", () => {
  const games = ["2", "1"].map((gameId) => ({ ...snapshot().game, gameId }));
  assert.deepEqual(selectDeckyCompactUpNextCandidates({ providerId: "steam", games, activeGameId: "2" }).map((game) => game.gameId), ["2", "1"]);
});

test("shared native menu offers pin/unpin without changing existing detail, list, or hide actions", () => {
  const calls: string[] = [];
  for (const pinned of [false, true]) {
    const menu = buildDeckyManageSuggestionsMenuItems({ suggestions: [{ achievement: row("manual"), pinned }], hiddenSuggestions: [], onTogglePin: (id) => calls.push(id), onOpenAchievement: () => {}, onJumpToAchievement: () => {}, onDismissSuggestion: () => {}, onRestoreSuggestion: () => {}, onRestoreAllSuggestions: () => {}, onFocusedSuggestionChange: () => {} });
    assert.deepEqual(menu[0]?.items?.map((item) => item.label), [pinned ? "Remove from Up Next" : "Set as Up Next", "View Details", "Show in Achievements", "Hide Suggestion"]);
    menu[0]?.items?.[0]?.onSelect?.({ restoreCurrent: () => {}, restoreParent: () => {} });
  }
  assert.deepEqual(calls, ["manual", "manual"]);
  const completedMenu = buildDeckyManageSuggestionsMenuItems({
    suggestions: [{ achievement: row("manual", { providerId: "retroachievements", isUnlocked: false, hardcoreUnlockedAt: 200 }) }],
    achievementMode: "softcore", hiddenSuggestions: [], onTogglePin: () => assert.fail("completed target"), onOpenAchievement: () => {}, onJumpToAchievement: () => {}, onDismissSuggestion: () => {}, onRestoreSuggestion: () => {}, onRestoreAllSuggestions: () => {}, onFocusedSuggestionChange: () => {},
  });
  assert.equal(completedMenu[0]?.items?.some((item) => item.key === "pin"), false, "mode filtering cannot make a completed canonical target pinnable");
});

test("settings migrate to On Focus and preserve all three persisted modes", () => {
  for (const value of [undefined, {}, { gamePageUpNextPreview: "invalid" }]) assert.equal(normalizeAchievementCompanionSettings(value).gamePageUpNextPreview, "focus");
  for (const mode of ["focus", "always", "hidden"] as const) assert.equal(normalizeAchievementCompanionSettings({ gamePageUpNextPreview: mode }).gamePageUpNextPreview, mode);
});

test("focus/blur, hover, rapid changes, Always Show and Hidden have a single visibility contract", () => {
  assert.deepEqual([[false, false], [true, false], [false, false], [false, true], [false, false], [true, true]].map(([focus, hover]) => shouldShowNativeUpNextPreview("focus", focus!, hover!)), [false, true, false, true, false, true]);
  for (const focused of [false, true]) for (const hovered of [false, true]) {
    assert.equal(shouldShowNativeUpNextPreview("hidden", focused, hovered), false);
    assert.equal(shouldShowNativeUpNextPreview("always", focused, hovered), true);
  }
});

test("native identity requires the current app's ready, verified provider game ID", () => {
  assert.deepEqual(nativeUpNextIdentity({ status: "ready", provider: "steam", appId: "10", source: "backend", earned: 0, total: 5 }, "10"), { providerId: "steam", gameId: "10" });
  assert.deepEqual(nativeUpNextIdentity({ status: "ready", provider: "retroachievements", appId: "4000000000", gameId: "42", source: "backend", earned: 0, total: 5 }, "4000000000"), { providerId: "retroachievements", gameId: "42" });
  assert.equal(nativeUpNextIdentity({ status: "ready", provider: "retroachievements", appId: "4000000000", source: "backend", earned: 0, total: 5 }, "4000000000"), undefined);
  assert.equal(nativeUpNextIdentity({ status: "unavailable", appId: "10", reason: "unmapped" }, "10"), undefined);
  assert.equal(nativeUpNextIdentity({ status: "ready", provider: "steam", appId: "10", source: "cache", earned: 0, total: 5 }, "20"), undefined);
});

test("collision-aware layout covers six positions, three sizes, both styles and multiple viewports", () => {
  let cases = 0;
  for (const width of [800, 1280, 1920]) for (const style of ["classic", "minimal"]) for (const [badgeWidth, badgeHeight] of style === "classic" ? [[232, 58], [264, 66], [292, 74]] : [[168, 32], [188, 38], [208, 44]]) for (const vertical of ["top", "bottom"]) for (const horizontal of ["left", "center", "right"]) {
    const left = horizontal === "left" ? 20 : horizontal === "right" ? width - badgeWidth! - 20 : (width - badgeWidth!) / 2;
    const top = vertical === "top" ? 25 : 300 - badgeHeight!;
    const badge = { left, top, right: left + badgeWidth!, bottom: top + badgeHeight! };
    const placed = placeNativeUpNextPreview(badge, { left: 0, top: 0, right: width, bottom: 330 }, { width, height: 800 }, { width: 340, height: 128 }, []);
    assert.ok(placed, `${style}/${vertical}/${horizontal}/${width}`);
    assert.ok(placed.left >= 8 && placed.right <= width - 8 && placed.top >= 8 && placed.bottom <= 322);
    assert.ok(placed.right <= badge.left - 6 || placed.left >= badge.right + 6 || placed.bottom <= badge.top - 6 || placed.top >= badge.bottom + 6);
    cases++;
  }
  assert.equal(cases, 108);
  const hero = { left: 0, top: 0, right: 800, bottom: 330 };
  assert.equal(placeNativeUpNextPreview({ left: 10, top: 10, right: 242, bottom: 68 }, hero, { width: 800, height: 800 }, { width: 340, height: 128 }, [hero]), undefined, "never cover Steam controls when no clear slot exists");
});

test("measured long-content height, viewport edges, and partially scrolled hero remain bounded", () => {
  const badge: PreviewRect = { left: 540, top: 15, right: 772, bottom: 73 };
  const placed = placeNativeUpNextPreview(badge, { left: 0, top: -80, right: 800, bottom: 250 }, { width: 800, height: 600 }, { width: 340, height: 156 }, []);
  assert.ok(placed); assert.ok(placed.top >= 8 && placed.bottom <= 242 && placed.right <= 792);
  assert.equal(placeNativeUpNextPreview(badge, { left: 0, top: -500, right: 800, bottom: -50 }, { width: 800, height: 600 }, { width: 340, height: 156 }, []), undefined);
});

test("actual mocked provider request counts for all preview entry and pin lifecycle scenarios", async () => {
  let requests = 0; const canonical = new Map<string, ResourceState<GameDetailSnapshot>>();
  const session = (id: string) => createNativeUpNextPreviewSession({ read: () => canonical.get(id), load: async () => { requests++; const state = success(snapshot()); canonical.set(id, state); return state; } });
  const counts: Record<string, number> = {};
  let before = requests; const cold = session("1");
  if (shouldShowNativeUpNextPreview("focus", false, false)) await cold.load();
  counts["on-focus page load without focus"] = requests - before;
  canonical.set("fresh", success(snapshot())); before = requests; await session("fresh").load(); counts["first focus with fresh canonical data"] = requests - before;
  before = requests; await cold.load(); counts["first focus without details"] = requests - before;
  before = requests; await Promise.all([cold.load(), cold.load(), cold.load()]); counts["repeated focus"] = requests - before;
  before = requests; await session("always").load(); counts["always show cold entry"] = requests - before;
  before = requests; if (shouldShowNativeUpNextPreview("hidden", true, true)) await session("hidden").load(); counts["hidden"] = requests - before;
  before = requests; await session("2").load(); await session("1").load(); counts["switch two games (one cold, one warm)"] = requests - before;
  const store = createGameOverviewPreferencesStore(storage()); before = requests; store.pinAchievement(scope, "manual"); selectGameOverviewSuggestions({ snapshot: canonical.get("1")!.data!, pinnedAchievement: store.readPinnedAchievement(scope) }); counts["pin from loaded browser"] = requests - before;
  before = requests; const unlocked = snapshot([row("automatic"), row("manual", { isUnlocked: true })]); if (isPinnedAchievementComplete(unlocked, pin)) store.unpinAchievement(scope, pin.achievementId); selectGameOverviewSuggestions({ snapshot: unlocked }); counts["canonical completion"] = requests - before;
  assert.deepEqual(Object.values(counts), [0, 0, 1, 0, 1, 0, 1, 0, 0]);
  console.log("PIN_PREVIEW_MOCK_HTTP_COUNTS " + JSON.stringify(counts));
});

test("concurrent focus joins one request; failures/cooldowns remain bounded until route reentry", async () => {
  let calls = 0;
  let complete!: (state: ResourceState<GameDetailSnapshot>) => void;
  const pending = new Promise<ResourceState<GameDetailSnapshot>>((resolve) => { complete = resolve; });
  const session = createNativeUpNextPreviewSession({ read: () => undefined, load: () => { calls++; return pending; } });
  assert.equal(session.requested(), false);
  const first = session.load(); const second = session.load(); assert.equal(first, second);
  await Promise.resolve(); assert.equal(calls, 1);
  complete({ status: "error", isStale: false, isRefreshing: false, error: { kind: "rate_limit", retryable: true, userMessage: "cooldown" } });
  await first; await session.load(); assert.equal(calls, 1);
  assert.equal(session.requested(), true);
});

test("canonical publication persists pin retirement and notifies subscribers without erasing another account", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage() });
  const config = { steamId64: scope.accountId, hasApiKey: true, language: "english", recentAchievementsCount: 5 as const, recentlyPlayedCount: 5 as const };
  updateDeckyProviderConfigCache("steam", config);
  let notifications = 0; const unsubscribe = subscribeToPinnedAchievementChanges(() => { notifications++; });
  try {
    pinAchievement(scope, "manual");
    const other = { ...scope, accountId: "76561198000000002" };
    pinAchievement(other, "manual");
    const before = notifications;
    publishDeckyGameDetail({ ...snapshot([row("automatic")]), achievementStateIsComplete: false });
    assert.ok(readPinnedAchievement(scope), "partial responses never erase a missing pin");
    assert.equal(notifications, before);
    publishDeckyGameDetail(snapshot([row("automatic"), row("manual", { isUnlocked: true })]));
    assert.equal(readPinnedAchievement(scope), undefined);
    assert.ok(readPinnedAchievement(other));
    assert.equal(notifications, before + 1);
    updateDeckyProviderConfigCache("steam", { ...config, steamId64: other.accountId });
    assert.ok(readPinnedAchievement(other));
  } finally {
    unsubscribe(); updateDeckyProviderConfigCache("steam", undefined);
    if (previous) Object.defineProperty(globalThis, "localStorage", previous); else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("failed or partial Steam progress never retires persisted pins based on optional unlock hints", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage() });
  updateDeckyProviderConfigCache("steam", { steamId64: scope.accountId, hasApiKey: true, language: "english", recentAchievementsCount: 5, recentlyPlayedCount: 5 });
  try {
    pinAchievement(scope, "manual");
    publishDeckyGameDetail({ ...snapshot([row("manual", { isUnlocked: true })]), achievementStateIsComplete: false });
    assert.ok(readPinnedAchievement(scope));
    assert.equal(readPinnedAchievement({ ...scope, providerId: "retroachievements" }), undefined);
    assert.equal(readPinnedAchievement({ ...scope, accountId: "different" }), undefined);
  } finally {
    updateDeckyProviderConfigCache("steam", undefined);
    if (previous) Object.defineProperty(globalThis, "localStorage", previous); else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("real RA provider and canonical transport introduce one cold progress dispatch and zero optional requests", async () => {
  resetDeckyRetroAchievementsTransportForTests();
  const paths: string[] = [];
  setDeckyBackendCallImplementationForTests(async (method, argument) => {
    if (method === "record_diagnostic_event") return true;
    assert.equal(method, "request_retroachievements_json");
    const request = argument as { path: string; query: { g: string } };
    paths.push(request.path);
    const time = Date.now();
    return { raResource: 1, resourceKey: `game:${request.query.g}`, sourceRevision: `revision:${request.query.g}`, cacheState: "live", fetchedAt: time, freshUntil: time + 900000,
      payload: { ID: Number(request.query.g), Title: "Test game", NumAchievements: 2, NumAwardedToUser: 0, Achievements: { "1": { ID: 1, Title: "Automatic", Points: 5 }, "2": { ID: 2, Title: "Pinned", Points: 5 } } } };
  });
  try {
    const provider = createRetroAchievementsProvider({ transport: createDeckyRetroAchievementsTransport() });
    const makeSession = (gameId: string) => createNativeUpNextPreviewSession({ read: () => undefined, load: async () => success(await provider.loadGameProgressForRecommendations({ username: "alice", hasApiKey: true }, gameId)) });
    const cold = makeSession("1");
    assert.equal(paths.length, 0, "page load alone dispatches nothing");
    await cold.load(); assert.equal(paths.length, 1);
    await Promise.all([cold.load(), cold.load()]); assert.equal(paths.length, 1);
    const warm = await makeSession("1").load(); assert.equal(paths.length, 1, "fresh canonical data reconstructs locally on remount");
    selectGameOverviewSuggestions({ snapshot: warm.data!, pinnedAchievement: { achievementId: "2", completionMode: "hardcore" } }); assert.equal(paths.length, 1);
    await makeSession("2").load(); await makeSession("1").load(); assert.equal(paths.length, 2, "two distinct cold games require one required progress request each");
    assert.deepEqual(paths, ["API_GetGameInfoAndUserProgress.php", "API_GetGameInfoAndUserProgress.php"]);
  } finally {
    setDeckyBackendCallImplementationForTests(undefined); resetDeckyRetroAchievementsTransportForTests();
  }
});

test("cold Steam preview uses the existing four base requests with zero SteamHunters calls and shares the game cache", async () => {
  const paths: string[] = []; let enrichmentCalls = 0;
  setDeckyBackendCallImplementationForTests(async (method, argument) => {
    assert.equal(method, "request_steam_json");
    const { path } = argument as { path: string }; paths.push(path);
    if (path.includes("RecentlyPlayedGames")) return { response: { games: [] } };
    if (path.includes("GetPlayerAchievements")) return { playerstats: { success: true, achievements: [{ apiname: "manual", achieved: 0 }, { apiname: "automatic", achieved: 0 }] } };
    if (path.includes("GetSchemaForGame")) return { game: { gameName: "Test", availableGameStats: { achievements: [{ name: "manual", displayName: "Manual" }, { name: "automatic", displayName: "Automatic" }] } } };
    if (path.includes("GetGlobalAchievementPercentages")) return { achievementpercentages: { achievements: [] } };
    assert.fail(`unexpected request: ${path}`);
  });
  try {
    const config = { steamId64: "76561198000000999", hasApiKey: true, language: "english", recentAchievementsCount: 5 as const, recentlyPlayedCount: 5 as const };
    const provider = createSteamProvider({ transport: createDeckySteamTransport(), steamHuntersService: { loadGameData: async () => { enrichmentCalls++; return undefined; }, loadProfile: async () => undefined, clearProfileCache: () => {}, clearCache: () => {} } });
    const services = createAppServices({ providerRegistry: createProviderRegistry([provider]), cacheStore: createMemoryCacheStore(), platform: {} as PlatformServices, loadProviderConfig: async () => config });
    let saved: ResourceState<GameDetailSnapshot> | undefined;
    const session = createNativeUpNextPreviewSession({ read: () => saved, load: async () => saved = await services.gameDetail.loadGameDetail("steam", "999999", { forceRefresh: false, recommendationOnly: true }) });
    assert.equal(paths.length, 0); await session.load();
    assert.equal(saved?.status, "success"); assert.equal(paths.length, 4); assert.equal(enrichmentCalls, 0);
    await session.load(); await services.gameDetail.loadGameDetail("steam", "999999", { forceRefresh: false });
    assert.equal(paths.length, 4, "full-screen reuses the exact canonical cache entry");
    assert.equal(enrichmentCalls, 0);
    await provider.loadGameProgress(config, "999999"); assert.equal(enrichmentCalls, 1, "ordinary full-detail provider loads retain optional enrichment");
    console.log("PIN_PREVIEW_STEAM_COLD_REQUESTS " + JSON.stringify({ steam: 4, steamHunters: 0, repeatedFocus: 0, fullScreenCacheReuse: 0 }));
  } finally { setDeckyBackendCallImplementationForTests(undefined); }
});
