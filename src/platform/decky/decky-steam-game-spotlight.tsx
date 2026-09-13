import type { CSSProperties } from "react";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import type { DeckyCompletionProgressBarTone } from "./decky-completion-progress-bar";
import { getDeckyGameArtworkFallbackInitials } from "./decky-game-artwork-fallback";
import { DeckyFullScreenGameSpotlightOverview } from "./decky-full-screen-game-spotlight-overview";
import type { DeckyFullScreenGameMetadataPill } from "./decky-full-screen-game-metadata-pills";
import { DeckySteamAchievementSpotlightCard } from "./decky-steam-achievement-spotlight-card";
import { DeckySteamFullscreenGameArtwork } from "./decky-steam-fullscreen-game-artwork";
import { getSteamFullscreenGameArtworkUrl } from "./decky-steam-game-artwork";
import { DeckySteamProgressSummary } from "./decky-steam-progress-summary";

type SteamGame = GameDetailSnapshot["game"];

function formatCount(value: number): string {
  return value.toLocaleString();
}

function computeRemainingAchievements(game: SteamGame): number | undefined {
  if (game.summary.totalCount === undefined) {
    return undefined;
  }

  return Math.max(0, game.summary.totalCount - game.summary.unlockedCount);
}

function getLayoutStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.18fr) minmax(320px, 0.82fr)",
    gap: 12,
    width: "100%",
    alignItems: "stretch",
  };
}

function getColumnStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
    minHeight: 0,
    height: "100%",
  };
}

function selectRecentUnlockedAchievements(
  achievements: readonly NormalizedAchievement[],
  limit = 3,
): readonly NormalizedAchievement[] {
  return achievements
    .filter((achievement) => achievement.isUnlocked && achievement.unlockedAt !== undefined)
    .sort((left, right) => {
      const unlockedAtDelta = (right.unlockedAt ?? 0) - (left.unlockedAt ?? 0);
      if (unlockedAtDelta !== 0) {
        return unlockedAtDelta;
      }

      const titleDelta = left.title.localeCompare(right.title);
      if (titleDelta !== 0) {
        return titleDelta;
      }

      return left.achievementId.localeCompare(right.achievementId);
    })
    .slice(0, limit);
}

function selectNextLockedAchievements(
  achievements: readonly NormalizedAchievement[],
  limit = 3,
): readonly NormalizedAchievement[] {
  return achievements.filter((achievement) => !achievement.isUnlocked).slice(0, limit);
}

export interface DeckySteamGameSpotlightProps {
  readonly game: SteamGame;
  readonly orderedAchievements: readonly NormalizedAchievement[];
  readonly totalAchievementCount: number;
  readonly completionPercent: number | undefined;
  readonly completionTone: DeckyCompletionProgressBarTone;
  readonly metadataLabels: readonly string[];
  readonly metadataPills: readonly DeckyFullScreenGameMetadataPill[];
  readonly backLabel: string;
  readonly onBack: () => void;
  readonly onRefresh: () => void;
}

export function DeckySteamGameSpotlight({
  game,
  orderedAchievements,
  totalAchievementCount,
  completionPercent,
  completionTone,
  metadataLabels,
  metadataPills,
  backLabel,
  onBack,
  onRefresh,
}: DeckySteamGameSpotlightProps): JSX.Element {
  const artworkUrl = getSteamFullscreenGameArtworkUrl(game);
  const remainingCount = computeRemainingAchievements(game);
  const recentAchievements = selectRecentUnlockedAchievements(orderedAchievements);
  const nextLockedAchievements = selectNextLockedAchievements(orderedAchievements);
  const secondaryAchievements =
    recentAchievements.length > 0 ? recentAchievements : nextLockedAchievements;
  const secondaryCardTitle =
    recentAchievements.length > 0 ? "Latest Unlocks" : "Achievement Highlights";

  return (
    <div style={getLayoutStyle()}>
      <DeckyFullScreenGameSpotlightOverview
        title={game.title}
        metadataLabels={metadataLabels}
        artwork={
          artworkUrl !== undefined ? (
            <DeckySteamFullscreenGameArtwork
              src={artworkUrl}
              fallbackLabel={getDeckyGameArtworkFallbackInitials(game.title)}
            />
          ) : undefined
        }
        backLabel={backLabel}
        onBack={onBack}
        onRefresh={onRefresh}
        platform={undefined}
      />

      <div style={getColumnStyle()}>
        <DeckySteamProgressSummary
          completionPercent={completionPercent}
          completionTone={completionTone}
          unlockedValue={formatCount(game.summary.unlockedCount)}
          totalValue={formatCount(totalAchievementCount)}
          remainingValue={remainingCount !== undefined ? formatCount(remainingCount) : undefined}
          metadataPills={metadataPills}
        />

        {secondaryAchievements.length > 0 ? (
          <DeckySteamAchievementSpotlightCard
            achievements={secondaryAchievements}
            mode={recentAchievements.length > 0 ? "recent" : "highlight"}
            title={secondaryCardTitle}
          />
        ) : null}
      </div>
    </div>
  );
}
