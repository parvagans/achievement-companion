import type { CSSProperties } from "react";
import type { NormalizedAchievement } from "@core/domain";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { getDeckyGameArtworkFallbackInitials } from "./decky-game-artwork-fallback";
import { DeckyFullScreenGameSpotlightCard } from "./decky-full-screen-game-spotlight-card";

type SteamAchievementSpotlightMode = "recent" | "highlight";

function formatTimestamp(epochMs: number): string {
  return new Date(epochMs).toLocaleString();
}

function formatAchievementDetail(
  achievement: NormalizedAchievement,
  mode: SteamAchievementSpotlightMode,
): string {
  if (mode === "recent") {
    return achievement.unlockedAt !== undefined ? `Unlocked ${formatTimestamp(achievement.unlockedAt)}` : "Unlocked";
  }

  return achievement.description ?? "Not yet unlocked";
}

function getListStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
  };
}

function getRowStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 8,
    alignItems: "center",
    boxSizing: "border-box",
    minWidth: 0,
    padding: 8,
    borderRadius: 12,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  };
}

function getIconFrameStyle(): CSSProperties {
  return {
    display: "flex",
    width: 30,
    height: 30,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 8,
  };
}

function getTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  };
}

function getTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.96)",
    fontSize: "0.86em",
    fontWeight: 700,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getDetailStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.66)",
    fontSize: "0.7em",
    lineHeight: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function SteamAchievementSpotlightRow({
  achievement,
  mode,
}: {
  readonly achievement: NormalizedAchievement;
  readonly mode: SteamAchievementSpotlightMode;
}): JSX.Element {
  return (
    <div style={getRowStyle()}>
      <span style={getIconFrameStyle()}>
        {achievement.badgeImageUrl !== undefined ? (
          <DeckyGameArtwork compact src={achievement.badgeImageUrl} size={28} title={achievement.title} />
        ) : (
          <span style={getDetailStyle()}>{getDeckyGameArtworkFallbackInitials(achievement.title)}</span>
        )}
      </span>
      <div style={getTextStyle()}>
        <div style={getTitleStyle()}>{achievement.title}</div>
        <div style={getDetailStyle()}>{formatAchievementDetail(achievement, mode)}</div>
      </div>
    </div>
  );
}

export interface DeckySteamAchievementSpotlightCardProps {
  readonly title: string;
  readonly achievements: readonly NormalizedAchievement[];
  readonly mode: SteamAchievementSpotlightMode;
}

export function DeckySteamAchievementSpotlightCard({
  title,
  achievements,
  mode,
}: DeckySteamAchievementSpotlightCardProps): JSX.Element {
  return (
    <DeckyFullScreenGameSpotlightCard
      title={title}
      style={{ flex: "1 1 auto", minHeight: 0 }}
    >
      <div style={getListStyle()}>
        {achievements.map((achievement) => (
          <SteamAchievementSpotlightRow
            key={achievement.achievementId}
            achievement={achievement}
            mode={mode}
          />
        ))}
      </div>
    </DeckyFullScreenGameSpotlightCard>
  );
}
