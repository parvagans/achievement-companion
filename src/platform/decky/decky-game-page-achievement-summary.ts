import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CompletionProgressSnapshot,
  DashboardSnapshot,
  NormalizedGame,
  RecentUnlock,
  RecentlyPlayedGame,
} from "@core/domain";
import { readDeckyDashboardSnapshotCacheEntry } from "./decky-dashboard-snapshot-cache";
import { stripCompletionProgressSubsetSuffix } from "./decky-completion-progress-grouping";
import {
  loadDeckySteamShortcutMetadata,
  type DeckySteamShortcutMetadata,
} from "./decky-steam-shortcut-metadata";
import { loadDeckyRetroAchievementsProviderConfig } from "./providers/retroachievements/config";
import { createDeckyRetroAchievementsTransport } from "./providers/retroachievements/backend-transport";
import {
  readDeckyProviderConfig as readDeckySteamProviderConfig,
  readDeckySteamLibraryAchievementScanSummary,
} from "./providers/steam/config";
import { findSteamLibraryScanGameSummaryByAppId } from "./providers/steam/game-detail";
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
  reportAchievementCompanionGamePageAchievementSummaryError,
  updateAchievementCompanionGamePageBadgeDebug,
  updateAchievementCompanionRaShortcutResolutionDebug,
} from "./decky-runtime-debug";

const GAME_PAGE_ACHIEVEMENT_SUMMARY_CACHE_TTL_MS = 30 * 1000;

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
        | "dashboard-identity-detail"
        | "ra-api-game-list"
        | "ra-api-game-detail";
      readonly confidence: "exact";
      readonly reason?: string;
      readonly platformLabel?: string;
      readonly systemIconUrl?: string;
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
        | "ra-platform-unsupported"
        | "ra-detail-unavailable"
        | "ra-game-list-no-match";
    }
  | {
      readonly status: "error";
      readonly appId: string;
      readonly message: string;
    };

type RetroAchievementsShortcutResolutionDebugArgs = RetroAchievementsShortcutResolution & {
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
    | "apiMatchedGameId"
    | "apiMatchedTitle"
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
  )[];
};

interface CachedGamePageAchievementSummaryEntry {
  readonly storedAt: number;
  readonly summary: GamePageAchievementSummary;
}

interface RetroAchievementsDashboardCandidate {
  readonly gameId: string;
  readonly title: string;
  readonly platformLabel?: string;
  readonly systemIconUrl?: string;
  readonly earned: number;
  readonly total: number;
  readonly updatedAt?: string;
}

interface RetroAchievementsCompletionProgressCandidate {
  readonly gameId: string;
  readonly title: string;
  readonly platformLabel?: string;
  readonly normalizedPlatformLabel?: string;
  readonly systemIconUrl?: string;
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

interface RetroAchievementsApiGameListCandidate {
  readonly gameId: string;
  readonly title: string;
  readonly platformLabel?: string;
  readonly normalizedPlatformLabel?: string;
  readonly systemIconUrl?: string;
  readonly updatedAt?: string;
}

type RetroAchievementsSubsetAwareCandidate = {
  readonly title: string;
};

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
    };

const gamePageAchievementSummaryCache = new Map<string, CachedGamePageAchievementSummaryEntry>();
const gamePageAchievementSummaryInFlight = new Map<string, Promise<GamePageAchievementSummary>>();
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
const RETROACHIEVEMENTS_GAME_LIST_CACHE_TTL_MS = 5 * 60 * 1000;
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

function normalizeRetroAchievementsShortcutPlatform(
  shortcutMetadata: DeckySteamShortcutMetadata | undefined,
): string | undefined {
  const shortcutPlatform =
    shortcutMetadata?.platformTag ??
    shortcutMetadata?.platformLabel ??
    shortcutMetadata?.tags?.[0];
  return normalizeRetroAchievementsPlatformLabel(shortcutPlatform);
}

