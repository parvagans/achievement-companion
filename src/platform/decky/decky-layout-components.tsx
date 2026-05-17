import { Focusable } from "@decky/ui";
import type { CSSProperties, JSX } from "react";

export function getStatsGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  };
}

export function StatsGrid({ children }: { readonly children: React.ReactNode }): JSX.Element {
  return (
    <Focusable flow-children="left-right" style={getStatsGridStyle()}>
      {children}
    </Focusable>
  );
}