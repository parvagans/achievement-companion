import { useMemo, type CSSProperties } from "react";
import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { PanelSection, PanelSectionRow } from "@decky/ui";
import { PlaceholderState } from "@ui/PlaceholderState";
import { loadDeckyGameDetailState, initialDeckyGameDetailState } from "./decky-app-services";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DeckyCompactPillActionGroup, DeckyCompactPillActionItem } from "./decky-compact-pill-action-item";
import {
  buildAchievementStatus,
  formatCount,
  getAchievementDescriptionText,
  formatPlatformBadgeLabel,
  formatTimestamp,
  hasAchievementCounts,
  getAchievementCounts,
  getMetricValue,
  getUnlockRatePercent,
  shouldHideSteamAchievementDetailStats,
} from "./decky-achievement-detail-helpers";
import { useAsyncResourceState } from "./useAsyncResourceState";

export interface CompactAchievementGameTarget {
  readonly providerId: string;
  readonly gameId: string;
  readonly title: string;
  readonly platformLabel?: string | undefined;
  readonly coverImageUrl?: string | undefined;
}

export interface CompactAchievementTarget {
  readonly game: CompactAchievementGameTarget;
  readonly achievement: Pick<
    NormalizedAchievement,
    | "achievementId"
    | "title"
    | "description"
    | "badgeImageUrl"
    | "isUnlocked"
    | "unlockedAt"
    | "hardcoreUnlockedAt"
    | "softcoreUnlockedAt"
    | "unlockMode"
    | "points"
    | "metrics"
  >;
}

export interface DeckyAchievementDetailViewProps {
  readonly target: CompactAchievementTarget;
  readonly onBack: () => void;
  readonly onOpenFullScreenGame: (() => void) | undefined;
}

function getCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    boxSizing: "border-box",
  };
}

function getRowStyle(): CSSProperties {
  return {
    display: "flex",
    gap: 10,
    alignItems: "center",
    minWidth: 0,
  };
}

function getTextBlockStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    gap: 1,
  };
}

function getGameTitleStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: "0.96em",
    fontWeight: 700,
    lineHeight: 1.15,
  };
}

function getAchievementTitleStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1.03em",
    fontWeight: 800,
    lineHeight: 1.1,
  };
}

function getSubtleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.74)",
    fontSize: "0.8em",
    lineHeight: 1.2,
  };
}

function getDescriptionStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: "0.84em",
    lineHeight: 1.28,
    whiteSpace: "pre-wrap",
  };
}

function getPlatformBadgeStyle(): CSSProperties {
  return {
    minWidth: 32,
    height: 32,
    padding: "0 7px",
    boxSizing: "border-box",
    borderRadius: 10,
    border: "1px solid rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: "0.76em",
    fontWeight: 700,
    letterSpacing: "0.06em",
  };
}

function getStatsGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 7,
  };
}

function getSectionBlockStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  };
}

function getSectionLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.68em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getStatStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    minWidth: 0,
    alignItems: "center",
    textAlign: "center",
  };
}

function getStatLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "0.72em",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getStatValueStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.96)",
    fontSize: "0.94em",
    fontWeight: 700,
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getStatSecondaryStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: "0.74em",
    lineHeight: 1.15,
    minWidth: 0,
    overflow: "visible",
    textOverflow: "clip",
    whiteSpace: "normal",
    textAlign: "center",
  };
}

function getRarityBarFrameStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    width: "100%",
  };
}

function getRarityBarTrackStyle(): CSSProperties {
  return {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.06)",
  };
}

function getRarityBarFillStyle(percent: number): CSSProperties {
  return {
    width: `${Math.max(0, Math.min(100, percent))}%`,
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, rgba(147, 197, 253, 0.92), rgba(96, 165, 250, 0.98))",
    transition: "width 120ms ease",
  };
}

function getRarityBarCaptionStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.76)",
    fontSize: "0.84em",
    fontWeight: 700,
    lineHeight: 1.2,
  };
}

function getCountsGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 7,
  };
}

