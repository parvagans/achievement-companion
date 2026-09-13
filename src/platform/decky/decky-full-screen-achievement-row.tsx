import { useState, type CSSProperties, type FocusEventHandler } from "react";
import { Focusable } from "@decky/ui";
import type { NormalizedAchievement } from "@core/domain";
import {
  formatProviderAchievementPointsText,
  formatProviderAchievementStatusText,
  isSteamAchievementPresentationProvider,
} from "./decky-achievement-detail-helpers";
import { DeckyAchievementTypeBadge } from "./decky-achievement-type-badge";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";

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

function getAchievementRowIconStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: 2,
  };
}

export interface DeckyFullScreenAchievementRowProps {
  readonly achievement: NormalizedAchievement;
  readonly onOpenAchievementDetail: ((achievementId: string) => void) | undefined;
  readonly onBack: () => void;
}

export function DeckyFullScreenAchievementRow({
  achievement,
  onOpenAchievementDetail,
  onBack,
}: DeckyFullScreenAchievementRowProps): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const isSteamProvider = isSteamAchievementPresentationProvider(achievement.providerId);
  const statusText = formatProviderAchievementStatusText(achievement.providerId, achievement);
  const pointsText = formatProviderAchievementPointsText(achievement.providerId, achievement.points);
  const unlockedAt = achievement.unlockedAt;
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
      onFocus={(event: Parameters<FocusEventHandler<HTMLElement>>[0]) => {
        setIsFocused(true);
        scrollDeckyFocusTargetIntoView(event.currentTarget);
      }}
      onGamepadFocus={(event) => {
        setIsFocused(true);
        scrollDeckyFocusTargetIntoView(event.currentTarget);
      }}
      onBlur={() => {
        setIsFocused(false);
      }}
      style={{
        ...getAchievementCardStyle(achievement),
        outline: isFocused ? "2px solid rgba(69, 148, 255, 0.8)" : "none",
        outlineOffset: 1,
        boxShadow: isFocused
          ? "inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 0 1px rgba(69, 148, 255, 0.55), 0 4px 14px rgba(0, 0, 0, 0.22)"
          : undefined,
      }}
    >
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
        {isSteamProvider && achievement.description !== undefined ? (
          <span style={getAchievementRowDetailStyle()}>{achievement.description}</span>
        ) : null}
        <span style={getAchievementRowMetadataStackStyle()}>
          <span style={getAchievementRowStatusStyle(achievement)}>{statusText}</span>
          {pointsText !== undefined ? (
            <span style={getAchievementRowDetailStyle()}>{pointsText}</span>
          ) : null}
          {!isSteamProvider && unlockedAt !== undefined ? (
            <span style={getAchievementRowDetailStyle()}>Unlocked {formatTimestamp(unlockedAt)}</span>
          ) : null}
        </span>
      </span>
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
