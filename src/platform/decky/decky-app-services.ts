import type { ResourceState } from "@core/cache";
import type { DashboardRefreshProgressEvent } from "@core/services";
import type {
  AchievementHistorySnapshot,
  CompletionProgressSnapshot,
  DashboardSnapshot,
  GameDetailSnapshot,
  NormalizedGame,
  NormalizedProfile,
  ProviderId,
  RecentlyPlayedGame,
  RecentUnlock,
  RelatedGameSummary,
} from "@core/domain";
import type {
  AuthenticatedProviderTransportFactory,
  NavigationPort,
  PlatformCapabilities,
  PlatformServices,
} from "@core/platform";
import { createAppRuntime } from "@core/app-runtime";
import { createProviderRegistry } from "@core/provider-registry";
import {
  createRetroAchievementsProvider,
  type RetroAchievementsSubsetCatalogueState,
  type RetroAchievementsSubsetRelationshipIndexState,
  type RetroAchievementsSubsetRelationshipIndexStore,
} from "../../providers/retroachievements";
import {
  clearSteamRecentGameSnapshotLoadCache,
  createSteamProvider,
} from "../../providers/steam";
import {
  composeSteamGameDetailWithSteamHunters,
  createSteamHuntersClient,
  createSteamHuntersService,
  type SteamHuntersProfile,
} from "../../providers/steamhunters";
import { createDeckySteamHuntersTransport } from "./providers/steamhunters/backend-transport";
import { createMemoryCacheStore } from "./memory-cache";
import { createDeckySettingsStore, isDeckySteamHuntersPersonalDataEnabled } from "./decky-settings";
import { loadDeckyRuntimeMode, type DeckyRuntimeMode } from "./runtime-mode";
import { readDeckyStorageText, removeDeckyStorageText, writeDeckyStorageText, writeDeckyStorageTextPreservingExisting } from "./storage";
import {
  readDeckyDashboardSnapshotState,
  deckyDashboardSnapshotStore,
  writeDeckyDashboardSnapshot,
} from "./decky-dashboard-snapshot-cache";
import { updateDeckyRetroAchievementsRankTrends } from "./decky-retroachievements-rank-trend";
import {
  preserveCachedSteamHuntersEnrichment,
  readDeckySteamGameDetailCacheEntry,
  readDeckySteamGameDetailState,
  writeDeckySteamGameDetail,
} from "./decky-steam-game-detail-cache";
import {
  createDeckySmokeTestDashboardCacheEntries,
  type DeckySmokeTestCacheMode,
} from "./smoke-test-cache";
import { loadDeckyProviderConfig } from "./providers";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";
import { STEAM_PROVIDER_ID, type SteamProviderConfig } from "../../providers/steam";
import { createDeckyRetroAchievementsTransport } from "./providers/retroachievements/backend-transport";
import {
  markRetroAchievementsAuthenticatedSuccess,
  markRetroAchievementsCachedDashboardRestored,
  markRetroAchievementsRefreshFailure,
} from "./providers/retroachievements/connection";
import { createDeckySteamTransport } from "./providers/steam/backend-transport";
import {
  markSteamAuthenticatedSuccess,
  markSteamCachedDashboardRestored,
  markSteamRefreshFailure,
} from "./providers/steam/connection";
import { deckyProviderConfigStore } from "./providers/provider-config-store";
import {
  buildDeckySteamAchievementHistorySnapshotFromSummary,
  buildDeckySteamCompletionProgressSnapshotFromSummary,
  refreshAndCacheDeckySteamLibraryAchievementProgress,
  runAndCacheDeckySteamLibraryAchievementScan,
} from "./providers/steam/library-scan";
import { reconcileSteamLibraryAchievementSummaryWithRecentGames } from "../../providers/steam/library-scan";
import { normalizeSteamCompletionProgressGames } from "../../providers/steam/mappers/normalize";
import { deckyDiagnosticLogger } from "./decky-diagnostic-logger";
import { publishDeckyRaNativeAchievementInvalidation } from "./decky-ra-native-achievement-invalidation";
import {
  getDeckySteamLibraryAchievementScanRevision,
  deckySteamLibraryScanStore,
  readDeckySteamLibraryAchievementScanSummary,
  type SteamLibraryAchievementScanSummary,
  writeDeckySteamLibraryAchievementScanSummaryIfRevisionMatches,
} from "./providers/steam/config";
import {
  applySteamLibraryScanGameDetailMetadata,
  findSteamLibraryScanGameSummaryByAppId,
} from "./providers/steam/game-detail";
import {
  createDeckyRecentAchievementCandidate,
  createDeckyRecentAchievementCompletionProgressGameCandidate,
  createDeckyRecentAchievementRecentlyPlayedGameCandidate,
  DECKY_RECENT_ACHIEVEMENTS_LIMIT,
  finalizeDeckyRecentAchievementCandidates,
  getDeckyRecentAchievementProfileMemberSinceAt,
  getNormalizedRecentUnlockTimestamp,
  getRecentUnlockIdentity,
  maxDefinedNumber,
  rankDeckyRecentAchievements,
  selectDeckyRecentAchievementCandidates,
  selectDeckyRecentAchievementGameCandidates,
  toRecentUnlock,
  type DeckyRecentAchievementBackfillProvider,
  type DeckyRecentAchievementCandidate,
  type DeckyRecentAchievementGameCandidate,
  type DeckyRecentAchievementGameSource,
  type DeckyRecentAchievementSource,
} from "./decky-recent-achievement-history-selection";

const deckyPlatformInfo = {
  platformId: "decky",
  appName: "Achievement Companion",
} as const;
const DECKY_RECENT_ACHIEVEMENTS_STORAGE_KEY_PREFIX =
  "achievement-companion:decky:recent-achievements";
const DECKY_RECENT_ACHIEVEMENTS_BACKFILL_RECENTLY_PLAYED_LIMIT = 50;

// This service instance is shared with the Steam provider. A page can await an
// already-started optional lookup without repeating any Steam account requests.
const deckySteamHuntersService = createSteamHuntersService({
  client: createSteamHuntersClient({ transport: createDeckySteamHuntersTransport() }),
});

interface DeckyRecentAchievementDebugGameCandidate {
  readonly id: string;
  readonly title: string;
  readonly source: DeckyRecentAchievementGameSource;
  readonly unlockedCount: number;
  readonly sortEpoch?: number;
}

export const deckyPlatformCapabilities: PlatformCapabilities = {
  supportsCompactNavigation: true,
  supportsFullscreenNavigation: true,
  supportsPersistentSettings: true,
  supportsSecretStorage: true,
  supportsAuthenticatedProviderTransport: true,
  supportsDiagnosticLogging: true,
  supportsSteamLibraryScan: true,
};

function createDeckyAuthenticatedProviderTransport(
  providerId: typeof RETROACHIEVEMENTS_PROVIDER_ID,
): ReturnType<typeof createDeckyRetroAchievementsTransport>;
function createDeckyAuthenticatedProviderTransport(
  providerId: typeof STEAM_PROVIDER_ID,
): ReturnType<typeof createDeckySteamTransport>;
function createDeckyAuthenticatedProviderTransport(providerId: ProviderId) {
  if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
    return createDeckyRetroAchievementsTransport();
  }

  if (providerId === STEAM_PROVIDER_ID) {
    return createDeckySteamTransport();
  }

  throw new Error(`Unsupported provider for Decky transport factory: ${providerId}`);
}

export const deckyAuthenticatedProviderTransportFactory: AuthenticatedProviderTransportFactory<
  ReturnType<typeof createDeckyRetroAchievementsTransport> | ReturnType<typeof createDeckySteamTransport>
> = {
  create: createDeckyAuthenticatedProviderTransport,
};

const DECKY_RETROACHIEVEMENTS_SUBSET_RELATIONSHIP_INDEX_STORAGE_KEY =
  "achievement-companion:decky:retroachievements:subset-relationship-index:v1";

interface StoredRetroAchievementsSubsetRelationshipIndex {
  readonly version: 1;
  readonly consoles: Readonly<Record<string, RetroAchievementsSubsetRelationshipIndexState>>;
  readonly catalogues: Readonly<Record<string, RetroAchievementsSubsetCatalogueState>>;
}

const deckyRetroAchievementsSubsetRelationshipIndexStore: RetroAchievementsSubsetRelationshipIndexStore = {
  async read(consoleId) {
    const raw = readDeckyStorageText(DECKY_RETROACHIEVEMENTS_SUBSET_RELATIONSHIP_INDEX_STORAGE_KEY);
    if (raw === undefined) return undefined;
    try {
      const parsed = JSON.parse(raw) as Partial<StoredRetroAchievementsSubsetRelationshipIndex>;
      if (parsed.version !== 1 || parsed.consoles === null || typeof parsed.consoles !== "object") return undefined;
      return parsed.consoles[consoleId];
    } catch {
      return undefined;
    }
  },
  async readCatalogue(consoleId) {
    const raw = readDeckyStorageText(DECKY_RETROACHIEVEMENTS_SUBSET_RELATIONSHIP_INDEX_STORAGE_KEY);
    if (raw === undefined) return undefined;
    try {
      const parsed = JSON.parse(raw) as Partial<StoredRetroAchievementsSubsetRelationshipIndex>;
      if (parsed.version !== 1 || parsed.catalogues === null || typeof parsed.catalogues !== "object") return undefined;
      return parsed.catalogues[consoleId];
    } catch {
      return undefined;
    }
  },
  async write(state) {
    let stored: StoredRetroAchievementsSubsetRelationshipIndex = { version: 1, consoles: {}, catalogues: {} };
    const raw = readDeckyStorageText(DECKY_RETROACHIEVEMENTS_SUBSET_RELATIONSHIP_INDEX_STORAGE_KEY);
    if (raw !== undefined) {
      try {
        const parsed = JSON.parse(raw) as Partial<StoredRetroAchievementsSubsetRelationshipIndex>;
        if (parsed.version === 1 && parsed.consoles !== null && typeof parsed.consoles === "object") {
          stored = {
            version: 1,
            consoles: parsed.consoles,
            catalogues: parsed.catalogues !== null && typeof parsed.catalogues === "object" ? parsed.catalogues : {},
          };
        }
      } catch {
        // Replace corrupt relationship-index storage with the next good write.
      }
    }
    writeDeckyStorageTextPreservingExisting(
      DECKY_RETROACHIEVEMENTS_SUBSET_RELATIONSHIP_INDEX_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        consoles: { ...stored.consoles, [state.consoleId]: state },
        catalogues: stored.catalogues,
      }),
    );
  },
  async writeCatalogue(state) {
    let stored: StoredRetroAchievementsSubsetRelationshipIndex = { version: 1, consoles: {}, catalogues: {} };
    const raw = readDeckyStorageText(DECKY_RETROACHIEVEMENTS_SUBSET_RELATIONSHIP_INDEX_STORAGE_KEY);
    if (raw !== undefined) {
      try {
        const parsed = JSON.parse(raw) as Partial<StoredRetroAchievementsSubsetRelationshipIndex>;
        if (parsed.version === 1 && parsed.consoles !== null && typeof parsed.consoles === "object") {
          stored = {
            version: 1,
            consoles: parsed.consoles,
            catalogues: parsed.catalogues !== null && typeof parsed.catalogues === "object" ? parsed.catalogues : {},
          };
        }
      } catch {
        // Replace corrupt relationship-index storage with the next good write.
      }
    }
    writeDeckyStorageTextPreservingExisting(
      DECKY_RETROACHIEVEMENTS_SUBSET_RELATIONSHIP_INDEX_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        consoles: stored.consoles,
        catalogues: { ...stored.catalogues, [state.consoleId]: state },
      }),
    );
  },
  async clear() {
    removeDeckyStorageText(DECKY_RETROACHIEVEMENTS_SUBSET_RELATIONSHIP_INDEX_STORAGE_KEY);
  },
};

