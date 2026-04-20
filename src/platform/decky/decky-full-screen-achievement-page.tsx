import { useMemo, type CSSProperties } from "react";
import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { PanelSection, PanelSectionRow, ScrollPanel } from "@decky/ui";
import { PlaceholderState } from "@ui/PlaceholderState";
import { initialDeckyGameDetailState, loadDeckyGameDetailState } from "./decky-app-services";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import { DeckyGameArtwork } from "./decky-game-artwork";
import {
  buildAchievementStatus,
  formatCount,
  formatPlatformBadgeLabel,
  formatTimestamp,
  dedupeDistinctLabels,
  hasAchievementCounts,
  getAchievementCounts,
  getAchievementDescriptionText,
  getMetricValue,
  getUnlockRatePercent,
  shouldHideSteamAchievementDetailStats,
} from "./decky-achievement-detail-helpers";
import { TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { useAsyncResourceState } from "./useAsyncResourceState";
import { formatDeckyProviderLabel } from "./providers";
import { STEAM_PROVIDER_ID } from "./providers/steam";

export interface DeckyFullScreenAchievementPageProps {
  readonly providerId: string | undefined;
  readonly gameId: string | undefined;
  readonly achievementId: string | undefined;
  readonly onBack: () => void;
  readonly backLabel?: string;
  readonly backDescription?: string;
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
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
    padding: 18,
    borderRadius: 20,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.03))",
  };
}

function getHeroArtworkStyle(): CSSProperties {
  return {
    flex: "0 0 auto",
  };
}

function getHeroTextStyle(): CSSProperties {
  return {
    flex: "1 1 280px",
    minWidth: 240,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
}

function getHeroLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function resolveSteamAchievementHeroLabel(game: GameDetailSnapshot["game"]): string {
  if (game.title.trim().length > 0) {
    return game.title;
  }

  if (game.appid !== undefined) {
    return `Steam App ${game.appid}`;
  }

  return "Steam Game";
}

function getHeroTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1.35em",
    fontWeight: 800,
    lineHeight: 1.08,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getHeroMetaRowStyle(): CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  };
}

function getHeroMetaPillStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: "0.82em",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  };
}

function getHeroSupportStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.84em",
    lineHeight: 1.35,
  };
}

function getAchievementBlockStyle(): CSSProperties {
  return {
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  };
}

function getAchievementTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
    flex: "1 1 260px",
  };
}

function getAchievementTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1.1em",
    fontWeight: 800,
    lineHeight: 1.12,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getAchievementDescriptionStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.86)",
    fontSize: "0.92em",
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
  };
}

function getBadgeFrameStyle(isUnlocked: boolean): CSSProperties {
  return {
    display: "inline-flex",
    flexShrink: 0,
    lineHeight: 0,
    opacity: isUnlocked ? 1 : 0.94,
    filter: isUnlocked ? "none" : "grayscale(1) contrast(1.12) brightness(0.92)",
  };
}

function getSectionBlockStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
}

function getSectionLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.7em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getStatGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
  };
}

function getStatStyle(): CSSProperties {
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
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "0.98em",
    fontWeight: 700,
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "visible",
    textOverflow: "clip",
    whiteSpace: "normal",
    textAlign: "center",
  };
}

function getStatSecondaryStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.82em",
    lineHeight: 1.2,
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
    gap: 8,
    width: "100%",
  };
}

function getRarityBarTrackStyle(): CSSProperties {
  return {
    height: 7,
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
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
  };
}

