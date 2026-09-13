import type {
  DashboardSnapshot,
  GameDetailSnapshot,
  NormalizedGame,
  RecentlyPlayedGame,
  RecentUnlock,
} from "@core/domain";

export const DECKY_RECENT_ACHIEVEMENTS_LIMIT = 10;

export interface DeckyRecentAchievementBackfillProvider {
  readonly loadCompletionProgress: (
    config: unknown,
  ) => Promise<readonly NormalizedGame[]>;
  readonly loadAchievementsEarnedBetween?: (
    config: unknown,
    options: {
      readonly fromEpochSeconds: number;
      readonly toEpochSeconds: number;
      readonly limit?: number;
    },
  ) => Promise<readonly RecentUnlock[]>;
  readonly loadRecentlyPlayedGames?: (
    config: unknown,
    options?: {
      readonly count?: number;
      readonly offset?: number;
    },
  ) => Promise<readonly RecentlyPlayedGame[]>;
  readonly loadGameProgress: (
    config: unknown,
    gameId: string,
  ) => Promise<GameDetailSnapshot>;
}

export type DeckyRecentAchievementGameSource =
  | "completion-progress"
  | "recently-played"
  | "snapshot-recently-played";

export interface DeckyRecentAchievementGameCandidate {
  readonly gameId: string;
  readonly title: string;
  readonly source: DeckyRecentAchievementGameSource;
  readonly unlockedCount: number;
  readonly sortEpoch?: number;
}

export type DeckyRecentAchievementSource = "live-recent" | "cache" | "date-range" | "backfill";

export interface DeckyRecentAchievementCandidate {
  readonly recentUnlock: RecentUnlock;
  readonly source: DeckyRecentAchievementSource;
  readonly normalizedUnlockAt?: number;
}

export function createDeckyRecentAchievementCompletionProgressGameCandidate(
  game: NormalizedGame,
): DeckyRecentAchievementGameCandidate | undefined {
  return createDeckyRecentAchievementGameCandidate(
    game.gameId,
    game.title,
    game.summary.unlockedCount,
    "completion-progress",
    game.lastUnlockAt,
  );
}

export function createDeckyRecentAchievementRecentlyPlayedGameCandidate(
  game: RecentlyPlayedGame,
  source: DeckyRecentAchievementGameSource,
): DeckyRecentAchievementGameCandidate | undefined {
  return createDeckyRecentAchievementGameCandidate(
    game.gameId,
    game.title,
    game.summary.unlockedCount,
    source,
    game.lastPlayedAt,
  );
}

function createDeckyRecentAchievementGameCandidate(
  gameId: string,
  title: string,
  unlockedCount: number,
  source: DeckyRecentAchievementGameSource,
  sortEpoch?: number,
): DeckyRecentAchievementGameCandidate | undefined {
  if (unlockedCount <= 0) {
    return undefined;
  }

  return {
    gameId,
    title,
    source,
    unlockedCount,
    ...(sortEpoch !== undefined ? { sortEpoch } : {}),
  };
}

function compareDeckyRecentAchievementGameCandidates(
  left: DeckyRecentAchievementGameCandidate,
  right: DeckyRecentAchievementGameCandidate,
): number {
  const leftSortEpoch = left.sortEpoch ?? Number.NEGATIVE_INFINITY;
  const rightSortEpoch = right.sortEpoch ?? Number.NEGATIVE_INFINITY;
  if (leftSortEpoch !== rightSortEpoch) {
    return rightSortEpoch - leftSortEpoch;
  }

  if (left.unlockedCount !== right.unlockedCount) {
    return right.unlockedCount - left.unlockedCount;
  }

  const sourceOrder: Record<DeckyRecentAchievementGameSource, number> = {
    "completion-progress": 0,
    "recently-played": 1,
    "snapshot-recently-played": 2,
  };
  const sourceOrderDelta = sourceOrder[left.source] - sourceOrder[right.source];
  if (sourceOrderDelta !== 0) {
    return sourceOrderDelta;
  }

  const titleDelta = left.title.localeCompare(right.title);
  if (titleDelta !== 0) {
    return titleDelta;
  }

  return left.gameId.localeCompare(right.gameId);
}

