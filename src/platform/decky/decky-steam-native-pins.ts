import { useEffect, useState } from "react";

interface NativePinQueryEvent {
  readonly query?: { readonly queryKey?: readonly unknown[] };
  readonly action?: { readonly type?: string };
}

interface NativePinQueryClient {
  setQueryData(key: readonly unknown[], value: readonly string[]): unknown;
  getQueryCache(): { subscribe(listener: (event: NativePinQueryEvent) => void): () => void };
  getMutationCache(): {
    build(client: NativePinQueryClient, options: {
      scope: { id: string };
      mutationFn: () => Promise<void>;
    }): { execute(): Promise<void> };
  };
}

interface NativePinStorage {
  GetString(key: string): Promise<string | null | undefined>;
  SetString(key: string, value: string): Promise<unknown>;
}

interface SteamIdentity {
  currentUserSteamID?: { ConvertTo64BitString?(): string };
  GetFriendState?: unknown;
}

interface NativePinRuntime {
  SteamClient?: { Storage?: NativePinStorage };
  DFL?: { findModuleExport?(filter: (value: unknown) => boolean): unknown };
  appStore?: {
    GetAllApps?(): Iterable<{ appid?: number; app_type?: number }>;
    allApps?: Iterable<{ appid?: number; app_type?: number }>;
  };
}

const EMPTY_PINS: readonly string[] = [];
let steamIdentity: SteamIdentity | undefined;
let queryClient: NativePinQueryClient | undefined;
const pendingReads = new Map<string, Promise<readonly string[]>>();

function getRuntime(): NativePinRuntime {
  return globalThis as NativePinRuntime;
}

function readSignedInSteamId(): string | undefined {
  steamIdentity ??= getRuntime().DFL?.findModuleExport?.((value) => {
    const identity = value as SteamIdentity | undefined;
    return identity?.currentUserSteamID !== undefined && typeof identity.GetFriendState === "function";
  }) as SteamIdentity | undefined;
  return steamIdentity?.currentUserSteamID?.ConvertTo64BitString?.();
}

function readQueryClient(): NativePinQueryClient | undefined {
  queryClient ??= getRuntime().DFL?.findModuleExport?.((value) => {
    if (typeof value !== "object" || value === null) return false;
    const client = value as Partial<NativePinQueryClient> & { resetQueries?: unknown; getQueryData?: unknown };
    return typeof client.setQueryData === "function" && typeof client.getQueryData === "function"
      && typeof client.resetQueries === "function" && typeof client.getQueryCache === "function"
      && typeof client.getMutationCache === "function";
  }) as NativePinQueryClient | undefined;
  return queryClient;
}

export function isSteamNativePinAppId(appId: unknown): appId is number {
  return typeof appId === "number" && Number.isInteger(appId) && appId > 0 && appId < 0x80000000;
}

export function parseSteamNativePins(value: string | null | undefined): readonly string[] {
  if (value == null || value === "") return EMPTY_PINS;
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some(id => typeof id !== "string")) throw new Error("Invalid Steam pin list");
  return parsed;
}

async function readSteamNativePinKey(storage: NativePinStorage, key: string): Promise<readonly string[]> {
  try {
    return parseSteamNativePins(await storage.GetString(key));
  } catch (error) {
    const result = error as { result?: unknown; message?: unknown } | null;
    // Steam reports an absent per-game value with this exact IPC error.
    if (result?.result === 2 && result.message === "Not found") return EMPTY_PINS;
    throw error;
  }
}

export async function editSteamNativePin(storage: NativePinStorage, key: string, id: string, pinned: boolean, current: () => boolean): Promise<readonly string[]> {
  if (!current()) throw new Error("Steam account changed");
  const existing = await readSteamNativePinKey(storage, key);
  if (!current()) throw new Error("Steam account changed");
  if (existing.includes(id) === pinned) return existing;
  const next = pinned ? [...existing, id] : existing.filter(value => value !== id);
  await storage.SetString(key, JSON.stringify(next));
  if (!current()) throw new Error("Steam account changed");
  const confirmed = await readSteamNativePinKey(storage, key);
  if (!current() || confirmed.includes(id) !== pinned) throw new Error("Steam did not confirm the pin change");
  return confirmed;
}

function ownSteamPins(accountId: string | undefined): accountId is string {
  return accountId !== undefined && /^\d{17}$/u.test(accountId) && readSignedInSteamId() === accountId;
}

function readSteamPins(accountId: string, appId: number): Promise<readonly string[]> {
  const key = `${accountId}:${appId}`;
  const existing = pendingReads.get(key);
  if (existing !== undefined) return existing;
  const storage = getRuntime().SteamClient?.Storage;
  if (typeof storage?.GetString !== "function" || !ownSteamPins(accountId)) return Promise.reject(new Error("Steam pin storage unavailable"));
  const pending = readSteamNativePinKey(storage, `SortedAchievements_${appId}`).then(pins => {
    if (!ownSteamPins(accountId)) throw new Error("Steam account changed");
    return pins;
  }).finally(() => { pendingReads.delete(key); });
  pendingReads.set(key, pending);
  return pending;
}

