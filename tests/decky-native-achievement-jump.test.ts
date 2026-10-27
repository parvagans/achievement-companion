import assert from "node:assert/strict";
import test from "node:test";
import { getNativeAchievementListIndex } from "../src/platform/decky/decky-native-achievement-jump-model";

test("native achievement jump locates an exact unlocked or locked RA ID in Steam's list order", () => {
  const earned = [{ strID: "ra:9" }, { strID: "ra:2" }];
  const locked = [{ strID: "ra:1" }, { strID: "ra:3" }];
  assert.equal(getNativeAchievementListIndex(earned, locked, "2"), 1);
  assert.equal(getNativeAchievementListIndex(earned, locked, "1"), 3);
  assert.equal(getNativeAchievementListIndex(earned, locked, "3"), 4);
  assert.equal(getNativeAchievementListIndex(earned, locked, "missing"), undefined);
});