function getRetroAchievementsClient(): RetroAchievementsClient {
  if (retroAchievementsClient === undefined) {
    retroAchievementsClient = createRetroAchievementsClient(createDeckyRetroAchievementsTransport());
  }

  return retroAchievementsClient;
}

function normalizeRetroAchievementsShortcutTitleCandidates(
  value: string | undefined,
  shortcutPlatform: string | undefined,
): readonly string[] {
  const candidates = new Set(normalizeRetroAchievementsTitleCandidates(value));
  const normalizedPlatform = normalizeRetroAchievementsPlatformLabel(shortcutPlatform);

  if (normalizedPlatform === "PlayStation 2") {
    const normalizedTitle = normalizeRetroAchievementsTitleText("Final Fantasy X International");
    if (candidates.has(normalizedTitle)) {
      candidates.add(normalizeRetroAchievementsTitleText("Final Fantasy X: International"));
    }
  }

  return Array.from(candidates.values());
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

  const addNormalizedCandidate = (candidate: string | undefined) => {
    if (candidate === undefined) {
      return;
    }

    const normalized = normalizeRetroAchievementsTitleText(candidate);
    if (normalized.length > 0) {
      candidates.add(normalized);
    }
  };

  for (const candidate of rawCandidates) {
    addNormalizedCandidate(candidate);

    const normalizedCandidate = candidate !== undefined ? normalizeRetroAchievementsTitleText(candidate) : "";
    const sonicHeroMatch = normalizedCandidate.match(/^sonic the hedgehog (?=\d)/u);
    if (sonicHeroMatch !== null) {
      addNormalizedCandidate(normalizedCandidate.replace(/^sonic the hedgehog /u, "sonic "));
    }
  }

  return Array.from(candidates.values());
}

function parseRetroAchievementsGameListCandidates(
  response: unknown,
  system: RetroAchievementsResolvedSystemMetadata,
  updatedAt: string | undefined,
): readonly RetroAchievementsApiGameListCandidate[] {
  if (!Array.isArray(response)) {
    return [];
  }

  const candidatesByGameId = new Map<string, RetroAchievementsApiGameListCandidate>();

  for (const entry of response) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const gameIdValue = record["GameID"] ?? record["gameId"] ?? record["ID"] ?? record["id"];
    const titleValue = record["Title"] ?? record["title"] ?? record["GameTitle"] ?? record["gameTitle"];
    const consoleNameValue = record["ConsoleName"] ?? record["consoleName"];
    const consoleIdValue = record["ConsoleID"] ?? record["consoleId"];
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
    if (gameId === undefined || title === undefined) {
      continue;
    }

    if (candidatesByGameId.has(gameId)) {
      continue;
    }

    const platformLabel = normalizeRetroAchievementsPlatformLabel(
      typeof consoleNameValue === "string" ? consoleNameValue : undefined,
    ) ?? system.normalizedPlatform;
    const normalizedPlatformLabel =
      platformLabel !== undefined ? normalizeRetroAchievementsPlatformLabel(platformLabel) : undefined;
    candidatesByGameId.set(gameId, {
      gameId,
      title,
      ...(platformLabel !== undefined ? { platformLabel } : {}),
      ...(normalizedPlatformLabel !== undefined ? { normalizedPlatformLabel } : {}),
      ...(system.systemIconUrl !== undefined ? { systemIconUrl: system.systemIconUrl } : {}),
      ...(updatedAt !== undefined ? { updatedAt } : {}),
    });

    void consoleIdValue;
  }

  return Array.from(candidatesByGameId.values());
}

function collectRetroAchievementsGameListCandidatesForPlatform(
  candidates: readonly RetroAchievementsApiGameListCandidate[],
  shortcutTitleCandidates: readonly string[],
  shortcutPlatformCandidates: readonly string[],
): readonly RetroAchievementsApiGameListCandidate[] {
  const matches = new Map<string, RetroAchievementsApiGameListCandidate>();

  for (const candidate of candidates) {
    if (
      !matchesRetroAchievementsShortcutPlatform(
        candidate.platformLabel,
        shortcutPlatformCandidates,
      )
    ) {
      continue;
    }

    if (!matchesRetroAchievementsShortcutTitle(candidate.title, shortcutTitleCandidates)) {
      continue;
    }

    if (!matches.has(candidate.gameId)) {
      matches.set(candidate.gameId, candidate);
    }
  }

  const matchedCandidates = Array.from(matches.values());
  return preferRetroAchievementsBaseSetCandidates(matchedCandidates);
}

