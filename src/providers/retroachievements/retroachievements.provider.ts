import type {
  GameCommunityStats,
  NormalizedGame,
  NormalizedMetric,
  ProviderCapabilities,
  RecentUnlock,
  RecentlyPlayedGame,
  RelatedGameSummary,
  ProgressSummary,
} from "@core/domain";
import type { AchievementProvider } from "@core/ports";
import { RETROACHIEVEMENTS_PROVIDER_ID, type RetroAchievementsProviderConfig } from "./config";
import { createRetroAchievementsClient, type RetroAchievementsClient } from "./client/client";
import {
  createFetchRetroAchievementsTransport,
  type FetchRetroAchievementsTransportOptions,
  type RetroAchievementsTransport,
} from "./client/transport";
import {
  countRetroAchievementsGamesBeaten,
  countRetroAchievementsGamesMastered,
  normalizeRetroAchievementsGameDetail,
  normalizeRetroAchievementsCompletionProgressGames,
  normalizeRetroAchievementsImageUrl,
  normalizeRetroAchievementsProfile,
  normalizeRetroAchievementsSelectableGames,
  normalizeRetroAchievementsRecentUnlocks,
  normalizeRetroAchievementsRecentlyPlayedGames,
  summarizeRetroAchievementsProfileAchievementCounts,
  summarizeRetroAchievementsCompletionProgress,
  summarizeRetroAchievementsGameCompletionAwardCounts,
} from "./mappers/normalize";
import type {
  RawRetroAchievementsAchievementDistributionResponse,
  RawRetroAchievementsGameProgressResponse,
  RawRetroAchievementsGameProgressionResponse,
  RawRetroAchievementsGameExtendedResponse,
  RawRetroAchievementsGameListEntry,
  RawRetroAchievementsUserProgressEntry,
  RawRetroAchievementsRecentlyPlayedGameResponse,
  RawRetroAchievementsSummaryResponse,
  RawRetroAchievementsSystemResponse,
} from "./raw-types";
import { normalizeRetroAchievementsGameCommunityStats } from "./community-stats";

const retroAchievementsCapabilities: ProviderCapabilities = {
  requiresCredentials: true,
  profileSummary: true,
  completionProgress: true,
  recentUnlocks: true,
  gameProgress: true,
  rarityStats: true,
  search: false,
};

