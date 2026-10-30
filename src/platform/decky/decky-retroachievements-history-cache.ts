import type { CacheEntry, CacheStore } from "@core/cache";
import { CACHE_VERSION, createProviderAchievementHistoryCacheKey } from "@core/cache-keys";
import type { AchievementHistorySnapshot } from "@core/domain";
import { getDeckyAccountRevision, subscribeDeckyAccountRevision } from "./decky-account-revision";
import {
  readDeckyStorageText,
  removeDeckyStorageTextPreservingExisting,
  removeDeckyStorageTextsByPrefix,
  writeDeckyStorageTextPreservingExisting,
} from "./storage";

const PROVIDER_ID = "retroachievements";
const HISTORY_CACHE_KEY = createProviderAchievementHistoryCacheKey(PROVIDER_ID);
const STORAGE_KEY_PREFIX = "achievement-companion:decky:retroachievements:history:v1:";
// Keep one account's history below the browser storage quota, leaving room for
// settings, the dashboard snapshot, and other Decky caches.
const MAX_STORED_HISTORY_CHARS = 1_500_000;

interface StoredHistory {
  readonly version: 1;
  readonly username: string;
  readonly entry: Omit<CacheEntry<AchievementHistorySnapshot>, "key">;
}

function normalizedUsername(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLocaleLowerCase();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}

function storageKey(username: string): string {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(username)}`;
}

function isHistoryCacheKey(key: string): boolean {
  return key === HISTORY_CACHE_KEY || key.endsWith(`:${HISTORY_CACHE_KEY}`);
}

function isCompleteHistory(value: unknown): value is AchievementHistorySnapshot {
  if (typeof value !== "object" || value === null) return false;
  const snapshot = value as Partial<AchievementHistorySnapshot>;
  if (
    snapshot.providerId !== PROVIDER_ID
    || snapshot.profile?.providerId !== PROVIDER_ID
    || typeof snapshot.profile.identity?.accountId !== "string"
    || !Array.isArray(snapshot.entries)
    || typeof snapshot.sourceLabel !== "string"
    || !snapshot.sourceLabel.startsWith("Member since ")
    || typeof snapshot.refreshedAt !== "number"
    || !Number.isFinite(snapshot.refreshedAt)
  ) return false;
  return snapshot.entries.every((item) =>
    typeof item?.achievement?.providerId === "string"
    && item.achievement.providerId === PROVIDER_ID
    && typeof item.achievement.gameId === "string"
    && typeof item.achievement.achievementId === "string"
    && typeof item.game?.gameId === "string"
  );
}

function parseStoredHistory(raw: string, username: string, key: string): CacheEntry<AchievementHistorySnapshot> | undefined {
  if (raw.length > MAX_STORED_HISTORY_CHARS) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredHistory>;
    if (
      parsed.version !== 1
      || parsed.username !== username
      || parsed.entry?.version !== CACHE_VERSION
      || typeof parsed.entry.storedAt !== "number"
      || !Number.isFinite(parsed.entry.storedAt)
      || typeof parsed.entry.expiresAt !== "number"
      || !Number.isFinite(parsed.entry.expiresAt)
      || !isCompleteHistory(parsed.entry.value)
    ) return undefined;
    return { ...parsed.entry, key } as CacheEntry<AchievementHistorySnapshot>;
  } catch {
    return undefined;
  }
}

export function clearDeckyRetroAchievementsHistoryCache(): void {
  removeDeckyStorageTextsByPrefix(STORAGE_KEY_PREFIX);
}

/** Migration fallback only: this browser record cannot establish canonical freshness. */
export function readLegacyDeckyRetroAchievementsHistory(username: string): AchievementHistorySnapshot | undefined {
  const account = normalizedUsername(username);
  if (account === undefined) return undefined;
  const raw = readDeckyStorageText(storageKey(account));
  return raw === undefined ? undefined : parseStoredHistory(raw, account, HISTORY_CACHE_KEY)?.value;
}

subscribeDeckyAccountRevision((providerId) => {
  if (providerId === PROVIDER_ID) clearDeckyRetroAchievementsHistoryCache();
});

/** Persist only complete RA history; all other resources keep their memory cache. */
export function createDeckyRetroAchievementsHistoryCacheStore(
  memory: CacheStore,
  loadUsername: () => Promise<string | undefined>,
  getAccountRevision: () => number = () => getDeckyAccountRevision(PROVIDER_ID),
): CacheStore {
  async function currentUsername(revision: number): Promise<string | undefined> {
    try {
      const username = normalizedUsername(await loadUsername());
      return getAccountRevision() === revision ? username : undefined;
    } catch {
      return undefined;
    }
  }

  return {
    async read<T>(key: string): Promise<CacheEntry<T> | undefined> {
      const inMemory = await memory.read<T>(key);
      if (inMemory !== undefined || !isHistoryCacheKey(key)) return inMemory;
      const revision = getAccountRevision();
      const username = await currentUsername(revision);
      if (username === undefined) return undefined;
      const raw = readDeckyStorageText(storageKey(username));
      if (raw === undefined || getAccountRevision() !== revision) return undefined;
      const persisted = parseStoredHistory(raw, username, key);
      if (persisted === undefined) return undefined;
      await memory.write(persisted);
      return persisted as CacheEntry<T>;
    },

    async write<T>(entry: CacheEntry<T>): Promise<void> {
      await memory.write(entry);
      if (!isHistoryCacheKey(entry.key)) return;
      const revision = getAccountRevision();
      const username = await currentUsername(revision);
      if (username === undefined) return;
      const key = storageKey(username);
      if (!isCompleteHistory(entry.value)) {
        removeDeckyStorageTextPreservingExisting(key);
        return;
      }
      try {
        const stored: StoredHistory = {
          version: 1,
          username,
          entry: {
            value: entry.value,
            storedAt: entry.storedAt,
            expiresAt: entry.expiresAt,
            version: entry.version,
          },
        };
        const serialized = JSON.stringify(stored);
        if (serialized.length > MAX_STORED_HISTORY_CHARS || getAccountRevision() !== revision) return;
        writeDeckyStorageTextPreservingExisting(key, serialized);
      } catch {
        // Storage or serialization failure must not affect the in-memory cache.
      }
    },

    async delete(key: string): Promise<void> {
      await memory.delete(key);
      if (!isHistoryCacheKey(key)) return;
      const revision = getAccountRevision();
      const username = await currentUsername(revision);
      if (username !== undefined) removeDeckyStorageTextPreservingExisting(storageKey(username));
    },

    async clear(prefix?: string): Promise<void> {
      await memory.clear(prefix);
      if (prefix === undefined || HISTORY_CACHE_KEY.startsWith(prefix) || isHistoryCacheKey(prefix)) {
        clearDeckyRetroAchievementsHistoryCache();
      }
    },
  };
}
