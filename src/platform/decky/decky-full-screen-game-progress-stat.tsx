import type { CSSProperties } from "react";

function getProgressStatStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    padding: "10px 11px",
    borderRadius: 12,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    minWidth: 0,
    textAlign: "center",
  };
}

function getProgressStatLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "0.72em",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getProgressStatValueStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "0.98em",
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
}

export function DeckyFullScreenGameProgressStat({
  label,
  value,
}: DeckyFullScreenGameProgressStatProps): JSX.Element {
  return (
    <div style={getProgressStatStyle()}>
      <div style={getProgressStatLabelStyle()}>{label}</div>
      <div style={getProgressStatValueStyle()}>{value}</div>
    </div>
  );
}
