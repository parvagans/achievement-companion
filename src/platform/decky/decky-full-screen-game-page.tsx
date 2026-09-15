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
import { getCompletionPercent } from "./decky-completion-progress-bar";
import {
  DeckyFullScreenAchievementBrowser,
  matchesAchievementFilter,
  matchesAchievementModeFilter,
  type AchievementFilter,
  type AchievementModeFilter,
} from "./decky-full-screen-achievement-browser";
import type { DeckyFullScreenGameMetadataPill } from "./decky-full-screen-game-metadata-pills";
import { DeckyRetroAchievementsGameSpotlight } from "./decky-retroachievements-game-spotlight";
import { DeckySteamGameSpotlight } from "./decky-steam-game-spotlight";
import { shouldRenderAchievementModeFilter } from "./decky-achievement-detail-helpers";
import { sortAchievementsForDisplay } from "./decky-game-detail-ordering";
import { TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { STEAM_PROVIDER_ID } from "./providers/steam";

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

function getMetricValue(
  metrics: readonly { readonly key: string; readonly label: string; readonly value: string }[],
  key: string,
): string | undefined {
  return metrics.find((metric) => metric.key === key)?.value;
}

function buildGameMetadataPills(
  metrics: readonly { readonly key: string; readonly label: string; readonly value: string }[],
  includeTotalPlayers: boolean,
): readonly DeckyFullScreenGameMetadataPill[] {
  const totalPlayers = getMetricValue(metrics, "total-players");
  const released = getMetricValue(metrics, "released");
  const points = getMetricValue(metrics, "points");
  const retroPoints = getMetricValue(metrics, "retro-points");

  return [
    ...(includeTotalPlayers && totalPlayers !== undefined
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

const FULLSCREEN_GAME_BOTTOM_SCROLL_PADDING = 88;
const FULLSCREEN_GAME_TOP_PADDING = 42;
const FULLSCREEN_GAME_FOCUS_DIAGNOSTICS_CLASS = "achievement-companion-fullscreen-game-focus-diagnostics";

function FullScreenGameFocusDiagnostics(): JSX.Element {
  return (
    <style>{`
.${FULLSCREEN_GAME_FOCUS_DIAGNOSTICS_CLASS} .Panel.Focusable.gpfocuswithin,
.${FULLSCREEN_GAME_FOCUS_DIAGNOSTICS_CLASS} .Panel.Focusable:focus-within {
  outline: 2px dashed rgba(56, 189, 248, 0.9) !important;
  outline-offset: 3px !important;
}

.${FULLSCREEN_GAME_FOCUS_DIAGNOSTICS_CLASS} .Panel.Focusable.gpfocus,
.${FULLSCREEN_GAME_FOCUS_DIAGNOSTICS_CLASS} .Panel.Focusable:focus {
  outline: 3px solid rgba(250, 204, 21, 1) !important;
  outline-offset: 3px !important;
  box-shadow: 0 0 0 5px rgba(250, 204, 21, 0.28) !important;
}
`}</style>
  );
}

function getFullScreenPageFrameStyle(): CSSProperties {
  return {
    padding: `calc(env(safe-area-inset-top, 0px) + ${FULLSCREEN_GAME_TOP_PADDING}px) 12px calc(env(safe-area-inset-bottom, 0px) + ${FULLSCREEN_GAME_BOTTOM_SCROLL_PADDING}px)`,
    boxSizing: "border-box",
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
          <div className={FULLSCREEN_GAME_FOCUS_DIAGNOSTICS_CLASS} style={getFullScreenPageFrameStyle()}>
            <FullScreenGameFocusDiagnostics />
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
  const achievements = filteredAchievements;
  const isCachedView = state.status === "stale";
  const snapshotSourceLabel = isCachedView ? "Cached snapshot" : "Live snapshot";
  const refreshTimestamp = state.lastUpdatedAt ?? snapshot.refreshedAt;
  const totalAchievementCount = summary.totalCount ?? snapshot.achievements.length;
  const gameMetadataPills = buildGameMetadataPills(
    game.metrics,
    isSteamProvider || game.communityStats === undefined,
  );

  return (
    <ScrollPanel>
      <TopAlignedScrollViewport
        scrollKey={`full-screen-game:${providerId ?? game.providerId}:${game.gameId}`}
      >
        <div className={FULLSCREEN_GAME_FOCUS_DIAGNOSTICS_CLASS} style={getFullScreenPageFrameStyle()}>
          <FullScreenGameFocusDiagnostics />
          <PanelSection title="Game Spotlight">
            <PanelSectionRow>
              {isSteamProvider ? (
                <DeckySteamGameSpotlight
                  game={game}
                  orderedAchievements={orderedAchievements}
                  totalAchievementCount={totalAchievementCount}
                  completionPercent={completionPercent}
                  completionTone="default"
                  metadataPills={gameMetadataPills}
                  backLabel={backLabel}
                  onBack={onBack}
                  onRefresh={() => {
                    setRefreshNonce((current) => current + 1);
                  }}
                />
              ) : (
                <DeckyRetroAchievementsGameSpotlight
                  game={game}
                  achievements={snapshot.achievements}
                  metadataPills={gameMetadataPills}
                  backLabel={backLabel}
                  onBack={onBack}
                  onRefresh={() => {
                    setRefreshNonce((current) => current + 1);
                  }}
                />
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
