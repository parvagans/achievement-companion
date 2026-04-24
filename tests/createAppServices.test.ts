import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import type { CacheEntry, CacheStore, ResourceState } from "../src/core/cache";
import {
  createProviderAchievementHistoryCacheKey,
  CACHE_VERSION,
  createProviderCompletionProgressCacheKey,
  createProviderDashboardCacheKey,
  createProviderGameDetailCacheKey,
} from "../src/core/cache-keys";
import { createAppServices } from "../src/core/app-services";
import type {
  DashboardSnapshot,
  GameDetailSnapshot,
  NormalizedGame,
  ProviderCapabilities,
  RecentlyPlayedGame,
} from "../src/core/domain";
import { createProviderRegistry } from "../src/core/provider-registry";
import type { AchievementProvider } from "../src/core/ports";
import type { KeyValueStore, PlatformServices } from "../src/core/platform";
import {
  ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY,
  DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS,
  parseAchievementCompanionSettings,
  serializeAchievementCompanionSettings,
} from "../src/core/settings";
import { resolveProviderDashboardPreferences } from "../src/core/provider-dashboard-preferences";
import { redactFrontendLogText, redactFrontendLogValue } from "../src/core/redaction";
import {
  applyDeckyRecentAchievementHistory,
  buildDeckyRecentAchievementHistory,
  loadDeckyDashboardState,
  loadDeckyCompletionProgressState,
} from "../src/platform/decky/decky-app-services";
import { setDeckyBackendCallImplementationForTests } from "../src/platform/decky/decky-backend-bridge";
import {
  dedupeDistinctLabels,
  getAchievementCounts,
  getAchievementDescriptionText,
  hasAchievementCounts,
  shouldHideSteamAchievementDetailStats,
} from "../src/platform/decky/decky-achievement-detail-helpers";
import {
  formatCompletionProgressFilterLabelForProvider,
  formatCompletionProgressStatusLabel,
  formatCompletionProgressSummary,
  formatProfileMemberSince,
  formatSteamPlaytimeMinutes,
  getSteamCompletionProgressGameDetailId,
  getSteamAccountProgressCards,
  getSteamAccountProgressSummary,
  getDeckyProfileStats,
  getSteamProfileStats,
} from "../src/platform/decky/decky-stat-helpers";
import {
  DECKY_ACHIEVEMENT_FILTER_GROUP_CLASS,
  DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS,
  DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS,
  DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS,
  DECKY_FULLSCREEN_ACTION_ROW_CENTERED_CLASS,
  DECKY_FULLSCREEN_ACTION_ROW_CLASS,
  DECKY_FULLSCREEN_CHIP_CLASS,
  getDeckyFocusStylesCss,
} from "../src/platform/decky/decky-focus-styles";
import { getDeckyFullscreenActionStylesCss } from "../src/platform/decky/decky-full-screen-action-styles";
import {
  clearDeckyDashboardSnapshot,
  readDeckyDashboardSnapshotCacheEntry,
  readDeckyDashboardSnapshotState,
  writeDeckyDashboardSnapshot,
} from "../src/platform/decky/decky-dashboard-snapshot-cache";
import {
  DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY,
  consumeDeckyFullscreenReturnContext,
  createDeckyFullscreenReturnContextForGame,
  createDeckyFullscreenReturnContextForProviderDashboard,
  clearDeckyFullscreenReturnContext,
  markDeckyFullscreenReturnRequested,
  readDeckyFullscreenReturnContext,
  writeDeckyFullscreenReturnContext,
  restoreDeckyFullscreenSelectionFromContext,
} from "../src/platform/decky/decky-full-screen-return-context";
import { getSteamBadgeSummaryCards } from "../src/platform/decky/steam-badges";
import { shouldRefreshDashboardOnEntry } from "../src/platform/decky/dashboard-refresh";
import {
  clearDeckyProviderConfig,
  clearDeckyRetroAchievementsAccountState,
  loadDeckyProviderConfig as loadDeckyRetroAchievementsProviderConfig,
  readDeckyProviderConfig,
  writeDeckyProviderConfig,
} from "../src/platform/decky/providers/retroachievements/config";
import {
  RETROACHIEVEMENTS_CREDENTIAL_HELPER_COPY,
  buildRetroAchievementsCredentialsFormModel,
  getRetroAchievementsApiKeyInputDescriptor,
  getRetroAchievementsCredentialsFieldSpecs,
  resolveRetroAchievementsApiKeyForSave,
} from "../src/platform/decky/providers/retroachievements/credentials-help";
import {
  clearDeckySteamLibraryAchievementScanSummary,
  clearDeckySteamProviderConfig,
  loadDeckyProviderConfig as loadDeckySteamProviderConfig,
  readDeckySteamLibraryAchievementScanOverview,
  readDeckySteamLibraryAchievementScanSummary,
  readDeckySteamProviderConfig,
  writeDeckySteamLibraryAchievementScanSummary,
  writeDeckySteamProviderConfig,
} from "../src/platform/decky/providers/steam/config";
import { clearDeckyProviderConfigCache } from "../src/platform/decky/providers/provider-config-store";
import {
  STEAM_CREDENTIAL_HELPER_COPY,
  buildSteamCredentialsFormModel,
  getSteamApiKeyInputDescriptor,
  getSteamCredentialsFieldSpecs,
  resolveSteamApiKeyForSave,
} from "../src/platform/decky/providers/steam/credentials-help";
import {
  buildDeckySteamCompletionProgressSnapshotFromSummary,
  buildDeckySteamAchievementHistorySnapshotFromSummary,
  runAndCacheDeckySteamLibraryAchievementScan,
} from "../src/platform/decky/providers/steam/library-scan";
import { scanSteamLibraryAchievements } from "../src/providers/steam/library-scan";
import type { SteamClient } from "../src/providers/steam/client/client";
import { normalizeSteamBadges } from "../src/providers/steam/badges";
import {
  applySteamLibraryScanGameDetailMetadata,
  findSteamLibraryScanGameSummaryByAppId,
} from "../src/platform/decky/providers/steam/game-detail";
import {
  consumeNextFullScreenSettingsBackTarget,
  markFullScreenGameRouteBackBehavior,
  markNextFullScreenSettingsBackTarget,
  resolveFullScreenGameRouteBackBehavior,
  resolveFullScreenSettingsBackTarget,
  shouldSuppressGameRouteUnmountWhenOpeningAchievement,
} from "../src/platform/decky/decky-full-screen-navigation-state";
import {
  ensureFullscreenCancelBridgeRegisteredForBackButtonElement,
  resetFullscreenCancelBridgeForTests,
} from "../src/platform/decky/decky-full-screen-cancel-bridge";
import type { SteamLibraryAchievementScanSummary } from "../src/platform/decky/providers/steam";
import { groupCompletionProgressGames } from "../src/platform/decky/decky-completion-progress-grouping";
import {
  normalizeRetroAchievementsCompletionProgressGames,
  normalizeRetroAchievementsGameDetail,
  normalizeRetroAchievementsProfile,
  normalizeRetroAchievementsRecentUnlocks,
  normalizeRetroAchievementsRecentlyPlayedGames,
} from "../src/providers/retroachievements/mappers/normalize";
import type {
  RawRetroAchievementsCompletionProgressEntry,
  RawRetroAchievementsGameProgressResponse,
  RawRetroAchievementsProfileResponse,
  RawRetroAchievementsRecentUnlockResponse,
  RawRetroAchievementsRecentlyPlayedGameResponse,
} from "../src/providers/retroachievements/raw-types";
import {
  readDeckyStorageText,
  writeDeckyStorageText,
} from "../src/platform/decky/storage";
import {
  createRetroAchievementsProvider,
  type RetroAchievementsClient,
} from "../src/providers/retroachievements";
import {
  DEFAULT_STEAM_PROVIDER_CONFIG,
  normalizeSteamProviderConfig,
  parseSteamProviderConfig,
  serializeSteamProviderConfig,
} from "../src/providers/steam/config";
import {
  createFetchSteamTransport,
  createSteamClient,
  createSteamProvider,
  clearSteamRecentGameSnapshotLoadCacheForTests,
} from "../src/providers/steam";
import {
  normalizeSteamGameDetail,
  normalizeSteamProfile,
  normalizeSteamRecentUnlocks,
  normalizeSteamRecentlyPlayedGames,
} from "../src/providers/steam/mappers/normalize";
import type {
  SteamLibraryAchievementScanSummary,
  RawSteamPlayerAchievement,
  RawSteamBadge,
  RawSteamPlayerSummary,
  RawSteamOwnedGame,
  RawSteamGetBadgesResponse,
  RawSteamGetOwnedGamesResponse,
  RawSteamRecentlyPlayedGame,
  RawSteamGetSteamLevelResponse,
  RawSteamSchemaAchievement,
} from "../src/providers/steam/raw-types";
import { buildProviderOverviewStats } from "../src/platform/decky/decky-overview-stats";
import { getSteamXpProgress } from "../src/platform/decky/steam-xp";

const PROVIDER_ID = "retroachievements";
const PLATFORM: PlatformServices = {
  info: {
    platformId: "decky",
    appName: "Achievement Companion",
  },
};
const PROVIDER_CAPABILITIES: ProviderCapabilities = {
  requiresCredentials: true,
  profileSummary: true,
  completionProgress: true,
  recentUnlocks: true,
  gameProgress: true,
  rarityStats: true,
  search: false,
};

interface CallCounts {
  config: number;
  profile: number;
  completionProgress: number;
  recentUnlocks: number;
  achievementsEarnedBetween: number;
  recentlyPlayedGames: number;
  gameProgress: number;
}

function createMemoryCacheStore(
  initialEntries: readonly CacheEntry<unknown>[] = [],
): { readonly cacheStore: CacheStore; readonly writes: readonly CacheEntry<unknown>[] } {
  const entries = new Map<string, CacheEntry<unknown>>();
  const writes: CacheEntry<unknown>[] = [];

  for (const entry of initialEntries) {
    entries.set(entry.key, entry);
  }

  return {
    writes,
    cacheStore: {
      async read<T>(key: string): Promise<CacheEntry<T> | undefined> {
        return entries.get(key) as CacheEntry<T> | undefined;
      },

      async write<T>(entry: CacheEntry<T>): Promise<void> {
        writes.push(entry as CacheEntry<unknown>);
        entries.set(entry.key, entry as CacheEntry<unknown>);
      },

      async delete(key: string): Promise<void> {
        entries.delete(key);
      },

      async clear(prefix?: string): Promise<void> {
        if (prefix === undefined) {
          entries.clear();
          return;
        }

        for (const key of [...entries.keys()]) {
          if (key.startsWith(prefix)) {
            entries.delete(key);
          }
        }
      },
    },
  };
}

function createCacheEntry<T>(
  key: string,
  value: T,
  storedAt: number,
  expiresAt: number,
): CacheEntry<T> {
  return {
    key,
    value,
    storedAt,
    expiresAt,
    version: CACHE_VERSION,
  };
}

function setGlobalTestValue<T>(key: string, value: T): () => void {
  const globalRecord = globalThis as Record<string, unknown>;
  const hadOwnProperty = Object.prototype.hasOwnProperty.call(globalRecord, key);
  const previousValue = globalRecord[key];
  globalRecord[key] = value as unknown;

  return () => {
    if (hadOwnProperty) {
      globalRecord[key] = previousValue;
      return;
    }

    delete globalRecord[key];
  };
}

function createDashboardSnapshot(): DashboardSnapshot {
  return {
    profile: {
      providerId: PROVIDER_ID,
      identity: {
        providerId: PROVIDER_ID,
        accountId: "alice",
        displayName: "Alice",
      },
      summary: {
        unlockedCount: 12,
        totalCount: 20,
        completionPercent: 60,
      },
      metrics: [],
      refreshedAt: 1_700_000_000_000,
    },
    recentAchievements: [],
    recentlyPlayedGames: [],
    recentUnlocks: [],
    featuredGames: [],
    refreshedAt: 1_700_000_000_000,
  };
}

function createDashboardSnapshotWithRecentAchievements(
  recentAchievements: DashboardSnapshot["recentAchievements"],
): DashboardSnapshot {
  return {
    ...createDashboardSnapshot(),
    recentAchievements,
    recentUnlocks: recentAchievements,
  };
}

function createRecentUnlock(sequence: number): DashboardSnapshot["recentAchievements"][number] {
  const unlockedAt = 1_700_000_000_000 + sequence * 1_000;

  return {
    achievement: {
      providerId: PROVIDER_ID,
      achievementId: `ach-${sequence}`,
      gameId: "game-1",
      title: `Achievement ${sequence}`,
      isUnlocked: true,
      unlockedAt,
      points: 10,
      metrics: [],
    },
    game: {
      providerId: PROVIDER_ID,
      gameId: "game-1",
      title: "Test Game",
    },
    unlockedAt,
  };
}

function createRecentUnlockWithoutTimestamp(
  sequence: number,
): DashboardSnapshot["recentAchievements"][number] {
  const recentUnlock = createRecentUnlock(sequence);

  return {
    ...recentUnlock,
    achievement: {
      ...recentUnlock.achievement,
      unlockedAt: undefined,
    },
    unlockedAt: undefined,
  };
}

function createRecentUnlockForGame(
  gameId: string,
  gameTitle: string,
  achievementNumber: number,
  unlockedAt: number,
): DashboardSnapshot["recentAchievements"][number] {
  return {
    achievement: {
      providerId: PROVIDER_ID,
      achievementId: `${gameId}-ach-${achievementNumber}`,
      gameId,
      title: `${gameTitle} Achievement ${achievementNumber}`,
      isUnlocked: true,
      unlockedAt,
      points: 10,
      metrics: [],
    },
    game: {
      providerId: PROVIDER_ID,
      gameId,
      title: gameTitle,
    },
    unlockedAt,
  };
}

function createBackfillGameDetail(
  gameId: string,
  title: string,
  timestamps: readonly number[],
): GameDetailSnapshot {
  return {
    game: {
      providerId: PROVIDER_ID,
      gameId,
      title,
      summary: {
        unlockedCount: timestamps.length,
      },
      metrics: [],
    },
    achievements: timestamps.map((unlockedAt, index) => ({
      providerId: PROVIDER_ID,
      achievementId: `${gameId}-ach-${index + 1}`,
      gameId,
      title: `${title} Achievement ${index + 1}`,
      description: `Unlock ${index + 1} for ${title}`,
      isUnlocked: true,
      unlockedAt,
      points: 10 + index,
      metrics: [],
    })),
    refreshedAt: timestamps[0],
  };
}

function createBackfillCompletionProgress(): readonly NormalizedGame[] {
  return [
    {
      providerId: PROVIDER_ID,
      gameId: "game-a",
      title: "Game A",
      status: "in_progress",
      summary: {
        unlockedCount: 3,
      },
      metrics: [],
      lastUnlockAt: 1_700_000_000_500,
    },
    {
      providerId: PROVIDER_ID,
      gameId: "game-b",
      title: "Game B",
      status: "in_progress",
      summary: {
        unlockedCount: 3,
      },
      metrics: [],
      lastUnlockAt: 1_700_000_000_200,
    },
  ];
}

function createBackfillCompletionProgressWithoutDates(): readonly NormalizedGame[] {
  return [
    {
      providerId: PROVIDER_ID,
      gameId: "game-a",
      title: "Game A",
      status: "in_progress",
      summary: {
        unlockedCount: 3,
      },
      metrics: [],
    },
    {
      providerId: PROVIDER_ID,
      gameId: "game-b",
      title: "Game B",
      status: "in_progress",
      summary: {
        unlockedCount: 2,
      },
      metrics: [],
    },
  ];
}

function createBackfillRecentlyPlayedGame(
  gameId: string,
  title: string,
  unlockedCount: number,
  lastPlayedAt: number,
): RecentlyPlayedGame {
  return {
    providerId: PROVIDER_ID,
    gameId,
    title,
    summary: {
      unlockedCount,
    },
    lastPlayedAt,
  };
}

function createMockStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key: string): string | null {
      return entries.get(key) ?? null;
    },
    key(index: number): string | null {
      return [...entries.keys()][index] ?? null;
    },
    removeItem(key: string): void {
      entries.delete(key);
    },
    setItem(key: string, value: string): void {
      entries.set(key, value);
    },
  };
}

function createMemoryKeyValueStore(
  initialEntries: Readonly<Record<string, string>> = {},
): KeyValueStore {
  const entries = new Map<string, string>(Object.entries(initialEntries));

  return {
    async read(key: string): Promise<string | undefined> {
      return entries.get(key);
    },

    async write(key: string, value: string): Promise<void> {
      entries.set(key, value);
    },

    async delete(key: string): Promise<void> {
      entries.delete(key);
    },
  };
}

async function withMockDeckyStorage<T>(callback: () => Promise<T> | T): Promise<T> {
  const globalObject = globalThis as typeof globalThis & {
    localStorage?: Storage;
    sessionStorage?: Storage;
  };
  const previousLocalStorage = globalObject.localStorage;
  const previousSessionStorage = globalObject.sessionStorage;
  const mockStorage = createMockStorage();

  globalObject.localStorage = mockStorage;
  globalObject.sessionStorage = mockStorage;

  try {
    return await callback();
  } finally {
    if (previousLocalStorage === undefined) {
      delete globalObject.localStorage;
    } else {
      globalObject.localStorage = previousLocalStorage;
    }

    if (previousSessionStorage === undefined) {
      delete globalObject.sessionStorage;
    } else {
      globalObject.sessionStorage = previousSessionStorage;
    }
  }
}

interface DeckyBackendTestRetroAchievementsState {
  readonly config?: {
    readonly username: string;
    readonly hasApiKey: boolean;
    readonly recentAchievementsCount?: number;
    readonly recentlyPlayedCount?: number;
  };
  readonly secret?: string;
}

interface DeckyBackendTestSteamState {
  readonly config?: {
    readonly steamId64: string;
    readonly hasApiKey: boolean;
    readonly language: string;
    readonly recentAchievementsCount: number;
    readonly recentlyPlayedCount: number;
    readonly includePlayedFreeGames: boolean;
  };
  readonly secret?: string;
}

const deckyBackendTestState = {
  retroAchievements: {} as DeckyBackendTestRetroAchievementsState,
  steam: {} as DeckyBackendTestSteamState,
};

function resetDeckyBackendTestState(): void {
  deckyBackendTestState.retroAchievements = {};
  deckyBackendTestState.steam = {};
}

function getDeckyBackendTestSecret(providerId: "retroachievements" | "steam"): string | undefined {
  return providerId === "retroachievements"
    ? deckyBackendTestState.retroAchievements.secret
    : deckyBackendTestState.steam.secret;
}

const deckyBackendTestCallImplementation = async (route: string, payload: unknown) => {
  const record = payload as Record<string, unknown> | undefined;

  if (route === "get_provider_configs") {
    const result: Record<string, unknown> = { version: 1 };

    if (deckyBackendTestState.retroAchievements.config !== undefined) {
      result.retroAchievements = deckyBackendTestState.retroAchievements.config;
    }

    if (deckyBackendTestState.steam.config !== undefined) {
      result.steam = deckyBackendTestState.steam.config;
    }

    return result;
  }

  if (route === "save_retroachievements_credentials") {
    const username =
      typeof record?.username === "string" ? record.username.trim() : "";
    const draftApiKey =
      typeof record?.apiKeyDraft === "string"
        ? record.apiKeyDraft.trim()
        : typeof record?.apiKey === "string"
          ? record.apiKey.trim()
          : "";
    const recentAchievementsCount =
      typeof record?.recentAchievementsCount === "number"
        ? record.recentAchievementsCount
        : deckyBackendTestState.retroAchievements.config?.recentAchievementsCount;
    const recentlyPlayedCount =
      typeof record?.recentlyPlayedCount === "number"
        ? record.recentlyPlayedCount
        : deckyBackendTestState.retroAchievements.config?.recentlyPlayedCount;

    if (username.length === 0) {
      return undefined;
    }

    if (draftApiKey.length > 0) {
      deckyBackendTestState.retroAchievements.secret = draftApiKey;
    } else if (deckyBackendTestState.retroAchievements.secret === undefined) {
      return undefined;
    }

    deckyBackendTestState.retroAchievements.config = {
      username,
      hasApiKey: true,
      ...(typeof recentAchievementsCount === "number" ? { recentAchievementsCount } : {}),
      ...(typeof recentlyPlayedCount === "number" ? { recentlyPlayedCount } : {}),
    };

    return deckyBackendTestState.retroAchievements.config;
  }

  if (route === "save_steam_credentials") {
    const steamId64 =
      typeof record?.steamId64 === "string" ? record.steamId64.trim() : "";
    const draftApiKey =
      typeof record?.apiKeyDraft === "string"
        ? record.apiKeyDraft.trim()
        : typeof record?.apiKey === "string"
          ? record.apiKey.trim()
          : "";
    const language = typeof record?.language === "string" ? record.language.trim() || "english" : "english";

    if (steamId64.length === 0) {
      return undefined;
    }

    if (draftApiKey.length > 0) {
      deckyBackendTestState.steam.secret = draftApiKey;
    } else if (deckyBackendTestState.steam.secret === undefined) {
      return undefined;
    }

    deckyBackendTestState.steam.config = {
      steamId64,
      hasApiKey: true,
      language,
      recentAchievementsCount: typeof record?.recentAchievementsCount === "number" ? record.recentAchievementsCount : 5,
      recentlyPlayedCount: typeof record?.recentlyPlayedCount === "number" ? record.recentlyPlayedCount : 5,
      includePlayedFreeGames: typeof record?.includePlayedFreeGames === "boolean"
        ? record.includePlayedFreeGames
        : false,
    };

    return deckyBackendTestState.steam.config;
  }

  if (route === "clear_provider_credentials") {
    const providerId = typeof record?.providerId === "string" ? record.providerId : "";
    if (providerId === "retroachievements") {
      const hadState =
        deckyBackendTestState.retroAchievements.config !== undefined ||
        deckyBackendTestState.retroAchievements.secret !== undefined;
      deckyBackendTestState.retroAchievements = {};
      return hadState;
    }

    if (providerId === "steam") {
      const hadState =
        deckyBackendTestState.steam.config !== undefined || deckyBackendTestState.steam.secret !== undefined;
      deckyBackendTestState.steam = {};
      return hadState;
    }

    return false;
  }

  if (route === "request_steam_json") {
    const path = typeof record?.path === "string" ? record.path : "";
    if (path === "ISteamUser/GetPlayerSummaries/v2/") {
      return {
        response: {
          players: [
            {
              steamid: deckyBackendTestState.steam.config?.steamId64 ?? "12345678901234567",
              personaname: "Steam User",
              avatarfull: "https://cdn.steam.com/avatar.jpg",
            },
          ],
        },
      };
    }

    if (path === "IPlayerService/GetSteamLevel/v1/") {
      return {
        response: {
          player_level: 29,
        },
      };
    }

    if (path === "IPlayerService/GetBadges/v1/") {
      return {
        response: {
          badges: [],
          player_xp: 5_740,
        },
      };
    }

    if (path === "IPlayerService/GetOwnedGames/v1/") {
      return {
        response: {
          game_count: 1,
          games: [
            {
              appid: 220,
              name: "Half-Life 2",
              img_icon_url: "half-life-2-icon",
              playtime_forever: 42,
              playtime_2weeks: 12,
            },
          ],
        },
      };
    }

    if (path === "IPlayerService/GetRecentlyPlayedGames/v1/") {
      return {
        response: {
          games: [
            {
              appid: 220,
              name: "Half-Life 2",
              img_icon_url: "half-life-2-icon",
              playtime_forever: 42,
              playtime_2weeks: 12,
            },
          ],
        },
      };
    }

    if (path === "ISteamUserStats/GetPlayerAchievements/v1/") {
      return {
        playerstats: {
          success: true,
          achievements: [],
        },
      };
    }

    if (path === "ISteamUserStats/GetSchemaForGame/v2/") {
      return {
        game: {
          availableGameStats: {
            achievements: [],
          },
        },
      };
    }

    if (path === "ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/") {
      return {
        achievementpercentages: {
          achievements: [],
        },
      };
    }

    throw new Error(`Unexpected steam backend request path in test: ${path}`);
  }

  throw new Error(`Unexpected decky backend route in test: ${route}`);
};

