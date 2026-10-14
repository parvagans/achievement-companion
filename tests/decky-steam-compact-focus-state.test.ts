import assert from "node:assert/strict";
import test from "node:test";
import {
  getDeckySteamCompactFocusTargetKey,
  readDeckySteamCompactFocusRestoreRequest,
  readDeckySteamCompactFocusScrollTop,
  readDeckySteamCompactFocusTarget,
  requestDeckySteamCompactFocusRestore,
  resetDeckySteamCompactFocusTargetForTests,
  setDeckySteamCompactFocusTarget,
  subscribeToDeckySteamCompactFocusRestore,
} from "../src/platform/decky/decky-steam-compact-focus-state";

test("Steam compact focus state uses stable domain identity", () => {
  resetDeckySteamCompactFocusTargetForTests();
  assert.deepEqual(readDeckySteamCompactFocusTarget(), { kind: "profile" });

  const achievement = { kind: "achievement", gameId: "game-7", achievementId: "achievement-42" } as const;
  setDeckySteamCompactFocusTarget(achievement, 184);
  assert.deepEqual(readDeckySteamCompactFocusTarget(), achievement);
  assert.equal(readDeckySteamCompactFocusScrollTop(), 184);
  assert.equal(getDeckySteamCompactFocusTargetKey(achievement), "achievement:game-7:achievement-42");

  const game = { kind: "game", gameId: "game-7" } as const;
  setDeckySteamCompactFocusTarget(game);
  assert.equal(getDeckySteamCompactFocusTargetKey(readDeckySteamCompactFocusTarget()), "game:game-7");
  assert.equal(readDeckySteamCompactFocusScrollTop(), 0);
});

test("Steam compact non-row destinations have deterministic keys", () => {
  assert.equal(getDeckySteamCompactFocusTargetKey({ kind: "profile" }), "profile");
  assert.equal(getDeckySteamCompactFocusTargetKey({ kind: "steamhunters-points" }), "steamhunters-points");
  assert.equal(getDeckySteamCompactFocusTargetKey({ kind: "activity" }), "activity");
  assert.equal(getDeckySteamCompactFocusTargetKey({ kind: "games" }), "games");
  assert.equal(getDeckySteamCompactFocusTargetKey({ kind: "settings" }), "settings");
});

test("Steam compact terminal return publishes one deterministic restoration request", () => {
  resetDeckySteamCompactFocusTargetForTests();
  let notifications = 0;
  const unsubscribe = subscribeToDeckySteamCompactFocusRestore(() => {
    notifications += 1;
  });

  requestDeckySteamCompactFocusRestore();
  assert.equal(readDeckySteamCompactFocusRestoreRequest(), 1);
  assert.equal(notifications, 1);

  unsubscribe();
  requestDeckySteamCompactFocusRestore();
  assert.equal(readDeckySteamCompactFocusRestoreRequest(), 2);
  assert.equal(notifications, 1);
});
