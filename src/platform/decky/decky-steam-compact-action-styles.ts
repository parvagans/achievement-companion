import type { CSSProperties } from "react";

export type DeckySteamCompactActionTone = "primary" | "row";

export function getSteamCompactActionStyle(
  tone: DeckySteamCompactActionTone,
  isFocused: boolean,
): CSSProperties {
  const isPrimary = tone === "primary";

  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    width: "100%",
    minWidth: 0,
    minHeight: isPrimary ? 38 : undefined,
    padding: isPrimary ? "8px 12px" : 0,
    border: isFocused
      ? "1px solid rgba(54, 185, 255, 0.92)"
      : isPrimary
        ? "1px solid rgba(54, 185, 255, 0.52)"
        : "1px solid rgba(54, 142, 191, 0.16)",
    borderRadius: isPrimary ? 8 : 9,
    background: isFocused
      ? "linear-gradient(180deg, rgba(17, 91, 139, 0.78), rgba(8, 53, 82, 0.9))"
      : isPrimary
        ? "linear-gradient(180deg, rgba(10, 63, 96, 0.82), rgba(7, 43, 67, 0.92))"
        : "linear-gradient(150deg, rgba(9, 35, 51, 0.88), rgba(7, 27, 41, 0.94))",
    boxShadow: isFocused
      ? "0 0 0 1px rgba(54, 185, 255, 0.72), 0 0 13px rgba(54, 185, 255, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
      : isPrimary
        ? "inset 0 1px 0 rgba(125, 211, 252, 0.08), 0 4px 12px rgba(0, 0, 0, 0.16)"
        : "inset 0 1px 0 rgba(255, 255, 255, 0.025)",
    boxSizing: "border-box",
    color: "#f2f6fb",
    cursor: "pointer",
    outline: "none",
    transition: "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
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
    fontWeight: isSelected ? 800 : 650,
    lineHeight: 1.15,
    textAlign: "center",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    color: isSelected ? "#69cfff" : "#b9d4e5",
    // The selection stays visible as focus moves to another filter or an achievement.
    boxShadow: isSelected
      ? `${surface.boxShadow}, inset 0 -3px 0 rgba(54, 185, 255, 0.82)`
      : surface.boxShadow,
  };
}
