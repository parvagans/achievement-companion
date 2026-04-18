import type { NormalizedGame } from "@core/domain";

const COMPLETION_PROGRESS_SUBSET_TITLE_PATTERNS = [
  /\s*\((?:subset|challenge set)(?:\s+\d+)?\)\s*$/i,
  /\s*\[(?:subset|challenge set)(?:\s+\d+)?\]\s*$/i,
  /\s*-\s*(?:subset|challenge set)(?:\s+\d+)?\s*$/i,
] as const;

function normalizeCompletionProgressGroupTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

function stripCompletionProgressSubsetSuffix(title: string): string | undefined {
  for (const pattern of COMPLETION_PROGRESS_SUBSET_TITLE_PATTERNS) {
    const stripped = title.replace(pattern, "").trim();
    if (stripped.length > 0 && stripped !== title.trim()) {
      return stripped;
    }
  }

  return undefined;
}

function getCompletionProgressSubsetKindLabel(
  title: string,
): "subset" | "challenge set" | undefined {
  const normalizedTitle = title.trim();

  if (
    /\((?:subset)(?:\s+\d+)?\)\s*$/i.test(normalizedTitle) ||
    /\[(?:subset)(?:\s+\d+)?\]\s*$/i.test(normalizedTitle) ||
    /-\s*(?:subset)(?:\s+\d+)?\s*$/i.test(normalizedTitle)
  ) {
    return "subset";
  }

  if (
    /\((?:challenge set)(?:\s+\d+)?\)\s*$/i.test(normalizedTitle) ||
    /\[(?:challenge set)(?:\s+\d+)?\]\s*$/i.test(normalizedTitle) ||
    /-\s*(?:challenge set)(?:\s+\d+)?\s*$/i.test(normalizedTitle)
  ) {
    return "challenge set";
  }

  return undefined;
}

function buildCompletionProgressTitleGroupKey(
  title: string,
  platformLabel: string | undefined,
): string {
  return [
    "title",
    normalizeCompletionProgressGroupTitle(platformLabel ?? "unknown"),
    normalizeCompletionProgressGroupTitle(title),
  ].join(":");
}

function isCompletionProgressSubsetGame(
  game: NormalizedGame,
  referencedParentGameIds: ReadonlySet<string>,
): boolean {
  if (game.parentGameId !== undefined) {
    return true;
  }

  if (referencedParentGameIds.has(game.gameId)) {
    return false;
  }

  return stripCompletionProgressSubsetSuffix(game.title) !== undefined;
}

function compareCompletionProgressGroupedGames(
  left: NormalizedGame,
  right: NormalizedGame,
  referencedParentGameIds: ReadonlySet<string>,
): number {
  const leftIsSubset = isCompletionProgressSubsetGame(left, referencedParentGameIds);
  const rightIsSubset = isCompletionProgressSubsetGame(right, referencedParentGameIds);

  if (leftIsSubset !== rightIsSubset) {
    return leftIsSubset ? 1 : -1;
  }

  const leftSortEpoch = left.lastUnlockAt ?? Number.NEGATIVE_INFINITY;
  const rightSortEpoch = right.lastUnlockAt ?? Number.NEGATIVE_INFINITY;
  if (leftSortEpoch !== rightSortEpoch) {
    return rightSortEpoch - leftSortEpoch;
  }

  if (left.summary.unlockedCount !== right.summary.unlockedCount) {
    return right.summary.unlockedCount - left.summary.unlockedCount;
  }

  const titleDelta = left.title.localeCompare(right.title);
  if (titleDelta !== 0) {
    return titleDelta;
  }

  return left.gameId.localeCompare(right.gameId);
}

function compareCompletionProgressGroups(
  left: CompletionProgressGameGroup,
  right: CompletionProgressGameGroup,
): number {
  const leftSortEpoch = left.sortEpoch ?? Number.NEGATIVE_INFINITY;
  const rightSortEpoch = right.sortEpoch ?? Number.NEGATIVE_INFINITY;
  if (leftSortEpoch !== rightSortEpoch) {
    return rightSortEpoch - leftSortEpoch;
  }

  if (
    left.representativeGame.summary.unlockedCount !==
    right.representativeGame.summary.unlockedCount
  ) {
    return (
      right.representativeGame.summary.unlockedCount -
      left.representativeGame.summary.unlockedCount
    );
  }

  const titleDelta = left.representativeGame.title.localeCompare(right.representativeGame.title);
  if (titleDelta !== 0) {
    return titleDelta;
  }

  return left.groupKey.localeCompare(right.groupKey);
}

