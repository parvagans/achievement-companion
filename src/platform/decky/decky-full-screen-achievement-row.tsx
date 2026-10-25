import { useState, type CSSProperties, type FocusEventHandler } from "react";
import { Focusable, type GamepadEvent } from "@decky/ui";
import type { NormalizedAchievement, NormalizedMetric } from "@core/domain";
import {
  getAchievementDetailCounts,
  formatProviderAchievementPointsText,
  formatProviderAchievementStatusText,
  isSteamAchievementPresentationProvider,
} from "./decky-achievement-detail-helpers";
import { DeckyAchievementTypeBadge } from "./decky-achievement-type-badge";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { formatSteamHuntersPercentage } from "./decky-steam-hunters-presentation";
import { DeckySteamAchievementStatusIcon } from "./decky-steam-achievement-status-icon";
import { DeckyRetroAchievementsPointsIcon } from "./decky-retroachievements-points-icon";
import { DeckySteamHuntersIcon } from "./decky-steam-icons";
import { getSteamAchievementCommunityPercent } from "./decky-achievement-row-presentation";
import type { SteamHuntersAchievement } from "../../providers/steamhunters";
import { steamRecipes, steamTheme } from "./steam-theme";
import { raRecipes, raTheme } from "./ra-theme";
import { achievementCompanionAchievementRowRecipes, achievementCompanionQamTheme } from "./decky-qam-theme";

// Full-screen lists reserve room for their filters and native footer. Artwork
// stays large enough to identify while a two-line description sets row height.
const FULLSCREEN_ACHIEVEMENT_ARTWORK_SIZE = 48;

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

function getAchievementCardStyle(achievement: NormalizedAchievement, gamePageGradient: boolean): CSSProperties {
  const isHardcore = achievement.isUnlocked && achievement.unlockMode === "hardcore";
  const isSoftcore = achievement.isUnlocked && achievement.unlockMode === "softcore";
  const accentColor = isHardcore
    ? raTheme.color.hardcore
    : isSoftcore
      ? raTheme.color.softcore
      : raTheme.color.borderSubtle;
  const accentBackground = isHardcore
    ? raTheme.surface.hardcore
    : isSoftcore
      ? raTheme.surface.softcore
      : raTheme.surface.locked;

  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 12,
    minWidth: 0,
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: raTheme.radius.large,
    border: `1px solid ${accentColor}`,
    borderLeftWidth: 4,
    borderLeftStyle: "solid",
    borderLeftColor: accentColor,
    background: gamePageGradient
      ? `linear-gradient(180deg, ${accentBackground}, ${accentBackground}), ${raTheme.surface.contentCard}`
      : accentBackground,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 8px rgba(0, 0, 0, 0.15)",
  };
}

function getSteamShapedRetroAchievementCardStyle(achievement: NormalizedAchievement): CSSProperties {
  const isHardcore = achievement.isUnlocked && achievement.unlockMode === "hardcore";
  const isSoftcore = achievement.isUnlocked && achievement.unlockMode === "softcore";
  const accentColor = isHardcore
    ? raTheme.color.hardcore
    : isSoftcore
      ? raTheme.color.softcore
      : raTheme.color.locked;
  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) minmax(150px, auto)",
    gap: achievementCompanionQamTheme.space.md,
    alignItems: "center",
    minWidth: 0,
    minHeight: 66,
    padding: "8px 12px",
    borderRadius: raTheme.radius.large,
    ...achievementCompanionAchievementRowRecipes.surface("fullscreen", accentColor),
    boxSizing: "border-box",
  };
}

function getSteamShapedRetroAchievementBadgeFrameStyle(isUnlocked: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: FULLSCREEN_ACHIEVEMENT_ARTWORK_SIZE,
    height: FULLSCREEN_ACHIEVEMENT_ARTWORK_SIZE,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: raTheme.radius.medium,
    border: `1px solid ${raTheme.color.borderSubtle}`,
    backgroundColor: raTheme.surface.interactive,
    opacity: isUnlocked ? 1 : 0.92,
    filter: isUnlocked ? "none" : raRecipes.achievementState.locked.artworkFilter,
  };
}

function getSteamShapedRetroAchievementTextStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: achievementCompanionQamTheme.space.xs, minWidth: 0 };
}

