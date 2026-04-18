import { useMemo, useState, type CSSProperties, type ComponentProps } from "react";
import type { ResourceState } from "@core/cache";
import type { CompletionProgressSnapshot, NormalizedGame } from "@core/domain";
import { Field, PanelSection, PanelSectionRow, ScrollPanel } from "@decky/ui";
import { PlaceholderState } from "@ui/PlaceholderState";
import { DeckyActionButtonItem } from "./decky-action-button-item";
import { DeckyCompletionProgressBar, getCompletionPercent } from "./decky-completion-progress-bar";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import {
  DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS,
  DECKY_FOCUS_ACTION_ROW_CLASS,
} from "./decky-focus-styles";
import { initialDeckyCompletionProgressState, loadDeckyCompletionProgressState } from "./decky-app-services";
import { formatCompletionProgressFilterLabel, type CompletionProgressFilter } from "@core/settings";
import { useDeckySettings } from "./decky-settings";
import { TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";

const COMPLETION_PROGRESS_INITIAL_GAME_LIMIT = 12;
const COMPLETION_PROGRESS_GAME_LOAD_STEP = 12;
const COMPLETION_PROGRESS_FILTERS: readonly CompletionProgressFilter[] = [
  "all",
  "unfinished",
  "beaten",
  "mastered",
];

export interface DeckyFullScreenCompletionProgressPageProps {
  readonly providerId: string | undefined;
  readonly onBack: () => void;
  readonly onOpenGameDetail: (gameId: string) => void;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatTimestamp(epochMs: number | undefined): string {
  if (epochMs === undefined) {
    return "Unknown";
  }

  return new Date(epochMs).toLocaleString();
}

function getPageFrameStyle(): CSSProperties {
  return {
    padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px calc(env(safe-area-inset-bottom, 0px) + 12px)",
    boxSizing: "border-box",
  };
}

function getHeroCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: 18,
    borderRadius: 20,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.03))",
  };
}

function getHeroTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
  };
}

function getHeroKickerStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getHeroTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1.45em",
    fontWeight: 800,
    lineHeight: 1.08,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getHeroSupportStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.92em",
    lineHeight: 1.35,
  };
}

function getSummaryGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(136px, 1fr))",
    gap: 10,
  };
}

function getSummaryStatStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    padding: "11px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    minWidth: 0,
  };
}

function getSummaryStatLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "0.72em",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getSummaryStatValueStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1em",
    fontWeight: 700,
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getSummaryStatSecondaryStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.82em",
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getBrowserCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.026))",
  };
}

function getBrowserTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getBrowserSummaryStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: "0.94em",
    lineHeight: 1.35,
  };
}

function getBrowserMetaStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.86em",
    lineHeight: 1.25,
  };
}

function getFilterWrapStyle(): CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 4,
    width: "100%",
  };
}

function getFilterGroupStyle(): CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: "8px 10px",
    minWidth: 0,
    width: "100%",
  };
}

function getBrowserContinuationStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingTop: 2,
  };
}

function getStatusPillStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 24,
    padding: "0 9px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: "0.78em",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  };
}

function getGameRowMetaRowStyle(): CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  };
}

function getGameRowDescriptionStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  };
}

function getGameRowSummaryStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: "0.94em",
    lineHeight: 1.3,
    whiteSpace: "pre-wrap",
  };
}

function getGameRowSupportStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.84em",
    lineHeight: 1.25,
  };
}

function getGameRowTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1em",
    fontWeight: 800,
    lineHeight: 1.15,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

type FullScreenGamepadFocusHandler = NonNullable<ComponentProps<typeof Field>["onGamepadFocus"]>;

const scrollFocusedGamepadElementIntoView: FullScreenGamepadFocusHandler = (event) => {
  const target = event.currentTarget;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  target.scrollIntoView({
    block: "nearest",
    inline: "nearest",
  });
};

