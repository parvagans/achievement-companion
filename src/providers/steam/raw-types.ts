export interface RawSteamPlayerSummary {
  readonly steamid?: string;
  readonly personaname?: string;
  readonly profileurl?: string;
  readonly avatar?: string;
  readonly avatarmedium?: string;
  readonly avatarfull?: string;
  readonly communityvisibilitystate?: number;
  readonly profilestate?: number;
  readonly lastlogoff?: number;
  readonly timecreated?: number;
  readonly loccountrycode?: string;
}

export interface RawSteamGetPlayerSummariesResponse {
  readonly response?: {
    readonly players?: readonly RawSteamPlayerSummary[];
  };
}

export interface RawSteamGetSteamLevelResponse {
  readonly response?: {
    readonly player_level?: number;
  };
}

export interface RawSteamBadge {
  readonly badgeid?: number;
  readonly badge_id?: number;
  readonly appid?: number;
  readonly level?: number;
  readonly completion_time?: number;
  readonly xp?: number;
  readonly scarcity?: number;
  readonly border_color?: number;
}

export interface RawSteamGetBadgesResponse {
  readonly response?: {
    readonly badges?: readonly RawSteamBadge[];
    readonly player_xp?: number;
    readonly player_level?: number;
    readonly player_xp_needed_to_level_up?: number;
    readonly player_xp_needed_current_level?: number;
  };
}

export interface RawSteamRecentlyPlayedGame {
  readonly appid?: number;
  readonly name?: string;
  readonly playtime_2weeks?: number;
  readonly playtime_forever?: number;
  readonly playtime_deck_forever?: number;
  readonly rtime_last_played?: number;
  readonly img_icon_url?: string;
  readonly img_logo_url?: string;
  readonly has_community_visible_stats?: boolean;
}

export interface RawSteamGetRecentlyPlayedGamesResponse {
  readonly response?: {
    readonly total_count?: number;
    readonly games?: readonly RawSteamRecentlyPlayedGame[];
  };
}

export interface RawSteamOwnedGame {
  readonly appid?: number;
  readonly name?: string;
  readonly playtime_forever?: number;
  readonly playtime_2weeks?: number;
  readonly playtime_deck_forever?: number;
  readonly rtime_last_played?: number;
  readonly img_icon_url?: string;
  readonly has_community_visible_stats?: boolean;
}

export interface RawSteamGetOwnedGamesResponse {
  readonly response?: {
    readonly game_count?: number;
    readonly games?: readonly RawSteamOwnedGame[];
  };
}

export interface RawSteamPlayerAchievement {
  readonly apiname?: string;
  readonly achieved?: number;
  readonly unlocktime?: number;
  readonly name?: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly icon?: string;
  readonly icongray?: string;
}

export interface RawSteamGetPlayerAchievementsResponse {
  readonly playerstats?: {
    readonly steamID?: string;
    readonly gameName?: string;
    readonly achievements?: readonly RawSteamPlayerAchievement[];
    readonly success?: boolean;
    readonly error?: string;
  };
}

export interface RawSteamSchemaAchievement {
  readonly name?: string;
  readonly defaultvalue?: number | string;
  readonly displayName?: string;
  readonly hidden?: number;
  readonly description?: string;
  readonly icon?: string;
  readonly icongray?: string;
}

export interface RawSteamSchemaForGameResponse {
  readonly game?: {
    readonly gameName?: string;
    readonly gameVersion?: string;
    readonly availableGameStats?: {
      readonly achievements?: readonly RawSteamSchemaAchievement[];
    };
  };
}

export interface RawSteamGlobalAchievementPercentage {
  readonly name?: string;
  readonly percent?: number;
}

export interface RawSteamGetGlobalAchievementPercentagesForAppResponse {
  readonly achievementpercentages?: {
    readonly achievements?: readonly RawSteamGlobalAchievementPercentage[];
  };
}
