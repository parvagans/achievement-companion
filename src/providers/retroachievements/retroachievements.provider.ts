import { inheritSourceProvenance } from "../../core/source-provenance";
import type {
  GameDetailSnapshot,
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
  RawRetroAchievementsCompletionProgressEntry,
  RawRetroAchievementsGameProgressResponse,
  RawRetroAchievementsGameProgressionResponse,
  RawRetroAchievementsGameRankAndScoreEntry,
  RawRetroAchievementsGameExtendedResponse,
  RawRetroAchievementsGameListEntry,
  RawRetroAchievementsUserProgressEntry,
  RawRetroAchievementsRecentlyPlayedGameResponse,
  RawRetroAchievementsSummaryResponse,
  RawRetroAchievementsSystemResponse,
} from "./raw-types";
import { normalizeRetroAchievementsGameCommunityStats, normalizeRetroAchievementsLatestMasters } from "./community-stats";

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
  /** Derived checkpoints are current only while their canonical source records are current. */
  readonly isResourceFresh?: (path: string, query: Readonly<Record<string, string | number>>) => boolean;
  readonly resourceFreshUntil?: (path: string, query: Readonly<Record<string, string | number>>) => number | undefined;
  readonly subsetBatchSize?: number;
  readonly now?: () => number;
  readonly subsetDiagnostic?: (event: string, fields: Readonly<Record<string, string | number | boolean>>) => void;
}

export type RetroAchievementsSubsetCandidateStatus =
  | "unresolved"
  | "verifying"
  | "unsupported"
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
  /** Authoritative source expiry, copied from the coordinator, never a local TTL. */
  readonly metadataFreshUntil?: number;
  readonly attempts?: number;
  readonly retryAt?: number;
  readonly failureCategory?: string;
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
  readonly retryAt?: number;
  readonly failureCategory?: string;
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

export interface RetroAchievementsProviderRuntime extends AchievementProvider<RetroAchievementsProviderConfig> {
  loadCommunityStats(config: RetroAchievementsProviderConfig, snapshot: GameDetailSnapshot): Promise<GameCommunityStats | undefined>;
  getSubsetDiscoveryStatus(consoleId: string): RetroAchievementsSubsetDiscoveryStatus | undefined;
  resumeSubsetDiscovery(config: RetroAchievementsProviderConfig, consoleId: string): Promise<RetroAchievementsSubsetRelationshipIndexState>;
  readVerifiedRelatedGames(game: NormalizedGame): Promise<readonly RelatedGameSummary[]>;
  subscribeSubsetRelationships(listener: () => void): () => void;
  invalidateGameProgressCache(gameId?: string): void;
  loadGameProgressForRecommendations(
    config: RetroAchievementsProviderConfig,
    gameId: string,
    options?: { readonly forceRefresh?: boolean; readonly activeViewing?: boolean },
  ): Promise<GameDetailSnapshot>;
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

export interface RetroAchievementsSubsetDiscoveryStatus {
  readonly complete: boolean;
  readonly verified: number;
  readonly total: number;
  readonly unsupported: number;
  readonly remaining: number;
  readonly running: boolean;
  readonly retryAt?: number;
  readonly failureCategory?: string;
  readonly checkpointSaved: boolean;
}

// The date-range endpoint can return at most 500 records for a broad request. Split a saturated
// range until every response is complete, so a long account history does not omit recent unlocks.
const ACHIEVEMENTS_EARNED_BETWEEN_RESPONSE_LIMIT = 500;
// Relationship metadata changes infrequently. The app-level cache persists the
// discovered summaries, while this provider cache avoids rebuilding the same
// console index during a long-running Decky session.
const RETROACHIEVEMENTS_USER_PROGRESS_BATCH_SIZE = 50;
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
  games: readonly RecentlyPlayedGame[],
  completionProgress?: readonly RawRetroAchievementsCompletionProgressEntry[],
): Promise<readonly RecentlyPlayedGame[]> {
  if (completionProgress === undefined) return games;
  const progressByGameId = new Map(
    normalizeRetroAchievementsCompletionProgressGames(completionProgress).map((game) => [game.gameId, game]),
  );
  return games.map((game) => {
    const progress = progressByGameId.get(game.gameId);
    if (progress === undefined) return game;
    const awardKind = getMetricValue(progress.metrics, "highest-award-kind");
    if (awardKind === undefined) return game;
    const awardDate = getMetricValue(progress.metrics, "highest-award-date");
    const metrics = mergeMetrics(game.metrics, [
      { key: "highest-award-kind", label: "Highest Award", value: awardKind },
      ...(awardDate !== undefined
        ? [{ key: "highest-award-date", label: "Highest Award Date", value: awardDate }]
        : []),
    ]);
    return metrics === undefined ? game : { ...game, metrics };
  });
}

