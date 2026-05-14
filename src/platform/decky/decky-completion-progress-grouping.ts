import type { CompletionProgressSummary, NormalizedGame } from "@core/domain";

const COMPLETION_PROGRESS_SUBSET_PAREN_TITLE_PATTERN =
  /^(.+?)\s*\((subset|challenge set)\b[^\)]*\)\s*$/i;
const COMPLETION_PROGRESS_SUBSET_BRACKET_TITLE_PATTERN =
  /^(.+?)\s*\[(subset|challenge set)\b[^\]]*\]\s*$/i;
const COMPLETION_PROGRESS_SUBSET_DASH_TITLE_PATTERN = /^(.+?)\s*-\s*(subset|challenge set)\b.*$/i;

function normalizeCompletionProgressGroupTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseCompletionProgressSubsetTitle(
  title: string,
): { readonly kind: "subset" | "challenge set"; readonly strippedTitle: string } | undefined {
  const normalizedTitle = title.trim();
  const patterns = [
    COMPLETION_PROGRESS_SUBSET_PAREN_TITLE_PATTERN,
    COMPLETION_PROGRESS_SUBSET_BRACKET_TITLE_PATTERN,
    COMPLETION_PROGRESS_SUBSET_DASH_TITLE_PATTERN,
  ] as const;

  for (const pattern of patterns) {
    const match = normalizedTitle.match(pattern);
    const strippedTitle = match?.[1]?.trim();
    const kind = match?.[2]?.trim().toLowerCase();

    if (
      strippedTitle !== undefined &&
      strippedTitle.length > 0 &&
      kind !== undefined &&
      (kind === "subset" || kind === "challenge set")
    ) {
      return {
        kind,
        strippedTitle,
      };
    }
  }

  return undefined;
}

function stripCompletionProgressSubsetSuffix(title: string): string | undefined {
  return parseCompletionProgressSubsetTitle(title)?.strippedTitle;
}

function getCompletionProgressSubsetKindLabel(
  title: string,
): "subset" | "challenge set" | undefined {
  return parseCompletionProgressSubsetTitle(title)?.kind;
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

export function filterCompletionProgressGamesBySubsetVisibility(
  games: readonly NormalizedGame[],
  showSubsets: boolean,
): readonly NormalizedGame[] {
  if (showSubsets) {
    return games;
  }

  const referencedParentGameIds = new Set(
    games.flatMap((game) => (game.parentGameId !== undefined ? [game.parentGameId] : [])),
  );

  return games.filter((game) => !isCompletionProgressSubsetGame(game, referencedParentGameIds));
}

export function summarizeCompletionProgressSummaryBySubsetVisibility(
  summary: CompletionProgressSummary,
  games: readonly NormalizedGame[],
  showSubsets: boolean,
): CompletionProgressSummary {
  if (showSubsets) {
    return summary;
  }

  const referencedParentGameIds = new Set(
    games.flatMap((game) => (game.parentGameId !== undefined ? [game.parentGameId] : [])),
  );
  const hiddenSubsetUnfinishedCount = games.filter(
    (game) => game.status === "in_progress" && isCompletionProgressSubsetGame(game, referencedParentGameIds),
  ).length;

  return {
    ...summary,
    unfinishedCount: Math.max(0, summary.unfinishedCount - hiddenSubsetUnfinishedCount),
  };
}

export function countCompletionProgressSubsetGames(games: readonly NormalizedGame[]): number {
  const referencedParentGameIds = new Set(
    games.flatMap((game) => (game.parentGameId !== undefined ? [game.parentGameId] : [])),
  );

  return games.filter((game) => isCompletionProgressSubsetGame(game, referencedParentGameIds)).length;
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
  readonly isSubsetGame: boolean;
  readonly sortEpoch?: number;
}

export function groupCompletionProgressGames(
  games: readonly NormalizedGame[],
  showSubsets = false,
): readonly CompletionProgressGameGroup[] {
  const referencedParentGameIds = new Set(
    games.flatMap((game) => (game.parentGameId !== undefined ? [game.parentGameId] : [])),
  );
  if (showSubsets) {
    return [...games]
      .sort((left, right) => compareCompletionProgressGroupedGames(left, right, referencedParentGameIds))
      .map((game) => {
        const sortEpoch = game.lastUnlockAt;

        return {
          groupKey: `game:${game.gameId}`,
          games: [game],
          representativeGame: game,
          subsetGames: [],
          isSubsetGame: isCompletionProgressSubsetGame(game, referencedParentGameIds),
          ...(sortEpoch !== undefined ? { sortEpoch } : {}),
        };
      })
      .sort(compareCompletionProgressGroups);
  }

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
        isSubsetGame: isCompletionProgressSubsetGame(representativeGame, referencedParentGameIds),
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
