import type { CSSProperties, ReactNode } from "react";
import type { DeckyCommunityRarityDistribution } from "./decky-community-rarity";
import { DeckyFullScreenGameSpotlightCard } from "./decky-full-screen-game-spotlight-card";
import { achievementCompanionQamTheme as qamTheme, qamActivityCalendarColors } from "./decky-qam-theme";

function getCommunityInsightsTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1.4em",
    fontWeight: 800,
    letterSpacing: 0,
    textTransform: "none",
  };
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
    border: `1px solid ${qamTheme.color.borderSubtle}`,
    background: qamTheme.surface.contentStat,
    boxSizing: "border-box",
    textAlign: "center",
  };
}

function getCommunityInsightValueStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.98)", fontSize: "1.5em", fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap" };
}

export function DeckyCommunityInsightsStack({ children }: { readonly children: ReactNode }): JSX.Element {
  return <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", minWidth: 0 }}>{children}</div>;
}

export function DeckyCommunityInsightsCard({
  title,
  children,
  focusable,
  focusTargetId,
  note,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly focusable: boolean;
  readonly focusTargetId?: string;
  readonly note?: string;
}): JSX.Element {
  return (
    <DeckyFullScreenGameSpotlightCard
      title={<span style={getCommunityInsightsTitleStyle()}>{title}</span>}
      focusable={focusable}
      headerAlignment="left"
      style={{ gap: 12, padding: 14, borderColor: qamTheme.color.borderSubtle, background: qamTheme.surface.contentCard }}
      {...(focusTargetId !== undefined ? { focusTargetId } : {})}
    >
      {note !== undefined ? <div style={{ color: qamTheme.color.textSecondary, fontSize: "0.82em" }}>{note}</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, width: "100%" }}>
        {children}
      </div>
    </DeckyFullScreenGameSpotlightCard>
  );
}

export function DeckyCommunityInsightMetric({
  label,
  value,
  valueStyle,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly valueStyle?: CSSProperties;
}): JSX.Element {
  return (
    <div style={getCommunityInsightMetricStyle()}>
      <div style={{ color: qamTheme.color.accent, fontSize: "0.88em", fontWeight: 700, lineHeight: 1.15 }}>{label}</div>
      <div style={{ ...getCommunityInsightValueStyle(), ...valueStyle }}>{value}</div>
    </div>
  );
}

export function DeckyCommunityRarityDistribution({
  distribution,
}: {
  readonly distribution: DeckyCommunityRarityDistribution;
}): JSX.Element {
  const entries = [
    { key: "common", label: "Common", count: distribution.common, color: qamActivityCalendarColors[1] },
    { key: "uncommon", label: "Uncommon", count: distribution.uncommon, color: qamActivityCalendarColors[2] },
    { key: "rare", label: "Rare", count: distribution.rare, color: qamActivityCalendarColors[3] },
    { key: "very-rare", label: "Very Rare", count: distribution.veryRare, color: qamActivityCalendarColors[4] },
  ];

  return (
    <DeckyFullScreenGameSpotlightCard
      title={<span style={getCommunityInsightsTitleStyle()}>Achievement Rarity Distribution</span>}
      focusable={false}
      headerAlignment="left"
      style={{ gap: 14, padding: 14, borderColor: qamTheme.color.borderSubtle, background: qamTheme.surface.contentCard }}
    >
      <div
        aria-label="Achievement rarity distribution"
        style={{ display: "flex", height: 28, overflow: "hidden", borderRadius: 999, background: qamTheme.surface.progressTrack, boxShadow: `inset 0 0 0 1px ${qamTheme.color.borderSubtle}` }}
      >
        {entries.map((entry) => (
          entry.count > 0 ? (
            <div
              key={entry.key}
              style={{
                flex: `${entry.count} 1 0`,
                minWidth: 0,
                background: entry.color,
                boxShadow: `inset -3px 0 0 ${qamTheme.color.background}`,
              }}
            />
          ) : null
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, width: "100%" }}>
        {entries.map((entry) => {
          const percentage = distribution.total === 0 ? 0 : (entry.count / distribution.total) * 100;
          return (
            <div key={entry.key} style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                <span aria-hidden="true" style={{ width: 14, height: 14, flexShrink: 0, borderRadius: "50%", background: entry.color }} />
                <span style={{ color: qamTheme.color.textPrimary, fontSize: "0.92em", fontWeight: 800, lineHeight: 1.15 }}>{entry.label}</span>
              </div>
              <div style={{ color: qamTheme.color.textPrimary, fontSize: "0.92em", fontWeight: 800, lineHeight: 1.15 }}>{`${entry.count.toLocaleString()} (${Number(percentage.toFixed(1))}%)`}</div>
            </div>
          );
        })}
      </div>
    </DeckyFullScreenGameSpotlightCard>
  );
}
