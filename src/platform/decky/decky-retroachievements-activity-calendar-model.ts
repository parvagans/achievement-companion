import type { RecentUnlock } from "@core/domain";
import type { ActivityCalendarWeeks, RetroAchievementsAchievementMode } from "@core/settings";
import {
  buildActivityCalendarModel,
  getLocalActivityCalendarDayTimestamp,
  type ActivityCalendarModel,
} from "./decky-activity-calendar-model";

export const RETROACHIEVEMENTS_ACTIVITY_CALENDAR_WEEKS: ActivityCalendarWeeks = 8;

export function buildRetroAchievementsActivityCalendarModel(args: {
  readonly entries: readonly RecentUnlock[];
  readonly achievementMode: RetroAchievementsAchievementMode;
  readonly weeks?: ActivityCalendarWeeks;
  readonly now?: number;
}): ActivityCalendarModel {
  const dayCounts = new Map<number, number>();
  for (const entry of args.entries) {
    if (args.achievementMode === "hardcore" && entry.achievement.unlockMode !== "hardcore") continue;
    if (args.achievementMode === "softcore" && entry.achievement.unlockMode !== "softcore") continue;
    const unlockedAt = entry.unlockedAt ?? entry.achievement.unlockedAt;
    if (unlockedAt === undefined || !Number.isFinite(unlockedAt)) continue;
    const day = getLocalActivityCalendarDayTimestamp(unlockedAt);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }

  return buildActivityCalendarModel(
    dayCounts,
    args.weeks ?? RETROACHIEVEMENTS_ACTIVITY_CALENDAR_WEEKS,
    args.now,
  );
}
