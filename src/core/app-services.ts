import type { CacheEntry, CacheStore, ResourceState } from "./cache";
import type {
  AchievementHistorySnapshot,
  CompletionProgressSnapshot,
  CompletionProgressSummary,
  DashboardSnapshot,
  GameDetailSnapshot,
  NormalizedGame,
  NormalizedMetric,
  NormalizedProfile,
  ProviderId,
  RecentlyPlayedGame,
  RecentUnlock,
} from "./domain";
import type { AppError } from "./errors";
import {
  CACHE_VERSION,
  createProviderAchievementHistoryCacheKey,
  createProviderCompletionProgressCacheKey,
  createProviderDashboardCacheKey,
  createProviderGameDetailCacheKey,
} from "./cache-keys";
import type { AchievementProvider, ProviderRegistry } from "./ports";
import type { PlatformServices } from "./platform";
import type { AppServices } from "./services";
import {
  DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS,
  loadAchievementCompanionSettings,
} from "./settings";

type ResourceCapability = "profileSummary" | "completionProgress" | "gameProgress" | "achievementHistory";
type ResourceLabel = "dashboard" | "achievement history" | "completion progress" | "game detail";

export interface AppServiceBootstrapOptions {
  readonly providerRegistry: ProviderRegistry;
  readonly platform: PlatformServices;
  readonly cacheStore: CacheStore;
  readonly loadProviderConfig: (providerId: ProviderId) => Promise<unknown | undefined>;
}

// Assumption: the compact dashboard only needs enough entries to cover the user-configurable maximum.
const DASHBOARD_RECENT_ACHIEVEMENT_LIMIT = 10;
// Assumption: recently played only needs enough entries to cover the user-configurable maximum.
const DASHBOARD_RECENTLY_PLAYED_LIMIT = 10;
// Assumption: normalized dashboard snapshots stay fresh for 15 minutes in cache.
const DASHBOARD_CACHE_TTL_MS = 15 * 60 * 1000;
// Assumption: completion progress can use the same short-lived TTL as the dashboard snapshot.
const COMPLETION_PROGRESS_CACHE_TTL_MS = 15 * 60 * 1000;
// Assumption: game detail snapshots can use the same short-lived TTL.
const GAME_DETAIL_CACHE_TTL_MS = 15 * 60 * 1000;
const providerRefreshQueues = new Map<ProviderId, Promise<void>>();

function createIdleState<T>(): ResourceState<T> {
  return {
    status: "idle",
    isStale: false,
    isRefreshing: false,
  };
}

function createErrorState<T>(error: AppError): ResourceState<T> {
  return {
    status: "error",
    error,
    isStale: false,
    isRefreshing: false,
  };
}

function createSuccessState<T>(data: T, lastUpdatedAt: number): ResourceState<T> {
  return {
    status: "success",
    data,
    lastUpdatedAt,
    isStale: false,
    isRefreshing: false,
  };
}

function createStateFromCache<T>(entry: CacheEntry<T>): ResourceState<T> {
  const isStale = entry.expiresAt <= Date.now();

  return {
    status: isStale ? "stale" : "success",
    data: entry.value,
    lastUpdatedAt: entry.storedAt,
    isStale,
    isRefreshing: false,
  };
}

function createCachedStateWithError<T>(
  state: ResourceState<T>,
  error: AppError,
): ResourceState<T> {
  return {
    ...state,
    error,
  };
}

async function runProviderRefreshExclusive<T>(
  providerId: ProviderId,
  task: () => Promise<T>,
): Promise<T> {
  const previousQueue = providerRefreshQueues.get(providerId) ?? Promise.resolve();
  let releaseCurrentQueue: (() => void) | undefined;
  const currentQueue = new Promise<void>((resolve) => {
    releaseCurrentQueue = resolve;
  });

  providerRefreshQueues.set(providerId, previousQueue.then(() => currentQueue));

  await previousQueue;
  try {
    return await task();
  } finally {
    releaseCurrentQueue?.();
  }
}

