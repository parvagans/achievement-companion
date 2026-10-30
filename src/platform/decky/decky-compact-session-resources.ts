import type { ResourceState } from "@core/cache";
import type { AchievementHistorySnapshot, DashboardSnapshot, GameDetailSnapshot, ProviderId } from "@core/domain";
import type { SteamHuntersProfile } from "../../providers/steamhunters/types";
import { subscribeDeckyAccountRevision } from "./decky-account-revision";
import { getDeckyRetroAchievementsProfileResourceRevision, getDeckyRetroAchievementsGameResourceRevision, isDeckyRetroAchievementsGameResourceFresh, areDeckyRetroAchievementsProfileResourcesFresh } from "./providers/retroachievements/backend-transport";
import { readDeckyProviderConfigs } from "./providers/provider-config-store";
import { getRetroAchievementsActiveGameId } from "./decky-retroachievements-current-game";

interface CachedState<T> {
  readonly sourceRevision?: string | undefined;
  readonly promise?: Promise<ResourceState<T>>;
  readonly state?: ResourceState<T>;
}

const gameStateByProviderAndId = new Map<string, CachedState<GameDetailSnapshot>>();
// Retained recommendation presentations use the same canonical required progress.
const recommendationStateByGameId = new Map<string, CachedState<GameDetailSnapshot>>();
const dashboardStateByProvider = new Map<ProviderId, CachedState<DashboardSnapshot>>();
const steamActivityStateByProvider = new Map<ProviderId, CachedState<AchievementHistorySnapshot>>();
const steamHuntersProfileStateById = new Map<string, CachedState<SteamHuntersProfile>>();
let sessionGeneration = 0;
let steamDashboardRefreshClaimed = false;
let retroAchievementsDashboardRefreshClaimed = false;

function sourceRevision<T>(state: ResourceState<T>, capture = false): string | undefined {
  const profile = (state.data as DashboardSnapshot | undefined)?.profile;
  if (profile?.providerId === "retroachievements") {
    const config = readDeckyProviderConfigs().retroAchievements;
    return capture ? (state.data as DashboardSnapshot).canonicalSourceRevision : config === undefined ? undefined : getDeckyRetroAchievementsProfileResourceRevision(config.username);
  }
  const game = (state.data as GameDetailSnapshot | undefined)?.game;
  return game?.providerId === "retroachievements" ? (capture ? (state.data as GameDetailSnapshot).canonicalSourceRevision : undefined) ?? getDeckyRetroAchievementsGameResourceRevision(game.gameId) : undefined;
}
function matches<T>(entry: CachedState<T> | undefined): boolean {
  return entry?.state === undefined || entry.sourceRevision === sourceRevision(entry.state);
}
function isTerminal<T>(state: ResourceState<T>): boolean {
  return state.status === "success" || state.status === "stale" || state.status === "error";
}

