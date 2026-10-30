import { getDeckyAccountRevision, subscribeDeckyAccountRevision } from "../../decky-account-revision";
import { callDeckyBackendMethod } from "../../decky-backend-bridge";
import { createRetroAchievementsDataCoordinator } from "../../retroachievements-data-coordinator";
import { getRetroAchievementsActiveGameId } from "../../decky-retroachievements-current-game";
import { readDeckyDashboardSnapshotState } from "../../decky-dashboard-snapshot-cache";
import { readDeckyProviderConfigs } from "../provider-config-store";
import { parseRaPresence, projectRaPresence } from "../../retroachievements-presence-coordinator";
import { deckyDiagnosticLogger, type DeckyDiagnosticEvent } from "../../decky-diagnostic-logger";
import { markRetroAchievementsSource, RetroAchievementsRequestError, type RetroAchievementsTransport, type RetroAchievementsTransportRequest } from "../../../../providers/retroachievements/client/transport";

const invalidations = new Map<string, Promise<unknown>>();
let diagnosticSequence = 0;
function createCoordinator() {
  return createRetroAchievementsDataCoordinator({
    onEvent(event, fields) {
      void deckyDiagnosticLogger.record({ event: event as DeckyDiagnosticEvent, providerId: "retroachievements",
        correlationId: `frontend:${++diagnosticSequence}`,
        resource: fields.resource, ...(fields.entryPoint !== undefined ? { entryPoint: fields.entryPoint } : {}),
        ...(fields.subscribers !== undefined ? { subscribers: fields.subscribers } : {}),
        ...(fields.source === "memory" ? { source: "cache" as const } : {}),
      });
    },
    getRevision: () => getDeckyAccountRevision("retroachievements"),
    async fetchResource(request, context) {
      if (request.path === "history-checkpoint") {
        const result = await callDeckyBackendMethod<Record<string, unknown>>("synchronize_retroachievements_history", {});
        const checkpoint = result["history"] as { lastSuccessAt?: number } | undefined;
        if (checkpoint === undefined) return result;
        return { raResource: 1, resourceKey: "history-checkpoint", payload: result,
          cacheState: result["error"] === undefined ? "live" : "stale",
          fetchedAt: (checkpoint.lastSuccessAt ?? 0) * 1000, freshUntil: result["freshUntil"] ?? 0,
          ...(result["error"] !== undefined ? { error: result["error"] } : {}),
        };
      }
      const gameId = request.path === "API_GetGameInfoAndUserProgress.php" ? String(request.query?.["g"] ?? "") : undefined;
      if (gameId !== undefined) await invalidations.get(gameId);
      const response = await callDeckyBackendMethod<unknown>("request_retroachievements_json", {
        path: request.path,
        query: request.query,
        resourceProtocol: 1,
        refreshIntent: context.intent ?? "policy",
        activeViewing: context.activeViewing === true,
        entryPoint: context.entryPoint,
      });
      if (request.path === "API_GetGameInfoAndUserProgress.php" && typeof response === "object" && response !== null &&
          (response as Record<string, unknown>)["cacheState"] === "live") {
        coordinator.invalidateResource({ path: "history-checkpoint" });
      }
      if (typeof response === "object" && response !== null &&
          ((response as Record<string, unknown>)["handledHttpError"] === true ||
           (response as Record<string, unknown>)["raResource"] === 1)) return response;
      // Older backend compatibility: use the response for this entry only. An
      // unversioned response cannot claim backend-authoritative freshness.
      const fetchedAt = Date.now();
      return { raResource: 1, resourceKey: "legacy", payload: response, cacheState: "live", fetchedAt, freshUntil: fetchedAt };
    },
  });
}

