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
  formatAchievementUnlockRatePercent,
  formatTimestamp,
  dedupeDistinctLabels,
  hasAchievementCounts,
  getAchievementCounts,
  getAchievementSpotlightCounts,
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

type AchievementSpotlightTone = "hardcore" | "softcore" | "locked";

function getAchievementSpotlightTone(
  achievement: Pick<NormalizedAchievement, "isUnlocked" | "unlockMode">,
): AchievementSpotlightTone {
  if (!achievement.isUnlocked) {
    return "locked";
  }

  return achievement.unlockMode === "hardcore" ? "hardcore" : "softcore";
}

function getAchievementSpotlightToneColors(tone: AchievementSpotlightTone): {
  readonly accent: string;
  readonly background: string;
  readonly border: string;
  readonly pillBackground: string;
  readonly pillBorder: string;
  readonly rarityBarEnd: string;
  readonly rarityBarStart: string;
  readonly secondary: string;
  readonly statBackground: string;
  readonly statBorder: string;
  readonly statLabel: string;
  readonly statValue: string;
  readonly statusLabel: string;
} {
  if (tone === "hardcore") {
    return {
      accent: "rgba(232, 201, 102, 0.96)",
      background: "linear-gradient(180deg, rgba(214, 178, 74, 0.09), rgba(214, 178, 74, 0.035))",
      border: "rgba(214, 178, 74, 0.3)",
      pillBackground: "rgba(214, 178, 74, 0.11)",
      pillBorder: "rgba(214, 178, 74, 0.35)",
      rarityBarStart: "rgba(232, 201, 102, 0.96)",
      rarityBarEnd: "rgba(214, 178, 74, 0.88)",
      secondary: "rgba(232, 201, 102, 0.78)",
      statBackground: "rgba(214, 178, 74, 0.045)",
      statBorder: "rgba(214, 178, 74, 0.2)",
      statLabel: "rgba(232, 201, 102, 0.86)",
      statValue: "rgba(255, 255, 255, 0.98)",
      statusLabel: "rgba(232, 201, 102, 0.98)",
    };
  }

  if (tone === "softcore") {
    return {
      accent: "rgba(220, 225, 233, 0.98)",
      background: "linear-gradient(180deg, rgba(214, 221, 232, 0.08), rgba(214, 221, 232, 0.03))",
      border: "rgba(214, 221, 232, 0.24)",
      pillBackground: "rgba(214, 221, 232, 0.1)",
      pillBorder: "rgba(214, 221, 232, 0.3)",
      rarityBarStart: "rgba(220, 225, 233, 0.98)",
      rarityBarEnd: "rgba(214, 221, 232, 0.82)",
      secondary: "rgba(214, 221, 232, 0.78)",
      statBackground: "rgba(214, 221, 232, 0.04)",
      statBorder: "rgba(214, 221, 232, 0.18)",
      statLabel: "rgba(220, 225, 233, 0.86)",
      statValue: "rgba(255, 255, 255, 0.98)",
      statusLabel: "rgba(220, 225, 233, 0.98)",
    };
  }

  return {
    accent: "rgba(255, 255, 255, 0.72)",
    background: "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.025))",
    border: "rgba(255, 255, 255, 0.09)",
    pillBackground: "rgba(255, 255, 255, 0.05)",
    pillBorder: "rgba(255, 255, 255, 0.1)",
    rarityBarStart: "rgba(180, 186, 196, 0.82)",
    rarityBarEnd: "rgba(120, 126, 138, 0.82)",
    secondary: "rgba(255, 255, 255, 0.68)",
    statBackground: "rgba(255, 255, 255, 0.03)",
    statBorder: "rgba(255, 255, 255, 0.08)",
    statLabel: "rgba(255, 255, 255, 0.7)",
    statValue: "rgba(255, 255, 255, 0.96)",
    statusLabel: "rgba(255, 255, 255, 0.72)",
  };
}

function getSectionBlockStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
}

function getAchievementSpotlightCardStyle(tone: AchievementSpotlightTone): CSSProperties {
  const colors = getAchievementSpotlightToneColors(tone);

  return {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    boxSizing: "border-box",
    border: `1px solid ${colors.border}`,
    borderLeftWidth: 4,
    borderLeftStyle: "solid",
    borderLeftColor: colors.accent,
    background: colors.background,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 12px rgba(0, 0, 0, 0.2)",
    minWidth: 0,
  };
}

function getAchievementSpotlightBackRowStyle(): CSSProperties {
  return {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    minWidth: 0,
  };
}

function getAchievementSpotlightHeaderStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 14,
    alignItems: "start",
    minWidth: 0,
  };
}

function getAchievementSpotlightBadgeFrameStyle(tone: AchievementSpotlightTone): CSSProperties {
  const colors = getAchievementSpotlightToneColors(tone);

  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 88,
    height: 88,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: 16,
    border: `1px solid ${colors.pillBorder}`,
    background: colors.pillBackground,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
    filter: tone === "locked" ? "grayscale(1) contrast(1.08) brightness(0.92)" : "none",
  };
}

function getAchievementSpotlightTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
  };
}

function getAchievementSpotlightTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1.24em",
    fontWeight: 800,
    lineHeight: 1.12,
    minWidth: 0,
    overflowWrap: "anywhere",
    whiteSpace: "normal",
  };
}

function getAchievementSpotlightDescriptionStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.84)",
    fontSize: "0.9em",
    lineHeight: 1.35,
    whiteSpace: "pre-wrap",
  };
}

function getAchievementSpotlightMetaRowStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, max-content))",
    gap: 8,
    alignItems: "center",
    justifyContent: "start",
  };
}

function getAchievementSpotlightMetaPillStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: "0.8em",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  };
}

function getAchievementSpotlightStatusStyle(tone: AchievementSpotlightTone): CSSProperties {
  const colors = getAchievementSpotlightToneColors(tone);

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    border: `1px solid ${colors.pillBorder}`,
    backgroundColor: colors.pillBackground,
    color: colors.statusLabel,
    fontSize: "0.8em",
    fontWeight: 800,
    letterSpacing: "0.02em",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  };
}

function getAchievementSpotlightSecondaryStyle(tone: AchievementSpotlightTone): CSSProperties {
  const colors = getAchievementSpotlightToneColors(tone);

  return {
    color: colors.secondary,
    fontSize: "0.8em",
    lineHeight: 1.25,
  };
}

function getAchievementSpotlightStatGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    width: "100%",
    alignItems: "stretch",
  };
}

function getAchievementSpotlightCountsGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    width: "100%",
    alignItems: "stretch",
  };
}

function getAchievementSpotlightRarityStackStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    width: "100%",
  };
}

function getAchievementSpotlightRarityLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.66)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    lineHeight: 1.2,
    textTransform: "uppercase",
  };
}

function getAchievementSpotlightRarityBarTrackStyle(): CSSProperties {
  return {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.06)",
  };
}

function getAchievementSpotlightRarityBarFillStyle(
  percent: number,
  tone: AchievementSpotlightTone,
): CSSProperties {
  const colors = getAchievementSpotlightToneColors(tone);

  return {
    width: `${Math.max(0, Math.min(100, percent))}%`,
    height: "100%",
    borderRadius: 999,
    background: `linear-gradient(90deg, ${colors.rarityBarStart}, ${colors.rarityBarEnd})`,
    transition: "width 120ms ease",
  };
}

function getAchievementSpotlightRarityBarCaptionStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.76)",
    fontSize: "0.84em",
    fontWeight: 700,
    lineHeight: 1.2,
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
  tone,
  style,
}: {
  readonly label: string;
  readonly value: string;
  readonly secondary?: string;
  readonly tone?: AchievementSpotlightTone;
  readonly style?: CSSProperties;
}): JSX.Element {
  const colors = tone !== undefined ? getAchievementSpotlightToneColors(tone) : undefined;

  return (
    <div
      style={{
        ...getStatStyle(),
        ...(colors !== undefined
          ? {
              border: `1px solid ${colors.statBorder}`,
              backgroundColor: colors.statBackground,
              boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 2px 8px rgba(0, 0, 0, 0.14)",
            }
          : {}),
        ...(style ?? {}),
      }}
    >
      <div style={colors !== undefined ? { ...getStatLabelStyle(), color: colors.statLabel } : getStatLabelStyle()}>
        {label}
      </div>
      <div style={colors !== undefined ? { ...getStatValueStyle(), color: colors.statValue } : getStatValueStyle()}>
        {value}
      </div>
      {secondary !== undefined ? <div style={getStatSecondaryStyle()}>{secondary}</div> : null}
    </div>
  );
}

function RarityBar({
  percent,
  tone,
  caption,
}: {
  readonly percent: number | undefined;
  readonly tone?: AchievementSpotlightTone;
  readonly caption?: string;
}): JSX.Element {
  const resolvedPercent = percent ?? 0;
  const resolvedCaption =
    caption ??
    (percent !== undefined
      ? tone !== undefined
        ? "Rarity"
        : `${resolvedPercent}% unlock rate`
      : "Unlock rate unavailable");

  return (
    <div style={getRarityBarFrameStyle()}>
      <div style={tone !== undefined ? getAchievementSpotlightRarityBarCaptionStyle() : getRarityBarCaptionStyle()}>
        {resolvedCaption}
      </div>
      <div
        aria-label="Achievement unlock rate"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={resolvedPercent}
        aria-valuetext={resolvedCaption}
        role="progressbar"
        style={tone !== undefined ? getAchievementSpotlightRarityBarTrackStyle() : getRarityBarTrackStyle()}
      >
        <div style={tone !== undefined ? getAchievementSpotlightRarityBarFillStyle(resolvedPercent, tone) : getRarityBarFillStyle(resolvedPercent)} />
      </div>
    </div>
  );
}

