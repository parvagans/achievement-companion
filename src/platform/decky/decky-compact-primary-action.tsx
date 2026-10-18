import type { CSSProperties, ReactNode } from "react";
import { achievementCompanionQamTheme as qamTheme } from "./decky-qam-theme";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import externalLinkIconUrl from "./assets/external-link.svg";

export { getDeckyCompactPrimaryActionStyle } from "./decky-compact-primary-action-style";

/** Keeps a primary action's title visually centered between its fixed icon and chevron. */
export function DeckyCompactPrimaryActionContent({ children }: { readonly children: ReactNode }): JSX.Element {
  const iconStyle: CSSProperties = {
    width: 16,
    height: 16,
    flex: "0 0 16px",
    filter: qamTheme.decorative.iconFilter,
  };
  return (
    <span style={{ display: "grid", gridTemplateColumns: "16px minmax(0, 1fr) 16px", alignItems: "center", gap: 8, width: "100%", minWidth: 0 }}>
      <img alt="" src={externalLinkIconUrl} style={iconStyle} />
      <span style={{ minWidth: 0, color: qamTheme.color.textPrimary, fontSize: qamTheme.type.compact.body, fontWeight: 800, lineHeight: 1, textAlign: "center" }}>{children}</span>
      <img alt="" src={chevronRightIconUrl} style={iconStyle} />
    </span>
  );
}
