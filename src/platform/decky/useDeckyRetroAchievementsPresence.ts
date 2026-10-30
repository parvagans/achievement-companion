import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { DashboardSnapshot } from "@core/domain";
import type { ResourceState } from "@core/cache";
import { deckyRaPresence } from "./decky-retroachievements-presence";
import { getRetroAchievementsActiveGameId, findRetroAchievementsActiveGame } from "./decky-retroachievements-current-game";
import { getDeckyAccountRevision } from "./decky-account-revision";

/** Only the activity pair/current-game presentation is live. Counts, collections,
 * focus, navigation and the ready dashboard snapshot remain owned by the page. */
export function useDeckyRetroAchievementsPresence(
  state: ResourceState<DashboardSnapshot>, visible: boolean, entry: "qam-entry" | "full-screen-entry",
): ResourceState<DashboardSnapshot> {
  const version = useSyncExternalStore(deckyRaPresence.subscribe, deckyRaPresence.revision, deckyRaPresence.revision);
  const enabled = state.data?.profile.providerId === "retroachievements";
  useEffect(() => {
    if (!enabled || !visible) return;
    let stop: (() => void) | undefined;
    const update = () => {
      stop?.(); stop = undefined;
      if (document.visibilityState !== "hidden") stop = deckyRaPresence.visible(entry);
    };
    update(); document.addEventListener("visibilitychange", update);
    return () => { stop?.(); document.removeEventListener("visibilitychange", update); };
  }, [enabled, visible, entry]);
  const projected = useMemo(() => state.data === undefined || !enabled ? state.data
    : deckyRaPresence.project(state.data), [state.data, enabled, version]);
  const activeGameId = projected === undefined ? undefined : getRetroAchievementsActiveGameId(projected.profile);
  const gameId = projected === undefined ? undefined : activeGameId ?? deckyRaPresence.preferredGameId(projected);
  const known = projected === undefined ? undefined : findRetroAchievementsActiveGame(gameId,
    projected.currentGame === undefined ? [] : [projected.currentGame], projected.recentlyPlayedGames,
    projected.featuredGames, projected.profile.featuredGames);
  useEffect(() => {
    if (known !== undefined) { deckyRaPresence.rememberGame(known); return; }
    if (!enabled || !visible || gameId === undefined || known !== undefined) return;
    let active = true;
    const revision = getDeckyAccountRevision("retroachievements");
    void import("./decky-app-services").then((services) => services.loadDeckyGameDetailState("retroachievements", gameId,
      { forceRefresh: false, entryPoint: "presence-current-game", recommendationOnly: true })).then((result) => {
      if (active && revision === getDeckyAccountRevision("retroachievements") && result.data?.game.gameId === gameId) {
        deckyRaPresence.rememberGame(result.data.game);
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [enabled, visible, gameId, known]);
  return useMemo(() => projected === undefined || !enabled ? state : { ...state, data: {
    ...projected, currentGame: activeGameId === undefined ? undefined : known,
  } }, [state, projected, enabled, known, activeGameId]);
}
