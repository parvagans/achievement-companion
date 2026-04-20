import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../../providers/retroachievements";
import { STEAM_PROVIDER_ID } from "../../../providers/steam";

export function formatDeckyProviderLabel(providerId: string): string {
  if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
    return "RetroAchievements";
  }

  if (providerId === STEAM_PROVIDER_ID) {
    return "Steam";
  }

  return providerId;
}
