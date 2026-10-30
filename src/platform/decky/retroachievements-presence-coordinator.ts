import type { DashboardSnapshot, RecentlyPlayedGame } from "@core/domain";
import type { RaResourceResult } from "./retroachievements-data-coordinator";

export const RA_PRESENCE_FRESH_MS = 45_000;
export const RA_PRESENCE_VISIBLE_MS = 60_000;
export type PresenceTrigger = "qam-entry" | "full-screen-entry" | "game-launch" | "game-exit" | "scheduled-validation";
export interface RaPresence {
  readonly gameId?: string;
  readonly messageDate?: number;
  readonly message?: string;
  readonly validatedAt: number;
  readonly freshUntil: number;
  readonly suppressed?: boolean;
}
export interface RaObservedSession {
  readonly gameId: string;
  readonly observedAt: number;
  readonly heartbeatAt: number;
  readonly endedAt?: number;
  readonly localAppId?: string;
  readonly localOwnership?: "mapped" | "emulator";
}

export function orderRaRecentSessions(games: readonly RecentlyPlayedGame[], sessions: readonly RaObservedSession[],
  known: readonly RecentlyPlayedGame[] = []): readonly RecentlyPlayedGame[] {
  const result = new Map(games.map((game) => [game.gameId, game]));
  for (const session of sessions) {
    const authoritative = result.get(session.gameId);
    const game = authoritative ?? known.find((entry) => entry.gameId === session.gameId);
    if (game === undefined || (authoritative?.lastPlayedAt ?? 0) >= session.heartbeatAt) continue;
    result.set(game.gameId, { ...game, observedSessionAt: session.observedAt });
  }
  // Stable ties preserve the provider's order; never invent a LastPlayed value.
  return [...result.values()].sort((a, b) => Math.max(b.lastPlayedAt ?? 0, b.observedSessionAt ?? 0)
    - Math.max(a.lastPlayedAt ?? 0, a.observedSessionAt ?? 0));
}

/** Activity age is provider evidence; validatedAt controls request freshness. */
export function parseRaPresence(resource: RaResourceResult<unknown>): RaPresence | undefined {
  if (!Number.isFinite(resource.fetchedAt) || !Number.isFinite(resource.freshUntil)) return undefined;
  if (typeof resource.payload !== "object" || resource.payload === null) return undefined;
  const raw = resource.payload as Record<string, unknown>;
  if (!("LastGameID" in raw || "lastGameId" in raw) || !("RichPresenceMsgDate" in raw || "richPresenceMsgDate" in raw)) return undefined;
  const id = String(raw["LastGameID"] ?? raw["lastGameId"] ?? "").trim();
  const date = raw["RichPresenceMsgDate"] ?? raw["richPresenceMsgDate"];
  const timestamp = typeof date === "string" ? Date.parse(/[zZ]|[+-]\d\d:\d\d$/u.test(date) ? date : `${date.replace(" ", "T")}Z`) : NaN;
  const message = raw["RichPresenceMsg"] ?? raw["richPresenceMsg"];
  return { ...( /^\d+$/u.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0 ? { gameId: String(Number(id)) } : {}),
    ...(Number.isFinite(timestamp) ? { messageDate: timestamp } : {}),
    ...(typeof message === "string" ? { message } : {}),
    validatedAt: resource.fetchedAt,
    freshUntil: resource.cacheState === "stale" ? 0 : Math.min(resource.freshUntil, resource.fetchedAt + RA_PRESENCE_FRESH_MS),
  };
}

export function projectRaPresence(snapshot: DashboardSnapshot, presence: RaPresence | undefined): DashboardSnapshot {
  if (presence === undefined || snapshot.profile.providerId !== "retroachievements") return snapshot;
  const { richPresenceGameId: _id, richPresenceMsgDate: _date, ...profile } = snapshot.profile;
  const metrics = presence.message === undefined ? profile.metrics : [
    ...profile.metrics.filter((metric) => metric.key !== "rich-presence"),
    { key: "rich-presence", label: "Rich Presence", value: presence.message },
  ];
  return { ...snapshot, profile: { ...profile, metrics,
    ...(!presence.suppressed && presence.gameId !== undefined ? { richPresenceGameId: presence.gameId } : {}),
    ...(!presence.suppressed && presence.messageDate !== undefined ? { richPresenceMsgDate: presence.messageDate } : {}),
  } };
}

