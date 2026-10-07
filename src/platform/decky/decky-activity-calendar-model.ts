import {
  ACTIVITY_CALENDAR_WEEK_OPTIONS,
  type ActivityCalendarWeeks,
} from "@core/settings";

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_ACTIVITY_CALENDAR_WEEKS: ActivityCalendarWeeks = 12;

export type ActivityCalendarIntensity = 0 | 1 | 2 | 3 | 4;

export interface ActivityCalendarDay {
  readonly day: number;
  readonly count: number;
  readonly intensity: ActivityCalendarIntensity;
}

export interface ActivityCalendarModel {
  readonly weeks: ActivityCalendarWeeks;
  readonly effectiveMaximum: number;
  readonly days: readonly ActivityCalendarDay[];
}

export function resolveActivityCalendarWeeks(value: unknown): ActivityCalendarWeeks {
  return typeof value === "number" && ACTIVITY_CALENDAR_WEEK_OPTIONS.includes(value as ActivityCalendarWeeks)
    ? value as ActivityCalendarWeeks
    : DEFAULT_ACTIVITY_CALENDAR_WEEKS;
}

export function getLocalActivityCalendarDayTimestamp(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function getEffectiveMaximum(counts: readonly number[]): number {
  const nonzeroCounts = counts.filter((count) => count > 0).sort((left, right) => left - right);
  if (nonzeroCounts.length === 0) return 0;
  return nonzeroCounts[Math.ceil(nonzeroCounts.length * 0.9) - 1] ?? 0;
}

export function getActivityCalendarIntensity(
  count: number,
  effectiveMaximum: number,
): ActivityCalendarIntensity {
  if (count <= 0 || effectiveMaximum <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / effectiveMaximum) * 4))) as ActivityCalendarIntensity;
}

export function buildActivityCalendarModel(
  dayCounts: ReadonlyMap<number, number>,
  weeks: ActivityCalendarWeeks = DEFAULT_ACTIVITY_CALENDAR_WEEKS,
  now = Date.now(),
): ActivityCalendarModel {
  const today = getLocalActivityCalendarDayTimestamp(now);
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
      intensity: getActivityCalendarIntensity(count, effectiveMaximum),
    })),
  };
}
