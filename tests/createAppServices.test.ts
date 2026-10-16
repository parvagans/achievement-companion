import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeEach, test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { CacheEntry, CacheStore, ResourceState } from "../src/core/cache";
import {
  createProviderAchievementHistoryCacheKey,
  CACHE_VERSION,
  createProviderCompletionProgressCacheKey,
  createProviderDashboardCacheKey,
  createProviderGameDetailCacheKey,
  createProviderRelatedGamesCacheKey,
} from "../src/core/cache-keys";
import { createAppServices } from "../src/core/app-services";
import type {
  DashboardSnapshot,
  CompletionProgressSnapshot,
  GameDetailSnapshot,
  NormalizedAchievement,
  NormalizedGame,
  ProviderCapabilities,
  RecentlyPlayedGame,
  RelatedGameSummary,
} from "../src/core/domain";
import {
  DeckyAchievementTypeBadge,
  getAchievementTypeBadgeDescriptor,
} from "../src/platform/decky/decky-achievement-type-badge";
import { getCompletionBarFillStyle } from "../src/platform/decky/decky-completion-progress-bar";
import { raRecipes, raTheme } from "../src/platform/decky/ra-theme";
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
  DEFAULT_GAME_PAGE_ACHIEVEMENT_BADGE_COLORS,
  parseAchievementCompanionSettings,
  serializeAchievementCompanionSettings,
} from "../src/core/settings";
import { resolveProviderDashboardPreferences } from "../src/core/provider-dashboard-preferences";
import { redactFrontendLogText, redactFrontendLogValue } from "../src/core/redaction";
import {
  applyDeckyRecentAchievementHistory,
  buildDeckyRecentAchievementHistory,
  getDeckyDashboardStateForFullScreenEntryInitial,
  loadDeckyAchievementHistoryStateForFullScreenEntry,
  loadDeckyDashboardState,
  loadDeckyDashboardStateForFullScreenEntry,
  loadDeckyCompletionProgressState,
  loadDeckyCompletionProgressStateForFullScreenEntry,
  deckyAuthenticatedProviderTransportFactory,
  mergeDeckySteamCompletionProgressWithDashboard,
  mergeDeckySteamLibraryScanRecentAchievements,
  deckyPlatformCapabilities,
  refreshDeckySteamLibraryForExplicitRefresh,
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
  getRetroAchievementsProfileAwardStatus,
  getRetroAchievementsSupplementaryProfileStats,
  selectRetroAchievementsCompletionProgressGames,
  selectRetroAchievementsGameAwards,
} from "../src/platform/decky/decky-full-screen-profile-data";
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
import { getRetroAchievementsRecentActivityLabel } from "../src/platform/decky/decky-retroachievements-recent-activity";
import {
  addProfileAvatarCacheBustParam,
} from "../src/platform/decky/decky-avatar-cache-busting";
import {
  ACHIEVEMENT_COMPANION_LAST_GAME_PAGE_BADGE_DEBUG_STORAGE_KEY,
  ACHIEVEMENT_COMPANION_LAST_RA_SHORTCUT_RESOLUTION_DEBUG_STORAGE_KEY,
  ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_GLOBAL_NAME,
  getAchievementCompanionRuntimeDebugState,
  getAchievementCompanionLastGamePageBadgeDebug,
  getAchievementCompanionLastRaShortcutResolutionDebug,
  resolveAchievementCompanionRuntimeDebugHostContext,
} from "../src/platform/decky/decky-runtime-debug";
import {
  DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN,
  detectDeckyGamePageAchievementRouteFromUrl,
  resolveDeckyGamePageAchievementAppIdFromRouteProps,
} from "../src/platform/decky/decky-game-page-achievement-route";
import {
  clearDeckyGamePageAchievementSummaryCacheForTests,
  enrichDeckyGamePageAchievementSummaryCompletionStatus,
  formatDeckyGamePageAchievementBadgeLoadingText,
  formatDeckyGamePageAchievementBadgeLabel,
  invalidateDeckyGamePageAchievementSummaryCache,
  loadDeckyGamePageAchievementSummary,
  normalizeRetroAchievementsPlatformLabel,
  selectDeckyGamePageAchievementSummaryForAppId,
} from "../src/platform/decky/decky-game-page-achievement-summary";
import { resolveDeckyGamePageAchievementBadgePresentation } from "../src/platform/decky/decky-game-page-achievement-badge-presentation";
import {
  resolveDeckyGamePageAchievementBadgeColor,
  resolveDeckyGamePageAchievementBadgePalette,
} from "../src/platform/decky/decky-game-page-achievement-badge-colors";
import { loadDeckySteamShortcutMetadata } from "../src/platform/decky/decky-steam-shortcut-metadata";
import { loadDeckySteamShortcutRomHashInfo } from "../src/platform/decky/decky-steam-shortcut-metadata";
import { readDeckyStorageText } from "../src/platform/decky/storage";
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
  readDeckySteamAchievementSchemaCache,
  getDeckySteamLibraryAchievementScanRevision,
  readDeckySteamProviderConfig,
  writeDeckySteamLibraryAchievementScanSummary,
  writeDeckySteamLibraryAchievementScanSummaryIfRevisionMatches,
  writeDeckySteamAchievementSchemaCache,
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
  refreshAndCacheDeckySteamLibraryAchievementProgress,
  runAndCacheDeckySteamLibraryAchievementScan,
} from "../src/platform/decky/providers/steam/library-scan";
import {
  reconcileSteamLibraryAchievementSummaryWithRecentGames,
  refreshSteamLibraryAchievementProgress,
  scanSteamLibraryAchievements,
  validateSteamOwnedGamesResponse,
} from "../src/providers/steam/library-scan";
import { countSteamPlayerAchievements } from "../src/providers/steam/achievement-count";
import {
  loadSteamPlayerAchievementsCoalesced,
  type SteamClient,
} from "../src/providers/steam/client/client";
import { normalizeSteamBadges } from "../src/providers/steam/badges";
import {
  applySteamLibraryScanGameDetailMetadata,
  findSteamLibraryScanGameSummaryByAppId,
} from "../src/platform/decky/providers/steam/game-detail";
import {
  ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement,
  ensureCompactGameDetailCancelBridgeRegisteredForBackButtonElement,
  ensureCompactProviderCancelBridgeRegisteredForBackButtonElement,
  resetCompactAchievementCancelBridgeForTests,
  resetCompactGameDetailCancelBridgeForTests,
  resetCompactProviderCancelBridgeForTests,
} from "../src/platform/decky/decky-full-screen-cancel-bridge";
import type { SteamLibraryAchievementScanSummary } from "../src/platform/decky/providers/steam";
import {
  countCompletionProgressSubsetGames,
  filterCompletionProgressGamesBySubsetVisibility,
  groupCompletionProgressGames,
  sortCompletionProgressGroups,
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
  RawRetroAchievementsGameListEntry,
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
import { loadOptionalRetroAchievementsProfileSummary } from "../src/providers/retroachievements/retroachievements.provider";
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
  retroAchievementsSystems: number;
  retroAchievementsGameList: number;
  completionProgress: number;
  recentUnlocks: number;
  achievementsEarnedBetween: number;
  recentlyPlayedGames: number;
  gameProgress: number;
  relatedGames: number;
  relatedGameProgress: number;
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
  readonly systems?: readonly RawRetroAchievementsSystemResponse[];
  readonly completionProgressEntries?: readonly RawRetroAchievementsCompletionProgressEntry[];
  readonly gameListByConsoleId?: Readonly<Record<string, readonly RawRetroAchievementsGameListEntry[]>>;
  readonly gameProgressByGameId?: Readonly<Record<string, RawRetroAchievementsGameProgressResponse>>;
  systemsRequestCount?: number;
  gameListRequestCount?: number;
  gameListRequestedConsoleIds?: string[];
  gameProgressRequestCount?: number;
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
  readonly shortcutMetadataByAppId?: Readonly<
    Record<
      string,
      {
        readonly title: string;
        readonly platformTag?: string;
        readonly platformLabel?: string;
        readonly tags?: readonly string[];
        readonly exe?: string;
        readonly startDir?: string;
      }
    >
  >;
  readonly shortcutRomHashByAppId?: Readonly<
    Record<
      string,
      {
        readonly shortcutRomPathDetected: boolean;
        readonly romHashAttempted: boolean;
        readonly romHashStatus: "resolved" | "skipped" | "error" | "ambiguous";
        readonly romHashAlgorithm?: "rcheevos";
        readonly romHash?: string;
        readonly shortcutRomPathSource?: string;
        readonly hashResolverSkippedReason?: string;
        readonly hashRejectedReason?: string;
        readonly candidateCount?: number;
        readonly candidateExtension?: string;
        readonly archiveMemberExtension?: string;
        readonly candidateResults?: readonly { readonly source: string; readonly extension: string; readonly status: string; readonly reason?: string; readonly memberExtension?: string }[];
        readonly candidateRejections?: readonly { readonly source: string; readonly extension: string; readonly reason: string }[];
      }
    >
  >;
  hashRequestedConsoleIds?: number[];
  steamRequestCount?: number;
  steamRequestedPaths?: string[];
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

  if (route === "validate_retroachievements_credentials") {
    return { ok: true };
  }

  if (route === "validate_steam_credentials") {
    return { ok: true };
  }

  if (route === "request_retroachievements_json") {
    const path = typeof record?.path === "string" ? record.path : "";
    if (path === "API_GetConsoleIDs.php") {
      const systems = deckyBackendTestState.retroAchievements.systems;
      if (systems === undefined) {
        throw new Error("Unexpected RetroAchievements systems request in test");
      }

      deckyBackendTestState.retroAchievements.systemsRequestCount =
        (deckyBackendTestState.retroAchievements.systemsRequestCount ?? 0) + 1;
      return systems;
    }

    if (path === "API_GetGameList.php") {
      const consoleId =
        typeof record?.query === "object" && record.query !== null
          ? (() => {
              const query = record.query as Record<string, unknown>;
              const rawConsoleId = query["i"];
              return typeof rawConsoleId === "string"
                ? rawConsoleId.trim()
                : typeof rawConsoleId === "number"
                  ? String(Math.trunc(rawConsoleId))
                  : "";
            })()
          : "";

      if (consoleId.length === 0) {
        throw new Error("Unexpected RetroAchievements game list request without a console id in test");
      }

      const response = deckyBackendTestState.retroAchievements.gameListByConsoleId?.[consoleId];
      if (response === undefined) {
        throw new Error(`Unexpected RetroAchievements game list request for console id ${consoleId} in test`);
      }

      deckyBackendTestState.retroAchievements.gameListRequestCount =
        (deckyBackendTestState.retroAchievements.gameListRequestCount ?? 0) + 1;
      if (deckyBackendTestState.retroAchievements.gameListRequestedConsoleIds === undefined) {
        deckyBackendTestState.retroAchievements.gameListRequestedConsoleIds = [];
      }
      deckyBackendTestState.retroAchievements.gameListRequestedConsoleIds.push(consoleId);
      return response;
    }

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

      deckyBackendTestState.retroAchievements.gameProgressRequestCount =
        (deckyBackendTestState.retroAchievements.gameProgressRequestCount ?? 0) + 1;

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
    deckyBackendTestState.steam.steamRequestCount =
      (deckyBackendTestState.steam.steamRequestCount ?? 0) + 1;
    if (deckyBackendTestState.steam.steamRequestedPaths === undefined) {
      deckyBackendTestState.steam.steamRequestedPaths = [];
    }
    deckyBackendTestState.steam.steamRequestedPaths.push(path);
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
          ...(metadata.platformTag !== undefined ? { platformTag: metadata.platformTag } : {}),
          ...(metadata.platformLabel !== undefined ? { platformLabel: metadata.platformLabel } : {}),
          ...(metadata.tags !== undefined ? { tags: metadata.tags } : {}),
          ...(metadata.exe !== undefined ? { exe: metadata.exe } : {}),
          ...(metadata.startDir !== undefined ? { startDir: metadata.startDir } : {}),
      };
  }

  if (route === "get_steam_shortcut_rom_hash") {
    if (typeof record?.consoleId === "number") {
      (deckyBackendTestState.steam.hashRequestedConsoleIds ??= []).push(record.consoleId);
    }
    const appId =
      typeof record?.appId === "string"
        ? record.appId
        : typeof record?.appId === "number"
          ? String(record.appId)
          : "";
    const hashInfo = deckyBackendTestState.steam.shortcutRomHashByAppId?.[appId];
    return hashInfo === undefined
      ? undefined
      : {
          appId,
          shortcutRomPathDetected: hashInfo.shortcutRomPathDetected,
          ...(hashInfo.shortcutRomPathSource !== undefined ? { shortcutRomPathSource: hashInfo.shortcutRomPathSource } : {}),
          romHashAttempted: hashInfo.romHashAttempted,
          romHashStatus: hashInfo.romHashStatus,
          ...(hashInfo.candidateCount !== undefined ? { candidateCount: hashInfo.candidateCount } : {}),
          ...(hashInfo.candidateExtension !== undefined ? { candidateExtension: hashInfo.candidateExtension } : {}),
          ...(hashInfo.archiveMemberExtension !== undefined ? { archiveMemberExtension: hashInfo.archiveMemberExtension } : {}),
          ...(hashInfo.candidateResults !== undefined ? { candidateResults: hashInfo.candidateResults } : {}),
          ...(hashInfo.candidateRejections !== undefined ? { candidateRejections: hashInfo.candidateRejections } : {}),
          ...(hashInfo.romHashAlgorithm !== undefined ? { romHashAlgorithm: hashInfo.romHashAlgorithm } : {}),
          ...(hashInfo.romHash !== undefined ? { romHash: hashInfo.romHash } : {}),
          ...(hashInfo.hashResolverSkippedReason !== undefined
            ? { hashResolverSkippedReason: hashInfo.hashResolverSkippedReason }
            : {}),
          ...(hashInfo.hashRejectedReason !== undefined ? { hashRejectedReason: hashInfo.hashRejectedReason } : {}),
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
  readonly consoleId?: number | string;
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
    ...(args.consoleId !== undefined ? { ConsoleID: args.consoleId } : {}),
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

test("retroachievements achievement types survive normalization as typed classifications", () => {
  const rawGameProgress = createRetroAchievementsGameProgressResponse({
    gameId: "typed-game",
    title: "Typed Achievements",
    totalCount: 6,
  });
  rawGameProgress.Achievements = {
    "1": { ID: 1, Title: "Missable", Type: "missable", DisplayOrder: 1 },
    "2": { ID: 2, Title: "Progression", type: "progression", DisplayOrder: 2 },
    "3": { ID: 3, Title: "Win", Type: "win_condition", DisplayOrder: 3 },
    "4": { ID: 4, Title: "Normal", Type: null, DisplayOrder: 4 },
    "5": { ID: 5, Title: "Unknown", Type: "future_type", DisplayOrder: 5 },
    "6": { ID: 6, Title: "Absent", DisplayOrder: 6 },
  };

  const snapshot = normalizeRetroAchievementsGameDetail(rawGameProgress);

  assert.deepEqual(
    snapshot.achievements.map((achievement) => achievement.classification),
    ["missable", "progression", "win-condition", undefined, undefined, undefined],
  );
});

test("achievement type badge maps supported classifications and ignores absent cached or unknown values", () => {
  assert.equal(getAchievementTypeBadgeDescriptor("missable")?.label, "Missable");
  assert.equal(getAchievementTypeBadgeDescriptor("progression")?.label, "Progression");
  assert.equal(getAchievementTypeBadgeDescriptor("win-condition")?.label, "Win Condition");
  assert.match(
    renderToStaticMarkup(DeckyAchievementTypeBadge({ classification: "missable" })),
    />Missable<\/span>/u,
  );
  assert.match(
    renderToStaticMarkup(DeckyAchievementTypeBadge({ classification: "progression" })),
    />Progression<\/span>/u,
  );
  assert.match(
    renderToStaticMarkup(DeckyAchievementTypeBadge({ classification: "win-condition" })),
    />Win Condition<\/span>/u,
  );
  assert.equal(getAchievementTypeBadgeDescriptor(null), undefined);
  assert.equal(getAchievementTypeBadgeDescriptor(undefined), undefined);
  assert.equal(getAchievementTypeBadgeDescriptor("future_type"), undefined);
  assert.equal(DeckyAchievementTypeBadge({ classification: undefined }), null);
  assert.equal(DeckyAchievementTypeBadge({ classification: "future_type" }), null);

  const oldCachedAchievement = JSON.parse(JSON.stringify({
    providerId: "retroachievements",
    achievementId: "legacy-achievement",
    gameId: "legacy-game",
    title: "Legacy Achievement",
    isUnlocked: false,
    metrics: [],
  })) as NormalizedAchievement;
  assert.equal(getAchievementTypeBadgeDescriptor(oldCachedAchievement.classification), undefined);
});

test("compact and full-screen game rows share the achievement type badge", () => {
  const compactSource = readFileSync("src/platform/decky/decky-compact-achievement-list.tsx", "utf8");
  const fullScreenSource = readFileSync("src/platform/decky/decky-full-screen-achievement-row.tsx", "utf8");

  assert.match(compactSource, /DeckyAchievementTypeBadge/u);
  assert.match(compactSource, /classification=\{model\.classification\}/u);
  assert.match(compactSource, /getTitleLineStyle/u);
  assert.match(fullScreenSource, /DeckyAchievementTypeBadge/u);
  assert.match(fullScreenSource, /classification=\{achievement\.classification\}/u);
  assert.match(fullScreenSource, /getAchievementRowTitleLineStyle/u);
});

test("compact achievement details retain type badges while the full-screen page is static and B-only", () => {
  const compactSource = readFileSync("src/platform/decky/decky-achievement-detail-view.tsx", "utf8");
  const fullScreenSource = readFileSync("src/platform/decky/decky-full-screen-achievement-page.tsx", "utf8");

  assert.match(compactSource, /getTitleLineStyle/u);
  assert.match(compactSource, /flexWrap: "wrap"/u);
  assert.match(compactSource, /overflowWrap: "anywhere"/u);
  assert.match(compactSource, /DeckyAchievementTypeBadge classification=\{model\.classification\}/u);

  assert.match(fullScreenSource, /function DeckyFullScreenAchievementInputSurface/u);
  assert.match(fullScreenSource, /surface\.focus\(\{ preventScroll: true \}\)/u);
  assert.doesNotMatch(fullScreenSource, /onCancel=\{handleCancel\}|markDeckyFullscreenReturnRequested/u);
  assert.match(fullScreenSource, /function DeckyFullScreenAchievementLoadingState/u);
  assert.doesNotMatch(fullScreenSource, /DeckyAchievementTypeBadge/u);
  assert.match(fullScreenSource, /<Focusable/u);
  assert.doesNotMatch(fullScreenSource, /DeckyFullscreenActionButton/u);
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
      Type: "progression",
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
  assert.equal(recentUnlocks[0]?.achievement.classification, "progression");
  assert.equal(recentUnlocks[1]?.achievement.unlockMode, "softcore");
});

test("retroachievements earned-between history splits saturated date ranges without dropping recent unlocks", async () => {
  const requests: Array<{ readonly from: number; readonly to: number }> = [];
  const saturatedResponse = Array.from({ length: 500 }, (_, index) => ({
    AchievementID: index + 1,
    Title: `Older ${String(index + 1)}`,
    GameID: 1,
    GameTitle: "Older Game",
    Date: "2020-01-01 00:00:00",
  } satisfies RawRetroAchievementsRecentUnlockResponse));
  const provider = createRetroAchievementsProvider({
    client: {
      async loadProfile() {
        throw new Error("not used");
      },
      async loadCompletionProgress() {
        throw new Error("not used");
      },
      async loadAchievementsEarnedBetween(_config, options) {
        requests.push({ from: options.fromEpochSeconds, to: options.toEpochSeconds });
        if (options.fromEpochSeconds === 100 && options.toEpochSeconds === 200) {
          return saturatedResponse;
        }

        return [
          {
            AchievementID: options.fromEpochSeconds === 100 ? 501 : 502,
            Title: options.fromEpochSeconds === 100 ? "Older boundary" : "Recent boundary",
            GameID: 1,
            GameTitle: "Test Game",
            Date: options.fromEpochSeconds === 100 ? "2020-01-02 00:00:00" : "2020-01-03 00:00:00",
          },
        ] satisfies readonly RawRetroAchievementsRecentUnlockResponse[];
      },
      async loadRecentUnlocks() {
        throw new Error("not used");
      },
      async loadRecentlyPlayedGames() {
        throw new Error("not used");
      },
      async loadGameProgress() {
        throw new Error("not used");
      },
    },
  });

  const unlocks = await provider.loadAchievementsEarnedBetween?.(
    { username: "alice", apiKey: "secret" },
    { fromEpochSeconds: 100, toEpochSeconds: 200 },
  );

  assert.deepStrictEqual(requests, [
    { from: 100, to: 200 },
    { from: 151, to: 200 },
    { from: 100, to: 150 },
  ]);
  assert.deepStrictEqual(
    unlocks?.map((unlock) => unlock.achievement.achievementId),
    ["501", "502"],
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
    gamePageAchievementBadgeSize: "large",
    recentlyPlayedCount: 3,
  });
  assert.equal(
    serializeAchievementCompanionSettings(DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS),
    JSON.stringify(DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS),
  );
});

test("SteamHunters personal data stays enabled for existing settings and can be disabled", () => {
  assert.equal(DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.steamHuntersPersonalDataEnabled, true);
  assert.equal(parseAchievementCompanionSettings(JSON.stringify({ recentAchievementsCount: 3 })).steamHuntersPersonalDataEnabled, true);
  assert.equal(parseAchievementCompanionSettings(JSON.stringify({ steamHuntersPersonalDataEnabled: false })).steamHuntersPersonalDataEnabled, false);
  assert.equal(parseAchievementCompanionSettings(JSON.stringify({ steamHuntersPersonalDataEnabled: "false" })).steamHuntersPersonalDataEnabled, true);
});

test("game page badge settings preserve valid preferences and reject invalid positions", () => {
  assert.equal(DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.gamePageAchievementBadgeSize, "small");
  assert.deepStrictEqual(DEFAULT_GAME_PAGE_ACHIEVEMENT_BADGE_COLORS, {
    perfected: "purple",
    mastered: "gold",
    beaten: "blue",
    inProgress: "gray",
  });
  assert.equal(parseAchievementCompanionSettings(undefined).gamePageAchievementBadgeSize, "small");
  assert.equal(parseAchievementCompanionSettings("{}").gamePageAchievementBadgeSize, "large");
  const validSettings = parseAchievementCompanionSettings(
    JSON.stringify({
      showGamePageAchievementBadge: false,
      gamePageAchievementBadgeSize: "small",
      gamePageAchievementBadgePosition: "bottom-center",
      gamePageAchievementBadgeColors: {
        perfected: "gold",
        mastered: "cyan",
        beaten: "red",
        inProgress: "purple",
      },
    }),
  );
  assert.equal(validSettings.showGamePageAchievementBadge, false);
  assert.equal(validSettings.gamePageAchievementBadgeSize, "small");
  assert.equal(validSettings.gamePageAchievementBadgePosition, "bottom-center");
  assert.deepStrictEqual(validSettings.gamePageAchievementBadgeColors, {
    perfected: "gold",
    mastered: "cyan",
    beaten: "red",
    inProgress: "purple",
  });

  const invalidPositionSettings = parseAchievementCompanionSettings(
    JSON.stringify({
      gamePageAchievementBadgePosition: "middle-left",
      gamePageAchievementBadgeSize: "huge",
      gamePageAchievementBadgeColors: {
        perfected: "orange",
        mastered: "green",
        beaten: 42,
        inProgress: "gray",
      },
    }),
  );
  assert.equal(
    invalidPositionSettings.gamePageAchievementBadgePosition,
    DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.gamePageAchievementBadgePosition,
  );
  assert.equal(invalidPositionSettings.gamePageAchievementBadgeSize, "large");
  assert.deepStrictEqual(invalidPositionSettings.gamePageAchievementBadgeColors, {
    ...DEFAULT_GAME_PAGE_ACHIEVEMENT_BADGE_COLORS,
    mastered: "green",
    inProgress: "gray",
  });
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

test("provider setup, credential fields, and current compact profile routes stay explicit", () => {
  assert.match(RETROACHIEVEMENTS_CREDENTIAL_HELPER_COPY, /retroachievements\.org\/settings\?tab=applications/i);
  assert.match(RETROACHIEVEMENTS_CREDENTIAL_HELPER_COPY, /Enter your username and paste the API key/i);
  assert.doesNotMatch(RETROACHIEVEMENTS_CREDENTIAL_HELPER_COPY, /Show API key|Hide API key/i);
  assert.match(STEAM_CREDENTIAL_HELPER_COPY, /filled from the account signed in on this Deck when available/i);
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
    /The signed-in Steam account is detected automatically when available\. If not, enter its SteamID64\. Enter your Steam Web API key to connect, and keep the key private on this device\./u,
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
    new RegExp(`\\.${DECKY_FULLSCREEN_CHIP_CLASS} \\{`),
  );
  assert.match(getDeckyFullscreenActionStylesCss(), /border-radius:\s*999px\s*!important/);
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
  const compactAchievementListSource = readFileSync(
    "src/platform/decky/decky-compact-achievement-list.tsx",
    "utf8",
  );
  assert.match(
    compactAchievementListSource,
    /\{model\.supportsModeFilter \? \([\s\S]*MODE_FILTERS\.map/u,
  );
  assert.match(compactAchievementListSource, /matchesCompactAchievementModeFilter\(row, pageState\.modeFilter\)/u);
  assert.match(compactAchievementListSource, /matchesCompactAchievementFilter\(row, pageState\.filter\)/u);
  assert.match(compactAchievementListSource, /aria-label="Achievement mode filters"/u);
  assert.match(compactAchievementListSource, /aria-label="Achievement filters"/u);
  assert.match(compactAchievementListSource, /MODE_FILTERS\.map\(\(filter\)/u);
  assert.match(compactAchievementListSource, /FILTERS\.map\(\(filter\)/u);
  assert.match(compactAchievementListSource, /Show 5 more/u);
  assert.match(compactAchievementListSource, /Show all/u);
  assert.match(compactAchievementListSource, /role="radio"/);
  assert.match(compactAchievementListSource, /aria-checked=\{active\}/);
  assert.match(compactAchievementListSource, /DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS/);
  assert.match(compactAchievementListSource, /DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS/);
  assert.match(compactAchievementListSource, /onCancelButton=\{onBack\}/u);
  assert.match(compactAchievementListSource, /scrollDeckyFocusTargetIntoView\(event\.currentTarget\)/u);
  const fullScreenGamePageSource = readFileSync("src/platform/decky/decky-full-screen-game-page.tsx", "utf8");
  const fullScreenAchievementRowSource = readFileSync(
    "src/platform/decky/decky-full-screen-achievement-row.tsx",
    "utf8",
  );
  const fullScreenAchievementBrowserSource = readFileSync(
    "src/platform/decky/decky-full-screen-achievement-browser.tsx",
    "utf8",
  );
  const steamFullscreenGameArtworkSource = readFileSync(
    "src/platform/decky/decky-steam-fullscreen-game-artwork.tsx",
    "utf8",
  );
  const fullScreenGameProgressStatSource = readFileSync(
    "src/platform/decky/decky-full-screen-game-progress-stat.tsx",
    "utf8",
  );
  const retroAchievementsProgressSummarySource = readFileSync(
    "src/platform/decky/decky-retroachievements-progress-summary.tsx",
    "utf8",
  );
  const retroAchievementsCommunityStatsSource = readFileSync(
    "src/platform/decky/decky-retroachievements-community-stats.tsx",
    "utf8",
  );
  const steamProgressSummarySource = readFileSync(
    "src/platform/decky/decky-steam-progress-summary.tsx",
    "utf8",
  );
  const steamGameOverviewSource = readFileSync(
    "src/platform/decky/decky-steam-game-overview.tsx",
    "utf8",
  );
  assert.match(fullScreenGamePageSource, /PanelSection title="Achievements"/);
  assert.doesNotMatch(fullScreenGamePageSource, /PanelSection title="Navigation"/);
  assert.doesNotMatch(fullScreenGamePageSource, /FULLSCREEN_GAME_FOCUS_DIAGNOSTICS_CLASS|\.gpfocus/u);
  assert.match(fullScreenAchievementBrowserSource, /ACHIEVEMENT_MODE_FILTERS = \["all", "hardcore", "softcore"\] as const;/);
  assert.match(fullScreenGamePageSource, /useState<AchievementModeFilter>\(initialSectionState\?\.achievements\.achievementModeFilter \?\? "all"\)/u);
  assert.match(fullScreenGamePageSource, /useState<AchievementFilter>\(initialSectionState\?\.achievements\.achievementFilter \?\? "all"\)/u);
  assert.match(fullScreenGamePageSource, /projectRetroAchievementsFullScreenAchievements\([\s\S]*settings\.retroAchievementsAchievementMode[\s\S]*sortAchievementsForDisplay\(restorationProjectedAchievements\)/u);
  assert.match(fullScreenGamePageSource, /DeckySteamGameOverview/u);
  assert.match(steamProgressSummarySource, /DeckyCompletionProgressBar[\s\S]*percent=\{completionPercent\}/);
  assert.match(steamProgressSummarySource, /title="Your Progress" focusable=\{false\}/u);
  assert.match(retroAchievementsCommunityStatsSource, /title="Community"[\s\S]*focusable=\{false\}/u);
  assert.match(
    fullScreenGamePageSource,
    /matchesAchievementFilter\(achievement, achievementFilter\)[\s\S]*restorationShowModeFilter \? matchesAchievementModeFilter\(achievement, achievementModeFilter\) : true/u,
  );
  assert.match(fullScreenGamePageSource, /settings\.retroAchievementsAchievementMode === "both"[\s\S]*hasDistinctRetroAchievementsModes\(restorationSnapshot\.achievements\)/u);
  assert.match(fullScreenAchievementBrowserSource, /showAchievementModeFilter \?\s*\(/u);
  assert.match(fullScreenGamePageSource, /const isSteamProvider = game\.providerId === STEAM_PROVIDER_ID;/u);
  assert.match(
    steamProgressSummarySource,
    /function getStatsGridStyle\(\): CSSProperties[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/u,
  );
  assert.match(steamProgressSummarySource, /function getStatsGridStyle\(\): CSSProperties/u);
  assert.match(steamGameOverviewSource, /DeckySteamProgressSummary/u);
  assert.match(steamGameOverviewSource, /DeckySteamHuntersCommunitySection[\s\S]*compact/u);
  assert.match(
    steamGameOverviewSource,
    /DeckySteamHuntersCompletionHealthSection[\s\S]*title="Achievement Set Status"/u,
  );
  assert.match(steamGameOverviewSource, /DeckySteamHuntersSetDetailsSection/u);
  assert.match(steamGameOverviewSource, /store\.steampowered\.com\/app\/\$\{appId\}/u);
  assert.match(steamGameOverviewSource, /DeckyNavigation\.NavigateToExternalWeb/u);
  assert.doesNotMatch(steamGameOverviewSource, /Latest Unlocks|Achievement Highlights|title="Snapshot"/u);
  assert.doesNotMatch(fullScreenGamePageSource, /Most recent unlocked achievements already loaded in this snapshot\./u);
  assert.match(steamGameOverviewSource, /remainingValue=\{remainingCount === undefined \? undefined : formatCount\(remainingCount\)\}/u);
  assert.match(steamProgressSummarySource, /DeckyFullScreenGameProgressStat dense label="Remaining" value=\{remainingValue\}/u);
  assert.match(fullScreenGameProgressStatSource, /function getProgressStatStyle\(dense: boolean\): CSSProperties/u);
  assert.match(fullScreenGameProgressStatSource, /function getProgressStatValueStyle\(\): CSSProperties/u);
  assert.doesNotMatch(fullScreenGamePageSource, /handleSteamFullscreenRefreshKeyDown/u);
  assert.doesNotMatch(fullScreenGamePageSource, /handleSteamFullscreenSpotlightRowKeyDown/u);
  assert.doesNotMatch(fullScreenGamePageSource, /data-achievement-companion-steam-fullscreen-refresh="true"/u);
  assert.doesNotMatch(fullScreenGamePageSource, /data-achievement-companion-steam-spotlight-row="true"/u);
  assert.match(retroAchievementsProgressSummarySource, /function getProgressSummaryStyle\(\): CSSProperties/u);
  assert.match(retroAchievementsProgressSummarySource, /label="Unlocked"[\s\S]*label="Remaining"[\s\S]*label="Last unlock"/u);
  assert.match(retroAchievementsProgressSummarySource, /DeckyFullScreenGameProgressStatGrid/u);
  assert.doesNotMatch(fullScreenGamePageSource, /heroMetaPills|formatDeckyProviderLabel/u);
  assert.doesNotMatch(steamGameOverviewSource, /metadataLabels/u);
  assert.doesNotMatch(fullScreenGamePageSource, /GameOverviewRefreshPill/);
  assert.doesNotMatch(fullScreenGamePageSource, /getProgressSummaryPercentStyle/);
  assert.match(fullScreenGamePageSource, /buildGameMetadataPills\([\s\S]*game\.metrics,[\s\S]*isSteamProvider,[\s\S]*isSteamProvider/u);
  assert.match(fullScreenGamePageSource, /metadataPills=\{gameMetadataPills\}/);
  assert.match(fullScreenGamePageSource, /Total players/);
  assert.match(fullScreenGamePageSource, /Release date/);
  assert.match(fullScreenGamePageSource, /Points/);
  assert.match(fullScreenGamePageSource, /RetroPoints/);
  assert.equal((fullScreenGamePageSource.match(/gameMetadataPills\.map/g) ?? []).length, 0);
  assert.doesNotMatch(fullScreenGamePageSource, /hardcore-\$\{pill\.key\}/);
  assert.doesNotMatch(fullScreenGamePageSource, /softcore-\$\{pill\.key\}/);
  assert.doesNotMatch(fullScreenGamePageSource, /label="Completion"/);
  assert.doesNotMatch(fullScreenGamePageSource, /gameSystemLabel/);
  assert.doesNotMatch(fullScreenGamePageSource, /AchievementModeButtons/);
  assert.doesNotMatch(fullScreenGamePageSource, /AchievementStateButtons/);
  assert.match(fullScreenAchievementBrowserSource, /getRaAchievementFilterBarStyle\(\)/);
  assert.match(fullScreenAchievementBrowserSource, /AchievementFilterButton/);
  assert.match(fullScreenAchievementBrowserSource, /Focusable/);
  assert.match(fullScreenAchievementBrowserSource, /flow-children="left-right"/);
  assert.match(fullScreenAchievementBrowserSource, /flow-children="left-right"\s+tabIndex=\{-1\}/u);
  assert.match(fullScreenAchievementBrowserSource, /ACHIEVEMENT_MODE_FILTERS\.map\(\(filter\)/);
  assert.match(fullScreenAchievementBrowserSource, /ACHIEVEMENT_FILTERS\.map\(\(filter\)/);
  assert.match(fullScreenAchievementBrowserSource, /role="button"/);
  assert.match(fullScreenAchievementBrowserSource, /aria-pressed=\{selected\}/);
  assert.match(fullScreenAchievementBrowserSource, /onActivate=\{disabled \? \(\) => undefined : onActivate\}/);
  assert.match(fullScreenAchievementBrowserSource, /onGamepadFocus=\{\(event\) => \{/);
  assert.doesNotMatch(fullScreenAchievementBrowserSource, /role="radiogroup"/);
  assert.doesNotMatch(fullScreenGamePageSource, /data-game-overview-pill="refresh"/);
  assert.doesNotMatch(fullScreenGamePageSource, /aria-label="Refresh the current game detail snapshot"/);
  assert.doesNotMatch(fullScreenGamePageSource, /DeckyCompactPillActionItem/);
  assert.match(fullScreenGamePageSource, /DeckyFullScreenAchievementBrowser/);
  assert.match(fullScreenGamePageSource, /ownerWindow\.requestAnimationFrame/u);
  assert.match(fullScreenGamePageSource, /restoredSectionNonceRef\.current = sectionRestoreNonce/u);
  assert.match(fullScreenGamePageSource, /anchor\.querySelector<HTMLElement>/u);
  assert.match(fullScreenGamePageSource, /sectionEntryFocusTarget/u);
  assert.doesNotMatch(fullScreenGamePageSource, /setSectionRestoreNonce\(0\)/u);
  assert.doesNotMatch(fullScreenGamePageSource, /document\.querySelector(?:All)?<HTMLElement>/u);
  assert.match(fullScreenAchievementRowSource, /getAchievementCardStyle\(achievement, gamePageGradient\)/);
  assert.match(fullScreenAchievementRowSource, /getAchievementRowMetadataStackStyle\(\)/);
  assert.match(fullScreenAchievementRowSource, /const isSteamProvider = isSteamAchievementPresentationProvider\(achievement\.providerId\)/);
  assert.match(fullScreenAchievementRowSource, /const statusText = formatProviderAchievementStatusText\(achievement\.providerId, achievement\)/);
  assert.match(fullScreenAchievementRowSource, /const pointsText = formatProviderAchievementPointsText\(achievement\.providerId, achievement\.points\)/);
  assert.match(fullScreenAchievementRowSource, /function SteamAchievementRowContent[\s\S]*achievement\.description !== undefined/u);
  assert.match(fullScreenAchievementRowSource, /\{isSteamProvider \? \([\s\S]*<SteamAchievementRowContent/u);
  assert.match(fullScreenAchievementRowSource, /pointsText !== undefined/);
  assert.match(fullScreenAchievementRowSource, /unlockedAt !== undefined/u);
  assert.match(fullScreenAchievementBrowserSource, /gridTemplateColumns: "repeat\(3, minmax\(110px, 150px\)\)"/u);
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
  const steamGameArtworkSource = readFileSync("src/platform/decky/decky-steam-game-artwork.ts", "utf8");
  assert.match(steamGameArtworkSource, /getSteamCompactGameArtworkUrl/);
  assert.match(steamGameArtworkSource, /getSteamFullscreenGameArtworkUrl/);
  assert.match(steamGameArtworkSource, /header\.jpg/);
  assert.match(steamGameArtworkSource, /game\.boxArtImageUrl \?\?/u);
  assert.match(steamFullscreenGameArtworkSource, /function getArtworkFrameStyle\(compact: boolean, dense: boolean\): CSSProperties/u);
  assert.match(steamFullscreenGameArtworkSource, /aspectRatio: compact \? "2 \/ 1" : "460 \/ 215"/u);
  const fullScreenAchievementPageSource = readFileSync(
    "src/platform/decky/decky-full-screen-achievement-page.tsx",
    "utf8",
  );
  const deckyNavigationSource = readFileSync("src/platform/decky/decky-navigation.tsx", "utf8");
  assert.match(fullScreenGamePageSource, /function DeckyFullScreenGameLoadingState/u);
  assert.match(fullScreenGamePageSource, /focusRef\.current\?\.focus\(\{ preventScroll: true \}\)/u);
  assert.match(fullScreenGamePageSource, /<Focusable[\s\S]*onCancel=\{copy\.isError \? onBack : \(\) => \{\}\}[\s\S]*role=\{copy\.isError/u);
  assert.match(fullScreenAchievementPageSource, /function DeckyFullScreenAchievementContent/u);
  assert.match(fullScreenAchievementPageSource, /function DeckyFullScreenAchievementInputSurface/u);
  assert.doesNotMatch(
    fullScreenAchievementPageSource,
    /onCancel=\{handleCancel\}|markDeckyFullscreenReturnRequested/u,
  );
  assert.match(fullScreenAchievementPageSource, /function DeckyFullScreenAchievementLoadingState/u);
  assert.match(fullScreenAchievementPageSource, /calendarIconUrl/u);
  assert.match(fullScreenAchievementPageSource, /checkCircleIconUrl/u);
  assert.match(fullScreenAchievementPageSource, /DeckyRetroAchievementsPointsIcon/u);
  assert.match(fullScreenAchievementPageSource, /usersIconUrl/u);
  assert.match(fullScreenAchievementPageSource, /getSteamHuntersAchievementEnrichment/u);
  assert.match(fullScreenAchievementPageSource, /getSteamFullscreenGameArtworkUrl/u);
  assert.match(fullScreenAchievementPageSource, /hardcoreUnlockedAt/u);
  assert.match(fullScreenAchievementPageSource, /getAchievementDescriptionText/u);
  assert.doesNotMatch(fullScreenAchievementPageSource, /Obtainability/u);
  assert.match(fullScreenAchievementPageSource, /label="Points"[\s\S]*label="RetroPoints"[\s\S]*label="Players Unlocked"/u);
  assert.match(fullScreenAchievementPageSource, /<Focusable/u);
  assert.doesNotMatch(fullScreenAchievementPageSource, /DeckyFullscreenActionButton/u);
  assert.doesNotMatch(fullScreenAchievementPageSource, /onOpenFullScreenGame/u);
  assert.doesNotMatch(fullScreenAchievementPageSource, /backLabel/u);
  assert.doesNotMatch(fullScreenAchievementPageSource, /<ScrollPanel/u);
  assert.match(deckyNavigationSource, /function DeckyFullScreenAchievementRoute/u);
  assert.doesNotMatch(deckyNavigationSource, /onOpenFullScreenGame=/u);
  assert.doesNotMatch(deckyNavigationSource, /navigateToFullScreenGameFromAchievement/u);
  assert.doesNotMatch(deckyNavigationSource, /fullScreenAchievementRouteBackBehaviors/u);
  assert.match(deckyNavigationSource, /navigateToFullScreenAchievement\([\s\S]*params\.providerId!,[\s\S]*achievementGameId,[\s\S]*achievementId,/u);
  const coreDomainSource = readFileSync("src/core/domain.ts", "utf8");
  const retroRawTypesSource = readFileSync("src/providers/retroachievements/raw-types.ts", "utf8");
  const retroClientSource = readFileSync("src/providers/retroachievements/client/client.ts", "utf8");
  const retroProviderSource = readFileSync("src/providers/retroachievements/retroachievements.provider.ts", "utf8");
  const retroNormalizeSource = readFileSync(
    "src/providers/retroachievements/mappers/normalize.ts",
    "utf8",
  );
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
  const deckySystemPillSource = readFileSync("src/platform/decky/decky-system-pill.tsx", "utf8");
  assert.match(dashboardViewSource, /label="Open full-screen"/);
  assert.match(dashboardViewSource, /emphasis="primary"/);
  assert.match(
    dashboardViewSource,
    /label="Open full-screen"[\s\S]*label="Back"[\s\S]*label="Refresh"[\s\S]*label="Settings"/,
  );
  assert.match(dashboardViewSource, /ensureCompactProviderCancelBridgeRegisteredForBackButtonElement/u);
  assert.match(dashboardViewSource, /data-achievement-companion-compact-provider-back/u);
  assert.match(dashboardViewSource, /onOpenProfile\(profile\.providerId\)/);
  assert.match(dashboardViewSource, /addProfileAvatarCacheBustParam\(avatarUrl, refreshedAt\)/u);
  assert.match(coreDomainSource, /readonly systemIconUrl\?: string;/u);
  assert.match(retroNormalizeSource, /readonly systemIconUrl\?: string \| undefined;/u);
  assert.match(retroRawTypesSource, /export interface RawRetroAchievementsSystemResponse/u);
  assert.match(retroRawTypesSource, /export interface RawRetroAchievementsGameListEntry/u);
  assert.match(retroRawTypesSource, /readonly IconURL\?: string;/u);
  assert.match(retroClientSource, /loadSystems\?\(/u);
  assert.match(retroClientSource, /const SYSTEMS_PATH = "API_GetConsoleIDs\.php";/u);
  assert.match(retroClientSource, /path: SYSTEMS_PATH/u);
  assert.match(retroClientSource, /const GAME_LIST_PATH = "API_GetGameList\.php";/u);
  assert.match(retroClientSource, /loadGameList\(/u);
  assert.match(retroClientSource, /i: consoleId/u);
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
  assert.match(achievementHistorySource, /RetroPoints \$\{formatDeckyNumericText\(retroPoints\)\}/u);
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
    /paddingBottom: footerHeight[\s\S]*calc\(env\(safe-area-inset-top, 0px\) \+ \$\{FULLSCREEN_GAME_TOP_PADDING\}px\) 12px 0/u,
  );
  assert.match(completionProgressSource, /FULLSCREEN_COMPLETION_PROGRESS_TOP_PADDING = 42/u);
  assert.match(
    completionProgressSource,
    /calc\(env\(safe-area-inset-top, 0px\) \+ \$\{FULLSCREEN_COMPLETION_PROGRESS_TOP_PADDING\}px\) 12px calc\(env\(safe-area-inset-bottom, 0px\) \+ \$\{FULLSCREEN_COMPLETION_PROGRESS_BOTTOM_SCROLL_PADDING\}px\)/u,
  );
  assert.match(completionProgressSource, /FULLSCREEN_COMPLETION_PROGRESS_BOTTOM_SCROLL_PADDING = 88/u);
  assert.match(
    fullScreenSettingsSource,
    /padding: `calc\(env\(safe-area-inset-top, 0px\) \+ 43px\) 12px \$\{showSteamProfileFooter \|\| reserveSteamProfileFooter \? 50 : 10\}px`/u,
  );
  assert.match(retroProviderSettingsPageSource, /RETROACHIEVEMENTS_PROVIDER_SETTINGS_TOP_PADDING = 42/u);
  assert.match(
    retroProviderSettingsPageSource,
    /calc\(env\(safe-area-inset-top, 0px\) \+ \$\{RETROACHIEVEMENTS_PROVIDER_SETTINGS_TOP_PADDING\}px\) 12px calc\(env\(safe-area-inset-bottom, 0px\) \+ \$\{inProviderSwitcher \? 62 : 12\}px\)/u,
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
    /style\.dataset\["achievementCompanionFullscreenActionStyles"\] = "true"/u,
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
  assert.match(compactBootstrapSource, /useDeckySteamLibraryAchievementScanSummary\(providerId\)/u);
  assert.doesNotMatch(compactBootstrapSource, /useDeckySteamLibraryAchievementScanOverview\(providerId\)/u);
  assert.match(compactBootstrapSource, /createDeckySteamLibraryScanDependencies\(\)/u);
  assert.match(compactBootstrapSource, /runAndCacheDeckySteamLibraryAchievementScan/);
  assert.match(compactBootstrapSource, /Scan full Steam library/u);
  assert.match(compactBootstrapSource, /No full-library scan yet/u);
  assert.match(compactBootstrapSource, /Scanning library… this can take a few minutes/u);
  assert.match(compactDashboardSource, /steamLibraryScanAction\.label/u);
  assert.match(compactDashboardSource, /profile\.providerId === STEAM_PROVIDER_ID && steamLibraryScanAction !== undefined/u);
  assert.doesNotMatch(compactDashboardSource, /Library scan updated \$\{steamLibraryScanUpdatedLabel\}/u);
  assert.doesNotMatch(compactDashboardSource, /useDeckySteamLibraryAchievementScanSummary\(providerId\)/u);
  const steamCompactProfileSource = readFileSync("src/platform/decky/decky-steam-compact-profile.tsx", "utf8");
  const raCompactProfileSource = readFileSync("src/platform/decky/decky-retroachievements-compact-profile.tsx", "utf8");
  assert.match(compactDashboardSource, /<DeckySteamCompactProfile[\s\S]*onOpenProfile=\{\(\) => onOpenProfile\(profile\.providerId\)\}/u);
  assert.match(compactDashboardSource, /<DeckyRetroAchievementsCompactProfile[\s\S]*onOpenProfile=\{\(\) => onOpenProfile\(profile\.providerId\)\}/u);
  assert.match(compactDashboardSource, /isShowingRetroAchievementsCompactSettings\)[\s\S]*<DeckyRetroAchievementsCompactSettings/u);
  assert.match(steamCompactProfileSource, /export function DeckySteamCompactProfile/u);
  assert.doesNotMatch(steamCompactProfileSource, /ariaLabel="Open Steam profile settings"|onOpenSettings/u);
  assert.match(steamCompactProfileSource, /<SectionHeader title="Activity Calendar" \/>[\s\S]*<CompactActivityCalendar/u);
  assert.match(steamCompactProfileSource, /getQamActivityCalendarLegendStyle\(\)/u);
  assert.match(steamCompactProfileSource, /getQamActivityCalendarLegendCellStyle\(level\)/u);
  assert.match(steamCompactProfileSource, /<SectionHeader title="Recent Activity" \/>[\s\S]*<RecentAchievementItem/u);
  assert.match(steamCompactProfileSource, /ariaLabel="View all recent Steam achievements"[\s\S]*onOpenAchievementHistory/u);
  assert.match(steamCompactProfileSource, /<SectionHeader title="Recently Played" \/>[\s\S]*<RecentlyPlayedItem/u);
  assert.match(steamCompactProfileSource, /ariaLabel="View all Steam games"[\s\S]*onOpenCompletionProgress/u);
  assert.match(steamCompactProfileSource, /onActivate=\{\(\) => onOpenAchievementDetail\(recentUnlock\)\}/u);
  assert.match(steamCompactProfileSource, /onActivate=\{\(\) => onOpenGameDetail\(game\)\}/u);
  assert.match(raCompactProfileSource, /export function DeckyRetroAchievementsCompactProfile/u);
  assert.match(raCompactProfileSource, /<CompactAction label="Open Profile Full-Screen"[\s\S]*onActivate=\{onOpenProfile\}/u);
  assert.match(raCompactProfileSource, /<CurrentGameActivity[\s\S]*<Section title="RetroAchievements Overview">/u);
  assert.match(raCompactProfileSource, /<Section title="Activity Calendar">[\s\S]*entryTargetProps=\{targetProps\(\{ kind: "calendar-entry" \}\)\}[\s\S]*targetProps=\{\(day\) => targetProps\(\{ kind: "calendar-day", day \}\)\}/u);
  assert.match(raCompactProfileSource, /<Section title="Recent Activity">[\s\S]*<RecentAchievementRow[\s\S]*onOpenAchievementHistory/u);
  assert.match(raCompactProfileSource, /<Section title="Recently Played">[\s\S]*<RecentlyPlayedRow[\s\S]*onOpenCompletionProgress/u);
  assert.doesNotMatch(raCompactProfileSource, /<CompactAction label="RetroAchievements Settings"|onOpenSettings/u);
  assert.match(raCompactProfileSource, /raRecipes\.compactProfile\.footer/u);
  assert.match(raCompactProfileSource, /refreshText = refreshedAt/u);
  assert.match(compactBootstrapSource, /useDeckyCompactNavigation\(\)/u);
  assert.match(compactBootstrapSource, /setDeckyCompactNavigation\(/u);
  assert.doesNotMatch(compactBootstrapSource, /preserveCompactSelectionAfterFullscreen|preserveCompactSelectionForFullscreen/u);
  assert.doesNotMatch(compactBootstrapSource, /full-screen-return-context|fullscreenReturnContext/u);
  assert.doesNotMatch(compactBootstrapSource, /vgp_oncancel/u);
  assert.doesNotMatch(compactBootstrapSource, /addEventListener\(/u);
  assert.match(compactBootstrapSource, /preferredFocus=\{index === 0\}/u);
  assert.match(compactBootstrapSource, /preferredFocus=\{visibleProviders\.length === 0\}/u);
  assert.doesNotMatch(
    readFileSync("src/platform/decky/decky-full-screen-action-controls.tsx", "utf8"),
    /markDeckyFullscreenReturnRequested|onCancel=\{handleClick\}/u,
  );
  assert.match(
    compactBootstrapSource,
    /function ProviderLauncherCard\(/u,
  );
  assert.match(
    compactBootstrapSource,
    /function getChooserProviderCardStatusDotStyle\(/u,
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
    /statusLabel=\{provider\.connected \? "Configured" : "Set up"\}/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /getChooserProviderCardStatusStyle\(tone\)/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /getChooserProviderCardStatusDotStyle\(tone\)/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /getChooserProviderCardChevronStyle\(tone\)/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /minHeight: 62/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /background: tone === "connected" \? "#4FD17A" : "#F5C542"/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /ariaLabel=\{\s*provider\.connected\s*\? `\$\{provider\.label\} provider, configured`/u,
  );
  assert.doesNotMatch(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /No providers connected|1 provider connected|providers connected|connected dashboard/u,
  );
  assert.match(
    readFileSync("src/platform/decky/bootstrap.tsx", "utf8"),
    /label="Provider Settings"/u,
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
      description: "Filled from the account signed in on this Deck when available. Enter a different SteamID64 only if needed.",
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
      steamId64Description: "Filled from the account signed in on this Deck when available. Enter a different SteamID64 only if needed.",
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

test("compact provider menu uses a session-retained focusable game-page badge settings disclosure", () => {
  const source = readFileSync("src/platform/decky/bootstrap.tsx", "utf8");
  const popupGuardSource = readFileSync("src/platform/decky/decky-compact-dropdown-popup-guard.ts", "utf8");

  assert.match(
    source,
    /const \[gamePageBadgeSettingsExpanded, setGamePageBadgeSettingsExpanded\] = useState\(\s*readDeckyGamePageBadgeSettingsExpanded,\s*\)/u,
  );
  assert.match(source, /writeDeckyGamePageBadgeSettingsExpanded\(nextExpanded\)/u);
  assert.match(popupGuardSource, /function useDeckyCompactDropdownPopupGuard\(\)/u);
  assert.match(popupGuardSource, /releasePopupRef\.current = beginDeckyCompactPopup\(\)/u);
  assert.match(source, /onMenuWillOpen=\{openGuardedMenu\}/u);
  assert.match(source, /<GamePageBadgeSettingsDisclosure[\s\S]*expanded=\{gamePageBadgeSettingsExpanded\}/u);
  assert.match(source, /aria-expanded=\{expanded\}/u);
  assert.match(source, /aria-label=\{`Game Page Badge settings, \$\{expanded \? "expanded" : "collapsed"\}`\}/u);
  assert.match(source, /transform: expanded \? "rotate\(-90deg\)" : "rotate\(90deg\)"/u);
  assert.match(
    source,
    /function getGamePageBadgeLabelStyle\(disabled = false\)[\s\S]*steamTheme\.color\.textPrimary/u,
  );
  assert.match(source, /gamePageBadgeSettingsExpanded \? \([\s\S]*Show game page badge/u);
  assert.match(
    source,
    /Show game page badge[\s\S]*<GamePageBadgeSizeDropdown[\s\S]*<GamePageBadgePositionDropdown/u,
  );
  assert.match(source, /GAME_PAGE_ACHIEVEMENT_BADGE_SIZE_DROPDOWN_OPTIONS/u);
  assert.match(source, /selectedSize=\{settings\.gamePageAchievementBadgeSize\}/u);
  assert.match(source, /<GamePageBadgeSizeDropdown[\s\S]*disabled=\{!settings\.showGamePageAchievementBadge\}/u);
  assert.match(source, /GAME_PAGE_ACHIEVEMENT_BADGE_COLOR_DROPDOWN_OPTIONS/u);
  assert.match(source, /label="Perfected color"/u);
  assert.match(source, /label="Mastered color"/u);
  assert.match(source, /label="Beaten color"/u);
  assert.match(source, /label="In Progress color"/u);
  assert.match(source, /saveGamePageAchievementBadgeColor/u);
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
    /import \{[^}]*\bFocusable\b[^}]*\btype FocusableProps\b[^}]*\} from "@decky\/ui"/u,
  );
  assert.doesNotMatch(fullscreenActionControlsSource, /\bButton\b|\bButtonItem\b|\bDialogButton\b/);
  assert.match(fullscreenActionControlsSource, /flow-children="left-right"/);
  assert.match(
    fullscreenActionControlsSource,
    /flow-children="left-right"[\s\S]*noFocusRing[\s\S]*tabIndex=\{-1\}/u,
  );
  assert.match(fullscreenActionControlsSource, /focusClassName=.*DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS/u);
  assert.match(
    fullscreenActionControlsSource,
    /focusWithinClassName=.*DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS/u,
  );
  assert.match(
    fullscreenActionControlsSource,
    /role="button"[\s\S]*onActivate=\{handleClick\}[\s\S]*onClick=\{handleClick\}/u,
  );
  assert.doesNotMatch(fullscreenActionControlsSource, /onCancel=|onCancel:/u);
  assert.match(fullscreenActionControlsSource, /<span style=\{\{ whiteSpace: "nowrap" \}\}>\{label\}<\/span>/);
  assert.doesNotMatch(getDeckyFullscreenActionStylesCss(), /DialogButton|ButtonItem/);
  assert.match(getDeckyFullscreenActionStylesCss(), /border-radius:\s*999px\s*!important/);
  assert.match(getDeckyFullscreenActionStylesCss(), /background:\s*linear-gradient/);
  assert.match(getDeckyFullscreenActionStylesCss(), /0 0 18px rgba\(39, 124, 226, 0\.35\)/);
  assert.match(getDeckyFullscreenActionStylesCss(), /min-width:\s*max-content\s*!important/);
  assert.match(getDeckyFullscreenActionStylesCss(), /white-space:\s*nowrap\s*!important/);
  assert.doesNotMatch(getDeckyFullscreenActionStylesCss(), /text-overflow:\s*ellipsis/);
  assert.doesNotMatch(fullscreenCancelBridgeSource, /fullscreen-back|handleFullscreenCancelBridge/u);
  assert.match(
    fullscreenCancelBridgeSource,
    /\[data-achievement-companion-compact-achievement-back="true"\]\[role="button"\]/,
  );
  assert.match(
    fullscreenCancelBridgeSource,
    /\[data-achievement-companion-compact-provider-back="true"\]\[role="button"\]/,
  );
  assert.match(fullscreenCancelBridgeSource, /handleCompactAchievementCancelBridge/u);
  assert.match(fullscreenCancelBridgeSource, /handleCompactProviderCancelBridge/u);
  assert.match(
    fullscreenCancelBridgeSource,
    /ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement/u,
  );
  assert.match(
    fullscreenCancelBridgeSource,
    /ensureCompactProviderCancelBridgeRegisteredForBackButtonElement/u,
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
  assert.match(fullscreenActionControlsSource, /readonly scrollToTopOnFocus\?: boolean \| undefined;/u);
  assert.match(fullscreenActionControlsSource, /shouldScrollToTopOnFocus = isFullscreenBackAction \|\| scrollToTopOnFocus/u);
  assert.match(
    fullscreenProfileSource,
    /label="Completion Progress"\s+scrollToTopOnFocus[\s\S]*label="Achievement History"\s+scrollToTopOnFocus[\s\S]*label="Settings"\s+scrollToTopOnFocus/u,
  );
  assert.match(fullscreenProfileSource, /onGamepadFocus=\{scrollFocusedProfileGamepadContent\}/u);
  assert.match(fullscreenProfileSource, /scrollFocusedProfileGamepadContent[\s\S]*scrollDeckyFocusTargetIntoView/u);
  assert.match(fullscreenSettingsSource, /DeckyFullScreenFooterOverlay[\s\S]*activeNavigationItemId="settings"/u);
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

test("legacy provider forms retain their immediate-persistence controls outside the new full-screen dropdowns", () => {
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
    /import \{[^}]*PanelSection, PanelSectionRow, ScrollPanel[^}]*\} from "@decky\/ui"/u,
  );
  assert.doesNotMatch(retroAchievementsProviderSettingsSource, /label="Show subsets"/u);
  assert.match(
    retroAchievementsProviderSettingsSource,
    /import \{ DeckyProviderSettingsActionRow \} from "\.\.\/\.\.\/decky-provider-settings-action-row"/u,
  );
  assert.match(
    retroAchievementsProviderSettingsSource,
    /<DeckyProviderSettingsActionRow[\s\S]*label="Recent Achievements count"[\s\S]*getNextCountOption\(providerRecentAchievementsCount\)[\s\S]*persistProviderCounts\(\{ recentAchievementsCount \}\)/u,
  );
  assert.match(
    retroAchievementsProviderSettingsSource,
    /<DeckyProviderSettingsActionRow[\s\S]*label="Recently Played count"[\s\S]*getNextCountOption\(providerRecentlyPlayedCount\)[\s\S]*persistProviderCounts\(\{ recentlyPlayedCount \}\)/u,
  );
  assert.doesNotMatch(retroAchievementsProviderSettingsSource, /label="Default Completion Progress filter"/u);
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
    /<DeckyProviderSettingsActionRow[\s\S]*label="Recent Achievements count"[\s\S]*<DeckyProviderSettingsActionRow[\s\S]*label="Recently Played count"/u,
  );
  assert.doesNotMatch(steamCredentialsFormSource, /Include played free games/u);
  assert.doesNotMatch(steamCredentialsFormSource, /DropdownItem|\bDropdown\b/);
  assert.match(fullscreenActionControlsSource, /import \{[^}]*\bFocusable\b[^}]*\btype FocusableProps\b[^}]*\} from "@decky\/ui"/u);
  assert.doesNotMatch(
    `${retroAchievementsProviderSettingsSource}\n${steamCredentialsFormSource}`,
    /localStorage|sessionStorage/,
  );
});

test("provider setup and current settings actions use focusable controls", () => {
  const fullscreenSettingsSource = readFileSync(
    "src/platform/decky/decky-full-screen-settings-page.tsx",
    "utf8",
  );
  const fullscreenAboutSource = readFileSync(
    "src/platform/decky/decky-full-screen-about-page.tsx",
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
  assert.match(fullscreenActionControlsSource, /import \{[^}]*\bFocusable\b[^}]*\btype FocusableProps\b[^}]*\} from "@decky\/ui"/u);
  assert.doesNotMatch(fullscreenSettingsSource, /<SteamSettingsSectionPill title="Updates"/u);
  assert.match(fullscreenAboutSource, /<DeckyUpdateSettingsPanel onGamepadDirection=\{handleCardDirection\} \/>/u);
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
    /function getFocusedPillStyle\(selected: boolean\)[\s\S]*focusedSelectedContentStat[\s\S]*focusedContentStat[\s\S]*qamTheme\.focus\.shadow/u,
  );

  assert.match(
    retroAchievementsCredentialsSource,
    /<DeckyCredentialTextField[\s\S]*bIsPassword=\{apiKeyInputDescriptor\.bIsPassword\}[\s\S]*style=\{\{\s*\.\.\.getCredentialInputStyle\(\),\s*\.\.\.getDeckyCredentialTextFieldMaskStyle\(\)\s*\}\}/u,
  );
  assert.match(
    steamCredentialsSource,
    /<DeckyCredentialTextField[\s\S]*style=\{getDeckyCredentialTextFieldMaskStyle\(\)\}/u,
  );
  assert.doesNotMatch(retroAchievementsProviderSettingsSource, /DropdownItem|\bDropdown\b/);
  assert.match(
    retroAchievementsProviderSettingsSource,
    /<DeckyProviderSettingsActionRow[\s\S]*label="Recent Achievements count"[\s\S]*label="Recently Played count"/u,
  );
  assert.doesNotMatch(retroAchievementsProviderSettingsSource, /DeckyActionButtonItem|ButtonItem/);
  assert.doesNotMatch(retroAchievementsProviderSettingsSource, /<ToggleField[\s\S]*label="Show subsets"/u);

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

test("canonical version metadata and Decky cleanup stay aligned", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    version?: string;
    scripts?: Record<string, string>;
  };
  const pluginJson = JSON.parse(readFileSync("plugin.json", "utf8")) as { version?: string };
  const readmeSource = readFileSync("README.md", "utf8");
  const bootstrapSource = readFileSync("src/platform/decky/bootstrap.tsx", "utf8");
  const runtimeDebugSource = readFileSync("src/platform/decky/decky-runtime-debug.ts", "utf8");
  const generatedVersionSource = readFileSync("src/generated/version.ts", "utf8");
  const versionPropertiesSource = readFileSync("version.properties", "utf8");
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

  const canonicalVersion = versionPropertiesSource.match(/^version=(.+)$/mu)?.[1];
  assert.equal(typeof canonicalVersion, "string");
  assert.equal(packageJson.version, canonicalVersion);
  assert.equal(pluginJson.version, canonicalVersion);
  assert.match(readmeSource, /github\.com\/parvagans\/achievement-companion\/releases\/latest/u);
  assert.match(generatedVersionSource, new RegExp(`APP_VERSION = "${canonicalVersion}"`, "u"));
  assert.match(runtimeDebugSource, /`\$\{APP_VERSION\}-runtime`/u);
  assert.doesNotMatch(bootstrapSource, /DIAGNOSTIC BUILD LOADED 2026-06-28/u);
  assert.doesNotMatch(
    `${bootstrapSource}\n${runtimeDebugSource}\n${JSON.stringify(packageJson)}\n${JSON.stringify(pluginJson)}`,
    /0\.2\.9|v0\.2\.9|0\.2\.8|v0\.2\.8|0\.2\.10|v0\.2\.10/u,
  );
  assert.match(releasePackageScriptSource, /achievement-companion-v\{version\}\.zip/u);
  assert.match(releaseCheckScriptSource, /achievement-companion-v\{version\}\.zip/u);
  assert.match(releasePackageScriptSource, /INSTALL_DIAGNOSTIC\.txt/u);
  assert.match(releasePackageScriptSource, /AchievementCompanionGamePageBadge/u);
  assert.match(releasePackageScriptSource, /\/routes\/library\/app/u);
  assert.match(releasePackageScriptSource, /formatDeckyGamePageAchievementBadgeLabel/u);
  assert.match(releasePackageScriptSource, /ra-hash-game-detail/u);
  assert.match(releasePackageScriptSource, /hash-not-in-ra-catalogue/u);
  assert.match(releasePackageScriptSource, /API_GetGameList\.php/u);
  assert.match(releasePackageScriptSource, /retroachievements/u);
  assert.match(releasePackageScriptSource, /createRoot/u);
  assert.match(releasePackageScriptSource, /react-dom\/client/u);
  assert.match(releasePackageScriptSource, /\.protondb-decky-indicator-container/u);
  assert.match(releasePackageScriptSource, /py_modules\/backend\/steam_shortcuts\.py/u);
  assert.match(releaseCheckScriptSource, /INSTALL_DIAGNOSTIC\.txt/u);
  assert.match(releaseCheckScriptSource, /AchievementCompanionGamePageBadge/u);
  assert.match(releaseCheckScriptSource, /py_modules\/backend\/steam_shortcuts\.py/u);
  assert.match(releaseCheckScriptSource, /FORBIDDEN_FRONTEND_MARKERS/u);
  assert.match(releaseCheckScriptSource, /verify_release_dist_bundles/u);
  assert.match(packageJson.scripts?.build ?? "", /^node scripts\/version\/check-version\.mjs --allow-decky-package-suffix &&/u);
  assert.doesNotMatch(packageJson.scripts?.build ?? "", /python|clean_decky_dist\.py/iu);
  assert.match(packageJson.scripts?.build ?? "", /clean_decky_dist\.mjs/u);
  assert.match(packageJson.scripts?.build ?? "", /sync_decky_notices\.mjs/u);
  assert.match(packageJson.scripts?.build ?? "", /rollup -c/u);
  assert.equal(packageJson.packageManager, "pnpm@9.4.0");
  assert.equal(existsSync("scripts/clean_decky_dist.py"), false);
  assert.equal(existsSync("scripts/clean_decky_dist.mjs"), true);
  assert.equal(existsSync("scripts/sync_decky_notices.mjs"), true);
  assert.match(releasePackageScriptSource, /Path\("THIRD_PARTY_NOTICES\.md"\)/u);
  assert.doesNotMatch(releasePackageScriptSource, /defaults\/THIRD_PARTY_NOTICES\.md/u);

  for (const deckySource of [
    bootstrapSource,
    compactPillSource,
    fullScreenActionControlsSource,
    completionSummaryCardsSource,
    providerSettingsActionRowSource,
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

test("decky dist cleanup removes nested output and tolerates a missing directory", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "achievement-companion-decky-clean-"));
  const cleanupScriptPath = resolve("scripts/clean_decky_dist.mjs");

  try {
    const nestedDistPath = join(tempRoot, "dist", "nested");
    mkdirSync(nestedDistPath, { recursive: true });
    writeFileSync(join(nestedDistPath, "bundle.js"), "stale bundle\n", "utf8");

    const firstRun = spawnSync(process.execPath, [cleanupScriptPath], {
      cwd: tempRoot,
      encoding: "utf8",
    });
    assert.equal(firstRun.status, 0, firstRun.stderr);
    assert.equal(existsSync(join(tempRoot, "dist")), false);

    const secondRun = spawnSync(process.execPath, [cleanupScriptPath], {
      cwd: tempRoot,
      encoding: "utf8",
    });
    assert.equal(secondRun.status, 0, secondRun.stderr);
    assert.equal(existsSync(join(tempRoot, "dist")), false);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Decky notice sync copies the canonical notice byte-for-byte and fails when it is missing", () => {
  const syncScriptPath = resolve("scripts/sync_decky_notices.mjs");
  const tempRoot = mkdtempSync(join(tmpdir(), "achievement-companion-decky-notices-"));
  const missingRoot = mkdtempSync(join(tmpdir(), "achievement-companion-decky-notices-missing-"));

  try {
    const canonicalNotice = Buffer.from("Canonical notice with UTF-8: Caf\u00e9\n", "utf8");
    writeFileSync(join(tempRoot, "THIRD_PARTY_NOTICES.md"), canonicalNotice);

    const syncRun = spawnSync(process.execPath, [syncScriptPath], {
      cwd: tempRoot,
      encoding: "utf8",
    });
    assert.equal(syncRun.status, 0, syncRun.stderr);
    assert.deepEqual(
      readFileSync(join(tempRoot, "defaults", "THIRD_PARTY_NOTICES.md")),
      canonicalNotice,
    );

    const missingRun = spawnSync(process.execPath, [syncScriptPath], {
      cwd: missingRoot,
      encoding: "utf8",
    });
    assert.notEqual(missingRun.status, 0);
    assert.match(missingRun.stderr, /Canonical THIRD_PARTY_NOTICES\.md is missing or unreadable/u);
    assert.equal(existsSync(join(missingRoot, "defaults", "THIRD_PARTY_NOTICES.md")), false);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    rmSync(missingRoot, { recursive: true, force: true });
  }
});

test("Decky third-party notices preserve the bundled API license and generated-file boundary", () => {
  const noticeSource = readFileSync("THIRD_PARTY_NOTICES.md", "utf8");
  const ignoreLines = readFileSync(".gitignore", "utf8").split(/\r?\n/u);
  const licenseStart = "                   GNU LESSER GENERAL PUBLIC LICENSE";

  assert.equal(ignoreLines.filter((line) => line === "defaults/THIRD_PARTY_NOTICES.md").length, 1);
  assert.equal(ignoreLines.includes("defaults/"), false);
  assert.doesNotMatch(noticeSource, /\uFFFD/u);
  assert.match(noticeSource, /`@decky\/api` \| `1\.1\.3`/u);
  assert.match(noticeSource, /GNU Lesser General Public License v2\.1 \(`LGPL-2\.1`\)/u);
  assert.match(noticeSource, /SteamDeckHomebrew\/loader-api\/tree\/v1\.1\.3/u);
  assert.match(noticeSource, /Steam and the Steam logo are trademarks/u);
  assert.match(noticeSource, new RegExp(licenseStart, "u"));
  assert.match(noticeSource, /That's all there is to it!\r?\n```/u);

  const embeddedLicense = `${noticeSource.split(/```text\r?\n/u, 2)[1]?.split(/\r?\n```/u, 1)[0] ?? ""}\n`;
  const normalizeLineEndings = (value: string): string => value.replace(/\r\n/gu, "\n");
  assert.equal(
    normalizeLineEndings(embeddedLicense),
    normalizeLineEndings(readFileSync("node_modules/@decky/api/LICENSE", "utf8")),
  );
});

test("Decky publish image uses a current repository PNG asset", () => {
  const pluginJson = JSON.parse(readFileSync("plugin.json", "utf8")) as {
    publish?: { image?: string };
  };
  const imageUrl = new URL(pluginJson.publish?.image ?? "https://invalid.example/");
  const repositoryPrefix = "/parvagans/achievement-companion/main/";
  assert.equal(imageUrl.origin, "https://raw.githubusercontent.com");
  assert.equal(imageUrl.pathname.startsWith(repositoryPrefix), true);
  assert.match(imageUrl.pathname, /\.png$/u);
  assert.doesNotMatch(pluginJson.publish?.image ?? "", /CodeNode-Automation/u);
  const imagePath = imageUrl.pathname.slice(repositoryPrefix.length);
  assert.equal(existsSync(imagePath), true);

  const pngSignature = readFileSync(imagePath).subarray(0, 8);
  assert.deepEqual([...pngSignature], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
});

test("RetroAchievements profile summary is optional and bounded by a configurable wait", async () => {
  const summary = { Rank: 12, CasualRank: 34 };
  assert.equal(await loadOptionalRetroAchievementsProfileSummary(undefined, 1), undefined);
  assert.equal(await loadOptionalRetroAchievementsProfileSummary(async () => summary, 20), summary);
  assert.equal(await loadOptionalRetroAchievementsProfileSummary(async () => {
    throw new Error("optional summary unavailable");
  }, 20), undefined);
  assert.equal(await loadOptionalRetroAchievementsProfileSummary(() => new Promise(() => undefined), 2), undefined);
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

test("retroachievements full-screen profile uses a compact stats grid and provider-scoped overview cards", () => {
  const source = readFileSync("src/platform/decky/decky-full-screen-profile-page.tsx", "utf8");

  assert.match(
    source,
    /function getCompactStatsOverviewStyle\(\): CSSProperties \{[\s\S]*gridTemplateColumns: "repeat\(2, minmax\(0, 1fr\)\)"/u,
  );
  assert.match(
    source,
    /function getAwardsProgressGridStyle\(\): CSSProperties \{[\s\S]*alignItems: "stretch"/u,
  );
  assert.match(
    source,
    /function getOverviewCardStyle\(\): CSSProperties \{[\s\S]*height: "100%"/u,
  );
  assert.match(source, /data-retroachievements-profile-stats-overview/u);
  assert.match(source, /retroAchievementsSupplementaryStats\.map/u);
  assert.match(source, /data-retroachievements-profile-game-awards/u);
  assert.match(source, /data-retroachievements-profile-completion-progress/u);
  assert.doesNotMatch(source, /completionStats=\{retroAchievementsCompletionStats\}/u);
  assert.doesNotMatch(source, /function getAwardSummaryStyle/u);
  assert.match(source, /loadDeckyCompletionProgressStateForFullScreenEntry\(providerId\)/u);
  assert.match(source, /completionProgressState\.data\.games/u);
  assert.doesNotMatch(
    source,
    /selectRetroAchievements(?:GameAward|CompletionProgress)Games\(snapshot\.featuredGames\)/u,
  );
  assert.match(source, /DeckyCompletionProgressBar compact percent=\{completionPercent\}/u);
  assert.match(source, /Loading full completion records\.\.\./u);
  assert.match(source, /Full completion records are unavailable right now\./u);
  assert.match(source, /No completed game records are available\./u);
  assert.match(source, />\s*Beaten Games\s*</u);
  assert.match(source, /No unfinished games are available in this snapshot\./u);
  assert.match(source, /if \(steamProfileSummary !== undefined\) \{[\s\S]*<SteamFullScreenProfileDashboard/u);
  assert.match(source, /<PanelSection title="Awards & Progress">/u);
  assert.match(source, /return buildSteamFullScreenProfileSummary\(\{/u);
  assert.match(
    source,
    /DeckyFullscreenActionRow centered[\s\S]*label="Back"[\s\S]*label="Completion Progress"[\s\S]*label="Achievement History"[\s\S]*label="Settings"/u,
  );
});

test("retroachievements supplementary profile stats render only meaningful loaded values", () => {
  const profile = normalizeRetroAchievementsProfile(
    {
      User: "Retro User",
      ULID: "abc123",
      MemberSince: "2020-01-02 00:00:00",
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
  const completionGame: NormalizedGame = {
    providerId: RETROACHIEVEMENTS_PROVIDER_ID,
    gameId: "1",
    title: "Active Game",
    status: "in_progress",
    summary: {
      unlockedCount: 2,
      totalCount: 10,
      completionPercent: 20,
    },
    metrics: [],
    lastUnlockAt: Date.now() - 60_000,
  };

  const populated = getRetroAchievementsSupplementaryProfileStats({
    profile,
    recentlyPlayedGames: [],
    completionGames: [completionGame],
  });
  assert.deepStrictEqual(populated.map((stat) => stat.label), ["Achievement completion", "Last activity"]);
  assert.equal(populated[0]?.value, "60%");
  assert.notEqual(populated[1]?.value, undefined);

  const empty = getRetroAchievementsSupplementaryProfileStats({
    profile: {
      ...profile,
      summary: {
        unlockedCount: 0,
      },
    },
    recentlyPlayedGames: [],
    completionGames: [],
  });
  assert.deepStrictEqual(empty, []);
});

test("retroachievements profile game awards prefer authoritative mastered records and cap at three", () => {
  const createAwardGame = (
    gameId: string,
    title: string,
    highestAwardKind: string,
  ): NormalizedGame => ({
    providerId: RETROACHIEVEMENTS_PROVIDER_ID,
    gameId,
    title,
    platformLabel: "NES/Famicom",
    status: highestAwardKind.includes("beaten") ? "beaten" : "mastered",
    summary: {
      unlockedCount: 5,
      totalCount: 5,
      completionPercent: 100,
    },
    metrics: [
      {
        key: "highest-award-kind",
        label: "Highest Award",
        value: highestAwardKind,
      },
    ],
  });
  const games = [
    createAwardGame("1", "Beaten First", "beaten-hardcore"),
    createAwardGame("2", "Mastered First", "mastered"),
    createAwardGame("3", "Beaten Second", "beaten"),
    createAwardGame("4", "Mastered Second", "completed"),
    createAwardGame("5", "Mastered Third", "mastered-hardcore"),
    createAwardGame("6", "Mastered Fourth", "completed-softcore"),
  ];

  const selection = selectRetroAchievementsGameAwards(games);
  assert.equal(selection.mode, "mastered");
  assert.equal(selection.subtitle, "4 mastered awards");
  assert.deepStrictEqual(
    selection.games.map((game) => game.title),
    ["Mastered First", "Mastered Second", "Mastered Third"],
  );
});

test("retroachievements profile game awards fall back to clearly labeled beaten games", () => {
  const createBeatenGame = (gameId: string): NormalizedGame => ({
    providerId: RETROACHIEVEMENTS_PROVIDER_ID,
    gameId,
    title: `Beaten ${gameId}`,
    status: "beaten",
    summary: { unlockedCount: 8, totalCount: 10, completionPercent: 80 },
    metrics: [
      { key: "highest-award-kind", label: "Highest Award", value: "beaten-hardcore" },
    ],
  });
  const selection = selectRetroAchievementsGameAwards([
    createBeatenGame("1"),
    createBeatenGame("2"),
    createBeatenGame("3"),
    createBeatenGame("4"),
  ]);

  assert.equal(selection.mode, "beaten");
  assert.equal(selection.subtitle, "No mastered awards yet");
  assert.equal(selection.games.length, 3);
  assert.equal(
    selection.games.every((game) => getRetroAchievementsProfileAwardStatus(game) === "beaten"),
    true,
  );
});

test("retroachievements profile game awards expose a compact empty state", () => {
  assert.deepStrictEqual(selectRetroAchievementsGameAwards([]), {
    mode: "empty",
    games: [],
    subtitle: "No awards yet",
  });
});

test("retroachievements profile awards can use mastered records absent from the partial dashboard snapshot", () => {
  const beatenGame: NormalizedGame = {
    providerId: RETROACHIEVEMENTS_PROVIDER_ID,
    gameId: "partial-beaten",
    title: "Partial Beaten",
    status: "beaten",
    summary: { unlockedCount: 8, totalCount: 10, completionPercent: 80 },
    metrics: [
      { key: "highest-award-kind", label: "Highest Award", value: "beaten-hardcore" },
    ],
  };
  const masteredGame: NormalizedGame = {
    providerId: RETROACHIEVEMENTS_PROVIDER_ID,
    gameId: "full-mastered",
    title: "Full Mastered",
    status: "mastered",
    summary: { unlockedCount: 20, totalCount: 20, completionPercent: 100 },
    metrics: [
      { key: "highest-award-kind", label: "Highest Award", value: "mastered" },
    ],
  };

  assert.equal(selectRetroAchievementsGameAwards([beatenGame]).mode, "beaten");
  const fullSelection = selectRetroAchievementsGameAwards([beatenGame, masteredGame]);
  assert.equal(fullSelection.mode, "mastered");
  assert.equal(fullSelection.subtitle, "1 mastered award");
  assert.deepStrictEqual(fullSelection.games.map((game) => game.gameId), ["full-mastered"]);
});

test("retroachievements profile completion preview ranks incomplete games closest to mastery", () => {
  const createProgressGame = (
    gameId: string,
    title: string,
    unlockedCount: number,
    totalCount: number,
    highestAwardKind?: string,
    status: NormalizedGame["status"] = highestAwardKind === undefined ? "in_progress" : "mastered",
  ): NormalizedGame => ({
    providerId: RETROACHIEVEMENTS_PROVIDER_ID,
    gameId,
    title,
    platformLabel: "SNES/Super Famicom",
    status,
    summary: {
      unlockedCount,
      totalCount,
      completionPercent: Math.round((unlockedCount / totalCount) * 100),
    },
    metrics:
      highestAwardKind === undefined
        ? []
        : [
            {
              key: "highest-award-kind",
              label: "Highest Award",
              value: highestAwardKind,
            },
          ],
  });
  const games = [
    createProgressGame("1", "Lower Progress", 3, 10),
    createProgressGame("2", "Mastered Award", 8, 10, "mastered"),
    createProgressGame("3", "Beaten Progress", 47, 70, "beaten-hardcore", "beaten"),
    createProgressGame("4", "Highest Progress", 20, 25),
    createProgressGame("5", "Equal Ratio Lower Earned", 8, 20),
    createProgressGame("6", "Equal Ratio Higher Earned First", 16, 40),
    createProgressGame("7", "Equal Ratio Higher Earned Second", 16, 40),
    createProgressGame("8", "Complete Without Award", 10, 10, undefined, "completed"),
    createProgressGame("9", "No Total", 2, 0),
    createProgressGame("10", "Completed Status Below 100", 9, 10, undefined, "completed"),
  ];

  const selected = selectRetroAchievementsCompletionProgressGames(games, 6);
  assert.deepStrictEqual(
    selected.map((game) => game.title),
    [
      "Highest Progress",
      "Beaten Progress",
      "Equal Ratio Higher Earned First",
      "Equal Ratio Higher Earned Second",
      "Equal Ratio Lower Earned",
      "Lower Progress",
    ],
  );
  assert.equal(selected.some((game) => game.title === "Mastered Award"), false);
  assert.equal(selected.some((game) => game.title === "Complete Without Award"), false);
  assert.equal(selected.some((game) => game.title === "Completed Status Below 100"), false);
  assert.equal(selected.some((game) => game.title === "Beaten Progress"), true);
  assert.deepStrictEqual(
    selectRetroAchievementsCompletionProgressGames(games).map((game) => game.title),
    ["Highest Progress", "Beaten Progress", "Equal Ratio Higher Earned First"],
  );
});

test("retroachievements profile section helpers apply distinct softcore and hardcore tints", () => {
  const softcoreStyle = getRetroAchievementsProfileSectionStyle("softcore");
  const hardcoreStyle = getRetroAchievementsProfileSectionStyle("hardcore");
  const defaultStyle = getRetroAchievementsProfileSectionStyle("default");
  const retroAchievementsStyle = getRetroAchievementsProfileSectionStyle("retroachievements");
  const completionStyle = getRetroAchievementsProfileSectionStyle("completion");

  assert.equal(softcoreStyle.border, `1px solid ${raTheme.color.borderSubtle}`);
  assert.equal(softcoreStyle.borderLeft, `4px solid ${raTheme.color.softcore}`);
  assert.equal(softcoreStyle.background, `linear-gradient(180deg, ${raTheme.surface.softcore}, ${raTheme.surface.softcore}), ${raTheme.surface.contentCard}`);
  assert.equal(hardcoreStyle.border, `1px solid ${raTheme.color.borderSubtle}`);
  assert.equal(hardcoreStyle.borderLeft, `4px solid ${raTheme.color.hardcore}`);
  assert.equal(hardcoreStyle.background, `linear-gradient(180deg, ${raTheme.surface.hardcore}, ${raTheme.surface.hardcore}), ${raTheme.surface.contentCard}`);
  assert.notEqual(softcoreStyle.borderLeft, hardcoreStyle.borderLeft);
  assert.notEqual(softcoreStyle.background, hardcoreStyle.background);
  assert.equal(retroAchievementsStyle.borderLeft, `4px solid ${raTheme.color.accent}`);
  assert.equal(retroAchievementsStyle.background, `linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0)), ${raTheme.surface.contentCard}`);
  assert.equal(completionStyle.borderLeft, `4px solid ${raTheme.color.accent}`);
  assert.equal(completionStyle.background, retroAchievementsStyle.background);
  assert.equal(defaultStyle.borderLeft, `4px solid ${raTheme.color.borderSubtle}`);
  assert.equal(defaultStyle.background, retroAchievementsStyle.background);
  assert.equal(defaultStyle.boxShadow, undefined);

  const softcoreTitleStyle = getRetroAchievementsProfileSectionTitleStyle("softcore");
  const hardcoreTitleStyle = getRetroAchievementsProfileSectionTitleStyle("hardcore");
  const retroAchievementsTitleStyle = getRetroAchievementsProfileSectionTitleStyle("retroachievements");
  const completionTitleStyle = getRetroAchievementsProfileSectionTitleStyle("completion");
  const defaultTitleStyle = getRetroAchievementsProfileSectionTitleStyle("default");

  assert.equal(softcoreTitleStyle.color, raTheme.color.softcore);
  assert.equal(hardcoreTitleStyle.color, raTheme.color.hardcore);
  assert.equal(retroAchievementsTitleStyle.color, raTheme.color.accent);
  assert.equal(completionTitleStyle.color, raTheme.color.accent);
  assert.equal(defaultTitleStyle.color, raTheme.color.textMuted);
});

test("retroachievements full-screen profile section accents mirror the grouped mode language", () => {
  const softcoreAccent = getRetroAchievementsProfileSectionAccentStyle("softcore");
  const hardcoreAccent = getRetroAchievementsProfileSectionAccentStyle("hardcore");
  const retroAchievementsAccent = getRetroAchievementsProfileSectionAccentStyle("retroachievements");
  const completionAccent = getRetroAchievementsProfileSectionAccentStyle("completion");
  const defaultAccent = getRetroAchievementsProfileSectionAccentStyle("default");

  assert.equal(softcoreAccent.position, "absolute");
  assert.equal(softcoreAccent.width, 4);
  assert.equal(softcoreAccent.background, `linear-gradient(180deg, ${raTheme.color.softcore}, transparent)`);
  assert.equal(hardcoreAccent.position, "absolute");
  assert.equal(hardcoreAccent.width, 4);
  assert.equal(hardcoreAccent.background, `linear-gradient(180deg, ${raTheme.color.hardcore}, transparent)`);
  assert.equal(retroAchievementsAccent.position, "absolute");
  assert.equal(retroAchievementsAccent.width, 4);
  assert.equal(
    retroAchievementsAccent.background,
    `linear-gradient(180deg, ${raTheme.color.accent}, transparent)`,
  );
  assert.equal(completionAccent.position, "absolute");
  assert.equal(completionAccent.width, 4);
  assert.equal(
    completionAccent.background,
    `linear-gradient(180deg, ${raTheme.color.accent}, transparent)`,
  );
  assert.equal(defaultAccent.position, "absolute");
  assert.equal(defaultAccent.width, 4);
  assert.equal(defaultAccent.background, `linear-gradient(180deg, ${raTheme.color.borderSubtle}, transparent)`);
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
      [`Points:${(4321).toLocaleString()}`, "Unlocked:-"],
      [`Points:${(1234).toLocaleString()}`, "Unlocked:-"],
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

  assert.equal(getRetroAchievementsCompletionIndicatorStyle("beaten-hardcore").backgroundColor, raTheme.color.beaten);
  assert.equal(getRetroAchievementsCompletionIndicatorStyle("mastered-hardcore").backgroundColor, raTheme.color.mastered);
  assert.equal(getRetroAchievementsCompletionIndicatorStyle("beaten-softcore").backgroundColor, "transparent");
  assert.equal(getRetroAchievementsCompletionIndicatorStyle("mastered-softcore").backgroundColor, "transparent");

  const fullScreenCompletionProgressSource = readFileSync(
    "src/platform/decky/decky-full-screen-completion-progress-page.tsx",
    "utf8",
  );
  const compactDashboardSource = readFileSync("src/platform/decky/decky-dashboard-view.tsx", "utf8");
  const gameDetailSource = readFileSync("src/platform/decky/decky-game-detail-view.tsx", "utf8");
  const fullScreenGameSource = readFileSync("src/platform/decky/decky-full-screen-game-page.tsx", "utf8");
  const retroAchievementsProgressSummarySource = readFileSync(
    "src/platform/decky/decky-retroachievements-progress-summary.tsx",
    "utf8",
  );

  assert.match(fullScreenCompletionProgressSource, /RetroAchievementsCompletionIndicator game=\{game\}/u);
  const retroAchievementsGameOverviewSource = readFileSync(
    "src/platform/decky/decky-retroachievements-game-overview.tsx",
    "utf8",
  );
  assert.match(fullScreenGameSource, /DeckyRetroAchievementsGameOverview/u);
  assert.match(retroAchievementsGameOverviewSource, /DeckyFullScreenGameOverviewLayout/u);
  assert.match(retroAchievementsGameOverviewSource, /DeckyRetroAchievementsProgressSummary/u);
  assert.match(retroAchievementsProgressSummarySource, /tone=\{completionTone\}/u);
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
  const retroAchievementsProgressSummarySource = readFileSync(
    "src/platform/decky/decky-retroachievements-progress-summary.tsx",
    "utf8",
  );
  const steamProviderSource = readFileSync("src/providers/steam/mappers/normalize.ts", "utf8");

  assert.match(
    progressBarSource,
    /type DeckyCompletionProgressBarTone =[\s\S]*"default"[\s\S]*"retroachievements-mastered"[\s\S]*"retroachievements-beaten"/u,
  );
  assert.match(progressBarSource, /data-completion-progress-tone=\{tone\}/u);
  assert.match(progressBarSource, /tone === "retroachievements-mastered"[\s\S]*?raRecipes\.progressFill\.mastered/u);
  assert.match(progressBarSource, /tone === "retroachievements-beaten"[\s\S]*?raRecipes\.progressFill\.beaten/u);
  assert.equal(getCompletionBarFillStyle(100, "retroachievements-mastered", true).background, raRecipes.progressFill.mastered);
  assert.equal(getCompletionBarFillStyle(100, "retroachievements-beaten", true).background, raRecipes.progressFill.beaten);
  assert.match(achievementDetailHelperSource, /export function formatRetroAchievementsBeatenAtText/u);
  assert.match(achievementDetailHelperSource, /Beaten on/u);
  assert.match(achievementDetailHelperSource, /export function formatRetroAchievementsMasteredAtText/u);
  assert.match(achievementDetailHelperSource, /Mastered on/u);


  assert.match(retroAchievementsProgressSummarySource, /tone=\{completionTone\}/u);

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

test("animated default completion progress switches the whole fill to flame colors at 90 percent", () => {
  const blueBackground = raRecipes.progressFill.completion;
  const flameBackground =
    "linear-gradient(90deg, rgba(245, 196, 66, 0.96), rgba(249, 115, 22, 0.98), rgba(239, 68, 68, 0.98))";

  assert.equal(getCompletionBarFillStyle(89, "default", true).background, blueBackground);
  assert.equal(getCompletionBarFillStyle(90, "default", true).background, flameBackground);
  assert.equal(getCompletionBarFillStyle(100, "default", true).background, flameBackground);
  assert.equal(getCompletionBarFillStyle(100, "default", false).background, blueBackground);
  assert.equal(
    getCompletionBarFillStyle(100, "retroachievements-mastered", true).background,
    raRecipes.progressFill.mastered,
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
  assert.match(fullScreenProfileSource, /function ProfileCompletionBreakdown/u);
  assert.match(fullScreenProfileSource, /softcoreItem\?\.count \?\? 0/u);
  assert.match(fullScreenProfileSource, /hardcoreItem\?\.count \?\? 0/u);
  assert.match(fullScreenProfileSource, /`\$\{softcoreCount\.toLocaleString\(\)\} SC`/u);
  assert.match(fullScreenProfileSource, /`\$\{hardcoreCount\.toLocaleString\(\)\} HC`/u);
  assert.match(fullScreenProfileSource, /Softcore, \$\{hardcoreCount\.toLocaleString\(\)\} Hardcore/u);
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

test("steam completion progress sorts Most Recent by last played activity", () => {
  const groupedGames = groupCompletionProgressGames([
    {
      providerId: STEAM_PROVIDER_ID,
      gameId: "older-play-session",
      title: "Older play session",
      status: "in_progress",
      summary: { unlockedCount: 10, totalCount: 20, completionPercent: 50 },
      metrics: [],
      lastPlayedAt: Date.parse("2026-04-22T17:33:54Z"),
      // A newer achievement unlock must not make this game appear more recently played.
      lastUnlockAt: Date.parse("2026-08-01T12:00:00Z"),
    },
    {
      providerId: STEAM_PROVIDER_ID,
      gameId: "newer-play-session",
      title: "Newer play session",
      status: "in_progress",
      summary: { unlockedCount: 4, totalCount: 10, completionPercent: 40 },
      metrics: [],
      lastPlayedAt: Date.parse("2026-07-08T15:44:30Z"),
      lastUnlockAt: Date.parse("2026-05-01T12:00:00Z"),
    },
  ] satisfies readonly NormalizedGame[]);

  const sortedGames = sortCompletionProgressGroups(groupedGames, "recent");

  assert.deepStrictEqual(
    sortedGames.map((group) => group.representativeGame.gameId),
    ["newer-play-session", "older-play-session"],
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
  assert.equal(renderSource.includes("background: sharedTheme.surface.contentStat"), true);
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
    relatedGames: 0,
    relatedGameProgress: 0,
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
      const firstProgressEvents: { stepId: string; status: string }[] = [];
      const joinedProgressEvents: { stepId: string; status: string }[] = [];
      const firstRefresh = loadDeckyDashboardState("steam", {
        forceRefresh: true,
        onProgress: (event) => firstProgressEvents.push(event),
      });
      const secondRefresh = loadDeckyDashboardState("steam", {
        forceRefresh: true,
        onProgress: (event) => joinedProgressEvents.push(event),
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
      for (const progressEvents of [firstProgressEvents, joinedProgressEvents]) {
        assert.ok(progressEvents.some((event) => event.stepId === "profile" && event.status === "in-progress"));
        assert.ok(progressEvents.some((event) => event.stepId === "profile" && event.status === "complete"));
        assert.ok(progressEvents.some((event) => event.stepId === "finalize" && event.status === "complete"));
      }
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

test("dashboard retains maximum recent collections so display counts can change without a provider reload", async () => {
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
      assert.equal(options?.limit, 10);
      return Array.from({ length: 8 }, (_value, index) => createRecentUnlock(index + 1));
    },
    async loadRecentlyPlayedGames(_config: unknown, options?: { readonly count?: number }) {
      assert.equal(options?.count, 10);
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

test("achievement history reuses a full-screen session profile without loading it twice", async () => {
  const sessionProfile = {
    ...DASHBOARD_REFRESH_PROFILE,
    metrics: [
      ...DASHBOARD_REFRESH_PROFILE.metrics,
      { key: "member-since", label: "Member Since", value: "2020-01-02 00:00:00" },
    ],
  };
  const { appServices, counts } = createHarness({
    providerFactory: () => ({
      id: PROVIDER_ID,
      capabilities: PROVIDER_CAPABILITIES,
      async loadProfile() {
        counts.profile += 1;
        return sessionProfile;
      },
      async loadCompletionProgress() {
        counts.completionProgress += 1;
        return [];
      },
      async loadAchievementsEarnedBetween() {
        counts.achievementsEarnedBetween += 1;
        return [createRecentUnlockForGame("game-1", "Test Game", 1, 1_700_000_000_100)];
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
    providerConfig: { username: "alice", apiKey: "secret" },
  });

  const state = await appServices.achievementHistory.loadAchievementHistory(PROVIDER_ID, {
    forceRefresh: true,
    profile: sessionProfile,
  });

  assert.equal(state.status, "success");
  assert.equal(state.data?.profile, sessionProfile);
  assert.equal(counts.profile, 0);
  assert.equal(counts.achievementsEarnedBetween, 1);
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
        assert.equal(options?.count, 3);
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
            GameID: 250,
            Title: "Placeholder Award",
            ConsoleName: "Nintendo 64",
            LastPlayed: "2024-01-01 12:00:00",
            AchievementsTotal: 96,
            NumAchieved: 70,
            HighestAwardKind: "played",
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

        if (gameId === "250") {
          return createRetroAchievementsGameProgressResponse({
            gameId,
            title: "Placeholder Award",
            highestAwardKind: "beaten-hardcore",
            unlockedCount: 70,
            totalCount: 96,
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
    { count: 3 },
  );

  assert.deepStrictEqual(games.map((game) => game.title), ["Mastered Missing Award", "Already Explicit", "Placeholder Award"]);
  assert.deepStrictEqual(gameProgressCalls, ["100", "250"]);
  assert.equal(games[0]?.metrics?.find((metric) => metric.key === "highest-award-kind")?.value, "mastered");
  assert.equal(games[0]?.metrics?.find((metric) => metric.key === "highest-award-date")?.value, String(Date.parse("2024-04-23T21:28:49+00:00")));
  assert.equal(isRetroAchievementsMasteredHardcoreGame(games[0]!), true);
  assert.equal(games[1]?.metrics?.find((metric) => metric.key === "highest-award-kind")?.value, "beaten-hardcore");
  assert.equal(games[2]?.metrics?.find((metric) => metric.key === "highest-award-kind")?.value, "beaten-hardcore");
  assert.equal(isRetroAchievementsBeatenGame(games[2]!), true);
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

test("fresh empty related-game cache skips subset discovery entirely", async () => {
  const now = Date.now();
  const rootGame = createGameDetailSnapshot().game;
  const { appServices, counts } = createHarness({
    cacheEntries: [
      createCacheEntry(
        createProviderRelatedGamesCacheKey(PROVIDER_ID, rootGame.gameId),
        [],
        now - 1_000,
        now + 60_000,
      ),
    ],
    providerFactory: (callCounts) => ({
      ...createSuccessfulProvider(callCounts),
      async loadRelatedGames() {
        callCounts.relatedGames += 1;
        throw new Error("relationship discovery should not run for a fresh empty result");
      },
      async loadRelatedGameProgress() {
        callCounts.relatedGameProgress += 1;
        throw new Error("progress refresh should not run when there are no subsets");
      },
    }),
  });

  const state = await appServices.relatedGames.loadRelatedGames(PROVIDER_ID, rootGame);

  assert.equal(state.status, "success");
  assert.deepStrictEqual(state.data, []);
  assert.equal(counts.config, 0);
  assert.equal(counts.relatedGames, 0);
  assert.equal(counts.relatedGameProgress, 0);
});

test("fresh related-game cache refreshes only subset progress", async () => {
  const now = Date.now();
  const rootGame = createGameDetailSnapshot().game;
  const relatedGame: RelatedGameSummary = {
    providerId: PROVIDER_ID,
    gameId: "subset-1",
    title: "Test Game [Subset - Bonus]",
    parentGameId: rootGame.gameId,
    totalAchievementCount: 10,
  };
  const refreshedRelatedGame: RelatedGameSummary = {
    ...relatedGame,
    progress: {
      unlockedCount: 2,
      totalCount: 10,
      completionPercent: 20,
    },
  };
  const { appServices, counts, writes } = createHarness({
    cacheEntries: [
      createCacheEntry(
        createProviderRelatedGamesCacheKey(PROVIDER_ID, rootGame.gameId),
        [relatedGame],
        now - 1_000,
        now + 60_000,
      ),
    ],
    providerConfig: { username: "alice", apiKey: "secret" },
    providerFactory: (callCounts) => ({
      ...createSuccessfulProvider(callCounts),
      async loadRelatedGames() {
        callCounts.relatedGames += 1;
        throw new Error("relationship discovery should not rerun for a fresh result");
      },
      async loadRelatedGameProgress(_config, _game, cachedRelatedGames) {
        callCounts.relatedGameProgress += 1;
        assert.deepStrictEqual(cachedRelatedGames, [relatedGame]);
        return [refreshedRelatedGame];
      },
    }),
  });

  const state = await appServices.relatedGames.loadRelatedGames(PROVIDER_ID, rootGame);

  assert.equal(state.status, "success");
  assert.deepStrictEqual(state.data, [refreshedRelatedGame]);
  assert.equal(counts.config, 1);
  assert.equal(counts.relatedGames, 0);
  assert.equal(counts.relatedGameProgress, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.key, createProviderRelatedGamesCacheKey(PROVIDER_ID, rootGame.gameId));
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
  assert.equal(providerGames.every((game) => game.achievementStateIsComplete === true), true);
});

test("Steam recent detail without usable schema is not marked complete for library projections", async () => {
  clearSteamRecentGameSnapshotLoadCacheForTests();
  const provider = createSteamProvider({
    client: {
      async loadRecentlyPlayedGames() {
        return { response: { games: [{ appid: 991, name: "Schema Unavailable", playtime_forever: 10 }] } };
      },
      async loadOwnedGames() {
        return { response: { games: [] } };
      },
      async loadPlayerAchievements() {
        return { playerstats: { success: true, achievements: [{ apiname: "A", achieved: 1 }] } };
      },
      async loadSchemaForGame() {
        throw new Error("temporary schema failure");
      },
      async loadGlobalAchievementPercentagesForApp() {
        return { achievementpercentages: { achievements: [] } };
      },
    } as SteamClient,
  });
  const config = normalizeSteamProviderConfig({
    steamId64: "32345678901234567",
    hasApiKey: true,
    language: "english",
    recentAchievementsCount: 1,
    recentlyPlayedCount: 1,
    includePlayedFreeGames: false,
  });

  const recentGames = await provider.loadRecentlyPlayedGames(config, { count: 1 });
  assert.equal(recentGames[0]?.summary.unlockedCount, 1);
  assert.equal(recentGames[0]?.achievementStateIsComplete, undefined);
  clearSteamRecentGameSnapshotLoadCacheForTests();
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
  assert.equal(recentGames[0]?.achievementStateIsComplete, undefined,
    "normalization must not certify detail completeness without provider provenance");
  assert.equal(recentGames[0]?.lastPlayedAt, undefined);
  assert.equal(recentGames[0]?.playtimeTwoWeeksMinutes, 12);
  assert.equal(recentGames[0]?.playtimeForeverMinutes, 42);
  assert.equal(recentGames[0]?.playtimeDeckForeverMinutes, 28);
  assert.equal(recentGames[0]?.coverImageUrl, "https://cdn.steam.com/game-icon.jpg");
  assert.equal(recentGames[0]?.boxArtImageUrl, "https://cdn.steam.com/game-box.jpg");
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
      [`Points:${(4321).toLocaleString()}`, "Unlocked:-"],
      [`Points:${(1234).toLocaleString()}`, "Unlocked:-"],
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

          if (appId === 3) {
            return { game: { availableGameStats: { achievements: [] } } };
          }

          throw new Error("Steam schema unavailable for a game that already fails player-state loading.");
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
    assert.deepStrictEqual([...schemaCalls].sort((left, right) => left - right), [1, 2, 3, 4, 5]);
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
    assert.equal(summaryCompletion.summary.beatenCount, 1);
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

    await Promise.resolve();
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
        "ISteamUserStats/GetSchemaForGame/v2/",
        "ISteamUserStats/GetPlayerAchievements/v1/",
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
    assert.equal(history.summary.unlockedCount, 164);

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
    },
    achievements: [],
  };

  const patchedDungeonsSnapshot = applySteamLibraryScanGameDetailMetadata(dungeonsSnapshot, cachedSummary);
  assert.equal(patchedDungeonsSnapshot.game.appid, 423530);
  assert.equal(patchedDungeonsSnapshot.game.gameId, "423530");
  assert.equal(patchedDungeonsSnapshot.game.title, "Minecraft Dungeons");
  assert.equal(patchedDungeonsSnapshot.game.playtimeForeverMinutes, 28);
  assert.equal(patchedDungeonsSnapshot.game.playtimeTwoWeeksMinutes, 1);
  assert.equal(patchedDungeonsSnapshot.game.playtimeDeckForeverMinutes, 28);
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

  const livePlaytimeSnapshot = applySteamLibraryScanGameDetailMetadata({
    ...battlefieldSnapshot,
    game: {
      ...battlefieldSnapshot.game,
      playtimeForeverMinutes: 44,
    },
  }, cachedSummary);
  assert.equal(livePlaytimeSnapshot.game.playtimeForeverMinutes, 44);

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
    assert.equal(state.data?.summary.beatenCount, 1);
    assert.equal(state.data?.summary.masteredCount, 1);
    assert.equal(state.data?.games[0]?.playtimeForeverMinutes, 10);
    assert.equal(state.data?.games[0]?.lastPlayedAt, 1_700_000_010_000);
    assert.equal(state.data?.games[2]?.scanStatus, "no-achievements");
    assert.equal(state.data?.games[3]?.scanStatus, "failed");
    assert.deepStrictEqual(
      formatCompletionProgressSummary(state.data?.summary ?? { playedCount: 0, unfinishedCount: 0, beatenCount: 0, masteredCount: 0 }, "steam"),
      "5 Played | 1 Unfinished | 1 Skipped | 1 Perfect",
    );
    assert.equal(formatCompletionProgressStatusLabel("mastered", "steam"), "Perfect");
    assert.equal(formatCompletionProgressFilterLabelForProvider("mastered", "steam"), "Perfect");
  });
});

test("steam fullscreen games overlays freshly refreshed recent-game activity onto the library scan", () => {
  const completionProgress: CompletionProgressSnapshot = {
    providerId: "steam",
    summary: {
      playedCount: 1,
      unfinishedCount: 1,
      beatenCount: 0,
      masteredCount: 0,
    },
    games: [
      {
        providerId: "steam",
        appid: 2218750,
        gameId: "2218750",
        title: "Halls of Torment",
        status: "in_progress",
        summary: { unlockedCount: 164, totalCount: 500, completionPercent: 33 },
        metrics: [],
        playtimeForeverMinutes: 720,
        lastPlayedAt: 1_790_000_000_000,
        scanStatus: "scanned",
        hasAchievements: true,
      } satisfies NormalizedGame,
    ],
    refreshedAt: 1_790_000_000_000,
  };
  const dashboard: DashboardSnapshot = {
    ...createDashboardSnapshot(),
    profile: {
      ...createDashboardSnapshot().profile,
      providerId: "steam",
      identity: {
        ...createDashboardSnapshot().profile.identity,
        providerId: "steam",
      },
    },
    recentlyPlayedGames: [
      {
        providerId: "steam",
        appid: 2218750,
        gameId: "2218750",
        title: "Halls of Torment",
        summary: { unlockedCount: 168, totalCount: 500, completionPercent: 34 },
        achievementStateIsComplete: true,
        playtimeForeverMinutes: 780,
        lastPlayedAt: 1_790_100_000_000,
      },
      {
        providerId: "steam",
        appid: 1672970,
        gameId: "1672970",
        title: "Minecraft Dungeons 2",
        summary: { unlockedCount: 0 },
        playtimeForeverMinutes: 65,
        lastPlayedAt: 1_790_200_000_000,
      },
    ],
    refreshedAt: 1_790_100_000_000,
  };

  const merged = mergeDeckySteamCompletionProgressWithDashboard(completionProgress, dashboard);

  assert.equal(merged.games[0]?.summary.unlockedCount, 168);
  assert.equal(merged.games[0]?.summary.completionPercent, 34);
  assert.equal(merged.games[0]?.playtimeForeverMinutes, 780);
  assert.equal(merged.games[0]?.lastPlayedAt, 1_790_100_000_000);
  assert.equal(merged.games[0]?.scanStatus, "scanned");
  assert.equal(merged.games[1]?.title, "Minecraft Dungeons 2");
  assert.equal(merged.games[1]?.playtimeForeverMinutes, 65);
  assert.equal(merged.games[1]?.scanStatus, undefined);
  assert.deepStrictEqual(merged.summary, {
    playedCount: 2,
    unfinishedCount: 1,
    beatenCount: 0,
    masteredCount: 0,
  });
});

test("Steam Games projection keeps library counts when recent detail is fallback, and accepts valid recent detail", () => {
  const completionProgress: CompletionProgressSnapshot = {
    providerId: "steam",
    summary: { playedCount: 1, unfinishedCount: 1, beatenCount: 0, masteredCount: 0 },
    games: [{
      providerId: "steam",
      appid: 55,
      gameId: "55",
      title: "Recent Failure Test",
      status: "in_progress",
      summary: { unlockedCount: 50, totalCount: 100, completionPercent: 50 },
      metrics: [],
      scanStatus: "scanned",
      hasAchievements: true,
    }],
  };
  const dashboard: DashboardSnapshot = {
    ...createDashboardSnapshot(),
    profile: {
      ...createDashboardSnapshot().profile,
      providerId: "steam",
      identity: { ...createDashboardSnapshot().profile.identity, providerId: "steam" },
    },
    recentlyPlayedGames: [{
      providerId: "steam",
      appid: 55,
      gameId: "55",
      title: "Recent Failure Test",
      summary: { unlockedCount: 0 },
    }],
  };

  const fallbackProjection = mergeDeckySteamCompletionProgressWithDashboard(completionProgress, dashboard);
  assert.equal(fallbackProjection.games[0]?.summary.unlockedCount, 50);

  const validDashboard: DashboardSnapshot = {
    ...dashboard,
    recentlyPlayedGames: dashboard.recentlyPlayedGames.map((game) => ({
      ...game,
      summary: { unlockedCount: 55, totalCount: 100, completionPercent: 55 },
      achievementStateIsComplete: true,
    })),
  };
  const validProjection = mergeDeckySteamCompletionProgressWithDashboard(completionProgress, validDashboard);
  assert.equal(validProjection.games[0]?.summary.unlockedCount, 55);
});

test("Steam bounded profile refresh reconciles only complete recent-game progress into library totals", () => {
  const summary: SteamLibraryAchievementScanSummary = {
    steamId64: "12345678901234567",
    scannedAt: "2026-09-01T00:00:00.000Z",
    ownedGameCount: 2,
    scannedGameCount: 2,
    gamesWithAchievements: 2,
    skippedGameCount: 0,
    failedGameCount: 0,
    totalAchievements: 1_500,
    unlockedAchievements: 825,
    perfectGames: 0,
    completionPercent: 55,
    games: [
      {
        appid: 2218750, id: "2218750", gameId: "2218750", title: "Halls of Torment", providerId: "steam",
        totalAchievements: 500, unlockedAchievements: 168, completionPercent: 34,
        hasAchievements: true, scanStatus: "scanned",
      },
      {
        appid: 70, id: "70", gameId: "70", title: "Half-Life", providerId: "steam",
        totalAchievements: 1_000, unlockedAchievements: 657, completionPercent: 66,
        hasAchievements: true, scanStatus: "scanned",
      },
    ],
  };
  const reconciled = reconcileSteamLibraryAchievementSummaryWithRecentGames(summary, [{
    providerId: "steam",
    appid: 2218750,
    gameId: "2218750",
    title: "Halls of Torment",
    summary: { unlockedCount: 169, totalCount: 500, completionPercent: 34 },
    achievementStateIsComplete: true,
  }], "2026-09-25T20:00:00.000Z");

  assert.equal(reconciled.unlockedAchievements, 826);
  assert.equal(reconciled.games[0]?.unlockedAchievements, 169);
  assert.equal(reconciled.lastRecentActivityRefreshAt, "2026-09-25T20:00:00.000Z");

  const unchanged = reconcileSteamLibraryAchievementSummaryWithRecentGames(summary, [{
    providerId: "steam",
    appid: 2218750,
    gameId: "2218750",
    title: "Halls of Torment",
    summary: { unlockedCount: 169, totalCount: 500, completionPercent: 34 },
  }]);
  assert.equal(unchanged, summary, "fallback detail must not alter the saved library aggregate");
});

test("Steam dashboard refresh keeps cached library totals when bounded recent detail fails", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    const config = normalizeSteamProviderConfig({
      steamId64: "12345678901234567", hasApiKey: true, language: "english",
      recentAchievementsCount: 1, recentlyPlayedCount: 1, includePlayedFreeGames: false,
    });
    deckyBackendTestState.steam.config = config;
    deckyBackendTestState.steam.secret = "steam-test-secret";
    updateDeckyProviderConfigCache("steam", config);
    writeDeckySteamLibraryAchievementScanSummary({
      steamId64: config.steamId64,
      scannedAt: "2026-09-01T00:00:00.000Z",
      ownedGameCount: 1,
      scannedGameCount: 1,
      gamesWithAchievements: 1,
      skippedGameCount: 0,
      failedGameCount: 0,
      totalAchievements: 100,
      unlockedAchievements: 50,
      perfectGames: 0,
      completionPercent: 50,
      games: [{
        appid: 220, id: "220", gameId: "220", title: "Half-Life 2", providerId: "steam",
        totalAchievements: 100, unlockedAchievements: 50, completionPercent: 50,
        hasAchievements: true, scanStatus: "scanned",
      }],
    });

    let signalPlayerRequest: (() => void) | undefined;
    const playerRequestStarted = new Promise<void>((resolve) => { signalPlayerRequest = resolve; });
    let releasePlayerRequest: (() => void) | undefined;
    const playerRequestGate = new Promise<void>((resolve) => { releasePlayerRequest = resolve; });
    let playerRequestCount = 0;
    let refreshSettled = false;
    setDeckyBackendCallImplementationForTests(async (route: string, payload: unknown) => {
      if (route === "request_steam_json" && (payload as Record<string, unknown>).path === "ISteamUserStats/GetPlayerAchievements/v1/") {
        playerRequestCount += 1;
        signalPlayerRequest?.();
        await playerRequestGate;
        throw new Error("temporary recent player-state failure");
      }
      return deckyBackendTestCallImplementation(route, payload);
    });

    try {
      const refresh = loadDeckyDashboardState("steam", { forceRefresh: true }).then((state) => {
        refreshSettled = true;
        return state;
      });
      await playerRequestStarted;
      await Promise.resolve();
      assert.equal(refreshSettled, false);
      releasePlayerRequest?.();
      const dashboardState = await refresh;
      assert.equal(dashboardState.data?.recentlyPlayedGames[0]?.summary.unlockedCount, 0);
      assert.equal(playerRequestCount, 2, "only the bounded dashboard and history requests run; no complete library updater runs");
      const completionState = await loadDeckyCompletionProgressState("steam");
      assert.equal(completionState.data?.games[0]?.summary.unlockedCount, 50);
    } finally {
      setDeckyBackendCallImplementationForTests(deckyBackendTestCallImplementation);
      resetDeckyAppServicesForTests();
    }
  });
});

test("Steam full-screen entry refreshes the bounded account snapshot and reuses the saved library", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    const config = normalizeSteamProviderConfig({
      steamId64: "12345678901234567", hasApiKey: true, language: "english",
      recentAchievementsCount: 1, recentlyPlayedCount: 1, includePlayedFreeGames: false,
    });
    deckyBackendTestState.steam.config = config;
    deckyBackendTestState.steam.secret = "steam-test-secret";
    updateDeckyProviderConfigCache("steam", config);

    const ownedGames = Array.from({ length: 101 }, (_, index) => ({
      appid: 220 + index,
      name: `Owned Game ${index + 1}`,
      playtime_forever: index === 0 ? 42 : 0,
      ...(index === 0 ? { playtime_2weeks: 12 } : {}),
    }));
    let ownedGamesRequestCount = 0;
    let playerAchievementRequestCount = 0;
    setDeckyBackendCallImplementationForTests(async (route: string, payload: unknown) => {
      if (route === "request_steam_json") {
        const path = (payload as Record<string, unknown>).path;
        if (path === "IPlayerService/GetOwnedGames/v1/") {
          ownedGamesRequestCount += 1;
          return { response: { game_count: ownedGames.length, games: ownedGames } };
        }
        if (path === "ISteamUserStats/GetPlayerAchievements/v1/") {
          playerAchievementRequestCount += 1;
        }
      }
      return deckyBackendTestCallImplementation(route, payload);
    });

    try {
      const profileState = await loadDeckyDashboardStateForFullScreenEntry("steam");
      assert.equal(profileState.status, "success");
      assert.ok(profileState.data !== undefined);
      assert.equal(ownedGamesRequestCount, 3, "full-screen entry uses only the bounded profile/activity inputs");
      assert.equal(
        playerAchievementRequestCount,
        2,
        "full-screen entry refreshes only the configured recent game's bounded live state",
      );

      const cachedEntryState = getDeckyDashboardStateForFullScreenEntryInitial("steam");
      assert.equal(cachedEntryState.status, "success");
      assert.equal(cachedEntryState.data?.profile.providerId, "steam");

      const completedSessionRequestCounts = {
        ownedGames: ownedGamesRequestCount,
        playerAchievements: playerAchievementRequestCount,
      };
      const gamesState = await loadDeckyCompletionProgressStateForFullScreenEntry("steam");
      const activityState = await loadDeckyAchievementHistoryStateForFullScreenEntry("steam");
      assert.equal(gamesState.status, "success");
      assert.equal(activityState.status, "success");
      assert.deepEqual(
        {
          ownedGames: ownedGamesRequestCount,
          playerAchievements: playerAchievementRequestCount,
        },
        completedSessionRequestCounts,
        "switching to Games or Activity reuses the completed full-screen session without API calls",
      );

      playerAchievementRequestCount = 0;
      ownedGamesRequestCount = 0;
      await refreshDeckySteamLibraryForExplicitRefresh();
      assert.equal(ownedGamesRequestCount, 1);
      assert.equal(
        playerAchievementRequestCount,
        ownedGames.length,
        "an explicit library refresh still updates every owned game's achievement state",
      );
    } finally {
      setDeckyBackendCallImplementationForTests(deckyBackendTestCallImplementation);
      resetDeckyAppServicesForTests();
    }
  });
});

test("Steam inactive games remain historical but are excluded from current completion projections", () => {
  const historicalUnlock = {
    id: "9:OLD:1700000000",
    achievementId: "OLD",
    apiName: "OLD",
    title: "Old achievement",
    unlockedAt: "2023-11-14T22:13:20.000Z",
    gameId: "9",
    gameTitle: "Inactive Game",
    providerId: "steam" as const,
  };
  const summary: SteamLibraryAchievementScanSummary = {
    steamId64: "12345678901234567",
    scannedAt: "2026-09-24T00:00:00.000Z",
    ownedGameCount: 1,
    scannedGameCount: 1,
    gamesWithAchievements: 1,
    skippedGameCount: 0,
    failedGameCount: 0,
    totalAchievements: 2,
    unlockedAchievements: 1,
    perfectGames: 0,
    completionPercent: 50,
    unlockedAchievementsList: [historicalUnlock],
    games: [
      {
        appid: 9,
        id: "9",
        gameId: "9",
        title: "Inactive Game",
        providerId: "steam",
        totalAchievements: 10,
        unlockedAchievements: 10,
        completionPercent: 100,
        hasAchievements: true,
        scanStatus: "scanned",
        ownershipStatus: "inactive",
      },
      {
        appid: 10,
        id: "10",
        gameId: "10",
        title: "Owned Game",
        providerId: "steam",
        totalAchievements: 2,
        unlockedAchievements: 1,
        completionPercent: 50,
        hasAchievements: true,
        scanStatus: "scanned",
        ownershipStatus: "owned",
      },
    ],
  };

  const projection = buildDeckySteamCompletionProgressSnapshotFromSummary(summary);
  assert.deepStrictEqual(projection.games.map((game) => game.gameId), ["10"]);
  assert.equal(projection.summary.playedCount, 1);
  assert.equal(projection.summary.unfinishedCount, 1);
  assert.equal(projection.summary.masteredCount, 0);
  assert.equal(summary.unlockedAchievementsList?.length, 1, "historical unlock stays retained");
});

test("incremental Steam library refresh discovers and safely updates the complete owned library", async () => {
  const config = normalizeSteamProviderConfig({
    steamId64: "12345678901234567",
    hasApiKey: true,
    language: "english",
    recentAchievementsCount: 1,
    recentlyPlayedCount: 1,
    includePlayedFreeGames: false,
  });
  let ownedGames: RawSteamOwnedGame[] = [
    { appid: 10, name: "Recent Game", playtime_forever: 10 },
    { appid: 20, name: "Non-recent Owned Game", playtime_forever: 0 },
  ];
  const playerState = new Map<number, RawSteamPlayerAchievement[]>([
    [10, [{ apiname: "A", achieved: 1, unlocktime: 1_700_000_001 }, { apiname: "B", achieved: 0 }]],
    [20, [{ apiname: "C", achieved: 1, unlocktime: 1_700_000_002 }, { apiname: "D", achieved: 0 }]],
  ]);
  const schemaState = new Map<number, RawSteamSchemaAchievement[]>([
    [10, [{ name: "A" }, { name: "B" }]],
    [20, [{ name: "C" }, { name: "D" }]],
  ]);
  const failedGames = new Set<number>();
  const missingAchievementsGames = new Set<number>();
  let ownedGamesResponse: RawSteamGetOwnedGamesResponse | undefined;
  const schemaCalls = new Map<number, number>();
  const schemaCache = new Map<number, readonly RawSteamSchemaAchievement[]>();
  const schemaCacheAdapter = {
    read(appId: number) { return schemaCache.get(appId); },
    write(appId: number, achievements: readonly RawSteamSchemaAchievement[]) {
      schemaCache.set(appId, achievements);
    },
  };
  const client: SteamClient = {
    async loadOwnedGames() {
      return ownedGamesResponse ?? { response: { game_count: ownedGames.length, games: ownedGames } };
    },
    async loadPlayerAchievements(_config, appId) {
      if (failedGames.has(appId)) {
        throw new Error("temporary player-achievements failure");
      }
      if (missingAchievementsGames.has(appId)) {
        return { playerstats: { success: true } };
      }
      return { playerstats: { success: true, achievements: playerState.get(appId) ?? [] } };
    },
    async loadSchemaForGame(_config, appId) {
      schemaCalls.set(appId, (schemaCalls.get(appId) ?? 0) + 1);
      return { game: { availableGameStats: { achievements: schemaState.get(appId) ?? [] } } };
    },
    async loadPlayerSummaries() { throw new Error("unused"); },
    async loadSteamLevel() { throw new Error("unused"); },
    async loadBadges() { throw new Error("unused"); },
    async loadRecentlyPlayedGames() { throw new Error("unused"); },
    async loadGlobalAchievementPercentagesForApp() { throw new Error("unused"); },
  };

  const initial = await scanSteamLibraryAchievements(config, { client, schemaCache: schemaCacheAdapter });
  assert.equal(initial.ownedGameCount, 2);
  assert.equal(initial.totalAchievements, 4);
  assert.equal(initial.unlockedAchievements, 2);
  assert.equal(initial.games.find((game) => game.appid === 20)?.totalAchievements, 2);

  const unchanged = await refreshSteamLibraryAchievementProgress(config, initial, { client, schemaCache: schemaCacheAdapter });
  assert.equal(unchanged.totalAchievements, 4);
  assert.equal(unchanged.unlockedAchievements, 2);
  assert.equal(unchanged.games.find((game) => game.appid === 20)?.totalAchievements, 2);
  assert.equal(schemaCalls.get(10), 1, "cached static schema should be reused");
  assert.equal(schemaCalls.get(20), 1, "cached static schema should be reused");

  // A newly unlocked state on a game outside the recent-game UI limit is still refreshed.
  playerState.set(20, [
    { apiname: "C", achieved: 1, unlocktime: 1_700_000_002 },
    { apiname: "D", achieved: 1, unlocktime: 1_800_000_000 },
  ]);
  let updated = await refreshSteamLibraryAchievementProgress(config, unchanged, { client, schemaCache: schemaCacheAdapter });
  assert.equal(updated.unlockedAchievements, 3);
  assert.equal(updated.games.find((game) => game.appid === 20)?.unlockedAchievements, 2);
  assert.equal(updated.unlockedAchievementsList?.some((unlock) => unlock.apiName === "D"), true);

  // Owned-game discovery does not use installation state and adds new titles on normal refresh.
  const uninstalledButOwned = { appid: 30, name: "Owned but uninstalled" } as RawSteamOwnedGame & {
    readonly installed: false;
  };
  ownedGames = [...ownedGames, uninstalledButOwned];
  playerState.set(30, [{ apiname: "E", achieved: 1, unlocktime: 1_800_000_100 }]);
  schemaState.set(30, [{ name: "E" }]);
  updated = await refreshSteamLibraryAchievementProgress(config, updated, { client, schemaCache: schemaCacheAdapter });
  assert.equal(updated.ownedGameCount, 3);
  assert.equal(updated.games.some((game) => game.appid === 30 && game.ownershipStatus === "owned"), true);
  assert.equal(updated.unlockedAchievements, 4);

  // Absence in a single routine refresh is not proof of ownership loss.
  ownedGames = ownedGames.filter((game) => game.appid !== 20);
  updated = await refreshSteamLibraryAchievementProgress(config, updated, { client, schemaCache: schemaCacheAdapter });
  assert.equal(updated.games.find((game) => game.appid === 20)?.ownershipStatus, "owned");
  assert.equal(updated.ownedGameCount, 3);
  assert.equal(updated.unlockedAchievements, 4);
  ownedGames = [...ownedGames, { appid: 20, name: "Non-recent Owned Game", playtime_forever: 0 }];

  const knownGoodUnlocked = updated.unlockedAchievements;
  failedGames.add(20);
  const afterRequestFailure = await refreshSteamLibraryAchievementProgress(config, updated, { client, schemaCache: schemaCacheAdapter });
  assert.equal(afterRequestFailure.unlockedAchievements, knownGoodUnlocked);
  assert.equal(afterRequestFailure.games.find((game) => game.appid === 20)?.unlockedAchievements, 2);
  assert.match(afterRequestFailure.games.find((game) => game.appid === 20)?.lastAchievementRefreshError ?? "", /failure/u);

  failedGames.clear();
  missingAchievementsGames.add(20);
  const afterMissingState = await refreshSteamLibraryAchievementProgress(config, afterRequestFailure, { client, schemaCache: schemaCacheAdapter });
  assert.equal(afterMissingState.unlockedAchievements, knownGoodUnlocked);
  assert.equal(afterMissingState.games.find((game) => game.appid === 20)?.unlockedAchievements, 2);

  // Shape/count mismatches and ambiguous empty responses cannot replace the prior collection.
  assert.equal(validateSteamOwnedGamesResponse({ response: { game_count: 2, games: ownedGames } }), undefined);
  assert.equal(validateSteamOwnedGamesResponse({ response: { game_count: 0 } }), undefined);
  ownedGamesResponse = { response: { game_count: 2, games: ownedGames.slice(0, 2) } };
  const afterPartialOwnedList = await refreshSteamLibraryAchievementProgress(config, afterMissingState, { client, schemaCache: schemaCacheAdapter });
  assert.equal(afterPartialOwnedList.ownedGameCount, 3, "a partial owned-games list preserves cached ownership");
  ownedGamesResponse = { response: { game_count: 0, games: [] } };
  await assert.rejects(refreshSteamLibraryAchievementProgress(config, afterMissingState, { client, schemaCache: schemaCacheAdapter }));
  ownedGamesResponse = undefined;
  assert.equal(afterMissingState.ownedGameCount, 3);
  assert.equal(afterMissingState.unlockedAchievements, knownGoodUnlocked);

  // Player API names define counts; a partial schema cannot omit valid player states.
  const playerAchievements = [
    { apiname: "A", achieved: 1 },
    { apiname: "B", achieved: 0 },
  ] satisfies RawSteamPlayerAchievement[];
  const partialSchemaCounts = countSteamPlayerAchievements(playerAchievements);
  assert.equal(partialSchemaCounts?.total, 2);
  assert.equal(partialSchemaCounts?.unlocked, 1);
  const partialSchemaDetail = normalizeSteamGameDetail({
    appId: 10,
    rawGameName: "Recent Game",
    rawGameIcon: undefined,
    rawGameBoxArt: undefined,
    playerAchievements,
    schemaAchievements: [{ name: "A" }],
    globalAchievementPercentages: new Map(),
    playtimeForever: undefined,
    playtimeTwoWeeks: undefined,
    playtimeDeckForever: undefined,
  });
  assert.equal(partialSchemaDetail.game.summary.totalCount, 2);
  assert.equal(partialSchemaDetail.game.summary.unlockedCount, 1);

  // A complete player response with a refreshed schema can authoritatively lower totals.
  failedGames.clear();
  missingAchievementsGames.clear();
  schemaState.set(10, [{ name: "A" }]);
  playerState.set(10, [{ apiname: "A", achieved: 0 }]);
  updated = await refreshSteamLibraryAchievementProgress(config, updated, { client, schemaCache: schemaCacheAdapter });
  assert.equal(updated.games.find((game) => game.appid === 10)?.totalAchievements, 1);
  const rebuilt = await scanSteamLibraryAchievements(config, { client, previousSummary: updated, schemaCache: schemaCacheAdapter });
  assert.equal(rebuilt.totalAchievements, updated.totalAchievements);
  assert.equal(rebuilt.unlockedAchievements, updated.unlockedAchievements);
});

test("concurrent Steam recent-detail and library requests share only the in-flight player state", async () => {
  const config = normalizeSteamProviderConfig({
    steamId64: "12345678901234567", hasApiKey: true, language: "english",
    recentAchievementsCount: 1, recentlyPlayedCount: 1, includePlayedFreeGames: false,
  });
  let requestCount = 0;
  let resolveRequest: ((response: RawSteamGetPlayerAchievementsResponse) => void) | undefined;
  const pendingResponse = new Promise<RawSteamGetPlayerAchievementsResponse>((resolve) => {
    resolveRequest = resolve;
  });
  const createClient = (): SteamClient => ({
    loadPlayerAchievements() {
      requestCount += 1;
      return pendingResponse;
    },
    async loadOwnedGames() { throw new Error("unused"); },
    async loadPlayerSummaries() { throw new Error("unused"); },
    async loadSteamLevel() { throw new Error("unused"); },
    async loadBadges() { throw new Error("unused"); },
    async loadRecentlyPlayedGames() { throw new Error("unused"); },
    async loadSchemaForGame() { throw new Error("unused"); },
    async loadGlobalAchievementPercentagesForApp() { throw new Error("unused"); },
  });

  const recentRequest = loadSteamPlayerAchievementsCoalesced(createClient(), config, 123);
  const libraryRequest = loadSteamPlayerAchievementsCoalesced(createClient(), config, 123);
  assert.equal(requestCount, 1);
  resolveRequest?.({ playerstats: { success: true, achievements: [{ apiname: "A", achieved: 1 }] } });
  assert.deepStrictEqual(await recentRequest, await libraryRequest);
  await Promise.resolve();
  const laterRefresh = loadSteamPlayerAchievementsCoalesced(createClient(), config, 123);
  assert.equal(requestCount, 2, "resolved player state is not reused across refreshes");
  resolveRequest?.({ playerstats: { success: true, achievements: [{ apiname: "A", achieved: 1 }] } });
  await laterRefresh;
});

test("Steam library refresh preserves unverifiable decreases and accepts complete lower or increased state", async () => {
  const config = normalizeSteamProviderConfig({
    steamId64: "12345678901234567",
    hasApiKey: true,
    language: "english",
    recentAchievementsCount: 1,
    recentlyPlayedCount: 1,
    includePlayedFreeGames: false,
  });
  const previousAchievements = Array.from({ length: 100 }, (_, index) => ({
    apiname: `ACH_${index}`,
    achieved: index < 50 ? 1 : 0,
  } satisfies RawSteamPlayerAchievement));
  const previous: SteamLibraryAchievementScanSummary = {
    steamId64: config.steamId64,
    scannedAt: "2026-09-01T00:00:00.000Z",
    ownedGameCount: 1,
    scannedGameCount: 1,
    gamesWithAchievements: 1,
    skippedGameCount: 0,
    failedGameCount: 0,
    totalAchievements: 100,
    unlockedAchievements: 50,
    perfectGames: 0,
    completionPercent: 50,
    games: [{
      appid: 1,
      id: "1",
      gameId: "1",
      title: "Known Game",
      providerId: "steam",
      totalAchievements: 100,
      unlockedAchievements: 50,
      completionPercent: 50,
      hasAchievements: true,
      scanStatus: "scanned",
    }],
  };
  const makeClient = (
    achievements: readonly RawSteamPlayerAchievement[],
    schema: readonly RawSteamSchemaAchievement[] | undefined,
  ): SteamClient => ({
    async loadOwnedGames() { return { response: { game_count: 1, games: [{ appid: 1, name: "Known Game" }] } }; },
    async loadPlayerAchievements() { return { playerstats: { success: true, achievements } }; },
    async loadSchemaForGame() {
      if (schema === undefined) throw new Error("schema unavailable");
      return { game: { availableGameStats: { achievements: schema } } };
    },
    async loadPlayerSummaries() { throw new Error("unused"); },
    async loadSteamLevel() { throw new Error("unused"); },
    async loadBadges() { throw new Error("unused"); },
    async loadRecentlyPlayedGames() { throw new Error("unused"); },
    async loadGlobalAchievementPercentagesForApp() { throw new Error("unused"); },
  });

  const lowerPartial = Array.from({ length: 90 }, (_, index) => ({
    apiname: `ACH_${index}`,
    achieved: index < 45 ? 1 : 0,
  } satisfies RawSteamPlayerAchievement));
  const preserved = await refreshSteamLibraryAchievementProgress(
    config,
    previous,
    { client: makeClient(lowerPartial, undefined) },
  );
  assert.equal(preserved.totalAchievements, 100);
  assert.equal(preserved.unlockedAchievements, 50);
  assert.match(preserved.games[0]?.lastAchievementRefreshError ?? "", /authoritative state/u);

  const increased = previousAchievements.map((achievement, index) => ({
    ...achievement,
    achieved: index < 51 ? 1 : 0,
  }));
  const acceptedIncrease = await refreshSteamLibraryAchievementProgress(
    config,
    previous,
    { client: makeClient(increased, undefined) },
  );
  assert.equal(acceptedIncrease.totalAchievements, 100);
  assert.equal(acceptedIncrease.unlockedAchievements, 51);

  const completeSchema = Array.from({ length: 90 }, (_, index) => ({ name: `ACH_${index}` }));
  const acceptedDecrease = await refreshSteamLibraryAchievementProgress(
    config,
    previous,
    { client: makeClient(lowerPartial, completeSchema) },
  );
  assert.equal(acceptedDecrease.totalAchievements, 90);
  assert.equal(acceptedDecrease.unlockedAchievements, 45);

  const newGameClient: SteamClient = {
    ...makeClient([
      { apiname: "NEW_A", achieved: 1 },
      { apiname: "NEW_B", achieved: 0 },
      { apiname: "NEW_C", achieved: 0 },
    ], undefined),
    async loadOwnedGames() { return { response: { game_count: 1, games: [{ appid: 2, name: "New Game" }] } }; },
  };
  const initialized = await refreshSteamLibraryAchievementProgress(config, undefined, { client: newGameClient });
  assert.equal(initialized.totalAchievements, 3);
  assert.equal(initialized.unlockedAchievements, 1);
});

test("Steam incremental refresh prevents the 825 to 812 stale-detail regression and stale cache writes", async () => {
  await withMockDeckyStorage(async () => {
    const achievements = Array.from({ length: 825 }, (_, index) => ({
      apiname: `ACH_${index}`,
      achieved: index < 825 ? 1 : 0,
      unlocktime: 1_800_000_000 + index,
    } satisfies RawSteamPlayerAchievement));
    const schema = achievements.map((achievement) => ({ name: achievement.apiname }));
    const ownedGames: RawSteamOwnedGame[] = [{ appid: 99, name: "825-count game" }];
    const client: SteamClient = {
      async loadOwnedGames() { return { response: { game_count: 1, games: ownedGames } }; },
      async loadPlayerAchievements() { return { playerstats: { success: true, achievements } }; },
      async loadSchemaForGame() { return { game: { availableGameStats: { achievements: schema } } }; },
      async loadPlayerSummaries() { throw new Error("unused"); },
      async loadSteamLevel() { throw new Error("unused"); },
      async loadBadges() { throw new Error("unused"); },
      async loadRecentlyPlayedGames() { throw new Error("unused"); },
      async loadGlobalAchievementPercentagesForApp() { throw new Error("unused"); },
    };
    const config = normalizeSteamProviderConfig({
      steamId64: "12345678901234567",
      hasApiKey: true,
      language: "english",
      recentAchievementsCount: 1,
      recentlyPlayedCount: 1,
      includePlayedFreeGames: false,
    });
    const initial = await scanSteamLibraryAchievements(config, { client });
    assert.equal(initial.unlockedAchievements, 825);
    const refreshed = await refreshSteamLibraryAchievementProgress(config, initial, { client });
    assert.equal(refreshed.unlockedAchievements, 825);
    assert.equal(refreshed.games[0]?.unlockedAchievements, 825);

    const newer = { ...refreshed, unlockedAchievements: 826 };
    const stale = { ...refreshed, unlockedAchievements: 812 };
    writeDeckySteamLibraryAchievementScanSummary(newer);
    const expectedRevision = getDeckySteamLibraryAchievementScanRevision();
    writeDeckySteamLibraryAchievementScanSummary({ ...newer, unlockedAchievements: 827 });
    assert.equal(
      writeDeckySteamLibraryAchievementScanSummaryIfRevisionMatches(expectedRevision, stale),
      false,
    );
    assert.equal(readDeckySteamLibraryAchievementScanSummary("steam")?.unlockedAchievements, 827);

    const cached = await refreshAndCacheDeckySteamLibraryAchievementProgress(config, { client });
    assert.equal(cached?.unlockedAchievements, 825);
  });
});

test("Steam scan and incremental refresh serialize so older work cannot overwrite the later operation", async () => {
  await withMockDeckyStorage(async () => {
    const config = normalizeSteamProviderConfig({
      steamId64: "12345678901234567",
      hasApiKey: true,
      language: "english",
      recentAchievementsCount: 1,
      recentlyPlayedCount: 1,
      includePlayedFreeGames: false,
    });
    const ownedGames: RawSteamOwnedGame[] = [{ appid: 77, name: "Race Test" }];
    const oldPlayerState: RawSteamPlayerAchievement[] = [
      { apiname: "A", achieved: 0 },
      { apiname: "B", achieved: 0 },
    ];
    const newPlayerState: RawSteamPlayerAchievement[] = [
      { apiname: "A", achieved: 1, unlocktime: 1_800_000_001 },
      { apiname: "B", achieved: 1, unlocktime: 1_800_000_002 },
    ];
    writeDeckySteamLibraryAchievementScanSummary({
      scannedAt: "2026-09-01T00:00:00.000Z",
      ownedGameCount: 1,
      scannedGameCount: 1,
      gamesWithAchievements: 1,
      skippedGameCount: 0,
      failedGameCount: 0,
      totalAchievements: 2,
      unlockedAchievements: 0,
      perfectGames: 0,
      completionPercent: 0,
      games: [{
        appid: 77,
        id: "77",
        gameId: "77",
        title: "Race Test",
        providerId: "steam",
        totalAchievements: 2,
        unlockedAchievements: 0,
        completionPercent: 0,
        hasAchievements: true,
        scanStatus: "scanned",
        achievementSchema: [{ name: "A" }, { name: "B" }],
      }],
    });

    let notifyRefreshStarted: (() => void) | undefined;
    const refreshStarted = new Promise<void>((resolve) => { notifyRefreshStarted = resolve; });
    let releaseRefresh: (() => void) | undefined;
    const refreshGate = new Promise<void>((resolve) => { releaseRefresh = resolve; });
    const refreshClient: SteamClient = {
      async loadOwnedGames() { return { response: { game_count: 1, games: ownedGames } }; },
      async loadPlayerAchievements() {
        notifyRefreshStarted?.();
        await refreshGate;
        return { playerstats: { success: true, achievements: oldPlayerState } };
      },
      async loadSchemaForGame() { throw new Error("cached schema should be reused"); },
      async loadPlayerSummaries() { throw new Error("unused"); },
      async loadSteamLevel() { throw new Error("unused"); },
      async loadBadges() { throw new Error("unused"); },
      async loadRecentlyPlayedGames() { throw new Error("unused"); },
      async loadGlobalAchievementPercentagesForApp() { throw new Error("unused"); },
    };
    const scanClient: SteamClient = {
      async loadOwnedGames() { return { response: { game_count: 1, games: ownedGames } }; },
      async loadPlayerAchievements() { return { playerstats: { success: true, achievements: newPlayerState } }; },
      async loadSchemaForGame() { throw new Error("cached schema should be reused"); },
      async loadPlayerSummaries() { throw new Error("unused"); },
      async loadSteamLevel() { throw new Error("unused"); },
      async loadBadges() { throw new Error("unused"); },
      async loadRecentlyPlayedGames() { throw new Error("unused"); },
      async loadGlobalAchievementPercentagesForApp() { throw new Error("unused"); },
    };

    const refresh = refreshAndCacheDeckySteamLibraryAchievementProgress(config, { client: refreshClient });
    await refreshStarted;
    const scan = runAndCacheDeckySteamLibraryAchievementScan(config, { client: scanClient });
    releaseRefresh?.();
    await Promise.all([refresh, scan]);
    assert.equal(readDeckySteamLibraryAchievementScanSummary("steam")?.unlockedAchievements, 2);
  });
});

test("Steam account changes clear prior library state and old in-flight refreshes cannot write across accounts", async () => {
  await withMockDeckyStorage(async () => {
    const accountA = normalizeSteamProviderConfig({
      steamId64: "12345678901234567", hasApiKey: true, language: "english",
      recentAchievementsCount: 1, recentlyPlayedCount: 1, includePlayedFreeGames: false,
    });
    const accountB = normalizeSteamProviderConfig({
      steamId64: "22345678901234567", hasApiKey: true, language: "english",
      recentAchievementsCount: 1, recentlyPlayedCount: 1, includePlayedFreeGames: false,
    });
    deckyBackendTestState.steam.config = {
      ...accountA,
      hasApiKey: true,
    };
    deckyBackendTestState.steam.secret = "steam-test-secret";
    updateDeckyProviderConfigCache("steam", accountA);
    writeDeckySteamLibraryAchievementScanSummary({
      steamId64: accountA.steamId64,
      scannedAt: "2026-09-01T00:00:00.000Z",
      ownedGameCount: 1,
      scannedGameCount: 1,
      gamesWithAchievements: 1,
      skippedGameCount: 0,
      failedGameCount: 0,
      totalAchievements: 1,
      unlockedAchievements: 1,
      perfectGames: 1,
      completionPercent: 100,
      games: [{
        appid: 101,
        id: "101",
        gameId: "101",
        title: "Account A Game",
        providerId: "steam",
        totalAchievements: 1,
        unlockedAchievements: 1,
        completionPercent: 100,
        hasAchievements: true,
        scanStatus: "scanned",
      }],
    });

    let signalAccountAPlayerRequest: (() => void) | undefined;
    const accountAPlayerRequest = new Promise<void>((resolve) => { signalAccountAPlayerRequest = resolve; });
    let releaseAccountAPlayer: (() => void) | undefined;
    const accountAPlayerGate = new Promise<void>((resolve) => { releaseAccountAPlayer = resolve; });
    const accountAClient: SteamClient = {
      async loadOwnedGames() { return { response: { game_count: 1, games: [{ appid: 101, name: "Account A Game" }] } }; },
      async loadPlayerAchievements() {
        signalAccountAPlayerRequest?.();
        await accountAPlayerGate;
        return { playerstats: { success: true, achievements: [{ apiname: "A", achieved: 1 }] } };
      },
      async loadSchemaForGame() { return { game: { availableGameStats: { achievements: [{ name: "A" }] } } }; },
      async loadPlayerSummaries() { throw new Error("unused"); },
      async loadSteamLevel() { throw new Error("unused"); },
      async loadBadges() { throw new Error("unused"); },
      async loadRecentlyPlayedGames() { throw new Error("unused"); },
      async loadGlobalAchievementPercentagesForApp() { throw new Error("unused"); },
    };
    const accountARefresh = refreshAndCacheDeckySteamLibraryAchievementProgress(accountA, { client: accountAClient });
    await accountAPlayerRequest;

    assert.equal(await writeDeckySteamProviderConfig({
      steamId64: accountB.steamId64,
      language: accountB.language,
      recentAchievementsCount: accountB.recentAchievementsCount,
      recentlyPlayedCount: accountB.recentlyPlayedCount,
      includePlayedFreeGames: accountB.includePlayedFreeGames,
    }, ""), true);
    assert.equal(readDeckySteamLibraryAchievementScanSummary("steam"), undefined);

    const accountBClient: SteamClient = {
      async loadOwnedGames() { return { response: { game_count: 1, games: [{ appid: 202, name: "Account B Game" }] } }; },
      async loadPlayerAchievements() { return { playerstats: { success: true, achievements: [{ apiname: "B", achieved: 1 }] } }; },
      async loadSchemaForGame() { return { game: { availableGameStats: { achievements: [{ name: "B" }] } } }; },
      async loadPlayerSummaries() { throw new Error("unused"); },
      async loadSteamLevel() { throw new Error("unused"); },
      async loadBadges() { throw new Error("unused"); },
      async loadRecentlyPlayedGames() { throw new Error("unused"); },
      async loadGlobalAchievementPercentagesForApp() { throw new Error("unused"); },
    };
    const accountBRefresh = refreshAndCacheDeckySteamLibraryAchievementProgress(accountB, { client: accountBClient });
    releaseAccountAPlayer?.();
    await Promise.all([accountARefresh, accountBRefresh]);
    const activeSummary = readDeckySteamLibraryAchievementScanSummary("steam");
    assert.equal(activeSummary?.steamId64, accountB.steamId64);
    assert.deepStrictEqual(activeSummary?.games.map((game) => game.appid), [202]);
  });
});

test("Steam summary storage write failure retains the previous durable and in-memory summary", async () => {
  await withMockDeckyStorage(async () => {
    const existing: SteamLibraryAchievementScanSummary = {
      steamId64: "12345678901234567",
      scannedAt: "2026-09-01T00:00:00.000Z",
      ownedGameCount: 1,
      scannedGameCount: 1,
      gamesWithAchievements: 1,
      skippedGameCount: 0,
      failedGameCount: 0,
      totalAchievements: 100,
      unlockedAchievements: 50,
      perfectGames: 0,
      completionPercent: 50,
      games: [{
        appid: 1, id: "1", gameId: "1", title: "Known Game", providerId: "steam",
        totalAchievements: 100, unlockedAchievements: 50, completionPercent: 50,
        hasAchievements: true, scanStatus: "scanned",
        achievementSchema: [{ name: "A" }],
      }],
    };
    writeDeckySteamLibraryAchievementScanSummary(existing);
    const summaryKey = "achievement-companion:decky:steam:library-achievement-scan-summary";
    const storedInitial = JSON.parse(readDeckyStorageText(summaryKey) ?? "{}") as {
      games?: Array<Record<string, unknown>>;
    };
    assert.equal(storedInitial.games?.[0]?.["achievementSchema"], undefined);
    assert.equal(writeDeckySteamAchievementSchemaCache(existing.steamId64 ?? "", 1, [{ name: "A" }]), true);
    assert.deepStrictEqual(readDeckySteamAchievementSchemaCache(existing.steamId64 ?? "", 1), [{ name: "A" }]);
    const localStorageObject = globalThis.localStorage as Storage & { setItem: Storage["setItem"] };
    const originalSetItem = localStorageObject.setItem.bind(localStorageObject);
    Object.defineProperty(localStorageObject, "setItem", {
      configurable: true,
      value(key: string, value: string) {
        if (key === summaryKey) throw new Error("simulated storage quota failure");
        originalSetItem(key, value);
      },
    });
    try {
      const attempted = writeDeckySteamLibraryAchievementScanSummary({
        ...existing,
        unlockedAchievements: 40,
        completionPercent: 40,
      });
      assert.equal(attempted, false);
      assert.equal(readDeckySteamLibraryAchievementScanSummary("steam")?.unlockedAchievements, 50);
      assert.equal(JSON.parse(readDeckyStorageText(summaryKey) ?? "{}").unlockedAchievements, 50);
    } finally {
      Object.defineProperty(localStorageObject, "setItem", { configurable: true, value: originalSetItem });
    }
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

test("fullscreen settings uses native route history without an origin side channel", () => {
  const bootstrapSource = readFileSync(join("src", "platform", "decky", "bootstrap.tsx"), "utf8");
  const navigationSource = readFileSync(
    join("src", "platform", "decky", "decky-navigation.tsx"),
    "utf8",
  );
  const navigationStateSource = readFileSync(
    join("src", "platform", "decky", "decky-full-screen-navigation-state.ts"),
    "utf8",
  );

  assert.doesNotMatch(
    `${bootstrapSource}\n${navigationSource}\n${navigationStateSource}`,
    /FullScreenSettingsBackTarget|markNextFullScreenSettingsBackTarget|peekNextFullScreenSettingsBackTarget/u,
  );
  assert.match(navigationSource, /function DeckyFullScreenSettingsRoute/u);
  assert.doesNotMatch(navigationSource, /openedFromCompactPanel|showSteamProfileFooter=\{!/u);
});

test("steam game page achievement badge uses the route-patched header path without prototype UI", () => {
  const indexSource = readFileSync("src/index.tsx", "utf8");
  const bootstrapSource = readFileSync("src/platform/decky/bootstrap.tsx", "utf8");
  const runtimeDebugSource = readFileSync("src/platform/decky/decky-runtime-debug.ts", "utf8");
  const deckySystemPillSource = readFileSync("src/platform/decky/decky-system-pill.tsx", "utf8");
  const routeDetectionSource = readFileSync(
    "src/platform/decky/decky-game-page-achievement-route.ts",
    "utf8",
  );
  const navigationSource = readFileSync(
    "src/platform/decky/decky-navigation.tsx",
    "utf8",
  );
  const shortcutMetadataSource = readFileSync(
    "src/platform/decky/decky-steam-shortcut-metadata.ts",
    "utf8",
  );
  const retroClientSource = readFileSync("src/providers/retroachievements/client/client.ts", "utf8");
  const summarySource = readFileSync(
    "src/platform/decky/decky-game-page-achievement-summary.ts",
    "utf8",
  );
  const routeBadgeSource = readFileSync(
    "src/platform/decky/decky-game-page-achievement-bubble.tsx",
    "utf8",
  );
  const badgeSource = readFileSync(
    "src/platform/decky/decky-game-page-achievement-badge.tsx",
    "utf8",
  );
  const badgeThemeSource = readFileSync(
    "src/platform/decky/decky-game-page-achievement-badge-theme.tsx",
    "utf8",
  );
  const gameStatusIconSource = readFileSync(
    "src/platform/decky/decky-game-status-icon.tsx",
    "utf8",
  );
  const badgePresentationSource = readFileSync(
    "src/platform/decky/decky-game-page-achievement-badge-presentation.ts",
    "utf8",
  );
  const bubbleSource = `${routeBadgeSource}\n${badgeSource}\n${badgeThemeSource}\n${gameStatusIconSource}\n${badgePresentationSource}`;
  const routeBadgeStyleFunctionSource =
    routeBadgeSource.match(
      /function getDeckyGamePageAchievementRouteBadgeStyle\([\s\S]*?\r?\n\}\r?\n\r?\nfunction /u,
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
  assert.match(runtimeDebugSource, /achievement-companion:decky:last-game-page-badge-debug/u);
  assert.match(runtimeDebugSource, /achievement-companion:decky:last-ra-shortcut-resolution-debug/u);
  assert.match(runtimeDebugSource, /\[Achievement Companion\]\[Game Page Badge\]/u);
  assert.match(runtimeDebugSource, /\[Achievement Companion\]\[RA Shortcut Resolver\]/u);
  assert.match(runtimeDebugSource, /lastGamePageShortcutDetectedAppId/u);
  assert.match(runtimeDebugSource, /lastGamePageShortcutTitle/u);
  assert.match(runtimeDebugSource, /lastGamePageShortcutPlatform/u);
  assert.match(runtimeDebugSource, /lastGamePageShortcutDetectionReason/u);
  assert.match(runtimeDebugSource, /lastGamePageShortcutNextPath/u);
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
  assert.match(runtimeDebugSource, /markAchievementCompanionGamePageBadgeStatus/u);
  assert.match(runtimeDebugSource, /markAchievementCompanionGamePageShortcutDetected/u);
  assert.match(runtimeDebugSource, /updateAchievementCompanionGamePageBadgeDebug/u);
  assert.match(runtimeDebugSource, /updateAchievementCompanionRaShortcutResolutionDebug/u);
  assert.match(routeDetectionSource, /target-url-route/u);
  assert.match(routeDetectionSource, /DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_REGEX/u);
  assert.match(routeDetectionSource, /detectDeckyGamePageAchievementRouteFromUrl/u);
  assert.match(routeDetectionSource, /resolveDeckyGamePageAchievementAppIdFromRouteProps/u);
  assert.match(summarySource, /type GamePageAchievementSummary/u);
  assert.match(summarySource, /formatDeckyGamePageAchievementBadgeLabel/u);
  assert.match(summarySource, /formatDeckyGamePageAchievementBadgeLoadingText/u);
  assert.match(summarySource, /Checking game\.\.\./u);
  assert.match(summarySource, /Reading shortcut\.\.\./u);
  assert.match(summarySource, /Detecting ROM\.\.\./u);
  assert.match(summarySource, /Hashing ROM\.\.\./u);
  assert.match(summarySource, /RA lookup\.\.\./u);
  assert.match(summarySource, /Checking game media\.\.\./u);
  assert.match(summarySource, /Loading\.\.\./u);
  assert.match(summarySource, /requestSequenceRef\.current === requestSequence/u);
  assert.match(summarySource, /readDeckyGamePageAchievementSummaryRevision\(appId\) === requestRevision/u);
  assert.match(summarySource, /readDeckySteamLibraryAchievementScanSummary/u);
  assert.match(summarySource, /readDeckyDashboardSnapshotCacheEntry/u);
  assert.match(summarySource, /loadDeckySteamShortcutMetadata/u);
  assert.match(summarySource, /steam-shortcut-detected/u);
  assert.match(summarySource, /nextPath: "retroachievements"/u);
  assert.match(shortcutMetadataSource, /platformTag/u);
  assert.match(shortcutMetadataSource, /platformLabel/u);
  assert.match(shortcutMetadataSource, /tags/u);
  assert.match(shortcutMetadataSource, /exe/u);
  assert.match(shortcutMetadataSource, /startDir/u);
  assert.doesNotMatch(summarySource, /shortcut-title-match|titleFallbackUsed|matchesRetroAchievementsShortcutTitle/u);
  assert.match(summarySource, /hash-not-in-ra-catalogue/u);
  assert.match(summarySource, /loadDeckyGameDetailStateLazy\(STEAM_PROVIDER_ID, appId, \{\s*forceRefresh: false/u);
  assert.match(summarySource, /normalizeRetroAchievementsPlatformLabel/u);
  assert.match(summarySource, /nintendo game boy advance/u);
  assert.match(summarySource, /Game Boy Advance/u);
  assert.match(summarySource, /sega genesis/u);
  assert.match(summarySource, /PlayStation 2/u);
  assert.match(summarySource, /sony playstation 2/u);
  assert.match(summarySource, /loadRetroAchievementsGameListCandidatesForPlatform/u);
  assert.match(summarySource, /RetroAchievementsCompletionStatus/u);
  assert.match(summarySource, /normalizeRetroAchievementsCompletionStatus/u);
  assert.match(summarySource, /ra-detail-unavailable/u);
  assert.match(summarySource, /ra-platform-unsupported/u);
  assert.doesNotMatch(summarySource, /ra-provider-not-configured/u);
  assert.match(summarySource, /catalogue-unavailable/u);
  assert.match(summarySource, /loadDeckyGameDetailStateLazy\([\s\S]*?RETROACHIEVEMENTS_PROVIDER_ID/u);
  assert.match(summarySource, /normalizedPlatform/u);
  assert.match(summarySource, /resolvedConsoleId/u);
  assert.match(summarySource, /systemIconUrl/u);
  assert.match(summarySource, /unlockedCount/u);
  assert.match(summarySource, /totalCount/u);
  assert.match(retroClientSource, /API_GetGameList\.php/u);
  assert.match(retroClientSource, /loadGameList\(/u);
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
  assert.match(bubbleSource, /DeckyGamePageAchievementBadgeVisual/u);
  assert.match(bubbleSource, /resolveDeckyGamePageAchievementBadgePresentation/u);
  assert.match(bubbleSource, /resolveDeckyGamePageAchievementBadgeProviderIconUrl/u);
  assert.match(badgeThemeSource, /import infoIconUrl from "\.\/assets\/info\.svg"/u);
  assert.match(badgeThemeSource, /variant === "loading" \|\| provider === undefined/u);
  assert.match(badgeThemeSource, /variant === "loading" \|\| provider !== "retroachievements" \? \{ filter: "brightness\(0\) invert\(1\)" \}/u);
  assert.match(badgeThemeSource, /getProviderIconStyle\(presentation\.provider, presentation\.variant, dimensions\)/u);
  assert.match(badgeThemeSource, /strokeDasharray=\{loading \? `\$\{circumference \* presentation\.progress\} \$\{circumference \* \(1 - presentation\.progress\)\}` : circumference\}/u);
  assert.match(badgeThemeSource, /strokeDashoffset=\{loading \? 0 : dashOffset\}/u);
  assert.match(badgeThemeSource, /if \(presentation\.variant !== "loading"\) return;[\s\S]*?prefers-reduced-motion: reduce[\s\S]*?ring\.animate\([\s\S]*?reducedMotion\.addEventListener\("change", updateAnimation\)/u);
  assert.match(routeBadgeSource, /resolveDeckyGamePageAchievementBadgeProviderIconUrl\(presentation\.provider, presentation\.variant\)/u);
  assert.match(bubbleSource, /resolveDeckyGamePageAchievementBadgeCompletionStatus/u);
  assert.match(bubbleSource, /markAchievementCompanionGamePageBadgeStatus/u);
  assert.match(bubbleSource, /summary\.completionStatus/u);
  assert.match(bubbleSource, /"perfected"/u);
  assert.match(bubbleSource, /BEATEN/u);
  assert.match(bubbleSource, /MASTERED/u);
  assert.match(bubbleSource, /IN PROGRESS/u);
  assert.match(bubbleSource, /PLEASE WAIT\.\.\./u);
  assert.match(bubbleSource, /data-ac-game-page-badge-status-icon="crown-laurel"/u);
  assert.match(bubbleSource, /assets\/achievement-badge\/crown-laurel\.svg/u);
  assert.doesNotMatch(bubbleSource, /assets\/achievement-badge\/(?:crown|laurel)\.svg/u);
  assert.match(bubbleSource, /data-ac-game-page-badge-status-icon="flag"/u);
  assert.match(bubbleSource, /data-ac-game-page-badge-status-icon="bars"/u);
  assert.match(bubbleSource, /assets\/steam\.svg/u);
  assert.match(bubbleSource, /RETROACHIEVEMENTS_PROVIDER_ICON_SRC/u);
  assert.match(bubbleSource, /strokeDashoffset/u);
  assert.match(bubbleSource, /PROGRESS_RING_STROKE_WIDTH = 7\.5/u);
  assert.match(bubbleSource, /data-ac-game-page-badge-gloss="true"/u);
  assert.match(bubbleSource, /radial-gradient\(120% 90% at 42% -24%/u);
  assert.match(bubbleSource, /radial-gradient\(70% 58% at 44% 0%/u);
  assert.match(bubbleSource, /data-ac-game-page-badge-variant/u);
  assert.match(bubbleSource, /GAME_PAGE_ACHIEVEMENT_BADGE_FOCUS_CSS/u);
  assert.match(bubbleSource, /\.ac-game-page-achievement-badge:is\(\.gpfocus,\.gpfocuswithin,:focus,:focus-within\)/u);
  assert.match(bubbleSource, /background: transparent !important/u);
  assert.match(bubbleSource, /border: 0 solid transparent !important/u);
  assert.match(bubbleSource, /box-shadow: none !important/u);
  assert.doesNotMatch(bubbleSource, /🏆/u);
  assert.match(bubbleSource, /summary\.provider === "steam"/u);
  assert.match(bubbleSource, /summary\.provider === "retroachievements"/u);
  assert.match(bubbleSource, /iconUrl !== undefined/u);
  assert.match(bubbleSource, /useDeckyGamePageAchievementBadgeActivation/u);
  assert.match(bubbleSource, /resolveDeckyGamePageAchievementBadgeNavigationTarget/u);
  assert.match(bubbleSource, /openDeckyFullScreenGameFromLibraryGamePage/u);
  assert.match(bubbleSource, /routerHook\.addPatch\(DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN/u);
  assert.match(bubbleSource, /routerHook\.removePatch\(DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN/u);
  assert.match(bubbleSource, /Game-page achievement badge activated/u);
  assert.match(bubbleSource, /useGamePageAchievementSummary/u);
  assert.match(bubbleSource, /formatDeckyGamePageAchievementBadgeLabel/u);
  assert.match(bubbleSource, /position:\s*"absolute"/u);
  assert.match(bubbleSource, /DECKY_GAME_PAGE_ROUTE_BADGE_CANDIDATE_SLOTS/u);
  assert.match(bubbleSource, /top-left/u);
  assert.match(bubbleSource, /top-right/u);
  assert.match(bubbleSource, /top-center/u);
  assert.match(bubbleSource, /bottom-left/u);
  assert.match(bubbleSource, /bottom-center/u);
  assert.match(bubbleSource, /bottom-right/u);
  assert.match(bubbleSource, /top:\s*56/u);
  assert.doesNotMatch(bubbleSource, /<span style=\{getDeckyGamePageAchievementBadgeCountStyle\(\)\}>…<\/span>/u);
  assert.match(bubbleSource, /const maxTop = heroBottom - badgeHeight - DECKY_GAME_PAGE_ROUTE_BADGE_COLLISION_PADDING/u);
  assert.match(bubbleSource, /left:\s*32/u);
  assert.match(
    bubbleSource,
    /position:\s*"absolute",\s*top,\s*visibility:\s*heroMeasured \? "visible" : "hidden",\s*left:\s*slot\.left,\s*right:\s*slot\.right[\s\S]*background:\s*"transparent"[\s\S]*boxShadow:\s*"none"[\s\S]*zIndex:\s*1000/u,
  );
  assert.doesNotMatch(routeBadgeStyleFunctionSource, /getDeckyGamePageAchievementBadgeBaseStyle/u);
  assert.match(bubbleSource, /chooseDeckyGamePageAchievementRouteBadgePlacement/u);
  assert.match(bubbleSource, /collectDeckyGamePageAchievementRouteBadgeObstacleRects/u);
  assert.match(bubbleSource, /resolveDeckyGamePageAchievementRouteBadgeContainer/u);
  assert.match(bubbleSource, /DECKY_GAME_PAGE_ROUTE_BADGE_COLLISION_PADDING = 12/u);
  assert.match(bubbleSource, /querySelectorAll<HTMLElement>\("\*"\)/u);
  assert.match(bubbleSource, /offsetParent/u);
  assert.match(bubbleSource, /getBoundingClientRect/u);
  assert.match(bubbleSource, /markAchievementCompanionGamePageRouteBadgePlacement/u);
  assert.match(bubbleSource, /rejectedReasons/u);
  assert.match(runtimeDebugSource, /placementRejectedReasons/u);
  assert.match(bubbleSource, /markAchievementCompanionGamePageBadgeHidden/u);
  assert.match(bubbleSource, /summary-unset/u);
  assert.match(bubbleSource, /collision-/u);
  assert.match(bubbleSource, /fallbackUsed:\s*false/u);
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
  assert.match(bubbleSource, /noFocusRing/u);
  assert.match(bubbleSource, /tabIndex=\{0\}/u);
  assert.match(bubbleSource, /Open Achievement Companion details for app/u);
  assert.match(bubbleSource, /onActivate\?\.\(\)/u);
  assert.match(bubbleSource, /event\.key === "Enter" \|\| event\.key === " "/u);
  assert.match(bubbleSource, /markAchievementCompanionGamePageBadgeActivated/u);
  assert.match(bubbleSource, /reportAchievementCompanionGamePageBadgeNavigationError/u);
  assert.match(bubbleSource, /if \(badgeLabel === undefined \|\| presentation === undefined\) \{\s*return null;\s*\}/u);
  assert.match(routeBadgeStyleFunctionSource, /visibility: heroMeasured \? "visible" : "hidden"/u);
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

test("game page achievement badge formatter shows stage-aware loading and ready states but hides unavailable and error states", () => {
  assert.equal(formatDeckyGamePageAchievementBadgeLoadingText(undefined, {}), "\u{1f3c6} Checking game...");
  assert.equal(
    formatDeckyGamePageAchievementBadgeLoadingText(
      {
        status: "loading",
        appId: "1672970",
      },
      {
        lastSummaryStatus: "loading",
        lastSummaryFetchStartedAt: "2026-07-07T00:00:00.000Z",
        lastRetroAchievementsShortcutAppId: "1672970",
      },
    ),
    "\u{1f3c6} Reading shortcut...",
  );
  assert.equal(
    formatDeckyGamePageAchievementBadgeLoadingText(
      {
        status: "loading",
        appId: "1672970",
      },
      {
        lastSummaryStatus: "loading",
        lastSummaryFetchStartedAt: "2026-07-07T00:00:00.000Z",
        lastRetroAchievementsShortcutAppId: "1672970",
        lastRetroAchievementsShortcutRomPathDetected: true,
      },
    ),
    "\u{1f3c6} Detecting ROM...",
  );
  assert.equal(
    formatDeckyGamePageAchievementBadgeLoadingText(
      {
        status: "loading",
        appId: "1672970",
      },
      {
        lastSummaryStatus: "loading",
        lastSummaryFetchStartedAt: "2026-07-07T00:00:00.000Z",
        lastRetroAchievementsResolutionSource: "rom-hash",
        lastRetroAchievementsRomHashAttempted: true,
      },
    ),
    "\u{1f3c6} Hashing ROM...",
  );
  assert.equal(
    formatDeckyGamePageAchievementBadgeLoadingText(
      {
        status: "loading",
        appId: "1672970",
      },
      {
        lastSummaryStatus: "loading",
        lastSummaryFetchStartedAt: "2026-07-07T00:00:00.000Z",
        lastRetroAchievementsResolutionSource: "ra-hash-game-detail",
      },
    ),
    "\u{1f3c6} RA lookup...",
  );
  assert.equal(
    formatDeckyGamePageAchievementBadgeLoadingText(
      {
        status: "loading",
        appId: "1672970",
      },
      {
        lastSummaryStatus: "loading",
        lastSummaryFetchStartedAt: "2026-07-07T00:00:00.000Z",
      },
    ),
    "\u{1f3c6} Loading...",
  );
  assert.equal(
    formatDeckyGamePageAchievementBadgeLoadingText(
      {
        status: "loading",
        appId: "1672970",
      },
      {
        lastSummaryStatus: "loading",
        lastSummaryFetchStartedAt: "2026-07-07T00:00:00.000Z",
        lastRetroAchievementsResolutionSource: "ra-hash-game-detail",
      },
    ),
    "\u{1f3c6} RA lookup...",
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
    "\u{1f3c6} 12 / 45",
  );
  assert.equal(
    formatDeckyGamePageAchievementBadgeLabel({
      status: "unavailable",
      appId: "2217040867",
      reason: "rom-path-unavailable",
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

test("game page achievement badge presentation follows the neon specification variants", () => {
  assert.deepStrictEqual(resolveDeckyGamePageAchievementBadgePresentation(undefined), {
    ariaLabel: "Achievement Companion, please wait",
    variant: "loading",
    statusLabel: "PLEASE WAIT...",
    countLabel: "-- / --",
    progress: 0.18,
  });

  assert.deepStrictEqual(
    resolveDeckyGamePageAchievementBadgePresentation({
      status: "loading",
      appId: "11",
      provider: "retroachievements",
    }),
    {
      ariaLabel: "Achievement Companion, please wait",
      provider: "retroachievements",
      variant: "loading",
      statusLabel: "PLEASE WAIT...",
      countLabel: "-- / --",
      progress: 0.18,
    },
  );

  assert.deepStrictEqual(
    resolveDeckyGamePageAchievementBadgePresentation({
      status: "ready",
      provider: "steam",
      appId: "10",
      earned: 42,
      total: 42,
      source: "cache",
    }),
    {
      ariaLabel: "Open Achievement Companion details for app 10, perfected, 42 / 42",
      provider: "steam",
      variant: "perfected",
      statusLabel: "PERFECTED",
      countLabel: "42 / 42",
      progress: 1,
    },
  );

  assert.deepStrictEqual(
    resolveDeckyGamePageAchievementBadgePresentation({
      status: "ready",
      provider: "retroachievements",
      appId: "11",
      earned: 12,
      total: 15,
      source: "cache",
      completionStatus: "beaten",
    }),
    {
      ariaLabel: "Open Achievement Companion details for app 11, beaten, 12 / 15",
      provider: "retroachievements",
      variant: "beaten",
      statusLabel: "BEATEN",
      countLabel: "12 / 15",
      progress: 0.8,
    },
  );

  assert.deepStrictEqual(
    resolveDeckyGamePageAchievementBadgePresentation({
      status: "ready",
      provider: "retroachievements",
      appId: "12",
      earned: 23,
      total: 23,
      source: "cache",
      completionStatus: "mastered",
    }),
    {
      ariaLabel: "Open Achievement Companion details for app 12, mastered, 23 / 23",
      provider: "retroachievements",
      variant: "mastered",
      statusLabel: "MASTERED",
      countLabel: "23 / 23",
      progress: 1,
    },
  );

  assert.deepStrictEqual(
    resolveDeckyGamePageAchievementBadgePresentation({
      status: "ready",
      provider: "retroachievements",
      appId: "12a",
      gameId: "9300",
      earned: 10,
      total: 10,
      source: "snapshot",
    }),
    {
      ariaLabel: "Achievement Companion, please wait",
      provider: "retroachievements",
      variant: "loading",
      statusLabel: "PLEASE WAIT...",
      countLabel: "-- / --",
      progress: 0.18,
    },
  );

  assert.deepStrictEqual(
    resolveDeckyGamePageAchievementBadgePresentation({
      status: "ready",
      provider: "retroachievements",
      appId: "12b",
      gameId: "9302",
      earned: 2,
      total: 8,
      source: "backend",
      completionStatus: "in-progress",
    }),
    {
      ariaLabel: "Open Achievement Companion details for app 12b, in progress, 2 / 8",
      provider: "retroachievements",
      variant: "in-progress",
      statusLabel: "IN PROGRESS",
      countLabel: "2 / 8",
      progress: 0.25,
    },
  );

  assert.deepStrictEqual(
    resolveDeckyGamePageAchievementBadgePresentation({
      status: "ready",
      provider: "steam",
      appId: "13",
      earned: 8,
      total: 20,
      source: "cache",
    }),
    {
      ariaLabel: "Open Achievement Companion details for app 13, in progress, 8 / 20",
      provider: "steam",
      variant: "in-progress",
      statusLabel: "IN PROGRESS",
      countLabel: "8 / 20",
      progress: 0.4,
    },
  );

  assert.equal(
    resolveDeckyGamePageAchievementBadgePresentation({
      status: "unavailable",
      appId: "14",
      reason: "no-achievements",
    }),
    undefined,
  );
});

test("native game-page summaries fail to loading when the route app identity changes", () => {
  const priorSummary = {
    status: "ready" as const,
    provider: "retroachievements" as const,
    appId: "11",
    gameId: "9300",
    earned: 12,
    total: 15,
    source: "cache" as const,
    completionStatus: "beaten" as const,
  };

  assert.equal(
    selectDeckyGamePageAchievementSummaryForAppId(priorSummary, undefined),
    undefined,
  );
  assert.equal(
    selectDeckyGamePageAchievementSummaryForAppId(priorSummary, "11"),
    priorSummary,
  );
  assert.deepStrictEqual(
    selectDeckyGamePageAchievementSummaryForAppId(priorSummary, "12"),
    {
      status: "loading",
      appId: "12",
    },
  );
});

test("game page achievement badge color preferences preserve defaults and recolor complete variants", () => {
  assert.equal(resolveDeckyGamePageAchievementBadgeColor("perfected"), "purple");
  assert.equal(resolveDeckyGamePageAchievementBadgeColor("mastered"), "gold");
  assert.equal(resolveDeckyGamePageAchievementBadgeColor("beaten"), "blue");
  assert.equal(resolveDeckyGamePageAchievementBadgeColor("in-progress"), "gray");
  assert.equal(
    resolveDeckyGamePageAchievementBadgeColor("loading", {
      perfected: "red",
      mastered: "red",
      beaten: "red",
      inProgress: "red",
    }),
    "gray",
  );

  assert.equal(
    resolveDeckyGamePageAchievementBadgePalette("perfected", {
      perfected: "gold",
      mastered: "green",
      beaten: "blue",
      inProgress: "gray",
    }).accent,
    "#ffc83d",
  );
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

test("game page achievement summary keeps Steam results when no shortcut metadata exists even if RetroAchievements data also exists", async () => {
  await withMockDeckyStorage(async () => {
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
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

test("decky retroachievements platform labels normalize common SRM and canonical labels", () => {
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo Entertainment System"), "NES/Famicom");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo SNES (Super Nintendo)"), "SNES/Super Famicom");
  assert.equal(
    normalizeRetroAchievementsPlatformLabel("Nintendo SNES (Super Nintendo) HD - bsnes-hd"),
    "SNES/Super Famicom",
  );
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo SNES"), "SNES/Super Famicom");
  assert.equal(normalizeRetroAchievementsPlatformLabel("SFC"), "SNES/Super Famicom");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo NES (Nintendo Entertainment System)"), "NES/Famicom");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo NES"), "NES/Famicom");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo Game Boy"), "Game Boy");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo Game Boy Advance"), "Game Boy Advance");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo Game Boy Color"), "Game Boy Color");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo GameCube"), "GameCube");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo 64"), "Nintendo 64");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo DS"), "Nintendo DS");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo DS - melonDS (Standalone)"), "Nintendo DS");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo 3DS - Azahar (Standalone)"), "Nintendo 3DS");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo Virtual Boy"), "Virtual Boy");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo Wii"), "Wii");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo Wii U - Cemu Native"), "Wii U");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Sega CD/Mega CD"), "Sega CD");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Sega Game Gear"), "Game Gear");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Sega Genesis/Mega Drive"), "Genesis/Mega Drive");
  assert.equal(
    normalizeRetroAchievementsPlatformLabel("Sega Genesis/Mega Drive WideScreen"),
    "Genesis/Mega Drive",
  );
  assert.equal(normalizeRetroAchievementsPlatformLabel("Sega Master System"), "Master System");
  assert.equal(normalizeRetroAchievementsPlatformLabel("NEC PC Engine/TurboGrafx 16"), "PC Engine/TurboGrafx-16");
  assert.equal(
    normalizeRetroAchievementsPlatformLabel("NEC PC Engine/TurboGrafx 16 CD"),
    "PC Engine CD/TurboGrafx-CD",
  );
  assert.equal(normalizeRetroAchievementsPlatformLabel("Sony PlayStation 2"), "PlayStation 2");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Sony PlayStation"), "PlayStation");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Sega Dreamcast"), "Dreamcast");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Sony PlayStation Portable"), "PlayStation Portable");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Arcade"), "Arcade");
  assert.equal(normalizeRetroAchievementsPlatformLabel("SNES/Super Famicom"), "SNES/Super Famicom");
  assert.equal(normalizeRetroAchievementsPlatformLabel("NES/Famicom"), "NES/Famicom");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Game Boy"), "Game Boy");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Game Boy Advance"), "Game Boy Advance");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Game Boy Color"), "Game Boy Color");
  assert.equal(normalizeRetroAchievementsPlatformLabel("GameCube"), "GameCube");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Genesis/Mega Drive"), "Genesis/Mega Drive");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Master System"), "Master System");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Virtual Boy"), "Virtual Boy");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Wii"), "Wii");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Wii U"), "Wii U");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo 3DS"), "Nintendo 3DS");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Nintendo DS"), "Nintendo DS");
  assert.equal(normalizeRetroAchievementsPlatformLabel("PC Engine/TurboGrafx-16"), "PC Engine/TurboGrafx-16");
  assert.equal(normalizeRetroAchievementsPlatformLabel("PC Engine CD/TurboGrafx-CD"), "PC Engine CD/TurboGrafx-CD");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Sega CD"), "Sega CD");
  assert.equal(normalizeRetroAchievementsPlatformLabel("Game Gear"), "Game Gear");
  assert.equal(normalizeRetroAchievementsPlatformLabel("PlayStation 2"), "PlayStation 2");
});

test("native RA completion status enrichment maps authoritative completed awards to mastered", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    deckyBackendTestState.retroAchievements.gameProgressByGameId = {
      "9200": createRetroAchievementsGameProgressResponse({
        gameId: "9200",
        title: "Homebrew Test",
        highestAwardKind: "completed",
        unlockedCount: 57,
        totalCount: 57,
      }),
    };
    const plainSummary = {
      status: "ready" as const,
      provider: "retroachievements" as const,
      appId: "2493414764",
      gameId: "9200",
      title: "Homebrew Test",
      earned: 57,
      total: 57,
      source: "snapshot" as const,
    };

    const enrichedSummary = await enrichDeckyGamePageAchievementSummaryCompletionStatus(plainSummary);
    assert.equal(enrichedSummary.status, "ready");
    if (enrichedSummary.status !== "ready") {
      return;
    }
    assert.equal(enrichedSummary.completionStatus, "mastered");
    assert.equal(deckyBackendTestState.retroAchievements.gameProgressRequestCount, 1);
  });
});

test("native RA completion status enrichment fails closed and never infers status from counts", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    deckyBackendTestState.retroAchievements.gameProgressByGameId = {
      "9300": createRetroAchievementsGameProgressResponse({
        gameId: "9300",
        title: "No Award State",
        unlockedCount: 10,
        totalCount: 10,
      }),
    };
    const fullCountsSummary = {
      status: "ready" as const,
      provider: "retroachievements" as const,
      appId: "2493414765",
      gameId: "9300",
      earned: 10,
      total: 10,
      source: "snapshot" as const,
    };

    const unavailableEnrichment = await enrichDeckyGamePageAchievementSummaryCompletionStatus(fullCountsSummary);
    assert.deepStrictEqual(unavailableEnrichment, {
      status: "unavailable",
      appId: fullCountsSummary.appId,
      reason: "ra-completion-status-unresolved",
    });
    assert.equal(
      getAchievementCompanionLastRaShortcutResolutionDebug()?.completionStatusEnrichmentStatus,
      "unavailable",
    );

    clearDeckyGamePageAchievementSummaryCacheForTests();
    const failedSummary = {
      ...fullCountsSummary,
      appId: "2493414766",
      gameId: "9301",
      earned: 2,
      total: 8,
    };
    const failedEnrichment = await enrichDeckyGamePageAchievementSummaryCompletionStatus(failedSummary);
    assert.deepStrictEqual(failedEnrichment, {
      status: "unavailable",
      appId: failedSummary.appId,
      reason: "ra-completion-status-unresolved",
    });
    assert.equal(
      getAchievementCompanionLastRaShortcutResolutionDebug()?.completionStatusEnrichmentStatus,
      "failed",
    );

    assert.deepStrictEqual(
      await enrichDeckyGamePageAchievementSummaryCompletionStatus({
        ...fullCountsSummary,
        appId: "2493414767",
        gameId: undefined,
      }),
      {
        status: "unavailable",
        appId: "2493414767",
        reason: "ra-completion-status-game-id-unavailable",
      },
    );

    deckyBackendTestState.retroAchievements.gameProgressByGameId = {
      "9302": createRetroAchievementsGameProgressResponse({
        gameId: "9302",
        title: "Still Playing",
        unlockedCount: 2,
        totalCount: 8,
      }),
    };
    const inProgressEnrichment = await enrichDeckyGamePageAchievementSummaryCompletionStatus({
      ...fullCountsSummary,
      appId: "2493414768",
      gameId: "9302",
      earned: 2,
      total: 8,
    });
    assert.equal(inProgressEnrichment.status, "ready");
    if (inProgressEnrichment.status === "ready") {
      assert.equal(inProgressEnrichment.completionStatus, "in-progress");
    }
  });
});

test("native completion status enrichment skips summaries that already have RA status or belong to Steam", async () => {
  await withMockDeckyStorage(async () => {
    const hashResolvedSummary = {
      status: "ready" as const,
      provider: "retroachievements" as const,
      appId: "2493414762",
      gameId: "9001",
      earned: 16,
      total: 33,
      source: "backend" as const,
      completionStatus: "beaten" as const,
    };
    const steamSummary = {
      status: "ready" as const,
      provider: "steam" as const,
      appId: "1672970",
      gameId: "1672970",
      earned: 12,
      total: 45,
      source: "cache" as const,
    };

    assert.strictEqual(
      await enrichDeckyGamePageAchievementSummaryCompletionStatus(hashResolvedSummary),
      hashResolvedSummary,
    );
    assert.strictEqual(
      await enrichDeckyGamePageAchievementSummaryCompletionStatus(steamSummary),
      steamSummary,
    );
    assert.equal(deckyBackendTestState.retroAchievements.gameProgressRequestCount ?? 0, 0);
  });
});

test("decky steam shortcut metadata loader preserves platform and path metadata", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2874315920": {
        title: "Final Fantasy X International",
        platformTag: "Sony PlayStation 2",
        tags: ["Sony PlayStation 2"],
        exe: '"/usr/bin/pcsx2"',
        startDir: "/home/deck/Emulation/roms/ps2",
      },
    };

    const metadata = await loadDeckySteamShortcutMetadata("2874315920");
    assert.deepStrictEqual(metadata, {
      appId: "2874315920",
      title: "Final Fantasy X International",
      platformTag: "Sony PlayStation 2",
      platformLabel: "Sony PlayStation 2",
      tags: ["Sony PlayStation 2"],
      exe: '"/usr/bin/pcsx2"',
      startDir: "/home/deck/Emulation/roms/ps2",
    });
  });
});

test("decky steam shortcut metadata loader accepts a missing display title", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2874315920": {
        platformTag: "Game Boy Advance",
        exe: '"/usr/bin/retroarch" "/home/deck/roms/game.gba"',
      },
    };

    const metadata = await loadDeckySteamShortcutMetadata("2874315920");
    assert.deepStrictEqual(metadata, {
      appId: "2874315920",
      platformTag: "Game Boy Advance",
      platformLabel: "Game Boy Advance",
      exe: '"/usr/bin/retroarch" "/home/deck/roms/game.gba"',
    });
  });
});

test("decky steam shortcut rom hash loader preserves sanitized hash metadata", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    deckyBackendTestState.steam.shortcutRomHashByAppId = {
      "2874315920": {
        shortcutRomPathDetected: true,
        shortcutRomPathSource: "launchoptions",
        romHashAttempted: true,
        romHashStatus: "resolved",
        romHashAlgorithm: "rcheevos",
        romHash: "ABCDEF1234567890ABCDEF1234567890",
      },
    };

    const hashInfo = await loadDeckySteamShortcutRomHashInfo("2874315920", 18);
    assert.deepStrictEqual(hashInfo, {
      appId: "2874315920",
      shortcutRomPathDetected: true,
      shortcutRomPathSource: "launchoptions",
      romHashAttempted: true,
      romHashStatus: "resolved",
      romHashAlgorithm: "rcheevos",
      romHash: "abcdef1234567890abcdef1234567890",
    });
    assert.deepStrictEqual(deckyBackendTestState.steam.hashRequestedConsoleIds, [18]);
  });
});

test("game page achievement summary resolves a RetroAchievements shortcut from its accepted ROM hash", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2493414762": {
        title: "My Zombie Game",
        platformTag: "Nintendo 64",
        platformLabel: "Nintendo 64",
        tags: ["Nintendo 64"],
      },
    };
    deckyBackendTestState.steam.shortcutRomHashByAppId = {
      "2493414762": {
        shortcutRomPathDetected: true,
        shortcutRomPathSource: "launchoptions",
        romHashAttempted: true,
        romHashStatus: "resolved",
        romHashAlgorithm: "rcheevos",
        romHash: "DEADBEEFDEADBEEFDEADBEEFDEADBEEF",
      },
    };
    deckyBackendTestState.retroAchievements.systems = [
      {
        ID: 2,
        Name: "Nintendo 64",
        IconURL: "https://example.com/n64.png",
      },
    ];
    deckyBackendTestState.retroAchievements.gameListByConsoleId = {
      "2": [
        {
          GameID: 9001,
          Title: "~Homebrew~ Pyoro 64",
          ConsoleID: 2,
          ConsoleName: "Nintendo 64",
          Hashes: ["deadbeefdeadbeefdeadbeefdeadbeef"],
        },
      ],
    };
    deckyBackendTestState.retroAchievements.gameProgressByGameId = {
      "9001": createRetroAchievementsGameProgressResponse({
        gameId: "9001",
        title: "~Homebrew~ Pyoro 64",
        consoleId: 2,
        consoleName: "Nintendo 64",
        highestAwardKind: "beaten",
        unlockedCount: 16,
        totalCount: 33,
      }),
    };

    const summary = await loadDeckyGamePageAchievementSummary("2493414762");
    assert.equal(summary.status, "ready");
    if (summary.status !== "ready") {
      return;
    }

    assert.equal(summary.provider, "retroachievements");
    assert.equal(summary.gameId, "9001");
    assert.equal(summary.title, "~Homebrew~ Pyoro 64");
    assert.equal(summary.earned, 16);
    assert.equal(summary.total, 33);
    assert.equal(summary.completionStatus, "beaten");
    assert.equal(summary.platformLabel, "Nintendo 64");
    assert.equal(summary.systemIconUrl, "https://example.com/n64.png");

    const badgeDebug = getAchievementCompanionLastGamePageBadgeDebug();
    const runtimeDebugState = getAchievementCompanionRuntimeDebugState();
    assert.equal(badgeDebug?.summaryCompletionStatus, "beaten");
    assert.equal(runtimeDebugState.lastRetroAchievementsShortcutAppId, "2493414762");
    assert.equal(runtimeDebugState.lastRetroAchievementsShortcutTitle, "My Zombie Game");
    assert.deepStrictEqual(deckyBackendTestState.steam.hashRequestedConsoleIds, [2]);
    assert.equal(runtimeDebugState.lastRetroAchievementsShortcutPlatform, "Nintendo 64");
    assert.equal(runtimeDebugState.lastRetroAchievementsNormalizedPlatform, "Nintendo 64");
    assert.equal(runtimeDebugState.lastRetroAchievementsHashResolverAttempted, true);
    assert.equal(runtimeDebugState.lastRetroAchievementsRomHashStatus, "resolved");
    assert.equal(runtimeDebugState.lastRetroAchievementsRaHashLookupAttempted, true);
    assert.equal(runtimeDebugState.lastRetroAchievementsRaHashLookupStatus, "matched");
    assert.equal(runtimeDebugState.lastRetroAchievementsRaHashMatchedGameId, "9001");
    assert.equal(runtimeDebugState.lastRetroAchievementsRaHashMatchedTitle, "~Homebrew~ Pyoro 64");
    assert.equal(runtimeDebugState.lastRetroAchievementsResolvedSystemName, "Nintendo 64");
    assert.equal(runtimeDebugState.lastRetroAchievementsResolvedConsoleId, "2");
    assert.equal(runtimeDebugState.lastRetroAchievementsFinalResolverSource, "hash");
    assert.equal(runtimeDebugState.lastRetroAchievementsResolutionSource, "ra-hash-game-detail");
    assert.equal(runtimeDebugState.lastRetroAchievementsResolutionReason, "ra-hash-match");
    assert.equal(runtimeDebugState.lastRetroAchievementsCandidateCount, 1);
  });
});

test("direct-ROM identity is invariant under four unrelated Steam shortcut names", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice", hasApiKey: true, recentAchievementsCount: 5, recentlyPlayedCount: 5,
    });
    const cases = [
      { appId: "240001", tag: "Nintendo Game Boy Advance", consoleId: 5, name: "Game Boy Advance", hash: "11111111111111111111111111111111", gameId: "5001" },
      { appId: "240002", tag: "Nintendo Game Boy Color", consoleId: 6, name: "Game Boy Color", hash: "11111111111111111111111111111111", gameId: "6001" },
      { appId: "240003", tag: "Sega Genesis/Mega Drive", consoleId: 1, name: "Genesis/Mega Drive", hash: "33333333333333333333333333333333", gameId: "1001" },
      { appId: "240004", tag: "Nintendo NES", consoleId: 7, name: "NES/Famicom", hash: "44444444444444444444444444444444", gameId: "7001" },
      { appId: "240005", tag: "Nintendo DS", consoleId: 18, name: "Nintendo DS", hash: "55555555555555555555555555555555", gameId: "18001" },
    ] as const;
    deckyBackendTestState.retroAchievements.systems = cases.map(({ consoleId, name }) => ({ ID: consoleId, Name: name }));
    deckyBackendTestState.retroAchievements.gameListByConsoleId = Object.fromEntries(cases.map(({ consoleId, name, hash, gameId }) => [String(consoleId), [
      { ID: Number(gameId), Title: `Catalogue ${gameId}`, ConsoleID: consoleId, ConsoleName: name, Hashes: [hash] },
    ]]));
    deckyBackendTestState.retroAchievements.gameProgressByGameId = Object.fromEntries(cases.map(({ consoleId, name, gameId }) => [gameId,
      createRetroAchievementsGameProgressResponse({ gameId, title: `Catalogue ${gameId}`, consoleId, consoleName: name, unlockedCount: 1, totalCount: 3 }),
    ]));
    for (const { appId, tag, consoleId, hash, gameId } of cases) {
      deckyBackendTestState.steam.shortcutRomHashByAppId ??= {};
      deckyBackendTestState.steam.shortcutRomHashByAppId[appId] = {
        shortcutRomPathDetected: true, shortcutRomPathSource: "exe", candidateCount: 1,
        candidateExtension: consoleId === 5 ? ".gba" : consoleId === 6 ? ".gbc" : consoleId === 1 ? ".md" : consoleId === 7 ? ".nes" : ".nds",
        romHashAttempted: true, romHashStatus: "resolved", romHashAlgorithm: "rcheevos", romHash: hash,
      };
      for (const title of ["Correct Game Name", "Wrong Name", "abcdef", "Completely Unrelated Title"]) {
        deckyBackendTestState.steam.shortcutMetadataByAppId ??= {};
        deckyBackendTestState.steam.shortcutMetadataByAppId[appId] = { title, platformTag: tag, tags: [tag] };
        invalidateDeckyGamePageAchievementSummaryCache(appId);
        const summary = await loadDeckyGamePageAchievementSummary(appId);
        assert.equal(summary.status, "ready", `${tag}: ${title}`);
        if (summary.status === "ready") assert.equal(summary.gameId, gameId);
        const debug = getAchievementCompanionLastRaShortcutResolutionDebug();
        assert.equal(debug.finalResolverSource, "hash");
        assert.equal(debug.finalResolutionMethod, "hash");
        assert.equal(debug.romCandidateCount, 1);
        assert.equal(debug.romHashAttempted, true);
        assert.equal(debug.romHashStatus, "resolved");
        assert.equal(debug.romHashPrefix, hash.slice(0, 12));
        assert.equal(debug.catalogueSource, "API_GetGameList");
        assert.equal(debug.raHashCatalogueMatchCount, 1);
        assert.equal(debug.apiSystemsResolvedConsoleId, String(consoleId));
      }
    }
    assert.deepStrictEqual(deckyBackendTestState.retroAchievements.gameListRequestedConsoleIds, ["5", "6", "1", "7", "18"]);
  });
});

test("RA catalogue merges multiple hashes per Game ID and normalizes hash casing", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice", hasApiKey: true, recentAchievementsCount: 5, recentlyPlayedCount: 5,
    });
    const firstApp = "250001";
    const secondApp = "250002";
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      [firstApp]: { title: "banana", platformTag: "Nintendo Game Boy Advance" },
      [secondApp]: { title: "different banana", platformTag: "Nintendo Game Boy Advance" },
    };
    deckyBackendTestState.steam.shortcutRomHashByAppId = {
      [firstApp]: { shortcutRomPathDetected: true, romHashAttempted: true, romHashStatus: "resolved", romHashAlgorithm: "rcheevos", romHash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
      [secondApp]: { shortcutRomPathDetected: true, romHashAttempted: true, romHashStatus: "resolved", romHashAlgorithm: "rcheevos", romHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    };
    deckyBackendTestState.retroAchievements.systems = [{ ID: 5, Name: "Game Boy Advance" }];
    deckyBackendTestState.retroAchievements.gameListByConsoleId = { "5": [
      { ID: 5001, Title: "Canonical catalogue name", ConsoleID: 5, Hashes: ["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"] },
      { ID: 5001, Title: "Canonical catalogue name", ConsoleID: 5, Hashes: ["BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"] },
    ] };
    deckyBackendTestState.retroAchievements.gameProgressByGameId = {
      "5001": createRetroAchievementsGameProgressResponse({ gameId: "5001", title: "Canonical catalogue name", consoleId: 5, consoleName: "Game Boy Advance", unlockedCount: 1, totalCount: 2 }),
    };
    const first = await loadDeckyGamePageAchievementSummary(firstApp);
    assert.equal(first.status, "ready");
    if (first.status === "ready") assert.equal(first.gameId, "5001");
    assert.equal(getAchievementCompanionLastRaShortcutResolutionDebug().catalogueCacheStatus, "fetched");
    const second = await loadDeckyGamePageAchievementSummary(secondApp);
    assert.equal(second.status, "ready");
    if (second.status === "ready") assert.equal(second.gameId, "5001");
    const debug = getAchievementCompanionLastRaShortcutResolutionDebug();
    assert.equal(debug.catalogueCacheStatus, "hit");
    assert.equal(debug.catalogueEntryCount, 1);
    assert.equal(debug.catalogueHashCount, 2);
    assert.equal(deckyBackendTestState.retroAchievements.gameListRequestCount, 1);
  });
});

test("incomplete RA catalogue responses are never cached as complete", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice", hasApiKey: true, recentAchievementsCount: 5, recentlyPlayedCount: 5,
    });
    const appId = "250003";
    deckyBackendTestState.steam.shortcutMetadataByAppId = { [appId]: { title: "unrelated", platformTag: "Nintendo Game Boy Advance" } };
    deckyBackendTestState.steam.shortcutRomHashByAppId = { [appId]: { shortcutRomPathDetected: true, romHashAttempted: true, romHashStatus: "resolved", romHashAlgorithm: "rcheevos", romHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } };
    deckyBackendTestState.retroAchievements.systems = [{ ID: 5, Name: "Game Boy Advance" }];
    deckyBackendTestState.retroAchievements.gameListByConsoleId = { "5": [
      { ID: 5001, Title: "Incomplete", ConsoleID: 5 },
    ] };
    const incomplete = await loadDeckyGamePageAchievementSummary(appId);
    assert.deepStrictEqual(incomplete, { status: "unavailable", appId, reason: "catalogue-incomplete" });
    assert.equal(getAchievementCompanionLastRaShortcutResolutionDebug().catalogueCacheStatus, "unavailable");
    deckyBackendTestState.retroAchievements.gameListByConsoleId = { "5": [
      { ID: 5001, Title: "Complete", ConsoleID: 5, Hashes: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"] },
    ] };
    deckyBackendTestState.retroAchievements.gameProgressByGameId = {
      "5001": createRetroAchievementsGameProgressResponse({ gameId: "5001", title: "Complete", consoleId: 5, consoleName: "Game Boy Advance", unlockedCount: 1, totalCount: 2 }),
    };
    invalidateDeckyGamePageAchievementSummaryCache(appId);
    const recovered = await loadDeckyGamePageAchievementSummary(appId);
    assert.equal(recovered.status, "ready");
    assert.equal(deckyBackendTestState.retroAchievements.gameListRequestCount, 2);
  });
});

test("expired RA catalogue entries refresh before resolving a newly accepted hash", async () => {
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    await withMockDeckyStorage(async () => {
      resetDeckyAppServicesForTests();
      updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
        username: "alice", hasApiKey: true, recentAchievementsCount: 5, recentlyPlayedCount: 5,
      });
      const appId = "250004";
      const firstHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const secondHash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
      deckyBackendTestState.steam.shortcutMetadataByAppId = { [appId]: { title: "Any name", platformTag: "Nintendo Game Boy Advance" } };
      deckyBackendTestState.steam.shortcutRomHashByAppId = { [appId]: {
        shortcutRomPathDetected: true, romHashAttempted: true, romHashStatus: "resolved", romHashAlgorithm: "rcheevos", romHash: firstHash,
      } };
      deckyBackendTestState.retroAchievements.systems = [{ ID: 5, Name: "Game Boy Advance" }];
      deckyBackendTestState.retroAchievements.gameListByConsoleId = { "5": [
        { ID: 5001, Title: "First", ConsoleID: 5, Hashes: [firstHash] },
      ] };
      deckyBackendTestState.retroAchievements.gameProgressByGameId = {
        "5001": createRetroAchievementsGameProgressResponse({ gameId: "5001", title: "First", consoleId: 5, consoleName: "Game Boy Advance", unlockedCount: 1, totalCount: 2 }),
        "5002": createRetroAchievementsGameProgressResponse({ gameId: "5002", title: "Second", consoleId: 5, consoleName: "Game Boy Advance", unlockedCount: 1, totalCount: 2 }),
      };
      assert.equal((await loadDeckyGamePageAchievementSummary(appId)).status, "ready");
      assert.equal(deckyBackendTestState.retroAchievements.gameListRequestCount, 1);

      deckyBackendTestState.steam.shortcutRomHashByAppId[appId] = {
        shortcutRomPathDetected: true, romHashAttempted: true, romHashStatus: "resolved", romHashAlgorithm: "rcheevos", romHash: secondHash,
      };
      deckyBackendTestState.retroAchievements.gameListByConsoleId = { "5": [
        { ID: 5002, Title: "Second", ConsoleID: 5, Hashes: [secondHash] },
      ] };
      now += 60 * 60 * 1000 + 1;
      invalidateDeckyGamePageAchievementSummaryCache(appId);
      const refreshed = await loadDeckyGamePageAchievementSummary(appId);
      assert.equal(refreshed.status, "ready");
      if (refreshed.status === "ready") assert.equal(refreshed.gameId, "5002");
      assert.equal(deckyBackendTestState.retroAchievements.gameListRequestCount, 2);
      assert.equal(getAchievementCompanionLastRaShortcutResolutionDebug().catalogueCacheStatus, "fetched");
    });
  } finally {
    Date.now = originalNow;
  }
});