let coordinator = createCoordinator();
export function invalidateDeckyRetroAchievementsGameResource(gameId: string): void {
  coordinator.invalidateResource({ path: "API_GetGameInfoAndUserProgress.php", query: { g: gameId, a: 1 } });
  if (invalidations.has(gameId)) return;
  const operation = callDeckyBackendMethod<boolean>("invalidate_retroachievements_game", { gameId });
  invalidations.set(gameId, operation);
  void operation.finally(() => { if (invalidations.get(gameId) === operation) invalidations.delete(gameId); }).catch(() => undefined);
}
export function getDeckyRetroAchievementsDataCoordinator() { return coordinator; }
export function ensureDeckyRetroAchievementsHistoryResource<T>() {
  return coordinator.ensureFresh<T>({ path: "history-checkpoint" }, {
    revision: getDeckyAccountRevision("retroachievements"), entryPoint: "activity-history",
  });
}
export function isDeckyRetroAchievementsResourceFresh(path: string, query: Readonly<Record<string, string | number>> = {}): boolean {
  const resource = coordinator.getResource({ path, query });
  return resource !== undefined && resource.cacheState !== "stale" && resource.fetchedAt <= Date.now() && Date.now() < resource.freshUntil;
}
export function areDeckyRetroAchievementsProfileResourcesFresh(username: string, gameId?: string): boolean {
  return [
    { path: "API_GetUserProfile.php", query: { u: username } },
    { path: "API_GetUserSummary.php", query: { u: username, a: 0, g: 0 } },
    { path: "API_GetUserRecentAchievements.php", query: { u: username, m: 1440 } },
    { path: "API_GetUserRecentlyPlayedGames.php", query: { u: username, c: 10 } },
    { path: "API_GetUserCompletionProgress.php", query: { u: username, c: 500, o: 0 } },
  ].every((request) => isDeckyRetroAchievementsResourceFresh(request.path, request.query)) &&
    (gameId === undefined || isDeckyRetroAchievementsGameResourceFresh(gameId));
}
export function isDeckyRetroAchievementsGameResourceFresh(gameId: string): boolean {
  const resource = coordinator.getResource({ path: "API_GetGameInfoAndUserProgress.php", query: { g: gameId, a: 1 } });
  if (resource === undefined || resource.cacheState === "stale") return false;
  const saved = readDeckyDashboardSnapshotState("retroachievements")?.data;
  const config = readDeckyProviderConfigs().retroAchievements;
  const summary = config === undefined ? undefined : coordinator.getResource({ path: "API_GetUserSummary.php", query: { u: config.username, g: 0, a: 0 } });
  const presence = summary === undefined ? undefined : parseRaPresence(summary);
  const active = saved !== undefined && getRetroAchievementsActiveGameId(projectRaPresence(saved, presence).profile) === gameId;
  const eligibleUntil = active ? resource.activeFreshUntil ?? 0 : resource.freshUntil;
  return resource.fetchedAt <= Date.now() && Date.now() < eligibleUntil;
}
export function resetDeckyRetroAchievementsTransportForTests(): void {
  coordinator.clear();
  invalidations.clear();
  coordinator = createCoordinator();
}
subscribeDeckyAccountRevision((providerId) => {
  if (providerId === "retroachievements") coordinator.clear();
});

export function createDeckyRetroAchievementsTransport(): RetroAchievementsTransport {
  return {
    async requestJson<T>(request: RetroAchievementsTransportRequest): Promise<T> {
      if (request.init !== undefined && (request.init.body !== undefined || request.init.headers !== undefined ||
          (request.init.method !== undefined && request.init.method.toUpperCase() !== "GET"))) {
        throw new Error("RetroAchievements resources require a standard GET request.");
      }
      try {
        const result = await coordinator.ensureFresh<T>(request, {
          revision: getDeckyAccountRevision("retroachievements"), entryPoint: request.entryPoint ?? "provider",
          intent: request.refreshIntent ?? "policy", activeViewing: request.activeViewing === true,
          priority: request.entryPoint === "game-playtime" ? 3 : 1,
        });
        markRetroAchievementsSource(result.payload, result.sourceRevision);
        return result.payload;
      } catch (cause) {
        const failure = typeof cause === "object" && cause !== null ? cause as Record<string, unknown> : undefined;
        if (failure?.["handledHttpError"] === true) {
          throw new RetroAchievementsRequestError(
            typeof failure["message"] === "string" ? failure["message"] : "RetroAchievements is temporarily unavailable.",
            typeof failure["status"] === "number" ? failure["status"] : undefined, "http",
            typeof failure["retryAfterMs"] === "number" ? failure["retryAfterMs"] : undefined);
        }
        throw cause;
      }
    },
  };
}

/** Account-scoped content revision, independent of TTL and wall clocks. */
export function getDeckyRetroAchievementsGameResourceRevision(gameId: string): string | undefined {
  const request = { path: "API_GetGameInfoAndUserProgress.php", query: { g: gameId, a: 1 } };
  const version = coordinator.getResource(request)?.sourceRevision;
  return coordinator.getResource(request) === undefined || version === undefined ? undefined
    : version;
}

export function getDeckyRetroAchievementsProfileResourceRevision(username: string): string | undefined {
  const requests = [
    { path: "API_GetUserProfile.php", query: { u: username } },
    { path: "API_GetUserRecentAchievements.php", query: { u: username, m: 1440 } },
    { path: "API_GetUserRecentlyPlayedGames.php", query: { u: username, c: 10 } },
    { path: "API_GetUserCompletionProgress.php", query: { u: username, c: 500, o: 0 } },
  ];
  const revisions = requests.map((request) => coordinator.getResource(request) === undefined ? undefined : coordinator.getResource(request)?.sourceRevision);
  return revisions.some((revision) => revision === undefined) ? undefined : JSON.stringify([...new Set(revisions)].sort());
}
