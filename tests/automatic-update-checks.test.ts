import assert from "node:assert/strict";
import test from "node:test";
import {
  AutomaticUpdateChecks,
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_RECONNECT_COOLDOWN_MS,
  type AutomaticUpdateCheckSnapshot,
} from "../src/update/automatic-update-checks";

function harness(initial: AutomaticUpdateCheckSnapshot) {
  let now = 2 * UPDATE_CHECK_INTERVAL_MS;
  let state = initial;
  let checks = 0;
  const controller = new AutomaticUpdateChecks(
    () => state,
    async () => { checks += 1; },
    () => now,
  );
  return {
    controller,
    get checks() { return checks; },
    setState(next: AutomaticUpdateCheckSnapshot) { state = next; },
    advance(milliseconds: number) { now += milliseconds; },
    get now() { return now; },
  };
}

test("scheduled checks keep the 24-hour eligibility window", () => {
  const run = harness({ enabled: true, productionSource: true, busy: false, lastCheckedAt: UPDATE_CHECK_INTERVAL_MS + 1 });
  run.controller.checkIfDue();
  assert.equal(run.checks, 0);
  run.advance(1);
  run.controller.checkIfDue();
  assert.equal(run.checks, 1);
});

test("Steam offline-to-connected checks immediately even before the next daily check", () => {
  const run = harness({ enabled: true, productionSource: true, busy: false, lastCheckedAt: 0 });
  run.controller.observeSteamConnectivity(1, false); // Initial state is a baseline, not a reconnect.
  assert.equal(run.checks, 0);
  run.controller.observeSteamConnectivity(6, false); // No LAN.
  run.controller.observeSteamConnectivity(1, true); // Connectivity test still running.
  assert.equal(run.checks, 0);
  run.controller.observeSteamConnectivity(1, false);
  assert.equal(run.checks, 1);
});

test("browser online fallback and Steam events share a reconnect cooldown", () => {
  const run = harness({ enabled: true, productionSource: true, busy: false, lastCheckedAt: 0 });
  run.controller.observeBrowserOffline();
  run.controller.observeBrowserOnline();
  run.controller.observeSteamConnectivity(1, false);
  run.controller.observeBrowserOnline();
  assert.equal(run.checks, 1);
  run.advance(UPDATE_RECONNECT_COOLDOWN_MS);
  run.controller.observeBrowserOnline();
  assert.equal(run.checks, 2);
});

test("recent successful checks, disabled checks, local source, and busy service suppress reconnect fetches", () => {
  const run = harness({ enabled: true, productionSource: true, busy: false, lastCheckedAt: 2 * UPDATE_CHECK_INTERVAL_MS - 30_000 });
  run.controller.observeBrowserOnline();
  assert.equal(run.checks, 0);
  run.advance(UPDATE_RECONNECT_COOLDOWN_MS);
  run.setState({ enabled: false, productionSource: true, busy: false });
  run.controller.observeBrowserOnline();
  run.setState({ enabled: true, productionSource: false, busy: false });
  run.controller.observeBrowserOnline();
  run.setState({ enabled: true, productionSource: true, busy: true });
  run.controller.observeBrowserOnline();
  assert.equal(run.checks, 0);
  run.setState({ enabled: true, productionSource: true, busy: false });
  run.controller.observeBrowserOnline();
  assert.equal(run.checks, 1);
});
