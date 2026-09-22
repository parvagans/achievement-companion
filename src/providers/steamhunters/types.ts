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
}

/**
 * Profile totals as reported by SteamHunters, deliberately separate from the
 * Steam library scan. SteamHunters' public profile payload does not expose a
 * global leaderboard rank.
 */
export interface SteamHuntersProfile {
  /** The SteamID64 used for this lookup; never trust the remote numeric echo. */
  readonly steamId: string;
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
  readonly legendaryAchievements?: number;
}