function AchievementStat({
  label,
  value,
  secondary,
  style,
}: {
  readonly label: string;
  readonly value: string;
  readonly secondary?: string;
  readonly style?: CSSProperties;
}): JSX.Element {
  return (
    <div style={{ ...getStatStyle(), ...style }}>
      <div style={getStatLabelStyle()}>{label}</div>
      <div style={getStatValueStyle()}>{value}</div>
      {secondary !== undefined ? <div style={getStatSecondaryStyle()}>{secondary}</div> : null}
    </div>
  );
}

function RarityBar({
  percent,
}: {
  readonly percent: number | undefined;
}): JSX.Element {
  const resolvedPercent = percent ?? 0;

  return (
    <div style={getRarityBarFrameStyle()}>
      <div style={getRarityBarCaptionStyle()}>
        {percent !== undefined ? `${resolvedPercent}% unlock rate` : "Unlock rate unavailable"}
      </div>
      <div
        aria-label="Achievement unlock rate"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={resolvedPercent}
        aria-valuetext={percent !== undefined ? `${resolvedPercent}% unlock rate` : "Unlock rate unavailable"}
        role="progressbar"
        style={getRarityBarTrackStyle()}
      >
        <div style={getRarityBarFillStyle(resolvedPercent)} />
      </div>
    </div>
  );
}

function getAchievementCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 11,
    padding: 13,
    borderRadius: 16,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  };
}

function getAchievementBadgeStyle(isUnlocked: boolean): CSSProperties {
  return {
    display: "inline-flex",
    flexShrink: 0,
    lineHeight: 0,
    opacity: isUnlocked ? 1 : 0.9,
    filter: isUnlocked ? "none" : "grayscale(1) contrast(1.08) brightness(0.92)",
  };
}

