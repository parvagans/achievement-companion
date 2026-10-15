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
  }
});