function getSteamShapedRetroAchievementTitleStyle(): CSSProperties {
  return {
    ...raRecipes.text("fullscreen", "title"),
    fontWeight: raTheme.type.weight.strong,
    lineHeight: 1.15,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getSteamShapedRetroAchievementDescriptionStyle(): CSSProperties {
  return {
    ...raRecipes.text("fullscreen", "body"),
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  };
}

function getSteamShapedRetroAchievementModeColor(achievement: NormalizedAchievement): string {
  const color = achievement.isUnlocked
    ? achievement.unlockMode === "hardcore"
      ? raTheme.color.hardcore
      : achievement.unlockMode === "softcore"
        ? raTheme.color.softcore
        : raTheme.color.unlocked
    : raTheme.color.locked;
  return color;
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
    color: raTheme.color.textPrimary,
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
      ? raTheme.color.hardcore
      : isSoftcore
        ? raTheme.color.softcore
        : raTheme.color.textSecondary,
    fontSize: "0.8em",
    fontWeight: 800,
    lineHeight: 1.2,
  };
}

function getAchievementRowDetailStyle(): CSSProperties {
  return {
    color: raTheme.color.textSecondary,
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
  const accentColor = achievement.isUnlocked ? steamTheme.color.unlocked : steamTheme.color.locked;

  return {
    ...steamRecipes.interactiveRow("fullscreen"),
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) minmax(150px, auto)",
    gap: achievementCompanionQamTheme.space.md,
    alignItems: "center",
    minWidth: 0,
    minHeight: 66,
    padding: "8px 12px",
    borderRadius: steamTheme.radius.large,
    ...achievementCompanionAchievementRowRecipes.surface("fullscreen", accentColor),
    boxSizing: "border-box",
  };
}

function getSteamAchievementBadgeFrameStyle(isUnlocked: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: FULLSCREEN_ACHIEVEMENT_ARTWORK_SIZE,
    height: FULLSCREEN_ACHIEVEMENT_ARTWORK_SIZE,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: steamTheme.radius.medium,
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
    gap: achievementCompanionQamTheme.space.xs,
    minWidth: 0,
  };
}

function getSteamAchievementTitleStyle(): CSSProperties {
  return {
    ...steamRecipes.text("fullscreen", "title"),
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
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  };
}

function formatSteamAchievementPoints(
  achievement: NormalizedAchievement,
  steamHuntersAchievement: SteamHuntersAchievement | undefined,
): string | undefined {
  const points = steamHuntersAchievement?.points ?? achievement.points;
  return points !== undefined ? `${points.toLocaleString()} pts` : undefined;
}

function formatSteamAchievementUnlockDate(unlockedAt: number | undefined): string | undefined {
  return unlockedAt === undefined ? undefined : new Date(unlockedAt).toLocaleDateString();
}

function AchievementRowRail({
  statusText,
  statusColor,
  isUnlocked,
  pointsText,
  pointsIcon,
  rarityPercent,
  unlockedDate,
}: {
  readonly statusText: string;
  readonly statusColor: string;
  readonly isUnlocked: boolean;
  readonly pointsText?: string | undefined;
  readonly pointsIcon?: JSX.Element | undefined;
  readonly rarityPercent?: number | undefined;
  readonly unlockedDate?: string | undefined;
}): JSX.Element {
  const labels = [statusText, pointsText, rarityPercent === undefined ? undefined : `${Math.round(rarityPercent)}% players`, unlockedDate]
    .filter((value): value is string => value !== undefined);
  return (
    <span aria-label={labels.join(", ")} style={{ ...achievementCompanionAchievementRowRecipes.rail("fullscreen"), gap: achievementCompanionQamTheme.space.xs }}>
      <span style={achievementCompanionAchievementRowRecipes.railHeader}>
        {pointsText !== undefined ? <span style={achievementCompanionAchievementRowRecipes.points("fullscreen")}>{pointsIcon}{pointsText}</span> : null}
        <span style={achievementCompanionAchievementRowRecipes.status("fullscreen", statusColor)}>{statusText}</span>
        <DeckySteamAchievementStatusIcon isUnlocked={isUnlocked} />
      </span>
      {rarityPercent !== undefined ? (
        <span style={{ ...achievementCompanionAchievementRowRecipes.rarity.root("fullscreen"), flexDirection: "row", alignItems: "center", gap: achievementCompanionQamTheme.space.xs, width: 150 }}>
          <span aria-hidden="true" style={{ ...achievementCompanionAchievementRowRecipes.rarity.track("fullscreen"), flex: 1 }}>
            <span style={{ ...achievementCompanionAchievementRowRecipes.rarity.fill(rarityPercent), display: "block" }} />
          </span>
          <span style={achievementCompanionAchievementRowRecipes.rarity.label("fullscreen")}>{`${Math.round(rarityPercent)}% players`}</span>
        </span>
      ) : null}
      {unlockedDate !== undefined ? <span style={achievementCompanionAchievementRowRecipes.date}>{unlockedDate}</span> : null}
    </span>
  );
}

