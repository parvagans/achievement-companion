import type { NormalizedGame, RecentlyPlayedGame } from "@core/domain";

const STEAM_STORE_ITEM_ASSETS_BASE_URL =
  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";

export const STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH = 134;
export const STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT = 58;
export const STEAM_FULLSCREEN_GAME_ROW_HEIGHT = 70;

function buildSteamStoreArtworkUrl(appId: number, fileName: string): string {
  return `${STEAM_STORE_ITEM_ASSETS_BASE_URL}/${Math.trunc(appId)}/${fileName}`;
}

export function getSteamFullscreenGameArtworkUrlByGameId(
  gameId: string,
  fallback: Pick<NormalizedGame, "coverImageUrl" | "boxArtImageUrl">,
): string | undefined {
  if (!/^\d+$/u.test(gameId)) {
    return fallback.boxArtImageUrl ?? fallback.coverImageUrl;
  }

  const appId = Number.parseInt(gameId, 10);
  return getSteamFullscreenGameArtworkUrl({
    ...fallback,
    ...(Number.isFinite(appId) && appId > 0 ? { appid: appId } : {}),
  });
}

export function getSteamCompactGameArtworkUrl(
  game: Pick<RecentlyPlayedGame, "appid" | "coverImageUrl" | "boxArtImageUrl">,
): string | undefined {
  return (
    game.boxArtImageUrl ??
    game.coverImageUrl ??
    (game.appid !== undefined ? buildSteamStoreArtworkUrl(game.appid, "header.jpg") : undefined)
  );
}

export function getSteamFullscreenGameArtworkUrl(
  game: Pick<NormalizedGame, "appid" | "coverImageUrl" | "boxArtImageUrl">,
): string | undefined {
  return (
    (game.appid !== undefined ? buildSteamStoreArtworkUrl(game.appid, "header.jpg") : undefined) ??
    game.boxArtImageUrl ??
    game.coverImageUrl
  );
}

export function getSteamProfileGameIconUrl(
  game: Pick<RecentlyPlayedGame, "coverImageUrl" | "boxArtImageUrl">,
): string | undefined {
  return game.coverImageUrl ?? game.boxArtImageUrl;
}
