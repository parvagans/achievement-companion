export type ProviderId = string;
export type ProviderAccountId = string;
export type UnixEpochMs = number;

export type GameProgressStatus = "locked" | "in_progress" | "completed" | "beaten" | "mastered";

export interface ProviderIdentity {
  readonly providerId: ProviderId;
  readonly accountId: ProviderAccountId;
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly profileUrl?: string;
}

export interface ProviderCapabilities {
  readonly requiresCredentials: boolean;
  readonly profileSummary: boolean;
  readonly completionProgress: boolean;
  readonly recentUnlocks: boolean;
  readonly gameProgress: boolean;
  readonly rarityStats: boolean;
  readonly search: boolean;
}

export interface NormalizedMetric {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
}

export interface ProgressSummary {
  readonly unlockedCount: number;
  readonly totalCount?: number;
  readonly completionPercent?: number;
}

export interface NormalizedProfile {
  readonly providerId: ProviderId;
  readonly identity: ProviderIdentity;
  readonly summary: ProgressSummary;
  readonly metrics: readonly NormalizedMetric[];
  readonly motto?: string;
  readonly featuredGames?: readonly NormalizedGame[];
  readonly refreshedAt?: UnixEpochMs;
}

export interface NormalizedGame {
  readonly providerId: ProviderId;
  readonly gameId: string;
  readonly title: string;
  readonly platformLabel?: string;
  readonly coverImageUrl?: string;
  readonly boxArtImageUrl?: string;
  readonly parentGameId?: string;
  readonly status: GameProgressStatus;
  readonly summary: ProgressSummary;
  readonly metrics: readonly NormalizedMetric[];
  readonly lastUnlockAt?: UnixEpochMs;
}

export interface RecentlyPlayedGame {
  readonly providerId: ProviderId;
  readonly gameId: string;
  readonly title: string;
  readonly platformLabel?: string;
  readonly coverImageUrl?: string;
  readonly summary: ProgressSummary;
  readonly lastPlayedAt?: UnixEpochMs;
}

export interface CompletionProgressSummary {
  readonly playedCount: number;
  readonly unfinishedCount: number;
  readonly beatenCount: number;
  readonly masteredCount: number;
}

export interface CompletionProgressSnapshot {
  readonly providerId: ProviderId;
  readonly summary: CompletionProgressSummary;
  readonly games: readonly NormalizedGame[];
  readonly refreshedAt?: UnixEpochMs;
}

export interface AchievementHistorySummary {
  readonly unlockedCount: number;
  readonly newestUnlockedAt?: UnixEpochMs;
  readonly oldestUnlockedAt?: UnixEpochMs;
}

export interface AchievementHistorySnapshot {
  readonly providerId: ProviderId;
  readonly profile: NormalizedProfile;
  readonly entries: readonly RecentUnlock[];
  readonly summary: AchievementHistorySummary;
  readonly sourceLabel: string;
  readonly refreshedAt?: UnixEpochMs;
}

export interface NormalizedAchievement {
  readonly providerId: ProviderId;
  readonly achievementId: string;
  readonly gameId: string;
  readonly title: string;
  readonly description?: string;
  readonly badgeImageUrl?: string;
  readonly isUnlocked: boolean;
  readonly unlockedAt?: UnixEpochMs;
  readonly points?: number;
  readonly metrics: readonly NormalizedMetric[];
}

export interface RecentUnlock {
  readonly achievement: NormalizedAchievement;
  readonly game: Pick<NormalizedGame, "providerId" | "gameId" | "title" | "coverImageUrl" | "platformLabel">;
  readonly unlockedAt?: UnixEpochMs;
}

export interface GameDetailSnapshot {
  readonly game: NormalizedGame;
  readonly achievements: readonly NormalizedAchievement[];
  readonly refreshedAt?: UnixEpochMs;
}

export interface DashboardSnapshot {
  readonly profile: NormalizedProfile;
  readonly recentAchievements: readonly RecentUnlock[];
  readonly recentlyPlayedGames: readonly RecentlyPlayedGame[];
  readonly recentUnlocks: readonly RecentUnlock[];
  readonly featuredGames: readonly NormalizedGame[];
  readonly refreshedAt?: UnixEpochMs;
}
