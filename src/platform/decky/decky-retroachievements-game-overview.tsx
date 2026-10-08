import type { CSSProperties } from "react";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { DeckyFullScreenGameOverviewLayout, DeckyFullScreenGameTitle } from "./decky-full-screen-game-overview-layout";
import { DeckyRetroAchievementsFullscreenGameArtwork } from "./decky-retroachievements-fullscreen-game-artwork";
import { DeckyRetroAchievementsProgressSummary } from "./decky-retroachievements-progress-summary";
import { buildDeckyRetroAchievementsProgressSummaryData } from "./decky-retroachievements-progress-summary-data";
import { DeckyRetroAchievementsModeProgressCards } from "./decky-retroachievements-mode-progress-cards";
import { DeckyRetroAchievementsSetDetails } from "./decky-retroachievements-set-details";
import { DeckyRetroAchievementsCommunityStats } from "./decky-retroachievements-community-stats";
import { hasDisplayableRetroAchievementsCommunityStats } from "./decky-retroachievements-community-stats-data";
import { getRetroAchievementsCompletionIndicatorState } from "./decky-retroachievements-completion-indicator";
import { shouldRenderRetroAchievementsModeSummaryCard } from "./decky-achievement-detail-helpers";
import type { DeckyCompletionProgressBarTone } from "./decky-completion-progress-bar";
import type { DeckyFullScreenGameMetadataPill } from "./decky-full-screen-game-metadata-pills";
import { raRecipes, raTheme } from "./ra-theme";

type RetroAchievementsGame = GameDetailSnapshot["game"];

function getCompletionTone(
  completionState: ReturnType<typeof getRetroAchievementsCompletionIndicatorState>,
): DeckyCompletionProgressBarTone {
  if (completionState === "mastered-hardcore") return "retroachievements-mastered";
  if (completionState === "beaten-hardcore" || completionState === "beaten-softcore") return "retroachievements-beaten";
  return "default";
}

function getAchievementModePoints(
  achievements: readonly NormalizedAchievement[],
  mode: "hardcore" | "softcore",
): number | undefined {
  let points = 0;
  let hasPoints = false;
  for (const achievement of achievements) {
    if (!achievement.isUnlocked || achievement.unlockMode !== mode) continue;
    if (achievement.points !== undefined) {
      points += achievement.points;
      hasPoints = true;
    }
  }
  return hasPoints ? points : undefined;
}

function getIdentityStyle(): CSSProperties {
  return {
    ...raRecipes.card("fullscreen", true),
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 0,
    minWidth: 0,
    padding: 10,
    boxSizing: "border-box",
  };
}

function getProviderStyle(): CSSProperties {
  return {
    ...raRecipes.text("fullscreen", "body"),
    color: raTheme.color.textSecondary,
    fontWeight: raTheme.type.weight.strong,
  };
}

function getMetadataStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: "4px 8px",
    paddingTop: 6,
    borderTop: `1px solid ${raTheme.color.borderSubtle}`,
    ...raRecipes.text("fullscreen", "metadata"),
  };
}

function getMetadataValueStyle(): CSSProperties {
  return {
    color: raTheme.color.textPrimary,
    textAlign: "right",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function RetroAchievementsIdentityPanel({
  game,
  refreshedAt,
}: {
  readonly game: RetroAchievementsGame;
  readonly refreshedAt: number | undefined;
}): JSX.Element {
  const refreshLabel = refreshedAt === undefined ? undefined : new Date(refreshedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return (
    <div style={getIdentityStyle()}>
      <DeckyRetroAchievementsFullscreenGameArtwork game={game} src={game.boxArtImageUrl ?? game.coverImageUrl} variant="default" />
      <DeckyFullScreenGameTitle color={raTheme.color.textPrimary} title={game.title} />
      <div style={getProviderStyle()}>{game.platformLabel ?? "RetroAchievements"}</div>
      <div style={getMetadataStyle()}>
        <span>Game ID</span><span style={getMetadataValueStyle()}>{game.gameId}</span>
        {game.platformLabel !== undefined ? <><span>System</span><span style={getMetadataValueStyle()}>{game.platformLabel}</span></> : null}
        {refreshLabel !== undefined ? <><span>Updated</span><span style={getMetadataValueStyle()}>{refreshLabel}</span></> : null}
      </div>
    </div>
  );
}

export function DeckyRetroAchievementsGameOverview({
  game,
  achievements,
  metadataPills,
  refreshedAt,
}: {
  readonly game: RetroAchievementsGame;
  readonly achievements: readonly NormalizedAchievement[];
  readonly metadataPills: readonly DeckyFullScreenGameMetadataPill[];
  readonly refreshedAt: number | undefined;
}): JSX.Element {
  const progress = buildDeckyRetroAchievementsProgressSummaryData({ summary: game.summary, achievements });
  const completionTone = getCompletionTone(getRetroAchievementsCompletionIndicatorState(game));
  const hardcorePoints = getAchievementModePoints(achievements, "hardcore");
  const softcorePoints = getAchievementModePoints(achievements, "softcore");
  const showHardcore = shouldRenderRetroAchievementsModeSummaryCard({ game, mode: "hardcore", summary: game.hardcoreSummary, points: hardcorePoints });
  const showSoftcore = shouldRenderRetroAchievementsModeSummaryCard({ game, mode: "softcore", summary: game.softcoreSummary, points: softcorePoints });

  return (
    <DeckyFullScreenGameOverviewLayout
      identity={<RetroAchievementsIdentityPanel game={game} refreshedAt={refreshedAt} />}
      progress={<DeckyRetroAchievementsProgressSummary completionTone={completionTone} progress={progress} />}
      community={hasDisplayableRetroAchievementsCommunityStats(game.communityStats)
        ? <DeckyRetroAchievementsCommunityStats stats={game.communityStats} />
        : undefined}
      setDetails={<DeckyRetroAchievementsSetDetails details={metadataPills} />}
      setStatus={showHardcore || showSoftcore ? (
        <div style={{ ...raRecipes.card("fullscreen", true), padding: 10 }}>
          <div style={{ ...raRecipes.text("fullscreen", "caption"), color: raTheme.color.accent, textTransform: "uppercase", letterSpacing: "0.12em" }}>Mode Progress</div>
          <DeckyRetroAchievementsModeProgressCards game={game} hardcorePoints={hardcorePoints} softcorePoints={softcorePoints} showHardcore={showHardcore} showSoftcore={showSoftcore} />
        </div>
      ) : undefined}
    />
  );
}
