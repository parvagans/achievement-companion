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
import { resolveProviderDashboardPreferences } from "@core/provider-dashboard-preferences";
import { createProviderRegistry } from "@core/provider-registry";
import { createRetroAchievementsProvider } from "../../providers/retroachievements";
import { createSteamProvider } from "../../providers/steam";
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
import { createDeckySteamTransport } from "./providers/steam/backend-transport";
import { deckyProviderConfigStore } from "./providers/provider-config-store";
import {
  buildDeckySteamAchievementHistorySnapshotFromSummary,
  buildDeckySteamCompletionProgressSnapshotFromSummary,
} from "./providers/steam/library-scan";
import { deckyDiagnosticLogger } from "./decky-diagnostic-logger";
import {
  deckySteamLibraryScanStore,
  readDeckySteamLibraryAchievementScanSummary,
} from "./providers/steam/config";
import {
  applySteamLibraryScanGameDetailMetadata,
  findSteamLibraryScanGameSummaryByAppId,
} from "./providers/steam/game-detail";

const deckyPlatformInfo = {
  platformId: "decky",
  appName: "Achievement Companion",
} as const;
const DECKY_RECENT_ACHIEVEMENTS_STORAGE_KEY_PREFIX =
  "achievement-companion:decky:recent-achievements";
const DECKY_RECENT_ACHIEVEMENTS_LIMIT = 10;
const DECKY_RECENT_ACHIEVEMENTS_BACKFILL_RECENTLY_PLAYED_LIMIT = 50;

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

interface DeckyRecentAchievementBackfillProvider {
  readonly loadCompletionProgress: (
    config: unknown,
  ) => Promise<readonly NormalizedGame[]>;
  readonly loadAchievementsEarnedBetween?: (
    config: unknown,
    options: {
      readonly fromEpochSeconds: number;
      readonly toEpochSeconds: number;
    },
  ) => Promise<readonly RecentUnlock[]>;
  readonly loadRecentlyPlayedGames?: (
    config: unknown,
    options?: {
      readonly count?: number;
      readonly offset?: number;
    },
  ) => Promise<readonly RecentlyPlayedGame[]>;
  readonly loadGameProgress: (
    config: unknown,
    gameId: string,
  ) => Promise<GameDetailSnapshot>;
}

type DeckyRecentAchievementGameSource =
  | "completion-progress"
  | "recently-played"
  | "snapshot-recently-played";

interface DeckyRecentAchievementGameCandidate {
  readonly gameId: string;
  readonly title: string;
  readonly source: DeckyRecentAchievementGameSource;
  readonly unlockedCount: number;
  readonly sortEpoch?: number;
}

interface DeckyRecentAchievementDebugSelectedEntry {
  readonly id: string;
  readonly title: string;
  readonly gameTitle: string;
  readonly source: DeckyRecentAchievementSource;
  readonly normalizedUnlockAt?: number;
  readonly trusted: boolean;
}

interface DeckyRecentAchievementDebugGameCandidate {
  readonly id: string;
  readonly title: string;
  readonly source: DeckyRecentAchievementGameSource;
  readonly unlockedCount: number;
  readonly sortEpoch?: number;
}

type DeckyRecentAchievementSource = "live-recent" | "cache" | "date-range" | "backfill";

interface DeckyRecentAchievementCandidate {
  readonly recentUnlock: RecentUnlock;
  readonly source: DeckyRecentAchievementSource;
  readonly normalizedUnlockAt?: number;
}

function createDeckyRecentAchievementGameCandidate(
  gameId: string,
  title: string,
  unlockedCount: number,
  source: DeckyRecentAchievementGameSource,
  sortEpoch?: number,
): DeckyRecentAchievementGameCandidate | undefined {
  if (unlockedCount <= 0) {
    return undefined;
  }

  return {
    gameId,
    title,
    source,
    unlockedCount,
    ...(sortEpoch !== undefined ? { sortEpoch } : {}),
  };
}