function loadOnce<T>(
  cache: Map<string, CachedState<T>>,
  key: string,
  loader: () => Promise<ResourceState<T>>,
  forceRefresh = false,
  shouldCacheState: (state: ResourceState<T>) => boolean = isTerminal,
): Promise<ResourceState<T>> {
  const existing = cache.get(key);
  // Forced retries still join equivalent work already in flight.
  if (existing?.promise !== undefined) {
    return existing.promise;
  }
  if (!forceRefresh && existing?.state !== undefined && matches(existing)) {
    return Promise.resolve(existing.state);
  }

  const generation = sessionGeneration;
  let promise: Promise<ResourceState<T>>;
  promise = Promise.resolve().then(loader).then((state) => {
    if (generation === sessionGeneration && cache.get(key)?.promise === promise) {
      if (shouldCacheState(state)) {
        cache.set(key, { state, sourceRevision: sourceRevision(state, true) });
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
  const entry = cache.get(key);
  return matches(entry) ? entry?.state : undefined;
}

export function readDeckyCompactSteamGameState(gameId: string): ResourceState<GameDetailSnapshot> | undefined {
  return readDeckyCompactGameState("steam", gameId);
}

export function loadDeckyCompactSteamGameState(
  gameId: string,
  loader: () => Promise<ResourceState<GameDetailSnapshot>>,
): Promise<ResourceState<GameDetailSnapshot>> {
  return loadDeckyCompactGameState("steam", gameId, loader);
}

function compactGameKey(providerId: ProviderId, gameId: string): string {
  return JSON.stringify([providerId, gameId]);
}

export function readDeckyCompactGameState(
  providerId: ProviderId,
  gameId: string,
): ResourceState<GameDetailSnapshot> | undefined {
  if (providerId === "retroachievements" && !hasFreshRetroAchievementsGame(gameId)) return undefined;
  return readState(gameStateByProviderAndId, compactGameKey(providerId, gameId));
}

function hasFreshRetroAchievementsGame(gameId: string): boolean {
  return isDeckyRetroAchievementsGameResourceFresh(gameId);
}
export function readDeckyCompactGameLastKnownGoodState(providerId: ProviderId, gameId: string): ResourceState<GameDetailSnapshot> | undefined {
  return readState(gameStateByProviderAndId, compactGameKey(providerId, gameId))
    ?? (providerId === "retroachievements" ? readState(recommendationStateByGameId, gameId) : undefined);
}

export function loadDeckyCompactGameState(
  providerId: ProviderId,
  gameId: string,
  loader: () => Promise<ResourceState<GameDetailSnapshot>>,
  forceRefresh = false,
): Promise<ResourceState<GameDetailSnapshot>> {
  const key = compactGameKey(providerId, gameId);
  if (providerId === "retroachievements" && !hasFreshRetroAchievementsGame(gameId) &&
      gameStateByProviderAndId.get(key)?.promise === undefined) gameStateByProviderAndId.delete(key);
  return loadOnce(
    gameStateByProviderAndId,
    compactGameKey(providerId, gameId),
    loader,
    forceRefresh,
    (state) => isTerminal(state) && state.data !== undefined,
  );
}

export function writeDeckyCompactGameState(
  providerId: ProviderId,
  gameId: string,
  state: ResourceState<GameDetailSnapshot>,
): void {
  if (isTerminal(state) && state.data !== undefined) {
    gameStateByProviderAndId.set(compactGameKey(providerId, gameId), { state, sourceRevision: sourceRevision(state, true) });
  }
}

export function readDeckyCompactRecommendationGameState(gameId: string): ResourceState<GameDetailSnapshot> | undefined {
  const state = readState(recommendationStateByGameId, gameId);
  if (state === undefined) return undefined;
  if (!hasFreshRetroAchievementsGame(gameId)) {
    recommendationStateByGameId.delete(gameId);
    return undefined;
  }
  return state;
}

export function loadDeckyCompactRecommendationGameState(
  gameId: string,
  loader: () => Promise<ResourceState<GameDetailSnapshot>>,
  forceRefresh = false,
): Promise<ResourceState<GameDetailSnapshot>> {
  readDeckyCompactRecommendationGameState(gameId);
  return loadOnce(
    recommendationStateByGameId,
    gameId,
    loader,
    forceRefresh,
    (state) => isTerminal(state) && state.data !== undefined,
  );
}

export function invalidateDeckyCompactRetroAchievementsGameState(gameId?: string): void {
  if (gameId === undefined) {
    recommendationStateByGameId.clear();
    for (const key of gameStateByProviderAndId.keys()) {
      if (key.startsWith('["retroachievements",')) gameStateByProviderAndId.delete(key);
    }
    return;
  }
  recommendationStateByGameId.delete(gameId);
  gameStateByProviderAndId.delete(compactGameKey("retroachievements", gameId));
}

subscribeDeckyAccountRevision((providerId) => {
  if (providerId === "retroachievements") invalidateDeckyCompactRetroAchievementsGameState();
});

export function readDeckyCompactSteamDashboardState(): ResourceState<DashboardSnapshot> | undefined {
  return readDeckyCompactDashboardState("steam");
}

export function loadDeckyCompactSteamDashboardState(
  loader: () => Promise<ResourceState<DashboardSnapshot>>,
  forceRefresh = false,
): Promise<ResourceState<DashboardSnapshot>> {
  return loadDeckyCompactDashboardState("steam", loader, forceRefresh);
}

export function readDeckyCompactDashboardState(
  providerId: ProviderId,
): ResourceState<DashboardSnapshot> | undefined {
  const state = readState(dashboardStateByProvider, providerId);
  if (providerId === "retroachievements") {
    const config = readDeckyProviderConfigs().retroAchievements;
    if (config === undefined || state?.data === undefined || !areDeckyRetroAchievementsProfileResourcesFresh(config.username,
      getRetroAchievementsActiveGameId(state.data.profile) ?? state.data.recentlyPlayedGames[0]?.gameId)) return undefined;
  }
  return state;
}

export function loadDeckyCompactDashboardState(
  providerId: ProviderId,
  loader: () => Promise<ResourceState<DashboardSnapshot>>,
  forceRefresh = false,
): Promise<ResourceState<DashboardSnapshot>> {
  if (providerId === "retroachievements" && readDeckyCompactDashboardState(providerId) === undefined) forceRefresh = true;
  return loadOnce(dashboardStateByProvider, providerId, loader, forceRefresh);
}

export function claimDeckyCompactSteamDashboardRefresh(): boolean {
  if (steamDashboardRefreshClaimed) {
    return false;
  }
  steamDashboardRefreshClaimed = true;
  return true;
}

export function claimDeckyCompactRetroAchievementsDashboardRefresh(): boolean {
  if (retroAchievementsDashboardRefreshClaimed) {
    return false;
  }
  retroAchievementsDashboardRefreshClaimed = true;
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
  retroAchievementsDashboardRefreshClaimed = false;
  gameStateByProviderAndId.clear();
  recommendationStateByGameId.clear();
  dashboardStateByProvider.clear();
  steamActivityStateByProvider.clear();
  steamHuntersProfileStateById.clear();
}
