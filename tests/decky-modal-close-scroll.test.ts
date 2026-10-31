import assert from "node:assert/strict";
import test from "node:test";
import { preserveModalAncestorScrollWhileFocused } from "../src/platform/decky/decky-modal-close-scroll";

function fixture(offscreen = false) {
  let changed = () => {};
  let disconnected = false;
  const root = { parentElement: null, scrollTop: 11, scrollLeft: 0, listeners: new Set<() => void>(),
    addEventListener(_name: string, fn: () => void) { this.listeners.add(fn); }, removeEventListener(_name: string, fn: () => void) { this.listeners.delete(fn); } };
  const dialog = { ...root, parentElement: root, scrollTop: 0, listeners: new Set<() => void>() };
  let focused = true;
  const button = {
    parentElement: dialog, ownerDocument: { defaultView: { innerWidth: 1280, innerHeight: 800, MutationObserver: class {
      constructor(callback: () => void) { changed = callback; } observe() {} disconnect() { disconnected = true; }
    } } }, getBoundingClientRect: () => ({ top: 500, bottom: offscreen ? 900 : 538, left: 100, right: 400 }), matches: () => focused,
  };
  return { root, dialog, button: button as unknown as HTMLElement, leave: () => { focused = false; changed(); }, disconnected: () => disconnected };
}

test("visible Close focus preserves only its ancestor scroll, including deferred native scrolling", () => {
  const f = fixture();
  const guard = preserveModalAncestorScrollWhileFocused(f.button);
  f.root.scrollTop = 100; f.dialog.scrollTop = 70;
  guard.restore();
  assert.equal(f.root.scrollTop, 11); assert.equal(f.dialog.scrollTop, 0);
  f.dialog.scrollTop = 40;
  for (const callback of f.dialog.listeners) callback();
  assert.equal(f.dialog.scrollTop, 0);
  // Content viewports are siblings of Close; no listener locks their scroll.
  assert.equal(f.dialog.listeners.size, 1);
  f.leave();
  assert.equal(f.disconnected(), true);
  assert.equal(f.dialog.listeners.size, 0);
  f.dialog.scrollTop = 50; guard.restore();
  assert.equal(f.dialog.scrollTop, 50);
});

test("offscreen Close can still be revealed and closing always releases the guard", () => {
  const offscreen = fixture(true);
  preserveModalAncestorScrollWhileFocused(offscreen.button).restore();
  assert.equal(offscreen.root.listeners.size, 0);
  const visible = fixture();
  const guard = preserveModalAncestorScrollWhileFocused(visible.button);
  guard.release(); guard.release();
  assert.equal(visible.dialog.listeners.size, 0);
  assert.equal(visible.disconnected(), true);
  preserveModalAncestorScrollWhileFocused(undefined).release();
});