function createUnsupportedError(
  providerId: ProviderId,
  resourceLabel: ResourceLabel,
  capability: ResourceCapability,
  platform: PlatformServices,
): AppError {
  const message =
    resourceLabel === "dashboard"
      ? "Dashboard data is not available for this provider yet."
      : resourceLabel === "achievement history"
        ? "Achievement history data is not available for this provider yet."
      : resourceLabel === "completion progress"
        ? "Completion progress data is not available for this provider yet."
        : "Game detail data is not available for this provider yet.";

  return {
    kind: "unsupported",
    userMessage: message,
    retryable: false,
    providerId,
    capability,
    debugMessage: `${platform.info.appName} (${platform.info.platformId}) lacks ${capability} for ${providerId}`,
  };
}

function createCacheReadError(
  providerId: ProviderId,
  resourceLabel: ResourceLabel,
  platform: PlatformServices,
  cause: unknown,
): AppError {
  return {
    kind: "unknown",
    userMessage: `Unable to read cached ${resourceLabel} data right now.`,
    retryable: true,
    providerId,
    debugMessage: `${platform.info.platformId}:${providerId}:${resourceLabel} cache read failed`,
    cause,
  };
}

function createMissingConfigError(providerId: ProviderId): AppError {
  return {
    kind: "auth",
    userMessage: "Provider settings are missing. Set up this account to refresh dashboard data.",
    retryable: false,
    providerId,
  };
}

function createUnsupportedProviderError(
  providerId: ProviderId,
  platform: PlatformServices,
): AppError {
  return {
    kind: "unsupported",
    userMessage: "This provider is not available in the current shell.",
    retryable: false,
    providerId,
    debugMessage: `${platform.info.appName} (${platform.info.platformId}) does not have a registered provider for ${providerId}`,
  };
}

function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "userMessage" in value &&
    "retryable" in value
  );
}

function createRefreshError(
  resourceLabel: ResourceLabel,
  providerId: ProviderId,
  cause: unknown,
): AppError {
  if (isAppError(cause)) {
    return cause;
  }

  const resourceName =
    resourceLabel === "dashboard"
      ? "dashboard data"
      : resourceLabel === "achievement history"
        ? "achievement history data"
      : resourceLabel === "completion progress"
        ? "completion progress data"
        : "game detail data";

  if (cause instanceof SyntaxError) {
    return {
      kind: "parse",
      userMessage: `The provider returned an unexpected response while refreshing ${resourceName}.`,
      retryable: true,
      providerId,
      source: `${resourceLabel} refresh`,
      debugMessage: cause.message,
      cause,
    };
  }

  if (cause instanceof Error) {
    const message = cause.message.toLowerCase();
    if (message.includes("fetch") || message.includes("network")) {
      return {
        kind: "network",
        userMessage: "Unable to reach the provider right now.",
        retryable: true,
        providerId,
        debugMessage: cause.message,
        cause,
      };
    }
  }

  const debugMessage = cause instanceof Error ? cause.message : undefined;

  return {
    kind: "unknown",
    userMessage: `Unable to refresh ${resourceName} right now.`,
    retryable: true,
    providerId,
    ...(debugMessage !== undefined ? { debugMessage } : {}),
    cause,
  };
}

function createCacheKey(
  providerId: ProviderId,
  resourceLabel: ResourceLabel,
  gameId?: string,
): string {
  // Assumption: these cached snapshots are shell-neutral for now, so platform identity is excluded from the key.
  if (resourceLabel === "dashboard") {
    return createProviderDashboardCacheKey(providerId);
  }

  if (resourceLabel === "completion progress") {
    return createProviderCompletionProgressCacheKey(providerId);
  }

  if (resourceLabel === "achievement history") {
    return createProviderAchievementHistoryCacheKey(providerId);
  }

  if (gameId === undefined) {
    throw new Error("Game detail cache keys require a gameId.");
  }

  return createProviderGameDetailCacheKey(providerId, gameId);
}

async function readCachedState<T>(
  cacheStore: CacheStore,
  cacheKey: string,
): Promise<ResourceState<T> | undefined> {
  const entry = await cacheStore.read<T>(cacheKey);

  if (entry === undefined || entry.version !== CACHE_VERSION) {
    return undefined;
  }

  return createStateFromCache(entry);
}

async function readCachedStateSafely<T>(args: {
  readonly cacheStore: CacheStore;
  readonly cacheKey: string;
  readonly providerId: ProviderId;
  readonly resourceLabel: ResourceLabel;
  readonly platform: PlatformServices;
}): Promise<{ readonly cachedState?: ResourceState<T>; readonly error?: AppError }> {
  try {
    const cachedState = await readCachedState<T>(args.cacheStore, args.cacheKey);
    if (cachedState === undefined) {
      return {};
    }

    return { cachedState };
  } catch (cause) {
    return {
      error: createCacheReadError(args.providerId, args.resourceLabel, args.platform, cause),
    };
  }
}

