import type { CSSProperties } from "react";
import { DeckyFullScreenGameProgressStat, DeckyFullScreenGameProgressStatGrid } from "./decky-full-screen-game-progress-stat";
import { DeckyFullScreenGameSpotlightCard } from "./decky-full-screen-game-spotlight-card";
import type { DeckySteamHuntersGameViewModel } from "./decky-steam-hunters-view-model";

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

function getCompactDashboardCardStyle(): CSSProperties {
  return { gap: 6, padding: 8, borderRadius: 14 };
}

function getFooterMetadataStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.5)", fontSize: "0.68em", lineHeight: 1.15 };
}

export function DeckySteamHuntersCommunitySection({
  model,
  compact = false,
}: {
  readonly model: DeckySteamHuntersGameViewModel;
  readonly compact?: boolean;
}): JSX.Element | null {
  const app = model.enrichment.app;
  if (!model.hasCommunityStats) {
    return null;
  }

  return (
    <DeckyFullScreenGameSpotlightCard
      title={compact ? "Community (SteamHunters)" : "Community"}
      focusable={false}
      {...(compact ? { style: getCompactDashboardCardStyle() } : {})}
    >
      <div style={getAttributionStyle()}>SteamHunters</div>
      <DeckyFullScreenGameProgressStatGrid gap={compact ? 6 : 8}>
        {app.playersPerfectedCount !== undefined ? (
          <DeckyFullScreenGameProgressStat dense={compact} label="Perfected" value={formatCount(app.playersPerfectedCount)} />
        ) : null}
        {app.playersStartedCount !== undefined ? (
          <DeckyFullScreenGameProgressStat dense={compact} label="Players started" value={formatCount(app.playersStartedCount)} />
        ) : null}
        {app.playersCompletedCount !== undefined ? (
          <DeckyFullScreenGameProgressStat dense={compact} label="Completed" value={formatCount(app.playersCompletedCount)} />
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
    <DeckyFullScreenGameSpotlightCard title={title} focusable={false} style={getCompactDashboardCardStyle()}>
      <div style={getAttributionStyle()}>SteamHunters</div>
      <DeckyFullScreenGameProgressStatGrid columns={4} gap={6}>
        {health.hasPaidDlc !== undefined ? (
          <DeckyFullScreenGameProgressStat dense label="DLC required" value={health.hasPaidDlc ? "Yes" : "No"} />
        ) : null}
        {health.unobtainableCount !== undefined ? (
          <DeckyFullScreenGameProgressStat dense label="Unobtainable" value={formatCount(health.unobtainableCount)} />
        ) : null}
        {health.conditionalCount !== undefined ? (
          <DeckyFullScreenGameProgressStat dense label="Conditional" value={formatCount(health.conditionalCount)} />
        ) : null}
        {health.brokenButObtainableCount !== undefined ? (
          <DeckyFullScreenGameProgressStat dense label="Broken but obtainable" value={formatCount(health.brokenButObtainableCount)} />
        ) : null}
      </DeckyFullScreenGameProgressStatGrid>
    </DeckyFullScreenGameSpotlightCard>
  );
}

export function DeckySteamHuntersSetDetailsSection({
  model,
  totalAchievementCount,
  footerText,
}: {
  readonly model: DeckySteamHuntersGameViewModel | undefined;
  readonly totalAchievementCount: number | undefined;
  readonly footerText?: string;
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
        label="SteamHunters points"
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
  ];
  if (values.length === 0) {
    return null;
  }

  return (
    <DeckyFullScreenGameSpotlightCard title="Set Details" focusable={false} style={getCompactDashboardCardStyle()}>
      {model !== undefined ? <div style={getAttributionStyle()}>SteamHunters</div> : null}
      <DeckyFullScreenGameProgressStatGrid columns={values.length} gap={6}>
        {values}
      </DeckyFullScreenGameProgressStatGrid>
      {footerText !== undefined ? <div style={getFooterMetadataStyle()}>{footerText}</div> : null}
    </DeckyFullScreenGameSpotlightCard>
  );
}
