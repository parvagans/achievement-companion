import type { NormalizedProfile, ProgressSummary } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";

interface ModeGameProgress {
  readonly summary: ProgressSummary;
  readonly hardcoreSummary?: ProgressSummary;
  readonly softcoreSummary?: ProgressSummary;
}

function count(value: number): number {
  return Math.max(0, Math.trunc(value));
}

export function getRetroAchievementsModeUnlockedCount(
  profile: NormalizedProfile,
  mode: RetroAchievementsAchievementMode,
): number | undefined {
  if (mode === "both") return count(profile.summary.unlockedCount);
  const selected = mode === "hardcore" ? profile.hardcoreUnlockedCount : profile.softcoreUnlockedCount;
  return selected === undefined ? undefined : count(selected);
}

export function getRetroAchievementsModeGameProgress(
  game: ModeGameProgress,
  mode: RetroAchievementsAchievementMode,
): ProgressSummary | undefined {
  if (mode === "both") return game.summary;
  const selected = mode === "hardcore" ? game.hardcoreSummary : game.softcoreSummary;
  if (selected !== undefined) return selected;
  const other = mode === "hardcore" ? game.softcoreSummary : game.hardcoreSummary;
  if (other === undefined && game.summary.unlockedCount > 0) return undefined;
  const unlockedCount = count(game.summary.unlockedCount - (other?.unlockedCount ?? 0));
  const totalCount = game.summary.totalCount;
  return {
    unlockedCount,
    ...(totalCount !== undefined ? { totalCount } : {}),
    ...(totalCount !== undefined && totalCount > 0
      ? { completionPercent: Math.min(100, Math.round(unlockedCount / totalCount * 100)) }
      : {}),
  };
}

export function getRetroAchievementsModeGameUnlockedCount(
  game: ModeGameProgress,
  mode: RetroAchievementsAchievementMode,
): number | undefined {
  const progress = getRetroAchievementsModeGameProgress(game, mode);
  return progress === undefined ? undefined : count(progress.unlockedCount);
}
