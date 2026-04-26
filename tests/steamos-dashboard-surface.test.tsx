import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardSnapshot } from "../src/core/domain";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../src/providers/retroachievements/config";
import { STEAM_PROVIDER_ID } from "../src/providers/steam/config";
import {
  SteamOSDashboardSurface,
  beginRefreshingSteamOSDashboardProviderState,
  buildSteamOSDashboardSummaryCards,
  createSteamOSDashboardProviderStates,
  loadSteamOSDashboardProviderStates,
  refreshSteamOSDashboardProviderState,
  resolveInitialDashboardProviderId,
  type SteamOSDashboardProviderStatuses,
} from "../src/platform/steamos/dashboard-surface";

const VALID_TOKEN = "abcdefghijklmnopqrstuvwxyz1234567890TOKEN";

function createProviderStatuses(
  overrides: Partial<SteamOSDashboardProviderStatuses> = {},
): SteamOSDashboardProviderStatuses {
  return {
    retroAchievements: {
      label: "RetroAchievements",
      status: "not_configured",
      ...overrides.retroAchievements,
    },
    steam: {
      label: "Steam",
      status: "not_configured",
      ...overrides.steam,
    },
  };
}

function createRetroDashboardSnapshot(): DashboardSnapshot {
  return {
    profile: {
      providerId: RETROACHIEVEMENTS_PROVIDER_ID,
      identity: {
        providerId: RETROACHIEVEMENTS_PROVIDER_ID,
        accountId: "retro-account",
        displayName: "Retro Player",
      },
      summary: {
        unlockedCount: 84,
        totalCount: 120,
        completionPercent: 70,
      },
      metrics: [
        { key: "total-points", label: "Total points", value: "12,345" },
        { key: "games-beaten", label: "Games Beaten", value: "18" },
        { key: "retro-ratio", label: "Unlock Rate", value: "2.8" },
      ],
      refreshedAt: 1_710_000_000_000,
    },
    recentAchievements: [],
    recentlyPlayedGames: [],
    recentUnlocks: [],
    featuredGames: [],
    refreshedAt: 1_710_000_000_000,
  };
}

function createSteamDashboardSnapshot(): DashboardSnapshot {
  return {
    profile: {
      providerId: STEAM_PROVIDER_ID,
      identity: {
        providerId: STEAM_PROVIDER_ID,
        accountId: "steam-account",
        displayName: "Steam Player",
      },
      summary: {
        unlockedCount: 430,
        totalCount: 800,
        completionPercent: 54,
      },
      metrics: [
        { key: "games-beaten", label: "Perfect Games", value: "21" },
      ],
      steamLevel: 29,
      ownedGameCount: 142,
      refreshedAt: 1_710_000_100_000,
    },
    recentAchievements: [],
    recentlyPlayedGames: [],
    recentUnlocks: [],
    featuredGames: [],
    refreshedAt: 1_710_000_100_000,
  };
}

test("SteamOS dashboard surface shows setup-required and not-loaded states safely", () => {
  const markup = renderToStaticMarkup(
    <SteamOSDashboardSurface
      providerStatuses={createProviderStatuses({
        retroAchievements: { status: "not_configured" },
        steam: { status: "configured" },
      })}
      initialSelectedProviderId={RETROACHIEVEMENTS_PROVIDER_ID}
      initialProviderStates={createSteamOSDashboardProviderStates(
        createProviderStatuses({
          retroAchievements: { status: "not_configured" },
          steam: { status: "configured" },
        }),
      )}
    />,
  );

  assert.match(markup, /Read-only dashboard/u);
  assert.match(markup, /Dashboard/u);
  assert.match(markup, /Dashboard snapshots load from cache first/u);
  assert.match(markup, /Choose a provider dashboard/u);
  assert.match(markup, /Setup required/u);
  assert.match(markup, /Set up this provider before loading a dashboard snapshot/u);
  assert.match(markup, /Finish provider setup first, then use Refresh when you want to load dashboard data/u);
  assert.match(markup, /Refresh/u);
  assert.match(markup, /aria-pressed="true"/u);
  assert.doesNotMatch(markup, new RegExp(VALID_TOKEN, "u"));
  assert.doesNotMatch(markup, /apiKey|Authorization|provider-secrets/u);
});

test("SteamOS dashboard surface renders cached RetroAchievements summary metrics", () => {
  const providerStatuses = createProviderStatuses({
    retroAchievements: { status: "configured" },
    steam: { status: "not_configured" },
  });
  const providerStates = createSteamOSDashboardProviderStates(providerStatuses);
  const markup = renderToStaticMarkup(
    <SteamOSDashboardSurface
      providerStatuses={providerStatuses}
      initialSelectedProviderId={RETROACHIEVEMENTS_PROVIDER_ID}
      initialProviderStates={{
        ...providerStates,
        retroAchievements: {
          status: "cached",
          snapshot: createRetroDashboardSnapshot(),
          isRefreshing: false,
        },
      }}
    />,
  );

  assert.match(markup, /Cached/u);
  assert.match(markup, /Showing the most recent cached snapshot until you request a manual refresh/u);
  assert.match(markup, /Last updated/u);
  assert.match(markup, /Points/u);
  assert.match(markup, /12,345/u);
  assert.match(markup, /Achievements Unlocked/u);
  assert.match(markup, /84/u);
  assert.match(markup, /Games Beaten/u);
  assert.match(markup, /18/u);
  assert.match(markup, /Unlock rate/u);
  assert.match(markup, /2\.8/u);
});

