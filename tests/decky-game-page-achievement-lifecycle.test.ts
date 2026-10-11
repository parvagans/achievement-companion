import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createDeckyGamePageRoutePatchLifetime,
  createDeckyGamePageSummaryRevisionStore,
  shouldReleaseDeckyGamePageRoutePatchOnBadgeUnmount,
} from "../src/platform/decky/decky-game-page-achievement-lifecycle";
import {
  invalidateDeckyGamePageAchievementSummaryCache,
  readDeckyGamePageAchievementSummaryRevision,
  subscribeDeckyGamePageAchievementSummaryRevision,
} from "../src/platform/decky/decky-game-page-achievement-summary";
import { publishDeckyRaNativeAchievementInvalidation } from "../src/platform/decky/decky-ra-native-achievement-invalidation";

test("route patches release the previous owner and ignore a late unmount", () => {
  const lifetime = createDeckyGamePageRoutePatchLifetime<object>();
  let activePatches = 0;
  let maxActivePatches = 0;
  let unpatched = 0;
  const staleReleases: Array<() => void> = [];

  for (let index = 0; index < 100; index += 1) {
    const owner = { index };
    lifetime.install(owner, (release) => {
      staleReleases.push(release);
      activePatches += 1;
      maxActivePatches = Math.max(maxActivePatches, activePatches);
      return {
        unpatch() {
          activePatches -= 1;
          unpatched += 1;
        },
      };
    });
    assert.equal(lifetime.has(owner), true);
    assert.equal(activePatches, 1);
  }

  assert.equal(maxActivePatches, 1);
  assert.equal(unpatched, 99);
  staleReleases[0]?.();
  assert.equal(activePatches, 1, "a previous badge cannot remove the current route patch");
  staleReleases[99]?.();
  assert.equal(activePatches, 0, "the owning badge unmount removes its patch");

  const revisitedOwner = { index: 99 };
  lifetime.install(revisitedOwner, () => ({ unpatch() { unpatched += 1; } }));
  assert.equal(lifetime.has(revisitedOwner), true);
  lifetime.dispose();
  lifetime.dispose();
  assert.equal(unpatched, 101);
});

test("badge remount keeps its active route patch and leaving the route releases it", () => {
  assert.equal(shouldReleaseDeckyGamePageRoutePatchOnBadgeUnmount("42", { appId: "42", reason: "target-url-route" }), false);
  assert.equal(shouldReleaseDeckyGamePageRoutePatchOnBadgeUnmount("42", { appId: undefined, reason: "url-unavailable" }), false);
  assert.equal(shouldReleaseDeckyGamePageRoutePatchOnBadgeUnmount("42", { appId: "43", reason: "target-url-route" }), true);
  assert.equal(shouldReleaseDeckyGamePageRoutePatchOnBadgeUnmount("42", { appId: undefined, reason: "non-game-route" }), true);
});

test("summary revisions isolate apps and make an old request token stale", async () => {
  const revisions = createDeckyGamePageSummaryRevisionStore();
  const notifications: string[] = [];
  const unsubscribeA = revisions.subscribe("app-a", () => notifications.push("a"));
  const unsubscribeB = revisions.subscribe("app-b", () => notifications.push("b"));
  const pendingRevision = revisions.snapshot("app-a");
  const pending = Promise.resolve("old result").then((result) =>
    revisions.snapshot("app-a") === pendingRevision ? result : undefined,
  );

  revisions.invalidate("app-a");
  assert.equal(await pending, undefined);
  assert.deepEqual(notifications, ["a"]);
  assert.equal(revisions.snapshot("app-a"), 1);
  assert.equal(revisions.snapshot("app-b"), 0);

  unsubscribeA();
  unsubscribeB();
  assert.deepEqual(revisions.subscribedAppIds(), []);
});

test("refresh, account change, and game-exit cache invalidation notify a mounted same-app badge", () => {
  const appId = "900000001";
  const observedRevisions: number[] = [];
  const unsubscribe = subscribeDeckyGamePageAchievementSummaryRevision(appId, () => {
    observedRevisions.push(readDeckyGamePageAchievementSummaryRevision(appId));
  });

  publishDeckyRaNativeAchievementInvalidation("provider-refreshed");
  publishDeckyRaNativeAchievementInvalidation("account-changed");
  invalidateDeckyGamePageAchievementSummaryCache(appId);

  assert.deepEqual(observedRevisions, [1, 2, 3]);
  unsubscribe();
});

test("route unmount and revision guards are connected to the badge hook", () => {
  const bubble = readFileSync("src/platform/decky/decky-game-page-achievement-bubble.tsx", "utf8");
  const summary = readFileSync("src/platform/decky/decky-game-page-achievement-summary.ts", "utf8");

  assert.match(bubble, /useEffect\(\(\) => onRouteUnmount, \[onRouteUnmount\]\)/u);
  assert.match(bubble, /createDeckyGamePageAchievementRouteBadgeElement\(currentAppId, releaseWhenRouteLeaves\)/u);
  assert.match(bubble, /shouldReleaseDeckyGamePageRoutePatchOnBadgeUnmount/u);
  assert.match(summary, /useSyncExternalStore\(subscribeToRevision, readRevision, readRevision\)/u);
  assert.match(summary, /if \(!isCurrent\(\)\)/u);
});
