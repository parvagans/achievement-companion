import { useMemo, useSyncExternalStore } from "react";
import type { GameDetailSnapshot } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { useDeckyProviderConfigs, readDeckyProviderConfigs } from "./providers/provider-config-store";
import { isPinnedAchievementComplete } from "./decky-game-overview-recommendations";
import { subscribeDeckyGameDetailPublication } from "./decky-game-detail-publication";
import type { RetroAchievementsGameGoal } from "./decky-game-overview-recommendations";

export const GAME_OVERVIEW_PREFERENCES_STORAGE_KEY = "achievement-companion:game-overview:v1";

export interface GameOverviewPreferences {
  readonly version: 1;
  readonly globalRetroAchievementsGoal: RetroAchievementsGameGoal;
  readonly retroAchievementsGameGoals: Readonly<Record<string, RetroAchievementsGameGoal>>;
  readonly hiddenSuggestions: Readonly<Record<string, readonly string[]>>;
  readonly pinnedAchievements: Readonly<Record<string, PinnedAchievement>>;
}

export interface PinnedAchievement {
  readonly achievementId: string;
  /** Fixed at selection time; changing the display mode never changes this goal. */
  readonly completionMode: RetroAchievementsAchievementMode;
}

export interface PinnedAchievementScope {
  readonly providerId: string;
  readonly gameId: string;
  readonly accountId: string;
}

export interface SavedPinnedAchievement extends PinnedAchievementScope, PinnedAchievement {}

/** Enumerate only the supplied current accounts; never return other accounts' preferences. */
export function enumeratePinnedAchievements(preferences: GameOverviewPreferences, accounts: Readonly<Record<string, string | undefined>>): readonly SavedPinnedAchievement[] {
  const result: SavedPinnedAchievement[] = [];
  for (const [key, pin] of Object.entries(preferences.pinnedAchievements)) {
    let tuple: unknown;
    try { tuple = JSON.parse(key); } catch { continue; }
    if (!Array.isArray(tuple) || tuple.length !== 3 || !tuple.every((item) => typeof item === "string")) continue;
    const scope = { providerId: tuple[0]!, gameId: tuple[1]!, accountId: tuple[2]! };
    if (validScope(scope) && accounts[scope.providerId] === scope.accountId) result.push({ ...scope, ...pin });
  }
  return result;
}

function validScope(scope: PinnedAchievementScope): boolean {
  return (scope.providerId === "steam" || scope.providerId === "retroachievements")
    && /^[1-9]\d*$/.test(scope.gameId) && scope.accountId.trim().length > 0;
}

