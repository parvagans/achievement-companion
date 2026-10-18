import assert from "node:assert/strict";
import test from "node:test";
import { WHATS_NEW_SECTIONS } from "../src/platform/decky/decky-whats-new-content";

test("bundled What's New notes cover the update and remain readable offline", () => {
  assert.deepEqual(WHATS_NEW_SECTIONS.map((section) => section.title), [
    "Themes",
    "Interface & navigation",
    "Steam game data",
  ]);
  for (const section of WHATS_NEW_SECTIONS) {
    assert.ok(section.items.length > 0);
    for (const item of section.items) {
      assert.ok(item.length > 20);
      assert.ok(item.length < 180);
    }
  }
  assert.match(WHATS_NEW_SECTIONS[1].items.join(" "), /Quick Access/u);
});
