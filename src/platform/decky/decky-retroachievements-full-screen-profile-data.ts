import type { CompletionProgressSnapshot, DashboardSnapshot } from "@core/domain";
import type { AchievementCompanionSettings } from "@core/settings";
import {
  filterRetroAchievementsUnlocksByMode,
  getRetroAchievementsPlayedGameProgress,
  getRetroAchievementsProfileOverviewMetrics,
  getRetroAchievementsProfileRanks,
  sortRetroAchievementsUnlocksNewestFirst,
} from "./decky-retroachievements-compact-profile-model";
import { getRetroAchievementsCompletionIndicatorState } from "./decky-retroachievements-completion-indicator";

export function buildRetroAchievementsFullScreenProfileModel({
  snapshot,
  completion,
  settings,
}: {
  readonly snapshot: DashboardSnapshot;
  readonly completion?: CompletionProgressSnapshot;
  readonly settings: AchievementCompanionSettings;
}) {
  const games = completion?.games ?? snapshot.featuredGames;
  const recentUnlocks = sortRetroAchievementsUnlocksNewestFirst(
    filterRetroAchievementsUnlocksByMode(
      snapshot.recentAchievements.length > 0 ? snapshot.recentAchievements : snapshot.recentUnlocks,
      settings.retroAchievementsAchievementMode,
    ),
  );
  const awards = games.reduce((summary, game) => {
    const award = getRetroAchievementsCompletionIndicatorState(game);
    if (award?.startsWith("mastered")) summary.mastered += 1;
    else if (award?.startsWith("beaten")) summary.beaten += 1;
    return summary;
  }, { beaten: 0, mastered: 0 });

  return {
    profile: snapshot.profile,
    ranks: getRetroAchievementsProfileRanks(snapshot.profile, settings.retroAchievementsRankDisplay),
    overviewMetrics: getRetroAchievementsProfileOverviewMetrics(
      snapshot.profile,
      settings.retroAchievementsAchievementMode,
    ),
    recentUnlocks: recentUnlocks.slice(0, 3),
    recentGames: snapshot.recentlyPlayedGames.slice(0, 3).map((game) => ({
      game,
      progress: getRetroAchievementsPlayedGameProgress(game, settings.retroAchievementsAchievementMode),
    })),
    completion: {
      gamesWithProgress: games.length,
      inProgress: completion?.summary.unfinishedCount ?? games.filter((game) => game.status === "in_progress").length,
      beaten: completion?.summary.beatenCount ?? awards.beaten,
      mastered: completion?.summary.masteredCount ?? awards.mastered,
    },
  } as const;
}

