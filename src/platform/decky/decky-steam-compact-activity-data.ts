import type { RecentUnlock, RecentlyPlayedGame } from "@core/domain";
import { getLocalActivityCalendarDayTimestamp } from "./decky-activity-calendar-model";
import {
  buildCompactActivityGamesForDay,
  filterCompactActivityEntriesForDay,
  type CompactActivityGame,
} from "./decky-compact-activity-model";

export const STEAM_COMPACT_ACTIVITY_CALENDAR_WEEKS = 8 as const;

export function getSteamActivityLocalDayTimestamp(timestamp: number): number {
  return getLocalActivityCalendarDayTimestamp(timestamp);
}

export function filterSteamActivityEntriesForDay(
  entries: readonly RecentUnlock[],
  day: number,
): readonly RecentUnlock[] {
  return filterCompactActivityEntriesForDay(entries, day);
}

export type SteamCompactActivityGame = CompactActivityGame;

export function buildSteamCompactActivityGamesForDay(
  entries: readonly RecentUnlock[],
  knownGames: readonly RecentlyPlayedGame[],
): readonly SteamCompactActivityGame[] {
  return buildCompactActivityGamesForDay(entries, knownGames);
}
