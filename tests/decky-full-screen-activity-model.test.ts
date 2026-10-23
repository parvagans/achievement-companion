import assert from "node:assert/strict";
import test from "node:test";
import type { RecentUnlock } from "../src/core/domain";
import { ACTIVITY_DAY_MS as DAY, activityCalendarPeriod, filterActivityEntries, formatActivityDay, groupActivityEntries, isActivityPresetAvailable, pageActivityGroups, resolveActivityMode, selectActivityHistory, sortActivityEntries } from "../src/platform/decky/decky-full-screen-activity-model";
import { buildRecentActivityTrend } from "../src/platform/decky/decky-steam-activity-data";
import { buildSteamActivityCalendarModel } from "../src/platform/decky/decky-steam-activity-calendar-model";
import { clearDeckyActivityFilters, hasActivityTemporaryFilters, readDeckyActivityPageState, rememberDeckyActivityAnalyticsFocus, rememberDeckyActivityFilter, rememberDeckyActivityFocusTarget, rememberDeckyActivityGame, rememberDeckyActivityMode, rememberDeckyActivityPeriod, rememberDeckyActivityRenderLimit, rememberDeckyActivityScrollTop, rememberDeckyActivitySort, rememberDeckyActivitySubview, resetDeckyActivityPageState, subscribeDeckyActivityPageState } from "../src/platform/decky/decky-steam-full-screen-activity-state";

const time = (year: number, month: number, day: number, hour = 12) => new Date(year, month - 1, day, hour).getTime();
function unlock(id: string, timestamp?: number, gameId = "game", mode: "hardcore" | "softcore" = "hardcore"): RecentUnlock {
  return {
    game: { providerId: "retroachievements", gameId, title: gameId },
    achievement: { providerId: "retroachievements", gameId, achievementId: id, title: id, isUnlocked: true, metrics: [], unlockMode: mode },
    ...(timestamp === undefined ? {} : { unlockedAt: timestamp }),
  };
}
const ids = (entries: readonly RecentUnlock[]) => entries.map((entry) => entry.achievement.achievementId);

test("six presets respect Monday weeks, year/month boundaries, rolling cutoff, and unknown dates", () => {
  const now = time(2026, 1, 4); // Sunday; Monday belongs to the previous year.
  const entries = [unlock("old", now - 90 * DAY - 1), unlock("cutoff", now - 90 * DAY),
    unlock("sunday", time(2025, 12, 28)), unlock("monday", time(2025, 12, 29, 0)),
    unlock("december", time(2025, 12, 31)), unlock("january", time(2026, 1, 1, 0)),
    unlock("yesterday", time(2026, 1, 3)), unlock("today", now), unlock("future", time(2026, 1, 5)), unlock("unknown")];
  const filter = (preset: Parameters<typeof filterActivityEntries>[1]) => ids(filterActivityEntries(entries, preset, undefined, now));
  assert.equal(filterActivityEntries(entries, "all", undefined, now), entries);
  assert.deepEqual(filter("recent"), ["cutoff", "sunday", "monday", "december", "january", "yesterday", "today"]);
  assert.deepEqual(filter("week"), ["monday", "december", "january", "yesterday", "today"]);
  assert.deepEqual(filter("month"), ["january", "yesterday", "today"]);
  assert.deepEqual(filter("year"), ["january", "yesterday", "today"]);
  assert.deepEqual(filter("streak"), ["yesterday", "today"]);
  assert.deepEqual(ids(filterActivityEntries(entries, "week", undefined, time(2026, 1, 5))), ["future"]);
});

test("Current Streak includes every day when it ends yesterday and is empty after a gap", () => {
  const entries = [unlock("one", time(2026, 10, 19)), unlock("two", time(2026, 10, 20))];
  assert.deepEqual(ids(filterActivityEntries(entries, "streak", undefined, time(2026, 10, 21))), ["one", "two"]);
  assert.deepEqual(filterActivityEntries(entries, "streak", undefined, time(2026, 10, 22)), []);
});

