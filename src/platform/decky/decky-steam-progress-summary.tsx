import type { CSSProperties } from "react";
import { DeckyCompletionProgressBar } from "./decky-completion-progress-bar";
import { DeckyFullScreenGameProgressStat } from "./decky-full-screen-game-progress-stat";
import { DeckyFullScreenGameSpotlightCard } from "./decky-full-screen-game-spotlight-card";
import { steamRecipes, steamTheme } from "./steam-theme";

function getStatsGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
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
  readonly fillHeight?: boolean;
}

function getProgressCardStyle(fillHeight: boolean): CSSProperties {
  return {
    ...steamRecipes.card("fullscreen", "raised"),
    background: steamTheme.surface.contentCard,
    gap: 6,
    padding: 8,
    ...(fillHeight ? { height: "100%", justifyContent: "space-between" } : {}),
  };
}

export function DeckySteamProgressSummary({
  completionPercent,
  unlockedValue,
  totalValue,
  remainingValue,
  lastUnlockValue,
  fillHeight = false,
}: DeckySteamProgressSummaryProps): JSX.Element {
  return (
    <DeckyFullScreenGameSpotlightCard title="Your Progress" focusable={false} style={getProgressCardStyle(fillHeight)}>
      <div style={{ ...steamRecipes.text("fullscreen", "body"), display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, fontWeight: 700, textAlign: "center" }}>
        <span>{`${unlockedValue} / ${totalValue} achievements`}</span>
      </div>
      {completionPercent !== undefined ? (
        <DeckyCompletionProgressBar
          caption={`${Math.round(completionPercent)}% complete`}
          captionPlacement="inside"
          percent={completionPercent}
          breathe
          steamTheme
        />
      ) : null}
      <div style={getStatsGridStyle()}>
        <DeckyFullScreenGameProgressStat dense label="Unlocked" value={unlockedValue} />
        {remainingValue !== undefined ? (
          <DeckyFullScreenGameProgressStat dense label="Remaining" value={remainingValue} />
        ) : null}
        {lastUnlockValue !== undefined ? (
          <div style={{ gridColumn: "1 / -1" }}>
            <DeckyFullScreenGameProgressStat dense label="Last unlock" value={lastUnlockValue} />
          </div>
        ) : null}
      </div>
    </DeckyFullScreenGameSpotlightCard>
  );
}
