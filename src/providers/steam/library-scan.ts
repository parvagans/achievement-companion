import type {
  AchievementHistorySnapshot,
  NormalizedProfile,
  RecentlyPlayedGame,
  RecentUnlock,
} from "@core/domain";
import { redactFrontendLogText } from "@core/redaction";
import { STEAM_PROVIDER_ID, type SteamProviderConfig } from "./config";
import {
  createSteamClient,
  loadSteamPlayerAchievementsCoalesced,
  type SteamClient,
} from "./client/client";
import { countSteamPlayerAchievements, getSteamSchemaAchievementApiNames } from "./achievement-count";
import {
  createFetchSteamTransport,
  type FetchSteamTransportOptions,
  type SteamTransport,
} from "./client/transport";
import { normalizeSteamArtworkUrl } from "./artwork";
import type {
  RawSteamGetOwnedGamesResponse,
  RawSteamOwnedGame,
  RawSteamSchemaAchievement,
} from "./raw-types";

export interface SteamLibraryGameProgressSummary {
  readonly appid: number;
  readonly id: string;
  readonly gameId: string;
  readonly title: string;
  readonly providerId: "steam";
  readonly ownershipStatus?: "owned" | "inactive";
  readonly platformLabel?: string;
  readonly iconUrl?: string;
  readonly playtimeForeverMinutes?: number;
  readonly playtimeTwoWeeksMinutes?: number;
  readonly playtimeDeckForeverMinutes?: number;
  readonly lastPlayedAt?: string;
  readonly totalAchievements: number;
  readonly unlockedAchievements: number;
  readonly completionPercent: number;
  readonly hasAchievements: boolean;
  readonly scanStatus: "scanned" | "no-achievements" | "failed";
  /** Legacy persisted field, read only to migrate older summaries into schema cache. */
  readonly achievementSchema?: readonly RawSteamSchemaAchievement[];
  readonly lastAchievementRefreshAt?: string;
  readonly lastAchievementRefreshError?: string;
}

export interface SteamLibraryUnlockSummary {
  readonly id: string;
  readonly achievementId: string;
  readonly apiName: string;
  readonly title: string;
  readonly description?: string;
  readonly iconUrl?: string;
  readonly unlockedAt: string;
  readonly gameId: string;
  readonly gameTitle: string;
  readonly gameIconUrl?: string;
  readonly providerId: "steam";
}

export interface SteamLibraryAchievementScanSummary {
  /** Steam account that produced this active-library summary. */
  readonly steamId64?: string;
  readonly scannedAt: string;
  /** The full-library scan timestamp remains separate from incremental refreshes. */
  readonly lastRecentActivityRefreshAt?: string;
  readonly lastLibraryRefreshAt?: string;
  readonly ownedGameCount: number;
  readonly scannedGameCount: number;
  readonly gamesWithAchievements: number;
  readonly skippedGameCount: number;
  readonly failedGameCount: number;
  readonly totalAchievements: number;
  readonly unlockedAchievements: number;
  readonly perfectGames: number;
  readonly completionPercent: number;
  readonly games: readonly SteamLibraryGameProgressSummary[];
  readonly unlockedAchievementsList?: readonly SteamLibraryUnlockSummary[];
}

interface SteamLibraryScanDependencies {
  readonly client?: SteamClient;
  readonly transport?: SteamTransport;
  readonly transportOptions?: FetchSteamTransportOptions;
  readonly concurrencyLimit?: number;
  readonly logger?: SteamLibraryScanLogger;
  readonly previousSummary?: SteamLibraryAchievementScanSummary;
  readonly schemaCache?: SteamLibraryAchievementSchemaCache;
}

export interface SteamLibraryAchievementSchemaCache {
  read(appId: number): readonly RawSteamSchemaAchievement[] | undefined;
  write(appId: number, achievements: readonly RawSteamSchemaAchievement[]): void;
}

export interface SteamLibraryScanLogger {
  readonly started?: (fields: { readonly ownedGameCount: number }) => void;
  readonly progress?: (fields: {
    readonly ownedGameCount: number;
    readonly scannedGameCount: number;
    readonly skippedGameCount: number;
    readonly failedGameCount: number;
  }) => void;
  readonly completed?: (fields: {
    readonly durationMs: number;
    readonly ownedGameCount: number;
    readonly scannedGameCount: number;
    readonly gamesWithAchievements: number;
    readonly skippedGameCount: number;
    readonly failedGameCount: number;
    readonly totalAchievements: number;
    readonly unlockedAchievements: number;
    readonly perfectGames: number;
    readonly completionPercent: number;
  }) => void;
  readonly failed?: (fields: {
    readonly durationMs: number;
    readonly ownedGameCount: number;
    readonly scannedGameCount: number;
    readonly skippedGameCount: number;
    readonly failedGameCount: number;
    readonly errorKind: string;
  }) => void;
}

interface SteamLibraryScanStats {
  scannedGameCount: number;
  gamesWithAchievements: number;
  skippedGameCount: number;
  failedGameCount: number;
  totalAchievements: number;
  unlockedAchievements: number;
  perfectGames: number;
}

