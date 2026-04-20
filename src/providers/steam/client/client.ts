import type { SteamProviderConfig } from "../config";
import type {
  RawSteamGetGlobalAchievementPercentagesForAppResponse,
  RawSteamGetBadgesResponse,
  RawSteamGetOwnedGamesResponse,
  RawSteamGetPlayerAchievementsResponse,
  RawSteamGetPlayerSummariesResponse,
  RawSteamGetSteamLevelResponse,
  RawSteamGetRecentlyPlayedGamesResponse,
  RawSteamSchemaForGameResponse,
  RawSteamPlayerAchievement,
  RawSteamPlayerSummary,
  RawSteamOwnedGame,
  RawSteamRecentlyPlayedGame,
  RawSteamSchemaAchievement,
} from "../raw-types";
import type { SteamTransport } from "./transport";
import type { SteamTransportHandledHttpErrorResponse } from "./transport";

export interface SteamClient {
  loadPlayerSummaries(config: SteamProviderConfig): Promise<RawSteamGetPlayerSummariesResponse>;
  loadSteamLevel(config: SteamProviderConfig): Promise<RawSteamGetSteamLevelResponse>;
  loadBadges(config: SteamProviderConfig): Promise<RawSteamGetBadgesResponse>;
  loadOwnedGames(config: SteamProviderConfig): Promise<RawSteamGetOwnedGamesResponse>;
  loadRecentlyPlayedGames(config: SteamProviderConfig): Promise<RawSteamGetRecentlyPlayedGamesResponse>;
  loadPlayerAchievements(
    config: SteamProviderConfig,
    appId: number,
  ): Promise<RawSteamGetPlayerAchievementsResponse>;
  loadPlayerAchievementsWithHandledHttpStatuses?: (
    config: SteamProviderConfig,
    appId: number,
    handledHttpStatuses: readonly number[],
  ) => Promise<RawSteamGetPlayerAchievementsResponse | SteamTransportHandledHttpErrorResponse>;
  loadSchemaForGame(config: SteamProviderConfig, appId: number): Promise<RawSteamSchemaForGameResponse>;
  loadGlobalAchievementPercentagesForApp(
    appId: number,
  ): Promise<RawSteamGetGlobalAchievementPercentagesForAppResponse>;
}

const PLAYER_SUMMARIES_PATH = "ISteamUser/GetPlayerSummaries/v2/";
const STEAM_LEVEL_PATH = "IPlayerService/GetSteamLevel/v1/";
const BADGES_PATH = "IPlayerService/GetBadges/v1/";
const OWNED_GAMES_PATH = "IPlayerService/GetOwnedGames/v1/";
const RECENTLY_PLAYED_GAMES_PATH = "IPlayerService/GetRecentlyPlayedGames/v1/";
const PLAYER_ACHIEVEMENTS_PATH = "ISteamUserStats/GetPlayerAchievements/v1/";
const SCHEMA_FOR_GAME_PATH = "ISteamUserStats/GetSchemaForGame/v2/";
const GLOBAL_ACHIEVEMENT_PERCENTAGES_PATH = "ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/";

function toAuthQuery(config: SteamProviderConfig): Record<string, string | number | undefined> {
  return {
    steamid: config.steamId64,
  };
}

function coerceAppId(appId: number): number {
  if (!Number.isFinite(appId) || appId <= 0) {
    throw new SyntaxError("Steam app ID must be a positive number.");
  }

  return Math.trunc(appId);
}

function ensureSuccessMessage(error: string | undefined, fallback: string): string {
  return error !== undefined && error.trim().length > 0 ? error : fallback;
}

function readSteamAchievementsResponse(
  response: RawSteamGetPlayerAchievementsResponse,
): ReadonlyArray<RawSteamPlayerAchievement> {
  const playerStats = response.playerstats;
  if (playerStats === undefined || playerStats.success === false) {
    throw new Error(
      ensureSuccessMessage(playerStats?.error, "Steam player achievements request was not successful."),
    );
  }

  return playerStats.achievements ?? [];
}

