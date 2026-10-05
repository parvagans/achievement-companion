import {
  ACTIVITY_CALENDAR_WEEK_OPTIONS,
  type ActivityCalendarWeeks,
} from "@core/settings";

const DAY_MS = 24 * 60 * 60 * 1000;

export const STEAM_ACTIVITY_CALENDAR_WEEK_OPTIONS = ACTIVITY_CALENDAR_WEEK_OPTIONS;
export const DEFAULT_STEAM_ACTIVITY_CALENDAR_WEEKS: SteamActivityCalendarWeeks = 12;

export type SteamActivityCalendarWeeks = ActivityCalendarWeeks;
export type SteamActivityCalendarIntensity = 0 | 1 | 2 | 3 | 4;

export interface SteamActivityCalendarDay {
  readonly day: number;
  readonly count: number;
  readonly intensity: SteamActivityCalendarIntensity;
}

export interface SteamActivityCalendarModel {
  readonly weeks: SteamActivityCalendarWeeks;
  readonly effectiveMaximum: number;
  readonly days: readonly SteamActivityCalendarDay[];
}

export function resolveSteamActivityCalendarWeeks(value: unknown): SteamActivityCalendarWeeks {
  return typeof value === "number" && STEAM_ACTIVITY_CALENDAR_WEEK_OPTIONS.includes(value as SteamActivityCalendarWeeks)
    ? value as SteamActivityCalendarWeeks
    : DEFAULT_STEAM_ACTIVITY_CALENDAR_WEEKS;
}

function getLocalDayTimestamp(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function getEffectiveMaximum(counts: readonly number[]): number {
  const nonzeroCounts = counts.filter((count) => count > 0).sort((left, right) => left - right);
  if (nonzeroCounts.length === 0) {
    return 0;
  }

  const percentileIndex = Math.ceil(nonzeroCounts.length * 0.9) - 1;
  return nonzeroCounts[percentileIndex] ?? 0;
}

export function getSteamActivityCalendarIntensity(
  count: number,
  effectiveMaximum: number,
): SteamActivityCalendarIntensity {
  if (count <= 0 || effectiveMaximum <= 0) {
    return 0;
  }

  return Math.min(4, Math.max(1, Math.ceil((count / effectiveMaximum) * 4))) as SteamActivityCalendarIntensity;
}

export function buildSteamActivityCalendarModel(
  dayCounts: ReadonlyMap<number, number>,
  weeks: SteamActivityCalendarWeeks = DEFAULT_STEAM_ACTIVITY_CALENDAR_WEEKS,
  now = Date.now(),
): SteamActivityCalendarModel {
  const today = getLocalDayTimestamp(now);
  const mondayOffset = (new Date(today).getUTCDay() + 6) % 7;
  const start = today - (mondayOffset + (weeks - 1) * 7) * DAY_MS;
  const visibleCounts = Array.from({ length: weeks * 7 }, (_, index) => {
    const count = dayCounts.get(start + index * DAY_MS) ?? 0;
    return Number.isFinite(count) ? Math.max(0, count) : 0;
  });
  const effectiveMaximum = getEffectiveMaximum(visibleCounts);

  return {
    weeks,
    effectiveMaximum,
    days: visibleCounts.map((count, index) => ({
      day: start + index * DAY_MS,
      count,
      intensity: getSteamActivityCalendarIntensity(count, effectiveMaximum),
    })),
  };
}
