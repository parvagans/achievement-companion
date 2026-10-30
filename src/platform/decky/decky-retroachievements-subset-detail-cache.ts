import { subscribeDeckyAccountRevision } from "./decky-account-revision";
import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot } from "@core/domain";
import { getDeckyRetroAchievementsGameResourceRevision, isDeckyRetroAchievementsGameResourceFresh } from "./providers/retroachievements/backend-transport";

type CachedSubsetDetailStates = Readonly<Record<string, ResourceState<GameDetailSnapshot>>>;

const revisions = new WeakMap<ResourceState<GameDetailSnapshot>, string | undefined>();
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
  return key === undefined ? {} : Object.fromEntries(Object.entries(subsetDetailStatesByParent.get(key) ?? {})
    .filter(([subsetId, state]) => isDeckyRetroAchievementsGameResourceFresh(subsetId) && revisions.get(state) === getDeckyRetroAchievementsGameResourceRevision(subsetId)));
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
  revisions.set(state, state.data?.canonicalSourceRevision ?? getDeckyRetroAchievementsGameResourceRevision(subsetId));
  subsetDetailStatesByParent.set(key, {
    ...(subsetDetailStatesByParent.get(key) ?? {}),
    [subsetId]: state,
  });
  if (subsetDetailStatesByParent.size > 100) subsetDetailStatesByParent.delete(subsetDetailStatesByParent.keys().next().value!);
}

export function resetDeckyRetroAchievementsSubsetDetailCacheForTests(): void {
  subsetDetailStatesByParent.clear();
}

subscribeDeckyAccountRevision((_providerId) => { subsetDetailStatesByParent.clear(); });
