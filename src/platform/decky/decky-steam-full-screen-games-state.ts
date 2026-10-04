import type { CompletionProgressSort } from "./decky-completion-progress-grouping";
import type { SteamGamesFilter } from "./decky-steam-full-screen-games-data";

export interface DeckySteamGamesPageState {
  readonly filter: SteamGamesFilter;
  readonly focusGameId: string | undefined;
  readonly query: string;
  readonly renderLimit: number;
  readonly sort: CompletionProgressSort;
}

const initialState: DeckySteamGamesPageState = {
  filter: "all",
  focusGameId: undefined,
  query: "",
  renderLimit: 12,
  sort: "recent",
};

let pageState = initialState;

export function readDeckySteamGamesPageState(): DeckySteamGamesPageState {
  return pageState;
}

export function rememberDeckySteamGamesControls(
  filter: SteamGamesFilter,
  query: string,
  sort: CompletionProgressSort,
): void {
  pageState = { ...pageState, filter, focusGameId: undefined, query, renderLimit: 12, sort };
}

export function rememberDeckySteamGamesFocus(gameId: string): void {
  pageState = { ...pageState, focusGameId: gameId };
}

export function rememberDeckySteamGamesRenderLimit(renderLimit: number): void {
  pageState = { ...pageState, renderLimit };
}

export function resetDeckySteamGamesPageState(): void {
  pageState = initialState;
}

