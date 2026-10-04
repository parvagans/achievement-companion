export type DeckySteamActivityFilter = "all" | "recent" | "year" | "month" | "streak";

export interface DeckySteamActivityFocusTarget {
  readonly achievementId: string;
  readonly gameId: string;
}

interface DeckySteamActivityPageState {
  readonly filter: DeckySteamActivityFilter;
  readonly focusTarget: DeckySteamActivityFocusTarget | undefined;
  readonly renderLimit: number;
}

const initialState: DeckySteamActivityPageState = {
  filter: "all",
  focusTarget: undefined,
  renderLimit: 12,
};

let pageState = initialState;

export function readDeckySteamActivityPageState(): DeckySteamActivityPageState {
  return pageState;
}

export function rememberDeckySteamActivityFilter(filter: DeckySteamActivityFilter): void {
  pageState = { filter, focusTarget: undefined, renderLimit: 12 };
}

export function rememberDeckySteamActivityRenderLimit(renderLimit: number): void {
  pageState = { ...pageState, renderLimit };
}

export function rememberDeckySteamActivityFocusTarget(focusTarget: DeckySteamActivityFocusTarget): void {
  pageState = { ...pageState, focusTarget };
}

export function resetDeckySteamActivityPageState(): void {
  pageState = initialState;
}

