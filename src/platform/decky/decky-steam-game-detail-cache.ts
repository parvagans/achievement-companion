import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot } from "@core/domain";
import { STEAM_PROVIDER_ID } from "../../providers/steam/config";
import {
  readDeckyStorageText,
  removeDeckyStorageText,
  removeDeckyStorageTextsByPrefix,
  writeDeckyStorageText,
} from "./storage";

export const DECKY_STEAM_GAME_DETAIL_STORAGE_KEY_PREFIX =
  "achievement-companion:decky:steam:game-detail:v1:";

interface DeckySteamGameDetailCacheEntry {
  readonly version: 1;
  readonly gameId: string;
  readonly storedAt: number;
  readonly snapshot: GameDetailSnapshot;
}

function getSteamGameDetailStorageKey(gameId: string): string {
  return `${DECKY_STEAM_GAME_DETAIL_STORAGE_KEY_PREFIX}${gameId}`;
}

function isDeckySteamGameDetailCacheEntry(value: unknown): value is DeckySteamGameDetailCacheEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const snapshot = record["snapshot"];
  if (typeof snapshot !== "object" || snapshot === null) {
    return false;
  }

  const game = (snapshot as Record<string, unknown>)["game"];
  return record["version"] === 1 &&
    typeof record["gameId"] === "string" &&
    record["gameId"].length > 0 &&
    typeof record["storedAt"] === "number" &&
    Number.isFinite(record["storedAt"]) &&
    typeof game === "object" &&
    game !== null &&
    (game as Record<string, unknown>)["providerId"] === STEAM_PROVIDER_ID &&
    (game as Record<string, unknown>)["gameId"] === record["gameId"];
}

export function readDeckySteamGameDetailCacheEntry(
  gameId: string,
): DeckySteamGameDetailCacheEntry | undefined {
  if (gameId.length === 0) {
    return undefined;
  }

  const rawValue = readDeckyStorageText(getSteamGameDetailStorageKey(gameId));
  if (rawValue === undefined) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    const entry = isDeckySteamGameDetailCacheEntry(parsed) && parsed.gameId === gameId
      ? parsed
      : undefined;
    return entry;
  } catch {
    return undefined;
  }
}

export function readDeckySteamGameDetailState(
  gameId: string,
): ResourceState<GameDetailSnapshot> | undefined {
  const entry = readDeckySteamGameDetailCacheEntry(gameId);
  if (entry === undefined) {
    return undefined;
  }

  return {
    status: "stale",
    data: entry.snapshot,
    lastUpdatedAt: entry.storedAt,
    isStale: true,
    isRefreshing: false,
  };
}

export function writeDeckySteamGameDetail(snapshot: GameDetailSnapshot): boolean {
  if (snapshot.game.providerId !== STEAM_PROVIDER_ID || snapshot.game.gameId.length === 0) {
    return false;
  }

  const entry: DeckySteamGameDetailCacheEntry = {
    version: 1,
    gameId: snapshot.game.gameId,
    storedAt: Date.now(),
    snapshot,
  };
  const storageKey = getSteamGameDetailStorageKey(snapshot.game.gameId);
  const didWrite = writeDeckyStorageText(storageKey, JSON.stringify(entry));
  if (!didWrite) {
    removeDeckyStorageText(storageKey);
  }

  return didWrite;
}

export function clearDeckySteamGameDetailCache(): boolean {
  return removeDeckyStorageTextsByPrefix(DECKY_STEAM_GAME_DETAIL_STORAGE_KEY_PREFIX);
}
