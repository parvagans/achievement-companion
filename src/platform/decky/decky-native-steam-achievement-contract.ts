import type { NativeSteamAchievements } from "./decky-native-steam-achievement-conversion";

const STEAM_SHORTCUT_APP_TYPE = 1073741824;

interface SteamAppOverview {
  readonly appid?: number;
  readonly app_type?: number;
}

/** Steam's explicit Shortcut app type is the only admissible native adapter target. */
export function isNativeSteamShortcutOverview(overview: unknown, appId: number): boolean {
  if (typeof overview !== "object" || overview === null) return false;
  const candidate = overview as SteamAppOverview;
  return candidate.appid === appId && candidate.app_type === STEAM_SHORTCUT_APP_TYPE;
}

/** Adds a native section without changing Steam's memoized section Set. */
export function withNativeSteamAchievementsSection(
  sections: unknown,
  overview: unknown,
  appId: number,
  model: NativeSteamAchievements | undefined,
): unknown {
  if (!isNativeSteamShortcutOverview(overview, appId) || model === undefined || model.nTotal <= 0 || !(sections instanceof Set)) {
    return sections;
  }
  const next = new Set(sections);
  next.add("achievements");
  return next;
}

/** Shows Activity only when the verified shortcut has a dated RA unlock to display. */
export function withNativeSteamRecentActivitySection(
  sections: unknown,
  overview: unknown,
  appId: number,
  hasRecentUnlocks: boolean,
): unknown {
  if (!isNativeSteamShortcutOverview(overview, appId) || !hasRecentUnlocks || !(sections instanceof Set)) {
    return sections;
  }
  const next = new Set(sections);
  next.add("activity");
  return next;
}

export function toNativeSteamPersonalAchievementResponse(model: NativeSteamAchievements): {
  readonly data: {
    readonly achieved: Record<string, unknown>;
    readonly unachieved: Record<string, unknown>;
    readonly hidden: Record<string, unknown>;
  };
} {
  return {
    data: {
      achieved: Object.fromEntries(model.vecHighlight.map((achievement) => [achievement.strID, achievement])),
      unachieved: Object.fromEntries(model.vecUnachieved.map((achievement) => [achievement.strID, achievement])),
      hidden: Object.fromEntries(model.vecAchievedHidden.map((achievement) => [achievement.strID, achievement])),
    },
  };
}

export function toNativeSteamGlobalAchievementResponse(model: NativeSteamAchievements): {
  readonly data: Record<string, number>;
} {
  const rows = [...model.vecHighlight, ...model.vecAchievedHidden, ...model.vecUnachieved];
  return { data: Object.fromEntries(rows.map((achievement) => [achievement.strID, achievement.flAchieved])) };
}

export function toNativeSteamAchievementProgressPercentage(model: NativeSteamAchievements): number {
  return model.nTotal > 0 ? (model.nAchieved / model.nTotal) * 100 : 0;
}