const providerRegistry = createProviderRegistry([
  createRetroAchievementsProvider({
    transport: deckyAuthenticatedProviderTransportFactory.create(RETROACHIEVEMENTS_PROVIDER_ID),
    subsetRelationshipIndexStore: deckyRetroAchievementsSubsetRelationshipIndexStore,
  }),
  createSteamProvider({
    transport: deckyAuthenticatedProviderTransportFactory.create(STEAM_PROVIDER_ID),
    steamHuntersService: deckySteamHuntersService,
  }),
]);
export function createDeckyAppRuntime(runtimeMode: DeckySmokeTestCacheMode | "live") {
  const cacheStore =
    runtimeMode === "live"
      ? createMemoryCacheStore()
      : createMemoryCacheStore(createDeckySmokeTestDashboardCacheEntries(runtimeMode));

  return createAppRuntime({
    providerRegistry,
    platform: createDeckyPlatform(),
    cacheStore,
    loadProviderConfig: loadDeckyProviderConfig,
    adapters: {
      diagnosticLogger: deckyDiagnosticLogger,
      providerConfigStore: deckyProviderConfigStore,
      authenticatedProviderTransportFactory: deckyAuthenticatedProviderTransportFactory,
      dashboardSnapshotStore: deckyDashboardSnapshotStore,
      steamLibraryScanStore: deckySteamLibraryScanStore,
      platformCapabilities: deckyPlatformCapabilities,
    },
  });
}

let liveDeckyAppRuntime: ReturnType<typeof createDeckyAppRuntime> | undefined;
const deckyDashboardRefreshInFlightByProviderId = new Map<
  ProviderId,
  Promise<ResourceState<DashboardSnapshot>>
>();
interface DeckyDashboardProgressChannel {
  readonly latestByStep: Map<DashboardRefreshProgressEvent["stepId"], DashboardRefreshProgressEvent>;
  readonly listeners: Set<(event: DashboardRefreshProgressEvent) => void>;
}
const deckyDashboardProgressChannels = new Map<ProviderId, DeckyDashboardProgressChannel>();
export interface DeckyProviderFullScreenDataSession {
  readonly dashboard: ResourceState<DashboardSnapshot>;
  readonly completionProgress: ResourceState<CompletionProgressSnapshot>;
  readonly achievementHistory: ResourceState<AchievementHistorySnapshot>;
  readonly steamHuntersProfile: ResourceState<SteamHuntersProfile>;
}

interface DeckyProviderFullScreenDataSessionEntry {
  readonly promise: Promise<DeckyProviderFullScreenDataSession>;
  snapshot?: DeckyProviderFullScreenDataSession;
}

const deckyProviderFullScreenDataSessions = new Map<ProviderId, DeckyProviderFullScreenDataSessionEntry>();
interface DeckySteamHuntersProfileLoadEntry {
  readonly steamId: string;
  readonly promise: Promise<ResourceState<SteamHuntersProfile>>;
  state?: ResourceState<SteamHuntersProfile>;
  completedWhileDisabled?: boolean;
}
const deckySteamHuntersProfileLoadsByProviderId = new Map<ProviderId, DeckySteamHuntersProfileLoadEntry>();
const deckyProviderFullScreenCompactReturnRefreshSuppressions = new Set<ProviderId>();
let deckyProviderFullScreenDataSessionRevision = 0;
const deckyProviderFullScreenDataSessionListeners = new Set<() => void>();
const DECKY_RETROACHIEVEMENTS_PLAYTIME_REQUEST_INTERVAL_MS = 300;
const deckyRetroAchievementsGamePlaytimeCache = new Map<string, number | undefined>();
const deckyRetroAchievementsGamePlaytimeRequests = new Map<string, Promise<number | undefined>>();
let deckyRetroAchievementsGamePlaytimeSessionRevision = 0;
let deckyRetroAchievementsGamePlaytimeQueue: Promise<void> = Promise.resolve();
let deckyRetroAchievementsLastPlaytimeRequestStartedAt = 0;

function resetDeckyRetroAchievementsGamePlaytimeSession(): void {
  deckyRetroAchievementsGamePlaytimeSessionRevision += 1;
  deckyRetroAchievementsGamePlaytimeCache.clear();
  deckyRetroAchievementsGamePlaytimeRequests.clear();
}

/** Loads exact RA per-game playtime lazily, spaced to respect the API's rate limits. */
export function loadDeckyRetroAchievementsGamePlaytimeSeconds(gameId: string): Promise<number | undefined> {
  if (loadDeckyRuntimeMode() === "empty") {
    return Promise.resolve(undefined);
  }

  const sessionRevision = deckyRetroAchievementsGamePlaytimeSessionRevision;
  if (deckyRetroAchievementsGamePlaytimeCache.has(gameId)) {
    return Promise.resolve(deckyRetroAchievementsGamePlaytimeCache.get(gameId));
  }

  const requestKey = `${sessionRevision}:${gameId}`;
  const existingRequest = deckyRetroAchievementsGamePlaytimeRequests.get(requestKey);
  if (existingRequest !== undefined) {
    return existingRequest;
  }

  const queuedRequest = deckyRetroAchievementsGamePlaytimeQueue.then(async () => {
    if (sessionRevision !== deckyRetroAchievementsGamePlaytimeSessionRevision) {
      return undefined;
    }

    const provider = providerRegistry.get(RETROACHIEVEMENTS_PROVIDER_ID);
    const providerConfig = await loadDeckyProviderConfig(RETROACHIEVEMENTS_PROVIDER_ID);
    if (provider?.loadGamePlaytimeSeconds === undefined || providerConfig === undefined) {
      return undefined;
    }

    const waitMs = Math.max(
      0,
      DECKY_RETROACHIEVEMENTS_PLAYTIME_REQUEST_INTERVAL_MS -
        (Date.now() - deckyRetroAchievementsLastPlaytimeRequestStartedAt),
    );
    if (waitMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    }
    if (sessionRevision !== deckyRetroAchievementsGamePlaytimeSessionRevision) {
      return undefined;
    }

    deckyRetroAchievementsLastPlaytimeRequestStartedAt = Date.now();
    return provider.loadGamePlaytimeSeconds(providerConfig, gameId);
  });
  deckyRetroAchievementsGamePlaytimeQueue = queuedRequest.then(() => undefined, () => undefined);

  let request: Promise<number | undefined>;
  request = queuedRequest
    .then((playtimeSeconds) => {
      if (sessionRevision === deckyRetroAchievementsGamePlaytimeSessionRevision) {
        deckyRetroAchievementsGamePlaytimeCache.set(gameId, playtimeSeconds);
      }
      return playtimeSeconds;
    })
    .catch(() => {
      if (sessionRevision === deckyRetroAchievementsGamePlaytimeSessionRevision) {
        deckyRetroAchievementsGamePlaytimeCache.set(gameId, undefined);
      }
      return undefined;
    })
    .finally(() => {
      if (deckyRetroAchievementsGamePlaytimeRequests.get(requestKey) === request) {
        deckyRetroAchievementsGamePlaytimeRequests.delete(requestKey);
      }
    });
  deckyRetroAchievementsGamePlaytimeRequests.set(requestKey, request);
  return request;
}

function getDeckyDashboardProgressChannel(providerId: ProviderId): DeckyDashboardProgressChannel {
  let channel = deckyDashboardProgressChannels.get(providerId);
  if (channel === undefined) {
    channel = { latestByStep: new Map(), listeners: new Set() };
    deckyDashboardProgressChannels.set(providerId, channel);
  }

  return channel;
}

function publishDeckyDashboardProgress(providerId: ProviderId, event: DashboardRefreshProgressEvent): void {
  const channel = getDeckyDashboardProgressChannel(providerId);
  channel.latestByStep.set(event.stepId, event);
  for (const listener of channel.listeners) {
    listener(event);
  }
}

function subscribeToDeckyDashboardProgress(
  providerId: ProviderId,
  listener: (event: DashboardRefreshProgressEvent) => void,
): () => void {
  const channel = getDeckyDashboardProgressChannel(providerId);
  channel.listeners.add(listener);
  for (const event of channel.latestByStep.values()) {
    listener(event);
  }

  return () => channel.listeners.delete(listener);
}

function notifyDeckyProviderFullScreenDataSessionChanged(): void {
  deckyProviderFullScreenDataSessionRevision += 1;
  for (const listener of deckyProviderFullScreenDataSessionListeners) {
    listener();
  }
}

function createIdleState<T>(): ResourceState<T> {
  return {
    status: "idle",
    isStale: false,
    isRefreshing: false,
  };
}

export const initialDeckyBootstrapState = createIdleState<DashboardSnapshot>();
export const initialDeckyActivityCalendarState = createIdleState<readonly RecentUnlock[]>();
export const initialDeckyAchievementHistoryState = createIdleState<AchievementHistorySnapshot>();
export const initialDeckyCompletionProgressState = createIdleState<CompletionProgressSnapshot>();
export const initialDeckyGameDetailState = createIdleState<GameDetailSnapshot>();
export const initialDeckySteamHuntersProfileState = createIdleState<SteamHuntersProfile>();
const loadingDeckySteamHuntersProfileState: ResourceState<SteamHuntersProfile> = {
  status: "loading",
  isStale: false,
  isRefreshing: false,
};
const unavailableDeckySteamHuntersProfileState: ResourceState<SteamHuntersProfile> = {
  status: "success",
  isStale: false,
  isRefreshing: false,
};

export function createDeckyPlatform(navigation?: NavigationPort): PlatformServices {
  if (navigation === undefined) {
    return {
      info: deckyPlatformInfo,
      settingsStore: createDeckySettingsStore(),
    };
  }

  return {
    info: deckyPlatformInfo,
    settingsStore: createDeckySettingsStore(),
    navigation,
  };
}

function createDeckyAppServices(runtimeMode: DeckySmokeTestCacheMode | "live") {
  if (runtimeMode === "live") {
    if (liveDeckyAppRuntime === undefined) {
      liveDeckyAppRuntime = createDeckyAppRuntime("live");
    }

    return liveDeckyAppRuntime.services;
  }

  return createDeckyAppRuntime(runtimeMode).services;
}

