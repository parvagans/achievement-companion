import { useEffect, useMemo, useRef, useState } from "react";
import type { NormalizedGame, RecentlyPlayedGame } from "@core/domain";
import { readDeckyDashboardSnapshotCacheEntry } from "./decky-dashboard-snapshot-cache";
import { loadDeckyGameDetailState } from "./decky-app-services";
import { STEAM_PROVIDER_ID } from "./providers";
import {
  readDeckyProviderConfig as readDeckySteamProviderConfig,
  readDeckySteamLibraryAchievementScanSummary,
} from "./providers/steam/config";
import { findSteamLibraryScanGameSummaryByAppId } from "./providers/steam/game-detail";
import {
  markAchievementCompanionGamePageAchievementSummaryFetchCompleted,
  markAchievementCompanionGamePageAchievementSummaryFetchStarted,
  reportAchievementCompanionGamePageAchievementSummaryError,
} from "./decky-runtime-debug";

const GAME_PAGE_ACHIEVEMENT_SUMMARY_CACHE_TTL_MS = 30 * 1000;

export type GamePageAchievementSummary =
  | {
      readonly status: "ready";
      readonly provider: "steam" | "retroachievements";
      readonly appId: string;
      readonly gameId?: string;
      readonly title?: string;
      readonly earned: number;
      readonly total: number;
      readonly source: "cache" | "backend" | "snapshot";
      readonly updatedAt?: string;
    }
  | {
      readonly status: "loading";
      readonly appId: string;
    }
  | {
      readonly status: "unavailable";
      readonly appId: string;
      readonly reason: string;
    }
  | {
      readonly status: "error";
      readonly appId: string;
      readonly message: string;
    };

interface CachedGamePageAchievementSummaryEntry {
  readonly storedAt: number;
  readonly summary: GamePageAchievementSummary;
}

const gamePageAchievementSummaryCache = new Map<string, CachedGamePageAchievementSummaryEntry>();
const gamePageAchievementSummaryInFlight = new Map<string, Promise<GamePageAchievementSummary>>();

function parsePositiveAppId(value: string | undefined): number | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
}

function createReadySummary(args: {
  readonly appId: string;
  readonly gameId?: string;
  readonly title?: string;
  readonly earned: number;
  readonly total: number;
  readonly source: "cache" | "backend" | "snapshot";
  readonly updatedAt?: string;
}): GamePageAchievementSummary {
  return {
    status: "ready",
    provider: "steam",
    appId: args.appId,
    ...(args.gameId !== undefined ? { gameId: args.gameId } : {}),
    ...(args.title !== undefined ? { title: args.title } : {}),
    earned: args.earned,
    total: args.total,
    source: args.source,
    ...(args.updatedAt !== undefined ? { updatedAt: args.updatedAt } : {}),
  };
}

function resolveSummaryFromSteamScanCache(appId: string): GamePageAchievementSummary | undefined {
  const parsedAppId = parsePositiveAppId(appId);
  if (parsedAppId === undefined) {
    return undefined;
  }

  const summary = readDeckySteamLibraryAchievementScanSummary(STEAM_PROVIDER_ID);
  const cachedGame = findSteamLibraryScanGameSummaryByAppId(summary, parsedAppId);
  if (cachedGame === undefined) {
    return undefined;
  }

  if (cachedGame.totalAchievements <= 0) {
    return {
      status: "unavailable",
      appId,
      reason: "steam-no-achievement-summary",
    };
  }

    return createReadySummary({
      appId,
      gameId: cachedGame.gameId,
      title: cachedGame.title,
      earned: cachedGame.unlockedAchievements,
      total: cachedGame.totalAchievements,
      source: "cache",
      ...(summary?.scannedAt !== undefined ? { updatedAt: summary.scannedAt } : {}),
    });
}

function matchesSteamAppId(
  game: Pick<NormalizedGame, "appid" | "gameId"> | Pick<RecentlyPlayedGame, "appid" | "gameId">,
  appId: string,
): boolean {
  if (game.appid !== undefined && String(game.appid) === appId) {
    return true;
  }

  return game.gameId === appId;
}

function resolveSummaryFromSteamDashboardSnapshot(appId: string): GamePageAchievementSummary | undefined {
  const snapshotEntry = readDeckyDashboardSnapshotCacheEntry(STEAM_PROVIDER_ID);
  const snapshot = snapshotEntry?.snapshot;
  if (snapshot === undefined) {
    return undefined;
  }

  const matchingRecentlyPlayed = snapshot.recentlyPlayedGames.find((game) => matchesSteamAppId(game, appId));
  if (
    matchingRecentlyPlayed?.summary.totalCount !== undefined &&
    matchingRecentlyPlayed.summary.totalCount > 0
  ) {
    return createReadySummary({
      appId,
      gameId: matchingRecentlyPlayed.gameId,
      title: matchingRecentlyPlayed.title,
      earned: matchingRecentlyPlayed.summary.unlockedCount,
      total: matchingRecentlyPlayed.summary.totalCount,
      source: "snapshot",
      ...(snapshotEntry?.storedAt !== undefined
        ? { updatedAt: new Date(snapshotEntry.storedAt).toISOString() }
        : {}),
    });
  }

  const matchingFeaturedGame = snapshot.featuredGames.find((game) => matchesSteamAppId(game, appId));
  if (matchingFeaturedGame?.summary.totalCount !== undefined && matchingFeaturedGame.summary.totalCount > 0) {
    return createReadySummary({
      appId,
      gameId: matchingFeaturedGame.gameId,
      title: matchingFeaturedGame.title,
      earned: matchingFeaturedGame.summary.unlockedCount,
      total: matchingFeaturedGame.summary.totalCount,
      source: "snapshot",
      ...(snapshotEntry?.storedAt !== undefined
        ? { updatedAt: new Date(snapshotEntry.storedAt).toISOString() }
        : {}),
    });
  }

  return undefined;
}

