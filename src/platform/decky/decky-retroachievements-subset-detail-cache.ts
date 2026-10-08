import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot } from "@core/domain";

type CachedSubsetDetailStates = Readonly<Record<string, ResourceState<GameDetailSnapshot>>>;

const subsetDetailStatesByParent = new Map<string, CachedSubsetDetailStates>();

function getParentKey(providerId: string | undefined, gameId: string | undefined): string | undefined {
  if (providerId === undefined || gameId === undefined) return undefined;
  return `${providerId}:${gameId}`;
}

export function readDeckyRetroAchievementsSubsetDetailStates(
  providerId: string | undefined,
  gameId: string | undefined,
): CachedSubsetDetailStates {
  const key = getParentKey(providerId, gameId);
  return key === undefined ? {} : subsetDetailStatesByParent.get(key) ?? {};
}

export function cacheDeckyRetroAchievementsSubsetDetailState(
  providerId: string | undefined,
  gameId: string | undefined,
  subsetId: string,
  state: ResourceState<GameDetailSnapshot>,
): void {
  if ((state.status !== "success" && state.status !== "stale") || state.data === undefined) return;
  const key = getParentKey(providerId, gameId);
  if (key === undefined) return;
  subsetDetailStatesByParent.set(key, {
    ...(subsetDetailStatesByParent.get(key) ?? {}),
    [subsetId]: state,
  });
}

export function resetDeckyRetroAchievementsSubsetDetailCacheForTests(): void {
  subsetDetailStatesByParent.clear();
}