function formatCompletionProgressSummary(summary: CompletionProgressSnapshot["summary"]): string {
  return [
    `${formatCount(summary.playedCount)} played`,
    `${formatCount(summary.unfinishedCount)} unfinished`,
    `${formatCount(summary.beatenCount)} beaten`,
    `${formatCount(summary.masteredCount)} mastered`,
  ].join(" | ");
}

function formatCompletionProgressStatusLabel(status: NormalizedGame["status"]): string {
  if (status === "in_progress") {
    return "Unfinished";
  }

  if (status === "completed") {
    return "Completed";
  }

  if (status === "beaten") {
    return "Beaten";
  }

  if (status === "mastered") {
    return "Mastered";
  }

  return "Locked";
}

function matchesCompletionProgressFilter(
  game: NormalizedGame,
  filter: CompletionProgressFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "unfinished") {
    return game.status === "in_progress";
  }

  if (filter === "beaten") {
    return game.status === "beaten";
  }

  return game.status === "mastered";
}

function formatCompletionProgressFilterEmptyMessage(filter: CompletionProgressFilter): string {
  if (filter === "all") {
    return "No completion progress entries were returned yet.";
  }

  return `No ${formatCompletionProgressFilterLabel(filter).toLowerCase()} games match this filter.`;
}

function formatProgressSummary(game: NormalizedGame): string {
  if (game.summary.totalCount !== undefined) {
    return `${formatCount(game.summary.unlockedCount)}/${formatCount(game.summary.totalCount)} achievements`;
  }

  return `${formatCount(game.summary.unlockedCount)} unlocked achievements`;
}

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

  if (/\((?:subset)(?:\s+\d+)?\)\s*$/i.test(normalizedTitle) || /\[(?:subset)(?:\s+\d+)?\]\s*$/i.test(normalizedTitle) || /-\s*(?:subset)(?:\s+\d+)?\s*$/i.test(normalizedTitle)) {
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

  const subsetBaseTitle = stripCompletionProgressSubsetSuffix(game.title);
  if (subsetBaseTitle !== undefined) {
    return true;
  }

  return false;
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

function formatCompletionProgressSubsetSummary(
  group: CompletionProgressGameGroup,
  showSubsets: boolean,
): string | undefined {
  if (!showSubsets) {
    return undefined;
  }

  if (group.subsetGames.length === 0) {
    const subsetKind = getCompletionProgressSubsetKindLabel(group.representativeGame.title);
    return subsetKind !== undefined ? `This is a ${subsetKind}` : undefined;
  }

  const subsetCount = group.subsetGames.length;
  const subsetLabel = subsetCount === 1 ? "subset" : "subsets";
  const subsetPreview = group.subsetGames
    .slice(0, 2)
    .map((game) => game.title)
    .join(" • ");

  if (subsetPreview.length > 0) {
    return `Includes ${subsetCount} ${subsetLabel}: ${subsetPreview}`;
  }

  return `Includes ${subsetCount} ${subsetLabel}`;
}

function getCompletionProgressSummaryStatStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    padding: "11px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    minWidth: 0,
    textAlign: "center",
  };
}

function getCompletionProgressSummaryLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "0.72em",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getCompletionProgressSummaryValueStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1em",
    fontWeight: 700,
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "center",
  };
}

function CompletionProgressSummaryStat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div style={getCompletionProgressSummaryStatStyle()}>
      <div style={getCompletionProgressSummaryLabelStyle()}>{label}</div>
      <div style={getCompletionProgressSummaryValueStyle()}>{value}</div>
    </div>
  );
}

function CompletionProgressFilterPills({
  currentFilter,
  onSelect,
}: {
  readonly currentFilter: CompletionProgressFilter;
  readonly onSelect: (filter: CompletionProgressFilter) => void;
}): JSX.Element {
  return (
    <DeckyFullscreenActionRow>
      {COMPLETION_PROGRESS_FILTERS.map((filter) => {
        const active = filter === currentFilter;

        return (
          <DeckyFullscreenActionButton
            key={filter}
            label={formatCompletionProgressFilterLabel(filter)}
            onClick={() => {
              onSelect(filter);
            }}
            selected={active}
          />
        );
      })}
    </DeckyFullscreenActionRow>
  );
}

