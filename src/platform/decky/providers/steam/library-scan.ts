import { STEAM_PROVIDER_ID, type SteamProviderConfig } from "../../../../providers/steam";
import type { CompletionProgressSnapshot, NormalizedGame } from "@core/domain";
import { createSteamClient } from "../../../../providers/steam";
import {
  scanSteamLibraryAchievements,
  type SteamLibraryAchievementScanSummary,
  type SteamLibraryScanLogger,
  type SteamLibraryGameProgressSummary,
} from "../../../../providers/steam/library-scan";
import {
  buildSteamLibraryAchievementHistorySnapshot,
} from "../../../../providers/steam/library-scan";
import { recordDeckyDiagnosticEvent } from "../../decky-diagnostic-logger";
import {
  writeDeckySteamLibraryAchievementScanSummary,
} from "./config";
import { createDeckySteamTransport } from "./backend-transport";

// Keep only one manual Steam library scan active in a Decky runtime at a time.
let activeDeckySteamLibraryAchievementScan:
  | Promise<SteamLibraryAchievementScanSummary>
  | undefined;

function logDeckySteamLibraryScan(
  level: "info" | "warn",
  message: string,
  fields: Record<string, unknown>,
): void {
  const logger = level === "warn" ? console.warn : console.info;
  logger(`[Achievement Companion][Steam] ${message}`, fields);
}

function emitDeckySteamLibraryScanDiagnosticEvent(
  event: Parameters<typeof recordDeckyDiagnosticEvent>[0]["event"],
  fields: Omit<Parameters<typeof recordDeckyDiagnosticEvent>[0], "event">,
): void {
  void recordDeckyDiagnosticEvent({
    event,
    ...fields,
  });
}

function createDeckySteamLibraryScanLogger(): SteamLibraryScanLogger {
  return {
    started(fields) {
      logDeckySteamLibraryScan("info", "Steam library scan started", fields);
      emitDeckySteamLibraryScanDiagnosticEvent("steam_library_scan_started", {
        providerId: STEAM_PROVIDER_ID,
        ownedGameCount: fields.ownedGameCount,
      });
    },
    progress(fields) {
      logDeckySteamLibraryScan("info", "Steam library scan progress", fields);
      emitDeckySteamLibraryScanDiagnosticEvent("steam_library_scan_progress", {
        providerId: STEAM_PROVIDER_ID,
        ownedGameCount: fields.ownedGameCount,
        scannedGameCount: fields.scannedGameCount,
        skippedGameCount: fields.skippedGameCount,
        failedGameCount: fields.failedGameCount,
      });
    },
    completed(fields) {
      logDeckySteamLibraryScan("info", "Steam library scan completed", fields);
      emitDeckySteamLibraryScanDiagnosticEvent("steam_library_scan_completed", {
        providerId: STEAM_PROVIDER_ID,
        durationMs: fields.durationMs,
        ownedGameCount: fields.ownedGameCount,
        scannedGameCount: fields.scannedGameCount,
        gamesWithAchievements: fields.gamesWithAchievements,
        skippedGameCount: fields.skippedGameCount,
        failedGameCount: fields.failedGameCount,
        totalAchievements: fields.totalAchievements,
        unlockedAchievements: fields.unlockedAchievements,
        perfectGames: fields.perfectGames,
        completionPercent: fields.completionPercent,
      });
    },
    failed(fields) {
      logDeckySteamLibraryScan("warn", "Steam library scan failed", fields);
      emitDeckySteamLibraryScanDiagnosticEvent("steam_library_scan_failed", {
        providerId: STEAM_PROVIDER_ID,
        durationMs: fields.durationMs,
        ownedGameCount: fields.ownedGameCount,
        scannedGameCount: fields.scannedGameCount,
        skippedGameCount: fields.skippedGameCount,
        failedGameCount: fields.failedGameCount,
        errorKind: fields.errorKind,
      });
    },
  };
}

export function createDeckySteamLibraryScanDependencies(): Parameters<
  typeof scanSteamLibraryAchievements
>[1] {
  return {
    client: createSteamClient(createDeckySteamTransport()),
    logger: createDeckySteamLibraryScanLogger(),
  };
}

export async function runAndCacheDeckySteamLibraryAchievementScan(
  config: SteamProviderConfig,
  dependencies?: Parameters<typeof scanSteamLibraryAchievements>[1],
): Promise<SteamLibraryAchievementScanSummary> {
  if (activeDeckySteamLibraryAchievementScan !== undefined) {
    return activeDeckySteamLibraryAchievementScan;
  }

  const scanPromise = (async () => {
    const summary = await scanSteamLibraryAchievements(
      config,
      dependencies ?? createDeckySteamLibraryScanDependencies(),
    );
    writeDeckySteamLibraryAchievementScanSummary(summary);
    return summary;
  })();

  activeDeckySteamLibraryAchievementScan = scanPromise;
  try {
    return await scanPromise;
  } finally {
    if (activeDeckySteamLibraryAchievementScan === scanPromise) {
      activeDeckySteamLibraryAchievementScan = undefined;
    }
  }
}