test("game page mapping invalidation reloads a changed shortcut ROM hash", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    const changedAppId = "2493414799";
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      [changedAppId]: { title: "My ROM", platformTag: "Nintendo 64" },
    };
    deckyBackendTestState.steam.shortcutRomHashByAppId = {
      [changedAppId]: {
        shortcutRomPathDetected: true,
        romHashAttempted: true,
        romHashStatus: "resolved",
        romHashAlgorithm: "rcheevos",
        romHash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      },
    };
    deckyBackendTestState.retroAchievements.systems = [{ ID: 2, Name: "Nintendo 64" }];
    deckyBackendTestState.retroAchievements.gameListByConsoleId = {
      "2": [
        { GameID: 9001, Title: "First ROM", ConsoleID: 2, ConsoleName: "Nintendo 64", Hashes: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"] },
        { GameID: 9002, Title: "Second ROM", ConsoleID: 2, ConsoleName: "Nintendo 64", Hashes: ["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"] },
      ],
    };
    deckyBackendTestState.retroAchievements.gameProgressByGameId = {
      "9001": createRetroAchievementsGameProgressResponse({
        gameId: "9001", title: "First ROM", consoleId: 2, consoleName: "Nintendo 64", unlockedCount: 1, totalCount: 3,
      }),
      "9002": createRetroAchievementsGameProgressResponse({
        gameId: "9002", title: "Second ROM", consoleId: 2, consoleName: "Nintendo 64", unlockedCount: 2, totalCount: 3,
      }),
    };

    const first = await loadDeckyGamePageAchievementSummary(changedAppId);
    assert.equal(first.status, "ready");
    if (first.status !== "ready") return;
    assert.equal(first.gameId, "9001");

    deckyBackendTestState.steam.shortcutRomHashByAppId = {
      [changedAppId]: {
        shortcutRomPathDetected: true,
        romHashAttempted: true,
        romHashStatus: "resolved",
        romHashAlgorithm: "rcheevos",
        romHash: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      },
    };
    invalidateDeckyGamePageAchievementSummaryCache(changedAppId);
    const second = await loadDeckyGamePageAchievementSummary(changedAppId);
    assert.equal(second.status, "ready");
    if (second.status !== "ready") return;
    assert.equal(second.gameId, "9002");
  });
});

