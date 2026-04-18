import type { ResourceState } from "./cache";
import type {
  AchievementHistorySnapshot,
  CompletionProgressSnapshot,
  DashboardSnapshot,
  GameDetailSnapshot,
  ProviderId,
} from "./domain";

export interface LoadRequestOptions {
  readonly forceRefresh?: boolean;
}

export interface DashboardService {
  loadDashboard(
    providerId: ProviderId,
    options?: LoadRequestOptions,
  ): Promise<ResourceState<DashboardSnapshot>>;
}

export interface GameDetailService {
  loadGameDetail(
    providerId: ProviderId,
    gameId: string,
    options?: LoadRequestOptions,
  ): Promise<ResourceState<GameDetailSnapshot>>;
}

export interface CompletionProgressService {
  loadCompletionProgress(
    providerId: ProviderId,
    options?: LoadRequestOptions,
  ): Promise<ResourceState<CompletionProgressSnapshot>>;
}

export interface AchievementHistoryService {
  loadAchievementHistory(
    providerId: ProviderId,
    options?: LoadRequestOptions,
  ): Promise<ResourceState<AchievementHistorySnapshot>>;
}

export interface AppServices {
  readonly dashboard: DashboardService;
  readonly achievementHistory: AchievementHistoryService;
  readonly completionProgress: CompletionProgressService;
  readonly gameDetail: GameDetailService;
}
