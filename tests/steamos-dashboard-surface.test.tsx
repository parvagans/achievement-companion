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
  buildSteamOSDashboardGameDetail,
  createSteamOSDashboardProviderStates,
  loadSteamOSDashboardProviderStates,
  refreshSteamOSDashboardProviderState,
  resolveInitialDashboardProviderId,
  type SteamOSDashboardGameDetailSelection,
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

function createSteamLibraryScanOverview() {
  return {
    ownedGameCount: 142,
    scannedGameCount: 142,
    gamesWithAchievements: 91,
    unlockedAchievements: 430,
    totalAchievements: 800,
    perfectGames: 21,
    completionPercent: 54,
    scannedAt: "2026-04-29T10:30:00.000Z",
  };
}

function createRichRetroDashboardSnapshot(): DashboardSnapshot {
  return {
    profile: {
      providerId: RETROACHIEVEMENTS_PROVIDER_ID,
      identity: {
        providerId: RETROACHIEVEMENTS_PROVIDER_ID,
        accountId: "retro-rich-account",
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
    recentAchievements: [
      {
        achievement: {
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          achievementId: "retro-ach-1",
          gameId: "retro-game-1",
          title: "First Blood",
          points: 10,
          isUnlocked: true,
          unlockedAt: 1_710_000_000_000,
          metrics: [],
        },
        game: {
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          gameId: "retro-game-1",
          title: "Cyber Shadow",
          platformLabel: "RetroAchievements",
        },
        unlockedAt: 1_710_000_000_000,
      },
      {
        achievement: {
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          achievementId: "retro-ach-2",
          gameId: "retro-game-2",
          title: "All Clear",
          points: 5,
          isUnlocked: true,
          unlockedAt: 1_710_000_360_000,
          metrics: [],
        },
        game: {
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          gameId: "retro-game-2",
          title: "Night Shift",
          platformLabel: "RetroAchievements",
        },
        unlockedAt: 1_710_000_360_000,
      },
    ],
    recentlyPlayedGames: [
      {
        providerId: RETROACHIEVEMENTS_PROVIDER_ID,
        gameId: "retro-game-1",
        title: "Cyber Shadow",
        platformLabel: "RetroAchievements",
        summary: {
          unlockedCount: 5,
          totalCount: 10,
          completionPercent: 50,
        },
        playtimeForeverMinutes: 245,
        lastPlayedAt: 1_710_000_720_000,
      },
      {
        providerId: RETROACHIEVEMENTS_PROVIDER_ID,
        gameId: "retro-game-3",
        title: "Night Shift",
        platformLabel: "RetroAchievements",
        summary: {
          unlockedCount: 2,
          totalCount: 4,
          completionPercent: 50,
        },
        playtimeForeverMinutes: 95,
        lastPlayedAt: 1_710_001_080_000,
      },
    ],
    recentUnlocks: [
      {
        achievement: {
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          achievementId: "retro-ach-1",
          gameId: "retro-game-1",
          title: "First Blood",
          points: 10,
          isUnlocked: true,
          unlockedAt: 1_710_000_000_000,
          metrics: [],
        },
        game: {
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          gameId: "retro-game-1",
          title: "Cyber Shadow",
          platformLabel: "RetroAchievements",
        },
        unlockedAt: 1_710_000_000_000,
      },
      {
        achievement: {
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          achievementId: "retro-ach-2",
          gameId: "retro-game-2",
          title: "All Clear",
          points: 5,
          isUnlocked: true,
          unlockedAt: 1_710_000_360_000,
          metrics: [],
        },
        game: {
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          gameId: "retro-game-2",
          title: "Night Shift",
          platformLabel: "RetroAchievements",
        },
        unlockedAt: 1_710_000_360_000,
      },
    ],
    featuredGames: [
      {
        providerId: RETROACHIEVEMENTS_PROVIDER_ID,
        gameId: "retro-game-4",
        title: "Boss Rush",
        platformLabel: "RetroAchievements",
        status: "beaten",
        summary: {
          unlockedCount: 8,
          totalCount: 8,
          completionPercent: 100,
        },
        lastPlayedAt: 1_710_001_440_000,
      },
    ],
    refreshedAt: 1_710_000_000_000,
  };
}

function createRichSteamDashboardSnapshot(): DashboardSnapshot {
  return {
    profile: {
      providerId: STEAM_PROVIDER_ID,
      identity: {
        providerId: STEAM_PROVIDER_ID,
        accountId: "steam-rich-account",
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
    recentAchievements: [
      {
        achievement: {
          providerId: STEAM_PROVIDER_ID,
          achievementId: "steam-ach-1",
          gameId: "steam-game-1",
          title: "Silent Exit",
          points: 10,
          isUnlocked: true,
          unlockedAt: 1_710_001_000_000,
          metrics: [],
        },
        game: {
          providerId: STEAM_PROVIDER_ID,
          gameId: "steam-game-1",
          title: "Hades",
          platformLabel: "Steam",
        },
        unlockedAt: 1_710_001_000_000,
      },
    ],
    recentlyPlayedGames: [
      {
        providerId: STEAM_PROVIDER_ID,
        gameId: "steam-game-1",
        title: "Hades",
        platformLabel: "Steam",
        summary: {
          unlockedCount: 75,
          totalCount: 100,
          completionPercent: 75,
        },
        playtimeForeverMinutes: 365,
        lastPlayedAt: 1_710_001_080_000,
      },
      {
        providerId: STEAM_PROVIDER_ID,
        gameId: "steam-game-2",
        title: "Celeste",
        platformLabel: "Steam",
        summary: {
          unlockedCount: 100,
          totalCount: 100,
          completionPercent: 100,
        },
        playtimeForeverMinutes: 125,
        lastPlayedAt: 1_710_001_440_000,
      },
    ],
    recentUnlocks: [
      {
        achievement: {
          providerId: STEAM_PROVIDER_ID,
          achievementId: "steam-ach-1",
          gameId: "steam-game-1",
          title: "Silent Exit",
          points: 10,
          isUnlocked: true,
          unlockedAt: 1_710_001_000_000,
          metrics: [],
        },
        game: {
          providerId: STEAM_PROVIDER_ID,
          gameId: "steam-game-1",
          title: "Hades",
          platformLabel: "Steam",
        },
        unlockedAt: 1_710_001_000_000,
      },
    ],
    featuredGames: [
      {
        providerId: STEAM_PROVIDER_ID,
        gameId: "steam-game-3",
        title: "Celeste",
        platformLabel: "Steam",
        status: "mastered",
        summary: {
          unlockedCount: 100,
          totalCount: 100,
          completionPercent: 100,
        },
        lastPlayedAt: 1_710_001_440_000,
      },
    ],
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
  assert.match(markup, /class="steamos-dashboard-chooser steamos-action-row"/u);
  assert.match(markup, /class="steamos-focus-target steamos-button-target"/u);
  assert.match(markup, /data-steamos-focus-group="true"/u);
  assert.doesNotMatch(markup, new RegExp(VALID_TOKEN, "u"));
  assert.doesNotMatch(markup, /apiKey|Authorization|provider-secrets/u);
});

test("SteamOS dashboard surface shows setup-incomplete guidance safely", () => {
  const markup = renderToStaticMarkup(
    <SteamOSDashboardSurface
      providerStatuses={createProviderStatuses({
        retroAchievements: { status: "setup_incomplete" },
        steam: { status: "not_configured" },
      })}
      initialSelectedProviderId={RETROACHIEVEMENTS_PROVIDER_ID}
      initialProviderStates={{
        retroAchievements: {
          status: "setup_incomplete",
          isRefreshing: false,
        },
        steam: {
          status: "setup_required",
          isRefreshing: false,
        },
      }}
    />,
  );

  assert.match(markup, /Setup incomplete/u);
  assert.match(markup, /Saved setup is incomplete locally/u);
  assert.match(markup, /Open setup and save this provider again before refreshing/u);
  assert.match(markup, /disabled=""/u);
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
  assert.match(markup, /Last dashboard refresh/u);
  assert.doesNotMatch(markup, /undefined|null|NaN|mtimeMs|refreshedAtMs|sizeBytes/u);
  assert.match(markup, /Points/u);
  assert.match(markup, /12,345/u);
  assert.match(markup, /Achievements Unlocked/u);
  assert.match(markup, /84/u);
  assert.match(markup, /Games Beaten/u);
  assert.match(markup, /18/u);
  assert.match(markup, /Unlock rate/u);
  assert.match(markup, /2\.8/u);
  assert.match(markup, /No recent achievements in the cached snapshot/u);
  assert.match(markup, /No recently played games in the cached snapshot/u);
  assert.match(markup, /No featured games in the cached snapshot/u);
});

test("SteamOS dashboard surface renders cached Steam summary metrics from explicit scan totals", () => {
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
      steamLibraryScanOverview={createSteamLibraryScanOverview()}
      onScanSteamLibrary={() => {}}
      isSteamLibraryScanning={false}
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
  assert.match(markup, /Library scan totals cached/u);
  assert.match(markup, /Scan Steam library/u);
  assert.match(markup, /No recent achievements in the cached snapshot/u);
  assert.match(markup, /No recently played games in the cached snapshot/u);
  assert.match(markup, /No featured games in the cached snapshot/u);
});

test("SteamOS dashboard surface renders recent achievements, recently played, and featured cached sections from RetroAchievements", () => {
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
          snapshot: createRichRetroDashboardSnapshot(),
          isRefreshing: false,
        },
      }}
    />,
  );

  assert.match(markup, /Recent achievements \/ recent unlocks/u);
  assert.match(markup, /Recently played/u);
  assert.match(markup, /Featured \/ play next/u);
  assert.match(markup, /aria-label="Open First Blood cached game detail"/u);
  assert.match(markup, /aria-label="Open Cyber Shadow cached game detail"/u);
  assert.match(markup, /aria-label="Open Boss Rush cached game detail"/u);
  assert.match(markup, /First Blood/u);
  assert.match(markup, /Cyber Shadow/u);
  assert.match(markup, /Unlocked /u);
  assert.match(markup, /Playtime 4 h 5 min/u);
  assert.match(markup, /Status Beaten/u);
  assert.doesNotMatch(markup, /retro-rich-account|retro-game-1|retro-ach-1|accountId|gameId|achievementId/u);
});

