import { useMemo, useSyncExternalStore } from "react";
import type { RetroAchievementsGameGoal } from "./decky-game-overview-recommendations";

export const GAME_OVERVIEW_PREFERENCES_STORAGE_KEY = "achievement-companion:game-overview:v1";

export interface GameOverviewPreferences {
  readonly version: 1;
  readonly globalRetroAchievementsGoal: RetroAchievementsGameGoal;
  readonly retroAchievementsGameGoals: Readonly<Record<string, RetroAchievementsGameGoal>>;
  readonly hiddenSuggestions: Readonly<Record<string, readonly string[]>>;
}

export interface GameOverviewPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGoal(value: unknown): value is RetroAchievementsGameGoal {
  return value === "beat" || value === "master";
}

export function gameOverviewPreferenceKey(providerId: string, gameId: string): string {
  return JSON.stringify([providerId, gameId]);
}

export function parseGameOverviewPreferences(text: string | null | undefined): GameOverviewPreferences {
  let value: unknown;
  try { value = text ? JSON.parse(text) : undefined; } catch { value = undefined; }
  const source = record(value) && value["version"] === 1 ? value : {};
  const retroAchievementsGameGoals: Record<string, RetroAchievementsGameGoal> = {};
  const hiddenSuggestions: Record<string, readonly string[]> = {};
  if (record(source["retroAchievementsGameGoals"])) {
    for (const [key, goal] of Object.entries(source["retroAchievementsGameGoals"])) {
      if (key !== "__proto__" && isGoal(goal)) retroAchievementsGameGoals[key] = goal;
    }
  }
  if (record(source["hiddenSuggestions"])) {
    for (const [key, ids] of Object.entries(source["hiddenSuggestions"])) {
      // The tuple key prevents provider/game separator collisions.
      let tuple: unknown;
      try { tuple = JSON.parse(key); } catch { continue; }
      if (!Array.isArray(tuple) || tuple.length !== 2 || !tuple.every((item) => typeof item === "string")) continue;
      if (Array.isArray(ids)) hiddenSuggestions[key] = [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0))];
    }
  }
  return {
    version: 1,
    globalRetroAchievementsGoal: isGoal(source["globalRetroAchievementsGoal"]) ? source["globalRetroAchievementsGoal"] : "master",
    retroAchievementsGameGoals,
    hiddenSuggestions,
  };
}

/** Injectable storage keeps serialization/restart semantics testable without a browser. */
export function createGameOverviewPreferencesStore(storage: GameOverviewPreferenceStorage | undefined) {
  const read = (): GameOverviewPreferences => {
    try { return parseGameOverviewPreferences(storage?.getItem(GAME_OVERVIEW_PREFERENCES_STORAGE_KEY)); }
    catch { return parseGameOverviewPreferences(undefined); }
  };
  const update = (change: (current: GameOverviewPreferences) => GameOverviewPreferences): boolean => {
    if (storage === undefined) return false;
    try {
      const value = change(read());
      storage.setItem(GAME_OVERVIEW_PREFERENCES_STORAGE_KEY, JSON.stringify(value));
      return true;
    } catch { return false; }
  };
  return {
    read,
    hideSuggestion(providerId: string, gameId: string, achievementId: string): boolean {
      if (!achievementId) return false;
      const key = gameOverviewPreferenceKey(providerId, gameId);
      return update((current) => ({ ...current, hiddenSuggestions: {
        ...current.hiddenSuggestions, [key]: [...new Set([...(current.hiddenSuggestions[key] ?? []), achievementId])],
      } }));
    },
    restoreSuggestion(providerId: string, gameId: string, achievementId: string): boolean {
      const key = gameOverviewPreferenceKey(providerId, gameId);
      return update((current) => ({ ...current, hiddenSuggestions: {
        ...current.hiddenSuggestions, [key]: (current.hiddenSuggestions[key] ?? []).filter((id) => id !== achievementId),
      } }));
    },
    restoreAllSuggestions(providerId: string, gameId: string): boolean {
      const key = gameOverviewPreferenceKey(providerId, gameId);
      return update((current) => {
        const { [key]: _removed, ...hiddenSuggestions } = current.hiddenSuggestions;
        return { ...current, hiddenSuggestions };
      });
    },
    setGlobalRetroAchievementsGoal(goal: RetroAchievementsGameGoal): boolean {
      return isGoal(goal) && update((current) => ({ ...current, globalRetroAchievementsGoal: goal }));
    },
    setRetroAchievementsGameGoal(gameId: string, goal: RetroAchievementsGameGoal | undefined): boolean {
      if (goal !== undefined && !isGoal(goal)) return false;
      return update((current) => {
        const { [gameId]: _previous, ...rest } = current.retroAchievementsGameGoals;
        return { ...current, retroAchievementsGameGoals: goal === undefined ? rest : { ...rest, [gameId]: goal } };
      });
    },
  };
}

let revision = 0;
const EMPTY_HIDDEN_IDS: readonly string[] = [];
const listeners = new Set<() => void>();
function notify(): void {
  revision += 1;
  for (const listener of listeners) listener();
}
function onStorage(event: StorageEvent): void {
  if (event.key === GAME_OVERVIEW_PREFERENCES_STORAGE_KEY || event.key === null) notify();
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) globalThis.addEventListener?.("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) globalThis.removeEventListener?.("storage", onStorage);
  };
}
function getStore() {
  let storage: Storage | undefined;
  // Session storage cannot satisfy the restart-persistence contract.
  try { storage = globalThis.localStorage; } catch { /* Storage may be blocked. */ }
  return createGameOverviewPreferencesStore(storage);
}

export function useDeckyGameOverviewPreferences(providerId: string, gameId: string) {
  const currentRevision = useSyncExternalStore(subscribe, () => revision, () => revision);
  const current = useMemo(() => getStore().read(), [currentRevision]);
  const override = Object.prototype.hasOwnProperty.call(current.retroAchievementsGameGoals, gameId)
    ? current.retroAchievementsGameGoals[gameId] : undefined;
  const mutate = (operation: (store: ReturnType<typeof getStore>) => boolean): boolean => {
    const persisted = operation(getStore());
    if (persisted) notify();
    return persisted;
  };
  return {
    hiddenAchievementIds: current.hiddenSuggestions[gameOverviewPreferenceKey(providerId, gameId)] ?? EMPTY_HIDDEN_IDS,
    globalRetroAchievementsGoal: current.globalRetroAchievementsGoal,
    retroAchievementsGoalOverride: override,
    retroAchievementsGoal: override ?? current.globalRetroAchievementsGoal,
    hideSuggestion: (id: string) => mutate((store) => store.hideSuggestion(providerId, gameId, id)),
    restoreSuggestion: (id: string) => mutate((store) => store.restoreSuggestion(providerId, gameId, id)),
    restoreAllSuggestions: () => mutate((store) => store.restoreAllSuggestions(providerId, gameId)),
    setGlobalRetroAchievementsGoal: (goal: RetroAchievementsGameGoal) => mutate((store) => store.setGlobalRetroAchievementsGoal(goal)),
    setRetroAchievementsGameGoal: (goal: RetroAchievementsGameGoal | undefined) => mutate((store) => store.setRetroAchievementsGameGoal(gameId, goal)),
  };
}
