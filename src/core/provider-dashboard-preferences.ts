import {
  ACHIEVEMENT_COMPANION_COUNT_OPTIONS,
  DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS,
  type AchievementCompanionCount,
  type AchievementCompanionSettings,
} from "./settings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeCount(
  value: unknown,
  fallback: AchievementCompanionCount,
): AchievementCompanionCount {
  return ACHIEVEMENT_COMPANION_COUNT_OPTIONS.includes(value as AchievementCompanionCount)
    ? (value as AchievementCompanionCount)
    : fallback;
}

export interface ProviderDashboardPreferences {
  readonly recentAchievementsCount: AchievementCompanionCount;
  readonly recentlyPlayedCount: AchievementCompanionCount;
}

export function resolveProviderDashboardPreferences(
  providerConfig: unknown,
  fallbackSettings: AchievementCompanionSettings = DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS,
): ProviderDashboardPreferences {
  if (!isRecord(providerConfig)) {
    return {
      recentAchievementsCount: fallbackSettings.recentAchievementsCount,
      recentlyPlayedCount: fallbackSettings.recentlyPlayedCount,
    };
  }

  return {
    recentAchievementsCount: normalizeCount(
      providerConfig["recentAchievementsCount"],
      fallbackSettings.recentAchievementsCount,
    ),
    recentlyPlayedCount: normalizeCount(
      providerConfig["recentlyPlayedCount"],
      fallbackSettings.recentlyPlayedCount,
    ),
  };
}