setDeckyBackendCallImplementationForTests(deckyBackendTestCallImplementation);

beforeEach(() => {
  resetDeckyBackendTestState();
  clearDeckyProviderConfigCache("retroachievements");
  clearDeckyProviderConfigCache("steam");
  clearDeckySteamLibraryAchievementScanSummary();
  clearSteamRecentGameSnapshotLoadCacheForTests();
});

const DASHBOARD_REFRESH_FEATURED_GAMES: DashboardSnapshot["featuredGames"] = [
  {
    providerId: PROVIDER_ID,
    gameId: "game-2",
    title: "Test Journey",
    platformLabel: "NES",
    status: "in_progress",
    summary: {
      unlockedCount: 4,
      totalCount: 10,
      completionPercent: 40,
    },
    metrics: [],
    lastUnlockAt: 1_700_000_000_050,
  },
];

const DASHBOARD_REFRESH_PROFILE: DashboardSnapshot["profile"] = {
  providerId: PROVIDER_ID,
  identity: {
    providerId: PROVIDER_ID,
    accountId: "alice",
    displayName: "Alice",
  },
  summary: {
    unlockedCount: 12,
    totalCount: 20,
    completionPercent: 60,
  },
  metrics: [],
  featuredGames: DASHBOARD_REFRESH_FEATURED_GAMES,
  refreshedAt: 1_700_000_000_100,
};

const DASHBOARD_REFRESH_RECENT_UNLOCKS: DashboardSnapshot["recentUnlocks"] = [
  {
    achievement: {
      providerId: PROVIDER_ID,
      achievementId: "ach-1",
      gameId: "game-1",
      title: "First Blood",
      isUnlocked: true,
      unlockedAt: 1_700_000_000_100,
      points: 10,
      metrics: [],
    },
    game: {
      providerId: PROVIDER_ID,
      gameId: "game-1",
      title: "Test Game",
    },
    unlockedAt: 1_700_000_000_100,
  },
];

const DASHBOARD_REFRESH_RECENTLY_PLAYED_GAMES: DashboardSnapshot["recentlyPlayedGames"] = [
  {
    providerId: PROVIDER_ID,
    gameId: "game-3",
    title: "Familiar Game",
    platformLabel: "SNES",
    coverImageUrl: "https://example.com/game-3.png",
    summary: {
      unlockedCount: 8,
      totalCount: 16,
      completionPercent: 50,
    },
    lastPlayedAt: 1_700_000_000_200,
  },
];

function createGameDetailSnapshot(): GameDetailSnapshot {
  return {
    game: {
      providerId: PROVIDER_ID,
      gameId: "game-1",
      title: "Test Game",
      status: "in_progress",
      summary: {
        unlockedCount: 3,
        totalCount: 10,
        completionPercent: 30,
      },
      metrics: [],
    },
    achievements: [],
    refreshedAt: 1_700_000_000_000,
  };
}

test("retroachievements game progress normalizes achievement badge art", () => {
  const rawGameProgress: RawRetroAchievementsGameProgressResponse = {
    ID: 14402,
    Title: "Dragster",
    ConsoleName: "Atari 2600",
    ImageIcon: "/Images/026368.png",
    ImageBoxArt: "/Images/066952.png",
    NumAchievements: 1,
    NumAwardedToUser: 1,
    HighestAwardKind: "mastered",
    HighestAwardDate: "2024-04-23T21:28:49+00:00",
    Achievements: {
      "79434": {
        ID: 79434,
        Title: "Novice Dragster Driver 1",
        Description: "Complete your very first race in game 1.",
        Points: 1,
        NumAwarded: 200,
        NumAwardedHardcore: 50,
        BadgeName: "85541",
        DisplayOrder: 0,
        DateEarned: "2022-08-23 22:56:38",
        DateEarnedHardcore: "2022-08-23 22:56:38",
      },
    },
  };

  const snapshot = normalizeRetroAchievementsGameDetail(rawGameProgress);

  assert.equal(
    snapshot.achievements[0]?.badgeImageUrl,
    "https://i.retroachievements.org/Badge/85541.png",
  );
  assert.equal(
    snapshot.achievements[0]?.metrics.find((metric) => metric.key === "unlocked-count")?.value,
    "200",
  );
  assert.equal(
    snapshot.achievements[0]?.metrics.find((metric) => metric.key === "hardcore-unlocked-count")?.value,
    "50",
  );
  assert.equal(
    snapshot.achievements[0]?.metrics.find((metric) => metric.key === "softcore-unlocked-count")?.value,
    "150",
  );
  assert.equal(
    snapshot.game.coverImageUrl,
    "https://i.retroachievements.org/Images/026368.png",
  );
  assert.equal(
    snapshot.game.boxArtImageUrl,
    "https://i.retroachievements.org/Images/066952.png",
  );
});

test("retroachievements recent unlocks normalize badge art urls", () => {
  const rawRecentUnlocks: readonly RawRetroAchievementsRecentUnlockResponse[] = [
    {
      AchievementID: 108302,
      Title: "First Steps",
      Description: "Unlock a starter achievement.",
      BadgeURL: "/Badge/108302.png",
      GameID: 1234,
      GameTitle: "Test Game",
      GameIcon: "/Images/000001.png",
      ConsoleName: "NES",
      Date: "2024-01-01 00:00:00",
    },
  ];

  const recentUnlocks = normalizeRetroAchievementsRecentUnlocks(rawRecentUnlocks);

  assert.equal(
    recentUnlocks[0]?.achievement.badgeImageUrl,
    "https://i.retroachievements.org/Badge/108302.png",
  );
});

test("retroachievements recent unlock timestamps parse timezone-less UTC strings correctly", () => {
  const nowAt = Date.parse("2026-04-18T18:45:00Z");
  const rawRecentUnlocks: readonly RawRetroAchievementsRecentUnlockResponse[] = [
    {
      AchievementID: 108302,
      Title: "First Steps",
      Description: "Unlock a starter achievement.",
      BadgeURL: "/Badge/108302.png",
      GameID: 1234,
      GameTitle: "Test Game",
      GameIcon: "/Images/000001.png",
      ConsoleName: "NES",
      Date: "2026-04-18 18:30:00",
    },
    {
      AchievementID: 108303,
      Title: "Second Steps",
      Description: "Unlock another starter achievement.",
      BadgeURL: "/Badge/108303.png",
      GameID: 1234,
      GameTitle: "Test Game",
      GameIcon: "/Images/000001.png",
      ConsoleName: "NES",
      Date: "2026-04-18T18:30:00Z",
    },
    {
      AchievementID: 108304,
      Title: "Broken Steps",
      Description: "Invalid time should be ignored.",
      BadgeURL: "/Badge/108304.png",
      GameID: 1234,
      GameTitle: "Test Game",
      GameIcon: "/Images/000001.png",
      ConsoleName: "NES",
      Date: "not-a-date",
    },
  ];

  const recentUnlocks = normalizeRetroAchievementsRecentUnlocks(rawRecentUnlocks);

  assert.equal(recentUnlocks.length, 3);
  assert.equal(recentUnlocks[0]?.unlockedAt, Date.parse("2026-04-18T18:30:00Z"));
  assert.equal(recentUnlocks[1]?.unlockedAt, Date.parse("2026-04-18T18:30:00Z"));
  assert.equal(nowAt - (recentUnlocks[0]?.unlockedAt ?? 0), 15 * 60 * 1000);
  assert.equal(recentUnlocks[2]?.unlockedAt, undefined);
});

test("retroachievements profile normalizes avatar image urls", () => {
  const rawProfile: RawRetroAchievementsProfileResponse = {
    User: "Alice",
    ULID: "abc123",
    UserPic: "/UserPic/0001.png",
    MemberSince: "2020-01-02 00:00:00",
    Motto: "Keep on playing",
    TotalPoints: 1234,
  };

  const profile = normalizeRetroAchievementsProfile(
    rawProfile,
    {
      unlockedCount: 12,
      totalCount: 20,
      completionPercent: 60,
    },
    {
      username: "alice",
      apiKey: "secret",
    },
  );

  assert.equal(
    profile.identity.avatarUrl,
    "https://i.retroachievements.org/UserPic/0001.png",
  );
  assert.equal(profile.motto, "Keep on playing");
});

test("achievement companion settings normalize invalid stored values", () => {
  const settings = parseAchievementCompanionSettings(
    JSON.stringify({
      recentAchievementsCount: 9,
      recentlyPlayedCount: 3,
      showCompletionProgressSubsets: "yes",
      defaultCompletionProgressFilter: "secret",
    }),
  );

  assert.deepStrictEqual(settings, {
    ...DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS,
    recentlyPlayedCount: 3,
  });
  assert.equal(
    serializeAchievementCompanionSettings(DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS),
    JSON.stringify(DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS),
  );
});

test("decky provider config persists and clears retroachievements credentials", async () => {
  await withMockDeckyStorage(async () => {
    assert.equal(readDeckyProviderConfig("retroachievements"), undefined);

    assert.equal(
      await writeDeckyProviderConfig(
        {
          username: "alice",
          recentAchievementsCount: 10,
          recentlyPlayedCount: 7,
        },
        "secret",
      ),
      true,
    );
    assert.deepStrictEqual(readDeckyProviderConfig("retroachievements"), {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 10,
      recentlyPlayedCount: 7,
    });

    assert.equal(await clearDeckyProviderConfig(), true);
    assert.equal(readDeckyProviderConfig("retroachievements"), undefined);
  });
});

test("retroachievements dashboard preferences prefer provider counts and fall back to settings", () => {
  const fallbackSettings = {
    ...DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS,
    recentAchievementsCount: 7,
    recentlyPlayedCount: 3,
  };

  assert.deepStrictEqual(
    resolveProviderDashboardPreferences(
      {
        username: "alice",
        hasApiKey: true,
        recentAchievementsCount: 10,
        recentlyPlayedCount: 10,
      },
      fallbackSettings,
    ),
    {
      recentAchievementsCount: 10,
      recentlyPlayedCount: 10,
    },
  );

  assert.deepStrictEqual(
    resolveProviderDashboardPreferences(
      {
        username: "alice",
        hasApiKey: true,
      },
      fallbackSettings,
    ),
    {
      recentAchievementsCount: 7,
      recentlyPlayedCount: 3,
    },
  );
});

test("decky sign out clears retroachievements credentials and recent history", async () => {
  await withMockDeckyStorage(async () => {
    const recentHistoryStorageKey = "achievement-companion:decky:recent-achievements:retroachievements:alice";

    assert.equal(
      writeDeckyStorageText(recentHistoryStorageKey, JSON.stringify([{ recentUnlock: 1 }])),
      true,
    );
    assert.equal(await writeDeckyProviderConfig({ username: "alice" }, "secret"), true);

    assert.equal(await clearDeckyRetroAchievementsAccountState(), true);
    assert.equal(readDeckyProviderConfig("retroachievements"), undefined);
    assert.equal(readDeckyStorageText(recentHistoryStorageKey), undefined);
  });
});

test("decky steam provider config clears saved api key credentials", async () => {
  await withMockDeckyStorage(async () => {
    assert.equal(
      await writeDeckySteamProviderConfig(
        {
          steamId64: "12345678901234567",
          language: "english",
          recentAchievementsCount: 5,
          recentlyPlayedCount: 5,
          includePlayedFreeGames: false,
        },
        "secret",
      ),
      true,
    );

    assert.equal(await clearDeckySteamProviderConfig(), true);
    assert.equal(readDeckySteamProviderConfig("steam"), undefined);
  });
});

test("decky credential migration and draft saves stay backend-owned", async () => {
  await withMockDeckyStorage(async () => {
    const retroAchievementsLegacyStorageKey = "achievement-companion:decky:retroachievements:config";
    const steamLegacyStorageKey = "achievement-companion:decky:steam:config";

    writeDeckyStorageText(
      retroAchievementsLegacyStorageKey,
      JSON.stringify({ username: "alice", apiKey: "ra-secret" }),
    );
    writeDeckyStorageText(
      steamLegacyStorageKey,
      JSON.stringify({
        steamId64: "12345678901234567",
        apiKey: "steam-secret",
        language: "english",
        recentAchievementsCount: 5,
        recentlyPlayedCount: 5,
        includePlayedFreeGames: false,
      }),
    );

    assert.deepStrictEqual(
      await loadDeckyRetroAchievementsProviderConfig("retroachievements"),
      {
        username: "alice",
        hasApiKey: true,
      },
    );
    assert.deepStrictEqual(await loadDeckySteamProviderConfig("steam"), {
      steamId64: "12345678901234567",
      hasApiKey: true,
      language: "english",
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
      includePlayedFreeGames: false,
    });
    assert.equal(getDeckyBackendTestSecret("retroachievements"), "ra-secret");
    assert.equal(getDeckyBackendTestSecret("steam"), "steam-secret");
    assert.equal(readDeckyStorageText(retroAchievementsLegacyStorageKey), undefined);
    assert.equal(readDeckyStorageText(steamLegacyStorageKey), undefined);

    assert.equal(await writeDeckyProviderConfig({ username: "alice" }, ""), true);
    assert.equal(getDeckyBackendTestSecret("retroachievements"), "ra-secret");
    assert.equal(
      await writeDeckyProviderConfig({ username: "alice" }, "ra-secret-2"),
      true,
    );
    assert.equal(getDeckyBackendTestSecret("retroachievements"), "ra-secret-2");

    assert.equal(
      await writeDeckySteamProviderConfig(
        {
          steamId64: "12345678901234567",
          language: "english",
          recentAchievementsCount: 5,
          recentlyPlayedCount: 5,
          includePlayedFreeGames: false,
        },
        "",
      ),
      true,
    );
    assert.equal(getDeckyBackendTestSecret("steam"), "steam-secret");
    assert.equal(
      await writeDeckySteamProviderConfig(
        {
          steamId64: "12345678901234567",
          language: "english",
          recentAchievementsCount: 5,
          recentlyPlayedCount: 5,
          includePlayedFreeGames: false,
        },
        "steam-secret-2",
      ),
      true,
    );
    assert.equal(getDeckyBackendTestSecret("steam"), "steam-secret-2");
  });
});

test("decky legacy credential migration keeps the old localStorage key when the backend save fails", async () => {
  await withMockDeckyStorage(async () => {
    const retroAchievementsLegacyStorageKey = "achievement-companion:decky:retroachievements:config";
    writeDeckyStorageText(
      retroAchievementsLegacyStorageKey,
      JSON.stringify({ username: "alice", apiKey: "ra-secret" }),
    );

    setDeckyBackendCallImplementationForTests(async (route: string) => {
      if (route === "get_provider_configs") {
        return { version: 1 };
      }

      if (route === "save_retroachievements_credentials") {
        return undefined;
      }

      if (route === "save_steam_credentials") {
        return undefined;
      }

      if (route === "clear_provider_credentials") {
        return false;
      }

      throw new Error(`Unexpected decky backend route in test: ${route}`);
    });

    try {
      assert.equal(await loadDeckyRetroAchievementsProviderConfig("retroachievements"), undefined);
      assert.ok(readDeckyStorageText(retroAchievementsLegacyStorageKey) !== undefined);
      assert.equal(getDeckyBackendTestSecret("retroachievements"), undefined);
    } finally {
      setDeckyBackendCallImplementationForTests(deckyBackendTestCallImplementation);
    }
  });
});