export function createRetroAchievementsProvider(
  dependencies: RetroAchievementsProviderDependencies = {},
): RetroAchievementsProviderRuntime {
  const client = resolveClient(dependencies);
  let systemIconUrlByConsoleIdPromise: Promise<ReadonlyMap<string, string>> | undefined;
  const gameCommunityStatsLoads = new Map<string, Promise<GameCommunityStats | undefined>>();
  const rawGameProgressLoads = new Map<string, Promise<RawRetroAchievementsGameProgressResponse>>();
  const completionProgressLoads = new Map<string, Promise<readonly RawRetroAchievementsCompletionProgressEntry[]>>();
  const subsetRelationshipIndexStore = dependencies.subsetRelationshipIndexStore;
  const subsetCatalogueCache = new Map<string, RetroAchievementsSubsetCatalogueState>();
  const subsetCatalogueLoads = new Map<string, Promise<RetroAchievementsSubsetCatalogueState>>();
  const subsetRelationshipIndexCache = new Map<string, RetroAchievementsSubsetRelationshipIndexState>();
  const subsetRelationshipIndexLoads = new Map<string, Promise<RetroAchievementsSubsetRelationshipIndexState>>();
  const subsetRelationshipListeners = new Set<() => void>();
  const subsetNow = dependencies.now ?? (() => Date.now());
  const checkpointSaved = new Map<string, boolean>();
  const terminal = (candidate: RetroAchievementsSubsetCandidateRecord) => candidate.status === "verified-parent" || candidate.status === "verified-no-parent" || candidate.status === "unsupported";
  function subsetEvent(event: string, fields: Record<string, string | number | boolean>) {
    try { dependencies.subsetDiagnostic?.(event, fields); } catch { /* Diagnostic only. */ }
  }
  function discoveryStatus(state: RetroAchievementsSubsetRelationshipIndexState): RetroAchievementsSubsetDiscoveryStatus {
    const verified = state.candidates.filter((c) => c.status === "verified-parent" || c.status === "verified-no-parent").length;
    const unresolved = state.candidates.filter((c) => !terminal(c));
    const eligible = unresolved.some((c) => (c.retryAt ?? 0) <= subsetNow());
    const consoleDeferred = (state.retryAt ?? 0) > subsetNow();
    const retryAt = consoleDeferred ? state.retryAt : eligible ? undefined : Math.min(...unresolved.map((c) => c.retryAt ?? 0));
    const failureCategory = consoleDeferred ? state.failureCategory : unresolved.find((c) => c.failureCategory !== undefined)?.failureCategory;
    return { complete: state.candidates.every(terminal), verified, total: state.candidates.length,
      unsupported: state.candidates.filter((c) => c.status === "unsupported").length,
      remaining: unresolved.length, running: subsetRelationshipIndexLoads.has(state.consoleId),
      checkpointSaved: checkpointSaved.get(state.consoleId) !== false,
      ...(retryAt !== undefined && Number.isFinite(retryAt) ? { retryAt } : {}),
      ...(failureCategory !== undefined ? { failureCategory } : {}),
    };
  }
  let subsetVerificationQueue: Promise<void> = Promise.resolve();

  async function loadRawGameProgress(
    config: RetroAchievementsProviderConfig,
    gameId: string,
    forceRefresh = false,
    activeViewing = false,
  ): Promise<RawRetroAchievementsGameProgressResponse> {
    const key = JSON.stringify([config.username.trim().toLocaleLowerCase(), gameId]);
    const active = rawGameProgressLoads.get(key);
    if (active !== undefined) return active;
    const load = client.loadGameProgress(config, gameId, { forceRefresh, activeViewing });
    rawGameProgressLoads.set(key, load);
    try {
      const value = await load;
      return value;
    } finally {
      if (rawGameProgressLoads.get(key) === load) rawGameProgressLoads.delete(key);
    }
  }

  async function loadCompletionProgressAndRemember(
    config: RetroAchievementsProviderConfig,
  ): Promise<readonly RawRetroAchievementsCompletionProgressEntry[]> {
    const account = config.username.toLocaleLowerCase();
    const active = completionProgressLoads.get(account);
    if (active !== undefined) return active;
    const load = client.loadCompletionProgress(config);
    completionProgressLoads.set(account, load);
    try {
      const entries = await load;
      return entries;
    } finally {
      if (completionProgressLoads.get(account) === load) completionProgressLoads.delete(account);
    }
  }

  async function readCompletionProgressForAwards(
    config: RetroAchievementsProviderConfig,
  ): Promise<readonly RawRetroAchievementsCompletionProgressEntry[] | undefined> {
    const account = config.username.toLocaleLowerCase();
    const active = completionProgressLoads.get(account);
    if (active !== undefined) {
      try { return await active; } catch { return undefined; }
    }
    try {
      return await loadCompletionProgressAndRemember(config);
    } catch {
      // A failed account-wide progress refresh must not fan out into ten detail requests.
      return undefined;
    }
  }

  function enqueueSubsetVerification<T>(task: () => Promise<T>): Promise<T> {
    // Preserve checkpoint ordering; the backend exclusively owns HTTP pacing.
    const next = subsetVerificationQueue.then(task, task);
    subsetVerificationQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  async function loadSubsetVerificationMetadata(
    config: RetroAchievementsProviderConfig,
    gameId: string,
  ): Promise<RawRetroAchievementsGameExtendedResponse> {
    return client.loadGameExtended!(config, gameId);
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
      if (dependencies.isResourceFresh?.("API_GetGameList.php", { i: consoleId, f: 1, h: 1 })) return cached;
    }

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
      return await load;
    } finally {
      subsetCatalogueLoads.delete(consoleId);
    }
  }

  async function writeSubsetRelationshipIndex(
    state: RetroAchievementsSubsetRelationshipIndexState,
  ): Promise<void> {
    subsetRelationshipIndexCache.set(state.consoleId, state);
    try { await subsetRelationshipIndexStore?.write(state); checkpointSaved.set(state.consoleId, true); }
    catch { checkpointSaved.set(state.consoleId, false); }
    const status = discoveryStatus(state);
    subsetEvent("subset_checkpoint", { consoleId: state.consoleId, checkpointSaved: status.checkpointSaved,
      verified: status.verified, total: status.total, remaining: status.remaining, complete: status.complete });
    for (const listener of subsetRelationshipListeners) listener();
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
            ...previous,
            ...(previous.metadataFreshUntil !== undefined ? { metadataFreshUntil: previous.metadataFreshUntil } : {}),
            ...(previous.parentGameId !== undefined ? { parentGameId: previous.parentGameId } : {}),
          });
    }
    const next: RetroAchievementsSubsetRelationshipIndexState = {
      consoleId,
      catalogueFetchedAt: Date.now(),
      candidates,
      complete: candidates.every((candidate) => candidate.status === "verified-parent" || candidate.status === "verified-no-parent"),
    };
    if (current !== undefined) {
      return {
        ...next,
        lastKnownGoodCandidates: [...new Map([
          ...(current.lastKnownGoodCandidates ?? []),
          ...current.candidates.filter((entry) => entry.status === "verified-parent" || entry.status === "verified-no-parent"),
        ].map((entry) => [entry.gameId, entry])).values()],
        ...((current.retryAt ?? 0) > subsetNow() ? { retryAt: current.retryAt!, ...(current.failureCategory !== undefined ? { failureCategory: current.failureCategory } : {}) } : {}),
        ...(current.lastKnownGoodCatalogueFetchedAt !== undefined
          ? { lastKnownGoodCatalogueFetchedAt: current.lastKnownGoodCatalogueFetchedAt }
          : {}),
      };
    }
    return next;
  }

  async function refreshSubsetRelationshipIndex(
    config: RetroAchievementsProviderConfig, platformId: string,
    existing: RetroAchievementsSubsetRelationshipIndexState | undefined,
  ): Promise<RetroAchievementsSubsetRelationshipIndexState> {
    const inFlight = subsetRelationshipIndexLoads.get(platformId);
    if (inFlight !== undefined) { subsetEvent("subset_discovery_joined", { consoleId: platformId }); return inFlight; }
    if (client.loadGameList === undefined || client.loadGameExtended === undefined) throw new Error("RetroAchievements subset discovery is unavailable.");
    const load = (async () => {
      const catalogue = await loadSubsetCatalogue(config, platformId);
      let state = { ...mergeSubsetCandidates(existing, platformId, catalogue.candidates), catalogueFetchedAt: catalogue.fetchedAt };
      const candidates = [...state.candidates];
      const checkpoint = async () => {
        state = { ...state, candidates: [...candidates], complete: candidates.every(terminal) };
        if (state.complete) state = { ...state, lastKnownGoodCandidates: state.candidates, lastKnownGoodCatalogueFetchedAt: state.catalogueFetchedAt };
        await writeSubsetRelationshipIndex(state);
      };
      // Resume coverage before considering stale, already-verified metadata.
      // A missing local expiry (legacy checkpoint or memory eviction) is not
      // evidence that the relationship was never verified.
      const pending = candidates.map((c, i) => ({ c, i })).filter(({ c }) => !terminal(c));
      const work = pending.length > 0 ? pending : candidates.map((c, i) => ({ c, i })).filter(({ c }) =>
        c.status !== "unsupported" && Number.isFinite(c.metadataFreshUntil) && c.metadataFreshUntil! <= subsetNow());
      await checkpoint();
      if ((state.retryAt ?? 0) > subsetNow()) return state;
      let attempts = 0;
      for (const { c: candidate, i: index } of work) {
        if ((candidate.retryAt ?? 0) > subsetNow()) continue;
        if (attempts >= (dependencies.subsetBatchSize ?? 5)) break;
        attempts++;
        const attempt = (candidate.attempts ?? 0) + 1;
        const wasVerified = candidate.status === "verified-parent" || candidate.status === "verified-no-parent";
        candidates[index] = { ...candidate, attempts: attempt, ...(wasVerified ? {} : { status: "verifying" as const }) };
        state = { ...state, candidates: [...candidates] };
        subsetRelationshipIndexCache.set(platformId, state);
        for (const listener of subsetRelationshipListeners) listener();
        subsetEvent("subset_candidate", { consoleId: platformId, gameId: candidate.gameId, previousStatus: candidate.status,
          candidateStatus: "verifying", attempt, outcome: "started", retryEligible: true });
        try {
          const extended = await enqueueSubsetVerification(() => loadSubsetVerificationMetadata(config, candidate.gameId));
          if (readIdentifier(extended.ID ?? extended.id) !== candidate.gameId || readIdentifier(extended.ConsoleID ?? extended.consoleId) !== platformId)
            throw new Error("invalid_metadata_identity");
          const parent = "ParentGameID" in extended ? extended.ParentGameID : extended.parentGameId;
          if (!("ParentGameID" in extended || "parentGameId" in extended) ||
              (parent !== null && !(typeof parent === "number" && Number.isSafeInteger(parent) && parent > 0) &&
               !(typeof parent === "string" && /^[1-9]\d*$/u.test(parent)))) throw new Error("invalid_metadata_parent");
          const normalized = normalizeSubsetCatalogEntry({ ID: candidate.gameId, Title: candidate.title, ConsoleID: candidate.platformId }, extended);
          if (normalized === undefined || !Number.isFinite(normalized.totalAchievementCount) || normalized.totalAchievementCount! < 0)
            throw new Error("invalid_metadata");
          const { retryAt: _retry, failureCategory: _failure, parentGameId: _parent, ...preserved } = candidate;
          const expiry = dependencies.resourceFreshUntil?.("API_GetGameExtended.php", { i: candidate.gameId });
          const status = normalized.parentGameId === undefined ? "verified-no-parent" as const : "verified-parent" as const;
          candidates[index] = { ...preserved, ...normalized, status, attempts: attempt,
            ...(expiry !== undefined ? { metadataFreshUntil: expiry } : {}) };
          subsetEvent("subset_candidate", { consoleId: platformId, gameId: candidate.gameId, previousStatus: candidate.status,
            candidateStatus: status, attempt, outcome: "verified", normalization: "valid", retryEligible: false });
        } catch (cause) {
          const error = cause as { status?: number; statusCode?: number; retryAfterMs?: number; message?: string };
          const statusCode = error?.status ?? error?.statusCode;
          const unsupported = statusCode === 404 || statusCode === 410;
          const category = unsupported ? "unsupported" : statusCode === 429 ? "rate_limit" :
            error?.message?.startsWith("invalid_metadata") ? "invalid_metadata" : "provider_unavailable";
          const providerDelay = typeof error?.retryAfterMs === "number" && Number.isFinite(error.retryAfterMs) ? Math.max(0, error.retryAfterMs) : 0;
          const retryAt = subsetNow() + Math.max(providerDelay, statusCode === 401 || statusCode === 403 ? 900000 :
            unsupported ? 300000 : Math.min(900000, 30000 * 2 ** Math.min(5, attempt - 1)));
          candidates[index] = { ...candidate, attempts: attempt, status: wasVerified ? candidate.status : unsupported ? "unsupported" : "retry-later",
            failureCategory: category, ...(!unsupported || wasVerified ? { retryAt } : {}) };
          subsetEvent("subset_candidate", { consoleId: platformId, gameId: candidate.gameId, previousStatus: candidate.status,
            candidateStatus: candidates[index]!.status, attempt, outcome: category, normalization: category === "invalid_metadata" ? "rejected" : "not_available",
            retryEligible: false, ...(!unsupported ? { retryAt } : {}) });
          if (statusCode === 429 || statusCode === 401 || statusCode === 403) {
            state = { ...state, retryAt, failureCategory: category }; await checkpoint(); break;
          }
        }
        await checkpoint();
      }
      await checkpoint();
      return state;
    })();
    subsetRelationshipIndexLoads.set(platformId, load);
    subsetEvent("subset_discovery_started", { consoleId: platformId });
    try { return await load; }
    finally { subsetRelationshipIndexLoads.delete(platformId); for (const listener of subsetRelationshipListeners) listener(); }
  }

  async function ensureSubsetRelationshipIndex(config: RetroAchievementsProviderConfig, platformId: string,
    _waitForCompletion: boolean): Promise<RetroAchievementsSubsetRelationshipIndexState | undefined> {
    const current = await readSubsetRelationshipIndex(platformId);
    if (current !== undefined && subsetRelationshipIndexLoads.has(platformId)) return current;
    if (current !== undefined && current.candidates.every(terminal) &&
        dependencies.isResourceFresh?.("API_GetGameList.php", { i: platformId, f: 1, h: 1 }) === true &&
        !current.candidates.some((c) => Number.isFinite(c.metadataFreshUntil) && c.metadataFreshUntil! <= subsetNow() && (c.retryAt ?? 0) <= subsetNow())) {
      if (!current.complete) { const repaired = { ...current, complete: true }; await writeSubsetRelationshipIndex(repaired); return repaired; }
      return current;
    }
    if (current?.complete === true) {
      void refreshSubsetRelationshipIndex(config, platformId, current).catch(() => undefined);
      return current;
    }
    try { return await refreshSubsetRelationshipIndex(config, platformId, current); }
    catch (error) {
      if (current !== undefined && (current.lastKnownGoodCandidates !== undefined || current.candidates.some((c) => c.status === "verified-parent"))) return current;
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

  function loadLatestMasterAvatarUrls(entries: readonly RawRetroAchievementsGameRankAndScoreEntry[]): ReadonlyMap<string, string> {
    const avatars = new Map<string, string>();
    for (const entry of entries) {
      const username = readText(entry.User ?? entry.user);
      if (username === undefined) continue;
      // Public UserPic image URLs follow RA's documented profile response. Images
      // load independently; statistics readiness never waits for profile APIs.
      const url = normalizeRetroAchievementsImageUrl(`/UserPic/${encodeURIComponent(username)}.png`);
      avatars.set(username, url);
      const ulid = readText(entry.ULID ?? entry.ulid);
      if (ulid !== undefined) avatars.set(ulid, url);
    }
    return avatars;
  }

  async function loadGameCommunityStats(
    config: RetroAchievementsProviderConfig,
    snapshot: ReturnType<typeof normalizeRetroAchievementsGameDetail>,
  ): Promise<GameCommunityStats | undefined> {
    const gameId = snapshot.game.gameId;
    const inFlight = gameCommunityStatsLoads.get(gameId);
    if (inFlight !== undefined) {
      return inFlight;
    }

    const load = (async () => {
      const [distributionResult, progressionResult, latestMastersResult] = await Promise.allSettled([
        client.loadAchievementDistribution?.(config, gameId) ??
          Promise.resolve<RawRetroAchievementsAchievementDistributionResponse | undefined>(undefined),
        client.loadGameProgression?.(config, gameId) ??
          Promise.resolve<RawRetroAchievementsGameProgressionResponse | undefined>(undefined),
        client.loadLatestGameMasters?.(config, gameId) ??
          Promise.resolve<readonly RawRetroAchievementsGameRankAndScoreEntry[] | undefined>(undefined),
      ]);
      if (snapshot.game.communityStats === undefined && [distributionResult, progressionResult, latestMastersResult].every((result) => result.status === "rejected")) {
        throw distributionResult.status === "rejected" ? distributionResult.reason : new Error("Community data unavailable");
      }
      const baseStats = normalizeRetroAchievementsGameCommunityStats({
        ...(snapshot.game.communityStats !== undefined ? { previous: snapshot.game.communityStats } : {}),
        totalAchievementCount: snapshot.game.summary.totalCount,
        totalPlayers: getMetricNumber(snapshot.game.metrics, "total-players"),
        distribution: distributionResult.status === "fulfilled" ? distributionResult.value : undefined,
        progression: progressionResult.status === "fulfilled" ? progressionResult.value : undefined,
      });
      const latestMasterEntries = latestMastersResult.status === "fulfilled"
        ? latestMastersResult.value
        : undefined;
      const avatars = latestMasterEntries === undefined
        ? undefined
        : loadLatestMasterAvatarUrls(latestMasterEntries);
      const latestMasters = latestMasterEntries === undefined ? undefined : normalizeRetroAchievementsLatestMasters({
        entries: latestMasterEntries,
        masteredPlayers: baseStats?.masteredPlayers,
        ...(avatars !== undefined ? { avatarUrlByUserIdentifier: avatars } : {}),
      });
      const stats = normalizeRetroAchievementsGameCommunityStats({
        ...(snapshot.game.communityStats !== undefined ? { previous: snapshot.game.communityStats } : {}),
        totalAchievementCount: snapshot.game.summary.totalCount,
        totalPlayers: getMetricNumber(snapshot.game.metrics, "total-players"),
        distribution: distributionResult.status === "fulfilled" ? distributionResult.value : undefined,
        progression: progressionResult.status === "fulfilled" ? progressionResult.value : undefined,
        ...(latestMasters !== undefined ? { latestMasters } : {}),
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
    if (systemIconUrlByConsoleIdPromise !== undefined) {
      return systemIconUrlByConsoleIdPromise;
    }

    if (client.loadSystems === undefined) {
      return new Map<string, string>();
    }

    systemIconUrlByConsoleIdPromise = (async () => {
      try {
        const systems = await client.loadSystems!(config);
        return buildRetroAchievementsSystemIconUrlMap(systems);
      } catch {
        return new Map<string, string>();
      } finally {
        systemIconUrlByConsoleIdPromise = undefined;
      }
    })();

    return systemIconUrlByConsoleIdPromise;
  }

  const provider: RetroAchievementsProviderRuntime = {
    subscribeSubsetRelationships(listener) {
      subsetRelationshipListeners.add(listener);
      return () => { subsetRelationshipListeners.delete(listener); };
    },
    async readVerifiedRelatedGames(game) {
      if (game.parentGameId !== undefined || game.platformId === undefined) return [];
      const index = await readSubsetRelationshipIndex(game.platformId);
      if (index === undefined) return [];
      const candidates = new Map((index.lastKnownGoodCandidates ?? []).map((entry) => [entry.gameId, entry]));
      for (const entry of index.candidates) {
        // A failed recheck cannot erase a previously verified relationship.
        if (entry.status === "verified-parent" || entry.status === "verified-no-parent") candidates.set(entry.gameId, entry);
      }
      return [...candidates.values()].filter((entry) => entry.status === "verified-parent" && entry.parentGameId === game.gameId)
        .map((entry) => ({ providerId: RETROACHIEVEMENTS_PROVIDER_ID, gameId: entry.gameId, title: entry.title,
          platformId: entry.platformId, parentGameId: game.gameId,
          ...(entry.platformLabel !== undefined ? { platformLabel: entry.platformLabel } : {}),
          ...(entry.coverImageUrl !== undefined ? { coverImageUrl: entry.coverImageUrl } : {}),
          ...(entry.boxArtImageUrl !== undefined ? { boxArtImageUrl: entry.boxArtImageUrl } : {}),
          ...(entry.totalAchievementCount !== undefined ? { totalAchievementCount: entry.totalAchievementCount } : {}),
        }));
    },
    async resumeSubsetDiscovery(config, consoleId) {
      return refreshSubsetRelationshipIndex(config, consoleId, await readSubsetRelationshipIndex(consoleId));
    },
    loadCommunityStats: loadGameCommunityStats,
    getSubsetDiscoveryStatus(consoleId) {
      const state = subsetRelationshipIndexCache.get(consoleId);
      return state === undefined ? undefined : discoveryStatus(state);
    },
    id: RETROACHIEVEMENTS_PROVIDER_ID,
    capabilities: retroAchievementsCapabilities,
    invalidateGameProgressCache(gameId) {
      if (gameId === undefined) {
        rawGameProgressLoads.clear();
        completionProgressLoads.clear();
        return;
      }
      for (const key of rawGameProgressLoads.keys()) {
        if ((JSON.parse(key) as readonly string[])[1] === gameId) rawGameProgressLoads.delete(key);
      }
    },

    async loadProfile(config) {
      const [rawProfile, rawCompletionProgress, rawSummary, systemIconUrlByConsoleId] = await Promise.all([
        client.loadProfile(config),
        loadCompletionProgressAndRemember(config),
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

      return inheritSourceProvenance(normalizeRetroAchievementsProfile(
        rawProfile,
        completionSummary,
        config,
        featuredGames,
        gamesBeatenCount,
        gamesMasteredCount,
        achievementCounts,
        completionAwardCounts,
        rawSummary,
      ), rawProfile, rawCompletionProgress);
    },

    async loadCompletionProgress(config) {
      const rawCompletionProgress = await loadCompletionProgressAndRemember(config);
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
      return inheritSourceProvenance(applyRecentUnlockLimit(normalizedRecentUnlocks, options?.limit), rawRecentUnlocks);
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

      const awards = await readCompletionProgressForAwards(config);
      return inheritSourceProvenance(await enrichRecentlyPlayedGamesWithExplicitAwards(
        iconEnrichedRecentlyPlayedGames, awards,
      ), rawRecentlyPlayedGames, ...(awards === undefined ? [] : [awards]));
    },

    async loadGameProgressForRecommendations(config, gameId, options) {
      const rawGameProgress = await loadRawGameProgress(config, gameId, options?.forceRefresh === true, options?.activeViewing === true);
      return normalizeRetroAchievementsGameDetail(rawGameProgress);
    },

    async loadGameProgress(config, gameId, options) {
      const rawGameProgress = await loadRawGameProgress(config, gameId, options?.forceRefresh === true);
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
      const subsets = await provider.readVerifiedRelatedGames(game);
      if (subsets.length === 0) {
        return [];
      }

      const progressByGameId = await loadRetroAchievementsUserProgress(
        config,
        subsets.map((entry) => entry.gameId),
      );

      return applySubsetProgress(subsets, progressByGameId);
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
      subsetRelationshipIndexCache.clear();
      if (subsetRelationshipIndexStore !== undefined) void subsetRelationshipIndexStore.clear();
    },
  };

  return provider;
}
