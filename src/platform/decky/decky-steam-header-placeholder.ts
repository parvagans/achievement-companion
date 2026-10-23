const LEGACY_STEAM_HEADER_URL = /^https:\/\/shared\.akamai\.steamstatic\.com\/store_item_assets\/steam\/apps\/[1-9]\d*\/header\.jpg(?:\?.*)?$/u;
const MAX_BLANK_HEADER_BYTES = 2048;
const headerChecks = new Map<string, Promise<boolean>>();

export function isLegacySteamHeaderUrl(url: string): boolean {
  return LEGACY_STEAM_HEADER_URL.test(url);
}

export function isBlankSteamHeaderResponse(response: Response): boolean {
  if (!response.ok || !response.headers.get("content-type")?.toLowerCase().startsWith("image/")) return false;
  const contentLength = Number(response.headers.get("content-length"));
  return Number.isFinite(contentLength) && contentLength > 0 && contentLength <= MAX_BLANK_HEADER_BYTES;
}

/** Steam can return its tiny gray header placeholder with HTTP 200, so img.onError never fires. */
export function loadBlankSteamHeaderStatus(url: string): Promise<boolean> {
  if (!isLegacySteamHeaderUrl(url)) return Promise.resolve(false);
  const existing = headerChecks.get(url);
  if (existing !== undefined) return existing;
  const check = fetch(url, { method: "HEAD", credentials: "omit" })
    .then(isBlankSteamHeaderResponse)
    .catch(() => {
      headerChecks.delete(url);
      return false;
    });
  headerChecks.set(url, check);
  return check;
}
