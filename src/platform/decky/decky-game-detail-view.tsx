import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { useState, type FocusEventHandler } from "react";
import { Field, Focusable, PanelSection, PanelSectionRow } from "@decky/ui";
import type { CSSProperties } from "react";
import { DeckyCompletionProgressBar, getCompletionPercent } from "./decky-completion-progress-bar";
import { DeckyGameArtwork } from "./decky-game-artwork";
import {
  DECKY_FOCUS_PILL_ACTIVE_CLASS,
  DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS,
  DECKY_FOCUS_PILL_CLASS,
} from "./decky-focus-styles";
import type { CompactAchievementTarget } from "./decky-achievement-detail-view";
import { DeckyCompactPillActionGroup, DeckyCompactPillActionItem } from "./decky-compact-pill-action-item";

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
  const parts = [achievement.isUnlocked ? "Unlocked" : "Locked"];

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

function getAchievementFilterButtonStyle(active: boolean): CSSProperties {
  return {
    flex: "1 1 0",
    minWidth: 0,
    appearance: "none",
    WebkitAppearance: "none",
    border: "none",
    borderRadius: 999,
    boxSizing: "border-box",
    margin: 0,
    backgroundImage: "none",
    padding: "7px 10px",
    backgroundColor: active ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.04)",
    color: active ? "rgba(255, 255, 255, 0.98)" : "rgba(255, 255, 255, 0.82)",
    boxShadow: active ? "inset 0 0 0 1px rgba(255, 255, 255, 0.24)" : "inset 0 0 0 1px rgba(255, 255, 255, 0.08)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontFamily: "inherit",
    fontWeight: active ? 700 : 600,
    lineHeight: 1.15,
    whiteSpace: "nowrap",
    textAlign: "center",
    transition: "background-color 120ms ease, color 120ms ease, box-shadow 120ms ease",
  };
}

function getAchievementFilterGroupStyle(): CSSProperties {
  return {
    display: "flex",
    gap: 5,
    width: "100%",
  };
}

function getAchievementFilterWrapStyle(): CSSProperties {
  return {
    borderRadius: 14,
    border: "1px solid rgba(255, 255, 255, 0.07)",
    backgroundColor: "rgba(255, 255, 255, 0.025)",
    padding: 3,
    width: "100%",
  };
}

function AchievementFilterPills({
  currentFilter,
  onSelect,
}: {
  readonly currentFilter: AchievementFilter;
  readonly onSelect: (filter: AchievementFilter) => void;
}): JSX.Element {
  return (
    <div style={getAchievementFilterWrapStyle()}>
      <div role="radiogroup" aria-label="Achievement filter" style={getAchievementFilterGroupStyle()}>
        {ACHIEVEMENT_FILTERS.map((filter) => {
          const active = filter === currentFilter;

          return (
            <Focusable
              key={filter}
              className={DECKY_FOCUS_PILL_CLASS}
              focusClassName={DECKY_FOCUS_PILL_ACTIVE_CLASS}
              focusWithinClassName={DECKY_FOCUS_PILL_ACTIVE_CLASS}
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
              onFocus={scrollFocusedElementIntoView}
              style={getAchievementFilterButtonStyle(active)}
            >
              {formatAchievementFilterLabel(filter)}
            </Focusable>
          );
        })}
      </div>
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
  game,
}: AchievementSectionBodyProps): JSX.Element {
  return (
    <>
      <PanelSectionRow>
        <Field bottomSeparator="none" description={achievementSummary} label="Summary" />
      </PanelSectionRow>

      <PanelSectionRow>
        <AchievementFilterPills currentFilter={achievementFilter} onSelect={onAchievementFilterChange} />
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
            />

            {onOpenFullScreenPage !== undefined ? (
              <DeckyCompactPillActionItem
                label="Open full-screen page"
                onClick={onOpenFullScreenPage}
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