test("SteamOS dashboard surface renders recent achievements, recently played, and featured cached sections from Steam", () => {
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
          snapshot: createRichSteamDashboardSnapshot(),
          isRefreshing: false,
        },
      }}
      steamLibraryScanOverview={createSteamLibraryScanOverview()}
      onScanSteamLibrary={() => {}}
      isSteamLibraryScanning={false}
    />,
  );

  assert.match(markup, /Recent achievements \/ recent unlocks/u);
  assert.match(markup, /Recently played/u);
  assert.match(markup, /Featured \/ play next/u);
  assert.match(markup, /aria-label="Open Silent Exit cached game detail"/u);
  assert.match(markup, /aria-label="Open Hades cached game detail"/u);
  assert.match(markup, /aria-label="Open Celeste cached game detail"/u);
  assert.match(markup, /Silent Exit/u);
  assert.match(markup, /Hades/u);
  assert.match(markup, /Celeste/u);
  assert.match(markup, /Status Mastered/u);
  assert.match(markup, /Playtime 6 h 5 min/u);
  assert.doesNotMatch(markup, /steam-rich-account|steam-game-1|steam-ach-1|accountId|gameId|achievementId/u);
});

test("SteamOS dashboard game detail builder resolves safe cached fields and empty states", () => {
  const detail = buildSteamOSDashboardGameDetail(createRichRetroDashboardSnapshot(), {
    providerId: RETROACHIEVEMENTS_PROVIDER_ID,
    gameId: "retro-game-4",
    gameTitle: "Boss Rush",
  });

  assert.equal(detail.providerLabel, "RetroAchievements");
  assert.equal(detail.title, "Boss Rush");
  assert.deepStrictEqual(
    detail.summaryCards.map((card) => card.label),
    ["Provider", "Completion", "Playtime", "Last played", "Status"],
  );
  assert.equal(detail.summaryCards.find((card) => card.label === "Provider")?.value, "RetroAchievements");
  assert.equal(detail.summaryCards.find((card) => card.label === "Completion")?.value, "100%");
  assert.equal(detail.summaryCards.find((card) => card.label === "Playtime")?.value, "No cached playtime for this game.");
  assert.equal(detail.summaryCards.find((card) => card.label === "Status")?.value, "Beaten");
  assert.match(detail.summaryCards.find((card) => card.label === "Last played")?.value ?? "", /at /u);
  assert.equal(detail.recentAchievements.length, 0);
  assert.equal(detail.achievementEmptyState, "No cached achievements for this game.");
});

