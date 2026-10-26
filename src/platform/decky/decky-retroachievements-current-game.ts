import type { NormalizedProfile, RecentlyPlayedGame } from "@core/domain";
import { getRetroAchievementsRecentActivityLabel } from "./decky-retroachievements-recent-activity";

export function getRetroAchievementsActiveGameId(
  profile: NormalizedProfile,
  now = Date.now(),
): string | undefined {
  if (getRetroAchievementsRecentActivityLabel(profile.richPresenceMsgDate, now) !== "In game") {
    return undefined;
  }

  const gameId = profile.richPresenceGameId?.trim();
  if (gameId === undefined || gameId.length === 0) {
    return undefined;
  }

  const numericGameId = Number(gameId);
  return Number.isSafeInteger(numericGameId) && numericGameId > 0 ? gameId : undefined;
}

export function findRetroAchievementsActiveGame(
  activeGameId: string | undefined,
  ...collections: readonly (readonly RecentlyPlayedGame[] | undefined)[]
): RecentlyPlayedGame | undefined {
  if (activeGameId === undefined) {
    return undefined;
  }

  for (const collection of collections) {
    const match = collection?.find((game) => game.gameId === activeGameId);
    if (match !== undefined) {
      return match;
    }
  }

  return undefined;
}

export function prependRetroAchievementsActiveGame(
  games: readonly RecentlyPlayedGame[],
  activeGame: RecentlyPlayedGame | undefined,
): readonly RecentlyPlayedGame[] {
  if (activeGame === undefined) {
    return games;
  }

  return [activeGame, ...games.filter((game) => game.gameId !== activeGame.gameId)];
}
