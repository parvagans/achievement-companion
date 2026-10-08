import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { GameDetailSnapshot, NormalizedGame } from "../src/core/domain";
import {
  buildFullScreenGameSections,
  getAdjacentFullScreenGameSectionId,
} from "../src/platform/decky/decky-full-screen-game-section-navigation";
import {
  readFullScreenGameSectionPageState,
  resetFullScreenGameSectionPageStatesForTests,
  updateFullScreenGameSectionPageState,
} from "../src/platform/decky/decky-full-screen-game-section-state";
import {
  getAdjacentProviderFullScreenSessionTab,
  getProviderFullScreenSessionTabs,
} from "../src/platform/decky/decky-steam-full-screen-session-navigation";
import {
  hasDistinctRetroAchievementsModes,
  projectRetroAchievementsFullScreenAchievements,
} from "../src/platform/decky/decky-retroachievements-full-screen-achievement-data";
import { hasDisplayableRetroAchievementsCommunityStats } from "../src/platform/decky/decky-retroachievements-community-stats-data";
import {
  matchesSteamGamesFilter,
  selectSteamGames,
} from "../src/platform/decky/decky-steam-full-screen-games-data";
import { filterCompletionProgressGamesBySubsetVisibility } from "../src/platform/decky/decky-completion-progress-grouping";
import {
  cacheDeckyRetroAchievementsSubsetDetailState,
  readDeckyRetroAchievementsSubsetDetailStates,
  resetDeckyRetroAchievementsSubsetDetailCacheForTests,
} from "../src/platform/decky/decky-retroachievements-subset-detail-cache";

const game: NormalizedGame = {
  providerId: "retroachievements",
  gameId: "14402",
  title: "Mode Test",
  status: "in_progress",
  summary: { unlockedCount: 2, totalCount: 3, completionPercent: 67 },
  hardcoreSummary: { unlockedCount: 1, totalCount: 3, completionPercent: 33 },
  softcoreSummary: { unlockedCount: 1, totalCount: 3, completionPercent: 33 },
  lastUnlockAt: 300,
  metrics: [],
};

const snapshot: GameDetailSnapshot = {
  game,
  achievements: [
    {
      providerId: "retroachievements",
      gameId: game.gameId,
      achievementId: "hardcore-only",
      title: "Hardcore only",
      isUnlocked: true,
      unlockedAt: 100,
      hardcoreUnlockedAt: 100,
      unlockMode: "hardcore",
      metrics: [],
    },
    {
      providerId: "retroachievements",
      gameId: game.gameId,
      achievementId: "softcore-only",
      title: "Softcore only",
      isUnlocked: true,
      unlockedAt: 200,
      softcoreUnlockedAt: 200,
      unlockMode: "softcore",
      metrics: [],
    },
    {
      providerId: "retroachievements",
      gameId: game.gameId,
      achievementId: "locked",
      title: "Locked",
      isUnlocked: false,
      metrics: [],
    },
  ],
};

test("provider visit tab order keeps Steam and RA four-tab cycles", () => {
  const steamTabs = getProviderFullScreenSessionTabs("steam");
  const raTabs = getProviderFullScreenSessionTabs("retroachievements");

  assert.deepEqual(steamTabs, ["profile", "games", "activity", "settings"]);
  assert.deepEqual(raTabs, ["profile", "games", "activity", "settings"]);
  assert.equal(getAdjacentProviderFullScreenSessionTab(raTabs, "profile", "previous"), "settings");
  assert.equal(getAdjacentProviderFullScreenSessionTab(raTabs, "activity", "next"), "settings");
  assert.equal(getAdjacentProviderFullScreenSessionTab(raTabs, "settings", "next"), "profile");
});

test("full-screen game tabs keep RA Subsets conditional and before Community", () => {
  assert.deepEqual(
    buildFullScreenGameSections({ provider: "retroachievements" }).map((section) => section.label),
    ["Overview", "Achievements"],
  );
  const withBoth = buildFullScreenGameSections({
    provider: "retroachievements",
    hasSubsets: true,
    hasCommunity: true,
  });
  assert.deepEqual(withBoth.map((section) => section.label), ["Overview", "Achievements", "Subsets", "Community"]);
  assert.equal(getAdjacentFullScreenGameSectionId(withBoth, "community", "next"), "overview");
  assert.equal(getAdjacentFullScreenGameSectionId(withBoth, "overview", "previous"), "community");
  assert.deepEqual(
    buildFullScreenGameSections({ provider: "steam", hasAchievementGroups: true, hasCommunity: true }).map((section) => section.label),
    ["Overview", "Achievements", "DLC / Groups", "Community"],
  );
});

test("subset focus and scroll state are isolated per game and survive child return", () => {
  resetFullScreenGameSectionPageStatesForTests();
  updateFullScreenGameSectionPageState("retroachievements", "100", (current) => ({
    ...current,
    activeSection: "subsets",
    subsets: {
      scrollTop: 480,
      expandedSubsetIds: ["101"],
      focusedSubsetId: "101",
      focusedAchievementId: "achievement-1",
    },
  }));
  assert.deepEqual(readFullScreenGameSectionPageState("retroachievements", "100").subsets, {
    scrollTop: 480,
    expandedSubsetIds: ["101"],
    focusedSubsetId: "101",
    focusedAchievementId: "achievement-1",
  });
  assert.equal(readFullScreenGameSectionPageState("retroachievements", "101").activeSection, "overview");
});

