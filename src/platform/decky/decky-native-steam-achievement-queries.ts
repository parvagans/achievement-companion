import { nativeRetroAchievementsBadgeImage, type NativeSteamAchievements } from "./decky-native-steam-achievement-conversion";

type QueryKey = readonly ["achievements", number, string, ...string[]];
type ExactQuery = { readonly queryKey: QueryKey; readonly exact: true };

interface QueryEvent {
  readonly type: string;
  readonly query?: { readonly queryKey: readonly unknown[] };
  readonly action?: { readonly type: string; readonly manual?: boolean };
}

interface QueryClient {
  getQueryData(key: QueryKey): unknown;
  setQueryData(key: QueryKey, value: unknown): unknown;
  cancelQueries(filter: ExactQuery): Promise<void>;
  resetQueries(filter: ExactQuery): Promise<void>;
  getQueryCache(): { subscribe(listener: (event: QueryEvent) => void): () => void };
}

export function isSteamAchievementQueryClient(value: unknown): value is QueryClient {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<QueryClient>;
  return typeof candidate.getQueryData === "function" && typeof candidate.setQueryData === "function"
    && typeof candidate.cancelQueries === "function" && typeof candidate.resetQueries === "function"
    && typeof candidate.getQueryCache === "function" && typeof candidate.getQueryCache()?.subscribe === "function";
}

function buildAchievementQueries(appId: number, viewer: string, model: NativeSteamAchievements) {
  const rows = [...model.vecHighlight, ...model.vecAchievedHidden, ...model.vecUnachieved];
  const keys = rows.map(row => Number(row.strID.slice(3)));
  if (rows.some((row, index) => !/^ra:[1-9]\d*$/u.test(row.strID) || !Number.isSafeInteger(keys[index]))
    || new Set(keys).size !== rows.length) return undefined;

  const achievements = rows.map((row, index) => ({
    internal_key: keys[index], api_name: row.strID, name: row.strName, description: row.strDescription,
    hidden: row.bHidden, archived: false, groupid: 0,
    icon_achieved: nativeRetroAchievementsBadgeImage(row.strImage, true),
    icon_unachieved: nativeRetroAchievementsBadgeImage(row.strImage, false),
  }));
  const progress = Object.fromEntries(rows.map((row, index) => [keys[index], {
    internal_key: keys[index], unlocked: row.bAchieved, unlock_time: row.rtUnlocked,
  }]));

  const entries: { queryKey: QueryKey; value: unknown; installed?: unknown }[] = [
    { queryKey: ["achievements", appId, "schema"], value: {
      appid: appId, groups: [{ id: 0, order: -1, archived: false, developeronly: false, ispublic: true, dlcappid: 0, achievements }],
      schema_hash: 0, schema_version: 0,
    } },
    { queryKey: ["achievements", appId, "globalpercentages"], value: {
      percentages: Object.fromEntries(rows.map((row, index) => [keys[index], row.flAchieved])),
    } },
    { queryKey: ["achievements", appId, "user_achievements", viewer], value: {
      appid: appId, steamid: viewer, achievements: progress,
      groups: { 0: { groupid: 0, is_achievable: true, completed_achievements: model.nAchieved, is_completed: model.nAchieved === model.nTotal } },
      schema_hash: 0,
    } },
  ];
  return entries;
}

/** Presents verified RA progress to Steam's current achievement queries for one open shortcut. */
export function createSteamAchievementQueryProjection() {
  let current: { client: QueryClient; entries: NonNullable<ReturnType<typeof buildAchievementQueries>>; unsubscribe?: () => void } | undefined;

  function clear() {
    const previous = current;
    current = undefined;
    if (previous === undefined) return;
    previous.unsubscribe?.();
    for (const entry of previous.entries) {
      if (entry.installed !== undefined && previous.client.getQueryData(entry.queryKey) === entry.installed) {
        // Keep mounted native observers attached while dropping our in-memory rows.
        void previous.client.resetQueries({ queryKey: entry.queryKey, exact: true }).catch(() => undefined);
      }
    }
  }

  async function publish(client: QueryClient, appId: number, viewer: string, model: NativeSteamAchievements, isCurrent: () => boolean) {
    clear();
    const entries = buildAchievementQueries(appId, viewer, model);
    if (entries === undefined || !isCurrent()) return;
    const next: NonNullable<typeof current> = { client, entries };
    current = next;
    try {
      await Promise.all(entries.map(({ queryKey }) => client.cancelQueries({ queryKey, exact: true })));
      if (current !== next || !isCurrent()) return;
      for (const entry of entries) entry.installed = client.setQueryData(entry.queryKey, entry.value);
      next.unsubscribe = client.getQueryCache().subscribe((event) => {
        if (current !== next || event.type !== "updated" || event.action?.type !== "success" || event.action.manual) return;
        const key = event.query?.queryKey;
        const entry = entries.find(({ queryKey }) => key?.length === queryKey.length && queryKey.every((part, index) => part === key[index]));
        if (entry === undefined) return;
        if (!isCurrent()) { clear(); return; }
        entry.installed = client.setQueryData(entry.queryKey, entry.value);
      });
    } catch {
      if (current === next) clear();
    }
  }

  return { publish, clear };
}