async function loadDashboardSnapshot(
  provider: AchievementProvider,
  providerConfig: unknown,
  settingsStore: PlatformServices["settingsStore"],
): Promise<DashboardSnapshot> {
  const settings =
    settingsStore !== undefined
      ? await loadAchievementCompanionSettings(settingsStore)
      : DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS;
  const recentAchievementLimit = Math.min(
    settings.recentAchievementsCount,
    DASHBOARD_RECENT_ACHIEVEMENT_LIMIT,
  );
  const recentlyPlayedLimit = Math.min(
    settings.recentlyPlayedCount,
    DASHBOARD_RECENTLY_PLAYED_LIMIT,
  );

  const recentAchievementsPromise: Promise<readonly RecentUnlock[]> = provider.capabilities.recentUnlocks
    ? provider.loadRecentUnlocks(providerConfig, { limit: recentAchievementLimit })
    : Promise.resolve<readonly RecentUnlock[]>([]);
  const recentlyPlayedGamesPromise: Promise<readonly RecentlyPlayedGame[]> =
    provider.loadRecentlyPlayedGames(providerConfig, { count: recentlyPlayedLimit });

  const [profile, recentAchievements, recentlyPlayedGames] = await Promise.all([
    provider.loadProfile(providerConfig),
    recentAchievementsPromise,
    recentlyPlayedGamesPromise,
  ]);

  return {
    profile,
    recentAchievements,
    recentUnlocks: recentAchievements,
    recentlyPlayedGames,
    featuredGames: profile.featuredGames ?? [],
    refreshedAt: Date.now(),
  };
}

function summarizeCompletionProgressGames(
  games: readonly NormalizedGame[],
): CompletionProgressSummary {
  let playedCount = 0;
  let unfinishedCount = 0;
  let beatenCount = 0;
  let masteredCount = 0;

  for (const game of games) {
    playedCount += 1;

    if (game.status === "in_progress") {
      unfinishedCount += 1;
      continue;
    }

    if (game.status === "mastered") {
      masteredCount += 1;
      continue;
    }

    if (game.status === "beaten") {
      beatenCount += 1;
    }
  }

  return {
    playedCount,
    unfinishedCount,
    beatenCount,
    masteredCount,
  };
}

async function loadCompletionProgressSnapshot(
  provider: AchievementProvider,
  providerConfig: unknown,
  providerId: ProviderId,
): Promise<CompletionProgressSnapshot> {
  const games = provider.loadCompletionProgress !== undefined
    ? await provider.loadCompletionProgress(providerConfig)
    : [];

  return {
    providerId,
    games,
    summary: summarizeCompletionProgressGames(games),
    refreshedAt: Date.now(),
  };
}

function getMetricValue(metrics: readonly NormalizedMetric[], ...keys: string[]): string | undefined {
  for (const key of keys) {
    const match = metrics.find((metric) => metric.key === key || metric.label === key);
    if (match !== undefined) {
      return match.value;
    }
  }

  return undefined;
}

function getProfileMemberSinceAt(profile: NormalizedProfile): number | undefined {
  const rawValue = getMetricValue(profile.metrics, "member-since", "Member Since");
  if (rawValue === undefined) {
    return undefined;
  }

  const parsedAt = Date.parse(rawValue);
  if (!Number.isFinite(parsedAt)) {
    return undefined;
  }

  return Math.trunc(parsedAt);
}

function getRecentUnlockTimestamp(recentUnlock: RecentUnlock): number | undefined {
  const normalizedTimestamp = recentUnlock.unlockedAt ?? recentUnlock.achievement.unlockedAt;
  if (typeof normalizedTimestamp !== "number" || !Number.isFinite(normalizedTimestamp)) {
    return undefined;
  }

  return Math.trunc(normalizedTimestamp);
}

