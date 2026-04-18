import type { ProviderId } from "./domain";

export const CACHE_VERSION = 1;
const CACHE_NAMESPACE = "achievement-companion";

export function createProviderDashboardCacheKey(providerId: ProviderId): string {
  return `${CACHE_NAMESPACE}:v${CACHE_VERSION}:${providerId}:dashboard`;
}

export function createProviderCompletionProgressCacheKey(providerId: ProviderId): string {
  return `${CACHE_NAMESPACE}:v${CACHE_VERSION}:${providerId}:completion-progress`;
}

export function createProviderAchievementHistoryCacheKey(providerId: ProviderId): string {
  return `${CACHE_NAMESPACE}:v${CACHE_VERSION}:${providerId}:achievement-history`;
}

export function createProviderGameDetailCacheKey(providerId: ProviderId, gameId: string): string {
  return `${CACHE_NAMESPACE}:v${CACHE_VERSION}:${providerId}:game:${encodeURIComponent(gameId)}`;
}
