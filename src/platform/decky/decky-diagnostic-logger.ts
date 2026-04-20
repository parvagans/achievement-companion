import { callDeckyBackendMethod } from "./decky-backend-bridge";

export type DeckyDiagnosticEvent =
  | "dashboard_refresh_started"
  | "dashboard_refresh_completed"
  | "dashboard_refresh_failed"
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
