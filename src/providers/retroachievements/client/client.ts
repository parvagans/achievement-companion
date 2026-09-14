import type { RetroAchievementsProviderConfig } from "../config";
import type {
  RawRetroAchievementsCompletionProgressEntry,
  RawRetroAchievementsCompletionProgressResponse,
  RawRetroAchievementsGameListEntry,
  RawRetroAchievementsGameProgressResponse,
  RawRetroAchievementsAchievementDistributionResponse,
  RawRetroAchievementsGameProgressionResponse,
  RawRetroAchievementsProfileResponse,
  RawRetroAchievementsSummaryResponse,
  RawRetroAchievementsRecentUnlockResponse,
  RawRetroAchievementsRecentlyPlayedGameResponse,
  RawRetroAchievementsSystemResponse,
  
} from "../raw-types";
import type { RetroAchievementsTransport } from "./transport";

export interface RetroAchievementsClient {
  loadSystems?(
    config: RetroAchievementsProviderConfig,
  ): Promise<readonly RawRetroAchievementsSystemResponse[]>;
  loadGameList?(
    config: RetroAchievementsProviderConfig,
    consoleId: string,
  ): Promise<readonly RawRetroAchievementsGameListEntry[]>;
  loadProfile(config: RetroAchievementsProviderConfig): Promise<RawRetroAchievementsProfileResponse>;
  loadSummary?(
    config: RetroAchievementsProviderConfig,
  ): Promise<RawRetroAchievementsSummaryResponse>;
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
  loadAchievementDistribution?(
    config: RetroAchievementsProviderConfig,
    gameId: string,
  ): Promise<RawRetroAchievementsAchievementDistributionResponse>;
  loadGameProgression?(
    config: RetroAchievementsProviderConfig,
    gameId: string,
  ): Promise<RawRetroAchievementsGameProgressionResponse>;
}

const PROFILE_PATH = "API_GetUserProfile.php";
const SUMMARY_PATH = "API_GetUserSummary.php";
const SYSTEMS_PATH = "API_GetConsoleIDs.php";
const GAME_LIST_PATH = "API_GetGameList.php";
const COMPLETION_PROGRESS_PATH = "API_GetUserCompletionProgress.php";
const ACHIEVEMENTS_EARNED_BETWEEN_PATH = "API_GetAchievementsEarnedBetween.php";
const RECENT_UNLOCKS_PATH = "API_GetUserRecentAchievements.php";
const RECENTLY_PLAYED_GAMES_PATH = "API_GetUserRecentlyPlayedGames.php";
const GAME_PROGRESS_PATH = "API_GetGameInfoAndUserProgress.php";
const ACHIEVEMENT_DISTRIBUTION_PATH = "API_GetAchievementDistribution.php";
const GAME_PROGRESSION_PATH = "API_GetGameProgression.php";
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
    async loadSystems(config) {
      return transport.requestJson<readonly RawRetroAchievementsSystemResponse[]>({
        path: SYSTEMS_PATH,
        query: toAuthQuery(config),
      });
    },

    async loadGameList(config, consoleId) {
      return transport.requestJson<readonly RawRetroAchievementsGameListEntry[]>({
        path: GAME_LIST_PATH,
        query: {
          ...toAuthQuery(config),
          i: consoleId,
          f: 1,
          h: 1,
        },
      });
    },

    async loadProfile(config) {
      return transport.requestJson<RawRetroAchievementsProfileResponse>({
        path: PROFILE_PATH,
        query: toAuthQuery(config),
      });
    },
    async loadSummary(config) {
      // g: 0, a: 0 — we only need RichPresenceMsgDate, not recent games/achievements,
      // to keep this call as light as the (documented-slow) endpoint allows.
      return transport.requestJson<RawRetroAchievementsSummaryResponse>({
        path: SUMMARY_PATH,
        query: {
          ...toAuthQuery(config),
          g: 0,
          a: 0,
        },
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

    async loadAchievementDistribution(config, gameId) {
      return transport.requestJson<RawRetroAchievementsAchievementDistributionResponse>({
        path: ACHIEVEMENT_DISTRIBUTION_PATH,
        query: { ...toAuthQuery(config), i: gameId, h: 1, f: 3 },
      });
    },

    async loadGameProgression(config, gameId) {
      return transport.requestJson<RawRetroAchievementsGameProgressionResponse>({
        path: GAME_PROGRESSION_PATH,
        query: { ...toAuthQuery(config), i: gameId, h: 1 },
      });
    },
  };
}
