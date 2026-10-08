import assert from "node:assert/strict";
import { test } from "node:test";
import type { RecentUnlock } from "../src/core/domain";
import {
  createDeckyRecentAchievementCandidate,
  finalizeDeckyRecentAchievementCandidates,
  getRecentUnlockIdentity,
  selectDeckyRecentAchievementGameCandidates,
} from "../src/platform/decky/decky-recent-achievement-history-selection";

function createRecentUnlock(id: number, unlockedAt?: number): RecentUnlock {
  return {
    achievement: {
      providerId: "retroachievements",
      gameId: "game-1",
      achievementId: `achievement-${id}`,
      title: `Achievement ${id}`,
      isUnlocked: true,
      metrics: [],
      ...(unlockedAt !== undefined ? { unlockedAt } : {}),
    },
    game: {
      providerId: "retroachievements",
      gameId: "game-1",
      title: "Test Game",
    },
    ...(unlockedAt !== undefined ? { unlockedAt } : {}),
  };
}

test("recent achievement selection prioritizes trusted timestamps, deduplicates, and caps at ten", () => {
  const trustedCandidates = Array.from({ length: 11 }, (_value, index) =>
    createDeckyRecentAchievementCandidate(
      createRecentUnlock(index + 1, 1_700_000_000_000 + index),
      "date-range",
    ),
  );
  const duplicateFallback = createDeckyRecentAchievementCandidate(
    createRecentUnlock(11),
    "cache",
  );
  const fallbackCandidate = createDeckyRecentAchievementCandidate(
    createRecentUnlock(99),
    "cache",
  );

  const selection = finalizeDeckyRecentAchievementCandidates([
    ...trustedCandidates,
    duplicateFallback,
    fallbackCandidate,
  ]);

  assert.equal(selection.trustedCandidates.length, 11);
  assert.equal(selection.fallbackCandidates.length, 1);
  assert.deepStrictEqual(
    selection.selectedCandidates.map((candidate) => candidate.recentUnlock.achievement.achievementId),
    [
      "achievement-11",
      "achievement-10",
      "achievement-9",
      "achievement-8",
      "achievement-7",
      "achievement-6",
      "achievement-5",
      "achievement-4",
      "achievement-3",
      "achievement-2",
    ],
  );
});

test("recent achievement game discovery chooses the most recent candidate for each game", () => {
  const selected = selectDeckyRecentAchievementGameCandidates([
    {
      gameId: "game-a",
      title: "Game A",
      source: "completion-progress",
      unlockedCount: 4,
      sortEpoch: 100,
    },
    {
      gameId: "game-a",
      title: "Game A",
      source: "recently-played",
      unlockedCount: 4,
      sortEpoch: 300,
    },
    {
      gameId: "game-b",
      title: "Game B",
      source: "snapshot-recently-played",
      unlockedCount: 2,
      sortEpoch: 200,
    },
  ]);

  assert.deepStrictEqual(
    selected.map((candidate) => `${candidate.gameId}:${candidate.source}`),
    ["game-a:recently-played", "game-b:snapshot-recently-played"],
  );
});

test("RetroAchievements history keeps distinct Hardcore and Softcore awards", () => {
  const hardcore: RecentUnlock = {
    ...createRecentUnlock(1, 1_700_000_000_000),
    achievement: {
      ...createRecentUnlock(1, 1_700_000_000_000).achievement,
      unlockMode: "hardcore",
    },
  };
  const softcore: RecentUnlock = {
    ...createRecentUnlock(1, 1_700_000_000_100),
    achievement: {
      ...createRecentUnlock(1, 1_700_000_000_100).achievement,
      unlockMode: "softcore",
    },
  };

  assert.notEqual(getRecentUnlockIdentity(hardcore), getRecentUnlockIdentity(softcore));
  const selection = finalizeDeckyRecentAchievementCandidates([
    createDeckyRecentAchievementCandidate(hardcore, "date-range"),
    createDeckyRecentAchievementCandidate(softcore, "date-range"),
  ]);
  assert.equal(selection.selectedCandidates.length, 2);
});

test("Steam history retains its one-unlock identity", () => {
  const original = createRecentUnlock(1, 1_700_000_000_000);
  const first: RecentUnlock = {
    ...original,
    achievement: { ...original.achievement, providerId: "steam", unlockMode: "hardcore" },
    game: { ...original.game, providerId: "steam" },
  };
  const second: RecentUnlock = {
    ...first,
    unlockedAt: 1_700_000_000_100,
    achievement: { ...first.achievement, unlockedAt: 1_700_000_000_100, unlockMode: "softcore" },
  };

  assert.equal(getRecentUnlockIdentity(first), getRecentUnlockIdentity(second));
});
