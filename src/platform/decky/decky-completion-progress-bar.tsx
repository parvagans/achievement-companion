import { useLayoutEffect, useRef, type CSSProperties, type JSX } from "react";
import type { GameDetailSnapshot } from "@core/domain";
import { steamRecipes, steamTheme } from "./steam-theme";
import { raRecipes, raTheme } from "./ra-theme";

type GameSummary = GameDetailSnapshot["game"]["summary"];
export type DeckyCompletionProgressBarTone =
  | "default"
  | "retroachievements-mastered"
  | "retroachievements-beaten";

const FLAME_COMPLETION_THRESHOLD_PERCENT = 90;
const DEFAULT_COMPLETION_BACKGROUND = raRecipes.progressFill.completion;
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

function getCompletionBarTrackStyle(compact: boolean, captionPlacement: "above" | "below" | "inside", isSteam: boolean): CSSProperties {
  return {
    ...(isSteam ? steamRecipes.progressTrack : raRecipes.progressTrack),
    position: "relative",
    height: captionPlacement === "inside" ? (compact ? 22 : 28) : compact ? 4 : 8,
    borderRadius: 999,
    overflow: "hidden",
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
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.85), 0 0 3px rgba(0, 0, 0, 0.65)",
    pointerEvents: "none",
  };
}

function getCompletionBarInsideCaptionBadgeStyle(tone: DeckyCompletionProgressBarTone): CSSProperties {
  if (tone !== "retroachievements-mastered" && tone !== "retroachievements-beaten") {
    return {};
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 18,
    padding: "0 8px",
    border: "1px solid rgba(224, 237, 247, 0.32)",
    borderRadius: 999,
    background: "rgba(5, 16, 26, 0.9)",
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.42)",
    textShadow: "none",
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
  isSteam = false,
): CSSProperties {
  const normalizedPercent = clampPercent(percent);
  const completionRatio = normalizedPercent / 100;
  const usesFlamePalette =
    tone === "default" && breathe && normalizedPercent >= FLAME_COMPLETION_THRESHOLD_PERCENT;
  const glowAlpha = 0.2 + completionRatio * 0.35;
  const glowColor = usesFlamePalette
    ? `rgba(249, 115, 22, ${glowAlpha})`
    : tone === "retroachievements-mastered"
      ? `rgba(242, 216, 127, ${glowAlpha})`
      : tone === "retroachievements-beaten"
        ? `rgba(230, 235, 242, ${glowAlpha})`
        : `rgba(54, 185, 255, ${glowAlpha})`;

  return {
    width: `${normalizedPercent}%`,
    height: "100%",
    borderRadius: 999,
    background:
      tone === "retroachievements-mastered"
        ? raRecipes.progressFill.mastered
        : tone === "retroachievements-beaten"
          ? raRecipes.progressFill.beaten
        : usesFlamePalette
          ? FLAME_COMPLETION_BACKGROUND
        : isSteam
          ? steamRecipes.progressFill.completion
          : DEFAULT_COMPLETION_BACKGROUND,
    transition: "width 120ms ease, background 300ms ease",
    ...(breathe
      ? {
        animation: "achievement-companion-progress-breathe 1.9s ease-in-out infinite",
        ["--achievement-progress-glow" as string]: glowColor,
        ["--achievement-progress-intensity" as string]: (0.24 + completionRatio * 0.28).toFixed(2),
      }
      : {}),
  };
}

function getCompletionBarCaptionStyle(compact: boolean, isSteam: boolean): CSSProperties {
  return {
    ...(isSteam ? steamRecipes.text(compact ? "compact" : "fullscreen", "metadata") : raRecipes.text(compact ? "compact" : "fullscreen", "metadata")),
    color: isSteam ? steamTheme.color.textSecondary : raTheme.color.textSecondary,
    fontSize: isSteam ? steamTheme.type[compact ? "compact" : "fullscreen"].metadata : compact ? "12px" : "14px",
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
  steamTheme: isSteam = false,
}: {
  readonly compact?: boolean;
  readonly percent: number;
  readonly caption?: string;
  readonly captionPlacement?: "above" | "below" | "inside";
  readonly showCaption?: boolean;
  readonly tone?: DeckyCompletionProgressBarTone;
  readonly breathe?: boolean;
  readonly steamTheme?: boolean;
}): JSX.Element {
  const normalizedPercent = clampPercent(percent);
  const resolvedCaption = caption ?? `${normalizedPercent}% complete`;

  return (
    <div data-ac-steam-theme={isSteam ? (compact ? "compact" : "fullscreen") : undefined} data-ac-ra-theme={!isSteam ? (compact ? "compact" : "fullscreen") : undefined} style={getCompletionBarFrameStyle(compact)}>
      {showCaption && captionPlacement === "above" ? (
        <div style={getCompletionBarCaptionStyle(compact, isSteam)}>{resolvedCaption}</div>
      ) : null}

      <div
        aria-label="Completion progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={normalizedPercent}
        aria-valuetext={resolvedCaption}
        role="progressbar"
        style={getCompletionBarTrackStyle(compact, captionPlacement, isSteam)}
      >
        {breathe ? <DeckyCompletionProgressAnimationStyles /> : null}
        <div
          data-achievement-companion-completion-progress-fill={breathe ? "true" : undefined}
          data-completion-progress-tone={tone}
          style={getCompletionBarFillStyle(normalizedPercent, tone, breathe, isSteam)}
        />
        {showCaption && captionPlacement === "inside" ? (
          <div style={getCompletionBarInsideCaptionStyle(compact)}>
            <span style={getCompletionBarInsideCaptionBadgeStyle(tone)}>{resolvedCaption}</span>
          </div>
        ) : null}
      </div>

      {showCaption && captionPlacement === "below" ? (
        <div style={getCompletionBarCaptionStyle(compact, isSteam)}>{resolvedCaption}</div>
      ) : null}
    </div>
  );
}
