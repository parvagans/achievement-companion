import type { CSSProperties } from "react";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import type { DeckyCompletionProgressBarTone } from "./decky-completion-progress-bar";
import { shouldRenderRetroAchievementsModeSummaryCard } from "./decky-achievement-detail-helpers";
import { getRetroAchievementsCompletionIndicatorState } from "./decky-retroachievements-completion-indicator";
import { getDeckyGameArtworkFallbackInitials } from "./decky-game-artwork-fallback";
import { DeckyFullScreenGameSpotlightOverview } from "./decky-full-screen-game-spotlight-overview";
import type { DeckyFullScreenGameMetadataPill } from "./decky-full-screen-game-metadata-pills";
import { DeckyRetroAchievementsFullscreenGameArtwork } from "./decky-retroachievements-fullscreen-game-artwork";
import { DeckyRetroAchievementsProgressSummary } from "./decky-retroachievements-progress-summary";
import { buildDeckyRetroAchievementsProgressSummaryData } from "./decky-retroachievements-progress-summary-data";
import { DeckyRetroAchievementsCommunityStats } from "./decky-retroachievements-community-stats";
import { DeckyRetroAchievementsModeProgressCards } from "./decky-retroachievements-mode-progress-cards";
import { DeckyRetroAchievementsSetDetails } from "./decky-retroachievements-set-details";
import { DeckyFullScreenGameSpotlightCard } from "./decky-full-screen-game-spotlight-card";

type RetroAchievementsGame = GameDetailSnapshot["game"];
type AchievementMode = "hardcore" | "softcore";

function getLayoutStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
    alignItems: "stretch",
  };
}

function getSummaryGridStyle(hasCommunityStats: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: hasCommunityStats ? "repeat(auto-fit, minmax(320px, 1fr))" : "1fr",
    gap: 12,
  };
}

function getAchievementModePoints(
  achievements: readonly NormalizedAchievement[],
  mode: AchievementMode,
): number | undefined {
  let points = 0;
  let hasPoints = false;

  for (const achievement of achievements) {
    if (!achievement.isUnlocked || achievement.unlockMode !== mode) {
      continue;
    }

    if (achievement.points !== undefined) {
      points += achievement.points;
      hasPoints = true;
    }
  }

  return hasPoints ? points : undefined;
}

function getCompletionTone(
  completionState: ReturnType<typeof getRetroAchievementsCompletionIndicatorState>,
): DeckyCompletionProgressBarTone {
  if (completionState === "mastered-hardcore") {
    return "retroachievements-mastered";
  }

  if (completionState === "beaten-hardcore" || completionState === "beaten-softcore") {
    return "retroachievements-beaten";
  }

  return "default";
}

export interface DeckyRetroAchievementsGameSpotlightProps {
  readonly game: RetroAchievementsGame;
  readonly achievements: readonly NormalizedAchievement[];
  readonly metadataPills: readonly DeckyFullScreenGameMetadataPill[];
  readonly backLabel: string;
  readonly onBack: () => void;
  readonly onRefresh: () => void;
}

export function DeckyRetroAchievementsGameSpotlight({
  game,
  achievements,
  metadataPills,
  backLabel,
  onBack,
  onRefresh,
}: DeckyRetroAchievementsGameSpotlightProps): JSX.Element {
  const completionState = getRetroAchievementsCompletionIndicatorState(game);
  const completionTone = getCompletionTone(completionState);
  const progress = buildDeckyRetroAchievementsProgressSummaryData({
    summary: game.summary,
    achievements,
  });
  const hardcorePoints = getAchievementModePoints(achievements, "hardcore");
  const softcorePoints = getAchievementModePoints(achievements, "softcore");
  const showHardcoreModeCard = shouldRenderRetroAchievementsModeSummaryCard({
    game,
    mode: "hardcore",
    summary: game.hardcoreSummary,
    points: hardcorePoints,
  });
  const showSoftcoreModeCard = shouldRenderRetroAchievementsModeSummaryCard({
    game,
    mode: "softcore",
    summary: game.softcoreSummary,
    points: softcorePoints,
  });
  const artworkUrl = game.boxArtImageUrl ?? game.coverImageUrl;

  return (
    <div style={getLayoutStyle()}>
      <DeckyFullScreenGameSpotlightOverview
        title={game.title}
        layout="horizontal"
        focusable
        artwork={
          artworkUrl !== undefined ? (
            <DeckyRetroAchievementsFullscreenGameArtwork
              src={artworkUrl}
              fallbackLabel={getDeckyGameArtworkFallbackInitials(game.title)}
              variant="compact"
            />
          ) : undefined
        }
        backLabel={backLabel}
        onBack={onBack}
        onRefresh={onRefresh}
        platform={{
          label: game.platformLabel ?? "Unknown system",
          iconUrl: game.systemIconUrl,
        }}
      />

      <div style={getSummaryGridStyle(game.communityStats !== undefined)}>
        <DeckyRetroAchievementsProgressSummary completionTone={completionTone} progress={progress} />
        <DeckyRetroAchievementsCommunityStats stats={game.communityStats} />
      </div>
      {showHardcoreModeCard || showSoftcoreModeCard ? (
        <DeckyFullScreenGameSpotlightCard title="Mode Progress">
          <DeckyRetroAchievementsModeProgressCards
            game={game}
            hardcorePoints={hardcorePoints}
            softcorePoints={softcorePoints}
            showHardcore={showHardcoreModeCard}
            showSoftcore={showSoftcoreModeCard}
          />
        </DeckyFullScreenGameSpotlightCard>
      ) : null}
      <DeckyRetroAchievementsSetDetails details={metadataPills} />
    </div>
  );
}
