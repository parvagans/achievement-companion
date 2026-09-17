import type { CSSProperties } from "react";
import { DeckyCompletionProgressBar } from "./decky-completion-progress-bar";
import { DeckyFullScreenGameProgressStat } from "./decky-full-screen-game-progress-stat";
import { DeckyFullScreenGameSpotlightCard } from "./decky-full-screen-game-spotlight-card";

function getStatsGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 6,
    justifyItems: "stretch",
    alignItems: "stretch",
    width: "100%",
  };
}

export interface DeckySteamProgressSummaryProps {
  readonly completionPercent: number | undefined;
  readonly unlockedValue: string;
  readonly totalValue: string;
  readonly remainingValue: string | undefined;
  readonly lastUnlockValue: string | undefined;
}

function getProgressCardStyle(): CSSProperties {
  return { gap: 6, padding: 8, borderRadius: 14 };
}

export function DeckySteamProgressSummary({
  completionPercent,
  unlockedValue,
  totalValue,
  remainingValue,
  lastUnlockValue,
}: DeckySteamProgressSummaryProps): JSX.Element {
  return (
    <DeckyFullScreenGameSpotlightCard title="Your Progress" focusable={false} style={getProgressCardStyle()}>
      <div style={{ color: "rgba(255, 255, 255, 0.92)", fontSize: "0.94em", fontWeight: 700 }}>
        {`${unlockedValue} / ${totalValue} achievements${completionPercent !== undefined ? ` · ${Math.round(completionPercent)}% complete` : ""}`}
      </div>
      {completionPercent !== undefined ? (
        <DeckyCompletionProgressBar percent={completionPercent} showCaption={false} />
      ) : null}
      <div style={getStatsGridStyle()}>
        <DeckyFullScreenGameProgressStat dense label="Unlocked" value={unlockedValue} />
        {remainingValue !== undefined ? (
          <DeckyFullScreenGameProgressStat dense label="Remaining" value={remainingValue} />
        ) : null}
        {lastUnlockValue !== undefined ? (
          <DeckyFullScreenGameProgressStat dense label="Last unlock" value={lastUnlockValue} />
        ) : null}
      </div>
    </DeckyFullScreenGameSpotlightCard>
  );
}
