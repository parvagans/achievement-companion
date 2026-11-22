import assert from "node:assert/strict";
import test from "node:test";
import { loadLocalComponent } from "./helpers/render-decky-component";
import { getNativeAchievementListIndex, getNativeAchievementVirtualIndex } from "../src/platform/decky/decky-native-achievement-jump-model";

test("native achievement jump locates an exact unlocked or locked RA ID in Steam's list order", () => {
  const earned = [{ strID: "ra:9" }, { strID: "ra:2" }];
  const locked = [{ strID: "ra:1" }, { strID: "ra:3" }];
  assert.equal(getNativeAchievementListIndex(earned, locked, "2"), 1);
  assert.equal(getNativeAchievementListIndex(earned, locked, "1"), 3);
  assert.equal(getNativeAchievementListIndex(earned, locked, "3"), 4);
  assert.equal(getNativeAchievementListIndex(earned, locked, "missing"), undefined);
});

test("native achievement jump uses Steam's exact grouped row keys with headers and pinned rows present", () => {
  const keys = ["p:12", "h0", "s0:unlocked", "r0:2", "r0:9", "s0:locked", "r0:12", "h32", "s32:locked", "r32:120"];
  const read = (index: number) => keys[index];
  assert.equal(getNativeAchievementVirtualIndex(keys.length, read, "12"), 6);
  assert.equal(getNativeAchievementVirtualIndex(keys.length, read, "120"), 9);
  assert.equal(getNativeAchievementVirtualIndex(keys.length, read, "1"), undefined);
  assert.equal(getNativeAchievementVirtualIndex(keys.length, read, "0"), undefined);
});
test("the native jump scrolls to the offscreen row and restores only the originating Up Next card", () => {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  const location = { pathname: "/routes/library/app/7/tab/Activity" };
  Object.defineProperty(globalThis, "location", { configurable: true, value: location });
  const scheduled: (() => void)[] = [];
  const focused: unknown[] = [];
  const scrolled: number[] = [];
  const { exports } = loadLocalComponent("src/platform/decky/decky-native-achievement-jump.ts", {
    "./decky-steam-gamepad-focus": {
      requestDeckySteamGamepadFocusAfterMount: (element: unknown) => { focused.push(element); return () => {}; },
    },
  });
  const virtualizer = {
    options: { count: 5, getItemKey: (index: number) => ["h0", "r0:1", "h32", "s32:locked", "r32:12"][index] },
    scrollToIndex: (index: number) => { scrolled.push(index); },
  };
  function createRow(id: string) {
    const row = {
      hasAttribute: (attribute: string) => attribute === "data-tableindex",
      querySelector: () => null,
      scrollIntoView: () => {},
      __reactFiber$test: { memoizedProps: { achievement: { api_name: "ra:" + id } }, return: { memoizedProps: { virtualizer } } },
    };
    return row;
  }
  const visible = createRow("1");
  const target = createRow("12");
  let rows = [visible];
  const document = {
    defaultView: { setTimeout: (callback: () => void) => scheduled.push(callback), clearTimeout: () => {} },
    querySelectorAll: () => rows,
  };
  const card = {};
  try {
    exports.focusNativeAchievementAfterNavigation(document, 7, "12", "up-next", "12");
    assert.equal(exports.readNativeAchievementJumpReturn(7, "up-next"), undefined);
    location.pathname = "/routes/library/app/7/achievements/my/individual";
    scheduled.shift()?.();
    assert.deepEqual(scrolled, [4]);
    rows = [target];
    scheduled.shift()?.();
    assert.deepEqual(focused, [target]);
    location.pathname = "/routes/library/app/9/tab/Activity";
    assert.equal(exports.readNativeAchievementJumpReturn(9, "up-next"), undefined);
    location.pathname = "/routes/library/app/7/tab/Activity";
    assert.equal(exports.readNativeAchievementJumpReturn(7, "activity"), undefined);
    assert.equal(exports.readNativeAchievementJumpReturn(7, "up-next"), "12");
    exports.restoreNativeAchievementJumpReturn(card, 7, "up-next", "12");
    assert.deepEqual(focused, [target, card]);
    assert.equal(exports.readNativeAchievementJumpReturn(7, "up-next"), undefined);
  } finally {
    exports.cancelNativeAchievementJump();
    if (previousLocation === undefined) Reflect.deleteProperty(globalThis, "location");
    else Object.defineProperty(globalThis, "location", previousLocation);
  }
});