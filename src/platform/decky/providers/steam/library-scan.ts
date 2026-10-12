import { STEAM_PROVIDER_ID, type SteamProviderConfig } from "../../../../providers/steam";
import type { CompletionProgressSnapshot, NormalizedGame } from "@core/domain";
import { createSteamClient } from "../../../../providers/steam";
import {
  scanSteamLibraryAchievements,
  refreshSteamLibraryAchievementProgress,
  type SteamLibraryAchievementScanSummary,
  type SteamLibraryAchievementSchemaCache,
  type SteamLibraryScanLogger,
  type SteamLibraryGameProgressSummary,
} from "../../../../providers/steam/library-scan";
import {
  buildSteamLibraryAchievementHistorySnapshot,
} from "../../../../providers/steam/library-scan";
import {
  deckyDiagnosticLogger,
  type DeckyDiagnosticEvent,
  type DeckyDiagnosticEventPayload,
} from "../../decky-diagnostic-logger";
import {
  getDeckySteamLibraryAchievementScanRevision,
  readDeckySteamLibraryAchievementScanSummary,
  readDeckySteamAchievementSchemaCache,
  writeDeckySteamAchievementSchemaCache,
  writeDeckySteamLibraryAchievementScanSummaryIfRevisionMatches,
} from "./config";
import { createDeckySteamTransport } from "./backend-transport";

// Keep only one manual Steam library scan active in a Decky runtime at a time.
const activeDeckySteamLibraryAchievementScans = new Map<string, Promise<SteamLibraryAchievementScanSummary>>();
const activeDeckySteamLibraryAchievementRefreshes = new Map<
  string,
  Promise<SteamLibraryAchievementScanSummary | undefined>
>();
let steamLibrarySummaryUpdateQueue: Promise<void> = Promise.resolve();

function runSteamLibrarySummaryUpdate<T>(operation: () => Promise<T>): Promise<T> {
  const queuedOperation = steamLibrarySummaryUpdateQueue.then(operation, operation);
  steamLibrarySummaryUpdateQueue = queuedOperation.then(() => undefined, () => undefined);
  return queuedOperation;
}

function logDeckySteamLibraryScan(
  level: "info" | "warn",
  message: string,
  fields: Record<string, unknown>,
): void {
  const logger = level === "warn" ? console.warn : console.info;
  logger(`[Achievement Companion][Steam] ${message}`, fields);
}

