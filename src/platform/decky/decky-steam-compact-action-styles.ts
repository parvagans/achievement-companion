import type { CSSProperties } from "react";
import { steamRecipes, steamTheme } from "./steam-theme";
import { getQamCompactFocusControlStyle } from "./decky-qam-theme";
import { getDeckyCompactPrimaryActionStyle } from "./decky-compact-primary-action";

export type DeckySteamCompactActionTone = "primary" | "row";

export function getSteamCompactActionStyle(
  tone: DeckySteamCompactActionTone,
  isFocused: boolean,
): CSSProperties {
  const isPrimary = tone === "primary";

  if (isPrimary) return getDeckyCompactPrimaryActionStyle(isFocused);

  return {
    ...steamRecipes.action("compact", isPrimary),
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    width: "100%",
    minWidth: 0,
    minHeight: undefined,
    padding: 0,
    border: `1px solid ${steamTheme.color.borderSubtle}`,
    borderRadius: steamTheme.radius.medium,
    background: steamTheme.surface.compactRow,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.025)",
    boxSizing: "border-box",
    color: steamTheme.color.textPrimary,
    cursor: "pointer",
    outline: "none",
    transition: "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
    ...(isFocused ? getQamCompactFocusControlStyle() : {}),
  };
}

export function getSteamCompactAchievementFilterStyle(
  isSelected: boolean,
  isFocused: boolean,
): CSSProperties {
  const surface = getSteamCompactActionStyle("row", isFocused);

  return {
    ...surface,
    flex: "1 1 0",
    justifyContent: "center",
    minHeight: 32,
    padding: "7px 3px",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: isSelected ? steamTheme.type.weight.strong : steamTheme.type.weight.medium,
    lineHeight: 1.15,
    textAlign: "center",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    color: isSelected ? steamTheme.selection.compactText : steamTheme.color.textSecondary,
    // The selection stays visible as focus moves to another filter or an achievement.
    boxShadow: isSelected
      ? `${surface.boxShadow}, ${steamTheme.selection.compactUnderline}`
      : surface.boxShadow,
  };
}