test("SteamOS dashboard surface renders a cached game detail and back navigation without raw identifiers", () => {
  const providerStatuses = createProviderStatuses({
    retroAchievements: { status: "not_configured" },
    steam: { status: "configured" },
  });
  const providerStates = createSteamOSDashboardProviderStates(providerStatuses);
  const markup = renderToStaticMarkup(
    <SteamOSDashboardSurface
      providerStatuses={providerStatuses}
      initialSelectedProviderId={STEAM_PROVIDER_ID}
      initialSelectedGameDetail={{
        providerId: STEAM_PROVIDER_ID,
        gameId: "steam-game-1",
        gameTitle: "Hades",
      }}
      initialProviderStates={{
        ...providerStates,
        steam: {
          status: "cached",
          snapshot: createRichSteamDashboardSnapshot(),
          isRefreshing: false,
        },
      }}
      steamLibraryScanOverview={createSteamLibraryScanOverview()}
      onScanSteamLibrary={() => {}}
      isSteamLibraryScanning={false}
    />,
  );

  assert.match(markup, /Cached game detail/u);
  assert.match(markup, /Back to dashboard/u);
  assert.match(markup, /autofocus=""/u);
  assert.match(markup, /Hades/u);
  assert.match(markup, /Provider/u);
  assert.match(markup, /Steam/u);
  assert.match(markup, /Completion/u);
  assert.match(markup, /75%/u);
  assert.match(markup, /6 h 5 min/u);
  assert.match(markup, /Status/u);
  assert.match(markup, /Silent Exit/u);
  assert.match(markup, /Cached achievements \/ unlocks/u);
  assert.doesNotMatch(markup, /aria-label="Refresh [^"]+ dashboard"/u);
  assert.doesNotMatch(markup, /Scan Steam library/u);
  assert.doesNotMatch(markup, /steam-game-1|steam-ach-1|steam-rich-account|accountId|gameId|achievementId/u);
  assert.doesNotMatch(markup, /Authorization|Bearer|apiKey|provider payload|localStorage|sessionStorage/u);
});

