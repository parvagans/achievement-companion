import assert from "node:assert/strict";
import test from "node:test";
import {
  isNativeSteamShortcutOverview,
  toNativeSteamAchievementProgressPercentage,
  toNativeSteamGlobalAchievementResponse,
  toNativeSteamPersonalAchievementResponse,
  withNativeSteamAchievementsSection,
  withNativeSteamRecentActivitySection,
} from "../src/platform/decky/decky-native-steam-achievement-contract";
import type { NativeSteamAchievements } from "../src/platform/decky/decky-native-steam-achievement-conversion";
import { buildDeckyNativeSteamAchievementsRoute } from "../src/platform/decky/decky-game-page-achievement-route";

test("Activity can open the shortcut's native Steam achievement list", () => {
  assert.equal(buildDeckyNativeSteamAchievementsRoute(3058122499), "/library/app/3058122499/achievements/my/individual");
});

const appId = 2_590_000_000;
const shortcut = { appid: appId, app_type: 1073741824 };
const steamGame = { appid: 620, app_type: 1 };
const unlocked = {
  strID: "ra:123",
  strName: "One",
  strDescription: "Earn one",
  strImage: "https://example.test/123.png",
  bAchieved: true,
  bHidden: false,
  rtUnlocked: 1_760_000_000,
  flMinProgress: 0,
  flCurrentProgress: 1,
  flMaxProgress: 1,
  flAchieved: 25,
};
const locked = { ...unlocked, strID: "ra:124", bAchieved: false, rtUnlocked: 0, flCurrentProgress: 0, flAchieved: 10 };
const model: NativeSteamAchievements = {
  nAchieved: 1,
  nTotal: 2,
  vecHighlight: [unlocked],
  vecAchievedHidden: [],
  vecUnachieved: [locked],
};

test("only the exact native shortcut app type qualifies", () => {
  assert.equal(isNativeSteamShortcutOverview(shortcut, appId), true);
  assert.equal(isNativeSteamShortcutOverview(shortcut, appId + 1), false);
  assert.equal(isNativeSteamShortcutOverview(steamGame, 620), false);
  assert.equal(isNativeSteamShortcutOverview({ appid: appId, app_type: 1 }, appId), false);
});

test("native section is added only with a ready model and never mutates Steam's Set", () => {
  const original = new Set(["nonsteam", "notes", "screenshots"]);
  assert.equal(withNativeSteamAchievementsSection(original, shortcut, appId, undefined), original);
  assert.equal(withNativeSteamAchievementsSection(original, steamGame, 620, model), original);
  const projected = withNativeSteamAchievementsSection(original, shortcut, appId, model) as Set<string>;
  assert.equal(projected.has("achievements"), true);
  assert.equal(original.has("achievements"), false);
  assert.notEqual(projected, original);
});

test("native Activity appears only for shortcut unlocks with a usable timestamp", () => {
  const original = new Set(["nonsteam", "notes"]);
  assert.equal(withNativeSteamRecentActivitySection(original, shortcut, appId, false), original);
  assert.equal(withNativeSteamRecentActivitySection(original, steamGame, 620, true), original);
  const projected = withNativeSteamRecentActivitySection(original, shortcut, appId, true) as Set<string>;
  assert.deepEqual([...projected], ["nonsteam", "notes", "activity"]);
  assert.deepEqual([...original], ["nonsteam", "notes"]);
});

test("native personal, global and progress views share one RA achievement model", () => {
  const personal = toNativeSteamPersonalAchievementResponse(model);
  assert.deepEqual(Object.keys(personal.data.achieved), ["ra:123"]);
  assert.deepEqual(Object.keys(personal.data.unachieved), ["ra:124"]);
  const global = toNativeSteamGlobalAchievementResponse(model);
  assert.deepEqual(global.data, { "ra:123": 25, "ra:124": 10 });
  assert.equal(toNativeSteamAchievementProgressPercentage(model), 50);
});
