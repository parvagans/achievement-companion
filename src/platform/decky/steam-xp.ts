function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function getSteamLevelGroupCost(level: number): number {
  return Math.max(100, Math.ceil(level / 10) * 100);
}

function getSteamCumulativeXpToLevel(level: number): number {
  if (level <= 0) {
    return 0;
  }

  let cumulativeXp = 0;
  for (let currentLevel = 1; currentLevel <= level; currentLevel += 1) {
    cumulativeXp += getSteamLevelGroupCost(currentLevel);
  }

  return cumulativeXp;
}

export interface SteamXpProgress {
  readonly level: number;
  readonly playerXp: number;
  readonly xpToNextLevel: number;
  readonly progressPercent: number;
  readonly currentLevelXp: number;
  readonly nextLevelXp: number;
  readonly currentLevelStartXp: number;
  readonly caption: string;
}

export function formatSteamXp(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function getSteamXpProgress(
  level: number | undefined,
  playerXp: number | undefined,
): SteamXpProgress | undefined {
  if (level === undefined || playerXp === undefined) {
    return undefined;
  }

  const normalizedLevel = Math.max(0, Math.trunc(level));
  const normalizedPlayerXp = Math.max(0, Math.trunc(playerXp));
  const currentLevelStartXp = getSteamCumulativeXpToLevel(normalizedLevel);
  const nextLevelXp = getSteamLevelGroupCost(normalizedLevel + 1);
  const currentLevelXp = Math.max(
    0,
    Math.min(nextLevelXp, normalizedPlayerXp - currentLevelStartXp),
  );
  const xpToNextLevel = Math.max(0, currentLevelStartXp + nextLevelXp - normalizedPlayerXp);

  return {
    level: normalizedLevel,
    playerXp: normalizedPlayerXp,
    xpToNextLevel,
    progressPercent: clampPercent(Math.round((currentLevelXp / nextLevelXp) * 100)),
    currentLevelXp,
    nextLevelXp,
    currentLevelStartXp,
    caption: `${formatSteamXp(xpToNextLevel)} XP to Level ${normalizedLevel + 1}`,
  };
}
