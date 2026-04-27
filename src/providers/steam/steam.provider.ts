import type {
  GameDetailSnapshot,
  GameProgressStatus,
  NormalizedGame,
  ProviderCapabilities,
  RecentlyPlayedGame,
  RecentUnlock,
} from "@core/domain";
import type { AchievementProvider } from "@core/ports";
import { redactFrontendLogText } from "@core/redaction";
import { STEAM_PROVIDER_ID, type SteamProviderConfig } from "./config";
import { createSteamClient, type SteamClient } from "./client/client";
import {
  createFetchSteamTransport,
  type FetchSteamTransportOptions,
  type SteamTransport,
} from "./client/transport";
import {
  normalizeSteamCompletionProgressGames,
  normalizeSteamGameDetail,
  normalizeSteamProfile,
  normalizeSteamRecentUnlocks,
  normalizeSteamRecentlyPlayedGames,
} from "./mappers/normalize";
import { normalizeSteamBadges } from "./badges";
import type {
  RawSteamPlayerSummary,
  RawSteamRecentlyPlayedGame,
} from "./raw-types";

const steamCapabilities: ProviderCapabilities = {
  requiresCredentials: true,
  profileSummary: true,
  completionProgress: true,
  recentUnlocks: true,
  gameProgress: true,
  rarityStats: false,
  search: false,
};

interface SteamProviderDependencies {
  readonly client?: SteamClient;
  readonly transport?: SteamTransport;
  readonly transportOptions?: FetchSteamTransportOptions;
}

interface SteamRecentGameSnapshot {
  readonly rawGame: RawSteamRecentlyPlayedGame;
  readonly recentGame: RecentlyPlayedGame;
  readonly detail?: GameDetailSnapshot;
}

const steamRecentGameSnapshotLoadCache = new Map<
  string,
  | {
      readonly status: "pending";
      readonly createdAt: number;
      readonly promise: Promise<readonly SteamRecentGameSnapshot[]>;
    }
  | {
      readonly status: "resolved";
      readonly createdAt: number;
      readonly snapshots: readonly SteamRecentGameSnapshot[];
    }
>();
const STEAM_RECENT_GAME_SNAPSHOT_CACHE_TTL_MS = 2 * 60 * 1000;

export function clearSteamRecentGameSnapshotLoadCacheForTests(): void {
  steamRecentGameSnapshotLoadCache.clear();
}

function resolveClient(dependencies: SteamProviderDependencies): SteamClient {
  if (dependencies.client !== undefined) {
    return dependencies.client;
  }

  const transport = dependencies.transport ?? createFetchSteamTransport(dependencies.transportOptions);
  return createSteamClient(transport);
}

function applyRecentLimit<T>(items: readonly T[], limit?: number): readonly T[] {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return items;
  }

  const normalizedLimit = Math.trunc(limit);
  if (normalizedLimit <= 0) {
    return [];
  }

  return items.slice(0, normalizedLimit);
}

