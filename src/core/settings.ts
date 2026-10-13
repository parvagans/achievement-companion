import type { KeyValueStore } from "./platform";

export const ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY =
  "achievement-companion:settings";

export const ACHIEVEMENT_COMPANION_COUNT_OPTIONS = [3, 5, 7, 10] as const;

export type AchievementCompanionCount =
  (typeof ACHIEVEMENT_COMPANION_COUNT_OPTIONS)[number];

export const ACTIVITY_CALENDAR_WEEK_OPTIONS = [4, 6, 8, 10, 12] as const;
export type ActivityCalendarWeeks = (typeof ACTIVITY_CALENDAR_WEEK_OPTIONS)[number];

export const RECENT_ACTIVITY_INTERVAL_OPTIONS = ["7d", "14d", "30d", "12w", "12m"] as const;
export type RecentActivityInterval = (typeof RECENT_ACTIVITY_INTERVAL_OPTIONS)[number];

export function formatRecentActivityInterval(interval: RecentActivityInterval): string {
  if (interval === "7d") return "7 days";
  if (interval === "14d") return "14 days";
  if (interval === "30d") return "30 days";
  if (interval === "12w") return "12 weeks";
  return "12 months";
}

export type CompletionProgressFilter = "all" | "unfinished" | "beaten" | "mastered";
export type UpdateSourceKind = "production" | "local";
export type RetroAchievementsRankDisplay = "site" | "casual";
export type RetroAchievementsAchievementMode = "hardcore" | "softcore" | "both";

export const GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_OPTIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;

export type GamePageAchievementBadgePosition =
  (typeof GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_OPTIONS)[number];

export const GAME_PAGE_ACHIEVEMENT_BADGE_COLOR_OPTIONS = [
  "purple",
  "blue",
  "green",
  "gray",
  "cyan",
  "gold",
  "red",
] as const;

export type GamePageAchievementBadgeColor =
  (typeof GAME_PAGE_ACHIEVEMENT_BADGE_COLOR_OPTIONS)[number];

export interface GamePageAchievementBadgeColors {
  readonly perfected: GamePageAchievementBadgeColor;
  readonly mastered: GamePageAchievementBadgeColor;
  readonly beaten: GamePageAchievementBadgeColor;
  readonly inProgress: GamePageAchievementBadgeColor;
}

export const DEFAULT_GAME_PAGE_ACHIEVEMENT_BADGE_COLORS: GamePageAchievementBadgeColors = {
  perfected: "purple",
  mastered: "green",
  beaten: "blue",
  inProgress: "gray",
};

export interface AchievementCompanionSettings {
  readonly recentAchievementsCount: AchievementCompanionCount;
  readonly recentlyPlayedCount: AchievementCompanionCount;
  readonly showCompletionProgressSubsets: boolean;
  readonly defaultCompletionProgressFilter: CompletionProgressFilter;
  readonly showGamePageAchievementBadge: boolean;
  readonly gamePageAchievementBadgePosition: GamePageAchievementBadgePosition;
  readonly gamePageAchievementBadgeColors: GamePageAchievementBadgeColors;
  readonly steamCompactActivityCalendarWeeks: ActivityCalendarWeeks;
  readonly steamFullscreenActivityCalendarWeeks: ActivityCalendarWeeks;
  readonly steamFullscreenRecentActivityInterval: RecentActivityInterval;
  readonly retroAchievementsCompactActivityCalendarWeeks: ActivityCalendarWeeks;
  readonly retroAchievementsFullscreenActivityCalendarWeeks: ActivityCalendarWeeks;
  readonly retroAchievementsFullscreenRecentActivityInterval: RecentActivityInterval;
  readonly retroAchievementsRankDisplay: RetroAchievementsRankDisplay;
  readonly retroAchievementsAchievementMode: RetroAchievementsAchievementMode;
  readonly automaticUpdateChecks: boolean;
  readonly updateSource: UpdateSourceKind;
  readonly localUpdateManifestUrl: string;
  readonly lastUpdateCheckedAt?: number;
  readonly lastNotifiedUpdateVersion?: string;
}

