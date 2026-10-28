import type { ProviderId } from "@core/domain";
import type { ResourceState } from "@core/cache";
import { removeDeckyStorageTextsByPrefix } from "./storage";

const revisions = new Map<ProviderId, number>();
const listeners = new Set<(providerId: ProviderId) => void>();

export function getDeckyAccountRevision(providerId: ProviderId): number {
  return revisions.get(providerId) ?? 0;
}

/** Called only after the backend confirms a credential save or clear. */
export function advanceDeckyAccountRevision(providerId: ProviderId): void {
  revisions.set(providerId, getDeckyAccountRevision(providerId) + 1);
  removeDeckyStorageTextsByPrefix(`achievement-companion:decky:recent-achievements:${providerId}:`);
  for (const listener of listeners) listener(providerId);
}

export function subscribeDeckyAccountRevision(listener: (providerId: ProviderId) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function createDeckyAccountChangedState<T>(providerId: ProviderId): ResourceState<T> {
  return {
    status: "error", isStale: false, isRefreshing: false,
    error: { kind: "auth", providerId, retryable: true, userMessage: "Account settings changed. Please reload this page." },
  };
}
