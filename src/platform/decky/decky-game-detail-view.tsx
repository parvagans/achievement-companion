import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { useState, type FocusEventHandler } from "react";
import { Field, Focusable, PanelSection, PanelSectionRow } from "@decky/ui";
import type { CSSProperties } from "react";
import { DeckyCompletionProgressBar, getCompletionPercent } from "./decky-completion-progress-bar";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DECKY_ACHIEVEMENT_FILTER_GROUP_CLASS, DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS, DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS, DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS, DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import type { CompactAchievementTarget } from "./decky-achievement-detail-view";
import { DeckyCompactPillActionGroup, DeckyCompactPillActionItem } from "./decky-compact-pill-action-item";
import { buildAchievementStatus, formatModeProgressSummary } from "./decky-achievement-detail-helpers";

const INITIAL_ACHIEVEMENT_LIMIT = 3;
const ACHIEVEMENT_FILTERS = ["all", "unlocked", "locked"] as const;

type AchievementFilter = (typeof ACHIEVEMENT_FILTERS)[number];

export interface DeckyGameDetailViewProps {
  readonly state: ResourceState<GameDetailSnapshot> & {
    readonly data: GameDetailSnapshot;
  };
  readonly onBackToDashboard: () => void;
  readonly onOpenFullScreenPage: (() => void) | undefined;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
}

function formatTimestamp(epochMs: number | undefined): string {
  if (epochMs === undefined) {
    return "Unknown";
  }

  return new Date(epochMs).toLocaleString();
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatProgressSummary(snapshot: GameDetailSnapshot): string {
  const summary = snapshot.game.summary;
  const parts = [`${formatCount(summary.unlockedCount)} unlocked`];

  if (summary.totalCount !== undefined) {
    parts.push(`${formatCount(summary.totalCount)} total`);
  }

  if (summary.completionPercent !== undefined) {
    parts.push(`${formatCount(summary.completionPercent)}% complete`);
  }

  return parts.join(" · ");
}

function formatAchievementDescription(achievement: NormalizedAchievement): string {
  const parts = [buildAchievementStatus(achievement).value];

  if (achievement.points !== undefined) {
    parts.push(`${formatCount(achievement.points)} points`);
  }

  const unlockedAt = achievement.unlockedAt;
  if (unlockedAt !== undefined) {
    parts.push(formatTimestamp(unlockedAt));
  }

  return parts.join(" · ");
}

function formatDataSourceLabel(isCachedView: boolean): string {
  return isCachedView ? "Cached snapshot" : "Live snapshot";
}

function formatAchievementFilterLabel(filter: AchievementFilter): string {
  if (filter === "all") {
    return "All";
  }

  if (filter === "unlocked") {
    return "Unlocked";
  }

  return "Locked";
}

function matchesAchievementFilter(
  achievement: NormalizedAchievement,
  filter: AchievementFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "unlocked") {
    return achievement.isUnlocked;
  }

  return !achievement.isUnlocked;
}

const scrollFocusedElementIntoView: FocusEventHandler<HTMLElement> = (event) => {
  event.currentTarget.scrollIntoView({
    block: "nearest",
    inline: "nearest",
  });
};

function formatAchievementVisibilitySummary(
  visibleCount: number,
  totalCount: number,
  filter: AchievementFilter,
): string {
  const suffix = filter === "all" ? "achievements" : formatAchievementFilterLabel(filter).toLowerCase();
  return `Showing ${formatCount(visibleCount)} of ${formatCount(totalCount)} ${suffix}`;
}

function formatAchievementFilterEmptyMessage(filter: AchievementFilter): string {
  if (filter === "all") {
    return "No achievements were returned for this game.";
  }

  return `No ${formatAchievementFilterLabel(filter).toLowerCase()} achievements match this filter.`;
}

function formatAchievementStatusSummary(
  achievements: readonly NormalizedAchievement[],
): string {
  const unlockedCount = achievements.filter((achievement) => achievement.isUnlocked).length;
  const lockedCount = achievements.length - unlockedCount;

  return `Total ${formatCount(achievements.length)} · Unlocked ${formatCount(unlockedCount)} · Locked ${formatCount(lockedCount)}`;
}

function getAchievementBadgeFrameStyle(isUnlocked: boolean): CSSProperties {
  return {
    display: "inline-flex",
    flexShrink: 0,
    lineHeight: 0,
    opacity: isUnlocked ? 1 : 0.94,
    filter: isUnlocked ? "none" : "grayscale(1) contrast(1.12) brightness(0.92)",
  };
}