export function resetDeckyAppServicesForTests(): void {
  liveDeckyAppRuntime = undefined;
  deckyDashboardRefreshInFlightByProviderId.clear();
  deckyDashboardProgressChannels.clear();
  deckyProviderFullScreenDataSessions.clear();
  deckySteamHuntersProfileLoadsByProviderId.clear();
  deckyProviderFullScreenCompactReturnRefreshSuppressions.clear();
  deckyProviderFullScreenDataSessionRevision = 0;
  deckyProviderFullScreenDataSessionListeners.clear();
  deckySteamHuntersService.clearCache();
}

/**
 * Resolves optional SteamHunters data against an existing Steam snapshot.
 * This deliberately does not refresh Steam user/account data.
 */
export async function loadDeckySteamHuntersEnrichedGameDetail(
  snapshot: GameDetailSnapshot,
): Promise<GameDetailSnapshot> {
  const appId = snapshot.game.appid ?? Number(snapshot.game.gameId);
  if (snapshot.game.providerId !== STEAM_PROVIDER_ID || !Number.isSafeInteger(appId) || appId <= 0) {
    return snapshot;
  }

  const enrichedSnapshot = composeSteamGameDetailWithSteamHunters(
    snapshot,
    await deckySteamHuntersService.loadGameData(appId),
  );
  const preservedSnapshot = preserveCachedSteamHuntersEnrichment(
    enrichedSnapshot,
    readDeckySteamGameDetailCacheEntry(snapshot.game.gameId)?.snapshot,
  );
  if (preservedSnapshot !== snapshot) {
    writeDeckySteamGameDetail(preservedSnapshot);
  }

  return preservedSnapshot;
}

/**
 * Resolves the existing shared SteamHunters per-game request without applying
 * the provider's general 750ms optional-enrichment budget. Compact achievement
 * destinations use this to wait for a terminal result before rendering.
 */
export function loadDeckySteamHuntersGameData(
  appId: number,
): Promise<import("../../providers/steamhunters/types").SteamHuntersGameData | undefined> {
  return deckySteamHuntersService.loadGameData(appId);
}

/** Loads optional SteamHunters profile totals without refreshing Steam account data. */
export async function loadDeckySteamHuntersProfileState(
  steamId: string,
  onProgress?: (event: Omit<DashboardRefreshProgressEvent, "stepId"> & { readonly stepId: "steam-hunters" }) => void,
): Promise<ResourceState<SteamHuntersProfile>> {
  if (!isDeckySteamHuntersPersonalDataEnabled()) {
    return unavailableDeckySteamHuntersProfileState;
  }

  const startedAt = Date.now();
  onProgress?.({ stepId: "steam-hunters", status: "in-progress" });
  try {
    const profile = await deckySteamHuntersService.loadProfile(steamId);
    onProgress?.({ stepId: "steam-hunters", status: "complete", durationMs: Date.now() - startedAt });
    if (!isDeckySteamHuntersPersonalDataEnabled()) {
      return unavailableDeckySteamHuntersProfileState;
    }
    return {
      status: "success",
      isStale: false,
      isRefreshing: false,
      ...(profile !== undefined ? { data: profile } : {}),
    };
  } catch (error) {
    onProgress?.({ stepId: "steam-hunters", status: "failed", durationMs: Date.now() - startedAt });
    if (!isDeckySteamHuntersPersonalDataEnabled()) {
      return unavailableDeckySteamHuntersProfileState;
    }
    return {
      status: "error",
      error: {
        kind: "unknown",
        userMessage: "SteamHunters profile data is currently unavailable.",
        retryable: true,
        cause: error,
      },
      isStale: false,
      isRefreshing: false,
    };
  }
}

/** Refreshes the optional SteamHunters profile separately from Steam's API data. */
export async function refreshDeckySteamHuntersProfileState(
  steamId: string,
): Promise<ResourceState<SteamHuntersProfile>> {
  if (!isDeckySteamHuntersPersonalDataEnabled()) {
    return unavailableDeckySteamHuntersProfileState;
  }
  deckySteamHuntersProfileLoadsByProviderId.delete(STEAM_PROVIDER_ID);
  deckySteamHuntersService.clearProfileCache({ includeUnavailable: true });
  return loadSharedDeckySteamHuntersProfileState(STEAM_PROVIDER_ID, steamId);
}

/** Shares the optional personal lookup across compact and full-screen profile entry. */
function loadSharedDeckySteamHuntersProfileState(
  providerId: ProviderId,
  steamId: string,
): Promise<ResourceState<SteamHuntersProfile>> {
  if (!isDeckySteamHuntersPersonalDataEnabled()) {
    return Promise.resolve(unavailableDeckySteamHuntersProfileState);
  }

  const existing = deckySteamHuntersProfileLoadsByProviderId.get(providerId);
  if (existing?.steamId === steamId && existing.completedWhileDisabled !== true) {
    return existing.promise;
  }

  let entry: DeckySteamHuntersProfileLoadEntry;
  const promise = loadDeckySteamHuntersProfileState(steamId).then((state) => {
    if (deckySteamHuntersProfileLoadsByProviderId.get(providerId) === entry) {
      entry.state = state;
      entry.completedWhileDisabled = !isDeckySteamHuntersPersonalDataEnabled();
      const session = deckyProviderFullScreenDataSessions.get(providerId);
      if (session?.snapshot !== undefined) {
        session.snapshot = { ...session.snapshot, steamHuntersProfile: state };
      }
      notifyDeckyProviderFullScreenDataSessionChanged();
    }
    return state;
  });
  entry = { steamId, promise };
  deckySteamHuntersProfileLoadsByProviderId.set(providerId, entry);
  return promise;
}

function getDeckyRecentAchievementStorageKey(providerId: ProviderId, accountId: string): string {
  return `${DECKY_RECENT_ACHIEVEMENTS_STORAGE_KEY_PREFIX}:${providerId}:${accountId}`;
}

interface DeckyRecentAchievementRunLogger {
  log(stage: string, details: Record<string, unknown>): void;
}

function createDeckyRecentAchievementRunLogger(): DeckyRecentAchievementRunLogger {
  return {
    log(_stage: string, _details: Record<string, unknown>): void {
      return;
    },
  };
}

function readDeckyRecentAchievementHistory(storageKey: string): readonly RecentUnlock[] | undefined {
  const storedValue = readDeckyStorageText(storageKey);
  if (storedValue === undefined) {
    return undefined;
  }

  try {
    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) {
      return undefined;
    }

    return parsedValue as readonly RecentUnlock[];
  } catch {
    return undefined;
  }
}

function writeDeckyRecentAchievementHistory(
  storageKey: string,
  recentAchievements: readonly RecentUnlock[],
): void {
  const didWrite = writeDeckyStorageText(storageKey, JSON.stringify(recentAchievements));
  if (!didWrite) {
    removeDeckyStorageText(storageKey);
  }
}

function withDeckyRecentAchievements(
  snapshot: DashboardSnapshot,
  recentAchievements: readonly RecentUnlock[],
): DashboardSnapshot {
  return {
    ...snapshot,
    recentAchievements,
    recentUnlocks: recentAchievements,
  };
}

function persistDeckyRecentAchievementHistoryResult(
  snapshot: DashboardSnapshot,
  storageKey: string,
  recentAchievements: readonly RecentUnlock[],
): DashboardSnapshot {
  if (recentAchievements.length === 0) {
    removeDeckyStorageText(storageKey);
  } else {
    writeDeckyRecentAchievementHistory(storageKey, recentAchievements);
  }

  return withDeckyRecentAchievements(snapshot, recentAchievements);
}

function describeDeckyRecentAchievementCandidate(
  candidate: DeckyRecentAchievementCandidate,
): {
  readonly id: string;
  readonly title: string;
  readonly gameTitle: string;
  readonly source: DeckyRecentAchievementSource;
  readonly normalizedUnlockAt?: number;
  readonly trusted: boolean;
} {
  return {
    id: getRecentUnlockIdentity(candidate.recentUnlock),
    title: candidate.recentUnlock.achievement.title,
    gameTitle: candidate.recentUnlock.game.title,
    source: candidate.source,
    trusted: candidate.normalizedUnlockAt !== undefined,
    ...(candidate.normalizedUnlockAt !== undefined
      ? { normalizedUnlockAt: candidate.normalizedUnlockAt }
      : {}),
  };
}

function describeDeckyRecentAchievementGameCandidate(
  candidate: DeckyRecentAchievementGameCandidate,
): DeckyRecentAchievementDebugGameCandidate {
  return {
    id: candidate.gameId,
    title: candidate.title,
    source: candidate.source,
    unlockedCount: candidate.unlockedCount,
    ...(candidate.sortEpoch !== undefined ? { sortEpoch: candidate.sortEpoch } : {}),
  };
}

async function loadDeckyRecentAchievementDateRangeCandidates(args: {
  readonly provider: DeckyRecentAchievementBackfillProvider;
  readonly providerConfig: unknown;
  readonly memberSinceAt: number | undefined;
  readonly storageKey: string;
  readonly debugLog: DeckyRecentAchievementRunLogger;
}): Promise<readonly DeckyRecentAchievementCandidate[]> {
  if (args.provider.loadAchievementsEarnedBetween === undefined || args.memberSinceAt === undefined) {
    args.debugLog.log("date-range-skipped", {
      storageKey: args.storageKey,
      reason:
        args.provider.loadAchievementsEarnedBetween === undefined
          ? "missing-provider-method"
          : "missing-member-since",
    });
    return [];
  }

  const nowAt = Date.now();
  const fromEpochSeconds = Math.trunc(args.memberSinceAt / 1000);
  const toEpochSeconds = Math.trunc(nowAt / 1000);

  try {
    const recentUnlocks = await args.provider.loadAchievementsEarnedBetween(
      args.providerConfig,
      {
        fromEpochSeconds,
        toEpochSeconds,
        limit: DECKY_RECENT_ACHIEVEMENTS_LIMIT,
      },
    );
    const candidates = recentUnlocks.map((recentUnlock) =>
      createDeckyRecentAchievementCandidate(recentUnlock, "date-range"),
    );
    const selection = finalizeDeckyRecentAchievementCandidates(candidates);
    args.debugLog.log("date-range", {
      storageKey: args.storageKey,
      memberSinceAt: args.memberSinceAt,
      fromEpochSeconds,
      toEpochSeconds,
      dateRangeRecentUnlockCount: recentUnlocks.length,
      trustedCandidateCount: selection.trustedCandidates.length,
      fallbackCandidateCount: selection.fallbackCandidates.length,
      dateRangeSample: candidates.slice(0, 5).map(describeDeckyRecentAchievementCandidate),
      missingTimestampSamples: candidates
        .filter((candidate) => candidate.normalizedUnlockAt === undefined)
        .slice(0, 3)
        .map(describeDeckyRecentAchievementTimestampSources),
    });

    return candidates;
  } catch (cause) {
    args.debugLog.log("date-range-failed", {
      storageKey: args.storageKey,
      memberSinceAt: args.memberSinceAt,
      cause,
    });
    return [];
  }
}

