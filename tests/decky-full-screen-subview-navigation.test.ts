import assert from "node:assert/strict";
import test from "node:test";
import {
  handleDeckyFullscreenSubviewButtonDown,
  registerDeckyFullscreenSubviewNavigation,
} from "../src/platform/decky/decky-full-screen-subview-navigation";
import { registerDeckyFullscreenPopupCancel } from "../src/platform/decky/decky-full-screen-popup-state";

function fixture() {
  const document = {} as Document;
  const calls: string[] = [];
  const release = registerDeckyFullscreenSubviewNavigation(document, {
    onLeft: () => calls.push("activity"),
    onRight: () => calls.push("analytics"),
  });
  const press = (button: number, isRepeat = false, owner = document) => {
    const consumed: string[] = [];
    const handled = handleDeckyFullscreenSubviewButtonDown({
      detail: { button, source: 0, is_repeat: isRepeat },
      preventDefault: () => consumed.push("default"),
      stopPropagation: () => consumed.push("propagation"),
      stopImmediatePropagation: () => consumed.push("immediate"),
    }, owner);
    return { handled, consumed };
  };
  return { document, calls, release, press };
}

test("LT selects Activity and RT selects Analytics without depending on an event target", () => {
  const { calls, press, release } = fixture();
  try {
    for (const button of [8, 7]) {
      assert.deepEqual(press(button), {
        handled: true, consumed: ["default", "propagation", "immediate"],
      });
    }
    assert.deepEqual(calls, ["analytics", "activity"]);
  } finally { release(); }
});

test("held triggers are consumed without repeating navigation; bumpers remain available", () => {
  const { calls, press, release } = fixture();
  try {
    assert.equal(press(8, true).handled, true);
    assert.equal(press(7, true).handled, true);
    for (const button of [1, 4, 5, 6]) {
      assert.deepEqual(press(button), { handled: false, consumed: [] });
    }
    assert.deepEqual(calls, []);
  } finally { release(); }
});

test("trigger actions are scoped to the owning document and removed when the dashboard exits", () => {
  const { calls, press, release } = fixture();
  assert.deepEqual(press(8, false, {} as Document), { handled: false, consumed: [] });
  release();
  assert.deepEqual(press(8), { handled: false, consumed: [] });
  assert.deepEqual(calls, []);
});

test("stale dashboard cleanup cannot remove the current dashboard's actions", () => {
  const { document, calls, press, release } = fixture();
  const releaseCurrent = registerDeckyFullscreenSubviewNavigation(document, {
    onLeft: () => calls.push("current activity"),
    onRight: () => calls.push("current analytics"),
  });
  try {
    release();
    press(8);
    assert.deepEqual(calls, ["current analytics"]);
  } finally { releaseCurrent(); }
  assert.equal(press(8).handled, false);
});

test("open dropdowns and detail modals prevent background subview navigation", () => {
  const { calls, press, release } = fixture();
  const closePopup = registerDeckyFullscreenPopupCancel(() => {});
  try {
    assert.deepEqual(press(7), { handled: false, consumed: [] });
    assert.deepEqual(press(8), { handled: false, consumed: [] });
    assert.deepEqual(calls, []);
    closePopup();
    press(8);
    assert.deepEqual(calls, ["analytics"]);
  } finally { closePopup(); release(); }
});
