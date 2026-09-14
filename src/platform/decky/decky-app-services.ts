import type { ResourceState } from "@core/cache";
import type {
  AchievementHistorySnapshot,
  CompletionProgressSnapshot,
  DashboardSnapshot,
  GameDetailSnapshot,
  NormalizedGame,
  ProviderId,
  RecentlyPlayedGame,
  RecentUnlock,
} from "@core/domain";
import type {
  AuthenticatedProviderTransportFactory,
  NavigationPort,
  PlatformCapabilities,
  PlatformServices,
} from "@core/platform";
import { createAppRuntime } from "@core/app-runtime";
import { createProviderRegistry } from "@core/provider-registry";
import { createRetroAchievementsProvider } from "../../providers/retroachievements";
import {
  clearSteamRecentGameSnapshotLoadCache,
  createSteamProvider,
} from "../../providers/steam";
import { createMemoryCacheStore } from "./memory-cache";
import { createDeckySettingsStore } from "./decky-settings";
import { loadDeckyRuntimeMode, type DeckyRuntimeMode } from "./runtime-mode";
import { readDeckyStorageText, removeDeckyStorageText, writeDeckyStorageText } from "./storage";
import {
  readDeckyDashboardSnapshotState,
  deckyDashboardSnapshotStore,
  writeDeckyDashboardSnapshot,
} from "./decky-dashboard-snapshot-cache";
import {
  createDeckySmokeTestDashboardCacheEntries,
  type DeckySmokeTestCacheMode,
} from "./smoke-test-cache";
import { loadDeckyProviderConfig } from "./providers";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";
import { STEAM_PROVIDER_ID } from "../../providers/steam";
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
} from "./providers/steam/library-scan";
import { deckyDiagnosticLogger } from "./decky-diagnostic-logger";
import {
  deckySteamLibraryScanStore,
  readDeckySteamLibraryAchievementScanSummary,
  type SteamLibraryAchievementScanSummary,
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

const providerRegistry = createProviderRegistry([
  createRetroAchievementsProvider({
    transport: deckyAuthenticatedProviderTransportFactory.create(RETROACHIEVEMENTS_PROVIDER_ID),
  }),
  createSteamProvider({
    transport: deckyAuthenticatedProviderTransportFactory.create(STEAM_PROVIDER_ID),
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

function createIdleState<T>(): ResourceState<T> {
  return {
    status: "idle",
    isStale: false,
    isRefreshing: false,
  };
}

export const initialDeckyBootstrapState = createIdleState<DashboardSnapshot>();
export const initialDeckyAchievementHistoryState = createIdleState<AchievementHistorySnapshot>();
export const initialDeckyCompletionProgressState = createIdleState<CompletionProgressSnapshot>();
export const initialDeckyGameDetailState = createIdleState<GameDetailSnapshot>();

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
    summary: summarizeDeckyAchievementHistoryEntries(entries),
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
    return activeRefresh;
  }

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
    const state = await createDeckyAppServices(runtimeMode).dashboard.loadDashboard(providerId, options);
    if (state.data === undefined) {
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
    const snapshotWithSteamScanAchievements = mergeDeckySteamLibraryScanRecentAchievements(
      state.data,
      providerId === STEAM_PROVIDER_ID
        ? readDeckySteamLibraryAchievementScanSummary(providerId)
        : undefined,
    );
    const dashboardSnapshot = await buildDeckyRecentAchievementHistory({
      provider,
      providerConfig,
      snapshot: snapshotWithSteamScanAchievements,
    });
    writeDeckyDashboardSnapshot(dashboardSnapshot);

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
        data: buildDeckySteamCompletionProgressSnapshotFromSummary(cachedSteamLibraryScanSummary),
        lastUpdatedAt: Number.isFinite(parsedLastUpdatedAt) ? parsedLastUpdatedAt : Date.now(),
        isStale: false,
        isRefreshing: false,
      };
    }
  }

  return createDeckyAppServices(runtimeMode).completionProgress.loadCompletionProgress(providerId);
}

export async function loadDeckyAchievementHistoryState(
  providerId: ProviderId,
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
      const dashboardState = await loadDeckyDashboardState(providerId);
      if (dashboardState.data !== undefined) {
        const parsedLastUpdatedAt = Date.parse(cachedSteamLibraryScanSummary.scannedAt);
        return {
          status: "success",
          data: buildDeckySteamAchievementHistorySnapshotFromSummary({
            profile: dashboardState.data.profile,
            summary: cachedSteamLibraryScanSummary,
          }),
          lastUpdatedAt: Number.isFinite(parsedLastUpdatedAt) ? parsedLastUpdatedAt : Date.now(),
          isStale: false,
          isRefreshing: false,
        };
      }
    }
  }

  let historyState = await createDeckyAppServices(runtimeMode).achievementHistory.loadAchievementHistory(providerId);
  if (historyState.isStale) {
    historyState = await createDeckyAppServices(runtimeMode).achievementHistory.loadAchievementHistory(
      providerId,
      { forceRefresh: true },
    );
  }

  if (historyState.data === undefined) {
    return historyState;
  }

  const dashboardState = await loadDeckyDashboardState(providerId);
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

  const state = await createDeckyAppServices(runtimeMode).gameDetail.loadGameDetail(
    providerId,
    gameId,
    {
      forceRefresh: options?.forceRefresh ?? true,
    },
  );

  if (providerId !== STEAM_PROVIDER_ID || state.data === undefined) {
    return state;
  }

  const cachedSteamLibraryScanSummary = readDeckySteamLibraryAchievementScanSummary(providerId);
  if (cachedSteamLibraryScanSummary === undefined) {
    return state;
  }

  const cachedGameSummary = findSteamLibraryScanGameSummaryByAppId(
    cachedSteamLibraryScanSummary,
    state.data.game.appid ?? Number.parseInt(state.data.game.gameId, 10),
  );
  const patchedGameDetail = applySteamLibraryScanGameDetailMetadata(
    state.data,
    cachedSteamLibraryScanSummary,
  );

  if (patchedGameDetail === state.data) {
    return state;
  }

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

  return {
    ...state,
    data: patchedGameDetail,
  };
}