test("game page achievement summary preserves mastered completion status for a hash-resolved RetroAchievements shortcut", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2493414764": {
        title: "~Homebrew~ Minicraft PSP",
        platformTag: "Sony PlayStation Portable",
        platformLabel: "Sony PlayStation Portable",
        tags: ["Sony PlayStation Portable"],
      },
    };
    deckyBackendTestState.steam.shortcutRomHashByAppId = {
      "2493414764": {
        lastRetroAchievementsShortcutRomPathDetected: true,
        shortcutRomPathSource: "exe",
        lastRetroAchievementsRomHashAttempted: true,
        romHashStatus: "resolved",
        romHashAlgorithm: "rcheevos",
        romHash: "BADDCAFEBADDCAFEBADDCAFEBADDCAFE",
      },
    };
    deckyBackendTestState.retroAchievements.systems = [
      {
        ID: 41,
        Name: "PlayStation Portable",
        IconURL: "https://example.com/psp.png",
      },
    ];
    deckyBackendTestState.retroAchievements.gameListByConsoleId = {
      "41": [
        {
          GameID: 9200,
          Title: "~Homebrew~ Minicraft PSP",
          ConsoleID: 41,
          ConsoleName: "PlayStation Portable",
          Hashes: ["baddcafebaddcafebaddcafebaddcafe"],
        },
      ],
    };
    deckyBackendTestState.retroAchievements.gameProgressByGameId = {
      "9200": createRetroAchievementsGameProgressResponse({
        gameId: "9200",
        title: "~Homebrew~ Minicraft PSP",
        consoleId: 41,
        consoleName: "PlayStation Portable",
        highestAwardKind: "mastered",
        unlockedCount: 57,
        totalCount: 57,
        hardcoreUnlockedCount: 57,
      }),
    };

    const summary = await loadDeckyGamePageAchievementSummary("2493414764");
    assert.equal(summary.status, "ready");
    if (summary.status !== "ready") {
      return;
    }

    assert.equal(summary.provider, "retroachievements");
    assert.equal(summary.gameId, "9200");
    assert.equal(summary.title, "~Homebrew~ Minicraft PSP");
    assert.equal(summary.earned, 57);
    assert.equal(summary.total, 57);
    assert.equal(summary.completionStatus, "mastered");
    assert.equal(summary.platformLabel, "PlayStation Portable");
    assert.equal(summary.systemIconUrl, "https://example.com/psp.png");

    const badgeDebug = getAchievementCompanionLastGamePageBadgeDebug();
    const runtimeDebugState = getAchievementCompanionRuntimeDebugState();
    assert.equal(badgeDebug?.summaryCompletionStatus, "mastered");
    assert.equal(runtimeDebugState.lastRetroAchievementsFinalResolverSource, "hash");
    assert.equal(runtimeDebugState.lastRetroAchievementsResolutionSource, "ra-hash-game-detail");
  });
});

