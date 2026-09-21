import { useLayoutEffect, useRef, type CSSProperties, type JSX } from "react";
import type { GameDetailSnapshot } from "@core/domain";

type GameSummary = GameDetailSnapshot["game"]["summary"];
export type DeckyCompletionProgressBarTone =
  | "default"
  | "retroachievements-mastered"
  | "retroachievements-beaten";

const FLAME_COMPLETION_THRESHOLD_PERCENT = 90;
const DEFAULT_COMPLETION_BACKGROUND =
  "linear-gradient(90deg, rgba(99, 179, 237, 0.92), rgba(125, 211, 252, 0.98))";
const FLAME_COMPLETION_BACKGROUND =
  "linear-gradient(90deg, rgba(245, 196, 66, 0.96), rgba(249, 115, 22, 0.98), rgba(239, 68, 68, 0.98))";

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

function getCompletionBarTrackStyle(compact: boolean, captionPlacement: "above" | "below" | "inside"): CSSProperties {
  return {
    position: "relative",
    height: captionPlacement === "inside" ? (compact ? 22 : 28) : compact ? 4 : 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.06)",
  };
}

function getCompletionBarInsideCaptionStyle(compact: boolean): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255, 255, 255, 0.96)",
    fontSize: compact ? "11px" : "12px",
    fontWeight: 700,
    lineHeight: 1,
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.7)",
    pointerEvents: "none",
  };
}

function DeckyCompletionProgressAnimationStyles(): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const ownerDocument = anchorRef.current?.ownerDocument;
    if (ownerDocument === undefined) {
      return;
    }

    const style = ownerDocument.createElement("style");
    style.dataset["achievementCompanionCompletionProgressStyles"] = "true";
    style.textContent = `
@keyframes achievement-companion-progress-breathe {
  0%, 100% {
    filter: saturate(1) brightness(0.98);
    box-shadow: 0 0 4px var(--achievement-progress-glow);
  }
  50% {
    filter: saturate(calc(1 + var(--achievement-progress-intensity))) brightness(1.18);
    box-shadow: 0 0 22px var(--achievement-progress-glow);
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-achievement-companion-completion-progress-fill="true"] {
    animation: none !important;
  }
}
`;
    ownerDocument.head.appendChild(style);
    return () => style.remove();
  }, []);

  return <span ref={anchorRef} hidden aria-hidden="true" />;
}

export function getCompletionBarFillStyle(
  percent: number,
  tone: DeckyCompletionProgressBarTone,
  breathe: boolean,
): CSSProperties {
  const normalizedPercent = clampPercent(percent);
  const completionRatio = normalizedPercent / 100;
  const usesFlamePalette =
    tone === "default" && breathe && normalizedPercent >= FLAME_COMPLETION_THRESHOLD_PERCENT;
  const glowHue = usesFlamePalette ? 24 : 198;

  return {
    width: `${normalizedPercent}%`,
    height: "100%",
    borderRadius: 999,
    background:
      tone === "retroachievements-mastered"
        ? "linear-gradient(90deg, rgba(214, 178, 74, 0.94), rgba(232, 201, 102, 0.98))"
        : tone === "retroachievements-beaten"
          ? "linear-gradient(90deg, rgba(188, 198, 211, 0.94), rgba(223, 230, 239, 0.98))"
        : usesFlamePalette
          ? FLAME_COMPLETION_BACKGROUND
          : DEFAULT_COMPLETION_BACKGROUND,
    transition: "width 120ms ease, background 300ms ease",
    ...(breathe
      ? {
        animation: "achievement-companion-progress-breathe 1.9s ease-in-out infinite",
        ["--achievement-progress-glow" as string]: `hsl(${glowHue} 96% 60% / ${0.2 + completionRatio * 0.35})`,
        ["--achievement-progress-intensity" as string]: (0.24 + completionRatio * 0.28).toFixed(2),
      }
      : {}),
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
  showCaption = true,
  tone = "default",
  breathe = false,
}: {
  readonly compact?: boolean;
  readonly percent: number;
  readonly caption?: string;
  readonly captionPlacement?: "above" | "below" | "inside";
  readonly showCaption?: boolean;
  readonly tone?: DeckyCompletionProgressBarTone;
  readonly breathe?: boolean;
}): JSX.Element {
  const normalizedPercent = clampPercent(percent);
  const resolvedCaption = caption ?? `${normalizedPercent}% complete`;

  return (
    <div style={getCompletionBarFrameStyle(compact)}>
      {showCaption && captionPlacement === "above" ? (
        <div style={getCompletionBarCaptionStyle(compact)}>{resolvedCaption}</div>
      ) : null}

      <div
        aria-label="Completion progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={normalizedPercent}
        aria-valuetext={resolvedCaption}
        role="progressbar"
        style={getCompletionBarTrackStyle(compact, captionPlacement)}
      >
        {breathe ? <DeckyCompletionProgressAnimationStyles /> : null}
        <div
          data-achievement-companion-completion-progress-fill={breathe ? "true" : undefined}
          data-completion-progress-tone={tone}
          style={getCompletionBarFillStyle(normalizedPercent, tone, breathe)}
        />
        {showCaption && captionPlacement === "inside" ? (
          <div style={getCompletionBarInsideCaptionStyle(compact)}>{resolvedCaption}</div>
        ) : null}
      </div>

      {showCaption && captionPlacement === "below" ? (
        <div style={getCompletionBarCaptionStyle(compact)}>{resolvedCaption}</div>
      ) : null}
    </div>
  );
}