test("loaded RA subset achievements stay cached across child-detail return", () => {
  resetDeckyRetroAchievementsSubsetDetailCacheForTests();
  const loadedState = {
    status: "success",
    data: snapshot,
    isStale: false,
    isRefreshing: false,
  } as const;

  cacheDeckyRetroAchievementsSubsetDetailState("retroachievements", "14402", "subset-101", loadedState);

  assert.equal(
    readDeckyRetroAchievementsSubsetDetailStates("retroachievements", "14402")["subset-101"],
    loadedState,
  );
  assert.deepEqual(
    readDeckyRetroAchievementsSubsetDetailStates("retroachievements", "other-game"),
    {},
    "subset detail cache is isolated per parent game",
  );
  resetDeckyRetroAchievementsSubsetDetailCacheForTests();
});

test("RA full-screen achievement projection uses the selected mode and retains locked rows", () => {
  const hardcore = projectRetroAchievementsFullScreenAchievements(snapshot, "hardcore");
  const softcore = projectRetroAchievementsFullScreenAchievements(snapshot, "softcore");
  const both = projectRetroAchievementsFullScreenAchievements(snapshot, "both");

  assert.equal(hardcore.find((entry) => entry.achievementId === "hardcore-only")?.isUnlocked, true);
  assert.equal(hardcore.find((entry) => entry.achievementId === "softcore-only")?.isUnlocked, false);
  assert.equal(hardcore.find((entry) => entry.achievementId === "softcore-only")?.unlockedAt, undefined);
  assert.equal(softcore.find((entry) => entry.achievementId === "hardcore-only")?.isUnlocked, false);
  assert.equal(softcore.find((entry) => entry.achievementId === "softcore-only")?.unlockedAt, 200);
  assert.equal(hardcore.find((entry) => entry.achievementId === "locked")?.isUnlocked, false);
  assert.equal(both, snapshot.achievements);
  assert.equal(hasDistinctRetroAchievementsModes(snapshot.achievements), true);
});

test("RA Games uses award/status semantics and recent unlock ordering", () => {
  const mastered: NormalizedGame = {
    ...game,
    gameId: "mastered",
    title: "Mastered",
    status: "mastered",
    lastUnlockAt: 100,
  };
  const beaten: NormalizedGame = {
    ...game,
    gameId: "beaten",
    title: "Beaten",
    status: "beaten",
    lastUnlockAt: 200,
  };

  assert.equal(matchesSteamGamesFilter(mastered, "mastered"), true);
  assert.equal(matchesSteamGamesFilter(beaten, "beaten"), true);
  assert.equal(matchesSteamGamesFilter(game, "unfinished"), true);
  assert.deepEqual(
    selectSteamGames({ games: [mastered, game, beaten], filter: "all", query: "", sort: "recent" })
      .map((entry) => entry.gameId),
    [game.gameId, beaten.gameId, mastered.gameId],
  );
});

test("RA full-screen Games excludes subset rows; parent game pages own subset navigation", () => {
  const subset: NormalizedGame = {
    ...game,
    gameId: "subset",
    title: "Mode Test [Subset - Bonus]",
  };
  const visible = filterCompletionProgressGamesBySubsetVisibility([game, subset], false);
  assert.deepEqual(visible.map((entry) => entry.gameId), [game.gameId]);
});

test("RA Subsets mirrors Steam group expansion with square set art and child achievement rows", async () => {
  const source = await readFile(
    new URL("../src/platform/decky/decky-retroachievements-subsets-section.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /aria-expanded=\{isExpanded\}/u);
  assert.match(source, /onActivate=\{\(\) => toggleSubset\(subset\.gameId\)\}/u);
  assert.match(source, /projectRetroAchievementsFullScreenAchievements/u);
  assert.match(source, /<DeckyFullScreenAchievementRow/u);
  assert.match(source, /return subset\.coverImageUrl \?\? subset\.boxArtImageUrl/u);
  assert.match(source, /title=\{subset\.title\}/u);
  assert.match(source, /getSubsetCountStyle/u);
  assert.match(source, /\{completionPercent\}%/u);
  assert.match(source, /Loading subset achievements/u);
  assert.match(source, /Subset achievements unavailable/u);
});

test("RA full-screen game keeps the loading gate up until subset discovery settles", async () => {
  const source = await readFile(
    new URL("../src/platform/decky/decky-full-screen-game-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /isWaitingForRetroAchievementsSubsets/u);
  assert.match(source, /activeSteamSection === "subsets"[\s\S]*relatedGamesState\.status === "idle"/u);
  assert.match(source, /relatedGamesState\.status === "idle" \|\| relatedGamesState\.status === "loading"/u);
  assert.match(source, /title: "Loading game subsets\.\.\."/u);
  assert.match(source, /isWaitingForSteamHuntersEnrichment \|\| isWaitingForRetroAchievementsSubsets/u);
});

test("RA Community requires displayable real metrics and rejects sample-only or denominator-free rates", () => {
  assert.equal(hasDisplayableRetroAchievementsCommunityStats(undefined), false);
  assert.equal(hasDisplayableRetroAchievementsCommunityStats({ beatenSamples: 20, masteredSamples: 4 }), false);
  assert.equal(hasDisplayableRetroAchievementsCommunityStats({ masteryPercent: 10 }), false);
  assert.equal(hasDisplayableRetroAchievementsCommunityStats({ totalPlayers: 100 }), true);
  assert.equal(hasDisplayableRetroAchievementsCommunityStats({ totalPlayers: 100, masteredPlayers: 10, masteryPercent: 10 }), true);
  assert.equal(hasDisplayableRetroAchievementsCommunityStats({ medianMasterySeconds: 3_600 }), true);
});