function getSteamRecentGameSnapshotCount(
  config: SteamProviderConfig,
  requestedCount?: number,
): number {
  const values = [
    config.recentlyPlayedCount,
    config.recentAchievementsCount,
    requestedCount,
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (values.length === 0) {
    return 0;
  }

  return Math.max(...values.map((value) => Math.trunc(value)));
}

function getSteamRecentGameSnapshotLoadCacheKey(
  config: SteamProviderConfig,
  count: number,
): string {
  return [
    config.steamId64,
    config.language,
    config.includePlayedFreeGames ? "1" : "0",
    String(count),
  ].join(":");
}

function getSteamRecentGameSnapshotLoadCacheKeyPrefix(
  config: SteamProviderConfig,
): string {
  return [
    config.steamId64,
    config.language,
    config.includePlayedFreeGames ? "1" : "0",
  ].join(":");
}

async function getCachedSteamRecentGameSnapshot(
  config: SteamProviderConfig,
  appId: number,
): Promise<SteamRecentGameSnapshot | undefined> {
  const cacheKeyPrefix = `${getSteamRecentGameSnapshotLoadCacheKeyPrefix(config)}:`;
  const pendingLoads: Promise<readonly SteamRecentGameSnapshot[]>[] = [];
  const now = Date.now();

  for (const [cacheKey, cachedEntry] of steamRecentGameSnapshotLoadCache.entries()) {
    if (!cacheKey.startsWith(cacheKeyPrefix)) {
      continue;
    }

    if (now - cachedEntry.createdAt > STEAM_RECENT_GAME_SNAPSHOT_CACHE_TTL_MS) {
      steamRecentGameSnapshotLoadCache.delete(cacheKey);
      continue;
    }

    if (cachedEntry.status === "resolved") {
      const resolvedSnapshot = cachedEntry.snapshots.find(
        (snapshot) => snapshot.rawGame.appid === appId,
      );
      if (resolvedSnapshot !== undefined) {
        return resolvedSnapshot;
      }
      continue;
    }

    pendingLoads.push(cachedEntry.promise);
  }

  for (const pendingLoad of pendingLoads) {
    const pendingSnapshots = await pendingLoad;
    const pendingSnapshot = pendingSnapshots.find((snapshot) => snapshot.rawGame.appid === appId);
    if (pendingSnapshot !== undefined) {
      return pendingSnapshot;
    }
  }

  return undefined;
}

function parseAppId(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.trunc(value);
}

function getRawPlayerSummary(
  response: Awaited<ReturnType<SteamClient["loadPlayerSummaries"]>> | undefined,
  steamId64: string,
): RawSteamPlayerSummary | undefined {
  return response?.response?.players?.find((player) => player.steamid === steamId64);
}

function getSteamLevel(
  response: Awaited<ReturnType<SteamClient["loadSteamLevel"]>>,
): number | undefined {
  const level = response.response?.player_level;
  return typeof level === "number" && Number.isFinite(level) ? Math.trunc(level) : undefined;
}

function sanitizeSteamLoadFailureMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message.trim().length > 0) {
    return redactFrontendLogText(cause.message);
  }

  if (typeof cause === "string" && cause.trim().length > 0) {
    return redactFrontendLogText(cause.trim());
  }

  return "Unknown Steam provider error.";
}

function logSteamLoadFailure(operation: string, cause: unknown): void {
  console.warn("[Achievement Companion] steam provider load failed", {
    providerId: STEAM_PROVIDER_ID,
    operation,
    message: sanitizeSteamLoadFailureMessage(cause),
  });
}

function buildGlobalPercentMap(
  response: Awaited<ReturnType<SteamClient["loadGlobalAchievementPercentagesForApp"]>>,
): ReadonlyMap<string, number> {
  return new Map(
    (response.achievementpercentages?.achievements ?? [])
      .map((achievement) => {
        const name = achievement.name?.trim();
        const percent = achievement.percent;
        if (name === undefined || typeof percent !== "number" || !Number.isFinite(percent)) {
          return undefined;
        }

        return [name, percent] as const;
      })
      .filter((entry): entry is readonly [string, number] => entry !== undefined),
  );
}