function formatSteamLibraryCompletionPercent(
  unlockedAchievements: number,
  totalAchievements: number,
): number {
  if (totalAchievements <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round((unlockedAchievements / totalAchievements) * 100)),
  );
}

/**
 * Applies only complete, bounded recent-game player states to an existing
 * full-library summary. Profile refreshes must never make an unverified recent
 * detail response authoritative, but a schema-verified recent response is
 * safe to use for that game's aggregate contribution.
 */
export function reconcileSteamLibraryAchievementSummaryWithRecentGames(
  summary: SteamLibraryAchievementScanSummary,
  recentlyPlayedGames: readonly RecentlyPlayedGame[],
  refreshedAt = new Date().toISOString(),
): SteamLibraryAchievementScanSummary {
  const recentGamesByIdentity = new Map<string, {
    readonly totalAchievements: number;
    readonly unlockedAchievements: number;
  }>();
  for (const recentGame of recentlyPlayedGames) {
    const totalAchievements = recentGame.summary.totalCount;
    const unlockedAchievements = recentGame.summary.unlockedCount;
    if (
      recentGame.achievementStateIsComplete !== true ||
      typeof totalAchievements !== "number" ||
      !Number.isSafeInteger(unlockedAchievements) ||
      unlockedAchievements < 0 ||
      !Number.isSafeInteger(totalAchievements) ||
      totalAchievements < unlockedAchievements
    ) {
      continue;
    }

    const completeCounts = { totalAchievements, unlockedAchievements };
    recentGamesByIdentity.set(recentGame.gameId, completeCounts);
    if (recentGame.appid !== undefined) {
      recentGamesByIdentity.set(String(recentGame.appid), completeCounts);
    }
  }

  let changed = false;
  const games = summary.games.map((game): SteamLibraryGameProgressSummary => {
    if (game.ownershipStatus === "inactive") {
      return game;
    }

    const recentGame = recentGamesByIdentity.get(game.gameId) ?? recentGamesByIdentity.get(String(game.appid));
    if (
      recentGame === undefined ||
      recentGame.totalAchievements === game.totalAchievements &&
        recentGame.unlockedAchievements === game.unlockedAchievements
    ) {
      return game;
    }

    const { totalAchievements, unlockedAchievements } = recentGame;
    const { lastAchievementRefreshError: _lastAchievementRefreshError, ...gameWithoutRefreshError } = game;
    changed = true;
    return {
      ...gameWithoutRefreshError,
      totalAchievements,
      unlockedAchievements,
      completionPercent: formatSteamLibraryCompletionPercent(unlockedAchievements, totalAchievements),
      hasAchievements: totalAchievements > 0,
      scanStatus: totalAchievements > 0 ? "scanned" : "no-achievements",
      lastAchievementRefreshAt: refreshedAt,
    };
  });

  if (!changed) {
    return summary;
  }

  const activeGamesWithAchievements = games.filter(
    (game) =>
      game.ownershipStatus !== "inactive" &&
      game.scanStatus === "scanned" &&
      game.hasAchievements &&
      game.totalAchievements > 0,
  );
  const totalAchievements = activeGamesWithAchievements.reduce(
    (total, game) => total + game.totalAchievements,
    0,
  );
  const unlockedAchievements = activeGamesWithAchievements.reduce(
    (total, game) => total + game.unlockedAchievements,
    0,
  );

  return {
    ...summary,
    lastRecentActivityRefreshAt: refreshedAt,
    gamesWithAchievements: activeGamesWithAchievements.length,
    skippedGameCount: games.filter(
      (game) => game.ownershipStatus !== "inactive" && game.scanStatus === "no-achievements",
    ).length,
    failedGameCount: games.filter(
      (game) =>
        game.ownershipStatus !== "inactive" &&
        (game.scanStatus === "failed" || game.lastAchievementRefreshError !== undefined),
    ).length,
    totalAchievements,
    unlockedAchievements,
    perfectGames: activeGamesWithAchievements.filter(
      (game) => game.unlockedAchievements >= game.totalAchievements,
    ).length,
    completionPercent: formatSteamLibraryCompletionPercent(unlockedAchievements, totalAchievements),
    games,
  };
}

function coerceString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveClient(dependencies: SteamLibraryScanDependencies): SteamClient {
  if (dependencies.client !== undefined) {
    return dependencies.client;
  }

  const transport = dependencies.transport ?? createFetchSteamTransport(dependencies.transportOptions);
  return createSteamClient(transport);
}

function getOwnedGameTitle(game: RawSteamOwnedGame, appId: number): string {
  const title = game.name?.trim();
  return title !== undefined && title.length > 0 ? title : `Steam App ${String(appId)}`;
}

function parseOwnedGameAppId(game: RawSteamOwnedGame): number | undefined {
  if (typeof game.appid !== "number" || !Number.isFinite(game.appid) || game.appid <= 0) {
    return undefined;
  }

  return Math.trunc(game.appid);
}

