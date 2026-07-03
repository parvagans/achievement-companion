import { useMemo, useState, type CSSProperties } from "react";
import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import { Focusable, PanelSection, PanelSectionRow, ScrollPanel } from "@decky/ui";
import { PlaceholderState } from "@ui/PlaceholderState";
import { initialDeckyGameDetailState, loadDeckyGameDetailState } from "./decky-app-services";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { getSteamFullscreenGameArtworkUrl } from "./decky-steam-game-artwork";
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
  readonly onOpenFullScreenGame?: (() => void) | undefined;
  readonly backLabel?: string;
  readonly backDescription?: string;
}

const FULLSCREEN_ACHIEVEMENT_PAGE_BOTTOM_SCROLL_PADDING = 88;
const FULLSCREEN_ACHIEVEMENT_SPOTLIGHT_TOP_PADDING = 80;
const FULLSCREEN_ACHIEVEMENT_SPOTLIGHT_BOTTOM_PADDING = 20;

function getPageFrameStyle(): CSSProperties {
  return {
    padding: `calc(env(safe-area-inset-top, 0px) + 12px) 12px calc(env(safe-area-inset-bottom, 0px) + ${FULLSCREEN_ACHIEVEMENT_PAGE_BOTTOM_SCROLL_PADDING}px)`,
    boxSizing: "border-box",
  };
}

function getAchievementSpotlightPageFrameStyle(): CSSProperties {
  return {
    padding: `calc(env(safe-area-inset-top, 0px) + ${FULLSCREEN_ACHIEVEMENT_SPOTLIGHT_TOP_PADDING}px) 12px calc(env(safe-area-inset-bottom, 0px) + ${FULLSCREEN_ACHIEVEMENT_SPOTLIGHT_BOTTOM_PADDING}px)`,
    boxSizing: "border-box",
  };
}

function getAchievementSpotlightPageRailStyle(): CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
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

function getSteamAchievementSpotlightCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    boxSizing: "border-box",
    border: "1px solid rgba(105, 176, 255, 0.24)",
    borderLeftWidth: 4,
    borderLeftStyle: "solid",
    borderLeftColor: "rgba(105, 176, 255, 0.9)",
    background:
      "linear-gradient(180deg, rgba(20, 27, 40, 0.96), rgba(13, 18, 28, 0.98))",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 12px rgba(0, 0, 0, 0.2)",
    minWidth: 0,
  };
}

function getSteamAchievementSpotlightBackRowStyle(): CSSProperties {
  return {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "center",
    minWidth: 0,
    padding: "1px 2px 0",
  };
}

function getSteamAchievementSpotlightBodyStyle(hasGameArtwork: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: hasGameArtwork ? "minmax(0, 1.1fr) minmax(200px, 0.9fr)" : "minmax(0, 1fr)",
    gap: 16,
    alignItems: "start",
    minWidth: 0,
  };
}

function getSteamAchievementSpotlightMainStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    minWidth: 0,
  };
}

function getSteamAchievementSpotlightIdentityStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 14,
    alignItems: "start",
    minWidth: 0,
  };
}

function getSteamAchievementSpotlightIconFrameStyle(isUnlocked: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 104,
    height: 104,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.1)",
    background: "rgba(255, 255, 255, 0.04)",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
    opacity: isUnlocked ? 1 : 0.94,
    filter: isUnlocked ? "none" : "grayscale(1) contrast(1.1) brightness(0.92)",
  };
}

function getSteamAchievementSpotlightTitleBlockStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
  };
}

function getSteamAchievementSpotlightHeroLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.74em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    lineHeight: 1.2,
    textTransform: "uppercase",
  };
}

function getSteamAchievementSpotlightMetaRowStyle(): CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  };
}

function getSteamAchievementSpotlightGameCoverFrameStyle(interactive: boolean, focused: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "start",
    width: "100%",
    maxWidth: 272,
    aspectRatio: "460 / 215",
    padding: 10,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.1)",
    background:
      "radial-gradient(circle at top, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02) 52%, rgba(0, 0, 0, 0.18))",
    boxShadow: focused
      ? "0 0 0 2px rgba(73, 155, 255, 0.72), 0 0 18px rgba(39, 124, 226, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.14)"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 4px 16px rgba(0, 0, 0, 0.2)",
    boxSizing: "border-box",
    overflow: "hidden",
    cursor: interactive ? "pointer" : "default",
    transition: "border-color 120ms ease, box-shadow 120ms ease, background 120ms ease",
    outline: "none",
    borderColor: focused ? "rgba(105, 176, 255, 0.8)" : "rgba(255, 255, 255, 0.1)",
  };
}

function getSteamAchievementSpotlightArtworkStackStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  };
}

function getSteamAchievementSpotlightGameCoverImageStyle(): CSSProperties {
  return {
    display: "block",
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "cover",
    objectPosition: "center center",
  };
}

function getSteamAchievementSpotlightGameCoverFallbackStyle(): CSSProperties {
  return {
    display: "flex",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(160deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03))",
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: "1em",
    fontWeight: 700,
    letterSpacing: "0.06em",
  };
}

function getSteamAchievementSpotlightGameCoverCaptionStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.8em",
    fontWeight: 700,
    lineHeight: 1.2,
    textAlign: "center",
  };
}

function getSteamAchievementSpotlightStatsGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 8,
    width: "100%",
    alignItems: "stretch",
  };
}

function getSteamAchievementSpotlightStatStyle(): CSSProperties {
  return {
    padding: "8px 10px",
  };
}

function getSteamArtworkFallbackInitials(title: string): string {
  const words = title
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "AC";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
    .trim() || "AC";
}

function SteamAchievementSpotlightArtwork({
  src,
  title,
}: {
  readonly src: string;
  readonly title: string;
}): JSX.Element {
  const [hasImageError, setHasImageError] = useState(false);

  return hasImageError ? (
    <span style={getSteamAchievementSpotlightGameCoverFallbackStyle()}>{getSteamArtworkFallbackInitials(title)}</span>
  ) : (
    <img
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      src={src}
      onError={() => {
        setHasImageError(true);
      }}
      style={getSteamAchievementSpotlightGameCoverImageStyle()}
    />
  );
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
    gap: 12,
    padding: 14,
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
    marginBottom: -2,
  };
}

function getAchievementSpotlightHeaderStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    gap: 12,
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
    gap: 7,
    minWidth: 0,
  };
}

function getAchievementSpotlightTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1.18em",
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
    fontSize: "0.86em",
    lineHeight: 1.3,
    whiteSpace: "pre-wrap",
  };
}

function getAchievementSpotlightMetaRowStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, max-content))",
    gap: 7,
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

function getAchievementSpotlightGameCoverFrameStyle(
  interactive: boolean,
  focused: boolean,
): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "start",
    width: "clamp(170px, 19vw, 196px)",
    height: "clamp(96px, 12vw, 116px)",
    maxWidth: 196,
    maxHeight: 116,
    minWidth: 170,
    minHeight: 96,
    overflow: "hidden",
    borderRadius: 16,
    border: "1px solid rgba(255, 255, 255, 0.1)",
    background: "linear-gradient(180deg, rgba(12, 16, 24, 0.9), rgba(22, 28, 38, 0.82))",
    boxShadow: focused
      ? "0 0 0 2px rgba(73, 155, 255, 0.72), 0 0 18px rgba(39, 124, 226, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.14)"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
    padding: 8,
    boxSizing: "border-box",
    cursor: interactive ? "pointer" : "default",
    transition: "border-color 120ms ease, box-shadow 120ms ease, background 120ms ease",
    outline: "none",
    borderColor: focused ? "rgba(105, 176, 255, 0.8)" : "rgba(255, 255, 255, 0.1)",
  };
}

function getAchievementSpotlightGameCoverImageStyle(): CSSProperties {
  return {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "contain",
  };
}

function getAchievementSpotlightStatGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 6,
    width: "100%",
    alignItems: "stretch",
  };
}

function getAchievementSpotlightCountsGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 6,
    width: "100%",
    alignItems: "stretch",
  };
}

function getAchievementSpotlightRarityStackStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 5,
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
    gap: 2,
    padding: "9px 10px",
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
    fontSize: "0.94em",
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
    fontSize: "0.78em",
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
  gameArtworkUrl,
  providerLabel,
  backLabel,
  onBack,
  onOpenFullScreenGame,
}: {
  readonly game: GameDetailSnapshot["game"];
  readonly achievement: NormalizedAchievement;
  readonly gameArtworkUrl: string | undefined;
  readonly providerLabel: string;
  readonly backLabel: string;
  readonly onBack: () => void;
  readonly onOpenFullScreenGame: (() => void) | undefined;
}): JSX.Element {
  const [isGameCoverFocused, setIsGameCoverFocused] = useState(false);
  const tone = getAchievementSpotlightTone(achievement);
  const counts = getAchievementSpotlightCounts(achievement.metrics, game.metrics);
  const showCounts = hasAchievementCounts(counts);
  const unlockRatePercent = counts.unlockRatePercent;
  const unlockRateCaption = formatAchievementUnlockRatePercent(unlockRatePercent);
  const achievementStatus = buildAchievementStatus(achievement);
  const unlockTimestamp = achievement.hardcoreUnlockedAt ?? achievement.softcoreUnlockedAt ?? achievement.unlockedAt;
  const metaPills = dedupeDistinctLabels([providerLabel]);

  return (
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

        {gameArtworkUrl !== undefined && onOpenFullScreenGame !== undefined ? (
          <Focusable
            noFocusRing
            role="button"
            aria-label={`Open game details for ${game.title}`}
            onActivate={onOpenFullScreenGame}
            onClick={onOpenFullScreenGame}
            onFocus={() => {
              setIsGameCoverFocused(true);
            }}
            onBlur={() => {
              setIsGameCoverFocused(false);
            }}
            onGamepadFocus={() => {
              setIsGameCoverFocused(true);
            }}
            style={getAchievementSpotlightGameCoverFrameStyle(true, isGameCoverFocused)}
          >
            <img
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              src={gameArtworkUrl}
              style={getAchievementSpotlightGameCoverImageStyle()}
            />
          </Focusable>
        ) : gameArtworkUrl !== undefined ? (
          <div style={getAchievementSpotlightGameCoverFrameStyle(false, false)}>
            <img
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              src={gameArtworkUrl}
              style={getAchievementSpotlightGameCoverImageStyle()}
            />
          </div>
        ) : null}
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
  );
}

