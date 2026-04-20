import type { ProviderId } from "@core/domain";
import type { DeckyProviderOption } from "./provider-option";
import { formatDeckyProviderLabel } from "./provider-labels";
import {
  RETROACHIEVEMENTS_PROVIDER_ID,
  type RetroAchievementsProviderConfig,
} from "../../../providers/retroachievements/config";
import {
  STEAM_PROVIDER_ID,
  type SteamProviderConfig,
} from "../../../providers/steam/config";
import { createRetroAchievementsDeckyProviderOption } from "./retroachievements/provider";
import { createSteamDeckyProviderOption } from "./steam/provider";
import {
  clearDeckyProviderConfigCache,
  clearDeckyProviderAccountState as clearDeckyProviderAccountStateFromStore,
  loadDeckyProviderConfig,
  readDeckyProviderConfig,
  type DeckyProviderConfigs,
  updateDeckyProviderConfigCache,
  useDeckyProviderConfig,
  useDeckyProviderConfigs,
} from "./provider-config-store";
import { saveDeckyRetroAchievementsCredentials, saveDeckySteamCredentials } from "./provider-config-store";

export type { DeckyProviderConfigs };

export type DeckyProviderConfigById =
  | RetroAchievementsProviderConfig
  | SteamProviderConfig
  | undefined;

export function getDeckyProviderOptions(
  configs: DeckyProviderConfigs,
): readonly DeckyProviderOption[] {
  return [
    createRetroAchievementsDeckyProviderOption(configs.retroAchievements),
    createSteamDeckyProviderOption(configs.steam),
  ];
}

export async function writeDeckyProviderConfig(
  providerId: ProviderId,
  config: unknown,
  apiKeyDraft: string,
): Promise<boolean> {
  if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
    const savedConfig = await saveDeckyRetroAchievementsCredentials({
      username: (config as RetroAchievementsProviderConfig).username,
      apiKeyDraft,
    });
    return savedConfig !== undefined;
  }

  if (providerId === STEAM_PROVIDER_ID) {
    const steamConfig = config as SteamProviderConfig;
    const savedConfig = await saveDeckySteamCredentials({
      steamId64: steamConfig.steamId64,
      apiKeyDraft,
      language: steamConfig.language,
      recentAchievementsCount: steamConfig.recentAchievementsCount,
      recentlyPlayedCount: steamConfig.recentlyPlayedCount,
      includePlayedFreeGames: steamConfig.includePlayedFreeGames,
    });
    return savedConfig !== undefined;
  }

  return false;
}

export async function clearDeckyProviderAccountState(providerId: ProviderId): Promise<boolean> {
  if (providerId === RETROACHIEVEMENTS_PROVIDER_ID || providerId === STEAM_PROVIDER_ID) {
    return clearDeckyProviderAccountStateFromStore(providerId);
  }

  return false;
}

export {
  RETROACHIEVEMENTS_PROVIDER_ID,
  STEAM_PROVIDER_ID,
  formatDeckyProviderLabel,
  loadDeckyProviderConfig,
  readDeckyProviderConfig,
  updateDeckyProviderConfigCache,
  useDeckyProviderConfig,
  useDeckyProviderConfigs,
  clearDeckyProviderConfigCache,
};
