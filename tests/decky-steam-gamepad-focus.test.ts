import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Steam focus handoff activates the owning native GamepadUI context and tree", async () => {
  const source = await readFile(
    new URL("../src/platform/decky/decky-steam-gamepad-focus.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /owningTree\.m_context\.SetActive\?\.\(true, owningTree\.m_window\)/u);
  assert.match(source, /owningTree\.Activate\?\.\(true\)/u);
  assert.match(source, /node\.BTakeFocus\?\.\(\) === true/u);
  assert.doesNotMatch(source, /\.focus\(|\.click\(|setTimeout/u);
  assert.match(source, /attempts < 3/u);
});