export interface DeckyFullScreenAchievementRowProps {
  readonly achievement: NormalizedAchievement;
  readonly onOpenAchievementDetail: ((achievementId: string) => void) | undefined;
  readonly onBack: () => void;
  readonly onJumpToTop?: () => void;
  readonly steamHuntersAchievement: SteamHuntersAchievement | undefined;
  readonly onFocusAchievement?: (achievementId: string) => void;
  readonly gameMetrics?: readonly NormalizedMetric[];
  readonly retroAchievementsPresentation?: "default" | "steam-shaped";
  readonly gamePageGradient?: boolean;
}

function SteamAchievementRowContent({
  achievement,
  steamHuntersAchievement,
}: {
  readonly achievement: NormalizedAchievement;
  readonly steamHuntersAchievement: SteamHuntersAchievement | undefined;
}): JSX.Element {
  const pointsText = formatSteamAchievementPoints(achievement, steamHuntersAchievement);
  const rarityPercent = getSteamAchievementCommunityPercent(achievement, steamHuntersAchievement);
  const unlockedDate = formatSteamAchievementUnlockDate(achievement.unlockedAt);
  const availability = steamHuntersAchievement?.obtainability;
  const restriction = availability === "unobtainable" ? "Unobtainable"
    : availability === "conditionally-obtainable" ? "Conditional"
      : availability === "broken-but-obtainable" ? "Broken but obtainable" : undefined;

  return (
    <>
      <span style={getSteamAchievementBadgeFrameStyle(achievement.isUnlocked)}>
        {achievement.badgeImageUrl !== undefined ? (
          <DeckyGameArtwork compact src={achievement.badgeImageUrl} size={FULLSCREEN_ACHIEVEMENT_ARTWORK_SIZE} title={achievement.title} />
        ) : (
          <span style={getSteamAchievementBadgeFallbackStyle()}>?</span>
        )}
      </span>
      <span style={getSteamAchievementTextStyle()}>
        <span title={achievement.title} style={getSteamAchievementTitleStyle()}>{achievement.title}</span>
        {achievement.description !== undefined ? (
          <span style={getSteamAchievementDescriptionStyle()}>{achievement.description}</span>
        ) : null}
        {restriction !== undefined ? <span style={{ ...steamRecipes.text("fullscreen", "caption"), color: availability === "unobtainable" ? achievementCompanionQamTheme.color.danger : achievementCompanionQamTheme.color.warning }}>{restriction}</span> : null}
      </span>
      <AchievementRowRail
        statusText={achievement.isUnlocked ? "Unlocked" : "Locked"}
        statusColor={achievement.isUnlocked ? steamTheme.color.unlocked : steamTheme.color.locked}
        isUnlocked={achievement.isUnlocked}
        pointsText={pointsText}
        pointsIcon={pointsText !== undefined ? <DeckySteamHuntersIcon color={steamTheme.color.accent} size={13} /> : undefined}
        rarityPercent={rarityPercent}
        unlockedDate={achievement.isUnlocked ? unlockedDate : undefined}
      />
    </>
  );
}

