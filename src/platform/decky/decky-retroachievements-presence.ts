import { getDeckyAccountRevision, subscribeDeckyAccountRevision } from "./decky-account-revision";
import { readDeckyProviderConfigs } from "./providers/provider-config-store";
import { getDeckyRetroAchievementsDataCoordinator } from "./providers/retroachievements/backend-transport";
import { createRaPresenceCoordinator, type RaObservedSession } from "./retroachievements-presence-coordinator";
import { callDeckyBackendMethod } from "./decky-backend-bridge";
import { normalizeRetroAchievementsRecentlyPlayedGames } from "../../providers/retroachievements/mappers/normalize";
import type { RawRetroAchievementsRecentlyPlayedGameResponse } from "../../providers/retroachievements/raw-types";
let presenceSequence = 0;
let stopResourceSubscription: (() => void) | undefined;
let subscriptionIdentity: string | undefined;
let subscribedCoordinator: ReturnType<typeof getDeckyRetroAchievementsDataCoordinator> | undefined;
let stopRecentSubscription: (() => void) | undefined;
let observationScope: string | undefined;
let saveQueue: Promise<unknown> = Promise.resolve();

export const deckyRaPresence = createRaPresenceCoordinator({
  async loadSessions() {
    const revision = getDeckyAccountRevision("retroachievements");
    const saved = await callDeckyBackendMethod<{ scope: string; sessions: readonly RaObservedSession[] } | null>("read_retroachievements_observed_sessions", {});
    if (revision !== getDeckyAccountRevision("retroachievements")) return [];
    observationScope = saved?.scope;
    return Array.isArray(saved?.sessions) ? saved.sessions : [];
  },
  saveSessions(sessions) {
    if (observationScope === undefined) return;
    const scope = observationScope, revision = getDeckyAccountRevision("retroachievements");
    saveQueue = saveQueue.catch(() => undefined).then(() => revision === getDeckyAccountRevision("retroachievements")
      ? callDeckyBackendMethod("write_retroachievements_observed_sessions", { scope, sessions }) : undefined).catch(() => undefined);
  },
  async fetchRecent() {
    const config = readDeckyProviderConfigs().retroAchievements;
    if (config === undefined || !config.hasApiKey) throw { status: 401 };
    const result = await getDeckyRetroAchievementsDataCoordinator().ensureFresh<readonly RawRetroAchievementsRecentlyPlayedGameResponse[]>({
      path: "API_GetUserRecentlyPlayedGames.php", query: { u: config.username, c: 10 },
    }, { revision: getDeckyAccountRevision("retroachievements"), entryPoint: "presence-session-ended", intent: "explicit", priority: 2 });
    return normalizeRetroAchievementsRecentlyPlayedGames(result.payload);
  },
  revision: () => getDeckyAccountRevision("retroachievements"),
  read: () => {
    const config = readDeckyProviderConfigs().retroAchievements;
    if (config !== undefined) {
      const resources = getDeckyRetroAchievementsDataCoordinator();
      const identity = JSON.stringify([getDeckyAccountRevision("retroachievements"), config.username]);
      if (identity !== subscriptionIdentity || resources !== subscribedCoordinator) {
        stopResourceSubscription?.(); stopRecentSubscription?.(); subscriptionIdentity = identity; subscribedCoordinator = resources;
        stopResourceSubscription = resources.subscribeResource({ path: "API_GetUserSummary.php", query: { u: config.username, g: 0, a: 0 } },
          () => deckyRaPresence.observe());
        const recentRequest = { path: "API_GetUserRecentlyPlayedGames.php", query: { u: config.username, c: 10 } };
        const updateRecent = () => {
          const recent = resources.getResource<readonly RawRetroAchievementsRecentlyPlayedGameResponse[]>(recentRequest);
          if (Array.isArray(recent?.payload)) deckyRaPresence.updateRecent(normalizeRetroAchievementsRecentlyPlayedGames(recent.payload));
        };
        stopRecentSubscription = resources.subscribeResource(recentRequest, updateRecent);
        updateRecent();
      }
    }
    return config === undefined ? undefined : getDeckyRetroAchievementsDataCoordinator().getResource({
      path: "API_GetUserSummary.php", query: { u: config.username, g: 0, a: 0 },
    });
  },
  async fetch(trigger, force) {
    const config = readDeckyProviderConfigs().retroAchievements;
    if (config === undefined || !config.hasApiKey) throw { status: 401 };
    return getDeckyRetroAchievementsDataCoordinator().ensureFresh({
      path: "API_GetUserSummary.php", query: { u: config.username, g: 0, a: 0 },
    }, { revision: getDeckyAccountRevision("retroachievements"), entryPoint: `presence-${trigger}`,
      intent: force ? "explicit" : "policy", priority: 0 });
  },
  log(event, fields) {
    void callDeckyBackendMethod("record_diagnostic_event", { event, providerId: "retroachievements",
      correlationId: `presence:${++presenceSequence}`, ...fields }).catch(() => undefined);
  },
});
subscribeDeckyAccountRevision((providerId) => { if (providerId === "retroachievements") stopDeckyRaPresence(); });
export function stopDeckyRaPresence(): void {
  stopResourceSubscription?.(); stopResourceSubscription = undefined;
  stopRecentSubscription?.(); stopRecentSubscription = undefined; observationScope = undefined;
  subscriptionIdentity = undefined; subscribedCoordinator = undefined;
  deckyRaPresence.dispose();
}

/** Called from the existing Steam lifetime subscription; no second subscription. */
export function notifyDeckyRaPresenceLifecycle(appId: string, running: boolean, mappedGameId?: string, evidence: "unknown" | "emulator" = "unknown"): void {
  if (readDeckyProviderConfigs().retroAchievements?.hasApiKey !== true) return;
  deckyRaPresence.lifecycle(appId, running, mappedGameId, evidence);
}

export function corroborateDeckyRaPresenceLaunch(appId: string, gameId: string): void {
  if (readDeckyProviderConfigs().retroAchievements?.hasApiKey === true) deckyRaPresence.corroborateLaunch(appId, gameId);
}
