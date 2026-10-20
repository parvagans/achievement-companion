import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type {
  NormalizedGame,
  RecentlyPlayedGame,
} from "@core/domain";
import { readDeckyDashboardSnapshotCacheEntry } from "./decky-dashboard-snapshot-cache";
import { createDeckyGamePageSummaryRevisionStore } from "./decky-game-page-achievement-lifecycle";
import { subscribeDeckyRaNativeAchievementInvalidation } from "./decky-ra-native-achievement-invalidation";
import {
  loadDeckySteamShortcutMetadata,
  loadDeckySteamShortcutRomHashInfo,
  type DeckySteamShortcutMetadata,
} from "./decky-steam-shortcut-metadata";
import { loadDeckyRetroAchievementsProviderConfig } from "./providers/retroachievements/config";
import { createDeckyRetroAchievementsTransport } from "./providers/retroachievements/backend-transport";
import {
  readDeckyProviderConfig as readDeckySteamProviderConfig,
  readDeckySteamLibraryAchievementScanSummary,
} from "./providers/steam/config";
import { findSteamLibraryScanGameSummaryByAppId } from "./providers/steam/game-detail";
import { readDeckyProviderConfigs, useDeckyProviderConfigs } from "./providers/provider-config-store";
import {
  createRetroAchievementsClient,
  type RetroAchievementsClient,
} from "../../providers/retroachievements";
import { normalizeRetroAchievementsImageUrl } from "../../providers/retroachievements/mappers/normalize";
import type { RawRetroAchievementsSystemResponse } from "../../providers/retroachievements/raw-types";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";
import { STEAM_PROVIDER_ID } from "../../providers/steam";
import {
  markAchievementCompanionGamePageAchievementSummaryFetchCompleted,
  markAchievementCompanionGamePageAchievementSummaryFetchStarted,
  markAchievementCompanionGamePageShortcutDetected,
  markAchievementCompanionRetroAchievementsShortcutResolution,
  getAchievementCompanionRuntimeDebugState,
  reportAchievementCompanionGamePageAchievementSummaryError,
  updateAchievementCompanionRaShortcutResolutionDebug,
} from "./decky-runtime-debug";

const GAME_PAGE_ACHIEVEMENT_SUMMARY_CACHE_TTL_MS = 30 * 1000;

export type RetroAchievementsCompletionStatus = "beaten" | "mastered" | "in-progress";

export type GamePageAchievementSummary =
  | {
      readonly status: "ready";
      readonly provider: "steam" | "retroachievements";
      readonly appId: string;
      readonly gameId?: string;
      readonly title?: string;
      readonly platformLabel?: string;
      readonly systemIconUrl?: string;
      readonly earned: number;
      readonly total: number;
      readonly source: "cache" | "backend" | "snapshot";
      readonly updatedAt?: string;
      readonly completionStatus?: RetroAchievementsCompletionStatus;
    }
  | {
      readonly status: "loading";
      readonly appId: string;
      readonly provider?: "steam" | "retroachievements";
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
        | "ra-hash-game-detail";
      readonly confidence: "exact";
      readonly reason?: string;
      readonly platformLabel?: string;
      readonly systemIconUrl?: string;
      readonly updatedAt?: string;
      readonly completionStatus?: RetroAchievementsCompletionStatus;
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

type RetroAchievementsShortcutHashAttempt =
  | {
      readonly status: "mapped";
      readonly appId: string;
      readonly raGameId: string;
      readonly title: string;
      readonly earned: number;
      readonly total: number;
      readonly source: "ra-hash-game-detail";
      readonly confidence: "exact";
      readonly reason?: string;
      readonly platformLabel?: string;
      readonly systemIconUrl?: string;
      readonly updatedAt?: string;
      readonly shortcutRomPathDetected: boolean;
      readonly shortcutRomPathSource?: string;
      readonly romHashAttempted: boolean;
      readonly romHashStatus: "resolved";
      readonly romHashAlgorithm?: "rcheevos";
      readonly romHashPrefix?: string;
      readonly raHashLookupAttempted: boolean;
      readonly raHashLookupStatus: "matched";
      readonly raHashMatchedGameId: string;
      readonly raHashMatchedTitle: string;
      readonly raHashMatchedConsoleId?: string;
      readonly raHashMatchedConsoleName?: string;
      readonly hashResolverSkippedReason?: string;
      readonly hashRejectedReason?: string;
      readonly finalResolverSource: "hash";
      readonly completionStatus?: RetroAchievementsCompletionStatus;
    }
  | {
      readonly status: "skipped";
      readonly appId: string;
      readonly reason: string;
      readonly shortcutRomPathDetected: boolean;
      readonly shortcutRomPathSource?: string;
      readonly romHashAttempted: boolean;
      readonly romHashStatus?: string;
      readonly romHashAlgorithm?: string;
      readonly romHashPrefix?: string;
      readonly raHashLookupAttempted?: boolean;
      readonly raHashLookupStatus?: string;
      readonly raHashMatchedGameId?: string;
      readonly raHashMatchedTitle?: string;
      readonly raHashMatchedConsoleId?: string;
      readonly raHashMatchedConsoleName?: string;
      readonly hashResolverSkippedReason?: string;
      readonly hashRejectedReason?: string;
      readonly finalResolverSource: "unavailable";
    }
  | {
      readonly status: "error";
      readonly appId: string;
      readonly message: string;
      readonly finalResolverSource: "unavailable";
    };

type RetroAchievementsShortcutResolutionDebugArgs = RetroAchievementsShortcutResolution & {
  readonly hashResolverAttempted?: boolean | undefined;
  readonly hashResolverSkippedReason?: string | undefined;
  readonly shortcutRomPathDetected?: boolean | undefined;
  readonly shortcutRomPathSource?: string | undefined;
  readonly romHashAttempted?: boolean | undefined;
  readonly romHashStatus?: string | undefined;
  readonly romHashAlgorithm?: string | undefined;
  readonly romHashPrefix?: string | undefined;
  readonly raHashLookupAttempted?: boolean | undefined;
  readonly raHashLookupStatus?: string | undefined;
  readonly raHashMatchedGameId?: string | undefined;
  readonly raHashMatchedTitle?: string | undefined;
  readonly raHashMatchedConsoleId?: string | undefined;
  readonly raHashMatchedConsoleName?: string | undefined;
  readonly hashRejectedReason?: string | undefined;
  readonly finalResolverSource?: "hash" | "unavailable" | undefined;
  readonly shortcutTitle?: string | undefined;
  readonly shortcutPlatform?: string | undefined;
  readonly normalizedPlatform?: string | undefined;
  readonly resolutionSource?: string | undefined;
  readonly resolutionReason?: string | undefined;
  readonly resolvedSystemName?: string | undefined;
  readonly resolvedConsoleId?: string | undefined;
  readonly matchedTitle?: string | undefined;
  readonly matchedPlatform?: string | undefined;
  readonly matchedGameId?: string | undefined;
  readonly candidateCount?: number | undefined;
  readonly detailLoadStatus?: string | undefined;
  readonly detailLoadReason?: string | undefined;
  readonly clearKeys?: readonly (
    | "returnedSummaryProvider"
    | "returnedSummaryEarned"
    | "returnedSummaryTotal"
    | "detailGameId"
    | "detailTitle"
    | "detailPlatformLabel"
    | "detailEarned"
    | "detailEarnedHardcore"
    | "detailTotal"
    | "detailLoadStatus"
    | "detailLoadReason"
    | "completionStatusEnrichmentAttempted"
    | "completionStatusEnrichmentStatus"
    | "completionStatusEnrichmentSource"
    | "completionStatusEnrichmentGameId"
    | "enrichedCompletionStatus"
    | "hashResolverAttempted"
    | "hashResolverSkippedReason"
    | "shortcutRomPathDetected"
    | "shortcutRomPathSource"
    | "romHashAttempted"
    | "romHashStatus"
    | "romHashAlgorithm"
    | "romHashPrefix"
    | "raHashLookupAttempted"
    | "raHashLookupStatus"
    | "raHashMatchedGameId"
    | "raHashMatchedTitle"
    | "raHashMatchedConsoleId"
    | "raHashMatchedConsoleName"
    | "hashRejectedReason"
    | "finalResolverSource"
  )[];
};

interface CachedGamePageAchievementSummaryEntry {
  readonly storedAt: number;
  readonly summary: GamePageAchievementSummary;
}

type RetroAchievementsCompletionStatusEnrichmentResult =
  | {
      readonly status: "resolved";
      readonly completionStatus: RetroAchievementsCompletionStatus;
    }
  | {
      readonly status: "unavailable" | "failed";
    };

interface RetroAchievementsApiGameListCandidate {
  readonly gameId: string;
  readonly title: string;
  readonly platformLabel?: string;
  readonly normalizedPlatformLabel?: string;
  readonly systemIconUrl?: string;
  readonly hashes?: readonly string[];
  readonly updatedAt?: string;
}


interface RetroAchievementsResolvedSystemMetadata {
  readonly normalizedPlatform: string;
  readonly systemName: string;
  readonly consoleId: string;
  readonly systemIconUrl?: string | undefined;
}

type RetroAchievementsGameListCandidatesLoadResult =
  | {
      readonly status: "resolved";
      readonly system: RetroAchievementsResolvedSystemMetadata;
      readonly candidates: readonly RetroAchievementsApiGameListCandidate[];
      readonly cacheStatus: "fetched" | "hit";
    }
  | {
      readonly status: "unsupported";
      readonly normalizedPlatform: string;
      readonly candidates: readonly RetroAchievementsApiGameListCandidate[];
    }
  | {
      readonly status: "unavailable";
      readonly normalizedPlatform?: string;
      readonly candidates: readonly RetroAchievementsApiGameListCandidate[];
      readonly reason?: string;
    };

const gamePageAchievementSummaryCache = new Map<string, CachedGamePageAchievementSummaryEntry>();
const gamePageAchievementSummaryInFlight = new Map<string, Promise<GamePageAchievementSummary>>();
const gamePageAchievementSummaryRevisions = createDeckyGamePageSummaryRevisionStore();
let observedSteamProviderConfig = readDeckyProviderConfigs().steam;

export function subscribeDeckyGamePageAchievementSummaryRevision(
  appId: string,
  listener: () => void,
): () => void {
  return gamePageAchievementSummaryRevisions.subscribe(appId, listener);
}

export function readDeckyGamePageAchievementSummaryRevision(appId: string): number {
  return gamePageAchievementSummaryRevisions.snapshot(appId);
}
const retroAchievementsCompletionStatusEnrichmentCacheByGameId = new Map<
  string,
  {
    readonly storedAt: number;
    readonly result: RetroAchievementsCompletionStatusEnrichmentResult;
  }
>();
const retroAchievementsCompletionStatusEnrichmentInFlightByGameId = new Map<
  string,
  Promise<RetroAchievementsCompletionStatusEnrichmentResult>
>();
const retroAchievementsGameListCandidatesCacheByPlatform = new Map<
  string,
  {
    readonly storedAt: number;
    readonly result: RetroAchievementsGameListCandidatesLoadResult;
  }
>();
const retroAchievementsGameListCandidatesInFlightByPlatform = new Map<
  string,
  Promise<RetroAchievementsGameListCandidatesLoadResult>
>();
let retroAchievementsSystemsCache:
  | {
      readonly storedAt: number;
      readonly systems: readonly RawRetroAchievementsSystemResponse[];
    }
  | undefined;
let retroAchievementsSystemsInFlight: Promise<readonly RawRetroAchievementsSystemResponse[]> | undefined;
const RETROACHIEVEMENTS_GAME_LIST_CACHE_TTL_MS = 60 * 60 * 1000;
let retroAchievementsClient: RetroAchievementsClient | undefined;

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

function parsePositiveAppId(value: string | undefined): number | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
}