function compareRecentUnlocksDescending(left: RecentUnlock, right: RecentUnlock): number {
  const leftTimestamp = getRecentUnlockTimestamp(left) ?? Number.NEGATIVE_INFINITY;
  const rightTimestamp = getRecentUnlockTimestamp(right) ?? Number.NEGATIVE_INFINITY;
  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp;
  }

  const gameTitleDelta = left.game.title.localeCompare(right.game.title);
  if (gameTitleDelta !== 0) {
    return gameTitleDelta;
  }

  const achievementTitleDelta = left.achievement.title.localeCompare(right.achievement.title);
  if (achievementTitleDelta !== 0) {
    return achievementTitleDelta;
  }

  const achievementIdDelta = left.achievement.achievementId.localeCompare(right.achievement.achievementId);
  if (achievementIdDelta !== 0) {
    return achievementIdDelta;
  }

  return `${left.achievement.providerId}:${left.game.gameId}`.localeCompare(
    `${right.achievement.providerId}:${right.game.gameId}`,
  );
}

function sortRecentUnlocks(entries: readonly RecentUnlock[]): readonly RecentUnlock[] {
  return [...entries].sort(compareRecentUnlocksDescending);
}

function summarizeAchievementHistoryEntries(entries: readonly RecentUnlock[]): {
  readonly unlockedCount: number;
  readonly newestUnlockedAt?: number;
  readonly oldestUnlockedAt?: number;
} {
  const sortedEntries = sortRecentUnlocks(entries);
  const unlockedCount = sortedEntries.length;
  const newestUnlockedEntry = sortedEntries[0];
  const oldestUnlockedEntry = sortedEntries[sortedEntries.length - 1];
  const newestUnlockedAt = newestUnlockedEntry !== undefined
    ? getRecentUnlockTimestamp(newestUnlockedEntry)
    : undefined;
  const oldestUnlockedAt = oldestUnlockedEntry !== undefined
    ? getRecentUnlockTimestamp(oldestUnlockedEntry)
    : undefined;

  return {
    unlockedCount,
    ...(newestUnlockedAt !== undefined ? { newestUnlockedAt } : {}),
    ...(oldestUnlockedAt !== undefined ? { oldestUnlockedAt } : {}),
  };
}

function buildAchievementHistorySourceLabel(args: {
  readonly memberSinceAt?: number;
  readonly usedDateRange: boolean;
}): string {
  if (args.usedDateRange && args.memberSinceAt !== undefined) {
    return `Member since ${new Date(args.memberSinceAt).toLocaleDateString()} -> now`;
  }

  return "Recent unlock preview";
}

async function loadAchievementHistorySnapshot(
  provider: AchievementProvider,
  providerConfig: unknown,
  providerId: ProviderId,
): Promise<AchievementHistorySnapshot> {
  const profile = await provider.loadProfile(providerConfig);
  const memberSinceAt = getProfileMemberSinceAt(profile);
  const usedDateRange =
    provider.loadAchievementsEarnedBetween !== undefined && memberSinceAt !== undefined;

  let entries: readonly RecentUnlock[];
  if (usedDateRange) {
    entries = await provider.loadAchievementsEarnedBetween!(providerConfig, {
      fromEpochSeconds: Math.trunc(memberSinceAt / 1000),
      toEpochSeconds: Math.trunc(Date.now() / 1000),
    });
  } else {
    entries = provider.loadRecentUnlocks !== undefined
      ? await provider.loadRecentUnlocks(providerConfig, { limit: 100 })
      : [];
  }

  const normalizedEntries = sortRecentUnlocks(entries);

  return {
    providerId,
    profile,
    entries: normalizedEntries,
    summary: summarizeAchievementHistoryEntries(normalizedEntries),
    sourceLabel: buildAchievementHistorySourceLabel({
      usedDateRange,
      ...(memberSinceAt !== undefined ? { memberSinceAt } : {}),
    }),
    refreshedAt: Date.now(),
  };
}

async function loadGameDetailSnapshot(
  provider: AchievementProvider,
  providerConfig: unknown,
  gameId: string,
): Promise<GameDetailSnapshot> {
  return provider.loadGameProgress(providerConfig, gameId);
}

