import type { CacheStore } from "./cache";
import type {
  GameDetailSnapshot,
  NormalizedGame,
  NormalizedProfile,
  ProviderCapabilities,
  ProviderId,
  RelatedGameSummary,
  RecentlyPlayedGame,
  RecentUnlock,
} from "./domain";
import type { PlatformServices } from "./platform";

export interface AchievementProvider<Config = unknown> {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;
  loadProfile(config: Config): Promise<NormalizedProfile>;
  loadCompletionProgress?(
    config: Config,
  ): Promise<readonly NormalizedGame[]>;
  loadAchievementsEarnedBetween?(
    config: Config,
    options: {
      readonly fromEpochSeconds: number;
      readonly toEpochSeconds: number;
      readonly limit?: number;
    },
  ): Promise<readonly RecentUnlock[]>;
  loadRecentUnlocks(
    config: Config,
    options?: {
      readonly limit?: number;
    },
  ): Promise<readonly RecentUnlock[]>;
  loadRecentlyPlayedGames(
    config: Config,
    options?: {
      readonly count?: number;
      readonly offset?: number;
    },
  ): Promise<readonly RecentlyPlayedGame[]>;
  loadGameProgress(config: Config, gameId: string): Promise<GameDetailSnapshot>;
  loadRelatedGames?(
    config: Config,
    game: NormalizedGame,
  ): Promise<readonly RelatedGameSummary[]>;
}

export interface ProviderRegistry {
  get(providerId: ProviderId): AchievementProvider | undefined;
  list(): readonly AchievementProvider[];
}

export interface AppBootstrapDependencies {
  readonly platform: PlatformServices;
  readonly providerRegistry: ProviderRegistry;
  readonly cacheStore: CacheStore;
}
