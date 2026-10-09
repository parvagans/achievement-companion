import type { CSSProperties } from "react";
import checkCircleIconUrl from "./assets/check-circle.svg";
import lockedLockIconUrl from "./assets/locked-lock.svg";
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
} from "./decky-full-screen-game-spotlight-card";
import type { DeckyRetroAchievementsProgressSummaryData } from "./decky-retroachievements-progress-summary-data";
import { steamRecipes } from "./steam-theme";
import { raTheme } from "./ra-theme";

function getProgressSummaryStyle(): CSSProperties {
  return {
    ...steamRecipes.text("fullscreen", "body"),
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 8,
    fontWeight: 700,
    textAlign: "center",
  };
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatDate(value: number | undefined): string | undefined {
  return value === undefined ? undefined : new Date(value).toLocaleDateString();
}

function formatProgressSummary(data: DeckyRetroAchievementsProgressSummaryData): string {
  return `${formatCount(data.unlockedCount)} / ${formatCount(data.totalCount)} achievements`;
}

function getProgressIcon(src: string, filter: string): JSX.Element {
  return <img alt="" aria-hidden="true" src={src} style={{ width: 15, height: 15, objectFit: "contain", filter }} />;
}

export interface DeckyRetroAchievementsProgressSummaryProps {
  readonly progress: DeckyRetroAchievementsProgressSummaryData;
  readonly completionTone: DeckyCompletionProgressBarTone;
}

export function DeckyRetroAchievementsProgressSummary({
  progress,
  completionTone,
}: DeckyRetroAchievementsProgressSummaryProps): JSX.Element {
  return (
    <DeckyFullScreenGameSpotlightCard
      title="Your Progress"
      focusable={false}
      style={{
        ...steamRecipes.card("fullscreen", "raised"),
        background: raTheme.surface.contentCard,
        gap: 6,
        padding: 8,
        height: "100%",
        justifyContent: "space-between",
      }}
    >
      <div style={getProgressSummaryStyle()}>{formatProgressSummary(progress)}</div>
      <DeckyCompletionProgressBar
        percent={progress.completionPercent}
        caption={`${progress.completionPercent}% complete`}
        captionPlacement="inside"
        tone={completionTone}
        breathe
        steamTheme
      />
      <DeckyFullScreenGameProgressStatGrid columns={2} gap={6}>
        <DeckyFullScreenGameProgressStat dense themeVariant="ra" label="Unlocked" value={formatCount(progress.unlockedCount)} icon={getProgressIcon(checkCircleIconUrl, raTheme.iconFilter.success)} />
        <DeckyFullScreenGameProgressStat dense themeVariant="ra" label="Remaining" value={formatCount(progress.remainingCount)} icon={getProgressIcon(lockedLockIconUrl, raTheme.iconFilter.primary)} />
        {formatDate(progress.lastUnlockAt) !== undefined ? (
          <div style={{ gridColumn: "1 / -1" }}>
            <DeckyFullScreenGameProgressStat dense themeVariant="ra" label="Last unlock" value={formatDate(progress.lastUnlockAt)!} />
          </div>
        ) : null}
      </DeckyFullScreenGameProgressStatGrid>
    </DeckyFullScreenGameSpotlightCard>
  );
}
