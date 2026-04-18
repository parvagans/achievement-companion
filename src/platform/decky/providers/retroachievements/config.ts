import { useMemo, useSyncExternalStore } from "react";
import type { ProviderId } from "@core/domain";
import {
  RETROACHIEVEMENTS_PROVIDER_ID,
  type RetroAchievementsProviderConfig,
} from "../../../../providers/retroachievements";
import {
  readDeckyStorageText,
  removeDeckyStorageText,
  removeDeckyStorageTextsByPrefix,
  writeDeckyStorageText,
} from "../../storage";

const RETROACHIEVEMENTS_CONFIG_STORAGE_KEY = "achievement-companion:decky:retroachievements:config";
const RETROACHIEVEMENTS_RECENT_ACHIEVEMENTS_STORAGE_KEY_PREFIX =
  "achievement-companion:decky:recent-achievements";
let deckyProviderConfigRevision = 0;
let cachedDeckyProviderConfigText: string | undefined;
const deckyProviderConfigListeners = new Set<() => void>();

export interface StoredRetroAchievementsConfig {
  readonly username?: unknown;
  readonly apiKey?: unknown;
}

function coerceString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseRetroAchievementsConfig(raw: unknown): RetroAchievementsProviderConfig | undefined {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }

  const candidate = raw as StoredRetroAchievementsConfig;
  const username = coerceString(candidate.username);
  const apiKey = coerceString(candidate.apiKey);

  if (username === undefined || apiKey === undefined) {
    return undefined;
  }

  return {
    username,
    apiKey,
  };
}

function readDeckyProviderConfigText(): string | undefined {
  return cachedDeckyProviderConfigText ?? readDeckyStorageText(RETROACHIEVEMENTS_CONFIG_STORAGE_KEY);
}

function notifyDeckyProviderConfigChanged(): void {
  deckyProviderConfigRevision += 1;

  for (const listener of deckyProviderConfigListeners) {
    listener();
  }
}

function subscribeDeckyProviderConfig(listener: () => void): () => void {
  deckyProviderConfigListeners.add(listener);
  return () => {
    deckyProviderConfigListeners.delete(listener);
  };
}

function parseProviderConfigFromStorageText(): RetroAchievementsProviderConfig | undefined {
  const rawText = readDeckyProviderConfigText();
  if (rawText === undefined) {
    return undefined;
  }

  try {
    return parseRetroAchievementsConfig(JSON.parse(rawText) as unknown);
  } catch {
    return undefined;
  }
}

export function readDeckyProviderConfig(
  providerId: ProviderId,
): RetroAchievementsProviderConfig | undefined {
  if (providerId !== RETROACHIEVEMENTS_PROVIDER_ID) {
    return undefined;
  }

  return parseProviderConfigFromStorageText();
}

export function useDeckyProviderConfig(
  providerId: ProviderId,
): RetroAchievementsProviderConfig | undefined {
  const revision = useSyncExternalStore(
    subscribeDeckyProviderConfig,
    () => deckyProviderConfigRevision,
    () => deckyProviderConfigRevision,
  );

  return useMemo(() => readDeckyProviderConfig(providerId), [providerId, revision]);
}

export async function loadDeckyProviderConfig(
  providerId: ProviderId,
): Promise<unknown | undefined> {
  return readDeckyProviderConfig(providerId);
}

export function writeDeckyProviderConfig(
  config: RetroAchievementsProviderConfig,
): boolean {
  const username = coerceString(config.username);
  const apiKey = coerceString(config.apiKey);

  if (username === undefined || apiKey === undefined) {
    return false;
  }

  const wroteConfig = writeDeckyStorageText(
    RETROACHIEVEMENTS_CONFIG_STORAGE_KEY,
    JSON.stringify({
      username,
      apiKey,
    }),
  );
  if (wroteConfig) {
    cachedDeckyProviderConfigText = JSON.stringify({
      username,
      apiKey,
    });
    notifyDeckyProviderConfigChanged();
  }

  return wroteConfig;
}

export function clearDeckyProviderConfig(): boolean {
  cachedDeckyProviderConfigText = undefined;
  const removedConfig = removeDeckyStorageText(RETROACHIEVEMENTS_CONFIG_STORAGE_KEY);
  if (removedConfig) {
    notifyDeckyProviderConfigChanged();
  }
  return removedConfig;
}

export function clearDeckyRetroAchievementsAccountState(): boolean {
  const removedConfig = clearDeckyProviderConfig();
  const removedRecentAchievements = removeDeckyStorageTextsByPrefix(
    RETROACHIEVEMENTS_RECENT_ACHIEVEMENTS_STORAGE_KEY_PREFIX,
  );

  return removedConfig || removedRecentAchievements;
}
