import assert from "node:assert/strict";
import test from "node:test";
import type { NormalizedGame } from "../src/core/domain";
import {
  getSteamGamesRemainingAchievementCount,
  matchesSteamGamesFilter,
  selectSteamGames,
} from "../src/platform/decky/decky-steam-full-screen-games-data";
import { formatCompletionProgressSelectionLabelForProvider } from "../src/platform/decky/decky-completion-progress-summary-card-data";

function steamGame(
  gameId: string,
  unlockedCount: number,
  totalCount?: number,
  scanStatus: NormalizedGame["scanStatus"] = "scanned",
): NormalizedGame {
  return {
    providerId: "steam",
    gameId,
    title: gameId,
    status: "in_progress",
    summary: { unlockedCount, ...(totalCount === undefined ? {} : { totalCount }) },
    metrics: [],
    scanStatus,
  };
}

function raGame(
  gameId: string,
  unlockedCount: number,
  totalCount?: number,
  status: NormalizedGame["status"] = "in_progress",
): NormalizedGame {
  return {
    providerId: "retroachievements",
    gameId,
    title: gameId,
    status,
    summary: { unlockedCount, ...(totalCount === undefined ? {} : { totalCount }) },
    metrics: [],
  };
}

function selectedGames(
  games: readonly NormalizedGame[],
  sort: "recent" | "oldest" | "completion" | "fewest_remaining",
  filter: "all" | "completed" = "all",
  mode: "hardcore" | "softcore" | "both" = "both",
): readonly string[] {
  return selectSteamGames({ games, filter, query: "", sort, mode }).map((game) => game.gameId);
}

test("remaining includes a beaten RA game with actual achievements left", () => {
  const beaten = {
    ...raGame("beaten", 4, 10, "beaten"),
    metrics: [{ key: "highest-award-kind", label: "Award", value: "beaten-hardcore" }],
  } satisfies NormalizedGame;
  const mastered = raGame("mastered", 10, 10, "mastered");

  assert.equal(getSteamGamesRemainingAchievementCount(beaten), 6);
  assert.equal(matchesSteamGamesFilter(beaten, "remaining"), true);
  assert.equal(matchesSteamGamesFilter(beaten, "unfinished"), false);
  assert.equal(matchesSteamGamesFilter(beaten, "completed"), true);
  assert.equal(matchesSteamGamesFilter(mastered, "remaining"), false);
  assert.equal(getSteamGamesRemainingAchievementCount(mastered), 0);
});

test("RA Any award includes verified Beaten, Mastered, and Softcore Completed without conflating them", () => {
  const awarded = [
    { ...raGame("beaten", 4, 10, "beaten"), metrics: [{ key: "highest-award-kind", label: "Award", value: "beaten-hardcore" }] },
    { ...raGame("mastered", 10, 10, "mastered"), metrics: [{ key: "highest-award-kind", label: "Award", value: "mastered-hardcore" }] },
    { ...raGame("completed", 10, 10, "completed"), metrics: [{ key: "highest-award-kind", label: "Award", value: "completed-softcore" }] },
  ] satisfies readonly NormalizedGame[];
  const inferredOnly = raGame("inferred", 10, 10, "beaten");

  assert.deepEqual(awarded.filter((game) => matchesSteamGamesFilter(game, "completed")).map((game) => game.gameId), [
    "beaten", "mastered", "completed",
  ]);
  assert.deepEqual(awarded.filter((game) => matchesSteamGamesFilter(game, "beaten")).map((game) => game.gameId), [
    "beaten",
  ]);
  assert.deepEqual(awarded.filter((game) => matchesSteamGamesFilter(game, "mastered")).map((game) => game.gameId), [
    "mastered",
  ]);
  assert.equal(matchesSteamGamesFilter(inferredOnly, "completed"), false);
  assert.equal(matchesSteamGamesFilter(inferredOnly, "beaten"), false);
  assert.deepEqual(awarded.filter((game) => matchesSteamGamesFilter(game, "completed", "softcore")).map((game) => game.gameId), [
    "completed",
  ]);
});

test("played profile shortcut has an explicit Games filter label", () => {
  assert.equal(formatCompletionProgressSelectionLabelForProvider("played", "steam"), "Played");
  assert.equal(formatCompletionProgressSelectionLabelForProvider("played", "retroachievements"), "Played");
});

