import type { GamePageAchievementBadgeSize } from "@core/settings";
import type { DeckyGamePageAchievementBadgeVariant } from "./decky-game-page-achievement-badge-presentation";

export const MINIMAL_GAME_PAGE_BADGE_DIMENSIONS = {
  small: { width: 168, height: 32, font: 10, providerIcon: 15, statusIcon: 17, gap: 5, padding: 8 },
  medium: { width: 188, height: 38, font: 11, providerIcon: 18, statusIcon: 20, gap: 6, padding: 9 },
  large: { width: 208, height: 44, font: 12, providerIcon: 21, statusIcon: 23, gap: 7, padding: 11 },
} as const;

export type MinimalGamePageBadgeDimensions =
  (typeof MINIMAL_GAME_PAGE_BADGE_DIMENSIONS)[GamePageAchievementBadgeSize];

export type MinimalGamePageBadgeStatusIcon = "crown-laurel" | "flag" | undefined;

export function resolveMinimalGamePageBadgeStatusIcon(
  variant: DeckyGamePageAchievementBadgeVariant,
): MinimalGamePageBadgeStatusIcon {
  if (variant === "mastered" || variant === "perfected") return "crown-laurel";
  if (variant === "beaten") return "flag";
  return undefined;
}