function normalizeRetroAchievementsShortcutPlatform(
  shortcutMetadata: DeckySteamShortcutMetadata | undefined,
): string | undefined {
  const labels = [shortcutMetadata?.platformTag, shortcutMetadata?.platformLabel, ...(shortcutMetadata?.tags ?? [])];
  const recognized = new Set(labels.flatMap((label) => {
    if (label === undefined) return [];
    const alias = RETROACHIEVEMENTS_PLATFORM_LABEL_ALIASES.get(normalizeRetroAchievementsPlatformAliasKey(label));
    return alias === undefined ? [] : [alias];
  }));
  if (recognized.size > 1) return undefined;
  if (recognized.size === 1) return recognized.values().next().value;
  return normalizeRetroAchievementsPlatformLabel(labels[0]);
}

function normalizeRetroAchievementsCompletionStatus(
  status: NormalizedGame["status"] | undefined,
  highestAwardKind?: string | undefined,
): RetroAchievementsCompletionStatus | undefined {
  if (status === "beaten") {
    return "beaten";
  }

  if (status === "mastered" || status === "completed") {
    return "mastered";
  }

  const normalizedHighestAwardKind = highestAwardKind?.trim().toLowerCase();
  if (normalizedHighestAwardKind?.includes("beaten")) {
    return "beaten";
  }

  if (
    normalizedHighestAwardKind?.includes("mastered") ||
    normalizedHighestAwardKind?.includes("completed")
  ) {
    return "mastered";
  }

  return undefined;
}

function getRetroAchievementsHighestAwardKind(
  game: Pick<NormalizedGame, "metrics">,
): string | undefined {
  return game.metrics.find((metric) => metric.key === "highest-award-kind")?.value;
}

function getRetroAchievementsClient(): RetroAchievementsClient {
  if (retroAchievementsClient === undefined) {
    retroAchievementsClient = createRetroAchievementsClient(createDeckyRetroAchievementsTransport());
  }

  return retroAchievementsClient;
}

