import { createSteamHuntersClient, type SteamHuntersClient } from "./client";
import {
  normalizeSteamHuntersAchievementGroups,
  normalizeSteamHuntersAchievements,
  normalizeSteamHuntersApp,
} from "./normalize";
import type { SteamHuntersGameData } from "./types";

interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

export interface SteamHuntersService {
  loadGameData(appId: number): Promise<SteamHuntersGameData | undefined>;
  clearCache(): void;
}

export interface CreateSteamHuntersServiceOptions {
  readonly client?: SteamHuntersClient;
  readonly cacheTtlMs?: number;
  readonly now?: () => number;
}

const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

function validAppId(appId: number): boolean {
  return Number.isSafeInteger(appId) && appId > 0;
}

function readFresh<T>(cache: ReadonlyMap<number, CacheEntry<T>>, appId: number, now: number): T | undefined {
  const entry = cache.get(appId);
  return entry !== undefined && entry.expiresAt > now ? entry.value : undefined;
}

export function createSteamHuntersService(
  options: CreateSteamHuntersServiceOptions = {},
): SteamHuntersService {
  const client = options.client ?? createSteamHuntersClient();
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const now = options.now ?? Date.now;
  const appCache = new Map<number, CacheEntry<SteamHuntersGameData["app"]>>();
  const achievementCache = new Map<number, CacheEntry<SteamHuntersGameData["achievements"]>>();
  const groupCache = new Map<number, CacheEntry<SteamHuntersGameData["groups"]>>();
  const pendingLoads = new Map<number, Promise<SteamHuntersGameData | undefined>>();

  async function loadApp(appId: number): Promise<SteamHuntersGameData["app"] | undefined> {
    const cached = readFresh(appCache, appId, now());
    if (cached !== undefined) {
      return cached;
    }

    const normalized = normalizeSteamHuntersApp(await client.loadApp(appId));
    if (normalized === undefined || normalized.appId !== appId) {
      return undefined;
    }

    appCache.set(appId, { value: normalized, expiresAt: now() + cacheTtlMs });
    return normalized;
  }

  async function loadAchievements(appId: number): Promise<SteamHuntersGameData["achievements"]> {
    const cached = readFresh(achievementCache, appId, now());
    if (cached !== undefined) {
      return cached;
    }

    const normalized = normalizeSteamHuntersAchievements(await client.loadAchievements(appId));
    achievementCache.set(appId, { value: normalized, expiresAt: now() + cacheTtlMs });
    return normalized;
  }

  async function loadGroups(appId: number): Promise<SteamHuntersGameData["groups"]> {
    const cached = readFresh(groupCache, appId, now());
    if (cached !== undefined) {
      return cached;
    }

    const normalized = normalizeSteamHuntersAchievementGroups(await client.loadGroups(appId));
    groupCache.set(appId, { value: normalized, expiresAt: now() + cacheTtlMs });
    return normalized;
  }

  return {
    loadGameData(appId) {
      if (!validAppId(appId)) {
        return Promise.resolve(undefined);
      }

      const pending = pendingLoads.get(appId);
      if (pending !== undefined) {
        return pending;
      }

      const load = (async () => {
        try {
          const app = await loadApp(appId);
          if (app === undefined) {
            return undefined;
          }

          const [achievements, groups] = await Promise.all([
            loadAchievements(appId).catch(() => []),
            // Group metadata is optional; Steam achievements remain usable if this endpoint is unavailable.
            loadGroups(appId).catch(() => []),
          ]);
          return { app, achievements, groups };
        } catch {
          // Missing games and transient network failures are normal optional-enrichment outcomes.
          return undefined;
        } finally {
          pendingLoads.delete(appId);
        }
      })();

      pendingLoads.set(appId, load);
      return load;
    },
    clearCache() {
      appCache.clear();
      achievementCache.clear();
      groupCache.clear();
      pendingLoads.clear();
    },
  };
}
