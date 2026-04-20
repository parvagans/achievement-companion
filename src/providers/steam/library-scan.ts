import type {
  AchievementHistorySnapshot,
  NormalizedProfile,
  RecentUnlock,
} from "@core/domain";
import { STEAM_PROVIDER_ID, type SteamProviderConfig } from "./config";
import { createSteamClient, type SteamClient } from "./client/client";
import {
  createFetchSteamTransport,
  type FetchSteamTransportOptions,
  isSteamTransportHandledHttpErrorResponse,
  type SteamTransport,
} from "./client/transport";
import { normalizeSteamArtworkUrl } from "./artwork";
import type { RawSteamOwnedGame, RawSteamSchemaAchievement } from "./raw-types";

export interface SteamLibraryGameProgressSummary {
  readonly appid: number;
  readonly id: string;
  readonly gameId: string;
  readonly title: string;
  readonly providerId: "steam";
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
  readonly scannedAt: string;
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

interface SteamLibraryScanGameResult {
  readonly gameSummary: SteamLibraryGameProgressSummary;
  readonly unlockedSummaries: readonly SteamLibraryUnlockSummary[];
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

function getAchievementCount(
  achievements: ReadonlyArray<{ readonly achieved?: number | boolean }>,
): {
  readonly total: number;
  readonly unlocked: number;
} {
  let total = 0;
  let unlocked = 0;

  for (const achievement of achievements) {
    total += 1;
    if (achievement.achieved === 1 || achievement.achieved === true) {
      unlocked += 1;
    }
  }

  return { total, unlocked };
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
    return cause.message;
  }

