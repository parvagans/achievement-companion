import assert from "node:assert/strict";
import test from "node:test";
import type { NormalizedAchievement } from "../src/core/domain";
import { getFullScreenAchievementRenderLimit, planFullScreenAchievementJump, type AchievementTargetFilters } from "../src/platform/decky/decky-full-screen-achievement-target";
const filters: AchievementTargetFilters = { achievementFilter: "all", achievementModeFilter: "all", achievementGroupFilter: "all", achievementAvailabilityFilter: "all", achievementTypeFilter: "all", achievementMissableOnly: false };
const achievements: readonly NormalizedAchievement[] = Array.from({ length: 110 }, (_, index) => ({ providerId: "steam", gameId: "1", achievementId: `id-${index}`, title: `Achievement ${index}`, isUnlocked: index < 50, metrics: [] }));

test("target jump reveals exact rows beyond 36 and preserves compatible filters", () => {
  const plan = planFullScreenAchievementJump({ achievementId: "id-89", achievements, filters: { ...filters, achievementFilter: "locked" } });
  assert.equal(plan?.targetIndex, 39);
  assert.equal(plan?.renderLimit, 72);
  assert.equal(plan?.filters.achievementFilter, "locked");
  assert.equal(getFullScreenAchievementRenderLimit(achievements, "id-89"), 108);
  assert.equal(getFullScreenAchievementRenderLimit(achievements, "id-35"), 36);
  assert.equal(getFullScreenAchievementRenderLimit(achievements, "id-36"), 72);
});

test("target jump clears conflicting status, group, availability and RA type filters", () => {
  const plan = planFullScreenAchievementJump({ achievementId: "id-89", achievements, filters: { ...filters, achievementFilter: "unlocked", achievementGroupFilter: "dlc", achievementAvailabilityFilter: "unobtainable", achievementTypeFilter: "win-condition", achievementMissableOnly: true } });
  assert.deepEqual(plan?.filters, filters);
  assert.equal(plan?.targetIndex, 89);
  assert.equal(plan?.renderLimit, 108);
});

test("target jump honors compatible add-on identity and mode, ignores nonexistent IDs", () => {
  const target = { ...achievements[0]!, unlockMode: "softcore" as const, classification: "missable" as const };
  const plan = planFullScreenAchievementJump({ achievementId: target.achievementId, achievements: [target], filters: { ...filters, achievementModeFilter: "hardcore", achievementMissableOnly: true, achievementGroupFilter: "dlc" }, steamHuntersGroups: { [target.achievementId]: { achievementApiNames: [target.achievementId], dlcAppId: 2 } } });
  assert.equal(plan?.filters.achievementModeFilter, "all");
  assert.equal(plan?.filters.achievementMissableOnly, true);
  assert.equal(plan?.filters.achievementGroupFilter, "dlc");
  assert.equal(planFullScreenAchievementJump({ achievementId: "missing", achievements, filters }), undefined);
});