function createDeckyRecentAchievementCompletionProgressGameCandidate(
  game: NormalizedGame,
): DeckyRecentAchievementGameCandidate | undefined {
  return createDeckyRecentAchievementGameCandidate(
    game.gameId,
    game.title,
    game.summary.unlockedCount,
    "completion-progress",
    game.lastUnlockAt,
  );
}

function createDeckyRecentAchievementRecentlyPlayedGameCandidate(
  game: RecentlyPlayedGame,
  source: DeckyRecentAchievementGameSource,
): DeckyRecentAchievementGameCandidate | undefined {
  return createDeckyRecentAchievementGameCandidate(
    game.gameId,
    game.title,
    game.summary.unlockedCount,
    source,
    game.lastPlayedAt,
  );
}

function compareDeckyRecentAchievementGameCandidates(
  left: DeckyRecentAchievementGameCandidate,
  right: DeckyRecentAchievementGameCandidate,
): number {
  const leftSortEpoch = left.sortEpoch ?? Number.NEGATIVE_INFINITY;
  const rightSortEpoch = right.sortEpoch ?? Number.NEGATIVE_INFINITY;
  if (leftSortEpoch !== rightSortEpoch) {
    return rightSortEpoch - leftSortEpoch;
  }

  if (left.unlockedCount !== right.unlockedCount) {
    return right.unlockedCount - left.unlockedCount;
  }

  const sourceOrder: Record<DeckyRecentAchievementGameSource, number> = {
    "completion-progress": 0,
    "recently-played": 1,
    "snapshot-recently-played": 2,
  };
  const sourceOrderDelta = sourceOrder[left.source] - sourceOrder[right.source];
  if (sourceOrderDelta !== 0) {
    return sourceOrderDelta;
  }

  const titleDelta = left.title.localeCompare(right.title);
  if (titleDelta !== 0) {
    return titleDelta;
  }

  return left.gameId.localeCompare(right.gameId);
}

function selectDeckyRecentAchievementGameCandidates(
  candidates: readonly DeckyRecentAchievementGameCandidate[],
): readonly DeckyRecentAchievementGameCandidate[] {
  const seen = new Set<string>();
  const deduped: DeckyRecentAchievementGameCandidate[] = [];

  for (const candidate of [...candidates].sort(compareDeckyRecentAchievementGameCandidates)) {
    if (seen.has(candidate.gameId)) {
      continue;
    }

    seen.add(candidate.gameId);
    deduped.push(candidate);
  }

  return deduped;
}

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

function getRecentUnlockIdentity(recentUnlock: RecentUnlock): string {
  return `${recentUnlock.achievement.providerId}:${recentUnlock.achievement.gameId}:${recentUnlock.achievement.achievementId}`;
}

function getNormalizedRecentUnlockTimestamp(recentUnlock: RecentUnlock): number | undefined {
  const normalizedUnlockAt = recentUnlock.unlockedAt ?? recentUnlock.achievement.unlockedAt;
  if (typeof normalizedUnlockAt !== "number" || !Number.isFinite(normalizedUnlockAt)) {
    return undefined;
  }

  return Math.trunc(normalizedUnlockAt);
}

function getDeckyRecentAchievementProfileMemberSinceAt(
  snapshot: DashboardSnapshot,
): number | undefined {
  const memberSinceMetric = snapshot.profile.metrics.find((metric) =>
    metric.key === "member-since" || metric.label.toLowerCase() === "member since",
  );
  if (memberSinceMetric === undefined) {
    return undefined;
  }

  const parsedAt = Date.parse(memberSinceMetric.value);
  if (!Number.isFinite(parsedAt)) {
    return undefined;
  }

  return Math.trunc(parsedAt);
}

function createDeckyRecentAchievementRunLogger() {
  return {
    log(_stage: string, _details: Record<string, unknown>): void {
      return;
    },
  };
}

function createDeckyRecentAchievementCandidate(
  recentUnlock: RecentUnlock,
  source: DeckyRecentAchievementSource,
): DeckyRecentAchievementCandidate {
  const normalizedUnlockAt = getNormalizedRecentUnlockTimestamp(recentUnlock);

  return {
    recentUnlock,
    source,
    ...(normalizedUnlockAt !== undefined ? { normalizedUnlockAt } : {}),
  };
}

