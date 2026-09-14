import type { CSSProperties } from "react";
import type { GameDetailSnapshot } from "@core/domain";
import {
  DeckyCompletionProgressBar,
  type DeckyCompletionProgressBarTone,
} from "./decky-completion-progress-bar";
import { DeckyFullScreenGameProgressStat } from "./decky-full-screen-game-progress-stat";
import { DeckyFullScreenGameSpotlightCard } from "./decky-full-screen-game-spotlight-card";
import { RetroAchievementsCompletionIndicator } from "./decky-retroachievements-completion-indicator";

type RetroAchievementsGame = GameDetailSnapshot["game"];

function getCardStyle(): CSSProperties {
  return {
    flex: "1 1 auto",
    minHeight: 0,
    height: "100%",
  };
}

function getCompletionStatusBlockStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    width: "100%",
  };
}

function getCompletionStatusPillStyle(tone: DeckyCompletionProgressBarTone): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
    width: "fit-content",
    maxWidth: "100%",
    minHeight: 28,
    padding: "5px 11px",
    borderRadius: 999,
    border:
      tone === "retroachievements-mastered"
        ? "1px solid rgba(232, 201, 102, 0.44)"
        : "1px solid rgba(214, 221, 232, 0.34)",
    background:
      tone === "retroachievements-mastered"
        ? "linear-gradient(180deg, rgba(232, 201, 102, 0.14), rgba(214, 178, 74, 0.06))"
        : "linear-gradient(180deg, rgba(214, 221, 232, 0.14), rgba(188, 198, 211, 0.06))",
    color:
      tone === "retroachievements-mastered"
        ? "rgba(255, 239, 184, 0.97)"
        : "rgba(231, 237, 245, 0.97)",
    fontSize: "0.82em",
    fontWeight: 800,
    letterSpacing: "0.05em",
    lineHeight: 1,
    textTransform: "uppercase",
    boxSizing: "border-box",
  };
}

function getCompletionTimingTextStyle(tone: DeckyCompletionProgressBarTone): CSSProperties {
  return {
    color:
      tone === "retroachievements-mastered"
        ? "rgba(255, 239, 184, 0.84)"
        : "rgba(221, 228, 236, 0.84)",
    fontSize: "0.86em",
    fontWeight: 700,
    lineHeight: 1.25,
  };
}

function getProgressStatGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 8,
  };
}

export interface DeckyRetroAchievementsProgressSummaryProps {
  readonly game: RetroAchievementsGame;
  readonly completionPercent: number | undefined;
  readonly completionTone: DeckyCompletionProgressBarTone;
  readonly completionStatusLabel: string | undefined;
  readonly completionStatusAriaLabel: string | undefined;
  readonly completionAtText: string | undefined;
  readonly unlockedValue: string;
  readonly totalValue: string;
}

export function DeckyRetroAchievementsProgressSummary({
  game,
  completionPercent,
  completionTone,
  completionStatusLabel,
  completionStatusAriaLabel,
  completionAtText,
  unlockedValue,
  totalValue,
}: DeckyRetroAchievementsProgressSummaryProps): JSX.Element {
  return (
    <DeckyFullScreenGameSpotlightCard title="Your Progress" style={getCardStyle()}>
      {completionStatusLabel !== undefined && completionStatusAriaLabel !== undefined ? (
        <div style={getCompletionStatusBlockStyle()}>
          <div
            aria-label={completionStatusAriaLabel}
            style={getCompletionStatusPillStyle(completionTone)}
            title={completionStatusAriaLabel}
          >
            <RetroAchievementsCompletionIndicator game={game} />
            <span>{completionStatusLabel}</span>
          </div>
          {completionAtText !== undefined && completionTone !== "default" ? (
            <div style={getCompletionTimingTextStyle(completionTone)}>{completionAtText}</div>
          ) : null}
        </div>
      ) : (
        <RetroAchievementsCompletionIndicator game={game} />
      )}
      {completionPercent !== undefined ? (
        <DeckyCompletionProgressBar percent={completionPercent} tone={completionTone} />
      ) : null}
      <div style={getProgressStatGridStyle()}>
        <DeckyFullScreenGameProgressStat label="Unlocked" value={unlockedValue} />
        <DeckyFullScreenGameProgressStat label="Total" value={totalValue} />
      </div>
    </DeckyFullScreenGameSpotlightCard>
  );
}
