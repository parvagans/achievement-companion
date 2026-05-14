import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { useState, type ComponentProps, type FocusEventHandler } from "react";
import { Field, Focusable, PanelSection, PanelSectionRow } from "@decky/ui";
import type { CSSProperties } from "react";
import { DeckyCompletionProgressBar, getCompletionPercent } from "./decky-completion-progress-bar";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DECKY_ACHIEVEMENT_FILTER_GROUP_CLASS, DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS, DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS, DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS, DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import type { CompactAchievementTarget } from "./decky-achievement-detail-view";
import { DeckyCompactPillActionGroup, DeckyCompactPillActionItem } from "./decky-compact-pill-action-item";
import { buildAchievementStatus, formatModeProgressSummary } from "./decky-achievement-detail-helpers";
import { sortAchievementsForDisplay } from "./decky-game-detail-ordering";

const INITIAL_ACHIEVEMENT_LIMIT = 3;
const ACHIEVEMENT_FILTERS = ["all", "unlocked", "locked"] as const;
const ACHIEVEMENT_MODE_FILTERS = ["all", "hardcore", "softcore"] as const;

type AchievementFilter = (typeof ACHIEVEMENT_FILTERS)[number];
type AchievementModeFilter = (typeof ACHIEVEMENT_MODE_FILTERS)[number];
type DeckyGamepadFocusHandler = NonNullable<ComponentProps<typeof Focusable>["onGamepadFocus"]>;

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

  return parts.join(" / ");
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

function formatAchievementFilterEmptyMessage(filter: AchievementFilter): string {
  if (filter === "all") {
    return "No achievements were returned for this game.";
  }

  return `No ${formatAchievementFilterLabel(filter).toLowerCase()} achievements match this filter.`;
}

function formatAchievementModeLabel(modeFilter: AchievementModeFilter): string {
  if (modeFilter === "all") {
    return "All";
  }

  return modeFilter === "hardcore" ? "Hardcore" : "Softcore";
}

function matchesAchievementModeFilter(
  achievement: NormalizedAchievement,
  modeFilter: AchievementModeFilter,
): boolean {
  if (modeFilter === "all") {
    return true;
  }

  if (!achievement.isUnlocked) {
    return true;
  }

  if (modeFilter === "hardcore") {
    return achievement.unlockMode !== "softcore";
  }

  return achievement.unlockMode !== "hardcore";
}

function getAchievementModeProgressSummary(
  achievements: readonly NormalizedAchievement[],
  modeFilter: AchievementModeFilter,
): {
  readonly unlockedCount: number;
  readonly points: number | undefined;
} {
  let unlockedCount = 0;
  let points = 0;
  let hasPoints = false;

  for (const achievement of achievements) {
    if (!achievement.isUnlocked || achievement.unlockMode !== modeFilter) {
      continue;
    }

    unlockedCount += 1;
    if (achievement.points !== undefined) {
      points += achievement.points;
      hasPoints = true;
    }
  }

  return {
    unlockedCount,
    points: hasPoints ? points : undefined,
  };
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

function getGameDetailSectionCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.02))",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 2px 10px rgba(0, 0, 0, 0.18)",
  };
}

function getGameDetailSectionHeaderStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: "0.8em",
    fontWeight: 800,
    letterSpacing: "0.12em",
    lineHeight: 1.1,
    textAlign: "center",
    textTransform: "uppercase",
  };
}

function getGameDetailSystemPillStyle(): CSSProperties {
  return {
    alignSelf: "center",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "rgba(255, 255, 255, 0.05)",
    color: "rgba(255, 255, 255, 0.74)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };
}

function getGameDetailOverviewIconFrameStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    minWidth: 72,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "rgba(255, 255, 255, 0.04)",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
  };
}

function getGameDetailOverviewLayoutStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    textAlign: "center",
  };
}

function getGameDetailOverviewTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.95)",
    fontSize: "1.18em",
    fontWeight: 800,
    lineHeight: 1.15,
    textAlign: "center",
  };
}

function getGameDetailSummaryLineStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: "0.88em",
    fontWeight: 700,
    lineHeight: 1.25,
    textAlign: "center",
  };
}

function getModeProgressGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    alignItems: "stretch",
    minWidth: 0,
    width: "100%",
  };
}

