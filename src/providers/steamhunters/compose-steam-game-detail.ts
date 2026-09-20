import type { GameDetailSnapshot } from "@core/domain";
import { matchSteamAchievements } from "./achievement-match";
import type { SteamHuntersService } from "./service";
import type {
  SteamHuntersAchievement,
  SteamHuntersAchievementGroup,
  SteamHuntersApp,
  SteamHuntersGameData,
} from "./types";

export interface SteamHuntersGameEnrichment {
  readonly source: "steamhunters";
  readonly app: SteamHuntersApp;
  /** Only exact stable-ID matches are represented here. */
  readonly achievementsBySteamAchievementId: Readonly<Record<string, SteamHuntersAchievement>>;
  readonly achievementGroupsBySteamAchievementId: Readonly<Record<string, SteamHuntersAchievementGroup>>;
}

export type SteamHuntersEnrichedGameDetailSnapshot = GameDetailSnapshot & {
  readonly steamHunters?: SteamHuntersGameEnrichment;
};

export const DEFAULT_STEAM_HUNTERS_ENRICHMENT_WAIT_MS = 750;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveSteamAppId(snapshot: GameDetailSnapshot): number | undefined {
  const candidate = snapshot.game.appid ?? Number(snapshot.game.gameId);
  return Number.isSafeInteger(candidate) && candidate > 0 ? candidate : undefined;
}

function buildAchievementEnrichment(
  snapshot: GameDetailSnapshot,
  gameData: SteamHuntersGameData,
): Readonly<Record<string, SteamHuntersAchievement>> {
  const entries = matchSteamAchievements(snapshot.achievements, gameData.achievements).map((match) => [
    match.steamAchievementId,
    match.steamHuntersAchievement,
  ] as const);
  return Object.fromEntries(entries);
}

function buildAchievementGroupEnrichment(
  groups: readonly SteamHuntersAchievementGroup[],
): Readonly<Record<string, SteamHuntersAchievementGroup>> {
  const groupsByAchievementId = new Map<string, SteamHuntersAchievementGroup>();
  for (const group of groups) {
    for (const achievementApiName of group.achievementApiNames) {
      if (!groupsByAchievementId.has(achievementApiName)) {
        groupsByAchievementId.set(achievementApiName, group);
      }
    }
  }
  return Object.fromEntries(groupsByAchievementId.entries());
}

export function composeSteamGameDetailWithSteamHunters(
  snapshot: GameDetailSnapshot,
  gameData: SteamHuntersGameData | undefined,
): SteamHuntersEnrichedGameDetailSnapshot {
  if (snapshot.game.providerId !== "steam" || gameData === undefined) {
    return snapshot;
  }

  const appId = resolveSteamAppId(snapshot);
  if (appId === undefined || gameData.app.appId !== appId) {
    return snapshot;
  }

  return {
    ...snapshot,
    steamHunters: {
      source: "steamhunters",
      app: gameData.app,
      achievementsBySteamAchievementId: buildAchievementEnrichment(snapshot, gameData),
      achievementGroupsBySteamAchievementId: buildAchievementGroupEnrichment(gameData.groups),
    },
  };
}

/**
 * SteamHunters may continue filling its cache after this budget expires. The
 * Steam snapshot is returned immediately so optional enrichment never blocks it.
 */
export async function composeSteamGameDetailWithSteamHuntersWithinBudget(args: {
  readonly snapshot: GameDetailSnapshot;
  readonly service: SteamHuntersService;
  readonly waitMs?: number;
}): Promise<SteamHuntersEnrichedGameDetailSnapshot> {
  const appId = resolveSteamAppId(args.snapshot);
  if (args.snapshot.game.providerId !== "steam" || appId === undefined) {
    return args.snapshot;
  }

  const load = args.service.loadGameData(appId).catch(() => undefined);
  const waitMs = args.waitMs ?? DEFAULT_STEAM_HUNTERS_ENRICHMENT_WAIT_MS;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const unavailableWithinBudget = new Promise<undefined>((resolve) => {
    timeout = setTimeout(resolve, waitMs);
  });
  try {
    const gameData = await Promise.race([load, unavailableWithinBudget]);
    return composeSteamGameDetailWithSteamHunters(args.snapshot, gameData);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

export function getSteamHuntersGameEnrichment(
  snapshot: GameDetailSnapshot,
): SteamHuntersGameEnrichment | undefined {
  const candidate = (snapshot as SteamHuntersEnrichedGameDetailSnapshot).steamHunters;
  return candidate !== undefined && isRecord(candidate) && candidate.source === "steamhunters"
    ? candidate as SteamHuntersGameEnrichment
    : undefined;
}

export function getSteamHuntersAchievementEnrichment(
  snapshot: GameDetailSnapshot,
  steamAchievementId: string,
): SteamHuntersAchievement | undefined {
  return getSteamHuntersGameEnrichment(snapshot)?.achievementsBySteamAchievementId[steamAchievementId];
}