function compareDeckyRecentAchievementCandidates(
  left: DeckyRecentAchievementCandidate,
  right: DeckyRecentAchievementCandidate,
): number {
  const leftHasTrustedUnlockAt = left.normalizedUnlockAt !== undefined;
  const rightHasTrustedUnlockAt = right.normalizedUnlockAt !== undefined;

  if (leftHasTrustedUnlockAt !== rightHasTrustedUnlockAt) {
    return leftHasTrustedUnlockAt ? -1 : 1;
  }

  if (
    leftHasTrustedUnlockAt &&
    rightHasTrustedUnlockAt &&
    left.normalizedUnlockAt !== right.normalizedUnlockAt
  ) {
    return right.normalizedUnlockAt - left.normalizedUnlockAt;
  }

  const sourceOrder: Record<DeckyRecentAchievementSource, number> = {
    "live-recent": 0,
    cache: 1,
    "date-range": 2,
    backfill: 3,
  };
  const sourceOrderDelta = sourceOrder[left.source] - sourceOrder[right.source];
  if (sourceOrderDelta !== 0) {
    return sourceOrderDelta;
  }

  const titleDelta = left.recentUnlock.achievement.title.localeCompare(right.recentUnlock.achievement.title);
  if (titleDelta !== 0) {
    return titleDelta;
  }

  const gameTitleDelta = left.recentUnlock.game.title.localeCompare(right.recentUnlock.game.title);
  if (gameTitleDelta !== 0) {
    return gameTitleDelta;
  }

  return getRecentUnlockIdentity(left.recentUnlock).localeCompare(getRecentUnlockIdentity(right.recentUnlock));
}

function selectDeckyRecentAchievementCandidates(
  candidates: readonly DeckyRecentAchievementCandidate[],
): readonly DeckyRecentAchievementCandidate[] {
  const seen = new Set<string>();
  const deduped: DeckyRecentAchievementCandidate[] = [];

  for (const candidate of [...candidates].sort(compareDeckyRecentAchievementCandidates)) {
    const identity = getRecentUnlockIdentity(candidate.recentUnlock);
    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    deduped.push(candidate);
  }

  return deduped;
}

function isTrustedDeckyRecentAchievementCandidate(
  candidate: DeckyRecentAchievementCandidate,
): boolean {
  return candidate.normalizedUnlockAt !== undefined;
}

function compareFallbackDeckyRecentAchievementCandidates(
  left: DeckyRecentAchievementCandidate,
  right: DeckyRecentAchievementCandidate,
): number {
  const sourceOrder: Record<DeckyRecentAchievementSource, number> = {
    "live-recent": 0,
    cache: 1,
    "date-range": 2,
    backfill: 3,
  };
  const sourceOrderDelta = sourceOrder[left.source] - sourceOrder[right.source];
  if (sourceOrderDelta !== 0) {
    return sourceOrderDelta;
  }

  const titleDelta = left.recentUnlock.achievement.title.localeCompare(right.recentUnlock.achievement.title);
  if (titleDelta !== 0) {
    return titleDelta;
  }

  const gameTitleDelta = left.recentUnlock.game.title.localeCompare(right.recentUnlock.game.title);
  if (gameTitleDelta !== 0) {
    return gameTitleDelta;
  }

  return getRecentUnlockIdentity(left.recentUnlock).localeCompare(getRecentUnlockIdentity(right.recentUnlock));
}

function rankDeckyRecentAchievements(
  candidates: readonly DeckyRecentAchievementCandidate[],
): readonly RecentUnlock[] {
  return finalizeDeckyRecentAchievementCandidates(candidates).selectedCandidates.map(
    (candidate) => candidate.recentUnlock,
  );
}