/** One account-scoped validation owner. Timers express activity/visibility policy;
 * transport retries, spacing, failures and cooldown remain in the backend. */
export function createRaPresenceCoordinator(dependencies: {
  revision(): number;
  read(): RaResourceResult<unknown> | undefined;
  fetch(trigger: PresenceTrigger, force: boolean): Promise<RaResourceResult<unknown>>;
  loadSessions?: () => Promise<readonly RaObservedSession[]>;
  saveSessions?: (sessions: readonly RaObservedSession[]) => void;
  fetchRecent?: () => Promise<readonly RecentlyPlayedGame[]>;
  now?: () => number;
  schedule?: (callback: () => void, ms: number) => unknown;
  cancel?: (timer: unknown) => void;
  log?: (event: string, fields: Record<string, string | number | boolean>) => void;
}) {
  const now = dependencies.now ?? (() => Date.now());
  const schedule = dependencies.schedule ?? ((callback, ms) => setTimeout(callback, ms));
  const cancel = dependencies.cancel ?? ((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));
  let account = dependencies.revision(), generation = 0, version = 0;
  let current: RaPresence | undefined;
  let pending: Promise<RaPresence | undefined> | undefined, pendingGeneration = 0;
  let blockedUntil = 0;
  let invalidated = false;
  let activityWasCurrent = false;
  let visibleTimer: unknown, followTimer: unknown;
  const visible = new Set<object>(), listeners = new Set<() => void>();
  const local = new Map<string, { running: boolean; startedAt: number; evidenceRevision: number; gameId?: string; ownership?: "mapped" | "emulator" }>();
  let exitFence: { gameId: string; at: number } | undefined;
  const sessions = new Map<string, RaObservedSession>(), knownGames = new Map<string, RecentlyPlayedGame>();
  let recentGames: readonly RecentlyPlayedGame[] = [];
  let hydration: Promise<void> | undefined;
  let recentLoad: Promise<void> | undefined;
  const changed = () => { version += 1; for (const listener of listeners) listener(); };
  const persist = () => { try { dependencies.saveSessions?.([...sessions.values()].sort((a, b) => b.observedAt - a.observedAt).slice(0, 12)); } catch { /* Keep observations in memory if storage is unavailable. */ } };
  function updateRecent(games: readonly RecentlyPlayedGame[]) {
    checkAccount();
    if (JSON.stringify(recentGames) === JSON.stringify(games)) return;
    recentGames = games;
    for (const game of games) knownGames.set(game.gameId, game);
    while (knownGames.size > 64) knownGames.delete(knownGames.keys().next().value!);
    // Keep bounded session evidence for exit suppression across plugin restarts.
    // Ordering ignores it once authoritative LastPlayed reaches the heartbeat.
    persist(); changed();
  }
  function hydrate() {
    if (hydration !== undefined) return hydration;
    const revision = account;
    hydration = (async () => {
      try {
        const saved = await dependencies.loadSessions?.() ?? [];
        if (revision !== dependencies.revision()) return;
        for (const session of saved.slice(0, 12)) if (/^[1-9]\d*$/u.test(session.gameId) && Number.isFinite(session.observedAt) &&
            session.observedAt <= now() && Number.isFinite(session.heartbeatAt) && session.heartbeatAt <= session.observedAt &&
            (sessions.get(session.gameId)?.observedAt ?? 0) < session.observedAt) sessions.set(session.gameId, session);
        persist(); changed();
      } catch { /* Presence and cached metadata remain usable offline. */ }
    })();
    return hydration;
  }
  function endSession(gameId: string) {
    const session = sessions.get(gameId);
    if (session === undefined || session.endedAt !== undefined) return;
    sessions.set(gameId, { ...session, endedAt: now() }); persist();
    if (recentLoad === undefined && dependencies.fetchRecent !== undefined) {
      const revision = account;
      const operation = dependencies.fetchRecent().then((games) => {
        if (revision === dependencies.revision()) updateRecent(games);
      }).catch(() => undefined);
      recentLoad = operation;
      void operation.finally(() => { if (recentLoad === operation) recentLoad = undefined; });
    }
  }
  const log = (event: string, fields: Record<string, string | number | boolean>) => { try { dependencies.log?.(event, fields); } catch { /* Diagnostic only. */ } };
  function failureDelay(value: unknown) {
    const delay = typeof value === "object" && value !== null ? (value as { retryAfterMs?: unknown }).retryAfterMs : undefined;
    return Math.max(30_000, typeof delay === "number" && Number.isFinite(delay) && delay >= 0 ? delay : 0);
  }
  function reset() {
    account = dependencies.revision(); generation += 1; current = undefined; pending = undefined;
    blockedUntil = 0; invalidated = false; activityWasCurrent = false; exitFence = undefined; local.clear();
    sessions.clear(); knownGames.clear(); recentGames = []; hydration = undefined; recentLoad = undefined;
    if (visibleTimer !== undefined) cancel(visibleTimer);
    if (followTimer !== undefined) cancel(followTimer);
    visibleTimer = followTimer = undefined;
    version += 1; for (const listener of listeners) listener();
  }
  function checkAccount() { if (account !== dependencies.revision()) reset(); }
  function read() {
    checkAccount();
    const cached = dependencies.read();
    const parsed = cached === undefined ? undefined : parseRaPresence(cached);
    if (!invalidated && parsed !== undefined && (current === undefined || parsed.validatedAt > current.validatedAt)) publish(parsed);
    return current;
  }
  function withLocalEvidence(value: RaPresence): RaPresence {
    // A local exit only suppresses that game's old heartbeat. Newer account
    // activity (including the same game on another device) remains authoritative.
    const endedAt = value.gameId === undefined ? undefined : sessions.get(value.gameId)?.endedAt;
    const fence = exitFence !== undefined && value.gameId === exitFence.gameId ? exitFence.at : endedAt;
    return fence !== undefined && (value.messageDate ?? 0) <= fence
      ? { ...value, suppressed: true } : value;
  }
  function publish(next: RaPresence) {
    const previous = current;
    current = withLocalEvidence(next);
    const activityCurrent = current.gameId !== undefined && !current.suppressed && current.messageDate !== undefined &&
      current.messageDate <= now() && now() - current.messageDate <= 600000;
    const activityChanged = activityCurrent !== activityWasCurrent;
    if (activityWasCurrent && previous?.gameId !== undefined && (!activityCurrent || previous.gameId !== current.gameId)) endSession(previous.gameId);
    if (activityCurrent && current.gameId !== undefined) {
      const saved = sessions.get(current.gameId);
      if (saved === undefined || activityChanged || previous?.gameId !== current.gameId) {
        sessions.set(current.gameId, { gameId: current.gameId, observedAt: now(), heartbeatAt: current.messageDate!, ...(saved?.localAppId !== undefined && saved.endedAt === undefined ? { localAppId: saved.localAppId, ...(saved.localOwnership === undefined ? {} : { localOwnership: saved.localOwnership }) } : {}) });
        while (sessions.size > 12) sessions.delete([...sessions.values()].sort((a, b) => a.observedAt - b.observedAt)[0]!.gameId);
        persist();
      }
    }
    if (activityCurrent && current.gameId !== undefined) {
      const running = [...local.entries()].filter(([, value]) => value.running && value.ownership !== undefined &&
        (current!.messageDate ?? 0) >= value.startedAt && (
          value.gameId === current!.gameId ||
          // A ROM transition continues an already corroborated process session.
          (value.gameId !== undefined && previous?.gameId === value.gameId && !previous.suppressed) ||
          // An unmapped emulator needs a launch-time activity transition, not a
          // later heartbeat for account activity that was already present.
          (value.ownership === "emulator" && value.gameId === undefined && previous?.gameId !== current!.gameId &&
            (current!.messageDate ?? 0) - value.startedAt <= RA_PRESENCE_VISIBLE_MS)
        ));
      if (running.length === 1) {
        const [appId, process] = running[0]!;
        if (process.gameId !== current.gameId) process.evidenceRevision += 1;
        process.gameId = current.gameId;
        const session = sessions.get(current.gameId);
        if (session !== undefined && (session.localAppId !== appId || session.localOwnership !== process.ownership)) { sessions.set(current.gameId, { ...session, localAppId: appId, localOwnership: process.ownership! }); persist(); }
      }
    }
    activityWasCurrent = activityCurrent;
    const changed = activityChanged || previous?.validatedAt !== current.validatedAt || previous?.gameId !== current.gameId || previous?.messageDate !== current.messageDate || previous?.suppressed !== current.suppressed || previous?.message !== current.message;
    if (changed) { version += 1; for (const listener of listeners) listener(); }
    log("presence_published", { gameId: current.gameId ?? "", validActivityDate: current.messageDate !== undefined,
      activeGameChanged: activityChanged || previous?.gameId !== current.gameId || previous?.suppressed !== current.suppressed,
      subscribers: listeners.size, presentationUpdated: changed && listeners.size > 0 });
  }
  function fresh() { const value = read(); return !invalidated && value !== undefined && now() >= value.validatedAt && now() < value.freshUntil; }
  function armVisible() {
    if (visibleTimer !== undefined) cancel(visibleTimer);
    visibleTimer = undefined;
    if (!visible.size) return;
    visibleTimer = schedule(() => { visibleTimer = undefined; void ensure("scheduled-validation").finally(armVisible); },
      Math.min(2_147_483_647, Math.max(RA_PRESENCE_VISIBLE_MS, blockedUntil - now())));
  }
  async function ensure(trigger: PresenceTrigger, force = false): Promise<RaPresence | undefined> {
    checkAccount();
    if (dependencies.loadSessions !== undefined) await hydrate();
    const saved = read();
    log("presence_evaluated", { trigger, ageMs: saved === undefined ? -1 : Math.max(0, now() - saved.validatedAt),
      lastSuccessAt: saved?.validatedAt ?? 0, fresh: fresh() });
    if (now() < blockedUntil || (!force && fresh())) {
      log("presence_skipped", { trigger, cooldown: now() < blockedUntil }); return saved;
    }
    if (pending !== undefined) {
      if (pendingGeneration !== generation) { await pending; return ensure(trigger, force); }
      log("presence_joined", { trigger }); return pending;
    }
    const expected = generation, revision = account, started = now();
    pendingGeneration = expected;
    const operation = (async () => {
      try {
        const result = await dependencies.fetch(trigger, force || invalidated);
        if (expected !== generation || revision !== dependencies.revision()) return current;
        const failure = result.error as { status?: number; retryAfterMs?: number } | undefined;
        if (failure !== undefined) blockedUntil = now() + failureDelay(failure);
        const next = parseRaPresence(result);
        if (next !== undefined && result.cacheState !== "stale") invalidated = false;
        if (next !== undefined && (current === undefined || next.validatedAt >= current.validatedAt)) publish(next);
        log("presence_validated", { trigger, durationMs: now() - started, failed: result.cacheState === "stale" });
        return current;
      } catch (cause) {
        if (expected !== generation || revision !== dependencies.revision()) return current;
        const failure = cause as { status?: number; statusCode?: number; retryAfterMs?: number } | undefined;
        blockedUntil = now() + failureDelay(failure);
        if (current !== undefined) publish(current);
        log("presence_failed", { trigger, durationMs: now() - started, status: failure?.status ?? failure?.statusCode ?? 503 });
        return current;
      }
    })();
    pending = operation;
    void operation.finally(() => { if (pending === operation) pending = undefined; });
    return operation;
  }
  function lifecycle(appId: string, running: boolean, gameId?: string, evidence: "unknown" | "emulator" = "unknown") {
    checkAccount();
    read();
    if (local.get(appId)?.running === running) { log("presence_skipped", { trigger: running ? "game-launch" : "game-exit", duplicate: true }); return; }
    const previousProcess = local.get(appId);
    if (!running) gameId = previousProcess?.gameId ?? [...sessions.values()]
      .filter((session) => previousProcess === undefined && session.localAppId === appId && session.localOwnership !== undefined && session.endedAt === undefined)
      .sort((a, b) => b.observedAt - a.observedAt)[0]?.gameId ?? gameId;
    // Ownership belongs to this launch, never the last completed process.
    const ownership = running ? (evidence === "emulator" ? "emulator" : gameId !== undefined ? "mapped" : undefined)
      : previousProcess?.ownership;
    local.set(appId, { running, evidenceRevision: running ? 0 : previousProcess?.evidenceRevision ?? 0, ...(ownership === undefined ? {} : { ownership }),
      startedAt: running ? now() : previousProcess?.startedAt ?? now(), ...(gameId === undefined ? {} : { gameId }) });
    generation += 1;
    invalidated = true;
    const expected = generation, eventAt = now();
    if (followTimer !== undefined) cancel(followTimer);
    if (running) exitFence = undefined;
    else if (gameId !== undefined) { exitFence = { gameId, at: eventAt }; if (current !== undefined) publish(current); }
    if (current !== undefined) current = { ...current, freshUntil: 0 };
    const trigger = running ? "game-launch" : "game-exit";
    const reflected = (value: RaPresence | undefined) => running
      ? value?.gameId !== undefined && (gameId === undefined || value.gameId === gameId) && (value.messageDate ?? 0) >= eventAt
      : gameId !== undefined ? value?.gameId !== gameId || (value?.messageDate ?? 0) > eventAt : value?.gameId === undefined;
    const check = async (attempt: number): Promise<void> => {
      if (expected !== generation) return;
      // Entry-time validation may already have satisfied the debounced event.
      if (attempt === 0 && fresh() && reflected(read())) return;
      const value = await ensure(attempt ? "scheduled-validation" : trigger, true);
      if (expected !== generation || now() < blockedUntil || attempt >= 2) return;
      if (!reflected(value)) followTimer = schedule(() => { followTimer = undefined; void check(attempt + 1); }, attempt === 0 ? 15_000 : 30_000);
    };
    // Exit/start bursts and repeated Steam notifications coalesce into one
    // lightweight validation, without another HTTP scheduling authority.
    followTimer = schedule(() => { followTimer = undefined; void check(0); }, 250);
  }
  function corroborateLaunch(appId: string, gameId: string) {
    checkAccount();
    const process = local.get(appId);
    // This result describes initial launch evidence (revision zero). A heartbeat
    // association or ROM transition established since launch is stronger evidence.
    // Launch/account tokens are checked by the adapter; ordering within that same
    // launch belongs here and never depends on wall-clock timestamps.
    if (!process?.running || process.evidenceRevision !== 0) return;
    process.evidenceRevision += 1;
    process.gameId = gameId; process.ownership = "mapped";
    if (current !== undefined) publish(current);
  }
  function observe() {
    checkAccount();
    if (invalidated) return;
    const resource = dependencies.read();
    const value = resource === undefined ? undefined : parseRaPresence(resource);
    if (value !== undefined && (current === undefined || value.validatedAt >= current.validatedAt)) publish(value);
  }
  function project(snapshot: DashboardSnapshot): DashboardSnapshot {
    const projected = projectRaPresence(snapshot, read());
    const originals = new Map(snapshot.recentlyPlayedGames.map((game) => [game.gameId, game]));
    for (const game of recentGames) {
      const previous = originals.get(game.gameId);
      if (previous === undefined || (game.lastPlayedAt ?? 0) >= (previous.lastPlayedAt ?? 0)) originals.set(game.gameId, game);
    }
    const known = [...knownGames.values(), ...(snapshot.currentGame === undefined ? [] : [snapshot.currentGame]),
      ...snapshot.featuredGames, ...(snapshot.profile.featuredGames ?? [])];
    return { ...projected, currentGame: known.find((game) => game.gameId === projected.profile.richPresenceGameId),
      recentlyPlayedGames: orderRaRecentSessions([...originals.values()], [...sessions.values()], known) };
  }
  return { ensure, read, fresh, lifecycle, corroborateLaunch, reset, observe, project, updateRecent, hydrate,
    observedSessions: () => [...sessions.values()],
    preferredGameId(snapshot: DashboardSnapshot) {
      const recent = project(snapshot).recentlyPlayedGames[0];
      const observed = [...sessions.values()].sort((a, b) => b.observedAt - a.observedAt)[0];
      return observed !== undefined && observed.observedAt > Math.max(recent?.lastPlayedAt ?? 0, recent?.observedSessionAt ?? 0)
        ? observed.gameId : recent?.gameId;
    },
    rememberGame(game: RecentlyPlayedGame) { if (game.providerId === "retroachievements" && JSON.stringify(knownGames.get(game.gameId)) !== JSON.stringify(game)) {
      knownGames.set(game.gameId, game); while (knownGames.size > 64) knownGames.delete(knownGames.keys().next().value!); changed();
    } },
    revision: () => version,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    visible(trigger: "qam-entry" | "full-screen-entry") {
      const owner = {}; visible.add(owner); void ensure(trigger).finally(armVisible); armVisible();
      return () => { visible.delete(owner); armVisible(); };
    },
    dispose() { visible.clear(); reset(); listeners.clear(); },
  };
}