test("SteamOS dashboard surface shows a disabled scanning state while the Steam library scan is running", () => {
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
      onScanSteamLibrary={() => {}}
      isSteamLibraryScanning={true}
    />,
  );

  assert.match(markup, /Scanning Steam library\.\.\./u);
  assert.match(markup, /disabled=""/u);
  assert.match(markup, /Run a Steam library scan to unlock Owned Games and Perfect Games/u);
});

test("SteamOS dashboard surface keeps Steam scan-dependent metrics honest before a library scan exists", () => {
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
      onScanSteamLibrary={() => {}}
      isSteamLibraryScanning={false}
    />,
  );

  assert.match(markup, /Owned Games/u);
  assert.match(markup, /Perfect Games/u);
  assert.match(markup, /54% \(partial\)/u);
  assert.match(markup, /Library scan not run yet/u);
  assert.match(markup, /Run a Steam library scan to unlock Owned Games and Perfect Games/u);
  assert.match(markup, /Scan Steam library/u);
  assert.doesNotMatch(markup, />21</u);
  assert.doesNotMatch(markup, /Perfect Games<\/p><p[^>]*>0</u);
});

test("SteamOS dashboard surface keeps cached scan totals visible when a library scan fails", () => {
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
      steamLibraryScanOverview={createSteamLibraryScanOverview()}
      steamLibraryScanErrorMessage="Steam library scan failed. Showing the last saved scan totals. Retry when the backend is available."
      onScanSteamLibrary={() => {}}
      isSteamLibraryScanning={false}
    />,
  );

  assert.match(markup, /Owned Games/u);
  assert.match(markup, />142</u);
  assert.match(markup, /Perfect Games/u);
  assert.match(markup, />21</u);
  assert.match(markup, /Library scan totals cached/u);
  assert.match(markup, /Steam library scan failed\. Showing the last saved scan totals/u);
  assert.doesNotMatch(markup, /Authorization|apiKey|SteamID64|provider payload|query value/u);
});

