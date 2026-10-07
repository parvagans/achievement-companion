import type { GameDetailSnapshot, NormalizedAchievement, ProgressSummary } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { Focusable } from "@decky/ui";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { DeckyCompletionProgressBar, getCompletionPercent } from "./decky-completion-progress-bar";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DeckyGameStatusIcon } from "./decky-game-status-icon";
import { formatRetroAchievementsBeatenAtText, formatRetroAchievementsMasteredAtText } from "./decky-achievement-detail-helpers";
import { DeckySteamCompactAction } from "./decky-steam-compact-profile";
import { DeckySystemPill } from "./decky-system-pill";
import { registerCompactGameDetailCancelCallback } from "./decky-full-screen-cancel-bridge";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { formatRetroAchievementsCommunityDuration } from "./decky-retroachievements-community-stats-data";
import { getRetroAchievementsCompletionIndicatorState } from "./decky-retroachievements-completion-indicator";
import { sortAchievementsForDisplay } from "./decky-game-detail-ordering";
import { raRecipes, raTheme } from "./ra-theme";
import externalLinkIconUrl from "./assets/external-link.svg";
import clockIconUrl from "./assets/clock.svg";
import crownIconUrl from "./assets/crown.svg";
import masteredIconUrl from "./assets/mastered.svg";
import pieChartIconUrl from "./assets/pie-chart.svg";
import rankPointsIconUrl from "./assets/rank-points.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";
import usersIconUrl from "./assets/users.svg";

function formatCount(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString();
}

function formatPercent(value: number): string {
  return `${value.toFixed(value < 10 ? 1 : 0)}%`;
}

function modeUnlockedAt(achievement: NormalizedAchievement, mode: "hardcore" | "softcore"): number | undefined {
  return mode === "hardcore" ? achievement.hardcoreUnlockedAt : achievement.softcoreUnlockedAt;
}

export function isRetroAchievementsAchievementUnlockedInMode(
  achievement: NormalizedAchievement,
  mode: RetroAchievementsAchievementMode,
): boolean {
  if (mode === "both") return achievement.isUnlocked;
  return modeUnlockedAt(achievement, mode) !== undefined || (achievement.isUnlocked && achievement.unlockMode === mode);
}

export function getRetroAchievementsGameModeSummary(
  snapshot: GameDetailSnapshot,
  mode: "hardcore" | "softcore",
): ProgressSummary {
  const supplied = mode === "hardcore" ? snapshot.game.hardcoreSummary : snapshot.game.softcoreSummary;
  if (supplied !== undefined) return supplied;
  const unlockedCount = snapshot.achievements.filter((achievement) => isRetroAchievementsAchievementUnlockedInMode(achievement, mode)).length;
  return { unlockedCount, ...(snapshot.game.summary.totalCount !== undefined ? { totalCount: snapshot.game.summary.totalCount } : {}) };
}

function PassiveCard({ label, children }: { readonly label: string; readonly children: ReactNode }): JSX.Element {
  const [focused, setFocused] = useState(false);
  return (
    <Focusable
      aria-label={`${label} section`}
      noFocusRing
      onActivate={() => {}}
      onFocus={(event) => { setFocused(true); scrollDeckyFocusTargetIntoView(event.currentTarget); }}
      onGamepadFocus={(event) => { setFocused(true); scrollDeckyFocusTargetIntoView(event.currentTarget); }}
      onBlur={() => setFocused(false)}
      role="group"
      style={raRecipes.compactGame.passiveCard(focused)}
    >
      {children}
    </Focusable>
  );
}

function SectionHeading({ children }: { readonly children: ReactNode }): JSX.Element {
  return <div style={raRecipes.compactGame.heading}>{children}</div>;
}

function StatTile({ label, value, icon, tone = "primary" }: {
  readonly label: string;
  readonly value: string;
  readonly icon: string;
  readonly tone?: "primary" | "hardcore" | "softcore";
}): JSX.Element {
  return (
    <div style={raRecipes.compactGame.stat}>
      <img alt="" src={icon} style={{ ...raRecipes.compactGame.statIcon, filter: raTheme.iconFilter[tone] }} />
      <span style={raRecipes.compactGame.statText}>
        <span style={{ ...raRecipes.compactGame.statLabel, color: tone === "hardcore" ? raTheme.color.hardcore : tone === "softcore" ? raTheme.color.softcore : raTheme.color.accent }}>{label}</span>
        <strong style={raRecipes.compactGame.statValue}>{value}</strong>
      </span>
    </div>
  );
}

