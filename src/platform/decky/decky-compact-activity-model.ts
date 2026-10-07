import type { RecentUnlock, RecentlyPlayedGame } from "@core/domain";
import { getLocalActivityCalendarDayTimestamp } from "./decky-activity-calendar-model";

export function formatCompactActivityDate(day: number): string {
  return new Date(day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function filterCompactActivityEntriesForDay(
  entries: readonly RecentUnlock[],
  day: number,
): readonly RecentUnlock[] {
  return entries.filter((entry) => {
    const timestamp = entry.unlockedAt ?? entry.achievement.unlockedAt;
    return timestamp !== undefined && Number.isFinite(timestamp)
      && getLocalActivityCalendarDayTimestamp(timestamp) === day;
  });
}

export interface CompactActivityGame {
  readonly game: RecentlyPlayedGame;
  readonly unlockCount: number;
}

/** Groups the selected day's real unlocks into the game rows shown beside activity details. */
export function buildCompactActivityGamesForDay(
  entries: readonly RecentUnlock[],
  knownGames: readonly RecentlyPlayedGame[],
): readonly CompactActivityGame[] {
  const knownById = new Map(knownGames.map((game) => [game.gameId, game]));
  const games = new Map<string, CompactActivityGame>();
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
