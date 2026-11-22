import type { RetroAchievementsAchievementMode } from "@core/settings";
import { isAchievementCompleteForPin, type GameOverviewSuggestion } from "./decky-game-overview-recommendations";

export interface UpNextPinAction {
  readonly label: "Pin" | "Unpin";
  readonly menuLabel: "Set as Up Next" | "Remove from Up Next" | "Pin in Steam" | "Unpin in Steam";
  readonly pinned: boolean;
  readonly activate: () => void;
  readonly onOptionsButton: (event: { preventDefault(): void; stopPropagation(): void; readonly detail: { readonly is_repeat?: boolean } }) => void;
}

/** Every direct control and native Y footer derives from the resolved preference-backed suggestion. */
export function createUpNextPinAction(suggestion: GameOverviewSuggestion | undefined, mode: RetroAchievementsAchievementMode, toggle: ((id: string) => void) | undefined): UpNextPinAction | undefined {
  if (suggestion === undefined || toggle === undefined || !suggestion.pinned && isAchievementCompleteForPin(suggestion.achievement, mode)) return undefined;
  return createUpNextPinToggleAction(suggestion.achievement.achievementId, suggestion.pinned === true, toggle, suggestion.achievement.providerId);
}

export function createUpNextPinToggleAction(achievementId: string, pinned: boolean, toggle: (id: string) => void, providerId?: string): UpNextPinAction {
  const activate = (): void => toggle(achievementId);
  const menuLabel = providerId === "steam" ? pinned ? "Unpin in Steam" : "Pin in Steam" : pinned ? "Remove from Up Next" : "Set as Up Next";
  return {
    label: pinned ? "Unpin" : "Pin",
    menuLabel,
    pinned,
    activate,
    onOptionsButton: (event) => { event.preventDefault(); event.stopPropagation(); if (!event.detail.is_repeat) activate(); },
  };
}