function SteamShapedRetroAchievementRowContent({
  achievement,
  gameMetrics,
}: {
  readonly achievement: NormalizedAchievement;
  readonly gameMetrics: readonly NormalizedMetric[];
}): JSX.Element {
  const pointsText = achievement.points !== undefined
    ? formatProviderAchievementPointsText(achievement.providerId, achievement.points)
    : undefined;
  const counts = getAchievementDetailCounts(achievement.metrics, gameMetrics);
  const rarityPercent = counts.unlockRatePercent;
  const unlockedDate = achievement.isUnlocked && achievement.unlockedAt !== undefined
    ? formatSteamAchievementUnlockDate(achievement.unlockedAt)
    : undefined;
  const statusText = formatProviderAchievementStatusText(achievement.providerId, achievement);
  const modeText = achievement.isUnlocked && achievement.unlockMode !== undefined
    ? achievement.unlockMode === "hardcore" ? "Hardcore" : "Softcore"
    : statusText;

  return (
    <>
      <span style={getSteamShapedRetroAchievementBadgeFrameStyle(achievement.isUnlocked)}>
        {achievement.badgeImageUrl !== undefined ? (
          <DeckyGameArtwork compact src={achievement.badgeImageUrl} size={FULLSCREEN_ACHIEVEMENT_ARTWORK_SIZE} title={achievement.title} />
        ) : (
          <span style={getSteamAchievementBadgeFallbackStyle()}>?</span>
        )}
      </span>
      <span style={getSteamShapedRetroAchievementTextStyle()}>
        <span style={{ ...getAchievementRowTitleLineStyle(), flexWrap: "nowrap" }}>
          <span title={achievement.title} style={{ ...getSteamShapedRetroAchievementTitleStyle(), flex: "1 1 auto" }}>{achievement.title}</span>
          <DeckyAchievementTypeBadge classification={achievement.classification} />
        </span>
        {achievement.description !== undefined ? (
          <span style={getSteamShapedRetroAchievementDescriptionStyle()}>{achievement.description}</span>
        ) : null}
      </span>
      <AchievementRowRail
        statusText={modeText}
        statusColor={getSteamShapedRetroAchievementModeColor(achievement)}
        isUnlocked={achievement.isUnlocked}
        pointsText={pointsText}
        pointsIcon={pointsText !== undefined ? <DeckyRetroAchievementsPointsIcon size={13} /> : undefined}
        rarityPercent={rarityPercent}
        unlockedDate={unlockedDate}
      />
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
  gameMetrics = [],
  retroAchievementsPresentation = "default",
  gamePageGradient = false,
}: DeckyFullScreenAchievementRowProps): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const isSteamProvider = isSteamAchievementPresentationProvider(achievement.providerId);
  const isSteamShapedRetroAchievement = !isSteamProvider && retroAchievementsPresentation === "steam-shaped";
  const isRetroGamePageRow = !isSteamProvider && (isSteamShapedRetroAchievement || gamePageGradient);
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
        ...(isSteamProvider
          ? getSteamAchievementCardStyle(achievement)
          : isSteamShapedRetroAchievement
            ? getSteamShapedRetroAchievementCardStyle(achievement)
            : getAchievementCardStyle(achievement, gamePageGradient)),
        outline: isFocused ? `2px solid ${isSteamProvider ? steamTheme.focus.border : raTheme.focus.border}` : "none",
        outlineOffset: 1,
        ...(isFocused
          ? { boxShadow: isSteamProvider ? steamTheme.focus.shadow : raTheme.focus.shadow }
          : {}),
      }}
      data-achievement-companion-achievement-id={achievement.achievementId}
      data-achievement-companion-steam-achievement-id={isSteamProvider ? achievement.achievementId : undefined}
      data-ra-fullscreen-game-achievement-row={isRetroGamePageRow ? "true" : undefined}
      data-ra-fullscreen-game-achievement-tone={!isRetroGamePageRow ? undefined : achievement.isUnlocked && achievement.unlockMode === "hardcore"
        ? "hardcore"
        : achievement.isUnlocked && achievement.unlockMode === "softcore"
          ? "softcore"
          : "locked"}
    >
      {isSteamProvider ? (
        <SteamAchievementRowContent achievement={achievement} steamHuntersAchievement={steamHuntersAchievement} />
      ) : isSteamShapedRetroAchievement ? (
        <SteamShapedRetroAchievementRowContent achievement={achievement} gameMetrics={gameMetrics} />
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
                <span style={{ ...getAchievementRowDetailStyle(), display: "inline-flex", alignItems: "center", gap: 4 }}><DeckyRetroAchievementsPointsIcon size={13} />{pointsText}</span>
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