function AchievementStat({
  label,
  value,
  secondary,
}: {
  readonly label: string;
  readonly value: string;
  readonly secondary?: string;
}): JSX.Element {
  return (
    <div style={getStatStyle()}>
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

function isRenderableGameDetailState(
  state: ResourceState<GameDetailSnapshot>,
): state is ResourceState<GameDetailSnapshot> & { readonly data: GameDetailSnapshot } {
  return (state.status === "success" || state.status === "stale") && state.data !== undefined;
}

export function DeckyFullScreenAchievementPage({
  providerId,
  gameId,
  achievementId,
  onBack,
  backLabel = "Back",
  backDescription = "Return to the full-screen game page.",
}: DeckyFullScreenAchievementPageProps): JSX.Element {
  const loadSelectedGameDetail = useMemo(() => {
    if (providerId === undefined || gameId === undefined) {
      return () => Promise.resolve(initialDeckyGameDetailState);
    }

    return () => loadDeckyGameDetailState(providerId, gameId);
  }, [gameId, providerId]);
  const state = useAsyncResourceState(loadSelectedGameDetail, initialDeckyGameDetailState);
  const hasRouteParameters = providerId !== undefined && gameId !== undefined && achievementId !== undefined;

  if (!isRenderableGameDetailState(state)) {
    return (
      <ScrollPanel>
        <TopAlignedScrollViewport
          scrollKey={`full-screen-achievement:${providerId ?? "missing"}:${gameId ?? "missing"}:${achievementId ?? "missing"}`}
        >
          <div style={getPageFrameStyle()}>
            <PlaceholderState
              title="Full-screen achievement page"
              description={
                hasRouteParameters
                  ? "Loading the full-screen achievement page from the existing game-detail service."
                  : "The full-screen achievement page route is missing provider, game, or achievement information."
              }
              state={state}
              footer={<span>Use Back to return to the full-screen game page.</span>}
            />
          </div>
        </TopAlignedScrollViewport>
      </ScrollPanel>
    );
  }

  const snapshot = state.data;
  const game = snapshot.game;
  const achievement =
    achievementId !== undefined
      ? snapshot.achievements.find((entry) => entry.achievementId === achievementId)
      : undefined;

  if (achievement === undefined) {
    return (
      <ScrollPanel>
        <TopAlignedScrollViewport
          scrollKey={`full-screen-achievement:${providerId ?? game.providerId}:${game.gameId}:${achievementId ?? "missing"}`}
        >
          <div style={getPageFrameStyle()}>
            <PlaceholderState
              title={game.title}
              description="Achievement details are unavailable for the selected row."
              state={state}
              footer={<span>Use Back to return to the full-screen game page.</span>}
            />
          </div>
        </TopAlignedScrollViewport>
      </ScrollPanel>
    );
  }

  const heroArtworkUrl = game.boxArtImageUrl ?? game.coverImageUrl;
  const providerLabel = formatDeckyProviderLabel(providerId ?? game.providerId);
  const isSteamProvider = shouldHideSteamAchievementDetailStats(providerId ?? game.providerId);
  const heroLabel = isSteamProvider ? resolveSteamAchievementHeroLabel(game) : "Selected achievement";
  const counts = getAchievementCounts(achievement.metrics);
  const showCounts = hasAchievementCounts(counts);
  const unlockRatePercent = getUnlockRatePercent(achievement);
  const achievementStatus = buildAchievementStatus(achievement);
  const heroMetaPills = dedupeDistinctLabels([game.platformLabel ?? "Unknown platform", providerLabel]);

  return (
    <ScrollPanel>
      <TopAlignedScrollViewport
        scrollKey={`full-screen-achievement:${providerId ?? game.providerId}:${game.gameId}:${achievement.achievementId}`}
      >
        <div style={getPageFrameStyle()}>
          <PanelSection title="Navigation">
            <DeckyFullscreenActionRow>
              <DeckyFullscreenActionButton
                label={backLabel}
                isFullscreenBackAction
                onClick={() => {
                  onBack();
                }}
              />
            </DeckyFullscreenActionRow>
          </PanelSection>

          <PanelSection title="Achievement spotlight">
            <PanelSectionRow>
              <div style={getHeroCardStyle()}>
                {heroArtworkUrl !== undefined ? (
                  <div style={getHeroArtworkStyle()}>
                    <DeckyGameArtwork src={heroArtworkUrl} size={144} title={game.title} />
                  </div>
                ) : null}

                <div style={getHeroTextStyle()}>
                  <div style={getHeroLabelStyle()}>{heroLabel}</div>
                  <div style={getHeroTitleStyle()}>{achievement.title}</div>
                  <div style={getHeroMetaRowStyle()}>
                    {heroMetaPills.map((label) => (
                      <span key={label} style={getHeroMetaPillStyle()}>
                        {label}
                      </span>
                    ))}
                  </div>
                  <div style={getHeroSupportStyle()}>
                    {achievementStatus.secondary ?? achievementStatus.value}
                  </div>
                </div>
              </div>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Achievement details">
            <PanelSectionRow>
              <div style={getAchievementBlockStyle()}>
                {achievement.badgeImageUrl !== undefined ? (
                  <span style={getBadgeFrameStyle(achievement.isUnlocked)}>
                    <DeckyGameArtwork compact src={achievement.badgeImageUrl} size={72} title={achievement.title} />
                  </span>
                ) : (
                  <span style={getHeroMetaPillStyle()}>{formatPlatformBadgeLabel(game.platformLabel)}</span>
                )}

                <div style={getAchievementTextStyle()}>
                  <div style={getAchievementTitleStyle()}>{achievement.title}</div>
                  <div style={getAchievementDescriptionStyle()}>{getAchievementDescriptionText(achievement.description)}</div>
                  {isSteamProvider ? (
                    <div style={getHeroSupportStyle()}>{achievementStatus.secondary ?? achievementStatus.value}</div>
                  ) : null}
                </div>
              </div>
            </PanelSectionRow>
          </PanelSection>

          {!isSteamProvider ? (
            <>
              <PanelSection title="Unlock details">
                <PanelSectionRow>
                  <div style={getStatGridStyle()}>
                    <AchievementStat
                      label="Points"
                      value={achievement.points !== undefined ? formatCount(achievement.points) : "-"}
                    />
                    <AchievementStat
                      label="Unlock rate"
                      value={getMetricValue(achievement.metrics, "true-ratio", "True Ratio") ?? "-"}
                    />
                    <AchievementStat
                      label="Unlocked at"
                      value={achievement.unlockedAt !== undefined ? formatTimestamp(achievement.unlockedAt) : "-"}
                    />
                  </div>
                </PanelSectionRow>
              </PanelSection>

              <PanelSection title="Rarity">
                <PanelSectionRow>
                  <RarityBar percent={unlockRatePercent} />
                </PanelSectionRow>

                {showCounts ? (
                  <PanelSectionRow>
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
                      />
                    </div>
                  </PanelSectionRow>
                ) : null}
              </PanelSection>
            </>
          ) : null}
        </div>
      </TopAlignedScrollViewport>
    </ScrollPanel>
  );
}