test("explicit local days use half-open boundaries through both DST transitions", () => {
  for (const [month, day] of [[3, 29], [10, 25]] as const) {
    const start = time(2026, month, day, 0), next = time(2026, month, day + 1, 0);
    if (process.env["TZ"] === "Europe/Berlin") assert.equal((next - start) / 3_600_000, month === 3 ? 23 : 25);
    const entries = [unlock("before", start - 1), unlock("start", start), unlock("end", next - 1), unlock("next", next)];
    const period = activityCalendarPeriod(Date.UTC(2026, month - 1, day));
    assert.deepEqual(ids(filterActivityEntries(entries, "year", period, next)), ["start", "end"]);
    assert.equal(groupActivityEntries(sortActivityEntries(entries, "asc"))[1]?.count, 2);
  }
});

test("local date labels do not shift backwards in negative UTC offsets", () => {
  const day = Date.UTC(2026, 0, 1);
  assert.equal(formatActivityDay(day), new Date(day).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }));
  const state = readDeckyActivityPageState("labels");
  const { stats } = selectActivityHistory([unlock("a", time(2026, 1, 1))], "steam", "both", state, true, time(2026, 1, 2));
  assert.equal(stats.mostActiveDay.value, new Date(day).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }));
});

test("all trend intervals expose exact contiguous day/week/month buckets and exclude future dates", () => {
  const now = time(2026, 10, 25);
  const entries = Array.from({ length: 400 }, (_, i) => unlock(String(i), time(2026, 10, 26 - i)));
  const { stats } = selectActivityHistory(entries, "steam", "both", readDeckyActivityPageState("trend"), true, now);
  for (const interval of ["7d", "14d", "30d", "12w", "12m"] as const) {
    const trend = buildRecentActivityTrend(stats.dayCounts, interval, now);
    trend.bars.forEach((bar, index) => {
      assert.equal(filterActivityEntries(entries, "all", { ...bar, source: "trend" }, now).length, bar.count);
      if (index > 0) assert.equal(trend.bars[index - 1]?.endDayExclusive, bar.startDay);
      if (interval === "12m") {
        assert.equal(new Date(bar.startDay).getUTCDate(), 1);
        assert.equal(new Date(bar.endDayExclusive).getUTCDate(), 1);
      } else assert.equal(bar.endDayExclusive - bar.startDay, (interval === "12w" ? 7 : 1) * DAY);
    });
    assert.equal(trend.bars.at(-1)?.count, interval === "12m" ? 25 : interval === "12w" ? 7 : 1);
  }
});

test("game options survive time filters and every analytics model consumes the same effective entries", () => {
  const provider = "pipeline";
  resetDeckyActivityPageState(provider);
  rememberDeckyActivityGame(provider, "a");
  rememberDeckyActivityFilter(provider, "week");
  const entries = [unlock("a1", time(2026, 10, 19), "a"), unlock("a2", time(2026, 10, 20), "a"),
    unlock("old", time(2026, 9, 1), "a"), unlock("other", time(2026, 9, 1), "b")];
  const now = time(2026, 10, 21);
  const select = () => selectActivityHistory(entries, "steam", "both", readDeckyActivityPageState(provider), true, now);
  const activity = select();
  rememberDeckyActivitySubview(provider, "analytics");
  const analytics = select();
  assert.deepEqual(analytics, activity);
  assert.deepEqual(ids(analytics.effectiveEntries), ["a1", "a2"]);
  assert.equal(analytics.gameOptions.length, 2);
  assert.equal(analytics.stats.thisMonthCount, 2);
  assert.equal(analytics.stats.gameCount, 1);
  assert.equal(analytics.stats.currentStreak, 2);
  assert.equal(analytics.stats.longestStreak, 2);
  assert.equal(buildRecentActivityTrend(analytics.stats.dayCounts, "7d", now).total, 2);
  assert.equal(buildSteamActivityCalendarModel(analytics.stats.dayCounts, 4, now).days.reduce((sum, day) => sum + day.count, 0), 2);
  assert.equal(groupActivityEntries(analytics.effectiveEntries).reduce((sum, group) => sum + group.count, 0), 2);
  rememberDeckyActivitySort(provider, "asc");
  assert.deepEqual(select(), analytics);
  rememberDeckyActivityGame(provider, "missing");
  assert.equal(select().effectiveEntries.length, 0);
  assert.equal(select().stats.gameCount, 0);
});

