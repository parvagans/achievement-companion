import type { DashboardSnapshot, RecentlyPlayedGame } from "@core/domain";
import type { SteamLibraryAchievementScanSummary } from "../../providers/steam/library-scan";
import { getSteamXpProgress } from "./steam-xp";

export interface SteamProfileGameSummary {
  readonly gameId: string;
  readonly title: string;
  readonly artworkUrl?: string;
  readonly unlockedAchievements: number;
  readonly totalAchievements?: number;
  readonly completionPercent?: number;
  readonly achievementsRemaining?: number;
  readonly totalPlaytimeMinutes?: number;
  readonly steamDeckPlaytimeMinutes?: number;
  readonly lastPlayedAt?: number;
}

export interface SteamFullScreenProfileSummary {
  readonly account: {
    readonly level?: number;
    readonly badges?: number;
    readonly xp?: number;
    readonly xpToNextLevel?: number;
    readonly nextLevel?: number;
    readonly xpProgressPercent?: number;
  };
  readonly achievements: {
    readonly unlocked: number;
    readonly perfectGames?: number;
    readonly completionPercent?: number;
  };
  readonly library: {
    readonly ownedGames?: number;
    readonly playedGames?: number;
    readonly unplayedGames?: number;
    readonly inProgressGames?: number;
    readonly totalPlaytimeMinutes?: number;
    readonly steamDeckPlaytimeMinutes?: number;
    readonly lastTwoWeeksPlaytimeMinutes?: number;
    readonly lastLibraryScanAt?: number;
  };
  readonly mostPlayedGame?: SteamProfileGameSummary;
  readonly closestToPerfectGame?: SteamProfileGameSummary;
  readonly recentGames: readonly SteamProfileGameSummary[];
}

function normalizeMinutes(minutes: number | undefined): number | undefined {
  if (minutes === undefined || !Number.isFinite(minutes)) {
    return undefined;
  }

  return Math.max(0, Math.trunc(minutes));
}

function hasRecordedPlaytime(game: Pick<SteamLibraryAchievementScanSummary["games"][number],
  "playtimeForeverMinutes" | "playtimeTwoWeeksMinutes" | "playtimeDeckForeverMinutes">): boolean {
  return [
    game.playtimeForeverMinutes,
    game.playtimeTwoWeeksMinutes,
    game.playtimeDeckForeverMinutes,
  ].some((minutes) => (normalizeMinutes(minutes) ?? 0) > 0);
}

function toSteamProfileGameSummary(
  game: SteamLibraryAchievementScanSummary["games"][number],
): SteamProfileGameSummary {
  const totalAchievements = game.totalAchievements > 0 ? game.totalAchievements : undefined;
  const totalPlaytimeMinutes = normalizeMinutes(game.playtimeForeverMinutes);
  const steamDeckPlaytimeMinutes = normalizeMinutes(game.playtimeDeckForeverMinutes);
  const unlockedAchievements = Math.max(0, Math.trunc(game.unlockedAchievements));
  const completionPercent = totalAchievements !== undefined
    ? Math.max(0, Math.min(100, Math.round((unlockedAchievements / totalAchievements) * 100)))
    : undefined;
  const parsedLastPlayedAt = game.lastPlayedAt !== undefined ? Date.parse(game.lastPlayedAt) : Number.NaN;

  return {
    gameId: game.gameId,
    title: game.title,
    ...(game.iconUrl !== undefined ? { artworkUrl: game.iconUrl } : {}),
    unlockedAchievements,
    ...(totalAchievements !== undefined ? { totalAchievements } : {}),
    ...(completionPercent !== undefined ? { completionPercent } : {}),
    ...(totalAchievements !== undefined ? { achievementsRemaining: totalAchievements - unlockedAchievements } : {}),
    ...(totalPlaytimeMinutes !== undefined
      ? { totalPlaytimeMinutes }
      : {}),
    ...(steamDeckPlaytimeMinutes !== undefined
      ? { steamDeckPlaytimeMinutes }
      : {}),
    ...(Number.isFinite(parsedLastPlayedAt) ? { lastPlayedAt: parsedLastPlayedAt } : {}),
  };
}

function toRecentSteamProfileGameSummary(game: RecentlyPlayedGame): SteamProfileGameSummary {
  const totalAchievements = game.summary.totalCount;
  const artworkUrl = game.coverImageUrl ?? game.boxArtImageUrl;
  const totalPlaytimeMinutes = normalizeMinutes(game.playtimeForeverMinutes);
  const steamDeckPlaytimeMinutes = normalizeMinutes(game.playtimeDeckForeverMinutes);

  return {
    gameId: game.gameId,
    title: game.title,
    ...(artworkUrl !== undefined
      ? { artworkUrl }
      : {}),
    unlockedAchievements: game.summary.unlockedCount,
    ...(totalAchievements !== undefined ? { totalAchievements } : {}),
    ...(game.summary.completionPercent !== undefined ? { completionPercent: game.summary.completionPercent } : {}),
    ...(totalAchievements !== undefined ? { achievementsRemaining: Math.max(0, totalAchievements - game.summary.unlockedCount) } : {}),
    ...(totalPlaytimeMinutes !== undefined
      ? { totalPlaytimeMinutes }
      : {}),
    ...(steamDeckPlaytimeMinutes !== undefined
      ? { steamDeckPlaytimeMinutes }
      : {}),
    ...(game.lastPlayedAt !== undefined ? { lastPlayedAt: game.lastPlayedAt } : {}),
  };
}

