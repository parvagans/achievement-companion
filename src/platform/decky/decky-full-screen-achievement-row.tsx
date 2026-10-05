import { useState, type CSSProperties, type FocusEventHandler } from "react";
import { Focusable, type GamepadEvent } from "@decky/ui";
import type { NormalizedAchievement } from "@core/domain";
import {
  formatProviderAchievementPointsText,
  formatProviderAchievementStatusText,
  getMetricValue,
  isSteamAchievementPresentationProvider,
} from "./decky-achievement-detail-helpers";
import { DeckyAchievementTypeBadge } from "./decky-achievement-type-badge";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { formatSteamHuntersPercentage } from "./decky-steam-hunters-presentation";
import { DeckySteamAchievementStatusIcon } from "./decky-steam-achievement-status-icon";
import type { SteamHuntersAchievement } from "../../providers/steamhunters";
import { steamRecipes, steamTheme } from "./steam-theme";

function formatTimestamp(epochMs: number): string {
  return new Date(epochMs).toLocaleString();
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
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 8px rgba(0, 0, 0, 0.15)",
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
    minWidth: 0,
    overflowWrap: "anywhere",
  };
}

function getAchievementRowTitleLineStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "4px 7px",
    minWidth: 0,
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

function formatSteamHuntersMetadata(achievement: SteamHuntersAchievement): string | undefined {
  const details = [
    achievement.obtainability !== "unknown"
      ? achievement.obtainability === "broken-but-obtainable"
        ? "Broken but obtainable"
        : achievement.obtainability === "conditionally-obtainable"
          ? "Conditional"
          : achievement.obtainability === "unobtainable"
            ? "Unobtainable"
            : "Obtainable"
      : undefined,
    achievement.points !== undefined ? `${achievement.points.toLocaleString()} SH pts` : undefined,
    achievement.localPercentage !== undefined ? `${formatSteamHuntersPercentage(achievement.localPercentage)} SH` : undefined,
  ].filter((value): value is string => value !== undefined);
  return details.length > 0 ? `SteamHunters · ${details.join(" · ")}` : undefined;
}

function getAchievementRowIconStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: 2,
  };
}

function getSteamAchievementCardStyle(achievement: NormalizedAchievement): CSSProperties {
  // The row rail marks earned points, while the status text marks completion.
  const accentColor = achievement.isUnlocked ? steamTheme.color.rewardGold : steamTheme.color.locked;

  return {
    ...steamRecipes.interactiveRow("fullscreen"),
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto minmax(150px, 0.24fr)",
    gap: 16,
    alignItems: "center",
    minWidth: 0,
    minHeight: 88,
    padding: "10px 16px 10px 14px",
    borderRadius: steamTheme.radius.large,
    border: `1px solid ${steamTheme.color.borderSubtle}`,
    borderLeft: `5px solid ${accentColor}`,
    background: steamTheme.surface.raised,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 2px 8px rgba(0, 0, 0, 0.16)",
    boxSizing: "border-box",
  };
}

function getSteamAchievementBadgeFrameStyle(isUnlocked: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: 9,
    border: `1px solid ${steamTheme.color.borderSubtle}`,
    backgroundColor: steamTheme.surface.interactive,
    opacity: isUnlocked ? 1 : 0.92,
    filter: isUnlocked ? "none" : "grayscale(1) contrast(1.08) brightness(0.9)",
  };
}

function getSteamAchievementBadgeFallbackStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: "1.4em",
    fontWeight: 800,
  };
}

function getSteamAchievementTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    minWidth: 0,
  };
}

function getSteamAchievementTitleStyle(): CSSProperties {
  return {
    ...steamRecipes.text("fullscreen", "title"),
    fontSize: "1em",
    fontWeight: 800,
    lineHeight: 1.15,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getSteamAchievementDescriptionStyle(): CSSProperties {
  return {
    ...steamRecipes.text("fullscreen", "body"),
    fontSize: "0.84em",
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  };
}

function getSteamAchievementMetricsStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  };
}

function getSteamAchievementMetricStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 94,
    minHeight: 44,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(255, 255, 255, 0.1)",
    background: "linear-gradient(180deg, rgba(255, 255, 255, 0.065), rgba(255, 255, 255, 0.035))",
    color: "rgba(255, 255, 255, 0.96)",
    fontSize: "0.94em",
    fontWeight: 800,
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  };
}

function getSteamAchievementStatusStyle(isUnlocked: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    columnGap: 9,
    alignItems: "center",
    minWidth: 0,
    color: isUnlocked ? steamTheme.color.unlocked : steamTheme.color.locked,
  };
}

function getSteamAchievementStatusTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
    fontSize: "0.92em",
    fontWeight: 800,
    lineHeight: 1.15,
    whiteSpace: "nowrap",
  };
}

function getSteamAchievementStatusDateStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.82)", fontSize: "0.84em", fontWeight: 600 };
}

function formatSteamAchievementRarity(
  achievement: NormalizedAchievement,
  steamHuntersAchievement: SteamHuntersAchievement | undefined,
): string {
  if (steamHuntersAchievement?.localPercentage !== undefined) {
    return formatSteamHuntersPercentage(steamHuntersAchievement.localPercentage);
  }

  const globalPercentage = Number(getMetricValue(achievement.metrics, "global-percent", "Global Unlock Rate"));
  return Number.isFinite(globalPercentage) ? `${Number(globalPercentage.toFixed(1))}%` : "—";
}

function formatSteamAchievementPoints(
  achievement: NormalizedAchievement,
  steamHuntersAchievement: SteamHuntersAchievement | undefined,
): string {
  const points = steamHuntersAchievement?.points ?? achievement.points;
  return points !== undefined ? `${points.toLocaleString()} pts` : "— pts";
}

function formatSteamAchievementUnlockDate(unlockedAt: number | undefined): string | undefined {
  return unlockedAt === undefined ? undefined : new Date(unlockedAt).toLocaleDateString();
}

export interface DeckyFullScreenAchievementRowProps {
  readonly achievement: NormalizedAchievement;
  readonly onOpenAchievementDetail: ((achievementId: string) => void) | undefined;
  readonly onBack: () => void;
  readonly onJumpToTop?: () => void;
  readonly steamHuntersAchievement: SteamHuntersAchievement | undefined;
  readonly onFocusAchievement?: (achievementId: string) => void;
}

function SteamAchievementRowContent({
  achievement,
  steamHuntersAchievement,
}: {
  readonly achievement: NormalizedAchievement;
  readonly steamHuntersAchievement: SteamHuntersAchievement | undefined;
}): JSX.Element {
  const unlockedDate = formatSteamAchievementUnlockDate(achievement.unlockedAt);

  return (
    <>
      <span style={getSteamAchievementBadgeFrameStyle(achievement.isUnlocked)}>
        {achievement.badgeImageUrl !== undefined ? (
          <DeckyGameArtwork compact src={achievement.badgeImageUrl} size={72} title={achievement.title} />
        ) : (
          <span style={getSteamAchievementBadgeFallbackStyle()}>?</span>
        )}
      </span>
      <span style={getSteamAchievementTextStyle()}>
        <span style={getSteamAchievementTitleStyle()}>{achievement.title}</span>
        {achievement.description !== undefined ? (
          <span style={getSteamAchievementDescriptionStyle()}>{achievement.description}</span>
        ) : null}
      </span>
      <span aria-label={`${formatSteamAchievementPoints(achievement, steamHuntersAchievement)}, ${formatSteamAchievementRarity(achievement, steamHuntersAchievement)} rarity`} style={getSteamAchievementMetricsStyle()}>
        <span style={getSteamAchievementMetricStyle()}>{formatSteamAchievementPoints(achievement, steamHuntersAchievement)}</span>
        <span style={getSteamAchievementMetricStyle()}>{formatSteamAchievementRarity(achievement, steamHuntersAchievement)}</span>
      </span>
      <span style={getSteamAchievementStatusStyle(achievement.isUnlocked)}>
        <DeckySteamAchievementStatusIcon isUnlocked={achievement.isUnlocked} />
        <span style={getSteamAchievementStatusTextStyle()}>
          <span>{achievement.isUnlocked ? "Unlocked" : "Locked"}</span>
          {achievement.isUnlocked && unlockedDate !== undefined ? (
            <span style={getSteamAchievementStatusDateStyle()}>{unlockedDate}</span>
          ) : null}
        </span>
      </span>
    </>
  );
}

