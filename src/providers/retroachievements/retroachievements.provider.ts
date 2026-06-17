import type {
  NormalizedGame,
  NormalizedMetric,
  ProviderCapabilities,
  RecentUnlock,
  RecentlyPlayedGame,
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
  RawRetroAchievementsGameProgressResponse,
  RawRetroAchievementsRecentlyPlayedGameResponse,
  RawRetroAchievementsSystemResponse,
} from "./raw-types";

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
    },
  ): Promise<readonly RecentUnlock[]>;
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
  let cachedSystemIconUrlByConsoleId: ReadonlyMap<string, string> | undefined;
  let systemIconUrlByConsoleIdPromise: Promise<ReadonlyMap<string, string>> | undefined;

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
      const [rawProfile, rawCompletionProgress] = await Promise.all([
        client.loadProfile(config),
        client.loadCompletionProgress(config),
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
      );
    },

    async loadCompletionProgress(config) {
      const rawCompletionProgress = await client.loadCompletionProgress(config);
      return normalizeRetroAchievementsCompletionProgressGames(rawCompletionProgress);
    },

    async loadAchievementsEarnedBetween(config, options) {
      const rawAchievementsEarnedBetween = await client.loadAchievementsEarnedBetween(
        config,
        options,
      );
      return normalizeRetroAchievementsRecentUnlocks(rawAchievementsEarnedBetween);
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
      return enrichGameDetailSnapshotWithSystemIcon(
        normalizedGameDetail,
        rawGameProgress,
        systemIconUrlByConsoleId,
      );
    },
  };

  return provider;
}
