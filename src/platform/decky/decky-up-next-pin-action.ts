import type { RetroAchievementsAchievementMode } from "@core/settings";
import { isAchievementCompleteForPin, type GameOverviewSuggestion } from "./decky-game-overview-recommendations";

export interface UpNextPinAction {
  readonly label: "Pin" | "Unpin";
  readonly menuLabel: "Set as Up Next" | "Remove from Up Next";
  readonly pinned: boolean;
  readonly activate: () => void;
  readonly onOptionsButton: (event: { preventDefault(): void; stopPropagation(): void; readonly detail: { readonly is_repeat?: boolean } }) => void;
}

/** Every direct control and native Y footer derives from the resolved preference-backed suggestion. */
export function createUpNextPinAction(suggestion: GameOverviewSuggestion | undefined, mode: RetroAchievementsAchievementMode, toggle: ((id: string) => void) | undefined): UpNextPinAction | undefined {
  if (suggestion === undefined || toggle === undefined || !suggestion.pinned && isAchievementCompleteForPin(suggestion.achievement, mode)) return undefined;
  const activate = (): void => toggle(suggestion.achievement.achievementId);
  return {
    label: suggestion.pinned ? "Unpin" : "Pin",
    menuLabel: suggestion.pinned ? "Remove from Up Next" : "Set as Up Next",
    pinned: suggestion.pinned === true,
    activate,
    onOptionsButton: (event) => { event.preventDefault(); event.stopPropagation(); if (!event.detail.is_repeat) activate(); },
  };
}
