import { useState, type CSSProperties } from "react";

function getArtworkFrameStyle(variant: "default" | "compact"): CSSProperties {
  const isCompact = variant === "compact";

  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: isCompact ? 168 : "100%",
    minWidth: isCompact ? 140 : 0,
    maxWidth: isCompact ? 180 : 268,
    height: isCompact ? 168 : 256,
    maxHeight: isCompact ? 180 : 256,
    padding: isCompact ? 10 : 14,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background:
      "radial-gradient(circle at top, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02) 52%, rgba(0, 0, 0, 0.18))",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 4px 16px rgba(0, 0, 0, 0.2)",
    boxSizing: "border-box",
    flexShrink: 0,
    overflow: "hidden",
  };
}

function getArtworkImageStyle(): CSSProperties {
  return {
    display: "block",
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    objectPosition: "center center",
  };
}

function getArtworkFallbackStyle(): CSSProperties {
  return {
    display: "flex",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(160deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03))",
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: "1em",
    fontWeight: 700,
    letterSpacing: "0.06em",
  };
}

export interface DeckyRetroAchievementsFullscreenGameArtworkProps {
  readonly src: string;
  readonly fallbackLabel: string;
  readonly variant?: "default" | "compact";
}

export function DeckyRetroAchievementsFullscreenGameArtwork({
  src,
  fallbackLabel,
  variant = "default",
}: DeckyRetroAchievementsFullscreenGameArtworkProps): JSX.Element {
  const [hasImageError, setHasImageError] = useState(false);

  return (
    <span aria-hidden="true" style={getArtworkFrameStyle(variant)}>
      {hasImageError ? (
        <span style={getArtworkFallbackStyle()}>{fallbackLabel}</span>
      ) : (
        <img
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          src={src}
          onError={() => {
            setHasImageError(true);
          }}
          style={getArtworkImageStyle()}
        />
      )}
    </span>
  );
}
