import type { ProviderId } from "@core/domain";
import { removeDeckyStorageTextsByPrefix } from "../../storage";
import { clearDeckyDashboardSnapshot } from "../../decky-dashboard-snapshot-cache";
import {
  RETROACHIEVEMENTS_PROVIDER_ID,
  type RetroAchievementsProviderConfig,
} from "../../../../providers/retroachievements/config";
import {
  clearDeckyRetroAchievementsAccountState as clearDeckyRetroAchievementsAccountStateFromStore,
  loadDeckyProviderConfig as loadDeckyProviderConfigFromStore,
  readDeckyProviderConfig as readDeckyProviderConfigFromStore,
  saveDeckyRetroAchievementsCredentials,
  type DeckyProviderConfigs,
  useDeckyProviderConfig as useDeckyProviderConfigFromStore,
  updateDeckyProviderConfigCache,
} from "../provider-config-store";

export type { RetroAchievementsProviderConfig } from "../../../../providers/retroachievements/config";
export type StoredRetroAchievementsConfig = Readonly<{
  readonly username?: unknown;
  readonly apiKey?: unknown;
  readonly recentAchievementsCount?: unknown;
  readonly recentlyPlayedCount?: unknown;
}>;
export type { DeckyProviderConfigs };

const DECKY_RECENT_ACHIEVEMENTS_STORAGE_KEY_PREFIX =
  "achievement-companion:decky:recent-achievements:retroachievements:";

export function readDeckyProviderConfig(
  providerId: ProviderId,
): RetroAchievementsProviderConfig | undefined {
  return providerId === RETROACHIEVEMENTS_PROVIDER_ID
    ? (readDeckyProviderConfigFromStore(providerId) as RetroAchievementsProviderConfig | undefined)
    : undefined;
}

export function useDeckyProviderConfig(
  providerId: ProviderId,
): RetroAchievementsProviderConfig | undefined {
  return providerId === RETROACHIEVEMENTS_PROVIDER_ID
    ? (useDeckyProviderConfigFromStore(providerId) as RetroAchievementsProviderConfig | undefined)
    : undefined;
}

export async function loadDeckyProviderConfig(
  providerId: ProviderId,
): Promise<RetroAchievementsProviderConfig | undefined> {
  return providerId === RETROACHIEVEMENTS_PROVIDER_ID
    ? (await loadDeckyProviderConfigFromStore(providerId)) as RetroAchievementsProviderConfig | undefined
    : undefined;
}

export async function writeDeckyProviderConfig(
  config: Omit<RetroAchievementsProviderConfig, "hasApiKey">,
  apiKeyDraft: string,
): Promise<boolean> {
  const savedConfig = await saveDeckyRetroAchievementsCredentials({
    username: config.username,
    ...(config.recentAchievementsCount !== undefined
      ? { recentAchievementsCount: config.recentAchievementsCount }
      : {}),
    ...(config.recentlyPlayedCount !== undefined
      ? { recentlyPlayedCount: config.recentlyPlayedCount }
      : {}),
    apiKeyDraft,
  });
  return savedConfig !== undefined;
}

export async function clearDeckyProviderConfig(): Promise<boolean> {
  const cleared = await clearDeckyRetroAchievementsAccountStateFromStore();
  if (cleared) {
    removeDeckyStorageTextsByPrefix(DECKY_RECENT_ACHIEVEMENTS_STORAGE_KEY_PREFIX);
    clearDeckyDashboardSnapshot(RETROACHIEVEMENTS_PROVIDER_ID);
  }

  return cleared;
}

export async function clearDeckyRetroAchievementsAccountState(): Promise<boolean> {
  const cleared = await clearDeckyRetroAchievementsAccountStateFromStore();
  if (cleared) {
    removeDeckyStorageTextsByPrefix(DECKY_RECENT_ACHIEVEMENTS_STORAGE_KEY_PREFIX);
    clearDeckyDashboardSnapshot(RETROACHIEVEMENTS_PROVIDER_ID);
  }

  return cleared;
}

export const readDeckyRetroAchievementsProviderConfig = readDeckyProviderConfig;
export const useDeckyRetroAchievementsProviderConfig = useDeckyProviderConfig;
export const loadDeckyRetroAchievementsProviderConfig = loadDeckyProviderConfig;
export { updateDeckyProviderConfigCache };