async function refreshDashboard(args: {
  readonly providerId: ProviderId;
  readonly providerRegistry: ProviderRegistry;
  readonly cacheStore: CacheStore;
  readonly platform: PlatformServices;
  readonly loadProviderConfig: (providerId: ProviderId) => Promise<unknown | undefined>;
  readonly cacheKey: string;
  readonly cachedState?: ResourceState<DashboardSnapshot>;
}): Promise<ResourceState<DashboardSnapshot>> {
  const provider = args.providerRegistry.get(args.providerId);
  if (provider === undefined) {
    const error = createUnsupportedProviderError(args.providerId, args.platform);
    return args.cachedState !== undefined
      ? createCachedStateWithError(args.cachedState, error)
      : createErrorState(error);
  }

  if (provider.capabilities.profileSummary === false) {
    const error = createUnsupportedError(
      args.providerId,
      "dashboard",
      "profileSummary",
      args.platform,
    );
    return args.cachedState !== undefined
      ? createCachedStateWithError(args.cachedState, error)
      : createErrorState(error);
  }

  let providerConfig: unknown | undefined;
  try {
    providerConfig = await args.loadProviderConfig(args.providerId);
  } catch (cause) {
    const error = createRefreshError("dashboard", args.providerId, cause);
    return args.cachedState !== undefined
      ? createCachedStateWithError(args.cachedState, error)
      : createErrorState(error);
  }

  if (providerConfig === undefined) {
    const error = createMissingConfigError(args.providerId);
    return args.cachedState !== undefined
      ? createCachedStateWithError(args.cachedState, error)
      : createErrorState(error);
  }

  return runProviderRefreshExclusive(args.providerId, async () => {
    try {
      const snapshot = await loadDashboardSnapshot(provider, providerConfig, args.platform.settingsStore);
      const now = Date.now();

      await args.cacheStore.write<DashboardSnapshot>({
        key: args.cacheKey,
        value: snapshot,
        storedAt: now,
        expiresAt: now + DASHBOARD_CACHE_TTL_MS,
        version: CACHE_VERSION,
      });

      return createSuccessState(snapshot, now);
    } catch (cause) {
      const error = createRefreshError("dashboard", args.providerId, cause);
      return args.cachedState !== undefined
        ? createCachedStateWithError(args.cachedState, error)
        : createErrorState(error);
    }
  });
}

async function refreshAchievementHistory(args: {
  readonly providerId: ProviderId;
  readonly providerRegistry: ProviderRegistry;
  readonly cacheStore: CacheStore;
  readonly platform: PlatformServices;
  readonly loadProviderConfig: (providerId: ProviderId) => Promise<unknown | undefined>;
  readonly cacheKey: string;
  readonly cachedState?: ResourceState<AchievementHistorySnapshot>;
}): Promise<ResourceState<AchievementHistorySnapshot>> {
  const provider = args.providerRegistry.get(args.providerId);
  if (provider === undefined) {
    const error = createUnsupportedProviderError(args.providerId, args.platform);
    return args.cachedState !== undefined
      ? createCachedStateWithError(args.cachedState, error)
      : createErrorState(error);
  }

  let providerConfig: unknown | undefined;
  try {
    providerConfig = await args.loadProviderConfig(args.providerId);
  } catch (cause) {
    const error = createRefreshError("achievement history", args.providerId, cause);
    return args.cachedState !== undefined
      ? createCachedStateWithError(args.cachedState, error)
      : createErrorState(error);
  }

  if (providerConfig === undefined) {
    const error = createMissingConfigError(args.providerId);
    return args.cachedState !== undefined
      ? createCachedStateWithError(args.cachedState, error)
      : createErrorState(error);
  }

  return runProviderRefreshExclusive(args.providerId, async () => {
    try {
      const snapshot = await loadAchievementHistorySnapshot(provider, providerConfig, args.providerId);
      const now = Date.now();

      await args.cacheStore.write<AchievementHistorySnapshot>({
        key: args.cacheKey,
        value: snapshot,
        storedAt: now,
        expiresAt: now + COMPLETION_PROGRESS_CACHE_TTL_MS,
        version: CACHE_VERSION,
      });

      return createSuccessState(snapshot, now);
    } catch (cause) {
      const error = createRefreshError("achievement history", args.providerId, cause);
      return args.cachedState !== undefined
        ? createCachedStateWithError(args.cachedState, error)
        : createErrorState(error);
    }
  });
}