function emitDeckySteamLibraryScanDiagnosticEvent(
  event: DeckyDiagnosticEvent,
  fields: Omit<DeckyDiagnosticEventPayload, "event">,
): void {
  void deckyDiagnosticLogger.record({
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

export function createDeckySteamLibraryScanDependencies(): NonNullable<Parameters<
  typeof scanSteamLibraryAchievements
>[1]> {
  return {
    client: createSteamClient(createDeckySteamTransport()),
    logger: createDeckySteamLibraryScanLogger(),
  };
}

function createDeckySteamSchemaCache(steamId64: string): SteamLibraryAchievementSchemaCache {
  return {
    read(appId) {
      return readDeckySteamAchievementSchemaCache(steamId64, appId);
    },
    write(appId, achievements) {
      writeDeckySteamAchievementSchemaCache(steamId64, appId, achievements);
    },
  };
}

function getPreviousSummaryForSteamAccount(
  summary: SteamLibraryAchievementScanSummary | undefined,
  steamId64: string,
): SteamLibraryAchievementScanSummary | undefined {
  // Summaries written before account scoping are treated as belonging to the
  // currently configured account for compatibility; account changes clear them.
  return summary === undefined || summary.steamId64 === undefined || summary.steamId64 === steamId64
    ? summary
    : undefined;
}

function getDeckySteamLibraryScanDependencies(
  config: SteamProviderConfig,
  dependencies?: Parameters<typeof scanSteamLibraryAchievements>[1],
): NonNullable<Parameters<typeof scanSteamLibraryAchievements>[1]> {
  const defaults = dependencies ?? createDeckySteamLibraryScanDependencies();
  return {
    ...defaults,
    schemaCache: defaults.schemaCache ?? createDeckySteamSchemaCache(config.steamId64),
  };
}

export async function runAndCacheDeckySteamLibraryAchievementScan(
  config: SteamProviderConfig,
  dependencies?: Parameters<typeof scanSteamLibraryAchievements>[1],
): Promise<SteamLibraryAchievementScanSummary> {
  const active = activeDeckySteamLibraryAchievementScans.get(config.steamId64);
  if (active !== undefined) {
    return active;
  }

  const scanPromise = runSteamLibrarySummaryUpdate(async () => {
    const expectedRevision = getDeckySteamLibraryAchievementScanRevision();
    const previousSummary = getPreviousSummaryForSteamAccount(
      readDeckySteamLibraryAchievementScanSummary(STEAM_PROVIDER_ID),
      config.steamId64,
    );
    const summary = await scanSteamLibraryAchievements(
      config,
      {
        ...getDeckySteamLibraryScanDependencies(config, dependencies),
        ...(previousSummary !== undefined ? { previousSummary } : {}),
      },
    );
    if (writeDeckySteamLibraryAchievementScanSummaryIfRevisionMatches(expectedRevision, summary)) {
      return summary;
    }
    return readDeckySteamLibraryAchievementScanSummary(STEAM_PROVIDER_ID) ?? summary;
  });

  activeDeckySteamLibraryAchievementScans.set(config.steamId64, scanPromise);
  try {
    return await scanPromise;
  } finally {
    if (activeDeckySteamLibraryAchievementScans.get(config.steamId64) === scanPromise) {
      activeDeckySteamLibraryAchievementScans.delete(config.steamId64);
    }
  }
}

export async function refreshAndCacheDeckySteamLibraryAchievementProgress(
  config: SteamProviderConfig,
  dependencies?: Parameters<typeof refreshSteamLibraryAchievementProgress>[2],
): Promise<SteamLibraryAchievementScanSummary | undefined> {
  const active = activeDeckySteamLibraryAchievementRefreshes.get(config.steamId64);
  if (active !== undefined) {
    return active;
  }

  const refreshPromise = runSteamLibrarySummaryUpdate(async () => {
    const expectedRevision = getDeckySteamLibraryAchievementScanRevision();
    const previousSummary = getPreviousSummaryForSteamAccount(
      readDeckySteamLibraryAchievementScanSummary(STEAM_PROVIDER_ID),
      config.steamId64,
    );
    try {
      const summary = await refreshSteamLibraryAchievementProgress(
        config,
        previousSummary,
        getDeckySteamLibraryScanDependencies(config, dependencies),
      );
      if (writeDeckySteamLibraryAchievementScanSummaryIfRevisionMatches(expectedRevision, summary)) {
        return summary;
      }
      return readDeckySteamLibraryAchievementScanSummary(STEAM_PROVIDER_ID);
    } catch (cause) {
      logDeckySteamLibraryScan("warn", "Steam library refresh retained cached data", {
        error: cause instanceof Error ? cause.message : String(cause),
      });
      return readDeckySteamLibraryAchievementScanSummary(STEAM_PROVIDER_ID);
    }
  });

  activeDeckySteamLibraryAchievementRefreshes.set(config.steamId64, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    if (activeDeckySteamLibraryAchievementRefreshes.get(config.steamId64) === refreshPromise) {
      activeDeckySteamLibraryAchievementRefreshes.delete(config.steamId64);
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
    ...(game.ownershipStatus !== undefined ? { ownershipStatus: game.ownershipStatus } : {}),
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
  const activeGames = summary.games.filter((game) => game.ownershipStatus !== "inactive");
  const games = activeGames.map(mapSteamScanGameToNormalizedGame);
  const playedCount = activeGames.filter((game) => {
    if ((game.playtimeForeverMinutes ?? 0) > 0) {
      return true;
    }

    if ((game.playtimeTwoWeeksMinutes ?? 0) > 0) {
      return true;
    }

    if ((game.playtimeDeckForeverMinutes ?? 0) > 0) {
      return true;
    }

    return game.unlockedAchievements > 0;
  }).length;
  const unfinishedCount = activeGames.filter((game) => game.scanStatus === "scanned" && game.totalAchievements > 0 && game.unlockedAchievements < game.totalAchievements).length;
  const perfectGames = activeGames.filter((game) => game.scanStatus === "scanned" && game.totalAchievements > 0 && game.unlockedAchievements >= game.totalAchievements).length;
  const skippedCount = activeGames.filter((game) => game.scanStatus === "no-achievements").length;

  return {
    providerId: STEAM_PROVIDER_ID,
    games,
    summary: {
      playedCount,
      unfinishedCount,
      beatenCount: skippedCount,
      masteredCount: perfectGames,
    },
    refreshedAt: Date.parse(summary.scannedAt),
  };
}
