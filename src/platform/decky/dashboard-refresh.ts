import type { ResourceState } from "@core/cache";
import type { DashboardSnapshot, ProviderId } from "@core/domain";

export function shouldRefreshDashboardOnEntry(args: {
  readonly providerId: ProviderId | undefined;
  readonly state: ResourceState<DashboardSnapshot>;
}): boolean {
  if (args.providerId === undefined) {
    return false;
  }

  if (args.state.status === "error" || args.state.status === "stale") {
    return true;
  }

  const stateProviderId = args.state.data?.profile.providerId;
  if (stateProviderId !== undefined && stateProviderId !== args.providerId) {
    return true;
  }

  return false;
}
