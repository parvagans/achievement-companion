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
