import type { GameDetailSnapshot } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { Focusable, type FocusableProps } from "@decky/ui";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { getCompletionPercent } from "./decky-completion-progress-bar";
import { DeckyRetroAchievementsGameIcon } from "./decky-retroachievements-game-icon";
import { DeckyGameStatusIcon } from "./decky-game-status-icon";
import { formatRetroAchievementsBeatenAtText, formatRetroAchievementsMasteredAtText } from "./decky-achievement-detail-helpers";
import { DeckySystemPill } from "./decky-system-pill";
import { registerCompactGameDetailCancelCallback } from "./decky-full-screen-cancel-bridge";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { formatRetroAchievementsCommunityDuration } from "./decky-retroachievements-community-stats-data";
import { buildRetroAchievementsCompactGamePresentation, shouldCollapseRetroAchievementsModeProgress } from "./decky-retroachievements-compact-game-model";
import { raRecipes, raTheme } from "./ra-theme";
import { DeckyRetroAchievementsPointsIcon } from "./decky-retroachievements-points-icon";
import { DeckyCompactGameOverviewActions } from "./decky-compact-game-overview-actions";
import { DeckyCompactGameOverviewUpNext } from "./decky-compact-game-overview-up-next";
import { openDeckyOverviewDetails } from "./decky-full-screen-game-overview-content";
import { buildDeckyRetroAchievementsGameInfoRows, formatDeckyOverviewDateTime } from "./decky-overview-format";
import { buildDeckyRetroAchievementsProgressSummaryData } from "./decky-retroachievements-progress-summary-data";
import { DeckyResponsiveGameTitle } from "./decky-responsive-game-title";
import clockIconUrl from "./assets/clock.svg";
import starIconUrl from "./assets/star.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";

function formatCount(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString();
}

function formatPercent(value: number | undefined): string {
  return value === undefined ? "—" : `${Math.round(value)}%`;
}

function GameTitle({ title }: { readonly title: string }): JSX.Element {
  return <DeckyResponsiveGameTitle title={title} preferredFontSize={16} minimumFontSize={14} style={raRecipes.compactGame.title} />;
}

function PassiveSection({ label, children }: { readonly label: string; readonly children: ReactNode }): JSX.Element {
  const [focused, setFocused] = useState(false);
  const focus: NonNullable<FocusableProps["onGamepadFocus"]> = (event) => {
    setFocused(true);
    scrollDeckyFocusTargetIntoView(event.currentTarget);
  };
  return (
    <Focusable
      aria-label={`${label} section`}
      noFocusRing
      onActivate={() => {}}
      onFocus={(event) => { setFocused(true); scrollDeckyFocusTargetIntoView(event.currentTarget); }}
      onGamepadFocus={focus}
      onBlur={() => setFocused(false)}
      role="group"
      style={raRecipes.compactGame.section(focused)}
    >
      {children}
    </Focusable>
  );
}

function Metric({ icon, label, value, secondary, tone = "primary", stat = false }: {
  readonly icon: string | JSX.Element;
  readonly label: string;
  readonly value: string;
  readonly secondary?: string;
  readonly tone?: "primary" | "hardcore" | "softcore";
  readonly stat?: boolean;
}): JSX.Element {
  return (
    <div style={stat ? raRecipes.compactGame.statMetric() : raRecipes.compactGame.metric()}>
      {typeof icon === "string" ? <img alt="" aria-hidden="true" src={icon} style={{ width: stat ? 17 : 22, height: stat ? 17 : 22, filter: raTheme.iconFilter[tone] }} /> : icon}
      <div style={raRecipes.compactGame.metricText}>
        <span style={{ ...raRecipes.compactGame.metricLabel, color: tone === "hardcore" ? raTheme.color.hardcore : tone === "softcore" ? raTheme.color.softcore : raTheme.color.textSecondary }}>{label}</span>
        <strong style={raRecipes.compactGame.metricValue}>{value}</strong>
        {secondary !== undefined ? <span style={raRecipes.compactGame.metricSecondary}>{secondary}</span> : null}
      </div>
    </div>
  );
}

