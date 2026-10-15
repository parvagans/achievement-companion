import type { SteamHuntersProfile } from "./types";

/** An unindexed profile can contain a full set of zero-valued fields. */
export function hasMeaningfulSteamHuntersProfile(
  profile: SteamHuntersProfile | undefined,
): profile is SteamHuntersProfile {
  if (profile === undefined) {
    return false;
  }

  return [
    profile.globalPointsRank,
    profile.globalAchievementsRank,
    profile.globalCompletedGamesRank,
    profile.points,
    profile.unrestrictedPoints,
    profile.averageGameCompletion,
    profile.obtainableAverageGameCompletion,
    profile.perfectedGames,
    profile.completedGames,
    profile.achievements,
    profile.epicAchievements,
    profile.legendaryAchievements,
  ].some((value) => value !== undefined && value > 0);
}
