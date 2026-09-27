import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createDeckyProviderInitialFocusAttempt,
  DECKY_PROVIDER_INITIAL_FOCUS_MAX_ATTEMPTS,
  requestDeckyProviderInitialFocus,
  shouldRequestDeckyProviderInitialFocus,
  type DeckyProviderInitialFocusRequestResult,
} from "../src/platform/decky/decky-provider-initial-focus";
import {
  readDeckyCompactNavigation,
  resetDeckyCompactNavigationForTests,
  setDeckyCompactNavigation,
} from "../src/platform/decky/decky-compact-navigation";

const gamepadNavigationSource = readFileSync(
  "src/platform/decky/decky-gamepad-navigation.ts",
  "utf8",
);
const providerFocusSource = readFileSync(
  "src/platform/decky/decky-provider-initial-focus.ts",
  "utf8",
);

test.afterEach(() => {
  resetDeckyCompactNavigationForTests();
});

function createAttemptHarness(results: readonly DeckyProviderInitialFocusRequestResult[]) {
  const scheduledFrames: Array<{ readonly callback: FrameRequestCallback; readonly handle: number }> = [];
  const cancelledFrames: number[] = [];
  const requestedTargets: Array<HTMLElement | null> = [];
  let nextHandle = 1;
  let nextResultIndex = 0;

  const attempt = createDeckyProviderInitialFocusAttempt({
    cancelAnimationFrame(handle) {
      cancelledFrames.push(handle);
    },
    requestAnimationFrame(callback) {
      const handle = nextHandle;
      nextHandle += 1;
      scheduledFrames.push({ callback, handle });
      return handle;
    },
    requestFocus(target) {
      requestedTargets.push(target);
      return results[nextResultIndex++] ?? { status: "node-not-found" };
    },
  });

  return {
    attempt,
    cancelledFrames,
    requestedTargets,
    runNextFrame() {
      const frame = scheduledFrames.shift();
      assert.notEqual(frame, undefined, "a native focus frame should have been scheduled");
      frame.callback(0);
    },
    scheduledFrames,
  };
}

test("Provider only requests initial focus for the provider chooser", () => {
  assert.equal(shouldRequestDeckyProviderInitialFocus({ kind: "provider-chooser" }), true);
  assert.equal(
    shouldRequestDeckyProviderInitialFocus({ kind: "provider-dashboard", providerId: "retroachievements" }),
    false,
  );
  assert.equal(
    shouldRequestDeckyProviderInitialFocus({ kind: "provider-dashboard", providerId: "steam" }),
    false,
  );
  assert.equal(
    shouldRequestDeckyProviderInitialFocus({ kind: "game", providerId: "steam", gameId: "1", gameTitle: "Game" }),
    false,
  );
  assert.equal(
    shouldRequestDeckyProviderInitialFocus({
      kind: "achievement",
      providerId: "retroachievements",
      gameId: "1",
      achievementId: "2",
      gameTitle: "Game",
      parent: "game",
    }),
    false,
  );
  assert.equal(shouldRequestDeckyProviderInitialFocus({ kind: "settings", providerId: "steam" }), false);
});

test("Provider retries native focus after delayed GamepadUI node registration", () => {
  const harness = createAttemptHarness([{ status: "node-not-found" }, { status: "focused" }]);
  const target = {} as HTMLElement;

  harness.attempt.start(target);
  assert.equal(harness.attempt.getState(), "pending");
  assert.equal(harness.scheduledFrames.length, 1);

  harness.runNextFrame();
  assert.equal(harness.attempt.getState(), "pending");
  assert.deepEqual(harness.requestedTargets, [target]);
  assert.equal(harness.scheduledFrames.length, 1);

  harness.runNextFrame();
  assert.equal(harness.attempt.getState(), "complete");
  assert.deepEqual(harness.requestedTargets, [target, target]);
  assert.equal(harness.scheduledFrames.length, 0);
});

test("a rejected native focus attempt remains pending until BTakeFocus succeeds", () => {
  const harness = createAttemptHarness([
    { status: "node-not-found" },
    { status: "focus-rejected" },
    { status: "focused" },
  ]);
  const target = {} as HTMLElement;

  harness.attempt.start(target);
  harness.runNextFrame();
  assert.equal(harness.attempt.getState(), "pending");
  harness.runNextFrame();
  assert.equal(harness.attempt.getState(), "pending");
  harness.runNextFrame();

  assert.equal(harness.attempt.getState(), "complete");
  assert.equal(harness.requestedTargets.length, 3);
});

test("a successful native focus request is consumed once", () => {
  const harness = createAttemptHarness([{ status: "focused" }]);
  const target = {} as HTMLElement;

  harness.attempt.start(target);
  harness.runNextFrame();
  harness.attempt.start(target);

  assert.equal(harness.attempt.getState(), "complete");
  assert.equal(harness.requestedTargets.length, 1);
  assert.equal(harness.scheduledFrames.length, 0);
});

test("Provider cancels a pending native focus frame on unmount", () => {
  const harness = createAttemptHarness([{ status: "focused" }]);
  const target = {} as HTMLElement;

  harness.attempt.start(target);
  harness.attempt.cancel();
  assert.deepEqual(harness.cancelledFrames, [1]);
  assert.equal(harness.attempt.getState(), "idle");
  harness.runNextFrame();
  assert.equal(harness.requestedTargets.length, 0);
});

test("Provider stops after a bounded native registration retry window", () => {
  const harness = createAttemptHarness([]);
  harness.attempt.start({} as HTMLElement);

  for (let index = 0; index < DECKY_PROVIDER_INITIAL_FOCUS_MAX_ATTEMPTS; index += 1) {
    harness.runNextFrame();
  }

  assert.equal(harness.attempt.getState(), "exhausted");
  assert.equal(harness.requestedTargets.length, DECKY_PROVIDER_INITIAL_FOCUS_MAX_ATTEMPTS);
  assert.equal(harness.scheduledFrames.length, 0);
});

test("provider initial focus takes the matching native GamepadUI navigation node only after BTakeFocus succeeds", () => {
  const target = {} as HTMLElement;
  let takeFocusCalls = 0;

  const result = requestDeckyProviderInitialFocus(target, {
    getNavigationTrees: () => [
      {
        m_Root: {
          m_rgChildren: [
            {
              m_element: target,
              BTakeFocus: () => {
                takeFocusCalls += 1;
                return true;
              },
            },
          ],
        },
      },
    ],
  });

  assert.deepEqual(result, { status: "focused" });
  assert.equal(takeFocusCalls, 1);
});

test("provider initial focus reads Decky's exported Gamepad navigation-tree helper", () => {
  assert.match(gamepadNavigationSource, /import \* as deckyUi from "@decky\/ui"/u);
  assert.match(gamepadNavigationSource, /getGamepadNavigationTrees/u);
});

test("provider native focus handoff does not invoke compact or full-screen routing", () => {
  assert.doesNotMatch(providerFocusSource, /Navigation\.|routerHook|Navigate(?:Back)?\(/u);
});

test("provider initial focus does not mutate compact navigation when native focus is unavailable", () => {
  setDeckyCompactNavigation({ kind: "provider-dashboard", providerId: "steam" });

  const result = requestDeckyProviderInitialFocus({} as HTMLElement, {
    getNavigationTrees: () => [],
  });

  assert.deepEqual(result, { status: "node-not-found" });
  assert.deepEqual(readDeckyCompactNavigation(), { kind: "provider-dashboard", providerId: "steam" });
});