async function resolveSummaryFromSteamGameDetail(appId: string): Promise<GamePageAchievementSummary | undefined> {
  const steamConfig = readDeckySteamProviderConfig(STEAM_PROVIDER_ID);
  if (steamConfig === undefined) {
    return {
      status: "unavailable",
      appId,
      reason: "steam-provider-not-configured",
    };
  }

  const gameDetailState = await loadDeckyGameDetailState(STEAM_PROVIDER_ID, appId, {
    forceRefresh: false,
  });
  const game = gameDetailState.data?.game;
  const total = game?.summary.totalCount;

  if (gameDetailState.status !== "success" || game === undefined || total === undefined || total <= 0) {
    return undefined;
  }

  return createReadySummary({
    appId,
    gameId: game.gameId,
    title: game.title,
    earned: game.summary.unlockedCount,
    total,
    source: "backend",
    ...(gameDetailState.lastUpdatedAt !== undefined
      ? { updatedAt: new Date(gameDetailState.lastUpdatedAt).toISOString() }
      : {}),
  });
}

export function formatDeckyGamePageAchievementBadgeLabel(
  summary: GamePageAchievementSummary | undefined,
): string | undefined {
  if (summary === undefined) {
    return undefined;
  }

  if (summary.status === "loading") {
    return "🏆 …";
  }

  if (summary.status !== "ready") {
    return undefined;
  }

  return `🏆 ${String(summary.earned)} / ${String(summary.total)}`;
}

export async function loadDeckyGamePageAchievementSummary(
  appId: string,
): Promise<GamePageAchievementSummary> {
  const cachedEntry = gamePageAchievementSummaryCache.get(appId);
  if (
    cachedEntry !== undefined &&
    Date.now() - cachedEntry.storedAt <= GAME_PAGE_ACHIEVEMENT_SUMMARY_CACHE_TTL_MS
  ) {
    return cachedEntry.summary;
  }

  const inFlight = gamePageAchievementSummaryInFlight.get(appId);
  if (inFlight !== undefined) {
    return inFlight;
  }

  const loadPromise: Promise<GamePageAchievementSummary> = (async () => {
    const steamCacheSummary = resolveSummaryFromSteamScanCache(appId);
    if (steamCacheSummary?.status === "ready") {
      return steamCacheSummary;
    }

    const steamSnapshotSummary = resolveSummaryFromSteamDashboardSnapshot(appId);
    if (steamSnapshotSummary?.status === "ready") {
      return steamSnapshotSummary;
    }

    const steamDetailSummary = await resolveSummaryFromSteamGameDetail(appId);
    if (steamDetailSummary?.status === "ready") {
      return steamDetailSummary;
    }

    if (steamCacheSummary?.status === "unavailable") {
      return steamCacheSummary;
    }

    if (steamSnapshotSummary?.status === "unavailable") {
      return steamSnapshotSummary;
    }

    if (steamDetailSummary?.status === "unavailable") {
      return steamDetailSummary;
    }

    const unavailableSummary: GamePageAchievementSummary = {
      status: "unavailable",
      appId,
      reason: "no-retroachievements-shortcut-mapping",
    };
    return unavailableSummary;
  })();

  gamePageAchievementSummaryInFlight.set(appId, loadPromise);

  try {
    const summary = await loadPromise;
    gamePageAchievementSummaryCache.set(appId, {
      storedAt: Date.now(),
      summary,
    });
    return summary;
  } finally {
    if (gamePageAchievementSummaryInFlight.get(appId) === loadPromise) {
      gamePageAchievementSummaryInFlight.delete(appId);
    }
  }
}

export function useGamePageAchievementSummary(
  appId: string | undefined,
): GamePageAchievementSummary | undefined {
  const [summary, setSummary] = useState<GamePageAchievementSummary | undefined>(undefined);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    if (appId === undefined) {
      setSummary(undefined);
      return;
    }

    requestSequenceRef.current += 1;
    const requestSequence = requestSequenceRef.current;
    const loadingSummary: GamePageAchievementSummary = {
      status: "loading",
      appId,
    };
    setSummary(loadingSummary);
    markAchievementCompanionGamePageAchievementSummaryFetchStarted(appId);

    void loadDeckyGamePageAchievementSummary(appId)
      .then((nextSummary) => {
        if (requestSequenceRef.current !== requestSequence) {
          return;
        }

        setSummary(nextSummary);
        markAchievementCompanionGamePageAchievementSummaryFetchCompleted(nextSummary);
      })
      .catch((error: unknown) => {
        if (requestSequenceRef.current !== requestSequence) {
          return;
        }

        const message = reportAchievementCompanionGamePageAchievementSummaryError(
          appId,
          error,
          "game-page-achievement-summary",
        );
        const errorSummary: GamePageAchievementSummary = {
          status: "error",
          appId,
          message,
        };
        setSummary(errorSummary);
        markAchievementCompanionGamePageAchievementSummaryFetchCompleted(errorSummary);
      });
  }, [appId]);

  return useMemo(() => summary, [summary]);
}