test("game page achievement summary rejects a valid hash without a matching game and never title-matches", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2493414763": {
        title: "Pyoro64",
        platformTag: "Nintendo 64",
        platformLabel: "Nintendo 64",
        tags: ["Nintendo 64"],
      },
    };
    deckyBackendTestState.steam.shortcutRomHashByAppId = {
      "2493414763": {
        shortcutRomPathDetected: true,
        shortcutRomPathSource: "launchoptions",
        romHashAttempted: true,
        romHashStatus: "resolved",
        romHashAlgorithm: "rcheevos",
        romHash: "DEADBEEFDEADBEEFDEADBEEFDEADBEEF",
      },
    };
    deckyBackendTestState.retroAchievements.systems = [
      {
        ID: 2,
        Name: "Nintendo 64",
        IconURL: "https://example.com/n64.png",
      },
    ];
    deckyBackendTestState.retroAchievements.gameListByConsoleId = {
      "2": [
        {
          GameID: 9100,
          Title: "~Homebrew~ Pyoro 64",
          ConsoleID: 2,
          ConsoleName: "Nintendo 64",
          Hashes: ["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
        },
        {
          GameID: 9101,
          Title: "Pyoro64",
          ConsoleID: 2,
          ConsoleName: "Nintendo 64",
          Hashes: [],
        },
      ],
    };
    deckyBackendTestState.retroAchievements.gameProgressByGameId = {
      "9101": createRetroAchievementsGameProgressResponse({
        gameId: "9101",
        title: "Pyoro64",
        consoleId: 2,
        consoleName: "Nintendo 64",
        unlockedCount: 0,
        totalCount: 2,
      }),
    };

    const summary = await loadDeckyGamePageAchievementSummary("2493414763");
    assert.deepStrictEqual(summary, { status: "unavailable", appId: "2493414763", reason: "hash-not-in-ra-catalogue" });

    const runtimeDebugState = getAchievementCompanionRuntimeDebugState();
    assert.equal(runtimeDebugState.lastRetroAchievementsHashResolverAttempted, true);
    assert.equal(runtimeDebugState.lastRetroAchievementsRaHashLookupStatus, "no-match");
    assert.equal(runtimeDebugState.lastRetroAchievementsHashRejectedReason, "hash-not-in-ra-catalogue");
    assert.equal(runtimeDebugState.lastRetroAchievementsFinalResolverSource, "unavailable");
    assert.equal(runtimeDebugState.lastRetroAchievementsResolutionReason, "hash-not-in-ra-catalogue");
  });
});