export function validateSteamOwnedGamesResponse(
  response: RawSteamGetOwnedGamesResponse,
): readonly RawSteamOwnedGame[] | undefined {
  const payload = response.response;
  if (
    payload === undefined ||
    !Array.isArray(payload.games) ||
    typeof payload.game_count !== "number" ||
    !Number.isSafeInteger(payload.game_count) ||
    payload.game_count < 0 ||
    payload.game_count !== payload.games.length
  ) {
    return undefined;
  }

  const seenAppIds = new Set<number>();
  for (const game of payload.games) {
    if (typeof game !== "object" || game === null) {
      return undefined;
    }

    const appId = parseOwnedGameAppId(game);
    if (appId === undefined || seenAppIds.has(appId)) {
      return undefined;
    }
    seenAppIds.add(appId);
  }

  return payload.games;
}

function getValidSchemaAchievements(
  response: Awaited<ReturnType<SteamClient["loadSchemaForGame"]>>,
): readonly RawSteamSchemaAchievement[] | undefined {
  const achievements = response.game?.availableGameStats?.achievements;
  if (!Array.isArray(achievements) || getSteamSchemaAchievementApiNames(achievements) === undefined) {
    return undefined;
  }
  return achievements;
}

function coercePlaytimeMinutes(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  return undefined;
}

function normalizeSteamUnlockTimestamp(unlocktime: unknown): string | undefined {
  if (typeof unlocktime !== "number" || !Number.isFinite(unlocktime) || unlocktime <= 0) {
    return undefined;
  }

  return new Date(Math.trunc(unlocktime) * 1000).toISOString();
}

function buildSteamLibraryGameProgressSummary(args: {
  readonly game: RawSteamOwnedGame | undefined;
  readonly appId: number;
  readonly title: string;
  readonly scanStatus: "scanned" | "no-achievements" | "failed";
  readonly totalAchievements: number;
  readonly unlockedAchievements: number;
  readonly hasAchievements: boolean;
  readonly ownershipStatus?: "owned" | "inactive";
  readonly achievementSchema?: readonly RawSteamSchemaAchievement[];
  readonly lastAchievementRefreshAt?: string;
  readonly lastAchievementRefreshError?: string;
}): SteamLibraryGameProgressSummary {
  const playtimeForeverMinutes = coercePlaytimeMinutes(args.game?.playtime_forever);
  const playtimeTwoWeeksMinutes = coercePlaytimeMinutes(args.game?.playtime_2weeks);
  const playtimeDeckForeverMinutes = coercePlaytimeMinutes(args.game?.playtime_deck_forever);
  const lastPlayedAt =
    typeof args.game?.rtime_last_played === "number" &&
    Number.isFinite(args.game.rtime_last_played) &&
    args.game.rtime_last_played > 0
      ? new Date(args.game.rtime_last_played * 1000).toISOString()
      : undefined;
  const iconUrl = normalizeSteamArtworkUrl(args.game?.img_icon_url, args.appId);
  const completionPercent =
    args.totalAchievements > 0
      ? Math.max(0, Math.min(100, Math.round((args.unlockedAchievements / args.totalAchievements) * 100)))
      : 0;

  return {
    appid: args.appId,
    id: String(args.appId),
    gameId: String(args.appId),
    title: args.title,
    providerId: "steam",
    ...(args.ownershipStatus !== undefined ? { ownershipStatus: args.ownershipStatus } : {}),
    platformLabel: "Steam",
    ...(iconUrl !== undefined ? { iconUrl } : {}),
    ...(playtimeForeverMinutes !== undefined ? { playtimeForeverMinutes } : {}),
    ...(playtimeTwoWeeksMinutes !== undefined ? { playtimeTwoWeeksMinutes } : {}),
    ...(playtimeDeckForeverMinutes !== undefined ? { playtimeDeckForeverMinutes } : {}),
    ...(lastPlayedAt !== undefined ? { lastPlayedAt } : {}),
    totalAchievements: args.totalAchievements,
    unlockedAchievements: args.unlockedAchievements,
    completionPercent,
    hasAchievements: args.hasAchievements,
    scanStatus: args.scanStatus,
    ...(args.achievementSchema !== undefined ? { achievementSchema: args.achievementSchema } : {}),
    ...(args.lastAchievementRefreshAt !== undefined
      ? { lastAchievementRefreshAt: args.lastAchievementRefreshAt }
      : {}),
    ...(args.lastAchievementRefreshError !== undefined
      ? { lastAchievementRefreshError: args.lastAchievementRefreshError }
      : {}),
  };
}