function AchievementFilterPills({
  currentFilter,
  onSelect,
  onCancel,
}: {
  readonly currentFilter: AchievementFilter;
  readonly onSelect: (filter: AchievementFilter) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  return (
    <div role="radiogroup" aria-label="Achievement filter" className={DECKY_ACHIEVEMENT_FILTER_GROUP_CLASS}>
      {ACHIEVEMENT_FILTERS.map((filter) => {
        const active = filter === currentFilter;
        const optionClassName = [
          DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS,
          active ? DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS : undefined,
        ]
          .filter((value): value is string => value !== undefined)
          .join(" ");

        return (
          <Focusable
            key={filter}
            className={optionClassName}
            focusClassName={DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS}
            focusWithinClassName={DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS}
            noFocusRing
            role="radio"
            aria-checked={active}
            aria-label={formatAchievementFilterLabel(filter)}
            onActivate={() => {
              onSelect(filter);
            }}
            onClick={() => {
              onSelect(filter);
            }}
            onCancelButton={onCancel}
            onFocus={scrollFocusedElementIntoView}
          >
            {formatAchievementFilterLabel(filter)}
          </Focusable>
        );
      })}
    </div>
  );
}

function AchievementBadgeIcon({
  achievement,
}: {
  readonly achievement: NormalizedAchievement;
}): JSX.Element | null {
  if (achievement.badgeImageUrl === undefined) {
    return null;
  }

  return (
    <span style={getAchievementBadgeFrameStyle(achievement.isUnlocked)}>
      <DeckyGameArtwork compact src={achievement.badgeImageUrl} size={32} title={achievement.title} />
    </span>
  );
}

interface AchievementSectionBodyProps {
  readonly achievementFilter: AchievementFilter;
  readonly achievementSummary: string;
  readonly achievements: readonly NormalizedAchievement[];
  readonly canLoadMoreAchievements: boolean;
  readonly canShowAllAchievements: boolean;
  readonly filteredAchievementCount: number;
  readonly onAchievementFilterChange: (filter: AchievementFilter) => void;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
  readonly onLoadFiveMoreAchievements: () => void;
  readonly onShowAllAchievements: () => void;
  readonly onBackToDashboard: () => void;
  readonly game: GameDetailSnapshot["game"];
}

function AchievementSectionBody({
  achievementFilter,
  achievementSummary,
  achievements,
  canLoadMoreAchievements,
  canShowAllAchievements,
  filteredAchievementCount,
  onAchievementFilterChange,
  onOpenAchievementDetail,
  onLoadFiveMoreAchievements,
  onShowAllAchievements,
  onBackToDashboard,
  game,
}: AchievementSectionBodyProps): JSX.Element {
  const hardcoreProgress = game.hardcoreSummary;
  const softcoreProgress = game.softcoreSummary;

  return (
    <>
      <PanelSectionRow>
        <Field
          bottomSeparator="none"
          description={achievementSummary}
          label="Summary"
          onCancelButton={onBackToDashboard}
        />
      </PanelSectionRow>

      {hardcoreProgress !== undefined || softcoreProgress !== undefined ? (
        <PanelSectionRow>
          <Field
            bottomSeparator="none"
            description={
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div>{formatModeProgressSummary(hardcoreProgress, "Hardcore")}</div>
                <div>{formatModeProgressSummary(softcoreProgress, "Softcore")}</div>
              </div>
            }
            label="Mode progress"
            onCancelButton={onBackToDashboard}
          />
        </PanelSectionRow>
      ) : null}

      <PanelSectionRow>
        <AchievementFilterPills
          currentFilter={achievementFilter}
          onSelect={onAchievementFilterChange}
          onCancel={onBackToDashboard}
        />
      </PanelSectionRow>

      {achievements.length > 0 ? (
        <>
          <PanelSectionRow>
            <Field
              bottomSeparator="none"
              description={formatAchievementVisibilitySummary(
                achievements.length,
                filteredAchievementCount,
                achievementFilter,
              )}
              label="Visible"
              onCancelButton={onBackToDashboard}
            />
          </PanelSectionRow>

          {achievements.map((achievement, index) => (
            <PanelSectionRow key={achievement.achievementId}>
              <Field
                className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
                focusable
                highlightOnFocus
                icon={
                  achievement.badgeImageUrl !== undefined ? (
                    <AchievementBadgeIcon achievement={achievement} />
                  ) : undefined
                }
                bottomSeparator="none"
                verticalAlignment="center"
                description={formatAchievementDescription(achievement)}
                label={`${index + 1}. ${achievement.title}`}
                onCancelButton={onBackToDashboard}
                onActivate={() => {
                  onOpenAchievementDetail({
                    game: {
                      providerId: game.providerId,
                      gameId: game.gameId,
                      title: game.title,
                      platformLabel: game.platformLabel,
                      coverImageUrl: game.coverImageUrl,
                    },
                    achievement,
                  });
                }}
                onClick={() => {
                  onOpenAchievementDetail({
                    game: {
                      providerId: game.providerId,
                      gameId: game.gameId,
                      title: game.title,
                      platformLabel: game.platformLabel,
                      coverImageUrl: game.coverImageUrl,
                    },
                    achievement,
                  });
                }}
              />
            </PanelSectionRow>
          ))}

          {canLoadMoreAchievements ? (
            <PanelSectionRow>
              <DeckyCompactPillActionGroup>
              <DeckyCompactPillActionItem
                  label="Show 5 more"
                  onClick={onLoadFiveMoreAchievements}
                  onCancelButton={onBackToDashboard}
                />
              </DeckyCompactPillActionGroup>
            </PanelSectionRow>
          ) : null}

          {canShowAllAchievements ? (
            <PanelSectionRow>
              <DeckyCompactPillActionGroup>
              <DeckyCompactPillActionItem
                  label="Show all"
                  onClick={onShowAllAchievements}
                  onCancelButton={onBackToDashboard}
                />
              </DeckyCompactPillActionGroup>
            </PanelSectionRow>
          ) : null}
        </>
      ) : (
        <PanelSectionRow>
          <Field
            bottomSeparator="none"
            description={formatAchievementFilterEmptyMessage(achievementFilter)}
            label="Achievements"
            onCancelButton={onBackToDashboard}
          />
        </PanelSectionRow>
      )}
    </>
  );
}

export function DeckyGameDetailView({
  state,
  onBackToDashboard,
  onOpenFullScreenPage,
  onOpenAchievementDetail,
}: DeckyGameDetailViewProps): JSX.Element {
  const snapshot = state.data;
  const game = snapshot.game;
  const headerArtworkUrl = game.coverImageUrl;
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>("all");
  const [visibleAchievementLimit, setVisibleAchievementLimit] = useState(INITIAL_ACHIEVEMENT_LIMIT);
  const totalAchievements = snapshot.achievements.length;
  const filteredAchievements = snapshot.achievements.filter((achievement) =>
    matchesAchievementFilter(achievement, achievementFilter),
  );
  const filteredAchievementCount = filteredAchievements.length;
  const completionPercent = getCompletionPercent(snapshot.game.summary);
  const achievementSummary = formatAchievementStatusSummary(snapshot.achievements);
  const hasAchievements = totalAchievements > 0;
  const canLoadMoreAchievements = visibleAchievementLimit < filteredAchievementCount;
  const canShowAllAchievements = filteredAchievementCount > visibleAchievementLimit + 5;
  const achievements = filteredAchievements.slice(0, visibleAchievementLimit);
  const isCachedView = state.status === "stale";
  const refreshTimestamp = state.lastUpdatedAt ?? snapshot.refreshedAt;

  return (
    <>
      <PanelSection title="Navigation">
        <PanelSectionRow>
          <DeckyCompactPillActionGroup>
            <DeckyCompactPillActionItem
              label="Back"
              onClick={onBackToDashboard}
              onCancelButton={onBackToDashboard}
            />

            {onOpenFullScreenPage !== undefined ? (
              <DeckyCompactPillActionItem
                label="Open full-screen page"
                onClick={onOpenFullScreenPage}
                onCancelButton={onBackToDashboard}
              />
            ) : null}
          </DeckyCompactPillActionGroup>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Game overview">
        <PanelSectionRow>
          <Field
            icon={
              headerArtworkUrl !== undefined ? (
                <DeckyGameArtwork compact src={headerArtworkUrl} size={48} title={game.title} />
              ) : undefined
            }
            bottomSeparator="none"
            description={game.platformLabel ?? "Unknown platform"}
            label={game.title}
          />
        </PanelSectionRow>

        <PanelSectionRow>
          <Field
            bottomSeparator="none"
            description={formatProgressSummary(snapshot)}
            label="Progress summary"
          />
        </PanelSectionRow>

        {completionPercent !== undefined ? (
          <PanelSectionRow>
            <Field
              bottomSeparator="none"
              description={<DeckyCompletionProgressBar compact percent={completionPercent} />}
              label="Completion"
            />
          </PanelSectionRow>
        ) : null}
      </PanelSection>

      <PanelSection title="Achievements">
        {hasAchievements ? (
          <AchievementSectionBody
            achievementFilter={achievementFilter}
            achievementSummary={achievementSummary}
            achievements={achievements}
            canLoadMoreAchievements={canLoadMoreAchievements}
            canShowAllAchievements={canShowAllAchievements}
            filteredAchievementCount={filteredAchievementCount}
            onAchievementFilterChange={(filter) => {
              setAchievementFilter(filter);
              setVisibleAchievementLimit(INITIAL_ACHIEVEMENT_LIMIT);
            }}
            onOpenAchievementDetail={onOpenAchievementDetail}
            onLoadFiveMoreAchievements={() => {
              setVisibleAchievementLimit((current) => Math.min(filteredAchievementCount, current + 5));
            }}
            onShowAllAchievements={() => {
              setVisibleAchievementLimit(filteredAchievementCount);
            }}
            onBackToDashboard={onBackToDashboard}
            game={game}
          />
        ) : (
          <PanelSectionRow>
            <Field
              bottomSeparator="none"
              description={formatAchievementFilterEmptyMessage(achievementFilter)}
              label="Achievements"
            />
          </PanelSectionRow>
        )}
      </PanelSection>

      <PanelSection title="Snapshot">
        <PanelSectionRow>
          <Field
            bottomSeparator="none"
            description={`${formatDataSourceLabel(isCachedView)} · ${formatTimestamp(refreshTimestamp)}`}
            label="Updated"
          />
        </PanelSectionRow>

        {state.error ? (
          <PanelSectionRow>
            <Field bottomSeparator="none" description={state.error.userMessage} label="Snapshot note" />
          </PanelSectionRow>
        ) : null}
      </PanelSection>
    </>
  );
}