test("RA global enforcement overrides but preserves the local mode when returning to Both", () => {
  const provider = "retroachievements";
  resetDeckyActivityPageState(provider);
  rememberDeckyActivityMode(provider, "softcore");
  const entries = [unlock("hard", time(2026, 10, 20)), unlock("soft", time(2026, 10, 20), "game", "softcore")];
  for (const [global, expected, visible] of [["both", "soft", true], ["hardcore", "hard", false], ["softcore", "soft", false], ["both", "soft", true]] as const) {
    const model = selectActivityHistory(entries, provider, global, readDeckyActivityPageState(provider));
    assert.deepEqual(ids(model.effectiveEntries), [expected]);
    assert.equal(model.showModeControl, visible);
    assert.equal(readDeckyActivityPageState(provider).mode, "softcore");
  }
  assert.deepEqual(resolveActivityMode("steam", "both", "softcore"), { mode: "both", showModeControl: false });
});

test("calendar and chart selections replace presets, enter Activity, and retain game/mode", () => {
  for (const source of ["calendar", "trend"] as const) {
    const provider = `selection-${source}`;
    resetDeckyActivityPageState(provider);
    rememberDeckyActivityGame(provider, "game");
    rememberDeckyActivityMode(provider, "softcore");
    rememberDeckyActivityFilter(provider, "month");
    rememberDeckyActivitySubview(provider, "analytics");
    rememberDeckyActivityRenderLimit(provider, 96);
    rememberDeckyActivityScrollTop(provider, 800);
    const period = { ...activityCalendarPeriod(Date.UTC(2025, 0, 1)), source };
    rememberDeckyActivityPeriod(provider, period);
    const state = readDeckyActivityPageState(provider);
    assert.equal(state.subview, "activity");
    assert.equal(state.filter, "all");
    assert.equal(state.selectedGameId, "game");
    assert.equal(state.mode, "softcore");
    assert.equal(state.scrollTop, 0);
    assert.equal(state.renderLimit, 24);
    rememberDeckyActivitySubview(provider, "analytics");
    assert.deepEqual(readDeckyActivityPageState(provider).selectedPeriod, period);
    rememberDeckyActivityFilter(provider, "year");
    assert.equal(readDeckyActivityPageState(provider).selectedPeriod, undefined);
  }
});

test("Clear from either view resets temporary filters but preserves sort, local mode, and subview", () => {
  for (const subview of ["activity", "analytics"] as const) {
    const provider = `clear-${subview}`;
    resetDeckyActivityPageState(provider);
    rememberDeckyActivitySort(provider, "asc");
    rememberDeckyActivityMode(provider, "softcore");
    assert.equal(hasActivityTemporaryFilters(readDeckyActivityPageState(provider)), false);
    rememberDeckyActivityPeriod(provider, activityCalendarPeriod(Date.UTC(2026, 9, 20)));
    rememberDeckyActivityGame(provider, "game");
    rememberDeckyActivitySubview(provider, subview);
    assert.equal(hasActivityTemporaryFilters(readDeckyActivityPageState(provider)), true);
    clearDeckyActivityFilters(provider);
    const state = readDeckyActivityPageState(provider);
    assert.equal(hasActivityTemporaryFilters(state), false);
    assert.equal(state.selectedPeriod, undefined);
    assert.equal(state.selectedGameId, undefined);
    assert.equal(state.filter, "all");
    assert.equal(state.mode, "softcore");
    assert.equal(state.sort, "asc");
    assert.equal(state.subview, subview);
  }
});

