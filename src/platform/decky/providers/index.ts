import type { DeckyProviderOption } from "./provider-option";
import { formatDeckyProviderLabel } from "./provider-labels";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../../providers/retroachievements/config";
import { STEAM_PROVIDER_ID } from "../../../providers/steam/config";
import { createRetroAchievementsDeckyProviderOption } from "./retroachievements/provider";
import { createSteamDeckyProviderOption } from "./steam/provider";
import {
  clearDeckyProviderConfigCache,
  loadDeckyProviderConfig,
  readDeckyProviderConfig,
  type DeckyProviderConfigs,
  updateDeckyProviderConfigCache,
  useDeckyProviderConfig,
  useDeckyProviderConfigs,
} from "./provider-config-store";

export type { DeckyProviderConfigs };

export function getDeckyProviderOptions(
  configs: DeckyProviderConfigs,
): readonly DeckyProviderOption[] {
  return [
    createRetroAchievementsDeckyProviderOption(configs.retroAchievements),
    createSteamDeckyProviderOption(configs.steam),
  ];
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
