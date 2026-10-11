import assert from "node:assert/strict";
import baseTest from "node:test";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const hasDeckHarness = existsSync(new URL("../tools/deck/cli.mjs", import.meta.url));
const test = hasDeckHarness
  ? baseTest
  : (name, callback) => baseTest(name, { skip: "Local Deck harness is not present in this checkout." }, callback);
const [
  { parseArgs },
  { latestLog, screenshotRemotePath, screenshotFetchArgs, validateLines, isWithin },
  { tunnelArgs, localWebSocketUrl, selectTarget, snapshotExpression },
  { launchProcess, quoteRemote, redact, setHostNameOverride, sshOptions },
  { SEMANTIC_TARGETS, matchSemanticTarget },
  { SCENARIOS },
] = hasDeckHarness
  ? await Promise.all([
    import("../tools/deck/cli.mjs"),
    import("../tools/deck/diagnostics.mjs"),
    import("../tools/deck/cef.mjs"),
    import("../tools/deck/process.mjs"),
    import("../tools/deck/navigation.mjs"),
    import("../tools/deck/scenarios.mjs"),
  ])
  : Array.from({ length: 6 }, () => ({}));

test("CLI parses maintained commands and bounds numeric options", () => {
  for (const command of ["doctor", "deploy", "reload", "input", "eval"]) {
    assert.equal(parseArgs([command]).command, command);
  }
  assert.throws(() => parseArgs(["logs", "--lines", "1001"]));
  assert.throws(() => parseArgs(["ready", "--timeout-ms", "999"]));
  assert.throws(() => parseArgs(["input", "down", "--delay-ms", "5001"]));
  assert.equal(parseArgs(["logs", "--lines", "5"]).options.lines, 5);
  assert.equal(validateLines("1"), 1);
  assert.throws(() => validateLines("2;id"));
});

test("logs, paths and redaction do not accept arbitrary shell payloads", () => {
  assert.equal(latestLog("100 old.log\n200 latest.log\n300 bad;name.log"), "latest.log");
  assert.throws(() => latestLog("300 $(id).log"));
  assert.equal(quoteRemote("a'b"), "'a'\\''b'");
  assert.doesNotMatch(redact('apiKey="secret123" password=hidden https://test.invalid/?key=hidden'), /secret123|hidden/);
  assert.equal(isWithin(resolve("tools/deck"), resolve(".")), true);
  assert.equal(isWithin(resolve("../outside"), resolve(".")), false);
});

test("screenshot transfer is inbound and restricted to owned temporary PNGs", () => {
  const path = screenshotRemotePath("12345678-1234-4123-8123-123456789abc");
  const destination = resolve("screenshot.png");
  const args = screenshotFetchArgs(path, destination);
  assert.equal(args.at(-2), `ghast:${path}`);
  assert.equal(args.at(-1), destination);
  assert.throws(() => screenshotRemotePath("../../plugin"));
  assert.throws(() => screenshotFetchArgs("/home/deck/homebrew/plugin.json", destination));
});

test("CEF is localhost tunneled and selectors remain data", () => {
  assert.ok(tunnelArgs(8765).includes("127.0.0.1:8765:127.0.0.1:8080"));
  const target = { title: "QuickAccess_uid2", webSocketDebuggerUrl: "ws://localhost:8080/devtools/page/ABC" };
  assert.equal(selectTarget([target], "QuickAccess"), target);
  assert.equal(localWebSocketUrl(target, 8765), "ws://127.0.0.1:8765/devtools/page/ABC");
  assert.throws(() => localWebSocketUrl({ webSocketDebuggerUrl: "ws://example.invalid:8081/devtools/page/ABC" }, 8765));
  const selector = 'button[data-test="quoted"]';
  assert.ok(snapshotExpression(selector).includes(JSON.stringify(selector)));
  assert.throws(() => snapshotExpression("button", 999));
});

