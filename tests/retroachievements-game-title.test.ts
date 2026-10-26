import assert from "node:assert/strict";
import test from "node:test";
import {
  formatRetroAchievementsGameTitle,
  normalizeRetroAchievementsRecentUnlocks,
  normalizeRetroAchievementsRecentlyPlayedGames,
} from "../src/providers/retroachievements/mappers/normalize";

test("RetroAchievements game titles omit catalog classification prefixes", () => {
  assert.equal(formatRetroAchievementsGameTitle("~Homebrew~ Portal 64"), "Portal 64");
  assert.equal(formatRetroAchievementsGameTitle("~Unlicensed~ Plants vs. Zombies"), "Plants vs. Zombies");
  assert.equal(formatRetroAchievementsGameTitle("~Prototype~ Demo Game"), "Demo Game");
  assert.equal(formatRetroAchievementsGameTitle("~Demo~ Sample Game"), "Sample Game");
  assert.equal(formatRetroAchievementsGameTitle("~Hack~ Modified Game"), "Modified Game");
  assert.equal(formatRetroAchievementsGameTitle("  ~homebrew~   Pyoro 64  "), "Pyoro 64");
  assert.equal(formatRetroAchievementsGameTitle("~Demo~ ~Hack~ Layered Game"), "Layered Game");
  assert.equal(formatRetroAchievementsGameTitle("Licensed Game"), "Licensed Game");
});

test("RetroAchievements normalized game identities use the display title consistently", () => {
  const [recentGame] = normalizeRetroAchievementsRecentlyPlayedGames([{
    GameID: 1,
    Title: "~Homebrew~ Portal 64",
    ConsoleName: "Nintendo 64",
    NumAchieved: 1,
    NumPossibleAchievements: 2,
  }]);
  const [recentUnlock] = normalizeRetroAchievementsRecentUnlocks([{
    GameID: 1,
    GameTitle: "~Homebrew~ Portal 64",
    AchievementID: 2,
    Title: "Test Chamber",
  }]);

  assert.equal(recentGame?.title, "Portal 64");
  assert.equal(recentUnlock?.game.title, "Portal 64");
});