function AchievementCard({
  achievement,
  game,
}: {
  readonly achievement: Pick<
    NormalizedAchievement,
    "achievementId" | "title" | "description" | "badgeImageUrl" | "isUnlocked" | "unlockedAt" | "points" | "metrics"
  >;
  readonly game: CompactAchievementGameTarget;
}): JSX.Element {
  const isSteamProvider = shouldHideSteamAchievementDetailStats(game.providerId);
  const counts = getAchievementCounts(achievement.metrics);
  const showCounts = hasAchievementCounts(counts);
  const unlockRatePercent = getUnlockRatePercent(achievement);
  const retroPoints = getMetricValue(achievement.metrics, "true-ratio", "True Ratio");
  const achievementStatus = buildAchievementStatus(achievement);
  const achievementStatusSecondary =
    achievementStatus.secondary !== undefined ? achievementStatus.secondary.replace(/^Unlocked\s+/u, "") : undefined;

  return (
    <div style={getAchievementCardStyle()}>
      <div style={getRowStyle()}>
        {game.coverImageUrl !== undefined ? (
          <DeckyGameArtwork compact src={game.coverImageUrl} size={40} title={game.title} />
        ) : (
          <span style={getPlatformBadgeStyle()}>{formatPlatformBadgeLabel(game.platformLabel)}</span>
        )}

        <div style={getTextBlockStyle()}>
          <div style={getGameTitleStyle()}>{game.title}</div>
          <div style={getSubtleStyle()}>{game.platformLabel ?? "Unknown platform"}</div>
        </div>
      </div>

      <div style={getRowStyle()}>
        {achievement.badgeImageUrl !== undefined ? (
          <span style={getAchievementBadgeStyle(achievement.isUnlocked)}>
            <DeckyGameArtwork compact src={achievement.badgeImageUrl} size={40} title={achievement.title} />
          </span>
        ) : null}

        <div style={getTextBlockStyle()}>
          <div style={getAchievementTitleStyle()}>{achievement.title}</div>
          {isSteamProvider ? (
            <div style={getDescriptionStyle()}>{getAchievementDescriptionText(achievement.description)}</div>
          ) : achievement.description !== undefined ? (
            <div style={getDescriptionStyle()}>{achievement.description}</div>
          ) : null}
          {isSteamProvider ? <div style={getSubtleStyle()}>{achievementStatus.secondary ?? achievementStatus.value}</div> : null}
        </div>
      </div>

      {!isSteamProvider ? (
        <>
          <div style={getSectionBlockStyle()}>
            <div style={getSectionLabelStyle()}>Unlock details</div>
            <div style={getStatsGridStyle()}>
              <AchievementStat
                label="Points"
                value={achievement.points !== undefined ? formatCount(achievement.points) : "-"}
              />
              <AchievementStat label="Unlock rate" value={retroPoints ?? "-"} />
              <AchievementStat
                label="Unlock status"
                value={achievementStatus.value}
                {...(achievementStatusSecondary !== undefined ? { secondary: achievementStatusSecondary } : {})}
                style={{ gridColumn: "1 / -1" }}
              />
            </div>
          </div>

          <div style={getSectionBlockStyle()}>
            <div style={getSectionLabelStyle()}>Rarity</div>
            <RarityBar percent={unlockRatePercent} />

            {showCounts ? (
              <div style={getCountsGridStyle()}>
                <AchievementStat
                  label="Softcore unlocks"
                  value={counts.softcoreUnlockCount !== undefined ? formatCount(counts.softcoreUnlockCount) : "-"}
                />
                <AchievementStat
                  label="Hardcore unlocks"
                  value={counts.hardcoreUnlockCount !== undefined ? formatCount(counts.hardcoreUnlockCount) : "-"}
                />
                <AchievementStat
                  label="Total players"
                  value={counts.totalPlayers !== undefined ? formatCount(counts.totalPlayers) : "-"}
                  style={{ gridColumn: "1 / -1" }}
                />
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div style={getSectionBlockStyle()}>
          <div style={getSectionLabelStyle()}>Unlock status</div>
          <div style={getSubtleStyle()}>{achievementStatus.secondary ?? achievementStatus.value}</div>
        </div>
      )}
    </div>
  );
}

function isRenderableGameDetailState(
  state: ResourceState<GameDetailSnapshot>,
): state is ResourceState<GameDetailSnapshot> & { readonly data: GameDetailSnapshot } {
  return (state.status === "success" || state.status === "stale") && state.data !== undefined;
}

export function DeckyAchievementDetailView({
  target,
  onBack,
  onOpenFullScreenGame,
}: DeckyAchievementDetailViewProps): JSX.Element {
  const loadSelectedGameDetail = useMemo(
    () => () => loadDeckyGameDetailState(target.game.providerId, target.game.gameId),
    [target.game.gameId, target.game.providerId],
  );
  const loader = useAsyncResourceState(loadSelectedGameDetail, initialDeckyGameDetailState);

  if (!isRenderableGameDetailState(loader)) {
    return (
      <PlaceholderState
        title={target.achievement.title}
        description="Loading achievement details from the selected provider."
        state={loader}
        footer={<span>Use Back to return to the previous compact view.</span>}
      />
    );
  }

  const achievement =
    loader.data.achievements.find((entry) => entry.achievementId === target.achievement.achievementId) ??
    target.achievement;
  const game = {
    providerId: loader.data.game.providerId,
    gameId: loader.data.game.gameId,
    title: loader.data.game.title,
    ...(loader.data.game.platformLabel !== undefined ? { platformLabel: loader.data.game.platformLabel } : {}),
    ...(loader.data.game.coverImageUrl !== undefined ? { coverImageUrl: loader.data.game.coverImageUrl } : {}),
  };

  return (
    <>
      <PanelSection title="Navigation">
        <PanelSectionRow>
          <DeckyCompactPillActionGroup>
          <DeckyCompactPillActionItem
            label="Back"
            onClick={onBack}
            onCancelButton={onBack}
          />

            {onOpenFullScreenGame !== undefined ? (
              <DeckyCompactPillActionItem
                label="Open full-screen game"
                onClick={onOpenFullScreenGame}
                onCancelButton={onBack}
              />
            ) : null}
          </DeckyCompactPillActionGroup>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Achievement details">
        <PanelSectionRow>
          <AchievementCard achievement={achievement} game={game} />
        </PanelSectionRow>
      </PanelSection>
    </>
  );
}