test("game page achievement summary rejects an ambiguous accepted RA hash", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice", hasApiKey: true, recentAchievementsCount: 5, recentlyPlayedCount: 5,
    });
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2493414798": { title: "Completely unrelated", platformTag: "Nintendo DS" },
    };
    deckyBackendTestState.steam.shortcutRomHashByAppId = {
      "2493414798": {
        shortcutRomPathDetected: true,
        romHashAttempted: true,
        romHashStatus: "resolved",
        romHashAlgorithm: "rcheevos",
        romHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
    };
    deckyBackendTestState.retroAchievements.systems = [{ ID: 18, Name: "Nintendo DS" }];
    deckyBackendTestState.retroAchievements.gameListByConsoleId = {
      "18": [
        { GameID: 9001, Title: "First", ConsoleID: 18, ConsoleName: "Nintendo DS", Hashes: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"] },
        { GameID: 9002, Title: "Second", ConsoleID: 18, ConsoleName: "Nintendo DS", Hashes: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"] },
      ],
    };

    const summary = await loadDeckyGamePageAchievementSummary("2493414798");
    assert.deepStrictEqual(summary, {
      status: "unavailable", appId: "2493414798", reason: "ambiguous-hash-match",
    });
    assert.equal(getAchievementCompanionRuntimeDebugState().lastRetroAchievementsRaHashLookupStatus, "ambiguous");
  });
});

