import type { RecentUnlock } from "@core/domain";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ActivityInsightValue {
  readonly value: string;
  readonly detail: string;
}

export interface SteamActivityStats {
  readonly gameCount: number;
  readonly thisMonthCount: number;
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly dayCounts: ReadonlyMap<number, number>;
  readonly recentThirtyDayCount: number;
  readonly bestMonth: ActivityInsightValue;
  readonly mostActiveDay: ActivityInsightValue;
}

function getUnlockTime(entry: RecentUnlock): number | undefined {
  const timestamp = entry.unlockedAt ?? entry.achievement.unlockedAt;
  return timestamp !== undefined && Number.isFinite(timestamp) ? timestamp : undefined;
}

function getLocalDayTimestamp(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function getLongestStreak(days: readonly number[]): number {
  let longest = 0;
  let current = 0;
  let previous: number | undefined;
  for (const day of days) {
    current = previous !== undefined && day - previous === DAY_MS ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }
  return longest;
}

function getCurrentStreak(days: readonly number[], now: number): number {
  const present = new Set(days);
  let cursor = getLocalDayTimestamp(now);
  if (!present.has(cursor)) {
    cursor -= DAY_MS;
  }

  let streak = 0;
  while (present.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

function getMostFrequent<Value>(values: Iterable<readonly [Value, number]>): readonly [Value, number] | undefined {
  let candidate: readonly [Value, number] | undefined;
  for (const value of values) {
    if (candidate === undefined || value[1] > candidate[1]) {
      candidate = value;
    }
  }
  return candidate;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatUnlockCount(value: number): string {
  return `${formatCount(value)} unlock${value === 1 ? "" : "s"}`;
}

function noTimestampedActivity(): ActivityInsightValue {
  return { value: "No activity", detail: "No timestamped unlocks" };
}

export function buildSteamActivityStats(entries: readonly RecentUnlock[], now = Date.now()): SteamActivityStats {
  const unlockedGameIds = new Set(entries.map((entry) => `${entry.game.providerId}:${entry.game.gameId}`));
  const nowDate = new Date(now);
  const thisMonthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime();
  const nextMonthStart = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 1).getTime();
  const today = getLocalDayTimestamp(now);
  const recentStart = today - 29 * DAY_MS;
  const dayCounts = new Map<number, number>();
  const monthCounts = new Map<number, number>();

  for (const entry of entries) {
    const timestamp = getUnlockTime(entry);
    if (timestamp === undefined) {
      continue;
    }

    const day = getLocalDayTimestamp(timestamp);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    const unlockedDate = new Date(timestamp);
    const monthStart = new Date(unlockedDate.getFullYear(), unlockedDate.getMonth(), 1).getTime();
    monthCounts.set(monthStart, (monthCounts.get(monthStart) ?? 0) + 1);
  }

  const bestMonth = getMostFrequent(monthCounts.entries());
  const mostActiveDay = getMostFrequent(dayCounts.entries());
  const days = [...dayCounts.keys()].sort((left, right) => left - right);

  return {
    gameCount: unlockedGameIds.size,
    thisMonthCount: entries.filter((entry) => {
      const timestamp = getUnlockTime(entry);
      return timestamp !== undefined && timestamp >= thisMonthStart && timestamp < nextMonthStart;
    }).length,
    currentStreak: getCurrentStreak(days, now),
    longestStreak: getLongestStreak(days),
    dayCounts,
    recentThirtyDayCount: [...dayCounts.entries()].reduce(
      (count, [day, unlockCount]) => day >= recentStart && day <= today ? count + unlockCount : count,
      0,
    ),
    bestMonth: bestMonth === undefined
      ? noTimestampedActivity()
      : {
          value: new Date(bestMonth[0]).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
          detail: formatUnlockCount(bestMonth[1]),
        },
    mostActiveDay: mostActiveDay === undefined
      ? noTimestampedActivity()
      : {
          value: new Date(mostActiveDay[0]).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
          detail: formatUnlockCount(mostActiveDay[1]),
        },
  };
}
