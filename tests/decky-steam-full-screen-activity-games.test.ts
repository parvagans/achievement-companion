import assert from "node:assert/strict";
import test from "node:test";
import type { RecentUnlock } from "../src/core/domain";
import { buildActivityGameOptions, filterActivityEntriesByGame } from "../src/platform/decky/decky-steam-full-screen-activity-games";

function unlock(gameId: string, title: string, achievementId: string): RecentUnlock {
  return {
    game: { providerId: "steam", gameId, title },
    achievement: { providerId: "steam", gameId, achievementId, title: achievementId, isUnlocked: true, metrics: [] },
  };
}

test("Activity game picker lists each game with recorded unlocks once, alphabetically", () => {
  const entries = [unlock("2", "Zelda", "a"), unlock("1", "Astro", "b"), unlock("2", "Zelda", "c")];

  assert.deepEqual(buildActivityGameOptions(entries), [
    { gameId: "1", title: "Astro", unlockCount: 1 },
    { gameId: "2", title: "Zelda", unlockCount: 2 },
  ]);
  assert.deepEqual(filterActivityEntriesByGame(entries, "2"), [entries[0], entries[2]]);
  assert.equal(filterActivityEntriesByGame(entries, "1")[0], entries[1]);
  assert.equal(filterActivityEntriesByGame(entries, undefined), entries);
});
