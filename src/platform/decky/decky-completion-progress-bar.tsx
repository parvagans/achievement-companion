import type { CSSProperties } from "react";
import type { GameDetailSnapshot } from "@core/domain";

type GameSummary = GameDetailSnapshot["game"]["summary"];
export type DeckyCompletionProgressBarTone =
  | "default"
  | "retroachievements-mastered"
  | "retroachievements-beaten";

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function getCompletionBarFrameStyle(compact: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: compact ? 3 : 5,
    width: "100%",
  };
}

function getCompletionBarTrackStyle(compact: boolean): CSSProperties {
  return {
    height: compact ? 4 : 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.06)",
  };
}

function getCompletionBarFillStyle(percent: number, tone: DeckyCompletionProgressBarTone): CSSProperties {
  return {
    width: `${clampPercent(percent)}%`,
    height: "100%",
    borderRadius: 999,
    background:
      tone === "retroachievements-mastered"
        ? "linear-gradient(90deg, rgba(214, 178, 74, 0.94), rgba(232, 201, 102, 0.98))"
        : tone === "retroachievements-beaten"
          ? "linear-gradient(90deg, rgba(188, 198, 211, 0.94), rgba(223, 230, 239, 0.98))"
        : "linear-gradient(90deg, rgba(99, 179, 237, 0.92), rgba(125, 211, 252, 0.98))",
    transition: "width 120ms ease",
  };
}

function getCompletionBarCaptionStyle(compact: boolean): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.76)",
    fontSize: compact ? "12px" : "14px",
    fontWeight: 600,
    lineHeight: 1.2,
  };
}

export function getCompletionPercent(summary: GameSummary): number | undefined {
  if (summary.completionPercent !== undefined) {
    return clampPercent(summary.completionPercent);
  }

  if (summary.totalCount === undefined) {
    return undefined;
  }

  if (summary.totalCount === 0) {
    return 0;
  }

  return clampPercent(Math.round((summary.unlockedCount / summary.totalCount) * 100));
}

export function DeckyCompletionProgressBar({
  compact = false,
  percent,
  caption,
  captionPlacement = "below",
  tone = "default",
}: {
  readonly compact?: boolean;
  readonly percent: number;
  readonly caption?: string;
  readonly captionPlacement?: "above" | "below";
  readonly tone?: DeckyCompletionProgressBarTone;
}): JSX.Element {
  const normalizedPercent = clampPercent(percent);
  const resolvedCaption = caption ?? `${normalizedPercent}% complete`;

  return (
    <div style={getCompletionBarFrameStyle(compact)}>
      {captionPlacement === "above" ? (
        <div style={getCompletionBarCaptionStyle(compact)}>{resolvedCaption}</div>
      ) : null}

      <div
        aria-label="Completion progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={normalizedPercent}
        aria-valuetext={resolvedCaption}
        role="progressbar"
        style={getCompletionBarTrackStyle(compact)}
      >
        <div data-completion-progress-tone={tone} style={getCompletionBarFillStyle(normalizedPercent, tone)} />
      </div>

      {captionPlacement === "below" ? (
        <div style={getCompletionBarCaptionStyle(compact)}>{resolvedCaption}</div>
      ) : null}
    </div>
  );
}
