import type { ProviderId } from "@core/domain";
import type {
  CompactAchievementDisplayMode,
  CompactAchievementFilter,
  CompactAchievementModeFilter,
  CompactAchievementSort,
} from "./decky-compact-achievement-model";

export interface DeckyCompactAchievementPageState {
  readonly filter: CompactAchievementFilter;
  readonly modeFilter: CompactAchievementModeFilter;
  readonly searchQuery: string;
  readonly sort: CompactAchievementSort;
  readonly displayMode: CompactAchievementDisplayMode;
  readonly visibleCount: number;
  readonly focusedAchievementId: string | undefined;
  readonly scrollTop: number;
}

export type DeckyCompactAchievementPageStateInput = Omit<
  DeckyCompactAchievementPageState,
  "searchQuery" | "sort" | "displayMode"
> & Partial<Pick<
  DeckyCompactAchievementPageState,
  "searchQuery" | "sort" | "displayMode"
>>;

export interface DeckyCompactAchievementRevealRequest {
  readonly achievementId: string;
  readonly requestId: number;
}

const pageStateByGame = new Map<string, DeckyCompactAchievementPageState>();
const revealRequestByGame = new Map<string, DeckyCompactAchievementRevealRequest>();
let nextRevealRequestId = 1;

function getDefaultDeckyCompactAchievementPageState(
  initialVisibleCount: number,
): DeckyCompactAchievementPageState {
  return {
    filter: "all",
    modeFilter: "all",
    searchQuery: "",
    sort: "default",
    displayMode: "detailed",
    visibleCount: initialVisibleCount,
    focusedAchievementId: undefined,
    scrollTop: 0,
  };
}

function normalizeDeckyCompactAchievementPageState(
  state: DeckyCompactAchievementPageStateInput,
): DeckyCompactAchievementPageState {
  return {
    ...state,
    searchQuery: state.searchQuery ?? "",
    sort: state.sort ?? "default",
    displayMode: state.displayMode ?? "detailed",
  };
}

export function getDeckyCompactAchievementPageStateKey(
  providerId: ProviderId,
  gameId: string,
): string {
  return `${providerId}:${gameId}`;
}

export function readDeckyCompactAchievementPageState(
  providerId: ProviderId,
  gameId: string,
  initialVisibleCount: number,
): DeckyCompactAchievementPageState {
  return pageStateByGame.get(getDeckyCompactAchievementPageStateKey(providerId, gameId))
    ?? getDefaultDeckyCompactAchievementPageState(initialVisibleCount);
}

export function writeDeckyCompactAchievementPageState(
  providerId: ProviderId,
  gameId: string,
  state: DeckyCompactAchievementPageStateInput,
): void {
  pageStateByGame.set(
    getDeckyCompactAchievementPageStateKey(providerId, gameId),
    normalizeDeckyCompactAchievementPageState(state),
  );
}

export function updateDeckyCompactAchievementPageState(
  providerId: ProviderId,
  gameId: string,
  initialVisibleCount: number,
  update: (
    current: DeckyCompactAchievementPageState,
  ) => DeckyCompactAchievementPageState,
): DeckyCompactAchievementPageState {
  const next = update(readDeckyCompactAchievementPageState(providerId, gameId, initialVisibleCount));
  writeDeckyCompactAchievementPageState(providerId, gameId, next);
  return next;
}

/**
 * Requests one achievement to be revealed on the next compact-list entry.
 *
 * This intentionally lives beside, rather than inside, the remembered page
 * state: Up Next navigation must be able to bypass a hiding filter or search
 * without overwriting the user's provider/game-scoped browsing preferences.
 */
export function requestDeckyCompactAchievementReveal(
  providerId: ProviderId,
  gameId: string,
  achievementId: string,
): DeckyCompactAchievementRevealRequest {
  const request = {
    achievementId,
    requestId: nextRevealRequestId,
  } satisfies DeckyCompactAchievementRevealRequest;
  nextRevealRequestId += 1;
  revealRequestByGame.set(getDeckyCompactAchievementPageStateKey(providerId, gameId), request);
  return request;
}

export function readDeckyCompactAchievementRevealRequest(
  providerId: ProviderId,
  gameId: string,
): DeckyCompactAchievementRevealRequest | undefined {
  return revealRequestByGame.get(getDeckyCompactAchievementPageStateKey(providerId, gameId));
}

export function clearDeckyCompactAchievementRevealRequest(
  providerId: ProviderId,
  gameId: string,
  requestId?: number,
): void {
  const key = getDeckyCompactAchievementPageStateKey(providerId, gameId);
  if (requestId !== undefined && revealRequestByGame.get(key)?.requestId !== requestId) {
    return;
  }
  revealRequestByGame.delete(key);
}

export function resetDeckyCompactAchievementPageState(): void {
  pageStateByGame.clear();
  revealRequestByGame.clear();
  nextRevealRequestId = 1;
}
