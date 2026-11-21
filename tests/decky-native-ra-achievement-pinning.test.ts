import assert from "node:assert/strict";
import test from "node:test";
import { createContext, createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadLocalComponent } from "./helpers/render-decky-component";

const MY_ROUTE = "/library/app/:appid/achievements/my";
const initialProjection = { raGameId: "31" };

function fixture({ install = true, allowRouteDiscovery = true } = {}) {
  const calls: string[] = [];
  const rendered: Record<string, unknown>[] = [];
  let pin: string | undefined = "501";
  let projection: typeof initialProjection | undefined = initialProjection;
  let account = "first";
  let accountRevision = 0;
  const routeContext = createContext(null);
  const nativeToggle = () => calls.push("steam-toggle");
  const nativeWrite = () => calls.push("steam-pins");

  function Panel(props: Record<string, unknown>) {
    rendered.push(props);
    return createElement("div");
  }

  class Route {
    constructor(readonly props: { path: string; children: ReactElement; computedMatch: boolean }) {}
    render(): ReactElement {
      return createElement(routeContext.Consumer, null, (() => createElement(routeContext.Provider, {
        value: null,
        children: this.props.computedMatch ? this.props.children : null,
      })) as () => ReactNode);
    }
  }

  const { exports } = loadLocalComponent("src/platform/decky/decky-native-ra-achievement-pinning.tsx", {
    "@decky/ui": {
      findModuleExport: (predicate: (value: unknown) => boolean) => allowRouteDiscovery && predicate(Route) ? Route : undefined,
      afterPatch: (prototype: typeof Route.prototype, property: "render", patch: (args: unknown[], result: unknown) => ReactElement) => {
        const original = prototype[property];
        prototype[property] = function () { return patch.call(this, [], original.call(this)); };
        return { unpatch: () => { prototype[property] = original; } };
      },
    },
    "./decky-game-overview-preferences": {
      useDeckyGameOverviewPreferences: () => ({ pinnedAchievement: pin === undefined ? undefined : { achievementId: pin } }),
      readPinnedAchievement: () => pin === undefined ? undefined : { achievementId: pin },
      pinAchievement: (scope: { accountId: string }, id: string, mode: string) => {
        calls.push([scope.accountId, id, mode].join(":"));
        pin = id;
      },
      unpinAchievement: (scope: { accountId: string }, expected: string) => {
        if (pin === expected) { calls.push(scope.accountId + ":unpin:" + expected); pin = undefined; }
      },
    },
  });
  const patch = install ? exports.installNativeRaAchievementPinning({
    isShortcut: (appId: number) => appId === 7,
    readAccountRevision: () => accountRevision,
    readProjection: (appId: number, viewer: string) => appId === 7 && viewer === "current" ? projection : undefined,
    resolveTarget: (_appId: number, { strID }: { strID: string }) => /^ra:(501|502)$/u.test(strID)
      ? { providerId: "retroachievements", accountId: account, gameId: "31", achievementId: strID.slice(3), mode: "hardcore" }
      : undefined,
    subscribe: () => () => undefined,
  }) : undefined;

  function render({ appId = 7, viewer = "current", path = MY_ROUTE, hasNativePinning = true } = {}) {
    const panel = createElement(Panel, {
      appid: appId, targetsteamid: viewer, pinnedAchievements: [], showPinning: true,
      ...(hasNativePinning ? { setPinnedAchievements: nativeWrite, setShowPinning: nativeToggle } : {}),
    });
    renderToStaticMarkup(new Route({ path, children: panel, computedMatch: true }).render());
    const props = rendered.at(-1)!;
    return { ...props, setPinnedAchievements: props["setPinnedAchievements"] as ((names: string[]) => void) | undefined };
  }

  return {
    calls, render, patch, nativeWrite, nativeToggle,
    externalPin: (id: string | undefined) => { pin = id; },
    switchAccount: () => { account = "second"; accountRevision++; },
    clearProjection: () => { projection = undefined; },
  };
}

test("Steam's pinned section reads and updates the same one-per-game RA pin as Up Next", () => {
  const before = fixture({ install: false });
  assert.deepEqual(before.render()["pinnedAchievements"], []);

  const f = fixture();
  const first = f.render();
  assert.deepEqual(first["pinnedAchievements"], ["ra:501"]);
  assert.equal(first["setShowPinning"], f.nativeToggle);
  first.setPinnedAchievements?.(["ra:501", "ra:502"]);
  assert.deepEqual(f.calls, ["first:502:hardcore"]);
  const second = f.render();
  assert.deepEqual(second["pinnedAchievements"], ["ra:502"]);
  second.setPinnedAchievements?.([]);
  assert.deepEqual(f.calls, ["first:502:hardcore", "first:unpin:502"]);
  assert.deepEqual(f.render()["pinnedAchievements"], []);
  f.externalPin("501");
  assert.deepEqual(f.render()["pinnedAchievements"], ["ra:501"]);
});

test("Steam and friend routes, unverified shortcuts, and unsupported host components keep their native props", () => {
  const f = fixture();
  for (const props of [{ appId: 4 }, { viewer: "friend" }, { path: "/library/app/:appid/achievements/friend" }]) {
    assert.equal(f.render(props).setPinnedAchievements, f.nativeWrite);
  }
  assert.equal(f.render({ hasNativePinning: false }).setPinnedAchievements, undefined);
  f.clearProjection();
  assert.equal(f.render().setPinnedAchievements, f.nativeWrite);
  assert.equal(fixture({ allowRouteDiscovery: false }).patch, undefined);
});

test("Only verified achievements are writable and stale callbacks cannot change another pin or account", () => {
  const f = fixture();
  const first = f.render();
  first.setPinnedAchievements?.(["ra:999"]);
  first.setPinnedAchievements?.(["steam-id"]);
  f.externalPin("502");
  first.setPinnedAchievements?.([]);
  assert.deepEqual(f.calls, []);
  first.setPinnedAchievements?.(["ra:502"]);
  assert.deepEqual(f.calls, []);
  const active = f.render();
  f.switchAccount();
  active.setPinnedAchievements?.(["ra:501"]);
  active.setPinnedAchievements?.([]);
  assert.deepEqual(f.calls, []);
  f.patch?.unpatch();
  assert.equal(f.render().setPinnedAchievements, f.nativeWrite);
});