export function DeckyFullScreenAchievementRow({
  achievement,
  onOpenAchievementDetail,
  onBack,
  onJumpToTop,
  steamHuntersAchievement,
  onFocusAchievement,
}: DeckyFullScreenAchievementRowProps): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const isSteamProvider = isSteamAchievementPresentationProvider(achievement.providerId);
  const statusText = formatProviderAchievementStatusText(achievement.providerId, achievement);
  const pointsText = formatProviderAchievementPointsText(achievement.providerId, achievement.points);
  const unlockedAt = achievement.unlockedAt;
  const steamHuntersMetadata = steamHuntersAchievement !== undefined
    ? formatSteamHuntersMetadata(steamHuntersAchievement)
    : undefined;
  const openAchievementDetail = (): void => {
    if (onOpenAchievementDetail !== undefined) {
      onOpenAchievementDetail(achievement.achievementId);
    }
  };

  return (
    <Focusable
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      noFocusRing
      role="button"
      aria-label={`${achievement.title} achievement detail`}
      onActivate={openAchievementDetail}
      onClick={openAchievementDetail}
      onCancel={onBack}
      {...(onJumpToTop !== undefined
        ? {
            onOptionsActionDescription: "Top",
            onOptionsButton: (event: GamepadEvent): void => {
              event.preventDefault();
              event.stopPropagation();
              onJumpToTop();
            },
          }
        : {})}
      onFocus={(event: Parameters<FocusEventHandler<HTMLElement>>[0]) => {
        setIsFocused(true);
        onFocusAchievement?.(achievement.achievementId);
        scrollDeckyFocusTargetIntoView(event.currentTarget);
      }}
      onGamepadFocus={(event) => {
        setIsFocused(true);
        onFocusAchievement?.(achievement.achievementId);
        scrollDeckyFocusTargetIntoView(event.currentTarget);
      }}
      onBlur={() => {
        setIsFocused(false);
      }}
      style={{
        ...(isSteamProvider ? getSteamAchievementCardStyle(achievement) : getAchievementCardStyle(achievement)),
        outline: isFocused ? "2px solid rgba(69, 148, 255, 0.8)" : "none",
        outlineOffset: 1,
        ...(isFocused
          ? { boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 0 1px rgba(69, 148, 255, 0.55), 0 4px 14px rgba(0, 0, 0, 0.22)" }
          : {}),
      }}
      data-achievement-companion-steam-achievement-id={isSteamProvider ? achievement.achievementId : undefined}
    >
      {isSteamProvider ? (
        <SteamAchievementRowContent achievement={achievement} steamHuntersAchievement={steamHuntersAchievement} />
      ) : (
        <>
          <span style={getAchievementRowIconStyle()}>
            {achievement.badgeImageUrl !== undefined ? (
              <AchievementBadgeIcon achievement={achievement} />
            ) : null}
          </span>

          <span style={getAchievementRowTextStyle()}>
            <span style={getAchievementRowTitleLineStyle()}>
              <span style={getAchievementRowTitleStyle()}>{achievement.title}</span>
              <DeckyAchievementTypeBadge classification={achievement.classification} />
            </span>
            <span style={getAchievementRowMetadataStackStyle()}>
              <span style={getAchievementRowStatusStyle(achievement)}>{statusText}</span>
              {pointsText !== undefined ? (
                <span style={getAchievementRowDetailStyle()}>{pointsText}</span>
              ) : null}
              {steamHuntersMetadata !== undefined ? (
                <span style={getAchievementRowDetailStyle()}>{steamHuntersMetadata}</span>
              ) : null}
              {unlockedAt !== undefined ? (
                <span style={getAchievementRowDetailStyle()}>Unlocked {formatTimestamp(unlockedAt)}</span>
              ) : null}
            </span>
          </span>
        </>
      )}
    </Focusable>
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
