import type { ProviderId } from "@core/domain";
import type { DashboardRefreshProgressEvent } from "@core/services";

interface ProgressChannel {
  readonly latestByStep: Map<DashboardRefreshProgressEvent["stepId"], DashboardRefreshProgressEvent>;
  readonly listeners: Set<(event: DashboardRefreshProgressEvent) => void>;
}

/** Owns one refresh per provider and replays progress to screens joining it. */
export function createDeckyDashboardRefreshCoordinator<T>() {
  const inFlight = new Map<ProviderId, Promise<T>>();
  const channels = new Map<ProviderId, ProgressChannel>();
  function channel(providerId: ProviderId): ProgressChannel {
    let current = channels.get(providerId);
    if (current === undefined) {
      current = { latestByStep: new Map(), listeners: new Set() };
      channels.set(providerId, current);
    }
    return current;
  }
  return {
    get: (providerId: ProviderId) => inFlight.get(providerId),
    start(providerId: ProviderId, promise: Promise<T>) { inFlight.set(providerId, promise); },
    finish(providerId: ProviderId, promise: Promise<T>) {
      if (inFlight.get(providerId) === promise) {
        inFlight.delete(providerId);
        channels.delete(providerId);
      }
    },
    invalidate(providerId: ProviderId) { inFlight.delete(providerId); channels.delete(providerId); },
    reset() { inFlight.clear(); channels.clear(); },
    publish(providerId: ProviderId, event: DashboardRefreshProgressEvent) {
      const current = channel(providerId);
      current.latestByStep.set(event.stepId, event);
      for (const listener of current.listeners) listener(event);
    },
    subscribe(providerId: ProviderId, listener: (event: DashboardRefreshProgressEvent) => void) {
      const current = channel(providerId);
      current.listeners.add(listener);
      for (const event of current.latestByStep.values()) listener(event);
      return () => current.listeners.delete(listener);
    },
  };
}