function preferRetroAchievementsBaseSetCandidates<T extends RetroAchievementsSubsetAwareCandidate>(
  candidates: readonly T[],
): readonly T[] {
  if (candidates.length <= 1) {
    return candidates;
  }

  const nonSubsetMatches = candidates.filter(
    (candidate) => stripCompletionProgressSubsetSuffix(candidate.title) === undefined,
  );

  return nonSubsetMatches.length > 0 ? nonSubsetMatches : candidates;
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
    return cachedEntry.result;
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

    const candidateLists = await Promise.all(
      [system.consoleId].map(async (consoleId) => {
        const response = await client.loadGameList!(config, consoleId);
        return parseRetroAchievementsGameListCandidates(response, system, undefined);
      }),
    );

    const mergedCandidates = new Map<string, RetroAchievementsApiGameListCandidate>();
    for (const candidateList of candidateLists) {
      for (const candidate of candidateList) {
        if (!mergedCandidates.has(candidate.gameId)) {
          mergedCandidates.set(candidate.gameId, candidate);
        }
      }
    }

    const nextCandidates = Array.from(mergedCandidates.values());
    return {
      status: "resolved",
      system,
      candidates: nextCandidates,
    } satisfies RetroAchievementsGameListCandidatesLoadResult;
  })().finally(() => {
    retroAchievementsGameListCandidatesInFlightByPlatform.delete(normalizedShortcutPlatform);
  });

  retroAchievementsGameListCandidatesInFlightByPlatform.set(normalizedShortcutPlatform, loadPromise);
  const result = await loadPromise;
  retroAchievementsGameListCandidatesCacheByPlatform.set(normalizedShortcutPlatform, {
    storedAt: Date.now(),
    result,
  });
  return result;
}

function collectRetroAchievementsDashboardCandidates(
  snapshot: DashboardSnapshot,
  updatedAt: string | undefined,
): readonly RetroAchievementsDashboardCandidate[] {
  const candidatesByGameId = new Map<string, RetroAchievementsDashboardCandidate>();

  const addCandidate = (
    game:
      | Pick<NormalizedGame, "gameId" | "title" | "platformLabel" | "systemIconUrl" | "summary">
      | Pick<RecentlyPlayedGame, "gameId" | "title" | "platformLabel" | "systemIconUrl" | "summary">,
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
      ...(game.platformLabel !== undefined ? { platformLabel: game.platformLabel } : {}),
      ...(game.systemIconUrl !== undefined ? { systemIconUrl: game.systemIconUrl } : {}),
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
      ...(game.systemIconUrl !== undefined ? { systemIconUrl: game.systemIconUrl } : {}),
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
      resolution.source === "completion-progress-title-match" ||
      resolution.source === "dashboard-identity-detail" ||
      resolution.source === "ra-api-game-detail"
        ? "backend"
        : "snapshot",
    ...(resolution.updatedAt !== undefined ? { updatedAt: resolution.updatedAt } : {}),
  });
}

