import type { NormalizedGame, RecentlyPlayedGame } from "@core/domain";

const STEAM_STORE_ITEM_ASSETS_BASE_URL =
  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";

function buildSteamStoreArtworkUrl(appId: number, fileName: string): string {
  return `${STEAM_STORE_ITEM_ASSETS_BASE_URL}/${Math.trunc(appId)}/${fileName}`;
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
