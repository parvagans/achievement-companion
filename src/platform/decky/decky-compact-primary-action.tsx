import type { CSSProperties, ReactNode } from "react";
import { achievementCompanionQamTheme as qamTheme, getQamCompactFocusControlStyle } from "./decky-qam-theme";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import externalLinkIconUrl from "./assets/external-link.svg";

/** Shared QAM primary action presentation used by both provider profiles. */
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
    border: `1px solid ${qamTheme.color.borderStrong}`,
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

/** Keeps a primary action's title visually centered between its fixed icon and chevron. */
export function DeckyCompactPrimaryActionContent({ children }: { readonly children: ReactNode }): JSX.Element {
  const iconStyle: CSSProperties = {
    width: 16,
    height: 16,
    flex: "0 0 16px",
    filter: "brightness(0) saturate(100%) invert(73%) sepia(60%) saturate(963%) hue-rotate(164deg) brightness(101%) contrast(95%)",
  };
  return (
    <span style={{ display: "grid", gridTemplateColumns: "16px minmax(0, 1fr) 16px", alignItems: "center", gap: 8, width: "100%", minWidth: 0 }}>
      <img alt="" src={externalLinkIconUrl} style={iconStyle} />
      <span style={{ minWidth: 0, color: qamTheme.color.textPrimary, fontSize: qamTheme.type.compact.body, fontWeight: 800, lineHeight: 1, textAlign: "center" }}>{children}</span>
      <img alt="" src={chevronRightIconUrl} style={iconStyle} />
    </span>
  );
}
