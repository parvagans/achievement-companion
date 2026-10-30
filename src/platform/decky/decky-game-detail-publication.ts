import type { GameDetailSnapshot } from "@core/domain";

// Notification only. Canonical resources retain cache and request ownership.
const listeners = new Set<(snapshot: GameDetailSnapshot) => void>();
export function subscribeDeckyGameDetailPublication(listener: (snapshot: GameDetailSnapshot) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function publishDeckyGameDetail(snapshot: GameDetailSnapshot): void {
  for (const listener of listeners) {
    try { listener(snapshot); } catch { /* Presentation observers cannot fail a canonical load. */ }
  }
}