export function selectDeckyRecentAchievementGameCandidates(
  candidates: readonly DeckyRecentAchievementGameCandidate[],
): readonly DeckyRecentAchievementGameCandidate[] {
  const seen = new Set<string>();
  const deduped: DeckyRecentAchievementGameCandidate[] = [];

  for (const candidate of [...candidates].sort(compareDeckyRecentAchievementGameCandidates)) {
    if (seen.has(candidate.gameId)) {
      continue;
    }

    seen.add(candidate.gameId);
    deduped.push(candidate);
  }

  return deduped;
}

export function getRecentUnlockIdentity(recentUnlock: RecentUnlock): string {
  return `${recentUnlock.achievement.providerId}:${recentUnlock.achievement.gameId}:${recentUnlock.achievement.achievementId}`;
}

export function getNormalizedRecentUnlockTimestamp(recentUnlock: RecentUnlock): number | undefined {
  const normalizedUnlockAt = recentUnlock.unlockedAt ?? recentUnlock.achievement.unlockedAt;
  if (typeof normalizedUnlockAt !== "number" || !Number.isFinite(normalizedUnlockAt)) {
    return undefined;
  }

  return Math.trunc(normalizedUnlockAt);
}

export function maxDefinedNumber(
  ...values: readonly (number | undefined)[]
): number | undefined {
  const numericValues = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );

  if (numericValues.length === 0) {
    return undefined;
  }

  return Math.max(...numericValues);
}

export function getDeckyRecentAchievementProfileMemberSinceAt(
  snapshot: DashboardSnapshot,
): number | undefined {
  const memberSinceMetric = snapshot.profile.metrics.find((metric) =>
    metric.key === "member-since" || metric.label.toLowerCase() === "member since",
  );
  if (memberSinceMetric === undefined) {
    return undefined;
  }

  const parsedAt = Date.parse(memberSinceMetric.value);
  if (!Number.isFinite(parsedAt)) {
    return undefined;
  }

  return Math.trunc(parsedAt);
}

export function createDeckyRecentAchievementCandidate(
  recentUnlock: RecentUnlock,
  source: DeckyRecentAchievementSource,
): DeckyRecentAchievementCandidate {
  const normalizedUnlockAt = getNormalizedRecentUnlockTimestamp(recentUnlock);

  return {
    recentUnlock,
    source,
    ...(normalizedUnlockAt !== undefined ? { normalizedUnlockAt } : {}),
  };
}

function compareDeckyRecentAchievementCandidates(
  left: DeckyRecentAchievementCandidate,
  right: DeckyRecentAchievementCandidate,
): number {
  const leftHasTrustedUnlockAt = left.normalizedUnlockAt !== undefined;
  const rightHasTrustedUnlockAt = right.normalizedUnlockAt !== undefined;

  if (leftHasTrustedUnlockAt !== rightHasTrustedUnlockAt) {
    return leftHasTrustedUnlockAt ? -1 : 1;
  }

  if (
    leftHasTrustedUnlockAt &&
    rightHasTrustedUnlockAt &&
    left.normalizedUnlockAt !== right.normalizedUnlockAt
  ) {
    return right.normalizedUnlockAt - left.normalizedUnlockAt;
  }

  const sourceOrder: Record<DeckyRecentAchievementSource, number> = {
    "live-recent": 0,
    cache: 1,
    "date-range": 2,
    backfill: 3,
  };
  const sourceOrderDelta = sourceOrder[left.source] - sourceOrder[right.source];
  if (sourceOrderDelta !== 0) {
    return sourceOrderDelta;
  }

  const titleDelta = left.recentUnlock.achievement.title.localeCompare(right.recentUnlock.achievement.title);
  if (titleDelta !== 0) {
    return titleDelta;
  }

  const gameTitleDelta = left.recentUnlock.game.title.localeCompare(right.recentUnlock.game.title);
  if (gameTitleDelta !== 0) {
    return gameTitleDelta;
  }

  return getRecentUnlockIdentity(left.recentUnlock).localeCompare(getRecentUnlockIdentity(right.recentUnlock));
}