export const DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS: AchievementCompanionSettings = {
  recentAchievementsCount: 5,
  recentlyPlayedCount: 5,
  showCompletionProgressSubsets: true,
  defaultCompletionProgressFilter: "all",
  showGamePageAchievementBadge: true,
  gamePageAchievementBadgePosition: "top-left",
  gamePageAchievementBadgeColors: DEFAULT_GAME_PAGE_ACHIEVEMENT_BADGE_COLORS,
  steamCompactActivityCalendarWeeks: 8,
  steamFullscreenActivityCalendarWeeks: 12,
  steamFullscreenRecentActivityInterval: "30d",
  retroAchievementsCompactActivityCalendarWeeks: 8,
  retroAchievementsFullscreenActivityCalendarWeeks: 12,
  retroAchievementsFullscreenRecentActivityInterval: "30d",
  retroAchievementsRankDisplay: "site",
  retroAchievementsAchievementMode: "both",
  automaticUpdateChecks: true,
  updateSource: "production",
  localUpdateManifestUrl: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeCount(value: unknown, fallback: AchievementCompanionCount): AchievementCompanionCount {
  return ACHIEVEMENT_COMPANION_COUNT_OPTIONS.includes(value as AchievementCompanionCount)
    ? (value as AchievementCompanionCount)
    : fallback;
}

function normalizeActivityCalendarWeeks(value: unknown, fallback: ActivityCalendarWeeks): ActivityCalendarWeeks {
  return ACTIVITY_CALENDAR_WEEK_OPTIONS.includes(value as ActivityCalendarWeeks)
    ? (value as ActivityCalendarWeeks)
    : fallback;
}

function normalizeRecentActivityInterval(value: unknown, fallback: RecentActivityInterval): RecentActivityInterval {
  return RECENT_ACTIVITY_INTERVAL_OPTIONS.includes(value as RecentActivityInterval)
    ? value as RecentActivityInterval
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

function normalizeUpdateSource(value: unknown): UpdateSourceKind {
  return value === "local" ? "local" : "production";
}

function normalizeRetroAchievementsRankDisplay(value: unknown): RetroAchievementsRankDisplay {
  return value === "casual" ? value : "site";
}

function normalizeRetroAchievementsAchievementMode(value: unknown): RetroAchievementsAchievementMode {
  return value === "hardcore" || value === "softcore" ? value : "both";
}

function normalizeOptionalTimestamp(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeGamePageAchievementBadgePosition(
  value: unknown,
  fallback: GamePageAchievementBadgePosition,
): GamePageAchievementBadgePosition {
  return GAME_PAGE_ACHIEVEMENT_BADGE_POSITION_OPTIONS.includes(value as GamePageAchievementBadgePosition)
    ? (value as GamePageAchievementBadgePosition)
    : fallback;
}

function normalizeGamePageAchievementBadgeColor(
  value: unknown,
  fallback: GamePageAchievementBadgeColor,
): GamePageAchievementBadgeColor {
  return GAME_PAGE_ACHIEVEMENT_BADGE_COLOR_OPTIONS.includes(value as GamePageAchievementBadgeColor)
    ? (value as GamePageAchievementBadgeColor)
    : fallback;
}

function normalizeGamePageAchievementBadgeColors(value: unknown): GamePageAchievementBadgeColors {
  if (!isRecord(value)) {
    return DEFAULT_GAME_PAGE_ACHIEVEMENT_BADGE_COLORS;
  }

  return {
    perfected: normalizeGamePageAchievementBadgeColor(
      value["perfected"],
      DEFAULT_GAME_PAGE_ACHIEVEMENT_BADGE_COLORS.perfected,
    ),
    mastered: normalizeGamePageAchievementBadgeColor(
      value["mastered"],
      DEFAULT_GAME_PAGE_ACHIEVEMENT_BADGE_COLORS.mastered,
    ),
    beaten: normalizeGamePageAchievementBadgeColor(
      value["beaten"],
      DEFAULT_GAME_PAGE_ACHIEVEMENT_BADGE_COLORS.beaten,
    ),
    inProgress: normalizeGamePageAchievementBadgeColor(
      value["inProgress"],
      DEFAULT_GAME_PAGE_ACHIEVEMENT_BADGE_COLORS.inProgress,
    ),
  };
}

export function normalizeAchievementCompanionSettings(
  value: unknown,
): AchievementCompanionSettings {
  if (!isRecord(value)) {
    return DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS;
  }

  const lastUpdateCheckedAt = normalizeOptionalTimestamp(value["lastUpdateCheckedAt"]);
  const lastNotifiedUpdateVersion = normalizeOptionalString(value["lastNotifiedUpdateVersion"]);

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
    showGamePageAchievementBadge:
      typeof value["showGamePageAchievementBadge"] === "boolean"
        ? value["showGamePageAchievementBadge"]
        : DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.showGamePageAchievementBadge,
    gamePageAchievementBadgePosition: normalizeGamePageAchievementBadgePosition(
      value["gamePageAchievementBadgePosition"],
      DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.gamePageAchievementBadgePosition,
    ),
    gamePageAchievementBadgeColors: normalizeGamePageAchievementBadgeColors(
      value["gamePageAchievementBadgeColors"],
    ),
    steamCompactActivityCalendarWeeks: normalizeActivityCalendarWeeks(
      value["steamCompactActivityCalendarWeeks"],
      DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.steamCompactActivityCalendarWeeks,
    ),
    steamFullscreenActivityCalendarWeeks: normalizeActivityCalendarWeeks(
      value["steamFullscreenActivityCalendarWeeks"],
      DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.steamFullscreenActivityCalendarWeeks,
    ),
    steamFullscreenRecentActivityInterval: normalizeRecentActivityInterval(
      value["steamFullscreenRecentActivityInterval"],
      DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.steamFullscreenRecentActivityInterval,
    ),
    retroAchievementsCompactActivityCalendarWeeks: normalizeActivityCalendarWeeks(
      value["retroAchievementsCompactActivityCalendarWeeks"],
      DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.retroAchievementsCompactActivityCalendarWeeks,
    ),
    retroAchievementsFullscreenActivityCalendarWeeks: normalizeActivityCalendarWeeks(
      value["retroAchievementsFullscreenActivityCalendarWeeks"],
      DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.retroAchievementsFullscreenActivityCalendarWeeks,
    ),
    retroAchievementsFullscreenRecentActivityInterval: normalizeRecentActivityInterval(
      value["retroAchievementsFullscreenRecentActivityInterval"],
      DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.retroAchievementsFullscreenRecentActivityInterval,
    ),
    retroAchievementsRankDisplay: normalizeRetroAchievementsRankDisplay(
      value["retroAchievementsRankDisplay"],
    ),
    retroAchievementsAchievementMode: normalizeRetroAchievementsAchievementMode(
      value["retroAchievementsAchievementMode"],
    ),
    automaticUpdateChecks:
      typeof value["automaticUpdateChecks"] === "boolean"
        ? value["automaticUpdateChecks"]
        : DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.automaticUpdateChecks,
    updateSource: normalizeUpdateSource(value["updateSource"]),
    localUpdateManifestUrl:
      typeof value["localUpdateManifestUrl"] === "string"
        ? value["localUpdateManifestUrl"].trim()
        : DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS.localUpdateManifestUrl,
    ...(lastUpdateCheckedAt !== undefined
      ? { lastUpdateCheckedAt }
      : {}),
    ...(lastNotifiedUpdateVersion !== undefined
      ? { lastNotifiedUpdateVersion }
      : {}),
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
