import type { CSSProperties } from "react";
import {
  DeckyCompletionProgressBar,
  type DeckyCompletionProgressBarTone,
} from "./decky-completion-progress-bar";
import {
  DeckyFullScreenGameProgressStat,
  DeckyFullScreenGameProgressStatGrid,
} from "./decky-full-screen-game-progress-stat";
import {
  DeckyFullScreenGameSpotlightCard,
  getDeckyFullScreenGameSpotlightFillStyle,
} from "./decky-full-screen-game-spotlight-card";
import type { DeckyRetroAchievementsProgressSummaryData } from "./decky-retroachievements-progress-summary-data";
import { formatDeckyRelativeTime } from "./decky-stat-helpers";

function getProgressSummaryStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: "0.92em",
    fontWeight: 700,
    lineHeight: 1.25,
    width: "100%",
  };
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatPoints(data: DeckyRetroAchievementsProgressSummaryData): string {
  if (data.earnedPoints === undefined || data.totalPoints === undefined) {
    return "Unavailable";
  }

  return `${formatCount(data.earnedPoints)} / ${formatCount(data.totalPoints)}`;
}

function formatProgressSummary(data: DeckyRetroAchievementsProgressSummaryData): string {
  return `${formatCount(data.unlockedCount)} / ${formatCount(data.totalCount)} achievements · ${data.completionPercent}% complete`;
}

export interface DeckyRetroAchievementsProgressSummaryProps {
  readonly progress: DeckyRetroAchievementsProgressSummaryData;
  readonly completionTone: DeckyCompletionProgressBarTone;
}

export function DeckyRetroAchievementsProgressSummary({
  progress,
  completionTone,
}: DeckyRetroAchievementsProgressSummaryProps): JSX.Element {
  const lastUnlock = formatDeckyRelativeTime(progress.lastUnlockAt) ?? "None yet";

  return (
    <DeckyFullScreenGameSpotlightCard title="Your Progress" style={getDeckyFullScreenGameSpotlightFillStyle()}>
      <div style={getProgressSummaryStyle()}>{formatProgressSummary(progress)}</div>
      <DeckyCompletionProgressBar percent={progress.completionPercent} showCaption={false} tone={completionTone} />
      <DeckyFullScreenGameProgressStatGrid>
        <DeckyFullScreenGameProgressStat label="Unlocked" value={formatCount(progress.unlockedCount)} />
        <DeckyFullScreenGameProgressStat label="Remaining" value={formatCount(progress.remainingCount)} />
        <DeckyFullScreenGameProgressStat label="Points earned" value={formatPoints(progress)} />
        <DeckyFullScreenGameProgressStat label="Last unlock" value={lastUnlock} />
      </DeckyFullScreenGameProgressStatGrid>
    </DeckyFullScreenGameSpotlightCard>
  );
}
