import assert from "node:assert/strict";
import test from "node:test";
import { getCenteredViewportScrollTop } from "../src/platform/decky/decky-focus-scroll-model";

test("an inset list centers its row using the list's visible area", () => {
  // The list starts below a fixed header; the 60px row is 100px below its top.
  assert.equal(getCenteredViewportScrollTop(900, 140, 400, 2400, 240, 60), 830);
  // Moving the whole list within its document must not change the result.
  assert.equal(getCenteredViewportScrollTop(900, 240, 400, 2400, 340, 60), 830);
});

test("returning to the first achievement reveals the date group above it", () => {
  // A row 30px into the list is above the viewport after scrolling down 900px.
  assert.equal(getCenteredViewportScrollTop(900, 140, 400, 2400, -730, 60), 0);
  assert.equal(getCenteredViewportScrollTop(0, 140, 400, 2400, 170, 60), 0);
});

test("centering clamps to the bottom and keeps a short list at zero", () => {
  assert.equal(getCenteredViewportScrollTop(1900, 140, 400, 2400, 580, 60), 2000);
  assert.equal(getCenteredViewportScrollTop(0, 140, 400, 180, 260, 60), 0);
});
