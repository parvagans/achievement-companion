import type { RecentUnlock } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { getLocalActivityCalendarDayTimestamp as localDay } from "./decky-activity-calendar-model";
import { buildSteamActivityStats, getActivityUnlockTime } from "./decky-steam-activity-data";
import { filterRetroAchievementsUnlocksByMode } from "./decky-retroachievements-compact-profile-model";
import { buildActivityGameOptions, filterActivityEntriesByGame } from "./decky-steam-full-screen-activity-games";
import type { ActivitySelectedPeriod, DeckySteamActivityPageState, DeckySteamActivityFilter } from "./decky-steam-full-screen-activity-state";

// These are UTC-encoded local calendar dates, not elapsed local milliseconds.
export const ACTIVITY_DAY_MS = 86_400_000;
export const ACTIVITY_TIME_OPTIONS: readonly { value: DeckySteamActivityFilter; label: string }[] = [
  { value: "all", label: "All Unlocks" },
  { value: "recent", label: "Recent (90 Days)" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "streak", label: "Current Streak" },
];

export { getActivityUnlockTime } from "./decky-steam-activity-data";

export function formatActivityDay(day: number): string {
  return new Date(day).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function activityCalendarPeriod(day: number): ActivitySelectedPeriod {
  return { startDay: day, endDayExclusive: day + ACTIVITY_DAY_MS, label: formatActivityDay(day), source: "calendar", interval: "day" };
}

export function resolveActivityMode(providerId: string, setting: RetroAchievementsAchievementMode, local: RetroAchievementsAchievementMode) {
  return { mode: providerId === "retroachievements" ? (setting === "both" ? local : setting) : "both",
    showModeControl: providerId === "retroachievements" && setting === "both" } as const;
}

export function isActivityPresetAvailable(filter: DeckySteamActivityFilter, complete: boolean): boolean {
  return complete || filter === "all" || filter === "recent";
}

export function filterActivityEntries(
  entries: readonly RecentUnlock[], filter: DeckySteamActivityFilter,
  period: ActivitySelectedPeriod | undefined, now = Date.now(),
): readonly RecentUnlock[] {
  if (period === undefined && filter === "all") return entries;
  const today = localDay(now);
  const date = new Date(today);
  let start = today;
  let end = today + ACTIVITY_DAY_MS;
  if (period !== undefined) {
    start = period.startDay;
    end = Math.min(period.endDayExclusive, end);
  } else if (filter === "recent") {
    // Preserve the existing rolling 90-day cutoff, including its time of day.
    return entries.filter((entry) => {
      const time = getActivityUnlockTime(entry);
      return time !== undefined && time >= now - 90 * ACTIVITY_DAY_MS && time <= now;
    });
  } else if (filter === "week") {
    start = today - ((date.getUTCDay() + 6) % 7) * ACTIVITY_DAY_MS;
  } else if (filter === "month") {
    start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  } else if (filter === "year") {
    start = Date.UTC(date.getUTCFullYear(), 0, 1);
  } else if (filter === "streak") {
    const days = new Set(entries.flatMap((entry) => {
      const time = getActivityUnlockTime(entry);
      return time === undefined ? [] : [localDay(time)];
    }));
    let cursor = days.has(today) ? today : today - ACTIVITY_DAY_MS;
    if (!days.has(cursor)) return [];
    end = cursor + ACTIVITY_DAY_MS;
    while (days.has(cursor)) cursor -= ACTIVITY_DAY_MS;
    start = cursor + ACTIVITY_DAY_MS;
  }
  return entries.filter((entry) => {
    const time = getActivityUnlockTime(entry);
    return time !== undefined && localDay(time) >= start && localDay(time) < end;
  });
}

export function selectActivityHistory(entries: readonly RecentUnlock[], providerId: string,
  setting: RetroAchievementsAchievementMode, state: Pick<DeckySteamActivityPageState, "mode" | "filter" | "selectedGameId" | "selectedPeriod">,
  complete = true, now = Date.now()) {
  const { mode, showModeControl } = resolveActivityMode(providerId, setting, state.mode);
  const modeEntries = providerId === "retroachievements" ? filterRetroAchievementsUnlocksByMode(entries, mode) : entries;
  const gameOptions = buildActivityGameOptions(modeEntries);
  const filter = isActivityPresetAvailable(state.filter, complete) ? state.filter : "all";
  const effectiveEntries = filterActivityEntries(filterActivityEntriesByGame(modeEntries, state.selectedGameId), filter, state.selectedPeriod, now);
  return { mode, showModeControl, gameOptions, effectiveEntries, stats: buildSteamActivityStats(effectiveEntries, now) };
}

export function activityEntryKey(entry: RecentUnlock): string {
  return JSON.stringify([entry.game.providerId, entry.game.gameId, entry.achievement.achievementId, entry.achievement.unlockMode, getActivityUnlockTime(entry)]);
}

export function sortActivityEntries(entries: readonly RecentUnlock[], sort: "asc" | "desc"): readonly RecentUnlock[] {
  return [...entries].sort((left, right) => {
    const a = getActivityUnlockTime(left);
    const b = getActivityUnlockTime(right);
    if (a === undefined && b !== undefined) return 1;
    if (b === undefined && a !== undefined) return -1;
    const timeOrder = a !== undefined && b !== undefined ? (a - b) * (sort === "asc" ? 1 : -1) : 0;
    const aKey = activityEntryKey(left), bKey = activityEntryKey(right);
    return timeOrder || (aKey < bKey ? -1 : aKey > bKey ? 1 : 0);
  });
}

export interface ActivityDateGroup {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly rows: readonly { entry: RecentUnlock; rowIndex: number; key: string }[];
}

export function groupActivityEntries(entries: readonly RecentUnlock[]): readonly ActivityDateGroup[] {
  const groups = new Map<string, { key: string; label: string; count: number; rows: { entry: RecentUnlock; rowIndex: number; key: string }[] }>();
  entries.forEach((entry, rowIndex) => {
    const time = getActivityUnlockTime(entry);
    const day = time === undefined ? undefined : localDay(time);
    const key = day === undefined ? "unknown" : String(day);
    let group = groups.get(key);
    if (group === undefined) {
      group = { key, label: day === undefined ? "Date unavailable" : formatActivityDay(day), count: 0, rows: [] };
      groups.set(key, group);
    }
    group.count += 1;
    group.rows.push({ entry, rowIndex, key: activityEntryKey(entry) });
  });
  return [...groups.values()];
}

export function pageActivityGroups(groups: readonly ActivityDateGroup[], renderLimit: number): readonly ActivityDateGroup[] {
  const visible: ActivityDateGroup[] = [];
  let remaining = renderLimit;
  for (const group of groups) {
    if (remaining <= 0) break;
    visible.push(remaining >= group.rows.length ? group : { ...group, rows: group.rows.slice(0, remaining) });
    remaining -= group.rows.length;
  }
  return visible;
}
