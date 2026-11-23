import assert from "node:assert/strict";
import test from "node:test";
import type { GameDetailSnapshot, NormalizedAchievement, RelatedGameSummary } from "../src/core/domain";
import type { NativeRetroAchievementsProjection } from "../src/platform/decky/decky-native-retroachievements-projection";
import { buildNativeRaAchievementSets } from "../src/platform/decky/decky-native-ra-achievement-sets";

import { toNativeSteamAchievements } from "../src/platform/decky/decky-native-steam-achievement-conversion";
import { buildAchievementQueries, createSteamAchievementQueryProjection } from "../src/platform/decky/decky-native-steam-achievement-queries";

const viewer = "76561198000000000";
const achievement = (gameId: string, achievementId: string, isUnlocked = false): NormalizedAchievement => ({
  gameId, achievementId, isUnlocked, providerId: "retroachievements", title: "Fixture " + achievementId, metrics: [],
});
const base: NativeRetroAchievementsProjection = {
  status: "ready", appId: "3058122499", raGameId: "100", title: "Fixture Base Game", mode: "hardcore",
  earned: 1, total: 2, achievements: [achievement("100", "501", true), achievement("100", "502")],
};
function details(gameId: string, parentId: string, rows: readonly NormalizedAchievement[]) {
  const relationship: RelatedGameSummary = { providerId: "retroachievements", gameId, parentGameId: parentId, title: "Bonus" };
  const snapshot: GameDetailSnapshot = {
    game: {
      providerId: "retroachievements", gameId, parentGameId: parentId, status: "in_progress", title: "Bonus",
      summary: { unlockedCount: 0, totalCount: rows.length }, metrics: [],
    },
    achievements: rows,
  };
  return { relationship, snapshot };
}

const model = toNativeSteamAchievements(base.achievements, base.mode, base.totalPlayers);

test("verified subset data projects a separate Steam set while preserving base counts and RA unlock mode", () => {
  const good = details("110", "100", [
    { ...achievement("110", "601", true), unlockMode: "hardcore", hardcoreUnlockedAt: 1_760_000_000_000 },
    { ...achievement("110", "602", true), unlockMode: "softcore", softcoreUnlockedAt: 1_760_000_000_000 },
  ]);
  const sets = buildNativeRaAchievementSets(base, [good]);
  assert.equal(sets[0]?.projection.raGameId, "110");
  const queries = buildAchievementQueries(Number(base.appId), viewer, model, sets);
  assert.ok(queries);
  const schema = queries.find(entry => entry.queryKey[2] === "schema")!.value as {
    groups: { id: number; name?: string; dlcappid: number; achievements: { groupid: number; api_name: string }[] }[];
  };
  assert.deepEqual(schema.groups.map(set => [set.id, set.name, set.dlcappid, set.achievements.map(row => [row.groupid, row.api_name])]), [
    [0, undefined, 0, [[0, "ra:501"], [0, "ra:502"]]],
    [110, "Bonus", 0, [[110, "ra:601"], [110, "ra:602"]]],
  ]);
  const player = queries.find(entry => entry.queryKey[2] === "user_achievements")!.value as {
    groups: Record<number, { completed_achievements: number }>;
    achievements: Record<number, { unlocked: boolean }>;
  };
  assert.equal(player.groups[0]?.completed_achievements, 1);
  assert.equal(player.groups[110]?.completed_achievements, 1);
  assert.equal(player.achievements[602]?.unlocked, false);
  assert.equal(base.total, 2);
});

test("wrong-parent, mismatched identity, and duplicate rows never enter the native schema", () => {
  const sets = buildNativeRaAchievementSets(base, [
    details("110", "123", [achievement("110", "601")]),
    details("111", "100", [achievement("111", "501")]),
    details("112", "100", [achievement("110", "602")]),
    details("113", "100", []),
  ]);
  const queries = buildAchievementQueries(Number(base.appId), viewer, model, sets);
  const schema = queries?.find(entry => entry.queryKey[2] === "schema")?.value as { groups: { id: number }[] };
  assert.deepEqual(schema.groups.map(set => set.id), [0]);
});

test("expanding the native query replaces the live base payload without resetting it", async () => {
  const appId = Number(base.appId);
  const schemaKey = ["achievements", appId, "schema"];
  const cache = new Map<string, unknown>();
  const resets: string[] = [];
  const client = {
    getQueryData: (key: readonly unknown[]) => cache.get(JSON.stringify(key)),
    setQueryData: (key: readonly unknown[], value: unknown) => {
      cache.set(JSON.stringify(key), value);
      return value;
    },
    cancelQueries: async () => {},
    resetQueries: async ({ queryKey }: { queryKey: readonly unknown[] }) => { resets.push(JSON.stringify(queryKey)); },
    getQueryCache: () => ({ subscribe: () => () => {} }),
  };
  const sets = buildNativeRaAchievementSets(base, [details("110", "100", [achievement("110", "601")])]);
  const publisher = createSteamAchievementQueryProjection();
  assert.equal(await publisher.publish(client, appId, viewer, model, () => true), true);
  assert.equal(await publisher.publish(client, appId, viewer, model, () => true, sets), true);
  assert.deepEqual(resets, []);
  assert.deepEqual((client.getQueryData(schemaKey) as { groups: { id: number }[] }).groups.map(set => set.id), [0, 110]);
  publisher.clear();
  assert.equal(resets.length, 3);
});