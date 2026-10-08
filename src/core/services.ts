import type { ResourceState } from "./cache";
import type {
  AchievementHistorySnapshot,
  CompletionProgressSnapshot,
  DashboardSnapshot,
  GameDetailSnapshot,
  NormalizedProfile,
  ProviderId,
  RecentUnlock,
} from "./domain";

export interface LoadRequestOptions {
  readonly forceRefresh?: boolean;
  readonly onProgress?: (event: DashboardRefreshProgressEvent) => void;
}

export interface AchievementHistoryLoadRequestOptions extends LoadRequestOptions {
  /** Reuse a profile already fetched by the owning data session. */
  readonly profile?: NormalizedProfile;
}

export type DashboardRefreshProgressStepId =
  | "profile"
  | "recent-games"
  | "recent-achievements"
  | "finalize";

export interface DashboardRefreshProgressEvent {
  readonly stepId: DashboardRefreshProgressStepId;
  readonly status: "in-progress" | "complete" | "failed";
  readonly durationMs?: number;
}

export interface DashboardService {
  loadDashboard(
    providerId: ProviderId,
    options?: LoadRequestOptions,
  ): Promise<ResourceState<DashboardSnapshot>>;
}

export interface ActivityCalendarService {
  loadActivityCalendarUnlocks(
    providerId: ProviderId,
    options?: LoadRequestOptions,
  ): Promise<ResourceState<readonly RecentUnlock[]>>;
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
    options?: AchievementHistoryLoadRequestOptions,
  ): Promise<ResourceState<AchievementHistorySnapshot>>;
}

export interface AppServices {
  readonly dashboard: DashboardService;
  readonly activityCalendar: ActivityCalendarService;
  readonly achievementHistory: AchievementHistoryService;
  readonly completionProgress: CompletionProgressService;
  readonly gameDetail: GameDetailService;
}