function getModeProgressCardStyle(mode: AchievementModeFilter): CSSProperties {
  const isHardcore = mode === "hardcore";

  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: 16,
    border: `1px solid ${isHardcore ? "rgba(214, 178, 74, 0.28)" : "rgba(214, 221, 232, 0.2)"}`,
    borderLeftWidth: 4,
    borderLeftStyle: "solid",
    borderLeftColor: isHardcore ? "rgba(214, 178, 74, 0.8)" : "rgba(214, 221, 232, 0.72)",
    background: isHardcore
      ? "linear-gradient(180deg, rgba(214, 178, 74, 0.08), rgba(214, 178, 74, 0.03))"
      : "linear-gradient(180deg, rgba(214, 221, 232, 0.07), rgba(214, 221, 232, 0.03))",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 8px rgba(0, 0, 0, 0.14)",
  };
}

function getModeProgressCardTitleStyle(mode: AchievementModeFilter): CSSProperties {
  const isHardcore = mode === "hardcore";

  return {
    color: isHardcore ? "rgba(232, 201, 102, 0.95)" : "rgba(220, 225, 233, 0.95)",
    fontSize: "0.78em",
    fontWeight: 800,
    letterSpacing: "0.05em",
    lineHeight: 1.15,
    textTransform: "uppercase",
  };
}

function getModeProgressCardLineStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.86)",
    fontSize: "0.84em",
    lineHeight: 1.2,
  };
}

function getModeProgressCardPointsStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.8em",
    lineHeight: 1.2,
  };
}

function getAchievementControlsRowStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
}

function getAchievementCardStyle(achievement: NormalizedAchievement): CSSProperties {
  const isHardcore = achievement.isUnlocked && achievement.unlockMode === "hardcore";
  const isSoftcore = achievement.isUnlocked && achievement.unlockMode === "softcore";
  const accentColor = isHardcore
    ? "rgba(214, 178, 74, 0.78)"
    : isSoftcore
      ? "rgba(214, 221, 232, 0.72)"
      : "rgba(255, 255, 255, 0.12)";
  const accentBackground = isHardcore
    ? "linear-gradient(180deg, rgba(214, 178, 74, 0.08), rgba(214, 178, 74, 0.03))"
    : isSoftcore
      ? "linear-gradient(180deg, rgba(214, 221, 232, 0.07), rgba(214, 221, 232, 0.03))"
      : "rgba(255, 255, 255, 0.03)";

  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 12,
    minWidth: 0,
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: 16,
    border: `1px solid ${accentColor}`,
    borderLeftWidth: 4,
    borderLeftStyle: "solid",
    borderLeftColor: accentColor,
    background: accentBackground,
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 8px rgba(0, 0, 0, 0.15)",
  };
}

function getAchievementRowTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  };
}

function getAchievementRowTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.96)",
    fontSize: "0.95em",
    fontWeight: 800,
    lineHeight: 1.2,
  };
}

function getAchievementRowMetadataStackStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    minWidth: 0,
  };
}

function getAchievementRowStatusStyle(achievement: NormalizedAchievement): CSSProperties {
  const isHardcore = achievement.isUnlocked && achievement.unlockMode === "hardcore";
  const isSoftcore = achievement.isUnlocked && achievement.unlockMode === "softcore";

  return {
    color: isHardcore
      ? "rgba(232, 201, 102, 0.95)"
      : isSoftcore
        ? "rgba(220, 225, 233, 0.95)"
        : "rgba(255, 255, 255, 0.7)",
    fontSize: "0.8em",
    fontWeight: 800,
    lineHeight: 1.2,
  };
}

function getAchievementRowDetailStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.8em",
    lineHeight: 1.2,
  };
}

function getAchievementRowIconStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: 2,
  };
}

function getAchievementRowsLayoutStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
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

