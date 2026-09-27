import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement,
  ensureCompactGameDetailCancelBridgeRegisteredForBackButtonElement,
  ensureCompactProviderCancelBridgeRegisteredForBackButtonElement,
  removeDeckyCompactCancelBridges,
} from "../src/platform/decky/decky-full-screen-cancel-bridge";
import { createDeckyRouteRegistration } from "../src/platform/decky/decky-route-registration";
import {
  buildDeckyFullScreenAchievementHistoryRoute,
  buildDeckyFullScreenAchievementRoute,
  buildDeckyFullScreenCompletionProgressRoute,
  buildDeckyFullScreenGameRoute,
  buildDeckyFullScreenProfileRoute,
  buildDeckyFullScreenProviderSettingsRoute,
  buildDeckyFullScreenSettingsRoute,
  DECKY_FULL_SCREEN_ROUTE_PATTERNS,
} from "../src/platform/decky/decky-routes";
import {
  beginDeckyCompactOriginFullScreenSession,
  clearDeckyFullScreenSession,
  consumeDeckyCompactOriginFullScreenSession,
} from "../src/platform/decky/decky-full-screen-session";
import {
  readDeckyCompactNavigation,
  resetDeckyCompactNavigationForTests,
  setDeckyCompactNavigation,
  useDeckyCompactNavigation,
} from "../src/platform/decky/decky-compact-navigation";
import {
  createDeckyFullScreenTerminalReturn,
  DECKY_COMPACT_ORIGIN_QAM_REOPEN_DELAY_MS,
} from "../src/platform/decky/decky-full-screen-terminal-return";

const EmptyRoute: ComponentType = () => null;

function CompactRootProbe(): JSX.Element {
  const destination = useDeckyCompactNavigation();
  return createElement("output", undefined, JSON.stringify(destination));
}

function renderFreshCompactRoot(): string {
  // renderToStaticMarkup completes and disposes this React tree. Calling it
  // again below models a new QAM compact-root lifetime with no component state.
  return renderToStaticMarkup(createElement(CompactRootProbe));
}

function createTerminalReturnHarness(): {
  readonly calls: string[];
  readonly scheduled: Array<{ readonly callback: () => void; readonly delayMs: number }>;
  readonly cancelled: unknown[];
  readonly terminalReturn: ReturnType<typeof createDeckyFullScreenTerminalReturn>;
} {
  const calls: string[] = [];
  const scheduled: Array<{ readonly callback: () => void; readonly delayMs: number }> = [];
  const cancelled: unknown[] = [];
  const terminalReturn = createDeckyFullScreenTerminalReturn({
    consumeSession: consumeDeckyCompactOriginFullScreenSession,
    clearSession: clearDeckyFullScreenSession,
    navigateBack: () => calls.push("navigate-back"),
    openDeckyQuickAccessMenu: () => calls.push("open-decky-qam"),
    schedule(callback, delayMs) {
      const handle = { callback, delayMs };
      scheduled.push(handle);
      return handle;
    },
    cancel(handle) {
      cancelled.push(handle);
    },
  });

  return { calls, scheduled, cancelled, terminalReturn };
}

test.afterEach(() => {
  clearDeckyFullScreenSession();
  resetDeckyCompactNavigationForTests();
});

test("compact RetroAchievements profile terminal Back pops first, then reopens Decky QAM", () => {
  setDeckyCompactNavigation({ kind: "provider-dashboard", providerId: "retroachievements" });
  beginDeckyCompactOriginFullScreenSession("profile");
  const harness = createTerminalReturnHarness();

  assert.equal(harness.terminalReturn.handleRootBack("profile"), true);
  assert.deepStrictEqual(harness.calls, ["navigate-back"]);
  assert.deepStrictEqual(readDeckyCompactNavigation(), {
    kind: "provider-dashboard",
    providerId: "retroachievements",
  });
  assert.equal(harness.scheduled.length, 1);
  assert.equal(harness.scheduled[0]?.delayMs, DECKY_COMPACT_ORIGIN_QAM_REOPEN_DELAY_MS);

  harness.scheduled[0]?.callback();
  assert.deepStrictEqual(harness.calls, ["navigate-back", "open-decky-qam"]);
});

test("compact Steam profile terminal Back retains its provider-specific origin", () => {
  setDeckyCompactNavigation({ kind: "provider-dashboard", providerId: "steam" });
  beginDeckyCompactOriginFullScreenSession("profile");
  const harness = createTerminalReturnHarness();

  assert.equal(harness.terminalReturn.handleRootBack("profile"), true);
  assert.deepStrictEqual(harness.calls, ["navigate-back"]);
  harness.scheduled[0]?.callback();
  assert.deepStrictEqual(harness.calls, ["navigate-back", "open-decky-qam"]);
});