async function loadSteamGameProgressSnapshot(args: {
  readonly client: SteamClient;
  readonly config: SteamProviderConfig;
  readonly appId: number;
  readonly rawGame?: RawSteamRecentlyPlayedGame;
}): Promise<GameDetailSnapshot> {
  const [playerAchievements, schemaResponse, globalPercentagesResponse] = await Promise.all([
    args.client.loadPlayerAchievements(args.config, args.appId),
    args.client.loadSchemaForGame(args.config, args.appId),
    args.client.loadGlobalAchievementPercentagesForApp(args.appId),
  ]);

  const globalAchievementPercentages = buildGlobalPercentMap(globalPercentagesResponse);
  const schemaAchievements = schemaResponse.game?.availableGameStats?.achievements ?? [];
  const rawGameName =
    args.rawGame?.name ?? schemaResponse.game?.gameName ?? `Steam App ${String(args.appId)}`;

  return normalizeSteamGameDetail({
    appId: args.appId,
    rawGameName,
    rawGameIcon: args.rawGame?.img_icon_url,
    rawGameBoxArt: args.rawGame?.img_logo_url,
    playerAchievements: playerAchievements.playerstats?.achievements ?? [],
    schemaAchievements,
    globalAchievementPercentages,
    playtimeForever: args.rawGame?.playtime_forever,
    playtimeTwoWeeks: args.rawGame?.playtime_2weeks,
    playtimeDeckForever: args.rawGame?.playtime_deck_forever,
  });
}

async function loadSteamRecentGameSnapshots(
  client: SteamClient,
  config: SteamProviderConfig,
  options?: {
    readonly count?: number;
  },
): Promise<readonly SteamRecentGameSnapshot[]> {
  const count = getSteamRecentGameSnapshotCount(config, options?.count);
  const cacheKey = getSteamRecentGameSnapshotLoadCacheKey(config, count);
  const cachedEntry = steamRecentGameSnapshotLoadCache.get(cacheKey);
  if (cachedEntry !== undefined && Date.now() - cachedEntry.createdAt <= STEAM_RECENT_GAME_SNAPSHOT_CACHE_TTL_MS) {
    if (cachedEntry.status === "pending") {
      return cachedEntry.promise;
    }

    return cachedEntry.snapshots;
  }

  if (cachedEntry !== undefined) {
    steamRecentGameSnapshotLoadCache.delete(cacheKey);
  }

  const promise = (async () => {
    const rawResponse = await client.loadRecentlyPlayedGames(config);
    const rawGames = applyRecentLimit(rawResponse.response?.games ?? [], count);

    const snapshots = await Promise.all(
      rawGames.map(async (rawGame) => {
        const appId = parseAppId(rawGame.appid);
        if (appId === undefined) {
          return undefined;
        }

        try {
          const detail = await loadSteamGameProgressSnapshot({
            client,
            config,
            appId,
            rawGame,
          });
          const recentGame = normalizeSteamRecentlyPlayedGames([rawGame], new Map([[appId, detail]]))[0];
          if (recentGame === undefined) {
            return undefined;
          }

          return {
            rawGame,
            recentGame,
            detail,
          } as const;
        } catch {
          const recentGame = normalizeSteamRecentlyPlayedGames([rawGame])[0];
          if (recentGame === undefined) {
            return undefined;
          }

          return {
            rawGame,
            recentGame,
          } as const;
        }
      }),
    );

    return snapshots.filter((snapshot): snapshot is SteamRecentGameSnapshot => snapshot !== undefined);
  })();

  steamRecentGameSnapshotLoadCache.set(cacheKey, {
    status: "pending",
    createdAt: Date.now(),
    promise: promise.then((snapshots) => {
      steamRecentGameSnapshotLoadCache.set(cacheKey, {
        status: "resolved",
        createdAt: Date.now(),
        snapshots,
      });
      return snapshots;
    }),
  });

  return promise;
}

function countBeatenGames(games: readonly RecentlyPlayedGame[]): number {
  let beatenCount = 0;

  for (const game of games) {
    if (game.summary.totalCount !== undefined && game.summary.unlockedCount >= game.summary.totalCount) {
      beatenCount += 1;
    }
  }

  return beatenCount;
}

function toNormalizedGames(recentGames: readonly RecentlyPlayedGame[]): readonly NormalizedGame[] {
  return normalizeSteamCompletionProgressGames(recentGames);
}

