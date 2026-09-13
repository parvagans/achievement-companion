import {
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { Field, PanelSection, PanelSectionRow, ScrollPanel } from "@decky/ui";
import { PlaceholderState } from "@ui/PlaceholderState";
import {
  initialDeckyGameDetailState,
  loadDeckyGameDetailState,
} from "./decky-app-services";
import {
  DeckyCompletionProgressBar,
  getCompletionPercent,
  type DeckyCompletionProgressBarTone,
} from "./decky-completion-progress-bar";
import {
  formatRetroAchievementsCompletionIndicatorLabel,
  getRetroAchievementsCompletionIndicatorState,
  RetroAchievementsCompletionIndicator,
} from "./decky-retroachievements-completion-indicator";
import { getDeckyGameArtworkFallbackInitials } from "./decky-game-artwork-fallback";
import { DeckyRetroAchievementsFullscreenGameArtwork } from "./decky-retroachievements-fullscreen-game-artwork";
import { DeckySteamAchievementSpotlightCard } from "./decky-steam-achievement-spotlight-card";
import { DeckySteamFullscreenGameArtwork } from "./decky-steam-fullscreen-game-artwork";
import {
  DeckyFullScreenAchievementBrowser,
  matchesAchievementFilter,
  matchesAchievementModeFilter,
  type AchievementFilter,
  type AchievementModeFilter,
} from "./decky-full-screen-achievement-browser";
import { getSteamFullscreenGameArtworkUrl } from "./decky-steam-game-artwork";
import { DeckyFullScreenGameProgressStat } from "./decky-full-screen-game-progress-stat";
import { DeckyFullScreenGameSpotlightCard } from "./decky-full-screen-game-spotlight-card";
import { DeckyFullScreenGameSpotlightOverview } from "./decky-full-screen-game-spotlight-overview";
import {
  DeckyFullScreenGameMetadataPills,
  type DeckyFullScreenGameMetadataPill,
} from "./decky-full-screen-game-metadata-pills";
import {
  formatRetroAchievementsBeatenAtText,
  formatRetroAchievementsMasteredAtText,
  dedupeDistinctLabels,
  shouldRenderRetroAchievementsModeSummaryCard,
  shouldRenderAchievementModeFilter,
} from "./decky-achievement-detail-helpers";
import { DeckyRetroAchievementsModeProgressCards } from "./decky-retroachievements-mode-progress-cards";
import { sortAchievementsForDisplay } from "./decky-game-detail-ordering";
import { TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { STEAM_PROVIDER_ID } from "./providers/steam";
import { formatDeckyProviderLabel } from "./providers";

export interface DeckyFullScreenGamePageProps {
  readonly providerId: string | undefined;
  readonly gameId: string | undefined;
  readonly onOpenAchievementDetail: ((achievementId: string) => void) | undefined;
  readonly onBack: () => void;
  readonly backLabel?: string;
  readonly backFooter?: string;
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

function computeSteamRemainingAchievements(summary: GameDetailSnapshot["game"]["summary"]): number | undefined {
  if (summary.totalCount === undefined) {
    return undefined;
  }

  return Math.max(0, summary.totalCount - summary.unlockedCount);
}

function getMetricValue(
  metrics: readonly { readonly key: string; readonly label: string; readonly value: string }[],
  key: string,
): string | undefined {
  return metrics.find((metric) => metric.key === key)?.value;
}

function getAchievementModePoints(
  achievements: readonly NormalizedAchievement[],
  modeFilter: Exclude<AchievementModeFilter, "all">,
): number | undefined {
  let points = 0;
  let hasPoints = false;

  for (const achievement of achievements) {
    if (!achievement.isUnlocked || achievement.unlockMode !== modeFilter) {
      continue;
    }

    if (achievement.points !== undefined) {
      points += achievement.points;
      hasPoints = true;
    }
  }

  return hasPoints ? points : undefined;
}

function buildGameMetadataPills(
  metrics: readonly { readonly key: string; readonly label: string; readonly value: string }[],
): readonly DeckyFullScreenGameMetadataPill[] {
  const totalPlayers = getMetricValue(metrics, "total-players");
  const released = getMetricValue(metrics, "released");
  const points = getMetricValue(metrics, "points");
  const retroPoints = getMetricValue(metrics, "retro-points");

  return [
    ...(totalPlayers !== undefined
      ? [
          {
            key: "total-players",
            label: "Total players",
            value: totalPlayers,
          },
        ]
      : []),
    ...(released !== undefined
      ? [
          {
            key: "released",
            label: "Release date",
            value: released,
          },
        ]
      : []),
    ...(points !== undefined
      ? [
          {
            key: "points",
            label: "Points",
            value: points,
          },
        ]
      : []),
    ...(retroPoints !== undefined
      ? [
          {
            key: "retro-points",
            label: "RetroPoints",
            value: retroPoints,
          },
        ]
      : []),
  ];
}

function formatAchievementStatusSummary(
  achievements: readonly NormalizedAchievement[],
): string {
  const unlockedCount = achievements.filter((achievement) => achievement.isUnlocked).length;
  const lockedCount = achievements.length - unlockedCount;

  return `Total ${formatCount(achievements.length)} · Unlocked ${formatCount(unlockedCount)} · Locked ${formatCount(lockedCount)}`;
}

function getSteamGameSpotlightLayoutStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.18fr) minmax(320px, 0.82fr)",
    gap: 12,
    width: "100%",
    alignItems: "stretch",
  };
}

function getSteamGameSpotlightColumnStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
    minHeight: 0,
    height: "100%",
  };
}

function getRetroAchievementsGameSpotlightLayoutStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 12,
    width: "100%",
    alignItems: "stretch",
  };
}

const FULLSCREEN_GAME_BOTTOM_SCROLL_PADDING = 88;
const FULLSCREEN_GAME_TOP_PADDING = 42;

function getFullScreenPageFrameStyle(): CSSProperties {
  return {
    padding: `calc(env(safe-area-inset-top, 0px) + ${FULLSCREEN_GAME_TOP_PADDING}px) 12px calc(env(safe-area-inset-bottom, 0px) + ${FULLSCREEN_GAME_BOTTOM_SCROLL_PADDING}px)`,
    boxSizing: "border-box",
  };
}

function getGameSpotlightStatsStyle(): CSSProperties {
  return {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    height: "100%",
  };
}

function getRetroAchievementsProgressSummaryCardStyle(): CSSProperties {
  return {
    flex: "1 1 auto",
    minHeight: 0,
    height: "100%",
  };
}

function getCompletionStatusBlockStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    width: "100%",
  };
}

function getSteamGameSpotlightStatsGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    justifyItems: "stretch",
    alignItems: "stretch",
    width: "100%",
  };
}

function selectSteamRecentUnlockedAchievements(
  achievements: readonly NormalizedAchievement[],
  limit = 3,
): readonly NormalizedAchievement[] {
  return achievements
    .filter((achievement) => achievement.isUnlocked && achievement.unlockedAt !== undefined)
    .sort((left, right) => {
      const unlockedAtDelta = (right.unlockedAt ?? 0) - (left.unlockedAt ?? 0);
      if (unlockedAtDelta !== 0) {
        return unlockedAtDelta;
      }

      const titleDelta = left.title.localeCompare(right.title);
      if (titleDelta !== 0) {
        return titleDelta;
      }

      return left.achievementId.localeCompare(right.achievementId);
    })
    .slice(0, limit);
}

function selectSteamNextLockedAchievements(
  achievements: readonly NormalizedAchievement[],
  limit = 3,
): readonly NormalizedAchievement[] {
  return achievements.filter((achievement) => !achievement.isUnlocked).slice(0, limit);
}

