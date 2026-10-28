import { createProviderRelatedGamesCachePrefix } from "./cache-keys";
import type { CacheStore, ResourceState } from "./cache";
import type { ProviderId } from "./domain";
import type { AppServices } from "./services";
import type { AppServiceBootstrapOptions } from "./app-services";

/** Isolates both queued work and cache writes across credential changes. */
export function createAccountScopedServices(
  options: AppServiceBootstrapOptions,
  createServices: (options: AppServiceBootstrapOptions) => AppServices,
): AppServices {
  const accounts = new Map<ProviderId, { revision: number; services: AppServices }>();
  async function run<T>(providerId: ProviderId, load: (services: AppServices) => Promise<ResourceState<T>>): Promise<ResourceState<T>> {
    const revision = options.getProviderAccountRevision?.(providerId) ?? 0;
    const current = () => (options.getProviderAccountRevision?.(providerId) ?? 0) === revision;
    let account = accounts.get(providerId);
    if (account?.revision !== revision) {
      const prefix = `account:${providerId}:${revision}:`;
      const cache: CacheStore = {
        async read<T>(key: string) {
          if (!current()) return undefined;
          const entry = await options.cacheStore.read<T>(prefix + key);
          return current() && entry !== undefined ? { ...entry, key } : undefined;
        },
        async write(entry) { if (current()) await options.cacheStore.write({ ...entry, key: prefix + entry.key }); },
        async delete(key) { if (current()) await options.cacheStore.delete(prefix + key); },
        async clear(key = "") { if (current()) await options.cacheStore.clear(prefix + key); },
      };
      account = { revision, services: createServices({
        ...options, cacheStore: cache,
        async loadProviderConfig(id) {
          if (!current()) return undefined;
          const config = await options.loadProviderConfig(id);
          return current() ? config : undefined;
        },
      }) };
      accounts.set(providerId, account);
    }
    const state = await load(account.services);
    return current() ? state : {
      status: "error", isStale: false, isRefreshing: false,
      error: { kind: "auth", providerId, retryable: true, userMessage: "Account settings changed. Please reload this page." },
    };
  }
  return {
    dashboard: { loadDashboard: (id, opts) => run(id, (s) => s.dashboard.loadDashboard(id, opts)) },
    activityCalendar: { loadActivityCalendarUnlocks: (id, opts) => run(id, (s) => s.activityCalendar.loadActivityCalendarUnlocks(id, opts)) },
    achievementHistory: { loadAchievementHistory: (id, opts) => run(id, (s) => s.achievementHistory.loadAchievementHistory(id, opts)) },
    completionProgress: { loadCompletionProgress: (id, opts) => run(id, (s) => s.completionProgress.loadCompletionProgress(id, opts)) },
    gameDetail: { loadGameDetail: (id, gameId, opts) => run(id, (s) => s.gameDetail.loadGameDetail(id, gameId, opts)) },
    relatedGames: {
      loadRelatedGames: (id, game, opts) => run(id, (s) => s.relatedGames.loadRelatedGames(id, game, opts)),
      async clearRelatedGameIndex(id) {
        const revision = options.getProviderAccountRevision?.(id) ?? 0;
        await options.cacheStore.clear(`account:${id}:${revision}:` + createProviderRelatedGamesCachePrefix(id));
        options.providerRegistry.get(id)?.clearRelatedGameIndex?.();
      },
    },
  };
}
