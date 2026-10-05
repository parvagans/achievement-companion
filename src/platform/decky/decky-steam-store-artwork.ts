import { useEffect, useState } from "react";

const artworkRequests = new Map<number, Promise<string | undefined>>();

export function loadSteamStoreHeaderArtwork(appId: number): Promise<string | undefined> {
  const existing = artworkRequests.get(appId);
  if (existing !== undefined) return existing;
  const request = fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}`, { credentials: "omit" })
    .then((response) => response.ok ? response.json() as Promise<unknown> : undefined)
    .then((payload) => {
      const entry = (payload as Record<string, { success?: unknown; data?: { header_image?: unknown } }> | undefined)?.[String(appId)];
      const candidate = entry?.success === true ? entry.data?.header_image : undefined;
      if (typeof candidate !== "string") return undefined;
      try {
        const url = new URL(candidate);
        const steamStaticHost = url.hostname === "steamstatic.com" || url.hostname.endsWith(".steamstatic.com");
        return url.protocol === "https:" && steamStaticHost ? url.href : undefined;
      } catch { return undefined; }
    })
    .catch(() => undefined);
  artworkRequests.set(appId, request);
  return request;
}

/** Resolves Steam's newer, hashed store header when the legacy header URL is absent. */
export function useSteamStoreHeaderArtwork(appId: number | undefined): string | undefined {
  const [artwork, setArtwork] = useState<{ appId: number; url: string } | undefined>(undefined);
  useEffect(() => {
    if (appId === undefined || !Number.isSafeInteger(appId) || appId <= 0) return;
    let active = true;
    void loadSteamStoreHeaderArtwork(appId).then((url) => {
      if (active && url !== undefined) setArtwork({ appId, url });
    });
    return () => { active = false; };
  }, [appId]);
  return artwork !== undefined && artwork.appId === appId ? artwork.url : undefined;
}