function buildSteamLibraryUnlockSummary(args: {
  readonly game: RawSteamOwnedGame | undefined;
  readonly appId: number;
  readonly title: string;
  readonly achievement: {
    readonly apiname?: string;
    readonly achieved?: number | boolean;
    readonly unlocktime?: number;
    readonly name?: string;
    readonly displayName?: string;
    readonly description?: string;
    readonly icon?: string;
  };
  readonly schemaAchievement?: {
    readonly name?: string;
    readonly displayName?: string;
    readonly description?: string;
    readonly icon?: string;
    readonly icongray?: string;
  };
}): SteamLibraryUnlockSummary | undefined {
  const isUnlocked = args.achievement.achieved === 1 || args.achievement.achieved === true;
  const unlockedAt = normalizeSteamUnlockTimestamp(args.achievement.unlocktime);
  if (!isUnlocked || unlockedAt === undefined) {
    return undefined;
  }

  const apiName =
    coerceString(args.achievement.apiname) ??
    coerceString(args.achievement.name) ??
    coerceString(args.achievement.displayName) ??
    `steam-achievement-${String(args.appId)}`;
  const title =
    coerceString(args.schemaAchievement?.displayName) ??
    coerceString(args.achievement.displayName) ??
    coerceString(args.achievement.name) ??
    coerceString(args.achievement.apiname) ??
    apiName;
  const description =
    coerceString(args.schemaAchievement?.description) ?? coerceString(args.achievement.description);
  const iconUrl = normalizeSteamArtworkUrl(
    args.schemaAchievement?.icon ?? args.achievement.icon ?? args.schemaAchievement?.icongray,
    args.appId,
  );
  const gameIconUrl = normalizeSteamArtworkUrl(args.game?.img_icon_url, args.appId);

  return {
    id: `${args.appId}:${apiName}:${unlockedAt}`,
    achievementId: apiName,
    apiName,
    title,
    ...(description !== undefined ? { description } : {}),
    ...(iconUrl !== undefined ? { iconUrl } : {}),
    unlockedAt,
    gameId: String(args.appId),
    gameTitle: args.title,
    ...(gameIconUrl !== undefined ? { gameIconUrl } : {}),
    providerId: "steam",
  };
}

function compareSteamLibraryUnlockSummaries(
  left: SteamLibraryUnlockSummary,
  right: SteamLibraryUnlockSummary,
): number {
  const leftTimestamp = Date.parse(left.unlockedAt);
  const rightTimestamp = Date.parse(right.unlockedAt);
  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp;
  }

  const gameTitleDelta = left.gameTitle.localeCompare(right.gameTitle);
  if (gameTitleDelta !== 0) {
    return gameTitleDelta;
  }

  const titleDelta = left.title.localeCompare(right.title);
  if (titleDelta !== 0) {
    return titleDelta;
  }

  return left.id.localeCompare(right.id);
}

async function mapWithConcurrency<T, U>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<U>,
): Promise<readonly U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex] as T, currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function sanitizeSteamLoadFailureMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message.trim().length > 0) {
    return redactFrontendLogText(cause.message);
  }

  if (typeof cause === "string" && cause.trim().length > 0) {
    return redactFrontendLogText(cause.trim());
  }

  return "Unknown Steam library scan error.";
}

function logSteamLibraryScan(message: string, extra?: unknown): void {
  console.warn("[Achievement Companion] steam library scan", {
    providerId: STEAM_PROVIDER_ID,
    message,
    ...(typeof extra === "object" && extra !== null ? extra : {}),
  });
}

function isExpectedSteamLibraryScanGameFailure(cause: unknown): boolean {
  const message =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : undefined;
  if (message === undefined) {
    return false;
  }

  return /HTTP\s+(400|403)/i.test(message) || /no stats|not public|private/i.test(message);
}

export async function scanSteamLibraryAchievements(
  config: SteamProviderConfig,
  dependencies: SteamLibraryScanDependencies = {},
): Promise<SteamLibraryAchievementScanSummary> {
  return updateSteamLibraryAchievementSummary(config, dependencies, "full-scan");
}

export async function refreshSteamLibraryAchievementProgress(
  config: SteamProviderConfig,
  previousSummary: SteamLibraryAchievementScanSummary | undefined,
  dependencies: Omit<SteamLibraryScanDependencies, "previousSummary"> = {},
): Promise<SteamLibraryAchievementScanSummary> {
  return updateSteamLibraryAchievementSummary(
    config,
    { ...dependencies, ...(previousSummary !== undefined ? { previousSummary } : {}) },
    "incremental-refresh",
  );
}

