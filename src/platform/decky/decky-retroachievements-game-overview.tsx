import { Navigation as DeckyNavigation } from "@decky/ui";
import type { GameDetailSnapshot } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { DeckyFullScreenGameOverviewLayout, DeckyFullScreenGameTitle } from "./decky-full-screen-game-overview-layout";
import { buildDeckyRetroAchievementsProgressSummaryData } from "./decky-retroachievements-progress-summary-data";
import { buildRetroAchievementsCompactGamePresentation } from "./decky-retroachievements-compact-game-model";
import type { DeckyFullScreenGameMetadataPill } from "./decky-full-screen-game-metadata-pills";
import { DeckyRetroAchievementsGameIcon } from "./decky-retroachievements-game-icon";
import { DeckyGameStatusIcon } from "./decky-game-status-icon";
import { steamRecipes, steamTheme } from "./steam-theme";
import { raTheme } from "./ra-theme";
import type { RetroAchievementsGameGoal } from "./decky-game-overview-recommendations";
import { DeckyOverviewHeaderIndicators, DeckyOverviewMenuButton, DeckyOverviewProgress, DeckyOverviewCompanion, DeckyOverviewMilestoneShowcase, DeckyOverviewSupporting, openDeckyOverviewDetails, overviewPanelStyle, type DeckyGameOverviewActions, type DeckyOverviewSupportingMetric } from "./decky-full-screen-game-overview-content";
import { buildRetroAchievementsOverviewActionItems } from "./decky-overview-menu-model";
import { buildDeckyRetroAchievementsGameInfoRows, formatDeckyOverviewDateTime } from "./decky-overview-format";

