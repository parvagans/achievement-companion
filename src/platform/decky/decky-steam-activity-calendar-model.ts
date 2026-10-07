import { ACTIVITY_CALENDAR_WEEK_OPTIONS, type ActivityCalendarWeeks } from "@core/settings";
import {
  buildActivityCalendarModel,
  getActivityCalendarIntensity,
  resolveActivityCalendarWeeks,
  type ActivityCalendarDay,
  type ActivityCalendarIntensity,
  type ActivityCalendarModel,
} from "./decky-activity-calendar-model";

export const STEAM_ACTIVITY_CALENDAR_WEEK_OPTIONS = ACTIVITY_CALENDAR_WEEK_OPTIONS;
export const DEFAULT_STEAM_ACTIVITY_CALENDAR_WEEKS: SteamActivityCalendarWeeks = 12;

export type SteamActivityCalendarWeeks = ActivityCalendarWeeks;
export type SteamActivityCalendarIntensity = ActivityCalendarIntensity;
export type SteamActivityCalendarDay = ActivityCalendarDay;
export type SteamActivityCalendarModel = ActivityCalendarModel;

export const resolveSteamActivityCalendarWeeks = resolveActivityCalendarWeeks;
export const getSteamActivityCalendarIntensity = getActivityCalendarIntensity;

export function buildSteamActivityCalendarModel(
  dayCounts: ReadonlyMap<number, number>,
  weeks: SteamActivityCalendarWeeks = DEFAULT_STEAM_ACTIVITY_CALENDAR_WEEKS,
  now = Date.now(),
): SteamActivityCalendarModel {
  return buildActivityCalendarModel(dayCounts, weeks, now);
}
