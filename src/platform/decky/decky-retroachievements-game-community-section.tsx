import type { GameCommunityStats } from "@core/domain";
import { DeckyFullScreenGameSpotlightFocusTarget } from "./decky-full-screen-game-spotlight-card";
import {
  formatRetroAchievementsCommunityDuration,
  hasDisplayableRetroAchievementsCommunityStats,
} from "./decky-retroachievements-community-stats-data";
import { raRecipes, raTheme } from "./ra-theme";

export const RETROACHIEVEMENTS_COMMUNITY_SECTION_FOCUS_TARGET = "ra-community-summary";

export { hasDisplayableRetroAchievementsCommunityStats };

export function DeckyRetroAchievementsGameCommunitySection({ stats }: { readonly stats: GameCommunityStats }): JSX.Element {
  const hasValidMasteryRate = stats.masteryPercent !== undefined
    && Number.isFinite(stats.masteryPercent)
    && stats.totalPlayers !== undefined
    && stats.totalPlayers > 0
    && stats.masteredPlayers !== undefined;
  const items = [
    ...(stats.totalPlayers !== undefined ? [{ label: "Players", value: stats.totalPlayers.toLocaleString() }] : []),
    ...(stats.masteredPlayers !== undefined ? [{ label: "Mastered Players", value: stats.masteredPlayers.toLocaleString() }] : []),
    ...(hasValidMasteryRate ? [{ label: "Mastery", value: `${stats.masteryPercent!.toFixed(stats.masteryPercent! < 10 ? 1 : 0)}%` }] : []),
    ...(formatRetroAchievementsCommunityDuration(stats.medianBeatSeconds) !== undefined ? [{ label: "Median Beat · Hardcore", value: formatRetroAchievementsCommunityDuration(stats.medianBeatSeconds)! }] : []),
    ...(formatRetroAchievementsCommunityDuration(stats.medianBeatSoftcoreSeconds) !== undefined ? [{ label: "Median Beat · Softcore", value: formatRetroAchievementsCommunityDuration(stats.medianBeatSoftcoreSeconds)! }] : []),
    ...(formatRetroAchievementsCommunityDuration(stats.medianCompletionSeconds) !== undefined ? [{ label: "Median Completion", value: formatRetroAchievementsCommunityDuration(stats.medianCompletionSeconds)! }] : []),
    ...(formatRetroAchievementsCommunityDuration(stats.medianMasterySeconds) !== undefined ? [{ label: "Median Mastery", value: formatRetroAchievementsCommunityDuration(stats.medianMasterySeconds)! }] : []),
  ];

  return (
    <DeckyFullScreenGameSpotlightFocusTarget
      focusTargetId={RETROACHIEVEMENTS_COMMUNITY_SECTION_FOCUS_TARGET}
      style={{ ...raRecipes.card("fullscreen", true), background: raTheme.surface.contentCard, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, padding: 16 }}
    >
      {items.map((item) => (
        <div key={item.label} style={{ ...raRecipes.metric("fullscreen"), background: raTheme.surface.contentStat, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", minHeight: 92 }}>
          <div style={{ color: raTheme.color.textPrimary, fontSize: 22, fontWeight: 850 }}>{item.value}</div>
          <div style={{ color: raTheme.color.textSecondary, fontSize: 11 }}>{item.label}</div>
        </div>
      ))}
    </DeckyFullScreenGameSpotlightFocusTarget>
  );
}
