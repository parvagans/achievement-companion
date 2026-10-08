import type {
  AchievementAvailabilityFilter,
  AchievementFilter,
  AchievementGroupFilter,
  AchievementModeFilter,
} from "./decky-full-screen-achievement-browser";
import type { DeckyFullScreenGameSectionId } from "./decky-full-screen-game-section-navigation";

export interface FullScreenGameSectionState {
  readonly scrollTop: number;
  readonly focusedId?: string;
}

export interface FullScreenGameAchievementSectionState extends FullScreenGameSectionState {
  readonly achievementFilter: AchievementFilter;
  readonly achievementModeFilter: AchievementModeFilter;
  readonly achievementGroupFilter: AchievementGroupFilter;
  readonly achievementAvailabilityFilter: AchievementAvailabilityFilter;
  readonly visibleAchievementIds: readonly string[];
}

export interface FullScreenGameAchievementGroupsSectionState extends FullScreenGameSectionState {
  readonly expandedGroupIds: readonly string[];
  readonly focusedGroupId?: string | undefined;
  readonly focusedAchievementId?: string | undefined;
}

export interface FullScreenGameSubsetsSectionState extends FullScreenGameSectionState {
  readonly focusedSubsetId?: string;
}

export interface FullScreenGameSectionPageState {
  readonly activeSection: DeckyFullScreenGameSectionId;
  readonly overview: FullScreenGameSectionState;
  readonly achievements: FullScreenGameAchievementSectionState;
  readonly "achievement-groups": FullScreenGameAchievementGroupsSectionState;
  readonly subsets: FullScreenGameSubsetsSectionState;
  readonly community: FullScreenGameSectionState;
  readonly restoreRequested: boolean;
}

const defaultSectionState: FullScreenGameSectionState = { scrollTop: 0 };
const defaultPageState: FullScreenGameSectionPageState = {
  activeSection: "overview",
  overview: defaultSectionState,
  achievements: {
    scrollTop: 0,
    achievementFilter: "all",
    achievementModeFilter: "all",
    achievementGroupFilter: "all",
    achievementAvailabilityFilter: "all",
    visibleAchievementIds: [],
  },
  "achievement-groups": { scrollTop: 0, expandedGroupIds: [] },
  subsets: { scrollTop: 0 },
  community: defaultSectionState,
  restoreRequested: false,
};

const sectionPageStates = new Map<string, FullScreenGameSectionPageState>();

function getKey(providerId: string, gameId: string): string {
  return `${providerId}:${gameId}`;
}

export function readFullScreenGameSectionPageState(providerId: string, gameId: string): FullScreenGameSectionPageState {
  return sectionPageStates.get(getKey(providerId, gameId)) ?? defaultPageState;
}

export function updateFullScreenGameSectionPageState(
  providerId: string,
  gameId: string,
  update: (current: FullScreenGameSectionPageState) => FullScreenGameSectionPageState,
): FullScreenGameSectionPageState {
  const next = update(readFullScreenGameSectionPageState(providerId, gameId));
  sectionPageStates.set(getKey(providerId, gameId), next);
  return next;
}

export function resetFullScreenGameSectionActiveSection(providerId: string, gameId: string): void {
  updateFullScreenGameSectionPageState(providerId, gameId, (current) => ({ ...current, activeSection: "overview" }));
}

export function resetFullScreenGameSectionPageStates(): void {
  sectionPageStates.clear();
}

export function requestFullScreenGameSectionRestoration(providerId: string, gameId: string): void {
  updateFullScreenGameSectionPageState(providerId, gameId, (current) => ({ ...current, restoreRequested: true }));
}

export function consumeFullScreenGameSectionRestoration(providerId: string, gameId: string): boolean {
  const current = readFullScreenGameSectionPageState(providerId, gameId);
  if (!current.restoreRequested) return false;
  sectionPageStates.set(getKey(providerId, gameId), { ...current, restoreRequested: false });
  return true;
}

export function selectFullScreenGameAchievementRestorationTarget({
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

  const previousIndex = focusedAchievementId === undefined ? -1 : previousVisibleAchievementIds.indexOf(focusedAchievementId);
  for (let distance = 1; previousIndex >= 0 && distance < previousVisibleAchievementIds.length; distance += 1) {
    const before = previousVisibleAchievementIds[previousIndex - distance];
    if (before !== undefined && currentVisibleAchievementIds.includes(before)) return before;
    const after = previousVisibleAchievementIds[previousIndex + distance];
    if (after !== undefined && currentVisibleAchievementIds.includes(after)) return after;
  }

  return currentVisibleAchievementIds[0];
}

export function resetFullScreenGameSectionPageStatesForTests(): void {
  resetFullScreenGameSectionPageStates();
}