interface DeckyRecentAchievementBackfillResult {
  readonly status: "success" | "completion-progress-failed";
  readonly candidates: readonly DeckyRecentAchievementCandidate[];
  readonly perGameProgressFetchCount: number;
  readonly perGameProgressFailureCount: number;
  readonly extractedBackfillCount: number;
}

async function loadDeckyRecentAchievementBackfillCandidates(args: {
  readonly provider: DeckyRecentAchievementBackfillProvider;
  readonly providerConfig: unknown;
  readonly snapshot: DashboardSnapshot;
  readonly storageKey: string;
  readonly debugLog: DeckyRecentAchievementRunLogger;
}): Promise<DeckyRecentAchievementBackfillResult> {
  let completionProgress: readonly NormalizedGame[];
  try {
    completionProgress = await args.provider.loadCompletionProgress(args.providerConfig);
  } catch (cause) {
    args.debugLog.log("completion-progress-failed", {
      storageKey: args.storageKey,
      cause,
    });
    return {
      status: "completion-progress-failed",
      candidates: [],
      perGameProgressFetchCount: 0,
      perGameProgressFailureCount: 0,
      extractedBackfillCount: 0,
    };
  }

  let providerRecentlyPlayedGames: readonly RecentlyPlayedGame[] = [];
  if (args.provider.loadRecentlyPlayedGames !== undefined) {
    try {
      providerRecentlyPlayedGames = await args.provider.loadRecentlyPlayedGames(
        args.providerConfig,
        {
          count: DECKY_RECENT_ACHIEVEMENTS_BACKFILL_RECENTLY_PLAYED_LIMIT,
        },
      );
    } catch (cause) {
      args.debugLog.log("recently-played-failed", { storageKey: args.storageKey, cause });
    }
  }

  const completionProgressGameCandidates = completionProgress
    .map((game) => createDeckyRecentAchievementCompletionProgressGameCandidate(game))
    .filter((game): game is DeckyRecentAchievementGameCandidate => game !== undefined);
  const snapshotRecentlyPlayedGameCandidates = args.snapshot.recentlyPlayedGames
    .map((game) =>
      createDeckyRecentAchievementRecentlyPlayedGameCandidate(
        game,
        "snapshot-recently-played",
      ),
    )
    .filter((game): game is DeckyRecentAchievementGameCandidate => game !== undefined);
  const providerRecentlyPlayedGameCandidates = providerRecentlyPlayedGames
    .map((game) =>
      createDeckyRecentAchievementRecentlyPlayedGameCandidate(game, "recently-played"),
    )
    .filter((game): game is DeckyRecentAchievementGameCandidate => game !== undefined);
  args.debugLog.log("candidate-sources", {
    storageKey: args.storageKey,
    completionProgressCount: completionProgress.length,
    completionProgressSample: completionProgressGameCandidates.slice(0, 5).map(
      describeDeckyRecentAchievementGameCandidate,
    ),
    providerRecentlyPlayedCount: providerRecentlyPlayedGames.length,
    providerRecentlyPlayedSample: providerRecentlyPlayedGameCandidates.slice(0, 5).map(
      describeDeckyRecentAchievementGameCandidate,
    ),
    snapshotRecentlyPlayedCount: args.snapshot.recentlyPlayedGames.length,
    snapshotRecentlyPlayedSample: snapshotRecentlyPlayedGameCandidates.slice(0, 5).map(
      describeDeckyRecentAchievementGameCandidate,
    ),
  });
  const candidateGames = selectDeckyRecentAchievementGameCandidates([
    ...completionProgressGameCandidates,
    ...snapshotRecentlyPlayedGameCandidates,
    ...providerRecentlyPlayedGameCandidates,
  ]);

  args.debugLog.log("candidate-discovery", {
    storageKey: args.storageKey,
    completionProgressCount: completionProgress.length,
    providerRecentlyPlayedCount: providerRecentlyPlayedGames.length,
    snapshotRecentlyPlayedCount: args.snapshot.recentlyPlayedGames.length,
    candidateBackfillGameCount: candidateGames.length,
    candidateBackfillSample: candidateGames.slice(0, 5).map((game) => ({
      id: game.gameId,
      title: game.title,
      source: game.source,
      unlockedCount: game.unlockedCount,
      sortEpoch: game.sortEpoch,
    })),
    containsDonkeyKongCountry: candidateGames.some((game) =>
      game.title.toLowerCase().includes("donkey kong country"),
    ),
  });

  if (candidateGames.length === 0) {
    args.debugLog.log("no-candidates", {
      storageKey: args.storageKey,
      baselineRecentAchievementCount: args.snapshot.recentAchievements.length,
      baselineRecentAchievementSample: args.snapshot.recentAchievements
        .slice(0, 5)
        .map((recentUnlock) =>
          describeDeckyRecentAchievementCandidate(
            createDeckyRecentAchievementCandidate(recentUnlock, "live-recent"),
          ),
        ),
    });
    return {
      status: "success",
      candidates: [],
      perGameProgressFetchCount: 0,
      perGameProgressFailureCount: 0,
      extractedBackfillCount: 0,
    };
  }

  const candidates: DeckyRecentAchievementCandidate[] = [];
  let perGameProgressFailureCount = 0;
  let extractedBackfillCount = 0;

  for (const candidateGame of candidateGames) {
    try {
      const gameDetail = await args.provider.loadGameProgress(args.providerConfig, candidateGame.gameId);
      const gameBackfillCandidates = gameDetail.achievements
        .filter((achievement) => achievement.isUnlocked)
        .map((achievement) => toRecentUnlock(gameDetail.game, achievement))
        .map((recentUnlock) => createDeckyRecentAchievementCandidate(recentUnlock, "backfill"));

      extractedBackfillCount += gameBackfillCandidates.length;
      candidates.push(...gameBackfillCandidates);
      args.debugLog.log("game-progress", {
        storageKey: args.storageKey,
        candidateGame: {
          id: candidateGame.gameId,
          title: candidateGame.title,
          source: candidateGame.source,
          sortEpoch: candidateGame.sortEpoch,
        },
        extractedCount: gameBackfillCandidates.length,
        extractedSample: gameBackfillCandidates.slice(0, 2).map(
          describeDeckyRecentAchievementCandidate,
        ),
        missingTimestampSamples: gameBackfillCandidates
          .filter((candidate) => candidate.normalizedUnlockAt === undefined)
          .slice(0, 3)
          .map(describeDeckyRecentAchievementTimestampSources),
      });
    } catch (cause) {
      perGameProgressFailureCount += 1;
      args.debugLog.log("game-progress-failed", {
        storageKey: args.storageKey,
        candidateGame: {
          id: candidateGame.gameId,
          title: candidateGame.title,
          source: candidateGame.source,
          sortEpoch: candidateGame.sortEpoch,
        },
        cause,
      });
    }
  }

  return {
    status: "success",
    candidates,
    perGameProgressFetchCount: candidateGames.length,
    perGameProgressFailureCount,
    extractedBackfillCount,
  };
}

export function applyDeckyRecentAchievementHistory(
  snapshot: DashboardSnapshot,
): DashboardSnapshot {
  const storageKey = getDeckyRecentAchievementStorageKey(
    snapshot.profile.providerId,
    snapshot.profile.identity.accountId,
  );
  const cachedRecentAchievements = readDeckyRecentAchievementHistory(storageKey) ?? [];
  const mergedRecentAchievements = rankDeckyRecentAchievements([
    ...snapshot.recentAchievements.map((recentUnlock) =>
      createDeckyRecentAchievementCandidate(recentUnlock, "live-recent"),
    ),
    ...cachedRecentAchievements.map((recentUnlock) =>
      createDeckyRecentAchievementCandidate(recentUnlock, "cache"),
    ),
  ]);

  if (mergedRecentAchievements.length === 0) {
    removeDeckyStorageText(storageKey);
    return snapshot;
  }

  writeDeckyRecentAchievementHistory(storageKey, mergedRecentAchievements);

  return withDeckyRecentAchievements(snapshot, mergedRecentAchievements);
}

export function mergeDeckySteamLibraryScanRecentAchievements(
  snapshot: DashboardSnapshot,
  summary: SteamLibraryAchievementScanSummary | undefined,
): DashboardSnapshot {
  if (
    snapshot.profile.providerId !== STEAM_PROVIDER_ID ||
    summary === undefined ||
    (summary.unlockedAchievementsList?.length ?? 0) === 0
  ) {
    return snapshot;
  }

  const scanRecentAchievements = buildDeckySteamAchievementHistorySnapshotFromSummary({
    profile: snapshot.profile,
    summary,
  }).entries;
  const recentAchievements = rankDeckyRecentAchievements([
    ...snapshot.recentAchievements.map((recentUnlock) =>
      createDeckyRecentAchievementCandidate(recentUnlock, "live-recent"),
    ),
    ...scanRecentAchievements.map((recentUnlock) =>
      createDeckyRecentAchievementCandidate(recentUnlock, "live-recent"),
    ),
  ]);

  return withDeckyRecentAchievements(snapshot, recentAchievements);
}

function compareDeckyAchievementHistoryEntries(
  left: RecentUnlock,
  right: RecentUnlock,
): number {
  const leftTimestamp = getNormalizedRecentUnlockTimestamp(left);
  const rightTimestamp = getNormalizedRecentUnlockTimestamp(right);

  if (leftTimestamp !== undefined && rightTimestamp !== undefined && leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp;
  }

  if (leftTimestamp !== undefined && rightTimestamp === undefined) {
    return -1;
  }

  if (leftTimestamp === undefined && rightTimestamp !== undefined) {
    return 1;
  }

  const gameTitleDelta = left.game.title.localeCompare(right.game.title);
  if (gameTitleDelta !== 0) {
    return gameTitleDelta;
  }

  const achievementTitleDelta = left.achievement.title.localeCompare(right.achievement.title);
  if (achievementTitleDelta !== 0) {
    return achievementTitleDelta;
  }

  return getRecentUnlockIdentity(left).localeCompare(getRecentUnlockIdentity(right));
}

function selectDeckyAchievementHistoryEntries(
  entries: readonly RecentUnlock[],
): readonly RecentUnlock[] {
  const seen = new Set<string>();
  const selectedEntries: RecentUnlock[] = [];

  for (const entry of [...entries].sort(compareDeckyAchievementHistoryEntries)) {
    const identity = getRecentUnlockIdentity(entry);
    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    selectedEntries.push(entry);

  }

  return selectedEntries;
}

function summarizeDeckyAchievementHistoryEntries(
  entries: readonly RecentUnlock[],
): AchievementHistorySnapshot["summary"] {
  const newestEntry = entries[0];
  const oldestEntry = entries[entries.length - 1];
  const newestUnlockedAt =
    newestEntry !== undefined ? getNormalizedRecentUnlockTimestamp(newestEntry) : undefined;
  const oldestUnlockedAt =
    oldestEntry !== undefined ? getNormalizedRecentUnlockTimestamp(oldestEntry) : undefined;

  return {
    unlockedCount: entries.length,
    ...(newestUnlockedAt !== undefined ? { newestUnlockedAt } : {}),
    ...(oldestUnlockedAt !== undefined ? { oldestUnlockedAt } : {}),
  };
}

