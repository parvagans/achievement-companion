// Assumptions below are intentionally narrow.
// They describe only the shape needed to build the provider-local mapping layer.

export interface RawRetroAchievementsMetric {
  readonly key?: string;
  readonly label?: string;
  readonly value?: string | number;
  readonly detail?: string;
}

// Assumption: the Profile endpoint only supplies identity/basic account metadata.
export interface RawRetroAchievementsProfileResponse {
  readonly User?: string;
  readonly user?: string;
  readonly ULID?: string;
  readonly ulid?: string;
  readonly UserPic?: string;
  readonly userPic?: string;
  readonly MemberSince?: string;
  readonly memberSince?: string;
  readonly RichPresenceMsg?: string;
  readonly richPresenceMsg?: string;
  readonly LastGameID?: number | string;
  readonly lastGameId?: number | string;
  readonly ContribCount?: number | string;
  readonly contribCount?: number | string;
  readonly ContribYield?: number | string;
  readonly contribYield?: number | string;
  readonly TotalPoints?: number | string;
  readonly totalPoints?: number | string;
  readonly TotalSoftcorePoints?: number | string;
  readonly totalSoftcorePoints?: number | string;
  readonly TotalTruePoints?: number | string;
  readonly totalTruePoints?: number | string;
  readonly Permissions?: number | string;
  readonly permissions?: number | string;
  readonly Untracked?: number | boolean | string;
  readonly untracked?: number | boolean | string;
  readonly ID?: number | string;
  readonly id?: number | string;
  readonly UserWallActive?: number | boolean | string;
  readonly userWallActive?: number | boolean | string;
  readonly Motto?: string;
  readonly motto?: string;
}

// Assumption: completion progress returns one entry per game with completion counts for that game.
export interface RawRetroAchievementsCompletionProgressEntry {
  readonly GameID?: number | string;
  readonly gameId?: number | string;
  readonly Title?: string;
  readonly title?: string;
  readonly ImageIcon?: string;
  readonly imageIcon?: string;
  readonly ConsoleID?: number | string;
  readonly consoleId?: number | string;
  readonly ConsoleName?: string;
  readonly consoleName?: string;
  readonly MaxPossible?: number | string;
  readonly maxPossible?: number | string;
  readonly NumAwarded?: number | string;
  readonly numAwarded?: number | string;
  readonly NumAwardedHardcore?: number | string;
  readonly numAwardedHardcore?: number | string;
  readonly MostRecentAwardedDate?: string;
  readonly mostRecentAwardedDate?: string;
  readonly HighestAwardKind?: string;
  readonly highestAwardKind?: string;
  readonly HighestAwardDate?: string;
  readonly highestAwardDate?: string;
  readonly ParentGameID?: number | string | null;
  readonly parentGameId?: number | string | null;
}

// Assumption: the response is paginated and returns a total count plus a page of results.
export interface RawRetroAchievementsCompletionProgressResponse {
  readonly Count?: number | string;
  readonly count?: number | string;
  readonly Total?: number | string;
  readonly total?: number | string;
  readonly Results?: readonly RawRetroAchievementsCompletionProgressEntry[];
  readonly results?: readonly RawRetroAchievementsCompletionProgressEntry[];
}

// Assumption: recent unlock payloads expose the unlock timestamp plus the game and achievement identity.
export interface RawRetroAchievementsRecentUnlockResponse {
  readonly Date?: string;
  readonly date?: string;
  readonly HardcoreMode?: number | boolean | string;
  readonly hardcoreMode?: number | boolean | string;
  readonly AchievementID?: number | string;
  readonly achievementId?: number | string;
  readonly Title?: string;
  readonly title?: string;
  readonly Description?: string;
  readonly description?: string;
  readonly BadgeName?: string;
  readonly badgeName?: string;
  readonly Points?: number | string;
  readonly points?: number | string;
  readonly TrueRatio?: number | string;
  readonly trueRatio?: number | string;
  readonly Type?: string | null;
  readonly type?: string | null;
  readonly Author?: string;
  readonly author?: string;
  readonly AuthorULID?: string;
  readonly authorUlid?: string;
  readonly GameTitle?: string;
  readonly gameTitle?: string;
  readonly GameIcon?: string;
  readonly gameIcon?: string;
  readonly GameID?: number | string;
  readonly gameId?: number | string;
  readonly ConsoleName?: string;
  readonly consoleName?: string;
  readonly BadgeURL?: string;
  readonly badgeUrl?: string;
  readonly GameURL?: string;
  readonly gameUrl?: string;
}

