import type { CSSProperties } from "react";
import { DeckyFullScreenGameProgressStat } from "./decky-full-screen-game-progress-stat";
import { DeckyFullScreenGameSpotlightCard } from "./decky-full-screen-game-spotlight-card";
import type { DeckyFullScreenGameMetadataPill } from "./decky-full-screen-game-metadata-pills";

function getGridStyle(): CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 };
}

export function DeckyRetroAchievementsSetDetails({
  details,
}: {
  readonly details: readonly DeckyFullScreenGameMetadataPill[];
}): JSX.Element | null {
  if (details.length === 0) {
    return null;
  }

  return (
    <DeckyFullScreenGameSpotlightCard title="Set Details">
      <div style={getGridStyle()}>
        {details.map((detail) => (
          <DeckyFullScreenGameProgressStat key={detail.key} label={detail.label} value={detail.value} />
        ))}
      </div>
    </DeckyFullScreenGameSpotlightCard>
  );
}