function mergeDeckyAchievementHistoryWithDashboardRecent(
  history: AchievementHistorySnapshot,
  dashboard: DashboardSnapshot | undefined,
): AchievementHistorySnapshot {
  if (
    dashboard === undefined ||
    dashboard.profile.providerId !== history.providerId ||
    dashboard.profile.identity.accountId !== history.profile.identity.accountId
  ) {
    return history;
  }

  const entries = selectDeckyAchievementHistoryEntries([
    ...dashboard.recentAchievements,
    ...dashboard.recentUnlocks,
    ...history.entries,
  ]);

  const refreshedAt =
    maxDefinedNumber(history.refreshedAt, dashboard.refreshedAt) ??
    Date.now();

  return {
    ...history,
    entries,
    summary: {
      ...summarizeDeckyAchievementHistoryEntries(entries),
      unlockedCount: Math.max(history.summary.unlockedCount, entries.length),
    },
    refreshedAt,
  };
}

export async function buildDeckyRecentAchievementHistory(args: {
  readonly provider: DeckyRecentAchievementBackfillProvider | undefined;
  readonly providerConfig: unknown | undefined;
  readonly snapshot: DashboardSnapshot;
}): Promise<DashboardSnapshot> {
  const debugLog = createDeckyRecentAchievementRunLogger();
  const storageKey = getDeckyRecentAchievementStorageKey(
    args.snapshot.profile.providerId,
    args.snapshot.profile.identity.accountId,
  );
  const cachedRecentAchievements = readDeckyRecentAchievementHistory(storageKey) ?? [];
  const liveRecentAchievementCandidates = args.snapshot.recentAchievements.map((recentUnlock) =>
    createDeckyRecentAchievementCandidate(recentUnlock, "live-recent"),
  );
  const cachedRecentAchievementCandidates = cachedRecentAchievements.map((recentUnlock) =>
    createDeckyRecentAchievementCandidate(recentUnlock, "cache"),
  );
  const baselineRecentAchievementCandidates = selectDeckyRecentAchievementCandidates([
    ...liveRecentAchievementCandidates,
    ...cachedRecentAchievementCandidates,
  ]);
  const baselineSelection = finalizeDeckyRecentAchievementCandidates(baselineRecentAchievementCandidates);
  const baselineRecentAchievements = baselineSelection.selectedCandidates.map(
    (candidate) => candidate.recentUnlock,
  );
  debugLog.log("start", {
    storageKey,
    liveRecentCount: args.snapshot.recentAchievements.length,
    cachedHistoryCount: cachedRecentAchievements.length,
    liveRecentSample: liveRecentAchievementCandidates.slice(0, 5).map(
      describeDeckyRecentAchievementCandidate,
    ),
  });
  debugLog.log("after-cache-merge", {
    storageKey,
    cachedHistoryCount: cachedRecentAchievements.length,
    trustedCandidateCount: baselineSelection.trustedCandidates.length,
    fallbackCandidateCount: baselineSelection.fallbackCandidates.length,
    cachedHistorySample: baselineRecentAchievementCandidates.slice(0, 3).map(
      describeDeckyRecentAchievementCandidate,
    ),
    missingTimestampSamples: baselineRecentAchievementCandidates
      .filter((candidate) => candidate.normalizedUnlockAt === undefined)
      .slice(0, 3)
      .map(describeDeckyRecentAchievementTimestampSources),
  });

  if (args.provider === undefined || args.providerConfig === undefined) {
    debugLog.log("skip-backfill", {
      storageKey,
      reason: args.provider === undefined ? "missing-provider" : "missing-config",
      baselineRecentAchievementCount: baselineRecentAchievements.length,
      baselineRecentAchievementSample: baselineRecentAchievementCandidates
        .slice(0, 5)
        .map(describeDeckyRecentAchievementCandidate),
    });
    return persistDeckyRecentAchievementHistoryResult(
      args.snapshot,
      storageKey,
      baselineRecentAchievements,
    );
  }

  const memberSinceAt = getDeckyRecentAchievementProfileMemberSinceAt(args.snapshot);
  debugLog.log("profile-history-bound", {
    storageKey,
    canLoadDateRange: args.provider.loadAchievementsEarnedBetween !== undefined,
    memberSinceAt,
    memberSinceRaw: args.snapshot.profile.metrics.find((metric) =>
      metric.key === "member-since" || metric.label.toLowerCase() === "member since",
    )?.value,
  });

  let candidateSelection = baselineSelection;
  let candidateRecentAchievementCandidates = baselineRecentAchievementCandidates;
  const dateRangeRecentAchievementCandidates = await loadDeckyRecentAchievementDateRangeCandidates({
    provider: args.provider,
    providerConfig: args.providerConfig,
    memberSinceAt,
    storageKey,
    debugLog,
  });
  candidateRecentAchievementCandidates = [
    ...candidateRecentAchievementCandidates,
    ...dateRangeRecentAchievementCandidates,
  ];
  candidateSelection = finalizeDeckyRecentAchievementCandidates(candidateRecentAchievementCandidates);

  if (candidateSelection.trustedCandidates.length >= DECKY_RECENT_ACHIEVEMENTS_LIMIT) {
    const finalRecentAchievementCandidates = candidateSelection.selectedCandidates;
    const finalRecentAchievements = finalRecentAchievementCandidates.map(
      (candidate) => candidate.recentUnlock,
    );
    debugLog.log("candidate-discovery-skipped", {
      storageKey,
      reason: "date-range-satisfied",
      dateRangeTrustedCount: candidateSelection.trustedCandidates.length,
      dateRangeFallbackCount: candidateSelection.fallbackCandidates.length,
    });
    debugLog.log("final", {
      storageKey,
      mode: "date-range",
      finalRecentAchievementCount: finalRecentAchievements.length,
      trustedCandidateCount: candidateSelection.trustedCandidates.length,
      fallbackCandidateCount: candidateSelection.fallbackCandidates.length,
    });

    return persistDeckyRecentAchievementHistoryResult(
      args.snapshot,
      storageKey,
      finalRecentAchievements,
    );
  }

  const backfill = await loadDeckyRecentAchievementBackfillCandidates({
    provider: args.provider,
    providerConfig: args.providerConfig,
    snapshot: args.snapshot,
    storageKey,
    debugLog,
  });
  if (backfill.status === "completion-progress-failed") {
    const finalRecentAchievements = candidateSelection.selectedCandidates.map(
      (candidate) => candidate.recentUnlock,
    );
    return persistDeckyRecentAchievementHistoryResult(
      args.snapshot,
      storageKey,
      finalRecentAchievements,
    );
  }

  const finalSelection = finalizeDeckyRecentAchievementCandidates([
    ...candidateSelection.selectedCandidates,
    ...backfill.candidates,
  ]);
  const finalRecentAchievementCandidates = finalSelection.selectedCandidates;
  const finalRecentAchievements = finalRecentAchievementCandidates.map(
    (candidate) => candidate.recentUnlock,
  );
  debugLog.log("merge-before-limit", {
    storageKey,
    dateRangeTrustedCount: candidateSelection.trustedCandidates.length,
    dateRangeFallbackCount: candidateSelection.fallbackCandidates.length,
    perGameProgressFetchCount: backfill.perGameProgressFetchCount,
    perGameProgressFailureCount: backfill.perGameProgressFailureCount,
    extractedBackfillCount: backfill.extractedBackfillCount,
    mergedHistoryCountBeforeLimit:
      candidateSelection.selectedCandidates.length + backfill.candidates.length,
    trustedCandidateCount: finalSelection.trustedCandidates.length,
    fallbackCandidateCount: finalSelection.fallbackCandidates.length,
    topTrustedCandidateSample: finalSelection.trustedCandidates.slice(0, 10).map(
      describeDeckyRecentAchievementCandidate,
    ),
    mergedHistorySample: finalRecentAchievementCandidates.map(
      describeDeckyRecentAchievementCandidate,
    ),
    missingTimestampSamples: [
      ...candidateSelection.selectedCandidates,
      ...backfill.candidates,
    ]
      .filter((candidate) => candidate.normalizedUnlockAt === undefined)
      .slice(0, 5)
      .map(describeDeckyRecentAchievementTimestampSources),
  });

  if (finalRecentAchievements.length === 0) {
    removeDeckyStorageText(storageKey);
    debugLog.log("empty-after-backfill", { storageKey });
    return withDeckyRecentAchievements(
      args.snapshot,
      candidateSelection.selectedCandidates.map((candidate) => candidate.recentUnlock),
    );
  }

  debugLog.log("final", {
    storageKey,
    finalRecentAchievementCount: finalRecentAchievements.length,
  });

  return persistDeckyRecentAchievementHistoryResult(
    args.snapshot,
    storageKey,
    finalRecentAchievements,
  );
}

