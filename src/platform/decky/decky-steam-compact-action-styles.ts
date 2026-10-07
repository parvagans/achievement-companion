import type { CSSProperties } from "react";
import { steamRecipes, steamTheme } from "./steam-theme";
import { getQamCompactFocusControlStyle } from "./decky-qam-theme";

export type DeckySteamCompactActionTone = "primary" | "row";

export function getSteamCompactActionStyle(
  tone: DeckySteamCompactActionTone,
  isFocused: boolean,
): CSSProperties {
  const isPrimary = tone === "primary";

  return {
    ...steamRecipes.action("compact", isPrimary),
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    width: "100%",
    minWidth: 0,
    minHeight: isPrimary ? 38 : undefined,
    padding: isPrimary ? "8px 12px" : 0,
    border: isPrimary
        ? `1px solid ${steamTheme.color.borderStrong}`
        : `1px solid ${steamTheme.color.borderSubtle}`,
    borderRadius: isPrimary ? steamTheme.radius.small : steamTheme.radius.medium,
    background: isPrimary
        ? steamTheme.surface.compactPrimaryAction
        : steamTheme.surface.compactRow,
    boxShadow: isPrimary
        ? "inset 0 1px 0 rgba(125, 211, 252, 0.08), 0 4px 12px rgba(0, 0, 0, 0.16)"
        : "inset 0 1px 0 rgba(255, 255, 255, 0.025)",
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