test("remaining uses the selected RA mode and never treats missing counts as zero", () => {
  const game = {
    ...raGame("mode-split", 5, 5),
    hardcoreSummary: { unlockedCount: 2, totalCount: 5 },
    softcoreSummary: { unlockedCount: 5, totalCount: 5 },
  } satisfies NormalizedGame;
  const unavailable = raGame("unknown-split", 2, 5);

  assert.equal(getSteamGamesRemainingAchievementCount(game, "hardcore"), 3);
  assert.equal(getSteamGamesRemainingAchievementCount(game, "softcore"), 0);
  assert.equal(getSteamGamesRemainingAchievementCount(game, "both"), 0);
  assert.equal(matchesSteamGamesFilter(game, "remaining", "hardcore"), true);
  assert.equal(matchesSteamGamesFilter(game, "remaining", "softcore"), false);
  assert.equal(getSteamGamesRemainingAchievementCount(unavailable, "hardcore"), undefined);
  assert.equal(matchesSteamGamesFilter(unavailable, "remaining", "hardcore"), false);
  assert.equal(matchesSteamGamesFilter(unavailable, "remaining", "both"), true);
});

test("Steam remaining includes untouched scanned games but omits unverified or invalid counts", () => {
  assert.equal(matchesSteamGamesFilter(steamGame("untouched", 0, 20), "remaining"), true);
  assert.equal(getSteamGamesRemainingAchievementCount(steamGame("unknown", 0)), undefined);
  assert.equal(getSteamGamesRemainingAchievementCount(steamGame("failed", 0, 20, "failed")), undefined);
  assert.equal(getSteamGamesRemainingAchievementCount(steamGame("no-achievements", 0, 0, "no-achievements")), undefined);
  assert.equal(getSteamGamesRemainingAchievementCount(steamGame("impossible", 21, 20)), undefined);
  assert.equal(getSteamGamesRemainingAchievementCount(steamGame("fractional", 2.5, 20)), undefined);
});

test("fewest remaining ranks valid targets before complete and unknown games", () => {
  const games = [
    steamGame("unknown", 0),
    steamGame("complete", 10, 10),
    steamGame("five-left", 5, 10),
    steamGame("one-left", 9, 10),
    steamGame("unverified", 1, 2, "failed"),
  ];
  assert.deepEqual(selectedGames(games, "fewest_remaining"), [
    "one-left", "five-left", "complete", "unknown", "unverified",
  ]);
  assert.deepEqual(selectedGames(games, "completion"), [
    "complete", "one-left", "five-left", "unknown", "unverified",
  ]);
});

test("fewest remaining follows RA mode-specific counts", () => {
  const games = [
    { ...raGame("a", 3, 10), hardcoreSummary: { unlockedCount: 9, totalCount: 10 }, softcoreSummary: { unlockedCount: 1, totalCount: 10 } },
    { ...raGame("b", 3, 10), hardcoreSummary: { unlockedCount: 2, totalCount: 10 }, softcoreSummary: { unlockedCount: 8, totalCount: 10 } },
  ] satisfies readonly NormalizedGame[];

  assert.deepEqual(selectedGames(games, "fewest_remaining", "all", "hardcore"), ["a", "b"]);
  assert.deepEqual(selectedGames(games, "fewest_remaining", "all", "softcore"), ["b", "a"]);
});

test("newest and oldest mean last played for Steam and last unlock for RA", () => {
  const steamGames = [
    { ...steamGame("earlier-play", 1, 3), lastPlayedAt: 100, lastUnlockAt: 900 },
    { ...steamGame("later-play", 1, 3), lastPlayedAt: 200, lastUnlockAt: 50 },
    { ...steamGame("no-play", 1, 3), lastUnlockAt: 1000 },
  ];
  const raGames = [
    {
      ...raGame("earlier-unlock", 1, 3, "beaten"),
      lastUnlockAt: 100,
      lastPlayedAt: 1000,
      metrics: [
        { key: "highest-award-kind", label: "Award", value: "beaten-hardcore" },
        { key: "highest-award-date", label: "Award date", value: "10000" },
      ],
    },
    { ...raGame("later-unlock", 1, 3, "beaten"), lastUnlockAt: 200, lastPlayedAt: 10, metrics: [{ key: "highest-award-kind", label: "Award", value: "beaten-hardcore" }] },
    { ...raGame("no-unlock", 1, 3, "beaten"), lastPlayedAt: 2000, metrics: [{ key: "highest-award-kind", label: "Award", value: "beaten-hardcore" }] },
  ];

  assert.deepEqual(selectedGames(steamGames, "recent"), ["later-play", "earlier-play", "no-play"]);
  assert.deepEqual(selectedGames(raGames, "recent", "completed"), ["later-unlock", "earlier-unlock", "no-unlock"]);
  assert.deepEqual(selectedGames(steamGames, "oldest"), ["earlier-play", "later-play", "no-play"]);
  assert.deepEqual(selectedGames(raGames, "oldest", "completed"), ["earlier-unlock", "later-unlock", "no-unlock"]);
});
