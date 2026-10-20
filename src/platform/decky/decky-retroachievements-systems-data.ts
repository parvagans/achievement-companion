import type { NormalizedGame, NormalizedProfile } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { getRetroAchievementsCompletionIndicatorState } from "./decky-retroachievements-completion-indicator";
import { getRetroAchievementsBaseGames, getRetroAchievementsProfileSystems } from "./decky-retroachievements-full-screen-profile-data";
import { getRetroAchievementsModeGameUnlockedCount, getRetroAchievementsModeUnlockedCount, hasUnavailableRetroAchievementsModeGameCounts } from "./decky-retroachievements-mode-progress";

export interface RetroAchievementsSystemsBreakdownItem {
  readonly id: string;
  readonly title: string;
  readonly unlocked: number;
  readonly sharePercent: number;
  readonly iconUrl?: string;
  readonly completionPercent?: number;
}

function distributeBreakdownPercentages(
  items: readonly RetroAchievementsSystemsBreakdownItem[],
  total: number,
): RetroAchievementsSystemsBreakdownItem[] {
  if (total <= 0) return [...items];
  const exact = items.map((item) => item.unlocked / total * 100);
  const shares = exact.map(Math.floor);
  const remainders = exact.map((value, index) => ({ index, remainder: value - shares[index]! }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  const remaining = 100 - shares.reduce((sum, share) => sum + share, 0);
  for (let index = 0; index < remaining; index += 1) {
    shares[remainders[index]!.index]! += 1;
  }
  return items.map((item, index) => ({ ...item, sharePercent: shares[index]! }));
}

export function buildRetroAchievementsSystemsOverview(
  profile: NormalizedProfile,
  games: readonly NormalizedGame[] | undefined,
  mode: RetroAchievementsAchievementMode = "both",
) {
  const unlocked = getRetroAchievementsModeUnlockedCount(profile, mode);
  const total = profile.summary.totalCount;
  const completionPercent = unlocked !== undefined && total !== undefined && total > 0
    ? Math.min(100, Math.round((unlocked / total) * 100))
    : undefined;
  if (games === undefined) {
    return { mode, unlocked, total, completionPercent, systems: undefined } as const;
  }

  if (hasUnavailableRetroAchievementsModeGameCounts(games, mode)) {
    return { mode, unlocked, total, completionPercent, systems: undefined } as const;
  }

  const baseGames = getRetroAchievementsBaseGames(games);
  const systems = getRetroAchievementsProfileSystems(games, mode);
  const playedGames = baseGames.filter((game) => (getRetroAchievementsModeGameUnlockedCount(game, mode) ?? 0) > 0);
  const awardStates = playedGames.map(getRetroAchievementsCompletionIndicatorState)
    .filter((state) => mode === "both" || state?.endsWith(mode));

  const attributedUnlocks = systems.reduce((sum, system) => sum + system.unlockedAchievements, 0);
  const breakdownItems: RetroAchievementsSystemsBreakdownItem[] = systems
    .filter((system) => system.unlockedAchievements > 0)
    .slice(0, 5)
    .map((system) => ({
      id: system.systemId,
      title: system.title,
      unlocked: system.unlockedAchievements,
      sharePercent: 0,
      ...(system.iconUrl !== undefined ? { iconUrl: system.iconUrl } : {}),
      ...(system.completionPercent !== undefined ? { completionPercent: system.completionPercent } : {}),
    }));
  const otherUnlocked = attributedUnlocks - breakdownItems.reduce((sum, item) => sum + item.unlocked, 0);
  if (otherUnlocked > 0) {
    breakdownItems.push({
      id: "other",
      title: "Other",
      unlocked: otherUnlocked,
      sharePercent: 0,
    });
  }
  const breakdown = distributeBreakdownPercentages(breakdownItems, attributedUnlocks);

  return {
    mode,
    unlocked,
    total,
    completionPercent,
    systems: {
      systemsWithUnlocks: systems.filter((system) => system.unlockedAchievements > 0).length,
      gamesWithUnlocks: playedGames.length,
      masteredGames: awardStates.filter((state) => state === "mastered-hardcore").length,
      beatenGames: awardStates.filter((state) => state?.startsWith("beaten") === true).length,
      attributedUnlocks,
      breakdown,
      topSystem: systems.find((system) => system.unlockedAchievements > 0),
    },
  } as const;
}
