/**
 * Deliberately loose representations of the public SteamHunters JSON payloads.
 * Every field remains unknown until normalize.ts validates it.
 */
export interface RawSteamHuntersTag {
  readonly tagId?: unknown;
  readonly name?: unknown;
}

export interface RawSteamHuntersAppResponse {
  readonly appId?: unknown;
  readonly name?: unknown;
  readonly type?: unknown;
  readonly typeString?: unknown;
  readonly steamDbRating?: unknown;
  readonly playersPerfectedCount?: unknown;
  readonly playersCompletedCount?: unknown;
  readonly playersBaseGameCompletedCount?: unknown;
  readonly playersStartedCount?: unknown;
  readonly playersQualifiedCount?: unknown;
  readonly playerCount?: unknown;
  readonly userCount?: unknown;
  readonly achievementCount?: unknown;
  readonly unobtainableAchievementCount?: unknown;
  readonly points?: unknown;
  readonly unrestrictedPoints?: unknown;
  readonly agc?: unknown;
  readonly agcObtainable?: unknown;
  readonly startedGameCount?: unknown;
  readonly fastestCompletionTime?: unknown;
  readonly medianCompletionTime?: unknown;
  readonly releaseDate?: unknown;
  readonly hasPaidDlc?: unknown;
  readonly tags?: unknown;
}

export interface RawSteamHuntersAchievementResponse {
  readonly achievementId?: unknown;
  readonly apiName?: unknown;
  readonly name?: unknown;
  readonly description?: unknown;
  readonly steamPercentage?: unknown;
  readonly localPercentage?: unknown;
  readonly points?: unknown;
  readonly steamPoints?: unknown;
  readonly obtainability?: unknown;
}

export interface RawSteamHuntersAchievementGroupResponse {
  readonly achievementApiNames?: unknown;
  readonly bannerUrl?: unknown;
  readonly dlcAppId?: unknown;
  readonly dlcAppName?: unknown;
  readonly name?: unknown;
  readonly releaseDate?: unknown;
}

export interface RawSteamHuntersAchievementGroupsResponse {
  readonly groups?: unknown;
}

/** Public profile payload returned by /api/steam-users/{steamId}. */
export interface RawSteamHuntersProfileResponse {
  /** Global position in SteamHunters' points leaderboard, when supplied. */
  readonly globalPointsRank?: unknown;
  /** Legacy alias used by some SteamHunters profile responses. */
  readonly pointsRank?: unknown;
  /** Global position in SteamHunters' achievement-unlocks leaderboard. */
  readonly achievementUnlockCountRank?: unknown;
  /** Global position in SteamHunters' completed-games leaderboard. */
  readonly completedGameCountRank?: unknown;
  readonly previousPointsRank?: unknown;
  readonly previousAchievementUnlockCountRank?: unknown;
  readonly previousCompletedGameCountRank?: unknown;
  readonly points?: unknown;
  readonly unrestrictedPoints?: unknown;
  readonly agc?: unknown;
  readonly agcObtainable?: unknown;
  readonly startedGameCount?: unknown;
  readonly appCount?: unknown;
  readonly perfectGameCount?: unknown;
  readonly completedGameCount?: unknown;
  readonly achievementUnlockCount?: unknown;
  readonly epicAchievementUnlockCount?: unknown;
  /** Alternate field names returned by SteamHunters public profile responses. */
  readonly epicAchievementCount?: unknown;
  readonly epicCount?: unknown;
  readonly legendaryAchievementUnlockCount?: unknown;
}