async function updateSteamLibraryAchievementSummary(
  config: SteamProviderConfig,
  dependencies: SteamLibraryScanDependencies,
  mode: "full-scan" | "incremental-refresh",
): Promise<SteamLibraryAchievementScanSummary> {
  const client = resolveClient(dependencies);
  const concurrencyLimit = dependencies.concurrencyLimit ?? 4;
  const startedAt = new Date().toISOString();
  const logger = dependencies.logger;
  const startedAtMs = Date.now();
  let lastProgressLoggedAtMs = startedAtMs;
  let lastProgressSignature: string | undefined;
  let finalProgressLogged = false;
  let ownedGameCount = 0;
  const stats: SteamLibraryScanStats = {
    scannedGameCount: 0,
    gamesWithAchievements: 0,
    skippedGameCount: 0,
    failedGameCount: 0,
    totalAchievements: 0,
    unlockedAchievements: 0,
    perfectGames: 0,
  };

  logSteamLibraryScan("started");
  try {
    const ownedGamesResponse = await client.loadOwnedGames(config);
    const ownedGames = validateSteamOwnedGamesResponse(ownedGamesResponse);
    if (ownedGames === undefined) {
      throw new Error("Steam owned-games response was incomplete or inconsistent; cached library was preserved.");
    }
    if (ownedGames.length === 0 && (dependencies.previousSummary?.games.length ?? 0) > 0) {
      throw new Error("Steam returned an empty owned-games list for a cached non-empty library; cached library was preserved.");
    }
    ownedGameCount = ownedGames.length;
    logSteamLibraryScan("owned games loaded", { ownedGameCount });
    logger?.started?.({ ownedGameCount });

    const validOwnedGames = ownedGames.map((game) => {
      const appId = parseOwnedGameAppId(game) as number;
      return { appId, game, title: getOwnedGameTitle(game, appId) } as const;
    });
    const ownedGamesByAppId = new Map(
      validOwnedGames.map((game) => [game.appId, game.game] as const),
    );
    const previousGamesByAppId = new Map(
      (dependencies.previousSummary?.games ?? []).map((game) => [game.appid, game] as const),
    );
    for (const previousGame of dependencies.previousSummary?.games ?? []) {
      if (previousGame.achievementSchema !== undefined) {
        dependencies.schemaCache?.write(previousGame.appid, previousGame.achievementSchema);
      }
    }

    const gameResults = await mapWithConcurrency(validOwnedGames, concurrencyLimit, async (game) => {
    stats.scannedGameCount += 1;

    let gameResult:
      | {
          readonly gameSummary: SteamLibraryGameProgressSummary;
          readonly unlockedSummaries: readonly SteamLibraryUnlockSummary[];
        }
      | undefined;

    const ownedGame = ownedGamesByAppId.get(game.appId);
    const previousGame = previousGamesByAppId.get(game.appId);
    let schemaAchievements = dependencies.schemaCache?.read(game.appId) ?? previousGame?.achievementSchema;
    let schemaWasConfirmed = schemaAchievements !== undefined;
    let schemaRefreshed = false;
    try {
      if (!schemaWasConfirmed) {
        const schemaResponse = await client.loadSchemaForGame(config, game.appId);
        schemaAchievements = getValidSchemaAchievements(schemaResponse);
        schemaWasConfirmed = schemaAchievements !== undefined;
        schemaRefreshed = schemaWasConfirmed;
        if (schemaWasConfirmed && schemaAchievements !== undefined) {
          dependencies.schemaCache?.write(game.appId, schemaAchievements);
        }
      }
    } catch (cause) {
      logSteamSchemaLoadFailureMessage(cause, { appId: game.appId, title: game.title });
    }

    try {
      const response = await loadSteamPlayerAchievementsCoalesced(client, config, game.appId);

      const playerStats = response.playerstats;
      if (playerStats?.success !== true || !Array.isArray(playerStats.achievements)) {
        throw new Error("Steam player-achievements response was missing a successful playerstats achievement array.");
      }

      const counts = countSteamPlayerAchievements(playerStats.achievements);
      if (counts === undefined) {
        throw new Error("Steam player-achievements response contained malformed or conflicting entries.");
      }

      let schemaNames = schemaWasConfirmed
        ? getSteamSchemaAchievementApiNames(schemaAchievements ?? [])
        : undefined;
      let playerNames = new Set(counts.achievements.map((achievement) => achievement.apiname?.trim()));
      const decreasedTotal = previousGame !== undefined && counts.total < previousGame.totalAchievements;
      const decreasedUnlocked = previousGame !== undefined && counts.unlocked < previousGame.unlockedAchievements;
      const decreasedAny = decreasedTotal || decreasedUnlocked;
      if (decreasedAny && !schemaRefreshed) {
        try {
          const schemaResponse = await client.loadSchemaForGame(config, game.appId);
          const refreshedSchema = getValidSchemaAchievements(schemaResponse);
          if (refreshedSchema !== undefined) {
            schemaAchievements = refreshedSchema;
            schemaNames = getSteamSchemaAchievementApiNames(refreshedSchema);
            schemaWasConfirmed = true;
            schemaRefreshed = true;
            dependencies.schemaCache?.write(game.appId, refreshedSchema);
          }
        } catch (cause) {
          logSteamSchemaLoadFailureMessage(cause, { appId: game.appId, title: game.title });
        }
        playerNames = new Set(counts.achievements.map((achievement) => achievement.apiname?.trim()));
      }
      const schemaMatchesPlayer = schemaNames !== undefined &&
        schemaNames.length === playerNames.size &&
        schemaNames.every((apiName) => playerNames.has(apiName));
      if (
        previousGame !== undefined &&
        decreasedAny &&
        (!schemaMatchesPlayer || (decreasedTotal && !schemaRefreshed))
      ) {
        throw new Error("Steam player-achievements decrease was not supported by a complete authoritative state.");
      }
      if (counts.total === 0 && (!schemaWasConfirmed || (schemaAchievements?.length ?? 0) !== 0)) {
        throw new Error("Empty Steam achievement state was ambiguous; cached counts were preserved.");
      }

      const schemaAchievementByName = new Map(
        (schemaAchievements ?? []).flatMap((achievement) => {
          const name = coerceString(achievement.name);
          return name !== undefined ? [[name, achievement] as const] : [];
        }),
      );
      const unlockedSummaries = counts.achievements
        .map((achievement) => {
          const schemaAchievement = schemaAchievementByName.get(achievement.apiname?.trim() ?? "");
          return buildSteamLibraryUnlockSummary({
            game: ownedGame,
            appId: game.appId,
            title: game.title,
            achievement,
            ...(schemaAchievement !== undefined ? { schemaAchievement } : {}),
          });
        })
        .filter((unlock): unlock is SteamLibraryUnlockSummary => unlock !== undefined);
      const refreshedAt = new Date().toISOString();
      const refreshedGameSummary = buildSteamLibraryGameProgressSummary({
          game: ownedGame,
          appId: game.appId,
          title: game.title,
          scanStatus: counts.total === 0 ? "no-achievements" : "scanned",
          totalAchievements: counts.total,
          unlockedAchievements: counts.unlocked,
          hasAchievements: counts.total > 0,
          ownershipStatus: "owned",
          lastAchievementRefreshAt: refreshedAt,
        });
      const previousGameWithoutError = previousGame !== undefined ? { ...previousGame } : undefined;
      if (previousGameWithoutError !== undefined) {
        delete previousGameWithoutError.lastAchievementRefreshError;
        delete previousGameWithoutError.achievementSchema;
      }
      gameResult = {
        gameSummary: previousGame === undefined
          ? refreshedGameSummary
          : {
              ...previousGameWithoutError,
              ...refreshedGameSummary,
              ...((refreshedGameSummary.iconUrl ?? previousGame.iconUrl) !== undefined
                ? { iconUrl: refreshedGameSummary.iconUrl ?? previousGame.iconUrl }
                : {}),
              ...((refreshedGameSummary.playtimeForeverMinutes ?? previousGame.playtimeForeverMinutes) !== undefined
                ? {
                    playtimeForeverMinutes:
                      refreshedGameSummary.playtimeForeverMinutes ?? previousGame.playtimeForeverMinutes,
                  }
                : {}),
              ...((refreshedGameSummary.playtimeTwoWeeksMinutes ?? previousGame.playtimeTwoWeeksMinutes) !== undefined
                ? {
                    playtimeTwoWeeksMinutes:
                      refreshedGameSummary.playtimeTwoWeeksMinutes ?? previousGame.playtimeTwoWeeksMinutes,
                  }
                : {}),
              ...((refreshedGameSummary.playtimeDeckForeverMinutes ?? previousGame.playtimeDeckForeverMinutes) !== undefined
                ? {
                    playtimeDeckForeverMinutes:
                      refreshedGameSummary.playtimeDeckForeverMinutes ?? previousGame.playtimeDeckForeverMinutes,
                  }
                : {}),
            },
        unlockedSummaries,
      } as const;
    } catch (cause) {
      stats.failedGameCount += 1;
      if (!isExpectedSteamLibraryScanGameFailure(cause)) {
        logSteamLoadFailureMessage(cause, { appId: game.appId, title: game.title });
      }
      const refreshedAt = new Date().toISOString();
      gameResult = {
        gameSummary: previousGame !== undefined
          ? {
              ...previousGame,
              ...buildSteamLibraryGameProgressSummary({
                game: ownedGame,
                appId: game.appId,
                title: game.title,
                scanStatus: previousGame.scanStatus,
                totalAchievements: previousGame.totalAchievements,
                unlockedAchievements: previousGame.unlockedAchievements,
                hasAchievements: previousGame.hasAchievements,
                ownershipStatus: "owned",
                ...(previousGame.lastAchievementRefreshAt !== undefined
                  ? { lastAchievementRefreshAt: previousGame.lastAchievementRefreshAt }
                  : {}),
                lastAchievementRefreshError: sanitizeSteamLoadFailureMessage(cause),
              }),
            }
          : buildSteamLibraryGameProgressSummary({
              game: ownedGame,
              appId: game.appId,
              title: game.title,
              scanStatus: "failed",
              totalAchievements: 0,
              unlockedAchievements: 0,
              hasAchievements: false,
              ownershipStatus: "owned",
              lastAchievementRefreshAt: refreshedAt,
              lastAchievementRefreshError: sanitizeSteamLoadFailureMessage(cause),
            }),
        unlockedSummaries: previousGame === undefined
          ? []
          : (dependencies.previousSummary?.unlockedAchievementsList ?? []).filter(
              (unlock) => unlock.gameId === previousGame.gameId,
            ),
      } as const;
    }

    const now = Date.now();
    const progressSignature = `${ownedGameCount}:${stats.scannedGameCount}:${stats.skippedGameCount}:${stats.failedGameCount}`;
    const isFinalProgress = stats.scannedGameCount === ownedGameCount;
    if (
      logger !== undefined &&
      progressSignature !== lastProgressSignature &&
      ((isFinalProgress && !finalProgressLogged) ||
        stats.scannedGameCount % 25 === 0 ||
        now - lastProgressLoggedAtMs >= 15_000)
    ) {
      lastProgressLoggedAtMs = now;
      lastProgressSignature = progressSignature;
      if (isFinalProgress) {
        finalProgressLogged = true;
      }
      logger.progress?.({
        ownedGameCount,
        scannedGameCount: stats.scannedGameCount,
        skippedGameCount: stats.skippedGameCount,
        failedGameCount: stats.failedGameCount,
      });
    }

    return gameResult as {
      readonly gameSummary: SteamLibraryGameProgressSummary;
      readonly unlockedSummaries: readonly SteamLibraryUnlockSummary[];
    };
  });
    const returnedAppIds = new Set(validOwnedGames.map((game) => game.appId));
    const absentPreviousGames = (dependencies.previousSummary?.games ?? []).filter(
      (game) => !returnedAppIds.has(game.appid),
    );
    const preservedAbsentGames = mode === "full-scan"
      ? absentPreviousGames.map((game) => ({ ...game, ownershipStatus: "inactive" as const }))
      : absentPreviousGames;
    const gameSummariesWithLegacySchema = [...gameResults.map((result) => result.gameSummary), ...preservedAbsentGames];
    const gameSummaries = gameSummariesWithLegacySchema.map((game) => {
      if (game.achievementSchema === undefined) {
        return game;
      }
      const { achievementSchema: _legacySchema, ...lightweightGame } = game;
      return lightweightGame;
    });
    const successfulAppIds = new Set(
      gameResults
        .filter((result) => result.gameSummary.lastAchievementRefreshError === undefined)
        .map((result) => result.gameSummary.appid),
    );
    const refreshedUnlocks = gameResults.flatMap((result) => result.unlockedSummaries);
    const preservedUnlocks = (dependencies.previousSummary?.unlockedAchievementsList ?? [])
      .filter((unlock) => {
        const appId = Number.parseInt(unlock.gameId, 10);
        return !successfulAppIds.has(appId);
      });
    const unlockedAchievementsList = [...preservedUnlocks, ...refreshedUnlocks]
      .sort(compareSteamLibraryUnlockSummaries);
    const activeGamesWithAchievements = gameSummaries.filter(
      (game) =>
        game.ownershipStatus !== "inactive" &&
        game.scanStatus === "scanned" &&
        game.hasAchievements &&
        game.totalAchievements > 0,
    );
    stats.scannedGameCount = validOwnedGames.length;
    stats.gamesWithAchievements = activeGamesWithAchievements.length;
    stats.skippedGameCount = gameSummaries.filter(
      (game) => game.ownershipStatus !== "inactive" && game.scanStatus === "no-achievements",
    ).length;
    stats.failedGameCount = gameSummaries.filter(
      (game) =>
        game.ownershipStatus !== "inactive" &&
        (game.scanStatus === "failed" || game.lastAchievementRefreshError !== undefined),
    ).length;
    stats.totalAchievements = activeGamesWithAchievements.reduce(
      (total, game) => total + game.totalAchievements,
      0,
    );
    stats.unlockedAchievements = activeGamesWithAchievements.reduce(
      (total, game) => total + game.unlockedAchievements,
      0,
    );
    stats.perfectGames = activeGamesWithAchievements.filter(
      (game) => game.unlockedAchievements >= game.totalAchievements,
    ).length;
    const completionPercent = formatSteamLibraryCompletionPercent(
      stats.unlockedAchievements,
      stats.totalAchievements,
    );

    const summary: SteamLibraryAchievementScanSummary = {
      steamId64: config.steamId64,
      scannedAt: mode === "full-scan" ? startedAt : dependencies.previousSummary?.scannedAt ?? startedAt,
      ...(mode === "incremental-refresh"
        ? { lastLibraryRefreshAt: new Date().toISOString() }
        : {}),
      ownedGameCount: gameSummaries.filter((game) => game.ownershipStatus !== "inactive").length,
      scannedGameCount: stats.scannedGameCount,
      gamesWithAchievements: stats.gamesWithAchievements,
      skippedGameCount: stats.skippedGameCount,
      failedGameCount: stats.failedGameCount,
      totalAchievements: stats.totalAchievements,
      unlockedAchievements: stats.unlockedAchievements,
      perfectGames: stats.perfectGames,
      completionPercent,
      games: gameSummaries,
      ...(unlockedAchievementsList.length > 0 ? { unlockedAchievementsList } : {}),
    };

    logSteamLibraryScan("completed", {
      scannedAt: summary.scannedAt,
      ownedGameCount: summary.ownedGameCount,
      scannedGameCount: summary.scannedGameCount,
      gamesWithAchievements: summary.gamesWithAchievements,
      skippedGameCount: summary.skippedGameCount,
      failedGameCount: summary.failedGameCount,
      totalAchievements: summary.totalAchievements,
      unlockedAchievements: summary.unlockedAchievements,
      perfectGames: summary.perfectGames,
      completionPercent: summary.completionPercent,
    });
    logger?.completed?.({
      durationMs: Date.now() - startedAtMs,
      ownedGameCount: summary.ownedGameCount,
      scannedGameCount: summary.scannedGameCount,
      gamesWithAchievements: summary.gamesWithAchievements,
      skippedGameCount: summary.skippedGameCount,
      failedGameCount: summary.failedGameCount,
      totalAchievements: summary.totalAchievements,
      unlockedAchievements: summary.unlockedAchievements,
      perfectGames: summary.perfectGames,
      completionPercent: summary.completionPercent,
    });

    return summary;
  } catch (cause) {
    logger?.failed?.({
      durationMs: Date.now() - startedAtMs,
      ownedGameCount: 0,
      scannedGameCount: stats.scannedGameCount,
      skippedGameCount: stats.skippedGameCount,
      failedGameCount: stats.failedGameCount,
      errorKind:
        cause instanceof Error ? cause.name : typeof cause === "string" ? "error" : "unknown",
    });
    throw cause;
  }
}