function SteamAchievementSpotlightCard({
  game,
  achievement,
  gameArtworkUrl,
  heroLabel,
  providerLabel,
  achievementStatusLabel,
  metaPills,
  backLabel,
  onBack,
  onOpenFullScreenGame,
}: {
  readonly game: GameDetailSnapshot["game"];
  readonly achievement: NormalizedAchievement;
  readonly gameArtworkUrl: string | undefined;
  readonly heroLabel: string;
  readonly providerLabel: string;
  readonly achievementStatusLabel: string;
  readonly metaPills: readonly string[];
  readonly backLabel: string;
  readonly onBack: () => void;
  readonly onOpenFullScreenGame: (() => void) | undefined;
}): JSX.Element {
  const [isGameArtworkFocused, setIsGameArtworkFocused] = useState(false);
  const unlockTimestamp = achievement.unlockedAt;
  const unlockRatePercent = getUnlockRatePercent(achievement);
  const unlockRateCaption = unlockRatePercent !== undefined ? formatAchievementUnlockRatePercent(unlockRatePercent) : undefined;
  const hasInteractiveGameArtwork = gameArtworkUrl !== undefined && onOpenFullScreenGame !== undefined;
  const showUnlockDate = unlockTimestamp !== undefined;

  return (
    <div style={getSteamAchievementSpotlightCardStyle()}>
      <div style={getSteamAchievementSpotlightBackRowStyle()}>
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

      <div style={getSteamAchievementSpotlightBodyStyle(hasInteractiveGameArtwork)}>
        <div style={getSteamAchievementSpotlightMainStyle()}>
          <div style={getSteamAchievementSpotlightIdentityStyle()}>
            {achievement.badgeImageUrl !== undefined ? (
              <span style={getSteamAchievementSpotlightIconFrameStyle(achievement.isUnlocked)}>
                <DeckyGameArtwork compact src={achievement.badgeImageUrl} size={104} title={achievement.title} />
              </span>
            ) : (
              <span style={getSteamAchievementSpotlightIconFrameStyle(achievement.isUnlocked)}>
                <span style={getSteamAchievementSpotlightGameCoverFallbackStyle()}>{providerLabel}</span>
              </span>
            )}

            <div style={getSteamAchievementSpotlightTitleBlockStyle()}>
              <div style={getSteamAchievementSpotlightHeroLabelStyle()}>{heroLabel}</div>
              <div style={getAchievementSpotlightTitleStyle()}>{achievement.title}</div>
              <div style={getSteamAchievementSpotlightMetaRowStyle()}>
                {metaPills.map((label) => (
                  <span key={label} style={getAchievementSpotlightMetaPillStyle()}>
                    {label}
                  </span>
                ))}
              </div>
              <div style={getAchievementSpotlightDescriptionStyle()}>{getAchievementDescriptionText(achievement.description)}</div>
            </div>
          </div>
        </div>

        {gameArtworkUrl !== undefined ? (
          <div style={getSteamAchievementSpotlightArtworkStackStyle()}>
            {hasInteractiveGameArtwork ? (
              <Focusable
                noFocusRing
                role="button"
                aria-label={`Open game overview for ${game.title}`}
                onActivate={onOpenFullScreenGame}
                onClick={onOpenFullScreenGame}
                onFocus={() => {
                  setIsGameArtworkFocused(true);
                }}
                onBlur={() => {
                  setIsGameArtworkFocused(false);
                }}
                onGamepadFocus={() => {
                  setIsGameArtworkFocused(true);
                }}
                style={getSteamAchievementSpotlightGameCoverFrameStyle(true, isGameArtworkFocused)}
              >
                <SteamAchievementSpotlightArtwork src={gameArtworkUrl} title={game.title} />
              </Focusable>
            ) : (
              <div style={getSteamAchievementSpotlightGameCoverFrameStyle(false, false)}>
                <SteamAchievementSpotlightArtwork src={gameArtworkUrl} title={game.title} />
              </div>
            )}
            <div style={getSteamAchievementSpotlightGameCoverCaptionStyle()}>
              {onOpenFullScreenGame !== undefined ? "Open game overview" : game.title}
            </div>
          </div>
        ) : null}
      </div>

      <div style={getSteamAchievementSpotlightStatsGridStyle()}>
        <AchievementStat
          label="Status"
          value={achievementStatusLabel}
          style={getSteamAchievementSpotlightStatStyle()}
        />
        {showUnlockDate ? (
          <AchievementStat
            label="Unlock date"
            value={formatTimestamp(unlockTimestamp)}
            style={getSteamAchievementSpotlightStatStyle()}
          />
        ) : null}
        {unlockRateCaption !== undefined ? (
          <AchievementStat
            label="Global unlock rate"
            value={unlockRateCaption}
            style={getSteamAchievementSpotlightStatStyle()}
          />
        ) : null}
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
  onOpenFullScreenGame,
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
  const steamHeroArtworkUrl = getSteamFullscreenGameArtworkUrl(game);
  const providerLabel = formatDeckyProviderLabel(providerId ?? game.providerId);
  const isSteamProvider = shouldHideSteamAchievementDetailStats(providerId ?? game.providerId);
  const heroLabel = isSteamProvider ? resolveSteamAchievementHeroLabel(game) : "Selected achievement";
  const counts = getAchievementCounts(achievement.metrics);
  const showCounts = hasAchievementCounts(counts);
  const unlockRatePercent = getUnlockRatePercent(achievement);
  const achievementStatus = buildAchievementStatus(achievement);
  const snapshotSourceLabel = state.status === "stale" ? "Cached snapshot" : "Live snapshot";
  const steamMetaPills = dedupeDistinctLabels([providerLabel, snapshotSourceLabel, achievementStatus.value]);

  if (!isSteamProvider) {
    return (
      <ScrollPanel>
        <TopAlignedScrollViewport
          scrollKey={`full-screen-achievement:${providerId ?? game.providerId}:${game.gameId}:${achievement.achievementId}`}
        >
          <div style={getAchievementSpotlightPageFrameStyle()}>
            <div style={getAchievementSpotlightPageRailStyle()}>
              <AchievementSpotlightCard
                achievement={achievement}
                game={game}
                gameArtworkUrl={heroArtworkUrl}
                providerLabel={providerLabel}
                backLabel={backLabel}
                onBack={onBack}
                onOpenFullScreenGame={onOpenFullScreenGame}
              />
            </div>
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
        <div style={getAchievementSpotlightPageFrameStyle()}>
          <div style={getAchievementSpotlightPageRailStyle()}>
            <SteamAchievementSpotlightCard
              achievement={achievement}
              backLabel={backLabel}
              heroLabel={heroLabel}
              game={game}
              gameArtworkUrl={steamHeroArtworkUrl}
              achievementStatusLabel={achievementStatus.value}
              onBack={onBack}
              onOpenFullScreenGame={onOpenFullScreenGame}
              providerLabel={providerLabel}
              metaPills={steamMetaPills}
            />
          </div>
        </div>
      </TopAlignedScrollViewport>
    </ScrollPanel>
  );
}
