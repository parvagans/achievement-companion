import type { CSSProperties } from "react";
import type { GameDetailSnapshot } from "@core/domain";

type GameSummary = GameDetailSnapshot["game"]["summary"];

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

function getCompletionBarFillStyle(percent: number): CSSProperties {
  return {
    width: `${clampPercent(percent)}%`,
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, rgba(99, 179, 237, 0.92), rgba(125, 211, 252, 0.98))",
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
}: {
  readonly compact?: boolean;
  readonly percent: number;
}): JSX.Element {
  const normalizedPercent = clampPercent(percent);

  return (
    <div style={getCompletionBarFrameStyle(compact)}>
      <div
        aria-label="Completion progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={normalizedPercent}
        aria-valuetext={`${normalizedPercent}% complete`}
        role="progressbar"
        style={getCompletionBarTrackStyle(compact)}
      >
        <div style={getCompletionBarFillStyle(normalizedPercent)} />
      </div>

      <div style={getCompletionBarCaptionStyle(compact)}>{`${normalizedPercent}% complete`}</div>
    </div>
  );
}