export function createSteamProvider(
  dependencies: SteamProviderDependencies = {},
): AchievementProvider<SteamProviderConfig> {
  const client = resolveClient(dependencies);

  return {
    id: STEAM_PROVIDER_ID,
    capabilities: steamCapabilities,

    async loadProfile(config) {
      const playerSummariesPromise = client
        .loadPlayerSummaries(config)
        .catch((cause: unknown) => {
          logSteamLoadFailure("profile.loadPlayerSummaries", cause);
          return undefined;
        });
      const steamLevelPromise = client
        .loadSteamLevel(config)
        .then((response) => getSteamLevel(response))
        .catch((cause: unknown) => {
          logSteamLoadFailure("profile.loadSteamLevel", cause);
          return undefined;
        });
      const steamBadgesPromise = client
        .loadBadges(config)
        .then((response) => normalizeSteamBadges(response))
        .catch((cause: unknown) => {
          logSteamLoadFailure("profile.loadBadges", cause);
          return undefined;
        });

      const [playerSummaries, recentGameSnapshots, steamLevel, steamBadges] = await Promise.all([
        playerSummariesPromise,
        loadSteamRecentGameSnapshots(client, config, {
          count: getSteamRecentGameSnapshotCount(config),
        }),
        steamLevelPromise,
        steamBadgesPromise,
      ]);

      const recentGames = recentGameSnapshots.map((snapshot) => snapshot.recentGame);
      const beatenCount = countBeatenGames(recentGames);

      return normalizeSteamProfile({
        playerSummary: getRawPlayerSummary(playerSummaries, config.steamId64),
        config,
        recentGames,
        gamesBeatenCount: beatenCount,
        ...(steamLevel !== undefined ? { steamLevel } : {}),
        ...(steamBadges !== undefined ? steamBadges : {}),
      });
    },

    async loadCompletionProgress(config) {
      const recentGameSnapshots = await loadSteamRecentGameSnapshots(client, config, {
        count: getSteamRecentGameSnapshotCount(config),
      });

      return toNormalizedGames(recentGameSnapshots.map((snapshot) => snapshot.recentGame));
    },

    async loadRecentUnlocks(config, options) {
      const recentGameSnapshots = await loadSteamRecentGameSnapshots(client, config, {
        count: getSteamRecentGameSnapshotCount(config, options?.limit),
      });
      const recentGames = recentGameSnapshots.map((snapshot) => snapshot.recentGame);
      const details = recentGameSnapshots
        .map((snapshot) => snapshot.detail)
        .filter((detail): detail is GameDetailSnapshot => detail !== undefined);

      return normalizeSteamRecentUnlocks(recentGames, details);
    },

    async loadRecentlyPlayedGames(config, options) {
      const recentGameSnapshots = await loadSteamRecentGameSnapshots(client, config, {
        count: getSteamRecentGameSnapshotCount(config, options?.count),
      });

      return recentGameSnapshots.map((snapshot) => snapshot.recentGame);
    },

    async loadGameProgress(config, gameId) {
      const normalizedAppId = parseAppId(Number(gameId));
      if (normalizedAppId === undefined) {
        throw new Error("Steam app ID must be a positive number.");
      }

      const cachedRecentGameSnapshot = await getCachedSteamRecentGameSnapshot(config, normalizedAppId);
      if (cachedRecentGameSnapshot?.detail !== undefined) {
        return cachedRecentGameSnapshot.detail;
      }

      const rawRecentlyPlayedGamesResponse =
        cachedRecentGameSnapshot?.rawGame !== undefined ? undefined : await client.loadRecentlyPlayedGames(config);
      const rawGame =
        cachedRecentGameSnapshot?.rawGame ??
        rawRecentlyPlayedGamesResponse?.response?.games?.find(
          (game) => parseAppId(game.appid) === normalizedAppId,
        );

      return loadSteamGameProgressSnapshot({
        client,
        config,
        appId: normalizedAppId,
        ...(rawGame !== undefined ? { rawGame } : {}),
      });
    },
  };
}