function createReadySummary(args: {
  readonly provider: "steam" | "retroachievements";
  readonly appId: string;
  readonly gameId?: string;
  readonly title?: string;
  readonly platformLabel?: string;
  readonly systemIconUrl?: string;
  readonly earned: number;
  readonly total: number;
  readonly source: "cache" | "backend" | "snapshot";
  readonly updatedAt?: string;
  readonly completionStatus?: RetroAchievementsCompletionStatus;
}): GamePageAchievementSummary {
  return {
    status: "ready",
    provider: args.provider,
    appId: args.appId,
    ...(args.gameId !== undefined ? { gameId: args.gameId } : {}),
    ...(args.title !== undefined ? { title: args.title } : {}),
    ...(args.platformLabel !== undefined ? { platformLabel: args.platformLabel } : {}),
    ...(args.systemIconUrl !== undefined ? { systemIconUrl: args.systemIconUrl } : {}),
    earned: args.earned,
    total: args.total,
    source: args.source,
    ...(args.updatedAt !== undefined ? { updatedAt: args.updatedAt } : {}),
    ...(args.completionStatus !== undefined ? { completionStatus: args.completionStatus } : {}),
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

const RETROACHIEVEMENTS_CANONICAL_SYSTEM_NAMES = [
  "Genesis/Mega Drive",
  "Nintendo 64",
  "SNES/Super Famicom",
  "Game Boy",
  "Game Boy Advance",
  "Game Boy Color",
  "NES/Famicom",
  "PC Engine/TurboGrafx-16",
  "Sega CD",
  "32X",
  "Master System",
  "PlayStation",
  "Atari Lynx",
  "Neo Geo Pocket",
  "Game Gear",
  "GameCube",
  "Atari Jaguar",
  "Nintendo DS",
  "Wii",
  "Wii U",
  "PlayStation 2",
  "Xbox",
  "Magnavox Odyssey 2",
  "Pokemon Mini",
  "Atari 2600",
  "DOS",
  "Arcade",
  "Virtual Boy",
  "MSX",
  "Commodore 64",
  "ZX81",
  "Oric",
  "SG-1000",
  "VIC-20",
  "Amiga",
  "Atari ST",
  "Amstrad CPC",
  "Apple II",
  "Saturn",
  "Dreamcast",
  "PlayStation Portable",
  "Philips CD-i",
  "3DO Interactive Multiplayer",
  "ColecoVision",
  "Intellivision",
  "Vectrex",
  "PC-8000/8800",
  "PC-9800",
  "PC-FX",
  "Atari 5200",
  "Atari 7800",
  "Sharp X68000",
  "WonderSwan",
  "Cassette Vision",
  "Super Cassette Vision",
  "Neo Geo CD",
  "Fairchild Channel F",
  "FM Towns",
  "ZX Spectrum",
  "Game & Watch",
  "Nokia N-Gage",
  "Nintendo 3DS",
  "Watara Supervision",
  "Sharp X1",
  "TIC-80",
  "Thomson TO8",
  "PC-6000",
  "Sega Pico",
  "Mega Duck",
  "Zeebo",
  "Arduboy",
  "WASM-4",
  "Arcadia 2001",
  "Interton VC 4000",
  "Elektor TV Games Computer",
  "PC Engine CD/TurboGrafx-CD",
  "Atari Jaguar CD",
  "Nintendo DSi",
  "TI-83",
  "Uzebox",
  "Famicom Disk System",
  "Hubs",
  "Events",
  "Standalone",
] as const;

function normalizeRetroAchievementsPlatformAliasKey(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[™®]/gu, "")
    .replace(/&/gu, " and ")
    .replace(/\+/gu, " plus ")
    .replace(/[/_():[\]{}.,]/gu, " ")
    .replace(/[‐-‒–—-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const RETROACHIEVEMENTS_PLATFORM_LABEL_ALIASES = new Map<string, string>([
  ...RETROACHIEVEMENTS_CANONICAL_SYSTEM_NAMES.map(
    (systemName) => [normalizeRetroAchievementsPlatformAliasKey(systemName), systemName] as const,
  ),

  ["sega genesis", "Genesis/Mega Drive"],
  ["genesis", "Genesis/Mega Drive"],
  ["mega drive", "Genesis/Mega Drive"],
  ["megadrive", "Genesis/Mega Drive"],
  ["sega mega drive", "Genesis/Mega Drive"],
  ["sega megadrive", "Genesis/Mega Drive"],
  ["sega genesis mega drive", "Genesis/Mega Drive"],
  ["sega mega drive genesis", "Genesis/Mega Drive"],
  ["sega genesis megadrive", "Genesis/Mega Drive"],
  ["sega megadrive genesis", "Genesis/Mega Drive"],
  ["sega genesis mega drive widescreen", "Genesis/Mega Drive"],

  ["super nintendo", "SNES/Super Famicom"],
  ["super nintendo entertainment system", "SNES/Super Famicom"],
  ["snes", "SNES/Super Famicom"],
  ["super famicom", "SNES/Super Famicom"],
  ["nintendo snes", "SNES/Super Famicom"],
  ["nintendo snes super nintendo", "SNES/Super Famicom"],
  ["nintendo super nintendo", "SNES/Super Famicom"],
  ["nintendo super nintendo entertainment system", "SNES/Super Famicom"],
  ["nintendo snes super nintendo hd bsnes hd", "SNES/Super Famicom"],
  ["sfc", "SNES/Super Famicom"],

  ["nintendo entertainment system", "NES/Famicom"],
  ["nes", "NES/Famicom"],
  ["famicom", "NES/Famicom"],
  ["nintendo nes", "NES/Famicom"],
  ["nintendo nes nintendo entertainment system", "NES/Famicom"],
  ["nintendo famicom", "NES/Famicom"],
  ["nintendo famicom nes", "NES/Famicom"],

  ["n64", "Nintendo 64"],

  ["nintendo game boy", "Game Boy"],
  ["gameboy", "Game Boy"],
  ["gb", "Game Boy"],

  ["nintendo game boy color", "Game Boy Color"],
  ["gameboy color", "Game Boy Color"],
  ["gbc", "Game Boy Color"],

  ["nintendo game boy advance", "Game Boy Advance"],
  ["gameboy advance", "Game Boy Advance"],
  ["gba", "Game Boy Advance"],

  ["pc engine", "PC Engine/TurboGrafx-16"],
  ["pcengine", "PC Engine/TurboGrafx-16"],
  ["nec pc engine turbografx 16", "PC Engine/TurboGrafx-16"],
  ["turbografx 16", "PC Engine/TurboGrafx-16"],
  ["turbografx16", "PC Engine/TurboGrafx-16"],
  ["tg16", "PC Engine/TurboGrafx-16"],

  ["pc engine cd", "PC Engine CD/TurboGrafx-CD"],
  ["nec pc engine turbografx 16 cd", "PC Engine CD/TurboGrafx-CD"],
  ["turbografx cd", "PC Engine CD/TurboGrafx-CD"],
  ["turbografxcd", "PC Engine CD/TurboGrafx-CD"],
  ["tg cd", "PC Engine CD/TurboGrafx-CD"],

  ["sega cd mega cd", "Sega CD"],

  ["sega master system", "Master System"],
  ["sms", "Master System"],

  ["sega game gear", "Game Gear"],
  ["gg", "Game Gear"],

  ["sega saturn", "Saturn"],
  ["sega dreamcast", "Dreamcast"],

  ["sony playstation", "PlayStation"],
  ["playstation 1", "PlayStation"],
  ["ps1", "PlayStation"],
  ["psx", "PlayStation"],

  ["sony playstation 2", "PlayStation 2"],
  ["ps2", "PlayStation 2"],

  ["sony playstation portable", "PlayStation Portable"],
  ["psp", "PlayStation Portable"],

  ["nintendo gamecube", "GameCube"],
  ["nintendo game cube", "GameCube"],
  ["game cube", "GameCube"],
  ["gc", "GameCube"],

  ["nintendo ds", "Nintendo DS"],
  ["nintendo ds melonds standalone", "Nintendo DS"],
  ["nds", "Nintendo DS"],
  ["ds", "Nintendo DS"],

  ["nintendo 3ds", "Nintendo 3DS"],
  ["nintendo 3ds azahar standalone", "Nintendo 3DS"],
  ["3ds", "Nintendo 3DS"],

  ["nintendo dsi", "Nintendo DSi"],
  ["dsi", "Nintendo DSi"],

  ["nintendo virtual boy", "Virtual Boy"],
  ["nintendo wii", "Wii"],
  ["nintendo wii u", "Wii U"],
  ["nintendo wii u cemu native", "Wii U"],

  ["sega sg 1000", "SG-1000"],
  ["sega sg1000", "SG-1000"],
  ["sg 1000", "SG-1000"],
  ["sg1000", "SG-1000"],

  ["neo geo pocket", "Neo Geo Pocket"],
  ["neogeo pocket", "Neo Geo Pocket"],
  ["neo geo cd", "Neo Geo CD"],
  ["neogeo cd", "Neo Geo CD"],

  ["game and watch", "Game & Watch"],
  ["game watch", "Game & Watch"],

  ["mame", "Arcade"],
  ["arcade fbneo", "Arcade"],
  ["dos pc", "DOS"],
  ["pc dos", "DOS"],

  ["commodore c64", "Commodore 64"],
  ["c64", "Commodore 64"],

  ["zx spectrum", "ZX Spectrum"],
  ["spectrum", "ZX Spectrum"],

  ["atari lynx", "Atari Lynx"],
  ["lynx", "Atari Lynx"],

  ["atari jaguar", "Atari Jaguar"],
  ["jaguar", "Atari Jaguar"],
  ["atari jaguar cd", "Atari Jaguar CD"],
  ["jaguar cd", "Atari Jaguar CD"],

  ["atari st", "Atari ST"],
  ["atari 2600", "Atari 2600"],
  ["atari 5200", "Atari 5200"],
  ["atari 7800", "Atari 7800"],

  ["3do", "3DO Interactive Multiplayer"],
  ["coleco vision", "ColecoVision"],
  ["colecovision", "ColecoVision"],
  ["mattel intellivision", "Intellivision"],
  ["odyssey 2", "Magnavox Odyssey 2"],
  ["videopac", "Magnavox Odyssey 2"],
  ["philips videopac", "Magnavox Odyssey 2"],
  ["pokemon mini", "Pokemon Mini"],
  ["poke mini", "Pokemon Mini"],
  ["pokemini", "Pokemon Mini"],

  ["wonderswan", "WonderSwan"],
  ["wonder swan", "WonderSwan"],

  ["sega pico", "Sega Pico"],
  ["mega duck", "Mega Duck"],
  ["megaduck", "Mega Duck"],
]);

export function normalizeRetroAchievementsPlatformLabel(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (trimmed.length === 0) {
    return undefined;
  }

  const aliasKey = normalizeRetroAchievementsPlatformAliasKey(trimmed);
  const alias = RETROACHIEVEMENTS_PLATFORM_LABEL_ALIASES.get(aliasKey);
  if (alias !== undefined) {
    return alias;
  }

  return trimmed;
}

function parseRetroAchievementsConsoleIdentifier(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  return undefined;
}

function readRetroAchievementsSystemName(
  system: RawRetroAchievementsSystemResponse,
): string | undefined {
  if (typeof system.Name === "string" && system.Name.trim().length > 0) {
    return system.Name.trim();
  }

  if (typeof system.name === "string" && system.name.trim().length > 0) {
    return system.name.trim();
  }

  return undefined;
}

function readRetroAchievementsSystemIconUrl(
  system: RawRetroAchievementsSystemResponse,
): string | undefined {
  const rawIconUrl =
    typeof system.IconURL === "string" && system.IconURL.trim().length > 0
      ? system.IconURL
      : typeof system.iconUrl === "string" && system.iconUrl.trim().length > 0
        ? system.iconUrl
        : undefined;

  return rawIconUrl !== undefined ? normalizeRetroAchievementsImageUrl(rawIconUrl.trim()) : undefined;
}

async function loadRetroAchievementsSystems():
  Promise<readonly RawRetroAchievementsSystemResponse[]> {
  if (
    retroAchievementsSystemsCache !== undefined &&
    Date.now() - retroAchievementsSystemsCache.storedAt <= RETROACHIEVEMENTS_GAME_LIST_CACHE_TTL_MS
  ) {
    return retroAchievementsSystemsCache.systems;
  }

  if (retroAchievementsSystemsInFlight !== undefined) {
    return retroAchievementsSystemsInFlight;
  }

  const loadPromise = (async () => {
    const config = await loadDeckyRetroAchievementsProviderConfig(RETROACHIEVEMENTS_PROVIDER_ID);
    const emptySystems: readonly RawRetroAchievementsSystemResponse[] = [];
    if (config === undefined || config.hasApiKey !== true) {
      return emptySystems;
    }

    const client = getRetroAchievementsClient();
    if (client.loadSystems === undefined) {
      return emptySystems;
    }

    const systems = await client.loadSystems(config);
    retroAchievementsSystemsCache = {
      storedAt: Date.now(),
      systems,
    };
    return systems;
  })().finally(() => {
    retroAchievementsSystemsInFlight = undefined;
  });

  retroAchievementsSystemsInFlight = loadPromise;
  return loadPromise;
}

async function resolveRetroAchievementsSystemMetadataForPlatform(
  shortcutPlatform: string | undefined,
): Promise<RetroAchievementsResolvedSystemMetadata | undefined> {
  const normalizedPlatform = normalizeRetroAchievementsPlatformLabel(shortcutPlatform);
  if (normalizedPlatform === undefined) {
    return undefined;
  }

  const systems = await loadRetroAchievementsSystems();
  const matchingSystems = systems.filter((system) => {
    const systemName = readRetroAchievementsSystemName(system);
    return normalizeRetroAchievementsPlatformLabel(systemName) === normalizedPlatform;
  });

  if (matchingSystems.length !== 1) {
    return undefined;
  }

  const system = matchingSystems[0]!;
  const consoleId = parseRetroAchievementsConsoleIdentifier(system.ID ?? system.id);
  const systemName = readRetroAchievementsSystemName(system);
  if (consoleId === undefined || systemName === undefined) {
    return undefined;
  }

  return {
    normalizedPlatform,
    systemName,
    consoleId,
    ...(readRetroAchievementsSystemIconUrl(system) !== undefined
      ? { systemIconUrl: readRetroAchievementsSystemIconUrl(system) }
      : {}),
  };
}

function parseRetroAchievementsGameListCandidates(
  response: unknown,
  system: RetroAchievementsResolvedSystemMetadata,
): readonly RetroAchievementsApiGameListCandidate[] {
  if (!Array.isArray(response) || response.length === 0) {
    throw new Error("catalogue-incomplete");
  }

  const candidatesByGameId = new Map<string, RetroAchievementsApiGameListCandidate>();

  for (const entry of response) {
    if (typeof entry !== "object" || entry === null) {
      throw new Error("catalogue-incomplete");
    }

    const record = entry as Record<string, unknown>;
    const gameIdValue = record["GameID"] ?? record["gameId"] ?? record["ID"] ?? record["id"];
    const titleValue = record["Title"] ?? record["title"] ?? record["GameTitle"] ?? record["gameTitle"];
    const consoleNameValue = record["ConsoleName"] ?? record["consoleName"];
    const consoleIdValue = record["ConsoleID"] ?? record["consoleId"];
    const hashesValue = record["Hashes"] ?? record["hashes"];
    const gameId =
      typeof gameIdValue === "string"
        ? gameIdValue.trim()
        : typeof gameIdValue === "number" && Number.isFinite(gameIdValue)
          ? String(Math.trunc(gameIdValue))
          : undefined;
    const title =
      typeof titleValue === "string" && titleValue.trim().length > 0
        ? titleValue.trim()
        : undefined;
    if (gameId === undefined || !/^\d+$/u.test(gameId) || !Array.isArray(hashesValue)) {
      throw new Error("catalogue-incomplete");
    }
    const returnedConsoleId = parseRetroAchievementsConsoleIdentifier(consoleIdValue);
    if (returnedConsoleId !== undefined && returnedConsoleId !== system.consoleId) {
      throw new Error("catalogue-console-mismatch");
    }

    const platformLabel = normalizeRetroAchievementsPlatformLabel(
      typeof consoleNameValue === "string" ? consoleNameValue : undefined,
    ) ?? system.normalizedPlatform;
    const normalizedPlatformLabel =
      platformLabel !== undefined ? normalizeRetroAchievementsPlatformLabel(platformLabel) : undefined;
    const hashes = hashesValue.map((hash) => typeof hash === "string" ? hash.trim().toLowerCase() : "");
    if (hashes.some((hash) => !/^[0-9a-f]{32}$/u.test(hash))) {
      throw new Error("catalogue-incomplete");
    }
    const prior = candidatesByGameId.get(gameId);
    candidatesByGameId.set(gameId, {
      gameId,
      title: title ?? prior?.title ?? `Game ${gameId}`,
      ...(platformLabel !== undefined ? { platformLabel } : {}),
      ...(normalizedPlatformLabel !== undefined ? { normalizedPlatformLabel } : {}),
      ...(system.systemIconUrl !== undefined ? { systemIconUrl: system.systemIconUrl } : {}),
      hashes: Array.from(new Set([...(prior?.hashes ?? []), ...hashes])),
    });
  }

  return Array.from(candidatesByGameId.values());
}

function collectRetroAchievementsGameListCandidatesForHash(
  candidates: readonly RetroAchievementsApiGameListCandidate[],
  romHash: string,
): readonly RetroAchievementsApiGameListCandidate[] {
  const normalizedRomHash = romHash.trim().toLowerCase();
  const matches = new Map<string, RetroAchievementsApiGameListCandidate>();

  for (const candidate of candidates) {
    if (
      candidate.hashes === undefined ||
      !candidate.hashes.some((candidateHash) => candidateHash.trim().toLowerCase() === normalizedRomHash)
    ) {
      continue;
    }

    if (!matches.has(candidate.gameId)) {
      matches.set(candidate.gameId, candidate);
    }
  }

  return Array.from(matches.values());
}

function normalizeRetroAchievementsRomHashPreview(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed.slice(0, 12) : undefined;
}

async function loadRetroAchievementsGameListCandidatesForPlatform(
  shortcutPlatform: string | undefined,
): Promise<RetroAchievementsGameListCandidatesLoadResult> {
  const normalizedShortcutPlatform = normalizeRetroAchievementsPlatformLabel(shortcutPlatform);
  const emptyCandidates: readonly RetroAchievementsApiGameListCandidate[] = [];
  if (normalizedShortcutPlatform === undefined) {
    return {
      status: "unavailable",
      candidates: emptyCandidates,
    };
  }

  const cachedEntry = retroAchievementsGameListCandidatesCacheByPlatform.get(normalizedShortcutPlatform);
  if (
    cachedEntry !== undefined &&
    Date.now() - cachedEntry.storedAt <= RETROACHIEVEMENTS_GAME_LIST_CACHE_TTL_MS
  ) {
    return cachedEntry.result.status === "resolved"
      ? { ...cachedEntry.result, cacheStatus: "hit" }
      : cachedEntry.result;
  }

  const inFlight = retroAchievementsGameListCandidatesInFlightByPlatform.get(normalizedShortcutPlatform);
  if (inFlight !== undefined) {
    return inFlight;
  }

  const loadPromise = (async () => {
    const config = await loadDeckyRetroAchievementsProviderConfig(RETROACHIEVEMENTS_PROVIDER_ID);
    if (config === undefined || config.hasApiKey !== true) {
      return {
        status: "unavailable",
        normalizedPlatform: normalizedShortcutPlatform,
        candidates: emptyCandidates,
      } satisfies RetroAchievementsGameListCandidatesLoadResult;
    }

    const client = getRetroAchievementsClient();
    if (client.loadGameList === undefined) {
      return {
        status: "unavailable",
        normalizedPlatform: normalizedShortcutPlatform,
        candidates: emptyCandidates,
      } satisfies RetroAchievementsGameListCandidatesLoadResult;
    }

    const system = await resolveRetroAchievementsSystemMetadataForPlatform(normalizedShortcutPlatform);
    if (system === undefined) {
      return {
        status: "unsupported",
        normalizedPlatform: normalizedShortcutPlatform,
        candidates: emptyCandidates,
      } satisfies RetroAchievementsGameListCandidatesLoadResult;
    }

    // API_GetGameList with h=1 and no c limit returns every supported hash for
    // this console. A malformed response must not become a complete cache entry.
    const response = await client.loadGameList(config, system.consoleId);
    const nextCandidates = parseRetroAchievementsGameListCandidates(response, system);
    return {
      status: "resolved",
      system,
      candidates: nextCandidates,
      cacheStatus: "fetched",
    } satisfies RetroAchievementsGameListCandidatesLoadResult;
  })().finally(() => {
    retroAchievementsGameListCandidatesInFlightByPlatform.delete(normalizedShortcutPlatform);
  });

  retroAchievementsGameListCandidatesInFlightByPlatform.set(normalizedShortcutPlatform, loadPromise);
  const result = await loadPromise;
  if (result.status === "resolved") {
    retroAchievementsGameListCandidatesCacheByPlatform.set(normalizedShortcutPlatform, {
      storedAt: Date.now(),
      result,
    });
  }
  return result;
}

function markRetroAchievementsShortcutResolution(
  resolution: RetroAchievementsShortcutResolutionDebugArgs,
): void {
  if (resolution.status === "mapped") {
    markAchievementCompanionRetroAchievementsShortcutResolution({
      appId: resolution.appId,
      status: "mapped",
      ...(resolution.reason !== undefined ? { reason: resolution.reason } : {}),
      gameId: resolution.raGameId,
      title: resolution.title,
      earned: resolution.earned,
      total: resolution.total,
      source: resolution.source,
      confidence: resolution.confidence,
      ...(resolution.shortcutTitle !== undefined ? { shortcutTitle: resolution.shortcutTitle } : {}),
      ...(resolution.shortcutPlatform !== undefined ? { shortcutPlatform: resolution.shortcutPlatform } : {}),
      ...(resolution.normalizedPlatform !== undefined ? { normalizedPlatform: resolution.normalizedPlatform } : {}),
      ...(resolution.resolutionSource !== undefined ? { resolutionSource: resolution.resolutionSource } : {}),
      ...(resolution.resolutionReason !== undefined ? { resolutionReason: resolution.resolutionReason } : {}),
      ...(resolution.resolvedSystemName !== undefined ? { resolvedSystemName: resolution.resolvedSystemName } : {}),
      ...(resolution.resolvedConsoleId !== undefined ? { resolvedConsoleId: resolution.resolvedConsoleId } : {}),
      ...(resolution.matchedTitle !== undefined ? { matchedTitle: resolution.matchedTitle } : {}),
      ...(resolution.matchedPlatform !== undefined ? { matchedPlatform: resolution.matchedPlatform } : {}),
      ...(resolution.matchedGameId !== undefined ? { matchedGameId: resolution.matchedGameId } : {}),
      ...(resolution.candidateCount !== undefined ? { candidateCount: resolution.candidateCount } : {}),
      ...(resolution.detailLoadStatus !== undefined ? { detailLoadStatus: resolution.detailLoadStatus } : {}),
      ...(resolution.detailLoadReason !== undefined ? { detailLoadReason: resolution.detailLoadReason } : {}),
      ...(resolution.hashResolverAttempted !== undefined ? { hashResolverAttempted: resolution.hashResolverAttempted } : {}),
      ...(resolution.hashResolverSkippedReason !== undefined
        ? { hashResolverSkippedReason: resolution.hashResolverSkippedReason }
        : {}),
      ...(resolution.shortcutRomPathDetected !== undefined
        ? { shortcutRomPathDetected: resolution.shortcutRomPathDetected }
        : {}),
      ...(resolution.shortcutRomPathSource !== undefined ? { shortcutRomPathSource: resolution.shortcutRomPathSource } : {}),
      ...(resolution.romHashAttempted !== undefined ? { romHashAttempted: resolution.romHashAttempted } : {}),
      ...(resolution.romHashStatus !== undefined ? { romHashStatus: resolution.romHashStatus } : {}),
      ...(resolution.romHashAlgorithm !== undefined ? { romHashAlgorithm: resolution.romHashAlgorithm } : {}),
      ...(resolution.romHashPrefix !== undefined ? { romHashPrefix: resolution.romHashPrefix } : {}),
      ...(resolution.raHashLookupAttempted !== undefined
        ? { raHashLookupAttempted: resolution.raHashLookupAttempted }
        : {}),
      ...(resolution.raHashLookupStatus !== undefined ? { raHashLookupStatus: resolution.raHashLookupStatus } : {}),
      ...(resolution.raHashMatchedGameId !== undefined ? { raHashMatchedGameId: resolution.raHashMatchedGameId } : {}),
      ...(resolution.raHashMatchedTitle !== undefined ? { raHashMatchedTitle: resolution.raHashMatchedTitle } : {}),
      ...(resolution.raHashMatchedConsoleId !== undefined
        ? { raHashMatchedConsoleId: resolution.raHashMatchedConsoleId }
        : {}),
      ...(resolution.raHashMatchedConsoleName !== undefined
        ? { raHashMatchedConsoleName: resolution.raHashMatchedConsoleName }
        : {}),
      ...(resolution.hashRejectedReason !== undefined ? { hashRejectedReason: resolution.hashRejectedReason } : {}),
      ...(resolution.finalResolverSource !== undefined ? { finalResolverSource: resolution.finalResolverSource } : {}),
    });
    return;
  }

  if (resolution.status === "error") {
    markAchievementCompanionRetroAchievementsShortcutResolution({
      appId: resolution.appId,
      status: "error",
      reason: resolution.message,
      error: resolution.message,
      ...(resolution.shortcutTitle !== undefined ? { shortcutTitle: resolution.shortcutTitle } : {}),
      ...(resolution.shortcutPlatform !== undefined ? { shortcutPlatform: resolution.shortcutPlatform } : {}),
      ...(resolution.normalizedPlatform !== undefined ? { normalizedPlatform: resolution.normalizedPlatform } : {}),
      ...(resolution.resolutionSource !== undefined ? { resolutionSource: resolution.resolutionSource } : {}),
      ...(resolution.resolutionReason !== undefined ? { resolutionReason: resolution.resolutionReason } : {}),
      ...(resolution.resolvedSystemName !== undefined ? { resolvedSystemName: resolution.resolvedSystemName } : {}),
      ...(resolution.resolvedConsoleId !== undefined ? { resolvedConsoleId: resolution.resolvedConsoleId } : {}),
      ...(resolution.matchedTitle !== undefined ? { matchedTitle: resolution.matchedTitle } : {}),
      ...(resolution.matchedPlatform !== undefined ? { matchedPlatform: resolution.matchedPlatform } : {}),
      ...(resolution.matchedGameId !== undefined ? { matchedGameId: resolution.matchedGameId } : {}),
      ...(resolution.candidateCount !== undefined ? { candidateCount: resolution.candidateCount } : {}),
      ...(resolution.detailLoadStatus !== undefined ? { detailLoadStatus: resolution.detailLoadStatus } : {}),
      ...(resolution.detailLoadReason !== undefined ? { detailLoadReason: resolution.detailLoadReason } : {}),
      ...(resolution.hashResolverAttempted !== undefined ? { hashResolverAttempted: resolution.hashResolverAttempted } : {}),
      ...(resolution.hashResolverSkippedReason !== undefined
        ? { hashResolverSkippedReason: resolution.hashResolverSkippedReason }
        : {}),
      ...(resolution.shortcutRomPathDetected !== undefined
        ? { shortcutRomPathDetected: resolution.shortcutRomPathDetected }
        : {}),
      ...(resolution.shortcutRomPathSource !== undefined ? { shortcutRomPathSource: resolution.shortcutRomPathSource } : {}),
      ...(resolution.romHashAttempted !== undefined ? { romHashAttempted: resolution.romHashAttempted } : {}),
      ...(resolution.romHashStatus !== undefined ? { romHashStatus: resolution.romHashStatus } : {}),
      ...(resolution.romHashAlgorithm !== undefined ? { romHashAlgorithm: resolution.romHashAlgorithm } : {}),
      ...(resolution.romHashPrefix !== undefined ? { romHashPrefix: resolution.romHashPrefix } : {}),
      ...(resolution.raHashLookupAttempted !== undefined
        ? { raHashLookupAttempted: resolution.raHashLookupAttempted }
        : {}),
      ...(resolution.raHashLookupStatus !== undefined ? { raHashLookupStatus: resolution.raHashLookupStatus } : {}),
      ...(resolution.raHashMatchedGameId !== undefined ? { raHashMatchedGameId: resolution.raHashMatchedGameId } : {}),
      ...(resolution.raHashMatchedTitle !== undefined ? { raHashMatchedTitle: resolution.raHashMatchedTitle } : {}),
      ...(resolution.raHashMatchedConsoleId !== undefined
        ? { raHashMatchedConsoleId: resolution.raHashMatchedConsoleId }
        : {}),
      ...(resolution.raHashMatchedConsoleName !== undefined
        ? { raHashMatchedConsoleName: resolution.raHashMatchedConsoleName }
        : {}),
      ...(resolution.hashRejectedReason !== undefined ? { hashRejectedReason: resolution.hashRejectedReason } : {}),
      ...(resolution.finalResolverSource !== undefined ? { finalResolverSource: resolution.finalResolverSource } : {}),
    });
    return;
  }

  markAchievementCompanionRetroAchievementsShortcutResolution({
    appId: resolution.appId,
    status: "unavailable",
    reason: resolution.reason,
    ...(resolution.shortcutTitle !== undefined ? { shortcutTitle: resolution.shortcutTitle } : {}),
    ...(resolution.shortcutPlatform !== undefined ? { shortcutPlatform: resolution.shortcutPlatform } : {}),
    ...(resolution.normalizedPlatform !== undefined ? { normalizedPlatform: resolution.normalizedPlatform } : {}),
    ...(resolution.resolutionSource !== undefined ? { resolutionSource: resolution.resolutionSource } : {}),
    ...(resolution.resolutionReason !== undefined ? { resolutionReason: resolution.resolutionReason } : {}),
    ...(resolution.resolvedSystemName !== undefined ? { resolvedSystemName: resolution.resolvedSystemName } : {}),
    ...(resolution.resolvedConsoleId !== undefined ? { resolvedConsoleId: resolution.resolvedConsoleId } : {}),
    ...(resolution.matchedTitle !== undefined ? { matchedTitle: resolution.matchedTitle } : {}),
    ...(resolution.matchedPlatform !== undefined ? { matchedPlatform: resolution.matchedPlatform } : {}),
    ...(resolution.matchedGameId !== undefined ? { matchedGameId: resolution.matchedGameId } : {}),
    ...(resolution.candidateCount !== undefined ? { candidateCount: resolution.candidateCount } : {}),
    ...(resolution.detailLoadStatus !== undefined ? { detailLoadStatus: resolution.detailLoadStatus } : {}),
    ...(resolution.detailLoadReason !== undefined ? { detailLoadReason: resolution.detailLoadReason } : {}),
    ...(resolution.hashResolverAttempted !== undefined ? { hashResolverAttempted: resolution.hashResolverAttempted } : {}),
    ...(resolution.hashResolverSkippedReason !== undefined
      ? { hashResolverSkippedReason: resolution.hashResolverSkippedReason }
      : {}),
    ...(resolution.shortcutRomPathDetected !== undefined
      ? { shortcutRomPathDetected: resolution.shortcutRomPathDetected }
      : {}),
    ...(resolution.shortcutRomPathSource !== undefined ? { shortcutRomPathSource: resolution.shortcutRomPathSource } : {}),
    ...(resolution.romHashAttempted !== undefined ? { romHashAttempted: resolution.romHashAttempted } : {}),
    ...(resolution.romHashStatus !== undefined ? { romHashStatus: resolution.romHashStatus } : {}),
    ...(resolution.romHashAlgorithm !== undefined ? { romHashAlgorithm: resolution.romHashAlgorithm } : {}),
    ...(resolution.romHashPrefix !== undefined ? { romHashPrefix: resolution.romHashPrefix } : {}),
    ...(resolution.raHashLookupAttempted !== undefined
      ? { raHashLookupAttempted: resolution.raHashLookupAttempted }
      : {}),
    ...(resolution.raHashLookupStatus !== undefined ? { raHashLookupStatus: resolution.raHashLookupStatus } : {}),
    ...(resolution.raHashMatchedGameId !== undefined ? { raHashMatchedGameId: resolution.raHashMatchedGameId } : {}),
    ...(resolution.raHashMatchedTitle !== undefined ? { raHashMatchedTitle: resolution.raHashMatchedTitle } : {}),
    ...(resolution.raHashMatchedConsoleId !== undefined
      ? { raHashMatchedConsoleId: resolution.raHashMatchedConsoleId }
      : {}),
    ...(resolution.raHashMatchedConsoleName !== undefined
      ? { raHashMatchedConsoleName: resolution.raHashMatchedConsoleName }
      : {}),
    ...(resolution.hashRejectedReason !== undefined ? { hashRejectedReason: resolution.hashRejectedReason } : {}),
    ...(resolution.finalResolverSource !== undefined ? { finalResolverSource: resolution.finalResolverSource } : {}),
  });
}

async function buildRetroAchievementsReadySummary(
  appId: string,
  resolution: Extract<RetroAchievementsShortcutResolution, { readonly status: "mapped" }>,
): Promise<GamePageAchievementSummary> {
  let platformLabel = resolution.platformLabel;
  let systemIconUrl = resolution.systemIconUrl;

  if (systemIconUrl === undefined && platformLabel !== undefined) {
    const resolvedSystem = await resolveRetroAchievementsSystemMetadataForPlatform(platformLabel);
    if (resolvedSystem?.systemIconUrl !== undefined) {
      systemIconUrl = resolvedSystem.systemIconUrl;
    }
  }

  return createReadySummary({
    provider: "retroachievements",
    appId,
    gameId: resolution.raGameId,
    title: resolution.title,
    ...(platformLabel !== undefined ? { platformLabel } : {}),
    ...(systemIconUrl !== undefined ? { systemIconUrl } : {}),
    earned: resolution.earned,
    total: resolution.total,
    source:
      "backend",
    ...(resolution.updatedAt !== undefined ? { updatedAt: resolution.updatedAt } : {}),
    ...(resolution.completionStatus !== undefined
      ? { completionStatus: resolution.completionStatus }
      : {}),
  });
}

async function attemptRetroAchievementsShortcutHashResolution(
  appId: string,
  shortcutMetadata: DeckySteamShortcutMetadata | undefined,
): Promise<RetroAchievementsShortcutHashAttempt> {
  updateAchievementCompanionRaShortcutResolutionDebug({
    appId,
    clearKeys: ["romCandidateCount", "candidateExtension", "archiveMemberExtension", "candidateResults", "candidateRejections", "raHashCatalogueMatchCount", "catalogueSource", "catalogueCacheStatus", "catalogueEntryCount", "catalogueHashCount"],
  });
  if (shortcutMetadata === undefined) {
    return {
      status: "skipped",
      appId,
      reason: "shortcut-metadata-unavailable",
      shortcutRomPathDetected: false,
      romHashAttempted: false,
      finalResolverSource: "unavailable",
    };
  }

  const rawShortcutPlatform =
    shortcutMetadata.platformTag ?? shortcutMetadata.platformLabel ?? shortcutMetadata.tags?.[0];
  const platformSource = shortcutMetadata.platformTag !== undefined
    ? "platformTag"
    : shortcutMetadata.platformLabel !== undefined
      ? "platformLabel"
      : shortcutMetadata.tags?.[0] !== undefined
        ? "tags"
        : undefined;
  const shortcutPlatform = normalizeRetroAchievementsShortcutPlatform(shortcutMetadata);
  let system: RetroAchievementsResolvedSystemMetadata | undefined;
  try {
    system = shortcutPlatform !== undefined
      ? await resolveRetroAchievementsSystemMetadataForPlatform(shortcutPlatform)
      : undefined;
  } catch {
    system = undefined;
  }
  const consoleId = system !== undefined ? Number(system.consoleId) : undefined;
  const hashInfo = consoleId !== undefined && Number.isInteger(consoleId)
    ? await loadDeckySteamShortcutRomHashInfo(appId, consoleId)
    : undefined;
  const romHashPrefix = normalizeRetroAchievementsRomHashPreview(hashInfo?.romHash);
  const hashResolverAttempted = true;

  updateAchievementCompanionRaShortcutResolutionDebug({
    appId,
    shortcutMetadataLoaded: true,
    ...(shortcutMetadata.title !== undefined ? { shortcutTitle: shortcutMetadata.title } : {}),
    ...(rawShortcutPlatform !== undefined ? { shortcutPlatform: rawShortcutPlatform } : {}),
    ...(platformSource !== undefined ? { platformSource } : {}),
    ...(shortcutPlatform !== undefined ? { normalizedPlatform: shortcutPlatform } : {}),
    ...(system !== undefined ? { resolvedConsoleId: system.consoleId, resolvedSystemName: system.systemName } : {}),
    steamSkippedBecauseShortcut: true,
    resolverStage: "rom-hash",
    hashResolverAttempted,
    ...(hashInfo !== undefined ? { shortcutRomPathDetected: hashInfo.shortcutRomPathDetected } : {}),
    ...(hashInfo?.shortcutRomPathSource !== undefined ? { shortcutRomPathSource: hashInfo.shortcutRomPathSource } : {}),
    ...(hashInfo?.candidateCount !== undefined ? { romCandidateCount: hashInfo.candidateCount } : {}),
    ...(hashInfo?.candidateExtension !== undefined ? { candidateExtension: hashInfo.candidateExtension } : {}),
    ...(hashInfo?.archiveMemberExtension !== undefined ? { archiveMemberExtension: hashInfo.archiveMemberExtension } : {}),
    ...(hashInfo?.candidateResults !== undefined ? { candidateResults: hashInfo.candidateResults } : {}),
    ...(hashInfo?.candidateRejections !== undefined ? { candidateRejections: hashInfo.candidateRejections } : {}),
    ...(hashInfo !== undefined ? { romHashAttempted: hashInfo.romHashAttempted } : {}),
    ...(hashInfo !== undefined ? { romHashStatus: hashInfo.romHashStatus } : {}),
    ...(hashInfo?.romHashAlgorithm !== undefined ? { romHashAlgorithm: hashInfo.romHashAlgorithm } : {}),
    ...(romHashPrefix !== undefined ? { romHashPrefix } : {}),
    ...(hashInfo?.hashResolverSkippedReason !== undefined
      ? { hashResolverSkippedReason: hashInfo.hashResolverSkippedReason }
      : {}),
    ...(hashInfo?.hashRejectedReason !== undefined ? { hashRejectedReason: hashInfo.hashRejectedReason } : {}),
    finalResolverSource: "unavailable",
    clearKeys: [
      "hashResolverAttempted",
      "hashResolverSkippedReason",
      "shortcutRomPathDetected",
      "shortcutRomPathSource",
      "romHashAttempted",
      "romHashStatus",
      "romHashAlgorithm",
      "romHashPrefix",
      "raHashLookupAttempted",
      "raHashLookupStatus",
      "raHashMatchedGameId",
      "raHashMatchedTitle",
      "raHashMatchedConsoleId",
      "raHashMatchedConsoleName",
      "hashRejectedReason",
      "finalResolverSource",
      "returnedSummaryProvider",
      "returnedSummaryEarned",
      "returnedSummaryTotal",
      "detailGameId",
      "detailTitle",
      "detailPlatformLabel",
      "detailEarned",
      "detailEarnedHardcore",
      "detailTotal",
      "detailLoadStatus",
      "detailLoadReason",
    ],
  });

  if (hashInfo === undefined) {
    return {
      status: "skipped",
      appId,
      reason: "console-id-unavailable",
      shortcutRomPathDetected: false,
      romHashAttempted: false,
      finalResolverSource: "unavailable",
    };
  }

  if (hashInfo.romHashStatus !== "resolved" || hashInfo.romHash === undefined) {
    return {
      status: "skipped",
      appId,
      reason: hashInfo.hashResolverSkippedReason ?? "rom-hash-unavailable",
      shortcutRomPathDetected: hashInfo.shortcutRomPathDetected,
      ...(hashInfo.shortcutRomPathSource !== undefined ? { shortcutRomPathSource: hashInfo.shortcutRomPathSource } : {}),
      romHashAttempted: hashInfo.romHashAttempted,
      ...(hashInfo.romHashStatus !== undefined ? { romHashStatus: hashInfo.romHashStatus } : {}),
      ...(hashInfo.romHashAlgorithm !== undefined ? { romHashAlgorithm: hashInfo.romHashAlgorithm } : {}),
      ...(romHashPrefix !== undefined ? { romHashPrefix } : {}),
      ...(hashInfo.hashRejectedReason !== undefined ? { hashRejectedReason: hashInfo.hashRejectedReason } : {}),
      finalResolverSource: "unavailable",
    };
  }

  // A resolved hash can only exist after the platform produced a console ID.
  const resolvedPlatform = shortcutPlatform!;
  let apiGameListResult: RetroAchievementsGameListCandidatesLoadResult;
  try {
    apiGameListResult = await loadRetroAchievementsGameListCandidatesForPlatform(resolvedPlatform);
  } catch (error: unknown) {
    apiGameListResult = {
      status: "unavailable",
      normalizedPlatform: resolvedPlatform,
      candidates: [],
      reason: error instanceof Error && ["catalogue-incomplete", "catalogue-console-mismatch"].includes(error.message)
        ? error.message
        : "catalogue-unavailable",
    };
  }

  if (apiGameListResult.status === "unsupported") {
    updateAchievementCompanionRaShortcutResolutionDebug({
      appId,
      hashResolverAttempted,
      shortcutRomPathDetected: hashInfo.shortcutRomPathDetected,
      ...(hashInfo.shortcutRomPathSource !== undefined ? { shortcutRomPathSource: hashInfo.shortcutRomPathSource } : {}),
      romHashAttempted: hashInfo.romHashAttempted,
      romHashStatus: hashInfo.romHashStatus,
      ...(hashInfo.romHashAlgorithm !== undefined ? { romHashAlgorithm: hashInfo.romHashAlgorithm } : {}),
      ...(romHashPrefix !== undefined ? { romHashPrefix } : {}),
      raHashLookupAttempted: false,
      raHashLookupStatus: "unsupported",
      hashRejectedReason: "ra-platform-unsupported",
      finalResolverSource: "unavailable",
    });
    return {
      status: "skipped",
      appId,
      reason: "ra-platform-unsupported",
      shortcutRomPathDetected: hashInfo.shortcutRomPathDetected,
      ...(hashInfo.shortcutRomPathSource !== undefined ? { shortcutRomPathSource: hashInfo.shortcutRomPathSource } : {}),
      romHashAttempted: hashInfo.romHashAttempted,
      romHashStatus: hashInfo.romHashStatus,
      ...(hashInfo.romHashAlgorithm !== undefined ? { romHashAlgorithm: hashInfo.romHashAlgorithm } : {}),
      ...(romHashPrefix !== undefined ? { romHashPrefix } : {}),
      raHashLookupAttempted: false,
      raHashLookupStatus: "unsupported",
      hashRejectedReason: "ra-platform-unsupported",
      finalResolverSource: "unavailable",
    };
  }

  if (apiGameListResult.status === "unavailable") {
    const reason = apiGameListResult.reason ?? "catalogue-unavailable";
    updateAchievementCompanionRaShortcutResolutionDebug({
      appId,
      catalogueSource: "API_GetGameList",
      catalogueCacheStatus: "unavailable",
      raHashLookupAttempted: false,
      raHashLookupStatus: "unavailable",
      hashRejectedReason: reason,
      finalResolverSource: "unavailable",
    });
    return {
      status: "skipped",
      appId,
      reason,
      shortcutRomPathDetected: hashInfo.shortcutRomPathDetected,
      ...(hashInfo.shortcutRomPathSource !== undefined ? { shortcutRomPathSource: hashInfo.shortcutRomPathSource } : {}),
      romHashAttempted: hashInfo.romHashAttempted,
      romHashStatus: hashInfo.romHashStatus,
      ...(hashInfo.romHashAlgorithm !== undefined ? { romHashAlgorithm: hashInfo.romHashAlgorithm } : {}),
      ...(romHashPrefix !== undefined ? { romHashPrefix } : {}),
      raHashLookupAttempted: false,
      raHashLookupStatus: "unavailable",
      hashRejectedReason: reason,
      finalResolverSource: "unavailable",
    };
  }

  const hashCandidates = collectRetroAchievementsGameListCandidatesForHash(
    apiGameListResult.candidates,
    hashInfo.romHash,
  );
  const hashLookupStatus =
    hashCandidates.length === 1 ? "matched" : hashCandidates.length > 1 ? "ambiguous" : "no-match";
  const hashRejectedReason =
    hashLookupStatus === "matched"
      ? undefined
      : hashLookupStatus === "ambiguous"
        ? "ambiguous-hash-match"
        : "hash-not-in-ra-catalogue";
  updateAchievementCompanionRaShortcutResolutionDebug({
    appId,
    catalogueSource: "API_GetGameList",
    catalogueCacheStatus: apiGameListResult.cacheStatus,
    catalogueEntryCount: apiGameListResult.candidates.length,
    catalogueHashCount: apiGameListResult.candidates.reduce((total, candidate) => total + (candidate.hashes?.length ?? 0), 0),
    hashResolverAttempted,
    shortcutRomPathDetected: hashInfo.shortcutRomPathDetected,
    ...(hashInfo.shortcutRomPathSource !== undefined ? { shortcutRomPathSource: hashInfo.shortcutRomPathSource } : {}),
    romHashAttempted: hashInfo.romHashAttempted,
    romHashStatus: hashInfo.romHashStatus,
    ...(hashInfo.romHashAlgorithm !== undefined ? { romHashAlgorithm: hashInfo.romHashAlgorithm } : {}),
    ...(romHashPrefix !== undefined ? { romHashPrefix } : {}),
    raHashLookupAttempted: true,
    raHashLookupStatus: hashLookupStatus,
    raHashCatalogueMatchCount: hashCandidates.length,
    ...(hashCandidates.length === 1
      ? {
          raHashMatchedGameId: hashCandidates[0]!.gameId,
          raHashMatchedTitle: hashCandidates[0]!.title,
          ...(apiGameListResult.status === "resolved"
            ? {
                raHashMatchedConsoleId: apiGameListResult.system.consoleId,
                raHashMatchedConsoleName: apiGameListResult.system.systemName,
              }
            : {}),
        }
      : {}),
    ...(hashRejectedReason !== undefined ? { hashRejectedReason } : {}),
    finalResolverSource: hashLookupStatus === "matched" ? "hash" : "unavailable",
  });

  if (hashCandidates.length !== 1) {
    return {
      status: "skipped",
      appId,
      reason: hashRejectedReason ?? "hash-not-in-ra-catalogue",
      shortcutRomPathDetected: hashInfo.shortcutRomPathDetected,
      ...(hashInfo.shortcutRomPathSource !== undefined ? { shortcutRomPathSource: hashInfo.shortcutRomPathSource } : {}),
      romHashAttempted: hashInfo.romHashAttempted,
      romHashStatus: hashInfo.romHashStatus,
      ...(hashInfo.romHashAlgorithm !== undefined ? { romHashAlgorithm: hashInfo.romHashAlgorithm } : {}),
      ...(romHashPrefix !== undefined ? { romHashPrefix } : {}),
      raHashLookupAttempted: true,
      raHashLookupStatus: hashLookupStatus,
      ...(hashRejectedReason !== undefined ? { hashRejectedReason } : {}),
      finalResolverSource: "unavailable",
    };
  }

  const matchingCandidate = hashCandidates[0]!;
  let gameDetailState: Awaited<ReturnType<typeof loadDeckyGameDetailStateLazy>>;
  try {
    gameDetailState = await loadDeckyGameDetailStateLazy(RETROACHIEVEMENTS_PROVIDER_ID, matchingCandidate.gameId, {
      forceRefresh: false,
    });
    if (gameDetailState.status !== "success" || gameDetailState.isStale) {
      gameDetailState = await loadDeckyGameDetailStateLazy(RETROACHIEVEMENTS_PROVIDER_ID, matchingCandidate.gameId, {
        forceRefresh: true,
      });
    }
  } catch {
    return {
      status: "skipped",
      appId,
      reason: "ra-detail-unavailable",
      shortcutRomPathDetected: hashInfo.shortcutRomPathDetected,
      ...(hashInfo.shortcutRomPathSource !== undefined ? { shortcutRomPathSource: hashInfo.shortcutRomPathSource } : {}),
      romHashAttempted: hashInfo.romHashAttempted,
      romHashStatus: hashInfo.romHashStatus,
      ...(hashInfo.romHashAlgorithm !== undefined ? { romHashAlgorithm: hashInfo.romHashAlgorithm } : {}),
      ...(romHashPrefix !== undefined ? { romHashPrefix } : {}),
      raHashLookupAttempted: true,
      raHashLookupStatus: "matched",
      raHashMatchedGameId: matchingCandidate.gameId,
      raHashMatchedTitle: matchingCandidate.title,
      hashRejectedReason: "ra-detail-unavailable",
      finalResolverSource: "unavailable",
    };
  }

  const game = gameDetailState.data?.game;
  if (
    gameDetailState.status === "success" &&
    game !== undefined &&
    game.summary.totalCount !== undefined &&
    game.summary.totalCount > 0
  ) {
    const completionStatus = normalizeRetroAchievementsCompletionStatus(
      game.status,
      getRetroAchievementsHighestAwardKind(game),
    );
    return {
      status: "mapped",
      appId,
      raGameId: game.gameId,
      title: game.title,
      ...(game.platformLabel !== undefined ? { platformLabel: game.platformLabel } : {}),
      ...(game.systemIconUrl !== undefined ? { systemIconUrl: game.systemIconUrl } : {}),
      earned: game.summary.unlockedCount,
      total: game.summary.totalCount,
      source: "ra-hash-game-detail",
      confidence: "exact",
      reason: "ra-hash-match",
      ...(gameDetailState.lastUpdatedAt !== undefined
        ? { updatedAt: new Date(gameDetailState.lastUpdatedAt).toISOString() }
        : {}),
      ...(completionStatus !== undefined ? { completionStatus } : {}),
      shortcutRomPathDetected: hashInfo.shortcutRomPathDetected,
      ...(hashInfo.shortcutRomPathSource !== undefined ? { shortcutRomPathSource: hashInfo.shortcutRomPathSource } : {}),
      romHashAttempted: hashInfo.romHashAttempted,
      romHashStatus: hashInfo.romHashStatus,
      ...(hashInfo.romHashAlgorithm !== undefined ? { romHashAlgorithm: hashInfo.romHashAlgorithm } : {}),
      raHashLookupAttempted: true,
      raHashLookupStatus: "matched",
      raHashMatchedGameId: matchingCandidate.gameId,
      raHashMatchedTitle: matchingCandidate.title,
      ...(apiGameListResult.status === "resolved"
        ? {
            raHashMatchedConsoleId: apiGameListResult.system.consoleId,
            raHashMatchedConsoleName: apiGameListResult.system.systemName,
          }
        : {}),
      ...(romHashPrefix !== undefined ? { romHashPrefix } : {}),
      finalResolverSource: "hash",
    };
  }

  return {
    status: "skipped",
    appId,
    reason: "ra-detail-unavailable",
    shortcutRomPathDetected: hashInfo.shortcutRomPathDetected,
    ...(hashInfo.shortcutRomPathSource !== undefined ? { shortcutRomPathSource: hashInfo.shortcutRomPathSource } : {}),
    romHashAttempted: hashInfo.romHashAttempted,
    romHashStatus: hashInfo.romHashStatus,
    ...(hashInfo.romHashAlgorithm !== undefined ? { romHashAlgorithm: hashInfo.romHashAlgorithm } : {}),
    ...(romHashPrefix !== undefined ? { romHashPrefix } : {}),
    hashRejectedReason: "ra-detail-unavailable",
    finalResolverSource: "unavailable",
  };
}

async function resolveSummaryFromRetroAchievementsShortcut(
  appId: string,
  shortcutMetadataOverride?: DeckySteamShortcutMetadata,
  options?: {
    readonly steamSkippedBecauseShortcut?: boolean;
  },
): Promise<RetroAchievementsShortcutResolution> {
  const staleResultDebugFieldsToClear: readonly (
    | "returnedSummaryProvider"
    | "returnedSummaryEarned"
    | "returnedSummaryTotal"
    | "detailGameId"
    | "detailTitle"
    | "detailPlatformLabel"
    | "detailEarned"
    | "detailEarnedHardcore"
    | "detailTotal"
    | "detailLoadStatus"
    | "detailLoadReason"
    | "completionStatusEnrichmentAttempted"
    | "completionStatusEnrichmentStatus"
    | "completionStatusEnrichmentSource"
    | "completionStatusEnrichmentGameId"
    | "enrichedCompletionStatus"
    | "hashResolverAttempted"
    | "hashResolverSkippedReason"
    | "shortcutRomPathDetected"
    | "shortcutRomPathSource"
    | "romHashAttempted"
    | "romHashStatus"
    | "romHashAlgorithm"
    | "romHashPrefix"
    | "raHashLookupAttempted"
    | "raHashLookupStatus"
    | "raHashMatchedGameId"
    | "raHashMatchedTitle"
    | "raHashMatchedConsoleId"
    | "raHashMatchedConsoleName"
    | "hashRejectedReason"
    | "finalResolverSource"
  )[] = [
    "returnedSummaryProvider",
    "returnedSummaryEarned",
    "returnedSummaryTotal",
    "detailGameId",
    "detailTitle",
    "detailPlatformLabel",
    "detailEarned",
    "detailEarnedHardcore",
    "detailTotal",
    "detailLoadStatus",
    "detailLoadReason",
    "completionStatusEnrichmentAttempted",
    "completionStatusEnrichmentStatus",
    "completionStatusEnrichmentSource",
    "completionStatusEnrichmentGameId",
    "enrichedCompletionStatus",
    "hashResolverAttempted",
    "hashResolverSkippedReason",
    "shortcutRomPathDetected",
    "shortcutRomPathSource",
    "romHashAttempted",
    "romHashStatus",
    "romHashAlgorithm",
    "romHashPrefix",
    "raHashLookupAttempted",
    "raHashLookupStatus",
    "raHashMatchedGameId",
    "raHashMatchedTitle",
    "raHashMatchedConsoleId",
    "raHashMatchedConsoleName",
    "hashRejectedReason",
    "finalResolverSource",
  ];

  try {
    const shortcutMetadata = shortcutMetadataOverride ?? (await loadDeckySteamShortcutMetadata(appId));
    const rawShortcutTitle = shortcutMetadata?.title;
    const rawShortcutPlatform =
      shortcutMetadata?.platformTag ?? shortcutMetadata?.platformLabel ?? shortcutMetadata?.tags?.[0];
    const shortcutPlatform = normalizeRetroAchievementsShortcutPlatform(shortcutMetadata);
    updateAchievementCompanionRaShortcutResolutionDebug({
      appId,
      shortcutMetadataLoaded: shortcutMetadata !== undefined,
      ...(rawShortcutTitle !== undefined ? { shortcutTitle: rawShortcutTitle } : {}),
      ...(rawShortcutPlatform !== undefined ? { shortcutPlatform: rawShortcutPlatform } : {}),
      ...(shortcutPlatform !== undefined ? { normalizedPlatform: shortcutPlatform } : {}),
      steamSkippedBecauseShortcut: options?.steamSkippedBecauseShortcut === true,
      resolverStage: "shortcut-metadata",
      detailLoadAttempted: false,
      clearKeys: staleResultDebugFieldsToClear,
    });
    const debugBase = {
      shortcutTitle: rawShortcutTitle,
      shortcutPlatform: rawShortcutPlatform,
      normalizedPlatform: shortcutPlatform,
    } as const;
    const markResolution = (
      resolution: RetroAchievementsShortcutResolution,
      extra: Omit<RetroAchievementsShortcutResolutionDebugArgs, keyof RetroAchievementsShortcutResolution> = {},
    ): void => {
      const clearKeys =
        resolvedHashResolutionSkipReason === undefined || extra.clearKeys === undefined
          ? extra.clearKeys
          : extra.clearKeys.filter((clearKey) => clearKey !== "hashResolverSkippedReason");
      markRetroAchievementsShortcutResolution({
        ...resolution,
        ...debugBase,
        ...(resolvedHashResolutionSkipReason !== undefined
          ? { hashResolverSkippedReason: resolvedHashResolutionSkipReason }
          : {}),
        ...extra,
        ...(resolvedHashResolutionSkipReason !== undefined
          ? { hashResolverSkippedReason: resolvedHashResolutionSkipReason }
          : {}),
        ...(clearKeys !== undefined ? { clearKeys } : {}),
      });
    };

    const hashResolution = await attemptRetroAchievementsShortcutHashResolution(appId, shortcutMetadata);
    const resolvedHashResolutionSkipReason =
      hashResolution.status === "skipped"
        ? hashResolution.hashResolverSkippedReason ?? hashResolution.reason
        : undefined;
    const hashResolutionDebugFields =
      hashResolution.status === "error"
        ? { hashResolverAttempted: true, finalResolverSource: "unavailable" as const }
        : {
            hashResolverAttempted: true,
            ...(hashResolution.shortcutRomPathDetected !== undefined
              ? { shortcutRomPathDetected: hashResolution.shortcutRomPathDetected }
              : {}),
            ...(hashResolution.shortcutRomPathSource !== undefined
              ? { shortcutRomPathSource: hashResolution.shortcutRomPathSource }
              : {}),
            ...(hashResolution.romHashAttempted !== undefined ? { romHashAttempted: hashResolution.romHashAttempted } : {}),
            ...(hashResolution.romHashStatus !== undefined ? { romHashStatus: hashResolution.romHashStatus } : {}),
            ...(hashResolution.romHashAlgorithm !== undefined ? { romHashAlgorithm: hashResolution.romHashAlgorithm } : {}),
            ...(hashResolution.romHashPrefix !== undefined ? { romHashPrefix: hashResolution.romHashPrefix } : {}),
            ...(hashResolution.hashResolverSkippedReason !== undefined
              ? { hashResolverSkippedReason: hashResolution.hashResolverSkippedReason }
              : {}),
            ...(hashResolution.raHashLookupAttempted !== undefined
              ? { raHashLookupAttempted: hashResolution.raHashLookupAttempted }
              : {}),
            ...(hashResolution.raHashLookupStatus !== undefined
              ? { raHashLookupStatus: hashResolution.raHashLookupStatus }
              : {}),
            ...(hashResolution.raHashMatchedGameId !== undefined
              ? { raHashMatchedGameId: hashResolution.raHashMatchedGameId }
              : {}),
            ...(hashResolution.raHashMatchedTitle !== undefined
              ? { raHashMatchedTitle: hashResolution.raHashMatchedTitle }
              : {}),
            ...(hashResolution.raHashMatchedConsoleId !== undefined
              ? { raHashMatchedConsoleId: hashResolution.raHashMatchedConsoleId }
              : {}),
            ...(hashResolution.raHashMatchedConsoleName !== undefined
              ? { raHashMatchedConsoleName: hashResolution.raHashMatchedConsoleName }
              : {}),
            ...(hashResolution.hashRejectedReason !== undefined
              ? { hashRejectedReason: hashResolution.hashRejectedReason }
              : {}),
            ...(hashResolution.finalResolverSource !== undefined
              ? { finalResolverSource: hashResolution.finalResolverSource }
              : {}),
          };
    if (hashResolution.status === "mapped") {
      const mappedResolution: RetroAchievementsShortcutResolution = {
        status: "mapped",
        appId,
        raGameId: hashResolution.raGameId,
        title: hashResolution.title,
        ...(hashResolution.platformLabel !== undefined ? { platformLabel: hashResolution.platformLabel } : {}),
        ...(hashResolution.systemIconUrl !== undefined ? { systemIconUrl: hashResolution.systemIconUrl } : {}),
        earned: hashResolution.earned,
        total: hashResolution.total,
        source: hashResolution.source,
        confidence: hashResolution.confidence,
        ...(hashResolution.reason !== undefined ? { reason: hashResolution.reason } : {}),
        ...(hashResolution.updatedAt !== undefined ? { updatedAt: hashResolution.updatedAt } : {}),
        ...(hashResolution.completionStatus !== undefined
          ? { completionStatus: hashResolution.completionStatus }
          : {}),
      };
      markResolution(mappedResolution, {
        resolutionSource: "ra-hash-game-detail",
        resolutionReason: "ra-hash-match",
        matchedTitle: hashResolution.title,
        matchedPlatform: hashResolution.platformLabel,
        matchedGameId: hashResolution.raGameId,
        candidateCount: 1,
        ...(hashResolution.raHashMatchedConsoleId !== undefined
          ? { resolvedConsoleId: hashResolution.raHashMatchedConsoleId }
          : {}),
        ...(hashResolution.raHashMatchedConsoleName !== undefined
          ? { resolvedSystemName: hashResolution.raHashMatchedConsoleName }
          : {}),
        detailLoadStatus: "success",
        ...hashResolutionDebugFields,
      });
      return mappedResolution;
    }

    if (hashResolution.status === "error") {
      const errorSummary: GamePageAchievementSummary = {
        status: "error",
        appId,
        message: hashResolution.message,
      };
      markAchievementCompanionGamePageAchievementSummaryFetchCompleted(errorSummary);
      return errorSummary;
    }

    const unavailableResolution: RetroAchievementsShortcutResolution = {
      status: "unavailable",
      appId,
      reason: hashResolution.reason,
    };
    markResolution(unavailableResolution, {
      ...hashResolutionDebugFields,
      resolutionSource: "ra-hash-game-detail",
      resolutionReason: hashResolution.reason,
      finalResolverSource: "unavailable",
    });
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
    updateAchievementCompanionRaShortcutResolutionDebug({
      appId,
      finalStatus: "error",
      finalReason: message,
      thrownErrorMessage: message,
      clearKeys: staleResultDebugFieldsToClear,
    });
    markRetroAchievementsShortcutResolution({
      ...errorResolution,
      resolutionSource: "unavailable",
      resolutionReason: message,
      detailLoadStatus: "error",
      detailLoadReason: message,
      clearKeys: staleResultDebugFieldsToClear,
    });
    return errorResolution;
  }
}

export function formatDeckyGamePageAchievementBadgeLabel(
  summary: GamePageAchievementSummary | undefined,
): string | undefined {
  if (summary === undefined) {
    return formatDeckyGamePageAchievementBadgeLoadingText(undefined, getAchievementCompanionRuntimeDebugState());
  }

  if (summary?.status === "ready") {
    return `\u{1f3c6} ${String(summary.earned)} / ${String(summary.total)}`;
  }

  if (summary.status !== "loading") {
    return undefined;
  }

  return formatDeckyGamePageAchievementBadgeLoadingText(summary, getAchievementCompanionRuntimeDebugState());
}

async function loadRetroAchievementsCompletionStatusEnrichment(
  gameId: string,
): Promise<RetroAchievementsCompletionStatusEnrichmentResult> {
  const cachedEntry = retroAchievementsCompletionStatusEnrichmentCacheByGameId.get(gameId);
  if (
    cachedEntry !== undefined &&
    Date.now() - cachedEntry.storedAt <= GAME_PAGE_ACHIEVEMENT_SUMMARY_CACHE_TTL_MS
  ) {
    return cachedEntry.result;
  }

  const inFlight = retroAchievementsCompletionStatusEnrichmentInFlightByGameId.get(gameId);
  if (inFlight !== undefined) {
    return inFlight;
  }

  const loadPromise = (async (): Promise<RetroAchievementsCompletionStatusEnrichmentResult> => {
    try {
      const gameDetailState = await loadDeckyGameDetailStateLazy(
        RETROACHIEVEMENTS_PROVIDER_ID,
        gameId,
        { forceRefresh: false },
      );
      if (gameDetailState.status === "error") {
        return { status: "failed" };
      }

      const game = gameDetailState.data?.game;
      if (gameDetailState.status !== "success" || game === undefined) {
        return { status: "unavailable" };
      }

      const completionStatus = normalizeRetroAchievementsCompletionStatus(
        undefined,
        getRetroAchievementsHighestAwardKind(game),
      );
      if (completionStatus !== undefined) {
        return { status: "resolved", completionStatus };
      }

      return game.status === "in_progress" || game.status === "locked"
        ? { status: "resolved", completionStatus: "in-progress" }
        : { status: "unavailable" };
    } catch {
      return { status: "failed" };
    }
  })();

  retroAchievementsCompletionStatusEnrichmentInFlightByGameId.set(gameId, loadPromise);
  try {
    const result = await loadPromise;
    if (retroAchievementsCompletionStatusEnrichmentInFlightByGameId.get(gameId) === loadPromise) {
      retroAchievementsCompletionStatusEnrichmentCacheByGameId.set(gameId, {
        storedAt: Date.now(),
        result,
      });
    }
    return result;
  } finally {
    if (retroAchievementsCompletionStatusEnrichmentInFlightByGameId.get(gameId) === loadPromise) {
      retroAchievementsCompletionStatusEnrichmentInFlightByGameId.delete(gameId);
    }
  }
}

export async function enrichDeckyGamePageAchievementSummaryCompletionStatus(
  summary: GamePageAchievementSummary,
): Promise<GamePageAchievementSummary> {
  if (
    summary.status !== "ready" ||
    summary.provider !== "retroachievements" ||
    summary.completionStatus !== undefined
  ) {
    return summary;
  }

  if (summary.gameId === undefined) {
    return createUnavailableSummary(summary.appId, "ra-completion-status-game-id-unavailable");
  }

  updateAchievementCompanionRaShortcutResolutionDebug({
    completionStatusEnrichmentAttempted: true,
    completionStatusEnrichmentStatus: "loading",
    completionStatusEnrichmentSource: "ra-game-detail",
    completionStatusEnrichmentGameId: summary.gameId,
    clearKeys: ["enrichedCompletionStatus"],
  });
  const result = await loadRetroAchievementsCompletionStatusEnrichment(summary.gameId);
  if (result.status !== "resolved") {
    updateAchievementCompanionRaShortcutResolutionDebug({
      completionStatusEnrichmentAttempted: true,
      completionStatusEnrichmentStatus: result.status,
      completionStatusEnrichmentSource: "ra-game-detail",
      completionStatusEnrichmentGameId: summary.gameId,
      clearKeys: ["enrichedCompletionStatus"],
    });
    return createUnavailableSummary(summary.appId, "ra-completion-status-unresolved");
  }

  const enrichedSummary: GamePageAchievementSummary = {
    ...summary,
    completionStatus: result.completionStatus,
  };
  if (gamePageAchievementSummaryCache.get(summary.appId)?.summary === summary) {
    gamePageAchievementSummaryCache.set(summary.appId, {
      storedAt: Date.now(),
      summary: enrichedSummary,
    });
  }
  updateAchievementCompanionRaShortcutResolutionDebug({
    completionStatusEnrichmentAttempted: true,
    completionStatusEnrichmentStatus: "resolved",
    completionStatusEnrichmentSource: "ra-game-detail",
    completionStatusEnrichmentGameId: summary.gameId,
    enrichedCompletionStatus: result.completionStatus,
  });
  markAchievementCompanionGamePageAchievementSummaryFetchCompleted(enrichedSummary);
  return enrichedSummary;
}

type DeckyGamePageAchievementBadgeLoadingState = Partial<{
  readonly lastSummaryStatus: GamePageAchievementSummary["status"] | undefined;
  readonly lastSummaryFetchStartedAt: string | undefined;
  readonly lastSummaryFetchCompletedAt: string | undefined;
  readonly lastRetroAchievementsShortcutAppId: string | undefined;
  readonly lastRetroAchievementsResolutionSource: string | undefined;
  readonly lastRetroAchievementsShortcutRomPathDetected: boolean | undefined;
  readonly lastRetroAchievementsRomHashAttempted: boolean | undefined;
  readonly lastRetroAchievementsRomHashStatus: string | undefined;
  readonly lastRetroAchievementsRaHashLookupAttempted: boolean | undefined;
  readonly lastRetroAchievementsRaHashLookupStatus: string | undefined;
}>;

export function formatDeckyGamePageAchievementBadgeLoadingText(
  summary: GamePageAchievementSummary | undefined,
  runtimeDebugState: DeckyGamePageAchievementBadgeLoadingState,
): string {
  if (summary === undefined) {
    return "\u{1f3c6} Checking game...";
  }

  if (summary.status !== "loading") {
    return "\u{1f3c6} Preparing badge...";
  }

  if (
    runtimeDebugState.lastSummaryFetchStartedAt === undefined &&
    runtimeDebugState.lastSummaryStatus === undefined
  ) {
    return "\u{1f3c6} Checking game...";
  }

  if (
    runtimeDebugState.lastRetroAchievementsShortcutRomPathDetected === true &&
    runtimeDebugState.lastRetroAchievementsRomHashAttempted !== true
  ) {
    return "\u{1f3c6} Detecting ROM...";
  }

  switch (runtimeDebugState.lastRetroAchievementsResolutionSource) {
    case "shortcut-metadata":
      return "\u{1f3c6} Reading shortcut...";
    case "rom-path":
      return "\u{1f3c6} Detecting ROM...";
    case "rom-hash":
      return "\u{1f3c6} Hashing ROM...";
    case "ra-hash-game-detail":
      return "\u{1f3c6} RA lookup...";
    case "hash":
    case "unavailable":
      return "\u{1f3c6} Preparing badge...";
    default:
      break;
  }

  if (runtimeDebugState.lastRetroAchievementsRomHashStatus === "skipped") {
    return "\u{1f3c6} Checking game media...";
  }

  if (runtimeDebugState.lastRetroAchievementsRomHashAttempted === true) {
    return "\u{1f3c6} Hashing ROM...";
  }

  if (runtimeDebugState.lastRetroAchievementsShortcutAppId !== undefined) {
    return "\u{1f3c6} Reading shortcut...";
  }

  if (runtimeDebugState.lastRetroAchievementsRaHashLookupAttempted === true) {
    return "\u{1f3c6} RA lookup...";
  }

  if (runtimeDebugState.lastRetroAchievementsRaHashLookupStatus !== undefined) {
    return "\u{1f3c6} RA lookup...";
  }

  if (runtimeDebugState.lastSummaryStatus === "loading") {
    return "\u{1f3c6} Loading...";
  }

  return "\u{1f3c6} Preparing badge...";
}

export function clearDeckyGamePageAchievementSummaryCacheForTests(): void {
  gamePageAchievementSummaryCache.clear();
  gamePageAchievementSummaryInFlight.clear();
  retroAchievementsCompletionStatusEnrichmentCacheByGameId.clear();
  retroAchievementsCompletionStatusEnrichmentInFlightByGameId.clear();
  retroAchievementsSystemsCache = undefined;
  retroAchievementsSystemsInFlight = undefined;
  retroAchievementsGameListCandidatesCacheByPlatform.clear();
  retroAchievementsGameListCandidatesInFlightByPlatform.clear();
}

/** Drop a shortcut's cached resolution before a native achievement refresh or identity change. */
export function invalidateDeckyGamePageAchievementSummaryCache(appId: string): void {
  const priorSummary = gamePageAchievementSummaryCache.get(appId)?.summary;
  if (priorSummary?.status === "ready" && priorSummary.provider === "retroachievements" && priorSummary.gameId !== undefined) {
    retroAchievementsCompletionStatusEnrichmentCacheByGameId.delete(priorSummary.gameId);
    retroAchievementsCompletionStatusEnrichmentInFlightByGameId.delete(priorSummary.gameId);
  }
  gamePageAchievementSummaryCache.delete(appId);
  gamePageAchievementSummaryInFlight.delete(appId);
  gamePageAchievementSummaryRevisions.invalidate(appId);
}

function invalidateAllDeckyGamePageAchievementSummaryCaches(): void {
  const appIds = new Set([
    ...gamePageAchievementSummaryCache.keys(),
    ...gamePageAchievementSummaryInFlight.keys(),
    ...gamePageAchievementSummaryRevisions.subscribedAppIds(),
  ]);
  for (const appId of appIds) {
    invalidateDeckyGamePageAchievementSummaryCache(appId);
  }
  retroAchievementsCompletionStatusEnrichmentCacheByGameId.clear();
  retroAchievementsCompletionStatusEnrichmentInFlightByGameId.clear();
}

function ensureSteamAccountSummaryCacheCurrent(): void {
  const currentConfig = readDeckyProviderConfigs().steam;
  if (observedSteamProviderConfig === currentConfig) {
    return;
  }
  observedSteamProviderConfig = currentConfig;
  invalidateAllDeckyGamePageAchievementSummaryCaches();
}

subscribeDeckyRaNativeAchievementInvalidation(() => {
  invalidateAllDeckyGamePageAchievementSummaryCaches();
});

export async function loadDeckyGamePageAchievementSummary(
  appId: string,
): Promise<GamePageAchievementSummary> {
  ensureSteamAccountSummaryCacheCurrent();
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
    markAchievementCompanionGamePageAchievementSummaryFetchStarted(appId);
    let steamUnavailableSummary: GamePageAchievementSummary | undefined;
    const shortcutMetadata = await loadDeckySteamShortcutMetadata(appId);

    if (shortcutMetadata !== undefined) {
      const shortcutPlatform =
        shortcutMetadata.platformTag ?? shortcutMetadata.platformLabel ?? shortcutMetadata.tags?.[0];
      markAchievementCompanionGamePageShortcutDetected({
        appId,
        title: shortcutMetadata.title ?? "",
        ...(shortcutPlatform !== undefined ? { platform: shortcutPlatform } : { platform: undefined }),
        reason: "steam-shortcut-detected",
        nextPath: "retroachievements",
      });

      const retroAchievementsShortcutResolution = await resolveSummaryFromRetroAchievementsShortcut(
        appId,
        shortcutMetadata,
        {
          steamSkippedBecauseShortcut: true,
        },
      );
      if (retroAchievementsShortcutResolution.status === "mapped") {
        const readySummary = await buildRetroAchievementsReadySummary(
          appId,
          retroAchievementsShortcutResolution,
        );
        markAchievementCompanionGamePageAchievementSummaryFetchCompleted(readySummary);
        return readySummary;
      }

      if (retroAchievementsShortcutResolution.status === "error") {
        const errorSummary: GamePageAchievementSummary = {
          status: "error",
          appId,
          message: retroAchievementsShortcutResolution.message,
        };
        markAchievementCompanionGamePageAchievementSummaryFetchCompleted(errorSummary);
        return errorSummary;
      }

      const unavailableSummary = createUnavailableSummary(appId, retroAchievementsShortcutResolution.reason);
      markAchievementCompanionGamePageAchievementSummaryFetchCompleted(unavailableSummary);
      return unavailableSummary;
    }

    const steamCacheSummary = resolveSummaryFromSteamScanCache(appId);
    if (steamCacheSummary?.status === "ready") {
      markAchievementCompanionGamePageAchievementSummaryFetchCompleted(steamCacheSummary);
      return steamCacheSummary;
    }

    if (steamCacheSummary?.status === "unavailable") {
      steamUnavailableSummary = steamCacheSummary;
    }

    const steamSnapshotSummary = resolveSummaryFromSteamDashboardSnapshot(appId);
    if (steamSnapshotSummary?.status === "ready") {
      markAchievementCompanionGamePageAchievementSummaryFetchCompleted(steamSnapshotSummary);
      return steamSnapshotSummary;
    }

    if (steamSnapshotSummary?.status === "unavailable") {
      steamUnavailableSummary = steamSnapshotSummary;
    }

    const steamDetailSummary = await resolveSummaryFromSteamGameDetail(appId);
    if (steamDetailSummary?.status === "ready") {
      markAchievementCompanionGamePageAchievementSummaryFetchCompleted(steamDetailSummary);
      return steamDetailSummary;
    }

    if (steamDetailSummary?.status === "unavailable") {
      steamUnavailableSummary = steamDetailSummary;
    }

    const retroAchievementsShortcutResolution = await resolveSummaryFromRetroAchievementsShortcut(appId);
    if (retroAchievementsShortcutResolution.status === "mapped") {
      const readySummary = await buildRetroAchievementsReadySummary(
        appId,
        retroAchievementsShortcutResolution,
      );
      markAchievementCompanionGamePageAchievementSummaryFetchCompleted(readySummary);
      return readySummary;
    }

    if (retroAchievementsShortcutResolution.status === "error") {
      const errorSummary: GamePageAchievementSummary = {
        status: "error",
        appId,
        message: retroAchievementsShortcutResolution.message,
      };
      markAchievementCompanionGamePageAchievementSummaryFetchCompleted(errorSummary);
      return errorSummary;
    }

    if (
      retroAchievementsShortcutResolution.reason === "shortcut-metadata-unavailable" &&
      steamUnavailableSummary !== undefined
    ) {
      markAchievementCompanionGamePageAchievementSummaryFetchCompleted(steamUnavailableSummary);
      return steamUnavailableSummary;
    }

    const unavailableSummary = createUnavailableSummary(appId, retroAchievementsShortcutResolution.reason);
    markAchievementCompanionGamePageAchievementSummaryFetchCompleted(unavailableSummary);
    return unavailableSummary;
  })();

  gamePageAchievementSummaryInFlight.set(appId, loadPromise);

  try {
    const summary = await loadPromise;
    // An invalidated request may still finish; it must not repopulate the cache.
    if (gamePageAchievementSummaryInFlight.get(appId) === loadPromise) {
      gamePageAchievementSummaryCache.set(appId, {
        storedAt: Date.now(),
        summary,
      });
    }
    return summary;
  } finally {
    if (gamePageAchievementSummaryInFlight.get(appId) === loadPromise) {
      gamePageAchievementSummaryInFlight.delete(appId);
    }
  }
}

export function selectDeckyGamePageAchievementSummaryForAppId(
  summary: GamePageAchievementSummary | undefined,
  appId: string | undefined,
): GamePageAchievementSummary | undefined {
  if (appId === undefined) {
    return undefined;
  }

  return summary?.appId === appId
    ? summary
    : {
        status: "loading",
        appId,
      };
}

export function useGamePageAchievementSummary(
  appId: string | undefined,
): GamePageAchievementSummary | undefined {
  const steamProviderConfig = useDeckyProviderConfigs().steam;
  const subscribeToRevision = useCallback(
    (listener: () => void) =>
      appId === undefined
        ? () => undefined
        : subscribeDeckyGamePageAchievementSummaryRevision(appId, listener),
    [appId],
  );
  const readRevision = useCallback(
    () => appId === undefined ? 0 : readDeckyGamePageAchievementSummaryRevision(appId),
    [appId],
  );
  const cacheRevision = useSyncExternalStore(subscribeToRevision, readRevision, readRevision);
  const [summary, setSummary] = useState<GamePageAchievementSummary | undefined>(undefined);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    requestSequenceRef.current += 1;
    const requestSequence = requestSequenceRef.current;
    if (appId === undefined) {
      setSummary(undefined);
      return;
    }

    ensureSteamAccountSummaryCacheCurrent();
    const requestRevision = readDeckyGamePageAchievementSummaryRevision(appId);
    const isCurrent = () =>
      requestSequenceRef.current === requestSequence &&
      readDeckyGamePageAchievementSummaryRevision(appId) === requestRevision;
    const loadingSummary: GamePageAchievementSummary = {
      status: "loading",
      appId,
    };
    setSummary(loadingSummary);
    markAchievementCompanionGamePageAchievementSummaryFetchStarted(appId);

    void loadDeckyGamePageAchievementSummary(appId)
      .then(async (nextSummary) => {
        if (!isCurrent()) {
          return;
        }

        if (
          nextSummary.status === "ready" &&
          nextSummary.provider === "retroachievements" &&
          nextSummary.gameId !== undefined &&
          nextSummary.completionStatus === undefined
        ) {
          setSummary({
            status: "loading",
            appId,
            provider: "retroachievements",
          });
        }

        const presentationSummary =
          nextSummary.status === "ready" && nextSummary.provider === "retroachievements"
            ? await enrichDeckyGamePageAchievementSummaryCompletionStatus(nextSummary)
            : nextSummary;
        if (!isCurrent()) {
          return;
        }

        setSummary(presentationSummary);
        markAchievementCompanionGamePageAchievementSummaryFetchCompleted(presentationSummary);
      })
      .catch((error: unknown) => {
        if (!isCurrent()) {
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

    return () => {
      if (requestSequenceRef.current === requestSequence) {
        requestSequenceRef.current += 1;
      }
    };
  }, [appId, cacheRevision, steamProviderConfig]);

  return useMemo(
    () => selectDeckyGamePageAchievementSummaryForAppId(summary, appId),
    [appId, summary],
  );
}