interface RetroAchievementsProviderDependencies {
  readonly client?: RetroAchievementsClient;
  readonly transport?: RetroAchievementsTransport;
  readonly transportOptions?: FetchRetroAchievementsTransportOptions;
  /** Override the live catalogue pacing in deterministic provider tests. */
  readonly subsetVerificationIntervalMs?: number;
  /** Override the live 429 backoff in deterministic provider tests. */
  readonly subsetVerificationRetryDelayMs?: number;
  /** Injectable timer used by catalogue pacing/backoff tests. */
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

interface RetroAchievementsProviderRuntime extends AchievementProvider<RetroAchievementsProviderConfig> {
  loadCompletionProgress(
    config: RetroAchievementsProviderConfig,
  ): Promise<readonly NormalizedGame[]>;
  loadAchievementsEarnedBetween(
    config: RetroAchievementsProviderConfig,
    options: {
      readonly fromEpochSeconds: number;
      readonly toEpochSeconds: number;
      readonly limit?: number;
    },
  ): Promise<readonly RecentUnlock[]>;
  loadRelatedGames(
    config: RetroAchievementsProviderConfig,
    game: NormalizedGame,
  ): Promise<readonly RelatedGameSummary[]>;
}

// The date-range endpoint can return at most 500 records for a broad request. Split a saturated
// range until every response is complete, so a long account history does not omit recent unlocks.
const ACHIEVEMENTS_EARNED_BETWEEN_RESPONSE_LIMIT = 500;
const GAME_COMMUNITY_STATS_TTL_MS = 60 * 60 * 1000;
const RETROACHIEVEMENTS_SUBSET_CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
const RETROACHIEVEMENTS_SUBSET_FAILURE_TTL_MS = 5 * 60 * 1000;
const RETROACHIEVEMENTS_USER_PROGRESS_BATCH_SIZE = 50;
// RA rate-limits the extended metadata endpoint aggressively. Keep one request
// in flight and pace live verification below the observed burst limit.
const RETROACHIEVEMENTS_SUBSET_VERIFICATION_INTERVAL_MS = 300;
const RETROACHIEVEMENTS_SUBSET_VERIFICATION_MAX_RATE_LIMIT_RETRIES = 3;
const RETROACHIEVEMENTS_SUBSET_VERIFICATION_RETRY_DELAY_MS = 1_000;
export const DEFAULT_RETROACHIEVEMENTS_PROFILE_SUMMARY_WAIT_MS = 5_000;

/** The summary endpoint enriches the profile with rank and rich-presence data. */
export async function loadOptionalRetroAchievementsProfileSummary(
  load: (() => Promise<RawRetroAchievementsSummaryResponse>) | undefined,
  waitMs = DEFAULT_RETROACHIEVEMENTS_PROFILE_SUMMARY_WAIT_MS,
): Promise<RawRetroAchievementsSummaryResponse | undefined> {
  if (load === undefined) return undefined;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const summary = Promise.resolve().then(load).catch(() => undefined);
  const deadline = new Promise<undefined>((resolve) => {
    timeout = setTimeout(resolve, Math.max(0, waitMs));
  });

  try {
    return await Promise.race([summary, deadline]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

interface CachedGameCommunityStats {
  readonly value: GameCommunityStats | undefined;
  readonly expiresAt: number;
}

interface RetroAchievementsSubsetCatalogEntry {
  readonly gameId: string;
  readonly title: string;
  readonly platformId: string;
  readonly platformLabel?: string;
  readonly coverImageUrl?: string;
  readonly boxArtImageUrl?: string;
  readonly parentGameId?: string;
  readonly totalAchievementCount?: number;
}

interface CachedRetroAchievementsSubsetCatalog {
  readonly entries: readonly RetroAchievementsSubsetCatalogEntry[];
  readonly expiresAt: number;
}

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readIdentifier(value: unknown): string | undefined {
  const parsed = readFiniteNumber(value);
  if (parsed !== undefined) return String(Math.trunc(parsed));
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return undefined;
}

function readText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const record = error as Record<string, unknown>;
  const value = record["statusCode"] ?? record["status"];
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function readRetryAfterMs(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const value = (error as Record<string, unknown>)["retryAfterMs"];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function normalizeSubsetCatalogEntry(
  raw: RawRetroAchievementsGameListEntry,
  extended: RawRetroAchievementsGameExtendedResponse,
): RetroAchievementsSubsetCatalogEntry | undefined {
  const gameId = readIdentifier(extended.ID ?? extended.id ?? raw.ID ?? raw.id ?? raw.GameID ?? raw.gameId);
  const title = readText(extended.Title ?? extended.title ?? raw.Title ?? raw.title);
  const platformId = readIdentifier(extended.ConsoleID ?? extended.consoleId ?? raw.ConsoleID ?? raw.consoleId);
  if (gameId === undefined || title === undefined || platformId === undefined) return undefined;

  const parentGameId = readIdentifier(extended.ParentGameID ?? extended.parentGameId);
  const totalAchievementCount = readFiniteNumber(extended.NumAchievements ?? extended.numAchievements ?? raw.NumAchievements ?? raw.numAchievements);
  const coverImageUrl = readText(extended.ImageIcon ?? extended.imageIcon ?? raw.ImageIcon ?? raw.imageIcon);
  const boxArtImageUrl = readText(extended.ImageBoxArt ?? extended.imageBoxArt);
  const platformLabel = readText(extended.ConsoleName ?? extended.consoleName ?? raw.ConsoleName ?? raw.consoleName);

  return {
    gameId,
    title,
    platformId,
    ...(platformLabel !== undefined ? { platformLabel } : {}),
    ...(coverImageUrl !== undefined ? { coverImageUrl: normalizeRetroAchievementsImageUrl(coverImageUrl) } : {}),
    ...(boxArtImageUrl !== undefined ? { boxArtImageUrl: normalizeRetroAchievementsImageUrl(boxArtImageUrl) } : {}),
    ...(parentGameId !== undefined ? { parentGameId } : {}),
    ...(totalAchievementCount !== undefined ? { totalAchievementCount } : {}),
  };
}

function buildSubsetProgress(
  entry: RawRetroAchievementsUserProgressEntry | undefined,
): { readonly progress?: ProgressSummary; readonly hardcoreProgress?: ProgressSummary } {
  if (entry === undefined) return {};
  const totalCount = readFiniteNumber(entry.NumPossibleAchievements ?? entry.numPossibleAchievements);
  const unlockedCount = readFiniteNumber(entry.NumAchieved ?? entry.numAchieved);
  const hardcoreUnlockedCount = readFiniteNumber(entry.NumAchievedHardcore ?? entry.numAchievedHardcore);
  if (totalCount === undefined || unlockedCount === undefined) return {};
  const progress: ProgressSummary = {
    unlockedCount,
    totalCount,
    ...(totalCount > 0 ? { completionPercent: Math.round((unlockedCount / totalCount) * 100) } : {}),
  };
  const hardcoreProgress = hardcoreUnlockedCount === undefined
    ? undefined
    : {
        unlockedCount: hardcoreUnlockedCount,
        totalCount,
        ...(totalCount > 0 ? { completionPercent: Math.round((hardcoreUnlockedCount / totalCount) * 100) } : {}),
      } satisfies ProgressSummary;
  return {
    progress,
    ...(hardcoreProgress !== undefined ? { hardcoreProgress } : {}),
  };
}

async function loadAllAchievementsEarnedBetween(
  client: RetroAchievementsClient,
  config: RetroAchievementsProviderConfig,
  options: {
    readonly fromEpochSeconds: number;
    readonly toEpochSeconds: number;
    readonly limit?: number;
  },
): Promise<readonly RecentUnlock[]> {
  const rawUnlocks = await client.loadAchievementsEarnedBetween(config, {
    fromEpochSeconds: options.fromEpochSeconds,
    toEpochSeconds: options.toEpochSeconds,
  });
  const isSmallestRange = options.fromEpochSeconds >= options.toEpochSeconds;

  if (rawUnlocks.length < ACHIEVEMENTS_EARNED_BETWEEN_RESPONSE_LIMIT || isSmallestRange) {
    return normalizeRetroAchievementsRecentUnlocks(rawUnlocks);
  }

  const midpoint = options.fromEpochSeconds + Math.floor(
    (options.toEpochSeconds - options.fromEpochSeconds) / 2,
  );
  const newerUnlocks = await loadAllAchievementsEarnedBetween(client, config, {
    fromEpochSeconds: midpoint + 1,
    toEpochSeconds: options.toEpochSeconds,
    ...(options.limit !== undefined ? { limit: options.limit } : {}),
  });
  const remainingLimit = options.limit !== undefined
    ? Math.max(0, options.limit - newerUnlocks.length)
    : undefined;

  if (remainingLimit === 0) {
    return newerUnlocks;
  }

  const olderUnlocks = await loadAllAchievementsEarnedBetween(client, config, {
    fromEpochSeconds: options.fromEpochSeconds,
    toEpochSeconds: midpoint,
    ...(remainingLimit !== undefined ? { limit: remainingLimit } : {}),
  });

  return [...olderUnlocks, ...newerUnlocks];
}

function resolveClient(
  dependencies: RetroAchievementsProviderDependencies,
): RetroAchievementsClient {
  if (dependencies.client !== undefined) {
    return dependencies.client;
  }

  const transport =
    dependencies.transport ?? createFetchRetroAchievementsTransport(dependencies.transportOptions);

  return createRetroAchievementsClient(transport);
}

function applyRecentUnlockLimit<T>(
  items: readonly T[],
  limit?: number,
): readonly T[] {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return items;
  }

  const normalizedLimit = Math.trunc(limit);
  if (normalizedLimit <= 0) {
    return [];
  }

  return items.slice(0, normalizedLimit);
}

function getMetricValue(
  metrics: readonly NormalizedMetric[] | undefined,
  key: string,
): string | undefined {
  return metrics?.find((metric) => metric.key === key)?.value;
}

function getMetricNumber(
  metrics: readonly NormalizedMetric[] | undefined,
  key: string,
): number | undefined {
  const value = getMetricValue(metrics, key);
  const numeric = value !== undefined ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) && numeric >= 0 ? Math.trunc(numeric) : undefined;
}

function mergeMetrics(
  existingMetrics: readonly NormalizedMetric[] | undefined,
  additionalMetrics: readonly NormalizedMetric[],
): readonly NormalizedMetric[] | undefined {
  if (additionalMetrics.length === 0) {
    return existingMetrics;
  }

  const mergedMetrics = [...(existingMetrics ?? [])];

  for (const additionalMetric of additionalMetrics) {
    const existingIndex = mergedMetrics.findIndex((metric) => metric.key === additionalMetric.key);
    if (existingIndex >= 0) {
      mergedMetrics[existingIndex] = additionalMetric;
    } else {
      mergedMetrics.push(additionalMetric);
    }
  }

  return mergedMetrics;
}

function coerceIdentifier(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  return undefined;
}

function pickIdentifier(...values: unknown[]): string | undefined {
  for (const value of values) {
    const identifier = coerceIdentifier(value);
    if (identifier !== undefined) {
      return identifier;
    }
  }

  return undefined;
}

function coerceString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const normalized = coerceString(value);
    if (normalized !== undefined) {
      return normalized;
    }
  }

  return undefined;
}

function buildRetroAchievementsSystemIconUrlMap(
  systems: readonly RawRetroAchievementsSystemResponse[],
): ReadonlyMap<string, string> {
  const iconUrlByConsoleId = new Map<string, string>();

  for (const system of systems) {
    const consoleId = pickIdentifier(system.ID, system.id);
    const iconUrl = pickString(system.IconURL, system.iconUrl);
    if (consoleId === undefined || iconUrl === undefined) {
      continue;
    }

    iconUrlByConsoleId.set(consoleId, normalizeRetroAchievementsImageUrl(iconUrl));
  }

  return iconUrlByConsoleId;
}

function enrichGameWithSystemIcon(
  game: NormalizedGame,
  consoleId: string | undefined,
  systemIconUrlByConsoleId: ReadonlyMap<string, string>,
): NormalizedGame {
  if (consoleId === undefined) {
    return game;
  }

  const systemIconUrl = systemIconUrlByConsoleId.get(consoleId);
  if (systemIconUrl === undefined || game.systemIconUrl === systemIconUrl) {
    return game;
  }

  return {
    ...game,
    systemIconUrl,
  };
}

function enrichRecentlyPlayedGamesWithSystemIcons(
  games: readonly RecentlyPlayedGame[],
  rawGames: readonly RawRetroAchievementsRecentlyPlayedGameResponse[],
  systemIconUrlByConsoleId: ReadonlyMap<string, string>,
): readonly RecentlyPlayedGame[] {
  if (games.length === 0 || systemIconUrlByConsoleId.size === 0) {
    return games;
  }

  const consoleIdByGameId = new Map<string, string>();

  for (const rawGame of rawGames) {
    const gameId = pickIdentifier(rawGame.GameID, rawGame.gameId);
    const consoleId = pickIdentifier(rawGame.ConsoleID, rawGame.consoleId);
    if (gameId !== undefined && consoleId !== undefined) {
      consoleIdByGameId.set(gameId, consoleId);
    }
  }

  return games.map((game) => {
    const consoleId = consoleIdByGameId.get(game.gameId);
    const systemIconUrl = consoleId !== undefined ? systemIconUrlByConsoleId.get(consoleId) : undefined;
    if (systemIconUrl === undefined || game.systemIconUrl === systemIconUrl) {
      return game;
    }

    return {
      ...game,
      systemIconUrl,
    };
  });
}

function enrichGameDetailSnapshotWithSystemIcon(
  snapshot: ReturnType<typeof normalizeRetroAchievementsGameDetail>,
  rawGameProgress: RawRetroAchievementsGameProgressResponse,
  systemIconUrlByConsoleId: ReadonlyMap<string, string>,
): ReturnType<typeof normalizeRetroAchievementsGameDetail> {
  if (systemIconUrlByConsoleId.size === 0) {
    return snapshot;
  }

  const consoleId = pickIdentifier(rawGameProgress.ConsoleID, rawGameProgress.consoleId);
  const enrichedGame = enrichGameWithSystemIcon(snapshot.game, consoleId, systemIconUrlByConsoleId);
  if (enrichedGame === snapshot.game) {
    return snapshot;
  }

  return {
    ...snapshot,
    game: enrichedGame,
  };
}

async function enrichRecentlyPlayedGamesWithExplicitAwards(
  client: RetroAchievementsClient,
  config: RetroAchievementsProviderConfig,
  games: readonly RecentlyPlayedGame[],
): Promise<readonly RecentlyPlayedGame[]> {
  return Promise.all(
    games.map(async (game) => {
      if (getMetricValue(game.metrics, "highest-award-kind") !== undefined) {
        return game;
      }

      try {
        const rawGameProgress = await client.loadGameProgress(config, game.gameId);
        const normalizedGameDetail = normalizeRetroAchievementsGameDetail(rawGameProgress);
        const highestAwardKind = getMetricValue(normalizedGameDetail.game.metrics, "highest-award-kind");
        const additionalMetrics: NormalizedMetric[] = [
          ...(highestAwardKind !== undefined
            ? [
                {
                  key: "highest-award-kind",
                  label: "Highest Award",
                  value: highestAwardKind,
                },
              ]
            : []),
          ...(normalizedGameDetail.game.lastUnlockAt !== undefined
            ? [
                {
                  key: "highest-award-date",
                  label: "Highest Award Date",
                  value: String(normalizedGameDetail.game.lastUnlockAt),
                },
              ]
            : []),
        ];

        const mergedMetrics = mergeMetrics(game.metrics, additionalMetrics);
        return mergedMetrics !== undefined
          ? {
              ...game,
              metrics: mergedMetrics,
            }
          : game;
      } catch {
        return game;
      }
    }),
  );
}

export function createRetroAchievementsProvider(
  dependencies: RetroAchievementsProviderDependencies = {},
): AchievementProvider<RetroAchievementsProviderConfig> {
  const client = resolveClient(dependencies);
  const subsetVerificationIntervalMs = Math.max(
    0,
    dependencies.subsetVerificationIntervalMs
      ?? (dependencies.client === undefined ? RETROACHIEVEMENTS_SUBSET_VERIFICATION_INTERVAL_MS : 0),
  );
  const subsetVerificationRetryDelayMs = Math.max(
    0,
    dependencies.subsetVerificationRetryDelayMs
      ?? (dependencies.client === undefined ? RETROACHIEVEMENTS_SUBSET_VERIFICATION_RETRY_DELAY_MS : 0),
  );
  const sleep = dependencies.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  }));
  let cachedSystemIconUrlByConsoleId: ReadonlyMap<string, string> | undefined;
  let systemIconUrlByConsoleIdPromise: Promise<ReadonlyMap<string, string>> | undefined;
  const gameCommunityStatsCache = new Map<string, CachedGameCommunityStats>();
  const gameCommunityStatsLoads = new Map<string, Promise<GameCommunityStats | undefined>>();
  const subsetCatalogCache = new Map<string, CachedRetroAchievementsSubsetCatalog>();
  const subsetCatalogLoads = new Map<string, Promise<readonly RetroAchievementsSubsetCatalogEntry[]>>();
  const subsetCatalogFailures = new Map<string, { readonly error: unknown; readonly expiresAt: number }>();
  let subsetVerificationQueue: Promise<void> = Promise.resolve();
  let nextSubsetVerificationAt = 0;

  function enqueueSubsetVerification<T>(task: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const waitMs = Math.max(0, nextSubsetVerificationAt - Date.now());
      if (waitMs > 0) await sleep(waitMs);
      nextSubsetVerificationAt = Date.now() + subsetVerificationIntervalMs;
      return task();
    };
    const next = subsetVerificationQueue.then(run, run);
    subsetVerificationQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  async function loadSubsetVerificationMetadata(
    config: RetroAchievementsProviderConfig,
    gameId: string,
  ): Promise<RawRetroAchievementsGameExtendedResponse> {
    let rateLimitRetries = 0;
    while (true) {
      try {
        return await client.loadGameExtended!(config, gameId);
      } catch (error) {
        if (
          readStatusCode(error) !== 429
          || rateLimitRetries >= RETROACHIEVEMENTS_SUBSET_VERIFICATION_MAX_RATE_LIMIT_RETRIES
        ) {
          throw error;
        }
        const delayMs = Math.max(
          subsetVerificationRetryDelayMs * 2 ** rateLimitRetries,
          readRetryAfterMs(error) ?? 0,
        );
        rateLimitRetries += 1;
        if (delayMs > 0) await sleep(delayMs);
      }
    }
  }

  async function loadRetroAchievementsSubsetCatalog(
    config: RetroAchievementsProviderConfig,
    platformId: string,
  ): Promise<readonly RetroAchievementsSubsetCatalogEntry[]> {
    const cached = subsetCatalogCache.get(platformId);
    if (cached !== undefined && cached.expiresAt > Date.now()) return cached.entries;
    const failure = subsetCatalogFailures.get(platformId);
    if (failure !== undefined && failure.expiresAt > Date.now()) throw failure.error;
    const inFlight = subsetCatalogLoads.get(platformId);
    if (inFlight !== undefined) return inFlight;
    if (client.loadGameList === undefined || client.loadGameExtended === undefined) {
      throw new Error("RetroAchievements subset discovery is unavailable.");
    }

    const load = (async () => {
      const gameList = await client.loadGameList!(config, platformId);
      const entries: RetroAchievementsSubsetCatalogEntry[] = [];
      // Verify one candidate at a time. The catalogue is static and cached for
      // a day, so this deliberately favors API friendliness over first-load latency.
      for (const raw of gameList) {
        const rawGameId = readIdentifier(raw.ID ?? raw.id ?? raw.GameID ?? raw.gameId);
        if (rawGameId === undefined) continue;
        const extended = await enqueueSubsetVerification(() => loadSubsetVerificationMetadata(config, rawGameId));
        const normalized = normalizeSubsetCatalogEntry(raw, extended);
        if (normalized === undefined) {
          throw new Error(`RetroAchievements subset catalogue entry ${rawGameId} is incomplete.`);
        }
        entries.push(normalized);
      }
      return entries;
    })();

    subsetCatalogLoads.set(platformId, load);
    try {
      const entries = await load;
      subsetCatalogCache.set(platformId, {
        entries,
        expiresAt: Date.now() + RETROACHIEVEMENTS_SUBSET_CATALOG_TTL_MS,
      });
      subsetCatalogFailures.delete(platformId);
      return entries;
    } catch (error) {
      subsetCatalogFailures.set(platformId, {
        error,
        expiresAt: Date.now() + RETROACHIEVEMENTS_SUBSET_FAILURE_TTL_MS,
      });
      throw error;
    } finally {
      subsetCatalogLoads.delete(platformId);
    }
  }

  async function loadRetroAchievementsUserProgress(
    config: RetroAchievementsProviderConfig,
    gameIds: readonly string[],
  ): Promise<ReadonlyMap<string, RawRetroAchievementsUserProgressEntry>> {
    const progressByGameId = new Map<string, RawRetroAchievementsUserProgressEntry>();
    if (client.loadUserProgress === undefined) return progressByGameId;
    for (let offset = 0; offset < gameIds.length; offset += RETROACHIEVEMENTS_USER_PROGRESS_BATCH_SIZE) {
      const batch = gameIds.slice(offset, offset + RETROACHIEVEMENTS_USER_PROGRESS_BATCH_SIZE);
      const response = await client.loadUserProgress(config, batch);
      for (const [gameId, progress] of Object.entries(response)) {
        progressByGameId.set(gameId, progress);
      }
    }
    return progressByGameId;
  }

  async function loadGameCommunityStats(
    config: RetroAchievementsProviderConfig,
    snapshot: ReturnType<typeof normalizeRetroAchievementsGameDetail>,
  ): Promise<GameCommunityStats | undefined> {
    const gameId = snapshot.game.gameId;
    const cached = gameCommunityStatsCache.get(gameId);
    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const inFlight = gameCommunityStatsLoads.get(gameId);
    if (inFlight !== undefined) {
      return inFlight;
    }

    const load = (async () => {
      const [distributionResult, progressionResult] = await Promise.allSettled([
        client.loadAchievementDistribution?.(config, gameId) ??
          Promise.resolve<RawRetroAchievementsAchievementDistributionResponse | undefined>(undefined),
        client.loadGameProgression?.(config, gameId) ??
          Promise.resolve<RawRetroAchievementsGameProgressionResponse | undefined>(undefined),
      ]);
      const stats = normalizeRetroAchievementsGameCommunityStats({
        totalAchievementCount: snapshot.game.summary.totalCount,
        totalPlayers: getMetricNumber(snapshot.game.metrics, "total-players"),
        distribution: distributionResult.status === "fulfilled" ? distributionResult.value : undefined,
        progression: progressionResult.status === "fulfilled" ? progressionResult.value : undefined,
      });
      gameCommunityStatsCache.set(gameId, {
        value: stats,
        expiresAt: Date.now() + GAME_COMMUNITY_STATS_TTL_MS,
      });
      return stats;
    })();

    gameCommunityStatsLoads.set(gameId, load);
    try {
      return await load;
    } finally {
      gameCommunityStatsLoads.delete(gameId);
    }
  }

  async function loadSystemIconUrlByConsoleId(
    config: RetroAchievementsProviderConfig,
  ): Promise<ReadonlyMap<string, string>> {
    if (cachedSystemIconUrlByConsoleId !== undefined) {
      return cachedSystemIconUrlByConsoleId;
    }

    if (systemIconUrlByConsoleIdPromise !== undefined) {
      return systemIconUrlByConsoleIdPromise;
    }

    if (client.loadSystems === undefined) {
      const emptyMap = new Map<string, string>();
      cachedSystemIconUrlByConsoleId = emptyMap;
      return emptyMap;
    }

    systemIconUrlByConsoleIdPromise = (async () => {
      try {
        const systems = await client.loadSystems!(config);
        const systemIconUrlByConsoleId = buildRetroAchievementsSystemIconUrlMap(systems);
        cachedSystemIconUrlByConsoleId = systemIconUrlByConsoleId;
        return systemIconUrlByConsoleId;
      } catch {
        systemIconUrlByConsoleIdPromise = undefined;
        return new Map<string, string>();
      }
    })();

    return systemIconUrlByConsoleIdPromise;
  }

  const provider: RetroAchievementsProviderRuntime = {
    id: RETROACHIEVEMENTS_PROVIDER_ID,
    capabilities: retroAchievementsCapabilities,

    async loadProfile(config) {
      const [rawProfile, rawCompletionProgress, rawSummary] = await Promise.all([
        client.loadProfile(config),
        client.loadCompletionProgress(config),
        loadOptionalRetroAchievementsProfileSummary(
          client.loadSummary === undefined ? undefined : () => client.loadSummary!(config),
        ),
      ]);

      const completionSummary = summarizeRetroAchievementsCompletionProgress(rawCompletionProgress);
      const featuredGames = normalizeRetroAchievementsSelectableGames(rawCompletionProgress);
      const gamesBeatenCount = countRetroAchievementsGamesBeaten(rawCompletionProgress);
      const gamesMasteredCount = countRetroAchievementsGamesMastered(rawCompletionProgress);
      const achievementCounts = summarizeRetroAchievementsProfileAchievementCounts(rawCompletionProgress);
      const completionAwardCounts =
        summarizeRetroAchievementsGameCompletionAwardCounts(rawCompletionProgress);

      return normalizeRetroAchievementsProfile(
        rawProfile,
        completionSummary,
        config,
        featuredGames,
        gamesBeatenCount,
        gamesMasteredCount,
        achievementCounts,
        completionAwardCounts,
        rawSummary,
      );
    },

    async loadCompletionProgress(config) {
      const rawCompletionProgress = await client.loadCompletionProgress(config);
      return normalizeRetroAchievementsCompletionProgressGames(rawCompletionProgress);
    },

    async loadAchievementsEarnedBetween(config, options) {
      return loadAllAchievementsEarnedBetween(
        client,
        config,
        options,
      );
    },

    async loadRecentUnlocks(config, options) {
      const rawRecentUnlocks = await client.loadRecentUnlocks(config);
      const normalizedRecentUnlocks = normalizeRetroAchievementsRecentUnlocks(rawRecentUnlocks);

      // Assumption: the shared limit is a local cap after normalization, not a transport concern for this endpoint.
      return applyRecentUnlockLimit(normalizedRecentUnlocks, options?.limit);
    },

    async loadRecentlyPlayedGames(config, options) {
      const rawRecentlyPlayedGames = await client.loadRecentlyPlayedGames(config, options);
      const normalizedRecentlyPlayedGames = normalizeRetroAchievementsRecentlyPlayedGames(rawRecentlyPlayedGames);
      const limitedRecentlyPlayedGames = applyRecentUnlockLimit(
        normalizedRecentlyPlayedGames,
        options?.count,
      );
      const systemIconUrlByConsoleId = await loadSystemIconUrlByConsoleId(config);
      const iconEnrichedRecentlyPlayedGames = enrichRecentlyPlayedGamesWithSystemIcons(
        limitedRecentlyPlayedGames,
        rawRecentlyPlayedGames,
        systemIconUrlByConsoleId,
      );

      return enrichRecentlyPlayedGamesWithExplicitAwards(
        client,
        config,
        iconEnrichedRecentlyPlayedGames,
      );
    },

    async loadGameProgress(config, gameId) {
      const rawGameProgress = await client.loadGameProgress(config, gameId);
      const normalizedGameDetail = normalizeRetroAchievementsGameDetail(rawGameProgress);
      const systemIconUrlByConsoleId = await loadSystemIconUrlByConsoleId(config);
      const iconEnrichedSnapshot = enrichGameDetailSnapshotWithSystemIcon(
        normalizedGameDetail,
        rawGameProgress,
        systemIconUrlByConsoleId,
      );
      const communityStats = await loadGameCommunityStats(config, iconEnrichedSnapshot);
      return communityStats !== undefined
        ? {
            ...iconEnrichedSnapshot,
            game: {
              ...iconEnrichedSnapshot.game,
              communityStats,
            },
          }
        : iconEnrichedSnapshot;
    },

    async loadRelatedGames(config, game) {
      if (game.parentGameId !== undefined || game.platformId === undefined) {
        return [];
      }

      const catalog = await loadRetroAchievementsSubsetCatalog(config, game.platformId);
      const subsets = catalog.filter((entry) => entry.parentGameId === game.gameId);
      if (subsets.length === 0) {
        return [];
      }

      const progressByGameId = await loadRetroAchievementsUserProgress(
        config,
        subsets.map((entry) => entry.gameId),
      );

      return subsets.map((entry) => {
        const progress = buildSubsetProgress(progressByGameId.get(entry.gameId));
        return {
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          gameId: entry.gameId,
          title: entry.title,
          platformId: entry.platformId,
          ...(entry.platformLabel !== undefined ? { platformLabel: entry.platformLabel } : {}),
          ...(entry.coverImageUrl !== undefined ? { coverImageUrl: entry.coverImageUrl } : {}),
          ...(entry.boxArtImageUrl !== undefined ? { boxArtImageUrl: entry.boxArtImageUrl } : {}),
          parentGameId: game.gameId,
          ...(entry.totalAchievementCount !== undefined ? { totalAchievementCount: entry.totalAchievementCount } : {}),
          ...(progress.progress !== undefined ? { progress: progress.progress } : {}),
          ...(progress.hardcoreProgress !== undefined ? { hardcoreProgress: progress.hardcoreProgress } : {}),
        } satisfies RelatedGameSummary;
      });
    },
  };

  return provider;
}
