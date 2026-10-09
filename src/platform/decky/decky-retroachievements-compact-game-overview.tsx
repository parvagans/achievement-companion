import type { GameDetailSnapshot } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { Focusable, type FocusableProps } from "@decky/ui";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { DeckyCompletionProgressBar, getCompletionPercent } from "./decky-completion-progress-bar";
import { DeckyRetroAchievementsGameIcon } from "./decky-retroachievements-game-icon";
import { DeckyGameStatusIcon } from "./decky-game-status-icon";
import { formatRetroAchievementsBeatenAtText, formatRetroAchievementsMasteredAtText } from "./decky-achievement-detail-helpers";
import { DeckySteamCompactAction } from "./decky-steam-compact-profile";
import { DeckySystemPill } from "./decky-system-pill";
import { registerCompactGameDetailCancelCallback } from "./decky-full-screen-cancel-bridge";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { formatRetroAchievementsCommunityDuration } from "./decky-retroachievements-community-stats-data";
import { buildRetroAchievementsCompactGamePresentation } from "./decky-retroachievements-compact-game-model";
import { raRecipes, raTheme } from "./ra-theme";
import { DeckyRetroAchievementsPointsIcon } from "./decky-retroachievements-points-icon";
import clockIconUrl from "./assets/clock.svg";
import externalLinkIconUrl from "./assets/external-link.svg";
import starIconUrl from "./assets/star.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";

function formatCount(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString();
}

function formatPercent(value: number | undefined): string {
  return value === undefined ? "—" : `${Math.round(value)}%`;
}

