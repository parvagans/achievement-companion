import assert from "node:assert/strict";
import test from "node:test";
import { formatDeckyNumericText } from "../src/platform/decky/decky-number-format";

test("formats integer and decimal display metrics with locale group separators", () => {
  assert.equal(formatDeckyNumericText("1245320"), (1245320).toLocaleString());
  assert.equal(formatDeckyNumericText("18340.5"), `${(18340).toLocaleString()}.5`);
  assert.equal(formatDeckyNumericText("999"), "999");
});

test("does not alter dates, labels, or already formatted metrics", () => {
  assert.equal(formatDeckyNumericText("9/22/2021"), "9/22/2021");
  assert.equal(formatDeckyNumericText("1,245,320"), "1,245,320");
  assert.equal(formatDeckyNumericText("Unknown"), "Unknown");
});