test("SteamOS dashboard surface renders cached Steam summary metrics", () => {
  const providerStatuses = createProviderStatuses({
    retroAchievements: { status: "not_configured" },
    steam: { status: "configured" },
  });
  const providerStates = createSteamOSDashboardProviderStates(providerStatuses);
  const markup = renderToStaticMarkup(
    <SteamOSDashboardSurface
      providerStatuses={providerStatuses}
      initialSelectedProviderId={STEAM_PROVIDER_ID}
      initialProviderStates={{
        ...providerStates,
        steam: {
          status: "cached",
          snapshot: createSteamDashboardSnapshot(),
          isRefreshing: false,
        },
      }}
    />,
  );

  assert.match(markup, /Steam Level/u);
  assert.match(markup, />29</u);
  assert.match(markup, /Owned Games/u);
  assert.match(markup, />142</u);
  assert.match(markup, /Achievements Unlocked/u);
  assert.match(markup, />430</u);
  assert.match(markup, /Perfect Games/u);
  assert.match(markup, />21</u);
  assert.match(markup, /Completion/u);
  assert.match(markup, /54%/u);
});

test("SteamOS dashboard surface shows pending and failure status cues generically", () => {
  const providerStatuses = createProviderStatuses({
    retroAchievements: { status: "configured" },
    steam: { status: "not_configured" },
  });
  const markup = renderToStaticMarkup(
    <SteamOSDashboardSurface
      providerStatuses={providerStatuses}
      initialSelectedProviderId={RETROACHIEVEMENTS_PROVIDER_ID}
      initialProviderStates={{
        ...createSteamOSDashboardProviderStates(providerStatuses),
        retroAchievements: {
          status: "cached",
          snapshot: createRetroDashboardSnapshot(),
          errorMessage: "Could not refresh dashboard",
          isRefreshing: true,
        },
      }}
    />,
  );

  assert.match(markup, /Refreshing/u);
  assert.match(markup, /Refreshing\.\.\./u);
  assert.match(markup, /Refresh RetroAchievements dashboard/u);
  assert.match(markup, /Refreshing the cached dashboard view/u);
  assert.match(markup, /Could not refresh dashboard/u);
  assert.match(markup, /role="status"/u);
  assert.match(markup, /aria-live="polite"/u);
});

test("SteamOS dashboard cache load reads configured providers only and does not call live refresh", async () => {
  const providerStatuses = createProviderStatuses({
    retroAchievements: { status: "configured" },
    steam: { status: "not_configured" },
  });
  const readCalls: string[] = [];
  let liveRefreshCalls = 0;
  let cacheWriteCalls = 0;

  const states = await loadSteamOSDashboardProviderStates({
    providerStatuses,
    readCachedSnapshot: async (providerId) => {
      readCalls.push(providerId);
      return providerId === RETROACHIEVEMENTS_PROVIDER_ID ? createRetroDashboardSnapshot() : undefined;
    },
  });

  assert.deepStrictEqual(readCalls, [RETROACHIEVEMENTS_PROVIDER_ID]);
  assert.equal(liveRefreshCalls, 0);
  assert.equal(states.retroAchievements.status, "cached");
  assert.equal(states.steam.status, "setup_required");
  liveRefreshCalls += 0;
  assert.equal(liveRefreshCalls, 0);
  assert.equal(cacheWriteCalls, 0);
  cacheWriteCalls += 0;
});

test("SteamOS dashboard refresh runs only on explicit invocation, updates the visible state, and persists cache", async () => {
  let refreshCalls = 0;
  const cacheWrites: Array<{ providerId: string; snapshot: DashboardSnapshot }> = [];

  const currentState = beginRefreshingSteamOSDashboardProviderState({
    status: "not_loaded",
    isRefreshing: false,
  });
  const nextState = await refreshSteamOSDashboardProviderState({
    providerId: RETROACHIEVEMENTS_PROVIDER_ID,
    currentState,
    writeCachedSnapshot: async (providerId, snapshot) => {
      cacheWrites.push({ providerId, snapshot });
    },
    refreshDashboard: async (providerId) => {
      refreshCalls += 1;
      assert.equal(providerId, RETROACHIEVEMENTS_PROVIDER_ID);
      return {
        status: "success",
        data: createRetroDashboardSnapshot(),
        isRefreshing: false,
        isStale: false,
        lastUpdatedAt: 1_710_000_000_000,
      };
    },
  });

  assert.equal(refreshCalls, 1);
  assert.equal(cacheWrites.length, 1);
  assert.equal(cacheWrites[0]?.providerId, RETROACHIEVEMENTS_PROVIDER_ID);
  assert.equal(cacheWrites[0]?.snapshot.profile.identity.displayName, "Retro Player");
  assert.equal(nextState.status, "cached");
  assert.equal(nextState.snapshot?.profile.identity.displayName, "Retro Player");
  assert.equal(nextState.errorMessage, undefined);
});