test("SteamOS dashboard surface keeps scan-dependent fields unavailable when no scan cache exists after a failure", () => {
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
      steamLibraryScanErrorMessage="Steam library scan failed. No saved library totals are available yet. Retry when the backend is available."
      onScanSteamLibrary={() => {}}
      isSteamLibraryScanning={false}
    />,
  );

  assert.match(markup, /Owned Games/u);
  assert.match(markup, /Perfect Games/u);
  assert.match(markup, /Library scan not run yet/u);
  assert.match(markup, /No saved library totals are available yet/u);
  assert.doesNotMatch(markup, />21</u);
  assert.doesNotMatch(markup, /Perfect Games<\/p><p[^>]*>0/u);
});

test("SteamOS dashboard surface hides the Steam scan action until Steam is configured", () => {
  const markup = renderToStaticMarkup(
    <SteamOSDashboardSurface
      providerStatuses={createProviderStatuses({
        retroAchievements: { status: "configured" },
        steam: { status: "not_configured" },
      })}
      initialSelectedProviderId={RETROACHIEVEMENTS_PROVIDER_ID}
      initialProviderStates={createSteamOSDashboardProviderStates(
        createProviderStatuses({
          retroAchievements: { status: "configured" },
          steam: { status: "not_configured" },
        }),
      )}
      onScanSteamLibrary={() => {}}
      isSteamLibraryScanning={false}
    />,
  );

  assert.doesNotMatch(markup, /Scan Steam library/u);
});

test("SteamOS dashboard surface falls back cleanly when cached timestamps are unavailable", () => {
  const providerStatuses = createProviderStatuses({
    retroAchievements: { status: "configured" },
    steam: { status: "not_configured" },
  });
  const snapshot = createRetroDashboardSnapshot();
  snapshot.refreshedAt = Number.NaN;
  snapshot.profile.refreshedAt = Number.NaN;

  const markup = renderToStaticMarkup(
    <SteamOSDashboardSurface
      providerStatuses={providerStatuses}
      initialSelectedProviderId={RETROACHIEVEMENTS_PROVIDER_ID}
      initialProviderStates={{
        ...createSteamOSDashboardProviderStates(providerStatuses),
        retroAchievements: {
          status: "cached",
          snapshot,
          isRefreshing: false,
        },
      }}
    />,
  );

  assert.match(markup, /Last dashboard refresh unavailable/u);
  assert.doesNotMatch(markup, /undefined|null|NaN|mtimeMs|refreshedAtMs|sizeBytes/u);
});