test("game page achievement summary stops on distinct candidate hashes and exposes safe diagnostics", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice", hasApiKey: true, recentAchievementsCount: 5, recentlyPlayedCount: 5,
    });
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2493414800": { title: "Pyoro64", platformTag: "Favorites", tags: ["Favorites", "Nintendo 64"] },
    };
    deckyBackendTestState.steam.shortcutRomHashByAppId = {
      "2493414800": {
        shortcutRomPathDetected: true,
        shortcutRomPathSource: "launchoptions",
        candidateCount: 2,
        candidateExtension: ".zip",
        candidateResults: [
          { source: "launchoptions", extension: ".zip", status: "resolved", memberExtension: ".n64" },
          { source: "exe", extension: ".n64", status: "resolved" },
        ],
        romHashAttempted: true,
        romHashStatus: "ambiguous",
        hashResolverSkippedReason: "ambiguous-rom-hash-candidates",
      },
    };
    deckyBackendTestState.retroAchievements.systems = [{ ID: 2, Name: "Nintendo 64" }];
    const summary = await loadDeckyGamePageAchievementSummary("2493414800");
    assert.deepStrictEqual(summary, { status: "unavailable", appId: "2493414800", reason: "ambiguous-rom-hash-candidates" });
    assert.deepStrictEqual(deckyBackendTestState.steam.hashRequestedConsoleIds, [2]);
    const debug = getAchievementCompanionLastRaShortcutResolutionDebug();
    assert.equal(debug.normalizedPlatform, "Nintendo 64");
    assert.equal(debug.romCandidateCount, 2);
    assert.equal(debug.candidateExtension, ".zip");
    assert.equal(debug.romHashStatus, "ambiguous");
    assert.equal(debug.finalResolverSource, "unavailable");
  });
});