function AchievementModeButtons({
  currentModeFilter,
  onSelect,
  onCancel,
}: {
  readonly currentModeFilter: AchievementModeFilter;
  readonly onSelect: (filter: AchievementModeFilter) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  return (
    <DeckyCompactPillActionGroup aria-label="Achievement mode" role="radiogroup">
      {ACHIEVEMENT_MODE_FILTERS.map((filter) => {
        const selected = filter === currentModeFilter;

        return (
          <DeckyCompactPillActionItem
            key={filter}
            label={formatAchievementModeLabel(filter)}
            role="radio"
            ariaChecked={selected}
            selected={selected}
            stretch
            onClick={() => {
              onSelect(filter);
            }}
            onCancelButton={onCancel}
          />
        );
      })}
    </DeckyCompactPillActionGroup>
  );
}

function AchievementRowCard({
  achievement,
  index,
  game,
  onBackToDashboard,
  onOpenAchievementDetail,
}: {
  readonly achievement: NormalizedAchievement;
  readonly index: number;
  readonly game: GameDetailSnapshot["game"];
  readonly onBackToDashboard: () => void;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
}): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const status = buildAchievementStatus(achievement);
  const unlockedAt = achievement.unlockedAt;

  return (
    <Focusable
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      noFocusRing
      role="button"
      aria-label={`${achievement.title} achievement detail`}
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
      onCancel={onBackToDashboard}
      onFocus={(event) => {
        setIsFocused(true);
        scrollFocusedElementIntoView(event);
      }}
      onGamepadFocus={((event) => {
        setIsFocused(true);
        if (event.currentTarget instanceof HTMLElement) {
          event.currentTarget.scrollIntoView({
            block: "nearest",
            inline: "nearest",
          });
        }
      }) satisfies DeckyGamepadFocusHandler}
      onBlur={() => {
        setIsFocused(false);
      }}
      style={{
        ...getAchievementCardStyle(achievement),
        ...(isFocused
          ? {
              boxShadow:
                "0 0 0 1px rgba(96, 165, 250, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 4px 16px rgba(0, 0, 0, 0.24)",
            }
          : {}),
      }}
    >
      <div style={getAchievementRowIconStyle()}>
        {achievement.badgeImageUrl !== undefined ? <AchievementBadgeIcon achievement={achievement} /> : null}
      </div>

      <div style={getAchievementRowTextStyle()}>
        <div style={getAchievementRowTitleStyle()}>{achievement.title}</div>
        <div style={getAchievementRowMetadataStackStyle()}>
          <div style={getAchievementRowStatusStyle(achievement)}>{status.value}</div>
          <div style={getAchievementRowDetailStyle()}>
            {achievement.points !== undefined ? `${formatCount(achievement.points)} points` : "Points unavailable"}
          </div>
          {unlockedAt !== undefined ? (
            <div style={getAchievementRowDetailStyle()}>{`Unlocked ${formatTimestamp(unlockedAt)}`}</div>
          ) : null}
        </div>
      </div>
    </Focusable>
  );
}

interface AchievementSectionBodyProps {
  readonly achievementModeFilter: AchievementModeFilter;
  readonly achievementFilter: AchievementFilter;
  readonly achievements: readonly NormalizedAchievement[];
  readonly canLoadMoreAchievements: boolean;
  readonly canShowAllAchievements: boolean;
  readonly filteredAchievementCount: number;
  readonly onAchievementModeFilterChange: (filter: AchievementModeFilter) => void;
  readonly onAchievementFilterChange: (filter: AchievementFilter) => void;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
  readonly onLoadFiveMoreAchievements: () => void;
  readonly onShowAllAchievements: () => void;
  readonly onBackToDashboard: () => void;
  readonly game: GameDetailSnapshot["game"];
}

