import type { ProviderId } from "@core/domain";

interface SessionEntry<T> { readonly promise: Promise<T>; snapshot?: T; }

/** Retains a provider session across routes and discards failed or invalidated loads. */
export function createDeckyFullScreenSessionCoordinator<T>() {
  const sessions = new Map<ProviderId, SessionEntry<T>>();
  const listeners = new Set<() => void>();
  let revision = 0;
  function notify() { revision += 1; for (const listener of listeners) listener(); }
  return {
    has: (id: ProviderId) => sessions.has(id),
    getSnapshot: (id: ProviderId | undefined) => id === undefined ? undefined : sessions.get(id)?.snapshot,
    updateSnapshot(id: ProviderId, update: (snapshot: T) => T) {
      const entry = sessions.get(id);
      if (entry?.snapshot !== undefined) { entry.snapshot = update(entry.snapshot); notify(); }
    },
    invalidate(id: ProviderId) { sessions.delete(id); notify(); },
    notify,
    getRevision: () => revision,
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    reset() { sessions.clear(); listeners.clear(); revision = 0; },
    load(id: ProviderId, loader: (id: ProviderId) => Promise<T>): Promise<T> {
      const existing = sessions.get(id);
      if (existing !== undefined) return existing.promise;
      let entry: SessionEntry<T>;
      const promise = loader(id).then((snapshot) => {
        if (sessions.get(id) === entry) entry.snapshot = snapshot;
        return snapshot;
      }).catch((cause: unknown) => {
        if (sessions.get(id) === entry) sessions.delete(id);
        throw cause;
      });
      entry = { promise };
      sessions.set(id, entry);
      return promise;
    },
  };
}
