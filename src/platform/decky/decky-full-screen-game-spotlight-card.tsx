import type { CSSProperties, ReactNode } from "react";

function getCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.02))",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 2px 10px rgba(0, 0, 0, 0.18)",
  };
}

function getHeaderStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: "0.8em",
    fontWeight: 800,
    letterSpacing: "0.12em",
    lineHeight: 1.1,
    textAlign: "center",
    textTransform: "uppercase",
  };
}

export interface DeckyFullScreenGameSpotlightCardProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly style?: CSSProperties;
}

export function DeckyFullScreenGameSpotlightCard({
  title,
  children,
  style,
}: DeckyFullScreenGameSpotlightCardProps): JSX.Element {
  return (
    <div style={{ ...getCardStyle(), ...style }}>
      <div style={getHeaderStyle()}>{title}</div>
      {children}
    </div>
  );
}