test("SteamOS dashboard surface follows the selected provider prop and keeps chooser state safe", () => {
  const providerStatuses = createProviderStatuses({
    retroAchievements: { status: "configured" },
    steam: { status: "configured" },
  });
  const providerStates = createSteamOSDashboardProviderStates(providerStatuses);
  const markup = renderToStaticMarkup(
    <SteamOSDashboardSurface
      providerStatuses={providerStatuses}
      selectedProviderId={STEAM_PROVIDER_ID}
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

  assert.match(markup, /aria-pressed="true"/u);
  assert.match(markup, /Steam/u);
  assert.match(markup, /Cached/u);
  assert.doesNotMatch(markup, new RegExp(VALID_TOKEN, "u"));
  assert.doesNotMatch(markup, /localStorage|sessionStorage|apiKey|Authorization/u);
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
          errorMessage:
            "Showing cached dashboard data. Refresh failed. Try again when the backend is available.",
          isRefreshing: true,
        },
      }}
    />,
  );

  assert.match(markup, /Refreshing/u);
  assert.match(markup, /Refreshing\.\.\./u);
  assert.match(markup, /Refresh RetroAchievements dashboard/u);
  assert.match(markup, /Refreshing the cached dashboard view/u);
  assert.match(markup, /Showing cached dashboard data\. Refresh failed\. Try again when the backend is available\./u);
  assert.match(markup, /role="status"/u);
  assert.match(markup, /aria-live="polite"/u);
  assert.match(markup, /class="steamos-focus-target steamos-button-target"/u);
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
  assert.equal(nextState.errorMessage, "Showing cached dashboard data. Refresh failed. Try again when the backend is available.");
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
  assert.equal(nextState.errorMessage, "No dashboard available yet. Refresh failed. Check setup or retry.");
});

test("SteamOS dashboard cache load failures stay generic and keep refresh available", async () => {
  const providerStatuses = createProviderStatuses({
    retroAchievements: { status: "configured" },
    steam: { status: "not_configured" },
  });

  const states = await loadSteamOSDashboardProviderStates({
    providerStatuses,
    readCachedSnapshot: async () => {
      throw new Error("Bearer secret should not leak");
    },
  });

  assert.equal(states.retroAchievements.status, "not_loaded");
  assert.equal(states.retroAchievements.errorMessage, "Cached dashboard unavailable. Try Refresh again.");
  assert.doesNotMatch(JSON.stringify(states), /Bearer secret should not leak/u);
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
  const steamCards = buildSteamOSDashboardSummaryCards(
    createSteamDashboardSnapshot(),
    createSteamLibraryScanOverview(),
  );
  const preScanSteamCards = buildSteamOSDashboardSummaryCards(createSteamDashboardSnapshot());
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
  assert.equal(preScanSteamCards.find((card) => card.label === "Owned Games")?.value, "\u2014");
  assert.equal(preScanSteamCards.find((card) => card.label === "Perfect Games")?.value, "\u2014");
  assert.equal(preScanSteamCards.find((card) => card.label === "Completion")?.value, "54% (partial)");
  assert.equal(resolveInitialDashboardProviderId(createProviderStatuses({
    retroAchievements: { status: "not_configured" },
    steam: { status: "configured" },
  })), STEAM_PROVIDER_ID);
  assert.doesNotMatch(dashboardSource, /@decky|platform\/decky|platform\\decky/u);
  assert.doesNotMatch(dashboardSource, /localStorage|sessionStorage/u);
  assert.doesNotMatch(dashboardSource, /scanSteamLibraryAchievements|platform\/decky\/providers\/steam|platform\\decky\\providers\\steam/u);
  assert.doesNotMatch(dashboardSource, /Authorization: Bearer|provider-secrets/u);
  assert.doesNotMatch(deckyEntrypoint, /platform\/steamos\/dashboard-surface|platform\\steamos\\dashboard-surface/u);
});
