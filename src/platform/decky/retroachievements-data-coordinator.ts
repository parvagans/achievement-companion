import type { RetroAchievementsTransportRequest } from "../../providers/retroachievements/client/transport";
export const RA_FOREGROUND_WAIT_MS = 9_000;
export const RA_COMPLETION_WAIT_MS = 65_000;

export interface RaResourceResult<T> {
  readonly raResource: 1;
  readonly resourceKey: string;
  readonly sourceRevision?: string;
  readonly payload: T;
  readonly cacheState: "fresh" | "live" | "stale";
  readonly fetchedAt: number;
  readonly freshUntil: number;
  readonly activeFreshUntil?: number;
  readonly error?: unknown;
}

export interface RaResourceContext {
  readonly revision: number;
  readonly entryPoint: string;
  readonly intent?: "policy" | "explicit";
  readonly activeViewing?: boolean;
  readonly priority?: number;
}

/** Frontend entry decisions over backend-authoritative, restart-safe resources.
 * Consumers receive copies and choose when to present them; cache notifications
 * never replace an already-visible page snapshot by themselves.
 */
export function createRetroAchievementsDataCoordinator(options: {
  readonly fetchResource: (request: RetroAchievementsTransportRequest, context: RaResourceContext) => Promise<unknown>;
  readonly getRevision: () => number;
  readonly now?: () => number;
  readonly foregroundMs?: number;
  readonly completionMs?: number;
  readonly onEvent?: (event: string, fields: { resource: string; entryPoint?: string; source?: string; subscribers?: number }) => void;
}) {
  const now = options.now ?? (() => Date.now());
  const records = new Map<string, RaResourceResult<unknown>>();
  const pending = new Map<string, Promise<RaResourceResult<unknown>>>();
  const pendingPriorities = new Map<string, number>();
  const listeners = new Map<string, Set<() => void>>();
  const owners = new Map<string, { valid: boolean }>();
  const sizes = new Map<string, number>();
  const revisions = new Map<string, number>();
  let sequence = 0;
  const epoch = `${Math.random().toString(36).slice(2)}:${Math.random().toString(36).slice(2)}`;
  let memoryBytes = 0;
  const stats = { hits: 0, joined: 0, fetched: 0, fallback: 0 };
  function notify(identity: string) {
    for (const listener of listeners.get(identity) ?? []) {
      try { listener(); } catch { /* A subscriber cannot fail a resource. */ }
    }
  }
  function event(name: string, request: RetroAchievementsTransportRequest, fields = {}) {
    try { options.onEvent?.(name, { resource: request.path, ...fields }); } catch { /* Logging cannot fail loading. */ }
  }
  const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  const publicPaths = new Set(["API_GetConsoleIDs.php", "API_GetGameList.php", "API_GetGameExtended.php",
    "API_GetAchievementDistribution.php", "API_GetGameProgression.php", "API_GetGameRankAndScore.php"]);
  function key(request: RetroAchievementsTransportRequest, revision: number): string {
    return JSON.stringify(["retroachievements", revision, 1, request.path,
      Object.entries(request.query ?? {}).filter(([name, value]) => value !== undefined && name !== "y")
        .filter(([name]) => name !== "u" || (request.path !== "API_GetGameInfoAndUserProgress.php" && !publicPaths.has(request.path)))
        .map(([name, value]) => [name, String(value)]).sort(([a], [b]) => a!.localeCompare(b!))]);
  }
  function remember(identity: string, result: RaResourceResult<unknown>) {
    const bytes = JSON.stringify(result).length * 2;
    const revision = JSON.stringify(records.get(identity)?.payload) === JSON.stringify(result.payload)
      ? revisions.get(identity)! : ++sequence;
    const sourceRevision = `${identity}:${epoch}:${revision}`;
    if (bytes > 16 * 1024 * 1024) return sourceRevision;
    revisions.set(identity, revision);
    memoryBytes -= sizes.get(identity) ?? 0;
    records.delete(identity);
    records.set(identity, copy({ ...result, sourceRevision }));
    sizes.set(identity, bytes);
    memoryBytes += bytes;
    while (records.size > 128 || memoryBytes > 32 * 1024 * 1024) {
      const oldest = records.keys().next().value;
      if (oldest === undefined) break;
      memoryBytes -= sizes.get(oldest) ?? 0;
      sizes.delete(oldest);
      records.delete(oldest); revisions.delete(oldest);
    }
    notify(identity);
    return sourceRevision;
  }
  async function ensureFresh<T>(request: RetroAchievementsTransportRequest, context: RaResourceContext): Promise<RaResourceResult<T>> {
    const identity = key(request, context.revision);
    const cached = records.get(identity);
    if (context.revision !== options.getRevision()) throw new Error("Account settings changed.");
    if (context.intent !== "explicit" && cached !== undefined && cached.cacheState !== "stale" &&
        now() >= cached.fetchedAt && now() < cached.freshUntil &&
        (!context.activeViewing || (cached.activeFreshUntil !== undefined && now() < cached.activeFreshUntil))) {
      stats.hits += 1;
      records.set(identity, { ...cached, cacheState: "fresh" });
      event("cache_hit", request, { entryPoint: context.entryPoint, source: "memory" });
      return copy({ ...cached, cacheState: "fresh" }) as RaResourceResult<T>;
    }
    let load = pending.get(identity);
    if (load === undefined) {
      const previousOwner = owners.get(identity);
      if (previousOwner) previousOwner.valid = false;
      const owner = { valid: true };
      owners.set(identity, owner);
      stats.fetched += 1;
      const operation = options.fetchResource(request, context).then((value) => {
        if (context.revision !== options.getRevision() || !owner.valid) {
          throw new Error("Resource identity changed during loading.");
        }
        const result = value as Partial<RaResourceResult<unknown>> | null;
        if (result?.raResource !== 1 || result.payload === undefined ||
            typeof result.fetchedAt !== "number" || typeof result.freshUntil !== "number") {
          throw value;
        }
        const sourceRevision = remember(identity, result as RaResourceResult<unknown>);
        event("resource_published", request, { entryPoint: context.entryPoint, subscribers: listeners.get(identity)?.size ?? 0 });
        return { ...result, sourceRevision } as RaResourceResult<unknown>;
      }).finally(() => { if (owners.get(identity) === owner) owners.delete(identity); });
      // Keep the actual operation single-flight after an entry waiter times out.
      // Its eventual publication must still reach mounted optional sections.
      let completionTimer: ReturnType<typeof setTimeout> | undefined;
      const completionDeadline = new Promise<never>((_, reject) => {
        completionTimer = setTimeout(() => reject({ handledHttpError: true, status: 503, category: "completion_deadline" }),
          options.completionMs ?? RA_COMPLETION_WAIT_MS);
        // A mocked/hung RPC must not keep an offline Node test process alive.
        (completionTimer as unknown as { unref?: () => void }).unref?.();
      });
      load = Promise.race([operation, completionDeadline]).finally(() => { if (completionTimer !== undefined) clearTimeout(completionTimer); });
      pending.set(identity, load);
      pendingPriorities.set(identity, context.priority ?? 1);
      void load.finally(() => { if (pending.get(identity) === load) { pending.delete(identity); pendingPriorities.delete(identity); notify(identity); } }).catch(() => undefined);
    } else {
      stats.joined += 1;
      event("request_joined", request, { entryPoint: context.entryPoint });
      if ((context.priority ?? 1) < (pendingPriorities.get(identity) ?? 1)) {
        pendingPriorities.set(identity, context.priority ?? 1);
        // One promotion RPC joins the same backend operation; it cannot dispatch
        // duplicate HTTP and keeps optional work from delaying a required entry.
        void options.fetchResource(request, context).catch(() => undefined);
      }
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject({ handledHttpError: true, status: 503, category: "foreground_deadline" }), options.foregroundMs ?? RA_FOREGROUND_WAIT_MS);
      });
      return copy(await Promise.race([load, deadline])) as RaResourceResult<T>;
    } catch (error) {
      if (context.revision !== options.getRevision() || cached === undefined) throw error;
      stats.fallback += 1;
      if (records.get(identity) === cached) remember(identity, { ...cached, error });
      return copy({ ...cached, cacheState: "stale", error }) as RaResourceResult<T>;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
  return {
    getResourceRevision: (request: RetroAchievementsTransportRequest) => {
      const revision = revisions.get(key(request, options.getRevision()));
      return revision === undefined ? undefined : `${epoch}:${revision}`;
    },
    isResourcePending: (request: RetroAchievementsTransportRequest) => pending.has(key(request, options.getRevision())),
    ensureFresh,
    refreshResource: <T,>(request: RetroAchievementsTransportRequest, context: RaResourceContext) =>
      ensureFresh<T>(request, { ...context, intent: "explicit" }),
    getResource<T>(request: RetroAchievementsTransportRequest): RaResourceResult<T> | undefined {
      const result = records.get(key(request, options.getRevision()));
      return result === undefined ? undefined : copy(result) as RaResourceResult<T>;
    },
    subscribeResource(request: RetroAchievementsTransportRequest, listener: () => void): () => void {
      const identity = key(request, options.getRevision());
      const subscribers = listeners.get(identity) ?? new Set();
      subscribers.add(listener);
      listeners.set(identity, subscribers);
      return () => { subscribers.delete(listener); if (subscribers.size === 0) listeners.delete(identity); };
    },
    invalidateResource(request: RetroAchievementsTransportRequest): void {
      const identity = key(request, options.getRevision());
      const owner = owners.get(identity); if (owner) owner.valid = false;
      owners.delete(identity);
      pending.delete(identity);
      pendingPriorities.delete(identity);
      const cached = records.get(identity);
      if (cached) remember(identity, { ...cached, freshUntil: 0 });
    },
    invalidateResources(paths: readonly string[]): void {
      for (const identity of new Set([...records.keys(), ...pending.keys(), ...owners.keys()])) {
        if (!paths.includes((JSON.parse(identity) as unknown[])[3] as string)) continue;
        const owner = owners.get(identity); if (owner) owner.valid = false;
        owners.delete(identity);
        pending.delete(identity); pendingPriorities.delete(identity);
        const cached = records.get(identity);
        if (cached) remember(identity, { ...cached, freshUntil: 0 });
      }
    },
    clear(): void {
      for (const owner of owners.values()) owner.valid = false;
      owners.clear(); revisions.clear();
      records.clear(); sizes.clear(); listeners.clear(); pending.clear(); pendingPriorities.clear(); memoryBytes = 0;
    },
    getResourceDiagnostics: () => ({ ...stats, resources: records.size, revisions: revisions.size, owners: owners.size, pending: pending.size, memoryBytes }),
  };
}
