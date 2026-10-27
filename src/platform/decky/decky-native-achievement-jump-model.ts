interface SteamAchievementIdentity {
  readonly strID: string;
}

/** Steam's native list inserts one section title between earned and locked rows. */
export function getNativeAchievementListIndex(
  achieved: readonly SteamAchievementIdentity[],
  unachieved: readonly SteamAchievementIdentity[],
  achievementId: string,
): number | undefined {
  const id = `ra:${achievementId}`;
  const earnedIndex = achieved.findIndex((achievement) => achievement.strID === id);
  if (earnedIndex >= 0) return earnedIndex;
  const lockedIndex = unachieved.findIndex((achievement) => achievement.strID === id);
  return lockedIndex < 0 ? undefined : achieved.length + 1 + lockedIndex;
}
