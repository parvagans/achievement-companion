import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildRetroAchievementsCompletionCollection } from "../src/platform/decky/decky-completion-progress-grouping";
import { formatRetroAchievementsCommunityDuration } from "../src/platform/decky/decky-retroachievements-community-stats-data";
import { buildDeckyRetroAchievementsProgressSummaryData } from "../src/platform/decky/decky-retroachievements-progress-summary-data";
import { normalizeRetroAchievementsGameCommunityStats } from "../src/providers/retroachievements/community-stats";
import type { CompletionProgressSnapshot, NormalizedAchievement, NormalizedGame } from "../src/core/domain";

function game(id: string, status: NormalizedGame["status"], parentGameId?: string): NormalizedGame {
  return {
    providerId: "retroachievements",
    gameId: id,
    title: `Game ${id}`,
    status,
    summary: { unlockedCount: 1, totalCount: 2 },
    metrics: [],
    ...(parentGameId !== undefined ? { parentGameId } : {}),
  };
}

function achievement({
  id,
  isUnlocked,
  points,
  unlockedAt,
  unlockMode,
}: {
  readonly id: string;
  readonly isUnlocked: boolean;
  readonly points?: number;
  readonly unlockedAt?: number;
  readonly unlockMode?: "hardcore" | "softcore";
}): NormalizedAchievement {
  return {
    providerId: "retroachievements",
    gameId: "game-1",
    achievementId: id,
    title: `Achievement ${id}`,
    isUnlocked,
    metrics: [],
    ...(points !== undefined ? { points } : {}),
    ...(unlockedAt !== undefined ? { unlockedAt } : {}),
    ...(unlockMode !== undefined ? { unlockMode } : {}),
  };
}

test("community stats use authoritative distribution counts and never expose median samples as player totals", () => {
  const stats = normalizeRetroAchievementsGameCommunityStats({
    totalAchievementCount: 12,
    totalPlayers: 2_916,
    distribution: { "12": 327 },
    progression: {
      TimesUsedInHardcoreBeatMedian: 4_493,
      MedianTimeToBeatHardcore: 30_840,
      TimesUsedInMasteryMedian: 1_091,
      MedianTimeToMaster: 63_720,
    },
  });

  assert.deepEqual(stats, {
    totalPlayers: 2_916,
    masteredPlayers: 327,
    masteryPercent: 327 / 2_916 * 100,
    medianBeatSeconds: 30_840,
    medianMasterySeconds: 63_720,
  });
  assert.equal((stats as Record<string, unknown>).beatenPlayers, undefined);
  assert.equal(formatRetroAchievementsCommunityDuration(stats?.medianBeatSeconds), "8h 34m");
  assert.equal(formatRetroAchievementsCommunityDuration(stats?.medianMasterySeconds), "17h 42m");
});

test("missing community responses remain optional and cannot break a game view", () => {
  assert.equal(
    normalizeRetroAchievementsGameCommunityStats({
      totalAchievementCount: 12,
      totalPlayers: undefined,
      distribution: undefined,
      progression: undefined,
    }),
    undefined,
  );
});

test("profile and completion progress share the same normalized collection counts", () => {
  const snapshot: CompletionProgressSnapshot = {
    providerId: "retroachievements",
    summary: { playedCount: 89, unfinishedCount: 70, beatenCount: 7, masteredCount: 12 },
    games: [game("1", "in_progress"), game("2", "mastered"), game("3", "in_progress", "1")],
  };

  assert.deepEqual(buildRetroAchievementsCompletionCollection(snapshot), {
    playedCount: 89,
    unfinishedCount: 70,
    beatenCount: 7,
    masteredCount: 12,
    subsetCount: 1,
  });
});

test("full-screen RetroAchievements progress derives mode-neutral totals, points, and the latest unlock once", () => {
  const progress = buildDeckyRetroAchievementsProgressSummaryData({
    summary: { unlockedCount: 3, totalCount: 56, completionPercent: 5 },
    achievements: [
      achievement({ id: "a", isUnlocked: true, points: 5, unlockedAt: 1_700_000_000_000, unlockMode: "softcore" }),
      achievement({ id: "b", isUnlocked: true, points: 10, unlockedAt: 1_700_000_020_000, unlockMode: "hardcore" }),
      achievement({ id: "c", isUnlocked: false, points: 385 }),
    ],
  });

  assert.deepEqual(progress, {
    unlockedCount: 3,
    totalCount: 56,
    remainingCount: 53,
    completionPercent: 5,
    earnedPoints: 15,
    totalPoints: 400,
    lastUnlockAt: 1_700_000_020_000,
  });
});

