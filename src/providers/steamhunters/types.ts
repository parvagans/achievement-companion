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

export interface SteamHuntersGameData {
  readonly app: SteamHuntersApp;
  readonly achievements: readonly SteamHuntersAchievement[];
}
