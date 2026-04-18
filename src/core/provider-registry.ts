import type { ProviderId } from "./domain";
import type { AchievementProvider, ProviderRegistry } from "./ports";

export function createProviderRegistry(
  providers: readonly AchievementProvider[],
): ProviderRegistry {
  const providerMap = new Map<ProviderId, AchievementProvider>();

  for (const provider of providers) {
    providerMap.set(provider.id, provider);
  }

  return {
    get(providerId) {
      return providerMap.get(providerId);
    },
    list() {
      return [...providerMap.values()];
    },
  };
}
