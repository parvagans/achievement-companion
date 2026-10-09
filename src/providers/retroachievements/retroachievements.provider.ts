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
  /** Persist the console-wide verified subset relationship index. */
  readonly subsetRelationshipIndexStore?: RetroAchievementsSubsetRelationshipIndexStore;
  /** Override the live catalogue pacing in deterministic provider tests. */
  readonly subsetVerificationIntervalMs?: number;
  /** Override the live 429 backoff in deterministic provider tests. */
  readonly subsetVerificationRetryDelayMs?: number;
  /** Override the number of immediate 429 retries in deterministic tests. */
  readonly subsetVerificationMaxRateLimitRetries?: number;
  /** Injectable timer used by catalogue pacing/backoff tests. */
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

export type RetroAchievementsSubsetCandidateStatus =
  | "unresolved"
  | "verified-parent"
  | "verified-no-parent"
  | "retry-later";

export interface RetroAchievementsSubsetCandidateRecord {
  readonly gameId: string;
  readonly title: string;
  readonly platformId: string;
  readonly platformLabel?: string;
  readonly coverImageUrl?: string;
  readonly boxArtImageUrl?: string;
  readonly totalAchievementCount?: number;
  readonly status: RetroAchievementsSubsetCandidateStatus;
  readonly parentGameId?: string;
}

export interface RetroAchievementsSubsetCatalogueEntry {
  readonly gameId: string;
  readonly title: string;
  readonly platformId: string;
  readonly platformLabel?: string;
  readonly coverImageUrl?: string;
  readonly totalAchievementCount?: number;
}

export interface RetroAchievementsSubsetCatalogueState {
  readonly consoleId: string;
  readonly fetchedAt: number;
  readonly candidates: readonly RetroAchievementsSubsetCatalogueEntry[];
}

export interface RetroAchievementsSubsetRelationshipIndexState {
  readonly consoleId: string;
  readonly catalogueFetchedAt: number;
  readonly candidates: readonly RetroAchievementsSubsetCandidateRecord[];
  readonly complete: boolean;
  /** The last fully verified catalogue snapshot, retained while a stale refresh is incomplete. */
  readonly lastKnownGoodCandidates?: readonly RetroAchievementsSubsetCandidateRecord[];
  readonly lastKnownGoodCatalogueFetchedAt?: number;
}

export interface RetroAchievementsSubsetRelationshipIndexStore {
  read(consoleId: string): Promise<RetroAchievementsSubsetRelationshipIndexState | undefined>;
  write(state: RetroAchievementsSubsetRelationshipIndexState): Promise<void>;
  readCatalogue?(consoleId: string): Promise<RetroAchievementsSubsetCatalogueState | undefined>;
  writeCatalogue?(state: RetroAchievementsSubsetCatalogueState): Promise<void>;
  clear(): Promise<void>;
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
  loadRelatedGameProgress(
    config: RetroAchievementsProviderConfig,
    game: NormalizedGame,
    relatedGames: readonly RelatedGameSummary[],
  ): Promise<readonly RelatedGameSummary[]>;
}

// The date-range endpoint can return at most 500 records for a broad request. Split a saturated
// range until every response is complete, so a long account history does not omit recent unlocks.
const ACHIEVEMENTS_EARNED_BETWEEN_RESPONSE_LIMIT = 500;
const GAME_COMMUNITY_STATS_TTL_MS = 60 * 60 * 1000;
// Relationship metadata changes infrequently. The app-level cache persists the
// discovered summaries, while this provider cache avoids rebuilding the same
// console index during a long-running Decky session.
const RETROACHIEVEMENTS_SUBSET_CATALOG_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RETROACHIEVEMENTS_SUBSET_CATALOG_FAILURE_TTL_MS = 5 * 60 * 1000;
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

interface RetroAchievementsSubsetCatalogEntry extends RetroAchievementsSubsetCatalogueEntry {
  readonly boxArtImageUrl?: string;
  readonly parentGameId?: string;
}

