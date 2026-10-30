import { useEffect, useMemo, useReducer, useState } from "react";
import { Focusable } from "@decky/ui";
import type { GameDetailSnapshot } from "@core/domain";
import { loadDeckyRetroAchievementsCommunityDetail } from "./decky-app-services";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { DeckyFullScreenLoadingState } from "./decky-full-screen-loading-state";
import { DeckyRetroAchievementsGameCommunitySection } from "./decky-retroachievements-game-community-section";
import { DeckyNativeRetroAchievementsCommunity, type NativeSteamCommunitySectionPrimitives } from "./decky-native-retroachievements-community";
import { buildNativeRetroAchievementsCommunityModels } from "./decky-native-retroachievements-community-model";
import { DeckyFullscreenActionButton } from "./decky-full-screen-action-controls";
import { getDeckyRetroAchievementsDataCoordinator } from "./providers/retroachievements/backend-transport";
import { raCommunityRequests, readRaCommunityPresentation } from "./retroachievements-community-state";

export function DeckyRetroAchievementsCommunityResource({ snapshot, primitives, achievementsAvailableSince, sectionOwnsFocus = false }: {
  readonly snapshot: GameDetailSnapshot;
  readonly sectionOwnsFocus?: boolean;
  readonly primitives?: NativeSteamCommunitySectionPrimitives;
  readonly achievementsAvailableSince?: string;
}): JSX.Element {
  const [attempt, setAttempt] = useState(0);
  const [, changed] = useReducer((value: number) => value + 1, 0);
  const resources = getDeckyRetroAchievementsDataCoordinator();
  useEffect(() => {
    const stops = raCommunityRequests(snapshot.game.gameId).map((request) => resources.subscribeResource(request, changed));
    return () => { for (const stop of stops) stop(); };
  }, [resources, snapshot.game.gameId]);
  const loader = useMemo(() => () => loadDeckyRetroAchievementsCommunityDetail(snapshot), [snapshot, attempt]);
  const state = useAsyncResourceState(loader, { status: "loading", isStale: false, isRefreshing: false });
  const shared = readRaCommunityPresentation(resources, snapshot, state.data?.game.communityStats ?? snapshot.game.communityStats);
  const loading = shared.pending || state.status === "idle" || state.status === "loading";
  const stats = loading && !shared.fresh && state.data === undefined ? undefined : shared.stats;
  const warning = !loading && (shared.degraded || (state.error !== undefined && !shared.fresh))
    ? "Some Community data could not be refreshed. Showing available cached statistics." : undefined;
  if (primitives !== undefined) {
    const models = buildNativeRetroAchievementsCommunityModels({ stats,
      ...(achievementsAvailableSince !== undefined ? { achievementsAvailableSince } : {}),
    });
    if (models !== undefined) return <>{warning !== undefined ? <Focusable role="status">{warning}</Focusable> : null}<DeckyNativeRetroAchievementsCommunity models={models} primitives={primitives} /></>;
    const { Section, Body } = primitives;
    return <Section label="RetroAchievements" availableOffline showRule><Body>
      <Focusable role="status">{loading ? "Loading community data…" : state.error?.userMessage ?? "Community statistics are unavailable for this game."}</Focusable>
      {!loading ? <Focusable role="button" onActivate={() => setAttempt((value) => value + 1)}>Retry community data</Focusable> : null}
    </Body></Section>;
  }
  if (stats !== undefined) return <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 42px) 12px 0", boxSizing: "border-box" }}>{warning !== undefined ? <div role="status">{warning}</div> : null}<DeckyRetroAchievementsGameCommunitySection stats={stats} snapshot={snapshot} focusable={!sectionOwnsFocus} /></div>;
  return <div data-ra-community-loading-viewport style={{ flex: "1 1 auto", minHeight: 0, width: "100%", display: "flex", flexDirection: "column" }}><DeckyFullScreenLoadingState providerId="retroachievements" isError={!loading}
    title={loading ? "Loading community data" : "Community data unavailable"}
    description={loading ? "Preparing this game's community statistics." : state.error?.userMessage ?? "No community statistics are available for this game."} />
    {!loading ? <DeckyFullscreenActionButton label="Retry community data" onClick={() => setAttempt((value) => value + 1)} /> : null}
  </div>;
}
