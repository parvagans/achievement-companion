import type { SteamGamesFilter, SteamGamesSort } from "./decky-steam-full-screen-games-data";
import type { RetroAchievementsAchievementMode } from "@core/settings";

export interface DeckySteamGamesPageState {
  readonly filter: SteamGamesFilter;
  readonly focusGameId: string | undefined;
  readonly query: string;
  readonly renderLimit: number;
  readonly scrollTop: number;
  readonly sort: SteamGamesSort;
  readonly mode: RetroAchievementsAchievementMode;
  readonly system: { readonly systemId: string; readonly title: string } | undefined;
}

const initialState: DeckySteamGamesPageState = {
  filter: "all",
  focusGameId: undefined,
  query: "",
  renderLimit: 12,
  scrollTop: 0,
  sort: "recent",
  mode: "both",
  system: undefined,
};

const pageStates = new Map<string, DeckySteamGamesPageState>();

export function readDeckyGamesPageState(providerId: string): DeckySteamGamesPageState {
  return pageStates.get(providerId) ?? initialState;
}

export function rememberDeckyGamesControls(
  providerId: string,
  filter: SteamGamesFilter,
  query: string,
  sort: SteamGamesSort,
  mode: RetroAchievementsAchievementMode,
): void {
  const current = readDeckyGamesPageState(providerId);
  pageStates.set(providerId, { ...current, filter, focusGameId: undefined, query, renderLimit: 12, scrollTop: 0, sort, mode });
}

/** A Profile shortcut starts a fresh Games view; subsequent tab visits read the saved controls. */
export function rememberDeckyGamesProfileShortcut(
  providerId: string,
  filter: SteamGamesFilter,
): void {
  pageStates.set(providerId, {
    ...readDeckyGamesPageState(providerId),
    filter,
    focusGameId: undefined,
    query: "",
    renderLimit: 12,
    scrollTop: 0,
    sort: "recent",
    system: undefined,
  });
}

export function rememberDeckyGamesFocus(providerId: string, gameId: string): void {
  pageStates.set(providerId, { ...readDeckyGamesPageState(providerId), focusGameId: gameId });
}

export function rememberDeckyGamesRenderLimit(providerId: string, renderLimit: number): void {
  pageStates.set(providerId, { ...readDeckyGamesPageState(providerId), renderLimit });
}

export function rememberDeckyGamesScrollTop(providerId: string, scrollTop: number): void {
  pageStates.set(providerId, { ...readDeckyGamesPageState(providerId), scrollTop: Math.max(0, scrollTop) });
}

export function rememberDeckyGamesSystem(
  providerId: string,
  system: DeckySteamGamesPageState["system"],
): void {
  pageStates.set(providerId, {
    ...readDeckyGamesPageState(providerId),
    filter: "all",
    focusGameId: undefined,
    query: "",
    renderLimit: 12,
    scrollTop: 0,
    sort: "recent",
    system,
  });
}

/** Local system selection composes with the current search, status and sort. */
export function rememberDeckyGamesSystemFilter(
  providerId: string,
  system: DeckySteamGamesPageState["system"],
): void {
  pageStates.set(providerId, {
    ...readDeckyGamesPageState(providerId),
    focusGameId: undefined,
    renderLimit: 12,
    scrollTop: 0,
    system,
  });
}

export function resetDeckyGamesPageState(providerId: string): void {
  pageStates.delete(providerId);
}

export function readDeckySteamGamesPageState(): DeckySteamGamesPageState {
  return readDeckyGamesPageState("steam");
}

export function rememberDeckySteamGamesControls(
  filter: SteamGamesFilter,
  query: string,
  sort: SteamGamesSort,
): void {
  rememberDeckyGamesControls("steam", filter, query, sort, "both");
}

export function rememberDeckySteamGamesFocus(gameId: string): void {
  rememberDeckyGamesFocus("steam", gameId);
}

export function rememberDeckySteamGamesRenderLimit(renderLimit: number): void {
  rememberDeckyGamesRenderLimit("steam", renderLimit);
}

export function resetDeckySteamGamesPageState(): void {
  resetDeckyGamesPageState("steam");
}