test("both sort orders have deterministic ties, local date counts and unknown dates last", () => {
  const entries = [unlock("unknown"), unlock("b", time(2026, 10, 20)), unlock("a", time(2026, 10, 20)), unlock("older", time(2026, 10, 19)), unlock("invalid", NaN)];
  const asc = sortActivityEntries(entries, "asc"), desc = sortActivityEntries(entries, "desc");
  assert.deepEqual(ids(asc), ["older", "a", "b", "invalid", "unknown"]);
  assert.deepEqual(ids(desc), ["a", "b", "older", "invalid", "unknown"]);
  assert.deepEqual(ids(sortActivityEntries([...entries].reverse(), "desc")), ids(desc));
  assert.deepEqual(groupActivityEntries(desc).map((group) => group.count), [2, 1, 2]);
  assert.equal(groupActivityEntries(asc).at(-1)?.label, "Date unavailable");
  assert.equal(entries[0]?.achievement.achievementId, "unknown", "sorting must not mutate history");
});

test("incremental paging extends one date group and retains flat row indices and keys", () => {
  const entries = sortActivityEntries(Array.from({ length: 80 }, (_, i) => unlock(String(i), time(2026, 10, 20) + i)), "desc");
  const allGroups = groupActivityEntries(entries);
  const first = pageActivityGroups(allGroups, 24), next = pageActivityGroups(allGroups, 48);
  assert.equal(first.length, 1);
  assert.equal(next.length, 1);
  assert.equal(first[0]?.count, 80);
  assert.equal(next[0]?.rows.length, 48);
  assert.equal(next[0]?.rows[24]?.rowIndex, 24);
  assert.equal(next[0]?.rows[23]?.key, first[0]?.rows[23]?.key);
});

test("preview disables incomplete-history presets and retains usable empty models", () => {
  for (const preset of ["week", "month", "year", "streak"] as const) assert.equal(isActivityPresetAvailable(preset, false), false);
  for (const preset of ["all", "recent"] as const) assert.equal(isActivityPresetAvailable(preset, false), true);
  const entries = [unlock("old", time(2020, 1, 1)), unlock("unknown")];
  const state = { ...readDeckyActivityPageState("preview"), filter: "streak" as const };
  assert.deepEqual(selectActivityHistory(entries, "retroachievements", "both", state, false).effectiveEntries, entries);
  const empty = selectActivityHistory([], "retroachievements", "both", state, false);
  assert.equal(empty.stats.currentStreak, 0);
  assert.equal(empty.stats.bestMonth.value, "No activity");
  assert.deepEqual(empty.gameOptions, []);
});

test("canonical subscriptions, per-view positions and detail identity survive view switches and reset on exit", () => {
  const provider = "restore";
  resetDeckyActivityPageState(provider);
  let notifications = 0;
  const unsubscribe = subscribeDeckyActivityPageState(() => { notifications += 1; });
  const target = { gameId: "game", achievementId: "25", unlockMode: "softcore" as const, unlockedAt: time(2026, 10, 20) };
  rememberDeckyActivityFocusTarget(provider, target);
  rememberDeckyActivityRenderLimit(provider, 72);
  rememberDeckyActivityScrollTop(provider, 1200);
  rememberDeckyActivitySubview(provider, "analytics");
  rememberDeckyActivityScrollTop(provider, 120, "analytics");
  rememberDeckyActivityAnalyticsFocus(provider, "calendar:123");
  rememberDeckyActivitySubview(provider, "activity");
  const state = readDeckyActivityPageState(provider);
  assert.deepEqual(state.focusTarget, target);
  assert.equal(state.renderLimit, 72);
  assert.equal(state.scrollTop, 1200);
  assert.equal(state.analyticsScrollTop, 120);
  assert.equal(state.analyticsFocusKey, "calendar:123");
  assert.equal(notifications, 7);
  unsubscribe();
  resetDeckyActivityPageState(provider);
  assert.equal(notifications, 7);
  assert.equal(readDeckyActivityPageState(provider).renderLimit, 24);
  assert.equal(readDeckyActivityPageState(provider).focusTarget, undefined);
});
