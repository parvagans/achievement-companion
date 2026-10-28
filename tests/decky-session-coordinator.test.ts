import assert from "node:assert/strict";
import test from "node:test";
import { createDeckyDashboardRefreshCoordinator } from "../src/platform/decky/decky-dashboard-refresh-coordinator";
import { createDeckyFullScreenSessionCoordinator } from "../src/platform/decky/decky-full-screen-session-coordinator";

test("rejected full-screen sessions are removed so a retry can succeed", async () => {
  const coordinator = createDeckyFullScreenSessionCoordinator<string>();
  let calls = 0;
  const loader = async () => { if (++calls === 1) throw new Error("network"); return "ready"; };
  await assert.rejects(coordinator.load("steam", loader), /network/);
  assert.equal(coordinator.getSnapshot("steam"), undefined);
  assert.equal(await coordinator.load("steam", loader), "ready");
  assert.equal(coordinator.getSnapshot("steam"), "ready");
  assert.equal(calls, 2);
});

test("invalidated sessions cannot restore late snapshots", async () => {
  const coordinator = createDeckyFullScreenSessionCoordinator<string>();
  let finish!: (value: string) => void;
  const old = coordinator.load("retroachievements", () => new Promise((resolve) => { finish = resolve; }));
  coordinator.invalidate("retroachievements");
  await coordinator.load("retroachievements", async () => "B");
  finish("A");
  await old;
  assert.equal(coordinator.getSnapshot("retroachievements"), "B");
});

test("refresh coordinator replays progress and does not retire a replacement refresh", async () => {
  const coordinator = createDeckyDashboardRefreshCoordinator<string>();
  const previous = Promise.resolve("A");
  const next = Promise.resolve("B");
  coordinator.start("steam", previous);
  coordinator.publish("steam", { stepId: "profile", status: "complete" });
  const events: string[] = [];
  coordinator.subscribe("steam", (event) => events.push(event.stepId));
  coordinator.start("steam", next);
  coordinator.finish("steam", previous);
  assert.equal(coordinator.get("steam"), next);
  assert.deepEqual(events, ["profile"]);
  coordinator.finish("steam", next);
  assert.equal(coordinator.get("steam"), undefined);
});

