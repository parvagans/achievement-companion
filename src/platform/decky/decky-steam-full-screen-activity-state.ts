import type { AchievementUnlockMode } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { activityCalendarPeriod } from "./decky-full-screen-activity-model";

export type DeckySteamActivityFilter = "all" | "recent" | "week" | "year" | "month" | "streak";
export type ActivitySubview = "activity" | "analytics";
export interface ActivitySelectedPeriod {
  readonly startDay: number;
  readonly endDayExclusive: number;
  readonly label: string;
  readonly source: "calendar" | "trend";
  readonly interval: "day" | "week" | "month";
}

export interface DeckySteamActivityFocusTarget {
  readonly achievementId: string;
  readonly gameId: string;
  readonly unlockMode?: AchievementUnlockMode;
  readonly unlockedAt?: number;
}

export interface DeckySteamActivityPageState {
  readonly filter: DeckySteamActivityFilter;
  readonly focusTarget: DeckySteamActivityFocusTarget | undefined;
  readonly renderLimit: number;
  readonly selectedGameId: string | undefined;
  readonly selectedPeriod: ActivitySelectedPeriod | undefined;
  readonly scrollTop: number;
  readonly mode: RetroAchievementsAchievementMode;
  readonly subview: ActivitySubview;
  readonly sort: "desc" | "asc";
  readonly analyticsScrollTop: number;
  readonly analyticsFocusKey: string | undefined;
}

const initialState: DeckySteamActivityPageState = {
  filter: "all",
  focusTarget: undefined,
  renderLimit: 24,
  selectedGameId: undefined,
  selectedPeriod: undefined,
  scrollTop: 0,
  mode: "both",
  subview: "activity",
  sort: "desc",
  analyticsScrollTop: 0,
  analyticsFocusKey: undefined,
};

const pageStates = new Map<string, DeckySteamActivityPageState>();
const listeners = new Set<() => void>();

export function subscribeDeckyActivityPageState(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function save(providerId: string, state: DeckySteamActivityPageState): void {
  pageStates.set(providerId, state);
  listeners.forEach((listener) => listener());
}

const resetResults = { focusTarget: undefined, renderLimit: 24, scrollTop: 0, analyticsScrollTop: 0, analyticsFocusKey: undefined };

export function hasActivityTemporaryFilters(state: DeckySteamActivityPageState): boolean {
  return state.filter !== "all" || state.selectedGameId !== undefined || state.selectedPeriod !== undefined;
}

export function clearDeckyActivityFilters(providerId: string): void {
  save(providerId, { ...readDeckyActivityPageState(providerId), ...resetResults, filter: "all", selectedPeriod: undefined, selectedGameId: undefined });
}

export function rememberDeckyActivitySubview(providerId: string, subview: ActivitySubview): void {
  save(providerId, { ...readDeckyActivityPageState(providerId), subview });
}

export function rememberDeckyActivityPeriod(providerId: string, selectedPeriod: ActivitySelectedPeriod): void {
  save(providerId, { ...readDeckyActivityPageState(providerId), ...resetResults, filter: "all", selectedPeriod, subview: "activity" });
}

export function rememberDeckyActivityMode(providerId: string, mode: RetroAchievementsAchievementMode): void {
  save(providerId, { ...readDeckyActivityPageState(providerId), ...resetResults, mode });
}

export function rememberDeckyActivitySort(providerId: string, sort: "asc" | "desc"): void {
  save(providerId, { ...readDeckyActivityPageState(providerId), ...resetResults, sort });
}

export function rememberDeckyActivityAnalyticsFocus(providerId: string, analyticsFocusKey: string): void {
  const current = readDeckyActivityPageState(providerId);
  if (current.analyticsFocusKey !== analyticsFocusKey) save(providerId, { ...current, analyticsFocusKey });
}

export function readDeckyActivityPageState(providerId: string): DeckySteamActivityPageState {
  return pageStates.get(providerId) ?? initialState;
}

export function rememberDeckyActivityFilter(
  providerId: string,
  filter: DeckySteamActivityFilter,
  mode = readDeckyActivityPageState(providerId).mode,
): void {
  const current = readDeckyActivityPageState(providerId);
  save(providerId, {
    ...current,
    ...resetResults,
    filter,
    selectedPeriod: undefined,
    mode,
  });
}

export function rememberDeckyActivityCalendarDay(providerId: string, selectedCalendarDay: number | undefined): void {
  if (selectedCalendarDay !== undefined) rememberDeckyActivityPeriod(providerId, activityCalendarPeriod(selectedCalendarDay));
  else save(providerId, { ...readDeckyActivityPageState(providerId), ...resetResults, selectedPeriod: undefined });
}

export function rememberDeckyActivityGame(providerId: string, selectedGameId: string | undefined): void {
  save(providerId, {
    ...readDeckyActivityPageState(providerId),
    ...resetResults,
    selectedGameId,
  });
}

export function rememberDeckyActivityRenderLimit(providerId: string, renderLimit: number): void {
  save(providerId, { ...readDeckyActivityPageState(providerId), renderLimit });
}

export function rememberDeckyActivityFocusTarget(providerId: string, focusTarget: DeckySteamActivityFocusTarget): void {
  const current = readDeckyActivityPageState(providerId);
  if (JSON.stringify(current.focusTarget) !== JSON.stringify(focusTarget)) save(providerId, { ...current, focusTarget });
}

export function rememberDeckyActivityScrollTop(providerId: string, scrollTop: number, subview: ActivitySubview = "activity"): void {
  const current = readDeckyActivityPageState(providerId);
  const key = subview === "activity" ? "scrollTop" : "analyticsScrollTop";
  const value = Math.max(0, scrollTop);
  if (current[key] !== value) save(providerId, { ...current, [key]: value });
}

export function resetDeckyActivityPageState(providerId: string): void {
  pageStates.delete(providerId);
  listeners.forEach((listener) => listener());
}

export function readDeckySteamActivityPageState(): DeckySteamActivityPageState {
  return readDeckyActivityPageState("steam");
}

export function rememberDeckySteamActivityFilter(filter: DeckySteamActivityFilter): void {
  rememberDeckyActivityFilter("steam", filter, "both");
}

export function rememberDeckySteamActivityCalendarDay(selectedCalendarDay: number | undefined): void {
  rememberDeckyActivityCalendarDay("steam", selectedCalendarDay);
}

export function rememberDeckySteamActivityRenderLimit(renderLimit: number): void {
  rememberDeckyActivityRenderLimit("steam", renderLimit);
}

export function rememberDeckySteamActivityFocusTarget(focusTarget: DeckySteamActivityFocusTarget): void {
  rememberDeckyActivityFocusTarget("steam", focusTarget);
}

export function resetDeckySteamActivityPageState(): void {
  resetDeckyActivityPageState("steam");
}
