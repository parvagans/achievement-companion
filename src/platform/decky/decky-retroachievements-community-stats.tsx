import type { CSSProperties } from "react";
import type { GameCommunityStats } from "@core/domain";
import { DeckyFullScreenGameProgressStat } from "./decky-full-screen-game-progress-stat";
import { DeckyFullScreenGameSpotlightCard } from "./decky-full-screen-game-spotlight-card";
import { formatRetroAchievementsCommunityDuration } from "./decky-retroachievements-community-stats-data";

export { formatRetroAchievementsCommunityDuration } from "./decky-retroachievements-community-stats-data";

function getSectionStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 8, minWidth: 0 };
}

function getGridStyle(): CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 };
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatPercent(value: number): string {
  return `${value.toFixed(value < 10 ? 1 : 0)}%`;
}

export function DeckyRetroAchievementsCommunityStats({
  stats,
}: {
  readonly stats: GameCommunityStats | undefined;
}): JSX.Element | null {
  if (stats === undefined) {
    return null;
  }

  const medianBeat = formatRetroAchievementsCommunityDuration(stats.medianBeatSeconds);
  const medianMastery = formatRetroAchievementsCommunityDuration(stats.medianMasterySeconds);
  const entries = [
    ...(stats.totalPlayers !== undefined ? [{ label: "Players", value: formatCount(stats.totalPlayers) }] : []),
    ...(stats.masteredPlayers !== undefined ? [{ label: "Mastered", value: formatCount(stats.masteredPlayers) }] : []),
    ...(stats.masteryPercent !== undefined ? [{ label: "Mastery", value: formatPercent(stats.masteryPercent) }] : []),
    ...(medianBeat !== undefined
      ? [{ label: "Median beat", value: medianBeat }]
      : []),
    ...(medianMastery !== undefined
      ? [{ label: "Median mastery", value: medianMastery }]
      : []),
  ];
  if (entries.length === 0) {
    return null;
  }

  return (
    <DeckyFullScreenGameSpotlightCard title="Community">
      <div style={getSectionStyle()}>
      <div style={getGridStyle()}>
        {entries.map((entry) => <DeckyFullScreenGameProgressStat key={entry.label} {...entry} />)}
      </div>
      </div>
    </DeckyFullScreenGameSpotlightCard>
  );
}
