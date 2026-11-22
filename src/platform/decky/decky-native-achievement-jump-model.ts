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

/** Resolve Steam's current grouped list from its stable achievement row keys. */
export function getNativeAchievementVirtualIndex(
  count: number,
  getItemKey: (index: number) => unknown,
  achievementId: string,
): number | undefined {
  if (!Number.isSafeInteger(count) || count < 1 || !/^[1-9]\d*$/u.test(achievementId)) return undefined;
  for (let index = 0; index < count; index++) {
    const key = getItemKey(index);
    if (typeof key === "string" && /^r\d+:\d+$/u.test(key) && key.endsWith(`:${achievementId}`)) return index;
  }
  return undefined;
}