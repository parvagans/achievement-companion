import assert from "node:assert/strict";
import test from "node:test";
import { DeckyNativeInstaller } from "../src/update/installers/decky-native-installer";
import { parseUpdateManifest } from "../src/update/update-manifest";
import { shouldNotifyUpdate } from "../src/update/update-notification";
import { LocalUpdateSource } from "../src/update/update-source";
import { UpdateService } from "../src/update/update-service";
import { isNewerVersion } from "../src/update/version-compare";
import type { UpdateManifest } from "../src/update/update-types";

const checksum = "a".repeat(64);
const manifest: UpdateManifest = {
  schema: 1,
  version: "0.9.0",
  channel: "stable",
  downloadUrl: "https://example.test/achievement-companion.zip",
  sha256: checksum,
};

for (const [installed, remote, expected] of [
  ["0.8.3", "0.8.4", true],
  ["0.8.3", "0.9.0", true],
  ["0.9.0", "0.9.0", false],
  ["0.9.0", "0.8.9", false],
  ["0.9.0-beta.1", "0.9.0-beta.2", true],
  ["0.9.0-beta.2", "0.9.0", true],
] as const) {
  test(`SemVer comparison ${installed} -> ${remote}`, () => {
    assert.equal(isNewerVersion(installed, remote), expected);
  });
}

test("manifest parser validates and resolves a relative artifact URL", () => {
  assert.equal(
    parseUpdateManifest({ ...manifest, downloadUrl: "./artifact.zip" }, "http://192.0.2.4:8765/update-manifest.json").downloadUrl,
    "http://192.0.2.4:8765/artifact.zip",
  );
});

for (const [name, value, message] of [
  ["malformed manifest", null, /JSON object/u],
  ["unsupported schema", { ...manifest, schema: 2 }, /Unsupported/u],
  ["absent download URL", { ...manifest, downloadUrl: undefined }, /downloadUrl is required/u],
  ["invalid checksum", { ...manifest, sha256: "bad" }, /64 hexadecimal/u],
  ["invalid channel", { ...manifest, channel: "nightly" }, /stable or preview/u],
] as const) {
  test(name, () => assert.throws(() => parseUpdateManifest(value), message));
}

test("source reports network failure and unavailable local server", async () => {
  const source = new LocalUpdateSource("http://192.0.2.4:8765/update-manifest.json", {
    fetch: async () => { throw new Error("connection refused"); },
  });
  await assert.rejects(source.loadManifest(), /connection refused/u);
});

test("source applies a bounded timeout", async () => {
  const source = new LocalUpdateSource("http://192.0.2.4:8765/update-manifest.json", {
    timeoutMs: 5,
    fetch: async (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }),
  });
  await assert.rejects(source.loadManifest(), /timed out/u);
});

test("notification deduplication allows only a new version or explicit manual repeat", () => {
  assert.equal(shouldNotifyUpdate(undefined, "0.9.0", false), true);
  assert.equal(shouldNotifyUpdate("0.9.0", "0.9.0", false), false);
  assert.equal(shouldNotifyUpdate("0.9.0", "0.9.0", true), true);
  assert.equal(shouldNotifyUpdate("0.9.0", "0.9.1", false), true);
});

test("update service is lazy and does not block plugin startup", () => {
  let sourceResolutions = 0;
  new UpdateService({
    installedVersion: "0.8.3",
    resolveSource: () => { sourceResolutions += 1; throw new Error("not expected"); },
    verifier: { verify: async () => { throw new Error("not expected"); } },
    installer: new DeckyNativeInstaller(),
  });
  assert.equal(sourceResolutions, 0);
});

test("older remote versions do not produce an update", async () => {
  const service = new UpdateService({
    installedVersion: "0.9.0",
    resolveSource: () => ({ kind: "local", manifestUrl: "http://example.test", loadManifest: async () => ({ ...manifest, version: "0.8.9" }) }),
    verifier: { verify: async () => { throw new Error("not expected"); } },
    installer: new DeckyNativeInstaller(),
  });
  assert.equal((await service.checkForUpdate()).status, "upToDate");
});

test("installer remains explicitly unsupported after successful verification", async () => {
  const service = new UpdateService({
    installedVersion: "0.8.3",
    resolveSource: () => ({ kind: "local", manifestUrl: "http://example.test", loadManifest: async () => manifest }),
    verifier: { verify: async (value, onPhase) => { onPhase("downloading"); onPhase("verifying"); return { version: value.version, sha256: value.sha256, packageVersion: value.version, pluginVersion: value.version }; } },
    installer: new DeckyNativeInstaller(),
  });
  assert.equal((await service.checkForUpdate()).status, "updateAvailable");
  assert.equal((await service.installAvailableUpdate()).status, "unsupported");
});