function logSteamLoadFailureMessage(
  cause: unknown,
  game: { readonly appId: number; readonly title: string },
): void {
  logSteamLibraryScan("game scan failed", {
    appId: game.appId,
    title: game.title,
    message: sanitizeSteamLoadFailureMessage(cause),
  });
}

function logSteamSchemaLoadFailureMessage(
  cause: unknown,
  game: { readonly appId: number; readonly title: string },
): void {
  logSteamLibraryScan("game schema failed", {
    appId: game.appId,
    title: game.title,
    message: sanitizeSteamLoadFailureMessage(cause),
  });
}

function compareSteamLibraryRecentUnlocks(left: RecentUnlock, right: RecentUnlock): number {
  const leftTimestamp = left.unlockedAt ?? left.achievement.unlockedAt ?? Number.NEGATIVE_INFINITY;
  const rightTimestamp = right.unlockedAt ?? right.achievement.unlockedAt ?? Number.NEGATIVE_INFINITY;

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

  return `${left.achievement.providerId}:${left.game.gameId}:${left.achievement.achievementId}`.localeCompare(
    `${right.achievement.providerId}:${right.game.gameId}:${right.achievement.achievementId}`,
  );
}

function toSteamLibraryRecentUnlock(
  unlock: SteamLibraryUnlockSummary,
): RecentUnlock {
  const unlockedAt = Date.parse(unlock.unlockedAt);

  return {
    achievement: {
      providerId: STEAM_PROVIDER_ID,
      achievementId: unlock.achievementId,
      gameId: unlock.gameId,
      title: unlock.title,
      ...(unlock.description !== undefined ? { description: unlock.description } : {}),
      ...(unlock.iconUrl !== undefined ? { badgeImageUrl: unlock.iconUrl } : {}),
      isUnlocked: true,
      ...(Number.isFinite(unlockedAt) ? { unlockedAt: Math.trunc(unlockedAt) } : {}),
      metrics: [],
    },
    game: {
      providerId: STEAM_PROVIDER_ID,
      gameId: unlock.gameId,
      title: unlock.gameTitle,
      ...(unlock.gameIconUrl !== undefined ? { coverImageUrl: unlock.gameIconUrl } : {}),
      platformLabel: "Steam",
    },
    ...(Number.isFinite(unlockedAt) ? { unlockedAt: Math.trunc(unlockedAt) } : {}),
  };
}

