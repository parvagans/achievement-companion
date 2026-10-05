import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSteamActivityCalendarModel,
  DEFAULT_STEAM_ACTIVITY_CALENDAR_WEEKS,
  getSteamActivityCalendarIntensity,
  resolveSteamActivityCalendarWeeks,
  STEAM_ACTIVITY_CALENDAR_WEEK_OPTIONS,
  type SteamActivityCalendarWeeks,
} from "../src/platform/decky/decky-steam-activity-calendar-model";

const DAY_MS = 24 * 60 * 60 * 1000;

function localDay(year: number, month: number, day: number): number {
  return Date.UTC(year, month, day);
}

test("supports the five calendar widths and defaults unsupported values to 12 weeks", () => {
  assert.deepEqual(STEAM_ACTIVITY_CALENDAR_WEEK_OPTIONS, [4, 6, 8, 10, 12]);
  assert.equal(DEFAULT_STEAM_ACTIVITY_CALENDAR_WEEKS, 12);
  for (const weeks of STEAM_ACTIVITY_CALENDAR_WEEK_OPTIONS) {
    assert.equal(resolveSteamActivityCalendarWeeks(weeks), weeks);
  }
  assert.equal(resolveSteamActivityCalendarWeeks(5), 12);
  assert.equal(resolveSteamActivityCalendarWeeks("8"), 12);
  assert.equal(resolveSteamActivityCalendarWeeks(undefined), 12);
});

test("builds the requested number of complete local Monday-Sunday weeks", () => {
  const now = new Date(2026, 9, 1, 15, 30).getTime();

  for (const weeks of STEAM_ACTIVITY_CALENDAR_WEEK_OPTIONS) {
    const model = buildSteamActivityCalendarModel(new Map(), weeks, now);
    assert.equal(model.days.length, weeks * 7);
    assert.equal(model.days[0]?.day, localDay(2026, 8, 28) - (weeks - 1) * 7 * DAY_MS);
    assert.equal(model.days.at(-1)?.day, localDay(2026, 9, 4));
    assert.equal(new Date(model.days[0]?.day ?? 0).getUTCDay(), 1);
    assert.equal(new Date(model.days.at(-1)?.day ?? 0).getUTCDay(), 0);
  }
});

test("derives the 90th-percentile maximum only from nonzero counts in the visible window", () => {
  const now = new Date(2026, 9, 1, 15, 30).getTime();
  const baseline = buildSteamActivityCalendarModel(new Map(), 4, now);
  const firstVisibleDay = baseline.days[0]?.day;
  assert.notEqual(firstVisibleDay, undefined);

  const counts = new Map<number, number>();
  for (let index = 0; index < 10; index += 1) {
    counts.set((firstVisibleDay ?? 0) + index * DAY_MS, index + 1);
  }
  counts.set((firstVisibleDay ?? 0) - DAY_MS, 10_000);
  counts.set((firstVisibleDay ?? 0) + 28 * DAY_MS, 20_000);

  const model = buildSteamActivityCalendarModel(counts, 4, now);
  assert.equal(model.effectiveMaximum, 9);
  assert.deepEqual(model.days.slice(0, 10).map((day) => day.intensity), [1, 1, 2, 2, 3, 3, 4, 4, 4, 4]);
});

test("maps zero separately and clamps positive values into four intensity levels", () => {
  assert.equal(getSteamActivityCalendarIntensity(0, 8), 0);
  assert.equal(getSteamActivityCalendarIntensity(1, 8), 1);
  assert.equal(getSteamActivityCalendarIntensity(3, 8), 2);
  assert.equal(getSteamActivityCalendarIntensity(5, 8), 3);
  assert.equal(getSteamActivityCalendarIntensity(7, 8), 4);
  assert.equal(getSteamActivityCalendarIntensity(80, 8), 4);

  const weeks: SteamActivityCalendarWeeks = 6;
  assert.equal(buildSteamActivityCalendarModel(new Map(), weeks, 0).weeks, 6);
});
