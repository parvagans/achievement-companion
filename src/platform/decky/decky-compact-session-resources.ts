import type { ResourceState } from "@core/cache";
import type { AchievementHistorySnapshot, DashboardSnapshot, GameDetailSnapshot, ProviderId } from "@core/domain";
import type { SteamHuntersProfile } from "../../providers/steamhunters/types";

interface CachedState<T> {
  readonly promise?: Promise<ResourceState<T>>;
  readonly state?: ResourceState<T>;
}

const steamGameStateById = new Map<string, CachedState<GameDetailSnapshot>>();
const steamDashboardStateByProvider = new Map<ProviderId, CachedState<DashboardSnapshot>>();
const steamActivityStateByProvider = new Map<ProviderId, CachedState<AchievementHistorySnapshot>>();
const steamHuntersProfileStateById = new Map<string, CachedState<SteamHuntersProfile>>();
let sessionGeneration = 0;
let steamDashboardRefreshClaimed = false;

function isTerminal<T>(state: ResourceState<T>): boolean {
  return state.status === "success" || state.status === "stale" || state.status === "error";
}

function loadOnce<T>(
  cache: Map<string, CachedState<T>>,
  key: string,
  loader: () => Promise<ResourceState<T>>,
  forceRefresh = false,
): Promise<ResourceState<T>> {
  const existing = cache.get(key);
  if (!forceRefresh && existing?.state !== undefined) {
    return Promise.resolve(existing.state);
  }
  if (!forceRefresh && existing?.promise !== undefined) {
    return existing.promise;
  }

  const generation = sessionGeneration;
  let promise: Promise<ResourceState<T>>;
  promise = Promise.resolve().then(loader).then((state) => {
    if (generation === sessionGeneration && cache.get(key)?.promise === promise) {
      if (isTerminal(state)) {
        cache.set(key, { state });
      } else {
        cache.delete(key);
      }
    }
    return state;
  }, (error: unknown) => {
    if (generation === sessionGeneration && cache.get(key)?.promise === promise) {
      cache.delete(key);
    }
    throw error;
  });
  cache.set(key, { promise });
  return promise;
}

function readState<T>(cache: Map<string, CachedState<T>>, key: string): ResourceState<T> | undefined {
  return cache.get(key)?.state;
}

export function readDeckyCompactSteamGameState(gameId: string): ResourceState<GameDetailSnapshot> | undefined {
  return readState(steamGameStateById, gameId);
}

export function loadDeckyCompactSteamGameState(
  gameId: string,
  loader: () => Promise<ResourceState<GameDetailSnapshot>>,
): Promise<ResourceState<GameDetailSnapshot>> {
  return loadOnce(steamGameStateById, gameId, loader);
}

export function readDeckyCompactSteamDashboardState(): ResourceState<DashboardSnapshot> | undefined {
  return readState(steamDashboardStateByProvider, "steam");
}

export function loadDeckyCompactSteamDashboardState(
  loader: () => Promise<ResourceState<DashboardSnapshot>>,
  forceRefresh = false,
): Promise<ResourceState<DashboardSnapshot>> {
  return loadOnce(steamDashboardStateByProvider, "steam", loader, forceRefresh);
}

export function claimDeckyCompactSteamDashboardRefresh(): boolean {
  if (steamDashboardRefreshClaimed) {
    return false;
  }
  steamDashboardRefreshClaimed = true;
  return true;
}

export function readDeckyCompactSteamActivityState(): ResourceState<AchievementHistorySnapshot> | undefined {
  return readState(steamActivityStateByProvider, "steam");
}

export function loadDeckyCompactSteamActivityState(
  loader: () => Promise<ResourceState<AchievementHistorySnapshot>>,
): Promise<ResourceState<AchievementHistorySnapshot>> {
  return loadOnce(steamActivityStateByProvider, "steam", loader);
}

export function readDeckyCompactSteamHuntersProfileState(
  steamId: string,
): ResourceState<SteamHuntersProfile> | undefined {
  return readState(steamHuntersProfileStateById, steamId);
}

export function loadDeckyCompactSteamHuntersProfileState(
  steamId: string,
  loader: () => Promise<ResourceState<SteamHuntersProfile>>,
  forceRefresh = false,
): Promise<ResourceState<SteamHuntersProfile>> {
  return loadOnce(steamHuntersProfileStateById, steamId, loader, forceRefresh);
}

export function clearDeckyCompactSessionResources(): void {
  sessionGeneration += 1;
  steamDashboardRefreshClaimed = false;
  steamGameStateById.clear();
  steamDashboardStateByProvider.clear();
  steamActivityStateByProvider.clear();
  steamHuntersProfileStateById.clear();
}
