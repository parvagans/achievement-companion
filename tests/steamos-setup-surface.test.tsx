import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SteamOSSetupSurface,
  clearRetroAchievementsSetup,
  clearSteamSetup,
  createSteamOSSetupFormValues,
  saveRetroAchievementsSetup,
  saveSteamSetup,
  validateRetroAchievementsSetup,
  validateSteamSetup,
  type SteamOSProviderConfigs,
  type SteamOSSetupFormValues,
} from "../src/platform/steamos/setup-surface";
import {
  DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG,
  RETROACHIEVEMENTS_PROVIDER_ID,
} from "../src/providers/retroachievements/config";
import { DEFAULT_STEAM_PROVIDER_CONFIG, STEAM_PROVIDER_ID } from "../src/providers/steam/config";

function createProviderConfigs(): SteamOSProviderConfigs {
  return {
    retroAchievements: DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG,
    steam: DEFAULT_STEAM_PROVIDER_CONFIG,
  };
}

test("SteamOS setup surface renders both provider forms with password inputs and no prefilled secrets", () => {
  const markup = renderToStaticMarkup(
    <SteamOSSetupSurface
      providerConfigStatus="loaded"
      providerStatuses={{
        retroAchievements: { label: "RetroAchievements", status: "not_configured" },
        steam: { label: "Steam", status: "configured" },
      }}
      values={createSteamOSSetupFormValues({
        retroAchievements: { username: "sol88", hasApiKey: false },
        steam: { ...DEFAULT_STEAM_PROVIDER_CONFIG, steamId64: "76561198136628813", hasApiKey: true },
      })}
    />,
  );

  assert.match(markup, /RetroAchievements/u);
  assert.match(markup, /Steam/u);
  assert.match(markup, /type="password"/u);
  assert.match(markup, /name="retroachievements-api-key"/u);
  assert.match(markup, /name="steam-api-key"/u);
  assert.match(markup, /name="retroachievements-username"/u);
  assert.match(markup, /name="steam-id64"/u);
  assert.match(markup, /value="sol88"/u);
  assert.match(markup, /value="76561198136628813"/u);
  assert.doesNotMatch(markup, /retro-secret|steam-secret|provider-secrets|Authorization: Bearer/u);
});

test("SteamOS saveRetroAchievementsSetup saves username and draft key then clears the draft", async () => {
  const calls: Array<{ readonly providerId: string; readonly config: unknown }> = [];
  const values: SteamOSSetupFormValues = {
    retroAchievements: {
      username: "sol88",
      apiKeyDraft: "retro-secret",
    },
    steam: {
      steamId64: "",
      apiKeyDraft: "",
    },
  };

  const result = await saveRetroAchievementsSetup(
    {
      async save(providerId, config) {
        calls.push({ providerId, config });
        return {
          username: "sol88",
          hasApiKey: true,
        };
      },
    },
    values,
    DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG,
    createProviderConfigs(),
  );

  assert.equal(result.ok, true);
  assert.deepStrictEqual(calls, [
    {
      providerId: RETROACHIEVEMENTS_PROVIDER_ID,
      config: {
        username: "sol88",
        hasApiKey: false,
        apiKeyDraft: "retro-secret",
      },
    },
  ]);
  if (result.ok) {
    assert.equal(result.values.retroAchievements.username, "sol88");
    assert.equal(result.values.retroAchievements.apiKeyDraft, "");
  }
});

test("SteamOS saveSteamSetup saves steam credentials with safe defaults and clears the draft", async () => {
  const calls: Array<{ readonly providerId: string; readonly config: unknown }> = [];
  const values: SteamOSSetupFormValues = {
    retroAchievements: {
      username: "",
      apiKeyDraft: "",
    },
    steam: {
      steamId64: "76561198136628813",
      apiKeyDraft: "steam-secret",
    },
  };

  const result = await saveSteamSetup(
    {
      async save(providerId, config) {
        calls.push({ providerId, config });
        return {
          ...DEFAULT_STEAM_PROVIDER_CONFIG,
          steamId64: "76561198136628813",
          hasApiKey: true,
        };
      },
    },
    values,
    DEFAULT_STEAM_PROVIDER_CONFIG,
    createProviderConfigs(),
  );

  assert.equal(result.ok, true);
  assert.deepStrictEqual(calls, [
    {
      providerId: STEAM_PROVIDER_ID,
      config: {
        steamId64: "76561198136628813",
        hasApiKey: false,
        language: "english",
        recentAchievementsCount: 5,
        recentlyPlayedCount: 5,
        includePlayedFreeGames: false,
        apiKeyDraft: "steam-secret",
      },
    },
  ]);
  if (result.ok) {
    assert.equal(result.values.steam.steamId64, "76561198136628813");
    assert.equal(result.values.steam.apiKeyDraft, "");
  }
});

