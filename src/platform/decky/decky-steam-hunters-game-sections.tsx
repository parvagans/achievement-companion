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

function getCommunityInsightsStackStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 12, width: "100%", minWidth: 0 };
}

function getCommunityInsightsTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1.4em",
    fontWeight: 800,
    letterSpacing: 0,
    textTransform: "none",
  };
}

function getCommunityInsightsGridStyle(): CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, width: "100%" };
}

function getCommunityInsightMetricStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 84,
    padding: "10px 8px",
    borderRadius: 14,
    border: "1px solid rgba(68, 184, 255, 0.22)",
    background: "linear-gradient(180deg, rgba(10, 40, 60, 0.72), rgba(6, 25, 40, 0.68))",
    boxSizing: "border-box",
    textAlign: "center",
  };
}

function getCommunityInsightLabelStyle(): CSSProperties {
  return { color: "rgba(166, 211, 255, 0.96)", fontSize: "0.88em", fontWeight: 700, lineHeight: 1.15 };
}

function getCommunityInsightValueStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.98)", fontSize: "1.5em", fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap" };
}

function getRarityBarStyle(): CSSProperties {
  return {
    display: "flex",
    height: 28,
    overflow: "hidden",
    borderRadius: 999,
    background: "rgba(255, 255, 255, 0.07)",
    boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.09)",
  };
}

function getRarityLegendStyle(): CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, width: "100%" };
}

function getRarityLegendNameStyle(color: string): CSSProperties {
  return { color, fontSize: "0.92em", fontWeight: 800, lineHeight: 1.15 };
}

function getRarityLegendValueStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.98)", fontSize: "0.92em", fontWeight: 800, lineHeight: 1.15 };
}

function CommunityInsightMetric({ label, value }: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <div style={getCommunityInsightMetricStyle()}>
      <div style={getCommunityInsightLabelStyle()}>{label}</div>
      <div style={getCommunityInsightValueStyle()}>{value}</div>
    </div>
  );
}

function CommunityRarityDistribution({
  distribution,
}: {
  readonly distribution: NonNullable<DeckySteamHuntersGameViewModel["rarityDistribution"]>;
}): JSX.Element {
  const entries = [
    { key: "common", label: "Common", count: distribution.common, color: "#46ed91" },
    { key: "uncommon", label: "Uncommon", count: distribution.uncommon, color: "#3ab7ff" },
    { key: "rare", label: "Rare", count: distribution.rare, color: "#a855f7" },
    { key: "very-rare", label: "Very Rare", count: distribution.veryRare, color: "#f35bd5" },
  ];

  return (
    <DeckyFullScreenGameSpotlightCard
      title={<span style={getCommunityInsightsTitleStyle()}>Achievement Rarity Distribution</span>}
      focusable={false}
      headerAlignment="left"
      style={{ gap: 14, padding: 14, borderColor: "rgba(68, 184, 255, 0.2)" }}
    >
      <div aria-label="Achievement rarity distribution" style={getRarityBarStyle()}>
        {entries.map((entry) => (
          entry.count > 0 ? (
            <div
              key={entry.key}
              style={{
                flex: `${entry.count} 1 0`,
                minWidth: 0,
                background: `linear-gradient(90deg, ${entry.color}, ${entry.color}c7)`,
                boxShadow: "inset -3px 0 0 rgba(5, 20, 35, 0.76)",
              }}
            />
          ) : null
        ))}
      </div>
      <div style={getRarityLegendStyle()}>
        {entries.map((entry) => {
          const percentage = distribution.total === 0 ? 0 : (entry.count / distribution.total) * 100;
          return (
            <div key={entry.key} style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                <span aria-hidden="true" style={{ width: 14, height: 14, flexShrink: 0, borderRadius: "50%", background: entry.color, boxShadow: `0 0 10px ${entry.color}80` }} />
                <span style={getRarityLegendNameStyle(entry.color)}>{entry.label}</span>
              </div>
              <div style={getRarityLegendValueStyle()}>{`${entry.count.toLocaleString()} (${formatSteamHuntersPercentage(percentage)})`}</div>
            </div>
          );
        })}
      </div>
    </DeckyFullScreenGameSpotlightCard>
  );
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

  if (!compact) {
    const communityMetrics = [
      ...(summary.startedPlayers !== undefined ? [{ label: "Players Started", value: formatCount(summary.startedPlayers) }] : []),
      ...(summary.perfectedPlayers !== undefined ? [{ label: "Players Perfected", value: formatCount(summary.perfectedPlayers) }] : []),
      ...(summary.perfectedPercentage !== undefined ? [{ label: "Perfected", value: formatSteamHuntersPercentage(summary.perfectedPercentage) }] : []),
      ...(summary.medianCompletionMinutes !== undefined ? [{ label: "Median 100%", value: formatSteamHuntersCompletionDuration(summary.medianCompletionMinutes) }] : []),
      ...(summary.fastestCompletionMinutes !== undefined ? [{ label: "Fastest 100%", value: formatSteamHuntersCompletionDuration(summary.fastestCompletionMinutes) }] : []),
      ...(summary.totalPlayers !== undefined ? [{ label: "Total Players", value: formatCount(summary.totalPlayers) }] : []),
    ];

    return (
      <div style={getCommunityInsightsStackStyle()}>
        <DeckyFullScreenGameSpotlightCard
          title={<span style={getCommunityInsightsTitleStyle()}>Community Insights (SteamHunters)</span>}
          focusable={sectionEntryFocusTarget}
          headerAlignment="left"
          style={{ gap: 12, padding: 14, borderColor: "rgba(68, 184, 255, 0.2)" }}
          {...(sectionEntryFocusTarget ? { focusTargetId: STEAM_HUNTERS_COMMUNITY_SECTION_FOCUS_TARGET } : {})}
        >
          <div style={getCommunityInsightsGridStyle()}>
            {communityMetrics.map((metric) => <CommunityInsightMetric key={metric.label} {...metric} />)}
          </div>
        </DeckyFullScreenGameSpotlightCard>
        {model.rarityDistribution !== undefined ? <CommunityRarityDistribution distribution={model.rarityDistribution} /> : null}
      </div>
    );
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
