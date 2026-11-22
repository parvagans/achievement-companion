import type { GameOverviewSuggestion, RetroAchievementsGameGoal } from "./decky-game-overview-recommendations";

/** Selection source is resolved by the shared recommendation model, never a local UI flag. */
export function resolveDeckyUpNextLabel(suggestion: GameOverviewSuggestion | undefined, providerId: string, goal: RetroAchievementsGameGoal): string {
  if (suggestion?.automaticSteamTarget) return "UP NEXT · STEAM PIN";
  return suggestion?.pinned ? "UP NEXT · PINNED" : providerId === "retroachievements" ? `UP NEXT · ${goal.toUpperCase()}` : "UP NEXT";
}
