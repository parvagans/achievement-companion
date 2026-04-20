import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../../providers/retroachievements";
import { STEAM_PROVIDER_ID } from "../../../providers/steam";
import { RETROACHIEVEMENTS_PROVIDER_ICON_SRC } from "./retroachievements/icon";
import { STEAM_PROVIDER_ICON_SRC } from "./steam/icon";

export function getDeckyProviderIconSrc(providerId: string): string | undefined {
  if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
    return RETROACHIEVEMENTS_PROVIDER_ICON_SRC;
  }

  if (providerId === STEAM_PROVIDER_ID) {
    return STEAM_PROVIDER_ICON_SRC;
  }

  return undefined;
}
