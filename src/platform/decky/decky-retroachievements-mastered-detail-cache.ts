import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot } from "@core/domain";
import { subscribeDeckyAccountRevision } from "./decky-account-revision";
import {
  readDeckyStorageText,
  removeDeckyStorageText,
  writeDeckyStorageTextPreservingExisting,
} from "./storage";

const STORAGE_KEY = "achievement-companion:decky:retroachievements:mastered-details:v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 12;
const MAX_SERIALIZED_CHARACTERS = 750_000;

interface MasteredDetailEntry {
  readonly username: string;
  readonly gameId: string;
  readonly storedAt: number;
  readonly snapshot: GameDetailSnapshot;
}

interface MasteredDetailCache {
  readonly version: 1;
  readonly entries: readonly MasteredDetailEntry[];
}

function accountKey(username: string): string {
  return username.trim().toLocaleLowerCase();
}

function hasVerifiedMastery(snapshot: GameDetailSnapshot): boolean {
  return snapshot.game.providerId === "retroachievements"
    && snapshot.game.status === "mastered"
    && snapshot.achievements.length > 0
    && snapshot.game.metrics.some((metric) =>
      metric.key === "highest-award-kind" && metric.value.toLocaleLowerCase().includes("mastered"));
}

function readEntries(): readonly MasteredDetailEntry[] {
  const raw = readDeckyStorageText(STORAGE_KEY);
  if (raw === undefined) return [];
  try {
    const parsed = JSON.parse(raw) as MasteredDetailCache;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return [];
    return parsed.entries.filter((entry) =>
      typeof entry.username === "string"
      && typeof entry.gameId === "string"
      && Number.isFinite(entry.storedAt)
      && typeof entry.snapshot === "object"
      && entry.snapshot !== null
      && entry.snapshot.game?.gameId === entry.gameId
      && hasVerifiedMastery(entry.snapshot));
  } catch {
    return [];
  }
}

export function readDeckyRetroAchievementsMasteredGameDetail(
  username: string,
  gameId: string,
  now = Date.now(),
): ResourceState<GameDetailSnapshot> | undefined {
  const normalizedUsername = accountKey(username);
  const entry = readEntries().find((candidate) =>
    candidate.username === normalizedUsername
    && candidate.gameId === gameId
    && candidate.storedAt <= now
    && now - candidate.storedAt < CACHE_TTL_MS);
  if (entry === undefined) return undefined;
  return {
    status: "success",
    data: entry.snapshot,
    lastUpdatedAt: entry.storedAt,
    isStale: false,
    isRefreshing: false,
  };
}

export function writeDeckyRetroAchievementsMasteredGameDetail(
  username: string,
  snapshot: GameDetailSnapshot,
  now = Date.now(),
): boolean {
  if (accountKey(username).length === 0 || !hasVerifiedMastery(snapshot)) return false;
  const entry: MasteredDetailEntry = {
    username: accountKey(username),
    gameId: snapshot.game.gameId,
    storedAt: now,
    snapshot,
  };
  const retained = readEntries().filter((candidate) =>
    now - candidate.storedAt < CACHE_TTL_MS
    && !(candidate.username === entry.username && candidate.gameId === entry.gameId));
  const entries = [...retained, entry].sort((left, right) => right.storedAt - left.storedAt).slice(0, MAX_ENTRIES);
  while (entries.length > 0) {
    const serialized = JSON.stringify({ version: 1, entries } satisfies MasteredDetailCache);
    if (serialized.length <= MAX_SERIALIZED_CHARACTERS) {
      return writeDeckyStorageTextPreservingExisting(STORAGE_KEY, serialized);
    }
    entries.pop();
  }
  return false;
}

/** Reconcile a game after play or an explicit refresh; omit gameId to clear the account cache. */
export function invalidateDeckyRetroAchievementsMasteredGameDetail(gameId?: string): void {
  if (gameId === undefined) {
    removeDeckyStorageText(STORAGE_KEY);
    return;
  }
  const entries = readEntries().filter((entry) => entry.gameId !== gameId);
  if (entries.length === 0) {
    removeDeckyStorageText(STORAGE_KEY);
  } else {
    writeDeckyStorageTextPreservingExisting(STORAGE_KEY, JSON.stringify({ version: 1, entries } satisfies MasteredDetailCache));
  }
}

subscribeDeckyAccountRevision((providerId) => {
  if (providerId === "retroachievements") invalidateDeckyRetroAchievementsMasteredGameDetail();
});