function compareFallbackDeckyRecentAchievementCandidates(
  left: DeckyRecentAchievementCandidate,
  right: DeckyRecentAchievementCandidate,
): number {
  const sourceOrder: Record<DeckyRecentAchievementSource, number> = {
    "live-recent": 0,
    cache: 1,
    "date-range": 2,
    backfill: 3,
  };
  const sourceOrderDelta = sourceOrder[left.source] - sourceOrder[right.source];
  if (sourceOrderDelta !== 0) {
    return sourceOrderDelta;
  }

  const titleDelta = left.recentUnlock.achievement.title.localeCompare(right.recentUnlock.achievement.title);
  if (titleDelta !== 0) {
    return titleDelta;
  }

  const gameTitleDelta = left.recentUnlock.game.title.localeCompare(right.recentUnlock.game.title);
  if (gameTitleDelta !== 0) {
    return gameTitleDelta;
  }

  return getRecentUnlockIdentity(left.recentUnlock).localeCompare(getRecentUnlockIdentity(right.recentUnlock));
}

export function selectDeckyRecentAchievementCandidates(
  candidates: readonly DeckyRecentAchievementCandidate[],
): readonly DeckyRecentAchievementCandidate[] {
  const seen = new Set<string>();
  const deduped: DeckyRecentAchievementCandidate[] = [];

  for (const candidate of [...candidates].sort(compareDeckyRecentAchievementCandidates)) {
    const identity = getRecentUnlockIdentity(candidate.recentUnlock);
    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    deduped.push(candidate);
  }

  return deduped;
}

function isTrustedDeckyRecentAchievementCandidate(
  candidate: DeckyRecentAchievementCandidate,
): boolean {
  return candidate.normalizedUnlockAt !== undefined;
}

export function finalizeDeckyRecentAchievementCandidates(
  candidates: readonly DeckyRecentAchievementCandidate[],
): {
  readonly trustedCandidates: readonly DeckyRecentAchievementCandidate[];
  readonly fallbackCandidates: readonly DeckyRecentAchievementCandidate[];
  readonly selectedCandidates: readonly DeckyRecentAchievementCandidate[];
} {
  const dedupedCandidates = selectDeckyRecentAchievementCandidates(candidates);
  const trustedCandidates = dedupedCandidates
    .filter(isTrustedDeckyRecentAchievementCandidate)
    .sort(compareDeckyRecentAchievementCandidates);
  const fallbackCandidates = dedupedCandidates
    .filter((candidate) => !isTrustedDeckyRecentAchievementCandidate(candidate))
    .sort(compareFallbackDeckyRecentAchievementCandidates);

  const selectedCandidates =
    trustedCandidates.length >= DECKY_RECENT_ACHIEVEMENTS_LIMIT
      ? trustedCandidates.slice(0, DECKY_RECENT_ACHIEVEMENTS_LIMIT)
      : [
          ...trustedCandidates,
          ...fallbackCandidates.slice(
            0,
            DECKY_RECENT_ACHIEVEMENTS_LIMIT - trustedCandidates.length,
          ),
        ];

  return {
    trustedCandidates,
    fallbackCandidates,
    selectedCandidates,
  };
}

export function rankDeckyRecentAchievements(
  candidates: readonly DeckyRecentAchievementCandidate[],
): readonly RecentUnlock[] {
  return finalizeDeckyRecentAchievementCandidates(candidates).selectedCandidates.map(
    (candidate) => candidate.recentUnlock,
  );
}

export function toRecentUnlock(
  game: GameDetailSnapshot["game"],
  achievement: GameDetailSnapshot["achievements"][number],
): RecentUnlock {
  const unlockedAt = achievement.unlockedAt;

  return {
    achievement,
    game: {
      providerId: game.providerId,
      gameId: game.gameId,
      title: game.title,
      ...(game.platformLabel !== undefined ? { platformLabel: game.platformLabel } : {}),
      ...(game.coverImageUrl !== undefined ? { coverImageUrl: game.coverImageUrl } : {}),
    },
    ...(unlockedAt !== undefined ? { unlockedAt } : {}),
  };
}
