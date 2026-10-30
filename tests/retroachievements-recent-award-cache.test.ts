import assert from "node:assert/strict";
import { test } from "node:test";
import { createRetroAchievementsProvider } from "../src/providers/retroachievements/retroachievements.provider";
import type { RawRetroAchievementsCompletionProgressEntry } from "../src/providers/retroachievements/raw-types";

const config = { username: "alice", apiKey: "test-key" };

function completionEntry(awardKind: string): RawRetroAchievementsCompletionProgressEntry {
  return {
    GameID: 100,
    Title: "Example Game",
    ConsoleID: 1,
    MaxPossible: 2,
    NumAwarded: 2,
    HighestAwardKind: awardKind,
    HighestAwardDate: "2024-04-23T21:28:49+00:00",
  };
}

test("recently played awards reuse completion progress instead of requesting each game detail", async () => {
  let completionCalls = 0;
  let detailCalls = 0;
  const provider = createRetroAchievementsProvider({
    client: {
      async loadSystems() { return []; },
      async loadProfile() { throw new Error("not used"); },
      async loadCompletionProgress() {
        completionCalls += 1;
        return [completionEntry("mastered")];
      },
      async loadAchievementsEarnedBetween() { return []; },
      async loadRecentUnlocks() { return []; },
      async loadRecentlyPlayedGames() {
        return [{ GameID: 100, Title: "Example Game", AchievementsTotal: 2, NumAchieved: 2 }];
      },
      async loadGameProgress() {
        detailCalls += 1;
        throw new Error("recent game detail should not be requested");
      },
    },
  });

  await provider.loadCompletionProgress(config);
  const games = await provider.loadRecentlyPlayedGames(config, { count: 1 });
  assert.equal(completionCalls, 2, "semantic reads share raw resources through the canonical transport");
  assert.equal(detailCalls, 0);
  assert.equal(games[0]?.metrics?.find((metric) => metric.key === "highest-award-kind")?.value, "mastered");
  assert.equal(games[0]?.metrics?.find((metric) => metric.key === "highest-award-date")?.value, String(Date.parse("2024-04-23T21:28:49+00:00")));
});

test("simultaneous completion progress consumers share one page load", async () => {
  let completionCalls = 0;
  let release: ((entries: readonly RawRetroAchievementsCompletionProgressEntry[]) => void) | undefined;
  const pending = new Promise<readonly RawRetroAchievementsCompletionProgressEntry[]>((resolve) => { release = resolve; });
  const provider = createRetroAchievementsProvider({
    client: {
      async loadSystems() { return []; },
      async loadProfile() { throw new Error("not used"); },
      async loadCompletionProgress() { completionCalls += 1; return pending; },
      async loadAchievementsEarnedBetween() { return []; },
      async loadRecentUnlocks() { return []; },
      async loadRecentlyPlayedGames() { return []; },
      async loadGameProgress() { throw new Error("not used"); },
    },
  });

  const first = provider.loadCompletionProgress(config);
  const second = provider.loadCompletionProgress(config);
  release?.([completionEntry("mastered")]);
  const [a, b] = await Promise.all([first, second]);
  assert.equal(completionCalls, 1);
  assert.deepEqual(a, b);
});