export async function setDeckySteamNativePin(accountId: string, gameId: string, id: string, pinned: boolean): Promise<boolean> {
  const appId = Number(gameId);
  const storage = getRuntime().SteamClient?.Storage;
  const client = readQueryClient();
  if (!ownSteamPins(accountId) || !isSteamNativePinAppId(appId) || !id || typeof storage?.SetString !== "function" || client === undefined) return false;
  try {
    await client.getMutationCache().build(client, {
      // Use Steam's own mutation scope so additions and removals wait for pending native edits.
      scope: { id: "PinnedAchievements" },
      mutationFn: async () => {
        const current = () => ownSteamPins(accountId);
        const pins = await editSteamNativePin(storage, `SortedAchievements_${appId}`, id, pinned, current);
        if (!current()) throw new Error("Steam account changed");
        // A read already pending for this game can precede the just-confirmed write.
        await pendingReads.get(`${accountId}:${appId}`)?.catch(() => undefined);
        if (!current()) throw new Error("Steam account changed");
        client.setQueryData(["PinnedAchievements", appId], pins);
      },
    }).execute();
    return true;
  } catch {
    return false;
  }
}

function subscribeToPinChanges(onChange: (appId: number) => void): (() => void) | undefined {
  return readQueryClient()?.getQueryCache().subscribe(event => {
    const key = event.query?.queryKey;
    if (key?.[0] === "PinnedAchievements" && isSteamNativePinAppId(key[1])
      && (event.action?.type === "success" || event.action?.type === "error")) onChange(key[1]);
  });
}

export function useDeckySteamNativePins(providerId: string, gameId: string, accountId: string | undefined) {
  const appId = providerId === "steam" && /^[1-9]\d*$/u.test(gameId) && isSteamNativePinAppId(Number(gameId)) ? Number(gameId) : undefined;
  const scope = appId !== undefined && accountId !== undefined ? `${accountId}:${appId}` : undefined;
  const [list, setList] = useState<{ scope: string; pins: readonly string[] }>();
  useEffect(() => {
    if (scope === undefined || appId === undefined || accountId === undefined) return;
    let generation = 0;
    const refresh = (): void => {
      const attempt = ++generation;
      void readSteamPins(accountId, appId).then(pins => {
        if (attempt === generation) setList(previous => previous?.scope === scope
          && previous.pins.length === pins.length && previous.pins.every((pin, index) => pins[index] === pin) ? previous : { scope, pins });
      }).catch(() => {
        if (attempt === generation && !ownSteamPins(accountId)) setList(undefined);
      });
    };
    const stop = subscribeToPinChanges(changedAppId => { if (changedAppId === appId) refresh(); });
    window.addEventListener("focus", refresh);
    refresh();
    return () => {
      generation++;
      stop?.();
      window.removeEventListener("focus", refresh);
    };
  }, [scope, appId, accountId]);

  const ownsList = scope !== undefined && scope === list?.scope && ownSteamPins(accountId);
  return {
    steamPinIds: ownsList ? list.pins : undefined,
    canPinInSteam: ownsList && typeof getRuntime().SteamClient?.Storage?.SetString === "function" && readQueryClient() !== undefined,
  };
}

interface SteamPinnedGame {
  readonly gameId: string;
  readonly achievementIds: readonly string[];
}

export function useDeckySteamPinnedGames(accountId: string | undefined, enabled: boolean) {
  const [index, setIndex] = useState<{ accountId: string; games: readonly SteamPinnedGame[]; complete: boolean }>();
  useEffect(() => {
    if (!enabled || !ownSteamPins(accountId)) return;
    const apps = getRuntime().appStore;
    const library = apps?.GetAllApps?.() ?? apps?.allApps;
    if (library === undefined) return;
    const candidates = new Set([...library].filter(app => app.app_type === 1 && isSteamNativePinAppId(app.appid)).map(app => app.appid!));
    const orderedAppIds = [...candidates];
    const games = new Map<number, readonly string[]>();
    const revisions = new Map<number, number>();
    let cancelled = false;
    let cursor = 0;
    let complete = false;
    const publish = () => {
      if (!cancelled && ownSteamPins(accountId)) setIndex({
        accountId, complete,
        games: orderedAppIds.flatMap(appId => {
          const achievementIds = games.get(appId);
          return achievementIds === undefined ? [] : [{ gameId: String(appId), achievementIds }];
        }),
      });
    };
    const readGame = async (appId: number) => {
      const revision = (revisions.get(appId) ?? 0) + 1;
      revisions.set(appId, revision);
      try {
        const pins = await readSteamPins(accountId, appId);
        if (cancelled || revisions.get(appId) !== revision) return;
        if (pins.length > 0) games.set(appId, pins);
        else games.delete(appId);
      } catch { /* Unavailable app storage does not erase another game's pins. */ }
    };
    const visit = async () => {
      while (!cancelled && ownSteamPins(accountId) && cursor < orderedAppIds.length) await readGame(orderedAppIds[cursor++]!);
    };
    publish();
    const stop = subscribeToPinChanges(appId => {
      if (candidates.has(appId)) void readGame(appId).then(publish);
    });
    // These are local Steam configuration reads. No provider requests or library sync.
    void Promise.all(Array.from({ length: Math.min(6, orderedAppIds.length) }, visit)).then(() => {
      complete = true;
      publish();
    });
    return () => { cancelled = true; stop?.(); };
  }, [accountId, enabled]);
  return index?.accountId === accountId && ownSteamPins(accountId) ? index : undefined;
}