export async function loadDeckyDashboardState(
  providerId: ProviderId,
  options?: {
    readonly forceRefresh?: boolean;
    /** Full-screen entry renders direct recent data first; history backfill is non-critical. */
    readonly skipRecentAchievementHistoryBackfill?: boolean;
    readonly onProgress?: (event: DashboardRefreshProgressEvent) => void;
  },
): Promise<ResourceState<DashboardSnapshot>> {
  const runtimeMode: DeckyRuntimeMode = loadDeckyRuntimeMode();

  if (runtimeMode === "empty") {
    return initialDeckyBootstrapState;
  }

  if (providerId === STEAM_PROVIDER_ID && options?.forceRefresh) {
    clearSteamRecentGameSnapshotLoadCache();
  }

  if (runtimeMode === "live" && !options?.forceRefresh) {
    const cachedDashboardState = readDeckyDashboardSnapshotState(providerId);
    if (cachedDashboardState !== undefined) {
      if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
        markRetroAchievementsCachedDashboardRestored(cachedDashboardState.lastUpdatedAt);
      }
      if (providerId === STEAM_PROVIDER_ID) {
        markSteamCachedDashboardRestored(cachedDashboardState.lastUpdatedAt);
      }
      return cachedDashboardState;
    }
  }

  const activeRefresh = deckyDashboardRefreshInFlightByProviderId.get(providerId);
  if (activeRefresh !== undefined) {
    if (options?.onProgress === undefined) {
      return activeRefresh;
    }

    // Refreshes are coalesced by provider. Subscribe to the existing operation
    // so a screen joining it receives both its current phase and future events.
    const unsubscribe = subscribeToDeckyDashboardProgress(providerId, options.onProgress);
    try {
      return await activeRefresh;
    } finally {
      unsubscribe();
    }
  }

  const unsubscribeProgress = options?.onProgress === undefined
    ? undefined
    : subscribeToDeckyDashboardProgress(providerId, options.onProgress);

  const dashboardRefreshStartedAt = Date.now();
  console.info("[Achievement Companion][Decky] Dashboard refresh started", {
    providerId,
    mode: options?.forceRefresh ? "manual" : "initial",
  });
  void deckyDiagnosticLogger.record({
    event: "dashboard_refresh_started",
    providerId,
    mode: options?.forceRefresh ? "manual" : "initial",
  });
  const refreshPromise = (async () => {
    const dashboardRefreshPromise = createDeckyAppServices(runtimeMode).dashboard.loadDashboard(providerId, {
      ...options,
      onProgress: (event) => publishDeckyDashboardProgress(providerId, event),
    });
    const state = await dashboardRefreshPromise;
    if (state.data === undefined) {
      publishDeckyDashboardProgress(providerId, { stepId: "finalize", status: "failed" });
      if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
        markRetroAchievementsRefreshFailure(state.error, { isShowingCachedData: false });
      }
      if (providerId === STEAM_PROVIDER_ID) {
        markSteamRefreshFailure(state.error, { isShowingCachedData: false });
      }
      console.warn("[Achievement Companion][Decky] Dashboard refresh failed", {
        providerId,
        mode: options?.forceRefresh ? "manual" : "initial",
        durationMs: Date.now() - dashboardRefreshStartedAt,
        errorKind: state.error?.kind ?? "unknown",
      });
      void deckyDiagnosticLogger.record({
        event: "dashboard_refresh_failed",
        providerId,
        mode: options?.forceRefresh ? "manual" : "initial",
        durationMs: Date.now() - dashboardRefreshStartedAt,
        errorKind: state.error?.kind ?? "unknown",
      });
      return state;
    }

    if (state.error !== undefined) {
      publishDeckyDashboardProgress(providerId, { stepId: "finalize", status: "failed" });
      if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
        markRetroAchievementsRefreshFailure(state.error, { isShowingCachedData: true });
      }
      if (providerId === STEAM_PROVIDER_ID) {
        markSteamRefreshFailure(state.error, { isShowingCachedData: true });
      }
      return state;
    }

    const provider = runtimeMode === "live"
      ? (providerRegistry.get(providerId) as DeckyRecentAchievementBackfillProvider | undefined)
      : undefined;
    const providerConfig = runtimeMode === "live" ? await loadDeckyProviderConfig(providerId) : undefined;
    // The dashboard/profile path deliberately uses the last-known-good library
    // summary. Refreshing every owned game's player state belongs to explicit
    // refresh, so failed or incomplete recent-game data cannot lower totals.
    const steamLibraryScanSummary = providerId === STEAM_PROVIDER_ID
      ? readDeckySteamLibraryAchievementScanSummary(providerId)
      : undefined;
    const reconciledSteamLibraryScanSummary = steamLibraryScanSummary === undefined
      ? undefined
      : reconcileSteamLibraryAchievementSummaryWithRecentGames(
          steamLibraryScanSummary,
          state.data.recentlyPlayedGames,
          new Date(state.lastUpdatedAt ?? Date.now()).toISOString(),
        );
    if (reconciledSteamLibraryScanSummary !== undefined && reconciledSteamLibraryScanSummary !== steamLibraryScanSummary) {
      const expectedRevision = getDeckySteamLibraryAchievementScanRevision();
      writeDeckySteamLibraryAchievementScanSummaryIfRevisionMatches(
        expectedRevision,
        reconciledSteamLibraryScanSummary,
      );
    }
    const snapshotWithSteamScanAchievements = mergeDeckySteamLibraryScanRecentAchievements(
      state.data,
      reconciledSteamLibraryScanSummary,
    );
    const dashboardSnapshot = options?.skipRecentAchievementHistoryBackfill === true
      ? snapshotWithSteamScanAchievements
      : await buildDeckyRecentAchievementHistory({
          provider,
          providerConfig,
          snapshot: snapshotWithSteamScanAchievements,
        });
    if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
      updateDeckyRetroAchievementsRankTrends(
        dashboardSnapshot.profile,
        readDeckyDashboardSnapshotState(providerId)?.data?.profile,
      );
    }
    writeDeckyDashboardSnapshot(dashboardSnapshot);
    if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
      publishDeckyRaNativeAchievementInvalidation("provider-refreshed");
    }
    publishDeckyDashboardProgress(providerId, { stepId: "finalize", status: "complete" });

    if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
      markRetroAchievementsAuthenticatedSuccess(state.lastUpdatedAt ?? Date.now());
    }
    if (providerId === STEAM_PROVIDER_ID) {
      markSteamAuthenticatedSuccess(state.lastUpdatedAt ?? Date.now());
    }

    {
      console.info("[Achievement Companion][Decky] Dashboard refresh completed", {
        providerId,
        mode: options?.forceRefresh ? "manual" : "initial",
        durationMs: Date.now() - dashboardRefreshStartedAt,
        source: "live",
      });
      void deckyDiagnosticLogger.record({
        event: "dashboard_refresh_completed",
        providerId,
        mode: options?.forceRefresh ? "manual" : "initial",
        durationMs: Date.now() - dashboardRefreshStartedAt,
        source: "live",
      });
    }

    return {
      ...state,
      data: dashboardSnapshot,
    };
  })();

  deckyDashboardRefreshInFlightByProviderId.set(providerId, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    if (deckyDashboardRefreshInFlightByProviderId.get(providerId) === refreshPromise) {
      deckyDashboardRefreshInFlightByProviderId.delete(providerId);
    }
    unsubscribeProgress?.();
    deckyDashboardProgressChannels.delete(providerId);
  }
}

export async function loadDeckyCompletionProgressState(
  providerId: ProviderId,
): Promise<ResourceState<CompletionProgressSnapshot>> {
  const runtimeMode: DeckyRuntimeMode = loadDeckyRuntimeMode();

  if (runtimeMode === "empty") {
    return initialDeckyCompletionProgressState;
  }

  if (providerId === STEAM_PROVIDER_ID) {
    const cachedSteamLibraryScanSummary = readDeckySteamLibraryAchievementScanSummary(providerId);
    if (cachedSteamLibraryScanSummary !== undefined && cachedSteamLibraryScanSummary.games.length > 0) {
      const parsedLastUpdatedAt = Date.parse(cachedSteamLibraryScanSummary.scannedAt);
      return {
        status: "success",
        data: mergeDeckySteamCompletionProgressWithDashboard(
          buildDeckySteamCompletionProgressSnapshotFromSummary(cachedSteamLibraryScanSummary),
          readDeckyDashboardSnapshotState(providerId)?.data,
        ),
        lastUpdatedAt: Number.isFinite(parsedLastUpdatedAt) ? parsedLastUpdatedAt : Date.now(),
        isStale: false,
        isRefreshing: false,
      };
    }
  }

  return createDeckyAppServices(runtimeMode).completionProgress.loadCompletionProgress(providerId);
}

export async function loadDeckyActivityCalendarState(
  providerId: ProviderId,
  options?: { readonly forceRefresh?: boolean },
): Promise<ResourceState<readonly RecentUnlock[]>> {
  const runtimeMode = loadDeckyRuntimeMode();
  if (runtimeMode === "empty") return initialDeckyActivityCalendarState;
  return createDeckyAppServices(runtimeMode).activityCalendar.loadActivityCalendarUnlocks(providerId, options);
}

export function getDeckyCompletionProgressStateForFullScreenEntryInitial(
  providerId: ProviderId | undefined,
): ResourceState<CompletionProgressSnapshot> {
  return getDeckyProviderFullScreenDataSessionSnapshot(providerId)?.completionProgress ??
    initialDeckyCompletionProgressState;
}

/**
 * Refresh the complete owned Steam library only for an explicit user action.
 * The underlying coordinator retains account/revision and stale-write guards.
 */
export async function refreshDeckySteamLibraryForExplicitRefresh(): Promise<
  SteamLibraryAchievementScanSummary | undefined
