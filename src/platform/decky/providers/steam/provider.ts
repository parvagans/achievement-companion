import { STEAM_PROVIDER_ID, type SteamProviderConfig } from "../../../../providers/steam";
import { STEAM_PROVIDER_ICON_SRC } from "./icon";
import type { DeckyProviderOption } from "../provider-option";

export function createSteamDeckyProviderOption(
  config: SteamProviderConfig | undefined,
): DeckyProviderOption {
  return {
    id: STEAM_PROVIDER_ID,
    label: "Steam",
    ...(STEAM_PROVIDER_ICON_SRC !== undefined ? { iconSrc: STEAM_PROVIDER_ICON_SRC } : {}),
    enabled: true,
    connected: config?.hasApiKey === true,
  };
}