function AchievementSectionBody({
  achievementModeFilter,
  achievementFilter,
  achievements,
  canLoadMoreAchievements,
  canShowAllAchievements,
  filteredAchievementCount,
  onAchievementModeFilterChange,
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
        <div style={getGameDetailSectionCardStyle()}>
          <AchievementModeButtons
            currentModeFilter={achievementModeFilter}
            onSelect={onAchievementModeFilterChange}
            onCancel={onBackToDashboard}
          />
          <AchievementFilterPills
            currentFilter={achievementFilter}
            onSelect={onAchievementFilterChange}
            onCancel={onBackToDashboard}
          />

          {achievements.length > 0 ? (
            <div style={getAchievementControlsRowStyle()}>
              <div style={getAchievementRowsLayoutStyle()}>
                {achievements.map((achievement, index) => (
                  <AchievementRowCard
                    key={achievement.achievementId}
                    achievement={achievement}
                    index={index}
                    game={game}
                    onBackToDashboard={onBackToDashboard}
                    onOpenAchievementDetail={onOpenAchievementDetail}
                  />
                ))}
              </div>

              {canLoadMoreAchievements || canShowAllAchievements ? (
                <DeckyCompactPillActionGroup>
                  {canLoadMoreAchievements ? (
                    <DeckyCompactPillActionItem
                      label="Show 5 more"
                      onClick={onLoadFiveMoreAchievements}
                      onCancelButton={onBackToDashboard}
                    />
                  ) : null}

                  {canShowAllAchievements ? (
                    <DeckyCompactPillActionItem
                      label="Show all"
                      onClick={onShowAllAchievements}
                      onCancelButton={onBackToDashboard}
                    />
                  ) : null}
                </DeckyCompactPillActionGroup>
              ) : null}
            </div>
          ) : (
            <Field
              bottomSeparator="none"
              description={formatAchievementFilterEmptyMessage(achievementFilter)}
              label="Achievements"
              onCancelButton={onBackToDashboard}
            />
          )}
        </div>
      </PanelSectionRow>
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
  const [achievementModeFilter, setAchievementModeFilter] = useState<AchievementModeFilter>("all");
  const [visibleAchievementLimit, setVisibleAchievementLimit] = useState(INITIAL_ACHIEVEMENT_LIMIT);
  const totalAchievements = snapshot.achievements.length;
  const orderedAchievements = sortAchievementsForDisplay(snapshot.achievements);
  const filteredAchievements = orderedAchievements.filter((achievement) =>
    matchesAchievementFilter(achievement, achievementFilter) &&
    matchesAchievementModeFilter(achievement, achievementModeFilter),
  );
  const filteredAchievementCount = filteredAchievements.length;
  const completionPercent = getCompletionPercent(snapshot.game.summary);
  const softcoreModeProgress = getAchievementModeProgressSummary(snapshot.achievements, "softcore");
  const hardcoreModeProgress = getAchievementModeProgressSummary(snapshot.achievements, "hardcore");
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

      <PanelSection title="GAME OVERVIEW">
        <PanelSectionRow>
          <div style={getGameDetailSectionCardStyle()}>
            <div style={getGameDetailOverviewLayoutStyle()}>
              <div style={getGameDetailSystemPillStyle()}>{game.platformLabel ?? "Unknown system"}</div>
              <div style={getGameDetailOverviewIconFrameStyle()}>
                {headerArtworkUrl !== undefined ? (
                  <DeckyGameArtwork compact src={headerArtworkUrl} size={48} title={game.title} />
                ) : null}
              </div>
              <div style={getGameDetailOverviewTitleStyle()}>{game.title}</div>
            </div>
          </div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="PROGRESS SUMMARY">
        <PanelSectionRow>
          <div style={getGameDetailSectionCardStyle()}>
            <div style={getGameDetailSummaryLineStyle()}>{formatProgressSummary(snapshot)}</div>
            {completionPercent !== undefined ? (
              <DeckyCompletionProgressBar compact percent={completionPercent} />
            ) : null}
            <div style={getModeProgressGridStyle()}>
              {game.softcoreSummary !== undefined ? (
                <div style={getModeProgressCardStyle("softcore")}>
                  <div style={getModeProgressCardTitleStyle("softcore")}>Softcore</div>
                  <div style={getModeProgressCardLineStyle()}>
                    {`${formatCount(softcoreModeProgress.unlockedCount)} unlocked`}
                  </div>
                  <div style={getModeProgressCardPointsStyle()}>
                    {softcoreModeProgress.points !== undefined
                      ? `${formatCount(softcoreModeProgress.points)} points`
                      : "Points unavailable"}
                  </div>
                </div>
              ) : null}
              {game.hardcoreSummary !== undefined ? (
                <div style={getModeProgressCardStyle("hardcore")}>
                  <div style={getModeProgressCardTitleStyle("hardcore")}>Hardcore</div>
                  <div style={getModeProgressCardLineStyle()}>
                    {`${formatCount(hardcoreModeProgress.unlockedCount)} unlocked`}
                  </div>
                  <div style={getModeProgressCardPointsStyle()}>
                    {hardcoreModeProgress.points !== undefined
                      ? `${formatCount(hardcoreModeProgress.points)} points`
                      : "Points unavailable"}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="ACHIEVEMENTS">
        {hasAchievements ? (
          <AchievementSectionBody
            achievementModeFilter={achievementModeFilter}
            achievementFilter={achievementFilter}
            achievements={achievements}
            canLoadMoreAchievements={canLoadMoreAchievements}
            canShowAllAchievements={canShowAllAchievements}
            filteredAchievementCount={filteredAchievementCount}
            onAchievementModeFilterChange={(filter) => {
              setAchievementModeFilter(filter);
              setVisibleAchievementLimit(INITIAL_ACHIEVEMENT_LIMIT);
            }}
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
