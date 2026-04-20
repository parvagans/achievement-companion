import type { RetroAchievementsProviderConfig } from "../config";
import type {
  RawRetroAchievementsCompletionProgressEntry,
  RawRetroAchievementsCompletionProgressResponse,
  RawRetroAchievementsGameProgressResponse,
  RawRetroAchievementsProfileResponse,
  RawRetroAchievementsRecentUnlockResponse,
  RawRetroAchievementsRecentlyPlayedGameResponse,
} from "../raw-types";
import type { RetroAchievementsTransport } from "./transport";

export interface RetroAchievementsClient {
  loadProfile(config: RetroAchievementsProviderConfig): Promise<RawRetroAchievementsProfileResponse>;
  loadCompletionProgress(
    config: RetroAchievementsProviderConfig,
  ): Promise<readonly RawRetroAchievementsCompletionProgressEntry[]>;
  loadAchievementsEarnedBetween(
    config: RetroAchievementsProviderConfig,
    options: {
      readonly fromEpochSeconds: number;
      readonly toEpochSeconds: number;
    },
  ): Promise<readonly RawRetroAchievementsRecentUnlockResponse[]>;
  loadRecentUnlocks(
    config: RetroAchievementsProviderConfig,
    options?: {
      readonly minutes?: number;
    },
  ): Promise<readonly RawRetroAchievementsRecentUnlockResponse[]>;
  loadRecentlyPlayedGames(
    config: RetroAchievementsProviderConfig,
    options?: {
      readonly count?: number;
      readonly offset?: number;
    },
  ): Promise<readonly RawRetroAchievementsRecentlyPlayedGameResponse[]>;
  loadGameProgress(
    config: RetroAchievementsProviderConfig,
    gameId: string,
  ): Promise<RawRetroAchievementsGameProgressResponse>;
}

const PROFILE_PATH = "API_GetUserProfile.php";
const COMPLETION_PROGRESS_PATH = "API_GetUserCompletionProgress.php";
const ACHIEVEMENTS_EARNED_BETWEEN_PATH = "API_GetAchievementsEarnedBetween.php";
const RECENT_UNLOCKS_PATH = "API_GetUserRecentAchievements.php";
const RECENTLY_PLAYED_GAMES_PATH = "API_GetUserRecentlyPlayedGames.php";
const GAME_PROGRESS_PATH = "API_GetGameInfoAndUserProgress.php";
// Assumption: 500 keeps the page count low while matching the documented maximum.
const COMPLETION_PROGRESS_PAGE_SIZE = 500;
// Assumption: a one-day recent-unlock window is a small but useful improvement over the default hour.
const DEFAULT_RECENT_UNLOCK_LOOKBACK_MINUTES = 24 * 60;
const DEFAULT_RECENTLY_PLAYED_COUNT = 10;

// Assumption: the client will continue querying by username first; ULID support can be added later without changing the seam.
function toAuthQuery(config: RetroAchievementsProviderConfig): Record<string, string> {
  return {
    u: config.username,
  };
}

function readCompletionProgressResults(
  response: RawRetroAchievementsCompletionProgressResponse,
): readonly RawRetroAchievementsCompletionProgressEntry[] {
  return response.Results ?? response.results ?? [];
}

async function loadAllCompletionProgressEntries(
  transport: RetroAchievementsTransport,
  config: RetroAchievementsProviderConfig,
): Promise<readonly RawRetroAchievementsCompletionProgressEntry[]> {
  const entries: RawRetroAchievementsCompletionProgressEntry[] = [];
  let offset = 0;

  while (true) {
    const response = await transport.requestJson<RawRetroAchievementsCompletionProgressResponse>({
      path: COMPLETION_PROGRESS_PATH,
      query: {
        ...toAuthQuery(config),
        c: COMPLETION_PROGRESS_PAGE_SIZE,
        o: offset,
      },
    });

    const pageEntries = readCompletionProgressResults(response);
    entries.push(...pageEntries);

    if (pageEntries.length === 0) {
      break;
    }

    const total = typeof response.Total === "number"
      ? response.Total
      : typeof response.Total === "string" && response.Total.trim().length > 0
        ? Number(response.Total)
        : typeof response.total === "number"
          ? response.total
          : typeof response.total === "string" && response.total.trim().length > 0
            ? Number(response.total)
            : undefined;

    if (
      (typeof total === "number" && Number.isFinite(total) && entries.length >= total) ||
      pageEntries.length < COMPLETION_PROGRESS_PAGE_SIZE
    ) {
      break;
    }

    offset += pageEntries.length;
  }

  return entries;
}

export function createRetroAchievementsClient(
  transport: RetroAchievementsTransport,
): RetroAchievementsClient {
  return {
    async loadProfile(config) {
      return transport.requestJson<RawRetroAchievementsProfileResponse>({
        path: PROFILE_PATH,
        query: toAuthQuery(config),
      });
    },

    async loadCompletionProgress(config) {
      return loadAllCompletionProgressEntries(transport, config);
    },

    async loadAchievementsEarnedBetween(config, options) {
      return transport.requestJson<readonly RawRetroAchievementsRecentUnlockResponse[]>({
        path: ACHIEVEMENTS_EARNED_BETWEEN_PATH,
        query: {
          ...toAuthQuery(config),
          f: options.fromEpochSeconds,
          t: options.toEpochSeconds,
        },
      });
    },

    async loadRecentUnlocks(config, options) {
      return transport.requestJson<readonly RawRetroAchievementsRecentUnlockResponse[]>({
        path: RECENT_UNLOCKS_PATH,
        query: {
          ...toAuthQuery(config),
          m: options?.minutes ?? DEFAULT_RECENT_UNLOCK_LOOKBACK_MINUTES,
        },
      });
    },

    async loadRecentlyPlayedGames(config, options) {
      return transport.requestJson<readonly RawRetroAchievementsRecentlyPlayedGameResponse[]>({
        path: RECENTLY_PLAYED_GAMES_PATH,
        query: {
          ...toAuthQuery(config),
          c: options?.count ?? DEFAULT_RECENTLY_PLAYED_COUNT,
          ...(options?.offset !== undefined ? { o: options.offset } : {}),
        },
      });
    },

    async loadGameProgress(config, gameId) {
      return transport.requestJson<RawRetroAchievementsGameProgressResponse>({
        path: GAME_PROGRESS_PATH,
        query: {
          ...toAuthQuery(config),
          a: 1,
          g: gameId,
        },
      });
    },
  };
}
