import type { RecentUnlock } from "@core/domain";

export interface ActivityGameOption {
  readonly gameId: string;
  readonly title: string;
  readonly unlockCount: number;
}

export function buildActivityGameOptions(entries: readonly RecentUnlock[]): readonly ActivityGameOption[] {
  const games = new Map<string, ActivityGameOption>();
  for (const entry of entries) {
    const { gameId, title } = entry.game;
    const previous = games.get(gameId);
    games.set(gameId, {
      gameId,
      title: title.trim() || previous?.title || "Unknown Game",
      unlockCount: (previous?.unlockCount ?? 0) + 1,
    });
  }
  return [...games.values()].sort((left, right) => left.title.localeCompare(right.title) || left.gameId.localeCompare(right.gameId));
}

export function filterActivityEntriesByGame(entries: readonly RecentUnlock[], gameId: string | undefined): readonly RecentUnlock[] {
  return gameId === undefined ? entries : entries.filter((entry) => entry.game.gameId === gameId);
}