function CompletionProgressGameRow({
  gameGroup,
  onOpenGameDetail,
  showSubsets,
}: {
  readonly gameGroup: CompletionProgressGameGroup;
  readonly onOpenGameDetail: (gameId: string) => void;
  readonly showSubsets: boolean;
}): JSX.Element {
  const { representativeGame: game } = gameGroup;
  const completionPercent = getCompletionPercent(game.summary);
  const unlockedCount = formatCount(game.summary.unlockedCount);
  const totalCount = game.summary.totalCount !== undefined ? formatCount(game.summary.totalCount) : undefined;
  const subsetSummary = formatCompletionProgressSubsetSummary(gameGroup, showSubsets);

  return (
    <Field
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      focusable
      highlightOnFocus
      icon={
        game.coverImageUrl !== undefined ? (
          <DeckyGameArtwork compact src={game.coverImageUrl} size={40} title={game.title} />
        ) : undefined
      }
      bottomSeparator="none"
      padding="compact"
      verticalAlignment="center"
      label={game.title}
      description={
        <div style={getGameRowDescriptionStyle()}>
          <div style={getGameRowMetaRowStyle()}>
            <span style={getStatusPillStyle()}>{game.platformLabel ?? "Unknown platform"}</span>
            <span style={getStatusPillStyle()}>{formatCompletionProgressStatusLabel(game.status)}</span>
          </div>

          <div style={getGameRowSummaryStyle()}>
            {totalCount !== undefined ? `${unlockedCount}/${totalCount} achievements` : `${unlockedCount} unlocked achievements`}
          </div>

          {subsetSummary !== undefined ? (
            <div style={getGameRowSupportStyle()}>{subsetSummary}</div>
          ) : null}

          {completionPercent !== undefined ? (
            <DeckyCompletionProgressBar compact percent={completionPercent} />
          ) : null}

          {game.lastUnlockAt !== undefined ? (
            <div style={getGameRowSupportStyle()}>{`Last unlock ${formatTimestamp(game.lastUnlockAt)}`}</div>
          ) : null}
        </div>
      }
      onActivate={() => {
        onOpenGameDetail(game.gameId);
      }}
      onClick={() => {
        onOpenGameDetail(game.gameId);
      }}
      onGamepadFocus={scrollFocusedGamepadElementIntoView}
    />
  );
}

