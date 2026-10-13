import assert from "node:assert/strict";
import test from "node:test";
import { buildRecentActivityTrend } from "../src/platform/decky/decky-steam-activity-data";

test("Recent Activity ranges count the selected days and keep the newest bar last", () => {
  const now = new Date(2026, 2, 15, 12).getTime();
  const counts = new Map([
    [Date.UTC(2026, 2, 15), 2],
    [Date.UTC(2026, 2, 2), 3],
    [Date.UTC(2026, 1, 14), 5],
    [Date.UTC(2026, 1, 13), 7],
  ]);

  const seven = buildRecentActivityTrend(counts, "7d", now);
  const fourteen = buildRecentActivityTrend(counts, "14d", now);
  const thirty = buildRecentActivityTrend(counts, "30d", now);

  assert.equal(seven.bars.length, 7);
  assert.equal(seven.total, 2);
  assert.equal(seven.bars.at(-1)?.count, 2);
  assert.equal(fourteen.bars.length, 14);
  assert.equal(fourteen.total, 5);
  assert.equal(fourteen.bars[0]?.count, 3);
  assert.equal(thirty.bars.length, 30);
  assert.equal(thirty.total, 10);
  assert.equal(thirty.bars[0]?.count, 5);
});

test("weekly and monthly ranges group unlocks without counting old or future days", () => {
  const now = new Date(2026, 2, 15, 12).getTime();
  const counts = new Map([
    [Date.UTC(2026, 2, 15), 2],
    [Date.UTC(2026, 2, 14), 3],
    [Date.UTC(2026, 0, 1), 5],
    [Date.UTC(2025, 2, 1), 7],
    [Date.UTC(2026, 2, 16), 11],
  ]);

  const weeks = buildRecentActivityTrend(counts, "12w", now);
  const months = buildRecentActivityTrend(counts, "12m", now);

  assert.equal(weeks.bars.length, 12);
  assert.equal(weeks.bars.at(-1)?.count, 5);
  assert.equal(weeks.total, 10);
  assert.equal(months.bars.length, 12);
  assert.equal(months.bars.at(-1)?.count, 5);
  assert.equal(months.bars[9]?.count, 5);
  assert.equal(months.total, 10);
});