export function DeckyRetroAchievementsGameOverview({ snapshot, achievementMode, metadataPills, refreshedAt, overviewActions, goal, globalGoal, gameGoalOverride, onSetGlobalGoal, onSetGameGoalOverride }: {
  readonly snapshot: GameDetailSnapshot;
  readonly achievementMode: RetroAchievementsAchievementMode;
  readonly metadataPills: readonly DeckyFullScreenGameMetadataPill[];
  readonly refreshedAt: number | undefined;
  readonly overviewActions: DeckyGameOverviewActions;
  readonly goal: RetroAchievementsGameGoal;
  readonly globalGoal: RetroAchievementsGameGoal;
  readonly gameGoalOverride?: RetroAchievementsGameGoal;
  readonly onSetGlobalGoal: (goal: RetroAchievementsGameGoal) => void;
  readonly onSetGameGoalOverride: (goal: RetroAchievementsGameGoal | undefined) => void;
}): JSX.Element {
  const { game, achievements } = snapshot;
  const presentation = buildRetroAchievementsCompactGamePresentation(snapshot, achievementMode);
  const progress = buildDeckyRetroAchievementsProgressSummaryData({ summary: presentation.summary, achievements, achievementMode });
  const award = presentation.completionStatus;
  const mastered = award?.startsWith("mastered") === true;
  const beaten = award?.startsWith("beaten") === true;
  const headline = mastered ? "MASTERED" : beaten ? "BEATEN" : "In Progress";
  const modeLabel = achievementMode === "both" ? "Both modes" : achievementMode === "hardcore" ? "Hardcore" : "Softcore";
  const awardMode = award?.endsWith("hardcore") ? "Hardcore" : "Softcore";
  const awardTimestamp = Number(game.metrics.find((metric) => metric.key === "highest-award-date")?.value);
  const awardDate = award !== undefined && Number.isFinite(awardTimestamp) && awardTimestamp > 0 ? formatDeckyOverviewDateTime(awardTimestamp) : undefined;
  const stats = game.communityStats;
  const releaseDate = metadataPills.find((metric) => metric.key === "game-release-date")?.value;
  const lastSync = refreshedAt !== undefined ? formatDeckyOverviewDateTime(refreshedAt) : undefined;
  const details = (onClose?: () => void): void => openDeckyOverviewDetails(game.title, buildDeckyRetroAchievementsGameInfoRows({
    gameId: game.gameId,
    ...(game.platformLabel !== undefined ? { system: game.platformLabel } : {}),
    ...(releaseDate !== undefined ? { releaseDate } : {}),
    ...(lastSync !== undefined ? { lastSync } : {}),
    ...(progress.totalPoints !== undefined ? { totalSetPoints: progress.totalPoints.toLocaleString() } : {}),
    ...(awardDate !== undefined ? { awardDate } : {}),
  }), undefined, onClose);
  const latestAchievement = achievements.reduce<(typeof achievements)[number] | undefined>((latest, achievement) => {
    const timestamp = achievementMode === "hardcore" ? achievement.hardcoreUnlockedAt : achievementMode === "softcore" ? achievement.softcoreUnlockedAt : achievement.unlockedAt;
    const latestTimestamp = latest === undefined ? undefined : achievementMode === "hardcore" ? latest.hardcoreUnlockedAt : achievementMode === "softcore" ? latest.softcoreUnlockedAt : latest.unlockedAt;
    return timestamp !== undefined && (latestTimestamp === undefined || timestamp > latestTimestamp) ? achievement : latest;
  }, undefined);
  const masteryPercent = stats?.totalPlayers !== undefined && stats.totalPlayers > 0 && stats.masteredPlayers !== undefined
    ? stats.masteredPlayers / stats.totalPlayers * 100 : undefined;
  const supportingMetrics: readonly DeckyOverviewSupportingMetric[] = [
    ...(stats?.totalPlayers !== undefined ? [{ label: "Players", value: stats.totalPlayers.toLocaleString() }] : []),
    ...(stats?.masteredPlayers !== undefined ? [{ label: "Mastered", value: stats.masteredPlayers.toLocaleString() }] : []),
    ...(masteryPercent !== undefined ? [{ label: "Mastery rate", value: `${masteryPercent.toFixed(masteryPercent < 1 ? 2 : 1)}%` }] : []),
    ...(presentation.points !== undefined ? [{ label: "Points", value: presentation.points.toLocaleString(), tone: raTheme.color.points }] : []),
    ...(presentation.retroPoints !== undefined ? [{ label: "RetroPoints", value: Math.round(presentation.retroPoints).toLocaleString(), tone: raTheme.color.retroPoints }] : []),
  ];
  const actionItems = buildRetroAchievementsOverviewActionItems({
    globalGoal,
    ...(gameGoalOverride !== undefined ? { gameGoalOverride } : {}),
    onOpenExternal: () => DeckyNavigation.NavigateToExternalWeb(`https://retroachievements.org/game/${game.gameId}`),
    onOpenGameInfo: (navigation) => details(() => navigation.restoreCurrent("game-info")),
    onSetGlobalGoal,
    onSetGameGoalOverride,
  });
  const history = award !== undefined ? <DeckyOverviewMilestoneShowcase
    kind={mastered ? "mastered" : "beaten"}
    color={mastered ? raTheme.color.mastered : raTheme.color.beatenFlagWhite}
    glow={mastered ? "rgba(242, 216, 127, 0.28)" : "rgba(255, 255, 255, 0.18)"}
    primaryLabel={mastered ? "MASTERY ACHIEVED" : "GOAL ACHIEVED"}
    title={`${mastered ? "Mastered" : "Beaten"} in ${awardMode}`}
    {...(awardDate !== undefined ? { supporting: <>Award recorded {awardDate}</> } : {})}
  /> : null;
  return <div data-ac-ra-theme="fullscreen" style={{ height: "100%", minHeight: 0, fontFamily: steamTheme.type.fontFamily }}><DeckyFullScreenGameOverviewLayout
    identity={<div style={{ ...overviewPanelStyle, flexDirection: "row", alignItems: "center", gap: 14 }}>
      <DeckyRetroAchievementsGameIcon game={game} src={game.coverImageUrl} fit="contain" size={64} prominent style={{ flexShrink: 0 }} />
      <div style={{ flex: "1 1 auto", minWidth: 120 }}><DeckyFullScreenGameTitle color={steamTheme.color.textPrimary} title={game.title} maxLines={2} /><div style={steamRecipes.text("fullscreen", "metadata")}>RetroAchievements{game.platformLabel ? ` · ${game.platformLabel}` : ""}</div></div>
      <div style={{ flex: "0 1 auto", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 6 }}>
        <DeckyOverviewHeaderIndicators mode={modeLabel.toUpperCase()} goal={goal.toUpperCase()} />
        <DeckyOverviewMenuButton label="Actions" compact items={actionItems} />
      </div>
    </div>}
    progress={<DeckyOverviewProgress headline={headline} {...(award !== undefined ? { detail: `${awardMode} award recorded` } : {})}
      percent={progress.completionPercent} unlocked={progress.unlockedCount} total={progress.totalCount} remaining={progress.remainingCount}
      {...(progress.lastUnlockAt !== undefined ? { lastUnlock: progress.lastUnlockAt } : {})}
      {...(latestAchievement !== undefined ? { latestAchievement } : {})}
      {...(progress.earnedPoints !== undefined ? { points: `${progress.earnedPoints.toLocaleString()} points` } : {})}
      {...(mastered || beaten ? { statusIcon: <DeckyGameStatusIcon kind={mastered ? "mastered" : "beaten"} size={48} color={mastered ? raTheme.color.mastered : raTheme.color.beatenFlagWhite} glow={mastered ? "rgba(242, 216, 127, 0.42)" : "rgba(255, 255, 255, 0.3)"} /> } : {})}
      tone={mastered ? "retroachievements-mastered" : beaten ? "retroachievements-beaten" : "default"}
      accent={mastered ? raTheme.color.mastered : beaten ? raTheme.color.beaten : steamTheme.color.textPrimary} />}
    companion={<DeckyOverviewCompanion actions={overviewActions} completed={overviewActions.goalComplete === true} history={history} goalLabel={goal === "beat" ? "Beat" : "Master"} />}
    supporting={<DeckyOverviewSupporting title="RetroAchievements" metrics={supportingMetrics.length > 0 ? supportingMetrics : [{ label: "Achievements", value: progress.totalCount.toLocaleString() }]} actions={overviewActions} onDetails={details} />}
    completed={overviewActions.goalComplete === true}
  /></div>;
}
