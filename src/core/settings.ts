import type { KeyValueStore } from "./platform";

export const ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY =
  "achievement-companion:settings";

export const ACHIEVEMENT_COMPANION_COUNT_OPTIONS = [3, 5, 7, 10] as const;

export type AchievementCompanionCount =
  (typeof ACHIEVEMENT_COMPANION_COUNT_OPTIONS)[number];

export type CompletionProgressFilter = "all" | "unfinished" | "beaten" | "mastered";

export interface AchievementCompanionSettings {
  readonly recentAchievementsCount: AchievementCompanionCount;
  readonly recentlyPlayedCount: AchievementCompanionCount;
  readonly showCompletionProgressSubsets: boolean;
  readonly defaultCompletionProgressFilter: CompletionProgressFilter;
}

export const DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS: AchievementCompanionSettings = {
  recentAchievementsCount: 5,
  recentlyPlayedCount: 5,
  showCompletionProgressSubsets: true,
  defaultCompletionProgressFilter: "all",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeCount(value: unknown, fallback: AchievementCompanionCount): AchievementCompanionCount {
  return ACHIEVEMENT_COMPANION_COUNT_OPTIONS.includes(value as AchievementCompanionCount)
    ? (value as AchievementCompanionCount)
    : fallback;
}

function normalizeCompletionProgressFilter(
  value: unknown,
  fallback: CompletionProgressFilter,
): CompletionProgressFilter {
  return value === "all" || value === "unfinished" || value === "beaten" || value === "mastered"
    ? value
    : fallback;
}

export function normalizeAchievementCompanionSettings(
  value: unknown,
): AchievementCompanionSettings {
  if (!isRecord(value)) {
    return DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS;
  }

  return {
    recentAchievementsCount: normalizeCount(
      value["recentAchievementsCount"],
      DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.recentAchievementsCount,
    ),
    recentlyPlayedCount: normalizeCount(
      value["recentlyPlayedCount"],
      DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.recentlyPlayedCount,
    ),
    showCompletionProgressSubsets:
      typeof value["showCompletionProgressSubsets"] === "boolean"
        ? value["showCompletionProgressSubsets"]
        : DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.showCompletionProgressSubsets,
    defaultCompletionProgressFilter: normalizeCompletionProgressFilter(
      value["defaultCompletionProgressFilter"],
      DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.defaultCompletionProgressFilter,
    ),
  };
}

export function parseAchievementCompanionSettings(
  rawValue: string | undefined,
): AchievementCompanionSettings {
  if (rawValue === undefined) {
    return DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS;
  }

  try {
    return normalizeAchievementCompanionSettings(JSON.parse(rawValue));
  } catch {
    return DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS;
  }
}

export function serializeAchievementCompanionSettings(
  settings: AchievementCompanionSettings,
): string {
  return JSON.stringify(settings);
}

export async function loadAchievementCompanionSettings(
  store: KeyValueStore | undefined,
): Promise<AchievementCompanionSettings> {
  if (store === undefined) {
    return DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS;
  }

  try {
    return parseAchievementCompanionSettings(await store.read(ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY));
  } catch {
    return DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS;
  }
}

export async function saveAchievementCompanionSettings(
  store: KeyValueStore | undefined,
  settings: AchievementCompanionSettings,
): Promise<boolean> {
  if (store === undefined) {
    return false;
  }

  try {
    await store.write(
      ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY,
      serializeAchievementCompanionSettings(settings),
    );
    return true;
  } catch {
    return false;
  }
}

export function formatCompletionProgressFilterLabel(
  filter: CompletionProgressFilter,
): string {
  if (filter === "all") {
    return "All";
  }

  if (filter === "unfinished") {
    return "Unfinished";
  }

  if (filter === "beaten") {
    return "Beaten";
  }

  return "Mastered";
}