function getCompletionStatusPillStyle(
  tone: DeckyCompletionProgressBarTone,
): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
    width: "fit-content",
    maxWidth: "100%",
    minHeight: 28,
    padding: "5px 11px",
    borderRadius: 999,
    border:
      tone === "retroachievements-mastered"
        ? "1px solid rgba(232, 201, 102, 0.44)"
        : "1px solid rgba(214, 221, 232, 0.34)",
    background:
      tone === "retroachievements-mastered"
        ? "linear-gradient(180deg, rgba(232, 201, 102, 0.14), rgba(214, 178, 74, 0.06))"
        : "linear-gradient(180deg, rgba(214, 221, 232, 0.14), rgba(188, 198, 211, 0.06))",
    color:
      tone === "retroachievements-mastered"
        ? "rgba(255, 239, 184, 0.97)"
        : "rgba(231, 237, 245, 0.97)",
    fontSize: "0.82em",
    fontWeight: 800,
    letterSpacing: "0.05em",
    lineHeight: 1,
    textTransform: "uppercase",
    boxSizing: "border-box",
  };
}

function getCompletionTimingTextStyle(
  tone: DeckyCompletionProgressBarTone,
): CSSProperties {
  return {
    color:
      tone === "retroachievements-mastered"
        ? "rgba(255, 239, 184, 0.84)"
        : "rgba(221, 228, 236, 0.84)",
    fontSize: "0.86em",
    fontWeight: 700,
    lineHeight: 1.25,
  };
}

function getProgressStatGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 8,
  };
}

function isRenderableGameDetailState(
  state: ResourceState<GameDetailSnapshot>,
): state is ResourceState<GameDetailSnapshot> & { readonly data: GameDetailSnapshot } {
  return (state.status === "success" || state.status === "stale") && state.data !== undefined;
}

