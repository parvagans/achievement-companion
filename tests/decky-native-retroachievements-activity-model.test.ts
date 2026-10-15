import assert from "node:assert/strict";
import test from "node:test";
import type { NormalizedAchievement } from "../src/core/domain";
import {
  getNativeRetroAchievementsActivityItems,
  groupNativeRetroAchievementsActivityItems,
} from "../src/platform/decky/decky-native-retroachievements-activity-model";

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

test("RA activity keeps every dated unlock, newest first, without changing the projection", () => {
  const achievements = [
    achievement("old", 1_000),
    achievement("locked", 9_000, false),
    achievement("undated", undefined),
    achievement("new", 3_000),
    achievement("bad", Number.NaN),
    achievement("new", 2_000),
    achievement("middle", 2_500),
    ...Array.from({ length: 10 }, (_, index) => achievement(`extra-${index}`, 10_000 + index)),
  ];
  const items = getNativeRetroAchievementsActivityItems(achievements);
  assert.equal(items.length, 13);
  assert.deepEqual(items.slice(0, 2).map((item) => item.achievement.achievementId), ["extra-9", "extra-8"]);
  assert.deepEqual(items.slice(-3).map((item) => item.achievement.achievementId), ["new", "middle", "old"]);
  assert.deepEqual(items.slice(-3).map((item) => item.unlockedAt), [3_000, 2_500, 1_000]);
  assert.equal(achievements[0]?.achievementId, "old");
  assert.deepEqual(getNativeRetroAchievementsActivityItems([]), []);
});

test("RA activity groups by local calendar day across midnight, newest day first", () => {
  const achievements = [
    achievement("previous-late", new Date(2026, 9, 14, 23, 59, 59).getTime()),
    achievement("today-early", new Date(2026, 9, 15, 0, 0, 0).getTime()),
    achievement("next-early", new Date(2026, 9, 16, 0, 0, 0).getTime()),
    achievement("today-late", new Date(2026, 9, 15, 23, 59, 59).getTime()),
  ];
  const items = getNativeRetroAchievementsActivityItems(achievements);
  const days = groupNativeRetroAchievementsActivityItems([...items].reverse());

  assert.deepEqual(days.map((day) => day.dayKey), ["2026-10-16", "2026-10-15", "2026-10-14"]);
  assert.deepEqual(days.map((day) => day.items.map((item) => item.achievement.achievementId)), [
    ["next-early"],
    ["today-late", "today-early"],
    ["previous-late"],
  ]);
  assert.deepEqual(items.map((item) => item.achievement.achievementId), [
    "next-early", "today-late", "today-early", "previous-late",
  ]);
});