test("full-screen RetroAchievements progress clamps malformed remaining counts and handles zero unlocks", () => {
  const progress = buildDeckyRetroAchievementsProgressSummaryData({
    summary: { unlockedCount: 5, totalCount: 3, completionPercent: -10 },
    achievements: [
      achievement({ id: "a", isUnlocked: false, points: 5 }),
      achievement({ id: "b", isUnlocked: false, points: 10 }),
      achievement({ id: "c", isUnlocked: false, points: 15 }),
    ],
  });

  assert.equal(progress.remainingCount, 0);
  assert.equal(progress.completionPercent, 0);
  assert.equal(progress.earnedPoints, 0);
  assert.equal(progress.totalPoints, 30);
  assert.equal(progress.lastUnlockAt, undefined);
});

test("full-screen RetroAchievements progress represents mastered sets with no remaining achievements", () => {
  const progress = buildDeckyRetroAchievementsProgressSummaryData({
    summary: { unlockedCount: 2, totalCount: 2, completionPercent: 100 },
    achievements: [
      achievement({ id: "a", isUnlocked: true, points: 200, unlockedAt: 1_700_000_000_000, unlockMode: "softcore" }),
      achievement({ id: "b", isUnlocked: true, points: 210, unlockedAt: 1_700_000_030_000, unlockMode: "hardcore" }),
    ],
  });

  assert.equal(progress.remainingCount, 0);
  assert.equal(progress.completionPercent, 100);
  assert.equal(progress.earnedPoints, 410);
  assert.equal(progress.totalPoints, 410);
});

test("full-screen RetroAchievements spotlight keeps the compact header, passive card focus, and action focus contracts", () => {
  const spotlightSource = readFileSync("src/platform/decky/decky-retroachievements-game-spotlight.tsx", "utf8");
  const overviewSource = readFileSync("src/platform/decky/decky-full-screen-game-spotlight-overview.tsx", "utf8");
  const artworkSource = readFileSync("src/platform/decky/decky-retroachievements-fullscreen-game-artwork.tsx", "utf8");
  const progressSource = readFileSync("src/platform/decky/decky-retroachievements-progress-summary.tsx", "utf8");
  const communitySource = readFileSync("src/platform/decky/decky-retroachievements-community-stats.tsx", "utf8");
  const cardSource = readFileSync("src/platform/decky/decky-full-screen-game-spotlight-card.tsx", "utf8");
  const progressStatSource = readFileSync("src/platform/decky/decky-full-screen-game-progress-stat.tsx", "utf8");
  const progressBarSource = readFileSync("src/platform/decky/decky-completion-progress-bar.tsx", "utf8");
  const actionSource = readFileSync("src/platform/decky/decky-full-screen-action-controls.tsx", "utf8");

  assert.match(spotlightSource, /layout="horizontal"[\s\S]*focusable[\s\S]*variant="compact"/u);
  assert.doesNotMatch(spotlightSource, /metadataLabels|loadDecky|useAsyncResourceState|fetch\(/u);
  assert.match(overviewSource, /flexDirection: isHorizontal \? "row" : "column"/u);
  assert.match(overviewSource, /whiteSpace: "normal"/u);
  assert.match(overviewSource, /artwork !== undefined/);
  assert.match(overviewSource, /headerAlignment=\{layout === "horizontal" \? "left" : "center"\}/u);
  assert.match(
    overviewSource,
    /DeckyFullScreenGameSpotlightCard[\s\S]*title="Game Overview"[\s\S]*focusable=\{false\}[\s\S]*DeckyFullScreenGameSpotlightFocusTarget[\s\S]*DeckyFullScreenGameSpotlightActions/u,
  );
  assert.match(artworkSource, /height: isCompact \? 168 : 256/u);
  assert.match(artworkSource, /objectFit: "contain"/u);
  assert.match(progressSource, /DeckyFullScreenGameProgressStatGrid/u);
  assert.match(progressSource, /showCaption=\{false\}/u);
  assert.match(progressBarSource, /showCaption && captionPlacement === "below"/u);
  assert.match(progressSource, /label="Unlocked"[\s\S]*label="Remaining"[\s\S]*label="Points earned"[\s\S]*label="Last unlock"/u);
  assert.match(progressSource, /formatDeckyRelativeTime\(progress\.lastUnlockAt\) \?\? "None yet"/u);
  assert.doesNotMatch(progressSource, /title="Your Progress"[\s\S]*focusable=\{false\}/u);
  assert.doesNotMatch(progressSource, /hardcore|softcore/u);
  assert.match(communitySource, /DeckyFullScreenGameProgressStatGrid fillHeight/u);
  assert.match(communitySource, /Players[\s\S]*Mastered[\s\S]*Median beat[\s\S]*Median mastery/u);
  assert.match(communitySource, /formatMasteryValue/u);
  assert.match(progressStatSource, /gridTemplateColumns: "repeat\(2, minmax\(0, 1fr\)\)"/u);
  assert.match(progressStatSource, /gridTemplateRows: "repeat\(2, minmax\(0, 1fr\)\)"/u);
  assert.match(cardSource, /scrollDeckyFocusTargetIntoView[\s\S]*noFocusRing/u);
  assert.match(actionSource, /focusClassName=\{DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS\}[\s\S]*tabIndex=\{disabled \? -1 : 0\}[\s\S]*onActivate=\{handleClick\}/u);
});
