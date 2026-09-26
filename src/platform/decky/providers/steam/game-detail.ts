import type { GameDetailSnapshot } from "@core/domain";
import { normalizeSteamArtworkUrl } from "../../../../providers/steam/artwork";
import type {
  SteamLibraryAchievementScanSummary,
  SteamLibraryGameProgressSummary,
} from "../../../../providers/steam/library-scan";

function parseSteamAppId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
  }

  return undefined;
}

export function findSteamLibraryScanGameSummaryByAppId(
  summary: SteamLibraryAchievementScanSummary | undefined,
  appId: number | undefined,
): SteamLibraryGameProgressSummary | undefined {
  if (summary === undefined || appId === undefined) {
    return undefined;
  }

  return summary.games.find(
    (game) => game.appid === appId || game.gameId === String(appId) || game.id === String(appId),
  );
}

export function applySteamLibraryScanGameDetailMetadata(
  snapshot: GameDetailSnapshot,
  summary: SteamLibraryAchievementScanSummary | undefined,
): GameDetailSnapshot {
  const appId = snapshot.game.appid ?? parseSteamAppId(snapshot.game.gameId);
  const cachedGame = findSteamLibraryScanGameSummaryByAppId(summary, appId);

  if (cachedGame === undefined) {
    return snapshot;
  }

  const resolvedTitle = cachedGame.title.trim().length > 0 ? cachedGame.title : snapshot.game.title;
  const resolvedIconUrl = normalizeSteamArtworkUrl(cachedGame.iconUrl, cachedGame.appid);
  const resolvedCoverImageUrl = resolvedIconUrl ?? snapshot.game.coverImageUrl;
  const resolvedBoxArtImageUrl = resolvedIconUrl ?? snapshot.game.boxArtImageUrl ?? resolvedCoverImageUrl;
  // Game-detail API responses do not consistently include the owned-library
  // playtime fields. Keep the live value when present, otherwise use the
  // last-known-good value collected from GetOwnedGames during the library scan.
  const resolvedPlaytimeForeverMinutes =
    snapshot.game.playtimeForeverMinutes ?? cachedGame.playtimeForeverMinutes;
  const resolvedPlaytimeTwoWeeksMinutes =
    snapshot.game.playtimeTwoWeeksMinutes ?? cachedGame.playtimeTwoWeeksMinutes;
  const resolvedPlaytimeDeckForeverMinutes =
    snapshot.game.playtimeDeckForeverMinutes ?? cachedGame.playtimeDeckForeverMinutes;

  const didChange =
    resolvedTitle !== snapshot.game.title ||
    resolvedCoverImageUrl !== snapshot.game.coverImageUrl ||
    resolvedBoxArtImageUrl !== snapshot.game.boxArtImageUrl ||
    resolvedPlaytimeForeverMinutes !== snapshot.game.playtimeForeverMinutes ||
    resolvedPlaytimeTwoWeeksMinutes !== snapshot.game.playtimeTwoWeeksMinutes ||
    resolvedPlaytimeDeckForeverMinutes !== snapshot.game.playtimeDeckForeverMinutes ||
    cachedGame.appid !== snapshot.game.appid ||
    cachedGame.gameId !== snapshot.game.gameId;

  if (!didChange) {
    return snapshot;
  }

  return {
    ...snapshot,
    game: {
      ...snapshot.game,
      ...(cachedGame.appid !== undefined ? { appid: cachedGame.appid } : {}),
      gameId: cachedGame.gameId,
      title: resolvedTitle,
      platformLabel: cachedGame.platformLabel ?? snapshot.game.platformLabel ?? "Steam",
      ...(resolvedCoverImageUrl !== undefined ? { coverImageUrl: resolvedCoverImageUrl } : {}),
      ...(resolvedBoxArtImageUrl !== undefined ? { boxArtImageUrl: resolvedBoxArtImageUrl } : {}),
      ...(resolvedPlaytimeForeverMinutes !== undefined
        ? { playtimeForeverMinutes: resolvedPlaytimeForeverMinutes }
        : {}),
      ...(resolvedPlaytimeTwoWeeksMinutes !== undefined
        ? { playtimeTwoWeeksMinutes: resolvedPlaytimeTwoWeeksMinutes }
        : {}),
      ...(resolvedPlaytimeDeckForeverMinutes !== undefined
        ? { playtimeDeckForeverMinutes: resolvedPlaytimeDeckForeverMinutes }
        : {}),
    },
  };
}
