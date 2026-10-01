import type { ProviderId } from "@core/domain";
import type {
  CompactAchievementFilter,
  CompactAchievementModeFilter,
} from "./decky-compact-achievement-model";

export interface DeckyCompactAchievementPageState {
  readonly filter: CompactAchievementFilter;
  readonly modeFilter: CompactAchievementModeFilter;
  readonly visibleCount: number;
  readonly focusedAchievementId: string | undefined;
  readonly scrollTop: number;
}

const pageStateByGame = new Map<string, DeckyCompactAchievementPageState>();

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
  return pageStateByGame.get(getDeckyCompactAchievementPageStateKey(providerId, gameId)) ?? {
    filter: "all",
    modeFilter: "all",
    visibleCount: initialVisibleCount,
    focusedAchievementId: undefined,
    scrollTop: 0,
  };
}

export function writeDeckyCompactAchievementPageState(
  providerId: ProviderId,
  gameId: string,
  state: DeckyCompactAchievementPageState,
): void {
  pageStateByGame.set(getDeckyCompactAchievementPageStateKey(providerId, gameId), state);
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

export function resetDeckyCompactAchievementPageState(): void {
  pageStateByGame.clear();
}