/** Official RA catalogue titles mark subsets with a bracketed/parenthesized/tagged Subset label. */
export function isRetroAchievementsSubsetEntry(raw: Pick<RawRetroAchievementsGameListEntry, "Title" | "title">): boolean {
  const title = readText(raw.Title ?? raw.title);
  return title !== undefined && /(?:^|[\s[\(~–—-])subset\b/i.test(title);
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

function normalizeSubsetCatalogueEntry(
  raw: RawRetroAchievementsGameListEntry,
): RetroAchievementsSubsetCatalogueEntry | undefined {
  const gameId = readIdentifier(raw.ID ?? raw.id ?? raw.GameID ?? raw.gameId);
  const title = readText(raw.Title ?? raw.title);
  const platformId = readIdentifier(raw.ConsoleID ?? raw.consoleId);
  if (gameId === undefined || title === undefined || platformId === undefined) return undefined;
  const platformLabel = readText(raw.ConsoleName ?? raw.consoleName);
  const coverImageUrl = readText(raw.ImageIcon ?? raw.imageIcon);
  const totalAchievementCount = readFiniteNumber(raw.NumAchievements ?? raw.numAchievements);
  return {
    gameId,
    title,
    platformId,
    ...(platformLabel !== undefined ? { platformLabel } : {}),
    ...(coverImageUrl !== undefined ? { coverImageUrl: normalizeRetroAchievementsImageUrl(coverImageUrl) } : {}),
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

function clearSubsetProgress(summary: RelatedGameSummary): RelatedGameSummary {
  const metadata = { ...summary };
  Reflect.deleteProperty(metadata, "progress");
  Reflect.deleteProperty(metadata, "hardcoreProgress");
  return metadata;
}

function applySubsetProgress(
  relatedGames: readonly RelatedGameSummary[],
  progressByGameId: ReadonlyMap<string, RawRetroAchievementsUserProgressEntry>,
): readonly RelatedGameSummary[] {
  return relatedGames.map((relatedGame) => {
    const progress = buildSubsetProgress(progressByGameId.get(relatedGame.gameId));
    const metadata = clearSubsetProgress(relatedGame);
    return {
      ...metadata,
      ...(progress.progress !== undefined ? { progress: progress.progress } : {}),
      ...(progress.hardcoreProgress !== undefined ? { hardcoreProgress: progress.hardcoreProgress } : {}),
    } satisfies RelatedGameSummary;
  });
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

function enrichGamesWithSystemIcons(
  games: readonly NormalizedGame[],
  systemIconUrlByConsoleId: ReadonlyMap<string, string>,
): readonly NormalizedGame[] {
  if (games.length === 0 || systemIconUrlByConsoleId.size === 0) {
    return games;
  }

  return games.map((game) => enrichGameWithSystemIcon(game, game.platformId, systemIconUrlByConsoleId));
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
  const subsetRelationshipIndexStore = dependencies.subsetRelationshipIndexStore;
  const subsetCatalogueCache = new Map<string, RetroAchievementsSubsetCatalogueState>();
  const subsetCatalogueLoads = new Map<string, Promise<RetroAchievementsSubsetCatalogueState>>();
  const subsetCatalogueFailures = new Map<string, { readonly error: unknown; readonly expiresAt: number }>();
  const subsetRelationshipIndexCache = new Map<string, RetroAchievementsSubsetRelationshipIndexState>();
  const subsetRelationshipIndexLoads = new Map<string, Promise<RetroAchievementsSubsetRelationshipIndexState>>();
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
    const maxRateLimitRetries = Math.max(
      0,
      dependencies.subsetVerificationMaxRateLimitRetries
        ?? RETROACHIEVEMENTS_SUBSET_VERIFICATION_MAX_RATE_LIMIT_RETRIES,
    );
    while (true) {
      try {
        return await client.loadGameExtended!(config, gameId);
      } catch (error) {
        if (
          readStatusCode(error) !== 429
          || rateLimitRetries >= maxRateLimitRetries
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

  async function readSubsetRelationshipIndex(
    platformId: string,
  ): Promise<RetroAchievementsSubsetRelationshipIndexState | undefined> {
    const cached = subsetRelationshipIndexCache.get(platformId);
    if (cached !== undefined) return cached;
    const persisted = await subsetRelationshipIndexStore?.read(platformId);
    if (persisted !== undefined) subsetRelationshipIndexCache.set(platformId, persisted);
    return persisted;
  }

  async function loadSubsetCatalogue(
    config: RetroAchievementsProviderConfig,
    consoleId: string,
  ): Promise<RetroAchievementsSubsetCatalogueState> {
    const cached = subsetCatalogueCache.get(consoleId)
      ?? await subsetRelationshipIndexStore?.readCatalogue?.(consoleId);
    if (cached !== undefined) {
      subsetCatalogueCache.set(consoleId, cached);
      if (cached.fetchedAt + RETROACHIEVEMENTS_SUBSET_CATALOG_TTL_MS > Date.now()) return cached;
    }

    const failure = subsetCatalogueFailures.get(consoleId);
    if (failure !== undefined && failure.expiresAt > Date.now()) throw failure.error;

    const inFlight = subsetCatalogueLoads.get(consoleId);
    if (inFlight !== undefined) return inFlight;
    if (client.loadGameList === undefined) {
      throw new Error("RetroAchievements subset catalogue discovery is unavailable.");
    }

    const load = (async () => {
      const rawCatalogue = await client.loadGameList!(config, consoleId);
      const candidates = rawCatalogue
        .filter((entry) => isRetroAchievementsSubsetEntry(entry))
        .map((entry) => normalizeSubsetCatalogueEntry(entry))
        .filter((entry): entry is RetroAchievementsSubsetCatalogueEntry => entry !== undefined);
      const state: RetroAchievementsSubsetCatalogueState = {
        consoleId,
        fetchedAt: Date.now(),
        candidates,
      };
      subsetCatalogueCache.set(consoleId, state);
      await subsetRelationshipIndexStore?.writeCatalogue?.(state);
      return state;
    })();
    subsetCatalogueLoads.set(consoleId, load);
    try {
      const result = await load;
      subsetCatalogueFailures.delete(consoleId);
      return result;
    } catch (error) {
      subsetCatalogueFailures.set(consoleId, {
        error,
        expiresAt: Date.now() + RETROACHIEVEMENTS_SUBSET_CATALOG_FAILURE_TTL_MS,
      });
      throw error;
    } finally {
      subsetCatalogueLoads.delete(consoleId);
    }
  }

  async function writeSubsetRelationshipIndex(
    state: RetroAchievementsSubsetRelationshipIndexState,
  ): Promise<void> {
    subsetRelationshipIndexCache.set(state.consoleId, state);
    await subsetRelationshipIndexStore?.write(state);
  }

  function mergeSubsetCandidates(
    current: RetroAchievementsSubsetRelationshipIndexState | undefined,
    consoleId: string,
    catalogue: readonly RetroAchievementsSubsetCatalogueEntry[],
  ): RetroAchievementsSubsetRelationshipIndexState {
    const previousById = new Map((current?.candidates ?? []).map((candidate) => [candidate.gameId, candidate]));
    const candidates: RetroAchievementsSubsetCandidateRecord[] = [];
    for (const catalogueEntry of catalogue) {
      const candidate: RetroAchievementsSubsetCandidateRecord = {
        ...catalogueEntry,
        status: "unresolved",
      };
      const previous = previousById.get(candidate.gameId);
      candidates.push(previous === undefined
        ? candidate
        : {
            ...candidate,
            status: previous.status,
            ...(previous.parentGameId !== undefined ? { parentGameId: previous.parentGameId } : {}),
          });
    }
    const next: RetroAchievementsSubsetRelationshipIndexState = {
      consoleId,
      catalogueFetchedAt: Date.now(),
      candidates,
      complete: candidates.every((candidate) => candidate.status === "verified-parent" || candidate.status === "verified-no-parent"),
    };
    if (current?.lastKnownGoodCandidates !== undefined) {
      return {
        ...next,
        lastKnownGoodCandidates: current.lastKnownGoodCandidates,
        ...(current.lastKnownGoodCatalogueFetchedAt !== undefined
          ? { lastKnownGoodCatalogueFetchedAt: current.lastKnownGoodCatalogueFetchedAt }
          : {}),
      };
    }
    if (current?.complete === true) {
      return {
        ...next,
        lastKnownGoodCandidates: current.candidates,
        lastKnownGoodCatalogueFetchedAt: current.catalogueFetchedAt,
      };
    }
    return next;
  }

  async function refreshSubsetRelationshipIndex(
    config: RetroAchievementsProviderConfig,
    platformId: string,
    existing: RetroAchievementsSubsetRelationshipIndexState | undefined,
  ): Promise<RetroAchievementsSubsetRelationshipIndexState> {
    const inFlight = subsetRelationshipIndexLoads.get(platformId);
    if (inFlight !== undefined) return inFlight;
    if (client.loadGameList === undefined || client.loadGameExtended === undefined) {
      throw new Error("RetroAchievements subset discovery is unavailable.");
    }

    const load = (async () => {
      const catalogue = await loadSubsetCatalogue(config, platformId);
      let state = mergeSubsetCandidates(existing, platformId, catalogue.candidates);
      state = { ...state, catalogueFetchedAt: catalogue.fetchedAt };
      await writeSubsetRelationshipIndex(state);

      for (const candidate of state.candidates) {
        if (candidate.status === "verified-parent" || candidate.status === "verified-no-parent") continue;
        try {
          const extended = await enqueueSubsetVerification(() => loadSubsetVerificationMetadata(config, candidate.gameId));
          const catalogueCandidate: RawRetroAchievementsGameListEntry = {
            ID: candidate.gameId,
            Title: candidate.title,
            ConsoleID: candidate.platformId,
            ...(candidate.platformLabel !== undefined ? { ConsoleName: candidate.platformLabel } : {}),
            ...(candidate.coverImageUrl !== undefined ? { ImageIcon: candidate.coverImageUrl } : {}),
            ...(candidate.totalAchievementCount !== undefined ? { NumAchievements: candidate.totalAchievementCount } : {}),
          };
          const normalized = normalizeSubsetCatalogEntry(
            catalogueCandidate,
            extended,
          );
          if (normalized === undefined) throw new Error(`RetroAchievements subset candidate ${candidate.gameId} is incomplete.`);
          state = {
            ...state,
            candidates: state.candidates.map((entry) => entry.gameId !== candidate.gameId
              ? entry
              : {
                  ...entry,
                  status: normalized.parentGameId === undefined ? "verified-no-parent" : "verified-parent",
                  ...(normalized.parentGameId !== undefined ? { parentGameId: normalized.parentGameId } : {}),
                  ...(normalized.platformLabel !== undefined ? { platformLabel: normalized.platformLabel } : {}),
                  ...(normalized.coverImageUrl !== undefined ? { coverImageUrl: normalized.coverImageUrl } : {}),
                  ...(normalized.boxArtImageUrl !== undefined ? { boxArtImageUrl: normalized.boxArtImageUrl } : {}),
                  ...(normalized.totalAchievementCount !== undefined ? { totalAchievementCount: normalized.totalAchievementCount } : {}),
                }),
            complete: false,
          };
          state = { ...state, complete: state.candidates.every((entry) => entry.status === "verified-parent" || entry.status === "verified-no-parent") };
          if (state.complete) {
            state = {
              ...state,
              lastKnownGoodCandidates: state.candidates,
              lastKnownGoodCatalogueFetchedAt: state.catalogueFetchedAt,
            };
          }
          await writeSubsetRelationshipIndex(state);
        } catch (error) {
          state = {
            ...state,
            candidates: state.candidates.map((entry) => entry.gameId === candidate.gameId ? { ...entry, status: "retry-later" } : entry),
            complete: false,
          };
          await writeSubsetRelationshipIndex(state);
          throw error;
        }
      }
      return state;
    })();

    subsetRelationshipIndexLoads.set(platformId, load);
    try {
      return await load;
    } finally {
      subsetRelationshipIndexLoads.delete(platformId);
    }
  }

  async function ensureSubsetRelationshipIndex(
    config: RetroAchievementsProviderConfig,
    platformId: string,
    waitForCompletion: boolean,
  ): Promise<RetroAchievementsSubsetRelationshipIndexState | undefined> {
    const current = await readSubsetRelationshipIndex(platformId);
    const isStale = current === undefined || current.catalogueFetchedAt + RETROACHIEVEMENTS_SUBSET_CATALOG_TTL_MS <= Date.now();
    if (current !== undefined && current.complete && !isStale) return current;
    const hasLastKnownGood = current !== undefined && (
      current.complete || current.lastKnownGoodCandidates !== undefined
    );
    if (hasLastKnownGood && !waitForCompletion) {
      void refreshSubsetRelationshipIndex(config, platformId, current).catch(() => undefined);
      return current;
    }
    try {
      return await refreshSubsetRelationshipIndex(config, platformId, current);
    } catch (error) {
      if (hasLastKnownGood && !waitForCompletion) return current;
      throw error;
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
      const [rawProfile, rawCompletionProgress, rawSummary, systemIconUrlByConsoleId] = await Promise.all([
        client.loadProfile(config),
        client.loadCompletionProgress(config),
        loadOptionalRetroAchievementsProfileSummary(
          client.loadSummary === undefined ? undefined : () => client.loadSummary!(config),
        ),
        loadSystemIconUrlByConsoleId(config),
      ]);

      const completionSummary = summarizeRetroAchievementsCompletionProgress(rawCompletionProgress);
      const featuredGames = enrichGamesWithSystemIcons(
        normalizeRetroAchievementsSelectableGames(rawCompletionProgress),
        systemIconUrlByConsoleId,
      );
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
      const systemIconUrlByConsoleId = await loadSystemIconUrlByConsoleId(config);
      return enrichGamesWithSystemIcons(
        normalizeRetroAchievementsCompletionProgressGames(rawCompletionProgress),
        systemIconUrlByConsoleId,
      );
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

    async loadGamePlaytimeSeconds(config, gameId) {
      return client.loadGamePlaytimeSeconds?.(config, gameId);
    },

    async loadRelatedGames(config, game) {
      if (game.parentGameId !== undefined || game.platformId === undefined) {
        return [];
      }

      const index = await ensureSubsetRelationshipIndex(config, game.platformId, false);
      if (index === undefined) return [];
      const usableCandidates = index.complete ? index.candidates : index.lastKnownGoodCandidates;
      if (usableCandidates === undefined) return [];
      const subsets = usableCandidates.filter((entry) => entry.status === "verified-parent" && entry.parentGameId === game.gameId);
      if (subsets.length === 0) {
        return [];
      }

      const progressByGameId = await loadRetroAchievementsUserProgress(
        config,
        subsets.map((entry) => entry.gameId),
      );

      const relatedGames = subsets.map((entry) => ({
          providerId: RETROACHIEVEMENTS_PROVIDER_ID,
          gameId: entry.gameId,
          title: entry.title,
          platformId: entry.platformId,
          ...(entry.platformLabel !== undefined ? { platformLabel: entry.platformLabel } : {}),
          ...(entry.coverImageUrl !== undefined ? { coverImageUrl: entry.coverImageUrl } : {}),
          ...(entry.boxArtImageUrl !== undefined ? { boxArtImageUrl: entry.boxArtImageUrl } : {}),
          parentGameId: game.gameId,
          ...(entry.totalAchievementCount !== undefined ? { totalAchievementCount: entry.totalAchievementCount } : {}),
        } satisfies RelatedGameSummary));

      return applySubsetProgress(relatedGames, progressByGameId);
    },

    async loadRelatedGameProgress(config, game, relatedGames) {
      if (game.parentGameId !== undefined || relatedGames.length === 0) {
        return [];
      }

      const progressByGameId = await loadRetroAchievementsUserProgress(
        config,
        relatedGames.map((relatedGame) => relatedGame.gameId),
      );
      return applySubsetProgress(relatedGames, progressByGameId);
    },

    clearRelatedGameIndex() {
      subsetCatalogueCache.clear();
      subsetCatalogueFailures.clear();
      subsetRelationshipIndexCache.clear();
      if (subsetRelationshipIndexStore !== undefined) void subsetRelationshipIndexStore.clear();
    },
  };

  return provider;
}