function finalizeDeckyRecentAchievementCandidates(
  candidates: readonly DeckyRecentAchievementCandidate[],
): {
  readonly trustedCandidates: readonly DeckyRecentAchievementCandidate[];
  readonly fallbackCandidates: readonly DeckyRecentAchievementCandidate[];
  readonly selectedCandidates: readonly DeckyRecentAchievementCandidate[];
} {
  const dedupedCandidates = selectDeckyRecentAchievementCandidates(candidates);
  const trustedCandidates = dedupedCandidates
    .filter(isTrustedDeckyRecentAchievementCandidate)
    .sort(compareDeckyRecentAchievementCandidates);
  const fallbackCandidates = dedupedCandidates
    .filter((candidate) => !isTrustedDeckyRecentAchievementCandidate(candidate))
    .sort(compareFallbackDeckyRecentAchievementCandidates);

  const selectedCandidates =
    trustedCandidates.length >= DECKY_RECENT_ACHIEVEMENTS_LIMIT
      ? trustedCandidates.slice(0, DECKY_RECENT_ACHIEVEMENTS_LIMIT)
      : [
          ...trustedCandidates,
          ...fallbackCandidates.slice(
            0,
            DECKY_RECENT_ACHIEVEMENTS_LIMIT - trustedCandidates.length,
          ),
        ];

  return {
    trustedCandidates,
    fallbackCandidates,
    selectedCandidates,
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

  return {
    ...snapshot,
    recentAchievements: mergedRecentAchievements,
    recentUnlocks: mergedRecentAchievements,
  };
}

function toRecentUnlock(
  game: GameDetailSnapshot["game"],
  achievement: GameDetailSnapshot["achievements"][number],
): RecentUnlock {
  const unlockedAt = achievement.unlockedAt;

  return {
    achievement,
    game: {
      providerId: game.providerId,
      gameId: game.gameId,
      title: game.title,
      ...(game.platformLabel !== undefined ? { platformLabel: game.platformLabel } : {}),
      ...(game.coverImageUrl !== undefined ? { coverImageUrl: game.coverImageUrl } : {}),
    },
    ...(unlockedAt !== undefined ? { unlockedAt } : {}),
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
    if (baselineRecentAchievements.length === 0) {
      removeDeckyStorageText(storageKey);
    } else {
      writeDeckyRecentAchievementHistory(storageKey, baselineRecentAchievements);
    }

    debugLog.log("skip-backfill", {
      storageKey,
      reason: args.provider === undefined ? "missing-provider" : "missing-config",
      baselineRecentAchievementCount: baselineRecentAchievements.length,
      baselineRecentAchievementSample: baselineRecentAchievementCandidates
        .slice(0, 5)
        .map(describeDeckyRecentAchievementCandidate),
    });
    return {
      ...args.snapshot,
      recentAchievements: baselineRecentAchievements,
      recentUnlocks: baselineRecentAchievements,
    };
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
  let dateRangeRecentAchievementCandidates: DeckyRecentAchievementCandidate[] = [];
  let dateRangeRecentUnlockCount = 0;
  let perGameProgressFetchCount = 0;
  let perGameProgressFailureCount = 0;
  let extractedBackfillCount = 0;
  let candidateGames: readonly DeckyRecentAchievementGameCandidate[] = [];

  if (
    args.provider.loadAchievementsEarnedBetween !== undefined &&
    memberSinceAt !== undefined
  ) {
    const nowAt = Date.now();
    try {
      const dateRangeRecentUnlocks = await args.provider.loadAchievementsEarnedBetween(
        args.providerConfig,
        {
          fromEpochSeconds: Math.trunc(memberSinceAt / 1000),
          toEpochSeconds: Math.trunc(nowAt / 1000),
        },
      );
      dateRangeRecentUnlockCount = dateRangeRecentUnlocks.length;
      dateRangeRecentAchievementCandidates = dateRangeRecentUnlocks.map((recentUnlock) =>
        createDeckyRecentAchievementCandidate(recentUnlock, "date-range"),
      );
      candidateRecentAchievementCandidates = [
        ...candidateRecentAchievementCandidates,
        ...dateRangeRecentAchievementCandidates,
      ];
      candidateSelection = finalizeDeckyRecentAchievementCandidates(candidateRecentAchievementCandidates);
      debugLog.log("date-range", {
        storageKey,
        memberSinceAt,
        fromEpochSeconds: Math.trunc(memberSinceAt / 1000),
        toEpochSeconds: Math.trunc(nowAt / 1000),
        dateRangeRecentUnlockCount,
        trustedCandidateCount: candidateSelection.trustedCandidates.length,
        fallbackCandidateCount: candidateSelection.fallbackCandidates.length,
        dateRangeSample: dateRangeRecentAchievementCandidates.slice(0, 5).map(
          describeDeckyRecentAchievementCandidate,
        ),
        missingTimestampSamples: dateRangeRecentAchievementCandidates
          .filter((candidate) => candidate.normalizedUnlockAt === undefined)
          .slice(0, 3)
          .map(describeDeckyRecentAchievementTimestampSources),
      });
    } catch (cause) {
      debugLog.log("date-range-failed", { storageKey, memberSinceAt, cause });
    }
  } else {
    debugLog.log("date-range-skipped", {
      storageKey,
      reason:
        args.provider.loadAchievementsEarnedBetween === undefined
          ? "missing-provider-method"
          : "missing-member-since",
    });
  }

  if (candidateSelection.trustedCandidates.length >= DECKY_RECENT_ACHIEVEMENTS_LIMIT) {
    const finalRecentAchievementCandidates = candidateSelection.selectedCandidates;
    const finalRecentAchievements = finalRecentAchievementCandidates.map(
      (candidate) => candidate.recentUnlock,
    );
    writeDeckyRecentAchievementHistory(storageKey, finalRecentAchievements);
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

    return {
      ...args.snapshot,
      recentAchievements: finalRecentAchievements,
      recentUnlocks: finalRecentAchievements,
    };
  }

  let completionProgress: readonly NormalizedGame[] = [];
  try {
    completionProgress = await args.provider.loadCompletionProgress(args.providerConfig);
  } catch (cause) {
    debugLog.log("completion-progress-failed", {
      storageKey,
      cause,
      trustedCandidateCount: candidateSelection.trustedCandidates.length,
      fallbackCandidateCount: candidateSelection.fallbackCandidates.length,
    });

    const finalRecentAchievements = candidateSelection.selectedCandidates.map(
      (candidate) => candidate.recentUnlock,
    );
    if (finalRecentAchievements.length === 0) {
      removeDeckyStorageText(storageKey);
    } else {
      writeDeckyRecentAchievementHistory(storageKey, finalRecentAchievements);
    }

    return {
      ...args.snapshot,
      recentAchievements: finalRecentAchievements,
      recentUnlocks: finalRecentAchievements,
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
      debugLog.log("recently-played-failed", { storageKey, cause });
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
  debugLog.log("candidate-sources", {
    storageKey,
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
  candidateGames = selectDeckyRecentAchievementGameCandidates([
    ...completionProgressGameCandidates,
    ...snapshotRecentlyPlayedGameCandidates,
    ...providerRecentlyPlayedGameCandidates,
  ]);

  debugLog.log("candidate-discovery", {
    storageKey,
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
    const finalRecentAchievements = candidateSelection.selectedCandidates.map(
      (candidate) => candidate.recentUnlock,
    );
    if (finalRecentAchievements.length === 0) {
      removeDeckyStorageText(storageKey);
    } else {
      writeDeckyRecentAchievementHistory(storageKey, finalRecentAchievements);
    }

    debugLog.log("no-candidates", {
      storageKey,
      baselineRecentAchievementCount: candidateSelection.selectedCandidates.length,
      baselineRecentAchievementSample: candidateSelection.selectedCandidates
        .slice(0, 5)
        .map(describeDeckyRecentAchievementCandidate),
    });
    return {
      ...args.snapshot,
      recentAchievements: finalRecentAchievements,
      recentUnlocks: finalRecentAchievements,
    };
  }

  const backfillRecentAchievementCandidates: DeckyRecentAchievementCandidate[] = [];
  for (const candidateGame of candidateGames) {
    perGameProgressFetchCount += 1;

    try {
      const gameDetail = await args.provider.loadGameProgress(args.providerConfig, candidateGame.gameId);
      const gameBackfill = gameDetail.achievements
        .filter((achievement) => achievement.isUnlocked)
        .map((achievement) => toRecentUnlock(gameDetail.game, achievement));
      const gameBackfillCandidates = gameBackfill.map((recentUnlock) =>
        createDeckyRecentAchievementCandidate(recentUnlock, "backfill"),
      );

      extractedBackfillCount += gameBackfillCandidates.length;
      backfillRecentAchievementCandidates.push(...gameBackfillCandidates);

      debugLog.log("game-progress", {
        storageKey,
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
      debugLog.log("game-progress-failed", {
        storageKey,
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

  const finalSelection = finalizeDeckyRecentAchievementCandidates([
    ...candidateSelection.selectedCandidates,
    ...backfillRecentAchievementCandidates,
  ]);
  const finalRecentAchievementCandidates = finalSelection.selectedCandidates;
  const finalRecentAchievements = finalRecentAchievementCandidates.map(
    (candidate) => candidate.recentUnlock,
  );
  debugLog.log("merge-before-limit", {
    storageKey,
    dateRangeTrustedCount: candidateSelection.trustedCandidates.length,
    dateRangeFallbackCount: candidateSelection.fallbackCandidates.length,
    perGameProgressFetchCount,
    perGameProgressFailureCount,
    extractedBackfillCount,
    mergedHistoryCountBeforeLimit:
      candidateSelection.selectedCandidates.length + backfillRecentAchievementCandidates.length,
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
      ...backfillRecentAchievementCandidates,
    ]
      .filter((candidate) => candidate.normalizedUnlockAt === undefined)
      .slice(0, 5)
      .map(describeDeckyRecentAchievementTimestampSources),
  });

  if (finalRecentAchievements.length === 0) {
    removeDeckyStorageText(storageKey);
    debugLog.log("empty-after-backfill", { storageKey });
    return {
      ...args.snapshot,
      recentAchievements: candidateSelection.selectedCandidates.map(
        (candidate) => candidate.recentUnlock,
      ),
      recentUnlocks: candidateSelection.selectedCandidates.map((candidate) => candidate.recentUnlock),
    };
  }

  writeDeckyRecentAchievementHistory(storageKey, finalRecentAchievements);
  debugLog.log("final", {
    storageKey,
    finalRecentAchievementCount: finalRecentAchievements.length,
  });

  return {
    ...args.snapshot,
    recentAchievements: finalRecentAchievements,
    recentUnlocks: finalRecentAchievements,
  };
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

  if (runtimeMode === "live" && !options?.forceRefresh) {
    const cachedDashboardState = readDeckyDashboardSnapshotState(providerId);
    if (cachedDashboardState !== undefined) {
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

    const provider = runtimeMode === "live"
      ? (providerRegistry.get(providerId) as DeckyRecentAchievementBackfillProvider | undefined)
      : undefined;
    const providerConfig = runtimeMode === "live" ? await loadDeckyProviderConfig(providerId) : undefined;
    const dashboardSnapshot = await buildDeckyRecentAchievementHistory({
      provider,
      providerConfig,
      snapshot: state.data,
    });
    writeDeckyDashboardSnapshot(dashboardSnapshot);

    if (state.error !== undefined) {
      console.warn("[Achievement Companion][Decky] Dashboard refresh failed", {
        providerId,
        mode: options?.forceRefresh ? "manual" : "initial",
        durationMs: Date.now() - dashboardRefreshStartedAt,
        errorKind: state.error.kind,
      });
      void deckyDiagnosticLogger.record({
        event: "dashboard_refresh_failed",
        providerId,
        mode: options?.forceRefresh ? "manual" : "initial",
        durationMs: Date.now() - dashboardRefreshStartedAt,
        errorKind: state.error.kind,
      });
    } else {
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

  return createDeckyAppServices(runtimeMode).achievementHistory.loadAchievementHistory(providerId);
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
): Promise<ResourceState<GameDetailSnapshot>> {
  const runtimeMode: DeckyRuntimeMode = loadDeckyRuntimeMode();

  if (runtimeMode === "empty") {
    return initialDeckyGameDetailState;
  }

  const state = await createDeckyAppServices(runtimeMode).gameDetail.loadGameDetail(providerId, gameId, {
    forceRefresh: true,
  });

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
