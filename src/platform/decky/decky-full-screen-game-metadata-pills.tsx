import type { CSSProperties } from "react";

export interface DeckyFullScreenGameMetadataPill {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

function getPillRowStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    width: "100%",
    alignItems: "stretch",
  };
}

function getPillStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    minHeight: 28,
    width: "100%",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: "0.74em",
    fontWeight: 700,
    lineHeight: 1.15,
    textAlign: "center",
    whiteSpace: "nowrap",
  };
}

export interface DeckyFullScreenGameMetadataPillsProps {
  readonly pills: readonly DeckyFullScreenGameMetadataPill[];
}

export function DeckyFullScreenGameMetadataPills({
  pills,
}: DeckyFullScreenGameMetadataPillsProps): JSX.Element | null {
  if (pills.length === 0) {
    return null;
  }

  return (
    <div style={getPillRowStyle()}>
      {pills.map((pill) => (
        <span key={pill.key} style={getPillStyle()}>
          {`${pill.label}: ${pill.value}`}
        </span>
      ))}
    </div>
  );
}
