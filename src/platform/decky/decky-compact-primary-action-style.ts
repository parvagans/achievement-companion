import type { CSSProperties } from "react";
import { achievementCompanionQamTheme as qamTheme, getQamCompactFocusControlStyle } from "./decky-qam-theme";

/** Data-only shared QAM primary-action recipe; safe for model and server-render tests. */
export function getDeckyCompactPrimaryActionStyle(focused: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: qamTheme.space.sm,
    width: "100%",
    minWidth: 0,
    minHeight: 38,
    padding: "8px 12px",
    border: `1px solid ${qamTheme.color.primaryActionBorder}`,
    borderRadius: qamTheme.radius.medium,
    background: qamTheme.surface.compactPrimaryAction,
    boxShadow: "inset 0 1px 0 rgba(125, 211, 252, 0.08), 0 4px 12px rgba(0, 0, 0, 0.16)",
    boxSizing: "border-box",
    color: qamTheme.color.textPrimary,
    cursor: "pointer",
    outline: "none",
    transition: "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
    ...(focused ? getQamCompactFocusControlStyle() : {}),
  };
}