export function buildSteamLibraryAchievementHistorySnapshot(args: {
  readonly profile: NormalizedProfile;
  readonly summary: SteamLibraryAchievementScanSummary;
}): AchievementHistorySnapshot {
  const entries = (args.summary.unlockedAchievementsList ?? [])
    .map(toSteamLibraryRecentUnlock)
    .sort(compareSteamLibraryRecentUnlocks);
  const newestUnlockedAt = entries[0]?.unlockedAt ?? entries[0]?.achievement.unlockedAt;
  const oldestUnlockedAt = entries[entries.length - 1]?.unlockedAt ?? entries[entries.length - 1]?.achievement.unlockedAt;
  const parsedRefreshedAt = Date.parse(args.summary.scannedAt);

  return {
    providerId: STEAM_PROVIDER_ID,
    profile: args.profile,
    entries,
    summary: {
      // A valid Steam count can include unlocks whose timestamp is unavailable.
      // Keep the library aggregate authoritative while entries stay timestamped.
      unlockedCount: args.summary.unlockedAchievements,
      ...(newestUnlockedAt !== undefined ? { newestUnlockedAt } : {}),
      ...(oldestUnlockedAt !== undefined ? { oldestUnlockedAt } : {}),
    },
    sourceLabel: "Library unlocks",
    refreshedAt: Number.isFinite(parsedRefreshedAt) ? Math.trunc(parsedRefreshedAt) : Date.now(),
  };
}
