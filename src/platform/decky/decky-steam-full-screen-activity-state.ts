import type { AchievementUnlockMode } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";

export type DeckySteamActivityFilter = "all" | "recent" | "year" | "month" | "streak";

export interface DeckySteamActivityFocusTarget {
  readonly achievementId: string;
  readonly gameId: string;
  readonly unlockMode?: AchievementUnlockMode;
  readonly unlockedAt?: number;
}

interface DeckySteamActivityPageState {
  readonly filter: DeckySteamActivityFilter;
  readonly focusTarget: DeckySteamActivityFocusTarget | undefined;
  readonly renderLimit: number;
  readonly selectedGameId: string | undefined;
  readonly selectedCalendarDay: number | undefined;
  readonly scrollTop: number;
  readonly mode: RetroAchievementsAchievementMode;
}

const initialState: DeckySteamActivityPageState = {
  filter: "all",
  focusTarget: undefined,
  renderLimit: 24,
  selectedGameId: undefined,
  selectedCalendarDay: undefined,
  scrollTop: 0,
  mode: "both",
};

const pageStates = new Map<string, DeckySteamActivityPageState>();

export function readDeckyActivityPageState(providerId: string): DeckySteamActivityPageState {
  return pageStates.get(providerId) ?? initialState;
}

export function rememberDeckyActivityFilter(
  providerId: string,
  filter: DeckySteamActivityFilter,
  mode: RetroAchievementsAchievementMode,
): void {
  const current = readDeckyActivityPageState(providerId);
  pageStates.set(providerId, {
    ...current,
    filter,
    focusTarget: undefined,
    renderLimit: 24,
    selectedCalendarDay: undefined,
    scrollTop: 0,
    mode,
  });
}

export function rememberDeckyActivityCalendarDay(providerId: string, selectedCalendarDay: number | undefined): void {
  const current = readDeckyActivityPageState(providerId);
  pageStates.set(providerId, {
    ...current,
    filter: selectedCalendarDay === undefined ? current.filter : "all",
    focusTarget: undefined,
    renderLimit: 24,
    selectedCalendarDay,
    scrollTop: 0,
  });
}

export function rememberDeckyActivityGame(providerId: string, selectedGameId: string | undefined): void {
  pageStates.set(providerId, {
    ...readDeckyActivityPageState(providerId),
    selectedGameId,
    focusTarget: undefined,
    renderLimit: 24,
    scrollTop: 0,
  });
}

export function rememberDeckyActivityRenderLimit(providerId: string, renderLimit: number): void {
  pageStates.set(providerId, { ...readDeckyActivityPageState(providerId), renderLimit });
}

export function rememberDeckyActivityFocusTarget(providerId: string, focusTarget: DeckySteamActivityFocusTarget): void {
  pageStates.set(providerId, { ...readDeckyActivityPageState(providerId), focusTarget });
}

export function rememberDeckyActivityScrollTop(providerId: string, scrollTop: number): void {
  pageStates.set(providerId, { ...readDeckyActivityPageState(providerId), scrollTop: Math.max(0, scrollTop) });
}

export function resetDeckyActivityPageState(providerId: string): void {
  pageStates.delete(providerId);
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
