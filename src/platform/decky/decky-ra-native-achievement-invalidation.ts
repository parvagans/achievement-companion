export type DeckyRaNativeAchievementInvalidationReason =
  | "achievement-mode-changed"
  | "account-changed"
  | "provider-refreshed";

export interface DeckyRaNativeAchievementInvalidation {
  readonly reason: DeckyRaNativeAchievementInvalidationReason;
}

const listeners = new Set<(event: DeckyRaNativeAchievementInvalidation) => void>();

export function subscribeDeckyRaNativeAchievementInvalidation(
  listener: (event: DeckyRaNativeAchievementInvalidation) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishDeckyRaNativeAchievementInvalidation(
  reason: DeckyRaNativeAchievementInvalidationReason,
): void {
  const event: DeckyRaNativeAchievementInvalidation = { reason };
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch {
      // A Steam-facing adapter failure must not fail a settings or provider save.
      console.warn("[Achievement Companion] RA native achievement invalidation listener failed", reason);
    }
  }
}