> {
  const config = await loadDeckyProviderConfig(STEAM_PROVIDER_ID);
  if (config === undefined || !("steamId64" in config)) {
    return readDeckySteamLibraryAchievementScanSummary(STEAM_PROVIDER_ID);
  }

  try {
    return await refreshAndCacheDeckySteamLibraryAchievementProgress(config as SteamProviderConfig);
  } catch (cause) {
    console.warn("[Achievement Companion][Steam] Explicit library refresh failed; cached library was retained", {
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return readDeckySteamLibraryAchievementScanSummary(STEAM_PROVIDER_ID);
  }
}

/**
 * Runs the explicit full-library scan used for initial population and recovery.
 * This is intentionally separate from the bounded Steam dashboard refresh.
 */
export async function runDeckySteamFullLibraryScan(): Promise<
  SteamLibraryAchievementScanSummary | undefined
> {
  const config = await loadDeckyProviderConfig(STEAM_PROVIDER_ID);
  if (config === undefined || !("steamId64" in config)) {
    return readDeckySteamLibraryAchievementScanSummary(STEAM_PROVIDER_ID);
  }

  try {
    return await runAndCacheDeckySteamLibraryAchievementScan(config as SteamProviderConfig);
  } catch (cause) {
    console.warn("[Achievement Companion][Steam] Full library scan failed; cached library was retained", {
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return readDeckySteamLibraryAchievementScanSummary(STEAM_PROVIDER_ID);
  }
}

function summarizeFullScreenCompletionProgress(
  games: readonly NormalizedGame[],
): CompletionProgressSnapshot["summary"] {
  return {
    playedCount: games.length,
    unfinishedCount: games.filter((game) => game.status === "in_progress").length,
    beatenCount: games.filter((game) => game.status === "beaten").length,
    masteredCount: games.filter((game) => game.status === "mastered").length,
  };
}

function buildRetroAchievementsCompletionProgressFromDashboard(
  dashboard: ResourceState<DashboardSnapshot>,
): ResourceState<CompletionProgressSnapshot> | undefined {
  if (dashboard.data?.profile.providerId !== RETROACHIEVEMENTS_PROVIDER_ID) {
    return undefined;
  }

  const games = dashboard.data.profile.featuredGames ?? [];
  return {
    status: dashboard.status === "stale" ? "stale" : "success",
    data: {
      providerId: RETROACHIEVEMENTS_PROVIDER_ID,
      games,
      summary: summarizeFullScreenCompletionProgress(games),
      ...(dashboard.data.refreshedAt !== undefined ? { refreshedAt: dashboard.data.refreshedAt } : {}),
    },
    ...(dashboard.error !== undefined ? { error: dashboard.error } : {}),
    ...(dashboard.lastUpdatedAt !== undefined ? { lastUpdatedAt: dashboard.lastUpdatedAt } : {}),
    isStale: dashboard.isStale,
    isRefreshing: false,
  };
}

async function createDeckyProviderFullScreenDataSession(
  providerId: ProviderId,
): Promise<DeckyProviderFullScreenDataSession> {
  // One QAM profile visit prepares the dashboard, Games, Activity, and optional
  // SteamHunters profile data. The full library scan remains its own operation.
  const dashboard = await loadDeckyDashboardState(providerId, {
    forceRefresh: true,
    skipRecentAchievementHistoryBackfill: true,
  });

  const completionProgressPromise = Promise.resolve(
    buildRetroAchievementsCompletionProgressFromDashboard(dashboard),
  ).then((derivedState) => derivedState ?? loadDeckyCompletionProgressState(providerId));
  const achievementHistoryPromise = loadDeckyAchievementHistoryState(providerId, {
    forceRefresh: providerId === RETROACHIEVEMENTS_PROVIDER_ID,
    ...(dashboard.data !== undefined ? { profile: dashboard.data.profile, dashboard } : {}),
  });
  const steamHuntersProfilePromise = providerId === STEAM_PROVIDER_ID && dashboard.data !== undefined && isDeckySteamHuntersPersonalDataEnabled()
    ? loadSharedDeckySteamHuntersProfileState(providerId, dashboard.data.profile.identity.accountId)
    : Promise.resolve(unavailableDeckySteamHuntersProfileState);
  const [completionProgress, achievementHistory, steamHuntersProfile] = await Promise.all([
    completionProgressPromise,
    achievementHistoryPromise,
    steamHuntersProfilePromise,
  ]);

  const dashboardWithRecentHistory =
    dashboard.data !== undefined &&
    achievementHistory.data !== undefined &&
    achievementHistory.data.entries.length > 0
      ? {
          ...dashboard,
          data: withDeckyRecentAchievements(
            dashboard.data,
            achievementHistory.data.entries.slice(0, DECKY_RECENT_ACHIEVEMENTS_LIMIT),
          ),
        }
      : dashboard;

  if (dashboardWithRecentHistory.status === "success" && dashboardWithRecentHistory.error === undefined) {
    writeDeckyDashboardSnapshot(dashboardWithRecentHistory.data!);
  }

  return {
    dashboard: dashboardWithRecentHistory,
    completionProgress,
    achievementHistory,
    steamHuntersProfile: isDeckySteamHuntersPersonalDataEnabled()
      ? steamHuntersProfile
      : unavailableDeckySteamHuntersProfileState,
  };
}

/** Starts one shared provider-profile load for QAM and its full-screen tabs. */
export function startDeckyProviderProfileDataSession(providerId: ProviderId): void {
  deckyProviderFullScreenDataSessions.delete(providerId);
  deckySteamHuntersProfileLoadsByProviderId.delete(providerId);
  deckyProviderFullScreenCompactReturnRefreshSuppressions.delete(providerId);
  if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
    resetDeckyRetroAchievementsGamePlaytimeSession();
  }
  if (providerId === STEAM_PROVIDER_ID) {
    deckySteamHuntersService.clearProfileCache();
  }
  notifyDeckyProviderFullScreenDataSessionChanged();
}

/** Preserves a QAM-started data session when navigation enters full-screen. */
export function beginDeckyProviderFullScreenDataSession(providerId: ProviderId): void {
  if (deckyProviderFullScreenDataSessions.has(providerId)) {
    return;
  }
  if (providerId === STEAM_PROVIDER_ID) {
    deckySteamHuntersProfileLoadsByProviderId.delete(providerId);
    deckySteamHuntersService.clearProfileCache();
  }
  notifyDeckyProviderFullScreenDataSessionChanged();
}

/** Keeps the loaded data for the compact profile returned to after full-screen. */
export function endDeckyProviderFullScreenDataSession(providerId: ProviderId): void {
  deckyProviderFullScreenCompactReturnRefreshSuppressions.add(providerId);
}

export function consumeDeckyProviderFullScreenCompactReturnRefreshSuppression(
  providerId: ProviderId,
): boolean {
  if (!deckyProviderFullScreenCompactReturnRefreshSuppressions.has(providerId)) {
    return false;
  }
  deckyProviderFullScreenCompactReturnRefreshSuppressions.delete(providerId);
  return true;
}

export function subscribeDeckyProviderFullScreenDataSession(listener: () => void): () => void {
  deckyProviderFullScreenDataSessionListeners.add(listener);
  return () => deckyProviderFullScreenDataSessionListeners.delete(listener);
}

export function getDeckyProviderFullScreenDataSessionRevision(): number {
  return deckyProviderFullScreenDataSessionRevision;
}

export function loadDeckyProviderFullScreenDataSession(
  providerId: ProviderId,
): Promise<DeckyProviderFullScreenDataSession> {
  const existing = deckyProviderFullScreenDataSessions.get(providerId);
  if (existing !== undefined) {
    return existing.promise;
  }

  let entry: DeckyProviderFullScreenDataSessionEntry;
  const promise = createDeckyProviderFullScreenDataSession(providerId).then((snapshot) => {
    entry.snapshot = snapshot;
    return snapshot;
  });
  entry = { promise };
  deckyProviderFullScreenDataSessions.set(providerId, entry);
  return promise;
}

function getDeckyProviderFullScreenDataSessionSnapshot(
  providerId: ProviderId | undefined,
): DeckyProviderFullScreenDataSession | undefined {
  return providerId === undefined
    ? undefined
    : deckyProviderFullScreenDataSessions.get(providerId)?.snapshot;
}

export function loadDeckyDashboardStateForFullScreenEntry(
  providerId: ProviderId,
): Promise<ResourceState<DashboardSnapshot>> {
  return loadDeckyProviderFullScreenDataSession(providerId).then((session) => session.dashboard);
}

export function getDeckyDashboardStateForFullScreenEntryInitial(
  providerId: ProviderId | undefined,
): ResourceState<DashboardSnapshot> {
  return getDeckyProviderFullScreenDataSessionSnapshot(providerId)?.dashboard ?? initialDeckyBootstrapState;
}

export function loadDeckyCompletionProgressStateForFullScreenEntry(
  providerId: ProviderId,
): Promise<ResourceState<CompletionProgressSnapshot>> {
  return loadDeckyProviderFullScreenDataSession(providerId).then((session) => session.completionProgress);
}

export function loadDeckyAchievementHistoryStateForFullScreenEntry(
  providerId: ProviderId,
): Promise<ResourceState<AchievementHistorySnapshot>> {
  return loadDeckyProviderFullScreenDataSession(providerId).then((session) => session.achievementHistory);
}

export function getDeckySteamHuntersProfileStateForFullScreenEntryInitial(
  providerId: ProviderId | undefined,
): ResourceState<SteamHuntersProfile> {
  if (!isDeckySteamHuntersPersonalDataEnabled()) {
    return unavailableDeckySteamHuntersProfileState;
  }
  if (providerId !== undefined) {
    const profileLoad = deckySteamHuntersProfileLoadsByProviderId.get(providerId);
    const session = getDeckyProviderFullScreenDataSessionSnapshot(providerId);
    if (profileLoad !== undefined &&
        (session?.dashboard.data === undefined || session.dashboard.data.profile.identity.accountId === profileLoad.steamId)) {
      return profileLoad.completedWhileDisabled === true
        ? loadingDeckySteamHuntersProfileState
        : profileLoad.state ?? loadingDeckySteamHuntersProfileState;
    }
    if (session?.steamHuntersProfile === unavailableDeckySteamHuntersProfileState &&
        session.dashboard.data !== undefined && providerId === STEAM_PROVIDER_ID) {
      return loadingDeckySteamHuntersProfileState;
    }
  }
  return getDeckyProviderFullScreenDataSessionSnapshot(providerId)?.steamHuntersProfile ?? initialDeckySteamHuntersProfileState;
}

export function loadDeckySteamHuntersProfileStateForFullScreenEntry(
  providerId: ProviderId,
): Promise<ResourceState<SteamHuntersProfile>> {
  if (!isDeckySteamHuntersPersonalDataEnabled()) {
    return Promise.resolve(unavailableDeckySteamHuntersProfileState);
  }
  return loadDeckyProviderFullScreenDataSession(providerId).then((session) => {
    if (!isDeckySteamHuntersPersonalDataEnabled()) {
      return unavailableDeckySteamHuntersProfileState;
    }
    if (session.dashboard.data !== undefined && providerId === STEAM_PROVIDER_ID) {
      return loadSharedDeckySteamHuntersProfileState(providerId, session.dashboard.data.profile.identity.accountId);
    }
    return unavailableDeckySteamHuntersProfileState;
  });
}

/**
 * A library scan owns the complete collection and its classifications. The live
 * dashboard owns the exact recently-played set returned by the same bounded
 * refresh used by QAM. Overlay its current fields and project any newly observed
 * recent game into the full-screen Games view without mutating the saved scan.
 */
export function mergeDeckySteamCompletionProgressWithDashboard(
  completionProgress: CompletionProgressSnapshot,
  dashboard: DashboardSnapshot | undefined,
): CompletionProgressSnapshot {
  if (
    completionProgress.providerId !== STEAM_PROVIDER_ID ||
    dashboard?.profile.providerId !== STEAM_PROVIDER_ID
  ) {
    return completionProgress;
  }

  const recentlyPlayedByGameId = new Map(
    dashboard.recentlyPlayedGames.map((game) => [game.gameId, game]),
  );
  const recentlyPlayedByAppId = new Map(
    dashboard.recentlyPlayedGames
      .filter((game) => game.appid !== undefined)
      .map((game) => [game.appid!, game]),
  );
  const games = completionProgress.games.map((game) => {
    const recentlyPlayed =
      (game.appid !== undefined ? recentlyPlayedByAppId.get(game.appid) : undefined) ??
      recentlyPlayedByGameId.get(game.gameId);
    if (recentlyPlayed === undefined) {
      return game;
    }

    return {
      ...game,
      gameId: recentlyPlayed.gameId,
      title: recentlyPlayed.title,
      ...(recentlyPlayed.achievementStateIsComplete === true
        ? { summary: recentlyPlayed.summary }
        : {}),
      ...(recentlyPlayed.appid !== undefined ? { appid: recentlyPlayed.appid } : {}),
      ...(recentlyPlayed.platformLabel !== undefined
        ? { platformLabel: recentlyPlayed.platformLabel }
        : {}),
      ...(recentlyPlayed.systemIconUrl !== undefined
        ? { systemIconUrl: recentlyPlayed.systemIconUrl }
        : {}),
      ...(recentlyPlayed.coverImageUrl !== undefined
        ? { coverImageUrl: recentlyPlayed.coverImageUrl }
        : {}),
      ...(recentlyPlayed.boxArtImageUrl !== undefined
        ? { boxArtImageUrl: recentlyPlayed.boxArtImageUrl }
        : {}),
      ...(recentlyPlayed.metrics !== undefined ? { metrics: recentlyPlayed.metrics } : {}),
      ...(recentlyPlayed.playtimeForeverMinutes !== undefined
        ? { playtimeForeverMinutes: recentlyPlayed.playtimeForeverMinutes }
        : {}),
      ...(recentlyPlayed.playtimeTwoWeeksMinutes !== undefined
        ? { playtimeTwoWeeksMinutes: recentlyPlayed.playtimeTwoWeeksMinutes }
        : {}),
      ...(recentlyPlayed.playtimeDeckForeverMinutes !== undefined
        ? { playtimeDeckForeverMinutes: recentlyPlayed.playtimeDeckForeverMinutes }
        : {}),
      ...(recentlyPlayed.lastPlayedAt !== undefined
        ? { lastPlayedAt: recentlyPlayed.lastPlayedAt }
        : {}),
    } satisfies NormalizedGame;
  });
  const knownGameIds = new Set(games.flatMap((game) => [
    game.gameId,
    ...(game.appid !== undefined ? [String(game.appid)] : []),
  ]));
  const appendedGames: NormalizedGame[] = [];
  for (const recentlyPlayed of dashboard.recentlyPlayedGames) {
    const identities = [
      recentlyPlayed.gameId,
      ...(recentlyPlayed.appid !== undefined ? [String(recentlyPlayed.appid)] : []),
    ];
    if (identities.some((identity) => knownGameIds.has(identity))) {
      continue;
    }

    const normalized = normalizeSteamCompletionProgressGames([recentlyPlayed])[0];
    if (normalized === undefined) {
      continue;
    }
    const totalCount = recentlyPlayed.summary.totalCount;
    appendedGames.push({
      ...normalized,
      ...(recentlyPlayed.systemIconUrl !== undefined ? { systemIconUrl: recentlyPlayed.systemIconUrl } : {}),
      ...(recentlyPlayed.boxArtImageUrl !== undefined ? { boxArtImageUrl: recentlyPlayed.boxArtImageUrl } : {}),
      ...(recentlyPlayed.metrics !== undefined ? { metrics: recentlyPlayed.metrics } : {}),
      ...(recentlyPlayed.achievementStateIsComplete !== undefined
        ? { achievementStateIsComplete: recentlyPlayed.achievementStateIsComplete }
        : {}),
      ...(recentlyPlayed.achievementStateIsComplete === true && totalCount !== undefined
        ? {
            status: totalCount > 0 ? normalized.status : "locked",
            hasAchievements: totalCount > 0,
            scanStatus: totalCount > 0 ? "scanned" : "no-achievements",
          }
        : {}),
    });
    for (const identity of identities) knownGameIds.add(identity);
  }
  const projectedGames = [...games, ...appendedGames];
  const projectedSummary = appendedGames.length === 0
    ? completionProgress.summary
    : {
        playedCount: projectedGames.filter((game) =>
          (game.playtimeForeverMinutes ?? 0) > 0 ||
          (game.playtimeTwoWeeksMinutes ?? 0) > 0 ||
          (game.playtimeDeckForeverMinutes ?? 0) > 0 ||
          game.hasAchievements === true
        ).length,
        unfinishedCount: projectedGames.filter((game) =>
          game.scanStatus === "scanned" &&
          (game.summary.totalCount ?? 0) > 0 &&
          game.summary.unlockedCount < (game.summary.totalCount ?? 0)
        ).length,
        beatenCount: projectedGames.filter((game) =>
          game.scanStatus !== undefined && game.scanStatus !== "scanned"
        ).length,
        masteredCount: projectedGames.filter((game) =>
          game.scanStatus === "scanned" &&
          (game.summary.totalCount ?? 0) > 0 &&
          game.summary.unlockedCount >= (game.summary.totalCount ?? 0)
        ).length,
      };

  return {
    ...completionProgress,
    games: projectedGames,
    summary: projectedSummary,
    ...(dashboard.refreshedAt !== undefined ? { refreshedAt: dashboard.refreshedAt } : {}),
  };
}

export async function loadDeckyAchievementHistoryState(
  providerId: ProviderId,
  options?: {
    readonly forceRefresh?: boolean;
    readonly profile?: NormalizedProfile;
    readonly dashboard?: ResourceState<DashboardSnapshot>;
  },
): Promise<ResourceState<AchievementHistorySnapshot>> {
  const runtimeMode: DeckyRuntimeMode = loadDeckyRuntimeMode();

  if (runtimeMode === "empty") {
    return initialDeckyAchievementHistoryState;
  }

  if (providerId === STEAM_PROVIDER_ID) {
    const cachedSteamLibraryScanSummary = readDeckySteamLibraryAchievementScanSummary(providerId);
    if (
      cachedSteamLibraryScanSummary !== undefined &&
      (cachedSteamLibraryScanSummary.unlockedAchievementsList?.length ?? 0) > 0
    ) {
      const dashboardState = options?.dashboard ?? await loadDeckyDashboardState(providerId);
      if (dashboardState.data !== undefined) {
        const parsedLastUpdatedAt = Date.parse(cachedSteamLibraryScanSummary.scannedAt);
        const history = mergeDeckyAchievementHistoryWithDashboardRecent(
          buildDeckySteamAchievementHistorySnapshotFromSummary({
            profile: dashboardState.data.profile,
            summary: cachedSteamLibraryScanSummary,
          }),
          dashboardState.data,
        );
        return {
          status: "success",
          data: history,
          lastUpdatedAt: Number.isFinite(parsedLastUpdatedAt) ? parsedLastUpdatedAt : Date.now(),
          isStale: false,
          isRefreshing: false,
        };
      }
    }
  }

  let historyState = await createDeckyAppServices(runtimeMode).achievementHistory.loadAchievementHistory(
    providerId,
    {
      ...(options?.forceRefresh === true ? { forceRefresh: true } : {}),
      ...(options?.profile !== undefined ? { profile: options.profile } : {}),
    },
  );
  if (historyState.isStale) {
    historyState = await createDeckyAppServices(runtimeMode).achievementHistory.loadAchievementHistory(
      providerId,
      {
        forceRefresh: true,
        ...(options?.profile !== undefined ? { profile: options.profile } : {}),
      },
    );
  }

  if (historyState.data === undefined) {
    return historyState;
  }

  const dashboardState = options?.dashboard ?? await loadDeckyDashboardState(providerId);
  const mergedHistory = mergeDeckyAchievementHistoryWithDashboardRecent(
    historyState.data,
    dashboardState.data,
  );
  const lastUpdatedAt =
    maxDefinedNumber(
      historyState.lastUpdatedAt,
      historyState.data.refreshedAt,
      dashboardState.lastUpdatedAt,
      dashboardState.data?.refreshedAt,
      mergedHistory.refreshedAt,
    ) ?? Date.now();

  return {
    ...historyState,
    data: mergedHistory,
    lastUpdatedAt,
  };
}

export function getDeckyAchievementHistoryStateForFullScreenEntryInitial(
  providerId: ProviderId | undefined,
): ResourceState<AchievementHistorySnapshot> {
  return getDeckyProviderFullScreenDataSessionSnapshot(providerId)?.achievementHistory ??
    initialDeckyAchievementHistoryState;
}

function describeDeckyRecentAchievementTimestampSources(
  candidate: DeckyRecentAchievementCandidate,
): Record<string, unknown> {
  return {
    id: getRecentUnlockIdentity(candidate.recentUnlock),
    achievementUnlockedAt: candidate.recentUnlock.achievement.unlockedAt,
    recentUnlockUnlockedAt: candidate.recentUnlock.unlockedAt,
    normalizedUnlockAt: candidate.normalizedUnlockAt,
    source: candidate.source,
  };
}

export async function loadDeckyGameDetailState(
  providerId: ProviderId,
  gameId: string,
  options?: {
    readonly forceRefresh?: boolean;
  },
): Promise<ResourceState<GameDetailSnapshot>> {
  const runtimeMode: DeckyRuntimeMode = loadDeckyRuntimeMode();

  if (runtimeMode === "empty") {
    return initialDeckyGameDetailState;
  }

  const cachedSteamGameDetailState = runtimeMode === "live" && providerId === STEAM_PROVIDER_ID
    ? readDeckySteamGameDetailState(gameId)
    : undefined;

  const state = await createDeckyAppServices(runtimeMode).gameDetail.loadGameDetail(
    providerId,
    gameId,
    {
      forceRefresh: options?.forceRefresh ?? true,
    },
  );

  if (providerId !== STEAM_PROVIDER_ID) {
    return state;
  }

  if (state.data === undefined) {
    return cachedSteamGameDetailState === undefined
      ? state
      : {
        ...cachedSteamGameDetailState,
        ...(state.error !== undefined ? { error: state.error } : {}),
      };
  }

  const cachedSteamLibraryScanSummary = readDeckySteamLibraryAchievementScanSummary(providerId);
  const patchedGameDetail = cachedSteamLibraryScanSummary === undefined
    ? state.data
    : applySteamLibraryScanGameDetailMetadata(state.data, cachedSteamLibraryScanSummary);

  if (cachedSteamLibraryScanSummary !== undefined && patchedGameDetail !== state.data) {
    const cachedGameSummary = findSteamLibraryScanGameSummaryByAppId(
      cachedSteamLibraryScanSummary,
      state.data.game.appid ?? Number.parseInt(state.data.game.gameId, 10),
    );
    console.debug("[Achievement Companion][Steam]", {
      operation: "loadGameDetail",
      appid: patchedGameDetail.game.appid,
      cachedTitle: cachedGameSummary?.title,
      originalTitle: state.data.game.title,
      resolvedTitle: patchedGameDetail.game.title,
      hasCachedIcon: cachedGameSummary?.iconUrl !== undefined,
      hasResolvedIcon:
        patchedGameDetail.game.coverImageUrl !== undefined || patchedGameDetail.game.boxArtImageUrl !== undefined,
    });
  }

  // Persist only successful live data; a failed refresh must not replace a
  // last-known-good offline snapshot with partial or stale provider data.
  const preservedGameDetail = preserveCachedSteamHuntersEnrichment(
    patchedGameDetail,
    cachedSteamGameDetailState?.data,
  );
  if (state.status === "success" && state.error === undefined) {
    writeDeckySteamGameDetail(preservedGameDetail);
  }

  return {
    ...state,
    data: preservedGameDetail,
  };
}

/** Loads optional RA parent-linked child games without changing the normal game-detail snapshot. */
export async function loadDeckyRetroAchievementsRelatedGames(
  game: NormalizedGame,
  options?: { readonly forceRefresh?: boolean },
): Promise<ResourceState<readonly RelatedGameSummary[]>> {
  const runtimeMode: DeckyRuntimeMode = loadDeckyRuntimeMode();
  if (runtimeMode === "empty" || game.providerId !== RETROACHIEVEMENTS_PROVIDER_ID) {
    return createIdleState<readonly RelatedGameSummary[]>();
  }

  return createDeckyAppServices(runtimeMode).relatedGames.loadRelatedGames(
    RETROACHIEVEMENTS_PROVIDER_ID,
    game,
    { forceRefresh: options?.forceRefresh ?? false },
  );
}

/** Clears the cached RA relationship index; the next parent-game visit rebuilds it. */
export async function clearDeckyRetroAchievementsRelatedGameIndex(): Promise<void> {
  const runtimeMode: DeckyRuntimeMode = loadDeckyRuntimeMode();
  if (runtimeMode === "empty") return;
  await createDeckyAppServices(runtimeMode).relatedGames.clearRelatedGameIndex(
    RETROACHIEVEMENTS_PROVIDER_ID,
  );
}