test("a non-compact root Back uses only native Decky navigation and leaves compact state untouched", () => {
  setDeckyCompactNavigation({ kind: "provider-dashboard", providerId: "retroachievements" });
  const harness = createTerminalReturnHarness();

  assert.equal(
    harness.terminalReturn.handleRootBack("profile"),
    false,
  );
  assert.deepStrictEqual(harness.calls, ["navigate-back"]);
  assert.equal(harness.scheduled.length, 0);
  assert.deepStrictEqual(readDeckyCompactNavigation(), {
    kind: "provider-dashboard",
    providerId: "retroachievements",
  });
});

test("terminal full-screen session state is consumed and cannot leak into another session", () => {
  const harness = createTerminalReturnHarness();

  beginDeckyCompactOriginFullScreenSession("profile");
  assert.equal(harness.terminalReturn.handleRootBack("profile"), true);
  assert.equal(harness.terminalReturn.handleRootBack("profile"), false);
  assert.equal(harness.scheduled.length, 1);

  harness.terminalReturn.cancelPendingReopen();
  beginDeckyCompactOriginFullScreenSession("game");
  assert.equal(harness.terminalReturn.handleRootBack("game"), true);
  assert.equal(harness.scheduled.length, 2);
  assert.equal(harness.cancelled.length, 1);
  harness.scheduled[1]?.callback();

  assert.deepStrictEqual(harness.calls, [
    "navigate-back",
    "navigate-back",
    "navigate-back",
    "open-decky-qam",
  ]);
});

test("terminal-return cleanup cancels a pending QAM reopen and clears origin state", () => {
  beginDeckyCompactOriginFullScreenSession("game");
  const harness = createTerminalReturnHarness();

  harness.terminalReturn.handleRootBack("game");
  harness.terminalReturn.clear();
  assert.equal(harness.cancelled.length, 1);
  assert.equal(consumeDeckyCompactOriginFullScreenSession("game"), false);
});

for (const providerId of ["retroachievements", "steam"] as const) {
  test(`compact ${providerId} Profile survives a fresh QAM React root after terminal return`, () => {
    setDeckyCompactNavigation({ kind: "provider-dashboard", providerId });
    const firstCompactRoot = renderFreshCompactRoot();
    assert.match(firstCompactRoot, new RegExp(`provider-dashboard.*${providerId}`, "u"));

    beginDeckyCompactOriginFullScreenSession("profile");
    const harness = createTerminalReturnHarness();
    assert.equal(harness.terminalReturn.handleRootBack("profile"), true);
    harness.scheduled[0]?.callback();

    const secondFreshCompactRoot = renderFreshCompactRoot();
    assert.match(secondFreshCompactRoot, new RegExp(`provider-dashboard.*${providerId}`, "u"));
    assert.doesNotMatch(secondFreshCompactRoot, /provider-chooser/u);
  });
}

test("compact Game destination survives terminal return without provider leakage", () => {
  setDeckyCompactNavigation({
    kind: "game",
    providerId: "steam",
    gameId: "42",
    gameTitle: "Example Game",
  });
  beginDeckyCompactOriginFullScreenSession("game");
  const harness = createTerminalReturnHarness();

  assert.equal(harness.terminalReturn.handleRootBack("game"), true);
  harness.scheduled[0]?.callback();
  assert.match(
    renderFreshCompactRoot(),
    /&quot;kind&quot;:&quot;game&quot;.*&quot;providerId&quot;:&quot;steam&quot;.*&quot;gameId&quot;:&quot;42&quot;/u,
  );
});

test("compact Settings destination survives a Settings-root terminal return", () => {
  setDeckyCompactNavigation({ kind: "settings", providerId: "steam" });
  beginDeckyCompactOriginFullScreenSession("settings");
  const harness = createTerminalReturnHarness();

  assert.equal(harness.terminalReturn.handleRootBack("settings"), true);
  harness.scheduled[0]?.callback();
  assert.deepStrictEqual(harness.calls, ["navigate-back", "open-decky-qam"]);
  assert.deepStrictEqual(readDeckyCompactNavigation(), {
    kind: "settings",
    providerId: "steam",
  });
});

test("plugin-lifetime compact navigation resets only on explicit plugin cleanup", () => {
  setDeckyCompactNavigation({ kind: "provider-dashboard", providerId: "steam" });
  assert.equal(readDeckyCompactNavigation().kind, "provider-dashboard");

  resetDeckyCompactNavigationForTests();
  assert.deepStrictEqual(readDeckyCompactNavigation(), { kind: "provider-chooser" });
});

