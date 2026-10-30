import assert from "node:assert/strict";
import { test } from "node:test";
import { createRetroAchievementsProvider } from "../src/providers/retroachievements/retroachievements.provider";

const config = { username: "alice", hasApiKey: true };

test("required progress avoids optional community work and leaves freshness to the coordinator", async () => {
  let time = 1_000_000;
  let progressCalls = 0;
  let distributionCalls = 0;
  const provider = createRetroAchievementsProvider({
    now: () => time,
    client: {
      async loadSystems() { return []; },
      async loadProfile() { throw new Error("not used"); },
      async loadCompletionProgress() { return []; },
      async loadAchievementsEarnedBetween() { return []; },
      async loadRecentUnlocks() { return []; },
      async loadRecentlyPlayedGames() { return []; },
      async loadGameProgress() {
        progressCalls += 1;
        return {
          ID: 1234,
          Title: "Test Game",
          ConsoleName: "NES",
          NumAchievements: 1,
          NumAwardedToUser: 0,
          Achievements: { "1": { ID: 1, Title: "Next", Description: "Keep playing", Points: 5, BadgeName: "1" } },
        };
      },
      async loadAchievementDistribution() { distributionCalls += 1; return { "1": 3 }; },
    },
  });

  const recommendation = await provider.loadGameProgressForRecommendations(config, "1234");
  assert.equal(recommendation.achievements[0]?.title, "Next");
  assert.equal(progressCalls, 1);
  assert.equal(distributionCalls, 0);

  const full = await provider.loadGameProgress(config, "1234");
  assert.equal(full.achievements[0]?.title, "Next");
  assert.equal(progressCalls, 2, "provider normalization does not maintain a competing freshness cache");
  assert.equal(distributionCalls, 1, "full detail still loads optional community statistics");

  time += 15 * 60 * 1000;
  await provider.loadGameProgressForRecommendations(config, "1234");
  assert.equal(progressCalls, 3);
  provider.invalidateGameProgressCache("1234");
  await provider.loadGameProgressForRecommendations(config, "1234");
  assert.equal(progressCalls, 4);
});

test("an explicit game refresh bypasses a recent recommendation response", async () => {
  let progressCalls = 0;
  const provider = createRetroAchievementsProvider({
    client: {
      async loadSystems() { return []; },
      async loadProfile() { throw new Error("not used"); },
      async loadCompletionProgress() { return []; },
      async loadAchievementsEarnedBetween() { return []; },
      async loadRecentUnlocks() { return []; },
      async loadRecentlyPlayedGames() { return []; },
      async loadGameProgress() {
        progressCalls += 1;
        return { ID: 1234, Title: "Test Game", ConsoleName: "NES", NumAchievements: 1,
          Achievements: { "1": { ID: 1, Title: "Next", Description: "Keep playing", Points: 5, BadgeName: "1" } } };
      },
    },
  });

  await provider.loadGameProgressForRecommendations(config, "1234");
  await provider.loadGameProgress(config, "1234", { forceRefresh: true });
  assert.equal(progressCalls, 2);
});