test("game page achievement summary reports missing console ID without title fallback", async () => {
  await withMockDeckyStorage(async () => {
    resetDeckyAppServicesForTests();
    updateDeckyProviderConfigCache(RETROACHIEVEMENTS_PROVIDER_ID, {
      username: "alice",
      hasApiKey: true,
      recentAchievementsCount: 5,
      recentlyPlayedCount: 5,
    });
    deckyBackendTestState.steam.shortcutMetadataByAppId = {
      "2874315922": {
        title: "Final Fantasy X International",
        platformTag: "Sony PlayStation Portable",
        tags: ["Sony PlayStation Portable"],
      },
    };
    deckyBackendTestState.retroAchievements.systems = [
      {
        ID: 7,
        Name: "PlayStation",
        IconURL: "https://example.com/ps1.png",
      },
      {
        ID: 21,
        Name: "PlayStation 2",
        IconURL: "https://example.com/ps2.png",
      },
    ];
    deckyBackendTestState.retroAchievements.gameListByConsoleId = {
      "21": [
        {
          GameID: 100,
          Title: "Final Fantasy X",
          ConsoleID: 21,
          ConsoleName: "PlayStation 2",
        },
      ],
    };

    const summary = await loadDeckyGamePageAchievementSummary("2874315922");
    assert.deepStrictEqual(summary, {
      status: "unavailable",
      appId: "2874315922",
      reason: "console-id-unavailable",
    });

    const runtimeDebugState = getAchievementCompanionRuntimeDebugState();
    assert.equal(runtimeDebugState.lastRetroAchievementsShortcutAppId, "2874315922");
    assert.equal(runtimeDebugState.lastRetroAchievementsMappingStatus, "unavailable");
    assert.equal(runtimeDebugState.lastRetroAchievementsMappingReason, "console-id-unavailable");
    assert.equal(runtimeDebugState.lastRetroAchievementsResolutionSource, "ra-hash-game-detail");
    assert.equal(runtimeDebugState.lastRetroAchievementsResolutionReason, "console-id-unavailable");
    assert.equal(runtimeDebugState.lastRetroAchievementsShortcutPlatform, "Sony PlayStation Portable");
    assert.equal(runtimeDebugState.lastRetroAchievementsNormalizedPlatform, "PlayStation Portable");
    assert.equal(runtimeDebugState.lastRetroAchievementsResolvedSystemName, undefined);
    assert.equal(runtimeDebugState.lastRetroAchievementsResolvedConsoleId, undefined);
    assert.equal(runtimeDebugState.lastRetroAchievementsCandidateCount, undefined);
  });
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

test("compact game detail back button ownerWindow registers the cancel bridge", () => {
  resetCompactGameDetailCancelBridgeForTests();
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
    ensureCompactGameDetailCancelBridgeRegisteredForBackButtonElement(buttonElement);
    ensureCompactGameDetailCancelBridgeRegisteredForBackButtonElement(buttonElement);

    assert.deepStrictEqual(addCalls, [
      {
        type: "vgp_oncancel",
        capture: true,
      },
    ]);
  } finally {
    resetCompactGameDetailCancelBridgeForTests();
  }
});

test("compact game detail cancel bridge stops a synthetic cancel event and clicks the marked visible back button", () => {
  resetCompactGameDetailCancelBridgeForTests();
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
    ensureCompactGameDetailCancelBridgeRegisteredForBackButtonElement({
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
    resetCompactGameDetailCancelBridgeForTests();
  }
});

test("compact game detail cancel bridge ignores hidden marked buttons and leaves cancel unhandled", () => {
  resetCompactGameDetailCancelBridgeForTests();
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
    ensureCompactGameDetailCancelBridgeRegisteredForBackButtonElement({
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
    resetCompactGameDetailCancelBridgeForTests();
  }
});

test("compact game detail cancel bridge leaves cancel alone when no marked back button exists", () => {
  resetCompactGameDetailCancelBridgeForTests();
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
    ensureCompactGameDetailCancelBridgeRegisteredForBackButtonElement({
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
    resetCompactGameDetailCancelBridgeForTests();
  }
});

test("compact provider back button ownerWindow registers the cancel bridge", () => {
  resetCompactProviderCancelBridgeForTests();
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
    ensureCompactProviderCancelBridgeRegisteredForBackButtonElement(buttonElement);
    ensureCompactProviderCancelBridgeRegisteredForBackButtonElement(buttonElement);

    assert.deepStrictEqual(addCalls, [
      {
        type: "vgp_oncancel",
        capture: true,
      },
    ]);
  } finally {
    resetCompactProviderCancelBridgeForTests();
  }
});

test("compact provider cancel bridge stops a synthetic cancel event and clicks the marked visible back button", () => {
  resetCompactProviderCancelBridgeForTests();
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
    ensureCompactProviderCancelBridgeRegisteredForBackButtonElement({
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
    resetCompactProviderCancelBridgeForTests();
  }
});

test("compact provider cancel bridge ignores hidden marked buttons and leaves cancel unhandled", () => {
  resetCompactProviderCancelBridgeForTests();
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
    ensureCompactProviderCancelBridgeRegisteredForBackButtonElement({
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
    resetCompactProviderCancelBridgeForTests();
  }
});

test("compact provider cancel bridge leaves cancel alone when no marked back button exists", () => {
  resetCompactProviderCancelBridgeForTests();
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
    ensureCompactProviderCancelBridgeRegisteredForBackButtonElement({
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
    resetCompactProviderCancelBridgeForTests();
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

  const progressEvents: { stepId: string; status: string }[] = [];
  const state = await appServices.dashboard.loadDashboard(PROVIDER_ID, {
    forceRefresh: true,
    onProgress: (event) => progressEvents.push(event),
  });

  assert.equal(state.status, "success");
  assert.equal(state.error, undefined);
  assert.equal(state.data?.recentAchievements.length, 2);
  assert.equal(state.data?.recentlyPlayedGames.length, 1);
  assert.equal(state.data?.recentlyPlayedGames[0]?.title, "Surviving Mars: Relaunched");
  assert.equal(state.data?.recentlyPlayedGames[0]?.lastPlayedAt, undefined);
  assert.equal(counts.profile, 1);
  assert.equal(counts.recentUnlocks, 1);
  assert.equal(counts.recentlyPlayedGames, 1);
  for (const stepId of ["profile", "recent-achievements", "recent-games", "finalize"]) {
    assert.ok(progressEvents.some((event) => event.stepId === stepId && event.status === "in-progress"));
    assert.ok(progressEvents.some((event) => event.stepId === stepId && event.status === "complete"));
  }
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