export function DeckyRetroAchievementsCompactGameOverview({
  snapshot,
  achievementMode,
  onBack,
  onOpenFullScreen,
  onViewAchievements,
  onOpenAchievement,
}: {
  readonly snapshot: GameDetailSnapshot;
  readonly achievementMode: RetroAchievementsAchievementMode;
  readonly onBack: () => void;
  readonly onOpenFullScreen: (() => void) | undefined;
  readonly onViewAchievements: (() => void) | undefined;
  readonly onOpenAchievement: (achievementId: string) => void;
}): JSX.Element {
  const rootRef = useRef<HTMLElement>(null);
  const firstActionRef = useRef<HTMLDivElement | null>(null);
  const game = snapshot.game;
  const status = getRetroAchievementsCompletionIndicatorState(game);
  const visibleStatus = status !== undefined && (achievementMode === "both" || status.endsWith(achievementMode)) ? status : undefined;
  const awardKind = status?.startsWith("mastered") === true ? "mastered" : "beaten";
  const awardDate = awardKind === "mastered" ? formatRetroAchievementsMasteredAtText(game) : formatRetroAchievementsBeatenAtText(game);
  const community = game.communityStats;
  const visibleModes = achievementMode === "both" ? (["hardcore", "softcore"] as const) : ([achievementMode] as const);
  const selectedSummary = achievementMode === "both" ? game.summary : getRetroAchievementsGameModeSummary(snapshot, achievementMode);
  const completionPercent = getCompletionPercent(selectedSummary);
  const recentAchievements = sortAchievementsForDisplay(snapshot.achievements, achievementMode)
    .filter((achievement) => isRetroAchievementsAchievementUnlockedInMode(achievement, achievementMode))
    .slice(0, 3);
  const earnedAchievements = snapshot.achievements.filter((achievement) => isRetroAchievementsAchievementUnlockedInMode(achievement, achievementMode));
  const earnedPoints = earnedAchievements.reduce((total, achievement) => total + (achievement.points ?? 0), 0);
  const earnedRetroPoints = earnedAchievements.reduce((total, achievement) => {
    const raw = achievement.metrics.find((metric) => metric.key === "true-ratio")?.value;
    const value = raw === undefined ? Number.NaN : Number(raw);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
  const communityEntries = [
    ...(achievementMode !== "hardcore" ? [
      { label: "Casual beat samples", value: community?.beatenSamples === undefined ? undefined : formatCount(community.beatenSamples), icon: usersIconUrl },
      { label: "Median casual beat", value: formatRetroAchievementsCommunityDuration(community?.medianBeatSoftcoreSeconds), icon: clockIconUrl },
      { label: "Casual completion samples", value: community?.completedSamples === undefined ? undefined : formatCount(community.completedSamples), icon: usersIconUrl },
      { label: "Median casual completion", value: formatRetroAchievementsCommunityDuration(community?.medianCompletionSeconds), icon: clockIconUrl },
    ] : []),
    ...(achievementMode !== "softcore" ? [
      { label: "Hardcore beat samples", value: community?.beatenHardcoreSamples === undefined ? undefined : formatCount(community.beatenHardcoreSamples), icon: usersIconUrl },
      { label: "Median hardcore beat", value: formatRetroAchievementsCommunityDuration(community?.medianBeatSeconds), icon: clockIconUrl },
      { label: "Mastery samples", value: community?.masteredSamples === undefined ? undefined : formatCount(community.masteredSamples), icon: crownIconUrl },
      { label: "Median mastered", value: formatRetroAchievementsCommunityDuration(community?.medianMasterySeconds), icon: clockIconUrl },
    ] : []),
    { label: "Players", value: community?.totalPlayers === undefined ? undefined : formatCount(community.totalPlayers), icon: usersIconUrl },
    { label: "Complete set rate", value: community?.masteryPercent === undefined ? undefined : formatPercent(community.masteryPercent), icon: pieChartIconUrl },
  ].filter((entry): entry is { label: string; value: string; icon: string } => entry.value !== undefined);

  useLayoutEffect(() => registerCompactGameDetailCancelCallback(rootRef.current, onBack), [onBack]);
  useLayoutEffect(() => requestDeckySteamGamepadFocusAfterMount(firstActionRef.current), []);

  return (
    <section data-ac-ra-theme="compact" data-ra-compact-game="true" ref={rootRef} style={raRecipes.compactGame.root}>
      <div style={raRecipes.compactGame.identity}>
        {game.coverImageUrl !== undefined ? <DeckyGameArtwork compact src={game.coverImageUrl} size={64} title={game.title} /> : null}
        <div style={raRecipes.compactGame.identityText}>
          <div style={raRecipes.compactGame.title}>{game.title}</div>
          {game.platformLabel !== undefined ? <DeckySystemPill label={game.platformLabel} iconUrl={game.systemIconUrl} iconSize={15} style={raRecipes.compactGame.platform} /> : null}
        </div>
      </div>

      {onOpenFullScreen !== undefined ? (
        <DeckySteamCompactAction ariaLabel="Open game full-screen" elementRef={(node) => { firstActionRef.current = node; }} onActivate={onOpenFullScreen} onCancel={onBack} preferredFocus scrollToTopOnFocus tone="primary">
          <span style={raRecipes.compactGame.actionLabel}><img alt="" src={externalLinkIconUrl} style={raRecipes.compactGame.actionIcon} />Open Full-Screen</span>
        </DeckySteamCompactAction>
      ) : null}
      {onViewAchievements !== undefined ? (
        <DeckySteamCompactAction ariaLabel="View game achievements" elementRef={onOpenFullScreen === undefined ? (node) => { firstActionRef.current = node; } : undefined} onActivate={onViewAchievements} onCancel={onBack} preferredFocus={onOpenFullScreen === undefined} tone="primary">
          <span style={raRecipes.compactGame.actionLabel}><img alt="" src={trophyIconUrl} style={raRecipes.compactGame.actionIcon} />View Achievements</span>
        </DeckySteamCompactAction>
      ) : null}

      <PassiveCard label="Progress Summary">
        <SectionHeading>Progress Summary</SectionHeading>
        <div style={raRecipes.compactGame.progressLine}>
          <span>{selectedSummary.totalCount === undefined ? `${formatCount(selectedSummary.unlockedCount)} unlocked` : `${formatCount(selectedSummary.unlockedCount)} / ${formatCount(selectedSummary.totalCount)} achievements`}</span>
          {completionPercent !== undefined ? <strong>{formatPercent(completionPercent)}</strong> : null}
        </div>
        {completionPercent !== undefined ? <DeckyCompletionProgressBar compact percent={completionPercent} showCaption={false} /> : null}
      </PassiveCard>

      {earnedAchievements.length > 0 ? (
        <PassiveCard label="Points earned">
          <SectionHeading>Your Points</SectionHeading>
          <div style={raRecipes.compactGame.statGrid}>
            <StatTile label="Points" value={formatCount(earnedPoints)} icon={trophyIconUrl} tone={achievementMode === "both" ? "primary" : achievementMode} />
            <StatTile label="RetroPoints" value={formatCount(earnedRetroPoints)} icon={rankPointsIconUrl} />
          </div>
        </PassiveCard>
      ) : null}

      {visibleStatus !== undefined ? (
        <PassiveCard label="Completion Badge">
          <SectionHeading>Completion Badge</SectionHeading>
          <div style={raRecipes.compactGame.award(awardKind)}>
            <DeckyGameStatusIcon kind={awardKind} size={36} color={raRecipes.gameAward[awardKind].color} accentColor={raTheme.color.hardcore} />
            <div><strong>{awardKind === "mastered" ? "Mastered" : "Beaten"}</strong><div style={raRecipes.compactGame.awardMode}>{visibleStatus.endsWith("hardcore") ? "Hardcore" : "Softcore"}{awardDate === undefined ? "" : ` · ${awardDate}`}</div></div>
          </div>
        </PassiveCard>
      ) : null}

      {communityEntries.length > 0 ? (
        <PassiveCard label="Community Insights">
          <SectionHeading>Community Insights</SectionHeading>
          <div style={raRecipes.compactGame.statGrid}>
            {communityEntries.map((entry) => <StatTile key={entry.label} label={entry.label} value={entry.value} icon={entry.icon} />)}
          </div>
        </PassiveCard>
      ) : null}

      <PassiveCard label="Achievement Modes">
        <SectionHeading>Achievement Modes</SectionHeading>
        <div style={raRecipes.compactGame.modeGrid(visibleModes.length)}>
          {visibleModes.map((mode) => {
            const summary = getRetroAchievementsGameModeSummary(snapshot, mode);
            const percent = getCompletionPercent(summary);
            return <div key={mode} style={raRecipes.compactGame.modeCard(mode)}><img alt="" src={mode === "hardcore" ? trophyIconUrl : masteredIconUrl} style={{ ...raRecipes.compactGame.statIcon, filter: raTheme.iconFilter[mode] }} /><span style={raRecipes.compactGame.statText}><span style={raRecipes.compactGame.statLabel}>{mode}</span><strong style={raRecipes.compactGame.modeValue}>{summary.totalCount === undefined ? `${formatCount(summary.unlockedCount)} unlocked` : `${formatCount(summary.unlockedCount)} / ${formatCount(summary.totalCount)}`}</strong>{percent !== undefined ? <small>{formatPercent(percent)} complete</small> : null}</span></div>;
          })}
        </div>
      </PassiveCard>

      {recentAchievements.length > 0 ? (
        <div style={raRecipes.compactGame.recentSection}>
          <SectionHeading>Recent Achievements</SectionHeading>
          {recentAchievements.map((achievement) => <DeckySteamCompactAction key={achievement.achievementId} ariaLabel={`Open achievement ${achievement.title}`} onActivate={() => onOpenAchievement(achievement.achievementId)} onCancel={onBack} tone="row" style={raRecipes.compactGame.recentRow}>
            {achievement.badgeImageUrl !== undefined ? <DeckyGameArtwork compact src={achievement.badgeImageUrl} size={36} title={achievement.title} /> : null}
            <span style={raRecipes.compactGame.recentText}><strong>{achievement.title}</strong><small>{achievement.points === undefined ? "Unlocked" : `${formatCount(achievement.points)} points`}</small></span>
          </DeckySteamCompactAction>)}
        </div>
      ) : null}
      {onViewAchievements !== undefined ? <DeckySteamCompactAction ariaLabel="View all game achievements" onActivate={onViewAchievements} onCancel={onBack} tone="row" style={raRecipes.compactGame.viewAll}>View All Achievements</DeckySteamCompactAction> : null}
    </section>
  );
}
