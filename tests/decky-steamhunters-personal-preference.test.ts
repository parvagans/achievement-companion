import assert from "node:assert/strict";
import test from "node:test";
import {
  getDeckySteamHuntersProfileStateForFullScreenEntryInitial,
  loadDeckySteamHuntersProfileState,
  refreshDeckySteamHuntersProfileState,
  resetDeckyAppServicesForTests,
} from "../src/platform/decky/decky-app-services";
import { defaultDeckySettings, saveDeckySettings } from "../src/platform/decky/decky-settings";

test("disabled personal SteamHunters data skips profile lookup and refresh", async () => {
  const previousStorage = globalThis.localStorage;
  const values = new Map<string, string>();
  globalThis.localStorage = {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, value); },
  } as Storage;
  await saveDeckySettings({ ...defaultDeckySettings, steamHuntersPersonalDataEnabled: false });
  try {
    const steamId = "76561198000000000";
    const [loaded, refreshed] = await Promise.all([
      loadDeckySteamHuntersProfileState(steamId),
      refreshDeckySteamHuntersProfileState(steamId),
    ]);
    const initial = getDeckySteamHuntersProfileStateForFullScreenEntryInitial("steam");

    for (const state of [loaded, refreshed, initial]) {
      assert.equal(state.status, "success");
      assert.equal(state.data, undefined);
      assert.equal(state.error, undefined);
    }
  } finally {
    await saveDeckySettings(defaultDeckySettings);
    resetDeckyAppServicesForTests();
    globalThis.localStorage = previousStorage;
  }
});
