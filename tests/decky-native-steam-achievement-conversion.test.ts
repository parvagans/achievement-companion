import assert from "node:assert/strict";
import test from "node:test";
import type { NormalizedAchievement } from "../src/core/domain";
import {
  toNativeSteamAchievement,
  toNativeSteamAchievements,
} from "../src/platform/decky/decky-native-steam-achievement-conversion";

const earned: NormalizedAchievement = {
  providerId: "retroachievements",
  gameId: "14402",
  achievementId: "123456",
  title: "Master the trial",
  description: "Clear the final course",
  badgeImageUrl: "https://media.retroachievements.org/Badge/123456.png",
  isUnlocked: true,
  unlockedAt: 1_760_000_000_500,
  metrics: [
    { key: "unlocked-count", label: "Total Players", value: "250" },
    { key: "hardcore-unlocked-count", label: "Hardcore Unlocks", value: "100" },
    { key: "softcore-unlocked-count", label: "Softcore Unlocks", value: "150" },
  ],
};
const locked: NormalizedAchievement = {
  providerId: "retroachievements",
  gameId: "14402",
  achievementId: "123457",
  title: "Find the secret",
  isUnlocked: false,
  metrics: [],
};

test("Steam boundary uses stable RA IDs and preserves artwork, description and unlock timestamp", () => {
  const row = toNativeSteamAchievement(earned, "both", 1000);
  assert.equal(row.strID, "ra:123456");
  assert.equal(row.strName, "Master the trial");
  assert.equal(row.strDescription, "Clear the final course");
  assert.equal(row.strImage, earned.badgeImageUrl);
  assert.equal(row.rtUnlocked, 1_760_000_000);
  assert.equal(row.bAchieved, true);
  assert.equal(row.flAchieved, 25);
  assert.equal(row.bHidden, false);
});

test("Steam boundary projects mode-specific rarity and earned/locked vectors", () => {
  assert.equal(toNativeSteamAchievement(earned, "hardcore", 1000).flAchieved, 10);
  assert.equal(toNativeSteamAchievement(earned, "softcore", 1000).flAchieved, 15);
  const model = toNativeSteamAchievements([earned, locked], "both", 1000);
  assert.equal(model.nAchieved, 1);
  assert.equal(model.nTotal, 2);
  assert.deepEqual(model.vecHighlight.map((row) => row.strID), ["ra:123456"]);
  assert.deepEqual(model.vecUnachieved.map((row) => row.strID), ["ra:123457"]);
  assert.equal(model.vecUnachieved[0]?.rtUnlocked, 0);
  assert.equal(model.vecUnachieved[0]?.flCurrentProgress, 0);
});
