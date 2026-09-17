import assert from "node:assert/strict";
import test from "node:test";
import { measureSteamGameFooterLayout } from "../src/platform/decky/decky-steam-game-footer-layout";

function createRouteDocument({
  nativeHeight = 41.6667,
  nativeBottom = 534,
  nativeZIndex = "7000",
  hasFooter = true,
} = {}) {
  const parent = { parentElement: null, zIndex: "5" };
  const footer = {
    parentElement: parent,
    zIndex: nativeZIndex,
    getBoundingClientRect: () => ({ height: nativeHeight, width: 854, bottom: nativeBottom }),
  };
  const overlay = { parentElement: null, zIndex: "7001" };
  const points: number[][] = [];
  // Structural DOM doubles deliberately have no global HTMLElement constructor:
  // valid elements from a different Steam window must not be rejected.
  const document = {
    defaultView: {
      innerWidth: 854,
      innerHeight: 534,
      getComputedStyle: (element: { zIndex: string }) => ({ zIndex: element.zIndex }),
    },
    getElementById: (id: string) => id === "Footer" && hasFooter ? footer : null,
    elementsFromPoint: (x: number, y: number) => {
      points.push([x, y]);
      return hasFooter ? [overlay, footer] : [overlay];
    },
  } as unknown as Document;
  const host = { contains: (element: unknown) => element === overlay } as unknown as HTMLElement;
  return { document, host, points };
}

test("uses the route document's real CSS viewport and native footer stacking", () => {
  const { document, host, points } = createRouteDocument();
  assert.deepEqual(measureSteamGameFooterLayout(document, host), { height: 42, zIndex: 7001 });
  assert.equal(points[0]?.[0], 427);
  assert.ok(Math.abs(points[0]![1]! - 513.16665) < 0.001);
});

test("measures a taller native footer rather than assuming 72 CSS pixels", () => {
  const { document, host } = createRouteDocument({ nativeHeight: 80.25 });
  assert.equal(measureSteamGameFooterLayout(document, host).height, 81);
});

test("uses the isolated fallback when native footer is missing or hidden", () => {
  for (const options of [{ hasFooter: false }, { nativeHeight: 0 }, { nativeBottom: 420 }]) {
    const { document, host } = createRouteDocument(options);
    assert.equal(measureSteamGameFooterLayout(document, host).height, 72);
  }
});

test("ignores its own overlay on repeated measurements instead of increasing z-index", () => {
  const { document, host } = createRouteDocument();
  assert.deepEqual(measureSteamGameFooterLayout(document, host), measureSteamGameFooterLayout(document, host));
  assert.equal(measureSteamGameFooterLayout(document, host).zIndex, 7001);
});

test("keeps z-index within CSS integer bounds", () => {
  const { document, host } = createRouteDocument({ nativeZIndex: "2147483647" });
  assert.equal(measureSteamGameFooterLayout(document, host).zIndex, 2147483647);
});

test("handles a detached document without a window", () => {
  assert.deepEqual(measureSteamGameFooterLayout({ defaultView: null } as Document), { height: 72, zIndex: 20 });
});
