import { ACHIEVEMENT_COMPANION_COUNT_OPTIONS, type AchievementCompanionCount } from "@core/settings";

export const STEAM_PROVIDER_ID = "steam" as const;

export interface SteamProviderConfig {
  readonly steamId64: string;
  readonly hasApiKey: boolean;
  readonly language: string;
  readonly recentAchievementsCount: AchievementCompanionCount;
  readonly recentlyPlayedCount: AchievementCompanionCount;
  readonly includePlayedFreeGames: boolean;
}

export const DEFAULT_STEAM_PROVIDER_CONFIG: SteamProviderConfig = {
  steamId64: "",
  hasApiKey: false,
  language: "english",
  recentAchievementsCount: 5,
  recentlyPlayedCount: 5,
  includePlayedFreeGames: false,
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

function coerceSteamId64(value: unknown): string | undefined {
  const candidate = coerceString(value);
  if (candidate === undefined) {
    return undefined;
  }

  return /^\d{15,20}$/u.test(candidate) ? candidate : undefined;
}

function normalizeCount(value: unknown, fallback: AchievementCompanionCount): AchievementCompanionCount {
  return ACHIEVEMENT_COMPANION_COUNT_OPTIONS.includes(value as AchievementCompanionCount)
    ? (value as AchievementCompanionCount)
    : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

export function normalizeSteamProviderConfig(value: unknown): SteamProviderConfig {
  if (!isRecord(value)) {
    return DEFAULT_STEAM_PROVIDER_CONFIG;
  }

  const steamId64 = coerceSteamId64(value["steamId64"]) ?? DEFAULT_STEAM_PROVIDER_CONFIG.steamId64;
  const language = coerceString(value["language"]) ?? DEFAULT_STEAM_PROVIDER_CONFIG.language;
  const hasApiKey =
    normalizeBoolean(value["hasApiKey"], coerceString(value["apiKey"]) !== undefined) ??
    DEFAULT_STEAM_PROVIDER_CONFIG.hasApiKey;

  return {
    steamId64,
    hasApiKey,
    language,
    recentAchievementsCount: normalizeCount(
      value["recentAchievementsCount"],
      DEFAULT_STEAM_PROVIDER_CONFIG.recentAchievementsCount,
    ),
    recentlyPlayedCount: normalizeCount(
      value["recentlyPlayedCount"],
      DEFAULT_STEAM_PROVIDER_CONFIG.recentlyPlayedCount,
    ),
    includePlayedFreeGames: normalizeBoolean(
      value["includePlayedFreeGames"],
      DEFAULT_STEAM_PROVIDER_CONFIG.includePlayedFreeGames,
    ),
  };
}

export function parseSteamProviderConfig(rawValue: string | undefined): SteamProviderConfig {
  if (rawValue === undefined) {
    return DEFAULT_STEAM_PROVIDER_CONFIG;
  }

  try {
    return normalizeSteamProviderConfig(JSON.parse(rawValue));
  } catch {
    return DEFAULT_STEAM_PROVIDER_CONFIG;
  }
}

export function serializeSteamProviderConfig(config: SteamProviderConfig): string {
  return JSON.stringify({
    steamId64: config.steamId64.trim(),
    hasApiKey: config.hasApiKey,
    language: config.language.trim() || DEFAULT_STEAM_PROVIDER_CONFIG.language,
    recentAchievementsCount: config.recentAchievementsCount,
    recentlyPlayedCount: config.recentlyPlayedCount,
    includePlayedFreeGames: config.includePlayedFreeGames,
  });
}