test("diagnostic process timeout kills its owned child without a shell", async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  let killed = false;
  child.kill = () => { killed = true; queueMicrotask(() => child.emit("close", null)); };
  const task = launchProcess("ssh", ["ghast", "uname -n"], {
    timeoutMs: 10,
    spawnImpl: (_name, _args, options) => {
      assert.equal(options.shell, false);
      assert.equal(options.windowsHide, true);
      return child;
    },
  });
  await assert.rejects(task.done, /timed out/);
  assert.equal(killed, true);
});

test("user-supplied host override is one-off and does not weaken host-key checks", () => {
  try {
    assert.throws(() => setHostNameOverride("host;id"));
    setHostNameOverride("192.0.2.1");
    assert.ok(sshOptions().includes("HostName=192.0.2.1"));
    assert.ok(sshOptions().every((option) => !/StrictHostKeyChecking|UserKnownHostsFile/.test(option)));
  } finally {
    setHostNameOverride(undefined);
  }
  assert.ok(sshOptions().every((option) => !option.startsWith("HostName=")));
});

test("Deck harness exposes the Steam full-screen Compact Settings tab", () => {
  assert.deepEqual(SEMANTIC_TARGETS["steam-settings-compact"], {
    labelPrefix: "Compact Settings, ",
    attribute: ["data-settings-provider", "steam"],
    context: { fullScreenSection: "settings" },
  });
  assert.deepEqual(SEMANTIC_TARGETS["provider-settings-ra-account"], {
    label: "Account, selected",
    attribute: ["data-settings-provider", "retroachievements"],
    routeIncludes: "/achievement-companion/full-screen/settings",
  });
  assert.ok(SEMANTIC_TARGETS["ra-settings-about"]);
  assert.ok(SEMANTIC_TARGETS["ra-settings-data"]);
  assert.ok(SEMANTIC_TARGETS["steam-settings-about"]);
  assert.ok(SEMANTIC_TARGETS["steam-settings-data"]);
});

test("Deck harness has provider-aware RetroAchievements QAM targets and scenarios", () => {
  for (const target of [
    "retroachievements-provider",
    "ra-compact-profile",
    "ra-compact-activity-calendar-entry",
    "ra-compact-activity-calendar-focused",
    "ra-compact-activity-calendar-selected",
    "ra-compact-recent-achievement",
    "ra-compact-recent-game",
    "ra-fullscreen-compact-settings-rank",
    "ra-fullscreen-profile",
    "ra-fullscreen-games",
    "ra-fullscreen-games-search",
    "ra-fullscreen-activity",
    "ra-fullscreen-activity-filter",
    "ra-fullscreen-activity-calendar",
    "ra-fullscreen-game-achievement-row",
    "ra-fullscreen-game-community",
    "ra-fullscreen-achievement-history",
  ]) {
    assert.ok(SEMANTIC_TARGETS[target], `missing semantic target ${target}`);
  }
  for (const scenario of [
    "ra-compact",
    "ra-compact-activity-calendar",
    "ra-compact-selected-day",
    "ra-compact-recent-activity",
    "ra-compact-recently-played",
    "ra-fullscreen-compact-settings",
    "ra-fullscreen-profile",
    "ra-fullscreen-games",
    "ra-fullscreen-games-search",
    "ra-fullscreen-activity",
    "ra-fullscreen-activity-filter",
    "ra-fullscreen-activity-calendar",
    "ra-view-all-achievements",
  ]) {
    assert.ok(SCENARIOS[scenario], `missing scenario ${scenario}`);
  }

  assert.equal(matchSemanticTarget({
    route: "/routes/library/home",
    focus: {
      context: { raCompactProfile: true },
      gpfocus: [{ visible: true, label: "Test Game, GBA", attributes: { "data-ra-profile-recent-game": "true" } }],
    },
  }, "ra-compact-recent-game"), true);
  assert.equal(matchSemanticTarget({
    route: "/routes/achievement-companion/full-screen/profile/retroachievements",
    focus: { context: { fullScreenSection: "profile" }, gpfocus: [] },
  }, "ra-fullscreen-profile"), true);
});