test("frontend log redaction masks secret-like fields and preserves safe diagnostics", () => {
  const sentinel = "AC_REDACTION_SENTINEL";
  const rawMessage = [
    `apiKey=${sentinel}`,
    `apiKeyDraft: ${sentinel}`,
    `key=${sentinel}`,
    `y=${sentinel}`,
    `token=${sentinel}`,
    `password=${sentinel}`,
    `secret=${sentinel}`,
    `Authorization: Bearer ${sentinel}`,
    `Bearer ${sentinel}`,
    `https://retroachievements.org/API/API_GetUserProfile.php?u=alice&y=${sentinel}`,
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${sentinel}&steamid=1234`,
  ].join(" ");

  const redactedMessage = redactFrontendLogText(rawMessage);

  assert.doesNotMatch(redactedMessage, new RegExp(sentinel));
  assert.match(redactedMessage, /apiKey: \[redacted\]/);
  assert.match(redactedMessage, /apiKeyDraft: \[redacted\]/);
  assert.match(redactedMessage, /key: \[redacted\]/);
  assert.match(redactedMessage, /y: \[redacted\]/);
  assert.match(redactedMessage, /token: \[redacted\]/);
  assert.match(redactedMessage, /password: \[redacted\]/);
  assert.match(redactedMessage, /secret: \[redacted\]/);
  assert.match(redactedMessage, /Authorization: \[redacted\]/);
  assert.match(redactedMessage, /Bearer \[redacted\]/);
  assert.match(redactedMessage, /[?&]y=\[redacted\]/);
  assert.match(redactedMessage, /[?&]key=\[redacted\]/);

  const redactedPayload = redactFrontendLogValue({
    providerId: "steam",
    path: "IPlayerService/GetOwnedGames/v1/",
    status: 401,
    durationMs: 1234,
    apiKey: sentinel,
    apiKeyDraft: sentinel,
    key: sentinel,
    y: sentinel,
    token: sentinel,
    password: sentinel,
    secret: sentinel,
    Authorization: `Bearer ${sentinel}`,
    nested: [
      {
        url: `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${sentinel}`,
        message: `Authorization=Bearer ${sentinel}`,
      },
    ],
  }) as Record<string, unknown>;

  assert.equal(redactedPayload.providerId, "steam");
  assert.equal(redactedPayload.path, "IPlayerService/GetOwnedGames/v1/");
  assert.equal(redactedPayload.status, 401);
  assert.equal(redactedPayload.durationMs, 1234);
  assert.equal(redactedPayload.apiKey, "[redacted]");
  assert.equal(redactedPayload.apiKeyDraft, "[redacted]");
  assert.equal(redactedPayload.Authorization, "[redacted]");

  const renderedPayload = JSON.stringify(redactedPayload);
  assert.doesNotMatch(renderedPayload, new RegExp(sentinel));
  assert.match(renderedPayload, /\[redacted\]/);
});

test("decky provider barrel does not expose stale generic save or clear facades", () => {
  const deckyProviderIndexSource = readFileSync(
    new URL("../src/platform/decky/providers/index.ts", import.meta.url),
    "utf-8",
  );
  const providerConfigStoreSource = readFileSync(
    new URL("../src/platform/decky/providers/provider-config-store.ts", import.meta.url),
    "utf-8",
  );

  assert.doesNotMatch(
    deckyProviderIndexSource,
    /export async function writeDeckyProviderConfig/,
  );
  assert.doesNotMatch(
    deckyProviderIndexSource,
    /export async function clearDeckyProviderAccountState/,
  );
  assert.doesNotMatch(
    deckyProviderIndexSource,
    /saveDeckyRetroAchievementsCredentials|saveDeckySteamCredentials/,
  );
  assert.doesNotMatch(
    providerConfigStoreSource,
    /export async function clearDeckyProviderAccountState/,
  );
});

test("provider credential helper copy and secret field defaults stay explicit", () => {
  assert.match(RETROACHIEVEMENTS_CREDENTIAL_HELPER_COPY, /retroachievements\.org\/settings/i);
  assert.match(RETROACHIEVEMENTS_CREDENTIAL_HELPER_COPY, /RetroAchievements username/i);
  assert.doesNotMatch(RETROACHIEVEMENTS_CREDENTIAL_HELPER_COPY, /Show API key|Hide API key/i);
  assert.match(STEAM_CREDENTIAL_HELPER_COPY, /steamid\.io/i);
  assert.match(STEAM_CREDENTIAL_HELPER_COPY, /steamcommunity\.com\/dev\/apikey/i);
  assert.doesNotMatch(STEAM_CREDENTIAL_HELPER_COPY, /Show API key|Hide API key/i);
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/credentials-form.tsx", import.meta.url),
      "utf-8",
    ),
    /Saves your account details and the provider options on this page\. If the API key field is empty, your saved key is kept\./,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/credentials-form.tsx", import.meta.url),
      "utf-8",
    ),
    /Saves your account details and the provider options on this page\. If the API key field is empty, your saved key is kept\./,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/credentials-form.tsx", import.meta.url),
      "utf-8",
    ),
    /Remove the saved RetroAchievements account from this device\./,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/credentials-form.tsx", import.meta.url),
      "utf-8",
    ),
    /Remove the saved Steam account from this device\./,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/provider-settings-page.tsx", import.meta.url),
      "utf-8",
    ),
    /statusLabel="Account status"/,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/provider-settings-page.tsx", import.meta.url),
      "utf-8",
    ),
    /saveLabel="Save provider settings"/,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/provider-settings-page.tsx", import.meta.url),
      "utf-8",
    ),
    /clearLabel="Sign out"/,
  );
  assert.doesNotMatch(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/provider-settings-page.tsx", import.meta.url),
      "utf-8",
    ),
    /Update credentials/,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/provider-settings-page.tsx", import.meta.url),
      "utf-8",
    ),
    /PanelSection title="Provider dashboard preferences"|PanelSection title="Global app\/completion settings"/,
  );
  assert.doesNotMatch(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/provider-settings-page.tsx", import.meta.url),
      "utf-8",
    ),
    /Decky panel|Completion progress/,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/provider-settings-page.tsx", import.meta.url),
      "utf-8",
    ),
    /PanelSection title="Account"/,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/provider-settings-page.tsx", import.meta.url),
      "utf-8",
    ),
    /statusLabel="Account status"/,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/provider-settings-page.tsx", import.meta.url),
      "utf-8",
    ),
    /saveLabel="Save provider settings"/,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/provider-settings-page.tsx", import.meta.url),
      "utf-8",
    ),
    /clearLabel="Sign out"/,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/provider-settings-page.tsx", import.meta.url),
      "utf-8",
    ),
    /PanelSection title="Library achievement scan"/,
  );
  assert.doesNotMatch(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/provider-settings-page.tsx", import.meta.url),
      "utf-8",
    ),
    /Account and preferences/,
  );
  assert.doesNotMatch(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/provider-settings-page.tsx", import.meta.url),
      "utf-8",
    ),
    /Library achievement scan/,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/credentials-form.tsx", import.meta.url),
      "utf-8",
    ),
    /Provider dashboard preferences/,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /PanelSection title="Account"/,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /saveLabel="Save provider settings"/,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /PanelSection title="Account"/,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /saveLabel="Save provider settings"/,
  );
  const retroAchievementsCredentialsFormSource = readFileSync(
    new URL("../src/platform/decky/providers/retroachievements/credentials-form.tsx", import.meta.url),
    "utf-8",
  );
  const steamCredentialsFormSource = readFileSync(
    new URL("../src/platform/decky/providers/steam/credentials-form.tsx", import.meta.url),
    "utf-8",
  );
  const retroAchievementsProviderSettingsSource = readFileSync(
    new URL("../src/platform/decky/providers/retroachievements/provider-settings-page.tsx", import.meta.url),
    "utf-8",
  );
  assert.ok(
    steamCredentialsFormSource.indexOf('label="Save provider settings"') <
      steamCredentialsFormSource.indexOf('label="Recent Achievements count"'),
  );
  assert.ok(
    steamCredentialsFormSource.indexOf('label={clearLabel ?? "Sign out"}') <
      steamCredentialsFormSource.indexOf('label="Recent Achievements count"'),
  );
  assert.ok(
    retroAchievementsCredentialsFormSource.indexOf('label={clearLabel ?? "Sign out"}') <
      retroAchievementsProviderSettingsSource.indexOf('label="Recent Achievements count"'),
  );
  assert.ok(
    retroAchievementsProviderSettingsSource.indexOf('label="Save provider settings"') <
      retroAchievementsProviderSettingsSource.indexOf('label="Recent Achievements count"'),
  );
  assert.match(getDeckyFullscreenActionStylesCss(), new RegExp(`\\.${DECKY_FULLSCREEN_ACTION_ROW_CLASS}`));
  assert.match(
    getDeckyFullscreenActionStylesCss(),
    new RegExp(`\\.${DECKY_FULLSCREEN_ACTION_ROW_CENTERED_CLASS}`),
  );
  assert.match(
    getDeckyFullscreenActionStylesCss(),
    new RegExp(`\\.Panel\\.Focusable\\.gpfocuswithin:has\\(\\.${DECKY_FULLSCREEN_CHIP_CLASS}\\)`),
  );
  assert.match(
    getDeckyFullscreenActionStylesCss(),
    /achievement-companion-fullscreen-chip\.DialogButton|button\.achievement-companion-fullscreen-chip\.DialogButton/,
  );
  assert.match(getDeckyFullscreenActionStylesCss(), /border-radius:\s*999px\s*!important/);
  assert.match(
    getDeckyFullscreenActionStylesCss(),
    new RegExp(`\\.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} > div::after`),
  );
  assert.match(
    getDeckyFullscreenActionStylesCss(),
    new RegExp(`\\.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} > div:focus-within \\.${DECKY_FULLSCREEN_CHIP_CLASS}`),
  );
  assert.match(
    getDeckyFocusStylesCss(),
    /achievement-companion-focus-pill\.Panel\.Focusable\[role="button"\]/,
  );
  assert.match(
    getDeckyFocusStylesCss(),
    /achievement-companion-focus-pill\.Panel\.Focusable\[role="button"\]\.achievement-companion-focus-pill--focused/,
  );
  assert.match(
    getDeckyFocusStylesCss(),
    /achievement-companion-focus-pill\.Panel\.Focusable\[role="button"\]:focus-within/,
  );
  assert.match(
    getDeckyFocusStylesCss(),
    /achievement-companion-focus-pill\.Panel\.Focusable\[role="button"\]::after/,
  );
  assert.match(
    getDeckyFocusStylesCss(),
    new RegExp(`\\.${DECKY_ACHIEVEMENT_FILTER_GROUP_CLASS}`),
  );
  assert.match(
    getDeckyFocusStylesCss(),
    new RegExp(`\\.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS}`),
  );
  assert.match(
    getDeckyFocusStylesCss(),
    new RegExp(`\\.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS}\\.${DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS}`),
  );
  assert.match(
    getDeckyFocusStylesCss(),
    new RegExp(`\\.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS}\\.${DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS}`),
  );
  assert.match(
    getDeckyFocusStylesCss(),
    new RegExp(`\\.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS}:focus`),
  );
  assert.match(
    getDeckyFocusStylesCss(),
    new RegExp(`\\.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS}:focus-within`),
  );
  assert.doesNotMatch(getDeckyFocusStylesCss(), /\.Panel\.Focusable\s*\{/);
  const achievementDetailViewSource = readFileSync(
    "src/platform/decky/decky-game-detail-view.tsx",
    "utf8",
  );
  assert.match(
    achievementDetailViewSource,
    /role="radiogroup" aria-label="Achievement filter" className={DECKY_ACHIEVEMENT_FILTER_GROUP_CLASS}/,
  );
  assert.match(achievementDetailViewSource, /role="radio"/);
  assert.match(achievementDetailViewSource, /aria-checked={active}/);
  assert.match(achievementDetailViewSource, /DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS/);
  assert.match(achievementDetailViewSource, /DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS/);
  assert.match(
    readFileSync("src/platform/decky/decky-compact-pill-action-item.tsx", "utf8"),
    /readonly emphasis\?: "default" \| "primary"/,
  );
  assert.match(
    readFileSync("src/platform/decky/decky-compact-pill-action-item.tsx", "utf8"),
    /const isPrimary = emphasis === "primary"/,
  );
  const dashboardViewSource = readFileSync("src/platform/decky/decky-dashboard-view.tsx", "utf8");
  assert.match(dashboardViewSource, /label="Open full-screen"/);
  assert.match(dashboardViewSource, /emphasis="primary"/);
  assert.match(
    dashboardViewSource,
    /label="Open full-screen"[\s\S]*label="Back"[\s\S]*label="Refresh"[\s\S]*label="Settings"/,
  );
  assert.match(dashboardViewSource, /onOpenProfile\(profile\.providerId\)/);
  assert.match(
    readFileSync("src/platform/decky/decky-full-screen-action-controls.tsx", "utf8"),
    /<DeckyFullscreenActionStyles\s*\/>/,
  );
  assert.match(
    readFileSync("src/platform/decky/decky-full-screen-action-controls.tsx", "utf8"),
    /data-achievement-companion-fullscreen-action-styles="true"/,
  );
  assert.match(
    readFileSync("src/platform/decky/providers/retroachievements/credentials-form.tsx", "utf8"),
    /bIsPassword=\{apiKeyInputDescriptor\.bIsPassword\}/,
  );
  assert.match(
    readFileSync("src/platform/decky/providers/retroachievements/credentials-form.tsx", "utf8"),
    /getDeckyCredentialTextFieldMaskStyle\(\)/,
  );
  assert.match(
    readFileSync("src/platform/decky/decky-credential-text-field.tsx", "utf8"),
    /WebkitTextSecurity:\s*"disc"/,
  );
  assert.match(
    readFileSync("src/platform/decky/providers/steam/credentials-form.tsx", "utf8"),
    /bIsPassword=\{apiKeyInputDescriptor\.bIsPassword\}/,
  );
  assert.match(
    readFileSync("src/platform/decky/providers/steam/credentials-form.tsx", "utf8"),
    /getDeckyCredentialTextFieldMaskStyle\(\)/,
  );
  assert.match(
    readFileSync("src/platform/decky/decky-credential-text-field.tsx", "utf8"),
    /WebkitTextSecurity:\s*"disc"/,
  );
  assert.doesNotMatch(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /selected={provider\.connected}/,
  );
  const compactDashboardSource = readFileSync("src/platform/decky/decky-dashboard-view.tsx", "utf8");
  const compactBootstrapSource = readFileSync("src/platform/decky/bootstrap.tsx", "utf8");
  assert.match(compactBootstrapSource, /useDeckySteamLibraryAchievementScanOverview\(providerId\)/u);
  assert.doesNotMatch(compactBootstrapSource, /useDeckySteamLibraryAchievementScanSummary\(providerId\)/u);
  assert.match(compactBootstrapSource, /createDeckySteamLibraryScanDependencies\(\)/u);
  assert.match(compactBootstrapSource, /runAndCacheDeckySteamLibraryAchievementScan/);
  assert.match(compactBootstrapSource, /Scan full Steam library/u);
  assert.match(compactBootstrapSource, /No full-library scan yet/u);
  assert.match(compactBootstrapSource, /Scanning library… this can take a few minutes/u);
  assert.match(compactDashboardSource, /steamLibraryScanAction\.label/u);
  assert.match(compactDashboardSource, /profile\.providerId === STEAM_PROVIDER_ID && steamLibraryScanAction !== undefined/u);
  assert.doesNotMatch(compactDashboardSource, /Library scan updated \$\{steamLibraryScanUpdatedLabel\}/u);
  assert.doesNotMatch(compactDashboardSource, /useDeckySteamLibraryAchievementScanSummary\(providerId\)/u);
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /fullscreenReturnContext/,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /createDeckyFullscreenReturnContextForProviderDashboard/,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /createDeckyFullscreenReturnContextForGame/,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /restoreDeckyFullscreenSelectionFromContext/,
  );
  assert.match(
    readFileSync("src/platform/decky/decky-full-screen-action-controls.tsx", "utf8"),
    /markDeckyFullscreenReturnRequested/,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /fullscreenReturnContext/,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /createDeckyFullscreenReturnContextForProviderDashboard/,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /createDeckyFullscreenReturnContextForGame/,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /statusLabel={provider\.connected \? "Connected" : undefined}/,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /<DeckyFocusStyles\s*\/>/,
  );

  assert.deepStrictEqual(getRetroAchievementsCredentialsFieldSpecs(), {
    username: {
      label: "Username",
      description: "Use your RetroAchievements username.",
      isPassword: false,
    },
    apiKey: {
      label: "API key",
      description: "Paste your RetroAchievements Web API Key.",
      isPassword: true,
    },
  });

  assert.deepStrictEqual(getSteamCredentialsFieldSpecs(), {
    steamId64: {
      label: "SteamID64",
      description: "Enter the SteamID64 for the account you want to browse.",
      isPassword: false,
    },
    apiKey: {
      label: "Web API key",
      description: "Paste your Steam Web API key.",
      isPassword: true,
    },
    language: {
      label: "Language",
      description: "Use the Steam achievement language code, usually english.",
    },
  });

  assert.deepStrictEqual(getRetroAchievementsApiKeyInputDescriptor(true), {
    ariaLabel: "RetroAchievements Web API key",
    autoCapitalize: "none",
    autoComplete: "off",
    autoCorrect: "off",
    inputMode: "text",
    spellCheck: false,
    bIsPassword: true,
    description: "API key configured. Enter a new key to replace it.",
  });
  assert.deepStrictEqual(getRetroAchievementsApiKeyInputDescriptor(false), {
    ariaLabel: "RetroAchievements Web API key",
    autoCapitalize: "none",
    autoComplete: "off",
    autoCorrect: "off",
    inputMode: "text",
    spellCheck: false,
    bIsPassword: true,
    description: "Enter your RetroAchievements API key.",
  });
  assert.deepStrictEqual(
    buildRetroAchievementsCredentialsFormModel(
      { username: "alice", hasApiKey: true },
      "alice",
      "",
    ),
    {
      usernameValue: "alice",
      usernameDescription: "Use your RetroAchievements username.",
      apiKeyValue: "",
      apiKeyIsPassword: true,
      apiKeyDescription: "API key configured. Enter a new key to replace it.",
      hasSavedApiKey: true,
    },
  );
  assert.equal(resolveRetroAchievementsApiKeyForSave("secret"), "secret");
  assert.equal(resolveRetroAchievementsApiKeyForSave(" new-secret "), "new-secret");
  assert.equal(resolveRetroAchievementsApiKeyForSave(""), undefined);

  assert.deepStrictEqual(getSteamApiKeyInputDescriptor(true), {
    ariaLabel: "Steam Web API key",
    autoCapitalize: "none",
    autoComplete: "off",
    autoCorrect: "off",
    inputMode: "text",
    spellCheck: false,
    bIsPassword: true,
    description: "API key configured. Enter a new key to replace it.",
  });
  assert.deepStrictEqual(getSteamApiKeyInputDescriptor(false), {
    ariaLabel: "Steam Web API key",
    autoCapitalize: "none",
    autoComplete: "off",
    autoCorrect: "off",
    inputMode: "text",
    spellCheck: false,
    bIsPassword: true,
    description: "Enter your Steam Web API key.",
  });
  assert.deepStrictEqual(
    buildSteamCredentialsFormModel(
      { steamId64: "12345678901234567", hasApiKey: true, language: "english" },
      "12345678901234567",
      "",
      "english",
    ),
    {
      steamId64Value: "12345678901234567",
      steamId64Description: "Enter the SteamID64 for the account you want to browse.",
      apiKeyValue: "",
      apiKeyIsPassword: true,
      apiKeyDescription: "API key configured. Enter a new key to replace it.",
      languageValue: "english",
      hasSavedApiKey: true,
    },
  );
  assert.equal(resolveSteamApiKeyForSave("secret"), "secret");
  assert.equal(resolveSteamApiKeyForSave(" new-secret "), "new-secret");
  assert.equal(resolveSteamApiKeyForSave(""), undefined);
});

test("retroachievements profile exposes points, games beaten, and retroratio metrics", async () => {
  const provider = createRetroAchievementsProvider({
    client: {
      async loadProfile() {
        return {
          User: "Alice",
          ULID: "abc123",
          TotalPoints: 100,
          TotalSoftcorePoints: 25,
          TotalTruePoints: 250,
        };
      },

      async loadCompletionProgress() {
        return [
          {
            GameID: 1,
            Title: "Beaten One",
            NumAwarded: 5,
            MaxPossible: 5,
            HighestAwardKind: "beaten",
          },
          {
            GameID: 2,
            Title: "Beaten Two",
            NumAwarded: 0,
            MaxPossible: 0,
            HighestAwardKind: "beaten-hardcore",
          },
          {
            GameID: 3,
            Title: "Unfinished",
            NumAwarded: 2,
            MaxPossible: 10,
          },
        ] satisfies readonly RawRetroAchievementsCompletionProgressEntry[];
      },

      async loadAchievementsEarnedBetween() {
        return [];
      },

      async loadRecentUnlocks() {
        return [];
      },

      async loadRecentlyPlayedGames() {
        return [];
      },

      async loadGameProgress() {
        throw new Error("not used");
      },
    },
  });

  const profile = await provider.loadProfile({
    username: "alice",
    apiKey: "secret",
  });

  assert.equal(
    profile.metrics.find((metric) => metric.key === "total-points")?.value,
    "100",
  );
  assert.equal(
    profile.metrics.find((metric) => metric.key === "games-beaten")?.value,
    "2",
  );
  assert.equal(
    profile.metrics.find((metric) => metric.key === "retro-ratio")?.value,
    "2.50",
  );
  assert.deepStrictEqual(
    buildProviderOverviewStats(profile).map((stat) => stat.label),
    ["Points", "Achievements Unlocked", "Games Beaten", "Unlock rate"],
  );
});

test("retroachievements completion progress normalizes beaten and mastered status", () => {
  const games = normalizeRetroAchievementsCompletionProgressGames([
    {
      GameID: 1,
      Title: "Beaten Game",
      ConsoleName: "NES",
      MaxPossible: 5,
      NumAwarded: 3,
      HighestAwardKind: "beaten-hardcore",
    },
    {
      GameID: 2,
      Title: "Mastered Game",
      ConsoleName: "NES",
      MaxPossible: 5,
      NumAwarded: 5,
      HighestAwardKind: "mastered",
    },
    {
      GameID: 3,
      Title: "Completed Game",
      ConsoleName: "NES",
      MaxPossible: 10,
      NumAwarded: 9,
      HighestAwardKind: "completed-hardcore",
    },
  ] satisfies readonly RawRetroAchievementsCompletionProgressEntry[]);

  assert.equal(games.find((game) => game.title === "Beaten Game")?.status, "beaten");
  assert.equal(games.find((game) => game.title === "Mastered Game")?.status, "mastered");
  assert.equal(games.find((game) => game.title === "Completed Game")?.status, "completed");
});

test("retroachievements completion progress preserves parent game ids", () => {
  const games = normalizeRetroAchievementsCompletionProgressGames([
    {
      GameID: 1,
      Title: "Mega Man X",
      ConsoleName: "SNES",
      MaxPossible: 10,
      NumAwarded: 5,
      ParentGameID: null,
    },
    {
      GameID: 2,
      Title: "Mega Man X (Subset)",
      ConsoleName: "SNES",
      MaxPossible: 6,
      NumAwarded: 3,
      ParentGameID: 1,
    },
  ] satisfies readonly RawRetroAchievementsCompletionProgressEntry[]);

  assert.equal(games.find((game) => game.gameId === "1")?.parentGameId, undefined);
  assert.equal(games.find((game) => game.gameId === "2")?.parentGameId, "1");
});

test("completion progress groups explicit subsets under the parent game", () => {
  const groupedGames = groupCompletionProgressGames([
    {
      providerId: PROVIDER_ID,
      gameId: "base-game",
      title: "Mega Man X",
      platformLabel: "SNES",
      status: "in_progress",
      summary: {
        unlockedCount: 5,
        totalCount: 10,
        completionPercent: 50,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_900,
    },
    {
      providerId: PROVIDER_ID,
      gameId: "subset-a",
      title: "Mega Man X (Subset)",
      platformLabel: "SNES",
      parentGameId: "base-game",
      status: "in_progress",
      summary: {
        unlockedCount: 3,
        totalCount: 6,
        completionPercent: 50,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_800,
    },
    {
      providerId: PROVIDER_ID,
      gameId: "subset-b",
      title: "Mega Man X (Challenge Set)",
      platformLabel: "SNES",
      status: "beaten",
      summary: {
        unlockedCount: 6,
        totalCount: 6,
        completionPercent: 100,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_700,
    },
    {
      providerId: PROVIDER_ID,
      gameId: "other-game",
      title: "Donkey Kong Country",
      platformLabel: "SNES",
      status: "mastered",
      summary: {
        unlockedCount: 8,
        totalCount: 8,
        completionPercent: 100,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_600,
    },
  ]);

  const groupedMegaManX = groupedGames.find(
    (group) => group.representativeGame.title === "Mega Man X",
  );

  assert.equal(groupedGames.length, 2);
  assert.equal(groupedMegaManX?.games.length, 3);
  assert.equal(groupedMegaManX?.subsetGames.length, 2);
  assert.deepStrictEqual(
    groupedMegaManX?.subsetGames.map((game) => game.title),
    ["Mega Man X (Subset)", "Mega Man X (Challenge Set)"],
  );
});

const DOCUMENTED_GAME_PROGRESS_RESPONSE = {
  ID: 14402,
  Title: "Dragster",
  ConsoleName: "Atari 2600",
  ImageIcon: "/Images/026368.png",
  Publisher: "Activision",
  Developer: "David Crane",
  Genre: "Racing",
  Released: "1992-06-02 00:00:00",
  NumAchievements: 2,
  NumAwardedToUser: 1,
  NumAwardedToUserHardcore: 1,
  UserCompletion: "50.00%",
  UserCompletionHardcore: "50.00%",
  UserTotalPlaytime: 60,
  HighestAwardDate: "2024-04-23T21:28:49+00:00",
  Achievements: {
    "79434": {
      ID: 79434,
      NumAwarded: 366,
      NumAwardedHardcore: 274,
      Title: "Novice Dragster Driver 1",
      Description: "Complete your very first race in game 1.",
      Points: 1,
      TrueRatio: 1,
      Author: "Boldewin",
      AuthorULID: "00003EMFWR7XB8SDPEHB3K56ZQ",
      DateModified: "2019-08-01 19:03:46",
      DateCreated: "2019-07-31 18:49:57",
      BadgeName: "85541",
      DisplayOrder: 0,
      MemAddr: "f5c41fa0b5fa0d5fbb8a74c598f18582",
      Type: "progression",
      DateEarned: "2024-04-23 21:28:49",
      DateEarnedHardcore: "2024-04-23 21:28:49",
    },
    "79435": {
      ID: 79435,
      NumAwarded: 100,
      NumAwardedHardcore: 50,
      Title: "Another Test Achievement",
      Description: "Do something else.",
      Points: 2,
      TrueRatio: 2,
      Author: "Boldewin",
      AuthorULID: "00003EMFWR7XB8SDPEHB3K56ZQ",
      DateModified: "2019-08-01 19:03:46",
      DateCreated: "2019-07-31 18:49:57",
      BadgeName: "85542",
      DisplayOrder: 1,
      MemAddr: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      Type: "progression",
    },
  },
} satisfies RawRetroAchievementsGameProgressResponse;

function createRetroAchievementsGameDetailClient(
  response: RawRetroAchievementsGameProgressResponse,
  counts?: Pick<CallCounts, "gameProgress" | "achievementsEarnedBetween">,
): RetroAchievementsClient {
  return {
    async loadProfile() {
      return {
        User: "Alice",
      };
    },

    async loadCompletionProgress() {
      return [];
    },

    async loadAchievementsEarnedBetween() {
      if (counts !== undefined) {
        counts.achievementsEarnedBetween += 1;
      }

      return [];
    },

    async loadRecentUnlocks() {
      return [];
    },

    async loadRecentlyPlayedGames() {
      return [];
    },

    async loadGameProgress() {
      if (counts !== undefined) {
        counts.gameProgress += 1;
      }

      return response;
    },
  };
}

function createThrowingProvider(counts: CallCounts): AchievementProvider {
  return {
    id: PROVIDER_ID,
    capabilities: PROVIDER_CAPABILITIES,
    async loadProfile() {
      counts.profile += 1;
      throw new Error("dashboard refresh failed");
    },
    async loadCompletionProgress() {
      counts.completionProgress += 1;
      throw new Error("completion progress refresh failed");
    },
    async loadAchievementsEarnedBetween() {
      counts.achievementsEarnedBetween += 1;
      throw new Error("achievement history refresh failed");
    },
    async loadRecentUnlocks() {
      counts.recentUnlocks += 1;
      throw new Error("dashboard refresh failed");
    },
    async loadRecentlyPlayedGames() {
      counts.recentlyPlayedGames += 1;
      throw new Error("dashboard refresh failed");
    },
    async loadGameProgress(_config, _gameId) {
      counts.gameProgress += 1;
      throw new Error("game detail refresh failed");
    },
  };
}

function createSuccessfulProvider(counts: CallCounts): AchievementProvider {
  return {
    id: PROVIDER_ID,
    capabilities: PROVIDER_CAPABILITIES,
    async loadProfile() {
      counts.profile += 1;
      return DASHBOARD_REFRESH_PROFILE;
    },
    async loadCompletionProgress() {
      counts.completionProgress += 1;
      return [];
    },
    async loadAchievementsEarnedBetween() {
      counts.achievementsEarnedBetween += 1;
      return [];
    },
    async loadRecentUnlocks() {
      counts.recentUnlocks += 1;
      return DASHBOARD_REFRESH_RECENT_UNLOCKS;
    },
    async loadRecentlyPlayedGames() {
      counts.recentlyPlayedGames += 1;
      return DASHBOARD_REFRESH_RECENTLY_PLAYED_GAMES;
    },
    async loadGameProgress() {
      counts.gameProgress += 1;
      return createGameDetailSnapshot();
    },
  };
}

function createHarness(options: {
  readonly cacheEntries?: readonly CacheEntry<unknown>[];
  readonly providerConfig?: unknown | undefined;
  readonly providerFactory?: (counts: CallCounts) => AchievementProvider;
  readonly platform?: PlatformServices;
}) {
  const counts: CallCounts = {
    config: 0,
    profile: 0,
    completionProgress: 0,
    recentUnlocks: 0,
    achievementsEarnedBetween: 0,
    recentlyPlayedGames: 0,
    gameProgress: 0,
  };

  const provider = options.providerFactory?.(counts) ?? createThrowingProvider(counts);
  const { cacheStore, writes } = createMemoryCacheStore(options.cacheEntries);
  const loadProviderConfig = async (): Promise<unknown | undefined> => {
    counts.config += 1;
    return options.providerConfig;
  };

  return {
    counts,
    writes,
    appServices: createAppServices({
      providerRegistry: createProviderRegistry([provider]),
      platform: options.platform ?? PLATFORM,
      cacheStore,
      loadProviderConfig,
    }),
  };
}

test("dashboard cache hit returns cached state without calling refresh path", async () => {
  const now = Date.now();
  const cachedSnapshot = createDashboardSnapshot();
  const cacheKey = createProviderDashboardCacheKey(PROVIDER_ID);
  const { appServices, counts } = createHarness({
    cacheEntries: [
      createCacheEntry(cacheKey, cachedSnapshot, now - 1_000, now + 60_000),
    ],
  });

  const state = await appServices.dashboard.loadDashboard(PROVIDER_ID);

  assert.equal(state.status, "success");
  assert.equal(state.isStale, false);
  assert.equal(state.error, undefined);
  assert.deepStrictEqual(state.data, cachedSnapshot);
  assert.equal(counts.config, 0);
  assert.equal(counts.profile, 0);
  assert.equal(counts.recentUnlocks, 0);
  assert.equal(counts.recentlyPlayedGames, 0);
});

test("decky dashboard snapshot cache returns cached state immediately without backend refresh", async () => {
  await withMockDeckyStorage(async () => {
    const cachedSnapshot = createDashboardSnapshot();
    assert.ok(writeDeckyDashboardSnapshot(cachedSnapshot));

    setDeckyBackendCallImplementationForTests(async () => {
      throw new Error("backend should not be called for cached dashboard snapshot");
    });

    try {
      const state = await loadDeckyDashboardState(PROVIDER_ID);

      assert.equal(state.status, "stale");
      assert.equal(state.isStale, true);
      assert.equal(state.error, undefined);
      assert.deepStrictEqual(state.data, cachedSnapshot);

      const cachedEntry = readDeckyDashboardSnapshotCacheEntry(PROVIDER_ID);
      assert.deepStrictEqual(cachedEntry?.snapshot, cachedSnapshot);
      assert.equal(JSON.stringify(cachedEntry ?? {}).includes("apiKey"), false);
    } finally {
      setDeckyBackendCallImplementationForTests(deckyBackendTestCallImplementation);
      assert.equal(clearDeckyDashboardSnapshot(PROVIDER_ID), true);
    }
  });
});

test("decky steam scan overview is readable without parsing the full summary blob", async () => {
  await withMockDeckyStorage(async () => {
    const overview = {
      ownedGameCount: 123,
      scannedGameCount: 120,
      gamesWithAchievements: 80,
      unlockedAchievements: 300,
      totalAchievements: 500,
      perfectGames: 10,
      completionPercent: 60,
      scannedAt: new Date(1_700_000_000_000).toISOString(),
    };

    writeDeckyStorageText(
      "achievement-companion:decky:steam:library-achievement-scan-overview",
      JSON.stringify(overview),
    );
    writeDeckyStorageText(
      "achievement-companion:decky:steam:library-achievement-scan-summary",
      "{ not valid json",
    );

    const loadedOverview = readDeckySteamLibraryAchievementScanOverview("steam");

    assert.deepStrictEqual(loadedOverview, overview);
  });
});

test("decky dashboard refresh logging breadcrumbs are present in source", () => {
  const source = readFileSync("src/platform/decky/decky-app-services.ts", "utf8");
  assert.match(source, /Dashboard refresh started/);
  assert.match(source, /Dashboard refresh completed/);
  assert.match(source, /Dashboard refresh failed/);
  assert.match(source, /recordDeckyDiagnosticEvent/);
});

test("dashboard missing config returns auth error state", async () => {
  const { appServices, counts } = createHarness({
    providerConfig: undefined,
  });

  const state = await appServices.dashboard.loadDashboard(PROVIDER_ID);

  assert.equal(state.status, "error");
  assert.equal(state.error?.kind, "auth");
  assert.match(state.error?.userMessage ?? "", /provider settings are missing/i);
  assert.equal(state.isStale, false);
  assert.equal(state.data, undefined);
  assert.equal(counts.config, 1);
  assert.equal(counts.profile, 0);
  assert.equal(counts.recentUnlocks, 0);
  assert.equal(counts.recentlyPlayedGames, 0);
});

test("dashboard stale cached data is preserved when refresh fails", async () => {
  const now = Date.now();
  const cachedSnapshot = createDashboardSnapshot();
  const cacheKey = createProviderDashboardCacheKey(PROVIDER_ID);
  const { appServices, counts } = createHarness({
    cacheEntries: [
      createCacheEntry(cacheKey, cachedSnapshot, now - 60_000, now - 1),
    ],
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.dashboard.loadDashboard(PROVIDER_ID, {
    forceRefresh: true,
  });

  assert.equal(state.status, "stale");
  assert.equal(state.isStale, true);
  assert.deepStrictEqual(state.data, cachedSnapshot);
  assert.equal(state.error?.kind, "unknown");
  assert.match(state.error?.userMessage ?? "", /refresh dashboard data/i);
  assert.equal(counts.config, 1);
  assert.equal(counts.profile, 1);
  assert.equal(counts.recentUnlocks, 1);
  assert.equal(counts.recentlyPlayedGames, 1);
});

test("dashboard successful refresh writes normalized snapshot to cache", async () => {
  const { appServices, counts, writes } = createHarness({
    providerFactory: createSuccessfulProvider,
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.dashboard.loadDashboard(PROVIDER_ID);

  assert.equal(state.status, "success");
  assert.equal(state.isStale, false);
  assert.equal(state.error, undefined);
  assert.equal(counts.config, 1);
  assert.equal(counts.profile, 1);
  assert.equal(counts.recentUnlocks, 1);
  assert.equal(counts.recentlyPlayedGames, 1);
  assert.deepStrictEqual(state.data?.featuredGames, DASHBOARD_REFRESH_FEATURED_GAMES);
  assert.deepStrictEqual(state.data?.profile, DASHBOARD_REFRESH_PROFILE);
  assert.deepStrictEqual(state.data?.recentUnlocks, DASHBOARD_REFRESH_RECENT_UNLOCKS);
  assert.deepStrictEqual(state.data?.recentAchievements, DASHBOARD_REFRESH_RECENT_UNLOCKS);
  assert.deepStrictEqual(state.data?.recentlyPlayedGames, DASHBOARD_REFRESH_RECENTLY_PLAYED_GAMES);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.key, createProviderDashboardCacheKey(PROVIDER_ID));
  assert.equal(writes[0]?.version, CACHE_VERSION);
  assert.equal(writes[0]?.storedAt, state.lastUpdatedAt);
  assert.deepStrictEqual(writes[0]?.value, state.data);
});

test("dashboard force refresh updates the decky dashboard snapshot cache", async () => {
  await withMockDeckyStorage(async () => {
    const initialSnapshot = createDashboardSnapshot();
    assert.ok(writeDeckyDashboardSnapshot(initialSnapshot));

    resetDeckyBackendTestState();
    deckyBackendTestState.steam.config = {
      steamId64: "12345678901234567",
      hasApiKey: true,
      language: "english",
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
      includePlayedFreeGames: false,
    };
    deckyBackendTestState.steam.secret = "dummy-secret";

    setDeckyBackendCallImplementationForTests(deckyBackendTestCallImplementation);
    try {
      const state = await loadDeckyDashboardState("steam", {
        forceRefresh: true,
      });

      assert.equal(state.status, "success");
      assert.equal(state.isStale, false);
      assert.equal(state.data?.profile.providerId, "steam");

      const cachedEntry = readDeckyDashboardSnapshotCacheEntry("steam");
      assert.ok(cachedEntry !== undefined);
      assert.equal(cachedEntry?.providerId, "steam");
      assert.equal(cachedEntry?.snapshot.profile.providerId, "steam");
      assert.equal(JSON.stringify(cachedEntry ?? {}).includes("dummy-secret"), false);
    } finally {
      setDeckyBackendCallImplementationForTests(deckyBackendTestCallImplementation);
      resetDeckyBackendTestState();
      assert.equal(clearDeckyDashboardSnapshot("steam"), true);
    }
  });
});

test("dashboard recent achievements and recently played games populate from provider data", async () => {
  const { appServices, counts } = createHarness({
    providerFactory: (callCounts) => ({
      id: PROVIDER_ID,
      capabilities: PROVIDER_CAPABILITIES,
      async loadProfile() {
        callCounts.profile += 1;
        return DASHBOARD_REFRESH_PROFILE;
      },
      async loadRecentUnlocks() {
        callCounts.recentUnlocks += 1;
        return DASHBOARD_REFRESH_RECENT_UNLOCKS;
      },
      async loadRecentlyPlayedGames() {
        callCounts.recentlyPlayedGames += 1;
        return DASHBOARD_REFRESH_RECENTLY_PLAYED_GAMES;
      },
      async loadGameProgress() {
        callCounts.gameProgress += 1;
        return createGameDetailSnapshot();
      },
    }),
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.dashboard.loadDashboard(PROVIDER_ID);

  assert.equal(state.status, "success");
  assert.equal(state.error, undefined);
  assert.deepStrictEqual(state.data?.recentAchievements, DASHBOARD_REFRESH_RECENT_UNLOCKS);
  assert.deepStrictEqual(state.data?.recentlyPlayedGames, DASHBOARD_REFRESH_RECENTLY_PLAYED_GAMES);
  assert.equal(counts.config, 1);
  assert.equal(counts.profile, 1);
  assert.equal(counts.recentUnlocks, 1);
  assert.equal(counts.recentlyPlayedGames, 1);
});

test("dashboard honors decky settings counts for recent achievements and recently played games", async () => {
  const settingsStore = createMemoryKeyValueStore({
    [ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY]: JSON.stringify({
      recentAchievementsCount: 3,
      recentlyPlayedCount: 7,
      showCompletionProgressSubsets: false,
      defaultCompletionProgressFilter: "beaten",
    }),
  });

  const provider = {
    id: PROVIDER_ID,
    capabilities: PROVIDER_CAPABILITIES,
    async loadProfile() {
      return DASHBOARD_REFRESH_PROFILE;
    },
    async loadRecentUnlocks(_config: unknown, options?: { readonly limit?: number }) {
      assert.equal(options?.limit, 3);
      return Array.from({ length: 8 }, (_value, index) => createRecentUnlock(index + 1));
    },
    async loadRecentlyPlayedGames(_config: unknown, options?: { readonly count?: number }) {
      assert.equal(options?.count, 7);
      return Array.from({ length: 8 }, (_value, index) => ({
        providerId: PROVIDER_ID,
        gameId: `game-${index + 1}`,
        title: `Game ${index + 1}`,
        summary: {
          unlockedCount: index + 1,
        },
        lastPlayedAt: 1_700_000_000_000 + index * 1_000,
      }));
    },
    async loadCompletionProgress() {
      return [];
    },
    async loadAchievementsEarnedBetween() {
      return [];
    },
    async loadGameProgress() {
      return createGameDetailSnapshot();
    },
  } satisfies AchievementProvider;

  const { appServices } = createHarness({
    providerFactory: () => provider,
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
    platform: {
      ...PLATFORM,
      settingsStore,
    },
  });

  const state = await appServices.dashboard.loadDashboard(PROVIDER_ID);

  assert.equal(state.status, "success");
  assert.equal(state.data?.recentAchievements.length, 8);
  assert.equal(state.data?.recentUnlocks.length, 8);
  assert.equal(state.data?.recentlyPlayedGames.length, 8);
});

test("dashboard reentry retries stale, error, and mismatched provider states", () => {
  const matchingSnapshot = createDashboardSnapshot();
  const mismatchedSnapshot = {
    ...createDashboardSnapshot(),
    profile: {
      ...createDashboardSnapshot().profile,
      providerId: "steam",
    },
  };

  const retryableErrorState: ResourceState<DashboardSnapshot> = {
    status: "error",
    error: {
      kind: "network",
      userMessage: "Failed to fetch",
      retryable: true,
      providerId: PROVIDER_ID,
      debugMessage: "Failed to fetch",
    },
    isStale: false,
    isRefreshing: false,
  };
  const staleState: ResourceState<DashboardSnapshot> = {
    status: "stale",
    data: matchingSnapshot,
    lastUpdatedAt: 1_700_000_000_000,
    isStale: true,
    isRefreshing: false,
  };
  const mismatchedState: ResourceState<DashboardSnapshot> = {
    status: "success",
    data: mismatchedSnapshot,
    lastUpdatedAt: 1_700_000_000_000,
    isStale: false,
    isRefreshing: false,
  };
  const matchingState: ResourceState<DashboardSnapshot> = {
    status: "success",
    data: matchingSnapshot,
    lastUpdatedAt: 1_700_000_000_000,
    isStale: false,
    isRefreshing: false,
  };

  assert.equal(
    shouldRefreshDashboardOnEntry({
      providerId: PROVIDER_ID,
      state: retryableErrorState,
    }),
    true,
  );
  assert.equal(
    shouldRefreshDashboardOnEntry({
      providerId: PROVIDER_ID,
      state: staleState,
    }),
    true,
  );
  assert.equal(
    shouldRefreshDashboardOnEntry({
      providerId: PROVIDER_ID,
      state: mismatchedState,
    }),
    true,
  );
  assert.equal(
    shouldRefreshDashboardOnEntry({
      providerId: PROVIDER_ID,
      state: matchingState,
    }),
    false,
  );
});

test("achievement history service loads newest-first earned-between history and caches it", async () => {
  const { appServices, counts, writes } = createHarness({
    providerFactory: () => ({
      id: PROVIDER_ID,
      capabilities: PROVIDER_CAPABILITIES,
      async loadProfile() {
        counts.profile += 1;
        return {
          ...DASHBOARD_REFRESH_PROFILE,
          metrics: [
            ...DASHBOARD_REFRESH_PROFILE.metrics,
            {
              key: "member-since",
              label: "Member Since",
              value: "2020-01-02 00:00:00",
            },
          ],
        };
      },
      async loadCompletionProgress() {
        counts.completionProgress += 1;
        return [];
      },
      async loadAchievementsEarnedBetween(_config, options) {
        counts.achievementsEarnedBetween += 1;
        assert.equal(options.fromEpochSeconds, Math.trunc(Date.parse("2020-01-02 00:00:00") / 1000));
        return [
          createRecentUnlockForGame("game-1", "Test Game", 1, 1_700_000_000_100),
          createRecentUnlockForGame("game-2", "Second Game", 1, 1_700_000_000_300),
          createRecentUnlockForGame("game-1", "Test Game", 2, 1_700_000_000_200),
        ];
      },
      async loadRecentUnlocks() {
        counts.recentUnlocks += 1;
        return [];
      },
      async loadRecentlyPlayedGames() {
        counts.recentlyPlayedGames += 1;
        return [];
      },
      async loadGameProgress() {
        counts.gameProgress += 1;
        return createGameDetailSnapshot();
      },
    }),
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.achievementHistory.loadAchievementHistory(PROVIDER_ID, {
    forceRefresh: true,
  });
  const cachedState = await appServices.achievementHistory.loadAchievementHistory(PROVIDER_ID);

  assert.equal(state.status, "success");
  assert.equal(state.error, undefined);
  assert.deepStrictEqual(state.data?.entries.map((entry) => entry.achievement.achievementId), [
    "game-2-ach-1",
    "game-1-ach-2",
    "game-1-ach-1",
  ]);
  assert.equal(state.data?.summary.unlockedCount, 3);
  assert.match(state.data?.sourceLabel ?? "", /Member since/i);
  assert.equal(counts.config, 1);
  assert.equal(counts.profile, 1);
  assert.equal(counts.achievementsEarnedBetween, 1);
  assert.equal(counts.recentUnlocks, 0);
  assert.equal(cachedState.status, "success");
  assert.deepStrictEqual(cachedState.data?.entries.map((entry) => entry.achievement.achievementId), [
    "game-2-ach-1",
    "game-1-ach-2",
    "game-1-ach-1",
  ]);
  assert.equal(counts.config, 1);
  assert.equal(counts.profile, 1);
  assert.equal(counts.achievementsEarnedBetween, 1);
  assert.equal(counts.recentUnlocks, 0);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.key, createProviderAchievementHistoryCacheKey(PROVIDER_ID));
});

test("completion progress service exposes played, unfinished, beaten, and mastered counts", async () => {
  const { appServices, counts, writes } = createHarness({
    providerFactory: (callCounts) => ({
      id: PROVIDER_ID,
      capabilities: PROVIDER_CAPABILITIES,
      async loadProfile() {
        callCounts.profile += 1;
        return DASHBOARD_REFRESH_PROFILE;
      },
      async loadCompletionProgress() {
        callCounts.completionProgress += 1;
        return [
          {
            providerId: PROVIDER_ID,
            gameId: "unfinished-game",
            title: "Unfinished Game",
            status: "in_progress",
            summary: {
              unlockedCount: 3,
              totalCount: 10,
              completionPercent: 30,
            },
            metrics: [],
          },
          {
            providerId: PROVIDER_ID,
            gameId: "completed-game",
            title: "Completed Game",
            status: "completed",
            summary: {
              unlockedCount: 9,
              totalCount: 10,
              completionPercent: 90,
            },
            metrics: [],
          },
          {
            providerId: PROVIDER_ID,
            gameId: "beaten-game",
            title: "Beaten Game",
            status: "beaten",
            summary: {
              unlockedCount: 10,
              totalCount: 10,
              completionPercent: 100,
            },
            metrics: [],
          },
          {
            providerId: PROVIDER_ID,
            gameId: "mastered-game",
            title: "Mastered Game",
            status: "mastered",
            summary: {
              unlockedCount: 12,
              totalCount: 12,
              completionPercent: 100,
            },
            metrics: [],
          },
        ] satisfies readonly NormalizedGame[];
      },
      async loadRecentUnlocks() {
        callCounts.recentUnlocks += 1;
        return DASHBOARD_REFRESH_RECENT_UNLOCKS;
      },
      async loadRecentlyPlayedGames() {
        callCounts.recentlyPlayedGames += 1;
        return DASHBOARD_REFRESH_RECENTLY_PLAYED_GAMES;
      },
      async loadGameProgress() {
        callCounts.gameProgress += 1;
        return createGameDetailSnapshot();
      },
    }),
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.completionProgress.loadCompletionProgress(PROVIDER_ID);

  assert.equal(state.status, "success");
  assert.equal(state.error, undefined);
  assert.deepStrictEqual(state.data?.summary, {
    playedCount: 4,
    unfinishedCount: 1,
    beatenCount: 1,
    masteredCount: 1,
  });
  assert.deepStrictEqual(state.data?.games.map((game) => game.status), [
    "in_progress",
    "completed",
    "beaten",
    "mastered",
  ]);
  assert.equal(counts.config, 1);
  assert.equal(counts.completionProgress, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.key, createProviderCompletionProgressCacheKey(PROVIDER_ID));
  assert.equal(writes[0]?.version, CACHE_VERSION);
  assert.equal(writes[0]?.storedAt, state.lastUpdatedAt);
  assert.deepStrictEqual(writes[0]?.value, state.data);
});

test("decky recent achievements persist the last ten observed unlocks", async () => {
  await withMockDeckyStorage(async () => {
    const seededSnapshot = createDashboardSnapshotWithRecentAchievements(
      [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(createRecentUnlock),
    );

    const seededState = applyDeckyRecentAchievementHistory(seededSnapshot);
    assert.deepStrictEqual(
      seededState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      ["ach-10", "ach-9", "ach-8", "ach-7", "ach-6", "ach-5", "ach-4", "ach-3", "ach-2", "ach-1"],
    );

    const emptyWindowState = applyDeckyRecentAchievementHistory(
      createDashboardSnapshotWithRecentAchievements([]),
    );
    assert.deepStrictEqual(
      emptyWindowState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      ["ach-10", "ach-9", "ach-8", "ach-7", "ach-6", "ach-5", "ach-4", "ach-3", "ach-2", "ach-1"],
    );

    const rolledState = applyDeckyRecentAchievementHistory(
      createDashboardSnapshotWithRecentAchievements([11].map(createRecentUnlock)),
    );
    assert.deepStrictEqual(
      rolledState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      ["ach-11", "ach-10", "ach-9", "ach-8", "ach-7", "ach-6", "ach-5", "ach-4", "ach-3", "ach-2"],
    );
  });
});

test("decky recent achievements rank newer live entries ahead of stale cached history", async () => {
  await withMockDeckyStorage(async () => {
    const cachedSnapshot = createDashboardSnapshotWithRecentAchievements(
      [5, 4, 3, 2, 1].map(createRecentUnlock),
    );
    applyDeckyRecentAchievementHistory(cachedSnapshot);

    const rankedState = await buildDeckyRecentAchievementHistory({
      provider: undefined,
      providerConfig: undefined,
      snapshot: createDashboardSnapshotWithRecentAchievements(
        [101, 100].map(createRecentUnlock),
      ),
    });

    assert.deepStrictEqual(
      rankedState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      ["ach-101", "ach-100", "ach-5", "ach-4", "ach-3", "ach-2", "ach-1"],
    );
  });
});

test("decky recent achievements fill remaining slots with fallback entries up to ten", async () => {
  await withMockDeckyStorage(async () => {
    const cachedSnapshot = createDashboardSnapshotWithRecentAchievements([
      createRecentUnlockWithoutTimestamp(1),
      createRecentUnlockWithoutTimestamp(2),
      createRecentUnlockWithoutTimestamp(3),
    ]);
    applyDeckyRecentAchievementHistory(cachedSnapshot);

    const rankedState = await buildDeckyRecentAchievementHistory({
      provider: undefined,
      providerConfig: undefined,
      snapshot: createDashboardSnapshotWithRecentAchievements(
        [10, 9, 8, 7, 6].map(createRecentUnlock),
      ),
    });

    assert.deepStrictEqual(
      rankedState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      ["ach-10", "ach-9", "ach-8", "ach-7", "ach-6", "ach-1", "ach-2", "ach-3"],
    );
  });
});

test("decky recent achievements keep missing timestamps behind trusted ones", async () => {
  await withMockDeckyStorage(async () => {
    const cachedSnapshot = createDashboardSnapshotWithRecentAchievements([
      createRecentUnlockWithoutTimestamp(1),
      createRecentUnlock(2),
    ]);
    applyDeckyRecentAchievementHistory(cachedSnapshot);

    const rankedState = await buildDeckyRecentAchievementHistory({
      provider: undefined,
      providerConfig: undefined,
      snapshot: createDashboardSnapshotWithRecentAchievements([100].map(createRecentUnlock)),
    });

    assert.deepStrictEqual(
      rankedState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      ["ach-100", "ach-2", "ach-1"],
    );
  });
});

test("decky recent achievements backfill from completion progress without dates", async () => {
  await withMockDeckyStorage(async () => {
    let completionProgressCalls = 0;
    let gameProgressCalls = 0;

    const state = await buildDeckyRecentAchievementHistory({
      provider: {
        async loadCompletionProgress() {
          completionProgressCalls += 1;
          return createBackfillCompletionProgressWithoutDates();
        },
        async loadGameProgress(_config, gameId) {
          gameProgressCalls += 1;
          if (gameId === "game-a") {
            return createBackfillGameDetail("game-a", "Game A", [
              1_700_000_000_500,
              1_700_000_000_400,
              1_700_000_000_300,
            ]);
          }

          return createBackfillGameDetail("game-b", "Game B", [
            1_700_000_000_200,
            1_700_000_000_100,
          ]);
        },
      },
      providerConfig: {
        username: "alice",
        apiKey: "secret",
      },
      snapshot: createDashboardSnapshotWithRecentAchievements([]),
    });

    assert.deepStrictEqual(
      state.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      ["game-a-ach-1", "game-a-ach-2", "game-a-ach-3", "game-b-ach-1", "game-b-ach-2"],
    );
    assert.equal(completionProgressCalls, 1);
    assert.equal(gameProgressCalls, 2);
  });
});

test("decky recent achievements discover missing games from recently played history", async () => {
  await withMockDeckyStorage(async () => {
    let completionProgressCalls = 0;
    let recentlyPlayedCalls = 0;
    let gameProgressCalls = 0;

    const state = await buildDeckyRecentAchievementHistory({
      provider: {
        async loadCompletionProgress() {
          completionProgressCalls += 1;
          return createBackfillCompletionProgressWithoutDates();
        },
        async loadRecentlyPlayedGames() {
          recentlyPlayedCalls += 1;
          return [
            createBackfillRecentlyPlayedGame(
              "game-dkc",
              "Donkey Kong Country",
              5,
              1_700_000_000_900,
            ),
            createBackfillRecentlyPlayedGame("game-b", "Game B", 2, 1_700_000_000_200),
          ];
        },
        async loadGameProgress(_config, gameId) {
          gameProgressCalls += 1;
          if (gameId === "game-dkc") {
            return createBackfillGameDetail("game-dkc", "Donkey Kong Country", [
              1_700_000_000_900,
              1_700_000_000_800,
              1_700_000_000_700,
              1_700_000_000_600,
              1_700_000_000_500,
            ]);
          }

          if (gameId === "game-a") {
            return createBackfillGameDetail("game-a", "Game A", [
              1_699_000_000_400,
              1_699_000_000_300,
              1_699_000_000_200,
            ]);
          }

          return createBackfillGameDetail("game-b", "Game B", [
            1_699_000_000_100,
            1_699_000_000_000,
          ]);
        },
      },
      providerConfig: {
        username: "alice",
        apiKey: "secret",
      },
      snapshot: createDashboardSnapshotWithRecentAchievements([]),
    });

    assert.deepStrictEqual(
      state.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      [
        "game-dkc-ach-1",
        "game-dkc-ach-2",
        "game-dkc-ach-3",
        "game-dkc-ach-4",
        "game-dkc-ach-5",
        "game-a-ach-1",
        "game-a-ach-2",
        "game-a-ach-3",
        "game-b-ach-1",
        "game-b-ach-2",
      ],
    );
    assert.equal(completionProgressCalls, 1);
    assert.equal(recentlyPlayedCalls, 1);
    assert.equal(gameProgressCalls, 3);
  });
});

test("decky recent achievements prefer date-range history and stay stable across reopen", async () => {
  await withMockDeckyStorage(async () => {
    const dateRangeAchievements = [
      createRecentUnlockForGame("game-dkc", "Donkey Kong Country", 1, 1_900_000_000_900),
      createRecentUnlockForGame("game-dkc", "Donkey Kong Country", 2, 1_900_000_000_800),
      createRecentUnlockForGame("game-pokemon", "Pokémon Gold Version", 1, 1_900_000_000_700),
      createRecentUnlockForGame("game-pokemon", "Pokémon Gold Version", 2, 1_900_000_000_600),
      createRecentUnlockForGame("game-mario", "Super Mario World", 1, 1_900_000_000_500),
      createRecentUnlockForGame("game-mario", "Super Mario World", 2, 1_900_000_000_400),
    ];

    let completionProgressCalls = 0;
    let dateRangeCalls = 0;
    let gameProgressCalls = 0;

    const provider = {
      async loadCompletionProgress() {
        completionProgressCalls += 1;
        throw new Error("completion progress should not be needed when date-range history is sufficient");
      },
      async loadAchievementsEarnedBetween() {
        dateRangeCalls += 1;
        return dateRangeAchievements;
      },
      async loadGameProgress() {
        gameProgressCalls += 1;
        throw new Error("game progress should not be needed when date-range history is sufficient");
      },
    };
    const snapshotWithRecentAchievements = createDashboardSnapshotWithRecentAchievements([
      createRecentUnlockWithoutTimestamp(1),
      createRecentUnlockWithoutTimestamp(2),
      createRecentUnlockWithoutTimestamp(3),
    ]);
    const snapshot = {
      ...snapshotWithRecentAchievements,
      profile: {
        ...snapshotWithRecentAchievements.profile,
        metrics: [
          {
            key: "member-since",
            label: "Member Since",
            value: "2020-01-02 00:00:00",
          },
        ],
      },
    };

    const firstState = await buildDeckyRecentAchievementHistory({
      provider,
      providerConfig: {
        username: "alice",
        apiKey: "secret",
      },
      snapshot,
    });

    const secondState = await buildDeckyRecentAchievementHistory({
      provider,
      providerConfig: {
        username: "alice",
        apiKey: "secret",
      },
      snapshot,
    });

    assert.deepStrictEqual(
      firstState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      [
        "game-dkc-ach-1",
        "game-dkc-ach-2",
        "game-pokemon-ach-1",
        "game-pokemon-ach-2",
        "game-mario-ach-1",
        "game-mario-ach-2",
        "ach-1",
        "ach-2",
        "ach-3",
      ],
    );
    assert.deepStrictEqual(
      secondState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      [
        "game-dkc-ach-1",
        "game-dkc-ach-2",
        "game-pokemon-ach-1",
        "game-pokemon-ach-2",
        "game-mario-ach-1",
        "game-mario-ach-2",
        "ach-1",
        "ach-2",
        "ach-3",
      ],
    );
    assert.equal(completionProgressCalls, 2);
    assert.equal(dateRangeCalls, 2);
    assert.equal(gameProgressCalls, 0);
  });
});

test("decky overview recent achievements stay separate from persistent recent achievements", async () => {
  await withMockDeckyStorage(async () => {
    const persistentSnapshot = createDashboardSnapshotWithRecentAchievements([
      createRecentUnlock(1),
      createRecentUnlock(2),
      createRecentUnlock(3),
      createRecentUnlock(4),
      createRecentUnlock(5),
    ]);
    const snapshot = {
      ...persistentSnapshot,
      recentUnlocks: [createRecentUnlock(90), createRecentUnlock(91)],
    };

    const state = await buildDeckyRecentAchievementHistory({
      provider: undefined,
      providerConfig: undefined,
      snapshot,
    });

    assert.equal(state.recentAchievements.length, 5);
  });
});

test("decky recent achievements continue when one backfill game fails", async () => {
  await withMockDeckyStorage(async () => {
    const state = await buildDeckyRecentAchievementHistory({
      provider: {
        async loadCompletionProgress() {
          return createBackfillCompletionProgressWithoutDates();
        },
        async loadGameProgress(_config, gameId) {
          if (gameId === "game-a") {
            throw new Error("temporary backfill failure");
          }

          return createBackfillGameDetail("game-b", "Game B", [
            1_700_000_000_200,
            1_700_000_000_100,
          ]);
        },
      },
      providerConfig: {
        username: "alice",
        apiKey: "secret",
      },
      snapshot: createDashboardSnapshotWithRecentAchievements([]),
    });

    assert.deepStrictEqual(
      state.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      ["game-b-ach-1", "game-b-ach-2"],
    );
  });
});

test("decky recent achievements can be backfilled from completion progress", async () => {
  await withMockDeckyStorage(async () => {
    const provider = {
      async loadCompletionProgress() {
        return createBackfillCompletionProgress();
      },
      async loadGameProgress(_config: unknown, gameId: string) {
        if (gameId === "game-a") {
          return createBackfillGameDetail("game-a", "Game A", [
            1_700_000_000_500,
            1_700_000_000_400,
            1_700_000_000_300,
          ]);
        }

        return createBackfillGameDetail("game-b", "Game B", [
          1_700_000_000_250,
          1_700_000_000_200,
          1_700_000_000_150,
        ]);
      },
    };

    const backfilledState = await buildDeckyRecentAchievementHistory({
      provider,
      providerConfig: {
        username: "alice",
        apiKey: "secret",
      },
      snapshot: createDashboardSnapshotWithRecentAchievements([]),
    });

    assert.equal(backfilledState.recentAchievements.length, 6);
    assert.deepStrictEqual(
      backfilledState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      [
        "game-a-ach-1",
        "game-a-ach-2",
        "game-a-ach-3",
        "game-b-ach-1",
        "game-b-ach-2",
        "game-b-ach-3",
      ],
    );
  });
});

test("retroachievements recently played games normalize badge art urls and progress", () => {
  const rawRecentlyPlayedGames: readonly RawRetroAchievementsRecentlyPlayedGameResponse[] = [
    {
      GameID: 1234,
      Title: "Test Game",
      ConsoleName: "NES",
      ImageIcon: "/Images/000001.png",
      LastPlayed: "2024-01-01 00:00:00",
      AchievementsTotal: 20,
      NumAchieved: 5,
    },
  ];

  const recentlyPlayedGames = normalizeRetroAchievementsRecentlyPlayedGames(rawRecentlyPlayedGames);

  assert.equal(recentlyPlayedGames[0]?.coverImageUrl, "https://i.retroachievements.org/Images/000001.png");
  assert.equal(recentlyPlayedGames[0]?.summary.unlockedCount, 5);
  assert.equal(recentlyPlayedGames[0]?.summary.totalCount, 20);
  assert.equal(recentlyPlayedGames[0]?.summary.completionPercent, 25);
  assert.equal(recentlyPlayedGames[0]?.lastPlayedAt, Date.parse("2024-01-01T00:00:00Z"));
});

test("game detail parses the documented RetroAchievements game-progress shape", async () => {
  const { appServices, counts } = createHarness({
    providerFactory: (callCounts) =>
      createRetroAchievementsProvider({
        client: createRetroAchievementsGameDetailClient(DOCUMENTED_GAME_PROGRESS_RESPONSE, callCounts),
      }),
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.gameDetail.loadGameDetail(PROVIDER_ID, "14402", {
    forceRefresh: true,
  });

  assert.equal(state.status, "success");
  assert.equal(state.isStale, false);
  assert.equal(state.error, undefined);
  assert.equal(state.data?.game.gameId, "14402");
  assert.equal(state.data?.game.title, "Dragster");
  assert.equal(state.data?.game.summary.unlockedCount, 1);
  assert.equal(state.data?.game.summary.totalCount, 2);
  assert.equal(state.data?.game.summary.completionPercent, 50);
  assert.equal(state.data?.achievements[0]?.unlockedAt, Date.parse("2024-04-23T21:28:49Z"));
  assert.equal(state.data?.achievements.length, 2);
  assert.equal(state.data?.achievements[0]?.title, "Novice Dragster Driver 1");
  assert.equal(state.data?.achievements[0]?.isUnlocked, true);
  assert.equal(state.data?.achievements[1]?.title, "Another Test Achievement");
  assert.equal(state.data?.achievements[1]?.isUnlocked, false);
  assert.equal(counts.config, 1);
  assert.equal(counts.gameProgress, 1);
});

test("game detail surfaces an error when the documented shape is unusable", async () => {
  const { appServices, counts } = createHarness({
    providerFactory: (callCounts) =>
      createRetroAchievementsProvider({
        client: createRetroAchievementsGameDetailClient(
          {} as RawRetroAchievementsGameProgressResponse,
          callCounts,
        ),
      }),
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.gameDetail.loadGameDetail(PROVIDER_ID, "14402", {
    forceRefresh: true,
  });

  assert.equal(state.status, "error");
  assert.equal(state.error?.kind, "parse");
  assert.match(state.error?.userMessage ?? "", /unexpected response/i);
  assert.equal(state.data, undefined);
  assert.equal(counts.config, 1);
  assert.equal(counts.gameProgress, 1);
});

test("game detail cache hit returns cached state without calling refresh path", async () => {
  const now = Date.now();
  const cachedSnapshot = createGameDetailSnapshot();
  const cacheKey = createProviderGameDetailCacheKey(PROVIDER_ID, cachedSnapshot.game.gameId);
  const { appServices, counts } = createHarness({
    cacheEntries: [
      createCacheEntry(cacheKey, cachedSnapshot, now - 1_000, now + 60_000),
    ],
  });

  const state = await appServices.gameDetail.loadGameDetail(PROVIDER_ID, cachedSnapshot.game.gameId);

  assert.equal(state.status, "success");
  assert.equal(state.isStale, false);
  assert.equal(state.error, undefined);
  assert.deepStrictEqual(state.data, cachedSnapshot);
  assert.equal(counts.config, 0);
  assert.equal(counts.gameProgress, 0);
});

test("game detail missing config returns auth error state", async () => {
  const { appServices, counts } = createHarness({
    providerConfig: undefined,
  });

  const state = await appServices.gameDetail.loadGameDetail(PROVIDER_ID, "game-1");

  assert.equal(state.status, "error");
  assert.equal(state.error?.kind, "auth");
  assert.match(state.error?.userMessage ?? "", /provider settings are missing/i);
  assert.equal(state.isStale, false);
  assert.equal(state.data, undefined);
  assert.equal(counts.config, 1);
  assert.equal(counts.gameProgress, 0);
});

test("game detail stale cached data is preserved when refresh fails", async () => {
  const now = Date.now();
  const cachedSnapshot = createGameDetailSnapshot();
  const cacheKey = createProviderGameDetailCacheKey(PROVIDER_ID, cachedSnapshot.game.gameId);
  const { appServices, counts } = createHarness({
    cacheEntries: [
      createCacheEntry(cacheKey, cachedSnapshot, now - 60_000, now - 1),
    ],
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.gameDetail.loadGameDetail(PROVIDER_ID, cachedSnapshot.game.gameId, {
    forceRefresh: true,
  });

  assert.equal(state.status, "stale");
  assert.equal(state.isStale, true);
  assert.deepStrictEqual(state.data, cachedSnapshot);
  assert.equal(state.error?.kind, "unknown");
  assert.match(state.error?.userMessage ?? "", /refresh game detail data/i);
  assert.equal(counts.config, 1);
  assert.equal(counts.gameProgress, 1);
});

test("game detail successful refresh writes normalized snapshot to cache", async () => {
  const { appServices, counts, writes } = createHarness({
    providerFactory: createSuccessfulProvider,
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.gameDetail.loadGameDetail(PROVIDER_ID, "game-1");
  const expectedSnapshot = createGameDetailSnapshot();

  assert.equal(state.status, "success");
  assert.equal(state.isStale, false);
  assert.equal(state.error, undefined);
  assert.equal(counts.config, 1);
  assert.equal(counts.gameProgress, 1);
  assert.deepStrictEqual(state.data, expectedSnapshot);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.key, createProviderGameDetailCacheKey(PROVIDER_ID, "game-1"));
  assert.equal(writes[0]?.version, CACHE_VERSION);
  assert.equal(writes[0]?.storedAt, state.lastUpdatedAt);
  assert.deepStrictEqual(writes[0]?.value, state.data);
});

test("steam provider config and normalization stay round-trippable", () => {
  const config = normalizeSteamProviderConfig({
    steamId64: " 12345678901234567 ",
    apiKey: "  api-key  ",
    language: " spanish ",
    recentAchievementsCount: 7,
    recentlyPlayedCount: 3,
    includePlayedFreeGames: true,
  });

  assert.deepStrictEqual(
    parseSteamProviderConfig(serializeSteamProviderConfig(config)),
    config,
  );
  assert.deepStrictEqual(DEFAULT_STEAM_PROVIDER_CONFIG.language, "english");

  const schemaAchievement: RawSteamSchemaAchievement = {
    name: "ACH_WIN",
    displayName: "Win One",
    description: "Unlock the first win",
    icon: "https://cdn.steam.com/icon.png",
    icongray: "https://cdn.steam.com/icongray.png",
    hidden: 0,
  };
  const detail = normalizeSteamGameDetail({
    appId: 98765,
    rawGameName: "Steam Test Game",
    rawGameIcon: "https://cdn.steam.com/game-icon.jpg",
    rawGameBoxArt: "https://cdn.steam.com/game-box.jpg",
    playerAchievements: [
      {
        apiname: "ACH_WIN",
        achieved: 1,
        unlocktime: 1_700_000_000,
        description: "Player achievement fallback description",
      } satisfies RawSteamPlayerAchievement,
    ],
    schemaAchievements: [schemaAchievement],
    globalAchievementPercentages: new Map([["ACH_WIN", 12.5]]),
    playtimeForever: 42,
    playtimeTwoWeeks: 12,
    playtimeDeckForever: 28,
  });

  const recentGames = normalizeSteamRecentlyPlayedGames(
    [
      {
        appid: 98765,
        name: "Steam Test Game",
        playtime_2weeks: 12,
        playtime_forever: 42,
        playtime_deck_forever: 28,
        img_icon_url: "https://cdn.steam.com/game-icon.jpg",
        img_logo_url: "https://cdn.steam.com/game-box.jpg",
        has_community_visible_stats: true,
      } satisfies RawSteamRecentlyPlayedGame,
    ],
    new Map([[98765, detail]]),
  );

  assert.equal(recentGames.length, 1);
  assert.equal(recentGames[0]?.providerId, "steam");
  assert.equal(recentGames[0]?.summary.unlockedCount, 1);
  assert.equal(recentGames[0]?.lastPlayedAt, undefined);
  assert.equal(recentGames[0]?.playtimeTwoWeeksMinutes, 12);
  assert.equal(recentGames[0]?.playtimeForeverMinutes, 42);
  assert.equal(recentGames[0]?.playtimeDeckForeverMinutes, 28);
  assert.equal(detail.game.lastUnlockAt, undefined);
  assert.equal(detail.achievements[0]?.description, "Unlock the first win");
  assert.equal(hasAchievementCounts(getAchievementCounts(detail.achievements[0]?.metrics ?? [])), false);
  assert.equal(getAchievementDescriptionText(undefined), "No description was returned for this achievement.");
  assert.deepStrictEqual(dedupeDistinctLabels(["Steam", " steam ", "RetroAchievements", "steam"]), [
    "Steam",
    "RetroAchievements",
  ]);
  assert.equal(formatSteamPlaytimeMinutes(0), "0m");
  assert.equal(formatSteamPlaytimeMinutes(59), "59m");
  assert.equal(formatSteamPlaytimeMinutes(60), "1h");
  assert.equal(formatSteamPlaytimeMinutes(90), "1h 30m");

  const fallbackDescriptionDetail = normalizeSteamGameDetail({
    appId: 98766,
    rawGameName: "Steam Fallback Game",
    rawGameIcon: undefined,
    rawGameBoxArt: undefined,
    playerAchievements: [
      {
        apiname: "ACH_FALLBACK",
        achieved: 1,
        unlocktime: 1_700_000_111,
        description: "Player description fallback",
      } satisfies RawSteamPlayerAchievement,
    ],
    schemaAchievements: [
      {
        name: "ACH_FALLBACK",
        displayName: "Fallback Win",
        description: undefined,
        icon: undefined,
        icongray: undefined,
        hidden: 0,
      } satisfies RawSteamSchemaAchievement,
    ],
    globalAchievementPercentages: new Map([["ACH_FALLBACK", 9.5]]),
    playtimeForever: 4,
    playtimeTwoWeeks: 0,
    playtimeDeckForever: 0,
  });

  assert.equal(fallbackDescriptionDetail.achievements[0]?.description, "Player description fallback");

  const profile = normalizeSteamProfile({
    playerSummary: {
      steamid: config.steamId64,
      personaname: "Steam User",
      avatarfull: "https://cdn.steam.com/avatar.jpg",
      timecreated: 1_600_000_000,
    } satisfies RawSteamPlayerSummary,
    config,
    recentGames,
    gamesBeatenCount: 1,
    steamLevel: 29,
    badgeCount: 17,
    playerXp: 5_740,
  });

  assert.equal(profile.identity.displayName, "Steam User");
  assert.equal(
    profile.metrics.find((metric) => metric.key === "steam-id64")?.value,
    config.steamId64,
  );
  assert.equal(
    profile.metrics.find((metric) => metric.key === "member-since")?.value,
    new Date(1_600_000_000 * 1000).toISOString(),
  );
  assert.equal(
    formatProfileMemberSince(profile.metrics),
    new Date(1_600_000_000 * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  );
  assert.equal(profile.metrics.find((metric) => metric.key === "steam-level")?.value, "29");
  assert.equal(profile.metrics.find((metric) => metric.key === "badge-count")?.value, "17");
  assert.equal(profile.badgeCount, 17);
  assert.equal(profile.playerXp, 5_740);
  assert.deepStrictEqual(
    getSteamXpProgress(29, 5_740),
    {
      level: 29,
      playerXp: 5_740,
      xpToNextLevel: 260,
      progressPercent: 13,
      currentLevelXp: 40,
      nextLevelXp: 300,
      currentLevelStartXp: 5_700,
      caption: "260 XP to Level 30",
    },
  );
  assert.equal(getSteamXpProgress(undefined, 5_740), undefined);
  assert.equal(getSteamXpProgress(29, undefined), undefined);
  assert.equal(getSteamXpProgress(29, -10)?.progressPercent, 0);
  assert.equal(getSteamXpProgress(29, 9_999)?.progressPercent, 100);
  assert.equal(getSteamXpProgress(29, 9_999)?.xpToNextLevel, 0);
  assert.deepStrictEqual(
    getSteamAccountProgressSummary({ profile }),
    {
      steamLevelValue: "29",
      badgesValue: "17",
      badgesSecondary: "5,740 XP",
      xpProgressPercent: 13,
      xpProgressCaption: "260 XP to Level 30",
      accountSubtitle: "Level 29 \u00b7 5,740 XP",
    },
  );
  assert.deepStrictEqual(getSteamAccountProgressCards({ profile }), [
    {
      label: "Badges",
      value: "17",
      secondary: "5,740 XP",
    },
  ]);
  const profileWithoutSteamProgress = normalizeSteamProfile({
    playerSummary: {
      steamid: config.steamId64,
      personaname: "Steam User",
      avatarfull: "https://cdn.steam.com/avatar.jpg",
    } satisfies RawSteamPlayerSummary,
    config,
    recentGames,
    gamesBeatenCount: 1,
    badgeCount: 17,
  });
  const missingSteamProgress = getSteamAccountProgressSummary({ profile: profileWithoutSteamProgress });
  assert.equal(missingSteamProgress.steamLevelValue, "-");
  assert.equal(missingSteamProgress.badgesValue, "17");
  assert.equal(missingSteamProgress.badgesSecondary, undefined);
  assert.equal(missingSteamProgress.xpProgressCaption, "XP unavailable");
  assert.equal(missingSteamProgress.accountSubtitle, "XP unavailable");
  assert.deepStrictEqual(
    buildProviderOverviewStats(profile).map((stat) => `${stat.label}:${stat.value}`),
    [
      "Achievements Unlocked:1",
      "Owned Games:-",
      "Perfect Games:1",
      "Completion:100%",
    ],
  );
  assert.equal(shouldHideSteamAchievementDetailStats("steam"), true);
  assert.equal(shouldHideSteamAchievementDetailStats("retroachievements"), false);

  const profileWithoutTimecreated = normalizeSteamProfile({
    playerSummary: {
      steamid: config.steamId64,
      personaname: "Steam User",
      avatarfull: "https://cdn.steam.com/avatar.jpg",
    } satisfies RawSteamPlayerSummary,
    config,
    recentGames,
    gamesBeatenCount: 1,
    steamLevel: 29,
    badgeCount: 17,
    playerXp: 5_740,
  });
  assert.equal(profileWithoutTimecreated.metrics.find((metric) => metric.key === "member-since"), undefined);
  assert.equal(formatProfileMemberSince(profileWithoutTimecreated.metrics), undefined);

  const playerOnlyDetail = normalizeSteamGameDetail({
    appId: 12345,
    rawGameName: undefined,
    rawGameIcon: undefined,
    rawGameBoxArt: undefined,
    playerAchievements: [
      {
        apiname: "ACH_PLAYER_ONLY",
        achieved: 1,
        unlocktime: 1_700_000_123,
        description: "Player achievement description",
        icon: "https://cdn.steam.com/player-only-icon.png",
      } satisfies RawSteamPlayerAchievement,
    ],
    schemaAchievements: [],
    globalAchievementPercentages: new Map([["ACH_PLAYER_ONLY", 25]]),
    playtimeForever: undefined,
    playtimeTwoWeeks: undefined,
    playtimeDeckForever: undefined,
  });

  assert.equal(playerOnlyDetail.achievements[0]?.description, "Player achievement description");
  assert.equal(
    playerOnlyDetail.achievements[0]?.badgeImageUrl,
    "https://cdn.steam.com/player-only-icon.png",
  );
  assert.equal(playerOnlyDetail.game.title, "Unknown Game");
  const steamLibraryAchievementScanSummary: SteamLibraryAchievementScanSummary = {
    scannedAt: "2026-04-18T18:45:00Z",
    ownedGameCount: 42,
    scannedGameCount: 42,
    gamesWithAchievements: 10,
    skippedGameCount: 2,
    failedGameCount: 1,
    totalAchievements: 100,
    unlockedAchievements: 820,
    perfectGames: 1,
    completionPercent: 10,
    games: [],
  };

  const steamProfileStats = getSteamProfileStats({
    profile,
    steamLibraryAchievementScanSummary,
  });

  assert.deepStrictEqual(
    steamProfileStats.map((stat) => `${stat.label}:${stat.value}`),
    [
      "Achievements Unlocked:820",
      "Owned Games:42",
      "Perfect Games:1",
      "Completion:10%",
      `Last Library Scan:${steamProfileStats.find((stat) => stat.label === "Last Library Scan")?.value}`,
    ],
  );
  assert.equal(steamProfileStats.some((stat) => stat.label === "Last Library Scan"), true);
  assert.equal(steamProfileStats.some((stat) => stat.label === "Steam Level"), false);
  assert.equal(steamProfileStats.some((stat) => stat.label === "Badges"), false);

  const retroAchievementsProfile = normalizeRetroAchievementsProfile(
    {
      User: "Retro User",
      ULID: "abc123",
      MemberSince: "2020-01-02 00:00:00",
      Motto: "Keep on playing",
      TotalPoints: 1234,
      TotalSoftcorePoints: 4321,
      TotalTruePoints: 987,
    },
    {
      unlockedCount: 12,
      totalCount: 20,
      completionPercent: 60,
    },
    {
      username: "retro-user",
      apiKey: "secret",
    },
  );
  const retroAchievementsProfileStats = getDeckyProfileStats({
    profile: retroAchievementsProfile,
    steamLibraryAchievementScanSummary: undefined,
  });
  assert.deepStrictEqual(
    retroAchievementsProfileStats.map((stat) => stat.label),
    ["Total points", "Softcore points", "True points", "Member since"],
  );
  assert.deepStrictEqual(
    retroAchievementsProfileStats.map((stat) => stat.value),
    ["1234", "4321", "987", retroAchievementsProfileStats[3]?.value ?? "-"],
  );
  assert.notEqual(retroAchievementsProfileStats[3]?.value, "-");

  const recentUnlocks = normalizeSteamRecentUnlocks(recentGames, [detail]);
  assert.equal(recentUnlocks.length, 1);
  assert.equal(recentUnlocks[0]?.achievement.providerId, "steam");
});

test("steam library achievement scan caches full library totals and survives per-game failures", async () => {
  await withMockDeckyStorage(async () => {
    const config = normalizeSteamProviderConfig({
      steamId64: "12345678901234567",
      apiKey: "api-key",
      language: "english",
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
      includePlayedFreeGames: false,
    });
    const ownedGamesResponse: RawSteamGetOwnedGamesResponse = {
      response: {
        game_count: 5,
        games: [
          {
            appid: 1,
            name: "Perfect One",
            playtime_forever: 10,
            playtime_2weeks: 3,
            playtime_deck_forever: 4,
            rtime_last_played: 1_700_000_010,
            img_icon_url: "d081048291a422432720ec71721d7e6b58add966",
          } satisfies RawSteamOwnedGame,
          {
            appid: 2,
            name: "Almost Two",
            playtime_forever: 20,
            img_icon_url: "almost-two-hash",
          } satisfies RawSteamOwnedGame,
          {
            appid: 3,
            name: "No Achievements",
            playtime_forever: 30,
            img_icon_url: "https://cdn.steam.com/game-3.jpg",
          } satisfies RawSteamOwnedGame,
          {
            appid: 4,
            name: "Private Game",
            playtime_forever: 40,
            img_icon_url: "https://cdn.steam.com/game-4.jpg",
          } satisfies RawSteamOwnedGame,
          {
            appid: 5,
            name: "Broken Game",
            playtime_forever: 50,
            img_icon_url: "https://cdn.steam.com/game-5.jpg",
          } satisfies RawSteamOwnedGame,
        ],
      },
    };

    const schemaCalls: number[] = [];
    const summary = await runAndCacheDeckySteamLibraryAchievementScan(config, {
      client: {
        async loadOwnedGames() {
          return ownedGamesResponse;
        },
        async loadPlayerAchievements(_config, appId) {
          if (appId === 1) {
            return {
              playerstats: {
                success: true,
                achievements: [
                  { apiname: "A_ONE", achieved: 1, unlocktime: 1_700_000_000 },
                  { apiname: "A_TWO", achieved: 1, unlocktime: 1_700_000_100 },
                ],
              },
            };
          }

          if (appId === 2) {
            return {
              playerstats: {
                success: true,
                achievements: [
                  { apiname: "B_ONE", achieved: 1, unlocktime: 1_700_000_200 },
                  { apiname: "B_TWO", achieved: 1, unlocktime: 1_700_000_300 },
                  { apiname: "B_THREE", achieved: 0, unlocktime: 0 },
                ],
              },
            };
          }

          if (appId === 3) {
            return {
              playerstats: {
                success: true,
                achievements: [],
              },
            };
          }

          if (appId === 4) {
            return {
              playerstats: {
                success: false,
                error: "Private profile.",
              },
            };
          }

          throw new Error("Steam request failed.");
        },
        async loadPlayerSummaries() {
          throw new Error("not used");
        },
        async loadSteamLevel() {
          throw new Error("not used");
        },
        async loadBadges() {
          throw new Error("not used");
        },
        async loadRecentlyPlayedGames() {
          throw new Error("not used");
        },
        async loadSchemaForGame(_config, appId) {
          schemaCalls.push(appId);

          if (appId === 1) {
            return {
              game: {
                availableGameStats: {
                  achievements: [
                    {
                      name: "A_ONE",
                      displayName: "Alpha One",
                      description: "First alpha unlock",
                      icon: "alpha-one-icon",
                      icongray: "alpha-one-gray",
                    } satisfies RawSteamSchemaAchievement,
                    {
                      name: "A_TWO",
                      displayName: "Alpha Two",
                      description: "Second alpha unlock",
                      icon: "alpha-two-icon",
                      icongray: "alpha-two-gray",
                    } satisfies RawSteamSchemaAchievement,
                  ],
                },
              },
            };
          }

          if (appId === 2) {
            throw new Error("Steam schema unavailable.");
          }

          throw new Error("Steam schema should not have been requested.");
        },
        async loadGlobalAchievementPercentagesForApp() {
          throw new Error("not used");
        },
      },
      concurrencyLimit: 2,
    });

    assert.equal(summary.ownedGameCount, 5);
    assert.equal(summary.scannedGameCount, 5);
    assert.equal(summary.gamesWithAchievements, 2);
    assert.equal(summary.skippedGameCount, 1);
    assert.equal(summary.failedGameCount, 2);
    assert.equal(summary.totalAchievements, 5);
    assert.equal(summary.unlockedAchievements, 4);
    assert.equal(summary.perfectGames, 1);
    assert.equal(summary.completionPercent, 80);
    assert.equal(summary.games.length, 5);
    assert.equal(summary.games[0]?.scanStatus, "scanned");
    assert.equal(summary.games[0]?.providerId, "steam");
    assert.equal(summary.games[0]?.platformLabel, "Steam");
    assert.equal(
      summary.games[0]?.iconUrl,
      "https://media.steampowered.com/steamcommunity/public/images/apps/1/d081048291a422432720ec71721d7e6b58add966.jpg",
    );
    assert.equal(summary.games[0]?.lastPlayedAt, new Date(1_700_000_010_000).toISOString());
    assert.equal(summary.games[0]?.playtimeForeverMinutes, 10);
    assert.equal(summary.games[0]?.playtimeTwoWeeksMinutes, 3);
    assert.equal(summary.games[0]?.playtimeDeckForeverMinutes, 4);
    assert.equal(summary.games[2]?.scanStatus, "no-achievements");
    assert.equal(summary.games[3]?.scanStatus, "failed");
    assert.equal(summary.games[4]?.scanStatus, "failed");
    assert.equal(summary.unlockedAchievementsList?.length, 4);
    assert.deepStrictEqual(
      summary.unlockedAchievementsList?.map((unlock) => unlock.apiName),
      ["B_TWO", "B_ONE", "A_TWO", "A_ONE"],
    );
    assert.deepStrictEqual([...schemaCalls].sort((left, right) => left - right), [1, 2]);
    assert.equal(
      summary.unlockedAchievementsList?.[0]?.gameIconUrl,
      "https://media.steampowered.com/steamcommunity/public/images/apps/2/almost-two-hash.jpg",
    );
    assert.equal(summary.unlockedAchievementsList?.find((unlock) => unlock.apiName === "A_ONE")?.title, "Alpha One");
    assert.equal(
      summary.unlockedAchievementsList?.find((unlock) => unlock.apiName === "A_ONE")?.iconUrl,
      "https://media.steampowered.com/steamcommunity/public/images/apps/1/alpha-one-icon.jpg",
    );

    assert.deepStrictEqual(readDeckySteamLibraryAchievementScanSummary("steam"), summary);

    const summaryCompletion = buildDeckySteamCompletionProgressSnapshotFromSummary(summary);
    assert.equal(summaryCompletion.games.length, 5);
    assert.equal(summaryCompletion.summary.playedCount, 5);
    assert.equal(summaryCompletion.summary.unfinishedCount, 1);
    assert.equal(summaryCompletion.summary.beatenCount, 3);
    assert.equal(summaryCompletion.summary.masteredCount, 1);
    assert.equal(summaryCompletion.games[0]?.playtimeForeverMinutes, 10);
    assert.equal(summaryCompletion.games[0]?.lastPlayedAt, 1_700_000_010_000);
    assert.equal(summaryCompletion.games[0]?.appid, 1);
    assert.equal(summaryCompletion.games[0]?.gameId, "1");
    assert.equal(summaryCompletion.games[0]?.status, "mastered");
    assert.equal(summaryCompletion.games[0]?.platformLabel, "Steam");
    assert.equal(summaryCompletion.games[0]?.summary.completionPercent, 100);
    assert.equal(summaryCompletion.games[2]?.status, "locked");
    assert.equal(summaryCompletion.games[2]?.scanStatus, "no-achievements");
    assert.equal(summaryCompletion.games[3]?.status, "locked");
    assert.equal(summaryCompletion.games[3]?.scanStatus, "failed");
    assert.equal(getSteamCompletionProgressGameDetailId(summaryCompletion.games[0]!), "1");

    const summaryDetail = normalizeSteamGameDetail({
      appId: 98765,
      rawGameName: "Steam Test Game",
      rawGameIcon: "https://cdn.steam.com/game-icon.jpg",
      rawGameBoxArt: "https://cdn.steam.com/game-box.jpg",
      playerAchievements: [
        {
          apiname: "ACH_WIN",
          achieved: 1,
          unlocktime: 1_700_000_000,
        } satisfies RawSteamPlayerAchievement,
      ],
      schemaAchievements: [
        {
          name: "ACH_WIN",
          displayName: "Win One",
          description: "Unlock the first win",
          icon: "https://cdn.steam.com/icon.png",
          icongray: "https://cdn.steam.com/icongray.png",
          hidden: 0,
        } satisfies RawSteamSchemaAchievement,
      ],
      globalAchievementPercentages: new Map([["ACH_WIN", 12.5]]),
      playtimeForever: 42,
      playtimeTwoWeeks: 12,
      playtimeDeckForever: 28,
    });
    const summaryRecentGames = normalizeSteamRecentlyPlayedGames(
      [
        {
          appid: 98765,
          name: "Steam Test Game",
          playtime_forever: 42,
          img_icon_url: "https://cdn.steam.com/game-icon.jpg",
          img_logo_url: "https://cdn.steam.com/game-box.jpg",
          has_community_visible_stats: true,
        } satisfies RawSteamOwnedGame,
      ],
      new Map([[98765, summaryDetail]]),
    );

    const profile = normalizeSteamProfile({
      playerSummary: {
        steamid: config.steamId64,
        personaname: "Steam User",
        avatarfull: "https://cdn.steam.com/avatar.jpg",
      } satisfies RawSteamPlayerSummary,
      config,
      recentGames: summaryRecentGames,
      gamesBeatenCount: 1,
      steamLevel: 29,
    });

    assert.deepStrictEqual(
      buildProviderOverviewStats(profile).map((stat) => `${stat.label}:${stat.value}`),
      [
        "Achievements Unlocked:1",
        "Owned Games:-",
        "Perfect Games:1",
        "Completion:100%",
      ],
    );

    assert.deepStrictEqual(
      buildProviderOverviewStats(profile, summary).map((stat) => `${stat.label}:${stat.value}`),
      [
        "Achievements Unlocked:4",
        "Owned Games:5",
        "Perfect Games:1",
        "Completion:80%",
      ],
    );

    const summaryHistory = buildDeckySteamAchievementHistorySnapshotFromSummary({
      profile,
      summary,
    });
    assert.equal(summaryHistory.sourceLabel, "Library unlocks");
    assert.equal(
      summaryHistory.entries.find((entry) => entry.achievement.achievementId === "A_ONE")?.achievement.badgeImageUrl,
      "https://media.steampowered.com/steamcommunity/public/images/apps/1/alpha-one-icon.jpg",
    );
  });
});

test("steam library achievement scan emits throttled progress logs when logger is provided", async () => {
  await withMockDeckyStorage(async () => {
    const startedEvents: Array<Record<string, unknown>> = [];
    const progressEvents: Array<Record<string, unknown>> = [];
    const completedEvents: Array<Record<string, unknown>> = [];
    const failedEvents: Array<Record<string, unknown>> = [];
    const client: SteamClient = {
      async loadOwnedGames() {
        return {
          response: {
            game_count: 30,
            games: Array.from({ length: 30 }, (_, index) => ({
              appid: index + 1,
              name: `Game ${index + 1}`,
            })),
          },
        };
      },
      async loadPlayerAchievements() {
        return {
          playerstats: {
            success: true,
            achievements: [],
          },
        };
      },
      async loadSchemaForGame() {
        return {
          game: {
            availableGameStats: {
              achievements: [],
            },
          },
        };
      },
      async loadGlobalAchievementPercentagesForApp() {
        return {
          achievementpercentages: {
            achievements: [],
          },
        };
      },
      async loadPlayerSummaries() {
        return {
          response: {
            players: [],
          },
        };
      },
      async loadSteamLevel() {
        return {
          response: {
            player_level: 29,
          },
        };
      },
      async loadBadges() {
        return {
          playerstats: {
            badges: [],
          },
        };
      },
    };

    const summary = await scanSteamLibraryAchievements(
      normalizeSteamProviderConfig({
        steamId64: "12345678901234567",
        hasApiKey: true,
        language: "english",
        recentAchievementsCount: 5,
        recentlyPlayedCount: 5,
        includePlayedFreeGames: false,
      }),
      {
        client,
        concurrencyLimit: 1,
        logger: {
          started(fields) {
            startedEvents.push(fields);
          },
          progress(fields) {
            progressEvents.push(fields);
          },
          completed(fields) {
            completedEvents.push(fields);
          },
          failed(fields) {
            failedEvents.push(fields);
          },
        },
      },
    );

    assert.equal(summary.scannedGameCount, 30);
    assert.equal(startedEvents.length, 1);
    assert.equal(startedEvents[0]?.ownedGameCount, 30);
    assert.ok(progressEvents.length >= 1);
    assert.ok(progressEvents.length <= 3);
    assert.equal(completedEvents.length, 1);
    assert.equal(failedEvents.length, 0);
  });
});

test("decky steam library scan uses backend request route without frontend apiKey", async () => {
  await withMockDeckyStorage(async () => {
    const config = normalizeSteamProviderConfig({
      steamId64: "12345678901234567",
      hasApiKey: true,
      language: "english",
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
      includePlayedFreeGames: false,
    });

    const requestPaths: string[] = [];
    const diagnosticEvents: Array<{ readonly event: string; readonly fields: Record<string, unknown> }> = [];
    const restoreFetch = setGlobalTestValue("fetch", async () => {
      throw new Error("unexpected frontend fetch during decky steam scan");
    });
    const restoreBackend = setDeckyBackendCallImplementationForTests(async (route: string, payload: unknown) => {
      if (route === "record_diagnostic_event") {
        const record = payload as Record<string, unknown>;
        diagnosticEvents.push({
          event: String(record.event),
          fields: record,
        });
        return true;
      }

      assert.equal(route, "request_steam_json");
      const record = payload as Record<string, unknown>;
      assert.equal(typeof record.apiKey, "undefined");
      assert.equal(typeof record.key, "undefined");
      assert.equal(typeof record.path, "string");
      requestPaths.push(record.path as string);

      if (record.path === "IPlayerService/GetOwnedGames/v1/") {
        return {
          response: {
            game_count: 1,
            games: [
              {
                appid: 220,
                name: "Half-Life 2",
                img_icon_url: "half-life-2-icon",
              },
            ],
          },
        };
      }

      if (record.path === "ISteamUserStats/GetPlayerAchievements/v1/") {
        assert.equal((record.query as Record<string, unknown>)?.appid, 220);
        return {
          playerstats: {
            success: true,
            achievements: [
              {
                apiname: "ACH_WIN",
                achieved: 1,
                unlocktime: 1_700_000_000,
              },
            ],
          },
        };
      }

      if (record.path === "ISteamUserStats/GetSchemaForGame/v2/") {
        assert.equal((record.query as Record<string, unknown>)?.appid, 220);
        return {
          game: {
            availableGameStats: {
              achievements: [
                {
                  name: "ACH_WIN",
                  displayName: "Win",
                  description: "Win the game.",
                },
              ],
            },
          },
        };
      }

      throw new Error(`Unexpected Steam backend request path in test: ${String(record.path)}`);
    });

    try {
      const summary = await runAndCacheDeckySteamLibraryAchievementScan(config);
      assert.equal(summary.ownedGameCount, 1);
      assert.equal(summary.scannedGameCount, 1);
      assert.equal(summary.gamesWithAchievements, 1);
      assert.equal(summary.failedGameCount, 0);
      assert.equal(summary.skippedGameCount, 0);
      assert.equal(summary.totalAchievements, 1);
      assert.equal(summary.unlockedAchievements, 1);
      assert.equal(summary.perfectGames, 1);
      assert.equal(summary.games[0]?.appid, 220);
      assert.equal(summary.games[0]?.scanStatus, "scanned");
      assert.equal(summary.games[0]?.unlockedAchievements, 1);
      assert.equal(summary.games[0]?.totalAchievements, 1);
      assert.equal(summary.unlockedAchievementsList?.length, 1);
      assert.ok(diagnosticEvents.some((event) => event.event === "steam_library_scan_started"));
      assert.ok(diagnosticEvents.some((event) => event.event === "steam_library_scan_progress"));
      assert.ok(diagnosticEvents.some((event) => event.event === "steam_library_scan_completed"));
      assert.equal(
        diagnosticEvents.filter((event) => event.event === "steam_library_scan_failed").length,
        0,
      );
      assert.deepStrictEqual(requestPaths, [
        "IPlayerService/GetOwnedGames/v1/",
        "ISteamUserStats/GetPlayerAchievements/v1/",
        "ISteamUserStats/GetSchemaForGame/v2/",
      ]);
      const providerSettingsSource = readFileSync(
        "src/platform/decky/providers/steam/provider-settings-page.tsx",
        "utf8",
      );
      assert.match(providerSettingsSource, /createDeckySteamLibraryScanDependencies\(\)/u);
      assert.doesNotMatch(
        providerSettingsSource,
        /runAndCacheDeckySteamLibraryAchievementScan\(providerConfig\)/u,
      );
    } finally {
      restoreFetch();
      setDeckyBackendCallImplementationForTests(deckyBackendTestCallImplementation);
    }
  });
});

test("steam cached scan normalizes icon urls, percent, and library unlock history", async () => {
  await withMockDeckyStorage(async () => {
    const cachedSummary: SteamLibraryAchievementScanSummary = {
      scannedAt: "2026-04-18T18:45:00Z",
      ownedGameCount: 1,
      scannedGameCount: 1,
      gamesWithAchievements: 1,
      skippedGameCount: 0,
      failedGameCount: 0,
      totalAchievements: 500,
      unlockedAchievements: 164,
      perfectGames: 0,
      completionPercent: 333,
      games: [
        {
          appid: 1,
          id: "1",
          gameId: "1",
          title: "Steam Test Game",
          providerId: "steam",
          iconUrl: "d081048291a422432720ec71721d7e6b58add966",
          playtimeForeverMinutes: 28,
          playtimeTwoWeeksMinutes: 1,
          playtimeDeckForeverMinutes: 28,
          lastPlayedAt: new Date(1_700_000_010_000).toISOString(),
          totalAchievements: 500,
          unlockedAchievements: 164,
          completionPercent: 333,
          hasAchievements: true,
          scanStatus: "scanned",
        },
      ],
      unlockedAchievementsList: [
        {
          id: "1:ACH_B:2026-04-18T18:31:00Z",
          achievementId: "ACH_B",
          apiName: "ACH_B",
          title: "Second Unlock",
          unlockedAt: "2026-04-18T18:31:00Z",
          gameId: "1",
          gameTitle: "Steam Test Game",
          gameIconUrl: "d081048291a422432720ec71721d7e6b58add966",
          providerId: "steam",
        },
        {
          id: "1:ACH_A:2026-04-18T18:30:00Z",
          achievementId: "ACH_A",
          apiName: "ACH_A",
          title: "First Unlock",
          unlockedAt: "2026-04-18T18:30:00Z",
          gameId: "1",
          gameTitle: "Steam Test Game",
          gameIconUrl: "d081048291a422432720ec71721d7e6b58add966",
          providerId: "steam",
        },
      ],
    };

    writeDeckySteamLibraryAchievementScanSummary(cachedSummary);

    const normalizedSummary = readDeckySteamLibraryAchievementScanSummary("steam");
    assert.equal(normalizedSummary?.completionPercent, 33);
    assert.equal(normalizedSummary?.games[0]?.platformLabel, "Steam");
    assert.equal(
      normalizedSummary?.games[0]?.iconUrl,
      "https://media.steampowered.com/steamcommunity/public/images/apps/1/d081048291a422432720ec71721d7e6b58add966.jpg",
    );
    assert.equal(normalizedSummary?.games[0]?.completionPercent, 33);
    assert.equal(normalizedSummary?.unlockedAchievementsList?.length, 2);
    assert.deepStrictEqual(
      normalizedSummary?.unlockedAchievementsList?.map((unlock) => unlock.apiName),
      ["ACH_B", "ACH_A"],
    );
    assert.equal(
      normalizedSummary?.unlockedAchievementsList?.[0]?.gameIconUrl,
      "https://media.steampowered.com/steamcommunity/public/images/apps/1/d081048291a422432720ec71721d7e6b58add966.jpg",
    );

    const profile = normalizeSteamProfile({
      playerSummary: {
        steamid: "12345678901234567",
        personaname: "Steam User",
        avatarfull: "https://cdn.steam.com/avatar.jpg",
      } satisfies RawSteamPlayerSummary,
      config: normalizeSteamProviderConfig({
        steamId64: "12345678901234567",
        apiKey: "api-key",
        language: "english",
        recentAchievementsCount: 5,
        recentlyPlayedCount: 5,
        includePlayedFreeGames: false,
      }),
      recentGames: [],
      gamesBeatenCount: 0,
      steamLevel: 29,
      badgeCount: 9,
      playerXp: 5_740,
      ownedGameCount: 1,
    });

    const history = buildDeckySteamAchievementHistorySnapshotFromSummary({
      profile,
      summary: cachedSummary,
    });

    assert.equal(history.sourceLabel, "Library unlocks");
    assert.equal(history.entries.length, 2);
    assert.equal(history.entries[0]?.achievement.title, "Second Unlock");
    assert.equal(history.entries[0]?.game.platformLabel, "Steam");
    assert.equal(
      history.entries.find((entry) => entry.achievement.achievementId === "A_ONE")?.achievement.badgeImageUrl,
      undefined,
    );
    assert.equal(history.summary.unlockedCount, 2);

    const legacyCachedSummaryText = JSON.stringify({
      scannedAt: "2026-04-18T18:45:00Z",
      ownedGameCount: 1,
      scannedGameCount: 1,
      gamesWithAchievements: 1,
      skippedGameCount: 0,
      failedGameCount: 0,
      totalAchievements: 1,
      unlockedAchievements: 1,
      perfectGames: 1,
      completionPercent: 100,
      games: [
        {
          id: "1",
          gameId: "1",
          title: "Legacy Steam Game",
          iconUrl: "d081048291a422432720ec71721d7e6b58add966",
          totalAchievements: 1,
          unlockedAchievements: 1,
          completionPercent: 100,
          hasAchievements: true,
          scanStatus: "scanned",
        },
      ],
      unlockedAchievementsList: [
        {
          id: "1:ACH_LEGACY:2026-04-18T18:30:00Z",
          achievementId: "ACH_LEGACY",
          apiName: "ACH_LEGACY",
          title: "Legacy Unlock",
          unlockedAt: "2026-04-18T18:30:00Z",
          gameId: "1",
          gameTitle: "Legacy Steam Game",
          providerId: "steam",
        },
      ],
    });

    clearDeckySteamLibraryAchievementScanSummary();
    writeDeckyStorageText("achievement-companion:decky:steam:library-achievement-scan", legacyCachedSummaryText);
    const normalizedLegacySummary = readDeckySteamLibraryAchievementScanSummary("steam");
    assert.equal(normalizedLegacySummary?.games[0]?.appid, 1);
    assert.equal(normalizedLegacySummary?.games[0]?.gameId, "1");
    assert.equal(normalizedLegacySummary?.games[0]?.providerId, "steam");
    assert.equal(
      normalizedLegacySummary?.games[0]?.iconUrl,
      "https://media.steampowered.com/steamcommunity/public/images/apps/1/d081048291a422432720ec71721d7e6b58add966.jpg",
    );
    const legacyHistory = buildDeckySteamAchievementHistorySnapshotFromSummary({
      profile,
      summary: normalizedLegacySummary ?? cachedSummary,
    });
    assert.equal(legacyHistory.entries[0]?.achievement.badgeImageUrl, undefined);

    const legacyNoIconSummaryText = JSON.stringify({
      scannedAt: "2026-04-18T18:45:00Z",
      ownedGameCount: 1,
      scannedGameCount: 1,
      gamesWithAchievements: 1,
      skippedGameCount: 0,
      failedGameCount: 0,
      totalAchievements: 1,
      unlockedAchievements: 1,
      perfectGames: 1,
      completionPercent: 100,
      games: [
        {
          id: "1",
          gameId: "1",
          title: "Legacy Steam Game",
          totalAchievements: 1,
          unlockedAchievements: 1,
          completionPercent: 100,
          hasAchievements: true,
          scanStatus: "scanned",
        },
      ],
      unlockedAchievementsList: [
        {
          id: "1:ACH_LEGACY:2026-04-18T18:30:00Z",
          achievementId: "ACH_LEGACY",
          apiName: "ACH_LEGACY",
          title: "Legacy Unlock",
          unlockedAt: "2026-04-18T18:30:00Z",
          gameId: "1",
          gameTitle: "Legacy Steam Game",
          providerId: "steam",
        },
      ],
    });

    clearDeckySteamLibraryAchievementScanSummary();
    writeDeckyStorageText("achievement-companion:decky:steam:library-achievement-scan", legacyNoIconSummaryText);
    const legacyNoIconSummary = readDeckySteamLibraryAchievementScanSummary("steam");
    const legacyNoIconHistory = buildDeckySteamAchievementHistorySnapshotFromSummary({
      profile,
      summary: legacyNoIconSummary ?? cachedSummary,
    });
    assert.equal(legacyNoIconHistory.entries[0]?.achievement.badgeImageUrl, undefined);
  });
});

test("steam cached completion rows prefer canonical appids over stale ids", () => {
  assert.equal(
    getSteamCompletionProgressGameDetailId({
      appid: 423530,
      gameId: "Lovika",
    }),
    "423530",
  );
  assert.equal(
    getSteamCompletionProgressGameDetailId({
      gameId: "377160",
    }),
    "377160",
  );
});

test("steam cached game detail metadata prefers cached library titles and icons over codename names", () => {
  const cachedSummary: SteamLibraryAchievementScanSummary = {
    scannedAt: "2026-04-18T18:45:00Z",
    ownedGameCount: 2,
    scannedGameCount: 2,
    gamesWithAchievements: 2,
    skippedGameCount: 0,
    failedGameCount: 0,
    totalAchievements: 6,
    unlockedAchievements: 3,
    perfectGames: 0,
    completionPercent: 50,
    games: [
      {
        appid: 423530,
        id: "423530",
        gameId: "423530",
        title: "Minecraft Dungeons",
        providerId: "steam",
        platformLabel: "Steam",
        iconUrl: "https://media.steampowered.com/steamcommunity/public/images/apps/423530/cached-dungeons-icon.jpg",
        playtimeForeverMinutes: 28,
        playtimeTwoWeeksMinutes: 1,
        playtimeDeckForeverMinutes: 28,
        lastPlayedAt: "2026-04-18T18:30:00.000Z",
        totalAchievements: 3,
        unlockedAchievements: 2,
        completionPercent: 67,
        hasAchievements: true,
        scanStatus: "scanned",
      },
      {
        appid: 1174150,
        id: "1174150",
        gameId: "1174150",
        title: "Battlefield 6",
        providerId: "steam",
        platformLabel: "Steam",
        iconUrl: "https://media.steampowered.com/steamcommunity/public/images/apps/1174150/cached-battlefield-icon.jpg",
        totalAchievements: 3,
        unlockedAchievements: 1,
        completionPercent: 33,
        hasAchievements: true,
        scanStatus: "scanned",
      },
    ],
  };

  const cachedSummaryGame = findSteamLibraryScanGameSummaryByAppId(cachedSummary, 423530);
  assert.equal(cachedSummaryGame?.title, "Minecraft Dungeons");

  const dungeonsSnapshot: GameDetailSnapshot = {
    game: {
      providerId: "steam",
      appid: 423530,
      gameId: "423530",
      title: "Lovika",
      platformLabel: "Steam",
      coverImageUrl: "https://cdn.steam.invalid/lovika.jpg",
      boxArtImageUrl: "https://cdn.steam.invalid/lovika-box.jpg",
      status: "in_progress",
      summary: {
        unlockedCount: 2,
        totalCount: 3,
        completionPercent: 67,
      },
      metrics: [],
      playtimeForeverMinutes: 28,
      playtimeTwoWeeksMinutes: 1,
      playtimeDeckForeverMinutes: 28,
    },
    achievements: [],
  };

  const patchedDungeonsSnapshot = applySteamLibraryScanGameDetailMetadata(dungeonsSnapshot, cachedSummary);
  assert.equal(patchedDungeonsSnapshot.game.appid, 423530);
  assert.equal(patchedDungeonsSnapshot.game.gameId, "423530");
  assert.equal(patchedDungeonsSnapshot.game.title, "Minecraft Dungeons");
  assert.equal(
    patchedDungeonsSnapshot.game.coverImageUrl,
    "https://media.steampowered.com/steamcommunity/public/images/apps/423530/cached-dungeons-icon.jpg",
  );
  assert.equal(
    patchedDungeonsSnapshot.game.boxArtImageUrl,
    "https://media.steampowered.com/steamcommunity/public/images/apps/423530/cached-dungeons-icon.jpg",
  );

  const battlefieldSnapshot: GameDetailSnapshot = {
    game: {
      providerId: "steam",
      appid: 1174150,
      gameId: "1174150",
      title: "Glacier",
      platformLabel: "Steam",
      status: "in_progress",
      summary: {
        unlockedCount: 1,
        totalCount: 3,
        completionPercent: 33,
      },
      metrics: [],
    },
    achievements: [],
  };

  const patchedBattlefieldSnapshot = applySteamLibraryScanGameDetailMetadata(battlefieldSnapshot, cachedSummary);
  assert.equal(patchedBattlefieldSnapshot.game.title, "Battlefield 6");
  assert.equal(
    patchedBattlefieldSnapshot.game.coverImageUrl,
    "https://media.steampowered.com/steamcommunity/public/images/apps/1174150/cached-battlefield-icon.jpg",
  );

  const fallbackSnapshot = applySteamLibraryScanGameDetailMetadata(dungeonsSnapshot, undefined);
  assert.deepStrictEqual(fallbackSnapshot, dungeonsSnapshot);
});

test("steam fullscreen completion prefers cached library scan games and labels perfect games", async () => {
  await withMockDeckyStorage(async () => {
    const cachedSummary: SteamLibraryAchievementScanSummary = {
      scannedAt: "2026-04-18T18:45:00Z",
      ownedGameCount: 5,
      scannedGameCount: 5,
      gamesWithAchievements: 2,
      skippedGameCount: 1,
      failedGameCount: 2,
      totalAchievements: 5,
      unlockedAchievements: 4,
      perfectGames: 1,
      completionPercent: 80,
      games: [
        {
          appid: 1,
          id: "1",
          gameId: "1",
          title: "Perfect One",
          providerId: "steam",
          iconUrl: "https://cdn.steam.com/game-1.jpg",
          playtimeForeverMinutes: 10,
          playtimeTwoWeeksMinutes: 3,
          playtimeDeckForeverMinutes: 4,
          lastPlayedAt: new Date(1_700_000_010_000).toISOString(),
          totalAchievements: 2,
          unlockedAchievements: 2,
          completionPercent: 100,
          hasAchievements: true,
          scanStatus: "scanned",
        },
        {
          appid: 2,
          id: "2",
          gameId: "2",
          title: "Almost Two",
          providerId: "steam",
          iconUrl: "https://cdn.steam.com/game-2.jpg",
          playtimeForeverMinutes: 20,
          totalAchievements: 3,
          unlockedAchievements: 2,
          completionPercent: 67,
          hasAchievements: true,
          scanStatus: "scanned",
        },
        {
          appid: 3,
          id: "3",
          gameId: "3",
          title: "No Achievements",
          providerId: "steam",
          iconUrl: "https://cdn.steam.com/game-3.jpg",
          playtimeForeverMinutes: 30,
          totalAchievements: 0,
          unlockedAchievements: 0,
          completionPercent: 0,
          hasAchievements: false,
          scanStatus: "no-achievements",
        },
        {
          appid: 4,
          id: "4",
          gameId: "4",
          title: "Private Game",
          providerId: "steam",
          iconUrl: "https://cdn.steam.com/game-4.jpg",
          playtimeForeverMinutes: 40,
          totalAchievements: 0,
          unlockedAchievements: 0,
          completionPercent: 0,
          hasAchievements: false,
          scanStatus: "failed",
        },
        {
          appid: 5,
          id: "5",
          gameId: "5",
          title: "Broken Game",
          providerId: "steam",
          iconUrl: "https://cdn.steam.com/game-5.jpg",
          playtimeForeverMinutes: 50,
          totalAchievements: 0,
          unlockedAchievements: 0,
          completionPercent: 0,
          hasAchievements: false,
          scanStatus: "failed",
        },
      ],
    };
    writeDeckySteamLibraryAchievementScanSummary(cachedSummary);

    const state = await loadDeckyCompletionProgressState("steam");

    assert.equal(state.status, "success");
    assert.equal(state.data?.games.length, 5);
    assert.equal(state.data?.summary.playedCount, 5);
    assert.equal(state.data?.summary.unfinishedCount, 1);
    assert.equal(state.data?.summary.beatenCount, 3);
    assert.equal(state.data?.summary.masteredCount, 1);
    assert.equal(state.data?.games[0]?.playtimeForeverMinutes, 10);
    assert.equal(state.data?.games[0]?.lastPlayedAt, 1_700_000_010_000);
    assert.equal(state.data?.games[2]?.scanStatus, "no-achievements");
    assert.equal(state.data?.games[3]?.scanStatus, "failed");
    assert.deepStrictEqual(
      formatCompletionProgressSummary(state.data?.summary ?? { playedCount: 0, unfinishedCount: 0, beatenCount: 0, masteredCount: 0 }, "steam"),
      "5 Played | 1 Unfinished | 3 Skipped | 1 Perfect",
    );
    assert.equal(formatCompletionProgressStatusLabel("mastered", "steam"), "Perfect");
    assert.equal(formatCompletionProgressFilterLabelForProvider("mastered", "steam"), "Perfect");
  });
});

test("steam fullscreen completion falls back to loaded games when no cached scan exists", async () => {
  const { appServices, counts } = createHarness({
    providerFactory: (callCounts) => ({
      id: PROVIDER_ID,
      capabilities: PROVIDER_CAPABILITIES,
      async loadProfile() {
        callCounts.profile += 1;
        return DASHBOARD_REFRESH_PROFILE;
      },
      async loadCompletionProgress() {
        callCounts.completionProgress += 1;
        return [
          {
            providerId: PROVIDER_ID,
            gameId: "game-1",
            title: "Steam Test Game",
            platformLabel: "Steam",
            coverImageUrl: "https://cdn.steam.com/game-icon.jpg",
            playtimeForeverMinutes: 42,
            playtimeTwoWeeksMinutes: 12,
            summary: {
              unlockedCount: 1,
              totalCount: 2,
              completionPercent: 50,
            },
            metrics: [],
            status: "in_progress",
          } satisfies NormalizedGame,
        ];
      },
      async loadRecentlyPlayedGames() {
        callCounts.recentlyPlayedGames += 1;
        return [
          {
            providerId: PROVIDER_ID,
            gameId: "game-1",
            title: "Steam Test Game",
            platformLabel: "Steam",
            coverImageUrl: "https://cdn.steam.com/game-icon.jpg",
            summary: {
              unlockedCount: 1,
              totalCount: 2,
              completionPercent: 50,
            },
            playtimeForeverMinutes: 42,
            playtimeTwoWeeksMinutes: 12,
          } satisfies RecentlyPlayedGame,
        ];
      },
      async loadRecentUnlocks() {
        callCounts.recentUnlocks += 1;
        return [];
      },
      async loadGameProgress() {
        callCounts.gameProgress += 1;
        throw new Error("not used");
      },
    }),
    providerConfig: {
      steamId64: "12345678901234567",
      apiKey: "api-key",
      language: "english",
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
      includePlayedFreeGames: false,
    },
  });

  const state = await appServices.completionProgress.loadCompletionProgress(PROVIDER_ID);

  assert.equal(state.status, "success");
  assert.equal(state.data?.games.length, 1);
  assert.equal(state.data?.summary.playedCount, 1);
  assert.equal(state.data?.summary.unfinishedCount, 1);
  assert.equal(state.data?.summary.masteredCount, 0);
  assert.equal(counts.completionProgress, 1);
  assert.equal(counts.profile, 0);
  assert.equal(counts.recentlyPlayedGames, 0);
});

test("steam client steam level maps player level and keeps requests simple", async () => {
  const requests: Array<{ readonly url: string; readonly init: RequestInit | undefined }> = [];
  const transport = createFetchSteamTransport({
    fetchImpl: async (input, init) => {
      requests.push({
        url: String(input),
        init,
      });

      return new Response(JSON.stringify({ response: { player_level: 29 } } satisfies RawSteamGetSteamLevelResponse), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
  });
  const client = createSteamClient(transport);
  const config = normalizeSteamProviderConfig({
    steamId64: "12345678901234567",
    hasApiKey: true,
    language: "english",
    recentAchievementsCount: 5,
    recentlyPlayedCount: 5,
    includePlayedFreeGames: false,
  });

  const response = await client.loadSteamLevel(config);

  assert.equal(response.response?.player_level, 29);
  assert.equal(requests.length, 1);
  const request = requests[0];
  assert.ok(request !== undefined);
  const url = new URL(request.url);
  assert.equal(url.pathname.endsWith("/IPlayerService/GetSteamLevel/v1/"), true);
  assert.equal(url.searchParams.get("key"), null);
  assert.equal(url.searchParams.get("steamid"), config.steamId64);
  assert.equal(url.searchParams.get("format"), "json");
  assert.equal(request.init?.method, "GET");
  assert.equal(request.init?.cache, "no-store");
  const headers = new Headers(request.init?.headers);
  assert.equal(headers.get("Accept"), "application/json");
  assert.equal(headers.get("Cache-Control"), null);
  assert.equal(headers.get("Pragma"), null);
  assert.equal(url.searchParams.get("key"), null);
});

test("steam client badges maps badge count and keeps requests simple", async () => {
  const requests: Array<{ readonly url: string; readonly init: RequestInit | undefined }> = [];
  const transport = createFetchSteamTransport({
    fetchImpl: async (input, init) => {
      requests.push({
        url: String(input),
        init,
      });

      return new Response(
        JSON.stringify({
          response: {
            badges: [
              { badgeid: 1 },
              { badgeid: 2 },
              { badgeid: 3 },
            ],
            player_xp: 5_740,
          },
        } satisfies RawSteamGetBadgesResponse),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    },
  });
  const client = createSteamClient(transport);
  const config = normalizeSteamProviderConfig({
    steamId64: "12345678901234567",
    hasApiKey: true,
    language: "english",
    recentAchievementsCount: 5,
    recentlyPlayedCount: 5,
    includePlayedFreeGames: false,
  });

  const response = await client.loadBadges(config);

  assert.equal(response.response?.badges?.length, 3);
  assert.equal(response.response?.player_xp, 5_740);
  assert.equal(requests.length, 1);
  const request = requests[0];
  assert.ok(request !== undefined);
  const url = new URL(request.url);
  assert.equal(url.pathname.endsWith("/IPlayerService/GetBadges/v1/"), true);
  assert.equal(url.searchParams.get("key"), null);
  assert.equal(url.searchParams.get("steamid"), config.steamId64);
  assert.equal(url.searchParams.get("format"), "json");
  assert.equal(request.init?.method, "GET");
  assert.equal(request.init?.cache, "no-store");
  const headers = new Headers(request.init?.headers);
  assert.equal(headers.get("Accept"), "application/json");
  assert.equal(headers.get("Cache-Control"), null);
  assert.equal(headers.get("Pragma"), null);
  assert.equal(url.searchParams.get("key"), null);
});

test("steam provider tolerates steam level failures without failing the dashboard", async () => {
  const config = normalizeSteamProviderConfig({
    steamId64: "12345678901234567",
    apiKey: "api-key",
    language: "english",
    recentAchievementsCount: 5,
    recentlyPlayedCount: 5,
    includePlayedFreeGames: false,
  });
  const provider = createSteamProvider({
    client: {
      async loadPlayerSummaries(config) {
        return {
          response: {
            players: [
              {
                steamid: config.steamId64,
                personaname: "Steam User",
                avatarfull: "https://cdn.steam.com/avatar.jpg",
              } satisfies RawSteamPlayerSummary,
            ],
          },
        };
      },
      async loadSteamLevel() {
        throw new Error("Steam level unavailable.");
      },
      async loadBadges() {
        throw new Error("Steam badges unavailable.");
      },
      async loadRecentlyPlayedGames() {
        return {
          response: {
            games: [
              {
                appid: 98765,
                name: "Steam Test Game",
                playtime_forever: 42,
                img_icon_url: "https://cdn.steam.com/game-icon.jpg",
                img_logo_url: "https://cdn.steam.com/game-box.jpg",
                has_community_visible_stats: true,
              } satisfies RawSteamRecentlyPlayedGame,
            ],
          },
        };
      },
      async loadPlayerAchievements() {
        return {
          playerstats: {
            success: true,
            achievements: [
              {
                apiname: "ACH_WIN",
                achieved: 1,
                unlocktime: 1_700_000_000,
              } satisfies RawSteamPlayerAchievement,
            ],
          },
        };
      },
      async loadSchemaForGame() {
        return {
          game: {
            availableGameStats: {
              achievements: [
                {
                  name: "ACH_WIN",
                  displayName: "Win One",
                  description: "Unlock the first win",
                  icon: "https://cdn.steam.com/icon.png",
                  icongray: "https://cdn.steam.com/icongray.png",
                  hidden: 0,
                } satisfies RawSteamSchemaAchievement,
              ],
            },
          },
        };
      },
      async loadGlobalAchievementPercentagesForApp() {
        return {
          achievementpercentages: {
            achievements: [
              {
                name: "ACH_WIN",
                percent: 12.5,
              },
            ],
          },
        };
      },
    },
  });

  const profile = await provider.loadProfile(config);

  assert.equal(profile.identity.displayName, "Steam User");
  assert.equal(profile.metrics.find((metric) => metric.key === "steam-level"), undefined);
  assert.deepStrictEqual(
    buildProviderOverviewStats(profile).map((stat) => `${stat.label}:${stat.value}`),
    [
      "Achievements Unlocked:1",
      "Owned Games:-",
      "Perfect Games:1",
      "Completion:100%",
    ],
  );
});

test("steam provider persists normalized badge summaries on profile load", async () => {
  const config = normalizeSteamProviderConfig({
    steamId64: "12345678901234567",
    apiKey: "api-key",
    language: "english",
    recentAchievementsCount: 5,
    recentlyPlayedCount: 5,
    includePlayedFreeGames: false,
  });
  const provider = createSteamProvider({
    client: {
      async loadPlayerSummaries(config) {
        return {
          response: {
            players: [
              {
                steamid: config.steamId64,
                personaname: "Steam User",
                avatarfull: "https://cdn.steam.com/avatar.jpg",
              } satisfies RawSteamPlayerSummary,
            ],
          },
        };
      },
      async loadSteamLevel() {
        return { response: { player_level: 29 } satisfies RawSteamGetSteamLevelResponse };
      },
      async loadBadges() {
        return {
          response: {
            badges: [
              {
                badgeid: 1,
                appid: 12345,
                level: 4,
                xp: 250,
                completion_time: 1_700_000_000,
              } satisfies RawSteamBadge,
            ],
            player_xp: 5_740,
          },
        };
      },
      async loadRecentlyPlayedGames() {
        return {
          response: {
            games: [],
          },
        };
      },
      async loadPlayerAchievements() {
        return {
          playerstats: {
            success: true,
            achievements: [],
          },
        };
      },
      async loadSchemaForGame() {
        return {
          game: {
            availableGameStats: {
              achievements: [],
            },
          },
        };
      },
      async loadGlobalAchievementPercentagesForApp() {
        return {
          achievementpercentages: {
            achievements: [],
          },
        };
      },
    },
  });

  const profile = await provider.loadProfile(config);

  assert.equal(profile.steamLevel, 29);
  assert.equal(profile.badgeCount, 1);
  assert.equal(profile.playerXp, 5_740);
  assert.equal(profile.steamBadges?.length, 1);
  assert.equal(profile.steamBadges?.[0]?.badgeId, "1");
  assert.equal(profile.steamBadges?.[0]?.appId, 12345);
  assert.equal(profile.steamBadges?.[0]?.completedAt, "2023-11-14T22:13:20.000Z");
});

test("steam provider reuses recent game snapshots across one dashboard refresh", async () => {
  const callCounts = {
    recentlyPlayedGames: 0,
    playerAchievements: 0,
    schemaForGame: 0,
    globalPercentages: 0,
  };
  const provider = createSteamProvider({
    client: {
      async loadPlayerSummaries(config) {
        return {
          response: {
            players: [
              {
                steamid: config.steamId64,
                personaname: "Steam User",
                avatarfull: "https://cdn.steam.com/avatar.jpg",
              } satisfies RawSteamPlayerSummary,
            ],
          },
        };
      },
      async loadSteamLevel() {
        return { response: { player_level: 29 } satisfies RawSteamGetSteamLevelResponse };
      },
      async loadBadges() {
        return {
          response: {
            badges: [],
            player_xp: 5_740,
          },
        };
      },
      async loadRecentlyPlayedGames() {
        callCounts.recentlyPlayedGames += 1;
        return {
          response: {
            games: [
              {
                appid: 220,
                name: "Test Game",
                playtime_forever: 42,
                has_community_visible_stats: true,
              } satisfies RawSteamRecentlyPlayedGame,
            ],
          },
        };
      },
      async loadPlayerAchievements() {
        callCounts.playerAchievements += 1;
        return {
          playerstats: {
            success: true,
            achievements: [
              {
                apiname: "ACH_WIN",
                achieved: 1,
                unlocktime: 1_700_000_000,
              } satisfies RawSteamPlayerAchievement,
            ],
          },
        };
      },
      async loadSchemaForGame() {
        callCounts.schemaForGame += 1;
        return {
          game: {
            availableGameStats: {
              achievements: [
                {
                  name: "ACH_WIN",
                  displayName: "Win One",
                  description: "Unlock the first win",
                  icon: "https://cdn.steam.com/icon.png",
                  icongray: "https://cdn.steam.com/icongray.png",
                  hidden: 0,
                } satisfies RawSteamSchemaAchievement,
              ],
            },
          },
        };
      },
      async loadGlobalAchievementPercentagesForApp() {
        callCounts.globalPercentages += 1;
        return {
          achievementpercentages: {
            achievements: [
              {
                name: "ACH_WIN",
                percent: 12.5,
              },
            ],
          },
        };
      },
    },
  });
  const config = normalizeSteamProviderConfig({
    steamId64: "12345678901234567",
    apiKey: "api-key",
    language: "english",
    recentAchievementsCount: 5,
    recentlyPlayedCount: 5,
    includePlayedFreeGames: false,
  });

  const [profile, recentUnlocks, recentlyPlayedGames, completionProgress] = await Promise.all([
    provider.loadProfile(config),
    provider.loadRecentUnlocks(config, {
      limit: 5,
    }),
    provider.loadRecentlyPlayedGames(config, {
      count: 5,
    }),
    provider.loadCompletionProgress(config),
  ]);
  const gameProgress = await provider.loadGameProgress(config, "220");

  assert.equal(profile.identity.displayName, "Steam User");
  assert.equal(recentUnlocks.length, 1);
  assert.equal(recentlyPlayedGames.length, 1);
  assert.equal(completionProgress.length, 1);
  assert.equal(gameProgress.game.gameId, "220");
  assert.equal(callCounts.recentlyPlayedGames, 1);
  assert.equal(callCounts.playerAchievements, 1);
  assert.equal(callCounts.schemaForGame, 1);
  assert.equal(callCounts.globalPercentages, 1);
});

test("steam badge normalization preserves badge details defensively", () => {
  const normalized = normalizeSteamBadges({
    response: {
      badges: [
        {
          badgeid: 42,
          appid: 12345,
          level: 7,
          xp: 320,
          scarcity: 12,
          completion_time: 1_700_000_000,
        } satisfies RawSteamBadge,
        {
          badge_id: 7,
        } satisfies RawSteamBadge,
      ],
      player_xp: 5_740,
    },
  } satisfies RawSteamGetBadgesResponse);

  assert.equal(normalized.badgeCount, 2);
  assert.equal(normalized.playerXp, 5_740);
  assert.equal(normalized.steamBadges?.length, 2);
  assert.equal(normalized.steamBadges?.[0]?.badgeId, "42");
  assert.equal(normalized.steamBadges?.[0]?.appId, 12345);
  assert.equal(normalized.steamBadges?.[0]?.level, 7);
  assert.equal(normalized.steamBadges?.[0]?.xp, 320);
  assert.equal(normalized.steamBadges?.[0]?.scarcity, 12);
  assert.equal(normalized.steamBadges?.[0]?.completedAt, "2023-11-14T22:13:20.000Z");
  assert.equal(normalized.steamBadges?.[1]?.badgeId, "7");
  assert.equal(normalized.steamBadges?.[1]?.completedAt, undefined);
});

test("steam badge summary cards reduce redundant account stats", () => {
  const formattedXp = new Intl.NumberFormat(undefined).format(5_740);
  assert.deepStrictEqual(
    getSteamBadgeSummaryCards({
      badgeCount: 9,
      playerXp: 5_740,
    }),
    [
      {
        label: "Badges",
        value: "9",
        secondary: `${formattedXp} XP`,
      },
      {
        label: "Total XP",
        value: formattedXp,
      },
    ],
  );
});

test("fullscreen settings back target preserves compact and fullscreen-profile origins", () => {
  assert.equal(resolveFullScreenSettingsBackTarget("compact-panel"), "compact-panel");
  assert.equal(resolveFullScreenSettingsBackTarget("fullscreen-profile"), "previous-fullscreen");

  markNextFullScreenSettingsBackTarget("previous-fullscreen");
  assert.equal(consumeNextFullScreenSettingsBackTarget(), "previous-fullscreen");
  assert.equal(consumeNextFullScreenSettingsBackTarget(), "compact-panel");
});

test("fullscreen game route suppresses unmount when opening an achievement from the game page", () => {
  assert.equal(shouldSuppressGameRouteUnmountWhenOpeningAchievement("decky-panel"), true);
  assert.equal(shouldSuppressGameRouteUnmountWhenOpeningAchievement("completion-progress"), true);
});

test("fullscreen game route preserves its original back behavior across achievement round trips", () => {
  const providerId = "steam";
  const gameId = "1482380";

  markFullScreenGameRouteBackBehavior(providerId, gameId, "completion-progress");
  assert.equal(
    resolveFullScreenGameRouteBackBehavior(providerId, gameId),
    "completion-progress",
  );

  markFullScreenGameRouteBackBehavior(providerId, gameId, "decky-panel");
  assert.equal(resolveFullScreenGameRouteBackBehavior(providerId, gameId), "decky-panel");
});

test("fullscreen return context writes provider dashboard payload and game payload", async () => {
  await withMockDeckyStorage(async () => {
    const dashboardContext = createDeckyFullscreenReturnContextForProviderDashboard("retroachievements");
    const dashboardPersisted = writeDeckyFullscreenReturnContext(dashboardContext);
    assert.ok(dashboardPersisted !== undefined);

    const dashboardStored = readDeckyStorageText(DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY);
    assert.ok(dashboardStored !== undefined);
    assert.deepStrictEqual(JSON.parse(dashboardStored), {
      providerId: "retroachievements",
      deckyReturnView: "provider-dashboard",
      focusTarget: "open-full-screen",
      createdAt: dashboardPersisted?.createdAt,
      returnRequested: false,
    });

    const gameContext = createDeckyFullscreenReturnContextForGame({
      providerId: "steam",
      gameId: "1482380",
      gameTitle: "Test Game",
    });
    const gamePersisted = writeDeckyFullscreenReturnContext(gameContext);
    assert.ok(gamePersisted !== undefined);

    const gameStored = readDeckyStorageText(DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY);
    assert.ok(gameStored !== undefined);
    assert.deepStrictEqual(JSON.parse(gameStored), {
      providerId: "steam",
      deckyReturnView: "game",
      gameId: "1482380",
      gameTitle: "Test Game",
      focusTarget: "open-full-screen",
      createdAt: gamePersisted?.createdAt,
      returnRequested: false,
    });
  });
});

test("fullscreen return context marking requested updates the stored payload", async () => {
  await withMockDeckyStorage(async () => {
    const context = createDeckyFullscreenReturnContextForGame({
      providerId: "steam",
      gameId: "1482380",
      gameTitle: "Test Game",
    });
    const persisted = writeDeckyFullscreenReturnContext(context);
    assert.ok(persisted !== undefined);

    const updated = markDeckyFullscreenReturnRequested();
    assert.ok(updated !== undefined);
    assert.equal(updated?.createdAt, persisted?.createdAt);
    assert.equal(updated?.returnRequested, true);

    const stored = readDeckyStorageText(DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY);
    assert.ok(stored !== undefined);
    assert.deepStrictEqual(JSON.parse(stored), {
      providerId: "steam",
      deckyReturnView: "game",
      gameId: "1482380",
      gameTitle: "Test Game",
      focusTarget: "open-full-screen",
      createdAt: persisted?.createdAt,
      returnRequested: true,
    });
  });
});

test("fullscreen return context clear removes the stored payload", async () => {
  await withMockDeckyStorage(async () => {
    const context = createDeckyFullscreenReturnContextForProviderDashboard("retroachievements");
    assert.ok(writeDeckyFullscreenReturnContext(context) !== undefined);
    assert.equal(clearDeckyFullscreenReturnContext(), true);
    assert.equal(readDeckyStorageText(DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY), undefined);
  });
});

test("fullscreen return context invalid json is ignored safely", async () => {
  await withMockDeckyStorage(async () => {
    globalThis.localStorage?.setItem(DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY, "{invalid-json");
    assert.equal(readDeckyFullscreenReturnContext(), undefined);
    assert.equal(markDeckyFullscreenReturnRequested(), undefined);
    assert.equal(consumeDeckyFullscreenReturnContext(), undefined);
  });
});

test("fullscreen return context restores provider dashboard selection only when requested", async () => {
  await withMockDeckyStorage(async () => {
    const context = writeDeckyFullscreenReturnContext(
      createDeckyFullscreenReturnContextForProviderDashboard("retroachievements"),
    );
    assert.ok(context !== undefined);

    assert.equal(consumeDeckyFullscreenReturnContext(), undefined);
    assert.equal(readDeckyStorageText(DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY), JSON.stringify(context));

    assert.ok(markDeckyFullscreenReturnRequested() !== undefined);
    const restored = consumeDeckyFullscreenReturnContext();
    assert.deepStrictEqual(restored?.selection, {
      selectedProviderId: "retroachievements",
    });
    assert.equal(readDeckyStorageText(DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY), undefined);
  });
});

test("fullscreen return context restores steam provider dashboard selection when requested", async () => {
  await withMockDeckyStorage(async () => {
    assert.ok(
      writeDeckyFullscreenReturnContext(createDeckyFullscreenReturnContextForProviderDashboard("steam")) !==
        undefined,
    );
    assert.ok(markDeckyFullscreenReturnRequested() !== undefined);

    const restored = consumeDeckyFullscreenReturnContext();
    assert.deepStrictEqual(restored?.selection, {
      selectedProviderId: "steam",
    });
    assert.equal(readDeckyStorageText(DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY), undefined);
  });
});

test("fullscreen return context restores game selection only when requested", async () => {
  await withMockDeckyStorage(async () => {
    const context = writeDeckyFullscreenReturnContext(
      createDeckyFullscreenReturnContextForGame({
        providerId: "steam",
        gameId: "1482380",
        gameTitle: "Test Game",
      }),
    );
    assert.ok(context !== undefined);
    assert.ok(markDeckyFullscreenReturnRequested() !== undefined);

    const restored = consumeDeckyFullscreenReturnContext();
    assert.deepStrictEqual(restored?.selection, {
      selectedProviderId: "steam",
      selectedGame: {
        providerId: "steam",
        gameId: "1482380",
        gameTitle: "Test Game",
      },
    });
    assert.equal(readDeckyStorageText(DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY), undefined);
  });
});

test("fullscreen return context helper captures provider dashboard and game origins", () => {
  const dashboardContext = createDeckyFullscreenReturnContextForProviderDashboard("retroachievements");
  assert.deepStrictEqual(dashboardContext, {
    providerId: "retroachievements",
    deckyReturnView: "provider-dashboard",
    focusTarget: "open-full-screen",
  });

  const gameContext = createDeckyFullscreenReturnContextForGame({
    providerId: "steam",
    gameId: "1482380",
    gameTitle: "Test Game",
  });
  assert.deepStrictEqual(gameContext, {
    providerId: "steam",
    deckyReturnView: "game",
    gameId: "1482380",
    gameTitle: "Test Game",
    focusTarget: "open-full-screen",
  });
  assert.deepStrictEqual(restoreDeckyFullscreenSelectionFromContext(gameContext), {
    selectedProviderId: "steam",
    selectedGame: {
      providerId: "steam",
      gameId: "1482380",
      gameTitle: "Test Game",
    },
  });
  assert.deepStrictEqual(restoreDeckyFullscreenSelectionFromContext(dashboardContext), {
    selectedProviderId: "retroachievements",
  });
});

test("fullscreen back button ownerWindow registers the cancel bridge", () => {
  resetFullscreenCancelBridgeForTests();
  const addCalls: Array<{ readonly type: string; readonly capture: boolean }> = [];

  const ownerWindow = {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, capture?: boolean) {
      addCalls.push({ type, capture: capture === true });
      void listener;
    },
    removeEventListener() {},
  } as Window;
  const ownerDocument = {
    defaultView: ownerWindow,
    querySelectorAll() {
      return [];
    },
  } as Document;
  const buttonElement = {
    ownerDocument,
  } as Element;

  try {
    ensureFullscreenCancelBridgeRegisteredForBackButtonElement(buttonElement);
    ensureFullscreenCancelBridgeRegisteredForBackButtonElement(buttonElement);

    assert.deepStrictEqual(addCalls, [
      {
        type: "vgp_oncancel",
        capture: true,
      },
    ]);
  } finally {
    resetFullscreenCancelBridgeForTests();
  }
});

test("fullscreen cancel bridge helper tolerates a missing element", () => {
  resetFullscreenCancelBridgeForTests();
  const addCalls: Array<{ readonly type: string; readonly capture: boolean }> = [];

  const restoreWindow = setGlobalTestValue("window", {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, capture?: boolean) {
      addCalls.push({ type, capture: capture === true });
      void listener;
    },
    removeEventListener() {},
  } as Window);

  try {
    ensureFullscreenCancelBridgeRegisteredForBackButtonElement(null);
    assert.deepStrictEqual(addCalls, []);
  } finally {
    restoreWindow();
    resetFullscreenCancelBridgeForTests();
  }
});

test("fullscreen cancel bridge helper tolerates a missing owner window", () => {
  resetFullscreenCancelBridgeForTests();
  const addCalls: Array<{ readonly type: string; readonly capture: boolean }> = [];
  const restoreWindow = setGlobalTestValue("window", {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, capture?: boolean) {
      addCalls.push({ type, capture: capture === true });
      void listener;
    },
    removeEventListener() {},
  } as Window);

  try {
    ensureFullscreenCancelBridgeRegisteredForBackButtonElement({
      ownerDocument: undefined,
    } as Element);
    assert.deepStrictEqual(addCalls, []);
  } finally {
    restoreWindow();
    resetFullscreenCancelBridgeForTests();
  }
});

test("fullscreen cancel bridge stops a synthetic cancel event and clicks the marked visible back button", () => {
  resetFullscreenCancelBridgeForTests();
  const clickCounts = new Map<string, number>();
  const eventCalls: string[] = [];
  let registeredListener: ((event: Event) => void) | undefined;

  const ownerWindow = {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === "vgp_oncancel") {
        registeredListener = listener as (event: Event) => void;
      }
    },
    removeEventListener() {},
  } as Window;
  const ownerDocument = {
    defaultView: ownerWindow,
    querySelectorAll() {
      return [
        {
          disabled: false,
          isConnected: true,
          innerText: "Back",
          getClientRects() {
            return [{}, {}];
          },
          click() {
            clickCounts.set("back", (clickCounts.get("back") ?? 0) + 1);
          },
        },
      ];
    },
  } as Document;

  try {
    ensureFullscreenCancelBridgeRegisteredForBackButtonElement({
      ownerDocument,
    } as Element);

    const cancelEvent = {
      type: "vgp_oncancel",
      preventDefault() {
        eventCalls.push("preventDefault");
      },
      stopPropagation() {
        eventCalls.push("stopPropagation");
      },
      stopImmediatePropagation() {
        eventCalls.push("stopImmediatePropagation");
      },
    } as Event;

    registeredListener?.(cancelEvent);

    assert.deepStrictEqual(eventCalls, [
      "preventDefault",
      "stopPropagation",
      "stopImmediatePropagation",
    ]);
    assert.equal(clickCounts.get("back"), 1);
  } finally {
    resetFullscreenCancelBridgeForTests();
  }
});

test("fullscreen cancel bridge ignores hidden marked buttons and leaves cancel unhandled", () => {
  resetFullscreenCancelBridgeForTests();
  const eventCalls: string[] = [];
  let registeredListener: ((event: Event) => void) | undefined;

  const restoreWindow = setGlobalTestValue("window", {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === "vgp_oncancel") {
        registeredListener = listener as (event: Event) => void;
      }
    },
    removeEventListener() {},
  } as Window);
  const ownerDocument = {
    querySelectorAll() {
      return [
        {
          disabled: false,
          isConnected: true,
          innerText: "Back",
          getClientRects() {
            return [];
          },
          click() {
            eventCalls.push("click");
          },
        },
      ];
    },
  } as Document;

  try {
    ensureFullscreenCancelBridgeRegisteredForBackButtonElement({
      ownerDocument,
    } as Element);

    const cancelEvent = {
      type: "vgp_oncancel",
      preventDefault() {
        eventCalls.push("preventDefault");
      },
      stopPropagation() {
        eventCalls.push("stopPropagation");
      },
      stopImmediatePropagation() {
        eventCalls.push("stopImmediatePropagation");
      },
    } as Event;

    registeredListener?.(cancelEvent);

    assert.deepStrictEqual(eventCalls, []);
  } finally {
    restoreWindow();
    resetFullscreenCancelBridgeForTests();
  }
});

test("fullscreen cancel bridge leaves cancel alone when no marked back button exists", () => {
  resetFullscreenCancelBridgeForTests();
  const eventCalls: string[] = [];
  let registeredListener: ((event: Event) => void) | undefined;

  const restoreWindow = setGlobalTestValue("window", {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === "vgp_oncancel") {
        registeredListener = listener as (event: Event) => void;
      }
    },
    removeEventListener() {},
  } as Window);
  const ownerDocument = {
    querySelectorAll() {
      return [];
    },
  } as Document;

  try {
    ensureFullscreenCancelBridgeRegisteredForBackButtonElement({
      ownerDocument,
    } as Element);

    const cancelEvent = {
      type: "vgp_oncancel",
      preventDefault() {
        eventCalls.push("preventDefault");
      },
      stopPropagation() {
        eventCalls.push("stopPropagation");
      },
      stopImmediatePropagation() {
        eventCalls.push("stopImmediatePropagation");
      },
    } as Event;

    registeredListener?.(cancelEvent);

    assert.deepStrictEqual(eventCalls, []);
  } finally {
    restoreWindow();
    resetFullscreenCancelBridgeForTests();
  }
});

test("dashboard derives recently played games from recent unlocks when provider omits them", async () => {
  const { appServices, counts } = createHarness({
    providerFactory: (callCounts) => ({
      id: PROVIDER_ID,
      capabilities: PROVIDER_CAPABILITIES,
      async loadProfile() {
        callCounts.profile += 1;
        return DASHBOARD_REFRESH_PROFILE;
      },
      async loadRecentUnlocks() {
        callCounts.recentUnlocks += 1;
        return [
          createRecentUnlockForGame(
            "3215050",
            "Surviving Mars: Relaunched",
            1,
            1_700_000_000_900,
          ),
          createRecentUnlockForGame(
            "3215050",
            "Surviving Mars: Relaunched",
            2,
            1_700_000_000_800,
          ),
        ];
      },
      async loadRecentlyPlayedGames() {
        callCounts.recentlyPlayedGames += 1;
        return [];
      },
      async loadGameProgress() {
        callCounts.gameProgress += 1;
        return createGameDetailSnapshot();
      },
    }),
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.dashboard.loadDashboard(PROVIDER_ID);

  assert.equal(state.status, "success");
  assert.equal(state.error, undefined);
  assert.equal(state.data?.recentAchievements.length, 2);
  assert.equal(state.data?.recentlyPlayedGames.length, 1);
  assert.equal(state.data?.recentlyPlayedGames[0]?.title, "Surviving Mars: Relaunched");
  assert.equal(state.data?.recentlyPlayedGames[0]?.lastPlayedAt, undefined);
  assert.equal(counts.profile, 1);
  assert.equal(counts.recentUnlocks, 1);
  assert.equal(counts.recentlyPlayedGames, 1);
});
