import { ACHIEVEMENT_COMPANION_COUNT_OPTIONS, type AchievementCompanionCount } from "@core/settings";

export const RETROACHIEVEMENTS_PROVIDER_ID = "retroachievements" as const;

export interface RetroAchievementsProviderConfig {
  readonly username: string;
  readonly hasApiKey: boolean;
  readonly recentAchievementsCount?: AchievementCompanionCount;
  readonly recentlyPlayedCount?: AchievementCompanionCount;
}

export const DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG: RetroAchievementsProviderConfig = {
  username: "",
  hasApiKey: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function coerceString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function coerceCount(value: unknown): AchievementCompanionCount | undefined {
  return ACHIEVEMENT_COMPANION_COUNT_OPTIONS.includes(value as AchievementCompanionCount)
    ? (value as AchievementCompanionCount)
    : undefined;
}

export function normalizeRetroAchievementsProviderConfig(value: unknown): RetroAchievementsProviderConfig {
  if (!isRecord(value)) {
    return DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG;
  }

  const username = coerceString(value["username"]) ?? DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG.username;
  const hasApiKey =
    coerceBoolean(value["hasApiKey"], coerceString(value["apiKey"]) !== undefined) ??
    DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG.hasApiKey;
  const recentAchievementsCount = coerceCount(value["recentAchievementsCount"]);
  const recentlyPlayedCount = coerceCount(value["recentlyPlayedCount"]);

  return {
    username,
    hasApiKey,
    ...(recentAchievementsCount !== undefined
      ? { recentAchievementsCount }
      : {}),
    ...(recentlyPlayedCount !== undefined
      ? { recentlyPlayedCount }
      : {}),
  };
}

export function parseRetroAchievementsProviderConfig(
  rawValue: string | undefined,
): RetroAchievementsProviderConfig {
  if (rawValue === undefined) {
    return DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG;
  }

  try {
    return normalizeRetroAchievementsProviderConfig(JSON.parse(rawValue));
  } catch {
    return DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG;
  }
}

export function serializeRetroAchievementsProviderConfig(
  config: RetroAchievementsProviderConfig,
): string {
  return JSON.stringify({
    username: config.username.trim(),
    hasApiKey: config.hasApiKey,
    ...(config.recentAchievementsCount !== undefined
      ? { recentAchievementsCount: config.recentAchievementsCount }
      : {}),
    ...(config.recentlyPlayedCount !== undefined
      ? { recentlyPlayedCount: config.recentlyPlayedCount }
      : {}),
  });
}