test("Decky route registration is idempotent, symmetrical, and reusable", () => {
  const calls: string[] = [];
  const registration = createDeckyRouteRegistration(
    {
      addRoute(path) {
        calls.push(`add:${path}`);
      },
      removeRoute(path) {
        calls.push(`remove:${path}`);
      },
    },
    [
      { path: "/achievement-companion/one", component: EmptyRoute },
      { path: "/achievement-companion/two", component: EmptyRoute },
    ],
  );

  registration.register();
  registration.register();
  assert.equal(registration.isRegistered(), true);
  assert.deepStrictEqual(calls, [
    "add:/achievement-companion/one",
    "add:/achievement-companion/two",
  ]);

  registration.unregister();
  registration.unregister();
  assert.equal(registration.isRegistered(), false);
  assert.deepStrictEqual(calls.slice(2), [
    "remove:/achievement-companion/two",
    "remove:/achievement-companion/one",
  ]);

  registration.register();
  assert.equal(registration.isRegistered(), true);
  assert.deepStrictEqual(calls.slice(4), [
    "add:/achievement-companion/one",
    "add:/achievement-companion/two",
  ]);
});

test("full-screen route builders produce stable URL-safe paths", () => {
  assert.equal(
    buildDeckyFullScreenProfileRoute("steam community"),
    "/achievement-companion/full-screen/profile/steam%20community",
  );
  assert.equal(
    buildDeckyFullScreenGameRoute("steam", "game/with spaces"),
    "/achievement-companion/full-screen/game/steam/game%2Fwith%20spaces",
  );
  assert.equal(
    buildDeckyFullScreenAchievementRoute("steam", "10", "achievement/#1"),
    "/achievement-companion/full-screen/achievement/steam/10/achievement%2F%231",
  );
  assert.equal(
    buildDeckyFullScreenAchievementHistoryRoute("retroachievements"),
    "/achievement-companion/full-screen/achievement-history/retroachievements",
  );
  assert.equal(
    buildDeckyFullScreenCompletionProgressRoute("steam"),
    "/achievement-companion/full-screen/completion-progress/steam",
  );
  assert.equal(
    buildDeckyFullScreenProviderSettingsRoute("retro/achievements"),
    "/achievement-companion/full-screen/provider-settings/retro%2Fachievements",
  );
  assert.equal(
    buildDeckyFullScreenSettingsRoute(),
    DECKY_FULL_SCREEN_ROUTE_PATTERNS.settings,
  );
});

test("plugin lifecycle owns all route registration and cleanup", () => {
  const indexSource = readFileSync("src/index.tsx", "utf8");
  const navigationSource = readFileSync(
    "src/platform/decky/decky-navigation.tsx",
    "utf8",
  );

  assert.match(indexSource, /registerDeckyFullScreenRoutes\(\)/u);
  assert.match(indexSource, /onDismount\(\)[\s\S]*removeDeckyFullScreenRoutes\(\)/u);
  assert.match(indexSource, /onDismount\(\)[\s\S]*removeDeckyCompactCancelBridges\(\)/u);
  assert.match(indexSource, /onDismount\(\)[\s\S]*resetDeckyCompactNavigation\(\)/u);
  assert.match(indexSource, /onDismount\(\)[\s\S]*clearDeckyCompactOriginFullScreenSession\(\)/u);
  assert.doesNotMatch(navigationSource, /DeckyFullscreenRouteLeaveBoundary/u);
  assert.doesNotMatch(navigationSource, /onUnmount=.*NavigateBack/u);
});

test("plugin cleanup removes every compact cancel bridge listener", () => {
  const removedEventTypes: string[] = [];
  const ownerWindow = {
    addEventListener() {},
    removeEventListener(type: string) {
      removedEventTypes.push(type);
    },
  } as unknown as Window;
  const ownerDocument = { defaultView: ownerWindow } as Document;
  const element = { ownerDocument } as Element;

  ensureCompactProviderCancelBridgeRegisteredForBackButtonElement(element);
  ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement(element);
  ensureCompactGameDetailCancelBridgeRegisteredForBackButtonElement(element);
  removeDeckyCompactCancelBridges();

  assert.deepStrictEqual(removedEventTypes, ["vgp_oncancel", "vgp_oncancel", "vgp_oncancel"]);
});

test("compact-to-full-screen navigation enters the route before closing QAM", () => {
  const navigationSource = readFileSync(
    "src/platform/decky/decky-navigation.tsx",
    "utf8",
  );
  const navigationPortSource = navigationSource.slice(
    navigationSource.indexOf("export function createDeckyNavigationPort"),
  );

  for (const routeVariable of [
    "profileRoute",
    "completionProgressRoute",
    "achievementHistoryRoute",
    "settingsRoute",
  ]) {
    assert.match(
      navigationPortSource,
      new RegExp(
        `DeckyNavigation\\.Navigate\\(${routeVariable}\\);[\\s\\S]*?DeckyNavigation\\.CloseSideMenus\\(\\);`,
        "u",
      ),
    );
  }
});