async function refreshCompletionProgress(args: {
  readonly providerId: ProviderId;
  readonly providerRegistry: ProviderRegistry;
  readonly cacheStore: CacheStore;
  readonly platform: PlatformServices;
  readonly loadProviderConfig: (providerId: ProviderId) => Promise<unknown | undefined>;
  readonly cacheKey: string;
  readonly cachedState?: ResourceState<CompletionProgressSnapshot>;
}): Promise<ResourceState<CompletionProgressSnapshot>> {
  const provider = args.providerRegistry.get(args.providerId);
  if (provider === undefined) {
    const error = createUnsupportedProviderError(args.providerId, args.platform);
    return args.cachedState !== undefined
      ? createCachedStateWithError(args.cachedState, error)
      : createErrorState(error);
  }

  if (provider.capabilities.completionProgress === false || provider.loadCompletionProgress === undefined) {
    const error = createUnsupportedError(
      args.providerId,
      "completion progress",
      "completionProgress",
      args.platform,
    );
    return args.cachedState !== undefined
      ? createCachedStateWithError(args.cachedState, error)
      : createErrorState(error);
  }

  let providerConfig: unknown | undefined;
  try {
    providerConfig = await args.loadProviderConfig(args.providerId);
  } catch (cause) {
    const error = createRefreshError("completion progress", args.providerId, cause);
    return args.cachedState !== undefined
      ? createCachedStateWithError(args.cachedState, error)
      : createErrorState(error);
  }

  if (providerConfig === undefined) {
    const error = createMissingConfigError(args.providerId);
    return args.cachedState !== undefined
      ? createCachedStateWithError(args.cachedState, error)
      : createErrorState(error);
  }

  return runProviderRefreshExclusive(args.providerId, async () => {
    try {
      const snapshot = await loadCompletionProgressSnapshot(provider, providerConfig, args.providerId);
      const now = Date.now();

      await args.cacheStore.write<CompletionProgressSnapshot>({
        key: args.cacheKey,
        value: snapshot,
        storedAt: now,
        expiresAt: now + COMPLETION_PROGRESS_CACHE_TTL_MS,
        version: CACHE_VERSION,
      });

      return createSuccessState(snapshot, now);
    } catch (cause) {
      const error = createRefreshError("completion progress", args.providerId, cause);
      return args.cachedState !== undefined
        ? createCachedStateWithError(args.cachedState, error)
        : createErrorState(error);
    }
  });
}

async function refreshGameDetail(args: {
  readonly providerId: ProviderId;
  readonly providerRegistry: ProviderRegistry;
  readonly cacheStore: CacheStore;
  readonly platform: PlatformServices;
  readonly loadProviderConfig: (providerId: ProviderId) => Promise<unknown | undefined>;
  readonly cacheKey: string;
  readonly gameId: string;
  readonly cachedState?: ResourceState<GameDetailSnapshot>;
}): Promise<ResourceState<GameDetailSnapshot>> {
  const provider = args.providerRegistry.get(args.providerId);
  if (provider === undefined) {
    const error = createUnsupportedProviderError(args.providerId, args.platform);
    return args.cachedState !== undefined
      ? createCachedStateWithError(args.cachedState, error)
      : createErrorState(error);
  }

  if (provider.capabilities.gameProgress === false) {
    const error = createUnsupportedError(
      args.providerId,
      "game detail",
      "gameProgress",
      args.platform,
    );
    return args.cachedState !== undefined
      ? createCachedStateWithError(args.cachedState, error)
      : createErrorState(error);
  }

  let providerConfig: unknown | undefined;
  try {
    providerConfig = await args.loadProviderConfig(args.providerId);
  } catch (cause) {
    const error = createRefreshError("game detail", args.providerId, cause);
    return args.cachedState !== undefined
      ? createCachedStateWithError(args.cachedState, error)
      : createErrorState(error);
  }

  if (providerConfig === undefined) {
    const error = createMissingConfigError(args.providerId);
    return args.cachedState !== undefined
      ? createCachedStateWithError(args.cachedState, error)
      : createErrorState(error);
  }

  return runProviderRefreshExclusive(args.providerId, async () => {
    try {
      const snapshot = await loadGameDetailSnapshot(provider, providerConfig, args.gameId);
      const now = Date.now();

      await args.cacheStore.write<GameDetailSnapshot>({
        key: args.cacheKey,
        value: snapshot,
        storedAt: now,
        expiresAt: now + GAME_DETAIL_CACHE_TTL_MS,
        version: CACHE_VERSION,
      });

      return createSuccessState(snapshot, now);
    } catch (cause) {
      const error = createRefreshError("game detail", args.providerId, cause);
      return args.cachedState !== undefined
        ? createCachedStateWithError(args.cachedState, error)
        : createErrorState(error);
    }
  });
}

