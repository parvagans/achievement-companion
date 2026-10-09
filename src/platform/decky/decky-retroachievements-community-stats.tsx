import type { GameCommunityStats } from "@core/domain";
import {
  DeckyFullScreenGameProgressStat,
  DeckyFullScreenGameProgressStatGrid,
} from "./decky-full-screen-game-progress-stat";
import {
  DeckyFullScreenGameSpotlightCard,
} from "./decky-full-screen-game-spotlight-card";
import { formatRetroAchievementsCommunityDuration } from "./decky-retroachievements-community-stats-data";
import { raTheme } from "./ra-theme";

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
  const medianBeatSoftcore = formatRetroAchievementsCommunityDuration(stats.medianBeatSoftcoreSeconds);
  const medianCompletion = formatRetroAchievementsCommunityDuration(stats.medianCompletionSeconds);
  const medianMastery = formatRetroAchievementsCommunityDuration(stats.medianMasterySeconds);
  const masteryValue = formatMasteryValue(stats);
  const entries = [
    ...(stats.totalPlayers !== undefined && Number.isFinite(stats.totalPlayers)
      ? [{ label: "Players", value: formatCount(stats.totalPlayers) }]
      : []),
    ...(masteryValue !== undefined ? [{ label: "Mastered", value: masteryValue }] : []),
    ...(medianBeat !== undefined ? [{ label: "Median beat · Hardcore", value: medianBeat }] : []),
    ...(medianBeatSoftcore !== undefined ? [{ label: "Median beat · Softcore", value: medianBeatSoftcore }] : []),
    ...(medianCompletion !== undefined ? [{ label: "Median completion", value: medianCompletion }] : []),
    ...(medianMastery !== undefined ? [{ label: "Median mastery", value: medianMastery }] : []),
  ];

  if (entries.length === 0) return null;

  return (
    <DeckyFullScreenGameSpotlightCard
      title="Community"
      focusable={false}
      style={{
        gap: 6,
        padding: 8,
        borderRadius: 14,
        background: raTheme.surface.gameOverviewCard,
        height: "100%",
        justifyContent: "space-between",
      }}
    >
      <DeckyFullScreenGameProgressStatGrid columns={2} gap={6}>
        {entries.map((entry) => <DeckyFullScreenGameProgressStat dense themeVariant="ra" key={entry.label} {...entry} />)}
      </DeckyFullScreenGameProgressStatGrid>
    </DeckyFullScreenGameSpotlightCard>
  );
}
