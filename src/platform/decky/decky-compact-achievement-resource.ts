import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot, ProviderId } from "@core/domain";
import type { SteamHuntersGameData } from "../../providers/steamhunters/types";
import { composeSteamGameDetailWithSteamHunters } from "../../providers/steamhunters/compose-steam-game-detail";
import {
  loadDeckyGameDetailState,
  loadDeckySteamHuntersGameData,
} from "./decky-app-services";

export interface CompactAchievementResourceDependencies {
  readonly loadGameDetail: (
    providerId: ProviderId,
    gameId: string,
    options: { readonly forceRefresh: boolean },
  ) => Promise<ResourceState<GameDetailSnapshot>>;
  readonly loadSteamHuntersGameData: (appId: number) => Promise<SteamHuntersGameData | undefined>;
}

const productionDependencies: CompactAchievementResourceDependencies = {
  loadGameDetail: loadDeckyGameDetailState,
  loadSteamHuntersGameData: loadDeckySteamHuntersGameData,
};

function createUnexpectedGameDetailError(
  providerId: ProviderId,
  cause: unknown,
): ResourceState<GameDetailSnapshot> {
  return {
    status: "error",
    error: {
      kind: "unknown",
      userMessage: `${providerId === "steam" ? "Steam" : "Achievement provider"} game data is currently unavailable.`,
      retryable: true,
      cause,
    },
    isStale: false,
    isRefreshing: false,
  };
}

function parseSteamAppId(gameId: string): number | undefined {
  const appId = Number(gameId);
  return Number.isSafeInteger(appId) && appId > 0 ? appId : undefined;
}

async function loadSteamState(
  gameId: string,
  dependencies: CompactAchievementResourceDependencies,
): Promise<ResourceState<GameDetailSnapshot>> {
  const cachedOrLoaded = await dependencies.loadGameDetail("steam", gameId, { forceRefresh: false });
  if (cachedOrLoaded.status !== "stale" || cachedOrLoaded.error !== undefined) {
    return cachedOrLoaded;
  }

  return dependencies.loadGameDetail("steam", gameId, { forceRefresh: true });
}

export async function resolveDeckyCompactAchievementResource(
  providerId: ProviderId,
  gameId: string,
  dependencies: CompactAchievementResourceDependencies = productionDependencies,
): Promise<ResourceState<GameDetailSnapshot>> {
  if (providerId !== "steam") {
    try {
      // Preserve the existing RA compact behavior: entering the game/detail
      // workflow performs its normal provider refresh.
      return await dependencies.loadGameDetail(providerId, gameId, { forceRefresh: true });
    } catch (cause) {
      return createUnexpectedGameDetailError(providerId, cause);
    }
  }

  const appId = parseSteamAppId(gameId);
  const steamPromise = loadSteamState(gameId, dependencies);
  const steamHuntersPromise = appId === undefined
    ? Promise.resolve<SteamHuntersGameData | undefined>(undefined)
    : dependencies.loadSteamHuntersGameData(appId);
  const [steamResult, steamHuntersResult] = await Promise.allSettled([
    steamPromise,
    steamHuntersPromise,
  ] as const);

  if (steamResult.status === "rejected") {
    return createUnexpectedGameDetailError(providerId, steamResult.reason);
  }

  const steamState = steamResult.value;
  if (steamState.data === undefined) {
    return steamState.status === "error"
      ? steamState
      : createUnexpectedGameDetailError(
        providerId,
        new Error(`Steam game detail settled as ${steamState.status} without data.`),
      );
  }

  const steamHuntersData = steamHuntersResult.status === "fulfilled"
    ? steamHuntersResult.value
    : undefined;
  return {
    ...steamState,
    data: composeSteamGameDetailWithSteamHunters(steamState.data, steamHuntersData),
  };
}
