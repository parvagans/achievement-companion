import type { CompletionProgressSort } from "./decky-completion-progress-grouping";
import type { SteamGamesFilter } from "./decky-steam-full-screen-games-data";
import type { RetroAchievementsAchievementMode } from "@core/settings";

export interface DeckySteamGamesPageState {
  readonly filter: SteamGamesFilter;
  readonly focusGameId: string | undefined;
  readonly query: string;
  readonly renderLimit: number;
  readonly scrollTop: number;
  readonly sort: CompletionProgressSort;
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
  sort: CompletionProgressSort,
  mode: RetroAchievementsAchievementMode,
): void {
  const current = readDeckyGamesPageState(providerId);
  pageStates.set(providerId, { ...current, filter, focusGameId: undefined, query, renderLimit: 12, sort, mode });
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

export function resetDeckyGamesPageState(providerId: string): void {
  pageStates.delete(providerId);
}

export function readDeckySteamGamesPageState(): DeckySteamGamesPageState {
  return readDeckyGamesPageState("steam");
}

export function rememberDeckySteamGamesControls(
  filter: SteamGamesFilter,
  query: string,
  sort: CompletionProgressSort,
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