export {
  buildSteamLibraryAchievementHistorySnapshot as buildDeckySteamAchievementHistorySnapshotFromSummary,
};

function getSteamScanGameSummaryStatus(
  game: SteamLibraryGameProgressSummary,
): NormalizedGame["status"] {
  if (game.scanStatus !== "scanned") {
    return "locked";
  }

  if (game.totalAchievements > 0) {
    return game.unlockedAchievements >= game.totalAchievements
      ? "mastered"
      : game.unlockedAchievements > 0
        ? "in_progress"
        : "locked";
  }

  return game.unlockedAchievements > 0 ? "in_progress" : "locked";
}

function mapSteamScanGameToNormalizedGame(
  game: SteamLibraryGameProgressSummary,
): NormalizedGame {
  const completionPercent =
    game.totalAchievements > 0
      ? Math.max(0, Math.min(100, Math.round((game.unlockedAchievements / game.totalAchievements) * 100)))
      : 0;

  return {
    providerId: STEAM_PROVIDER_ID,
    appid: game.appid,
    gameId: game.gameId,
    title: game.title,
    platformLabel: game.platformLabel ?? "Steam",
    ...(game.iconUrl !== undefined ? { coverImageUrl: game.iconUrl } : {}),
    ...(game.playtimeForeverMinutes !== undefined ? { playtimeForeverMinutes: game.playtimeForeverMinutes } : {}),
    ...(game.playtimeTwoWeeksMinutes !== undefined
      ? { playtimeTwoWeeksMinutes: game.playtimeTwoWeeksMinutes }
      : {}),
    ...(game.playtimeDeckForeverMinutes !== undefined
      ? { playtimeDeckForeverMinutes: game.playtimeDeckForeverMinutes }
      : {}),
    ...(game.lastPlayedAt !== undefined && Number.isFinite(Date.parse(game.lastPlayedAt))
      ? { lastPlayedAt: Date.parse(game.lastPlayedAt) }
      : {}),
    ...(game.scanStatus !== undefined ? { scanStatus: game.scanStatus } : {}),
    ...(game.hasAchievements !== undefined ? { hasAchievements: game.hasAchievements } : {}),
    status: getSteamScanGameSummaryStatus(game),
    summary: {
      unlockedCount: game.unlockedAchievements,
      ...(game.totalAchievements > 0 ? { totalCount: game.totalAchievements } : {}),
      ...(game.totalAchievements > 0 ? { completionPercent } : {}),
    },
    metrics: [
      {
        key: "steam-game-id",
        label: "Steam Game ID",
        value: game.gameId,
      },
      {
        key: "unlocked-count",
        label: "Unlocked",
        value: String(game.unlockedAchievements),
      },
      {
        key: "total-count",
        label: "Total",
        value: String(game.totalAchievements),
      },
      {
        key: "completion-percent",
        label: "Completion",
        value: String(game.completionPercent),
      },
    ],
  };
}

export function buildDeckySteamCompletionProgressSnapshotFromSummary(
  summary: SteamLibraryAchievementScanSummary,
): CompletionProgressSnapshot {
  const games = summary.games.map(mapSteamScanGameToNormalizedGame);
  const playedCount = summary.games.filter((game) => {
    if ((game.playtimeForeverMinutes ?? 0) > 0) {
      return true;
    }

    if ((game.playtimeTwoWeeksMinutes ?? 0) > 0) {
      return true;
    }

    if ((game.playtimeDeckForeverMinutes ?? 0) > 0) {
      return true;
    }

    return game.hasAchievements;
  }).length;
  const unfinishedCount = summary.games.filter((game) => game.scanStatus === "scanned" && game.totalAchievements > 0 && game.unlockedAchievements < game.totalAchievements).length;
  const perfectGames = summary.games.filter((game) => game.scanStatus === "scanned" && game.totalAchievements > 0 && game.unlockedAchievements >= game.totalAchievements).length;
  const skippedOrFailedCount = summary.games.filter((game) => game.scanStatus !== "scanned").length;

  return {
    providerId: STEAM_PROVIDER_ID,
    games,
    summary: {
      playedCount,
      unfinishedCount,
      beatenCount: skippedOrFailedCount,
      masteredCount: perfectGames,
    },
    refreshedAt: Date.parse(summary.scannedAt),
  };
}
