import assert from "node:assert/strict";
import test from "node:test";
import { renderCompactProfileHeader } from "./helpers/compact-profile-header-render";

test("both providers render a fixed utility control and explicitly sized image independent of resolution", () => {
  for (const provider of ["Steam", "RetroAchievements"]) for (const focused of [false, true]) {
    const { html, control } = renderCompactProfileHeader({ provider, focused, avatar: "https://example.invalid/avatar-1024.png", currentGame: provider === "RetroAchievements" });
    assert.equal(control.style.height, 38);
    assert.equal(control.style.minHeight, 38);
    assert.equal(control.style.maxHeight, 38);
    assert.equal(control.style.width, 38);
    assert.equal(control.style.whiteSpace, "nowrap");
    assert.match(html, /grid-template-columns:minmax\(0, 1fr\) auto/u);
    assert.match(html, /<img[^>]*width="24" height="24"/u);
    assert.match(html, /data-ac-compact-profile-avatar[^>]*width:24px;min-width:24px;max-width:24px;height:24px;min-height:24px;max-height:24px;flex:0 0 24px/u);
    assert.match(html, /object-fit:cover/u);
    assert.doesNotMatch(html, />Profile<\//u);
    assert.match(html, /aria-label="Pinned Achievements"/u);
    assert.match(html, /<svg width="20" height="20"/u);
    assert.doesNotMatch(html, />Account name/u);
    assert.ok(control["aria-label"].includes(provider));
    assert.ok(html.includes(provider === "Steam" ? "CONTINUE PLAYING" : "CURRENT GAME"));
  }
});

test("missing avatar keeps the fixed frame and useful fallback", () => {
  const { html } = renderCompactProfileHeader();
  assert.doesNotMatch(html, /<img/u);
  assert.match(html, />AN<\/span>/u);
  assert.match(html, /flex:0 0 24px/u);
});

test("shortcut retains activation, Back, focus checkpoint and preferred entry contracts", () => {
  const events: unknown[] = [];
  const rendered = renderCompactProfileHeader({ onActivate: () => events.push("open"), onCancel: () => events.push("back"), onActivated: (node) => events.push(node), onFocused: (node) => events.push(node) });
  const node = {} as HTMLDivElement;
  rendered.attach(node);
  rendered.control.onActivate();
  rendered.control.onCancel();
  rendered.control.onGamepadFocus();
  assert.deepEqual(events, [node, "open", "back", node]);
  assert.equal(rendered.control.preferredFocus, true);
  assert.equal(rendered.control.onOKActionDescription, "Open Profile");
});

test("header thumbtack opens the viewer with its own semantic checkpoint", () => {
  const events: unknown[] = [];
  const rendered = renderCompactProfileHeader({ onOpenPinned: (node) => events.push(node), onActivated: () => events.push("checkpoint") });
  const node = {} as HTMLDivElement;
  rendered.attachPinned(node);
  rendered.pinnedControl.onActivate();
  assert.deepEqual(events, ["checkpoint", node]);
  assert.equal(rendered.pinnedControl.onOKActionDescription, "Pinned Achievements");
  assert.equal(rendered.pinnedControl.style.width, 38);
  assert.equal(rendered.pinnedControl.style.height, 38);
  assert.equal(rendered.pinnedControl.style.background, "transparent");
});
