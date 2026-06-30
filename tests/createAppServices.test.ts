import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
import type {
  AuthenticatedProviderTransportFactory,
  DashboardSnapshotStore,
  DiagnosticLogger,
  PlatformCapabilities,
  ProviderConfigStore,
  SteamLibraryScanStore,
} from "../src/core/platform";
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
  deckyAuthenticatedProviderTransportFactory,
  mergeDeckySteamLibraryScanRecentAchievements,
  deckyPlatformCapabilities,
  resetDeckyAppServicesForTests,
} from "../src/platform/decky/decky-app-services";
import { setDeckyBackendCallImplementationForTests } from "../src/platform/decky/decky-backend-bridge";
import {
  formatRetroAchievementsBeatenAtText,
  buildAchievementStatus,
  dedupeDistinctLabels,
  formatRetroAchievementsMasteredAtText,
  formatProviderAchievementPointsText,
  formatProviderAchievementStatusText,
  formatProviderAchievementUnlockRateText,
  getAchievementCounts,
  getAchievementDescriptionText,
  getAchievementDetailCounts,
  formatAchievementDetailUnlockRatePercent,
  hasAchievementCounts,
  getAchievementSpotlightCounts,
  formatAchievementUnlockRatePercent,
  formatAchievementUnlockRateValue,
  formatAchievementUnlockModeLabel,
  formatModeProgressSummary,
  isSteamAchievementPresentationProvider,
  shouldRenderRetroAchievementsModeSummaryCard,
  shouldHideSteamAchievementDetailStats,
  shouldRenderAchievementModeFilter,
} from "../src/platform/decky/decky-achievement-detail-helpers";
import { sortAchievementsForDisplay } from "../src/platform/decky/decky-game-detail-ordering";
import {
  formatCompletionProgressFilterLabelForProvider,
  formatCompletionProgressStatusLabel,
  formatCompletionProgressSummary,
  formatProfileMemberSince,
  getRetroAchievementsProfileSectionAccentStyle,
  getRetroAchievementsProfileSectionStyle,
  getRetroAchievementsProfileSectionTitleStyle,
  formatSteamPlaytimeMinutes,
  getSteamCompletionProgressGameDetailId,
  getSteamAccountProgressCards,
  getSteamAccountProgressSummary,
  getRetroAchievementsProfileStatSections,
  getSteamProfileStats,
} from "../src/platform/decky/decky-stat-helpers";
import {
  buildRetroAchievementsProfileOverviewStatSections,
} from "../src/platform/decky/decky-overview-stats";
import {
  buildCompletionProgressSummaryCards,
} from "../src/platform/decky/decky-completion-progress-summary-card-data";
import {
  formatRetroAchievementsCompletionIndicatorLabel,
  getRetroAchievementsCompletionIndicatorState,
  getRetroAchievementsCompletionIndicatorStyle,
  isRetroAchievementsBeatenGame,
  isRetroAchievementsMasteredHardcoreGame,
} from "../src/platform/decky/decky-retroachievements-completion-indicator";
import {
  addProfileAvatarCacheBustParam,
} from "../src/platform/decky/decky-avatar-cache-busting";
import {
  ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_GLOBAL_NAME,
  resolveAchievementCompanionRuntimeDebugHostContext,
} from "../src/platform/decky/decky-runtime-debug";
import {
  DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN,
  detectDeckyGamePageAchievementRouteFromUrl,
  resolveDeckyGamePageAchievementAppIdFromRouteProps,
} from "../src/platform/decky/decky-game-page-achievement-route";
import {
  hasVisibleDeckyGamePageModal,
  isVisibleDeckyGamePageModalElement,
} from "../src/platform/decky/decky-game-page-achievement-modal-visibility";
import {
  clearDeckyGamePageAchievementSummaryCacheForTests,
  formatDeckyGamePageAchievementBadgeLabel,
  loadDeckyGamePageAchievementSummary,
} from "../src/platform/decky/decky-game-page-achievement-summary";
import {
  DECKY_ACHIEVEMENT_FILTER_GROUP_CLASS,
  DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS,
  DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS,
  DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS,
  DECKY_FULLSCREEN_ACTION_ROW_CENTERED_CLASS,
  DECKY_FULLSCREEN_ACTION_ROW_CLASS,
  DECKY_FULLSCREEN_CHIP_CLASS,
  DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS,
  getDeckyFocusStylesCss,
} from "../src/platform/decky/decky-focus-styles";
import { getDeckyFullscreenActionStylesCss } from "../src/platform/decky/decky-full-screen-action-styles";
import {
  clearDeckyDashboardSnapshot,
  readDeckyDashboardSnapshotCacheEntry,
  readDeckyDashboardSnapshotState,
  deckyDashboardSnapshotStore,
  writeDeckyDashboardSnapshot,
} from "../src/platform/decky/decky-dashboard-snapshot-cache";
import {
  deckyDiagnosticLogger,
  type DeckyDiagnosticEventPayload,
} from "../src/platform/decky/decky-diagnostic-logger";
import {
  DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY,
  consumeDeckyFullscreenReturnContext,
  createDeckyFullscreenReturnContextForAchievement,
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
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../src/providers/retroachievements/config";
import type { DeckyProviderConfigValue } from "../src/platform/decky/providers/provider-config-store";
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
  deckySteamLibraryScanStore,
  loadDeckyProviderConfig as loadDeckySteamProviderConfig,
  readDeckySteamLibraryAchievementScanOverview,
  readDeckySteamLibraryAchievementScanSummary,
  readDeckySteamProviderConfig,
  writeDeckySteamLibraryAchievementScanSummary,
  writeDeckySteamProviderConfig,
  type SteamLibraryAchievementScanOverview,
  type SteamLibraryAchievementScanSummary,
} from "../src/platform/decky/providers/steam/config";
import { STEAM_PROVIDER_ID } from "../src/providers/steam";
import {
  clearDeckyProviderConfigCache,
  deckyProviderConfigStore,
  updateDeckyProviderConfigCache,
} from "../src/platform/decky/providers/provider-config-store";
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
  clearNextFullScreenSettingsBackTarget,
  markFullScreenGameRouteBackBehavior,
  markNextFullScreenSettingsBackTarget,
  popFullScreenGameRouteBackBehavior,
  peekNextFullScreenSettingsBackTarget,
  pushFullScreenGameRouteAchievementReturnTarget,
  resolveFullScreenGameRouteAchievementReturnTarget,
  resolveFullScreenGameRouteBackBehavior,
  resolveFullScreenSettingsBackTarget,
  shouldSuppressGameRouteUnmountWhenOpeningAchievement,
} from "../src/platform/decky/decky-full-screen-navigation-state";
import {
  ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement,
  ensureFullscreenCancelBridgeRegisteredForBackButtonElement,
  resetCompactAchievementCancelBridgeForTests,
  resetFullscreenCancelBridgeForTests,
} from "../src/platform/decky/decky-full-screen-cancel-bridge";
import type { SteamLibraryAchievementScanSummary } from "../src/platform/decky/providers/steam";
import {
  countCompletionProgressSubsetGames,
  filterCompletionProgressGamesBySubsetVisibility,
  groupCompletionProgressGames,
  summarizeCompletionProgressSummaryBySubsetVisibility,
} from "../src/platform/decky/decky-completion-progress-grouping";
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
  RawRetroAchievementsSystemResponse,
} from "../src/providers/retroachievements/raw-types";
import {
  readDeckyStorageText,
  writeDeckyStorageText,
} from "../src/platform/decky/storage";
import {
  createRetroAchievementsClient,
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
  mergeSteamRecentlyPlayedCandidates,
  mergeSteamRecentlyPlayedLastPlayedTimes,
  sortSteamRecentlyPlayedGamesNewestFirst,
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

function collectSourceFiles(rootDir: string): readonly string[] {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(entryPath));
      continue;
    }

    if (entry.isFile() && /\.(ts|tsx|py)$/u.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

function readSourceTree(rootDir: string): string {
  return collectSourceFiles(rootDir)
    .map((filePath) => readFileSync(filePath, "utf-8"))
    .join("\n");
}

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

function createDeferredPromise<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
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
  readonly completionProgressEntries?: readonly RawRetroAchievementsCompletionProgressEntry[];
  readonly gameProgressByGameId?: Readonly<Record<string, RawRetroAchievementsGameProgressResponse>>;
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
  readonly shortcutMetadataByAppId?: Readonly<Record<string, { readonly title: string }>>;
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

  if (route === "request_retroachievements_json") {
    const path = typeof record?.path === "string" ? record.path : "";
    if (path === "API_GetUserCompletionProgress.php") {
      const entries = deckyBackendTestState.retroAchievements.completionProgressEntries;
      if (entries === undefined) {
        throw new Error("Unexpected RetroAchievements completion progress request in test");
      }

      return {
        Count: entries.length,
        Total: entries.length,
        Results: entries,
      };
    }

    if (path === "API_GetGameInfoAndUserProgress.php") {
      const gameId = typeof record?.query === "object" && record.query !== null
        ? (() => {
            const query = record.query as Record<string, unknown>;
            const rawGameId = query["g"];
            return typeof rawGameId === "string"
              ? rawGameId.trim()
              : typeof rawGameId === "number"
                ? String(rawGameId)
                : "";
          })()
        : "";

      if (gameId.length === 0) {
        throw new Error("Unexpected RetroAchievements game progress request without a game id in test");
      }

      const response = deckyBackendTestState.retroAchievements.gameProgressByGameId?.[gameId];
      if (response === undefined) {
        throw new Error(`Unexpected RetroAchievements game progress request for game id ${gameId} in test`);
      }

      return response;
    }

    throw new Error(`Unexpected RetroAchievements backend request path in test: ${path}`);
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

  if (route === "get_steam_shortcut_metadata") {
    const appId =
      typeof record?.appId === "string"
        ? record.appId
        : typeof record?.appId === "number"
          ? String(record.appId)
          : "";
    const metadata = deckyBackendTestState.steam.shortcutMetadataByAppId?.[appId];
    return metadata === undefined
      ? undefined
      : {
          appId,
          title: metadata.title,
        };
  }

  throw new Error(`Unexpected decky backend route in test: ${route}`);
};

setDeckyBackendCallImplementationForTests(deckyBackendTestCallImplementation);

beforeEach(() => {
  resetDeckyBackendTestState();
  clearDeckyProviderConfigCache("retroachievements");
  clearDeckyProviderConfigCache("steam");
  clearDeckySteamLibraryAchievementScanSummary();
  clearDeckyGamePageAchievementSummaryCacheForTests();
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

function createRetroAchievementsGameProgressResponse(args: {
  readonly gameId: string;
  readonly title: string;
  readonly consoleName?: string;
  readonly highestAwardKind?: string;
  readonly highestAwardDate?: string;
  readonly unlockedCount?: number;
  readonly totalCount?: number;
  readonly hardcoreUnlockedCount?: number;
}): RawRetroAchievementsGameProgressResponse {
  const unlockedCount = args.unlockedCount ?? 1;
  const totalCount = args.totalCount ?? Math.max(unlockedCount, 1);

  return {
    ID: args.gameId,
    Title: args.title,
    ConsoleName: args.consoleName ?? "NES",
    NumAchievements: totalCount,
    NumAwardedToUser: unlockedCount,
    ...(args.hardcoreUnlockedCount !== undefined
      ? { NumAwardedToUserHardcore: args.hardcoreUnlockedCount }
      : {}),
    UserCompletion: totalCount > 0 ? `${((unlockedCount / totalCount) * 100).toFixed(2)}%` : undefined,
    ...(args.highestAwardKind !== undefined ? { HighestAwardKind: args.highestAwardKind } : {}),
    ...(args.highestAwardDate !== undefined ? { HighestAwardDate: args.highestAwardDate } : {}),
    Achievements: {
      "1": {
        ID: 1,
        Title: "Achievement One",
        Description: "Test achievement",
        Points: 1,
        NumAwarded: 100,
        NumAwardedHardcore: 50,
        BadgeName: "badge-1",
        DisplayOrder: 0,
      },
    },
  };
}

test("retroachievements game progress normalizes achievement badge art", () => {
  const rawGameProgress: RawRetroAchievementsGameProgressResponse = {
    ID: 14402,
    Title: "Dragster",
    ConsoleName: "Atari 2600",
    ImageIcon: "/Images/026368.png",
    ImageBoxArt: "/Images/066952.png",
    NumAchievements: 2,
    NumAwardedToUser: 2,
    NumAwardedToUserHardcore: 1,
    UserCompletion: "100.00%",
    UserCompletionHardcore: "50.00%",
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
      "79435": {
        ID: 79435,
        Title: "Novice Dragster Driver 2",
        Description: "Complete your second race in game 1.",
        Points: 2,
        NumAwarded: 120,
        NumAwardedHardcore: 60,
        BadgeName: "85542",
        DisplayOrder: 1,
        DateEarned: "2022-09-01 22:56:38",
      },
    },
  };

  const snapshot = normalizeRetroAchievementsGameDetail(rawGameProgress);

  assert.equal(snapshot.game.hardcoreSummary?.unlockedCount, 1);
  assert.equal(snapshot.game.hardcoreSummary?.totalCount, 2);
  assert.equal(snapshot.game.hardcoreSummary?.completionPercent, 50);
  assert.equal(snapshot.game.softcoreSummary?.unlockedCount, 1);
  assert.equal(snapshot.game.softcoreSummary?.totalCount, 2);
  assert.equal(snapshot.game.softcoreSummary?.completionPercent, 50);
  assert.equal(
    snapshot.achievements[0]?.badgeImageUrl,
    "https://i.retroachievements.org/Badge/85541.png",
  );
  assert.equal(snapshot.achievements[0]?.unlockMode, "hardcore");
  assert.equal(snapshot.achievements[0]?.hardcoreUnlockedAt, Date.parse("2022-08-23T22:56:38Z"));
  assert.equal(snapshot.achievements[0]?.softcoreUnlockedAt, Date.parse("2022-08-23T22:56:38Z"));
  assert.equal(snapshot.achievements[1]?.unlockMode, "softcore");
  assert.equal(snapshot.achievements[1]?.softcoreUnlockedAt, Date.parse("2022-09-01T22:56:38Z"));
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
  assert.equal(snapshot.game.lastUnlockAt, Date.parse("2024-04-23T21:28:49+00:00"));
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
      HardcoreMode: true,
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
      Date: "2024-01-01 01:00:00",
      HardcoreMode: false,
    },
  ];

  const recentUnlocks = normalizeRetroAchievementsRecentUnlocks(rawRecentUnlocks);

  assert.equal(
    recentUnlocks[0]?.achievement.badgeImageUrl,
    "https://i.retroachievements.org/Badge/108302.png",
  );
  assert.equal(recentUnlocks[0]?.achievement.unlockMode, "hardcore");
  assert.equal(recentUnlocks[1]?.achievement.unlockMode, "softcore");
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

test("retroachievements achievement row mode label helper distinguishes hardcore and softcore unlocks", () => {
  assert.equal(
    formatAchievementUnlockModeLabel({
      isUnlocked: true,
      unlockMode: "hardcore",
    }),
    "Hardcore unlocked",
  );

  assert.equal(
    formatAchievementUnlockModeLabel({
      isUnlocked: true,
      unlockMode: "softcore",
    }),
    "Softcore unlocked",
  );

  assert.equal(
    formatAchievementUnlockModeLabel({
      isUnlocked: true,
    }),
    "Unlocked",
  );

  assert.equal(
    formatAchievementUnlockModeLabel({
      isUnlocked: false,
    }),
    "Locked",
  );
});

test("decky game detail mode filter is retroachievements only", () => {
  assert.equal(shouldRenderAchievementModeFilter("retroachievements"), true);
  assert.equal(shouldRenderAchievementModeFilter("steam"), false);
  assert.equal(shouldRenderAchievementModeFilter(undefined), false);
});

test("retroachievements achievement status helper distinguishes hardcore and softcore unlocks", () => {
  assert.deepStrictEqual(
    buildAchievementStatus({
      isUnlocked: true,
      unlockMode: "hardcore",
      unlockedAt: Date.parse("2024-01-01T00:00:00Z"),
    }),
    {
      value: "Hardcore unlocked",
      secondary: `Hardcore unlocked ${new Date(Date.parse("2024-01-01T00:00:00Z")).toLocaleString()}`,
    },
  );

  assert.deepStrictEqual(
    buildAchievementStatus({
      isUnlocked: true,
      unlockMode: "softcore",
      unlockedAt: Date.parse("2024-01-01T01:00:00Z"),
    }),
    {
      value: "Softcore unlocked",
      secondary: `Softcore unlocked ${new Date(Date.parse("2024-01-01T01:00:00Z")).toLocaleString()}`,
    },
  );

  assert.deepStrictEqual(buildAchievementStatus({ isUnlocked: false }), {
    value: "Locked",
  });
});

test("retroachievements mode progress helper falls back safely when data is missing", () => {
  assert.equal(formatModeProgressSummary(undefined, "Hardcore"), "No hardcore progress available.");
  assert.equal(formatModeProgressSummary(undefined, "Softcore"), "No softcore progress available.");
});

test("retroachievements mode summary cards hide empty mode containers and keep meaningful ones", () => {
  const hardcoreAwardGame = {
    providerId: PROVIDER_ID,
    metrics: [
      {
        key: "highest-award-kind",
        label: "Highest Award",
        value: "beaten-hardcore",
      },
    ],
  };
  const softcoreAwardGame = {
    providerId: PROVIDER_ID,
    metrics: [
      {
        key: "highest-award-kind",
        label: "Highest Award",
        value: "beaten",
      },
    ],
  };
  const emptySummary = {
    unlockedCount: 0,
    completionPercent: 0,
  };

  assert.equal(
    shouldRenderRetroAchievementsModeSummaryCard({
      game: { providerId: STEAM_PROVIDER_ID, metrics: [] },
      mode: "softcore",
      summary: emptySummary,
      points: 0,
    }),
    false,
  );
  assert.equal(
    shouldRenderRetroAchievementsModeSummaryCard({
      game: { providerId: PROVIDER_ID, metrics: [] },
      mode: "softcore",
      summary: undefined,
      points: 0,
    }),
    false,
  );
  assert.equal(
    shouldRenderRetroAchievementsModeSummaryCard({
      game: { providerId: PROVIDER_ID, metrics: [] },
      mode: "softcore",
      summary: emptySummary,
      points: 0,
    }),
    false,
  );
  assert.equal(
    shouldRenderRetroAchievementsModeSummaryCard({
      game: { providerId: PROVIDER_ID, metrics: [] },
      mode: "hardcore",
      summary: {
        unlockedCount: 4,
        completionPercent: 50,
      },
      points: 17,
    }),
    true,
  );
  assert.equal(
    shouldRenderRetroAchievementsModeSummaryCard({
      game: { providerId: PROVIDER_ID, metrics: [] },
      mode: "softcore",
      summary: {
        unlockedCount: 0,
        completionPercent: 0,
      },
      points: 8,
    }),
    true,
  );
  assert.equal(
    shouldRenderRetroAchievementsModeSummaryCard({
      game: hardcoreAwardGame,
      mode: "hardcore",
      summary: emptySummary,
      points: 0,
    }),
    true,
  );
  assert.equal(
    shouldRenderRetroAchievementsModeSummaryCard({
      game: hardcoreAwardGame,
      mode: "softcore",
      summary: emptySummary,
      points: 0,
    }),
    false,
  );
  assert.equal(
    shouldRenderRetroAchievementsModeSummaryCard({
      game: softcoreAwardGame,
      mode: "softcore",
      summary: emptySummary,
      points: 0,
    }),
    true,
  );
});

test("provider-aware achievement presentation helpers suppress retro placeholders for steam", () => {
  const unlockedAt = Date.parse("2024-01-01T01:00:00Z");

  assert.equal(isSteamAchievementPresentationProvider("steam"), true);
  assert.equal(isSteamAchievementPresentationProvider("retroachievements"), false);
  assert.equal(
    formatProviderAchievementStatusText("steam", {
      isUnlocked: true,
      unlockedAt,
    }),
    `Unlocked ${new Date(unlockedAt).toLocaleString()}`,
  );
  assert.equal(
    formatProviderAchievementStatusText("retroachievements", {
      isUnlocked: true,
      unlockMode: "hardcore",
      unlockedAt,
    }),
    "Hardcore unlocked",
  );
  assert.equal(formatProviderAchievementPointsText("steam", undefined), undefined);
  assert.equal(formatProviderAchievementPointsText("retroachievements", undefined), "Points unavailable");
  assert.equal(formatProviderAchievementPointsText("steam", 5), "5 points");
  assert.equal(formatProviderAchievementPointsText("steam", 5, "prefixed"), "Points 5");
  assert.equal(formatProviderAchievementUnlockRateText("steam", undefined), undefined);
  assert.equal(
    formatProviderAchievementUnlockRateText("retroachievements", undefined),
    "Unlock rate unavailable",
  );
});

test("retroachievements achievement spotlight counts use game players and award totals", () => {
  const spotlightCounts = getAchievementSpotlightCounts(
    [
      { key: "unlocked-count", label: "Total Players", value: "1082" },
      { key: "hardcore-unlocked-count", label: "Hardcore Unlocks", value: "688" },
    ],
    [{ key: "total-players", label: "Total Players", value: "5253" }],
  );

  assert.equal(spotlightCounts.totalUnlockCount, 1082);
  assert.equal(spotlightCounts.hardcoreUnlockCount, 688);
  assert.equal(spotlightCounts.softcoreUnlockCount, 394);
  assert.equal(spotlightCounts.totalPlayers, 5253);
  assert.equal(spotlightCounts.unlockRatePercent?.toFixed(2), "20.60");
  assert.equal(formatAchievementUnlockRateValue(spotlightCounts.unlockRatePercent), "20.60%");
  assert.equal(
    formatAchievementUnlockRatePercent(spotlightCounts.unlockRatePercent),
    "20.60% unlock rate",
  );
});

test("retroachievements achievement spotlight counts fall back safely when source data is missing", () => {
  const spotlightCounts = getAchievementSpotlightCounts([], []);

  assert.equal(spotlightCounts.softcoreUnlockCount, undefined);
  assert.equal(spotlightCounts.hardcoreUnlockCount, undefined);
  assert.equal(spotlightCounts.totalPlayers, undefined);
  assert.equal(spotlightCounts.unlockRatePercent, undefined);
  assert.equal(formatAchievementUnlockRateValue(spotlightCounts.unlockRatePercent), "-");
  assert.equal(
    formatAchievementUnlockRatePercent(spotlightCounts.unlockRatePercent),
    "Unlock rate unavailable",
  );
});

test("retroachievements achievement detail counts use game players and award totals", () => {
  const detailCounts = getAchievementDetailCounts(
    [
      { key: "unlocked-count", label: "Total Players", value: "1082" },
      { key: "hardcore-unlocked-count", label: "Hardcore Unlocks", value: "688" },
    ],
    [{ key: "total-players", label: "Total Players", value: "5253" }],
  );

  assert.equal(detailCounts.totalUnlockCount, 1082);
  assert.equal(detailCounts.hardcoreUnlockCount, 688);
  assert.equal(detailCounts.softcoreUnlockCount, 394);
  assert.equal(detailCounts.totalPlayers, 5253);
  assert.equal(detailCounts.unlockRatePercent?.toFixed(2), "20.60");
  assert.equal(formatAchievementDetailUnlockRatePercent(detailCounts.unlockRatePercent), "20.60% unlock rate");
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

test("profile avatar cache bust helper preserves query params and updates a safe refresh token", () => {
  const refreshedAt = 1_717_000_000_000;
  const cachedAvatar = addProfileAvatarCacheBustParam(
    "https://example.com/avatar.png?existing=1",
    refreshedAt,
  );

  assert.equal(cachedAvatar !== undefined, true);
  const url = new URL(cachedAvatar ?? "");
  assert.equal(url.searchParams.get("existing"), "1");
  assert.equal(url.searchParams.get("ac_avatar_refresh"), String(refreshedAt));
  assert.equal(url.searchParams.getAll("ac_avatar_refresh").length, 1);

  const updatedAvatar = addProfileAvatarCacheBustParam(
    "https://example.com/avatar.png?existing=1&ac_avatar_refresh=42",
    refreshedAt,
  );
  assert.equal(updatedAvatar !== undefined, true);
  const updatedUrl = new URL(updatedAvatar ?? "");
  assert.equal(updatedUrl.searchParams.get("existing"), "1");
  assert.equal(updatedUrl.searchParams.get("ac_avatar_refresh"), String(refreshedAt));
  assert.equal(updatedUrl.searchParams.getAll("ac_avatar_refresh").length, 1);

  assert.equal(
    addProfileAvatarCacheBustParam("https://example.com/avatar.png", undefined),
    "https://example.com/avatar.png",
  );
  assert.equal(addProfileAvatarCacheBustParam("not a url", refreshedAt), "not a url");
  assert.equal(addProfileAvatarCacheBustParam(undefined, refreshedAt), undefined);
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
    /if \(compactSurface\)[\s\S]*Leave the API key blank to keep your saved key\./u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/credentials-form.tsx", import.meta.url),
      "utf-8",
    ),
    /if \(compactSurface\)[\s\S]*Leave the API key blank to keep your saved key\./u,
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
    /Set up \{providerLabel\}/u,
  );
  assert.doesNotMatch(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /Connect \{providerLabel\}/u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /overflowWrap: "anywhere"/u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /textOverflow: "clip"/u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /RETROACHIEVEMENTS_SETUP_HELP_COPY/u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /In RetroAchievements, open Settings, then Authentication\. Copy your Web API Key and use your RetroAchievements username here\./u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /DeckyCompactPillActionItem/u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /onCancelButton=\{onBackToProviders\}/u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /compactSurface/u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /helperCopy=\{RETROACHIEVEMENTS_SETUP_HELP_COPY\}/u,
  );
  assert.doesNotMatch(
    readFileSync(
      new URL("../src/platform/decky/providers/retroachievements/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /PanelSection title="Navigation"/u,
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
    /Set up \{providerLabel\}/u,
  );
  assert.doesNotMatch(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /Connect \{providerLabel\}/u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /overflowWrap: "anywhere"/u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /textOverflow: "clip"/u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /STEAM_SETUP_HELP_COPY/u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /In Steam, use your SteamID64 and Web API Key\. Keep your API key private and save it only on your own device\./u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /DeckyCompactPillActionItem/u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /onCancelButton=\{onBackToProviders\}/u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /compactSurface/u,
  );
  assert.match(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /helperCopy=\{STEAM_SETUP_HELP_COPY\}/u,
  );
  assert.doesNotMatch(
    readFileSync(
      new URL("../src/platform/decky/providers/steam/setup-screen.tsx", import.meta.url),
      "utf-8",
    ),
    /PanelSection title="Navigation"/u,
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
    new RegExp(`\\.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} > \\.${DECKY_FULLSCREEN_CHIP_CLASS}`),
  );
  assert.match(getDeckyFullscreenActionStylesCss(), /border-radius:\s*999px\s*!important/);
  assert.match(getDeckyFullscreenActionStylesCss(), /rgba\(255,\s*255,\s*255,\s*0\.1\)/);
  assert.match(
    getDeckyFullscreenActionStylesCss(),
    /min-width:\s*max-content\s*!important/,
  );
  assert.match(
    getDeckyFullscreenActionStylesCss(),
    /white-space:\s*nowrap\s*!important/,
  );
  assert.doesNotMatch(getDeckyFullscreenActionStylesCss(), /text-overflow:\s*ellipsis/);
  assert.match(
    getDeckyFullscreenActionStylesCss(),
    new RegExp(`\\.${DECKY_FULLSCREEN_CHIP_CLASS}\\.${DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS}`),
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
  const achievementSectionBodyStart = achievementDetailViewSource.indexOf(
    "function AchievementSectionBody(",
  );
  const achievementSectionBodyEnd = achievementDetailViewSource.indexOf(
    "export function DeckyGameDetailView(",
    achievementSectionBodyStart,
  );
  assert.ok(achievementSectionBodyStart >= 0);
  assert.ok(achievementSectionBodyEnd > achievementSectionBodyStart);
  const achievementSectionBodySource = achievementDetailViewSource.slice(
    achievementSectionBodyStart,
    achievementSectionBodyEnd,
  );
  assert.match(achievementSectionBodySource, /flow-children="left-right"/);
  assert.match(achievementSectionBodySource, /role="radiogroup"/);
  assert.match(achievementSectionBodySource, /aria-label="Achievement filters"/);
  assert.match(
    achievementSectionBodySource,
    /className=\{DECKY_ACHIEVEMENT_FILTER_GROUP_CLASS\}/,
  );
  assert.match(achievementDetailViewSource, /PanelSection title="GAME OVERVIEW"/);
  assert.match(achievementDetailViewSource, /PanelSection title="PROGRESS SUMMARY"/);
  assert.match(achievementDetailViewSource, /PanelSection title="ACHIEVEMENTS"/);
  assert.match(achievementDetailViewSource, /getGameDetailOverviewIconFrameStyle\(\)/);
  assert.match(achievementDetailViewSource, /DeckyCompletionProgressBar[\s\S]*compact[\s\S]*percent=\{completionPercent\}/);
  assert.doesNotMatch(achievementDetailViewSource, /AchievementModeButtons/);
  assert.doesNotMatch(achievementDetailViewSource, /summary\.completionPercent/u);
  assert.match(achievementDetailViewSource, /const ACHIEVEMENT_MODE_FILTERS = \["all", "hardcore", "softcore"\] as const;/);
  assert.match(achievementDetailViewSource, /useState<AchievementModeFilter>\("all"\)/);
  assert.match(achievementDetailViewSource, /if \(modeFilter === "all"\) \{\s*return true;\s*\}/u);
  assert.match(achievementSectionBodySource, /ACHIEVEMENT_MODE_FILTERS\.map\(\(filter\)/);
  assert.match(achievementSectionBodySource, /ACHIEVEMENT_FILTERS\.map\(\(filter\)/);
  assert.match(achievementDetailViewSource, /shouldRenderAchievementModeFilter\(game\.providerId\)/);
  assert.match(achievementSectionBodySource, /DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS/);
  assert.match(achievementSectionBodySource, /DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS/);
  assert.match(achievementSectionBodySource, /DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS/);
  assert.match(achievementSectionBodySource, /role="radio"/);
  assert.match(achievementSectionBodySource, /aria-checked=\{active\}/);
  assert.match(
    achievementSectionBodySource,
    /aria-label=\{formatAchievementModeLabel\(filter\)\}/,
  );
  assert.match(
    achievementSectionBodySource,
    /onActivate=\{\(\) => onAchievementModeFilterChange\(filter\)\}/,
  );
  assert.match(
    achievementSectionBodySource,
    /onClick=\{\(\) => onAchievementModeFilterChange\(filter\)\}/,
  );
  assert.match(
    achievementSectionBodySource,
    /onActivate=\{\(\) => onAchievementFilterChange\(filter\)\}/,
  );
  assert.match(
    achievementSectionBodySource,
    /onClick=\{\(\) => onAchievementFilterChange\(filter\)\}/,
  );
  assert.match(achievementSectionBodySource, /onCancelButton=\{onBackToDashboard\}/);
  assert.match(achievementSectionBodySource, /onFocus=\{scrollFocusedElementIntoView\}/);
  assert.match(
    achievementSectionBodySource,
    /\{showAchievementModeFilter\s*\?\s*ACHIEVEMENT_MODE_FILTERS\.map/u,
  );
  assert.match(achievementDetailViewSource, /matchesAchievementModeFilter\(achievement, achievementModeFilter\)/);
  assert.match(achievementDetailViewSource, /label="Open Game"/);
  assert.doesNotMatch(achievementDetailViewSource, /label="Open full-screen page"/);
  assert.match(achievementDetailViewSource, /if \(modeFilter === "all"\) \{\s*return "All";\s*\}/u);
  assert.match(achievementDetailViewSource, /formatAchievementFilterLabel\(filter\)/);
  assert.match(achievementDetailViewSource, /label="Show 5 more"/);
  assert.match(achievementDetailViewSource, /label="Show all"/);
  assert.match(achievementDetailViewSource, /\{achievement\.title\}/);
  assert.match(achievementDetailViewSource, /getAchievementRowMetadataStackStyle\(\)/);
  assert.match(achievementDetailViewSource, /formatProviderAchievementStatusText\(game\.providerId, achievement\)/);
  assert.match(achievementDetailViewSource, /isSteamProvider && achievement\.description !== undefined/);
  assert.equal(
    (achievementDetailViewSource.match(/achievementStatus\.secondary \?\? achievementStatus\.value/g) ?? []).length,
    0,
  );
  assert.match(achievementDetailViewSource, /parts\.join\(" \/ "\)/);
  assert.doesNotMatch(achievementDetailViewSource, /\$\{index \+ 1\}\.\s*\$\{achievement\.title\}/);
  assert.match(achievementDetailViewSource, /role="radio"/);
  assert.match(achievementDetailViewSource, /aria-checked={active}/);
  assert.match(achievementDetailViewSource, /DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS/);
  assert.match(achievementDetailViewSource, /DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS/);
  const fullScreenGamePageSource = readFileSync("src/platform/decky/decky-full-screen-game-page.tsx", "utf8");
  assert.match(fullScreenGamePageSource, /PanelSection title="Game Spotlight"/);
  assert.match(fullScreenGamePageSource, /PanelSection title="Achievements"/);
  assert.doesNotMatch(fullScreenGamePageSource, /PanelSection title="Navigation"/);
  assert.match(fullScreenGamePageSource, /ACHIEVEMENT_MODE_FILTERS = \["all", "hardcore", "softcore"\] as const;/);
  assert.match(fullScreenGamePageSource, /useState<AchievementModeFilter>\("all"\)/);
  assert.match(fullScreenGamePageSource, /useState<AchievementFilter>\("all"\)/);
  assert.match(fullScreenGamePageSource, /sortAchievementsForDisplay\(snapshot\.achievements\)/);
  assert.match(fullScreenGamePageSource, /DeckyCompletionProgressBar[\s\S]*percent=\{completionPercent\}/);
  assert.match(
    fullScreenGamePageSource,
    /matchesAchievementFilter\(achievement, achievementFilter\)[\s\S]*matchesAchievementModeFilter\(achievement, achievementModeFilter\)/,
  );
  assert.match(fullScreenGamePageSource, /shouldRenderAchievementModeFilter\(providerIdValue\)/);
  assert.match(fullScreenGamePageSource, /showAchievementModeFilter \?\s*\(/u);
  assert.match(
    fullScreenGamePageSource,
    /Game Overview[\s\S]*getGameDetailOverviewTitleStyle\(\)[\s\S]*getGameOverviewPillRowStyle\(\)[\s\S]*game\.providerId === RETROACHIEVEMENTS_PROVIDER_ID[\s\S]*RetroAchievementsFullscreenGameArtwork[\s\S]*DeckyGameArtwork[\s\S]*size=\{256\}[\s\S]*DeckyFullscreenActionRow centered[\s\S]*DeckyFullscreenActionButton[\s\S]*label=\{backLabel\}[\s\S]*DeckyFullscreenActionButton[\s\S]*label="Refresh"/u,
  );
  assert.match(fullScreenGamePageSource, /import \{ RETROACHIEVEMENTS_PROVIDER_ID \} from "\.\.\/\.\.\/providers\/retroachievements";/u);
  assert.match(fullScreenGamePageSource, /function getRetroAchievementsGameSpotlightArtworkFrameStyle\(\): CSSProperties/u);
  assert.match(fullScreenGamePageSource, /function getRetroAchievementsGameSpotlightArtworkImageStyle\(\): CSSProperties/u);
  assert.match(fullScreenGamePageSource, /maxWidth: 268/u);
  assert.match(fullScreenGamePageSource, /height: 256/u);
  assert.match(fullScreenGamePageSource, /maxHeight: 256/u);
  assert.match(fullScreenGamePageSource, /objectFit: "contain"/u);
  assert.match(fullScreenGamePageSource, /objectPosition: "center center"/u);
  assert.doesNotMatch(fullScreenGamePageSource, /getRetroAchievementsGameSpotlightArtworkImageStyle\(\)[\s\S]*objectFit: "cover"/u);
  assert.match(fullScreenGamePageSource, /getGameDetailOverviewLayoutStyle\(\)/);
  assert.match(fullScreenGamePageSource, /DeckyFullscreenActionRow centered/);
  const heroStyleStart = fullScreenGamePageSource.indexOf(
    "function getGameSpotlightHeroStyle()",
  );
  const heroStyleEnd = fullScreenGamePageSource.indexOf(
    "function getGameSpotlightStatsStyle()",
    heroStyleStart,
  );
  assert.ok(heroStyleStart >= 0);
  assert.ok(heroStyleEnd > heroStyleStart);
  const heroStyleSource = fullScreenGamePageSource.slice(heroStyleStart, heroStyleEnd);
  assert.doesNotMatch(heroStyleSource, /borderLeft/);
  assert.match(fullScreenGamePageSource, /getGameOverviewPillRowStyle\(\)/);
  assert.doesNotMatch(fullScreenGamePageSource, /GameOverviewRefreshPill/);
  assert.doesNotMatch(fullScreenGamePageSource, /getProgressSummaryPercentStyle/);
  assert.match(fullScreenGamePageSource, /buildGameMetadataPills\(game\.metrics\)/);
  assert.match(fullScreenGamePageSource, /getGameDetailMetaRowStyle\(\)/);
  assert.match(fullScreenGamePageSource, /getGameDetailMetaPillStyle\(\)/);
  assert.match(fullScreenGamePageSource, /gridTemplateColumns: "repeat\(2, minmax\(0, 1fr\)\)"/);
  assert.match(fullScreenGamePageSource, /Total players/);
  assert.match(fullScreenGamePageSource, /Release date/);
  assert.match(fullScreenGamePageSource, /Points/);
  assert.match(fullScreenGamePageSource, /RetroPoints/);
  assert.equal((fullScreenGamePageSource.match(/gameMetadataPills\.map/g) ?? []).length, 1);
  assert.doesNotMatch(fullScreenGamePageSource, /hardcore-\$\{pill\.key\}/);
  assert.doesNotMatch(fullScreenGamePageSource, /softcore-\$\{pill\.key\}/);
  assert.doesNotMatch(fullScreenGamePageSource, /label="Completion"/);
  assert.doesNotMatch(fullScreenGamePageSource, /gameSystemLabel/);
  assert.doesNotMatch(fullScreenGamePageSource, /AchievementModeButtons/);
  assert.doesNotMatch(fullScreenGamePageSource, /AchievementStateButtons/);
  assert.match(fullScreenGamePageSource, /getAchievementFilterGridStyle\(\)/);
  assert.match(fullScreenGamePageSource, /AchievementFilterButton/);
  assert.match(fullScreenGamePageSource, /Focusable/);
  assert.match(fullScreenGamePageSource, /flow-children="left-right"/);
  assert.match(fullScreenGamePageSource, /ACHIEVEMENT_MODE_FILTERS\.map\(\(filter\)/);
  assert.match(fullScreenGamePageSource, /ACHIEVEMENT_FILTERS\.map\(\(filter\)/);
  assert.match(fullScreenGamePageSource, /role="button"/);
  assert.match(fullScreenGamePageSource, /aria-pressed=\{selected\}/);
  assert.match(fullScreenGamePageSource, /onActivate=\{disabled \? \(\) => undefined : onActivate\}/);
  assert.match(fullScreenGamePageSource, /onGamepadFocus=\{\(event\) => \{/);
  assert.doesNotMatch(fullScreenGamePageSource, /role="radiogroup"/);
  assert.match(fullScreenGamePageSource, /DeckyFullscreenActionButton[\s\S]*label="Refresh"/u);
  assert.doesNotMatch(fullScreenGamePageSource, /data-game-overview-pill="refresh"/);
  assert.doesNotMatch(fullScreenGamePageSource, /aria-label="Refresh the current game detail snapshot"/);
  assert.doesNotMatch(fullScreenGamePageSource, /DeckyCompactPillActionItem/);
  assert.match(fullScreenGamePageSource, /getAchievementCardStyle\(achievement\)/);
  assert.match(fullScreenGamePageSource, /getAchievementRowMetadataStackStyle\(\)/);
  assert.match(fullScreenGamePageSource, /const isSteamProvider = isSteamAchievementPresentationProvider\(achievement\.providerId\)/);
  assert.match(fullScreenGamePageSource, /const statusText = formatProviderAchievementStatusText\(achievement\.providerId, achievement\)/);
  assert.match(fullScreenGamePageSource, /const pointsText = formatProviderAchievementPointsText\(achievement\.providerId, achievement\.points\)/);
  assert.match(fullScreenGamePageSource, /isSteamProvider && achievement\.description !== undefined/);
  assert.match(fullScreenGamePageSource, /pointsText !== undefined/);
  assert.match(fullScreenGamePageSource, /!isSteamProvider && unlockedAt !== undefined/);
  assert.match(fullScreenGamePageSource, /gridTemplateColumns: "repeat\(auto-fit, minmax\(320px, 1fr\)\)"/);
  assert.match(fullScreenGamePageSource, /gridTemplateColumns: "repeat\(auto-fit, minmax\(240px, 1fr\)\)"/);
  assert.match(fullScreenGamePageSource, /gridTemplateColumns: "repeat\(3, minmax\(0, 1fr\)\)"/);
  assert.doesNotMatch(fullScreenGamePageSource, /FULL_SCREEN_INITIAL_ACHIEVEMENT_LIMIT/);
  assert.doesNotMatch(fullScreenGamePageSource, /FULL_SCREEN_ACHIEVEMENT_LOAD_STEP/);
  assert.doesNotMatch(fullScreenGamePageSource, /visibleAchievementLimit/);
  assert.doesNotMatch(fullScreenGamePageSource, /isShowingAllAchievements/);
  assert.doesNotMatch(fullScreenGamePageSource, /canLoadMoreAchievements/);
  assert.doesNotMatch(fullScreenGamePageSource, /canShowAllAchievements/);
  assert.doesNotMatch(fullScreenGamePageSource, /label=\{`Show \$\{formatCount\(FULL_SCREEN_ACHIEVEMENT_LOAD_STEP\)\} more`\}/u);
  assert.doesNotMatch(fullScreenGamePageSource, /label="Show all"/);
  const deckyGameArtworkSource = readFileSync("src/platform/decky/decky-game-artwork.tsx", "utf8");
  assert.match(deckyGameArtworkSource, /objectFit: "cover"/u);
  assert.match(achievementDetailViewSource, /DeckyGameArtwork compact src=\{headerArtworkUrl\} size=\{48\} title=\{game\.title\}/u);
  const fullScreenAchievementPageSource = readFileSync(
    "src/platform/decky/decky-full-screen-achievement-page.tsx",
    "utf8",
  );
  const deckyNavigationSource = readFileSync("src/platform/decky/decky-navigation.tsx", "utf8");
  assert.doesNotMatch(fullScreenAchievementPageSource, /PanelSection title="ACHIEVEMENT SPOTLIGHT"/);
  assert.match(fullScreenAchievementPageSource, /AchievementSpotlightCard/);
  assert.match(fullScreenAchievementPageSource, /if \(!isSteamProvider\) \{/);
  assert.match(fullScreenAchievementPageSource, /getAchievementSpotlightCardStyle\(tone\)/);
  assert.match(fullScreenAchievementPageSource, /readonly onOpenFullScreenGame\?: \(\(\) => void\) \| undefined;/u);
  assert.match(fullScreenAchievementPageSource, /const heroArtworkUrl = game\.boxArtImageUrl \?\? game\.coverImageUrl;/u);
  assert.match(
    fullScreenAchievementPageSource,
    /FULLSCREEN_ACHIEVEMENT_PAGE_BOTTOM_SCROLL_PADDING = 88/,
  );
  assert.match(
    fullScreenAchievementPageSource,
    /FULLSCREEN_ACHIEVEMENT_SPOTLIGHT_TOP_PADDING = 80/,
  );
  assert.match(
    fullScreenAchievementPageSource,
    /FULLSCREEN_ACHIEVEMENT_SPOTLIGHT_BOTTOM_PADDING = 20/,
  );
  assert.doesNotMatch(fullScreenAchievementPageSource, /FULLSCREEN_ACHIEVEMENT_SPOTLIGHT_TOP_CHROME_PADDING/u);
  assert.match(
    fullScreenAchievementPageSource,
    /calc\(env\(safe-area-inset-bottom, 0px\) \+ \$\{FULLSCREEN_ACHIEVEMENT_PAGE_BOTTOM_SCROLL_PADDING\}px\)/,
  );
  assert.match(fullScreenAchievementPageSource, /function getAchievementSpotlightPageFrameStyle\(\): CSSProperties/u);
  assert.doesNotMatch(fullScreenAchievementPageSource, /height: "100vh"/u);
  assert.match(
    fullScreenAchievementPageSource,
    /calc\(env\(safe-area-inset-top, 0px\) \+ \$\{FULLSCREEN_ACHIEVEMENT_SPOTLIGHT_TOP_PADDING\}px\) 12px calc\(env\(safe-area-inset-bottom, 0px\) \+ \$\{FULLSCREEN_ACHIEVEMENT_SPOTLIGHT_BOTTOM_PADDING\}px\)/u,
  );
  assert.match(fullScreenAchievementPageSource, /function getAchievementSpotlightPageRailStyle\(\): CSSProperties/u);
  assert.doesNotMatch(fullScreenAchievementPageSource, /FULLSCREEN_ACHIEVEMENT_SPOTLIGHT_VISUAL_Y_OFFSET/u);
  assert.doesNotMatch(fullScreenAchievementPageSource, /translateY\(/u);
  assert.doesNotMatch(fullScreenAchievementPageSource, /FULLSCREEN_ACHIEVEMENT_PAGE_BOTTOM_SCROLL_PADDING \+ 24/u);
  assert.doesNotMatch(fullScreenAchievementPageSource, /minHeight:\s*`calc\(100vh/u);
  assert.match(fullScreenAchievementPageSource, /getAchievementSpotlightBackRowStyle\(\)/);
  assert.match(fullScreenAchievementPageSource, /backLabel=\{backLabel\}/);
  assert.match(fullScreenAchievementPageSource, /onBack=\{onBack\}/);
  assert.match(fullScreenAchievementPageSource, /onOpenFullScreenGame=\{onOpenFullScreenGame\}/u);
  assert.match(fullScreenAchievementPageSource, /getAchievementSpotlightBadgeFrameStyle\(tone\)/);
  assert.match(fullScreenAchievementPageSource, /readonly gameArtworkUrl: string \| undefined;/u);
  assert.match(fullScreenAchievementPageSource, /gameArtworkUrl=\{heroArtworkUrl\}/u);
  assert.match(fullScreenAchievementPageSource, /getAchievementSpotlightTitleStyle\(\)/);
  assert.match(fullScreenAchievementPageSource, /getAchievementSpotlightDescriptionStyle\(\)/);
  assert.match(fullScreenAchievementPageSource, /getAchievementSpotlightMetaRowStyle\(\)/);
  assert.match(fullScreenAchievementPageSource, /dedupeDistinctLabels\(\[providerLabel\]\)/);
  assert.match(fullScreenAchievementPageSource, /getAchievementSpotlightStatusStyle\(tone\)/);
  assert.match(fullScreenAchievementPageSource, /getAchievementSpotlightCounts\(achievement\.metrics, game\.metrics\)/);
  assert.match(fullScreenAchievementPageSource, /formatAchievementUnlockRatePercent\(unlockRatePercent\)/);
  assert.match(fullScreenAchievementPageSource, /achievementStatus\.value/);
  assert.match(
    fullScreenAchievementPageSource,
    /achievement\.hardcoreUnlockedAt \?\? achievement\.softcoreUnlockedAt \?\? achievement\.unlockedAt/u,
  );
  assert.match(fullScreenAchievementPageSource, /Unlocked on \$\{formatTimestamp\(unlockTimestamp\)\}/u);
  assert.match(fullScreenAchievementPageSource, /label="Points"/);
  assert.match(fullScreenAchievementPageSource, /label="RetroPoints"/);
  const spotlightStatGridStart = fullScreenAchievementPageSource.indexOf(
    "<div style={getAchievementSpotlightStatGridStyle()}>",
  );
  const spotlightRarityStackStart = fullScreenAchievementPageSource.indexOf(
    "<div style={getAchievementSpotlightRarityStackStyle()}>",
  );
  assert.ok(spotlightStatGridStart >= 0);
  assert.ok(spotlightRarityStackStart > spotlightStatGridStart);
  const spotlightStatGridSource = fullScreenAchievementPageSource.slice(
    spotlightStatGridStart,
    spotlightRarityStackStart,
  );
  assert.match(spotlightStatGridSource, /label="Points"/);
  assert.match(spotlightStatGridSource, /label="RetroPoints"/);
  assert.doesNotMatch(spotlightStatGridSource, /label="Unlock rate"/u);
  assert.match(fullScreenAchievementPageSource, /label="Softcore unlocks"/);
  assert.match(fullScreenAchievementPageSource, /label="Hardcore unlocks"/);
  assert.match(fullScreenAchievementPageSource, /label="Total players"/);
  assert.match(
    fullScreenAchievementPageSource,
    /function getAchievementSpotlightGameCoverFrameStyle\(\s*interactive: boolean,\s*focused: boolean,\s*\): CSSProperties/u,
  );
  assert.match(fullScreenAchievementPageSource, /function getAchievementSpotlightGameCoverImageStyle\(\): CSSProperties/u);
  assert.match(fullScreenAchievementPageSource, /objectFit: "contain"/u);
  assert.match(fullScreenAchievementPageSource, /maxWidth: 196/u);
  assert.match(fullScreenAchievementPageSource, /maxHeight: 116/u);
  assert.match(fullScreenAchievementPageSource, /gameArtworkUrl !== undefined && onOpenFullScreenGame !== undefined \? \(/u);
  assert.match(fullScreenAchievementPageSource, /<Focusable[\s\S]*role="button"/u);
  assert.match(fullScreenAchievementPageSource, /aria-label=\{`Open game details for \$\{game\.title\}`\}/u);
  assert.match(fullScreenAchievementPageSource, /onActivate=\{onOpenFullScreenGame\}/u);
  assert.match(fullScreenAchievementPageSource, /onClick=\{onOpenFullScreenGame\}/u);
  assert.match(fullScreenAchievementPageSource, /onGamepadFocus=\{\(\) => \{/u);
  assert.match(fullScreenAchievementPageSource, /setIsGameCoverFocused\(true\)/u);
  assert.match(fullScreenAchievementPageSource, /setIsGameCoverFocused\(false\)/u);
  assert.match(fullScreenAchievementPageSource, /cursor: interactive \? "pointer" : "default"/u);
  assert.match(fullScreenAchievementPageSource, /borderColor: focused \? "rgba\(105, 176, 255, 0\.8\)" : "rgba\(255, 255, 255, 0\.1\)"/u);
  assert.doesNotMatch(fullScreenAchievementPageSource, /getAchievementSpotlightGameCoverImageStyle\(\)[\s\S]*objectFit: "cover"/u);
  assert.match(fullScreenAchievementPageSource, /<div style=\{getAchievementSpotlightPageFrameStyle\(\)\}>/u);
  assert.match(fullScreenAchievementPageSource, /<div style=\{getPageFrameStyle\(\)\}>/u);
  assert.match(fullScreenAchievementPageSource, /<div style=\{getAchievementSpotlightPageRailStyle\(\)\}>/u);
  const spotlightCardSourceStart = fullScreenAchievementPageSource.indexOf("function AchievementSpotlightCard");
  const spotlightCardSourceEnd = fullScreenAchievementPageSource.indexOf("function isRenderableGameDetailState");
  assert.ok(spotlightCardSourceStart >= 0);
  assert.ok(spotlightCardSourceEnd > spotlightCardSourceStart);
  const spotlightCardSource = fullScreenAchievementPageSource.slice(
    spotlightCardSourceStart,
    spotlightCardSourceEnd,
  );
  assert.doesNotMatch(spotlightCardSource, /PanelSection/u);
  assert.doesNotMatch(spotlightCardSource, /PanelSectionRow/u);
  assert.match(fullScreenAchievementPageSource, /getAchievementSpotlightStatGridStyle\(\)/);
  assert.match(fullScreenAchievementPageSource, /getAchievementSpotlightCountsGridStyle\(\)/);
  assert.match(fullScreenAchievementPageSource, /getAchievementSpotlightRarityStackStyle\(\)/);
  assert.match(fullScreenAchievementPageSource, /RarityBar percent=\{unlockRatePercent\} tone=\{tone\} caption=\{unlockRateCaption\}/);
  assert.match(fullScreenAchievementPageSource, /size=\{88\}/);
  assert.match(fullScreenAchievementPageSource, /gap: 12/u);
  assert.match(fullScreenAchievementPageSource, /padding: 14/u);
  assert.doesNotMatch(fullScreenAchievementPageSource, /P2/u);
  assert.match(fullScreenAchievementPageSource, /<span style=\{getAchievementSpotlightMetaPillStyle\(\)\}>\s*RA\s*<\/span>/u);
  assert.match(fullScreenAchievementPageSource, /getAchievementDescriptionText\(achievement\.description\)/);
  assert.match(fullScreenAchievementPageSource, /const steamStatusText = formatProviderAchievementStatusText\(providerId \?\? game\.providerId, achievement\)/);
  assert.equal(
    (fullScreenAchievementPageSource.match(/achievementStatus\.secondary \?\? achievementStatus\.value/g) ?? []).length,
    0,
  );
  assert.match(deckyNavigationSource, /function DeckyFullScreenAchievementRoute\(\): JSX\.Element/u);
  assert.match(deckyNavigationSource, /onOpenFullScreenGame=/u);
  assert.match(
    deckyNavigationSource,
    /function navigateToFullScreenGameFromAchievement\(/u,
  );
  assert.match(
    deckyNavigationSource,
    /pushFullScreenGameRouteAchievementReturnTarget\(providerId, gameId, \{/u,
  );
  assert.match(
    deckyNavigationSource,
    /navigateToFullScreenGameFromAchievement\(\s*params\.providerId!,\s*params\.gameId!,\s*params\.achievementId!,\s*\)/u,
  );
  assert.match(
    deckyNavigationSource,
    /const achievementReturnTarget = useMemo\(/u,
  );
  assert.match(
    deckyNavigationSource,
    /resolveFullScreenGameRouteAchievementReturnTarget\(params\.providerId, params\.gameId\)/u,
  );
  assert.match(
    deckyNavigationSource,
    /const shouldReturnToAchievementDetail =\s*fullScreenGameRouteBackBehavior === "achievement" && achievementReturnTarget !== undefined/u,
  );
  assert.match(
    deckyNavigationSource,
    /popFullScreenGameRouteBackBehavior\(params\.providerId, params\.gameId\)/u,
  );
  assert.match(
    deckyNavigationSource,
    /popFullScreenGameRouteBackBehavior\(params\.providerId, params\.gameId\);\s*DeckyNavigation\.NavigateBack\(\);/u,
  );
  assert.doesNotMatch(
    deckyNavigationSource,
    /navigateToFullScreenAchievement\(\s*achievementReturnTarget\.providerId/u,
  );
  assert.match(
    deckyNavigationSource,
    /const fullScreenAchievementRouteBackBehaviors = new Map<string, FullScreenAchievementRouteBackBehavior>\(\)/u,
  );
  assert.match(
    deckyNavigationSource,
    /function resolveFullScreenAchievementRouteBackBehavior\(/u,
  );
  assert.match(
    deckyNavigationSource,
    /resolveFullScreenAchievementRouteBackBehavior\(\s*params\.providerId,\s*params\.gameId,\s*params\.achievementId,\s*\) === "achievement-history"/u,
  );
  assert.doesNotMatch(
    deckyNavigationSource,
    /consumeNextFullScreenAchievementRouteBackBehavior/u,
  );
  assert.match(
    readFileSync("src/platform/decky/decky-compact-pill-action-item.tsx", "utf8"),
    /readonly emphasis\?: "default" \| "primary"/,
  );
  assert.match(
    readFileSync("src/platform/decky/decky-compact-pill-action-item.tsx", "utf8"),
    /const isPrimary = emphasis === "primary"/,
  );
  assert.doesNotMatch(
    readFileSync("src/platform/decky/decky-compact-pill-action-item.tsx", "utf8"),
    /readonly ariaPressed\?: boolean/,
  );
  const coreDomainSource = readFileSync("src/core/domain.ts", "utf8");
  const retroRawTypesSource = readFileSync("src/providers/retroachievements/raw-types.ts", "utf8");
  const retroClientSource = readFileSync("src/providers/retroachievements/client/client.ts", "utf8");
  const retroProviderSource = readFileSync("src/providers/retroachievements/retroachievements.provider.ts", "utf8");
  const retroNormalizeSource = readFileSync(
    "src/providers/retroachievements/mappers/normalize.ts",
    "utf8",
  );
  const deckySystemPillSource = readFileSync("src/platform/decky/decky-system-pill.tsx", "utf8");
  const dashboardViewSource = readFileSync("src/platform/decky/decky-dashboard-view.tsx", "utf8");
  const fullScreenProfileSource = readFileSync("src/platform/decky/decky-full-screen-profile-page.tsx", "utf8");
  const achievementHistorySource = readFileSync(
    "src/platform/decky/decky-full-screen-achievement-history-page.tsx",
    "utf8",
  );
  const completionProgressSource = readFileSync(
    "src/platform/decky/decky-full-screen-completion-progress-page.tsx",
    "utf8",
  );
  const fullScreenSettingsSource = readFileSync(
    "src/platform/decky/decky-full-screen-settings-page.tsx",
    "utf8",
  );
  const retroProviderSettingsPageSource = readFileSync(
    "src/platform/decky/providers/retroachievements/provider-settings-page.tsx",
    "utf8",
  );
  const steamProviderSettingsPageSource = readFileSync(
    "src/platform/decky/providers/steam/provider-settings-page.tsx",
    "utf8",
  );
  const retroSetupScreenSource = readFileSync(
    "src/platform/decky/providers/retroachievements/setup-screen.tsx",
    "utf8",
  );
  const steamSetupScreenSource = readFileSync(
    "src/platform/decky/providers/steam/setup-screen.tsx",
    "utf8",
  );
  assert.match(dashboardViewSource, /label="Open full-screen"/);
  assert.match(dashboardViewSource, /emphasis="primary"/);
  assert.match(
    dashboardViewSource,
    /label="Open full-screen"[\s\S]*label="Back"[\s\S]*label="Refresh"[\s\S]*label="Settings"/,
  );
  assert.match(dashboardViewSource, /onOpenProfile\(profile\.providerId\)/);
  assert.match(dashboardViewSource, /addProfileAvatarCacheBustParam\(avatarUrl, refreshedAt\)/u);
  assert.match(
    achievementDetailViewSource,
    /PanelSection title="GAME OVERVIEW"[\s\S]*DeckyCompactPillActionGroup[\s\S]*label="Back"[\s\S]*label="Open Game"/u,
  );
  assert.match(coreDomainSource, /readonly systemIconUrl\?: string;/u);
  assert.match(retroNormalizeSource, /readonly systemIconUrl\?: string \| undefined;/u);
  assert.match(retroRawTypesSource, /export interface RawRetroAchievementsSystemResponse/u);
  assert.match(retroRawTypesSource, /readonly IconURL\?: string;/u);
  assert.match(retroClientSource, /loadSystems\?\(/u);
  assert.match(retroClientSource, /const SYSTEMS_PATH = "API_GetConsoleIDs\.php";/u);
  assert.match(retroClientSource, /path: SYSTEMS_PATH/u);
  assert.match(retroProviderSource, /cachedSystemIconUrlByConsoleId/u);
  assert.match(retroProviderSource, /systemIconUrlByConsoleIdPromise/u);
  assert.match(retroProviderSource, /buildRetroAchievementsSystemIconUrlMap/u);
  assert.match(retroProviderSource, /enrichRecentlyPlayedGamesWithSystemIcons/u);
  assert.match(retroProviderSource, /enrichGameDetailSnapshotWithSystemIcon/u);
  assert.match(retroProviderSource, /normalizeRetroAchievementsImageUrl/u);
  assert.match(retroNormalizeSource, /const systemIconUrl = pickString\(raw\.systemIconUrl\);/u);
  assert.match(
    retroNormalizeSource,
    /systemIconUrl: normalizeRetroAchievementsImageUrl\(systemIconUrl\)/u,
  );
  assert.match(
    retroNormalizeSource,
    /const \{ providerId, gameId, title, platformLabel, systemIconUrl, coverImageUrl \} = game;/u,
  );
  assert.match(
    retroNormalizeSource,
    /\.\.\.\(systemIconUrl !== undefined \? \{ systemIconUrl \} : \{\}\),/u,
  );
  assert.match(deckySystemPillSource, /export interface DeckySystemPillProps/u);
  assert.match(deckySystemPillSource, /readonly iconUrl\?: string \| undefined;/u);
  assert.match(deckySystemPillSource, /useEffect/u);
  assert.match(deckySystemPillSource, /useState/u);
  assert.match(deckySystemPillSource, /export interface DeckySystemIconProps/u);
  assert.match(deckySystemPillSource, /export function DeckySystemIcon/u);
  assert.match(deckySystemPillSource, /getDeckySystemIconStyle/u);
  assert.match(deckySystemPillSource, /loading="lazy"/u);
  assert.match(deckySystemPillSource, /onError=\{\(\) => \{/u);
  assert.match(deckySystemPillSource, /setIsIconHidden\(true\)/u);
  assert.match(deckySystemPillSource, /referrerPolicy="no-referrer"/u);
  assert.match(deckySystemPillSource, /objectFit: "contain"/u);
  assert.match(deckySystemPillSource, /if \(iconUrl === undefined \|\| isIconHidden\) \{\s*return null;\s*\}/u);
  assert.match(deckySystemPillSource, /<DeckySystemIcon iconSize=\{iconSize\} iconUrl=\{iconUrl\} \/>/u);
  assert.match(deckySystemPillSource, /<span style=\{style\}>/u);
  assert.match(deckySystemPillSource, /textOverflow: "ellipsis"/u);
  assert.doesNotMatch(achievementDetailViewSource, /PanelSection title="Navigation"/);
  assert.doesNotMatch(achievementDetailViewSource, /label="Open full-screen page"/);
  assert.match(
    achievementDetailViewSource,
    /PanelSection title="GAME OVERVIEW"[\s\S]*DeckyCompactPillActionGroup[\s\S]*label="Back"[\s\S]*label="Open Game"/u,
  );
  assert.match(achievementDetailViewSource, /DeckyCompactPillActionGroup/);
  assert.match(achievementDetailViewSource, /DeckyCompactPillActionItem/);
  assert.match(achievementDetailViewSource, /DeckySystemPill/u);
  assert.match(
    achievementDetailViewSource,
    /iconUrl=\{game\.providerId === RETROACHIEVEMENTS_PROVIDER_ID \? game\.systemIconUrl : undefined\}/u,
  );
  assert.match(fullScreenProfileSource, /addProfileAvatarCacheBustParam\(avatarUrl, refreshedAt\)/u);
  assert.match(
    achievementHistorySource,
    /PanelSection title="Achievement history"[\s\S]*DeckyFullscreenActionRow centered[\s\S]*label="Back"/u,
  );
  assert.doesNotMatch(achievementHistorySource, /PanelSection title="Navigation"/);
  assert.match(achievementHistorySource, /Unlocked achievements, newest first\./u);
  assert.match(achievementHistorySource, /Showing .*unlocked achievements, newest first\./u);
  assert.match(achievementHistorySource, /Newest[\s\S]*Oldest/u);
  assert.match(achievementHistorySource, /AchievementHistoryRow/u);
  assert.match(achievementHistorySource, /Focusable/u);
  assert.match(achievementHistorySource, /data-achievement-history-row-tone/u);
  assert.match(achievementHistorySource, /getAchievementHistoryStatusStyle/u);
  assert.match(achievementHistorySource, /getAchievementHistoryRowFocusStyle/u);
  assert.match(achievementHistorySource, /getAchievementRowMetadataStackStyle/u);
  assert.match(
    achievementHistorySource,
    /formatProviderAchievementPointsText\(\s*recentUnlock\.achievement\.providerId,\s*recentUnlock\.achievement\.points,\s*"prefixed"/u,
  );
  assert.match(
    achievementHistorySource,
    /function formatAchievementHistoryRetroPointsText[\s\S]*getMetricValue\(achievement\.metrics, "true-ratio", "True Ratio"\)/u,
  );
  assert.match(achievementHistorySource, /const retroPointsText = formatAchievementHistoryRetroPointsText\(recentUnlock\.achievement\);/u);
  assert.match(achievementHistorySource, /RetroPoints \$\{retroPoints\}/u);
  assert.match(achievementHistorySource, /isSteamProvider && recentUnlock\.achievement\.description !== undefined/);
  assert.match(achievementHistorySource, /!isSteamProvider && unlockedAt !== undefined/);
  assert.doesNotMatch(achievementHistorySource, /Points unavailable/u);
  assert.doesNotMatch(achievementHistorySource, /Unlock rate unavailable/u);
  assert.doesNotMatch(
    achievementHistorySource,
    /formatProviderAchievementUnlockRateText\(\s*recentUnlock\.achievement\.providerId,\s*unlockRate/u,
  );
  assert.doesNotMatch(achievementHistorySource, /Unlock rate \$\{unlockRate\}/u);
  assert.doesNotMatch(achievementHistorySource, /summaryParts\.join\(" \| "\)/u);
  assert.match(achievementHistorySource, /addProfileAvatarCacheBustParam\(avatarUrl, refreshedAt\)/u);
  assert.doesNotMatch(dashboardViewSource, /addProfileAvatarCacheBustParam\(game\.coverImageUrl/u);
  assert.doesNotMatch(fullScreenProfileSource, /addProfileAvatarCacheBustParam\(game\.coverImageUrl/u);
  assert.doesNotMatch(achievementHistorySource, /addProfileAvatarCacheBustParam\(game\.coverImageUrl/u);
  assert.match(fullScreenGamePageSource, /DeckySystemPill/u);
  assert.match(
    fullScreenGamePageSource,
    /iconUrl=\{game\.providerId === RETROACHIEVEMENTS_PROVIDER_ID \? game\.systemIconUrl : undefined\}/u,
  );
  assert.match(dashboardViewSource, /DeckySystemPill/u);
  assert.match(
    dashboardViewSource,
    /iconUrl=\{game\.providerId === RETROACHIEVEMENTS_PROVIDER_ID \? game\.systemIconUrl : undefined\}/u,
  );
  assert.doesNotMatch(
    fullScreenGamePageSource,
    /providerId === STEAM_PROVIDER_ID \? game\.systemIconUrl/u,
  );
  assert.doesNotMatch(
    achievementDetailViewSource,
    /providerId === STEAM_PROVIDER_ID \? game\.systemIconUrl/u,
  );
  assert.doesNotMatch(
    dashboardViewSource,
    /providerId === STEAM_PROVIDER_ID \? game\.systemIconUrl/u,
  );
  assert.match(fullScreenProfileSource, /FULLSCREEN_PROFILE_TOP_PADDING = 42/u);
  assert.match(
    fullScreenProfileSource,
    /calc\(env\(safe-area-inset-top, 0px\) \+ \$\{FULLSCREEN_PROFILE_TOP_PADDING\}px\) 12px calc\(env\(safe-area-inset-bottom, 0px\) \+ \$\{FULLSCREEN_PROFILE_BOTTOM_SCROLL_PADDING\}px\)/u,
  );
  assert.match(fullScreenProfileSource, /FULLSCREEN_PROFILE_BOTTOM_SCROLL_PADDING = 88/u);
  assert.match(achievementHistorySource, /FULLSCREEN_ACHIEVEMENT_HISTORY_TOP_PADDING = 42/u);
  assert.match(
    achievementHistorySource,
    /calc\(env\(safe-area-inset-top, 0px\) \+ \$\{FULLSCREEN_ACHIEVEMENT_HISTORY_TOP_PADDING\}px\) 12px calc\(env\(safe-area-inset-bottom, 0px\) \+ \$\{FULLSCREEN_ACHIEVEMENT_HISTORY_PROGRESS_BOTTOM_SCROLL_PADDING\}px\)/u,
  );
  assert.match(achievementHistorySource, /FULLSCREEN_ACHIEVEMENT_HISTORY_PROGRESS_BOTTOM_SCROLL_PADDING = 88/u);
  assert.match(fullScreenGamePageSource, /FULLSCREEN_GAME_TOP_PADDING = 42/u);
  assert.match(
    fullScreenGamePageSource,
    /calc\(env\(safe-area-inset-top, 0px\) \+ \$\{FULLSCREEN_GAME_TOP_PADDING\}px\) 12px calc\(env\(safe-area-inset-bottom, 0px\) \+ \$\{FULLSCREEN_GAME_BOTTOM_SCROLL_PADDING\}px\)/u,
  );
  assert.match(fullScreenGamePageSource, /FULLSCREEN_GAME_BOTTOM_SCROLL_PADDING = 88/u);
  assert.match(completionProgressSource, /FULLSCREEN_COMPLETION_PROGRESS_TOP_PADDING = 42/u);
  assert.match(
    completionProgressSource,
    /calc\(env\(safe-area-inset-top, 0px\) \+ \$\{FULLSCREEN_COMPLETION_PROGRESS_TOP_PADDING\}px\) 12px calc\(env\(safe-area-inset-bottom, 0px\) \+ \$\{FULLSCREEN_COMPLETION_PROGRESS_BOTTOM_SCROLL_PADDING\}px\)/u,
  );
  assert.match(completionProgressSource, /FULLSCREEN_COMPLETION_PROGRESS_BOTTOM_SCROLL_PADDING = 88/u);
  assert.match(fullScreenSettingsSource, /FULLSCREEN_SETTINGS_PAGE_TOP_PADDING = 42/u);
  assert.match(
    fullScreenSettingsSource,
    /calc\(env\(safe-area-inset-top, 0px\) \+ \$\{FULLSCREEN_SETTINGS_PAGE_TOP_PADDING\}px\) 12px calc\(env\(safe-area-inset-bottom, 0px\) \+ \$\{FULLSCREEN_SETTINGS_PAGE_BOTTOM_SCROLL_PADDING\}px\)/u,
  );
  assert.match(fullScreenSettingsSource, /FULLSCREEN_SETTINGS_PAGE_BOTTOM_SCROLL_PADDING = 88/u);
  assert.match(retroProviderSettingsPageSource, /RETROACHIEVEMENTS_PROVIDER_SETTINGS_TOP_PADDING = 42/u);
  assert.match(
    retroProviderSettingsPageSource,
    /calc\(env\(safe-area-inset-top, 0px\) \+ \$\{RETROACHIEVEMENTS_PROVIDER_SETTINGS_TOP_PADDING\}px\) 12px calc\(env\(safe-area-inset-bottom, 0px\) \+ 12px\)/u,
  );
  assert.match(steamProviderSettingsPageSource, /STEAM_PROVIDER_SETTINGS_TOP_PADDING = 42/u);
  assert.match(
    steamProviderSettingsPageSource,
    /calc\(env\(safe-area-inset-top, 0px\) \+ \$\{STEAM_PROVIDER_SETTINGS_TOP_PADDING\}px\) 12px calc\(env\(safe-area-inset-bottom, 0px\) \+ 12px\)/u,
  );
  assert.match(retroSetupScreenSource, /RETROACHIEVEMENTS_SETUP_TOP_PADDING = 42/u);
  assert.match(
    retroSetupScreenSource,
    /calc\(env\(safe-area-inset-top, 0px\) \+ \$\{RETROACHIEVEMENTS_SETUP_TOP_PADDING\}px\) 12px calc\(env\(safe-area-inset-bottom, 0px\) \+ 12px\)/u,
  );
  assert.match(steamSetupScreenSource, /STEAM_SETUP_TOP_PADDING = 42/u);
  assert.match(
    steamSetupScreenSource,
    /calc\(env\(safe-area-inset-top, 0px\) \+ \$\{STEAM_SETUP_TOP_PADDING\}px\) 12px calc\(env\(safe-area-inset-bottom, 0px\) \+ 12px\)/u,
  );
  for (const source of [
    fullScreenProfileSource,
    achievementHistorySource,
    completionProgressSource,
    fullScreenGamePageSource,
    fullScreenSettingsSource,
    retroProviderSettingsPageSource,
    steamProviderSettingsPageSource,
    retroSetupScreenSource,
    steamSetupScreenSource,
  ]) {
    assert.doesNotMatch(source, /translateY\(/u);
    assert.doesNotMatch(source, /height: "100vh"/u);
    assert.doesNotMatch(source, /minHeight:\s*`calc\(100vh/u);
  }
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
  const providerIdentitySectionStyleStart = compactDashboardSource.indexOf(
    "function getProviderIdentitySectionStyle()",
  );
  const providerIdentitySectionStyleEnd = compactDashboardSource.indexOf(
    "function getProviderIdentityIconFrameStyle()",
    providerIdentitySectionStyleStart,
  );
  assert.ok(providerIdentitySectionStyleStart >= 0);
  assert.ok(providerIdentitySectionStyleEnd > providerIdentitySectionStyleStart);
  const providerIdentitySectionStyleSource = compactDashboardSource.slice(
    providerIdentitySectionStyleStart,
    providerIdentitySectionStyleEnd,
  );
  assert.match(providerIdentitySectionStyleSource, /alignItems: "center"/);
  assert.match(providerIdentitySectionStyleSource, /padding: "2px 0 4px"/);
  assert.match(providerIdentitySectionStyleSource, /marginBottom: 12/);
  assert.match(providerIdentitySectionStyleSource, /width: "100%"/);
  assert.match(compactDashboardSource, /<ProviderIdentityRow providerId=\{profile\.providerId\} \/>/u);
  assert.match(compactDashboardSource, /function RecentAchievementRow\(/u);
  assert.match(compactDashboardSource, /function RecentlyPlayedRow\(/u);
  assert.match(compactDashboardSource, /function SteamRecentlyPlayedDescription\(/u);
  assert.match(compactDashboardSource, /const secondaryLines = formatRecentlyPlayedSecondary\(game\);/u);
  assert.match(
    compactDashboardSource,
    /<div style=\{getSteamRecentlyPlayedPrimaryStyle\(\)\}>\{formatRecentlyPlayedSummary\(game\)\}<\/div>/u,
  );
  assert.match(
    compactDashboardSource,
    /secondaryLines\.map\(\(line\) => \(\s*<div key=\{line\} style=\{getSteamRecentlyPlayedSecondaryStyle\(\)\}>/u,
  );
  const steamRecentlyPlayedPrimaryStyleStart = compactDashboardSource.indexOf(
    "function getSteamRecentlyPlayedPrimaryStyle()",
  );
  const steamRecentlyPlayedSecondaryStyleStart = compactDashboardSource.indexOf(
    "function getSteamRecentlyPlayedSecondaryStyle()",
  );
  const dashboardAchievementToneStart = compactDashboardSource.indexOf(
    'type DashboardAchievementTone =',
  );
  assert.ok(steamRecentlyPlayedPrimaryStyleStart >= 0);
  assert.ok(steamRecentlyPlayedSecondaryStyleStart > steamRecentlyPlayedPrimaryStyleStart);
  assert.ok(dashboardAchievementToneStart > steamRecentlyPlayedSecondaryStyleStart);
  const steamRecentlyPlayedPrimaryStyleSource = compactDashboardSource.slice(
    steamRecentlyPlayedPrimaryStyleStart,
    steamRecentlyPlayedSecondaryStyleStart,
  );
  const steamRecentlyPlayedSecondaryStyleSource = compactDashboardSource.slice(
    steamRecentlyPlayedSecondaryStyleStart,
    dashboardAchievementToneStart,
  );
  assert.match(steamRecentlyPlayedPrimaryStyleSource, /fontSize: "0\.84rem"/u);
  assert.match(steamRecentlyPlayedPrimaryStyleSource, /lineHeight: 1\.18/u);
  assert.match(steamRecentlyPlayedSecondaryStyleSource, /fontSize: "0\.78rem"/u);
  assert.match(steamRecentlyPlayedSecondaryStyleSource, /lineHeight: 1\.16/u);
  for (const styleSource of [
    steamRecentlyPlayedPrimaryStyleSource,
    steamRecentlyPlayedSecondaryStyleSource,
  ]) {
    assert.match(styleSource, /minWidth: 0/u);
    assert.match(styleSource, /overflow: "hidden"/u);
    assert.match(styleSource, /textOverflow: "ellipsis"/u);
    assert.match(styleSource, /whiteSpace: "nowrap"/u);
  }
  assert.match(compactDashboardSource, /Past 2 weeks: \$\{formatSteamPlaytimeMinutes/u);
  assert.match(compactDashboardSource, /Steam Deck: \$\{formatSteamPlaytimeMinutes/u);
  assert.match(compactDashboardSource, /Total playtime: \$\{formatSteamPlaytimeMinutes/u);
  assert.match(
    compactDashboardSource,
    /if \(when !== undefined\) \{\s*return \[`Last played \$\{when\}`, \.\.\.playtimeLines\];\s*\}/u,
  );
  assert.doesNotMatch(compactDashboardSource, /playtimeLines\.join\(" \| "\)/u);
  assert.match(compactDashboardSource, /getDashboardAchievementTone\(recentUnlock\)/u);
  assert.match(compactDashboardSource, /getDashboardCompactCardStyle\(bottomSpacing = 0\)/u);
  assert.match(compactDashboardSource, /padding: "16px 16px 16px 20px"/u);
  assert.match(compactDashboardSource, /gap: 14/u);
  assert.match(compactDashboardSource, /marginBottom: bottomSpacing/u);
  assert.match(compactDashboardSource, /boxSizing: "border-box"/u);
  assert.match(compactDashboardSource, /profile\.providerId === STEAM_PROVIDER_ID/u);
  assert.match(compactDashboardSource, /<PanelSection title="Overview">[\s\S]*?<PanelSectionRow>\s*<div style=\{getOverviewCardStyle\(\)\}>/u);
  assert.match(compactDashboardSource, /recentAchievements\.map\(\(recentUnlock, index\) => \(\s*<PanelSectionRow[\s\S]*?<RecentAchievementRow/u);
  assert.match(compactDashboardSource, /recentlyPlayedGames\.map\(\(game, index\) => \(\s*<PanelSectionRow[\s\S]*?<RecentlyPlayedRow/u);
  assert.match(
    compactDashboardSource,
    /bottomSpacing=\{index === recentAchievements\.length - 1 \? 0 : 12\}/u,
  );
  assert.match(
    compactDashboardSource,
    /bottomSpacing=\{index === recentlyPlayedGames\.length - 1 \? 0 : 12\}/u,
  );
  assert.match(compactDashboardSource, /getDashboardCompactCardAccentStyle\(tone\)/u);
  assert.match(compactDashboardSource, /top: 14/u);
  assert.match(compactDashboardSource, /bottom: 14/u);
  assert.match(compactDashboardSource, /width: 42/u);
  assert.match(compactDashboardSource, /height: 42/u);
  assert.match(compactDashboardSource, /padding: 3/u);
  assert.match(compactDashboardSource, /gap: 7/u);
  assert.match(compactDashboardSource, /gap: 4/u);
  assert.match(compactDashboardSource, /getDashboardAchievementStatusStyle\(tone\)/u);
  assert.match(compactDashboardSource, /formatRecentlyPlayedProgressLine\(game\)/u);
  assert.match(compactDashboardSource, /formatRecentlyPlayedLastPlayedText\(game\)/u);
  assert.match(compactDashboardSource, /gap: 8/u);
  assert.match(compactDashboardSource, /CompactDashboardProgressBar[\s\S]*percent=\{progressPercent\}/u);
  assert.match(compactDashboardSource, /role="progressbar"/u);
  assert.match(compactDashboardSource, /formatAchievementUnlockModeLabel\(recentUnlock\.achievement\)/u);
  assert.match(compactDashboardSource, /if \(recentUnlock\.game\.providerId === STEAM_PROVIDER_ID\)/u);
  assert.match(compactDashboardSource, /if \(game\.providerId === STEAM_PROVIDER_ID\)/u);
  assert.match(compactDashboardSource, /description=\{<SteamRecentlyPlayedDescription game=\{game\} \/>\}/u);
  assert.match(compactDashboardSource, /onCancelButton=\{onCancel\}/u);
  assert.match(
    compactDashboardSource,
    /onActivate=\{\(\) => \{\s*onOpenGameDetail\(game\.providerId, game\.gameId, game\.title\);/u,
  );
  assert.doesNotMatch(compactDashboardSource, /data-dashboard-row-type=/u);
  assert.doesNotMatch(compactDashboardSource, /data-dashboard-achievement-tone=/u);
  assert.doesNotMatch(compactDashboardSource, /getDashboardCompactRowWrapperStyle/u);
  assert.doesNotMatch(compactDashboardSource, /getDashboardCompactListStyle/u);
  assert.match(compactDashboardSource, /onOpenAchievementDetail\(\{\s*game: recentUnlock\.game,\s*achievement: recentUnlock\.achievement,\s*\}\)/u);
  assert.match(compactDashboardSource, /onOpenGameDetail\(game\.providerId, game\.gameId, game\.title\)/u);
  const compactAchievementDetailSource = readFileSync("src/platform/decky/decky-achievement-detail-view.tsx", "utf8");
  assert.match(compactAchievementDetailSource, /PanelSection title="Achievement details"/);
  assert.doesNotMatch(compactAchievementDetailSource, /PanelSection title="Navigation"/);
  assert.match(compactAchievementDetailSource, /getAchievementDetailCounts\(achievement\.metrics, game\.metrics \?\? \[\]\)/u);
  assert.match(compactAchievementDetailSource, /formatAchievementDetailUnlockRatePercent\(counts\.unlockRatePercent\)/u);
  assert.match(compactAchievementDetailSource, /label="Points"/);
  assert.match(compactAchievementDetailSource, /label="RetroPoints"/);
  assert.doesNotMatch(compactAchievementDetailSource, /label="Unlock rate"/u);
  assert.match(compactAchievementDetailSource, /label="Softcore unlocks"/);
  assert.match(compactAchievementDetailSource, /label="Hardcore unlocks"/);
  assert.match(compactAchievementDetailSource, /label="Total players"/);
  assert.match(
    compactAchievementDetailSource,
    /RarityBar[\s\S]*caption=\{formatAchievementDetailUnlockRatePercent\(counts\.unlockRatePercent\)\}/u,
  );
  assert.match(
    compactAchievementDetailSource,
    /RarityBar[\s\S]*percent=\{counts\.unlockRatePercent\}/u,
  );
  assert.match(compactAchievementDetailSource, /label="Open Game"/);
  assert.doesNotMatch(compactAchievementDetailSource, /label="Open full-screen game"/);
  assert.match(compactAchievementDetailSource, /PanelSection title="Achievement details"/);
  assert.match(compactAchievementDetailSource, /DeckyCompactPillActionGroup/);
  assert.match(compactAchievementDetailSource, /DeckyCompactPillActionItem/);
  assert.match(compactAchievementDetailSource, /label="Back"/);
  assert.match(compactAchievementDetailSource, /label="Open Game"/);
  assert.match(
    compactAchievementDetailSource,
    /ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement/u,
  );
  assert.match(
    compactAchievementDetailSource,
    /data-achievement-companion-compact-achievement-back/u,
  );
  assert.match(
    compactAchievementDetailSource,
    /<DeckyCompactPillActionItem[\s\S]*label="Back"[\s\S]*onClick=\{onBack\}[\s\S]*onCancelButton=\{onBack\}[\s\S]*elementRef=\{compactAchievementBackButtonRef\}[\s\S]*dataAttributes=\{\s*\{\s*"data-achievement-companion-compact-achievement-back": "true"/u,
  );
  assert.match(compactAchievementDetailSource, /metrics: loader\.data\.game\.metrics/);
  assert.match(compactAchievementDetailSource, /getAchievementStatusTone\(achievement\)/);
  assert.match(compactAchievementDetailSource, /getAchievementStatusCardStyle\(achievementStatusTone\)/);
  assert.match(compactAchievementDetailSource, /getAchievementStatusValueStyle\(achievementStatusTone\)/);
  assert.match(compactAchievementDetailSource, /getAchievementStatusSecondaryStyle\(achievementStatusTone\)/);
  assert.match(compactAchievementDetailSource, /formatProviderAchievementStatusText\(game\.providerId, achievement\)/);
  assert.match(compactAchievementDetailSource, />Unlock status</);
  assert.match(compactAchievementDetailSource, /Unlocked \$\{formatTimestamp\(achievement\.unlockedAt\)\}/u);
  assert.doesNotMatch(compactAchievementDetailSource, /replace\(\^Unlocked\\s\+\/u,/u);
  assert.doesNotMatch(compactAchievementDetailSource, /preferredFocus/u);
  assert.match(
    compactBootstrapSource,
    /fullscreenReturnContext/,
  );
  assert.match(
    compactBootstrapSource,
    /createDeckyFullscreenReturnContextForProviderDashboard/,
  );
  assert.match(
    compactBootstrapSource,
    /createDeckyFullscreenReturnContextForAchievement/,
  );
  assert.match(
    compactBootstrapSource,
    /createDeckyFullscreenReturnContextForGame/,
  );
  assert.match(
    compactBootstrapSource,
    /restoreDeckyFullscreenSelectionFromContext/,
  );
  assert.match(
    compactBootstrapSource,
    /setSelectedAchievement\(restoredSelection\.selectedAchievement\)/,
  );
  assert.match(
    compactBootstrapSource,
    /const fullscreenContext = createDeckyFullscreenReturnContextForAchievement\(\s*selectedAchievement,\s*selectedGame,\s*\)/u,
  );
  assert.match(
    compactBootstrapSource,
    /writeDeckyFullscreenReturnContext\(fullscreenContext\);[\s\S]*view: "game"[\s\S]*providerId: selectedAchievement\.game\.providerId[\s\S]*gameId: selectedAchievement\.game\.gameId/u,
  );
  assert.doesNotMatch(compactBootstrapSource, /vgp_oncancel/u);
  assert.doesNotMatch(compactBootstrapSource, /addEventListener\(/u);
  assert.doesNotMatch(compactBootstrapSource, /preferredFocus/u);
  assert.match(
    readFileSync("src/platform/decky/decky-full-screen-action-controls.tsx", "utf8"),
    /markDeckyFullscreenReturnRequested/,
  );
  assert.match(
    compactBootstrapSource,
    /fullscreenReturnContext/,
  );
  assert.match(
    compactBootstrapSource,
    /createDeckyFullscreenReturnContextForProviderDashboard/,
  );
  assert.match(
    compactBootstrapSource,
    /createDeckyFullscreenReturnContextForGame/,
  );
  assert.match(
    compactBootstrapSource,
    /setFullscreenReturnContext\(fullscreenContext\);[\s\S]*writeDeckyFullscreenReturnContext\(fullscreenContext\);[\s\S]*view: "game"[\s\S]*providerId: game\.providerId[\s\S]*gameId: game\.gameId/u,
  );
  assert.match(
    compactBootstrapSource,
    /Open a connected dashboard or update provider settings\./u,
  );
  assert.match(
    compactBootstrapSource,
    /function ProviderLauncherCard\(/u,
  );
  assert.match(
    compactBootstrapSource,
    /function getChooserVersionStyle\(/u,
  );
  assert.match(
    compactBootstrapSource,
    /function getChooserFooterStyle\(/u,
  );
  assert.match(
    compactBootstrapSource,
    /onActivate=\{onClick\}/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /role="button"/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /function getChooserProviderLauncherTone\(/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /getChooserProviderLauncherTone\(providerId, connected === true\)/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /getChooserProviderCardTitleStyle\(\)/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /overflowWrap: "anywhere"/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /wordBreak: "break-word"/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /whiteSpace: "normal"/u,
  );
  assert.doesNotMatch(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /textOverflow: "ellipsis"/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /statusLabel=\{provider\.connected \? "CONNECTED" : "SET UP"\}/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /getChooserProviderCardStatusStyleForTone\(tone\)/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /getChooserProviderCardAccentStyle\(tone\)/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /padding: "12px 14px 12px 14px"/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /marginBlock: 8/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /marginInlineStart: 3/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /rgba\(214, 158, 46, 0\.82\)/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /rgba\(214, 158, 46, 0\.14\)/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /rgba\(96, 165, 250, 0\.12\)/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /label="Provider Settings"/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /Achievement Companion v\{ACHIEVEMENT_COMPANION_VERSION\}/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /visibleProviders\.filter\(\(provider\) => provider\.connected\)\.length/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /No providers connected/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /1 provider connected/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /providers connected/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /getChooserFooterStyle\(\)/u,
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

test("fullscreen action controls use Decky Focusable pills with unclipped labels", () => {
  const fullscreenActionControlsSource = readFileSync(
    "src/platform/decky/decky-full-screen-action-controls.tsx",
    "utf8",
  );
  const fullscreenProfileSource = readFileSync(
    "src/platform/decky/decky-full-screen-profile-page.tsx",
    "utf8",
  );
  const fullscreenGameSource = readFileSync(
    "src/platform/decky/decky-full-screen-game-page.tsx",
    "utf8",
  );
  const fullscreenSettingsSource = readFileSync(
    "src/platform/decky/decky-full-screen-settings-page.tsx",
    "utf8",
  );
  const retroAchievementsProviderSettingsSource = readFileSync(
    "src/platform/decky/providers/retroachievements/provider-settings-page.tsx",
    "utf8",
  );
  const steamProviderSettingsSource = readFileSync(
    "src/platform/decky/providers/steam/provider-settings-page.tsx",
    "utf8",
  );
  const fullscreenCancelBridgeSource = readFileSync(
    "src/platform/decky/decky-full-screen-cancel-bridge.ts",
    "utf8",
  );
  const compactPillSource = readFileSync(
    "src/platform/decky/decky-compact-pill-action-item.tsx",
    "utf8",
  );
  const actionButtonItemSource = readFileSync(
    "src/platform/decky/decky-action-button-item.tsx",
    "utf8",
  );

  assert.match(
    fullscreenActionControlsSource,
    /import \{ Focusable, type FocusableProps \} from "@decky\/ui"/,
  );
  assert.doesNotMatch(fullscreenActionControlsSource, /\bButton\b|\bButtonItem\b|\bDialogButton\b/);
  assert.match(fullscreenActionControlsSource, /flow-children="left-right"/);
  assert.match(
    fullscreenActionControlsSource,
    /<Focusable[\s\S]*focusClassName=\{DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS\}[\s\S]*focusWithinClassName=\{DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS\}[\s\S]*role="button"[\s\S]*onActivate=\{handleClick\}[\s\S]*onClick=\{handleClick\}/u,
  );
  assert.match(fullscreenActionControlsSource, /onCancel: handleClick/);
  assert.match(fullscreenActionControlsSource, /<span style=\{\{ whiteSpace: "nowrap" \}\}>\{label\}<\/span>/);
  assert.doesNotMatch(getDeckyFullscreenActionStylesCss(), /DialogButton|ButtonItem/);
  assert.match(getDeckyFullscreenActionStylesCss(), /border-radius:\s*999px\s*!important/);
  assert.match(getDeckyFullscreenActionStylesCss(), /background:\s*linear-gradient/);
  assert.match(getDeckyFullscreenActionStylesCss(), /0 0 18px rgba\(39, 124, 226, 0\.35\)/);
  assert.match(getDeckyFullscreenActionStylesCss(), /min-width:\s*max-content\s*!important/);
  assert.match(getDeckyFullscreenActionStylesCss(), /white-space:\s*nowrap\s*!important/);
  assert.doesNotMatch(getDeckyFullscreenActionStylesCss(), /text-overflow:\s*ellipsis/);
  assert.match(
    fullscreenCancelBridgeSource,
    /\[data-achievement-companion-fullscreen-back="true"\]\[role="button"\]/,
  );
  assert.match(
    fullscreenCancelBridgeSource,
    /\[data-achievement-companion-compact-achievement-back="true"\]\[role="button"\]/,
  );
  assert.match(fullscreenCancelBridgeSource, /handleCompactAchievementCancelBridge/u);
  assert.match(
    fullscreenCancelBridgeSource,
    /ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement/u,
  );
  assert.doesNotMatch(fullscreenCancelBridgeSource, /Achievement Details|innerText ===|textContent/u);
  assert.doesNotMatch(
    `${fullscreenActionControlsSource}\n${fullscreenCancelBridgeSource}`,
    /localStorage|sessionStorage/,
  );
  assert.match(
    fullscreenProfileSource,
    /DeckyFullscreenActionRow centered[\s\S]*label="Back"[\s\S]*label="Completion Progress"[\s\S]*label="Achievement History"[\s\S]*label="Settings"/u,
  );
  assert.match(
    fullscreenGameSource,
    /DeckyFullscreenActionRow centered[\s\S]*label=\{backLabel\}[\s\S]*label="Refresh"/u,
  );
  assert.match(fullscreenSettingsSource, /DeckyFullscreenActionButton[\s\S]*label="Back"/u);
  assert.match(retroAchievementsProviderSettingsSource, /DeckyFullscreenActionButton[\s\S]*label="Back"/u);
  assert.match(steamProviderSettingsSource, /DeckyFullscreenActionButton[\s\S]*label="Back"/u);
  assert.match(compactPillSource, /import \{ Focusable, type FocusableProps \} from "@decky\/ui"/);
  assert.match(compactPillSource, /readonly dataAttributes\?: Readonly<Record<`data-\$\{string\}`, string>> \| undefined;/u);
  assert.match(compactPillSource, /readonly elementRef\?: RefCallback<HTMLDivElement> \| undefined;/u);
  assert.match(compactPillSource, /ref=\{elementRef\}/u);
  assert.match(compactPillSource, /\{\.\.\.\(dataAttributes \?\? \{\}\)\}/u);
  assert.doesNotMatch(compactPillSource, /preferredFocus/u);
  assert.match(actionButtonItemSource, /import \{ ButtonItem, type ButtonItemProps \} from "@decky\/ui"/);
});

test("retroachievements provider settings avoid dropdown overlays for immediate-persistence controls", () => {
  const retroAchievementsProviderSettingsSource = readFileSync(
    "src/platform/decky/providers/retroachievements/provider-settings-page.tsx",
    "utf8",
  );
  const steamProviderSettingsSource = readFileSync(
    "src/platform/decky/providers/steam/provider-settings-page.tsx",
    "utf8",
  );
  const steamCredentialsFormSource = readFileSync(
    "src/platform/decky/providers/steam/credentials-form.tsx",
    "utf8",
  );
  const fullscreenActionControlsSource = readFileSync(
    "src/platform/decky/decky-full-screen-action-controls.tsx",
    "utf8",
  );

  assert.match(
    retroAchievementsProviderSettingsSource,
    /import \{ PanelSection, PanelSectionRow, ScrollPanel, ToggleField \} from "@decky\/ui"/u,
  );
  assert.match(
    retroAchievementsProviderSettingsSource,
    /<ToggleField[\s\S]*label="Show subsets"[\s\S]*checked=\{settings\.showCompletionProgressSubsets\}[\s\S]*onChange=\{\(showCompletionProgressSubsets\) =>/u,
  );
  assert.match(
    retroAchievementsProviderSettingsSource,
    /import \{ DeckyProviderSettingsActionRow \} from "\.\.\/\.\.\/decky-provider-settings-action-row"/u,
  );
  assert.match(
    retroAchievementsProviderSettingsSource,
    /<DeckyProviderSettingsActionRow[\s\S]*label="Recent Achievements count"[\s\S]*getNextCountOption\(currentSettings\.recentAchievementsCount\)[\s\S]*saveDeckySettings\(nextSettings\)[\s\S]*persistProviderCounts\(nextSettings\)/u,
  );
  assert.match(
    retroAchievementsProviderSettingsSource,
    /<DeckyProviderSettingsActionRow[\s\S]*label="Recently Played count"[\s\S]*getNextCountOption\(currentSettings\.recentlyPlayedCount\)[\s\S]*saveDeckySettings\(nextSettings\)[\s\S]*persistProviderCounts\(nextSettings\)/u,
  );
  assert.match(
    retroAchievementsProviderSettingsSource,
    /const filters: readonly CompletionProgressFilter\[\] = \["all", "unfinished", "beaten", "mastered"\]/u,
  );
  assert.match(
    retroAchievementsProviderSettingsSource,
    /<DeckyProviderSettingsActionRow[\s\S]*label="Default Completion Progress filter"[\s\S]*getNextCompletionProgressFilter\([\s\S]*current\.defaultCompletionProgressFilter/u,
  );
  assert.doesNotMatch(
    retroAchievementsProviderSettingsSource,
    /DeckyActionButtonItem|DropdownItem|COUNT_DROPDOWN_OPTIONS|COMPLETION_PROGRESS_FILTER_DROPDOWN_OPTIONS/,
  );
  assert.doesNotMatch(steamProviderSettingsSource, /DropdownItem|\bDropdown\b/);
  assert.match(
    steamCredentialsFormSource,
    /import \{[\s\S]*DeckyProviderSettingsActionGroup,[\s\S]*DeckyProviderSettingsActionRow,[\s\S]*\} from "\.\.\/\.\.\/decky-provider-settings-action-row"/u,
  );
  assert.match(
    steamCredentialsFormSource,
    /<DeckyProviderSettingsActionRow[\s\S]*label="Recent Achievements count"[\s\S]*<DeckyProviderSettingsActionRow[\s\S]*label="Recently Played count"[\s\S]*<DeckyProviderSettingsActionRow[\s\S]*label="Include played free games"/u,
  );
  assert.doesNotMatch(steamCredentialsFormSource, /DropdownItem|\bDropdown\b/);
  assert.match(fullscreenActionControlsSource, /import \{ Focusable, type FocusableProps \} from "@decky\/ui"/);
  assert.doesNotMatch(
    `${retroAchievementsProviderSettingsSource}\n${steamCredentialsFormSource}`,
    /localStorage|sessionStorage/,
  );
});

test("provider setup and settings true actions use compact focusable pills", () => {
  const fullscreenSettingsSource = readFileSync(
    "src/platform/decky/decky-full-screen-settings-page.tsx",
    "utf8",
  );
  const providerSettingsActionRowSource = readFileSync(
    "src/platform/decky/decky-provider-settings-action-row.tsx",
    "utf8",
  );
  const focusStylesSource = readFileSync(
    "src/platform/decky/decky-focus-styles.tsx",
    "utf8",
  );
  const retroAchievementsSetupSource = readFileSync(
    "src/platform/decky/providers/retroachievements/setup-screen.tsx",
    "utf8",
  );
  const retroAchievementsCredentialsSource = readFileSync(
    "src/platform/decky/providers/retroachievements/credentials-form.tsx",
    "utf8",
  );
  const retroAchievementsProviderSettingsSource = readFileSync(
    "src/platform/decky/providers/retroachievements/provider-settings-page.tsx",
    "utf8",
  );
  const steamSetupSource = readFileSync(
    "src/platform/decky/providers/steam/setup-screen.tsx",
    "utf8",
  );
  const steamCredentialsSource = readFileSync(
    "src/platform/decky/providers/steam/credentials-form.tsx",
    "utf8",
  );
  const steamProviderSettingsSource = readFileSync(
    "src/platform/decky/providers/steam/provider-settings-page.tsx",
    "utf8",
  );
  const fullscreenActionControlsSource = readFileSync(
    "src/platform/decky/decky-full-screen-action-controls.tsx",
    "utf8",
  );

  for (const setupSource of [retroAchievementsSetupSource, steamSetupSource]) {
    assert.match(
      setupSource,
      /<DeckyCompactPillActionItem[\s\S]*label="Back"[\s\S]*onCancelButton=\{onBackToProviders\}[\s\S]*onClick=\{onBackToProviders\}/u,
    );
    assert.match(setupSource, /saveLabel="Save provider settings"[\s\S]*compactSurface/u);
  }

  assert.match(
    retroAchievementsCredentialsSource,
    /<DeckyProviderSettingsActionGroup>[\s\S]*<DeckyCompactPillActionItem[\s\S]*emphasis="primary"[\s\S]*label=\{saveLabel\}[\s\S]*void handleSave\(\)[\s\S]*label=\{clearLabel \?\? "Clear credentials"\}[\s\S]*void handleClear\(\)[\s\S]*<\/DeckyProviderSettingsActionGroup>/u,
  );
  assert.doesNotMatch(retroAchievementsCredentialsSource, /DeckyCompactPillActionGroup/);
  assert.doesNotMatch(retroAchievementsCredentialsSource, /DeckyActionButtonItem/);
  assert.match(
    steamCredentialsSource,
    /<DeckyProviderSettingsActionGroup>[\s\S]*<DeckyCompactPillActionItem[\s\S]*emphasis="primary"[\s\S]*label=\{saveLabel\}[\s\S]*void handleSave\(\)[\s\S]*label=\{clearLabel \?\? "Clear credentials"\}[\s\S]*void handleClear\(\)[\s\S]*<\/DeckyProviderSettingsActionGroup>/u,
  );
  assert.doesNotMatch(steamCredentialsSource, /DeckyCompactPillActionGroup/);
  assert.doesNotMatch(steamCredentialsSource, /DeckyActionButtonItem/);
  assert.match(
    steamProviderSettingsSource,
    /<DeckyCompactPillActionItem[\s\S]*emphasis="primary"[\s\S]*disabled=\{scanButtonDisabled\}[\s\S]*label=\{scanButtonLabel\}[\s\S]*void handleScanLibraryAchievements\(\)/u,
  );
  assert.doesNotMatch(steamProviderSettingsSource, /DeckyActionButtonItem/);

  assert.match(
    retroAchievementsProviderSettingsSource,
    /<DeckyFullscreenActionButton[\s\S]*label="Back"[\s\S]*isFullscreenBackAction/u,
  );
  assert.match(
    steamProviderSettingsSource,
    /<DeckyFullscreenActionButton[\s\S]*label="Back"[\s\S]*isFullscreenBackAction/u,
  );
  assert.match(fullscreenActionControlsSource, /import \{ Focusable, type FocusableProps \} from "@decky\/ui"/);
  assert.match(
    fullscreenSettingsSource,
    /<DeckyProviderSettingsActionRow[\s\S]*label=\{provider\.label\}[\s\S]*actionLabel="Open"[\s\S]*onOpenProviderSettings\(provider\.id\)/u,
  );
  assert.doesNotMatch(fullscreenSettingsSource, /DeckyActionButtonItem|ButtonItem/);
  assert.match(
    providerSettingsActionRowSource,
    /import \{ Focusable, type FocusableProps, PanelSectionRow \} from "@decky\/ui"/u,
  );
  assert.match(
    providerSettingsActionRowSource,
    /export function DeckyProviderSettingsActionGroup[\s\S]*<Focusable[\s\S]*flow-children="left-right"[\s\S]*noFocusRing[\s\S]*style=\{getActionGroupStyle\(\)\}/u,
  );
  assert.match(
    providerSettingsActionRowSource,
    /function getActionGroupStyle\(\)[\s\S]*alignItems: "center"[\s\S]*justifyContent: "center"[\s\S]*gap: "8px 10px"[\s\S]*width: "100%"/u,
  );
  assert.match(
    providerSettingsActionRowSource,
    /<Focusable[\s\S]*focusClassName=\{DECKY_PROVIDER_SETTINGS_ACTION_ROW_ACTIVE_CLASS\}[\s\S]*focusWithinClassName=\{DECKY_PROVIDER_SETTINGS_ACTION_ROW_ACTIVE_CLASS\}[\s\S]*role="button"[\s\S]*onActivate=\{disabled \? \(\) => undefined : onClick\}[\s\S]*onClick=\{disabled \? \(\) => undefined : onClick\}/u,
  );
  assert.doesNotMatch(providerSettingsActionRowSource, /ButtonItem|DropdownItem/);
  assert.match(providerSettingsActionRowSource, /actionLabel = "Change"/u);
  assert.match(
    providerSettingsActionRowSource,
    /className=\{DECKY_PROVIDER_SETTINGS_ACTION_PILL_CLASS\}[\s\S]*style=\{getActionPillStyle\(isFocused\)\}/u,
  );
  assert.match(providerSettingsActionRowSource, /margin: "5px 0"/u);
  assert.match(providerSettingsActionRowSource, /scrollMarginBlock: 10/u);
  assert.match(
    focusStylesSource,
    /\.achievement-companion-focus-pill\[role="button"\]\.achievement-companion-focus-pill--focused/u,
  );
  assert.match(
    focusStylesSource,
    /DECKY_PROVIDER_SETTINGS_ACTION_ROW_ACTIVE_CLASS[\s\S]*rgba\(73, 155, 255, 0\.72\)[\s\S]*DECKY_PROVIDER_SETTINGS_ACTION_PILL_CLASS/u,
  );
  assert.match(
    readFileSync("src/platform/decky/decky-compact-pill-action-item.tsx", "utf8"),
    /focusClassName=\{DECKY_FOCUS_PILL_ACTIVE_CLASS\}[\s\S]*focusWithinClassName=\{DECKY_FOCUS_PILL_ACTIVE_CLASS\}/u,
  );
  assert.match(
    readFileSync("src/platform/decky/decky-compact-pill-action-item.tsx", "utf8"),
    /function getFocusedPillStyle\(\)[\s\S]*0 0 0 2px rgba\(73, 155, 255, 0\.72\)[\s\S]*0 0 18px rgba\(39, 124, 226, 0\.35\)/u,
  );

  assert.match(
    retroAchievementsCredentialsSource,
    /<DeckyCredentialTextField[\s\S]*style=\{getDeckyCredentialTextFieldMaskStyle\(\)\}/u,
  );
  assert.match(
    steamCredentialsSource,
    /<DeckyCredentialTextField[\s\S]*style=\{getDeckyCredentialTextFieldMaskStyle\(\)\}/u,
  );
  assert.doesNotMatch(retroAchievementsProviderSettingsSource, /DropdownItem|\bDropdown\b/);
  assert.match(
    retroAchievementsProviderSettingsSource,
    /<DeckyProviderSettingsActionRow[\s\S]*label="Recent Achievements count"[\s\S]*label="Recently Played count"[\s\S]*label="Default Completion Progress filter"/u,
  );
  assert.doesNotMatch(retroAchievementsProviderSettingsSource, /DeckyActionButtonItem|ButtonItem/);
  assert.match(retroAchievementsProviderSettingsSource, /<ToggleField[\s\S]*label="Show subsets"/u);

  assert.doesNotMatch(
    [
      retroAchievementsSetupSource,
      retroAchievementsCredentialsSource,
      retroAchievementsProviderSettingsSource,
      steamSetupSource,
      steamCredentialsSource,
      steamProviderSettingsSource,
    ].join("\n"),
    /localStorage|sessionStorage/,
  );
});

test("v0.2.10 diagnostic release metadata and Decky cleanup stay aligned", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    version?: string;
    scripts?: Record<string, string>;
  };
  const pluginJson = JSON.parse(readFileSync("plugin.json", "utf8")) as { version?: string };
  const readmeSource = readFileSync("README.md", "utf8");
  const bootstrapSource = readFileSync("src/platform/decky/bootstrap.tsx", "utf8");
  const compactPillSource = readFileSync(
    "src/platform/decky/decky-compact-pill-action-item.tsx",
    "utf8",
  );
  const fullScreenActionControlsSource = readFileSync(
    "src/platform/decky/decky-full-screen-action-controls.tsx",
    "utf8",
  );
  const completionSummaryCardsSource = readFileSync(
    "src/platform/decky/decky-completion-progress-summary-cards.tsx",
    "utf8",
  );
  const providerSettingsActionRowSource = readFileSync(
    "src/platform/decky/decky-provider-settings-action-row.tsx",
    "utf8",
  );
  const compactGameDetailSource = readFileSync(
    "src/platform/decky/decky-game-detail-view.tsx",
    "utf8",
  );
  const cancelBridgeSource = readFileSync(
    "src/platform/decky/decky-full-screen-cancel-bridge.ts",
    "utf8",
  );
  const releasePackageScriptSource = readFileSync("scripts/package_release.py", "utf8");
  const releaseCheckScriptSource = readFileSync("scripts/check_release_artifact.py", "utf8");

  assert.equal(packageJson.version, "0.2.10");
  assert.equal(pluginJson.version, "0.2.10");
  assert.match(readmeSource, /Version 0\.2\.10/u);
  assert.match(bootstrapSource, /const ACHIEVEMENT_COMPANION_VERSION = "0\.2\.10"/u);
  assert.doesNotMatch(bootstrapSource, /DIAGNOSTIC BUILD LOADED 2026-06-28/u);
  assert.doesNotMatch(
    `${readmeSource}\n${bootstrapSource}\n${JSON.stringify(packageJson)}\n${JSON.stringify(pluginJson)}`,
    /0\.2\.9|v0\.2\.9|0\.2\.8|v0\.2\.8/u,
  );
  assert.match(releasePackageScriptSource, /achievement-companion-v\{version\}\.zip/u);
  assert.match(releaseCheckScriptSource, /achievement-companion-v\{version\}\.zip/u);
  assert.match(releasePackageScriptSource, /INSTALL_DIAGNOSTIC\.txt/u);
  assert.match(releasePackageScriptSource, /AchievementCompanionGamePageBadge/u);
  assert.match(releasePackageScriptSource, /\/routes\/library\/app/u);
  assert.match(releasePackageScriptSource, /formatDeckyGamePageAchievementBadgeLabel/u);
  assert.match(releasePackageScriptSource, /completion-progress-title-match/u);
  assert.match(releasePackageScriptSource, /dashboard-identity-detail/u);
  assert.match(releasePackageScriptSource, /no-retroachievements-shortcut-mapping/u);
  assert.match(releasePackageScriptSource, /retroachievements/u);
  assert.match(releasePackageScriptSource, /createRoot/u);
  assert.match(releasePackageScriptSource, /react-dom\/client/u);
  assert.match(releasePackageScriptSource, /\.protondb-decky-indicator-container/u);
  assert.match(releasePackageScriptSource, /backend\/steam_shortcuts\.py/u);
  assert.match(releaseCheckScriptSource, /INSTALL_DIAGNOSTIC\.txt/u);
  assert.match(releaseCheckScriptSource, /AchievementCompanionGamePageBadge/u);
  assert.match(releaseCheckScriptSource, /backend\/steam_shortcuts\.py/u);
  assert.match(releaseCheckScriptSource, /FORBIDDEN_FRONTEND_MARKERS/u);
  assert.match(releaseCheckScriptSource, /verify_release_dist_bundles/u);
  assert.match(packageJson.scripts?.build ?? "", /clean_decky_dist\.py/u);

  for (const deckySource of [
    bootstrapSource,
    compactPillSource,
    fullScreenActionControlsSource,
    completionSummaryCardsSource,
    providerSettingsActionRowSource,
    compactGameDetailSource,
  ]) {
    assert.match(deckySource, /FocusableProps/u);
  }

  assert.equal(existsSync("src/platform/decky/provider-dashboard-preferences.ts"), false);
  assert.doesNotMatch(compactPillSource, /readonly flowChildren\?: "row" \| "column";/u);
  assert.doesNotMatch(cancelBridgeSource, /type BridgeWindow = Window;/u);
  assert.doesNotMatch(compactGameDetailSource, /function getGameDetailSectionHeaderStyle\(/u);
  assert.doesNotMatch(compactGameDetailSource, /readonly index: number;/u);
  assert.doesNotMatch(compactGameDetailSource, /achievements\.map\(\(achievement, index\) =>/u);
});

test("retroachievements profile exposes points, games beaten, and retroratio metrics", async () => {
  const provider = createRetroAchievementsProvider({
    client: {
      async loadProfile() {
        return {
          User: "Alice",
          ULID: "abc123",
          MemberSince: "2020-01-02 00:00:00",
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
            NumAwardedHardcore: 3,
            MaxPossible: 5,
            HighestAwardKind: "beaten",
          },
          {
            GameID: 2,
            Title: "Beaten Two",
            NumAwarded: 3,
            NumAwardedHardcore: 1,
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
    buildRetroAchievementsProfileOverviewStatSections(profile).map((section) => section.title),
    ["Softcore", "Hardcore", "RetroAchievements", "Game Completion"],
  );
  assert.deepStrictEqual(
    buildRetroAchievementsProfileOverviewStatSections(profile).map((section) =>
      section.stats.map((stat) => `${stat.label}:${stat.value}`),
    ),
    [
      ["Points:25", "Unlocked:6"],
      ["Points:100", "Unlocked:4"],
      ["Points:250", "Ratio:2.50"],
      ["Beaten:2", "Mastered:0"],
    ],
  );
});

test("retroachievements profile surfaces separate hardcore and softcore achievement counts", async () => {
  const provider = createRetroAchievementsProvider({
    client: {
      async loadProfile() {
        return {
          User: "Alice",
          ULID: "abc123",
          MemberSince: "2020-01-02 00:00:00",
          TotalPoints: 100,
          TotalSoftcorePoints: 25,
          TotalTruePoints: 250,
        };
      },

      async loadCompletionProgress() {
        return [
          {
            GameID: 1,
            Title: "Hardcore Game",
            NumAwarded: 5,
            NumAwardedHardcore: 3,
            MaxPossible: 5,
            HighestAwardKind: "beaten-hardcore",
          },
          {
            GameID: 2,
            Title: "Softcore Game",
            NumAwarded: 3,
            NumAwardedHardcore: 1,
            MaxPossible: 5,
            HighestAwardKind: "beaten",
          },
          {
            GameID: 3,
            Title: "Mastered Game",
            NumAwarded: 0,
            NumAwardedHardcore: 0,
            MaxPossible: 0,
            HighestAwardKind: "mastered",
          },
          {
            GameID: 4,
            Title: "Completed Game",
            NumAwarded: 8,
            NumAwardedHardcore: 0,
            MaxPossible: 8,
            HighestAwardKind: "completed",
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
  const stats = buildRetroAchievementsProfileOverviewStatSections(profile);

  assert.equal(profile.hardcoreUnlockedCount, 4);
  assert.equal(profile.softcoreUnlockedCount, 12);
  assert.equal(profile.masteredCount, 2);
  assert.equal(profile.beatenHardcoreCount, 1);
  assert.equal(profile.beatenSoftcoreCount, 1);
  assert.equal(profile.masteredHardcoreCount, 1);
  assert.equal(profile.completedSoftcoreCount, 1);
  assert.deepStrictEqual(
    stats.map((section) => section.title),
    [
      "Softcore",
      "Hardcore",
      "RetroAchievements",
      "Game Completion",
    ],
  );
  assert.deepStrictEqual(
    stats.map((section) => section.stats.map((stat) => `${stat.label}:${stat.value}`)),
    [
      ["Points:25", "Unlocked:12"],
      ["Points:100", "Unlocked:4"],
      ["Points:250", "Ratio:2.50"],
      ["Beaten:2", "Mastered:2"],
    ],
  );
  const gameCompletionSection = stats.find((section) => section.title === "Game Completion");
  assert.equal(gameCompletionSection?.stats.length, 2);
  const beatenStat = gameCompletionSection?.stats[0];
  const masteredStat = gameCompletionSection?.stats[1];

  assert.deepStrictEqual(beatenStat, {
    label: "Beaten",
    value: "2",
    completionBreakdown: {
      kind: "beaten",
      items: [
        {
          state: "beaten-softcore",
          count: 1,
          action: "beaten",
          mode: "softcore",
          fullLabel: "softcore",
        },
        {
          state: "beaten-hardcore",
          count: 1,
          action: "beaten",
          mode: "hardcore",
          fullLabel: "hardcore",
        },
      ],
    },
  });
  assert.equal(
    beatenStat?.completionBreakdown?.items.reduce((total, item) => total + (item.count ?? 0), 0),
    Number(beatenStat?.value),
  );
  assert.deepStrictEqual(masteredStat, {
    label: "Mastered",
    value: "2",
    completionBreakdown: {
      kind: "mastered",
      items: [
        {
          state: "mastered-hardcore",
          count: 1,
          action: "mastered",
          mode: "hardcore",
          fullLabel: "hardcore",
        },
        {
          state: "mastered-softcore",
          count: 1,
          action: "completed",
          mode: "softcore",
          fullLabel: "softcore",
        },
      ],
    },
  });
  assert.equal(
    masteredStat?.completionBreakdown?.items.reduce((total, item) => total + (item.count ?? 0), 0),
    Number(masteredStat?.value),
  );
});

test("retroachievements full-screen profile groups stats by category", () => {
  const profile = normalizeRetroAchievementsProfile(
    {
      User: "Retro User",
      ULID: "abc123",
      MemberSince: "2020-01-02 00:00:00",
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

  const sections = getRetroAchievementsProfileStatSections({
    profile,
  });

  assert.deepStrictEqual(
    sections.map((section) => section.title),
    ["Softcore", "Hardcore", "RetroAchievements", "Game Completion"],
  );
  assert.deepStrictEqual(
    sections.map((section) => section.stats.map((stat) => stat.label)),
    [
      ["Points", "Unlocked"],
      ["Points", "Unlocked"],
      ["Points", "Ratio"],
      ["Beaten", "Mastered"],
    ],
  );
  assert.deepStrictEqual(
    sections.map((section) => section.variant),
    ["softcore", "hardcore", "retroachievements", "completion"],
  );
  assert.equal(
    sections.flatMap((section) => section.stats).some((stat) => stat.label === "Member since"),
    false,
  );
});

test("retroachievements profile section helpers apply distinct softcore and hardcore tints", () => {
  const softcoreStyle = getRetroAchievementsProfileSectionStyle("softcore");
  const hardcoreStyle = getRetroAchievementsProfileSectionStyle("hardcore");
  const defaultStyle = getRetroAchievementsProfileSectionStyle("default");
  const retroAchievementsStyle = getRetroAchievementsProfileSectionStyle("retroachievements");
  const completionStyle = getRetroAchievementsProfileSectionStyle("completion");

  assert.equal(softcoreStyle.border, "1px solid rgba(255, 255, 255, 0.06)");
  assert.equal(softcoreStyle.backgroundColor, "rgba(214, 221, 232, 0.03)");
  assert.equal(softcoreStyle.boxShadow, "inset 4px 0 0 rgba(214, 221, 232, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.015)");
  assert.equal(hardcoreStyle.border, "1px solid rgba(255, 255, 255, 0.06)");
  assert.equal(hardcoreStyle.backgroundColor, "rgba(214, 178, 74, 0.035)");
  assert.equal(hardcoreStyle.boxShadow, "inset 4px 0 0 rgba(214, 178, 74, 0.55), inset 0 0 0 1px rgba(255, 255, 255, 0.015)");
  assert.equal(retroAchievementsStyle.border, "1px solid rgba(255, 255, 255, 0.06)");
  assert.equal(retroAchievementsStyle.backgroundColor, "rgba(82, 120, 220, 0.04)");
  assert.equal(
    retroAchievementsStyle.boxShadow,
    "inset 4px 0 0 rgba(91, 153, 255, 0.56), inset 0 0 0 1px rgba(255, 255, 255, 0.015)",
  );
  assert.equal(completionStyle.border, "1px solid rgba(255, 255, 255, 0.06)");
  assert.equal(completionStyle.backgroundColor, "rgba(60, 168, 192, 0.04)");
  assert.equal(
    completionStyle.boxShadow,
    "inset 4px 0 0 rgba(91, 208, 220, 0.56), inset 0 0 0 1px rgba(255, 255, 255, 0.015)",
  );
  assert.equal(defaultStyle.border, "1px solid rgba(255, 255, 255, 0.06)");
  assert.equal(defaultStyle.backgroundColor, "rgba(255, 255, 255, 0.02)");
  assert.equal(defaultStyle.boxShadow, undefined);

  const softcoreTitleStyle = getRetroAchievementsProfileSectionTitleStyle("softcore");
  const hardcoreTitleStyle = getRetroAchievementsProfileSectionTitleStyle("hardcore");
  const retroAchievementsTitleStyle = getRetroAchievementsProfileSectionTitleStyle("retroachievements");
  const completionTitleStyle = getRetroAchievementsProfileSectionTitleStyle("completion");
  const defaultTitleStyle = getRetroAchievementsProfileSectionTitleStyle("default");

  assert.equal(softcoreTitleStyle.color, "rgba(220, 225, 233, 0.86)");
  assert.equal(hardcoreTitleStyle.color, "rgba(232, 201, 102, 0.9)");
  assert.equal(retroAchievementsTitleStyle.color, "rgba(122, 178, 255, 0.92)");
  assert.equal(completionTitleStyle.color, "rgba(125, 225, 236, 0.92)");
  assert.equal(defaultTitleStyle.color, "rgba(255, 255, 255, 0.58)");
});

test("retroachievements full-screen profile section accents mirror the grouped mode language", () => {
  const softcoreAccent = getRetroAchievementsProfileSectionAccentStyle("softcore");
  const hardcoreAccent = getRetroAchievementsProfileSectionAccentStyle("hardcore");
  const retroAchievementsAccent = getRetroAchievementsProfileSectionAccentStyle("retroachievements");
  const completionAccent = getRetroAchievementsProfileSectionAccentStyle("completion");
  const defaultAccent = getRetroAchievementsProfileSectionAccentStyle("default");

  assert.equal(softcoreAccent.position, "absolute");
  assert.equal(softcoreAccent.width, 4);
  assert.equal(softcoreAccent.background, "linear-gradient(180deg, rgba(214, 221, 232, 0.84), rgba(214, 221, 232, 0.42))");
  assert.equal(hardcoreAccent.position, "absolute");
  assert.equal(hardcoreAccent.width, 4);
  assert.equal(hardcoreAccent.background, "linear-gradient(180deg, rgba(232, 201, 102, 0.92), rgba(214, 178, 74, 0.56))");
  assert.equal(retroAchievementsAccent.position, "absolute");
  assert.equal(retroAchievementsAccent.width, 4);
  assert.equal(
    retroAchievementsAccent.background,
    "linear-gradient(180deg, rgba(122, 178, 255, 0.92), rgba(91, 153, 255, 0.56))",
  );
  assert.equal(completionAccent.position, "absolute");
  assert.equal(completionAccent.width, 4);
  assert.equal(
    completionAccent.background,
    "linear-gradient(180deg, rgba(125, 225, 236, 0.9), rgba(91, 208, 220, 0.56))",
  );
  assert.equal(defaultAccent.position, "absolute");
  assert.equal(defaultAccent.width, 4);
  assert.equal(defaultAccent.background, "rgba(255, 255, 255, 0.08)");
});

test("retroachievements profile stats fall back safely when counts are unavailable", () => {
  const profile = normalizeRetroAchievementsProfile(
    {
      User: "Retro User",
      ULID: "abc123",
      MemberSince: "2020-01-02 00:00:00",
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

  const stats = buildRetroAchievementsProfileOverviewStatSections(profile);

  assert.deepStrictEqual(
    stats.map((section) => section.title),
    [
      "Softcore",
      "Hardcore",
      "RetroAchievements",
      "Game Completion",
    ],
  );
  assert.deepStrictEqual(
    stats.map((section) => section.stats.map((stat) => `${stat.label}:${stat.value}`)),
    [
      ["Points:4321", "Unlocked:-"],
      ["Points:1234", "Unlocked:-"],
      ["Points:987", "Ratio:0.80"],
      ["Beaten:-", "Mastered:-"],
    ],
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
  assert.equal(
    games
      .find((game) => game.title === "Beaten Game")
      ?.metrics.find((metric) => metric.key === "highest-award-kind")?.value,
    "beaten-hardcore",
  );
});

test("retroachievements completion indicator maps award kind to compact circle states", () => {
  const createGame = (
    highestAwardKind: string,
    providerId = PROVIDER_ID,
  ): Pick<NormalizedGame, "providerId" | "metrics"> => ({
    providerId,
    metrics: [
      {
        key: "highest-award-kind",
        label: "Highest Award",
        value: highestAwardKind,
      },
    ],
  });

  assert.equal(getRetroAchievementsCompletionIndicatorState(createGame("beaten-hardcore")), "beaten-hardcore");
  assert.equal(getRetroAchievementsCompletionIndicatorState(createGame("mastered")), "mastered-hardcore");
  assert.equal(getRetroAchievementsCompletionIndicatorState(createGame("beaten")), "beaten-softcore");
  assert.equal(getRetroAchievementsCompletionIndicatorState(createGame("completed")), "mastered-softcore");
  assert.equal(getRetroAchievementsCompletionIndicatorState(createGame("mastered", "steam")), undefined);
  assert.equal(getRetroAchievementsCompletionIndicatorState({ providerId: PROVIDER_ID, metrics: [] }), undefined);
  assert.equal(isRetroAchievementsBeatenGame(createGame("beaten-hardcore")), true);
  assert.equal(isRetroAchievementsBeatenGame(createGame("beaten")), true);
  assert.equal(isRetroAchievementsBeatenGame(createGame("mastered")), false);
  assert.equal(isRetroAchievementsMasteredHardcoreGame(createGame("mastered")), true);
  assert.equal(isRetroAchievementsMasteredHardcoreGame(createGame("completed")), false);
  assert.equal(isRetroAchievementsMasteredHardcoreGame(createGame("mastered", "steam")), false);
  assert.equal(
    isRetroAchievementsBeatenGame({
      providerId: PROVIDER_ID,
      metrics: [],
      summary: {
        unlockedCount: 20,
        totalCount: 40,
        completionPercent: 50,
      },
    } as Pick<RecentlyPlayedGame, "providerId" | "metrics" | "summary">),
    false,
  );
  assert.equal(
    isRetroAchievementsMasteredHardcoreGame({
      providerId: PROVIDER_ID,
      metrics: [],
      summary: {
        unlockedCount: 57,
        totalCount: 57,
        completionPercent: 100,
      },
    } as Pick<RecentlyPlayedGame, "providerId" | "metrics" | "summary">),
    false,
  );

  assert.equal(formatRetroAchievementsCompletionIndicatorLabel("beaten-hardcore"), "Beaten in hardcore");
  assert.equal(formatRetroAchievementsCompletionIndicatorLabel("mastered-hardcore"), "Mastered in hardcore");
  assert.equal(formatRetroAchievementsCompletionIndicatorLabel("beaten-softcore"), "Beaten in softcore");
  assert.equal(formatRetroAchievementsCompletionIndicatorLabel("mastered-softcore"), "Mastered in softcore");

  assert.equal(getRetroAchievementsCompletionIndicatorStyle("beaten-hardcore").backgroundColor, "rgba(214, 221, 232, 0.96)");
  assert.equal(getRetroAchievementsCompletionIndicatorStyle("mastered-hardcore").backgroundColor, "rgba(232, 201, 102, 0.98)");
  assert.equal(getRetroAchievementsCompletionIndicatorStyle("beaten-softcore").backgroundColor, "transparent");
  assert.equal(getRetroAchievementsCompletionIndicatorStyle("mastered-softcore").backgroundColor, "transparent");

  const fullScreenCompletionProgressSource = readFileSync(
    "src/platform/decky/decky-full-screen-completion-progress-page.tsx",
    "utf8",
  );
  const compactDashboardSource = readFileSync("src/platform/decky/decky-dashboard-view.tsx", "utf8");
  const gameDetailSource = readFileSync("src/platform/decky/decky-game-detail-view.tsx", "utf8");
  const fullScreenGameSource = readFileSync("src/platform/decky/decky-full-screen-game-page.tsx", "utf8");

  assert.match(fullScreenCompletionProgressSource, /RetroAchievementsCompletionIndicator game=\{game\}/u);
  assert.match(gameDetailSource, /RetroAchievementsCompletionIndicator game=\{game\}/u);
  assert.match(fullScreenGameSource, /RetroAchievementsCompletionIndicator game=\{game\}/u);
  assert.match(compactDashboardSource, /function RecentlyPlayedRow\([\s\S]*<RetroAchievementsCompletionIndicator game=\{game\} \/>/u);
});

test("retroachievements mastered date text requires explicit hardcore mastered state", () => {
  const masteredAtText = formatRetroAchievementsMasteredAtText({
    providerId: PROVIDER_ID,
    lastUnlockAt: Date.parse("2024-04-23T21:28:49Z"),
    metrics: [
      {
        key: "highest-award-kind",
        label: "Highest Award",
        value: "mastered",
      },
    ],
  });

  assert.match(masteredAtText ?? "", /^Mastered on /u);
  assert.equal(
    formatRetroAchievementsMasteredAtText({
      providerId: PROVIDER_ID,
      lastUnlockAt: Date.parse("2024-04-23T21:28:49Z"),
      metrics: [],
    }),
    undefined,
  );
  assert.equal(
    formatRetroAchievementsMasteredAtText({
      providerId: STEAM_PROVIDER_ID,
      lastUnlockAt: Date.parse("2024-04-23T21:28:49Z"),
      metrics: [
        {
          key: "highest-award-kind",
          label: "Highest Award",
          value: "mastered",
        },
      ],
    }),
    undefined,
  );
});

test("retroachievements beaten date text requires explicit beaten state", () => {
  const beatenAtText = formatRetroAchievementsBeatenAtText({
    providerId: PROVIDER_ID,
    lastUnlockAt: Date.parse("2024-04-23T21:28:49Z"),
    metrics: [
      {
        key: "highest-award-kind",
        label: "Highest Award",
        value: "beaten-hardcore",
      },
    ],
  });

  assert.match(beatenAtText ?? "", /^Beaten on /u);
  assert.equal(
    formatRetroAchievementsBeatenAtText({
      providerId: PROVIDER_ID,
      lastUnlockAt: Date.parse("2024-04-23T21:28:49Z"),
      metrics: [],
    }),
    undefined,
  );
  assert.equal(
    formatRetroAchievementsBeatenAtText({
      providerId: PROVIDER_ID,
      lastUnlockAt: Date.parse("2024-04-23T21:28:49Z"),
      metrics: [
        {
          key: "highest-award-kind",
          label: "Highest Award",
          value: "mastered",
        },
      ],
    }),
    undefined,
  );
  assert.equal(
    formatRetroAchievementsBeatenAtText({
      providerId: STEAM_PROVIDER_ID,
      lastUnlockAt: Date.parse("2024-04-23T21:28:49Z"),
      metrics: [
        {
          key: "highest-award-kind",
          label: "Highest Award",
          value: "beaten-hardcore",
        },
      ],
    }),
    undefined,
  );
});

test("retroachievements mastered games use explicit mastered presentation on game progress surfaces", () => {
  const achievementDetailHelperSource = readFileSync(
    "src/platform/decky/decky-achievement-detail-helpers.ts",
    "utf8",
  );
  const progressBarSource = readFileSync("src/platform/decky/decky-completion-progress-bar.tsx", "utf8");
  const compactDashboardSource = readFileSync("src/platform/decky/decky-dashboard-view.tsx", "utf8");
  const gameDetailSource = readFileSync("src/platform/decky/decky-game-detail-view.tsx", "utf8");
  const fullScreenGameSource = readFileSync("src/platform/decky/decky-full-screen-game-page.tsx", "utf8");
  const steamProviderSource = readFileSync("src/providers/steam/mappers/normalize.ts", "utf8");

  assert.match(
    progressBarSource,
    /type DeckyCompletionProgressBarTone =[\s\S]*"default"[\s\S]*"retroachievements-mastered"[\s\S]*"retroachievements-beaten"/u,
  );
  assert.match(progressBarSource, /data-completion-progress-tone=\{tone\}/u);
  assert.match(progressBarSource, /rgba\(214, 178, 74, 0\.94\)[\s\S]*rgba\(232, 201, 102, 0\.98\)/u);
  assert.match(progressBarSource, /rgba\(188, 198, 211, 0\.94\)[\s\S]*rgba\(223, 230, 239, 0\.98\)/u);
  assert.match(achievementDetailHelperSource, /export function formatRetroAchievementsBeatenAtText/u);
  assert.match(achievementDetailHelperSource, /Beaten on/u);
  assert.match(achievementDetailHelperSource, /export function formatRetroAchievementsMasteredAtText/u);
  assert.match(achievementDetailHelperSource, /Mastered on/u);

  assert.match(gameDetailSource, /const completionIndicatorState = getRetroAchievementsCompletionIndicatorState\(game\);/u);
  assert.match(gameDetailSource, /const isBeaten =[\s\S]*completionIndicatorState === "beaten-hardcore"[\s\S]*completionIndicatorState === "beaten-softcore"/u);
  assert.match(gameDetailSource, /const completionStatusLabel = isMasteredHardcore \? "Mastered" : isBeaten \? "Beaten" : undefined;/u);
  assert.match(gameDetailSource, /<span>\{completionStatusLabel\}<\/span>/u);
  assert.match(gameDetailSource, /const beatenAtText = formatRetroAchievementsBeatenAtText\(game\);/u);
  assert.match(gameDetailSource, /const masteredAtText = formatRetroAchievementsMasteredAtText\(game\);/u);
  assert.match(gameDetailSource, /const completionAtText = isMasteredHardcore \? masteredAtText : beatenAtText;/u);
  assert.match(gameDetailSource, /tone=\{completionTone\}/u);

  assert.match(fullScreenGameSource, /const completionIndicatorState = getRetroAchievementsCompletionIndicatorState\(game\);/u);
  assert.match(fullScreenGameSource, /const isBeaten =[\s\S]*completionIndicatorState === "beaten-hardcore"[\s\S]*completionIndicatorState === "beaten-softcore"/u);
  assert.match(fullScreenGameSource, /const completionStatusLabel = isMasteredHardcore \? "Mastered" : isBeaten \? "Beaten" : undefined;/u);
  assert.match(fullScreenGameSource, /<span>\{completionStatusLabel\}<\/span>/u);
  assert.match(fullScreenGameSource, /const beatenAtText = formatRetroAchievementsBeatenAtText\(game\);/u);
  assert.match(fullScreenGameSource, /const masteredAtText = formatRetroAchievementsMasteredAtText\(game\);/u);
  assert.match(fullScreenGameSource, /const completionAtText = isMasteredHardcore \? masteredAtText : beatenAtText;/u);
  assert.match(fullScreenGameSource, /tone=\{completionTone\}/u);

  assert.match(compactDashboardSource, /const completionIndicatorState = getRetroAchievementsCompletionIndicatorState\(game\);/u);
  assert.match(compactDashboardSource, /const isBeaten =[\s\S]*completionIndicatorState === "beaten-hardcore"[\s\S]*completionIndicatorState === "beaten-softcore"/u);
  assert.match(compactDashboardSource, /const completionStatusLabel = isMasteredHardcore \? "Mastered" : isBeaten \? "Beaten" : undefined;/u);
  assert.match(compactDashboardSource, /<RetroAchievementsCompletionIndicator game=\{game\} \/>/u);
  assert.match(compactDashboardSource, /<span>\{completionStatusLabel\}<\/span>/u);
  assert.match(compactDashboardSource, /tone=\{progressTone\}/u);
  assert.doesNotMatch(
    steamProviderSource,
    /highest-award-kind|retroachievements-mastered|retroachievements-beaten|RetroAchievementsCompletionIndicator/u,
  );
});

test("retroachievements fullscreen completion progress rows use explicit beaten and mastered progress tones", () => {
  const fullScreenCompletionProgressSource = readFileSync(
    "src/platform/decky/decky-full-screen-completion-progress-page.tsx",
    "utf8",
  );
  const steamProviderSource = readFileSync("src/providers/steam/mappers/normalize.ts", "utf8");

  assert.match(
    fullScreenCompletionProgressSource,
    /function getCompletionProgressRowTone[\s\S]*getRetroAchievementsCompletionIndicatorState\(game\)/u,
  );
  assert.match(
    fullScreenCompletionProgressSource,
    /completionIndicatorState === "mastered-hardcore"[\s\S]*completionIndicatorState === "mastered-softcore"[\s\S]*return "retroachievements-mastered";/u,
  );
  assert.match(
    fullScreenCompletionProgressSource,
    /completionIndicatorState === "beaten-hardcore"[\s\S]*completionIndicatorState === "beaten-softcore"[\s\S]*return "retroachievements-beaten";/u,
  );
  assert.match(fullScreenCompletionProgressSource, /return "default";/u);
  assert.match(fullScreenCompletionProgressSource, /const progressTone = getCompletionProgressRowTone\(game\);/u);
  assert.match(
    fullScreenCompletionProgressSource,
    /<DeckyCompletionProgressBar compact percent=\{completionPercent\} tone=\{progressTone\} \/>/u,
  );
  assert.doesNotMatch(
    steamProviderSource,
    /retroachievements-mastered|retroachievements-beaten|getRetroAchievementsCompletionIndicatorState/u,
  );
});

test("retroachievements game detail surfaces hide empty mode cards and keep meaningful mode cards", () => {
  const achievementDetailHelperSource = readFileSync(
    "src/platform/decky/decky-achievement-detail-helpers.ts",
    "utf8",
  );
  const gameDetailSource = readFileSync("src/platform/decky/decky-game-detail-view.tsx", "utf8");
  const fullScreenGameSource = readFileSync("src/platform/decky/decky-full-screen-game-page.tsx", "utf8");
  const steamProviderSource = readFileSync("src/providers/steam/mappers/normalize.ts", "utf8");

  assert.match(achievementDetailHelperSource, /export function shouldRenderRetroAchievementsModeSummaryCard/u);
  assert.match(achievementDetailHelperSource, /summary\.unlockedCount > 0/u);
  assert.match(achievementDetailHelperSource, /\(summary\.completionPercent \?\? 0\) > 0/u);
  assert.match(achievementDetailHelperSource, /\(points \?\? 0\) > 0/u);
  assert.match(
    achievementDetailHelperSource,
    /completionState === "beaten-hardcore" \|\| completionState === "mastered-hardcore"/u,
  );
  assert.match(
    achievementDetailHelperSource,
    /completionState === "beaten-softcore" \|\| completionState === "mastered-softcore"/u,
  );

  assert.match(gameDetailSource, /const showSoftcoreModeCard = shouldRenderRetroAchievementsModeSummaryCard\(\{/u);
  assert.match(gameDetailSource, /const showHardcoreModeCard = shouldRenderRetroAchievementsModeSummaryCard\(\{/u);
  assert.match(gameDetailSource, /const visibleModeCardCount = Number\(showSoftcoreModeCard\) \+ Number\(showHardcoreModeCard\);/u);
  assert.match(gameDetailSource, /function getModeProgressGridStyle\(singleColumn: boolean\): CSSProperties/u);
  assert.match(gameDetailSource, /gridTemplateColumns: singleColumn \? "minmax\(0, 1fr\)" : "repeat\(2, minmax\(0, 1fr\)\)"/u);
  assert.match(gameDetailSource, /style=\{getModeProgressGridStyle\(visibleModeCardCount === 1\)\}/u);
  assert.match(gameDetailSource, /\{showSoftcoreModeCard \|\| showHardcoreModeCard \? \(/u);
  assert.match(gameDetailSource, /\{showSoftcoreModeCard \? \(/u);
  assert.match(gameDetailSource, /\{showHardcoreModeCard \? \(/u);
  assert.doesNotMatch(gameDetailSource, /\{game\.softcoreSummary !== undefined \? \(/u);
  assert.doesNotMatch(gameDetailSource, /\{game\.hardcoreSummary !== undefined \? \(/u);

  assert.match(fullScreenGameSource, /const showHardcoreModeCard = shouldRenderRetroAchievementsModeSummaryCard\(\{/u);
  assert.match(fullScreenGameSource, /const showSoftcoreModeCard = shouldRenderRetroAchievementsModeSummaryCard\(\{/u);
  assert.match(fullScreenGameSource, /function getModeProgressGridStyle\(\): CSSProperties/u);
  assert.doesNotMatch(fullScreenGameSource, /visibleModeCardCount/u);
  assert.doesNotMatch(fullScreenGameSource, /singleColumn/u);
  assert.match(fullScreenGameSource, /\{showHardcoreModeCard \|\| showSoftcoreModeCard \? \(/u);
  assert.match(fullScreenGameSource, /\{showHardcoreModeCard \? \(/u);
  assert.match(fullScreenGameSource, /\{showSoftcoreModeCard \? \(/u);
  assert.doesNotMatch(fullScreenGameSource, /\{game\.hardcoreSummary !== undefined \? \(/u);
  assert.doesNotMatch(fullScreenGameSource, /\{game\.softcoreSummary !== undefined \? \(/u);
  assert.doesNotMatch(steamProviderSource, /shouldRenderRetroAchievementsModeSummaryCard/u);
});

test("retroachievements profile completion tiles render compact and fullscreen breakdowns without adding tiles", () => {
  const profile = normalizeRetroAchievementsProfile(
    {
      User: "Retro User",
      ULID: "abc123",
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
    [],
    2,
    1,
    undefined,
    {
      beatenHardcoreCount: 1,
      beatenSoftcoreCount: 1,
      masteredHardcoreCount: 1,
      completedSoftcoreCount: undefined,
    },
  );
  const completionSection = getRetroAchievementsProfileStatSections({ profile }).find(
    (section) => section.title === "Game Completion",
  );
  const steamStats = buildProviderOverviewStats({
    providerId: STEAM_PROVIDER_ID,
    identity: {
      providerId: STEAM_PROVIDER_ID,
      accountId: "steam-account",
      displayName: "Steam User",
    },
    summary: {
      unlockedCount: 10,
      completionPercent: 50,
    },
    metrics: [],
  });
  const compactDashboardSource = readFileSync("src/platform/decky/decky-dashboard-view.tsx", "utf8");
  const fullScreenProfileSource = readFileSync("src/platform/decky/decky-full-screen-profile-page.tsx", "utf8");
  const indicatorSource = readFileSync(
    "src/platform/decky/decky-retroachievements-completion-indicator.tsx",
    "utf8",
  );

  assert.deepStrictEqual(
    completionSection?.stats.map((stat) => stat.label),
    ["Beaten", "Mastered"],
  );
  assert.deepStrictEqual(completionSection?.stats[0]?.completionBreakdown, {
    kind: "beaten",
    items: [
      {
        state: "beaten-softcore",
        count: 1,
        action: "beaten",
        mode: "softcore",
        fullLabel: "softcore",
      },
      {
        state: "beaten-hardcore",
        count: 1,
        action: "beaten",
        mode: "hardcore",
        fullLabel: "hardcore",
      },
    ],
  });
  assert.deepStrictEqual(completionSection?.stats[1]?.completionBreakdown, {
    kind: "mastered",
    items: [
      {
        state: "mastered-hardcore",
        count: 1,
        action: "mastered",
        mode: "hardcore",
        fullLabel: "hardcore",
      },
      {
        state: "mastered-softcore",
        count: undefined,
        action: "completed",
        mode: "softcore",
        fullLabel: "softcore",
      },
    ],
  });
  assert.equal(steamStats.some((stat) => stat.completionBreakdown !== undefined), false);
  assert.match(compactDashboardSource, /RetroAchievementsCompletionBreakdown[\s\S]*variant="compact"/u);
  assert.match(fullScreenProfileSource, /RetroAchievementsCompletionBreakdown[\s\S]*variant="full"/u);
  assert.match(indicatorSource, /data-retroachievements-completion-breakdown=\{kind\}/u);
  assert.match(indicatorSource, /item\.count !== undefined && item\.count > 0/u);
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

test("completion progress groups named subset titles under the parent game and leaves ordinary bracketed titles separate", () => {
  const groupedGames = groupCompletionProgressGames([
    {
      providerId: PROVIDER_ID,
      gameId: "base-game",
      title: "Final Fantasy X: International",
      platformLabel: "PlayStation 2",
      status: "in_progress",
      summary: {
        unlockedCount: 20,
        totalCount: 40,
        completionPercent: 50,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_001_000,
    },
    {
      providerId: PROVIDER_ID,
      gameId: "subset-a",
      title: "Final Fantasy X: International [Subset - No Sphere Grid]",
      platformLabel: "PlayStation 2",
      status: "in_progress",
      summary: {
        unlockedCount: 12,
        totalCount: 24,
        completionPercent: 50,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_900,
    },
    {
      providerId: PROVIDER_ID,
      gameId: "subset-b",
      title: "Final Fantasy X: International (Challenge Set - No Sphere Grid)",
      platformLabel: "PlayStation 2",
      status: "in_progress",
      summary: {
        unlockedCount: 8,
        totalCount: 16,
        completionPercent: 50,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_800,
    },
    {
      providerId: PROVIDER_ID,
      gameId: "non-subset",
      title: "Final Fantasy X: International [HD Remaster]",
      platformLabel: "PlayStation 2",
      status: "beaten",
      summary: {
        unlockedCount: 40,
        totalCount: 40,
        completionPercent: 100,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_700,
    },
  ] satisfies readonly NormalizedGame[]);

  const groupedFinalFantasyX = groupedGames.find(
    (group) => group.representativeGame.title === "Final Fantasy X: International",
  );
  const bracketedNonSubset = groupedGames.find(
    (group) => group.representativeGame.title === "Final Fantasy X: International [HD Remaster]",
  );

  assert.equal(groupedGames.length, 2);
  assert.equal(groupedFinalFantasyX?.games.length, 3);
  assert.equal(groupedFinalFantasyX?.subsetGames.length, 2);
  assert.deepStrictEqual(
    groupedFinalFantasyX?.subsetGames.map((game) => game.title),
    [
      "Final Fantasy X: International [Subset - No Sphere Grid]",
      "Final Fantasy X: International (Challenge Set - No Sphere Grid)",
    ],
  );
  assert.equal(bracketedNonSubset?.subsetGames.length, 0);
});

test("completion progress subset visibility excludes unfinished subset games when hidden", () => {
  const games = [
    {
      providerId: PROVIDER_ID,
      gameId: "base-game",
      title: "Final Fantasy X: International",
      platformLabel: "PlayStation 2",
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
      title: "Final Fantasy X: International [Subset - No Sphere Grid]",
      platformLabel: "PlayStation 2",
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
      title: "Final Fantasy X: International (Challenge Set - No Sphere Grid)",
      platformLabel: "PlayStation 2",
      status: "in_progress",
      summary: {
        unlockedCount: 2,
        totalCount: 4,
        completionPercent: 50,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_700,
    },
    {
      providerId: PROVIDER_ID,
      gameId: "non-subset",
      title: "Final Fantasy X: International [HD Remaster]",
      platformLabel: "PlayStation 2",
      status: "in_progress",
      summary: {
        unlockedCount: 4,
        totalCount: 8,
        completionPercent: 50,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_650,
    },
    {
      providerId: PROVIDER_ID,
      gameId: "beaten-game",
      title: "Donkey Kong Country",
      platformLabel: "SNES",
      status: "beaten",
      summary: {
        unlockedCount: 8,
        totalCount: 8,
        completionPercent: 100,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_600,
    },
  ] satisfies readonly NormalizedGame[];
  const summary = {
    playedCount: 33,
    unfinishedCount: 32,
    beatenCount: 1,
    masteredCount: 0,
  };

  const hiddenGames = filterCompletionProgressGamesBySubsetVisibility(games, false);
  const visibleGames = filterCompletionProgressGamesBySubsetVisibility(games, true);
  const hiddenSummary = summarizeCompletionProgressSummaryBySubsetVisibility(summary, games, false);
  const visibleSummary = summarizeCompletionProgressSummaryBySubsetVisibility(summary, games, true);

  assert.equal(hiddenGames.length, 3);
  assert.deepStrictEqual(
    hiddenGames.map((game) => game.title),
    [
      "Final Fantasy X: International",
      "Final Fantasy X: International [HD Remaster]",
      "Donkey Kong Country",
    ],
  );
  assert.equal(visibleGames.length, 5);
  assert.equal(hiddenSummary.playedCount, 33);
  assert.equal(hiddenSummary.unfinishedCount, 30);
  assert.equal(hiddenSummary.beatenCount, 1);
  assert.equal(hiddenSummary.masteredCount, 0);
  assert.equal(visibleSummary.playedCount, 33);
  assert.equal(visibleSummary.unfinishedCount, 32);
  assert.equal(visibleSummary.beatenCount, 1);
  assert.equal(visibleSummary.masteredCount, 0);
});

test("completion progress subset visibility keeps subset rows selectable when shown and hidden when off", () => {
  const games = [
    {
      providerId: PROVIDER_ID,
      gameId: "base-game",
      title: "Final Fantasy X: International",
      platformLabel: "PlayStation 2",
      status: "in_progress",
      summary: {
        unlockedCount: 5,
        totalCount: 10,
        completionPercent: 50,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_001_000,
    },
    {
      providerId: PROVIDER_ID,
      gameId: "subset-a",
      title: "Final Fantasy X: International [Subset - No Sphere Grid]",
      platformLabel: "PlayStation 2",
      status: "in_progress",
      summary: {
        unlockedCount: 3,
        totalCount: 6,
        completionPercent: 50,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_900,
    },
    {
      providerId: PROVIDER_ID,
      gameId: "subset-b",
      title: "Final Fantasy X: International (Challenge Set - No Sphere Grid)",
      platformLabel: "PlayStation 2",
      status: "in_progress",
      summary: {
        unlockedCount: 2,
        totalCount: 4,
        completionPercent: 50,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_800,
    },
    {
      providerId: PROVIDER_ID,
      gameId: "non-subset",
      title: "Final Fantasy X: International [HD Remaster]",
      platformLabel: "PlayStation 2",
      status: "beaten",
      summary: {
        unlockedCount: 4,
        totalCount: 8,
        completionPercent: 50,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_700,
    },
    ...Array.from({ length: 29 }, (_, index) => ({
      providerId: PROVIDER_ID,
      gameId: `extra-game-${index + 1}`,
      title: `Extra Game ${index + 1}`,
      platformLabel: "SNES",
      status: "in_progress" as const,
      summary: {
        unlockedCount: 1,
        totalCount: 2,
        completionPercent: 50,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_600 - index,
    })),
  ] satisfies readonly NormalizedGame[];
  const summary = {
    playedCount: 33,
    unfinishedCount: 32,
    beatenCount: 1,
    masteredCount: 0,
  };

  const hiddenGames = filterCompletionProgressGamesBySubsetVisibility(games, false);
  const visibleGames = filterCompletionProgressGamesBySubsetVisibility(games, true);
  const hiddenGroups = groupCompletionProgressGames(hiddenGames, false);
  const visibleGroups = groupCompletionProgressGames(visibleGames, true);
  const hiddenSummary = summarizeCompletionProgressSummaryBySubsetVisibility(summary, games, false);
  const visibleSummary = summarizeCompletionProgressSummaryBySubsetVisibility(summary, games, true);

  assert.equal(countCompletionProgressSubsetGames(games), 2);
  assert.equal(hiddenGames.length, 31);
  assert.equal(visibleGames.length, 33);
  assert.equal(hiddenGroups.length, 31);
  assert.equal(visibleGroups.length, 33);
  assert.equal(
    hiddenGames.some((game) =>
      game.title === "Final Fantasy X: International [Subset - No Sphere Grid]" ||
      game.title === "Final Fantasy X: International (Challenge Set - No Sphere Grid)",
    ),
    false,
  );
  assert.equal(
    visibleGroups.some(
      (group) => group.representativeGame.title === "Final Fantasy X: International [Subset - No Sphere Grid]",
    ),
    true,
  );
  assert.equal(
    visibleGroups.some(
      (group) => group.representativeGame.title === "Final Fantasy X: International (Challenge Set - No Sphere Grid)",
    ),
    true,
  );
  assert.equal(hiddenSummary.playedCount, 33);
  assert.equal(hiddenSummary.unfinishedCount, 30);
  assert.equal(hiddenSummary.beatenCount, 1);
  assert.equal(hiddenSummary.masteredCount, 0);
  assert.equal(visibleSummary.playedCount, 33);
  assert.equal(visibleSummary.unfinishedCount, 32);
  assert.equal(visibleSummary.beatenCount, 1);
  assert.equal(visibleSummary.masteredCount, 0);
});

test("completion progress summary cards replace the old filter pill row and act as filter controls", () => {
  const summaryHiddenSubsets = {
    playedCount: 33,
    unfinishedCount: 30,
    beatenCount: 1,
    masteredCount: 0,
  };
  const summaryVisibleSubsets = {
    playedCount: 33,
    unfinishedCount: 32,
    beatenCount: 1,
    masteredCount: 0,
  };
  const cardsHiddenSubsets = buildCompletionProgressSummaryCards({
    summary: summaryHiddenSubsets,
    subsetCount: 2,
    providerId: PROVIDER_ID,
    currentFilter: "unfinished",
    showSubsets: false,
  });
  const cardsVisibleSubsets = buildCompletionProgressSummaryCards({
    summary: summaryVisibleSubsets,
    subsetCount: 2,
    providerId: PROVIDER_ID,
    currentFilter: "subsets",
    showSubsets: true,
  });
  const renderSource = readFileSync(
    join("src", "platform", "decky", "decky-completion-progress-summary-cards.tsx"),
    "utf8",
  );
  const summaryCardDataSource = readFileSync(
    join("src", "platform", "decky", "decky-completion-progress-summary-card-data.ts"),
    "utf8",
  );
  const groupingSource = readFileSync(
    join("src", "platform", "decky", "decky-completion-progress-grouping.ts"),
    "utf8",
  );
  const pageSource = readFileSync(
    join("src", "platform", "decky", "decky-full-screen-completion-progress-page.tsx"),
    "utf8",
  );

  assert.deepStrictEqual(cardsHiddenSubsets.map((card) => card.label), [
    "Played",
    "Unfinished",
    "Subsets",
    "Beaten",
    "Mastered",
  ]);
  assert.deepStrictEqual(cardsHiddenSubsets.map((card) => card.filter), [
    "all",
    "unfinished",
    "subsets",
    "beaten",
    "mastered",
  ]);
  assert.deepStrictEqual(
    cardsHiddenSubsets.map((card) => `${card.label}:${card.selected ? "selected" : "idle"}:${card.disabled ? "disabled" : "enabled"}`),
    [
      "Played:idle:enabled",
      "Unfinished:selected:enabled",
      "Subsets:idle:disabled",
      "Beaten:idle:enabled",
      "Mastered:idle:enabled",
    ],
  );
  assert.deepStrictEqual(
    cardsVisibleSubsets.map((card) => `${card.label}:${card.selected ? "selected" : "idle"}:${card.disabled ? "disabled" : "enabled"}`),
    [
      "Played:idle:enabled",
      "Unfinished:idle:enabled",
      "Subsets:selected:enabled",
      "Beaten:idle:enabled",
      "Mastered:idle:enabled",
    ],
  );
  assert.equal(renderSource.includes("Focusable"), true);
  assert.equal(renderSource.includes("role=\"button\""), true);
  assert.equal(renderSource.includes("tabIndex={disabled ? -1 : undefined}"), true);
  assert.equal(renderSource.includes("noFocusRing"), true);
  assert.equal(renderSource.includes("onActivate"), true);
  assert.equal(renderSource.includes("onGamepadFocus"), true);
  assert.equal(renderSource.includes("onBlur"), true);
  assert.equal(renderSource.includes("aria-pressed={selected}"), true);
  assert.equal(renderSource.includes("aria-disabled={disabled}"), true);
  assert.equal(renderSource.includes("data-completion-progress-filter-selected"), true);
  assert.equal(renderSource.includes("data-completion-progress-filter-disabled"), true);
  assert.equal(renderSource.includes("repeat(5, minmax(0, 1fr))"), true);
  assert.equal(renderSource.includes("gap: 12"), true);
  assert.equal(renderSource.includes('padding: "12px 12px 11px"'), true);
  assert.equal(renderSource.includes('borderRadius: 16'), true);
  assert.equal(renderSource.includes('rgba(255, 255, 255, 0.075)'), true);
  assert.equal(renderSource.includes('rgba(255, 255, 255, 0.032)'), true);
  assert.equal(renderSource.includes('rgba(96, 165, 250, 0.16)'), true);
  assert.equal(renderSource.includes('rgba(96, 165, 250, 0.24)'), true);
  assert.equal(renderSource.includes("<button"), false);
  assert.equal(renderSource.includes("Field"), false);
  assert.equal(renderSource.includes('from "./decky-completion-progress-summary-card-data"'), true);
  assert.equal(renderSource.includes("function formatCompletionProgressSelectionLabelForProvider"), false);
  assert.equal(renderSource.includes("export function buildCompletionProgressSummaryCards({"), false);
  assert.equal(summaryCardDataSource.includes("export function buildCompletionProgressSummaryCards"), true);
  assert.equal(getDeckyFocusStylesCss().includes("achievement-companion-completion-progress-summary-card"), false);
  assert.equal(groupingSource.includes("subset sets"), false);
  assert.equal(pageSource.includes("CompletionProgressFilterPills"), false);
  assert.equal(pageSource.includes("COMPLETION_PROGRESS_FILTERS"), false);
  assert.equal(pageSource.includes("export interface CompletionProgressGameGroup"), false);
  assert.equal(pageSource.includes("export function groupCompletionProgressGames"), false);
  assert.equal(pageSource.includes("function formatSteamPlaytimeMinutes"), false);
  assert.equal(pageSource.includes("function parseCompletionProgressSubsetTitle"), false);
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
  NumDistinctPlayers: 456,
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
  assert.match(source, /deckyDiagnosticLogger\.record/);
});

test("decky dashboard refresh reuses an in-flight refresh for the same provider", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
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

    const diagnosticEvents: Array<Record<string, unknown>> = [];
    setDeckyBackendCallImplementationForTests(async (route: string, payload: unknown) => {
      if (route === "record_diagnostic_event") {
        diagnosticEvents.push(payload as Record<string, unknown>);
        return true;
      }

      return deckyBackendTestCallImplementation(route, payload);
    });

    try {
      const firstRefresh = loadDeckyDashboardState("steam", {
        forceRefresh: true,
      });
      const secondRefresh = loadDeckyDashboardState("steam", {
        forceRefresh: true,
      });

      const [firstState, secondState] = await Promise.all([firstRefresh, secondRefresh]);

      assert.equal(firstState.status, "success");
      assert.equal(secondState.status, "success");
      assert.equal(
        diagnosticEvents.filter((event) => event.event === "dashboard_refresh_started").length,
        1,
      );
      assert.equal(
        diagnosticEvents.filter((event) => event.event === "dashboard_refresh_completed").length,
        1,
      );
      assert.equal(
        diagnosticEvents.filter((event) => event.event === "dashboard_refresh_failed").length,
        0,
      );
    } finally {
      setDeckyBackendCallImplementationForTests(deckyBackendTestCallImplementation);
      resetDeckyAppServicesForTests();
      resetDeckyBackendTestState();
    }
  });
});

test("decky dashboard refresh keeps steam and retroachievements refreshes independent", async () => {
  const steamHarness = createHarness({
    providerFactory: (counts) => ({
      id: STEAM_PROVIDER_ID,
      capabilities: PROVIDER_CAPABILITIES,
      async loadProfile() {
        counts.profile += 1;
        return DASHBOARD_REFRESH_PROFILE;
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
    }),
    providerConfig: {
      steamId64: "12345678901234567",
      hasApiKey: true,
      language: "english",
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
      includePlayedFreeGames: false,
    },
  });

  const retroHarness = createHarness({
    providerFactory: (counts) => ({
      id: PROVIDER_ID,
      capabilities: PROVIDER_CAPABILITIES,
      async loadProfile() {
        counts.profile += 1;
        return DASHBOARD_REFRESH_PROFILE;
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
    }),
    providerConfig: {
      username: "retro-user",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    },
  });

  const [steamState, retroState] = await Promise.all([
    steamHarness.appServices.dashboard.loadDashboard(STEAM_PROVIDER_ID, { forceRefresh: true }),
    retroHarness.appServices.dashboard.loadDashboard(PROVIDER_ID, { forceRefresh: true }),
  ]);

  assert.equal(steamState.status, "success");
  assert.equal(retroState.status, "success");
  assert.equal(steamHarness.counts.profile, 1);
  assert.equal(steamHarness.counts.recentUnlocks, 1);
  assert.equal(steamHarness.counts.recentlyPlayedGames, 1);
  assert.equal(retroHarness.counts.profile, 1);
  assert.equal(retroHarness.counts.recentUnlocks, 1);
  assert.equal(retroHarness.counts.recentlyPlayedGames, 1);
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
      ConsoleID: 7,
      Title: "Test Game",
      ConsoleName: "NES",
      ImageIcon: "/Images/000001.png",
      LastPlayed: "2024-01-01 00:00:00",
      AchievementsTotal: 20,
      NumAchieved: 5,
      HighestAwardKind: "mastered",
    },
  ];

  const recentlyPlayedGames = normalizeRetroAchievementsRecentlyPlayedGames(rawRecentlyPlayedGames);

  assert.equal(recentlyPlayedGames[0]?.coverImageUrl, "https://i.retroachievements.org/Images/000001.png");
  assert.equal(recentlyPlayedGames[0]?.summary.unlockedCount, 5);
  assert.equal(recentlyPlayedGames[0]?.summary.totalCount, 20);
  assert.equal(recentlyPlayedGames[0]?.summary.completionPercent, 25);
  assert.equal(recentlyPlayedGames[0]?.metrics?.find((metric) => metric.key === "highest-award-kind")?.value, "mastered");
  assert.equal(isRetroAchievementsMasteredHardcoreGame(recentlyPlayedGames[0]!), true);
  assert.equal(recentlyPlayedGames[0]?.lastPlayedAt, Date.parse("2024-01-01T00:00:00Z"));
});

test("retroachievements client loads official systems from API_GetConsoleIDs.php", async () => {
  const requests: Array<{ readonly path: string; readonly query?: Record<string, unknown> }> = [];
  const client = createRetroAchievementsClient({
    async requestJson<T>(request) {
      requests.push({
        path: request.path,
        ...(request.query !== undefined ? { query: request.query as Record<string, unknown> } : {}),
      });

      return [
        {
          ID: 7,
          Name: "NES",
          IconURL: "/Images/Consoles/007.png",
          Active: true,
          IsGameSystem: true,
        },
      ] as T;
    },
  });

  const systems = await client.loadSystems?.({
    username: "alice",
    hasApiKey: true,
  });

  assert.deepStrictEqual(requests, [
    {
      path: "API_GetConsoleIDs.php",
      query: {
        u: "alice",
      },
    },
  ]);
  assert.equal(systems?.[0]?.ID, 7);
  assert.equal(systems?.[0]?.IconURL, "/Images/Consoles/007.png");
});

test("retroachievements provider caches systems and maps ConsoleID to systemIconUrl", async () => {
  let systemsCalls = 0;
  const provider = createRetroAchievementsProvider({
    client: {
      async loadSystems() {
        systemsCalls += 1;
        return [
          {
            ID: 7,
            Name: "NES",
            IconURL: "/Images/Consoles/007.png",
            Active: true,
            IsGameSystem: true,
          },
          {
            ID: 8,
            Name: "SNES",
            IconURL: "https://static.retroachievements.org/Images/Consoles/008.png",
            Active: true,
            IsGameSystem: true,
          },
        ] satisfies readonly RawRetroAchievementsSystemResponse[];
      },
      async loadProfile() {
        throw new Error("not used");
      },
      async loadCompletionProgress() {
        throw new Error("not used");
      },
      async loadAchievementsEarnedBetween() {
        throw new Error("not used");
      },
      async loadRecentUnlocks() {
        throw new Error("not used");
      },
      async loadRecentlyPlayedGames() {
        return [
          {
            GameID: 100,
            ConsoleID: 7,
            Title: "Console Mapped Game",
            ConsoleName: "NES",
            LastPlayed: "2024-01-03 00:00:00",
            AchievementsTotal: 12,
            NumAchieved: 3,
          },
          {
            GameID: 200,
            ConsoleID: 8,
            Title: "Absolute Icon Game",
            ConsoleName: "SNES",
            LastPlayed: "2024-01-02 00:00:00",
            AchievementsTotal: 20,
            NumAchieved: 10,
          },
        ] satisfies readonly RawRetroAchievementsRecentlyPlayedGameResponse[];
      },
      async loadGameProgress() {
        return {
          ...createRetroAchievementsGameProgressResponse({
            gameId: "100",
            title: "Console Mapped Game",
            unlockedCount: 3,
            totalCount: 12,
          }),
          ConsoleID: 7,
        };
      },
    },
  });

  const firstLoad = await provider.loadRecentlyPlayedGames(
    {
      username: "alice",
      apiKey: "secret",
    },
    { count: 2 },
  );
  const gameDetail = await provider.loadGameProgress(
    {
      username: "alice",
      apiKey: "secret",
    },
    "100",
  );
  const secondLoad = await provider.loadRecentlyPlayedGames(
    {
      username: "alice",
      apiKey: "secret",
    },
    { count: 2 },
  );

  assert.equal(systemsCalls, 1);
  assert.equal(
    firstLoad[0]?.systemIconUrl,
    "https://i.retroachievements.org/Images/Consoles/007.png",
  );
  assert.equal(
    firstLoad[1]?.systemIconUrl,
    "https://static.retroachievements.org/Images/Consoles/008.png",
  );
  assert.equal(
    gameDetail.game.systemIconUrl,
    "https://i.retroachievements.org/Images/Consoles/007.png",
  );
  assert.equal(secondLoad[0]?.systemIconUrl, firstLoad[0]?.systemIconUrl);
});

test("retroachievements recently played games enrich explicit award state from bounded game detail", async () => {
  const gameProgressCalls: string[] = [];
  const provider = createRetroAchievementsProvider({
    client: {
      async loadSystems() {
        return [];
      },
      async loadProfile() {
        throw new Error("not used");
      },
      async loadCompletionProgress() {
        throw new Error("not used");
      },
      async loadAchievementsEarnedBetween() {
        throw new Error("not used");
      },
      async loadRecentUnlocks() {
        throw new Error("not used");
      },
      async loadRecentlyPlayedGames(_config, options) {
        assert.equal(options?.count, 2);
        return [
          {
            GameID: 100,
            Title: "Mastered Missing Award",
            ConsoleName: "NES",
            LastPlayed: "2024-01-03 00:00:00",
            AchievementsTotal: 57,
            NumAchieved: 57,
          },
          {
            GameID: 200,
            Title: "Already Explicit",
            ConsoleName: "SNES",
            LastPlayed: "2024-01-02 00:00:00",
            AchievementsTotal: 20,
            NumAchieved: 10,
            HighestAwardKind: "beaten-hardcore",
          },
          {
            GameID: 300,
            Title: "Should Not Be Enriched",
            ConsoleName: "Genesis",
            LastPlayed: "2024-01-01 00:00:00",
            AchievementsTotal: 8,
            NumAchieved: 8,
          },
        ] satisfies readonly RawRetroAchievementsRecentlyPlayedGameResponse[];
      },
      async loadGameProgress(_config, gameId) {
        gameProgressCalls.push(gameId);
        if (gameId === "100") {
          return createRetroAchievementsGameProgressResponse({
            gameId,
            title: "Mastered Missing Award",
            highestAwardKind: "mastered",
            highestAwardDate: "2024-04-23T21:28:49+00:00",
            unlockedCount: 57,
            totalCount: 57,
          });
        }

        throw new Error(`unexpected game progress call for ${gameId}`);
      },
    },
  });

  const games = await provider.loadRecentlyPlayedGames(
    {
      username: "alice",
      apiKey: "secret",
    },
    { count: 2 },
  );

  assert.deepStrictEqual(games.map((game) => game.title), ["Mastered Missing Award", "Already Explicit"]);
  assert.deepStrictEqual(gameProgressCalls, ["100"]);
  assert.equal(games[0]?.metrics?.find((metric) => metric.key === "highest-award-kind")?.value, "mastered");
  assert.equal(games[0]?.metrics?.find((metric) => metric.key === "highest-award-date")?.value, String(Date.parse("2024-04-23T21:28:49+00:00")));
  assert.equal(isRetroAchievementsMasteredHardcoreGame(games[0]!), true);
  assert.equal(games[1]?.metrics?.find((metric) => metric.key === "highest-award-kind")?.value, "beaten-hardcore");
});

test("retroachievements recently played enrichment does not infer mastered from 100 percent and falls back safely", async () => {
  const gameProgressCalls: string[] = [];
  const provider = createRetroAchievementsProvider({
    client: {
      async loadSystems() {
        return [];
      },
      async loadProfile() {
        throw new Error("not used");
      },
      async loadCompletionProgress() {
        throw new Error("not used");
      },
      async loadAchievementsEarnedBetween() {
        throw new Error("not used");
      },
      async loadRecentUnlocks() {
        throw new Error("not used");
      },
      async loadRecentlyPlayedGames() {
        return [
          {
            GameID: 400,
            Title: "Hundred Percent Without Award",
            ConsoleName: "Game Boy",
            LastPlayed: "2024-01-04 00:00:00",
            AchievementsTotal: 10,
            NumAchieved: 10,
          },
          {
            GameID: 500,
            Title: "Progress Fetch Fails",
            ConsoleName: "Game Boy Color",
            LastPlayed: "2024-01-03 00:00:00",
            AchievementsTotal: 12,
            NumAchieved: 6,
          },
        ] satisfies readonly RawRetroAchievementsRecentlyPlayedGameResponse[];
      },
      async loadGameProgress(_config, gameId) {
        gameProgressCalls.push(gameId);
        if (gameId === "400") {
          return createRetroAchievementsGameProgressResponse({
            gameId,
            title: "Hundred Percent Without Award",
            unlockedCount: 10,
            totalCount: 10,
          });
        }

        throw new Error("detail unavailable");
      },
    },
  });

  const games = await provider.loadRecentlyPlayedGames(
    {
      username: "alice",
      apiKey: "secret",
    },
    { count: 2 },
  );

  assert.deepStrictEqual(gameProgressCalls, ["400", "500"]);
  assert.equal(games.length, 2);
  assert.equal(games[0]?.summary.completionPercent, 100);
  assert.equal(games[0]?.metrics?.find((metric) => metric.key === "highest-award-kind"), undefined);
  assert.equal(isRetroAchievementsMasteredHardcoreGame(games[0]!), false);
  assert.equal(games[1]?.metrics?.find((metric) => metric.key === "highest-award-kind"), undefined);
  assert.equal(isRetroAchievementsMasteredHardcoreGame(games[1]!), false);
});

test("retroachievements systems fetch failure falls back to text-only game surfaces", async () => {
  const provider = createRetroAchievementsProvider({
    client: {
      async loadSystems() {
        throw new Error("systems unavailable");
      },
      async loadProfile() {
        throw new Error("not used");
      },
      async loadCompletionProgress() {
        throw new Error("not used");
      },
      async loadAchievementsEarnedBetween() {
        throw new Error("not used");
      },
      async loadRecentUnlocks() {
        throw new Error("not used");
      },
      async loadRecentlyPlayedGames() {
        return [
          {
            GameID: 100,
            ConsoleID: 7,
            Title: "Fallback Game",
            ConsoleName: "NES",
            LastPlayed: "2024-01-03 00:00:00",
            AchievementsTotal: 12,
            NumAchieved: 3,
          },
        ] satisfies readonly RawRetroAchievementsRecentlyPlayedGameResponse[];
      },
      async loadGameProgress() {
        return {
          ...createRetroAchievementsGameProgressResponse({
            gameId: "100",
            title: "Fallback Game",
            unlockedCount: 3,
            totalCount: 12,
          }),
          ConsoleID: 7,
        };
      },
    },
  });

  const recentlyPlayedGames = await provider.loadRecentlyPlayedGames(
    {
      username: "alice",
      apiKey: "secret",
    },
    { count: 1 },
  );
  const gameDetail = await provider.loadGameProgress(
    {
      username: "alice",
      apiKey: "secret",
    },
    "100",
  );

  assert.equal(recentlyPlayedGames[0]?.systemIconUrl, undefined);
  assert.equal(gameDetail.game.systemIconUrl, undefined);
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
  assert.equal(state.data?.game.metrics.find((metric) => metric.key === "total-players")?.value, "456");
  assert.equal(
    state.data?.game.metrics.find((metric) => metric.key === "released")?.value,
    "1992-06-02 00:00:00",
  );
  assert.equal(state.data?.game.metrics.find((metric) => metric.key === "points")?.value, "3");
  assert.equal(state.data?.game.metrics.find((metric) => metric.key === "retro-points")?.value, "3");
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

test("game detail achievement ordering keeps unlocked items first and newest unlocks first", () => {
  const achievements = sortAchievementsForDisplay([
    {
      providerId: PROVIDER_ID,
      achievementId: "locked-old",
      gameId: "game-1",
      title: "Locked Old",
      isUnlocked: false,
      metrics: [],
    },
    {
      providerId: PROVIDER_ID,
      achievementId: "hardcore-new",
      gameId: "game-1",
      title: "Hardcore New",
      isUnlocked: true,
      unlockMode: "hardcore",
      unlockedAt: Date.parse("2024-01-04T00:00:00Z"),
      hardcoreUnlockedAt: Date.parse("2024-01-04T00:00:00Z"),
      softcoreUnlockedAt: Date.parse("2024-01-04T00:00:00Z"),
      points: 3,
      metrics: [],
    },
    {
      providerId: PROVIDER_ID,
      achievementId: "softcore-newer",
      gameId: "game-1",
      title: "Softcore Newer",
      isUnlocked: true,
      unlockMode: "softcore",
      unlockedAt: Date.parse("2024-01-05T00:00:00Z"),
      hardcoreUnlockedAt: Date.parse("2024-01-05T00:00:00Z"),
      softcoreUnlockedAt: Date.parse("2024-01-05T00:00:00Z"),
      points: 5,
      metrics: [],
    },
    {
      providerId: PROVIDER_ID,
      achievementId: "hardcore-older",
      gameId: "game-1",
      title: "Hardcore Older",
      isUnlocked: true,
      unlockMode: "hardcore",
      unlockedAt: Date.parse("2024-01-02T00:00:00Z"),
      hardcoreUnlockedAt: Date.parse("2024-01-02T00:00:00Z"),
      softcoreUnlockedAt: Date.parse("2024-01-02T00:00:00Z"),
      points: 2,
      metrics: [],
    },
    {
      providerId: PROVIDER_ID,
      achievementId: "softcore-missing",
      gameId: "game-1",
      title: "Softcore Missing",
      isUnlocked: true,
      unlockMode: "softcore",
      metrics: [],
    },
    {
      providerId: PROVIDER_ID,
      achievementId: "locked-new",
      gameId: "game-1",
      title: "Locked New",
      isUnlocked: false,
      metrics: [],
    },
  ]);

  assert.deepStrictEqual(
    achievements.map((achievement) => achievement.achievementId),
    ["softcore-newer", "hardcore-new", "hardcore-older", "softcore-missing", "locked-old", "locked-new"],
  );

  const filterVisibleAchievements = (
    input: readonly (typeof achievements)[number][],
    modeFilter: "all" | "hardcore" | "softcore",
    stateFilter: "all" | "unlocked" | "locked",
  ): string[] =>
    sortAchievementsForDisplay(input)
      .filter((achievement) => {
        if (stateFilter === "unlocked" && !achievement.isUnlocked) {
          return false;
        }

        if (stateFilter === "locked" && achievement.isUnlocked) {
          return false;
        }

        if (!achievement.isUnlocked) {
          return true;
        }

        if (modeFilter === "all") {
          return true;
        }

        if (modeFilter === "hardcore") {
          return achievement.unlockMode !== "softcore";
        }

        return achievement.unlockMode !== "hardcore";
      })
      .map((achievement) => achievement.achievementId);

  assert.deepStrictEqual(
    filterVisibleAchievements(achievements, "all", "all"),
    ["softcore-newer", "hardcore-new", "hardcore-older", "softcore-missing", "locked-old", "locked-new"],
  );
  assert.deepStrictEqual(
    filterVisibleAchievements(achievements, "all", "unlocked"),
    ["softcore-newer", "hardcore-new", "hardcore-older", "softcore-missing"],
  );
  assert.deepStrictEqual(
    filterVisibleAchievements(achievements, "hardcore", "all"),
    ["hardcore-new", "hardcore-older", "locked-old", "locked-new"],
  );
  assert.deepStrictEqual(
    filterVisibleAchievements(achievements, "softcore", "all"),
    ["softcore-newer", "softcore-missing", "locked-old", "locked-new"],
  );
  assert.deepStrictEqual(
    filterVisibleAchievements(achievements, "hardcore", "unlocked"),
    ["hardcore-new", "hardcore-older"],
  );
  assert.deepStrictEqual(
    filterVisibleAchievements(achievements, "softcore", "unlocked"),
    ["softcore-newer", "softcore-missing"],
  );
  assert.deepStrictEqual(
    filterVisibleAchievements(achievements, "all", "locked"),
    ["locked-old", "locked-new"],
  );
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

test("steam recently played normalization sorts newest first with stable missing timestamps", () => {
  const recentGames = normalizeSteamRecentlyPlayedGames([
    {
      appid: 10,
      name: "Missing Timestamp First",
      playtime_forever: 10,
    },
    {
      appid: 20,
      name: "Older Known",
      playtime_forever: 20,
      rtime_last_played: 1_700_000_000,
    },
    {
      appid: 30,
      name: "Newest Known",
      playtime_forever: 30,
      rtime_last_played: 1_700_000_200,
    },
    {
      appid: 40,
      name: "Equal Newest Known",
      playtime_forever: 40,
      rtime_last_played: 1_700_000_200,
    },
    {
      appid: 50,
      name: "Missing Timestamp Second",
      playtime_forever: 50,
    },
  ]);

  assert.deepStrictEqual(
    recentGames.map((game) => game.title),
    [
      "Newest Known",
      "Equal Newest Known",
      "Older Known",
      "Missing Timestamp First",
      "Missing Timestamp Second",
    ],
  );
  assert.deepStrictEqual(
    recentGames.map((game) => game.lastPlayedAt),
    [1_700_000_200_000, 1_700_000_200_000, 1_700_000_000_000, undefined, undefined],
  );

  assert.deepStrictEqual(
    sortSteamRecentlyPlayedGamesNewestFirst([
      recentGames[2]!,
      recentGames[3]!,
      recentGames[1]!,
      recentGames[4]!,
      recentGames[0]!,
    ]).map((game) => game.title),
    [
      "Equal Newest Known",
      "Newest Known",
      "Older Known",
      "Missing Timestamp First",
      "Missing Timestamp Second",
    ],
  );
  assert.match(
    readFileSync("src/providers/steam/steam.provider.ts", "utf8"),
    /return sortSteamRecentlyPlayedGamesNewestFirst\(\s*recentGameSnapshots\.map\(\(snapshot\) => snapshot\.recentGame\),\s*\);/u,
  );
});

test("steam recently played merges owned-game timestamps before sorting", async () => {
  const mergedGames = mergeSteamRecentlyPlayedLastPlayedTimes(
    [
      {
        appid: 100,
        name: "GTA-like Older Game",
      },
      {
        appid: 200,
        name: "Minecraft-like Newer Game",
      },
      {
        appid: 300,
        name: "Direct Timestamp Wins",
        rtime_last_played: 1_700_000_300,
      },
      {
        appid: 400,
        name: "Missing Everywhere",
      },
    ],
    [
      {
        appid: 100,
        name: "GTA-like Older Game",
        rtime_last_played: 1_700_000_100,
      },
      {
        appid: 200,
        name: "Minecraft-like Newer Game",
        rtime_last_played: 1_700_000_200,
      },
      {
        appid: 300,
        name: "Direct Timestamp Wins",
        rtime_last_played: 1_700_000_400,
      },
    ],
  );
  const normalizedGames = normalizeSteamRecentlyPlayedGames(mergedGames);

  assert.deepStrictEqual(
    normalizedGames.map((game) => game.title),
    [
      "Direct Timestamp Wins",
      "Minecraft-like Newer Game",
      "GTA-like Older Game",
      "Missing Everywhere",
    ],
  );
  assert.deepStrictEqual(
    normalizedGames.map((game) => game.lastPlayedAt),
    [1_700_000_300_000, 1_700_000_200_000, 1_700_000_100_000, undefined],
  );

  const mergedCandidates = mergeSteamRecentlyPlayedCandidates(
    [
      {
        appid: 100,
        name: "Richer Recent Name",
        playtime_2weeks: 25,
        playtime_forever: 120,
      },
      {
        appid: 100,
        name: "Duplicate Recent Name",
        playtime_forever: 5,
      },
    ],
    [
      {
        appid: 100,
        name: "Owned Name",
        playtime_forever: 90,
        rtime_last_played: 1_700_000_100,
      },
      {
        appid: 300,
        name: "Cuphead-like Owned-only Game",
        playtime_forever: 10,
        rtime_last_played: 1_700_000_300,
      },
    ],
  );
  assert.equal(mergedCandidates.length, 2);
  assert.deepStrictEqual(mergedCandidates[0], {
    appid: 100,
    name: "Richer Recent Name",
    playtime_2weeks: 25,
    playtime_forever: 120,
    rtime_last_played: 1_700_000_100,
  });
  assert.equal(mergedCandidates[1]?.name, "Cuphead-like Owned-only Game");

  let ownedGamesCalls = 0;
  const provider = createSteamProvider({
    client: {
      async loadRecentlyPlayedGames() {
        return {
          response: {
            games: [
              {
                appid: 100,
                name: "GTA-like Older Game",
                playtime_forever: 120,
              },
              {
                appid: 200,
                name: "Minecraft-like Newer Game",
                playtime_forever: 60,
              },
              {
                appid: 400,
                name: "Oldest Direct Game",
                playtime_forever: 180,
              },
            ],
          },
        };
      },
      async loadOwnedGames() {
        ownedGamesCalls += 1;
        return {
          response: {
            games: [
              {
                appid: 100,
                name: "GTA-like Older Game",
                rtime_last_played: 1_700_000_100,
              },
              {
                appid: 200,
                name: "Minecraft-like Newer Game",
                rtime_last_played: 1_700_000_200,
              },
              {
                appid: 300,
                name: "Cuphead-like Owned-only Game",
                playtime_forever: 10,
                rtime_last_played: 1_700_000_300,
              },
              {
                appid: 400,
                name: "Oldest Direct Game",
                rtime_last_played: 1_700_000_050,
              },
            ],
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
    } as SteamClient,
  });
  const providerGames = await provider.loadRecentlyPlayedGames(
    normalizeSteamProviderConfig({
      steamId64: "12345678901234567",
      apiKey: "api-key",
      language: "english",
      recentAchievementsCount: 3,
      recentlyPlayedCount: 3,
      includePlayedFreeGames: false,
    }),
    { count: 3 },
  );

  assert.equal(ownedGamesCalls, 1);
  assert.deepStrictEqual(
    providerGames.map((game) => game.title),
    [
      "Cuphead-like Owned-only Game",
      "Minecraft-like Newer Game",
      "GTA-like Older Game",
    ],
  );
  assert.deepStrictEqual(
    providerGames.map((game) => game.lastPlayedAt),
    [1_700_000_300_000, 1_700_000_200_000, 1_700_000_100_000],
  );
});

test("steam recently played falls back safely when owned-game candidates fail to load", async () => {
  const provider = createSteamProvider({
    client: {
      async loadRecentlyPlayedGames() {
        return {
          response: {
            games: [
              {
                appid: 100,
                name: "First Direct Game",
                playtime_forever: 120,
              },
              {
                appid: 200,
                name: "Second Direct Game",
                playtime_forever: 60,
              },
            ],
          },
        };
      },
      async loadOwnedGames() {
        throw new Error("Owned games unavailable.");
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
    } as SteamClient,
  });
  const games = await provider.loadRecentlyPlayedGames(
    normalizeSteamProviderConfig({
      steamId64: "12345678901234567",
      apiKey: "api-key",
      language: "english",
      recentAchievementsCount: 3,
      recentlyPlayedCount: 3,
      includePlayedFreeGames: false,
    }),
    { count: 3 },
  );

  assert.deepStrictEqual(
    games.map((game) => game.title),
    ["First Direct Game", "Second Direct Game"],
  );
});

test("decky steam dashboard merges cached library unlocks into recent achievements", () => {
  const snapshot: DashboardSnapshot = {
    profile: {
      providerId: STEAM_PROVIDER_ID,
      identity: {
        providerId: STEAM_PROVIDER_ID,
        accountId: "steam-account",
        displayName: "Steam User",
      },
      summary: {
        unlockedCount: 1,
      },
      metrics: [],
    },
    recentAchievements: [
      {
        achievement: {
          providerId: STEAM_PROVIDER_ID,
          achievementId: "older-achievement",
          gameId: "100",
          title: "Older Achievement",
          isUnlocked: true,
          unlockedAt: 1_700_000_100_000,
          metrics: [],
        },
        game: {
          providerId: STEAM_PROVIDER_ID,
          gameId: "100",
          title: "Older Game",
        },
        unlockedAt: 1_700_000_100_000,
      },
    ],
    recentUnlocks: [],
    recentlyPlayedGames: [],
    featuredGames: [],
  };
  const summary: SteamLibraryAchievementScanSummary = {
    scannedAt: "2026-06-11T12:00:00.000Z",
    ownedGameCount: 1,
    scannedGameCount: 1,
    gamesWithAchievements: 1,
    skippedGameCount: 0,
    failedGameCount: 0,
    totalAchievements: 10,
    unlockedAchievements: 1,
    perfectGames: 0,
    completionPercent: 10,
    games: [],
    unlockedAchievementsList: [
      {
        id: "300:new-achievement:2026-06-11T11:55:00.000Z",
        achievementId: "new-achievement",
        apiName: "new-achievement",
        title: "Cuphead-like New Achievement",
        description: "Beat a level",
        unlockedAt: "2026-06-11T11:55:00.000Z",
        gameId: "300",
        gameTitle: "Cuphead-like Game",
        providerId: STEAM_PROVIDER_ID,
      },
    ],
  };

  const merged = mergeDeckySteamLibraryScanRecentAchievements(snapshot, summary);

  assert.equal(merged.recentAchievements[0]?.achievement.title, "Cuphead-like New Achievement");
  assert.equal(merged.recentAchievements[0]?.game.title, "Cuphead-like Game");
  assert.deepStrictEqual(merged.recentUnlocks, merged.recentAchievements);
  const deckyAppServicesSource = readFileSync("src/platform/decky/decky-app-services.ts", "utf8");
  assert.match(
    deckyAppServicesSource,
    /if \(providerId === STEAM_PROVIDER_ID && options\?\.forceRefresh\) \{\s*clearSteamRecentGameSnapshotLoadCache\(\);/u,
  );
  assert.match(
    deckyAppServicesSource,
    /mergeDeckySteamLibraryScanRecentAchievements\(\s*state\.data,/u,
  );
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
  const retroAchievementsProfileStats = buildRetroAchievementsProfileOverviewStatSections(retroAchievementsProfile);
  assert.deepStrictEqual(
    retroAchievementsProfileStats.map((section) => section.title),
    [
      "Softcore",
      "Hardcore",
      "RetroAchievements",
      "Game Completion",
    ],
  );
  assert.deepStrictEqual(
    retroAchievementsProfileStats.map((section) => section.stats.map((stat) => `${stat.label}:${stat.value}`)),
    [
      ["Points:4321", "Unlocked:-"],
      ["Points:1234", "Unlocked:-"],
      ["Points:987", "Ratio:0.80"],
      ["Beaten:-", "Mastered:-"],
    ],
  );
  assert.equal(
    retroAchievementsProfileStats.flatMap((section) => section.stats).some((stat) => stat.label === "Member since"),
    false,
  );

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

test("steam library achievement scan de-duplicates final progress diagnostics", async () => {
  await withMockDeckyStorage(async () => {
    const achievementsDeferred = createDeferredPromise<{
      readonly playerstats: {
        readonly success: true;
        readonly achievements: readonly RawSteamPlayerAchievement[];
      };
    }>();
    let playerAchievementsCalls = 0;
    const progressEvents: Array<Record<string, unknown>> = [];
    const client: SteamClient = {
      async loadOwnedGames() {
        return {
          response: {
            game_count: 2,
            games: [
              {
                appid: 1,
                name: "Game 1",
              },
              {
                appid: 2,
                name: "Game 2",
              },
            ],
          },
        };
      },
      async loadPlayerAchievements() {
        playerAchievementsCalls += 1;
        return achievementsDeferred.promise;
      },
      async loadSchemaForGame() {
        throw new Error("schema should not be needed when no achievements are unlocked");
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

    const scanPromise = scanSteamLibraryAchievements(
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
        concurrencyLimit: 2,
        logger: {
          started() {},
          progress(fields) {
            progressEvents.push(fields);
          },
          completed() {},
          failed() {},
        },
      },
    );

    for (let attempt = 0; attempt < 20 && playerAchievementsCalls < 2; attempt += 1) {
      await Promise.resolve();
    }

    assert.equal(playerAchievementsCalls, 2);

    achievementsDeferred.resolve({
      playerstats: {
        success: true,
        achievements: [],
      },
    });

    const summary = await scanPromise;
    assert.equal(summary.scannedGameCount, 2);
    assert.equal(progressEvents.length, 1);
    assert.equal(progressEvents[0]?.ownedGameCount, 2);
    assert.equal(progressEvents[0]?.scannedGameCount, 2);
    assert.equal(progressEvents[0]?.failedGameCount, 0);
  });
});

test("decky steam library scan reuses an in-flight runtime scan", async () => {
  await withMockDeckyStorage(async () => {
    const config = normalizeSteamProviderConfig({
      steamId64: "12345678901234567",
      hasApiKey: true,
      language: "english",
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
      includePlayedFreeGames: false,
    });

    const ownedGamesDeferred = createDeferredPromise<RawSteamGetOwnedGamesResponse>();
    let ownedGamesCalls = 0;
    const client: SteamClient = {
      async loadOwnedGames() {
        ownedGamesCalls += 1;
        return ownedGamesDeferred.promise;
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

    const firstScan = runAndCacheDeckySteamLibraryAchievementScan(config, {
      client,
      concurrencyLimit: 1,
    });
    const secondScan = runAndCacheDeckySteamLibraryAchievementScan(config, {
      client,
      concurrencyLimit: 1,
    });

    assert.equal(ownedGamesCalls, 1);

    ownedGamesDeferred.resolve({
      response: {
        game_count: 1,
        games: [
          {
            appid: 220,
            name: "Half-Life 2",
          } satisfies RawSteamOwnedGame,
        ],
      },
    });

    const [firstSummary, secondSummary] = await Promise.all([firstScan, secondScan]);
    assert.equal(firstSummary.scannedGameCount, 1);
    assert.equal(secondSummary.scannedGameCount, 1);
    assert.equal(ownedGamesCalls, 1);
    assert.equal(readDeckySteamLibraryAchievementScanSummary("steam")?.scannedGameCount, 1);
  });
});

test("decky steam library scan preserves the last successful cache when a later scan fails", async () => {
  await withMockDeckyStorage(async () => {
    const config = normalizeSteamProviderConfig({
      steamId64: "12345678901234567",
      hasApiKey: true,
      language: "english",
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
      includePlayedFreeGames: false,
    });

    const cachedSummary: SteamLibraryAchievementScanSummary = {
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
          appid: 220,
          id: "220",
          gameId: "220",
          title: "Half-Life 2",
          providerId: "steam",
          platformLabel: "Steam",
          totalAchievements: 1,
          unlockedAchievements: 1,
          completionPercent: 100,
          hasAchievements: true,
          scanStatus: "scanned",
        },
      ],
    };

    writeDeckySteamLibraryAchievementScanSummary(cachedSummary);

    const initialOverview = readDeckySteamLibraryAchievementScanOverview("steam");
    assert.equal(initialOverview?.scannedGameCount, 1);

    await assert.rejects(
      runAndCacheDeckySteamLibraryAchievementScan(config, {
        client: {
          async loadOwnedGames() {
            throw new Error("steam owned games refresh failed");
          },
          async loadPlayerAchievements() {
            throw new Error("unexpected player achievements request");
          },
          async loadSchemaForGame() {
            throw new Error("unexpected schema request");
          },
          async loadGlobalAchievementPercentagesForApp() {
            throw new Error("unexpected global achievement percentages request");
          },
          async loadPlayerSummaries() {
            throw new Error("unexpected player summaries request");
          },
          async loadSteamLevel() {
            throw new Error("unexpected steam level request");
          },
          async loadBadges() {
            throw new Error("unexpected badges request");
          },
        },
      }),
    );

    const preservedSummary = readDeckySteamLibraryAchievementScanSummary("steam");
    const preservedOverview = readDeckySteamLibraryAchievementScanOverview("steam");
    assert.equal(preservedSummary?.scannedGameCount, 1);
    assert.equal(preservedOverview?.scannedGameCount, 1);
    assert.equal(preservedSummary?.games[0]?.title, "Half-Life 2");
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

test("steam provider tolerates player summary failures without failing the dashboard", async () => {
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
      async loadPlayerSummaries() {
        throw new Error("player summaries forbidden");
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

  assert.equal(profile.identity.displayName, config.steamId64);
  assert.equal(profile.steamLevel, 29);
  assert.equal(profile.badgeCount, 1);
  assert.equal(profile.playerXp, 5_740);
  assert.equal(profile.steamBadges?.length, 1);
  assert.equal(profile.summary.unlockedCount, 1);
  assert.equal(profile.summary.totalCount, 1);
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

test("fullscreen settings back target persists across settings round trips", async () => {
  await withMockDeckyStorage(async () => {
    const bootstrapSource = readFileSync(join("src", "platform", "decky", "bootstrap.tsx"), "utf8");
    const navigationSource = readFileSync(
      join("src", "platform", "decky", "decky-navigation.tsx"),
      "utf8",
    );

    assert.equal(resolveFullScreenSettingsBackTarget("compact-panel"), "compact-panel");
    assert.equal(resolveFullScreenSettingsBackTarget("fullscreen-profile"), "previous-fullscreen");

    assert.equal(peekNextFullScreenSettingsBackTarget(), "compact-panel");
    assert.equal(navigationSource.includes("peekNextFullScreenSettingsBackTarget()"), true);
    assert.equal(navigationSource.includes("clearNextFullScreenSettingsBackTarget()"), true);
    assert.equal(
      navigationSource.includes('resolveFullScreenSettingsBackTarget("fullscreen-profile")'),
      true,
    );
    assert.equal(bootstrapSource.includes('resolveFullScreenSettingsBackTarget("compact-panel")'), true);
    assert.equal(bootstrapSource.includes("markNextFullScreenSettingsBackTarget("), true);
    assert.equal(navigationSource.includes("markNextFullScreenSettingsBackTarget("), true);

    markNextFullScreenSettingsBackTarget("previous-fullscreen");
    assert.equal(peekNextFullScreenSettingsBackTarget(), "previous-fullscreen");
    assert.equal(peekNextFullScreenSettingsBackTarget(), "previous-fullscreen");
    assert.equal(clearNextFullScreenSettingsBackTarget(), true);
    assert.equal(peekNextFullScreenSettingsBackTarget(), "compact-panel");

    markNextFullScreenSettingsBackTarget("compact-panel");
    assert.equal(peekNextFullScreenSettingsBackTarget(), "compact-panel");
    assert.equal(clearNextFullScreenSettingsBackTarget(), false);
    assert.equal(peekNextFullScreenSettingsBackTarget(), "compact-panel");
  });
});

test("fullscreen game route suppresses unmount when opening an achievement from the game page", () => {
  assert.equal(shouldSuppressGameRouteUnmountWhenOpeningAchievement("decky-panel"), true);
  assert.equal(shouldSuppressGameRouteUnmountWhenOpeningAchievement("completion-progress"), true);
  assert.equal(shouldSuppressGameRouteUnmountWhenOpeningAchievement("achievement"), true);
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

test("fullscreen game route can temporarily return to an achievement detail without losing its original back behavior", () => {
  const providerId = "retroachievements";
  const gameId = "1234";
  const achievementId = "5678";

  markFullScreenGameRouteBackBehavior(providerId, gameId, "decky-panel");
  pushFullScreenGameRouteAchievementReturnTarget(providerId, gameId, {
    providerId,
    gameId,
    achievementId,
  });

  assert.equal(resolveFullScreenGameRouteBackBehavior(providerId, gameId), "achievement");
  assert.deepStrictEqual(resolveFullScreenGameRouteAchievementReturnTarget(providerId, gameId), {
    providerId,
    gameId,
    achievementId,
  });

  popFullScreenGameRouteBackBehavior(providerId, gameId);
  assert.equal(resolveFullScreenGameRouteBackBehavior(providerId, gameId), "decky-panel");
  assert.equal(resolveFullScreenGameRouteAchievementReturnTarget(providerId, gameId), undefined);
});

test("steam game page achievement badge uses the route-patched header path without prototype UI", () => {
  const indexSource = readFileSync("src/index.tsx", "utf8");
  const bootstrapSource = readFileSync("src/platform/decky/bootstrap.tsx", "utf8");
  const runtimeDebugSource = readFileSync("src/platform/decky/decky-runtime-debug.ts", "utf8");
  const deckySystemPillSource = readFileSync("src/platform/decky/decky-system-pill.tsx", "utf8");
  const modalVisibilitySource = readFileSync(
    "src/platform/decky/decky-game-page-achievement-modal-visibility.ts",
    "utf8",
  );
  const routeDetectionSource = readFileSync(
    "src/platform/decky/decky-game-page-achievement-route.ts",
    "utf8",
  );
  const navigationSource = readFileSync(
    "src/platform/decky/decky-navigation.tsx",
    "utf8",
  );
  const summarySource = readFileSync(
    "src/platform/decky/decky-game-page-achievement-summary.ts",
    "utf8",
  );
  const bubbleSource = readFileSync(
    "src/platform/decky/decky-game-page-achievement-bubble.tsx",
    "utf8",
  );
  const routeBadgeStyleFunctionSource =
    bubbleSource.match(
      /function getDeckyGamePageAchievementRouteBadgeStyle\([\s\S]*?\n\}\n\nfunction /u,
    )?.[0] ?? "";

  assert.match(indexSource, /installAchievementCompanionRuntimeDebug\(/u);
  assert.doesNotMatch(indexSource, /ensureDeckyGamePageAchievementGlobalComponentRegistered\(/u);
  assert.doesNotMatch(indexSource, /removeDeckyGamePageAchievementGlobalComponent\(\)/u);
  assert.match(indexSource, /removeAchievementCompanionRuntimeDebug\(\)/u);
  assert.match(indexSource, /DeckyBootstrap/u);
  assert.match(runtimeDebugSource, /__achievementCompanionRuntimeDebug/u);
  assert.match(runtimeDebugSource, /win\.top/u);
  assert.match(runtimeDebugSource, /globalThis/u);
  assert.match(runtimeDebugSource, /Runtime debug initialized/u);
  assert.match(runtimeDebugSource, /currentRouteUrl/u);
  assert.match(runtimeDebugSource, /routeDetectionReason/u);
  assert.match(runtimeDebugSource, /badgeRenderCount/u);
  assert.match(runtimeDebugSource, /lastBadgeRenderAppId/u);
  assert.match(runtimeDebugSource, /lastSummaryStatus/u);
  assert.match(runtimeDebugSource, /lastSummaryProvider/u);
  assert.match(runtimeDebugSource, /lastSummaryEarned/u);
  assert.match(runtimeDebugSource, /lastSummaryTotal/u);
  assert.match(runtimeDebugSource, /lastSummaryUnavailableReason/u);
  assert.match(runtimeDebugSource, /lastSummaryFetchStartedAt/u);
  assert.match(runtimeDebugSource, /lastSummaryFetchCompletedAt/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsShortcutAppId/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsShortcutTitle/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsShortcutPlatform/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsMappingStatus/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsMappingReason/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsGameId/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsTitle/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsEarned/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsTotal/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsSource/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsConfidence/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsError/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsResolutionSource/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsResolutionReason/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsMatchedTitle/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsMatchedPlatform/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsMatchedGameId/u);
  assert.match(runtimeDebugSource, /lastRetroAchievementsCandidateCount/u);
  assert.doesNotMatch(runtimeDebugSource, /globalComponent/u);
  assert.doesNotMatch(runtimeDebugSource, /globalFallbackSuppressed/u);
  assert.match(runtimeDebugSource, /Game-page achievement badge rendered/u);
  assert.match(runtimeDebugSource, /reportAchievementCompanionRuntimeDebugError/u);
  assert.doesNotMatch(runtimeDebugSource, /reportAchievementCompanionGamePageGlobalComponentError/u);
  assert.match(runtimeDebugSource, /reportAchievementCompanionGamePageAchievementSummaryError/u);
  assert.match(runtimeDebugSource, /markAchievementCompanionRetroAchievementsShortcutResolution/u);
  assert.match(runtimeDebugSource, /markAchievementCompanionGamePageAchievementSummaryFetchStarted/u);
  assert.match(runtimeDebugSource, /markAchievementCompanionGamePageAchievementSummaryFetchCompleted/u);
  assert.match(routeDetectionSource, /target-url-route/u);
  assert.match(routeDetectionSource, /DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_REGEX/u);
  assert.match(routeDetectionSource, /detectDeckyGamePageAchievementRouteFromUrl/u);
  assert.match(routeDetectionSource, /resolveDeckyGamePageAchievementAppIdFromRouteProps/u);
  assert.match(summarySource, /type GamePageAchievementSummary/u);
  assert.match(summarySource, /formatDeckyGamePageAchievementBadgeLabel/u);
  assert.match(summarySource, /\\u\{1f3c6\}/u);
  assert.match(summarySource, /requestSequenceRef\.current !== requestSequence/u);
  assert.match(summarySource, /readDeckySteamLibraryAchievementScanSummary/u);
  assert.match(summarySource, /readDeckyDashboardSnapshotCacheEntry/u);
  assert.match(summarySource, /loadDeckySteamShortcutMetadata/u);
  assert.match(summarySource, /shortcut-title-match/u);
  assert.match(summarySource, /ambiguous-retroachievements-shortcut-mapping/u);
  assert.match(summarySource, /loadDeckyGameDetailStateLazy\(STEAM_PROVIDER_ID, appId, \{\s*forceRefresh: false/u);
  assert.match(summarySource, /loadDeckyCompletionProgressStateLazy/u);
  assert.match(summarySource, /matchesRetroAchievementsShortcutTitle/u);
  assert.match(summarySource, /matchesRetroAchievementsShortcutPlatform/u);
  assert.match(summarySource, /normalizeRetroAchievementsPlatformLabel/u);
  assert.match(summarySource, /collectRetroAchievementsCompletionProgressCandidates/u);
  assert.match(summarySource, /collectRetroAchievementsDashboardCandidates/u);
  assert.match(summarySource, /collectRetroAchievementsDashboardIdentityCandidates/u);
  assert.match(summarySource, /completion-progress-title-match/u);
  assert.match(summarySource, /dashboard-identity-detail/u);
  assert.match(summarySource, /ra-detail-unavailable/u);
  assert.match(summarySource, /ra-api-game-list/u);
  assert.match(summarySource, /no-retroachievements-shortcut-mapping/u);
  assert.doesNotMatch(summarySource, /ra-provider-not-configured/u);
  assert.match(summarySource, /ra-cache-unavailable/u);
  assert.match(summarySource, /recentAchievements/u);
  assert.match(summarySource, /recentUnlocks/u);
  assert.match(summarySource, /loadDeckyGameDetailStateLazy\([\s\S]*?RETROACHIEVEMENTS_PROVIDER_ID/u);
  assert.match(summarySource, /unlockedCount/u);
  assert.match(summarySource, /totalCount/u);
  assert.match(bootstrapSource, /Decky bootstrap mounted/u);
  assert.doesNotMatch(bootstrapSource, /DeckyGamePageAchievementBubbleOverlayLifecycle/u);
  assert.doesNotMatch(bootstrapSource, /startGamePageAchievementBubbleOverlay\(/u);
  assert.match(indexSource, /ensureDeckyGamePageAchievementRoutePatchRegistered/u);
  assert.match(bubbleSource, /routerHook\.addPatch/u);
  assert.match(bubbleSource, /routerHook\.removePatch/u);
  assert.match(bubbleSource, /afterPatch/u);
  assert.match(bubbleSource, /createReactTreePatcher/u);
  assert.match(bubbleSource, /findInReactTree/u);
  assert.match(bubbleSource, /appDetailsClasses\.InnerContainer/u);
  assert.match(bubbleSource, /DeckyGamePageAchievementBadge/u);
  assert.match(bubbleSource, /DeckyGamePageAchievementRouteBadge/u);
  assert.doesNotMatch(bubbleSource, /DeckyGamePageAchievementGlobalBadge/u);
  assert.doesNotMatch(bubbleSource, /AchievementCompanionGamePageBadgeGlobalComponent/u);
  assert.match(bubbleSource, /AchievementCompanionGamePageBadge/u);
  assert.match(bubbleSource, /DeckySystemIcon/u);
  assert.match(bubbleSource, /renderDeckyGamePageAchievementBadgeContent/u);
  assert.match(bubbleSource, /resolveDeckyGamePageRetroSystemIconMetadata/u);
  assert.match(bubbleSource, /collectDeckyGamePageRetroSystemIconCandidates/u);
  assert.match(bubbleSource, /useDeckyGamePageAchievementBadgeActivation/u);
  assert.match(bubbleSource, /resolveDeckyGamePageAchievementBadgeNavigationTarget/u);
  assert.match(bubbleSource, /openDeckyFullScreenGameFromLibraryGamePage/u);
  assert.match(bubbleSource, /routerHook\.addPatch\(DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN/u);
  assert.match(bubbleSource, /routerHook\.removePatch\(DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN/u);
  assert.match(bubbleSource, /Game-page achievement bubble clicked/u);
  assert.match(bubbleSource, /useGamePageAchievementSummary/u);
  assert.match(bubbleSource, /formatDeckyGamePageAchievementBadgeLabel/u);
  assert.match(bubbleSource, /\u{1f3c6}/u);
  assert.match(bubbleSource, /summary\.provider === "retroachievements" \? \(/u);
  assert.match(bubbleSource, /summary\.provider === "retroachievements" \? retroSystemIconMetadata\?\.systemIconUrl : undefined/u);
  assert.match(bubbleSource, /iconSize=\{20\}/u);
  assert.match(bubbleSource, /readDeckyDashboardSnapshotCacheEntry\(RETROACHIEVEMENTS_PROVIDER_ID\)/u);
  assert.match(bubbleSource, /summary\.provider === "retroachievements" && platformLabel !== undefined/u);
  assert.match(bubbleSource, /position:\s*"absolute"/u);
  assert.match(bubbleSource, /DECKY_GAME_PAGE_ROUTE_BADGE_CANDIDATE_SLOTS/u);
  assert.match(bubbleSource, /top-left/u);
  assert.match(bubbleSource, /top-right/u);
  assert.match(bubbleSource, /upper-left-below-buttons/u);
  assert.match(bubbleSource, /lower-right/u);
  assert.match(bubbleSource, /lower-left/u);
  assert.match(bubbleSource, /top:\s*56/u);
  assert.match(bubbleSource, /top:\s*84/u);
  assert.match(bubbleSource, /top:\s*128/u);
  assert.match(bubbleSource, /top:\s*360/u);
  assert.match(bubbleSource, /right:\s*144/u);
  assert.match(bubbleSource, /left:\s*32/u);
  assert.match(
    bubbleSource,
    /position:\s*"absolute",\s*top:\s*slot\.top,\s*left:\s*slot\.left,\s*right:\s*slot\.right,\s*zIndex:\s*1000/u,
  );
  assert.match(bubbleSource, /chooseDeckyGamePageAchievementRouteBadgePlacement/u);
  assert.match(bubbleSource, /collectDeckyGamePageAchievementRouteBadgeObstacleRects/u);
  assert.match(bubbleSource, /resolveDeckyGamePageAchievementRouteBadgeContainer/u);
  assert.match(bubbleSource, /DECKY_GAME_PAGE_ROUTE_BADGE_COLLISION_PADDING = 12/u);
  assert.match(bubbleSource, /querySelectorAll<HTMLElement>\("\*"\)/u);
  assert.match(bubbleSource, /offsetParent/u);
  assert.match(bubbleSource, /getBoundingClientRect/u);
  assert.match(bubbleSource, /markAchievementCompanionGamePageRouteBadgePlacement/u);
  assert.doesNotMatch(bubbleSource, /GAME_PAGE_BADGE_MODAL_POLL_INTERVAL_MS/u);
  assert.doesNotMatch(bubbleSource, /hasVisibleDeckyGamePageModal/u);
  assert.doesNotMatch(bubbleSource, /reportAchievementCompanionGamePageGlobalComponentError/u);
  assert.doesNotMatch(bubbleSource, /ensureDeckyGamePageAchievementGlobalComponentRegistered/u);
  assert.doesNotMatch(bubbleSource, /markAchievementCompanionGamePageGlobalComponentRendered/u);
  assert.doesNotMatch(bubbleSource, /markAchievementCompanionGamePageGlobalFallbackSuppressed/u);
  assert.doesNotMatch(bubbleSource, /shouldSuppressGlobalFallback/u);
  assert.doesNotMatch(bubbleSource, /addGlobalComponent/u);
  assert.doesNotMatch(bubbleSource, /removeGlobalComponent/u);
  assert.doesNotMatch(bubbleSource, /marker="global"/u);
  assert.match(bubbleSource, /marker="route"/u);
  assert.match(bubbleSource, /role="button"/u);
  assert.match(bubbleSource, /tabIndex=\{0\}/u);
  assert.match(bubbleSource, /Open Achievement Companion details for app/u);
  assert.match(bubbleSource, /onActivate\?\.\(\)/u);
  assert.match(bubbleSource, /event\.key === "Enter" \|\| event\.key === " "/u);
  assert.match(bubbleSource, /markAchievementCompanionGamePageBadgeActivated/u);
  assert.match(bubbleSource, /reportAchievementCompanionGamePageBadgeNavigationError/u);
  assert.match(bubbleSource, /if \(badgeLabel === undefined\) \{\s*return null;\s*\}/u);
  assert.doesNotMatch(routeBadgeStyleFunctionSource, /bottom:/u);
  assert.doesNotMatch(
    bubbleSource,
    /function getDeckyGamePageAchievementRouteBadgeStyle\([\s\S]*position:\s*"fixed"/u,
  );
  assert.match(bubbleSource, /resolveAchievementCompanionRuntimeDebugHostContext\(/u);
  assert.match(bubbleSource, /markAchievementCompanionGamePageRouteBadgePatchRegistered/u);
  assert.match(bubbleSource, /markAchievementCompanionGamePageRouteBadgePatchCallback/u);
  assert.match(bubbleSource, /markAchievementCompanionGamePageRouteBadgePatchHandlerFired/u);
  assert.match(bubbleSource, /markAchievementCompanionGamePageRouteBadgeRenderFuncPatched/u);
  assert.match(bubbleSource, /markAchievementCompanionGamePageRouteBadgeInserted/u);
  assert.match(bubbleSource, /markAchievementCompanionGamePageRouteBadgeRendered/u);
  assert.match(bubbleSource, /markAchievementCompanionGamePageBadgeSystemIcon/u);
  assert.match(bubbleSource, /ensureDeckyGamePageAchievementRoutePatchRegistered/u);
  assert.match(bubbleSource, /markAchievementCompanionGamePageAchievementBadgeRendered/u);
  const topHostDocument = {
    body: {},
  } as Document;
  const topHostWindow = {
    document: topHostDocument,
  } as Window;
  const hostContext = resolveAchievementCompanionRuntimeDebugHostContext(
    {
      body: {},
    } as Document,
    {
      top: topHostWindow,
    } as Window,
  );
  assert.deepStrictEqual(hostContext, {
    hostWindow: topHostWindow,
    hostDocument: topHostDocument,
    hostIsTopWindow: true,
  });

  const fallbackDocument = {
    body: {},
  } as Document;
  const fallbackWindow = {
    top: undefined,
  } as Window;
  const fallbackContext = resolveAchievementCompanionRuntimeDebugHostContext(
    fallbackDocument,
    fallbackWindow,
  );
  assert.deepStrictEqual(fallbackContext, {
    hostWindow: fallbackWindow,
    hostDocument: fallbackDocument,
    hostIsTopWindow: false,
  });

  assert.deepStrictEqual(
    detectDeckyGamePageAchievementRouteFromUrl("https://steamloopback.host/routes/library/app/1672970"),
    {
      isGamePage: true,
      appId: "1672970",
      reason: "target-url-route",
    },
  );
  assert.deepStrictEqual(
    detectDeckyGamePageAchievementRouteFromUrl("https://steamloopback.host/library/app/2217040867"),
    {
      isGamePage: true,
      appId: "2217040867",
      reason: "target-url-route",
    },
  );
  assert.deepStrictEqual(detectDeckyGamePageAchievementRouteFromUrl(undefined), {
    isGamePage: false,
    appId: undefined,
    reason: "url-unavailable",
  });
  assert.deepStrictEqual(
    resolveDeckyGamePageAchievementAppIdFromRouteProps({
      match: {
        params: {
          appid: "1672970",
        },
      },
    }),
    "1672970",
  );
  assert.equal(DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN, "/library/app/:appid");
});

test("game page achievement badge formatter shows loading and ready states but hides unavailable and error states", () => {
  assert.equal(
    formatDeckyGamePageAchievementBadgeLabel({
      status: "loading",
      appId: "1672970",
    }),
    "🏆 …",
  );
  assert.equal(
    formatDeckyGamePageAchievementBadgeLabel({
      status: "ready",
      provider: "steam",
      appId: "1672970",
      earned: 12,
      total: 45,
      source: "cache",
    }),
    "🏆 12 / 45",
  );
  assert.equal(
    formatDeckyGamePageAchievementBadgeLabel({
      status: "unavailable",
      appId: "2217040867",
      reason: "no-retroachievements-shortcut-mapping",
    }),
    undefined,
  );
  assert.equal(
    formatDeckyGamePageAchievementBadgeLabel({
      status: "error",
      appId: "1672970",
      message: "boom",
    }),
    undefined,
  );
});

test("game page achievement badge modal helper uses an explicitly provided dialog document", () => {
  const visibleDialog = {
    ownerDocument: {
      defaultView: {
        getComputedStyle() {
          return {
            display: "block",
            visibility: "visible",
            opacity: "1",
          } as CSSStyleDeclaration;
        },
      } as Window,
    } as Document,
    getBoundingClientRect() {
      return {
        width: 608,
        height: 356,
      };
    },
  } as Element;
  const targetDocument = {
    querySelectorAll() {
      return [visibleDialog];
    },
  } as unknown as Document;

  assert.equal(isVisibleDeckyGamePageModalElement(visibleDialog), true);
  assert.equal(hasVisibleDeckyGamePageModal(targetDocument), true);
});

test("game page achievement badge modal helper ignores hidden dialogs", () => {
  const hiddenDialog = {
    ownerDocument: {
      defaultView: {
        getComputedStyle() {
          return {
            display: "none",
            visibility: "hidden",
            opacity: "0",
          } as CSSStyleDeclaration;
        },
      } as Window,
    } as Document,
    getBoundingClientRect() {
      return {
        width: 608,
        height: 356,
      };
    },
  } as Element;
  const targetDocument = {
    querySelectorAll() {
      return [hiddenDialog];
    },
  } as unknown as Document;

  assert.equal(isVisibleDeckyGamePageModalElement(hiddenDialog), false);
  assert.equal(hasVisibleDeckyGamePageModal(targetDocument), false);
});

test("game page achievement summary resolves Steam counts from the cached library scan summary first", async () => {
  await withMockDeckyStorage(async () => {
    clearDeckySteamLibraryAchievementScanSummary();
    writeDeckySteamLibraryAchievementScanSummary({
      scannedAt: "2026-06-29T12:00:00.000Z",
      ownedGameCount: 1,
      scannedGameCount: 1,
      gamesWithAchievements: 1,
      unlockedAchievements: 12,
      totalAchievements: 45,
      perfectGames: 0,
      completionPercent: 27,
      games: [
        {
          providerId: STEAM_PROVIDER_ID,
          appid: 1672970,
          gameId: "1672970",
          id: "1672970",
          title: "Minecraft Dungeons",
          unlockedAchievements: 12,
          totalAchievements: 45,
          completionPercent: 27,
          scanStatus: "scanned",
          hasAchievements: true,
        },
      ],
    } as SteamLibraryAchievementScanSummary);

    const summary = await loadDeckyGamePageAchievementSummary("1672970");
    assert.deepStrictEqual(summary, {
      status: "ready",
      provider: "steam",
      appId: "1672970",
      gameId: "1672970",
      title: "Minecraft Dungeons",
      earned: 12,
      total: 45,
      source: "cache",
      updatedAt: "2026-06-29T12:00:00.000Z",
    });
  });
});

test("game page achievement summary keeps Steam results when both Steam and RetroAchievements data exist", async () => {
  await withMockDeckyStorage(async () => {
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "1672970": {
        title: "Minecraft Dungeons",
      },
    };
    assert.ok(
      writeDeckyDashboardSnapshot({
        ...createDashboardSnapshot(),
        profile: {
          ...createDashboardSnapshot().profile,
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          identity: {
            providerId: RETROACHIEVEMENTS_PROVIDER_ID,
            accountId: "alice",
            displayName: "Alice",
          },
        },
        recentlyPlayedGames: [
          {
            providerId: RETROACHIEVEMENTS_PROVIDER_ID,
            gameId: "42",
            title: "Minecraft Dungeons",
            platformLabel: "Xbox",
            summary: {
              unlockedCount: 4,
              totalCount: 10,
            },
          },
        ],
        recentUnlocks: [],
        recentAchievements: [],
        featuredGames: [],
      }),
    );
    writeDeckySteamLibraryAchievementScanSummary({
      scannedAt: "2026-06-29T12:00:00.000Z",
      ownedGameCount: 1,
      scannedGameCount: 1,
      gamesWithAchievements: 1,
      unlockedAchievements: 12,
      totalAchievements: 45,
      perfectGames: 0,
      completionPercent: 27,
      games: [
        {
          providerId: STEAM_PROVIDER_ID,
          appid: 1672970,
          gameId: "1672970",
          id: "1672970",
          title: "Minecraft Dungeons",
          unlockedAchievements: 12,
          totalAchievements: 45,
          completionPercent: 27,
          scanStatus: "scanned",
          hasAchievements: true,
        },
      ],
    } as SteamLibraryAchievementScanSummary);

    const summary = await loadDeckyGamePageAchievementSummary("1672970");
    assert.deepStrictEqual(summary, {
      status: "ready",
      provider: "steam",
      appId: "1672970",
      gameId: "1672970",
      title: "Minecraft Dungeons",
      earned: 12,
      total: 45,
      source: "cache",
      updatedAt: "2026-06-29T12:00:00.000Z",
    });
  });
});

test("game page achievement summary resolves RetroAchievements counts from an exact shortcut title match", async () => {
  await withMockDeckyStorage(async () => {
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2217040867": {
        title: "StarCraft 64",
      },
    };
    assert.ok(
      writeDeckyDashboardSnapshot({
        ...createDashboardSnapshot(),
        profile: {
          ...createDashboardSnapshot().profile,
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          identity: {
            providerId: RETROACHIEVEMENTS_PROVIDER_ID,
            accountId: "alice",
            displayName: "Alice",
          },
        },
        recentlyPlayedGames: [
          {
            providerId: RETROACHIEVEMENTS_PROVIDER_ID,
            gameId: "64",
            title: "StarCraft 64",
            platformLabel: "Nintendo 64",
            summary: {
              unlockedCount: 9,
              totalCount: 18,
            },
          },
        ],
        recentUnlocks: [],
        recentAchievements: [],
        featuredGames: [],
      }),
    );

    const summary = await loadDeckyGamePageAchievementSummary("2217040867");
    assert.deepStrictEqual(summary, {
      status: "ready",
      provider: "retroachievements",
      appId: "2217040867",
      gameId: "64",
      title: "StarCraft 64",
      earned: 9,
      total: 18,
      source: "snapshot",
      updatedAt: readDeckyDashboardSnapshotCacheEntry(RETROACHIEVEMENTS_PROVIDER_ID) !== undefined
        ? new Date(readDeckyDashboardSnapshotCacheEntry(RETROACHIEVEMENTS_PROVIDER_ID)!.storedAt).toISOString()
        : undefined,
    });
  });
});

test("game page achievement summary falls back to RetroAchievements completion progress when the dashboard snapshot misses", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2217040871": {
        title: "Legend of Zelda, The: Majora's Mask",
      },
    };
    deckyBackendTestState.retroAchievements.completionProgressEntries = [
      {
        GameID: 64,
        Title: "The Legend of Zelda: Majora's Mask",
        ConsoleName: "Nintendo 64",
        MaxPossible: 76,
        NumAwarded: 38,
      },
    ];

    const summary = await loadDeckyGamePageAchievementSummary("2217040871");
    assert.equal(summary.status, "ready");
    assert.equal(summary.provider, "retroachievements");
    assert.equal(summary.appId, "2217040871");
    assert.equal(summary.gameId, "64");
    assert.equal(summary.title, "The Legend of Zelda: Majora's Mask");
    assert.equal(summary.earned, 38);
    assert.equal(summary.total, 76);
    assert.equal(summary.source, "backend");
    assert.notEqual(summary.updatedAt, undefined);
  });
});

test("game page achievement summary resolves RetroAchievements counts from a dashboard identity detail match", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2217040873": {
        title: "The Legend of Zelda: Majora's Mask",
      },
    };
    deckyBackendTestState.retroAchievements.completionProgressEntries = [];
    deckyBackendTestState.retroAchievements.gameProgressByGameId = {
      "64": createRetroAchievementsGameProgressResponse({
        gameId: "64",
        title: "The Legend of Zelda: Majora's Mask",
        consoleName: "Nintendo 64",
        unlockedCount: 13,
        totalCount: 76,
        hardcoreUnlockedCount: 13,
      }),
    };
    assert.ok(
      writeDeckyDashboardSnapshot({
        ...createDashboardSnapshot(),
        profile: {
          ...createDashboardSnapshot().profile,
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          identity: {
            providerId: RETROACHIEVEMENTS_PROVIDER_ID,
            accountId: "alice",
            displayName: "Alice",
          },
        },
        recentAchievements: [
          {
            achievement: {
              providerId: PROVIDER_ID,
              achievementId: "majora-ach-1",
              gameId: "64",
              title: "Mask Trial",
              isUnlocked: true,
              unlockedAt: 1_700_000_010_000,
              points: 10,
              metrics: [],
            },
            game: {
              providerId: RETROACHIEVEMENTS_PROVIDER_ID,
              gameId: "64",
              title: "Legend of Zelda, The - Majora's Mask (USA)",
              platformLabel: "Nintendo 64",
            },
            unlockedAt: 1_700_000_010_000,
          },
        ],
        recentUnlocks: [
          {
            achievement: {
              providerId: PROVIDER_ID,
              achievementId: "majora-ach-1",
              gameId: "64",
              title: "Mask Trial",
              isUnlocked: true,
              unlockedAt: 1_700_000_010_000,
              points: 10,
              metrics: [],
            },
            game: {
              providerId: RETROACHIEVEMENTS_PROVIDER_ID,
              gameId: "64",
              title: "Legend of Zelda, The - Majora's Mask (USA)",
              platformLabel: "Nintendo 64",
            },
            unlockedAt: 1_700_000_010_000,
          },
        ],
        recentlyPlayedGames: [],
        featuredGames: [],
      }),
    );

    const summary = await loadDeckyGamePageAchievementSummary("2217040873");
    assert.equal(summary.status, "ready");
    if (summary.status !== "ready") {
      return;
    }
    assert.deepStrictEqual(
      {
        ...summary,
        updatedAt: undefined,
      },
      {
        status: "ready",
        provider: "retroachievements",
        appId: "2217040873",
        gameId: "64",
        title: "The Legend of Zelda: Majora's Mask",
        earned: 13,
        total: 76,
        source: "backend",
        updatedAt: undefined,
      },
    );
    assert.notEqual(summary.updatedAt, undefined);
  });
});

test("game page achievement summary resolves RetroAchievements counts from a dashboard identity detail match for Ocarina of Time", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2217040874": {
        title: "The Legend of Zelda: Ocarina of Time",
      },
    };
    deckyBackendTestState.retroAchievements.completionProgressEntries = [];
    deckyBackendTestState.retroAchievements.gameProgressByGameId = {
      "65": createRetroAchievementsGameProgressResponse({
        gameId: "65",
        title: "The Legend of Zelda: Ocarina of Time",
        consoleName: "Nintendo 64",
        unlockedCount: 4,
        totalCount: 104,
        hardcoreUnlockedCount: 4,
      }),
    };
    assert.ok(
      writeDeckyDashboardSnapshot({
        ...createDashboardSnapshot(),
        profile: {
          ...createDashboardSnapshot().profile,
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          identity: {
            providerId: RETROACHIEVEMENTS_PROVIDER_ID,
            accountId: "alice",
            displayName: "Alice",
          },
        },
        recentAchievements: [
          {
            achievement: {
              providerId: PROVIDER_ID,
              achievementId: "ocarina-ach-1",
              gameId: "65",
              title: "Forest Trial",
              isUnlocked: true,
              unlockedAt: 1_700_000_020_000,
              points: 10,
              metrics: [],
            },
            game: {
              providerId: RETROACHIEVEMENTS_PROVIDER_ID,
              gameId: "65",
              title: "Legend of Zelda, The - Ocarina of Time (USA)",
              platformLabel: "Nintendo 64",
            },
            unlockedAt: 1_700_000_020_000,
          },
        ],
        recentUnlocks: [
          {
            achievement: {
              providerId: PROVIDER_ID,
              achievementId: "ocarina-ach-1",
              gameId: "65",
              title: "Forest Trial",
              isUnlocked: true,
              unlockedAt: 1_700_000_020_000,
              points: 10,
              metrics: [],
            },
            game: {
              providerId: RETROACHIEVEMENTS_PROVIDER_ID,
              gameId: "65",
              title: "Legend of Zelda, The - Ocarina of Time (USA)",
              platformLabel: "Nintendo 64",
            },
            unlockedAt: 1_700_000_020_000,
          },
        ],
        recentlyPlayedGames: [],
        featuredGames: [],
      }),
    );

    const summary = await loadDeckyGamePageAchievementSummary("2217040874");
    assert.equal(summary.status, "ready");
    if (summary.status !== "ready") {
      return;
    }
    assert.equal(summary.provider, "retroachievements");
    assert.equal(summary.appId, "2217040874");
    assert.equal(summary.gameId, "65");
    assert.equal(summary.title, "The Legend of Zelda: Ocarina of Time");
    assert.equal(summary.earned, 4);
    assert.equal(summary.total, 104);
    assert.equal(summary.source, "backend");
    assert.notEqual(summary.updatedAt, undefined);
  });
});

test("game page achievement summary reports ra-detail-unavailable when dashboard identity detail load fails", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2217040875": {
        title: "The Legend of Zelda: Majora's Mask",
      },
    };
    deckyBackendTestState.retroAchievements.completionProgressEntries = [];
    assert.ok(
      writeDeckyDashboardSnapshot({
        ...createDashboardSnapshot(),
        profile: {
          ...createDashboardSnapshot().profile,
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          identity: {
            providerId: RETROACHIEVEMENTS_PROVIDER_ID,
            accountId: "alice",
            displayName: "Alice",
          },
        },
        recentAchievements: [
          {
            achievement: {
              providerId: PROVIDER_ID,
              achievementId: "majora-ach-2",
              gameId: "64",
              title: "Mask Trial",
              isUnlocked: true,
              unlockedAt: 1_700_000_030_000,
              points: 10,
              metrics: [],
            },
            game: {
              providerId: RETROACHIEVEMENTS_PROVIDER_ID,
              gameId: "64",
              title: "Legend of Zelda, The - Majora's Mask (USA)",
              platformLabel: "Nintendo 64",
            },
            unlockedAt: 1_700_000_030_000,
          },
        ],
        recentUnlocks: [
          {
            achievement: {
              providerId: PROVIDER_ID,
              achievementId: "majora-ach-2",
              gameId: "64",
              title: "Mask Trial",
              isUnlocked: true,
              unlockedAt: 1_700_000_030_000,
              points: 10,
              metrics: [],
            },
            game: {
              providerId: RETROACHIEVEMENTS_PROVIDER_ID,
              gameId: "64",
              title: "Legend of Zelda, The - Majora's Mask (USA)",
              platformLabel: "Nintendo 64",
            },
            unlockedAt: 1_700_000_030_000,
          },
        ],
        recentlyPlayedGames: [],
        featuredGames: [],
      }),
    );

    const summary = await loadDeckyGamePageAchievementSummary("2217040875");
    assert.deepStrictEqual(summary, {
      status: "unavailable",
      appId: "2217040875",
      reason: "ra-detail-unavailable",
    });
  });
});

test("game page achievement summary reports ambiguous RetroAchievements dashboard identity matches", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2217040876": {
        title: "Duplicate Game",
      },
    };
    deckyBackendTestState.retroAchievements.completionProgressEntries = [];
    assert.ok(
      writeDeckyDashboardSnapshot({
        ...createDashboardSnapshot(),
        profile: {
          ...createDashboardSnapshot().profile,
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          identity: {
            providerId: RETROACHIEVEMENTS_PROVIDER_ID,
            accountId: "alice",
            displayName: "Alice",
          },
        },
        recentAchievements: [
          {
            achievement: {
              providerId: PROVIDER_ID,
              achievementId: "duplicate-ach-1",
              gameId: "11",
              title: "Duplicate Game Achievement 1",
              isUnlocked: true,
              unlockedAt: 1_700_000_040_000,
              points: 10,
              metrics: [],
            },
            game: {
              providerId: RETROACHIEVEMENTS_PROVIDER_ID,
              gameId: "11",
              title: "Duplicate Game",
              platformLabel: "Nintendo 64",
            },
            unlockedAt: 1_700_000_040_000,
          },
          {
            achievement: {
              providerId: PROVIDER_ID,
              achievementId: "duplicate-ach-2",
              gameId: "12",
              title: "Duplicate Game Achievement 2",
              isUnlocked: true,
              unlockedAt: 1_700_000_041_000,
              points: 10,
              metrics: [],
            },
            game: {
              providerId: RETROACHIEVEMENTS_PROVIDER_ID,
              gameId: "12",
              title: "Duplicate Game",
              platformLabel: "Nintendo 64",
            },
            unlockedAt: 1_700_000_041_000,
          },
        ],
        recentUnlocks: [],
        recentlyPlayedGames: [],
        featuredGames: [],
      }),
    );

    const summary = await loadDeckyGamePageAchievementSummary("2217040876");
    assert.deepStrictEqual(summary, {
      status: "unavailable",
      appId: "2217040876",
      reason: "ambiguous-retroachievements-shortcut-mapping",
    });
  });
});

test("game page achievement summary hides ambiguous RetroAchievements shortcut title matches", async () => {
  await withMockDeckyStorage(async () => {
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2217040868": {
        title: "Duplicate Game",
      },
    };
    assert.ok(
      writeDeckyDashboardSnapshot({
        ...createDashboardSnapshot(),
        profile: {
          ...createDashboardSnapshot().profile,
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          identity: {
            providerId: RETROACHIEVEMENTS_PROVIDER_ID,
            accountId: "alice",
            displayName: "Alice",
          },
        },
        recentlyPlayedGames: [
          {
            providerId: RETROACHIEVEMENTS_PROVIDER_ID,
            gameId: "11",
            title: "Duplicate Game",
            platformLabel: "SNES",
            summary: {
              unlockedCount: 4,
              totalCount: 10,
            },
          },
        ],
        recentUnlocks: [],
        recentAchievements: [],
        featuredGames: [
          {
            providerId: RETROACHIEVEMENTS_PROVIDER_ID,
            gameId: "12",
            title: "Duplicate Game",
            platformLabel: "Genesis",
            status: "in_progress",
            summary: {
              unlockedCount: 7,
              totalCount: 14,
            },
            metrics: [],
          },
        ],
      }),
    );

    const summary = await loadDeckyGamePageAchievementSummary("2217040868");
    assert.deepStrictEqual(summary, {
      status: "unavailable",
      appId: "2217040868",
      reason: "ambiguous-retroachievements-shortcut-mapping",
    });
  });
});

test("game page achievement summary hides ambiguous RetroAchievements completion progress matches", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2217040872": {
        title: "Duplicate Progress Game",
      },
    };
    deckyBackendTestState.retroAchievements.completionProgressEntries = [
      {
        GameID: 11,
        Title: "Duplicate Progress Game",
        ConsoleName: "SNES",
        MaxPossible: 10,
        NumAwarded: 4,
      },
      {
        GameID: 12,
        Title: "Duplicate Progress Game",
        ConsoleName: "Genesis",
        MaxPossible: 14,
        NumAwarded: 7,
      },
    ];

    const summary = await loadDeckyGamePageAchievementSummary("2217040872");
    assert.deepStrictEqual(summary, {
      status: "unavailable",
      appId: "2217040872",
      reason: "ambiguous-retroachievements-shortcut-mapping",
    });
  });
});

test("game page achievement summary reports no RetroAchievements shortcut mapping when no exact title match exists", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2217040869": {
        title: "Unmatched ROM",
      },
    };
    deckyBackendTestState.retroAchievements.completionProgressEntries = [
      {
        GameID: 99,
        Title: "Different Game",
        ConsoleName: "SNES",
        MaxPossible: 10,
        NumAwarded: 4,
      },
    ];
    assert.ok(
      writeDeckyDashboardSnapshot({
        ...createDashboardSnapshot(),
        profile: {
          ...createDashboardSnapshot().profile,
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          identity: {
            providerId: RETROACHIEVEMENTS_PROVIDER_ID,
            accountId: "alice",
            displayName: "Alice",
          },
        },
        recentlyPlayedGames: [
          {
            providerId: RETROACHIEVEMENTS_PROVIDER_ID,
            gameId: "99",
            title: "Different Game",
            platformLabel: "Nintendo 64",
            summary: {
              unlockedCount: 3,
              totalCount: 9,
            },
          },
        ],
        recentUnlocks: [],
        recentAchievements: [],
        featuredGames: [],
      }),
    );

    const summary = await loadDeckyGamePageAchievementSummary("2217040869");
    assert.deepStrictEqual(summary, {
      status: "unavailable",
      appId: "2217040869",
      reason: "no-retroachievements-shortcut-mapping",
    });
  });
});

test("game page achievement summary handles missing RetroAchievements cache without crashing", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2217040870": {
        title: "Star Fox 64",
      },
    };

    const missingCacheWithoutConfigSummary = await loadDeckyGamePageAchievementSummary("2217040870");
    assert.deepStrictEqual(missingCacheWithoutConfigSummary, {
      status: "unavailable",
      appId: "2217040870",
      reason: "ra-cache-unavailable",
    });

    clearDeckyGamePageAchievementSummaryCacheForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });

    const missingCacheSummary = await loadDeckyGamePageAchievementSummary("2217040870");
    assert.deepStrictEqual(missingCacheSummary, {
      status: "unavailable",
      appId: "2217040870",
      reason: "ra-cache-unavailable",
    });
  });
});

test("fullscreen return context writes provider dashboard, game, and achievement payloads", async () => {
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

    const achievementContext = createDeckyFullscreenReturnContextForAchievement(
      {
        game: {
          providerId: "retroachievements",
          gameId: "42",
          title: "Achievement Game",
          platformLabel: "SNES/Super Famicom",
          coverImageUrl: "https://example.com/game-cover.png",
          metrics: [{ key: "players", label: "Players", value: "123" }],
        },
        achievement: {
          achievementId: "777",
          title: "Bug Catcher",
          description: "Catch the bug.",
          badgeImageUrl: "https://example.com/badge.png",
          isUnlocked: true,
          unlockedAt: 1_700_000_123_000,
          hardcoreUnlockedAt: 1_700_000_123_000,
          unlockMode: "hardcore",
          points: 5,
          metrics: [{ key: "true-ratio", label: "True Ratio", value: "2" }],
        },
      },
      {
        providerId: "retroachievements",
        gameId: "42",
        gameTitle: "Achievement Game",
      },
    );
    const achievementPersisted = writeDeckyFullscreenReturnContext(achievementContext);
    assert.ok(achievementPersisted !== undefined);

    const achievementStored = readDeckyStorageText(DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY);
    assert.ok(achievementStored !== undefined);
    assert.deepStrictEqual(JSON.parse(achievementStored), {
      providerId: "retroachievements",
      deckyReturnView: "achievement",
      achievementTarget: {
        game: {
          providerId: "retroachievements",
          gameId: "42",
          title: "Achievement Game",
          platformLabel: "SNES/Super Famicom",
          coverImageUrl: "https://example.com/game-cover.png",
          metrics: [{ key: "players", label: "Players", value: "123" }],
        },
        achievement: {
          achievementId: "777",
          title: "Bug Catcher",
          description: "Catch the bug.",
          badgeImageUrl: "https://example.com/badge.png",
          isUnlocked: true,
          unlockedAt: 1_700_000_123_000,
          hardcoreUnlockedAt: 1_700_000_123_000,
          unlockMode: "hardcore",
          points: 5,
          metrics: [{ key: "true-ratio", label: "True Ratio", value: "2" }],
        },
      },
      parentGameOrigin: {
        providerId: "retroachievements",
        gameId: "42",
        gameTitle: "Achievement Game",
      },
      focusTarget: "open-full-screen",
      createdAt: achievementPersisted?.createdAt,
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

test("fullscreen return context restores achievement detail selection only when requested", async () => {
  await withMockDeckyStorage(async () => {
    const context = writeDeckyFullscreenReturnContext(
      createDeckyFullscreenReturnContextForAchievement(
        {
          game: {
            providerId: "retroachievements",
            gameId: "42",
            title: "Achievement Game",
            platformLabel: "SNES/Super Famicom",
            coverImageUrl: "https://example.com/game-cover.png",
            metrics: [{ key: "players", label: "Players", value: "123" }],
          },
          achievement: {
            achievementId: "777",
            title: "Bug Catcher",
            description: "Catch the bug.",
            badgeImageUrl: "https://example.com/badge.png",
            isUnlocked: true,
            unlockedAt: 1_700_000_123_000,
            hardcoreUnlockedAt: 1_700_000_123_000,
            unlockMode: "hardcore",
            points: 5,
            metrics: [{ key: "true-ratio", label: "True Ratio", value: "2" }],
          },
        },
        {
          providerId: "retroachievements",
          gameId: "42",
          gameTitle: "Achievement Game",
        },
      ),
    );
    assert.ok(context !== undefined);
    assert.ok(markDeckyFullscreenReturnRequested() !== undefined);

    const restored = consumeDeckyFullscreenReturnContext();
    assert.deepStrictEqual(restored?.selection, {
      selectedProviderId: "retroachievements",
      selectedGame: {
        providerId: "retroachievements",
        gameId: "42",
        gameTitle: "Achievement Game",
      },
      selectedAchievement: {
        game: {
          providerId: "retroachievements",
          gameId: "42",
          title: "Achievement Game",
          platformLabel: "SNES/Super Famicom",
          coverImageUrl: "https://example.com/game-cover.png",
          metrics: [{ key: "players", label: "Players", value: "123" }],
        },
        achievement: {
          achievementId: "777",
          title: "Bug Catcher",
          description: "Catch the bug.",
          badgeImageUrl: "https://example.com/badge.png",
          isUnlocked: true,
          unlockedAt: 1_700_000_123_000,
          hardcoreUnlockedAt: 1_700_000_123_000,
          unlockMode: "hardcore",
          points: 5,
          metrics: [{ key: "true-ratio", label: "True Ratio", value: "2" }],
        },
      },
    });
    assert.equal(readDeckyStorageText(DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY), undefined);
  });
});

test("fullscreen return context helper captures provider dashboard, game, and achievement origins", () => {
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

  const achievementContext = createDeckyFullscreenReturnContextForAchievement(
    {
      game: {
        providerId: "steam",
        gameId: "1482380",
        title: "Test Game",
        platformLabel: "Steam",
        coverImageUrl: "https://example.com/game.png",
        metrics: [{ key: "players", label: "Players", value: "123" }],
      },
      achievement: {
        achievementId: "ach-1",
        title: "First Win",
        description: "Win once.",
        badgeImageUrl: "https://example.com/badge.png",
        isUnlocked: true,
        unlockedAt: 1_700_000_000_000,
        softcoreUnlockedAt: 1_700_000_000_000,
        unlockMode: "softcore",
        points: 10,
        metrics: [{ key: "true-ratio", label: "True Ratio", value: "2" }],
      },
    },
    {
      providerId: "steam",
      gameId: "1482380",
      gameTitle: "Test Game",
    },
  );
  assert.deepStrictEqual(achievementContext, {
    providerId: "steam",
    deckyReturnView: "achievement",
    achievementTarget: {
      game: {
        providerId: "steam",
        gameId: "1482380",
        title: "Test Game",
        platformLabel: "Steam",
        coverImageUrl: "https://example.com/game.png",
        metrics: [{ key: "players", label: "Players", value: "123" }],
      },
      achievement: {
        achievementId: "ach-1",
        title: "First Win",
        description: "Win once.",
        badgeImageUrl: "https://example.com/badge.png",
        isUnlocked: true,
        unlockedAt: 1_700_000_000_000,
        softcoreUnlockedAt: 1_700_000_000_000,
        unlockMode: "softcore",
        points: 10,
        metrics: [{ key: "true-ratio", label: "True Ratio", value: "2" }],
      },
    },
    parentGameOrigin: {
      providerId: "steam",
      gameId: "1482380",
      gameTitle: "Test Game",
    },
    focusTarget: "open-full-screen",
  });
  assert.deepStrictEqual(restoreDeckyFullscreenSelectionFromContext(achievementContext), {
    selectedProviderId: "steam",
    selectedGame: {
      providerId: "steam",
      gameId: "1482380",
      gameTitle: "Test Game",
    },
    selectedAchievement: {
      game: {
        providerId: "steam",
        gameId: "1482380",
        title: "Test Game",
        platformLabel: "Steam",
        coverImageUrl: "https://example.com/game.png",
        metrics: [{ key: "players", label: "Players", value: "123" }],
      },
      achievement: {
        achievementId: "ach-1",
        title: "First Win",
        description: "Win once.",
        badgeImageUrl: "https://example.com/badge.png",
        isUnlocked: true,
        unlockedAt: 1_700_000_000_000,
        softcoreUnlockedAt: 1_700_000_000_000,
        unlockMode: "softcore",
        points: 10,
        metrics: [{ key: "true-ratio", label: "True Ratio", value: "2" }],
      },
    },
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

test("compact achievement back button ownerWindow registers the cancel bridge", () => {
  resetCompactAchievementCancelBridgeForTests();
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
    ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement(buttonElement);
    ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement(buttonElement);

    assert.deepStrictEqual(addCalls, [
      {
        type: "vgp_oncancel",
        capture: true,
      },
    ]);
  } finally {
    resetCompactAchievementCancelBridgeForTests();
  }
});

test("compact achievement cancel bridge helper tolerates a missing element", () => {
  resetCompactAchievementCancelBridgeForTests();
  const addCalls: Array<{ readonly type: string; readonly capture: boolean }> = [];

  const restoreWindow = setGlobalTestValue("window", {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, capture?: boolean) {
      addCalls.push({ type, capture: capture === true });
      void listener;
    },
    removeEventListener() {},
  } as Window);

  try {
    ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement(null);
    assert.deepStrictEqual(addCalls, []);
  } finally {
    restoreWindow();
    resetCompactAchievementCancelBridgeForTests();
  }
});

test("compact achievement cancel bridge helper tolerates a missing owner window", () => {
  resetCompactAchievementCancelBridgeForTests();
  const addCalls: Array<{ readonly type: string; readonly capture: boolean }> = [];
  const restoreWindow = setGlobalTestValue("window", {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, capture?: boolean) {
      addCalls.push({ type, capture: capture === true });
      void listener;
    },
    removeEventListener() {},
  } as Window);

  try {
    ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement({
      ownerDocument: undefined,
    } as Element);
    assert.deepStrictEqual(addCalls, []);
  } finally {
    restoreWindow();
    resetCompactAchievementCancelBridgeForTests();
  }
});

test("compact achievement cancel bridge stops a synthetic cancel event and clicks the marked visible back button", () => {
  resetCompactAchievementCancelBridgeForTests();
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
    ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement({
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
    resetCompactAchievementCancelBridgeForTests();
  }
});

test("compact achievement cancel bridge ignores hidden marked buttons and leaves cancel unhandled", () => {
  resetCompactAchievementCancelBridgeForTests();
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
    ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement({
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
    resetCompactAchievementCancelBridgeForTests();
  }
});

test("compact achievement cancel bridge leaves cancel alone when no marked back button exists", () => {
  resetCompactAchievementCancelBridgeForTests();
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
    ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement({
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
    resetCompactAchievementCancelBridgeForTests();
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

test("core platform seam contracts are exported for future platform adapters", () => {
  const platformSource = readFileSync(new URL("../src/core/platform.ts", import.meta.url), "utf-8");

  assert.match(platformSource, /export interface DiagnosticLogger/u);
  assert.match(platformSource, /export interface ProviderConfigStore/u);
  assert.match(platformSource, /export interface AuthenticatedProviderTransportFactory/u);
  assert.match(platformSource, /export interface DashboardSnapshotStore/u);
  assert.match(platformSource, /export interface SteamLibraryScanStore/u);
  assert.match(platformSource, /export interface PlatformCapabilities/u);
});

test("core and providers stay free of Decky implementation imports", () => {
  const coreSource = readSourceTree("src/core");
  const providersSource = readSourceTree("src/providers");

  for (const source of [coreSource, providersSource]) {
    assert.doesNotMatch(source, /\bfrom\s+["'][^"']*platform\/decky[^"']*["']/u);
    assert.doesNotMatch(source, /\bfrom\s+["']@decky\/[^"']+["']/u);
    assert.doesNotMatch(source, /decky-backend-bridge/u);
    assert.doesNotMatch(source, /callDeckyBackendMethod/u);
  }
});

test("decky authenticated transport helpers still route through backend methods", () => {
  const retroAchievementsTransportSource = readFileSync(
    new URL("../src/platform/decky/providers/retroachievements/backend-transport.ts", import.meta.url),
    "utf-8",
  );
  const steamTransportSource = readFileSync(
    new URL("../src/platform/decky/providers/steam/backend-transport.ts", import.meta.url),
    "utf-8",
  );

  assert.match(retroAchievementsTransportSource, /callDeckyBackendMethod<T>\("request_retroachievements_json"/u);
  assert.match(steamTransportSource, /callDeckyBackendMethod<T>\("request_steam_json"/u);
});

test("frontend-facing provider configs stay apiKey-free in their exported shapes", () => {
  const retroAchievementsConfigSource = readFileSync(
    new URL("../src/providers/retroachievements/config.ts", import.meta.url),
    "utf-8",
  );
  const steamConfigSource = readFileSync(
    new URL("../src/providers/steam/config.ts", import.meta.url),
    "utf-8",
  );

  const retroAchievementsInterfaceBlock = retroAchievementsConfigSource.slice(
    retroAchievementsConfigSource.indexOf("export interface RetroAchievementsProviderConfig {"),
    retroAchievementsConfigSource.indexOf("export const DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG:"),
  );
  const steamInterfaceBlock = steamConfigSource.slice(
    steamConfigSource.indexOf("export interface SteamProviderConfig {"),
    steamConfigSource.indexOf("export const DEFAULT_STEAM_PROVIDER_CONFIG:"),
  );

  assert.match(retroAchievementsInterfaceBlock, /readonly hasApiKey: boolean;/u);
  assert.doesNotMatch(retroAchievementsInterfaceBlock, /readonly apiKey:/u);
  assert.match(steamInterfaceBlock, /readonly hasApiKey: boolean;/u);
  assert.doesNotMatch(steamInterfaceBlock, /readonly apiKey:/u);
});

test("decky seam adapters satisfy the new core contracts", () => {
  const providerConfigStore: ProviderConfigStore<DeckyProviderConfigValue> = deckyProviderConfigStore;
  const dashboardSnapshotStore: DashboardSnapshotStore<DashboardSnapshot> = deckyDashboardSnapshotStore;
  const diagnosticLogger: DiagnosticLogger<DeckyDiagnosticEventPayload> = deckyDiagnosticLogger;
  const transportFactory: AuthenticatedProviderTransportFactory =
    deckyAuthenticatedProviderTransportFactory;
  const capabilities: PlatformCapabilities = deckyPlatformCapabilities;
  const steamLibraryScanStore: SteamLibraryScanStore<
    SteamLibraryAchievementScanOverview,
    SteamLibraryAchievementScanSummary
  > = deckySteamLibraryScanStore;

  assert.equal(typeof providerConfigStore.load, "function");
  assert.equal(typeof providerConfigStore.save, "function");
  assert.equal(typeof providerConfigStore.clear, "function");
  assert.equal(typeof dashboardSnapshotStore.read, "function");
  assert.equal(typeof dashboardSnapshotStore.write, "function");
  assert.equal(typeof dashboardSnapshotStore.clear, "function");
  assert.equal(typeof diagnosticLogger.record, "function");
  assert.equal(typeof transportFactory.create, "function");
  assert.equal(capabilities.supportsAuthenticatedProviderTransport, true);
  assert.equal(capabilities.supportsSteamLibraryScan, true);
  assert.equal(typeof steamLibraryScanStore.readOverview, "function");
  assert.equal(typeof steamLibraryScanStore.writeSummary, "function");
  assert.equal(typeof steamLibraryScanStore.clear, "function");
});
