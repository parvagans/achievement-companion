import { callDeckyBackendMethod } from "../../decky-backend-bridge";

interface CurrentSteamIdResponse {
  readonly steamId64?: unknown;
}

export async function detectDeckyCurrentSteamId64(): Promise<string | undefined> {
  try {
    const response = await callDeckyBackendMethod<CurrentSteamIdResponse>("get_current_steam_id64");
    const steamId64 = typeof response?.steamId64 === "string" ? response.steamId64.trim() : "";
    return /^\d{17}$/u.test(steamId64) ? steamId64 : undefined;
  } catch {
    return undefined;
  }
}
