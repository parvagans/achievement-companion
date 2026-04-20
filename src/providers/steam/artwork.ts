const STEAM_ARTWORK_BASE_URL =
  "https://media.steampowered.com/steamcommunity/public/images/apps";

export function normalizeSteamArtworkUrl(
  imageUrl: string | undefined,
  appId?: number,
): string | undefined {
  if (imageUrl === undefined) {
    return undefined;
  }

  const trimmed = imageUrl.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith("/")) {
    return `https://media.steampowered.com${trimmed}`;
  }

  if (appId !== undefined) {
    return `${STEAM_ARTWORK_BASE_URL}/${Math.trunc(appId)}/${trimmed}.jpg`;
  }

  return trimmed;
}
