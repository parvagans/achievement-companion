import type { DiagnosticLogger } from "@core/platform";
import type { ResourceState } from "@core/cache";
import { callDeckyBackendMethod } from "./decky-backend-bridge";

export type DeckyDiagnosticEvent =
  | "cache_hit" | "resource_published" | "request_joined"
  | "dashboard_refresh_started"
  | "dashboard_refresh_completed"
  | "dashboard_refresh_failed"
  | "provider_opened"
  | "badge_opened"
  | "resource_refresh_started"
  | "resource_refresh_completed"
  | "resource_refresh_failed"
  | "steam_library_scan_started"
  | "steam_library_scan_progress"
  | "steam_library_scan_completed"
  | "steam_library_scan_failed";

export interface DeckyDiagnosticEventPayload {
  readonly event: DeckyDiagnosticEvent;
  readonly providerId?: string;
  readonly mode?: "initial" | "manual" | "background" | "unknown";
  readonly source?: "live" | "cache" | "unknown";
  readonly errorKind?: string;
  readonly resource?: string;
  readonly entryPoint?: string;
  readonly appId?: string;
  readonly gameId?: string;
  readonly forceRefresh?: boolean;
  readonly durationMs?: number;
  readonly ownedGameCount?: number;
  readonly scannedGameCount?: number;
  readonly skippedGameCount?: number;
  readonly failedGameCount?: number;
  readonly gamesWithAchievements?: number;
  readonly totalAchievements?: number;
  readonly unlockedAchievements?: number;
  readonly perfectGames?: number;
  readonly completionPercent?: number;
  readonly subscribers?: number;
  readonly correlationId?: string;
}

export async function recordDeckyDiagnosticEvent(
  payload: DeckyDiagnosticEventPayload,
): Promise<void> {
  try {
    await callDeckyBackendMethod<boolean>("record_diagnostic_event", payload);
  } catch {
    // Diagnostics must never break dashboard refresh or scans.
  }
}

export const deckyDiagnosticLogger: DiagnosticLogger<DeckyDiagnosticEventPayload> = {
  record(payload) {
    return recordDeckyDiagnosticEvent(payload);
  },
};

export interface DeckyResourceRefreshContext {
  readonly providerId: string;
  readonly resource: string;
  readonly entryPoint: string;
  readonly appId?: string;
  readonly gameId?: string;
  readonly forceRefresh: boolean;
}

/** Persist one start and one terminal outcome for each Decky resource load. */
export async function logDeckyResourceRefresh<T>(
  context: DeckyResourceRefreshContext,
  load: () => Promise<ResourceState<T>>,
): Promise<ResourceState<T>> {
  const startedAt = Date.now();
  void deckyDiagnosticLogger.record({ event: "resource_refresh_started", ...context });
  try {
    const state = await load();
    const failed = state.data === undefined && (state.status === "error" || state.error !== undefined);
    void deckyDiagnosticLogger.record({
      event: failed ? "resource_refresh_failed" : "resource_refresh_completed",
      ...context,
      durationMs: Date.now() - startedAt,
      source: state.isStale || state.status === "stale" ? "cache" : context.forceRefresh && !failed ? "live" : "unknown",
      ...(failed ? { errorKind: state.error?.kind ?? "unknown" } : {}),
    });
    return state;
  } catch (cause) {
    void deckyDiagnosticLogger.record({
      event: "resource_refresh_failed",
      ...context,
      durationMs: Date.now() - startedAt,
      source: "unknown",
      errorKind: cause instanceof Error ? cause.name : "unknown",
    });
    throw cause;
  }
}