test("full-screen hierarchy uses native Back without a parallel game stack", () => {
  const navigationSource = readFileSync(
    "src/platform/decky/decky-navigation.tsx",
    "utf8",
  );
  const footerSource = readFileSync(
    "src/platform/decky/decky-full-screen-footer-overlay.tsx",
    "utf8",
  );
  const stateSource = readFileSync(
    "src/platform/decky/decky-full-screen-navigation-state.ts",
    "utf8",
  );

  const achievementRouteSource = navigationSource.slice(
    navigationSource.indexOf("function DeckyFullScreenAchievementRoute"),
    navigationSource.indexOf("function DeckyFullScreenAchievementHistoryRoute"),
  );
  assert.doesNotMatch(achievementRouteSource, /onBack|NavigateBack|vgp_oncancel/u);
  assert.match(navigationSource, /function DeckyFullScreenGameRoute[\s\S]*DeckyNavigation\.NavigateBack\(\)/u);
  assert.doesNotMatch(stateSource, /fullScreenGameRouteBackBehaviors|achievementReturnTarget/u);
  assert.doesNotMatch(navigationSource, /window\.history|history\.back|pushState|replaceState/u);
  assert.doesNotMatch(footerSource, /onBackRef|markDeckyFullscreenReturnRequested/u);
  assert.match(footerSource, /Ordinary B remains unconsumed/u);
});

test("only matching compact-origin roots intercept B, and visual Back uses the same semantic", () => {
  const navigationSource = readFileSync(
    "src/platform/decky/decky-navigation.tsx",
    "utf8",
  );
  const bridgeSource = readFileSync(
    "src/platform/decky/decky-full-screen-terminal-back.tsx",
    "utf8",
  );

  const achievementRouteSource = navigationSource.slice(
    navigationSource.indexOf("function DeckyFullScreenAchievementRoute"),
    navigationSource.indexOf("function DeckyFullScreenAchievementHistoryRoute"),
  );
  assert.doesNotMatch(achievementRouteSource, /DeckyFullScreenTerminalBackBridge|vgp_oncancel/u);
  assert.match(navigationSource, /isDeckyCompactOriginFullScreenSessionRoot\("profile"\)[\s\S]*DeckyFullScreenTerminalBackBridge onBack=\{returnFromProfile\}/u);
  assert.match(navigationSource, /onBack=\{returnFromProfile\}/u);
  assert.match(bridgeSource, /consumeDeckyFullscreenTransientCancel/u);
  assert.match(bridgeSource, /handled \|\|/u);
  assert.match(bridgeSource, /removeEventListener\("vgp_oncancel"/u);
  const footerSource = readFileSync(
    "src/platform/decky/decky-full-screen-footer-overlay.tsx",
    "utf8",
  );
  assert.match(footerSource, /yieldedDeckyFullscreenKeyboardCancelEvents/u);
});

test("compact navigation marks only the full-screen root it enters", () => {
  const navigationSource = readFileSync(
    "src/platform/decky/decky-navigation.tsx",
    "utf8",
  );

  assert.match(navigationSource, /beginDeckyCompactFullScreenEntry\("profile"\)/u);
  assert.match(navigationSource, /return target\.providerId === undefined \|\| target\.gameId === undefined[\s\S]*: "game"/u);
  assert.match(navigationSource, /beginDeckyCompactFullScreenEntry\(sessionRoot\)/u);
  assert.match(navigationSource, /DeckyNavigation\.Navigate\(profileRoute\);[\s\S]*DeckyNavigation\.CloseSideMenus\(\);/u);
});

test("provider profile routing keeps Steam tabs local and routes non-Steam destinations", () => {
  const navigationSource = readFileSync(
    "src/platform/decky/decky-navigation.tsx",
    "utf8",
  );
  const cancelBridgeSource = readFileSync(
    "src/platform/decky/decky-full-screen-cancel-bridge.ts",
    "utf8",
  );

  assert.match(
    navigationSource,
    /providerId === STEAM_PROVIDER_ID[\s\S]*<DeckySteamFullScreenSession/u,
  );
  assert.match(
    navigationSource,
    /onOpenCompletionProgress=[\s\S]*buildDeckyFullScreenCompletionProgressRoute/u,
  );
  assert.doesNotMatch(cancelBridgeSource, /fullscreen-back|handleFullscreenCancelBridge/u);
});
