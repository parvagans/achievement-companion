import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot } from "@core/domain";
import type { SavedPinnedAchievement } from "./decky-game-overview-preferences";

/** Hydrate only rows near the bounded viewport, including a small scroll-ahead gutter. */
export function pinnedGamesNearViewport(rows: readonly { gameId: string; top: number; bottom: number }[], viewport: { top: number; bottom: number }): readonly string[] {
  return rows.filter((row) => row.bottom >= viewport.top - 120 && row.top <= viewport.bottom + 120).map((row) => row.gameId);
}

/** One bounded hydration lane. Snapshots remain owned by canonical/session caches. */
export function createPinnedMetadataResolver({ read, load }: {
  read: (pin: SavedPinnedAchievement) => ResourceState<GameDetailSnapshot> | undefined;
  load: (pin: SavedPinnedAchievement) => Promise<ResourceState<GameDetailSnapshot>>;
}) {
  let tail: Promise<unknown> = Promise.resolve();
  return (pin: SavedPinnedAchievement, isCurrent: () => boolean): Promise<ResourceState<GameDetailSnapshot> | undefined> => {
    const task = tail.then(async () => {
      if (!isCurrent()) return undefined;
      const cached = read(pin);
      if (cached?.data) return cached;
      const state = await load(pin);
      return isCurrent() ? state : undefined;
    });
    tail = task.catch(() => undefined);
    return task;
  };
}
