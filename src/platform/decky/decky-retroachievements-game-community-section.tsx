import type { GameCommunityStats, GameDetailSnapshot } from "@core/domain";
import {
  DeckyCommunityInsightMetric,
  DeckyCommunityInsightsCard,
  DeckyCommunityInsightsStack,
  DeckyCommunityRarityDistribution,
} from "./decky-full-screen-game-community-layout";
import {
  buildRetroAchievementsCommunityInsights,
  buildRetroAchievementsCommunityRarityDistribution,
  hasDisplayableRetroAchievementsCommunityStats,
  type RetroAchievementsCommunityInsight,
} from "./decky-retroachievements-community-stats-data";
import { raTheme } from "./ra-theme";

export const RETROACHIEVEMENTS_COMMUNITY_SECTION_FOCUS_TARGET = "ra-community-summary";

export { hasDisplayableRetroAchievementsCommunityStats };

function BeatMedianValue({ insight }: { readonly insight: Extract<RetroAchievementsCommunityInsight, { kind: "beat" }> }): JSX.Element {
  const medians = [
    ...(insight.hardcore !== undefined ? [{ mode: "Hardcore", value: insight.hardcore }] : []),
    ...(insight.softcore !== undefined ? [{ mode: "Softcore", value: insight.softcore }] : []),
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${medians.length}, minmax(0, 1fr))`, gap: 8, width: "100%" }}>
      {medians.map(({ mode, value }) => (
        <div key={mode} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 0 }}>
          <span style={{ color: raTheme.color.textSecondary, fontSize: "0.5em", fontWeight: 700, lineHeight: 1 }}>{mode}</span>
          <span style={{ fontSize: "0.72em", fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap" }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

export function DeckyRetroAchievementsGameCommunitySection({
  stats,
  snapshot,
}: {
  readonly stats: GameCommunityStats;
  readonly snapshot: GameDetailSnapshot;
}): JSX.Element {
  const insights = buildRetroAchievementsCommunityInsights(stats);
  const rarityDistribution = buildRetroAchievementsCommunityRarityDistribution(snapshot);

  return (
    <DeckyCommunityInsightsStack>
      <DeckyCommunityInsightsCard
        title="Community Insights (RetroAchievements)"
        focusable
        focusTargetId={RETROACHIEVEMENTS_COMMUNITY_SECTION_FOCUS_TARGET}
      >
        {insights.map((insight) => (
          insight.kind === "beat"
            ? <DeckyCommunityInsightMetric
                key={insight.label}
                label={insight.label}
                value={<BeatMedianValue insight={insight} />}
                valueStyle={{ width: "100%", whiteSpace: "normal" }}
              />
            : <DeckyCommunityInsightMetric key={insight.label} label={insight.label} value={insight.value} />
        ))}
      </DeckyCommunityInsightsCard>
      {rarityDistribution !== undefined ? <DeckyCommunityRarityDistribution distribution={rarityDistribution} /> : null}
    </DeckyCommunityInsightsStack>
  );
}
