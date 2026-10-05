import {
  DEFAULT_GAME_PAGE_ACHIEVEMENT_BADGE_COLORS,
  type GamePageAchievementBadgeColor,
  type GamePageAchievementBadgeColors,
} from "@core/settings";
import type { DeckyGamePageAchievementBadgeVariant } from "./decky-game-page-achievement-badge-presentation";

export interface DeckyGamePageAchievementBadgePalette {
  readonly accent: string;
  readonly accentBright: string;
  readonly border: string;
  readonly surface: string;
  readonly surfaceDeep: string;
  readonly track: string;
  readonly glow: string;
}

const badgeColorPalettes: Readonly<
  Record<GamePageAchievementBadgeColor, DeckyGamePageAchievementBadgePalette>
> = {
  purple: {
    accent: "#d633ff",
    accentBright: "#f2a2ff",
    border: "#f4dcff",
    surface: "#5c067f",
    surfaceDeep: "#19002f",
    track: "rgba(104, 25, 137, 0.78)",
    glow: "rgba(207, 44, 255, 0.76)",
  },
  blue: {
    accent: "#00b7ff",
    accentBright: "#85e8ff",
    border: "#e0f8ff",
    surface: "#004ea5",
    surfaceDeep: "#001438",
    track: "rgba(0, 53, 115, 0.88)",
    glow: "rgba(0, 184, 255, 0.72)",
  },
  green: {
    accent: "#28ef72",
    accentBright: "#a0ffc1",
    border: "#ddffe8",
    surface: "#00743b",
    surfaceDeep: "#002918",
    track: "rgba(0, 82, 42, 0.86)",
    glow: "rgba(39, 244, 112, 0.72)",
  },
  gray: {
    accent: "#b5d8f6",
    accentBright: "#edf7ff",
    border: "#eef8ff",
    surface: "#26394f",
    surfaceDeep: "#0d1726",
    track: "rgba(53, 72, 94, 0.9)",
    glow: "rgba(190, 221, 247, 0.42)",
  },
  cyan: {
    accent: "#20e5ff",
    accentBright: "#b8f8ff",
    border: "#e3fcff",
    surface: "#00758e",
    surfaceDeep: "#002833",
    track: "rgba(0, 83, 101, 0.88)",
    glow: "rgba(32, 229, 255, 0.7)",
  },
  gold: {
    accent: "#ffc83d",
    accentBright: "#fff0a3",
    border: "#fff6d4",
    surface: "#8a5500",
    surfaceDeep: "#2d1600",
    track: "rgba(107, 67, 0, 0.88)",
    glow: "rgba(255, 200, 61, 0.68)",
  },
  red: {
    accent: "#ff4f68",
    accentBright: "#ffc1c9",
    border: "#ffe7ea",
    surface: "#8c1028",
    surfaceDeep: "#31040d",
    track: "rgba(105, 12, 31, 0.88)",
    glow: "rgba(255, 79, 104, 0.68)",
  },
};

export function resolveDeckyGamePageAchievementBadgeColor(
  variant: DeckyGamePageAchievementBadgeVariant,
  colors: GamePageAchievementBadgeColors = DEFAULT_GAME_PAGE_ACHIEVEMENT_BADGE_COLORS,
): GamePageAchievementBadgeColor {
  if (variant === "perfected") {
    return colors.perfected;
  }

  if (variant === "mastered") {
    return colors.mastered;
  }

  if (variant === "beaten") {
    return colors.beaten;
  }

  if (variant === "in-progress") {
    return colors.inProgress;
  }

  return "gray";
}

export function resolveDeckyGamePageAchievementBadgePalette(
  variant: DeckyGamePageAchievementBadgeVariant,
  colors?: GamePageAchievementBadgeColors,
): DeckyGamePageAchievementBadgePalette {
  return badgeColorPalettes[resolveDeckyGamePageAchievementBadgeColor(variant, colors)];
}

export function getDeckyGamePageAchievementBadgeColorPreview(
  color: GamePageAchievementBadgeColor,
): string {
  return badgeColorPalettes[color].accent;
}
