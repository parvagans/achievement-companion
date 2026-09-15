import type { GameCommunityStats } from "@core/domain";
import {
  DeckyFullScreenGameProgressStat,
  DeckyFullScreenGameProgressStatGrid,
} from "./decky-full-screen-game-progress-stat";
import {
  DeckyFullScreenGameSpotlightCard,
  getDeckyFullScreenGameSpotlightFillStyle,
} from "./decky-full-screen-game-spotlight-card";
import { formatRetroAchievementsCommunityDuration } from "./decky-retroachievements-community-stats-data";

export { formatRetroAchievementsCommunityDuration } from "./decky-retroachievements-community-stats-data";

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatPercent(value: number): string {
  return `${value.toFixed(value < 10 ? 1 : 0)}%`;
}

function formatMasteryValue({
  masteredPlayers,
  masteryPercent,
}: GameCommunityStats): string | undefined {
  const mastered = masteredPlayers !== undefined ? formatCount(masteredPlayers) : undefined;
  const percent = masteryPercent !== undefined ? formatPercent(masteryPercent) : undefined;

  if (mastered === undefined) {
    return percent;
  }

  return percent !== undefined ? `${mastered} · ${percent}` : mastered;
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
  const masteryValue = formatMasteryValue(stats);
  const entries = [
    { label: "Players", value: stats.totalPlayers !== undefined ? formatCount(stats.totalPlayers) : "-" },
    { label: "Mastered", value: masteryValue ?? "-" },
    { label: "Median beat", value: medianBeat ?? "-" },
    { label: "Median mastery", value: medianMastery ?? "-" },
  ];

  return (
    <DeckyFullScreenGameSpotlightCard title="Community" style={getDeckyFullScreenGameSpotlightFillStyle()}>
      <DeckyFullScreenGameProgressStatGrid fillHeight>
        {entries.map((entry) => <DeckyFullScreenGameProgressStat key={entry.label} {...entry} />)}
      </DeckyFullScreenGameProgressStatGrid>
    </DeckyFullScreenGameSpotlightCard>
  );
}