function AchievementSpotlightCard({
  game,
  achievement,
  providerLabel,
  backLabel,
  onBack,
}: {
  readonly game: GameDetailSnapshot["game"];
  readonly achievement: NormalizedAchievement;
  readonly providerLabel: string;
  readonly backLabel: string;
  readonly onBack: () => void;
}): JSX.Element {
  const tone = getAchievementSpotlightTone(achievement);
  const counts = getAchievementSpotlightCounts(achievement.metrics, game.metrics);
  const showCounts = hasAchievementCounts(counts);
  const unlockRatePercent = counts.unlockRatePercent;
  const unlockRateCaption = formatAchievementUnlockRatePercent(unlockRatePercent);
  const achievementStatus = buildAchievementStatus(achievement);
  const unlockTimestamp = achievement.hardcoreUnlockedAt ?? achievement.softcoreUnlockedAt ?? achievement.unlockedAt;
  const metaPills = dedupeDistinctLabels([providerLabel]);

  return (
    <PanelSection title="ACHIEVEMENT SPOTLIGHT">
      <PanelSectionRow>
        <div style={getAchievementSpotlightCardStyle(tone)}>
          <div style={getAchievementSpotlightBackRowStyle()}>
            <DeckyFullscreenActionRow>
              <DeckyFullscreenActionButton
                label={backLabel}
                isFullscreenBackAction
                onClick={() => {
                  onBack();
                }}
              />
            </DeckyFullscreenActionRow>
          </div>

          <div style={getAchievementSpotlightHeaderStyle()}>
            <div style={getAchievementSpotlightBadgeFrameStyle(tone)}>
              {achievement.badgeImageUrl !== undefined ? (
                <DeckyGameArtwork compact src={achievement.badgeImageUrl} size={88} title={achievement.title} />
              ) : (
                <span style={getAchievementSpotlightMetaPillStyle()}>
                  RA
                </span>
              )}
            </div>

            <div style={getAchievementSpotlightTextStyle()}>
              <div style={getAchievementSpotlightTitleStyle()}>{achievement.title}</div>
              <div style={getAchievementSpotlightDescriptionStyle()}>
                {getAchievementDescriptionText(achievement.description)}
              </div>
              <div style={getAchievementSpotlightMetaRowStyle()}>
                {metaPills.map((label) => (
                  <span key={label} style={getAchievementSpotlightMetaPillStyle()}>
                    {label}
                  </span>
                ))}
                <span style={getAchievementSpotlightStatusStyle(tone)}>{achievementStatus.value}</span>
              </div>
              {unlockTimestamp !== undefined ? (
                <div style={getAchievementSpotlightSecondaryStyle(tone)}>{`Unlocked on ${formatTimestamp(unlockTimestamp)}`}</div>
              ) : null}
            </div>
          </div>

          <div style={getAchievementSpotlightStatGridStyle()}>
            <AchievementStat
              label="Points"
              tone={tone}
              value={achievement.points !== undefined ? formatCount(achievement.points) : "-"}
            />
            <AchievementStat
              label="RetroPoints"
              tone={tone}
              value={getMetricValue(achievement.metrics, "true-ratio", "True Ratio") ?? "-"}
            />
          </div>

          <div style={getAchievementSpotlightRarityStackStyle()}>
            <div style={getAchievementSpotlightRarityLabelStyle()}>Unlock rate</div>
            <RarityBar percent={unlockRatePercent} tone={tone} caption={unlockRateCaption} />
          </div>

          {showCounts ? (
            <div style={getAchievementSpotlightCountsGridStyle()}>
              <AchievementStat
                label="Softcore unlocks"
                tone={tone}
                value={counts.softcoreUnlockCount !== undefined ? formatCount(counts.softcoreUnlockCount) : "-"}
              />
              <AchievementStat
                label="Hardcore unlocks"
                tone={tone}
                value={counts.hardcoreUnlockCount !== undefined ? formatCount(counts.hardcoreUnlockCount) : "-"}
              />
              <AchievementStat
                label="Total players"
                tone={tone}
                value={counts.totalPlayers !== undefined ? formatCount(counts.totalPlayers) : "-"}
              />
            </div>
          ) : null}
        </div>
      </PanelSectionRow>
    </PanelSection>
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

  if (!isSteamProvider) {
    return (
      <ScrollPanel>
        <TopAlignedScrollViewport
          scrollKey={`full-screen-achievement:${providerId ?? game.providerId}:${game.gameId}:${achievement.achievementId}`}
        >
          <div style={getPageFrameStyle()}>
            <AchievementSpotlightCard
              achievement={achievement}
              game={game}
              providerLabel={providerLabel}
              backLabel={backLabel}
              onBack={onBack}
            />
          </div>
        </TopAlignedScrollViewport>
      </ScrollPanel>
    );
  }

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
