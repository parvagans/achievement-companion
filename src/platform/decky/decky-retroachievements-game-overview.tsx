import type { CSSProperties } from "react";
import { Navigation as DeckyNavigation } from "@decky/ui";
import type { GameDetailSnapshot } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import externalLinkIconUrl from "./assets/external-link.svg";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import { DeckyFullScreenGameOverviewLayout, DeckyFullScreenGameTitle } from "./decky-full-screen-game-overview-layout";
import { DeckyRetroAchievementsProgressSummary } from "./decky-retroachievements-progress-summary";
import { buildDeckyRetroAchievementsProgressSummaryData } from "./decky-retroachievements-progress-summary-data";
import { DeckyRetroAchievementsGameStatusBanner } from "./decky-retroachievements-game-status-banner";
import { DeckyRetroAchievementsSetDetails } from "./decky-retroachievements-set-details";
import { DeckyRetroAchievementsCommunityStats } from "./decky-retroachievements-community-stats";
import { hasDisplayableRetroAchievementsCommunityStats } from "./decky-retroachievements-community-stats-data";
import { getRetroAchievementsCompletionIndicatorState } from "./decky-retroachievements-completion-indicator";
import { buildRetroAchievementsCompactGamePresentation } from "./decky-retroachievements-compact-game-model";
import type { DeckyCompletionProgressBarTone } from "./decky-completion-progress-bar";
import type { DeckyFullScreenGameMetadataPill } from "./decky-full-screen-game-metadata-pills";
import { DeckyRetroAchievementsGameIcon } from "./decky-retroachievements-game-icon";
import { steamRecipes, steamTheme } from "./steam-theme";
import { raTheme } from "./ra-theme";

type RetroAchievementsGame = GameDetailSnapshot["game"];

function getCompletionTone(
  completionState: ReturnType<typeof getRetroAchievementsCompletionIndicatorState>,
): DeckyCompletionProgressBarTone {
  if (completionState?.startsWith("mastered")) return "retroachievements-mastered";
  if (completionState?.startsWith("beaten")) return "retroachievements-beaten";
  return "default";
}

function getIdentityStyle(): CSSProperties {
  return {
    ...steamRecipes.card("fullscreen", "raised"),
    background: raTheme.surface.contentCard,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    gap: 10,
    minHeight: 0,
    minWidth: 0,
    padding: 10,
    boxSizing: "border-box",
  };
}

function getMetadataStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: "4px 8px",
    paddingTop: 6,
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
    color: steamTheme.color.textSecondary,
    fontSize: "0.75em",
    lineHeight: 1.2,
  };
}

function getMetadataValueStyle(): CSSProperties {
  return {
    color: raTheme.color.textPrimary,
    textAlign: "right",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function openRetroAchievementsGame(gameId: string): void {
  DeckyNavigation.NavigateToExternalWeb(`https://retroachievements.org/game/${gameId}`);
}

function formatLastSync(refreshedAt: number): string {
  const date = new Date(refreshedAt);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const dateLabel = date.toDateString() === now.toDateString()
    ? "Today"
    : date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
    });

  return `${dateLabel}, ${time}`;
}

function RetroAchievementsIdentityPanel({
  game,
  refreshedAt,
}: {
  readonly game: RetroAchievementsGame;
  readonly refreshedAt: number | undefined;
}): JSX.Element {
  const lastSyncLabel = refreshedAt === undefined ? undefined : formatLastSync(refreshedAt);
  const artworkUrl = game.coverImageUrl;
  return (
    <div style={getIdentityStyle()}>
      {artworkUrl !== undefined ? (
        <DeckyRetroAchievementsGameIcon game={game} src={artworkUrl} fit="contain" size={111} style={{ alignSelf: "center" }} />
      ) : null}
      <DeckyFullScreenGameTitle color={steamTheme.color.textPrimary} title={game.title} maxLines={2} />
      <DeckyFullscreenActionRow>
        <DeckyFullscreenActionButton
          fullWidth
          contentAlign="left"
          icon={<img alt="" aria-hidden="true" src={externalLinkIconUrl} style={{ width: 20, height: 20, objectFit: "contain", filter: raTheme.iconFilter.primary }} />}
          label="Open on RetroAchievements"
          onClick={() => openRetroAchievementsGame(game.gameId)}
        />
      </DeckyFullscreenActionRow>
      <div style={{ ...getMetadataStyle(), marginTop: "auto" }}>
        <span>Game ID</span><span style={getMetadataValueStyle()}>{game.gameId}</span>
        {game.platformLabel !== undefined ? <><span>System</span><span style={getMetadataValueStyle()}>{game.platformLabel}</span></> : null}
        {lastSyncLabel !== undefined ? <><span>Last Sync</span><span style={getMetadataValueStyle()}>{lastSyncLabel}</span></> : null}
      </div>
    </div>
  );
}

export function DeckyRetroAchievementsGameOverview({
  snapshot,
  achievementMode,
  metadataPills,
  refreshedAt,
}: {
  readonly snapshot: GameDetailSnapshot;
  readonly achievementMode: RetroAchievementsAchievementMode;
  readonly metadataPills: readonly DeckyFullScreenGameMetadataPill[];
  readonly refreshedAt: number | undefined;
}): JSX.Element {
  const { game, achievements } = snapshot;
  const presentation = buildRetroAchievementsCompactGamePresentation(snapshot, achievementMode);
  const progress = buildDeckyRetroAchievementsProgressSummaryData({
    summary: presentation.summary,
    achievements,
    achievementMode,
  });
  const completionTone = getCompletionTone(presentation.completionStatus);

  return (
    <div data-ac-steam-theme="fullscreen" style={{ height: "100%", fontFamily: steamTheme.type.fontFamily }}>
      <DeckyFullScreenGameOverviewLayout
        identity={<RetroAchievementsIdentityPanel game={game} refreshedAt={refreshedAt} />}
        progress={<DeckyRetroAchievementsProgressSummary completionTone={completionTone} progress={progress} />}
        community={hasDisplayableRetroAchievementsCommunityStats(game.communityStats)
          ? <DeckyRetroAchievementsCommunityStats stats={game.communityStats} />
          : undefined}
        setDetails={<DeckyRetroAchievementsSetDetails details={metadataPills} />}
        setStatus={<DeckyRetroAchievementsGameStatusBanner snapshot={snapshot} achievementMode={achievementMode} />}
      />
    </div>
  );
}
