import assert from "node:assert/strict";
import test from "node:test";
import type { NormalizedAchievement } from "../src/core/domain";
import { getNativeRetroAchievementsActivityItems } from "../src/platform/decky/decky-native-retroachievements-activity-model";

function achievement(achievementId: string, unlockedAt: number | undefined, isUnlocked = true): NormalizedAchievement {
  return {
    achievementId,
    providerId: "retroachievements",
    gameId: "456",
    title: achievementId,
    isUnlocked,
    unlockedAt,
    metrics: [],
  };
}

test("recent RA activity uses only dated unlocks, newest first, without changing the projection", () => {
  const achievements = [
    achievement("old", 1_000),
    achievement("locked", 9_000, false),
    achievement("undated", undefined),
    achievement("new", 3_000),
    achievement("bad", Number.NaN),
    achievement("new", 2_000),
    achievement("middle", 2_500),
  ];
  const items = getNativeRetroAchievementsActivityItems(achievements, 2);
  assert.deepEqual(items.map((item) => item.achievement.achievementId), ["new", "middle"]);
  assert.deepEqual(items.map((item) => item.unlockedAt), [3_000, 2_500]);
  assert.equal(achievements[0]?.achievementId, "old");
  assert.equal(getNativeRetroAchievementsActivityItems(achievements, 0).length, 0);
});
