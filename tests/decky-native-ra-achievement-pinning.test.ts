import assert from "node:assert/strict";
import test from "node:test";
import { createContext, createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadLocalComponent } from "./helpers/render-decky-component";

const MY_ROUTE = "/library/app/:appid/achievements/my";
const initialProjection = { raGameId: "31" };

function fixture({ install = true, allowRouteDiscovery = true, overlay = false, withSubsets = false } = {}) {
  const calls: string[] = [];
  const rendered: Record<string, unknown>[] = [];
  const storedPins = new Map([["first:31", "501"]]);
  let sets = withSubsets ? ["32", "33"].map(raGameId => ({ projection: { raGameId } })) : [];
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

  const layout = {
    $$typeof: Symbol.for("react.forward_ref"),
    render(props: { children: ReactNode; padForHeader: boolean; padForFooter: boolean; contentMaxWidth?: string }) {
      const { padForHeader, padForFooter, contentMaxWidth, children } = props;
      return createElement("div", { className: "GamepadPage", "data-pads": [padForHeader, padForFooter, contentMaxWidth].join() }, children);
    },
  };
  const { exports } = loadLocalComponent("src/platform/decky/decky-native-ra-achievement-pinning.tsx", {
    "@decky/ui": {
      findModuleExport: (predicate: (value: unknown) => boolean) => allowRouteDiscovery ? [Route, layout].find(predicate) : undefined,
      beforePatch: (component: typeof layout, property: "render", callback: (args: unknown[]) => void) => {
        const original = component[property];
        component[property] = function (...args: Parameters<typeof original>) {
          callback(args);
          return original.call(this, ...args);
        };
        return { unpatch: () => { component[property] = original; } };
      },
      afterPatch: (prototype: typeof Route.prototype, property: "render", patch: (args: unknown[], result: unknown) => ReactElement) => {
        const original = prototype[property];
        prototype[property] = function () { return patch.call(this, [], original.call(this)); };
        return { unpatch: () => { prototype[property] = original; } };
      },
    },
    "./decky-game-overview-preferences": {
      useSavedPinnedAchievements: () => ({
        pins: [...storedPins].flatMap(([key, achievementId]) => {
          const [accountId, gameId] = key.split(":");
          return accountId === account ? [{ accountId, gameId, achievementId, providerId: "retroachievements" }] : [];
        }),
      }),
      readPinnedAchievement: ({ accountId, gameId }: { accountId: string; gameId: string }) => {
        const achievementId = storedPins.get(accountId + ":" + gameId);
        return achievementId === undefined ? undefined : { achievementId };
      },
      pinAchievement: (scope: { accountId: string; gameId: string }, id: string, mode: string) => {
        calls.push([scope.accountId, id, mode].join(":"));
        storedPins.set(scope.accountId + ":" + scope.gameId, id);
      },
      unpinAchievement: (scope: { accountId: string; gameId: string }, expected: string) => {
        const key = scope.accountId + ":" + scope.gameId;
        if (storedPins.get(key) === expected) {
          calls.push(scope.accountId + ":unpin:" + expected);
          storedPins.delete(key);
        }
      },
    },
  });
  const patch = install ? (overlay ? exports.installNativeRaOverlayAchievementPinning : exports.installNativeRaAchievementPinning)({
    isShortcut: (appId: number) => appId === 7,
    readAccountRevision: () => accountRevision,
    readProjection: (appId: number, viewer: string) => appId === 7 && viewer === "current" ? projection : undefined,
    readSubsets: () => sets,
    resolveTarget: (_appId: number, { strID }: { strID: string }) => {
      const gameId = /^ra:(501|502)$/u.test(strID) ? "31"
        : /^ra:(601|602)$/u.test(strID) ? "32"
        : strID === "ra:701" ? "33" : undefined;
      if (gameId === undefined || (gameId !== "31" && !sets.some(set => set.projection.raGameId === gameId))) return undefined;
      return { providerId: "retroachievements", accountId: account, gameId, achievementId: strID.slice(3), mode: "hardcore" };
    },
    subscribe: () => () => undefined,
  }) : undefined;

  function render({ appId = 7, viewer = "current", path = MY_ROUTE, hasNativePinning = true } = {}) {
    const panel = createElement(Panel, {
      appid: appId, targetsteamid: viewer, pinnedAchievements: [], showPinning: true,
      ...(overlay ? { asPanel: true, headerVariant: "compact" } : {}),
      ...(hasNativePinning ? { setPinnedAchievements: nativeWrite, setShowPinning: nativeToggle } : {}),
    });
    renderToStaticMarkup(overlay
      ? layout.render({ children: createElement("section", null, panel), padForHeader: false, padForFooter: false, scrollable: false } as Parameters<typeof layout.render>[0])
      : new Route({ path, children: panel, computedMatch: true }).render());
    const props = rendered.at(-1)!;
    return { ...props, setPinnedAchievements: props["setPinnedAchievements"] as ((names: string[]) => void) | undefined };
  }

  return {
    calls, render, patch, nativeWrite, nativeToggle,
    externalPin: (id: string | undefined) => { if (id === undefined) storedPins.delete(account + ":31"); else storedPins.set(account + ":31", id); },
    readSavedPin: (gameId: string) => storedPins.get(account + ":" + gameId),
    clearSubsets: () => { sets = []; },
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

test("the in-game Steam panel shows and edits the existing RetroAchievements pin", () => {
  const f = fixture({ overlay: true });
  assert.deepEqual(f.render()["pinnedAchievements"], ["ra:501"]);
  assert.equal(f.render({ appId: 4 }).setPinnedAchievements, f.nativeWrite);
  f.render().setPinnedAchievements?.(["ra:501", "ra:502"]);
  assert.deepEqual(f.calls, ["first:502:hardcore"]);
  assert.deepEqual(f.render()["pinnedAchievements"], ["ra:502"]);
});

test("native subset pins use the child game's scope and preserve the base and sibling pins", () => {
  const f = fixture({ withSubsets: true });
  assert.deepEqual(f.render()["pinnedAchievements"], ["ra:501"]);
  f.render().setPinnedAchievements?.(["ra:501", "ra:601"]);
  assert.equal(f.readSavedPin("31"), "501");
  assert.equal(f.readSavedPin("32"), "601");
  assert.deepEqual(f.render()["pinnedAchievements"], ["ra:501", "ra:601"]);

  f.render().setPinnedAchievements?.(["ra:501", "ra:601", "ra:701"]);
  f.render().setPinnedAchievements?.(["ra:501", "ra:601", "ra:701", "ra:602"]);
  assert.equal(f.readSavedPin("32"), "602");
  assert.equal(f.readSavedPin("33"), "701");
  f.render().setPinnedAchievements?.(["ra:501", "ra:701"]);
  assert.equal(f.readSavedPin("31"), "501");
  assert.equal(f.readSavedPin("32"), undefined);
  assert.equal(f.readSavedPin("33"), "701");
});

test("a native callback retained after leaving a verified subset cannot change its pins", () => {
  const f = fixture({ withSubsets: true });
  const first = f.render();
  first.setPinnedAchievements?.(["ra:501", "ra:601"]);
  const withPin = f.render();
  f.clearSubsets();
  withPin.setPinnedAchievements?.(["ra:501"]);
  withPin.setPinnedAchievements?.(["ra:501", "ra:601", "ra:602"]);
  assert.equal(f.readSavedPin("32"), "601");
  assert.deepEqual(f.render()["pinnedAchievements"], ["ra:501"]);
});