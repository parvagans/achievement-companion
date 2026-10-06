import type { CSSProperties } from "react";
import type { GameDetailSnapshot } from "@core/domain";
import { formatModeProgressSummary } from "./decky-achievement-detail-helpers";
import { raRecipes, raTheme } from "./ra-theme";

type RetroAchievementsGame = GameDetailSnapshot["game"];
type RetroAchievementsMode = "hardcore" | "softcore";

function formatCount(value: number): string {
  return value.toLocaleString();
}

function getGridStyle(): CSSProperties {
  return {
    ...raRecipes.card("fullscreen", true),
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 10,
    alignItems: "stretch",
    minWidth: 0,
    width: "100%",
  };
}

function getCardStyle(mode: RetroAchievementsMode): CSSProperties {
  return {
    ...raRecipes.profileSection.card(mode),
    display: "flex",
    flexDirection: "column",
    gap: raTheme.space.xs,
    minWidth: 0,
  };
}

function getCardTitleStyle(mode: RetroAchievementsMode): CSSProperties {
  return {
    color: mode === "hardcore" ? raTheme.color.hardcore : raTheme.color.softcore,
    ...raRecipes.text("fullscreen", "caption"),
    fontWeight: raTheme.type.weight.strong,
    letterSpacing: "0.05em",
    lineHeight: 1.15,
    textTransform: "uppercase",
  };
}

function getCardLineStyle(): CSSProperties {
  return {
    color: raTheme.color.textPrimary,
    ...raRecipes.text("fullscreen", "body"),
    lineHeight: 1.2,
  };
}

function getCardPointsStyle(): CSSProperties {
  return {
    ...raRecipes.badge("points"),
    lineHeight: 1.2,
  };
}

function ModeCard({
  game,
  mode,
  points,
}: {
  readonly game: RetroAchievementsGame;
  readonly mode: RetroAchievementsMode;
  readonly points: number | undefined;
}): JSX.Element {
  const label = mode === "hardcore" ? "Hardcore" : "Softcore";
  const summary = mode === "hardcore" ? game.hardcoreSummary : game.softcoreSummary;

  return (
    <div style={getCardStyle(mode)}>
      <div style={getCardTitleStyle(mode)}>{label}</div>
      <div style={getCardLineStyle()}>{formatModeProgressSummary(summary, label)}</div>
      {points !== undefined ? <div style={getCardPointsStyle()}>{`Points ${formatCount(points)}`}</div> : null}
    </div>
  );
}

export interface DeckyRetroAchievementsModeProgressCardsProps {
  readonly game: RetroAchievementsGame;
  readonly hardcorePoints: number | undefined;
  readonly softcorePoints: number | undefined;
  readonly showHardcore: boolean;
  readonly showSoftcore: boolean;
}

export function DeckyRetroAchievementsModeProgressCards({
  game,
  hardcorePoints,
  softcorePoints,
  showHardcore,
  showSoftcore,
}: DeckyRetroAchievementsModeProgressCardsProps): JSX.Element | null {
  if (!showHardcore && !showSoftcore) {
    return null;
  }

  return (
    <div style={getGridStyle()}>
      {showHardcore ? <ModeCard game={game} mode="hardcore" points={hardcorePoints} /> : null}
      {showSoftcore ? <ModeCard game={game} mode="softcore" points={softcorePoints} /> : null}
    </div>
  );
}