function getMostPlayedGame(
  games: readonly SteamLibraryAchievementScanSummary["games"][number][],
): SteamProfileGameSummary | undefined {
  return games
    .filter((game) => (normalizeMinutes(game.playtimeForeverMinutes) ?? 0) > 0)
    .map(toSteamProfileGameSummary)
    .sort((left, right) => (right.totalPlaytimeMinutes ?? 0) - (left.totalPlaytimeMinutes ?? 0))[0];
}

function getClosestToPerfectGame(
  games: readonly SteamLibraryAchievementScanSummary["games"][number][],
): SteamProfileGameSummary | undefined {
  return games
    .filter((game) =>
      game.scanStatus === "scanned" &&
      game.hasAchievements &&
      game.totalAchievements > 0 &&
      game.unlockedAchievements < game.totalAchievements,
    )
    .map(toSteamProfileGameSummary)
    .sort((left, right) => {
      const completionDelta = (right.completionPercent ?? 0) - (left.completionPercent ?? 0);
      if (completionDelta !== 0) {
        return completionDelta;
      }

      return (right.unlockedAchievements - left.unlockedAchievements) || left.title.localeCompare(right.title);
    })[0];
}

function sumPlaytime(
  games: readonly SteamLibraryAchievementScanSummary["games"][number][],
  property: "playtimeForeverMinutes" | "playtimeDeckForeverMinutes" | "playtimeTwoWeeksMinutes",
): number | undefined {
  const values = games
    .map((game) => normalizeMinutes(game[property]))
    .filter((value): value is number => value !== undefined);

  return values.length > 0 ? values.reduce((total, value) => total + value, 0) : undefined;
}

export function buildSteamFullScreenProfileSummary(args: {
  readonly profile: DashboardSnapshot["profile"];
  readonly recentlyPlayedGames: readonly RecentlyPlayedGame[];
  readonly libraryScan?: SteamLibraryAchievementScanSummary;
  readonly recentGameLimit?: number;
}): SteamFullScreenProfileSummary {
  const { profile, recentlyPlayedGames, libraryScan } = args;
  const xpProgress = getSteamXpProgress(profile.steamLevel, profile.playerXp);
  const games = libraryScan?.games ?? [];
  const playedGames = libraryScan !== undefined
    ? games.filter(hasRecordedPlaytime).length
    : undefined;
  const ownedGames = libraryScan?.ownedGameCount ?? profile.ownedGameCount;
  const inProgressGames = libraryScan !== undefined
    ? games.filter((game) =>
      hasRecordedPlaytime(game) &&
      game.scanStatus === "scanned" &&
      game.hasAchievements &&
      game.totalAchievements > 0 &&
      game.unlockedAchievements < game.totalAchievements,
    ).length
    : undefined;
  const parsedLastLibraryScanAt = libraryScan !== undefined ? Date.parse(libraryScan.scannedAt) : Number.NaN;
  const recentGameLimit = Math.max(0, args.recentGameLimit ?? 3);
  const totalPlaytimeMinutes = sumPlaytime(games, "playtimeForeverMinutes");
  const steamDeckPlaytimeMinutes = sumPlaytime(games, "playtimeDeckForeverMinutes");
  const lastTwoWeeksPlaytimeMinutes = sumPlaytime(games, "playtimeTwoWeeksMinutes");
  const mostPlayedGame = libraryScan !== undefined ? getMostPlayedGame(games) : undefined;
  const closestToPerfectGame = libraryScan !== undefined ? getClosestToPerfectGame(games) : undefined;

  return {
    account: {
      ...(profile.steamLevel !== undefined ? { level: profile.steamLevel } : {}),
      ...(profile.badgeCount !== undefined ? { badges: profile.badgeCount } : {}),
      ...(profile.playerXp !== undefined ? { xp: profile.playerXp } : {}),
      ...(xpProgress !== undefined ? {
        xpToNextLevel: xpProgress.xpToNextLevel,
        nextLevel: xpProgress.level + 1,
        xpProgressPercent: xpProgress.progressPercent,
      } : {}),
    },
    achievements: {
      unlocked: libraryScan?.unlockedAchievements ?? profile.summary.unlockedCount,
      ...(libraryScan !== undefined ? { perfectGames: libraryScan.perfectGames } : {}),
      ...(libraryScan?.completionPercent ?? profile.summary.completionPercent) !== undefined
        ? { completionPercent: libraryScan?.completionPercent ?? profile.summary.completionPercent }
        : {},
    },
    library: {
      ...(ownedGames !== undefined ? { ownedGames } : {}),
      ...(playedGames !== undefined ? { playedGames } : {}),
      ...(ownedGames !== undefined && playedGames !== undefined
        ? { unplayedGames: Math.max(0, ownedGames - playedGames) }
        : {}),
      ...(inProgressGames !== undefined ? { inProgressGames } : {}),
      ...(totalPlaytimeMinutes !== undefined
        ? { totalPlaytimeMinutes }
        : {}),
      ...(steamDeckPlaytimeMinutes !== undefined
        ? { steamDeckPlaytimeMinutes }
        : {}),
      ...(lastTwoWeeksPlaytimeMinutes !== undefined
        ? { lastTwoWeeksPlaytimeMinutes }
        : {}),
      ...(Number.isFinite(parsedLastLibraryScanAt) ? { lastLibraryScanAt: parsedLastLibraryScanAt } : {}),
    },
    ...(mostPlayedGame !== undefined ? { mostPlayedGame } : {}),
    ...(closestToPerfectGame !== undefined ? { closestToPerfectGame } : {}),
    recentGames: recentlyPlayedGames
      .map(toRecentSteamProfileGameSummary)
      .sort((left, right) => (right.lastPlayedAt ?? Number.NEGATIVE_INFINITY) - (left.lastPlayedAt ?? Number.NEGATIVE_INFINITY))
      .slice(0, recentGameLimit),
  };
}
