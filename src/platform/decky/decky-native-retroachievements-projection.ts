import type { ResourceState } from "@core/cache";
import type { GameCommunityStats, GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";
import { getDeckyRetroAchievementsGameResourceRevision, isDeckyRetroAchievementsGameResourceFresh } from "./providers/retroachievements/backend-transport";
import {
  invalidateDeckyGamePageAchievementSummaryCache,
  loadDeckyGamePageAchievementSummary,
  type GamePageAchievementSummary,
} from "./decky-game-page-achievement-summary";
import { projectRetroAchievementsFullScreenAchievements } from "./decky-retroachievements-full-screen-achievement-data";
import { getRetroAchievementsAvailabilityDate } from "./decky-native-retroachievements-community-model";
import {
  loadDeckySteamShortcutMetadata,
  type DeckySteamShortcutMetadata,
} from "./decky-steam-shortcut-metadata";

export interface NativeRetroAchievementsProjection {
  readonly status: "ready";
  readonly appId: string;
  readonly raGameId: string;
  readonly title: string;
  readonly boxArtImageUrl?: string;
  readonly platformLabel?: string;
  readonly releaseDate?: string;
  readonly releaseDateGranularity?: GameDetailSnapshot["game"]["releaseDateGranularity"];
  readonly developer?: string;
  readonly publisher?: string;
  readonly genre?: string;
  readonly mode: RetroAchievementsAchievementMode;
  readonly achievements: readonly NormalizedAchievement[];
  /** Cached provider detail for native game-page recommendations. */
  readonly detailSnapshot?: GameDetailSnapshot;
  readonly earned: number;
  readonly total: number;
  readonly totalPlayers?: number;
  readonly communityStats?: GameCommunityStats;
  readonly achievementsAvailableSince?: string;
  readonly refreshedAt?: number;
  readonly sourceRevision?: string | undefined;
  readonly shortcutIdentity?: string;
}

export type NativeRetroAchievementsProjectionResult =
  | NativeRetroAchievementsProjection
  | {
      readonly status: "unavailable";
      readonly appId: string;
      readonly reason:
        | "not-shortcut"
        | "shortcut-metadata-error"
        | "unmapped"
        | "resolution-error"
        | "detail-unavailable"
        | "detail-error"
        | "invalid-detail"
        | "stale-request"
        | "disposed";
    };

export interface NativeRetroAchievementsProjectionDependencies {
  readonly loadShortcutMetadata: (appId: string) => Promise<DeckySteamShortcutMetadata | undefined>;
  readonly loadSummary: (
    appId: string,
    options?: { readonly freshRetroAchievements?: boolean },
  ) => Promise<GamePageAchievementSummary>;
  readonly loadDetail: (
    raGameId: string,
    options: { readonly forceRefresh: boolean },
  ) => Promise<ResourceState<GameDetailSnapshot>>;
  readonly invalidateSummary: (appId: string, options?: { readonly preserveVisible?: boolean }) => void;
  readonly detailRevision?: (raGameId: string) => string | undefined;
  readonly isDetailFresh?: (raGameId: string) => boolean;
}

export interface NativeRetroAchievementsProjectionLoader {
  load(
    appId: string,
    mode: RetroAchievementsAchievementMode,
    options?: { readonly forceRefresh?: boolean; readonly revalidateOnEntry?: boolean },
  ): Promise<NativeRetroAchievementsProjectionResult>;
  read(appId: string, mode: RetroAchievementsAchievementMode): NativeRetroAchievementsProjection | undefined;
  invalidate(appId?: string, options?: { readonly refreshIncompleteOnly?: boolean }): void;
  dispose(): void;
}

function unavailable(
  appId: string,
  reason: Extract<NativeRetroAchievementsProjectionResult, { status: "unavailable" }>["reason"],
): NativeRetroAchievementsProjectionResult {
  return { status: "unavailable", appId, reason };
}

export function shortcutIdentity(metadata: DeckySteamShortcutMetadata): string {
  return JSON.stringify([
    metadata.appId,
    metadata.platformTag,
    metadata.platformLabel,
    metadata.tags,
    metadata.exe,
    metadata.startDir,
    metadata.launchOptions ?? "",
  ]);
}

function hasVerifiedMastery(detail: GameDetailSnapshot | undefined): boolean {
  if (detail?.game.status !== "mastered") return false;
  const award = detail.game.metrics.find((metric) => metric.key === "highest-award-kind")?.value;
  return award?.trim().toLowerCase().includes("mastered") === true;
}

function projectDetail(
  appId: string,
  raGameId: string,
  mode: RetroAchievementsAchievementMode,
  detail: GameDetailSnapshot,
): NativeRetroAchievementsProjectionResult {
  if (detail.game.providerId !== RETROACHIEVEMENTS_PROVIDER_ID || detail.game.gameId !== raGameId) {
    return unavailable(appId, "invalid-detail");
  }

  const achievements = projectRetroAchievementsFullScreenAchievements(detail, mode);
  if (achievements.length === 0) {
    return unavailable(appId, "invalid-detail");
  }

  const ids = new Set<string>();
  for (const achievement of achievements) {
    const id = achievement.achievementId.trim();
    if (
      id.length === 0 ||
      ids.has(id) ||
      achievement.providerId !== RETROACHIEVEMENTS_PROVIDER_ID ||
      achievement.gameId !== raGameId
    ) {
      return unavailable(appId, "invalid-detail");
    }
    ids.add(id);
  }

  const totalPlayersValue = detail.game.metrics.find((metric) => metric.key === "total-players")?.value;
  const parsedTotalPlayers = totalPlayersValue === undefined ? NaN : Number(totalPlayersValue);
  const totalPlayers = Number.isSafeInteger(parsedTotalPlayers) && parsedTotalPlayers > 0
    ? parsedTotalPlayers
    : undefined;
  const achievementsAvailableSince = getRetroAchievementsAvailabilityDate(detail.achievements);
  const metric = (key: string): string | undefined => {
    const value = detail.game.metrics.find((item) => item.key === key)?.value.trim();
    return value || undefined;
  };
  const releaseDate = metric("released");
  const developer = metric("developer");
  const publisher = metric("publisher");
  const genre = metric("genre");

  return {
    status: "ready",
    appId,
    raGameId,
    title: detail.game.title,
    ...(detail.game.boxArtImageUrl ? { boxArtImageUrl: detail.game.boxArtImageUrl } : {}),
    ...(detail.game.platformLabel ? { platformLabel: detail.game.platformLabel } : {}),
    ...(releaseDate ? { releaseDate } : {}),
    ...(detail.game.releaseDateGranularity ? { releaseDateGranularity: detail.game.releaseDateGranularity } : {}),
    ...(developer ? { developer } : {}),
    ...(publisher ? { publisher } : {}),
    ...(genre ? { genre } : {}),
    mode,
    achievements,
    detailSnapshot: { ...detail, achievements },
    earned: achievements.filter((achievement) => achievement.isUnlocked).length,
    total: achievements.length,
    ...(totalPlayers !== undefined ? { totalPlayers } : {}),
    ...(detail.game.communityStats !== undefined ? { communityStats: detail.game.communityStats } : {}),
    ...(achievementsAvailableSince !== undefined ? { achievementsAvailableSince } : {}),
    ...(detail.refreshedAt !== undefined ? { refreshedAt: detail.refreshedAt } : {}),
  };
}

/** Resolves one visible shortcut through the existing game-page mapping pipeline. */
export function createNativeRetroAchievementsProjectionLoader(
  dependencies: NativeRetroAchievementsProjectionDependencies,
): NativeRetroAchievementsProjectionLoader {
  const generations = new Map<string, number>();
  const modes = new Map<string, RetroAchievementsAchievementMode>();
  const identities = new Map<string, string>();
  const committed = new Map<string, NativeRetroAchievementsProjection>();
  const inFlight = new Map<string, Promise<NativeRetroAchievementsProjectionResult>>();
  const needsFreshDetail = new Set<string>();
  let disposed = false;

  function generation(appId: string): number {
    return generations.get(appId) ?? 0;
  }

  function invalidateOne(
    appId: string,
    invalidateMapping: boolean,
    preserveVisible = false,
    forceNextDetail = true,
  ): void {
    generations.set(appId, generation(appId) + 1);
    committed.delete(appId);
    inFlight.delete(appId);
    if (invalidateMapping) {
      if (forceNextDetail) needsFreshDetail.add(appId);
      else needsFreshDetail.delete(appId);
      dependencies.invalidateSummary(appId, preserveVisible ? { preserveVisible: true } : undefined);
    }
  }

  function isCurrent(appId: string, mode: RetroAchievementsAchievementMode, requestGeneration: number): boolean {
    return !disposed && generation(appId) === requestGeneration && modes.get(appId) === mode;
  }

  async function load(
    appId: string,
    mode: RetroAchievementsAchievementMode,
    options?: { readonly forceRefresh?: boolean; readonly revalidateOnEntry?: boolean },
  ): Promise<NativeRetroAchievementsProjectionResult> {
    if (disposed) {
      return unavailable(appId, "disposed");
    }

    if (modes.has(appId) && modes.get(appId) !== mode) {
      invalidateOne(appId, false);
    }
    modes.set(appId, mode);
    if (options?.forceRefresh === true) {
      invalidateOne(appId, true, true);
    }

    const existing = inFlight.get(appId);
    if (existing !== undefined) {
      return existing;
    }

    let requestGeneration = generation(appId);
    const request = (async (): Promise<NativeRetroAchievementsProjectionResult> => {
      let metadata: DeckySteamShortcutMetadata | undefined;
      try {
        metadata = await dependencies.loadShortcutMetadata(appId);
      } catch {
        invalidateOne(appId, false);
        return unavailable(appId, "shortcut-metadata-error");
      }
      if (!isCurrent(appId, mode, requestGeneration)) {
        return unavailable(appId, "stale-request");
      }
      if (metadata === undefined || metadata.appId !== appId) {
        invalidateOne(appId, true);
        identities.delete(appId);
        return unavailable(appId, "not-shortcut");
      }

      const identity = shortcutIdentity(metadata);
      let revalidateSummary = !identities.has(appId) || options?.forceRefresh === true ||
        options?.revalidateOnEntry === true;
      if (identities.has(appId) && identities.get(appId) !== identity) {
        invalidateOne(appId, true);
        requestGeneration = generation(appId);
        revalidateSummary = true;
      }
      identities.set(appId, identity);

      const cached = committed.get(appId);
      if (cached !== undefined && cached.mode === mode) {
        if (options?.forceRefresh !== true && cached.sourceRevision === dependencies.detailRevision?.(cached.raGameId) &&
            (dependencies.isDetailFresh?.(cached.raGameId) ?? (options?.revalidateOnEntry !== true))) {
          return cached;
        }
      }

      let summary: GamePageAchievementSummary;
      try {
        summary = await dependencies.loadSummary(
          appId,
          revalidateSummary ? { freshRetroAchievements: true } : undefined,
        );
      } catch {
        return unavailable(appId, "resolution-error");
      }
      if (!isCurrent(appId, mode, requestGeneration)) {
        return unavailable(appId, "stale-request");
      }
      if (
        summary.status !== "ready" ||
        summary.provider !== "retroachievements" ||
        summary.appId !== appId ||
        summary.gameId === undefined ||
        summary.gameId.trim().length === 0
      ) {
        return unavailable(appId, "unmapped");
      }

      let detailState: ResourceState<GameDetailSnapshot>;
      try {
        detailState = await dependencies.loadDetail(summary.gameId, {
          forceRefresh: options?.forceRefresh === true,
        });
      } catch {
        return unavailable(appId, "detail-error");
      }
      if (!isCurrent(appId, mode, requestGeneration)) {
        return unavailable(appId, "stale-request");
      }
      if ((detailState.status !== "success" && detailState.status !== "stale") || detailState.data === undefined) {
        return unavailable(appId, "detail-unavailable");
      }

      const projected = projectDetail(appId, summary.gameId, mode, detailState.data);
      const result = projected.status === "ready" ? { ...projected, shortcutIdentity: identity, sourceRevision: detailState.data.canonicalSourceRevision ?? dependencies.detailRevision?.(summary.gameId) } : projected;
      if (result.status !== "ready") {
        return result;
      }

      // A shortcut can be edited while its RA detail is loading. Recheck before publication.
      let currentMetadata: DeckySteamShortcutMetadata | undefined;
      try {
        currentMetadata = await dependencies.loadShortcutMetadata(appId);
      } catch {
        return unavailable(appId, "shortcut-metadata-error");
      }
      if (!isCurrent(appId, mode, requestGeneration)) {
        return unavailable(appId, "stale-request");
      }
      if (currentMetadata === undefined || currentMetadata.appId !== appId || shortcutIdentity(currentMetadata) !== identity) {
        invalidateOne(appId, true);
        identities.delete(appId);
        return unavailable(appId, "stale-request");
      }

      committed.set(appId, result);
      needsFreshDetail.delete(appId);
      if (options?.forceRefresh === true) {
        // Badge resolution may have read the previous detail while this request was loading.
        dependencies.invalidateSummary(appId, { preserveVisible: true });
      }
      return result;
    })();

    inFlight.set(appId, request);
    try {
      return await request;
    } finally {
      if (inFlight.get(appId) === request) {
        inFlight.delete(appId);
      }
    }
  }

  function read(appId: string, mode: RetroAchievementsAchievementMode): NativeRetroAchievementsProjection | undefined {
    const value = committed.get(appId);
    return !disposed && value?.mode === mode ? value : undefined;
  }

  function invalidate(appId?: string, options?: { readonly refreshIncompleteOnly?: boolean }): void {
    if (appId !== undefined) {
      const current = committed.get(appId);
      const forceNextDetail = options?.refreshIncompleteOnly !== true ||
        !hasVerifiedMastery(current?.detailSnapshot);
      invalidateOne(appId, true, false, forceNextDetail);
      return;
    }
    const appIds = new Set([...generations.keys(), ...modes.keys(), ...identities.keys(), ...committed.keys(), ...inFlight.keys()]);
    for (const knownAppId of appIds) {
      invalidateOne(knownAppId, true);
    }
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    invalidate();
    disposed = true;
    modes.clear();
    identities.clear();
    needsFreshDetail.clear();
  }

  return { load, read, invalidate, dispose };
}

const deckyDependencies: NativeRetroAchievementsProjectionDependencies = {
  detailRevision: getDeckyRetroAchievementsGameResourceRevision,
  isDetailFresh(raGameId) {
    return isDeckyRetroAchievementsGameResourceFresh(raGameId);
  },
  loadShortcutMetadata: loadDeckySteamShortcutMetadata,
  loadSummary: loadDeckyGamePageAchievementSummary,
  async loadDetail(raGameId, options) {
    const { loadDeckyGameDetailState } = await import("./decky-app-services");
    return loadDeckyGameDetailState(RETROACHIEVEMENTS_PROVIDER_ID, raGameId, options);
  },
  invalidateSummary: invalidateDeckyGamePageAchievementSummaryCache,
};

let deckyNativeRetroAchievementsProjectionLoader = createNativeRetroAchievementsProjectionLoader(deckyDependencies);

export function loadDeckyNativeRetroAchievementsProjection(
  appId: string,
  mode: RetroAchievementsAchievementMode,
  options?: { readonly forceRefresh?: boolean; readonly revalidateOnEntry?: boolean },
): Promise<NativeRetroAchievementsProjectionResult> {
  return deckyNativeRetroAchievementsProjectionLoader.load(appId, mode, options);
}

export function readDeckyNativeRetroAchievementsProjection(
  appId: string,
  mode: RetroAchievementsAchievementMode,
): NativeRetroAchievementsProjection | undefined {
  return deckyNativeRetroAchievementsProjectionLoader.read(appId, mode);
}

export function invalidateDeckyNativeRetroAchievementsProjection(
  appId?: string,
  options?: { readonly refreshIncompleteOnly?: boolean },
): void {
  deckyNativeRetroAchievementsProjectionLoader.invalidate(appId, options);
}

export function disposeDeckyNativeRetroAchievementsProjection(): void {
  deckyNativeRetroAchievementsProjectionLoader.dispose();
  deckyNativeRetroAchievementsProjectionLoader = createNativeRetroAchievementsProjectionLoader(deckyDependencies);
}

/** A presentation alone cannot authorize a new process session. No provider request. */
export async function verifyNativeProjectionLaunch(projection: NativeRetroAchievementsProjection | undefined): Promise<string | undefined> {
  if (projection?.shortcutIdentity === undefined) return undefined;
  const metadata = await loadDeckySteamShortcutMetadata(projection.appId);
  return metadata?.exe && shortcutIdentity(metadata) === projection.shortcutIdentity ? projection.raGameId : undefined;
}