export function pinnedAchievementPreferenceKey(scope: PinnedAchievementScope): string {
  return JSON.stringify([scope.providerId, scope.gameId, scope.accountId]);
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
  const pinnedAchievements: Record<string, PinnedAchievement> = {};
  if (record(source["pinnedAchievements"])) {
    for (const [key, pin] of Object.entries(source["pinnedAchievements"])) {
      let tuple: unknown;
      try { tuple = JSON.parse(key); } catch { continue; }
      if (!Array.isArray(tuple) || tuple.length !== 3 || !tuple.every((item) => typeof item === "string")) continue;
      if (!validScope({ providerId: tuple[0]!, gameId: tuple[1]!, accountId: tuple[2]! })) continue;
      if (record(pin) && typeof pin["achievementId"] === "string" && pin["achievementId"].trim()
        && ["hardcore", "softcore", "both"].includes(String(pin["completionMode"]))) {
        pinnedAchievements[key] = { achievementId: pin["achievementId"], completionMode: pin["completionMode"] as RetroAchievementsAchievementMode };
      }
    }
  }
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
    pinnedAchievements,
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
    readPinnedAchievement(scope: PinnedAchievementScope): PinnedAchievement | undefined {
      return validScope(scope) ? read().pinnedAchievements[pinnedAchievementPreferenceKey(scope)] : undefined;
    },
    pinAchievement(scope: PinnedAchievementScope, achievementId: string, completionMode: RetroAchievementsAchievementMode = "both"): boolean {
      if (!validScope(scope) || !achievementId.trim() || !["hardcore", "softcore", "both"].includes(completionMode)) return false;
      const key = pinnedAchievementPreferenceKey(scope);
      const hiddenKey = gameOverviewPreferenceKey(scope.providerId, scope.gameId);
      return update((current) => ({ ...current,
        pinnedAchievements: { ...current.pinnedAchievements, [key]: { achievementId, completionMode } },
        hiddenSuggestions: { ...current.hiddenSuggestions, [hiddenKey]: (current.hiddenSuggestions[hiddenKey] ?? []).filter((id) => id !== achievementId) },
      }));
    },
    unpinAchievement(scope: PinnedAchievementScope, expectedId?: string): boolean {
      if (!validScope(scope)) return false;
      return update((current) => {
        const key = pinnedAchievementPreferenceKey(scope);
        if (expectedId !== undefined && current.pinnedAchievements[key]?.achievementId !== expectedId) return current;
        const { [key]: _pin, ...pinnedAchievements } = current.pinnedAchievements;
        return { ...current, pinnedAchievements };
      });
    },
    hideSuggestion(providerId: string, gameId: string, achievementId: string, accountId?: string): boolean {
      if (!achievementId) return false;
      const key = gameOverviewPreferenceKey(providerId, gameId);
      return update((current) => {
        const pinKey = accountId === undefined ? undefined : pinnedAchievementPreferenceKey({ providerId, gameId, accountId });
        const pinnedAchievements = { ...current.pinnedAchievements };
        if (pinKey !== undefined && pinnedAchievements[pinKey]?.achievementId === achievementId) delete pinnedAchievements[pinKey];
        return { ...current, pinnedAchievements, hiddenSuggestions: {
        ...current.hiddenSuggestions, [key]: [...new Set([...(current.hiddenSuggestions[key] ?? []), achievementId])],
        } };
      });
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
  const configs = useDeckyProviderConfigs();
  const accountId = providerId === "steam" ? configs.steam?.steamId64 : configs.retroAchievements?.username.toLowerCase();
  const scope = { providerId, gameId, accountId: accountId ?? "" };
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
    pinnedAchievement: current.pinnedAchievements[pinnedAchievementPreferenceKey(scope)],
    canPin: validScope(scope),
    pinAchievement: (id: string, mode: RetroAchievementsAchievementMode = "both") => mutate((store) => store.pinAchievement(scope, id, mode)),
    unpinAchievement: () => mutate((store) => store.unpinAchievement(scope)),
    togglePinnedAchievement: (id: string, mode: RetroAchievementsAchievementMode = "both") => mutate((store) =>
      store.readPinnedAchievement(scope)?.achievementId === id
        ? store.unpinAchievement(scope, id) : store.pinAchievement(scope, id, mode)),
    hiddenAchievementIds: current.hiddenSuggestions[gameOverviewPreferenceKey(providerId, gameId)] ?? EMPTY_HIDDEN_IDS,
    globalRetroAchievementsGoal: current.globalRetroAchievementsGoal,
    retroAchievementsGoalOverride: override,
    retroAchievementsGoal: override ?? current.globalRetroAchievementsGoal,
    hideSuggestion: (id: string) => mutate((store) => store.hideSuggestion(providerId, gameId, id, scope.accountId)),
    restoreSuggestion: (id: string) => mutate((store) => store.restoreSuggestion(providerId, gameId, id)),
    restoreAllSuggestions: () => mutate((store) => store.restoreAllSuggestions(providerId, gameId)),
    setGlobalRetroAchievementsGoal: (goal: RetroAchievementsGameGoal) => mutate((store) => store.setGlobalRetroAchievementsGoal(goal)),
    setRetroAchievementsGameGoal: (goal: RetroAchievementsGameGoal | undefined) => mutate((store) => store.setRetroAchievementsGameGoal(gameId, goal)),
  };
}

export const subscribeToPinnedAchievementChanges = subscribe;
export function useSavedPinnedAchievements() {
  const configs = useDeckyProviderConfigs();
  const currentRevision = useSyncExternalStore(subscribe, () => revision, () => revision);
  const accounts = {
    steam: configs.steam?.hasApiKey ? configs.steam.steamId64 : undefined,
    retroachievements: configs.retroAchievements?.hasApiKey ? configs.retroAchievements.username.toLowerCase() : undefined,
  };
  const signature = JSON.stringify(accounts);
  const pins = useMemo(() => enumeratePinnedAchievements(getStore().read(), accounts), [currentRevision, signature]);
  return { pins, accounts };
}
export function readPinnedAchievement(scope: PinnedAchievementScope): PinnedAchievement | undefined {
  return getStore().readPinnedAchievement(scope);
}
export function pinAchievement(scope: PinnedAchievementScope, id: string, mode: RetroAchievementsAchievementMode = "both"): boolean {
  const saved = getStore().pinAchievement(scope, id, mode);
  if (saved) notify();
  return saved;
}
export function unpinAchievement(scope: PinnedAchievementScope, expectedId?: string): boolean {
  const saved = getStore().unpinAchievement(scope, expectedId);
  if (saved) notify();
  return saved;
}

/** Called only for current-account canonical progress, never optional enrichment. */
export function retireCompletedPinnedAchievement(snapshot: GameDetailSnapshot): void {
  const configs = readDeckyProviderConfigs();
  const providerId = snapshot.game.providerId;
  const accountId = providerId === "steam" ? configs.steam?.steamId64 : configs.retroAchievements?.username.toLowerCase();
  if (accountId === undefined || (providerId === "steam" ? snapshot.achievementStateIsComplete !== true : snapshot.canonicalSourceRevision === undefined)) return;
  const scope = { providerId, gameId: snapshot.game.gameId, accountId };
  const pin = readPinnedAchievement(scope);
  if (pin !== undefined && isPinnedAchievementComplete(snapshot, pin)) unpinAchievement(scope, pin.achievementId);
}

subscribeDeckyGameDetailPublication(retireCompletedPinnedAchievement);