function buildCompletionProgressGroupKey(
  game: NormalizedGame,
  referencedParentGameIds: ReadonlySet<string>,
  subsetTitleGroupKeys: ReadonlySet<string>,
  baseTitleToGameIds: ReadonlyMap<string, string>,
): string {
  if (game.parentGameId !== undefined) {
    return `parent:${game.parentGameId}`;
  }

  if (referencedParentGameIds.has(game.gameId)) {
    return `parent:${game.gameId}`;
  }

  const subsetBaseTitle = stripCompletionProgressSubsetSuffix(game.title);
  if (subsetBaseTitle !== undefined) {
    const titleGroupKey = buildCompletionProgressTitleGroupKey(subsetBaseTitle, game.platformLabel);
    return baseTitleToGameIds.get(titleGroupKey) !== undefined
      ? `parent:${baseTitleToGameIds.get(titleGroupKey)}`
      : titleGroupKey;
  }

  const titleGroupKey = buildCompletionProgressTitleGroupKey(game.title, game.platformLabel);
  if (subsetTitleGroupKeys.has(titleGroupKey)) {
    return baseTitleToGameIds.get(titleGroupKey) !== undefined
      ? `parent:${baseTitleToGameIds.get(titleGroupKey)}`
      : titleGroupKey;
  }

  return `game:${game.gameId}`;
}

function selectCompletionProgressGroupRepresentative(
  games: readonly NormalizedGame[],
  referencedParentGameIds: ReadonlySet<string>,
): NormalizedGame {
  const rankedGames = [...games].sort((left, right) =>
    compareCompletionProgressGroupedGames(left, right, referencedParentGameIds),
  );

  return rankedGames[0] ?? games[0]!;
}

export interface CompletionProgressGameGroup {
  readonly groupKey: string;
  readonly games: readonly NormalizedGame[];
  readonly representativeGame: NormalizedGame;
  readonly subsetGames: readonly NormalizedGame[];
  readonly sortEpoch?: number;
}

export function groupCompletionProgressGames(
  games: readonly NormalizedGame[],
): readonly CompletionProgressGameGroup[] {
  const referencedParentGameIds = new Set(
    games.flatMap((game) => (game.parentGameId !== undefined ? [game.parentGameId] : [])),
  );
  const subsetTitleGroupKeys = new Set(
    games.flatMap((game) => {
      const subsetBaseTitle = stripCompletionProgressSubsetSuffix(game.title);
      return subsetBaseTitle !== undefined
        ? [buildCompletionProgressTitleGroupKey(subsetBaseTitle, game.platformLabel)]
        : [];
    }),
  );
  const baseTitleToGameIds = new Map<string, string>();

  for (const game of games) {
    const titleGroupKey = buildCompletionProgressTitleGroupKey(game.title, game.platformLabel);
    if (baseTitleToGameIds.has(titleGroupKey)) {
      continue;
    }

    baseTitleToGameIds.set(titleGroupKey, game.gameId);
  }

  const groupedGames = new Map<string, NormalizedGame[]>();

  for (const game of games) {
    const groupKey = buildCompletionProgressGroupKey(
      game,
      referencedParentGameIds,
      subsetTitleGroupKeys,
      baseTitleToGameIds,
    );
    const groupGames = groupedGames.get(groupKey);
    if (groupGames === undefined) {
      groupedGames.set(groupKey, [game]);
      continue;
    }

    groupGames.push(game);
  }

  return [...groupedGames.entries()]
    .map(([groupKey, groupGames]) => {
      const representativeGame = selectCompletionProgressGroupRepresentative(
        groupGames,
        referencedParentGameIds,
      );
      const rankedGames = [...groupGames].sort((left, right) =>
        compareCompletionProgressGroupedGames(left, right, referencedParentGameIds),
      );
      const sortEpoch = rankedGames.reduce<number | undefined>((current, game) => {
        const gameSortEpoch = game.lastUnlockAt;
        if (gameSortEpoch === undefined) {
          return current;
        }

        return current === undefined ? gameSortEpoch : Math.max(current, gameSortEpoch);
      }, undefined);

      return {
        groupKey,
        games: rankedGames,
        representativeGame,
        subsetGames: rankedGames.filter((game) => game.gameId !== representativeGame.gameId),
        ...(sortEpoch !== undefined ? { sortEpoch } : {}),
      };
    })
    .sort(compareCompletionProgressGroups);
}

export function formatCompletionProgressSubsetSummary(
  group: CompletionProgressGameGroup,
): string | undefined {
  if (group.subsetGames.length === 0) {
    const subsetKind = getCompletionProgressSubsetKindLabel(group.representativeGame.title);
    return subsetKind !== undefined ? `This is a ${subsetKind}` : undefined;
  }

  const subsetCount = group.subsetGames.length;
  const subsetLabel = subsetCount === 1 ? "subset" : "subset sets";
  const subsetPreview = group.subsetGames
    .slice(0, 2)
    .map((game) => game.title)
    .join(" • ");

  if (subsetPreview.length > 0) {
    return `Includes ${subsetCount} ${subsetLabel}: ${subsetPreview}`;
  }

  return `Includes ${subsetCount} ${subsetLabel}`;
}
