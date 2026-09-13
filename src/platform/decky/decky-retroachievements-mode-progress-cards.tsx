import type { CSSProperties } from "react";
import type { GameDetailSnapshot } from "@core/domain";
import { formatModeProgressSummary } from "./decky-achievement-detail-helpers";

type RetroAchievementsGame = GameDetailSnapshot["game"];
type RetroAchievementsMode = "hardcore" | "softcore";

function formatCount(value: number): string {
  return value.toLocaleString();
}

function getGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 10,
    alignItems: "stretch",
    minWidth: 0,
    width: "100%",
  };
}

function getCardStyle(mode: RetroAchievementsMode): CSSProperties {
  const isHardcore = mode === "hardcore";

  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: 16,
    border: `1px solid ${isHardcore ? "rgba(214, 178, 74, 0.28)" : "rgba(214, 221, 232, 0.2)"}`,
    borderLeftWidth: 4,
    borderLeftStyle: "solid",
    borderLeftColor: isHardcore ? "rgba(214, 178, 74, 0.8)" : "rgba(214, 221, 232, 0.72)",
    background: isHardcore
      ? "linear-gradient(180deg, rgba(214, 178, 74, 0.08), rgba(214, 178, 74, 0.03))"
      : "linear-gradient(180deg, rgba(214, 221, 232, 0.07), rgba(214, 221, 232, 0.03))",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 8px rgba(0, 0, 0, 0.14)",
  };
}

function getCardTitleStyle(mode: RetroAchievementsMode): CSSProperties {
  return {
    color: mode === "hardcore" ? "rgba(232, 201, 102, 0.95)" : "rgba(220, 225, 233, 0.95)",
    fontSize: "0.78em",
    fontWeight: 800,
    letterSpacing: "0.05em",
    lineHeight: 1.15,
    textTransform: "uppercase",
  };
}

function getCardLineStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.86)",
    fontSize: "0.84em",
    lineHeight: 1.2,
  };
}

function getCardPointsStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.8em",
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
