import type { CSSProperties } from "react";
import { DeckyFullScreenGameProgressStat, DeckyFullScreenGameProgressStatGrid } from "./decky-full-screen-game-progress-stat";
import { DeckyFullScreenGameSpotlightCard } from "./decky-full-screen-game-spotlight-card";
import type { DeckySteamHuntersGameViewModel } from "./decky-steam-hunters-view-model";
import { formatSteamHuntersCompletionDuration, formatSteamHuntersPercentage } from "./decky-steam-hunters-presentation";
import { DeckySteamBrokenIcon, DeckySteamConditionalIcon, DeckySteamDlcIcon, DeckySteamUnobtainableIcon } from "./decky-steam-icons";

export const STEAM_HUNTERS_COMMUNITY_SECTION_FOCUS_TARGET = "steam-community-section";

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatReleaseDate(value: string): string {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleDateString() : value;
}

function getAttributionStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "0.76em",
    fontWeight: 700,
    letterSpacing: "0.06em",
    lineHeight: 1.2,
    textTransform: "uppercase",
  };
}

function getCompactDashboardCardStyle(fillHeight = false): CSSProperties {
  return {
    gap: 6,
    padding: 8,
    borderRadius: 14,
    ...(fillHeight ? { height: "100%", justifyContent: "space-between" } : {}),
  };
}

function SteamHuntersCardTitle({ title }: { readonly title: string }): JSX.Element {
  return (
    <>
      <div>{title}</div>
      <div style={getAttributionStyle()}>(SteamHunters)</div>
    </>
  );
}

export function DeckySteamHuntersCommunitySection({
  model,
  compact = false,
  fillHeight = false,
  sectionEntryFocusTarget = false,
}: {
  readonly model: DeckySteamHuntersGameViewModel;
  readonly compact?: boolean;
  readonly fillHeight?: boolean;
  readonly sectionEntryFocusTarget?: boolean;
}): JSX.Element | null {
  const summary = model.communitySummary;
  if (!model.hasCommunityStats || summary === undefined) {
    return null;
  }

  return (
    <DeckyFullScreenGameSpotlightCard
      title={<SteamHuntersCardTitle title="Community" />}
      // The standalone Community tab has no actions. Its card is therefore a
      // deliberate section-entry anchor so shoulder navigation retains focus.
      focusable={sectionEntryFocusTarget}
      {...(sectionEntryFocusTarget
        ? { focusTargetId: STEAM_HUNTERS_COMMUNITY_SECTION_FOCUS_TARGET }
        : {})}
      {...(compact ? { style: getCompactDashboardCardStyle(fillHeight) } : {})}
    >
      <DeckyFullScreenGameProgressStatGrid columns={2} gap={compact ? 6 : 8}>
        {summary.startedPlayers !== undefined ? (
          <DeckyFullScreenGameProgressStat dense={compact} label="Started" value={formatCount(summary.startedPlayers)} />
        ) : null}
        {summary.perfectedPercentage !== undefined ? (
          <DeckyFullScreenGameProgressStat dense={compact} label="Perfected %" value={formatSteamHuntersPercentage(summary.perfectedPercentage)} />
        ) : null}
        {summary.perfectedPlayers !== undefined ? (
          <DeckyFullScreenGameProgressStat dense={compact} label="Perfected" value={formatCount(summary.perfectedPlayers)} />
        ) : null}
        {summary.beatenPlayers !== undefined ? (
          <DeckyFullScreenGameProgressStat dense={compact} label="Beaten" value={formatCount(summary.beatenPlayers)} />
        ) : null}
        {summary.medianCompletionMinutes !== undefined ? (
          <DeckyFullScreenGameProgressStat dense={compact} label="Median 100%" value={formatSteamHuntersCompletionDuration(summary.medianCompletionMinutes)} />
        ) : null}
        {summary.fastestCompletionMinutes !== undefined ? (
          <DeckyFullScreenGameProgressStat dense={compact} label="Fastest 100%" value={formatSteamHuntersCompletionDuration(summary.fastestCompletionMinutes)} />
        ) : null}
      </DeckyFullScreenGameProgressStatGrid>
    </DeckyFullScreenGameSpotlightCard>
  );
}

export function DeckySteamHuntersCompletionHealthSection({
  model,
  title = "Completion Health",
}: {
  readonly model: DeckySteamHuntersGameViewModel;
  readonly title?: string;
}): JSX.Element | null {
  const health = model.completionHealth;
  if (
    health.hasPaidDlc === undefined &&
    health.unobtainableCount === undefined &&
    health.conditionalCount === undefined &&
    health.brokenButObtainableCount === undefined
  ) {
    return null;
  }

  return (
    <DeckyFullScreenGameSpotlightCard
      title={<SteamHuntersCardTitle title={title} />}
      focusable={false}
      style={getCompactDashboardCardStyle()}
    >
      <DeckyFullScreenGameProgressStatGrid columns={4} gap={6}>
        {health.hasPaidDlc !== undefined ? (
          <DeckyFullScreenGameProgressStat dense icon={<DeckySteamDlcIcon />} label="DLC required" value={health.hasPaidDlc ? "Yes" : "No"} />
        ) : null}
        {health.unobtainableCount !== undefined ? (
          <DeckyFullScreenGameProgressStat dense icon={<DeckySteamUnobtainableIcon />} label="Unobtainable" value={formatCount(health.unobtainableCount)} />
        ) : null}
        {health.conditionalCount !== undefined ? (
          <DeckyFullScreenGameProgressStat dense icon={<DeckySteamConditionalIcon />} label="Conditional" value={formatCount(health.conditionalCount)} />
        ) : null}
        {health.brokenButObtainableCount !== undefined ? (
          <DeckyFullScreenGameProgressStat dense icon={<DeckySteamBrokenIcon />} label="Broken but obtainable" value={formatCount(health.brokenButObtainableCount)} />
        ) : null}
      </DeckyFullScreenGameProgressStatGrid>
    </DeckyFullScreenGameSpotlightCard>
  );
}

export function DeckySteamHuntersSetDetailsSection({
  model,
  totalAchievementCount,
  updatedLabel,
}: {
  readonly model: DeckySteamHuntersGameViewModel | undefined;
  readonly totalAchievementCount: number | undefined;
  readonly updatedLabel: string;
}): JSX.Element | null {
  const app = model?.enrichment.app;
  const values = [
    ...(totalAchievementCount !== undefined ? [
      <DeckyFullScreenGameProgressStat
        key="achievement-count"
        label="Total achievements"
        value={formatCount(totalAchievementCount)}
        dense
      />,
    ] : []),
    ...(app?.points !== undefined ? [
      <DeckyFullScreenGameProgressStat
        key="points"
        label="SH points"
        value={formatCount(app.points)}
        dense
      />,
    ] : []),
    ...(app?.releaseDate !== undefined ? [
      <DeckyFullScreenGameProgressStat
        key="release-date"
        label="Release date"
        value={formatReleaseDate(app.releaseDate)}
        dense
      />,
    ] : []),
    <DeckyFullScreenGameProgressStat
      key="last-sh-update"
      label="Last SH update"
      value={updatedLabel}
      dense
    />,
  ];
  if (values.length === 0) {
    return null;
  }

  return (
    <DeckyFullScreenGameSpotlightCard
      title={<SteamHuntersCardTitle title="Set Details" />}
      focusable={false}
      style={getCompactDashboardCardStyle()}
    >
      <DeckyFullScreenGameProgressStatGrid columns={values.length} gap={6}>
        {values}
      </DeckyFullScreenGameProgressStatGrid>
    </DeckyFullScreenGameSpotlightCard>
  );
}