function GameTitle({ title }: { readonly title: string }): JSX.Element {
  const titleRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState<number | undefined>();
  useLayoutEffect(() => {
    const element = titleRef.current;
    const ownerWindow = element?.ownerDocument.defaultView;
    if (element === null || ownerWindow === undefined || ownerWindow === null || element.clientWidth === 0) return;
    const normalSize = raTheme.type.compact.heading;
    const next = element.scrollWidth > element.clientWidth
      ? Math.max(12, Math.floor((normalSize * element.clientWidth / element.scrollWidth) * 10) / 10)
      : undefined;
    setFontSize((current) => current === next ? current : next);
  }, [title]);
  return <div ref={titleRef} title={title} style={{ ...raRecipes.compactGame.title, ...(fontSize === undefined ? {} : { fontSize }) }}>{title}</div>;
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

function InfoRow({ label, value }: { readonly label: string; readonly value: string }): JSX.Element {
  return <><span style={raRecipes.compactGame.infoLabel}>{label}</span><span style={raRecipes.compactGame.infoValue}>{value}</span></>;
}

export function DeckyRetroAchievementsCompactGameOverview({
  snapshot,
  achievementMode,
  onBack,
  onOpenFullScreen,
  onViewAchievements,
}: {
  readonly snapshot: GameDetailSnapshot;
  readonly achievementMode: RetroAchievementsAchievementMode;
  readonly onBack: () => void;
  readonly onOpenFullScreen: (() => void) | undefined;
  readonly onViewAchievements: (() => void) | undefined;
}): JSX.Element {
  const rootRef = useRef<HTMLElement>(null);
  const initialFocusRef = useRef<HTMLDivElement | null>(null);
  const game = snapshot.game;
  const presentation = buildRetroAchievementsCompactGamePresentation(snapshot, achievementMode);
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

  useLayoutEffect(() => registerCompactGameDetailCancelCallback(rootRef.current, onBack), [onBack]);
  useLayoutEffect(() => requestDeckySteamGamepadFocusAfterMount(initialFocusRef.current), []);

  return (
    <section data-ac-ra-theme="compact" data-ac-ra-compact-game="true" ref={rootRef} style={raRecipes.compactGame.root}>
      <div style={raRecipes.compactGame.hero()}>
        <DeckyRetroAchievementsGameIcon game={game} src={game.coverImageUrl} fit="contain" size={124} />
      </div>
      <GameTitle title={game.title} />
      <div style={raRecipes.compactGame.provider}>
        <DeckySystemPill label={game.platformLabel ?? "RetroAchievements"} iconUrl={game.systemIconUrl} iconSize={20} style={raRecipes.compactGame.providerContent} />
      </div>

      {onOpenFullScreen !== undefined ? <DeckySteamCompactAction ariaLabel="Open game full-screen" elementRef={(node) => { initialFocusRef.current = node; }} onActivate={onOpenFullScreen} onCancel={onBack} preferredFocus scrollToTopOnFocus tone="primary">
        <span style={raRecipes.compactGame.actionLabel}><img alt="" src={externalLinkIconUrl} style={raRecipes.compactGame.actionIcon} />Open Full-Screen</span>
      </DeckySteamCompactAction> : null}
      {onViewAchievements !== undefined ? <DeckySteamCompactAction ariaLabel="View game achievements" elementRef={onOpenFullScreen === undefined ? (node) => { initialFocusRef.current = node; } : undefined} onActivate={onViewAchievements} onCancel={onBack} preferredFocus={onOpenFullScreen === undefined} tone="primary">
        <span style={raRecipes.compactGame.actionLabel}><img alt="" src={trophyIconUrl} style={raRecipes.compactGame.actionIcon} />View Achievements</span>
      </DeckySteamCompactAction> : null}

      {status !== undefined ? <PassiveSection label="Completion Status">
        <div style={raRecipes.compactGame.status(awardKind)}>
          <span style={raRecipes.compactGame.statusWatermark}>
            <DeckyGameStatusIcon kind={awardKind} size={112} color={raRecipes.gameAward[awardKind].color} accentColor={awardKind === "mastered" ? raTheme.color.hardcore : raTheme.color.accentStrong} />
          </span>
          <span style={raRecipes.compactGame.statusEmblem(awardKind)}>
            <DeckyGameStatusIcon kind={awardKind} size={48} color={raRecipes.gameAward[awardKind].color} accentColor={awardKind === "mastered" ? raTheme.color.hardcore : raTheme.color.accentStrong} glow={awardKind === "mastered" ? "rgba(242, 216, 127, 0.42)" : "rgba(43, 195, 242, 0.42)"} />
          </span>
          <span style={raRecipes.compactGame.statusContent}>
            <span style={raRecipes.compactGame.statusEyebrow}>Completion Status</span>
            <strong style={raRecipes.compactGame.statusTitle(awardKind)}>{awardKind === "mastered" ? "Mastered" : "Beaten"}</strong>
            {awardDate !== undefined ? <span style={raRecipes.compactGame.statusDate}>{awardDate}</span> : null}
          </span>
        </div>
      </PassiveSection> : null}

      <PassiveSection label="Your Progress">
        <div style={raRecipes.compactGame.sectionLabel}>Your Progress</div>
        <div style={raRecipes.compactGame.progress}>
          <img alt="" src={trophyIconUrl} style={raRecipes.compactGame.actionIcon} />
          <span>{`${formatCount(presentation.summary.unlockedCount)} / ${formatCount(presentation.summary.totalCount)} achievements`}</span>
        </div>
        {completionPercent !== undefined ? <DeckyCompletionProgressBar compact percent={completionPercent} /> : null}
        <div style={presentation.modes.length === 1 ? { ...raRecipes.compactGame.metricGrid, gridTemplateColumns: "minmax(0, 1fr)" } : raRecipes.compactGame.metricGrid}>
          {presentation.modes.map(({ mode, summary }) => <div key={mode} style={raRecipes.compactGame.mode(mode)}>
            <img alt="" src={trophyIconUrl} style={{ width: 17, height: 17, filter: raTheme.iconFilter[mode] }} />
            <span style={raRecipes.compactGame.modeText}>
              <span style={{ ...raRecipes.compactGame.modeLabel, color: mode === "hardcore" ? raTheme.color.hardcore : raTheme.color.softcore }}>{mode}</span>
              <span style={raRecipes.compactGame.modeValue}>{formatCount(summary.unlockedCount)} / {formatCount(summary.totalCount)}</span>
            </span>
          </div>)}
        </div>
      </PassiveSection>

      {medians.length > 0 ? <PassiveSection label="Community Times">
        <div style={raRecipes.compactGame.sectionLabel}>Community Times</div>
        <div style={raRecipes.compactGame.metricGrid}>{medians.map((entry) => <Metric key={entry.key} icon={entry.icon} label={entry.label} value={entry.value} {...(entry.secondary === undefined ? {} : { secondary: entry.secondary })} tone={entry.tone} />)}</div>
      </PassiveSection> : null}

      <PassiveSection label="My RetroAchievements Stats">
        <div style={raRecipes.compactGame.sectionLabel}>My RetroAchievements Stats</div>
        <div style={raRecipes.compactGame.statGrid}>
          <Metric stat icon={<DeckyRetroAchievementsPointsIcon size={17} />} label="Points" value={formatCount(presentation.points)} tone={achievementMode === "both" ? "primary" : achievementMode} />
          <Metric stat icon={<DeckyRetroAchievementsPointsIcon size={17} />} label="RetroPoints" value={formatCount(presentation.retroPoints)} />
          <Metric stat icon={starIconUrl} label="Unlock %" value={formatPercent(completionPercent)} />
        </div>
      </PassiveSection>

      <PassiveSection label="Game Info">
        <div style={raRecipes.compactGame.sectionLabel}>Game Info</div>
        <div style={raRecipes.compactGame.info}>
          <InfoRow label="Game ID" value={game.gameId} />
          <InfoRow label="System" value={game.platformLabel ?? "—"} />
          {metricValue("released") !== undefined ? <InfoRow label="Release date" value={metricValue("released")!} /> : null}
          {community?.totalPlayers !== undefined ? <InfoRow label="Players" value={formatCount(community.totalPlayers)} /> : null}
        </div>
      </PassiveSection>
    </section>
  );
}
