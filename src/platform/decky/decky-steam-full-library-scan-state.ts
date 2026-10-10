import { useSyncExternalStore } from "react";
import { runDeckySteamFullLibraryScan } from "./decky-app-services";

export type SteamFullLibraryScanState = "idle" | "scanning" | "completed" | "error";
let state: SteamFullLibraryScanState = "idle";
let pendingScan: Promise<void> | undefined;
const listeners = new Set<() => void>();

function setState(next: SteamFullLibraryScanState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function useSteamFullLibraryScanState(): SteamFullLibraryScanState {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => state,
  );
}

/** Own the scan outside the settings component so tab changes cannot reset its status. */
export function startSteamFullLibraryScan(): Promise<void> {
  if (pendingScan !== undefined) return pendingScan;
  setState("scanning");
  pendingScan = (async () => {
    try {
      const result = await runDeckySteamFullLibraryScan();
      setState(result === undefined ? "error" : "completed");
    } catch {
      setState("error");
    } finally {
      pendingScan = undefined;
    }
  })();
  return pendingScan;
}