  if (typeof cause === "string" && cause.trim().length > 0) {
    return cause.trim();
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
  const client = resolveClient(dependencies);
  const concurrencyLimit = dependencies.concurrencyLimit ?? 4;
  const startedAt = new Date().toISOString();
  const logger = dependencies.logger;
  const startedAtMs = Date.now();
  let lastProgressLoggedAtMs = startedAtMs;
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
    const ownedGames = ownedGamesResponse.response?.games ?? [];
    ownedGameCount =
      typeof ownedGamesResponse.response?.game_count === "number" &&
        Number.isFinite(ownedGamesResponse.response.game_count)
        ? Math.trunc(ownedGamesResponse.response.game_count)
        : ownedGames.length;
    logSteamLibraryScan("owned games loaded", { ownedGameCount });
    logger?.started?.({ ownedGameCount });

    const validOwnedGames = ownedGames
      .map((game) => {
        const appId = parseOwnedGameAppId(game);
        if (appId === undefined) {
          return undefined;
        }

        return {
          appId,
          game,
          title: getOwnedGameTitle(game, appId),
        } as const;
      })
      .filter(
        (game): game is { readonly appId: number; readonly game: RawSteamOwnedGame; readonly title: string } =>
          game !== undefined,
      );
    const ownedGamesByAppId = new Map(
      validOwnedGames.map((game) => [game.appId, game.game] as const),
    );

    const gameResults = await mapWithConcurrency(validOwnedGames, concurrencyLimit, async (game) => {
    stats.scannedGameCount += 1;

    let gameResult:
      | {
          readonly gameSummary: SteamLibraryGameProgressSummary;
          readonly unlockedSummaries: readonly SteamLibraryUnlockSummary[];
        }
      | undefined;

    try {
      const response =
        client.loadPlayerAchievementsWithHandledHttpStatuses !== undefined
          ? await client.loadPlayerAchievementsWithHandledHttpStatuses(config, game.appId, [400, 403])
          : await client.loadPlayerAchievements(config, game.appId);
      if (isSteamTransportHandledHttpErrorResponse(response)) {
        stats.failedGameCount += 1;
        const ownedGame = ownedGamesByAppId.get(game.appId);
        gameResult = {
          gameSummary: buildSteamLibraryGameProgressSummary({
            game: ownedGame,
            appId: game.appId,
            title: game.title,
            scanStatus: "failed",
            totalAchievements: 0,
            unlockedAchievements: 0,
            hasAchievements: false,
          }),
          unlockedSummaries: [],
        } as const;
      } else {
        const playerStats = response.playerstats;
        if (playerStats?.success === false) {
          stats.failedGameCount += 1;
          const ownedGame = ownedGamesByAppId.get(game.appId);
          gameResult = {
            gameSummary: buildSteamLibraryGameProgressSummary({
              game: ownedGame,
              appId: game.appId,
              title: game.title,
              scanStatus: "failed",
              totalAchievements: 0,
              unlockedAchievements: 0,
              hasAchievements: false,
            }),
            unlockedSummaries: [],
          } as const;
        } else {
          const achievements = playerStats?.achievements ?? [];
          if (achievements.length === 0) {
            stats.skippedGameCount += 1;
            const ownedGame = ownedGamesByAppId.get(game.appId);
            gameResult = {
              gameSummary: buildSteamLibraryGameProgressSummary({
                game: ownedGame,
                appId: game.appId,
                title: game.title,
                scanStatus: "no-achievements",
                totalAchievements: 0,
                unlockedAchievements: 0,
                hasAchievements: false,
              }),
              unlockedSummaries: [],
            } as const;
          } else {
            const counts = getAchievementCount(achievements);
            let schemaAchievementByName = new Map<string, RawSteamSchemaAchievement>();
            if (counts.unlocked > 0) {
              try {
                const schemaResponse = await client.loadSchemaForGame(config, game.appId);
                const schemaAchievements = schemaResponse.game?.availableGameStats?.achievements ?? [];
                schemaAchievementByName = new Map(
                  schemaAchievements
                    .map((achievement) => {
                      const name = coerceString(achievement.name);
                      if (name === undefined) {
                        return undefined;
                      }

                      return [name, achievement] as const;
                    })
                    .filter(
                      (entry): entry is readonly [
                        string,
                        {
                          readonly name?: string;
                          readonly displayName?: string;
                          readonly description?: string;
                          readonly icon?: string;
                          readonly icongray?: string;
                        },
                      ] => entry !== undefined,
                    ),
                );
              } catch (cause) {
                logSteamSchemaLoadFailureMessage(cause, { appId: game.appId, title: game.title });
              }
            }
            const unlockedSummaries = achievements
              .map((achievement) => {
                const achievementApiName =
                  coerceString(achievement.apiname) ??
                  coerceString(achievement.name) ??
                  coerceString(achievement.displayName) ??
                  "";
                const schemaAchievement = schemaAchievementByName.get(achievementApiName);

                return buildSteamLibraryUnlockSummary({
                  game: ownedGamesByAppId.get(game.appId),
                  appId: game.appId,
                  title: game.title,
                  achievement,
                  ...(schemaAchievement !== undefined ? { schemaAchievement } : {}),
                });
              })
              .filter((unlock): unlock is SteamLibraryUnlockSummary => unlock !== undefined);
            stats.gamesWithAchievements += 1;
            stats.totalAchievements += counts.total;
            stats.unlockedAchievements += counts.unlocked;
            if (counts.total > 0 && counts.total === counts.unlocked) {
              stats.perfectGames += 1;
            }
            const ownedGame = ownedGamesByAppId.get(game.appId);
            gameResult = {
              gameSummary: buildSteamLibraryGameProgressSummary({
                game: ownedGame,
                appId: game.appId,
                title: game.title,
                scanStatus: "scanned",
                totalAchievements: counts.total,
                unlockedAchievements: counts.unlocked,
                hasAchievements: true,
              }),
              unlockedSummaries,
            } as const;
          }
        }
      }
    } catch (cause) {
      stats.failedGameCount += 1;
      if (!isExpectedSteamLibraryScanGameFailure(cause)) {
        logSteamLoadFailureMessage(cause, { appId: game.appId, title: game.title });
      }
      const ownedGame = ownedGamesByAppId.get(game.appId);
      gameResult = {
        gameSummary: buildSteamLibraryGameProgressSummary({
          game: ownedGame,
          appId: game.appId,
          title: game.title,
          scanStatus: "failed",
          totalAchievements: 0,
          unlockedAchievements: 0,
          hasAchievements: false,
        }),
        unlockedSummaries: [],
      } as const;
    }

    const now = Date.now();
    if (
      logger !== undefined &&
      (stats.scannedGameCount === ownedGameCount ||
        stats.scannedGameCount % 25 === 0 ||
        now - lastProgressLoggedAtMs >= 15_000)
    ) {
      lastProgressLoggedAtMs = now;
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
    const gameSummaries = gameResults.map((result) => result.gameSummary);
    const unlockedAchievementsList = gameResults
      .flatMap((result) => result.unlockedSummaries)
      .sort(compareSteamLibraryUnlockSummaries);

    const completionPercent =
      stats.totalAchievements > 0
        ? Math.round((stats.unlockedAchievements / stats.totalAchievements) * 100)
        : 0;

    const summary: SteamLibraryAchievementScanSummary = {
      scannedAt: startedAt,
      ownedGameCount,
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
      unlockedCount: entries.length,
      ...(newestUnlockedAt !== undefined ? { newestUnlockedAt } : {}),
      ...(oldestUnlockedAt !== undefined ? { oldestUnlockedAt } : {}),
    },
    sourceLabel: "Library unlocks",
    refreshedAt: Number.isFinite(parsedRefreshedAt) ? Math.trunc(parsedRefreshedAt) : Date.now(),
  };
}
