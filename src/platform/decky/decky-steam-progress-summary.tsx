import type { CSSProperties } from "react";
import { DeckyCompletionProgressBar, type DeckyCompletionProgressBarTone } from "./decky-completion-progress-bar";
import { DeckyFullScreenGameMetadataPills, type DeckyFullScreenGameMetadataPill } from "./decky-full-screen-game-metadata-pills";
import { DeckyFullScreenGameProgressStat } from "./decky-full-screen-game-progress-stat";
import { DeckyFullScreenGameSpotlightCard } from "./decky-full-screen-game-spotlight-card";

function getStatsGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    justifyItems: "stretch",
    alignItems: "stretch",
    width: "100%",
  };
}

export interface DeckySteamProgressSummaryProps {
  readonly completionPercent: number | undefined;
  readonly completionTone: DeckyCompletionProgressBarTone;
  readonly unlockedValue: string;
  readonly totalValue: string;
  readonly remainingValue: string | undefined;
  readonly metadataPills: readonly DeckyFullScreenGameMetadataPill[];
}

export function DeckySteamProgressSummary({
  completionPercent,
  completionTone,
  unlockedValue,
  totalValue,
  remainingValue,
  metadataPills,
}: DeckySteamProgressSummaryProps): JSX.Element {
  return (
    <DeckyFullScreenGameSpotlightCard title="Progress Summary">
      {completionPercent !== undefined ? (
        <DeckyCompletionProgressBar percent={completionPercent} tone={completionTone} />
      ) : null}
      <div style={getStatsGridStyle()}>
        <DeckyFullScreenGameProgressStat label="Unlocked" value={unlockedValue} />
        <DeckyFullScreenGameProgressStat label="Total" value={totalValue} />
        {remainingValue !== undefined ? (
          <DeckyFullScreenGameProgressStat label="Remaining" value={remainingValue} />
        ) : null}
      </div>
      <DeckyFullScreenGameMetadataPills pills={metadataPills} />
    </DeckyFullScreenGameSpotlightCard>
  );
}