export function createAppServices(options: AppServiceBootstrapOptions): AppServices {
  return {
    dashboard: {
      async loadDashboard(providerId, requestOptions) {
        const cacheKey = createProviderDashboardCacheKey(providerId);
        const cacheRead = await readCachedStateSafely<DashboardSnapshot>({
          cacheStore: options.cacheStore,
          cacheKey,
          providerId,
          resourceLabel: "dashboard",
          platform: options.platform,
        });

        if (cacheRead.error !== undefined) {
          return createErrorState<DashboardSnapshot>(cacheRead.error);
        }

        if (cacheRead.cachedState !== undefined && !requestOptions?.forceRefresh) {
          return cacheRead.cachedState;
        }

        return refreshDashboard({
          providerId,
          providerRegistry: options.providerRegistry,
          cacheStore: options.cacheStore,
          platform: options.platform,
          loadProviderConfig: options.loadProviderConfig,
          cacheKey,
          ...(cacheRead.cachedState !== undefined ? { cachedState: cacheRead.cachedState } : {}),
        });
      },
    },
    achievementHistory: {
      async loadAchievementHistory(providerId, requestOptions) {
        const cacheKey = createCacheKey(providerId, "achievement history");
        const cacheRead = await readCachedStateSafely<AchievementHistorySnapshot>({
          cacheStore: options.cacheStore,
          cacheKey,
          providerId,
          resourceLabel: "achievement history",
          platform: options.platform,
        });

        if (cacheRead.error !== undefined) {
          return createErrorState<AchievementHistorySnapshot>(cacheRead.error);
        }

        if (cacheRead.cachedState !== undefined && !requestOptions?.forceRefresh) {
          return cacheRead.cachedState;
        }

        return refreshAchievementHistory({
          providerId,
          providerRegistry: options.providerRegistry,
          cacheStore: options.cacheStore,
          platform: options.platform,
          loadProviderConfig: options.loadProviderConfig,
          cacheKey,
          ...(cacheRead.cachedState !== undefined ? { cachedState: cacheRead.cachedState } : {}),
        });
      },
    },
    completionProgress: {
      async loadCompletionProgress(providerId, requestOptions) {
        const cacheKey = createCacheKey(providerId, "completion progress");
        const cacheRead = await readCachedStateSafely<CompletionProgressSnapshot>({
          cacheStore: options.cacheStore,
          cacheKey,
          providerId,
          resourceLabel: "completion progress",
          platform: options.platform,
        });

        if (cacheRead.error !== undefined) {
          return createErrorState<CompletionProgressSnapshot>(cacheRead.error);
        }

        if (cacheRead.cachedState !== undefined && !requestOptions?.forceRefresh) {
          return cacheRead.cachedState;
        }

        return refreshCompletionProgress({
          providerId,
          providerRegistry: options.providerRegistry,
          cacheStore: options.cacheStore,
          platform: options.platform,
          loadProviderConfig: options.loadProviderConfig,
          cacheKey,
          ...(cacheRead.cachedState !== undefined ? { cachedState: cacheRead.cachedState } : {}),
        });
      },
    },
    gameDetail: {
      async loadGameDetail(providerId, gameId, requestOptions) {
        const cacheKey = createProviderGameDetailCacheKey(providerId, gameId);
        const cacheRead = await readCachedStateSafely<GameDetailSnapshot>({
          cacheStore: options.cacheStore,
          cacheKey,
          providerId,
          resourceLabel: "game detail",
          platform: options.platform,
        });

        if (cacheRead.error !== undefined) {
          return createErrorState<GameDetailSnapshot>(cacheRead.error);
        }

        if (cacheRead.cachedState !== undefined && !requestOptions?.forceRefresh) {
          return cacheRead.cachedState;
        }

        return refreshGameDetail({
          providerId,
          providerRegistry: options.providerRegistry,
          cacheStore: options.cacheStore,
          platform: options.platform,
          loadProviderConfig: options.loadProviderConfig,
          cacheKey,
          gameId,
          ...(cacheRead.cachedState !== undefined ? { cachedState: cacheRead.cachedState } : {}),
        });
      },
    },
  };
}

