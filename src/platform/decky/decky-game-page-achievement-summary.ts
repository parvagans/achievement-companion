import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CompletionProgressSnapshot,
  DashboardSnapshot,
  NormalizedGame,
  RecentUnlock,
  RecentlyPlayedGame,
} from "@core/domain";
import { readDeckyDashboardSnapshotCacheEntry } from "./decky-dashboard-snapshot-cache";
import { loadDeckySteamShortcutMetadata } from "./decky-steam-shortcut-metadata";
import {
  readDeckyProviderConfig as readDeckySteamProviderConfig,
  readDeckySteamLibraryAchievementScanSummary,
} from "./providers/steam/config";
import { findSteamLibraryScanGameSummaryByAppId } from "./providers/steam/game-detail";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";
import { STEAM_PROVIDER_ID } from "../../providers/steam";
import {
  markAchievementCompanionGamePageAchievementSummaryFetchCompleted,
  markAchievementCompanionGamePageAchievementSummaryFetchStarted,
  markAchievementCompanionRetroAchievementsShortcutResolution,
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

type RetroAchievementsShortcutResolution =
  | {
      readonly status: "mapped";
      readonly appId: string;
      readonly raGameId: string;
      readonly title: string;
      readonly earned: number;
      readonly total: number;
      readonly source:
        | "shortcut-title-match"
        | "completion-progress-title-match"
        | "dashboard-identity-detail";
      readonly confidence: "exact";
      readonly updatedAt?: string;
    }
  | {
      readonly status: "unavailable";
      readonly appId: string;
      readonly reason:
        | "shortcut-metadata-unavailable"
        | "ra-cache-unavailable"
        | "no-retroachievements-shortcut-mapping"
        | "ambiguous-retroachievements-shortcut-mapping"
        | "ra-detail-unavailable";
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

interface RetroAchievementsDashboardCandidate {
  readonly gameId: string;
  readonly title: string;
  readonly earned: number;
  readonly total: number;
  readonly updatedAt?: string;
}

interface RetroAchievementsCompletionProgressCandidate {
  readonly gameId: string;
  readonly title: string;
  readonly platformLabel?: string;
  readonly normalizedPlatformLabel?: string;
  readonly earned: number;
  readonly total: number;
  readonly updatedAt?: string;
}

interface RetroAchievementsDashboardIdentityCandidate {
  readonly gameId: string;
  readonly title: string;
  readonly platformLabel?: string;
  readonly normalizedPlatformLabel?: string;
  readonly updatedAt?: string;
}

const gamePageAchievementSummaryCache = new Map<string, CachedGamePageAchievementSummaryEntry>();
const gamePageAchievementSummaryInFlight = new Map<string, Promise<GamePageAchievementSummary>>();

async function loadDeckyGameDetailStateLazy(
  providerId: string,
  gameId: string,
  options?: {
    readonly forceRefresh?: boolean;
  },
) {
  const { loadDeckyGameDetailState } = await import("./decky-app-services");
  return loadDeckyGameDetailState(providerId, gameId, options);
}

async function loadDeckyCompletionProgressStateLazy(providerId: string) {
  const { loadDeckyCompletionProgressState } = await import("./decky-app-services");
  return loadDeckyCompletionProgressState(providerId);
}

function parsePositiveAppId(value: string | undefined): number | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
}

function createReadySummary(args: {
  readonly provider: "steam" | "retroachievements";
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
    provider: args.provider,
    appId: args.appId,
    ...(args.gameId !== undefined ? { gameId: args.gameId } : {}),
    ...(args.title !== undefined ? { title: args.title } : {}),
    earned: args.earned,
    total: args.total,
    source: args.source,
    ...(args.updatedAt !== undefined ? { updatedAt: args.updatedAt } : {}),
  };
}

function createUnavailableSummary(appId: string, reason: string): GamePageAchievementSummary {
  return {
    status: "unavailable",
    appId,
    reason,
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
    return createUnavailableSummary(appId, "steam-no-achievement-summary");
  }

  return createReadySummary({
    provider: "steam",
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
  if (matchingRecentlyPlayed !== undefined) {
    if (
      matchingRecentlyPlayed.summary.totalCount !== undefined &&
      matchingRecentlyPlayed.summary.totalCount > 0
    ) {
      return createReadySummary({
        provider: "steam",
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

    return createUnavailableSummary(appId, "steam-no-achievement-summary");
  }

  const matchingFeaturedGame = snapshot.featuredGames.find((game) => matchesSteamAppId(game, appId));
  if (matchingFeaturedGame !== undefined) {
    if (matchingFeaturedGame.summary.totalCount !== undefined && matchingFeaturedGame.summary.totalCount > 0) {
      return createReadySummary({
        provider: "steam",
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

    return createUnavailableSummary(appId, "steam-no-achievement-summary");
  }

  return undefined;
}

async function resolveSummaryFromSteamGameDetail(appId: string): Promise<GamePageAchievementSummary | undefined> {
  const steamConfig = readDeckySteamProviderConfig(STEAM_PROVIDER_ID);
  if (steamConfig === undefined) {
    return createUnavailableSummary(appId, "steam-provider-not-configured");
  }

  const gameDetailState = await loadDeckyGameDetailStateLazy(STEAM_PROVIDER_ID, appId, {
    forceRefresh: false,
  });
  const game = gameDetailState.data?.game;

  if (gameDetailState.status !== "success" || game === undefined) {
    return undefined;
  }

  const total = game.summary.totalCount;
  if (total === undefined || total <= 0) {
    return createUnavailableSummary(appId, "steam-no-achievement-summary");
  }

  return createReadySummary({
    provider: "steam",
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

function matchesRetroAchievementsShortcutTitle(
  candidateTitle: string,
  shortcutTitleCandidates: readonly string[],
): boolean {
  return normalizeRetroAchievementsTitleCandidates(candidateTitle).some((candidateTitle) =>
    shortcutTitleCandidates.includes(candidateTitle),
  );
}

function normalizeRetroAchievementsPlatformLabel(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
  if (normalized.length === 0) {
    return undefined;
  }

  switch (normalized) {
    case "sega genesis/mega drive":
    case "genesis":
    case "mega drive":
      return "Genesis/Mega Drive";
    case "sony playstation":
    case "playstation":
      return "PlayStation";
    case "sony playstation 2":
    case "playstation 2":
      return "PlayStation 2";
    case "sony playstation portable":
    case "playstation portable":
      return "PlayStation Portable";
    case "nintendo 64":
      return "Nintendo 64";
    default:
      return value.trim();
  }
}

function stripRetroAchievementsTitleNoise(value: string): string {
  let previous = value.trim();
  let next = previous;

  do {
    previous = next;
    next = previous
      .replace(/\s*[\[(][^\])\]]*[\])]\s*$/gu, "")
      .replace(/\s*[-â€“â€”]\s*$/gu, "")
      .trim();
  } while (next !== previous);

  return next;
}

function normalizeRetroAchievementsTitleText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[â€™']/gu, "")
    .replace(/["â€œâ€]/gu, "")
    .replace(/[:;,.!?]/gu, " ")
    .replace(/\s*[-â€“â€”]\s*/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function normalizeRetroAchievementsTitleCandidates(value: string | undefined): readonly string[] {
  if (typeof value !== "string") {
    return [];
  }

  const candidates = new Set<string>();
  const baseTitle = stripRetroAchievementsTitleNoise(value);
  const relocatedArticleMatch = baseTitle.match(/^(.*),\s*(the|a|an)\s*(.*)$/iu);
  const rawCandidates = [
    baseTitle,
    relocatedArticleMatch !== null
      ? `${relocatedArticleMatch[2]} ${relocatedArticleMatch[1]} ${relocatedArticleMatch[3]}`
      : undefined,
  ];

  for (const candidate of rawCandidates) {
    if (candidate === undefined) {
      continue;
    }

    const normalized = normalizeRetroAchievementsTitleText(candidate);
    if (normalized.length > 0) {
      candidates.add(normalized);
    }
  }

  return Array.from(candidates.values());
}

function collectRetroAchievementsDashboardCandidates(
  snapshot: DashboardSnapshot,
  updatedAt: string | undefined,
): readonly RetroAchievementsDashboardCandidate[] {
  const candidatesByGameId = new Map<string, RetroAchievementsDashboardCandidate>();

  const addCandidate = (
    game:
      | Pick<NormalizedGame, "gameId" | "title" | "summary">
      | Pick<RecentlyPlayedGame, "gameId" | "title" | "summary">,
  ) => {
    const total = game.summary.totalCount;
    if (total === undefined || total <= 0) {
      return;
    }

    if (candidatesByGameId.has(game.gameId)) {
      return;
    }

    candidatesByGameId.set(game.gameId, {
      gameId: game.gameId,
      title: game.title,
      earned: game.summary.unlockedCount,
      total,
      ...(updatedAt !== undefined ? { updatedAt } : {}),
    });
  };

  for (const game of snapshot.recentlyPlayedGames) {
    addCandidate(game);
  }

  for (const game of snapshot.featuredGames) {
    addCandidate(game);
  }

  for (const game of snapshot.profile.featuredGames ?? []) {
    addCandidate(game);
  }

  return Array.from(candidatesByGameId.values());
}

function collectRetroAchievementsCompletionProgressCandidates(
  snapshot: CompletionProgressSnapshot,
): readonly RetroAchievementsCompletionProgressCandidate[] {
  return snapshot.games
    .filter((game) => game.summary.totalCount !== undefined && game.summary.totalCount > 0)
    .map((game) => ({
      gameId: game.gameId,
      title: game.title,
      ...(game.platformLabel !== undefined ? { platformLabel: game.platformLabel } : {}),
      earned: game.summary.unlockedCount,
      total: game.summary.totalCount ?? 0,
      ...(snapshot.refreshedAt !== undefined ? { updatedAt: new Date(snapshot.refreshedAt).toISOString() } : {}),
      ...(normalizeRetroAchievementsPlatformLabel(game.platformLabel) !== undefined
        ? {
            normalizedPlatformLabel: normalizeRetroAchievementsPlatformLabel(game.platformLabel)!,
          }
        : {}),
    }));
}

function collectRetroAchievementsDashboardIdentityCandidates(
  snapshot: DashboardSnapshot,
  updatedAt: string | undefined,
): readonly RetroAchievementsDashboardIdentityCandidate[] {
  const candidatesByGameId = new Map<string, RetroAchievementsDashboardIdentityCandidate>();

  const pushCandidate = (
    game:
      | Pick<NormalizedGame, "gameId" | "title" | "platformLabel">
      | Pick<RecentlyPlayedGame, "gameId" | "title" | "platformLabel">
      | Pick<RecentUnlock["game"], "gameId" | "title" | "platformLabel">,
  ) => {
    if (candidatesByGameId.has(game.gameId)) {
      return;
    }

    candidatesByGameId.set(game.gameId, {
      gameId: game.gameId,
      title: game.title,
      ...(game.platformLabel !== undefined ? { platformLabel: game.platformLabel } : {}),
      ...(normalizeRetroAchievementsPlatformLabel(game.platformLabel) !== undefined
        ? {
            normalizedPlatformLabel: normalizeRetroAchievementsPlatformLabel(game.platformLabel)!,
          }
        : {}),
      ...(updatedAt !== undefined ? { updatedAt } : {}),
    });
  };

  for (const recentUnlock of snapshot.recentAchievements) {
    pushCandidate(recentUnlock.game);
  }

  for (const recentUnlock of snapshot.recentUnlocks) {
    pushCandidate(recentUnlock.game);
  }

  for (const game of snapshot.recentlyPlayedGames) {
    pushCandidate(game);
  }

  for (const game of snapshot.featuredGames) {
    pushCandidate(game);
  }

  for (const game of snapshot.profile.featuredGames ?? []) {
    pushCandidate(game);
  }

  return Array.from(candidatesByGameId.values());
}

function matchesRetroAchievementsShortcutPlatform(
  candidatePlatformLabel: string | undefined,
  shortcutPlatformCandidates: readonly string[],
): boolean {
  if (shortcutPlatformCandidates.length === 0) {
    return true;
  }

  const normalizedCandidatePlatform = normalizeRetroAchievementsPlatformLabel(candidatePlatformLabel);
  return (
    normalizedCandidatePlatform !== undefined &&
    shortcutPlatformCandidates.includes(normalizedCandidatePlatform)
  );
}

function markRetroAchievementsShortcutResolution(
  resolution: RetroAchievementsShortcutResolution,
): void {
  if (resolution.status === "mapped") {
    markAchievementCompanionRetroAchievementsShortcutResolution({
      appId: resolution.appId,
      status: "mapped",
      gameId: resolution.raGameId,
      title: resolution.title,
      earned: resolution.earned,
      total: resolution.total,
      source: resolution.source,
      confidence: resolution.confidence,
    });
    return;
  }

  if (resolution.status === "error") {
    markAchievementCompanionRetroAchievementsShortcutResolution({
      appId: resolution.appId,
      status: "error",
      reason: resolution.message,
      error: resolution.message,
    });
    return;
  }

  markAchievementCompanionRetroAchievementsShortcutResolution({
    appId: resolution.appId,
    status: "unavailable",
    reason: resolution.reason,
  });
}

async function resolveSummaryFromRetroAchievementsShortcut(
  appId: string,
): Promise<RetroAchievementsShortcutResolution> {
  try {
    const shortcutMetadata = await loadDeckySteamShortcutMetadata(appId);
    const shortcutTitleCandidates = normalizeRetroAchievementsTitleCandidates(shortcutMetadata?.title);
    const shortcutTitle = shortcutTitleCandidates[0];
    const shortcutPlatform = normalizeRetroAchievementsPlatformLabel(
      (shortcutMetadata as { readonly platformLabel?: string } | undefined)?.platformLabel,
    );
    const shortcutPlatformCandidates =
      shortcutPlatform !== undefined ? [shortcutPlatform] : ([] as readonly string[]);

    if (shortcutTitle === undefined) {
      const unavailableResolution: RetroAchievementsShortcutResolution = {
        status: "unavailable",
        appId,
        reason: "shortcut-metadata-unavailable",
      };
      markRetroAchievementsShortcutResolution({
        ...unavailableResolution,
        shortcutTitle: shortcutMetadata?.title,
        shortcutPlatform,
        resolutionSource: "unavailable",
        resolutionReason: unavailableResolution.reason,
      } as unknown as Parameters<typeof markRetroAchievementsShortcutResolution>[0]);
      return unavailableResolution;
    }

    const snapshotEntry = readDeckyDashboardSnapshotCacheEntry(RETROACHIEVEMENTS_PROVIDER_ID);
    const snapshot = snapshotEntry?.snapshot;
    const snapshotUpdatedAt =
      snapshotEntry?.storedAt !== undefined ? new Date(snapshotEntry.storedAt).toISOString() : undefined;
    const matchingCandidates =
      snapshot !== undefined
        ? collectRetroAchievementsDashboardCandidates(snapshot, snapshotUpdatedAt).filter((candidate) =>
            matchesRetroAchievementsShortcutTitle(candidate.title, shortcutTitleCandidates),
          )
        : [];

    if (matchingCandidates.length === 1) {
      const matchingCandidate = matchingCandidates[0]!;
      const mappedResolution: RetroAchievementsShortcutResolution = {
        status: "mapped",
        appId,
        raGameId: matchingCandidate.gameId,
        title: matchingCandidate.title,
        earned: matchingCandidate.earned,
        total: matchingCandidate.total,
        source: "shortcut-title-match",
        confidence: "exact",
        ...(matchingCandidate.updatedAt !== undefined ? { updatedAt: matchingCandidate.updatedAt } : {}),
      };
      markRetroAchievementsShortcutResolution({
        ...mappedResolution,
        shortcutTitle: shortcutMetadata?.title,
        shortcutPlatform,
        resolutionSource: "dashboard-snapshot",
        resolutionReason: "shortcut-title-match",
        matchedTitle: matchingCandidate.title,
        matchedPlatform: undefined,
        matchedGameId: matchingCandidate.gameId,
        candidateCount: matchingCandidates.length,
      } as unknown as Parameters<typeof markRetroAchievementsShortcutResolution>[0]);
      return mappedResolution;
    }

    if (matchingCandidates.length > 1) {
      const unavailableResolution: RetroAchievementsShortcutResolution = {
        status: "unavailable",
        appId,
        reason: "ambiguous-retroachievements-shortcut-mapping",
      };
      markRetroAchievementsShortcutResolution({
        ...unavailableResolution,
        shortcutTitle: shortcutMetadata?.title,
        shortcutPlatform,
        resolutionSource: "dashboard-snapshot",
        resolutionReason: unavailableResolution.reason,
        candidateCount: matchingCandidates.length,
      } as unknown as Parameters<typeof markRetroAchievementsShortcutResolution>[0]);
      return unavailableResolution;
    }

    const completionProgressState = await loadDeckyCompletionProgressStateLazy(RETROACHIEVEMENTS_PROVIDER_ID);
    let completionProgressUnavailableReason:
      | "ambiguous-retroachievements-shortcut-mapping"
      | "no-retroachievements-shortcut-mapping"
      | undefined;
    if (completionProgressState.status === "success" && completionProgressState.data !== undefined) {
      const completionProgressCandidates = collectRetroAchievementsCompletionProgressCandidates(
        completionProgressState.data,
      ).filter((candidate) =>
        matchesRetroAchievementsShortcutTitle(candidate.title, shortcutTitleCandidates),
      );

      if (completionProgressCandidates.length === 1) {
        const matchingCandidate = completionProgressCandidates[0]!;
        const mappedResolution: RetroAchievementsShortcutResolution = {
          status: "mapped",
          appId,
          raGameId: matchingCandidate.gameId,
          title: matchingCandidate.title,
          earned: matchingCandidate.earned,
          total: matchingCandidate.total,
          source: "completion-progress-title-match",
          confidence: "exact",
          ...(matchingCandidate.updatedAt !== undefined ? { updatedAt: matchingCandidate.updatedAt } : {}),
        };
        markRetroAchievementsShortcutResolution({
          ...mappedResolution,
          shortcutTitle: shortcutMetadata?.title,
          shortcutPlatform,
          resolutionSource: "ra-api-game-list",
          resolutionReason: "completion-progress-title-match",
          matchedTitle: matchingCandidate.title,
          matchedPlatform: matchingCandidate.normalizedPlatformLabel,
          matchedGameId: matchingCandidate.gameId,
          candidateCount: completionProgressCandidates.length,
        } as unknown as Parameters<typeof markRetroAchievementsShortcutResolution>[0]);
        return mappedResolution;
      }

      completionProgressUnavailableReason =
        completionProgressCandidates.length > 1
          ? "ambiguous-retroachievements-shortcut-mapping"
          : "no-retroachievements-shortcut-mapping";
    }

    const dashboardIdentityCandidates = snapshotEntry?.snapshot
      ? collectRetroAchievementsDashboardIdentityCandidates(snapshotEntry.snapshot, snapshotUpdatedAt).filter(
          (candidate) =>
            matchesRetroAchievementsShortcutTitle(candidate.title, shortcutTitleCandidates) &&
            matchesRetroAchievementsShortcutPlatform(
              candidate.platformLabel,
              shortcutPlatformCandidates,
            ),
        )
      : [];

    if (dashboardIdentityCandidates.length === 1) {
      const matchingCandidate = dashboardIdentityCandidates[0]!;
      let gameDetailState: Awaited<ReturnType<typeof loadDeckyGameDetailStateLazy>>;
      try {
        gameDetailState = await loadDeckyGameDetailStateLazy(
          RETROACHIEVEMENTS_PROVIDER_ID,
          matchingCandidate.gameId,
          {
            forceRefresh: false,
          },
        );
      } catch {
        const unavailableResolution: RetroAchievementsShortcutResolution = {
          status: "unavailable",
          appId,
          reason: "ra-detail-unavailable",
        };
        markRetroAchievementsShortcutResolution({
          ...unavailableResolution,
          shortcutTitle: shortcutMetadata?.title,
          shortcutPlatform,
          resolutionSource: "dashboard-identity-detail",
          resolutionReason: unavailableResolution.reason,
          matchedTitle: matchingCandidate.title,
          matchedPlatform: matchingCandidate.normalizedPlatformLabel,
          matchedGameId: matchingCandidate.gameId,
          candidateCount: dashboardIdentityCandidates.length,
        } as unknown as Parameters<typeof markRetroAchievementsShortcutResolution>[0]);
        return unavailableResolution;
      }
      const game = gameDetailState.data?.game;
      if (
        gameDetailState.status === "success" &&
        game !== undefined &&
        game.summary.totalCount !== undefined &&
        game.summary.totalCount > 0
      ) {
        const mappedResolution: RetroAchievementsShortcutResolution = {
          status: "mapped",
          appId,
          raGameId: game.gameId,
          title: game.title,
          earned: game.summary.unlockedCount,
          total: game.summary.totalCount,
          source: "dashboard-identity-detail",
          confidence: "exact",
          ...(gameDetailState.lastUpdatedAt !== undefined
            ? { updatedAt: new Date(gameDetailState.lastUpdatedAt).toISOString() }
            : {}),
        };
        markRetroAchievementsShortcutResolution({
          ...mappedResolution,
          shortcutTitle: shortcutMetadata?.title,
          shortcutPlatform,
          resolutionSource: "dashboard-identity-detail",
          resolutionReason: "dashboard-identity-detail-title-match",
          matchedTitle: matchingCandidate.title,
          matchedPlatform: matchingCandidate.normalizedPlatformLabel,
          matchedGameId: matchingCandidate.gameId,
          candidateCount: dashboardIdentityCandidates.length,
        } as unknown as Parameters<typeof markRetroAchievementsShortcutResolution>[0]);
        return mappedResolution;
      }

      const unavailableResolution: RetroAchievementsShortcutResolution = {
        status: "unavailable",
        appId,
        reason: "ra-detail-unavailable",
      };
      markRetroAchievementsShortcutResolution({
        ...unavailableResolution,
        shortcutTitle: shortcutMetadata?.title,
        shortcutPlatform,
        resolutionSource: "dashboard-identity-detail",
        resolutionReason: unavailableResolution.reason,
        matchedTitle: matchingCandidate.title,
        matchedPlatform: matchingCandidate.normalizedPlatformLabel,
        matchedGameId: matchingCandidate.gameId,
        candidateCount: dashboardIdentityCandidates.length,
      } as unknown as Parameters<typeof markRetroAchievementsShortcutResolution>[0]);
      return unavailableResolution;
    }

    if (dashboardIdentityCandidates.length > 1) {
      const unavailableResolution: RetroAchievementsShortcutResolution = {
        status: "unavailable",
        appId,
        reason: "ambiguous-retroachievements-shortcut-mapping",
      };
      markRetroAchievementsShortcutResolution({
        ...unavailableResolution,
        shortcutTitle: shortcutMetadata?.title,
        shortcutPlatform,
        resolutionSource: "dashboard-identity-detail",
        resolutionReason: unavailableResolution.reason,
        candidateCount: dashboardIdentityCandidates.length,
      } as unknown as Parameters<typeof markRetroAchievementsShortcutResolution>[0]);
      return unavailableResolution;
    }

    const unavailableReason =
      completionProgressUnavailableReason ?? "ra-cache-unavailable";
    const unavailableResolution: RetroAchievementsShortcutResolution = {
      status: "unavailable",
      appId,
      reason: unavailableReason,
    };
    markRetroAchievementsShortcutResolution({
      ...unavailableResolution,
      shortcutTitle: shortcutMetadata?.title,
      shortcutPlatform,
      resolutionSource: "unavailable",
      resolutionReason: unavailableReason,
    } as unknown as Parameters<typeof markRetroAchievementsShortcutResolution>[0]);
    return unavailableResolution;
  } catch (error: unknown) {
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "string") {
      message = error;
    } else {
      message = "Unexpected RetroAchievements shortcut mapping failure.";
    }

    const errorResolution: RetroAchievementsShortcutResolution = {
      status: "error",
      appId,
      message,
    };
    markRetroAchievementsShortcutResolution({
      ...errorResolution,
      shortcutTitle: undefined,
      shortcutPlatform: undefined,
      resolutionSource: "unavailable",
      resolutionReason: message,
    } as unknown as Parameters<typeof markRetroAchievementsShortcutResolution>[0]);
    return errorResolution;
  }
}

export function formatDeckyGamePageAchievementBadgeLabel(
  summary: GamePageAchievementSummary | undefined,
): string | undefined {
  if (summary === undefined) {
    return undefined;
  }

  if (summary.status === "loading") {
    return "\u{1f3c6} \u2026";
  }

  if (summary.status !== "ready") {
    return undefined;
  }

  return `\u{1f3c6} ${String(summary.earned)} / ${String(summary.total)}`;
}

export function clearDeckyGamePageAchievementSummaryCacheForTests(): void {
  gamePageAchievementSummaryCache.clear();
  gamePageAchievementSummaryInFlight.clear();
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
    let steamUnavailableSummary: GamePageAchievementSummary | undefined;

    const steamCacheSummary = resolveSummaryFromSteamScanCache(appId);
    if (steamCacheSummary?.status === "ready") {
      return steamCacheSummary;
    }

    if (steamCacheSummary?.status === "unavailable") {
      steamUnavailableSummary = steamCacheSummary;
    }

    const steamSnapshotSummary = resolveSummaryFromSteamDashboardSnapshot(appId);
    if (steamSnapshotSummary?.status === "ready") {
      return steamSnapshotSummary;
    }

    if (steamSnapshotSummary?.status === "unavailable") {
      steamUnavailableSummary = steamSnapshotSummary;
    }

    const steamDetailSummary = await resolveSummaryFromSteamGameDetail(appId);
    if (steamDetailSummary?.status === "ready") {
      return steamDetailSummary;
    }

    if (steamDetailSummary?.status === "unavailable") {
      steamUnavailableSummary = steamDetailSummary;
    }

    const retroAchievementsShortcutResolution = await resolveSummaryFromRetroAchievementsShortcut(appId);
    if (retroAchievementsShortcutResolution.status === "mapped") {
      return createReadySummary({
        provider: "retroachievements",
        appId,
        gameId: retroAchievementsShortcutResolution.raGameId,
        title: retroAchievementsShortcutResolution.title,
        earned: retroAchievementsShortcutResolution.earned,
        total: retroAchievementsShortcutResolution.total,
        source:
          retroAchievementsShortcutResolution.source === "completion-progress-title-match" ||
          retroAchievementsShortcutResolution.source === "dashboard-identity-detail"
            ? "backend"
            : "snapshot",
        ...(retroAchievementsShortcutResolution.updatedAt !== undefined
          ? { updatedAt: retroAchievementsShortcutResolution.updatedAt }
          : {}),
      });
    }

    if (retroAchievementsShortcutResolution.status === "error") {
      return {
        status: "error",
        appId,
        message: retroAchievementsShortcutResolution.message,
      };
    }

    if (
      retroAchievementsShortcutResolution.reason === "shortcut-metadata-unavailable" &&
      steamUnavailableSummary !== undefined
    ) {
      return steamUnavailableSummary;
    }

    return createUnavailableSummary(appId, retroAchievementsShortcutResolution.reason);
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
