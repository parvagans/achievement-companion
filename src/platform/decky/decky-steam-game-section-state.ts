import type { AchievementFilter, AchievementModeFilter } from "./decky-full-screen-achievement-browser";
import type { DeckySteamGameSectionId } from "./decky-steam-game-section-navigation";

export interface SteamGameSectionState {
  readonly scrollTop: number;
  readonly focusedId?: string;
}

export interface SteamGameAchievementSectionState extends SteamGameSectionState {
  readonly achievementFilter: AchievementFilter;
  readonly achievementModeFilter: AchievementModeFilter;
  /** Stable ids, retained only to select a sensible neighbour after a refresh. */
  readonly visibleAchievementIds: readonly string[];
}

export interface SteamGameSectionPageState {
  readonly activeSection: DeckySteamGameSectionId;
  readonly overview: SteamGameSectionState;
  readonly achievements: SteamGameAchievementSectionState;
  readonly community: SteamGameSectionState;
  readonly restoreRequested: boolean;
}

const defaultSectionState: SteamGameSectionState = { scrollTop: 0 };
const defaultPageState: SteamGameSectionPageState = {
  activeSection: "overview",
  overview: defaultSectionState,
  achievements: {
    scrollTop: 0,
    achievementFilter: "all",
    achievementModeFilter: "all",
    visibleAchievementIds: [],
  },
  community: defaultSectionState,
  restoreRequested: false,
};

const sectionPageStates = new Map<string, SteamGameSectionPageState>();

function getKey(providerId: string, gameId: string): string {
  return `${providerId}:${gameId}`;
}

export function readSteamGameSectionPageState(providerId: string, gameId: string): SteamGameSectionPageState {
  return sectionPageStates.get(getKey(providerId, gameId)) ?? defaultPageState;
}

export function updateSteamGameSectionPageState(
  providerId: string,
  gameId: string,
  update: (current: SteamGameSectionPageState) => SteamGameSectionPageState,
): SteamGameSectionPageState {
  const next = update(readSteamGameSectionPageState(providerId, gameId));
  sectionPageStates.set(getKey(providerId, gameId), next);
  return next;
}

export function requestSteamGameSectionRestoration(providerId: string, gameId: string): void {
  updateSteamGameSectionPageState(providerId, gameId, (current) => ({ ...current, restoreRequested: true }));
}

export function consumeSteamGameSectionRestoration(providerId: string, gameId: string): boolean {
  const current = readSteamGameSectionPageState(providerId, gameId);
  if (!current.restoreRequested) {
    return false;
  }

  sectionPageStates.set(getKey(providerId, gameId), { ...current, restoreRequested: false });
  return true;
}

export function selectSteamAchievementRestorationTarget({
  focusedAchievementId,
  previousVisibleAchievementIds,
  currentVisibleAchievementIds,
}: {
  readonly focusedAchievementId: string | undefined;
  readonly previousVisibleAchievementIds: readonly string[];
  readonly currentVisibleAchievementIds: readonly string[];
}): string | undefined {
  if (focusedAchievementId !== undefined && currentVisibleAchievementIds.includes(focusedAchievementId)) {
    return focusedAchievementId;
  }

  const previousIndex = focusedAchievementId === undefined
    ? -1
    : previousVisibleAchievementIds.indexOf(focusedAchievementId);
  for (let distance = 1; previousIndex >= 0 && distance < previousVisibleAchievementIds.length; distance += 1) {
    const before = previousVisibleAchievementIds[previousIndex - distance];
    if (before !== undefined && currentVisibleAchievementIds.includes(before)) {
      return before;
    }
    const after = previousVisibleAchievementIds[previousIndex + distance];
    if (after !== undefined && currentVisibleAchievementIds.includes(after)) {
      return after;
    }
  }

  return currentVisibleAchievementIds[0];
}

export function resetSteamGameSectionPageStatesForTests(): void {
  sectionPageStates.clear();
}
