import type { CSSProperties } from "react";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { getCompletionPercent, type DeckyCompletionProgressBarTone } from "./decky-completion-progress-bar";
import {
  formatRetroAchievementsBeatenAtText,
  formatRetroAchievementsMasteredAtText,
  shouldRenderRetroAchievementsModeSummaryCard,
} from "./decky-achievement-detail-helpers";
import {
  formatRetroAchievementsCompletionIndicatorLabel,
  getRetroAchievementsCompletionIndicatorState,
} from "./decky-retroachievements-completion-indicator";
import { getDeckyGameArtworkFallbackInitials } from "./decky-game-artwork-fallback";
import { DeckyFullScreenGameSpotlightOverview } from "./decky-full-screen-game-spotlight-overview";
import type { DeckyFullScreenGameMetadataPill } from "./decky-full-screen-game-metadata-pills";
import { DeckyRetroAchievementsFullscreenGameArtwork } from "./decky-retroachievements-fullscreen-game-artwork";
import { DeckyRetroAchievementsProgressSummary } from "./decky-retroachievements-progress-summary";
import { DeckyRetroAchievementsCommunityStats } from "./decky-retroachievements-community-stats";
import { DeckyRetroAchievementsModeProgressCards } from "./decky-retroachievements-mode-progress-cards";
import { DeckyRetroAchievementsSetDetails } from "./decky-retroachievements-set-details";
import { DeckyFullScreenGameSpotlightCard } from "./decky-full-screen-game-spotlight-card";

type RetroAchievementsGame = GameDetailSnapshot["game"];
type AchievementMode = "hardcore" | "softcore";

function formatCount(value: number): string {
  return value.toLocaleString();
}

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
  readonly totalAchievementCount: number;
  readonly metadataPills: readonly DeckyFullScreenGameMetadataPill[];
  readonly backLabel: string;
  readonly onBack: () => void;
  readonly onRefresh: () => void;
}

export function DeckyRetroAchievementsGameSpotlight({
  game,
  achievements,
  totalAchievementCount,
  metadataPills,
  backLabel,
  onBack,
  onRefresh,
}: DeckyRetroAchievementsGameSpotlightProps): JSX.Element {
  const completionState = getRetroAchievementsCompletionIndicatorState(game);
  const isBeaten = completionState === "beaten-hardcore" || completionState === "beaten-softcore";
  const isMasteredHardcore = completionState === "mastered-hardcore";
  const completionStatusLabel = isMasteredHardcore ? "Mastered" : isBeaten ? "Beaten" : undefined;
  const completionStatusAriaLabel =
    completionState !== undefined
      ? formatRetroAchievementsCompletionIndicatorLabel(completionState)
      : undefined;
  const completionTone = getCompletionTone(completionState);
  const masteredAtText = formatRetroAchievementsMasteredAtText(game);
  const beatenAtText = formatRetroAchievementsBeatenAtText(game);
  const completionAtText = isMasteredHardcore ? masteredAtText : beatenAtText;
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
        artwork={
          artworkUrl !== undefined ? (
            <DeckyRetroAchievementsFullscreenGameArtwork
              src={artworkUrl}
              fallbackLabel={getDeckyGameArtworkFallbackInitials(game.title)}
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
        <DeckyRetroAchievementsProgressSummary
          game={game}
          completionPercent={getCompletionPercent(game.summary)}
          completionTone={completionTone}
          completionStatusLabel={completionStatusLabel}
          completionStatusAriaLabel={completionStatusAriaLabel}
          completionAtText={completionAtText}
          unlockedValue={formatCount(game.summary.unlockedCount)}
          totalValue={formatCount(totalAchievementCount)}
        />
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