function readSteamSchemaResponse(
  response: RawSteamSchemaForGameResponse,
): ReadonlyArray<RawSteamSchemaAchievement> {
  const achievements = response.game?.availableGameStats?.achievements;
  if (achievements === undefined) {
    return [];
  }

  return achievements;
}

function readSteamPlayerSummariesResponse(
  response: RawSteamGetPlayerSummariesResponse,
): ReadonlyArray<RawSteamPlayerSummary> {
  return response.response?.players ?? [];
}

function readSteamRecentlyPlayedGamesResponse(
  response: RawSteamGetRecentlyPlayedGamesResponse,
): ReadonlyArray<RawSteamRecentlyPlayedGame> {
  return response.response?.games ?? [];
}

export function createSteamClient(transport: SteamTransport): SteamClient {
  return {
    async loadPlayerSummaries(config) {
      return transport.requestJson<RawSteamGetPlayerSummariesResponse>({
        path: PLAYER_SUMMARIES_PATH,
        query: {
          ...toAuthQuery(config),
          steamids: config.steamId64,
          format: "json",
        },
      });
    },

    async loadSteamLevel(config) {
      return transport.requestJson<RawSteamGetSteamLevelResponse>({
        path: STEAM_LEVEL_PATH,
        query: {
          ...toAuthQuery(config),
          format: "json",
        },
      });
    },

    async loadBadges(config) {
      return transport.requestJson<RawSteamGetBadgesResponse>({
        path: BADGES_PATH,
        query: {
          ...toAuthQuery(config),
          format: "json",
        },
      });
    },

    async loadOwnedGames(config) {
      return transport.requestJson<RawSteamGetOwnedGamesResponse>({
        path: OWNED_GAMES_PATH,
        query: {
          ...toAuthQuery(config),
          include_appinfo: true,
          include_played_free_games: config.includePlayedFreeGames,
          format: "json",
        },
      });
    },

    async loadRecentlyPlayedGames(config) {
      return transport.requestJson<RawSteamGetRecentlyPlayedGamesResponse>({
        path: RECENTLY_PLAYED_GAMES_PATH,
        query: {
          ...toAuthQuery(config),
          count: config.recentlyPlayedCount,
          format: "json",
        },
      });
    },

    async loadPlayerAchievements(config, appId) {
      const normalizedAppId = coerceAppId(appId);
      return transport.requestJson<RawSteamGetPlayerAchievementsResponse>({
        path: PLAYER_ACHIEVEMENTS_PATH,
        query: {
          ...toAuthQuery(config),
          appid: normalizedAppId,
          l: config.language,
          format: "json",
        },
      });
    },

    async loadPlayerAchievementsWithHandledHttpStatuses(config, appId, handledHttpStatuses) {
      const normalizedAppId = coerceAppId(appId);
      return transport.requestJson<
        RawSteamGetPlayerAchievementsResponse | SteamTransportHandledHttpErrorResponse
      >({
        path: PLAYER_ACHIEVEMENTS_PATH,
        query: {
          ...toAuthQuery(config),
          appid: normalizedAppId,
          l: config.language,
          format: "json",
        },
        handledHttpStatuses,
      });
    },

    async loadSchemaForGame(config, appId) {
      const normalizedAppId = coerceAppId(appId);
      return transport.requestJson<RawSteamSchemaForGameResponse>({
        path: SCHEMA_FOR_GAME_PATH,
        query: {
          ...toAuthQuery(config),
          appid: normalizedAppId,
          l: config.language,
          format: "json",
        },
      });
    },

    async loadGlobalAchievementPercentagesForApp(appId) {
      const normalizedAppId = coerceAppId(appId);
      return transport.requestJson<RawSteamGetGlobalAchievementPercentagesForAppResponse>({
        path: GLOBAL_ACHIEVEMENT_PERCENTAGES_PATH,
        query: {
          gameid: normalizedAppId,
          format: "json",
        },
      });
    },
  };
}
