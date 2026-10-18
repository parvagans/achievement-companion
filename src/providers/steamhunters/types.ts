export type SteamHuntersObtainability =
  | "obtainable"
  | "broken-but-obtainable"
  | "conditionally-obtainable"
  | "unobtainable"
  | "unknown";

export interface SteamHuntersTag {
  readonly id?: number;
  readonly name: string;
}

export interface SteamHuntersApp {
  readonly appId: number;
  readonly name?: string;
  readonly achievementCount?: number;
  readonly playersPerfectedCount?: number;
  readonly playersCompletedCount?: number;
  readonly playersBaseGameCompletedCount?: number;
  readonly playersStartedCount?: number;
  readonly playersQualifiedCount?: number;
  readonly playerCount?: number;
  readonly userCount?: number;
  readonly unobtainableAchievementCount?: number;
  readonly points?: number;
  readonly fastestCompletionTime?: number;
  readonly medianCompletionTime?: number;
  readonly releaseDate?: string;
  readonly hasPaidDlc?: boolean;
  readonly tags: readonly SteamHuntersTag[];
}

export interface SteamHuntersAchievement {
  readonly achievementId?: number;
  /** Steam's stable schema/API achievement identifier. */
  readonly apiName: string;
  readonly name?: string;
  readonly description?: string;
  readonly steamPercentage?: number;
  readonly localPercentage?: number;
  readonly points?: number;
  readonly steamPoints?: number;
  readonly obtainability: SteamHuntersObtainability;
}

export interface SteamHuntersAchievementGroup {
  /** Steam achievement API names assigned to this group by SteamHunters. */
  readonly achievementApiNames: readonly string[];
  readonly bannerUrl?: string;
  readonly dlcAppId?: number;
  readonly dlcAppName?: string;
  readonly name?: string;
  readonly releaseDate?: string;
}

export interface SteamHuntersGameData {
  readonly app: SteamHuntersApp;
  readonly achievements: readonly SteamHuntersAchievement[];
  readonly groups: readonly SteamHuntersAchievementGroup[];
  /** Distinguish a failed optional endpoint from a valid empty result. */
  readonly achievementsAvailable?: boolean;
  readonly groupsAvailable?: boolean;
}

/**
 * Profile totals as reported by SteamHunters, deliberately separate from the
 * Steam library scan.
 */
export interface SteamHuntersProfile {
  /** The SteamID64 used for this lookup; never trust the remote numeric echo. */
  readonly steamId: string;
  /** Global position in SteamHunters' points leaderboard, when supplied. */
  readonly globalPointsRank?: number;
  /** Global position in SteamHunters' achievement-unlocks leaderboard. */
  readonly globalAchievementsRank?: number;
  /** Global position in SteamHunters' completed-games leaderboard. */
  readonly globalCompletedGamesRank?: number;
  /** Change in the corresponding global rank since the prior SteamHunters snapshot. */
  readonly globalPointsRankTrend?: SteamHuntersRankTrend;
  readonly globalAchievementsRankTrend?: SteamHuntersRankTrend;
  readonly globalCompletedGamesRankTrend?: SteamHuntersRankTrend;
  readonly points?: number;
  readonly unrestrictedPoints?: number;
  /** SteamHunters' Average Game Completion percentage. */
  readonly averageGameCompletion?: number;
  /** SteamHunters' Average Game Completion excluding unobtainable achievements. */
  readonly obtainableAverageGameCompletion?: number;
  readonly startedGames?: number;
  readonly trackedGames?: number;
  readonly perfectedGames?: number;
  readonly completedGames?: number;
  readonly achievements?: number;
  readonly epicAchievements?: number;
  readonly legendaryAchievements?: number;
}

export type SteamHuntersRankTrend = "up" | "down" | "unchanged";
