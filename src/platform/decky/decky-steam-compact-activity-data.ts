import type { RecentUnlock, RecentlyPlayedGame } from "@core/domain";

export const STEAM_COMPACT_ACTIVITY_CALENDAR_WEEKS = 4 as const;

export function getSteamActivityLocalDayTimestamp(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function getUnlockTimestamp(entry: RecentUnlock): number | undefined {
  const timestamp = entry.unlockedAt ?? entry.achievement.unlockedAt;
  return timestamp !== undefined && Number.isFinite(timestamp) ? timestamp : undefined;
}

export function filterSteamActivityEntriesForDay(
  entries: readonly RecentUnlock[],
  day: number,
): readonly RecentUnlock[] {
  return entries.filter((entry) => {
    const timestamp = getUnlockTimestamp(entry);
    return timestamp !== undefined && getSteamActivityLocalDayTimestamp(timestamp) === day;
  });
}

export interface SteamCompactActivityGame {
  readonly game: RecentlyPlayedGame;
  readonly unlockCount: number;
}

export function buildSteamCompactActivityGamesForDay(
  entries: readonly RecentUnlock[],
  knownGames: readonly RecentlyPlayedGame[],
): readonly SteamCompactActivityGame[] {
  const knownById = new Map(knownGames.map((game) => [game.gameId, game]));
  const games = new Map<string, SteamCompactActivityGame>();

  for (const entry of entries) {
    const existing = games.get(entry.game.gameId);
    if (existing !== undefined) {
      games.set(entry.game.gameId, { ...existing, unlockCount: existing.unlockCount + 1 });
      continue;
    }

    const known = knownById.get(entry.game.gameId);
    games.set(entry.game.gameId, {
      unlockCount: 1,
      game: known ?? {
        providerId: entry.game.providerId,
        gameId: entry.game.gameId,
        title: entry.game.title,
        ...(entry.game.coverImageUrl !== undefined ? { coverImageUrl: entry.game.coverImageUrl } : {}),
        ...(entry.game.platformLabel !== undefined ? { platformLabel: entry.game.platformLabel } : {}),
        summary: { unlockedCount: 1 },
      },
    });
  }

  return [...games.values()];
}
