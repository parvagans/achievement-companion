import assert from "node:assert/strict";
import test from "node:test";
import { getDeckyUpdateStatusText } from "../src/platform/decky/decky-update-status-text";
import type { UpdateState } from "../src/update/update-types";

function state(status: UpdateState["status"], message?: string): UpdateState {
  return {
    status,
    installedVersion: "0.22.2",
    ...(message !== undefined ? { message } : {}),
  };
}

test("available updates use only the green availability card", () => {
  assert.equal(getDeckyUpdateStatusText(state("updateAvailable", "Update 0.22.3 available")), undefined);
});

test("update progress and result messages remain visible", () => {
  assert.equal(getDeckyUpdateStatusText(state("checking")), "Checking…");
  assert.equal(getDeckyUpdateStatusText(state("downloading")), "Downloading…");
  assert.equal(getDeckyUpdateStatusText(state("verifying")), "Verifying…");
  assert.equal(getDeckyUpdateStatusText(state("installing")), "Installing…");
  assert.equal(getDeckyUpdateStatusText(state("upToDate", "Achievement Companion is up to date.")), "Achievement Companion is up to date.");
  assert.equal(getDeckyUpdateStatusText(state("error", "Update check failed.")), "Update check failed.");
});
