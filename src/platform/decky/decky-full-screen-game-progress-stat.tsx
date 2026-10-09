import type { CSSProperties, ReactNode } from "react";
import { steamTheme } from "./steam-theme";

function getProgressStatStyle(dense: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: dense ? 1 : 2,
    padding: dense ? "5px 6px" : "7px 8px",
    borderRadius: 12,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    background: steamTheme.surface.contentStat,
    minWidth: 0,
    textAlign: "center",
  };
}

function getProgressStatLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "0.68em",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getProgressStatValueStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "0.9em",
    fontWeight: 700,
    lineHeight: 1.15,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "center",
  };
}

export interface DeckyFullScreenGameProgressStatProps {
  readonly label: string;
  readonly value: string;
  readonly dense?: boolean;
  readonly icon?: ReactNode;
  readonly themeVariant?: "default" | "ra";
}

function getProgressStatGridStyle(fillHeight: boolean, columns: number, rows: number, gap: number): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    ...(fillHeight
      ? {
          flex: "1 1 auto",
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          minHeight: 0,
        }
      : {}),
    gap,
  };
}

export function DeckyFullScreenGameProgressStatGrid({
  children,
  fillHeight = false,
  columns = 2,
  rows = 2,
  gap = 8,
}: {
  readonly children: ReactNode;
  readonly fillHeight?: boolean;
  readonly columns?: number;
  readonly rows?: number;
  readonly gap?: number;
}): JSX.Element {
  return <div style={getProgressStatGridStyle(fillHeight, columns, rows, gap)}>{children}</div>;
}

export function DeckyFullScreenGameProgressStat({
  label,
  value,
  dense = false,
  icon,
}: DeckyFullScreenGameProgressStatProps): JSX.Element {
  return (
    <div style={getProgressStatStyle(dense)}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 0 }}>
        {icon !== undefined ? <span style={{ display: "inline-flex", flexShrink: 0 }}>{icon}</span> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <div style={getProgressStatLabelStyle()}>{label}</div>
          <div style={getProgressStatValueStyle()}>{value}</div>
        </div>
      </div>
    </div>
  );
}