export function DeckyFullScreenGamePage({
  providerId,
  gameId,
  onOpenAchievementDetail,
  onBack,
  backLabel = "Back",
  backFooter = "Use Back to return to the compact side panel.",
}: DeckyFullScreenGamePageProps): JSX.Element {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>("all");
  const [achievementModeFilter, setAchievementModeFilter] = useState<AchievementModeFilter>("all");
  const loadSelectedGameDetail = useMemo(() => {
    if (providerId === undefined || gameId === undefined) {
      return () => Promise.resolve(initialDeckyGameDetailState);
    }

    return () => loadDeckyGameDetailState(providerId, gameId);
  }, [gameId, providerId, refreshNonce]);
  const state = useAsyncResourceState(loadSelectedGameDetail, initialDeckyGameDetailState);
  const hasRouteParameters = providerId !== undefined && gameId !== undefined;

  if (!isRenderableGameDetailState(state)) {
    return (
      <ScrollPanel>
        <TopAlignedScrollViewport
          scrollKey={`full-screen-game:${providerId ?? "missing"}:${gameId ?? "missing"}`}
        >
          <div style={getFullScreenPageFrameStyle()}>
            <PlaceholderState
              title="Full-screen game page"
              description={
                hasRouteParameters
                  ? "Loading the full-screen game page from the existing game-detail service."
                  : "The full-screen game page route is missing provider or game information."
              }
              state={state}
              footer={<span>{backFooter}</span>}
            />
          </div>
        </TopAlignedScrollViewport>
      </ScrollPanel>
    );
  }

  const snapshot = state.data;
  const game = snapshot.game;
  const isSteamProvider = game.providerId === STEAM_PROVIDER_ID;
  const heroArtworkUrl =
    isSteamProvider
      ? getSteamFullscreenGameArtworkUrl(game)
      : game.boxArtImageUrl ?? game.coverImageUrl;
  const orderedAchievements = sortAchievementsForDisplay(snapshot.achievements);
  const achievementSummary = formatAchievementStatusSummary(orderedAchievements);
  const summary = snapshot.game.summary;
  const providerIdValue = providerId ?? game.providerId;
  const filteredAchievements = orderedAchievements.filter((achievement) =>
    matchesAchievementFilter(achievement, achievementFilter) &&
    (shouldRenderAchievementModeFilter(providerIdValue) ? matchesAchievementModeFilter(achievement, achievementModeFilter) : true),
  );
  const filteredAchievementCount = filteredAchievements.length;
  const completionPercent = getCompletionPercent(snapshot.game.summary);
  const completionIndicatorState = getRetroAchievementsCompletionIndicatorState(game);
  const isBeaten =
    completionIndicatorState === "beaten-hardcore" || completionIndicatorState === "beaten-softcore";
  const isMasteredHardcore = completionIndicatorState === "mastered-hardcore";
  const completionStatusLabel = isMasteredHardcore ? "Mastered" : isBeaten ? "Beaten" : undefined;
  const completionStatusAriaLabel =
    completionIndicatorState !== undefined
      ? formatRetroAchievementsCompletionIndicatorLabel(completionIndicatorState)
      : undefined;
  const completionTone = isMasteredHardcore
    ? "retroachievements-mastered"
    : isBeaten
      ? "retroachievements-beaten"
      : "default";
  const masteredAtText = formatRetroAchievementsMasteredAtText(game);
  const beatenAtText = formatRetroAchievementsBeatenAtText(game);
  const completionAtText = isMasteredHardcore ? masteredAtText : beatenAtText;
  const achievements = filteredAchievements;
  const providerLabel = formatDeckyProviderLabel(providerId ?? game.providerId);
  const isCachedView = state.status === "stale";
  const snapshotSourceLabel = isCachedView ? "Cached snapshot" : "Live snapshot";
  const refreshTimestamp = state.lastUpdatedAt ?? snapshot.refreshedAt;
  const totalAchievementCount = summary.totalCount ?? snapshot.achievements.length;
  const heroMetaPills = dedupeDistinctLabels([providerLabel, snapshotSourceLabel]);
  const gameMetadataPills = buildGameMetadataPills(game.metrics);
  const hardcoreModePoints = getAchievementModePoints(snapshot.achievements, "hardcore");
  const softcoreModePoints = getAchievementModePoints(snapshot.achievements, "softcore");
  const steamRemainingCount = isSteamProvider ? computeSteamRemainingAchievements(summary) : undefined;
  const steamRecentAchievements = isSteamProvider
    ? selectSteamRecentUnlockedAchievements(orderedAchievements, 3)
    : [];
  const steamNextLockedAchievements = isSteamProvider
    ? selectSteamNextLockedAchievements(orderedAchievements, 3)
    : [];
  const steamSecondaryAchievements =
    steamRecentAchievements.length > 0 ? steamRecentAchievements : steamNextLockedAchievements;
  const steamSecondaryCardTitle =
    steamRecentAchievements.length > 0 ? "Latest Unlocks" : "Achievement Highlights";
  const showHardcoreModeCard = shouldRenderRetroAchievementsModeSummaryCard({
    game,
    mode: "hardcore",
    summary: game.hardcoreSummary,
    points: hardcoreModePoints,
  });
  const showSoftcoreModeCard = shouldRenderRetroAchievementsModeSummaryCard({
    game,
    mode: "softcore",
    summary: game.softcoreSummary,
    points: softcoreModePoints,
  });

  return (
    <ScrollPanel>
      <TopAlignedScrollViewport
        scrollKey={`full-screen-game:${providerId ?? game.providerId}:${game.gameId}`}
      >
        <div style={getFullScreenPageFrameStyle()}>
          <PanelSection title="Game Spotlight">
            <PanelSectionRow>
              {isSteamProvider ? (
                <div style={getSteamGameSpotlightLayoutStyle()}>
                  <DeckyFullScreenGameSpotlightOverview
                    title={game.title}
                    metadataLabels={heroMetaPills}
                    artwork={
                      heroArtworkUrl !== undefined ? (
                        <DeckySteamFullscreenGameArtwork
                          src={heroArtworkUrl}
                          fallbackLabel={getDeckyGameArtworkFallbackInitials(game.title)}
                        />
                      ) : undefined
                    }
                    backLabel={backLabel}
                    onBack={onBack}
                    onRefresh={() => {
                      setRefreshNonce((current) => current + 1);
                    }}
                    platform={undefined}
                  />

                  <div style={getSteamGameSpotlightColumnStyle()}>
                    <DeckyFullScreenGameSpotlightCard title="Progress Summary">
                      {completionPercent !== undefined ? (
                        <DeckyCompletionProgressBar percent={completionPercent} tone={completionTone} />
                      ) : null}
                      <div style={getSteamGameSpotlightStatsGridStyle()}>
                        <DeckyFullScreenGameProgressStat label="Unlocked" value={formatCount(summary.unlockedCount)} />
                        <DeckyFullScreenGameProgressStat label="Total" value={formatCount(totalAchievementCount)} />
                        {steamRemainingCount !== undefined ? (
                          <DeckyFullScreenGameProgressStat label="Remaining" value={formatCount(steamRemainingCount)} />
                        ) : null}
                      </div>

                      <DeckyFullScreenGameMetadataPills pills={gameMetadataPills} />
                    </DeckyFullScreenGameSpotlightCard>

                    {steamSecondaryAchievements.length > 0 ? (
                      <DeckySteamAchievementSpotlightCard
                        achievements={steamSecondaryAchievements}
                        mode={steamRecentAchievements.length > 0 ? "recent" : "highlight"}
                        title={steamSecondaryCardTitle}
                      />
                    ) : null}
                  </div>
                </div>
              ) : (
                <div style={getRetroAchievementsGameSpotlightLayoutStyle()}>
                  <DeckyFullScreenGameSpotlightOverview
                    title={game.title}
                    metadataLabels={heroMetaPills}
                    artwork={
                      heroArtworkUrl !== undefined ? (
                        <DeckyRetroAchievementsFullscreenGameArtwork
                          src={heroArtworkUrl}
                          fallbackLabel={getDeckyGameArtworkFallbackInitials(game.title)}
                        />
                      ) : undefined
                    }
                    backLabel={backLabel}
                    onBack={onBack}
                    onRefresh={() => {
                      setRefreshNonce((current) => current + 1);
                    }}
                    platform={{
                      label: game.platformLabel ?? "Unknown system",
                      iconUrl: game.systemIconUrl,
                    }}
                  />

                  <div style={getGameSpotlightStatsStyle()}>
                    <DeckyFullScreenGameSpotlightCard
                      title="Progress Summary"
                      style={getRetroAchievementsProgressSummaryCardStyle()}
                    >
                      {completionStatusLabel !== undefined && completionStatusAriaLabel !== undefined ? (
                        <div style={getCompletionStatusBlockStyle()}>
                          <div
                            aria-label={completionStatusAriaLabel}
                            style={getCompletionStatusPillStyle(completionTone)}
                            title={completionStatusAriaLabel}
                          >
                            <RetroAchievementsCompletionIndicator game={game} />
                            <span>{completionStatusLabel}</span>
                          </div>
                          {completionAtText !== undefined && completionTone !== "default" ? (
                            <div style={getCompletionTimingTextStyle(completionTone)}>{completionAtText}</div>
                          ) : null}
                        </div>
                      ) : (
                        <RetroAchievementsCompletionIndicator game={game} />
                      )}
                      {completionPercent !== undefined ? (
                        <DeckyCompletionProgressBar
                          percent={completionPercent}
                          tone={completionTone}
                        />
                      ) : null}
                      <div style={getProgressStatGridStyle()}>
                        <DeckyFullScreenGameProgressStat label="Unlocked" value={formatCount(summary.unlockedCount)} />
                        <DeckyFullScreenGameProgressStat label="Total" value={formatCount(totalAchievementCount)} />
                      </div>

                      <DeckyFullScreenGameMetadataPills pills={gameMetadataPills} />

                      <DeckyRetroAchievementsModeProgressCards
                        game={game}
                        hardcorePoints={hardcoreModePoints}
                        softcorePoints={softcoreModePoints}
                        showHardcore={showHardcoreModeCard}
                        showSoftcore={showSoftcoreModeCard}
                      />
                    </DeckyFullScreenGameSpotlightCard>
                  </div>
                </div>
              )}
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Achievements">
            <PanelSectionRow>
              <DeckyFullScreenAchievementBrowser
                achievementFilter={achievementFilter}
                achievementModeFilter={achievementModeFilter}
                achievementSummary={achievementSummary}
                achievements={achievements}
                providerId={providerIdValue}
                filteredAchievementCount={filteredAchievementCount}
                onAchievementFilterChange={(filter) => {
                  setAchievementFilter(filter);
                }}
                onAchievementModeFilterChange={(filter) => {
                  setAchievementModeFilter(filter);
                }}
                onOpenAchievementDetail={onOpenAchievementDetail}
                onBack={onBack}
              />
            </PanelSectionRow>
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