test("SteamOS save helpers allow configured providers to save without sending an old key", async () => {
  const calls: Array<{ readonly providerId: string; readonly config: unknown }> = [];
  const currentConfigs: SteamOSProviderConfigs = {
    retroAchievements: {
      username: "sol88",
      hasApiKey: true,
    },
    steam: {
      ...DEFAULT_STEAM_PROVIDER_CONFIG,
      steamId64: "76561198136628813",
      hasApiKey: true,
    },
  };

  const result = await saveSteamSetup(
    {
      async save(providerId, config) {
        calls.push({ providerId, config });
        return currentConfigs.steam;
      },
    },
    {
      retroAchievements: {
        username: "sol88",
        apiKeyDraft: "",
      },
      steam: {
        steamId64: "76561198136628813",
        apiKeyDraft: "",
      },
    },
    currentConfigs.steam,
    currentConfigs,
  );

  assert.equal(result.ok, true);
  assert.deepStrictEqual(calls, [
    {
      providerId: STEAM_PROVIDER_ID,
      config: {
        steamId64: "76561198136628813",
        hasApiKey: true,
        language: "english",
        recentAchievementsCount: 5,
        recentlyPlayedCount: 5,
        includePlayedFreeGames: false,
      },
    },
  ]);
  assert.doesNotMatch(JSON.stringify(calls[0]?.config), /apiKeyDraft|steam-secret/u);
});

test("SteamOS clear helpers call the selected provider and clear local form state", async () => {
  const clearedProviders: string[] = [];
  const values: SteamOSSetupFormValues = {
    retroAchievements: {
      username: "sol88",
      apiKeyDraft: "retro-secret",
    },
    steam: {
      steamId64: "76561198136628813",
      apiKeyDraft: "steam-secret",
    },
  };

  const retroResult = await clearRetroAchievementsSetup(
    {
      async clear(providerId) {
        clearedProviders.push(providerId);
        return true;
      },
    },
    values,
    createProviderConfigs(),
  );
  const steamResult = await clearSteamSetup(
    {
      async clear(providerId) {
        clearedProviders.push(providerId);
        return true;
      },
    },
    values,
    createProviderConfigs(),
  );

  assert.deepStrictEqual(clearedProviders, [
    RETROACHIEVEMENTS_PROVIDER_ID,
    STEAM_PROVIDER_ID,
  ]);
  assert.equal(retroResult.ok, true);
  assert.equal(steamResult.ok, true);
  if (retroResult.ok) {
    assert.equal(retroResult.values.retroAchievements.username, "");
    assert.equal(retroResult.values.retroAchievements.apiKeyDraft, "");
  }
  if (steamResult.ok) {
    assert.equal(steamResult.values.steam.steamId64, "");
    assert.equal(steamResult.values.steam.apiKeyDraft, "");
  }
});

test("SteamOS setup validation and backend failures stay generic and clear draft secrets after submit", async () => {
  assert.equal(
    validateRetroAchievementsSetup(
      { username: "", apiKeyDraft: "retro-secret" },
      DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG,
    ),
    "Could not save RetroAchievements settings",
  );
  assert.equal(
    validateSteamSetup(
      { steamId64: "not-numeric", apiKeyDraft: "steam-secret" },
      DEFAULT_STEAM_PROVIDER_CONFIG,
    ),
    "Could not save Steam settings",
  );

  const failure = await saveSteamSetup(
    {
      async save() {
        throw new Error("backend said apiKeyDraft=steam-secret");
      },
    },
    {
      retroAchievements: {
        username: "",
        apiKeyDraft: "",
      },
      steam: {
        steamId64: "76561198136628813",
        apiKeyDraft: "steam-secret",
      },
    },
    DEFAULT_STEAM_PROVIDER_CONFIG,
    createProviderConfigs(),
  );

  assert.equal(failure.ok, false);
  if (!failure.ok) {
    assert.equal(failure.message, "Could not save Steam settings");
    assert.equal(failure.values.steam.apiKeyDraft, "");
    assert.doesNotMatch(JSON.stringify(failure), /steam-secret|Authorization: Bearer/u);
  }
});

test("SteamOS setup surface source stays isolated from Decky and browser storage", () => {
  const source = readFileSync(join(process.cwd(), "src", "platform", "steamos", "setup-surface.tsx"), "utf-8");
  const deckyEntrypoint = readFileSync(join(process.cwd(), "src", "index.tsx"), "utf-8");

  assert.doesNotMatch(source, /@decky|platform\/decky|platform\\decky/u);
  assert.doesNotMatch(source, /localStorage|sessionStorage/u);
  assert.doesNotMatch(source, /C:\\Users\\Arenn\\OneDrive/u);
  assert.doesNotMatch(deckyEntrypoint, /platform\/steamos\/setup-surface|platform\\steamos\\setup-surface/u);
});