async function resolveSummaryFromRetroAchievementsShortcut(
  appId: string,
  shortcutMetadataOverride?: DeckySteamShortcutMetadata,
  options?: {
    readonly steamSkippedBecauseShortcut?: boolean;
  },
): Promise<RetroAchievementsShortcutResolution> {
  const staleResultDebugFieldsToClear: readonly (
    | "apiMatchedGameId"
    | "apiMatchedTitle"
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
  )[] = [
    "apiMatchedGameId",
    "apiMatchedTitle",
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
  ];

  try {
    const shortcutMetadata = shortcutMetadataOverride ?? (await loadDeckySteamShortcutMetadata(appId));
    const rawShortcutTitle = shortcutMetadata?.title;
    const rawShortcutPlatform =
      shortcutMetadata?.platformTag ?? shortcutMetadata?.platformLabel ?? shortcutMetadata?.tags?.[0];
    const shortcutPlatform = normalizeRetroAchievementsShortcutPlatform(shortcutMetadata);
    const shortcutTitleCandidates = normalizeRetroAchievementsShortcutTitleCandidates(
      rawShortcutTitle,
      shortcutPlatform,
    );
    const shortcutTitle = shortcutTitleCandidates[0];
    const shortcutPlatformCandidates =
      shortcutPlatform !== undefined ? [shortcutPlatform] : ([] as readonly string[]);
    updateAchievementCompanionRaShortcutResolutionDebug({
      appId,
      shortcutMetadataLoaded: shortcutMetadata !== undefined,
      ...(rawShortcutTitle !== undefined ? { shortcutTitle: rawShortcutTitle } : {}),
      ...(rawShortcutPlatform !== undefined ? { shortcutPlatform: rawShortcutPlatform } : {}),
      ...(shortcutPlatform !== undefined ? { normalizedPlatform: shortcutPlatform } : {}),
      steamSkippedBecauseShortcut: options?.steamSkippedBecauseShortcut === true,
      resolverStage: "shortcut-metadata",
      dashboardSummaryCandidateCount: 0,
      completionProgressCandidateCount: 0,
      completionProgressRelevantCandidates: [],
      completionProgressAmbiguousCandidateTitles: [],
      dashboardIdentityCandidateCount: 0,
      apiGameListRelevantCandidates: [],
      apiAmbiguousCandidateTitles: [],
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
      markRetroAchievementsShortcutResolution({
        ...resolution,
        ...debugBase,
        ...extra,
      });
    };

    if (shortcutTitle === undefined) {
      const unavailableResolution: RetroAchievementsShortcutResolution = {
        status: "unavailable",
        appId,
        reason: "shortcut-metadata-unavailable",
      };
      markResolution(unavailableResolution, {
        resolutionSource: "unavailable",
        resolutionReason: unavailableResolution.reason,
        clearKeys: staleResultDebugFieldsToClear,
      });
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
    updateAchievementCompanionRaShortcutResolutionDebug({
      resolverStage: "dashboard-summary",
      dashboardSummaryCandidateCount: matchingCandidates.length,
      clearKeys: staleResultDebugFieldsToClear,
    });

    if (matchingCandidates.length === 1) {
      const matchingCandidate = matchingCandidates[0]!;
      const mappedResolution: RetroAchievementsShortcutResolution = {
        status: "mapped",
        appId,
        raGameId: matchingCandidate.gameId,
        title: matchingCandidate.title,
        ...(matchingCandidate.platformLabel !== undefined ? { platformLabel: matchingCandidate.platformLabel } : {}),
        ...(matchingCandidate.systemIconUrl !== undefined ? { systemIconUrl: matchingCandidate.systemIconUrl } : {}),
        earned: matchingCandidate.earned,
        total: matchingCandidate.total,
        source: "shortcut-title-match",
        confidence: "exact",
        reason: "shortcut-title-match",
        ...(matchingCandidate.updatedAt !== undefined ? { updatedAt: matchingCandidate.updatedAt } : {}),
      };
      markResolution(mappedResolution, {
        resolutionSource: "dashboard-snapshot",
        resolutionReason: "shortcut-title-match",
        matchedTitle: matchingCandidate.title,
        matchedPlatform: matchingCandidate.platformLabel,
        matchedGameId: matchingCandidate.gameId,
        candidateCount: matchingCandidates.length,
        clearKeys: staleResultDebugFieldsToClear,
      });
      return mappedResolution;
    }

    if (matchingCandidates.length > 1) {
      const unavailableResolution: RetroAchievementsShortcutResolution = {
        status: "unavailable",
        appId,
        reason: "ambiguous-retroachievements-shortcut-mapping",
      };
      markResolution(unavailableResolution, {
        resolutionSource: "dashboard-snapshot",
        resolutionReason: unavailableResolution.reason,
        candidateCount: matchingCandidates.length,
        clearKeys: staleResultDebugFieldsToClear,
      });
      return unavailableResolution;
    }

    const completionProgressState = await loadDeckyCompletionProgressStateLazy(RETROACHIEVEMENTS_PROVIDER_ID);
    if (completionProgressState.status === "success" && completionProgressState.data !== undefined) {
      const completionProgressCandidates = collectRetroAchievementsCompletionProgressCandidates(
        completionProgressState.data,
      ).filter((candidate) =>
        matchesRetroAchievementsShortcutTitle(candidate.title, shortcutTitleCandidates),
      );
      const preferredCompletionProgressCandidates = preferRetroAchievementsBaseSetCandidates(
        completionProgressCandidates,
      );
      updateAchievementCompanionRaShortcutResolutionDebug({
        resolverStage: "completion-progress",
        completionProgressCandidateCount: completionProgressCandidates.length,
        completionProgressRelevantCandidates: completionProgressCandidates.slice(0, 10).map((candidate) => ({
          id: candidate.gameId,
          title: candidate.title,
          ...(candidate.platformLabel !== undefined ? { console: candidate.platformLabel } : {}),
        })),
        completionProgressAmbiguousCandidateTitles:
          preferredCompletionProgressCandidates.length > 1
            ? preferredCompletionProgressCandidates.map((candidate) => candidate.title)
            : [],
        clearKeys: staleResultDebugFieldsToClear,
      });

      if (preferredCompletionProgressCandidates.length === 1) {
        const matchingCandidate = preferredCompletionProgressCandidates[0]!;
        const mappedResolution: RetroAchievementsShortcutResolution = {
          status: "mapped",
          appId,
          raGameId: matchingCandidate.gameId,
          title: matchingCandidate.title,
          ...(matchingCandidate.platformLabel !== undefined ? { platformLabel: matchingCandidate.platformLabel } : {}),
          ...(matchingCandidate.systemIconUrl !== undefined ? { systemIconUrl: matchingCandidate.systemIconUrl } : {}),
          earned: matchingCandidate.earned,
          total: matchingCandidate.total,
          source: "completion-progress-title-match",
          confidence: "exact",
          reason: "completion-progress-title-match",
          ...(matchingCandidate.updatedAt !== undefined ? { updatedAt: matchingCandidate.updatedAt } : {}),
        };
        markResolution(mappedResolution, {
          resolutionSource: "completion-progress-title-match",
          resolutionReason: "completion-progress-title-match",
          matchedTitle: matchingCandidate.title,
          matchedPlatform: matchingCandidate.normalizedPlatformLabel,
          matchedGameId: matchingCandidate.gameId,
          candidateCount: preferredCompletionProgressCandidates.length,
          clearKeys: staleResultDebugFieldsToClear,
        });
        return mappedResolution;
      }

      if (preferredCompletionProgressCandidates.length > 1) {
        const unavailableResolution: RetroAchievementsShortcutResolution = {
          status: "unavailable",
          appId,
          reason: "ambiguous-retroachievements-shortcut-mapping",
        };
        markResolution(unavailableResolution, {
          resolutionSource: "completion-progress-title-match",
          resolutionReason: unavailableResolution.reason,
          candidateCount: preferredCompletionProgressCandidates.length,
          clearKeys: staleResultDebugFieldsToClear,
        });
        return unavailableResolution;
      }
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
    updateAchievementCompanionRaShortcutResolutionDebug({
      resolverStage: "dashboard-identity-detail",
      dashboardIdentityCandidateCount: dashboardIdentityCandidates.length,
      clearKeys: staleResultDebugFieldsToClear,
    });

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
        markResolution(unavailableResolution, {
          resolutionSource: "dashboard-identity-detail",
          resolutionReason: unavailableResolution.reason,
          matchedTitle: matchingCandidate.title,
          matchedPlatform: matchingCandidate.normalizedPlatformLabel,
          matchedGameId: matchingCandidate.gameId,
          candidateCount: dashboardIdentityCandidates.length,
          detailLoadStatus: "error",
          detailLoadReason: unavailableResolution.reason,
          clearKeys: staleResultDebugFieldsToClear,
        });
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
          ...(game.platformLabel !== undefined ? { platformLabel: game.platformLabel } : {}),
          ...(game.systemIconUrl !== undefined ? { systemIconUrl: game.systemIconUrl } : {}),
          earned: game.summary.unlockedCount,
          total: game.summary.totalCount,
          source: "dashboard-identity-detail",
          confidence: "exact",
          reason: "dashboard-identity-detail-title-match",
          ...(gameDetailState.lastUpdatedAt !== undefined
            ? { updatedAt: new Date(gameDetailState.lastUpdatedAt).toISOString() }
            : {}),
        };
        markResolution(mappedResolution, {
          resolutionSource: "dashboard-identity-detail",
          resolutionReason: "dashboard-identity-detail-title-match",
          matchedTitle: matchingCandidate.title,
          matchedPlatform: matchingCandidate.normalizedPlatformLabel,
          matchedGameId: matchingCandidate.gameId,
          candidateCount: dashboardIdentityCandidates.length,
          detailLoadStatus: "success",
        });
        return mappedResolution;
      }

      const unavailableResolution: RetroAchievementsShortcutResolution = {
        status: "unavailable",
        appId,
        reason: "ra-detail-unavailable",
      };
      markResolution(unavailableResolution, {
        resolutionSource: "dashboard-identity-detail",
        resolutionReason: unavailableResolution.reason,
        matchedTitle: matchingCandidate.title,
        matchedPlatform: matchingCandidate.normalizedPlatformLabel,
        matchedGameId: matchingCandidate.gameId,
        candidateCount: dashboardIdentityCandidates.length,
        detailLoadStatus: "unavailable",
        detailLoadReason: unavailableResolution.reason,
        clearKeys: staleResultDebugFieldsToClear,
      });
      return unavailableResolution;
    }

    if (dashboardIdentityCandidates.length > 1) {
      const unavailableResolution: RetroAchievementsShortcutResolution = {
        status: "unavailable",
        appId,
        reason: "ambiguous-retroachievements-shortcut-mapping",
      };
      markResolution(unavailableResolution, {
        resolutionSource: "dashboard-identity-detail",
        resolutionReason: unavailableResolution.reason,
        candidateCount: dashboardIdentityCandidates.length,
        clearKeys: staleResultDebugFieldsToClear,
      });
      return unavailableResolution;
    }

    let apiGameListResult: RetroAchievementsGameListCandidatesLoadResult = {
      status: "unavailable",
      ...(shortcutPlatform !== undefined ? { normalizedPlatform: shortcutPlatform } : {}),
      candidates: [],
    };
    try {
      apiGameListResult = await loadRetroAchievementsGameListCandidatesForPlatform(shortcutPlatform);
    } catch {
      apiGameListResult = {
        status: "unavailable",
        ...(shortcutPlatform !== undefined ? { normalizedPlatform: shortcutPlatform } : {}),
        candidates: [],
      };
    }

    if (apiGameListResult.status === "unsupported") {
      const unavailableResolution: RetroAchievementsShortcutResolution = {
        status: "unavailable",
        appId,
        reason: "ra-platform-unsupported",
      };
      markResolution(unavailableResolution, {
        resolutionSource: "ra-api-game-list",
        resolutionReason: unavailableResolution.reason,
        candidateCount: 0,
        clearKeys: staleResultDebugFieldsToClear,
      });
      return unavailableResolution;
    }

    const matchingGameListCandidates = collectRetroAchievementsGameListCandidatesForPlatform(
      apiGameListResult.candidates,
      shortcutTitleCandidates,
      shortcutPlatformCandidates,
    );
    updateAchievementCompanionRaShortcutResolutionDebug({
      resolverStage: "ra-api-game-list",
      ...(apiGameListResult.status === "resolved"
        ? {
            apiSystemsResolvedConsoleId: apiGameListResult.system.consoleId,
            apiSystemsResolvedConsoleName: apiGameListResult.system.systemName,
            apiGameListRequestConsoleId: apiGameListResult.system.consoleId,
          }
        : {}),
      apiGameListCandidateCount: matchingGameListCandidates.length,
      apiGameListRelevantCandidates: matchingGameListCandidates.slice(0, 10).map((candidate) => ({
        id: candidate.gameId,
        title: candidate.title,
        ...(candidate.platformLabel !== undefined ? { console: candidate.platformLabel } : {}),
      })),
      apiAmbiguousCandidateTitles:
        matchingGameListCandidates.length > 1
          ? matchingGameListCandidates.map((candidate) => candidate.title)
          : [],
      clearKeys: staleResultDebugFieldsToClear,
    });

    if (matchingGameListCandidates.length === 1) {
      const matchingCandidate = matchingGameListCandidates[0]!;
      updateAchievementCompanionRaShortcutResolutionDebug({
        apiMatchedGameId: matchingCandidate.gameId,
        apiMatchedTitle: matchingCandidate.title,
        detailLoadAttempted: true,
        clearKeys: staleResultDebugFieldsToClear,
      });
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
        markResolution(unavailableResolution, {
          resolutionSource: "ra-api-game-detail",
          resolutionReason: unavailableResolution.reason,
          ...(apiGameListResult.status === "resolved"
            ? {
                resolvedSystemName: apiGameListResult.system.systemName,
                resolvedConsoleId: apiGameListResult.system.consoleId,
              }
            : {}),
          matchedTitle: matchingCandidate.title,
          matchedPlatform: matchingCandidate.normalizedPlatformLabel,
          matchedGameId: matchingCandidate.gameId,
          candidateCount: matchingGameListCandidates.length,
          detailLoadStatus: "error",
          detailLoadReason: unavailableResolution.reason,
        });
        return unavailableResolution;
      }
      const game = gameDetailState.data?.game;
      if (
        gameDetailState.status === "success" &&
        game !== undefined &&
        game.summary.totalCount !== undefined &&
        game.summary.totalCount > 0
      ) {
        updateAchievementCompanionRaShortcutResolutionDebug({
          resolverStage: "ra-api-game-detail",
          detailLoadStatus: "success",
          detailGameId: game.gameId,
          detailTitle: game.title,
          ...(game.platformLabel !== undefined ? { detailPlatformLabel: game.platformLabel } : {}),
          detailEarned: game.summary.unlockedCount,
          ...(game.hardcoreSummary?.unlockedCount !== undefined
            ? { detailEarnedHardcore: game.hardcoreSummary.unlockedCount }
            : {}),
          detailTotal: game.summary.totalCount,
        });
        const mappedResolution: RetroAchievementsShortcutResolution = {
          status: "mapped",
          appId,
          raGameId: game.gameId,
          title: game.title,
          ...(game.platformLabel !== undefined
            ? { platformLabel: game.platformLabel }
            : matchingCandidate.platformLabel !== undefined
              ? { platformLabel: matchingCandidate.platformLabel }
              : apiGameListResult.status === "resolved"
                ? { platformLabel: apiGameListResult.system.systemName }
                : {}),
          ...(game.systemIconUrl !== undefined
            ? { systemIconUrl: game.systemIconUrl }
            : matchingCandidate.systemIconUrl !== undefined
              ? { systemIconUrl: matchingCandidate.systemIconUrl }
              : apiGameListResult.status === "resolved" && apiGameListResult.system.systemIconUrl !== undefined
                ? { systemIconUrl: apiGameListResult.system.systemIconUrl }
                : {}),
          earned: game.summary.unlockedCount,
          total: game.summary.totalCount,
          source: "ra-api-game-detail",
          confidence: "exact",
          reason: "ra-api-game-list-title-match",
          ...(gameDetailState.lastUpdatedAt !== undefined
            ? { updatedAt: new Date(gameDetailState.lastUpdatedAt).toISOString() }
            : {}),
        };
        markResolution(mappedResolution, {
          resolutionSource: "ra-api-game-detail",
          resolutionReason: "ra-api-game-list-title-match",
          ...(apiGameListResult.status === "resolved"
            ? {
                resolvedSystemName: apiGameListResult.system.systemName,
                resolvedConsoleId: apiGameListResult.system.consoleId,
              }
            : {}),
          matchedTitle: matchingCandidate.title,
          matchedPlatform: matchingCandidate.normalizedPlatformLabel,
          matchedGameId: matchingCandidate.gameId,
          candidateCount: matchingGameListCandidates.length,
          detailLoadStatus: "success",
        });
        return mappedResolution;
      }

      const unavailableResolution: RetroAchievementsShortcutResolution = {
        status: "unavailable",
        appId,
        reason: "ra-detail-unavailable",
      };
      markResolution(unavailableResolution, {
        resolutionSource: "ra-api-game-detail",
        resolutionReason: unavailableResolution.reason,
        ...(apiGameListResult.status === "resolved"
          ? {
              resolvedSystemName: apiGameListResult.system.systemName,
              resolvedConsoleId: apiGameListResult.system.consoleId,
            }
          : {}),
        matchedTitle: matchingCandidate.title,
        matchedPlatform: matchingCandidate.normalizedPlatformLabel,
        matchedGameId: matchingCandidate.gameId,
        candidateCount: matchingGameListCandidates.length,
        detailLoadStatus: "unavailable",
        detailLoadReason: unavailableResolution.reason,
      });
      return unavailableResolution;
    }

    if (matchingGameListCandidates.length > 1) {
      const unavailableResolution: RetroAchievementsShortcutResolution = {
        status: "unavailable",
        appId,
        reason: "ambiguous-retroachievements-shortcut-mapping",
      };
      markResolution(unavailableResolution, {
        resolutionSource: "ra-api-game-list",
        resolutionReason: unavailableResolution.reason,
        ...(apiGameListResult.status === "resolved"
          ? {
              resolvedSystemName: apiGameListResult.system.systemName,
              resolvedConsoleId: apiGameListResult.system.consoleId,
            }
          : {}),
        candidateCount: matchingGameListCandidates.length,
        clearKeys: staleResultDebugFieldsToClear,
      });
      return unavailableResolution;
    }

    const unavailableReason = "ra-game-list-no-match";
    const unavailableResolution: RetroAchievementsShortcutResolution = {
      status: "unavailable",
      appId,
      reason: unavailableReason,
    };
    markResolution(unavailableResolution, {
      resolutionSource: "ra-api-game-list",
      resolutionReason: unavailableReason,
      ...(apiGameListResult.status === "resolved"
        ? {
            resolvedSystemName: apiGameListResult.system.systemName,
            resolvedConsoleId: apiGameListResult.system.consoleId,
          }
        : {}),
      candidateCount: 0,
      clearKeys: staleResultDebugFieldsToClear,
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
  retroAchievementsSystemsCache = undefined;
  retroAchievementsSystemsInFlight = undefined;
  retroAchievementsGameListCandidatesCacheByPlatform.clear();
  retroAchievementsGameListCandidatesInFlightByPlatform.clear();
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
    markAchievementCompanionGamePageAchievementSummaryFetchStarted(appId);
    let steamUnavailableSummary: GamePageAchievementSummary | undefined;
    const shortcutMetadata = await loadDeckySteamShortcutMetadata(appId);

    if (shortcutMetadata !== undefined) {
      const shortcutPlatform =
        shortcutMetadata.platformTag ?? shortcutMetadata.platformLabel ?? shortcutMetadata.tags?.[0];
      markAchievementCompanionGamePageShortcutDetected({
        appId,
        title: shortcutMetadata.title,
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