function CompletionProgressBrowser({
  currentFilter,
  showSubsets,
  summary,
  visibleGroups,
  filteredGroupCount,
  onFilterChange,
  onLoadMoreGames,
  onShowAllGames,
  canLoadMoreGames,
  canShowAllGames,
  onOpenGameDetail,
}: {
  readonly currentFilter: CompletionProgressFilter;
  readonly showSubsets: boolean;
  readonly summary: CompletionProgressSnapshot["summary"];
  readonly visibleGroups: readonly CompletionProgressGameGroup[];
  readonly filteredGroupCount: number;
  readonly onFilterChange: (filter: CompletionProgressFilter) => void;
  readonly onLoadMoreGames: () => void;
  readonly onShowAllGames: () => void;
  readonly canLoadMoreGames: boolean;
  readonly canShowAllGames: boolean;
  readonly onOpenGameDetail: (gameId: string) => void;
}): JSX.Element {
  return (
    <div style={getBrowserCardStyle()}>
      <div style={getBrowserTitleStyle()}>Browse</div>
      <div style={getBrowserSummaryStyle()}>{formatCompletionProgressSummary(summary)}</div>
      <div style={getBrowserMetaStyle()}>
        {`Showing ${formatCount(visibleGroups.length)} of ${formatCount(filteredGroupCount)} grouped games in this filter.`}
      </div>

      <CompletionProgressFilterPills currentFilter={currentFilter} onSelect={onFilterChange} />

      {visibleGroups.length > 0 ? (
        <>
          {visibleGroups.map((gameGroup) => (
            <PanelSectionRow key={gameGroup.groupKey}>
              <CompletionProgressGameRow
                gameGroup={gameGroup}
                onOpenGameDetail={onOpenGameDetail}
                showSubsets={showSubsets}
              />
            </PanelSectionRow>
          ))}
        </>
      ) : (
        <PanelSectionRow>
          <Field
            bottomSeparator="none"
            description={formatCompletionProgressFilterEmptyMessage(currentFilter)}
            label="Games"
          />
        </PanelSectionRow>
      )}

      {canLoadMoreGames || canShowAllGames ? (
        <div style={getBrowserContinuationStyle()}>
          {canLoadMoreGames ? (
              <DeckyActionButtonItem
                className={DECKY_FOCUS_ACTION_ROW_CLASS}
                focusClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
                focusWithinClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
                highlightOnFocus
                description={`Show the next ${formatCount(COMPLETION_PROGRESS_GAME_LOAD_STEP)} games below and keep your place in the list.`}
                label={`Show ${formatCount(COMPLETION_PROGRESS_GAME_LOAD_STEP)} more`}
                onClick={onLoadMoreGames}
              />
          ) : null}

          {canShowAllGames ? (
              <DeckyActionButtonItem
                className={DECKY_FOCUS_ACTION_ROW_CLASS}
                focusClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
                focusWithinClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
                highlightOnFocus
                description="Reveal the rest of the filtered games."
                label="Show all"
                onClick={onShowAllGames}
              />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function isRenderableCompletionProgressState(
  state: ResourceState<CompletionProgressSnapshot>,
): state is ResourceState<CompletionProgressSnapshot> & { readonly data: CompletionProgressSnapshot } {
  return (state.status === "success" || state.status === "stale") && state.data !== undefined;
}

export function DeckyFullScreenCompletionProgressPage({
  providerId,
  onBack,
  onOpenGameDetail,
}: DeckyFullScreenCompletionProgressPageProps): JSX.Element {
  const deckySettings = useDeckySettings();
  const [currentFilter, setCurrentFilter] = useState<CompletionProgressFilter>(
    deckySettings.defaultCompletionProgressFilter,
  );
  const [visibleGameLimit, setVisibleGameLimit] = useState(COMPLETION_PROGRESS_INITIAL_GAME_LIMIT);
  const [isShowingAllGames, setIsShowingAllGames] = useState(false);
  const loadSelectedCompletionProgress = useMemo(() => {
    if (providerId === undefined) {
      return () => Promise.resolve(initialDeckyCompletionProgressState);
    }

    return () => loadDeckyCompletionProgressState(providerId);
  }, [providerId]);
  const state = useAsyncResourceState(loadSelectedCompletionProgress, initialDeckyCompletionProgressState);
  const hasRouteParameters = providerId !== undefined;

  if (!isRenderableCompletionProgressState(state)) {
    return (
      <ScrollPanel>
        <TopAlignedScrollViewport scrollKey={`full-screen-completion-progress:${providerId ?? "missing"}`}>
          <div style={getPageFrameStyle()}>
            <PlaceholderState
              title="Full-screen completion progress"
              description={
                hasRouteParameters
                  ? "Loading the full-screen completion progress page from the existing completion-progress service."
                  : "The full-screen completion progress page route is missing provider information."
              }
              state={state}
              footer={<span>Use Back to return to the full-screen profile page.</span>}
            />
          </div>
        </TopAlignedScrollViewport>
      </ScrollPanel>
    );
  }

  const snapshot = state.data;
  const groupedGames = groupCompletionProgressGames(snapshot.games);
  const filteredGroups = groupedGames.filter((gameGroup) =>
    matchesCompletionProgressFilter(gameGroup.representativeGame, currentFilter),
  );
  const filteredGroupCount = filteredGroups.length;
  const effectiveGameLimit = isShowingAllGames ? filteredGroupCount : visibleGameLimit;
  const canLoadMoreGames = !isShowingAllGames && effectiveGameLimit < filteredGroupCount;
  const nextGameLimit = Math.min(
    filteredGroupCount,
    effectiveGameLimit + COMPLETION_PROGRESS_GAME_LOAD_STEP,
  );
  const canShowAllGames =
    !isShowingAllGames && canLoadMoreGames && filteredGroupCount > nextGameLimit;
  const visibleGroups = filteredGroups.slice(0, effectiveGameLimit);
  const refreshTimestamp = state.lastUpdatedAt ?? snapshot.refreshedAt;
  const isCachedView = state.status === "stale";
  const snapshotSourceLabel = isCachedView ? "Cached snapshot" : "Live snapshot";

  return (
    <ScrollPanel>
      <TopAlignedScrollViewport scrollKey={`full-screen-completion-progress:${providerId ?? snapshot.providerId}`}>
        <div style={getPageFrameStyle()}>
          <PanelSection title="Navigation">
            <PanelSectionRow>
              <DeckyFullscreenActionRow>
                <DeckyFullscreenActionButton label="Back" onClick={onBack} />
              </DeckyFullscreenActionRow>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Completion progress">
            <PanelSectionRow>
              <div style={getHeroCardStyle()}>
                <div style={getHeroTextStyle()}>
                  <div style={getHeroKickerStyle()}>RetroAchievements collection</div>
                  <div style={getHeroTitleStyle()}>Completion progress</div>
                  <div style={getHeroSupportStyle()}>
                    Browse started games grouped by progress tier.
                  </div>
                </div>

                <div style={getSummaryGridStyle()}>
                  <CompletionProgressSummaryStat label="Played" value={formatCount(snapshot.summary.playedCount)} />
                  <CompletionProgressSummaryStat
                    label="Unfinished"
                    value={formatCount(snapshot.summary.unfinishedCount)}
                  />
                  <CompletionProgressSummaryStat label="Beaten" value={formatCount(snapshot.summary.beatenCount)} />
                  <CompletionProgressSummaryStat label="Mastered" value={formatCount(snapshot.summary.masteredCount)} />
                </div>
              </div>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Games">
            <CompletionProgressBrowser
              currentFilter={currentFilter}
              showSubsets={deckySettings.showCompletionProgressSubsets}
              summary={snapshot.summary}
              visibleGroups={visibleGroups}
              filteredGroupCount={filteredGroupCount}
              onFilterChange={(filter) => {
                setCurrentFilter(filter);
              }}
              onLoadMoreGames={() => {
                setIsShowingAllGames(false);
                setVisibleGameLimit((current) =>
                  Math.min(filteredGroupCount, current + COMPLETION_PROGRESS_GAME_LOAD_STEP),
                );
              }}
              onOpenGameDetail={onOpenGameDetail}
              onShowAllGames={() => {
                setIsShowingAllGames(true);
                setVisibleGameLimit(filteredGroupCount);
              }}
              canLoadMoreGames={canLoadMoreGames}
              canShowAllGames={canShowAllGames}
            />
          </PanelSection>

          <PanelSection title="Snapshot">
            {state.error ? (
              <PanelSectionRow>
                <Field bottomSeparator="none" description={state.error.userMessage} label="Snapshot note" />
              </PanelSectionRow>
            ) : null}

            <PanelSectionRow>
              <Field
                bottomSeparator="none"
                description={`${snapshotSourceLabel} • ${formatTimestamp(refreshTimestamp)}`}
                label="Updated"
              />
            </PanelSectionRow>
          </PanelSection>
        </div>
      </TopAlignedScrollViewport>
    </ScrollPanel>
  );
}