export function DeckyRetroAchievementsCompactGameOverview({
  snapshot,
  achievementMode,
  onBack,
  onOpenFullScreen,
  onViewAchievements,
  onOpenAchievementDetail,
}: {
  readonly snapshot: GameDetailSnapshot;
  readonly achievementMode: RetroAchievementsAchievementMode;
  readonly onBack: () => void;
  readonly onOpenFullScreen: (() => void) | undefined;
  readonly onViewAchievements: ((achievementId?: string) => void) | undefined;
  readonly onOpenAchievementDetail: (achievementId: string, onClose?: () => void) => void;
}): JSX.Element {
  const rootRef = useRef<HTMLElement>(null);
  const game = snapshot.game;
  const presentation = buildRetroAchievementsCompactGamePresentation(snapshot, achievementMode);
  const collapseModeProgress = shouldCollapseRetroAchievementsModeProgress(presentation.summary, presentation.modes);
  const progressSummary = buildDeckyRetroAchievementsProgressSummaryData({ summary: presentation.summary, achievements: snapshot.achievements, achievementMode });
  const completionPercent = getCompletionPercent(presentation.summary);
  const community = game.communityStats;
  const status = presentation.completionStatus;
  const awardKind = status?.startsWith("mastered") === true ? "mastered" : "beaten";
  const awardDate = awardKind === "mastered" ? formatRetroAchievementsMasteredAtText(game) : formatRetroAchievementsBeatenAtText(game);
  const medians = [
    ...(achievementMode !== "softcore" ? [
      { key: "hardcore-beat", icon: clockIconUrl, label: "Median HC beat", value: formatRetroAchievementsCommunityDuration(community?.medianBeatSeconds), secondary: community?.beatenHardcoreSamples === undefined ? undefined : `${formatCount(community.beatenHardcoreSamples)} players`, tone: "hardcore" as const },
      { key: "mastery", icon: trophyIconUrl, label: "Median mastery", value: formatRetroAchievementsCommunityDuration(community?.medianMasterySeconds), secondary: community?.masteredSamples === undefined ? undefined : `${formatCount(community.masteredSamples)} players`, tone: "hardcore" as const },
    ] : []),
    ...(achievementMode !== "hardcore" ? [
      { key: "casual-beat", icon: clockIconUrl, label: "Median casual beat", value: formatRetroAchievementsCommunityDuration(community?.medianBeatSoftcoreSeconds), secondary: community?.beatenSamples === undefined ? undefined : `${formatCount(community.beatenSamples)} players`, tone: "softcore" as const },
      { key: "casual-completion", icon: trophyIconUrl, label: "Median casual completion", value: formatRetroAchievementsCommunityDuration(community?.medianCompletionSeconds), secondary: community?.completedSamples === undefined ? undefined : `${formatCount(community.completedSamples)} players`, tone: "softcore" as const },
    ] : []),
  ].filter((entry): entry is typeof entry & { value: string } => entry.value !== undefined);
  const info = game.metrics;
  const metricValue = (key: string): string | undefined => info.find((metric) => metric.key === key)?.value;
  const releaseDate = metricValue("released");
  const lastSync = snapshot.refreshedAt === undefined ? undefined : formatDeckyOverviewDateTime(snapshot.refreshedAt);
  const completionAward = status === undefined
    ? undefined
    : `${awardKind === "mastered" ? "Mastered" : "Beaten"} · ${status.endsWith("hardcore") ? "Hardcore" : "Softcore"}`;
  const openGameInfo = (onClose: () => void): void => openDeckyOverviewDetails(game.title, buildDeckyRetroAchievementsGameInfoRows({
    gameId: game.gameId,
    ...(game.platformLabel !== undefined ? { system: game.platformLabel } : {}),
    ...(releaseDate !== undefined ? { releaseDate } : {}),
    ...(lastSync !== undefined ? { lastSync } : {}),
    ...(progressSummary.totalPoints !== undefined ? { totalSetPoints: progressSummary.totalPoints.toLocaleString() } : {}),
    ...(community?.totalPlayers !== undefined ? { playerCount: community.totalPlayers.toLocaleString() } : {}),
    ...(completionAward !== undefined ? { completionAward } : {}),
    ...(awardDate !== undefined ? { awardDate } : {}),
  }), undefined, onClose, { preserveCompactSession: true });

  useLayoutEffect(() => registerCompactGameDetailCancelCallback(rootRef.current, onBack), [onBack]);

  return (
    <section data-ac-ra-theme="compact" data-ac-ra-compact-game="true" ref={rootRef} style={raRecipes.compactGame.root}>
      <div style={raRecipes.compactGame.identity}>
        <DeckyRetroAchievementsGameIcon game={game} src={game.coverImageUrl} fit="contain" size={92} />
        <div style={raRecipes.compactGame.identityText}>
          <GameTitle title={game.title} />
          <div style={raRecipes.compactGame.provider}>
            <DeckySystemPill label={game.platformLabel ?? "RetroAchievements"} iconUrl={game.systemIconUrl} iconSize={18} style={raRecipes.compactGame.providerContent} />
          </div>
        </div>
      </div>

      {onViewAchievements !== undefined ? <DeckyCompactGameOverviewActions providerId={game.providerId} gameId={game.gameId} onCancel={onBack} onOpenAchievements={() => onViewAchievements()} onOpenFullScreen={onOpenFullScreen} onOpenGameInfo={openGameInfo} /> : null}

      <DeckyCompactGameOverviewUpNext snapshot={snapshot} summary={presentation.summary} achievementMode={achievementMode} onCancel={onBack} onOpenAchievementDetail={onOpenAchievementDetail} onOpenAchievements={(achievementId) => onViewAchievements?.(achievementId)} progressDetails={
        collapseModeProgress ? <span style={raRecipes.compactGame.modeIndicator(presentation.modes[0]?.mode ?? "hardcore")}>{presentation.modes[0]?.mode ?? "Hardcore"}</span> : <div style={presentation.modes.length === 1 ? { ...raRecipes.compactGame.metricGrid, gridTemplateColumns: "minmax(0, 1fr)" } : raRecipes.compactGame.metricGrid}>
          {presentation.modes.map(({ mode, summary }) => <div key={mode} style={raRecipes.compactGame.mode(mode)}>
            <img alt="" src={trophyIconUrl} style={{ width: 17, height: 17, filter: raTheme.iconFilter[mode] }} />
            <span style={raRecipes.compactGame.modeText}>
              <span style={{ ...raRecipes.compactGame.modeLabel, color: mode === "hardcore" ? raTheme.color.hardcore : raTheme.color.softcore }}>{mode}</span>
              <span style={raRecipes.compactGame.modeValue}>{formatCount(summary.unlockedCount)} / {formatCount(summary.totalCount)}</span>
            </span>
          </div>)}
        </div>
      } />

      {status !== undefined ? <PassiveSection label="Completion Status">
        <div style={raRecipes.compactGame.status(awardKind, "game")}>
          <span style={raRecipes.compactGame.statusWatermark}>
            <DeckyGameStatusIcon kind={awardKind} size={112} color={awardKind === "mastered" ? raRecipes.gameAward.mastered.color : raTheme.color.beatenFlagWhite} accentColor={awardKind === "mastered" ? raTheme.color.hardcore : raTheme.color.beatenFlagBlack} />
          </span>
          <span style={raRecipes.compactGame.statusEmblem(awardKind, "game")}>
            <DeckyGameStatusIcon kind={awardKind} size={48} color={awardKind === "mastered" ? raRecipes.gameAward.mastered.color : raTheme.color.beatenFlagWhite} accentColor={awardKind === "mastered" ? raTheme.color.hardcore : raTheme.color.beatenFlagBlack} glow={awardKind === "mastered" ? "rgba(242, 216, 127, 0.42)" : "rgba(255, 255, 255, 0.3)"} />
          </span>
          <span style={raRecipes.compactGame.statusContent}>
            <span style={raRecipes.compactGame.statusEyebrow}>Completion Status</span>
            <strong style={raRecipes.compactGame.statusTitle(awardKind)}>{awardKind === "mastered" ? "Mastered" : "Beaten"}</strong>
            {awardDate !== undefined ? <span style={raRecipes.compactGame.statusDate}>{awardDate}</span> : null}
          </span>
        </div>
      </PassiveSection> : null}

      <PassiveSection label="My RetroAchievements Stats">
        <div style={raRecipes.compactGame.sectionLabel}>My RetroAchievements Stats</div>
        <div style={raRecipes.compactGame.statGrid}>
          <Metric stat icon={<DeckyRetroAchievementsPointsIcon size={17} />} label="Points" value={formatCount(presentation.points)} tone={achievementMode === "both" ? "primary" : achievementMode} />
          <Metric stat icon={<DeckyRetroAchievementsPointsIcon size={17} />} label="RetroPoints" value={formatCount(presentation.retroPoints)} />
          <Metric stat icon={starIconUrl} label="Unlock %" value={formatPercent(completionPercent)} />
        </div>
      </PassiveSection>

      {medians.length > 0 ? <PassiveSection label="Community Times">
        <div style={raRecipes.compactGame.sectionLabel}>Community Times</div>
        <div style={raRecipes.compactGame.metricGrid}>{medians.map((entry) => <Metric key={entry.key} icon={entry.icon} label={entry.label} value={entry.value} {...(entry.secondary === undefined ? {} : { secondary: entry.secondary })} tone={entry.tone} />)}</div>
      </PassiveSection> : null}

    </section>
  );
}