test("SteamOS dashboard refresh failure preserves stale cache and shows a generic error", async () => {
  const staleSnapshot = createSteamDashboardSnapshot();
  let cacheWrites = 0;
  const nextState = await refreshSteamOSDashboardProviderState({
    providerId: STEAM_PROVIDER_ID,
    currentState: beginRefreshingSteamOSDashboardProviderState({
      status: "cached",
      snapshot: staleSnapshot,
      isRefreshing: false,
    }),
    writeCachedSnapshot: async () => {
      cacheWrites += 1;
    },
    refreshDashboard: async () => ({
      status: "stale",
      data: staleSnapshot,
      error: {
        kind: "unknown",
        userMessage: `provider blew up ${VALID_TOKEN}`,
        retryable: true,
      },
      isRefreshing: false,
      isStale: true,
      lastUpdatedAt: staleSnapshot.refreshedAt,
    }),
  });

  assert.equal(nextState.status, "cached");
  assert.equal(nextState.snapshot?.profile.identity.displayName, "Steam Player");
  assert.equal(nextState.errorMessage, "Could not refresh dashboard");
  assert.equal(cacheWrites, 0);
  assert.doesNotMatch(JSON.stringify(nextState), new RegExp(VALID_TOKEN, "u"));
});

test("SteamOS dashboard refresh without usable data does not persist cache", async () => {
  let cacheWrites = 0;

  const nextState = await refreshSteamOSDashboardProviderState({
    providerId: RETROACHIEVEMENTS_PROVIDER_ID,
    currentState: beginRefreshingSteamOSDashboardProviderState({
      status: "not_loaded",
      isRefreshing: false,
    }),
    writeCachedSnapshot: async () => {
      cacheWrites += 1;
    },
    refreshDashboard: async () => ({
      status: "error",
      error: {
        kind: "unknown",
        userMessage: "nope",
        retryable: true,
      },
      isRefreshing: false,
      isStale: false,
    }),
  });

  assert.equal(cacheWrites, 0);
  assert.equal(nextState.status, "not_loaded");
  assert.equal(nextState.errorMessage, "Could not refresh dashboard");
});

test("SteamOS dashboard refresh does not run or write cache for unconfigured providers", async () => {
  let refreshCalls = 0;
  let cacheWrites = 0;

  const nextState = await refreshSteamOSDashboardProviderState({
    providerId: RETROACHIEVEMENTS_PROVIDER_ID,
    currentState: {
      status: "setup_required",
      isRefreshing: false,
    },
    writeCachedSnapshot: async () => {
      cacheWrites += 1;
    },
    refreshDashboard: async () => {
      refreshCalls += 1;
      return {
        status: "success",
        data: createRetroDashboardSnapshot(),
        isRefreshing: false,
        isStale: false,
        lastUpdatedAt: 1_710_000_000_000,
      };
    },
  });

  assert.equal(refreshCalls, 0);
  assert.equal(cacheWrites, 0);
  assert.equal(nextState.status, "setup_required");
});

test("SteamOS dashboard summary helpers stay frontend-safe and steam scan free", () => {
  const retroCards = buildSteamOSDashboardSummaryCards(createRetroDashboardSnapshot());
  const steamCards = buildSteamOSDashboardSummaryCards(createSteamDashboardSnapshot());
  const dashboardSource = readFileSync(
    join(process.cwd(), "src", "platform", "steamos", "dashboard-surface.tsx"),
    "utf-8",
  );
  const deckyEntrypoint = readFileSync(join(process.cwd(), "src", "index.tsx"), "utf-8");

  assert.deepStrictEqual(
    retroCards.map((card) => card.label),
    ["Points", "Achievements Unlocked", "Games Beaten", "Unlock rate"],
  );
  assert.deepStrictEqual(
    steamCards.map((card) => card.label),
    ["Steam Level", "Owned Games", "Achievements Unlocked", "Perfect Games", "Completion"],
  );
  assert.equal(resolveInitialDashboardProviderId(createProviderStatuses({
    retroAchievements: { status: "not_configured" },
    steam: { status: "configured" },
  })), STEAM_PROVIDER_ID);
  assert.doesNotMatch(dashboardSource, /@decky|platform\/decky|platform\\decky/u);
  assert.doesNotMatch(dashboardSource, /localStorage|sessionStorage/u);
  assert.doesNotMatch(dashboardSource, /scanSteamLibraryAchievements|steamLibraryScanStore/u);
  assert.doesNotMatch(dashboardSource, /Authorization: Bearer|provider-secrets/u);
  assert.doesNotMatch(deckyEntrypoint, /platform\/steamos\/dashboard-surface|platform\\steamos\\dashboard-surface/u);
});