// Assumption: recently played games return one record per game with last-played and per-game progress counts.
export interface RawRetroAchievementsRecentlyPlayedGameResponse {
  readonly GameID?: number | string;
  readonly gameId?: number | string;
  readonly ConsoleID?: number | string;
  readonly consoleId?: number | string;
  readonly ConsoleName?: string;
  readonly consoleName?: string;
  readonly Title?: string;
  readonly title?: string;
  readonly ImageIcon?: string;
  readonly imageIcon?: string;
  readonly ImageTitle?: string;
  readonly imageTitle?: string;
  readonly ImageIngame?: string;
  readonly imageIngame?: string;
  readonly ImageBoxArt?: string;
  readonly imageBoxArt?: string;
  readonly LastPlayed?: string;
  readonly lastPlayed?: string;
  readonly AchievementsTotal?: number | string;
  readonly achievementsTotal?: number | string;
  readonly NumPossibleAchievements?: number | string;
  readonly numPossibleAchievements?: number | string;
  readonly PossibleScore?: number | string;
  readonly possibleScore?: number | string;
  readonly NumAchieved?: number | string;
  readonly numAchieved?: number | string;
  readonly ScoreAchieved?: number | string;
  readonly scoreAchieved?: number | string;
  readonly NumAchievedHardcore?: number | string;
  readonly numAchievedHardcore?: number | string;
  readonly ScoreAchievedHardcore?: number | string;
  readonly scoreAchievedHardcore?: number | string;
}

export interface RawRetroAchievementsGameProgressAchievement {
  readonly ID?: number | string;
  readonly id?: number | string;
  readonly NumAwarded?: number | string;
  readonly numAwarded?: number | string;
  readonly NumAwardedHardcore?: number | string;
  readonly numAwardedHardcore?: number | string;
  readonly Title?: string;
  readonly title?: string;
  readonly Description?: string;
  readonly description?: string;
  readonly Points?: number | string;
  readonly points?: number | string;
  readonly TrueRatio?: number | string;
  readonly trueRatio?: number | string;
  readonly Author?: string;
  readonly author?: string;
  readonly AuthorULID?: string;
  readonly authorUlid?: string;
  readonly DateModified?: string;
  readonly dateModified?: string;
  readonly DateCreated?: string;
  readonly dateCreated?: string;
  readonly BadgeName?: string;
  readonly badgeName?: string;
  readonly DisplayOrder?: number | string;
  readonly displayOrder?: number | string;
  readonly MemAddr?: string;
  readonly memAddr?: string;
  readonly Type?: string;
  readonly type?: string;
  readonly DateEarned?: string;
  readonly dateEarned?: string;
  readonly DateEarnedHardcore?: string;
  readonly dateEarnedHardcore?: string;
}

export type RawRetroAchievementsGameProgressAchievementCollection =
  | readonly RawRetroAchievementsGameProgressAchievement[]
  | Readonly<Record<string, RawRetroAchievementsGameProgressAchievement>>;

// Assumption: the documented game-progress endpoint returns a full game record, with the per-user
// progress fields at top level and achievements provided as a keyed object or list.
export interface RawRetroAchievementsGameProgressResponse {
  readonly ID?: number | string;
  readonly id?: number | string;
  readonly Title?: string;
  readonly title?: string;
  readonly ConsoleID?: number | string;
  readonly consoleId?: number | string;
  readonly ForumTopicID?: number | string;
  readonly forumTopicId?: number | string;
  readonly Flags?: number | string | null;
  readonly flags?: number | string | null;
  readonly ImageIcon?: string;
  readonly imageIcon?: string;
  readonly ImageTitle?: string;
  readonly imageTitle?: string;
  readonly ImageIngame?: string;
  readonly imageIngame?: string;
  readonly ImageBoxArt?: string;
  readonly imageBoxArt?: string;
  readonly Publisher?: string;
  readonly publisher?: string;
  readonly Developer?: string;
  readonly developer?: string;
  readonly Genre?: string;
  readonly genre?: string;
  readonly Released?: string;
  readonly released?: string;
  readonly ReleasedAtGranularity?: string;
  readonly releasedAtGranularity?: string;
  readonly IsFinal?: boolean;
  readonly isFinal?: boolean;
  readonly RichPresencePatch?: string;
  readonly richPresencePatch?: string;
  readonly GuideURL?: string | null;
  readonly guideUrl?: string | null;
  readonly ConsoleName?: string;
  readonly consoleName?: string;
  readonly ParentGameID?: number | string | null;
  readonly parentGameId?: number | string | null;
  readonly NumDistinctPlayers?: number | string;
  readonly numDistinctPlayers?: number | string;
  readonly NumAchievements?: number | string;
  readonly numAchievements?: number | string;
  readonly Achievements?: RawRetroAchievementsGameProgressAchievementCollection;
  readonly achievements?: RawRetroAchievementsGameProgressAchievementCollection;
  readonly NumAwardedToUser?: number | string;
  readonly numAwardedToUser?: number | string;
  readonly NumAwardedToUserHardcore?: number | string;
  readonly numAwardedToUserHardcore?: number | string;
  readonly NumDistinctPlayersCasual?: number | string;
  readonly numDistinctPlayersCasual?: number | string;
  readonly NumDistinctPlayersHardcore?: number | string;
  readonly numDistinctPlayersHardcore?: number | string;
  readonly UserCompletion?: string;
  readonly userCompletion?: string;
  readonly UserCompletionHardcore?: string;
  readonly userCompletionHardcore?: string;
  readonly UserTotalPlaytime?: number | string;
  readonly userTotalPlaytime?: number | string;
  readonly HighestAwardKind?: string;
  readonly highestAwardKind?: string;
  readonly HighestAwardDate?: string;
  readonly highestAwardDate?: string;
}
