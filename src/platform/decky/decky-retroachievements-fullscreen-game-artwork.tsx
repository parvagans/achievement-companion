import { useState, type CSSProperties } from "react";
import { raRecipes, raTheme } from "./ra-theme";

function getArtworkFrameStyle(variant: "default" | "compact"): CSSProperties {
  const isCompact = variant === "compact";

  return {
    ...raRecipes.artwork(isCompact ? "compact" : "fullscreen"),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: isCompact ? 168 : "100%",
    minWidth: isCompact ? 140 : 0,
    maxWidth: isCompact ? 180 : 268,
    height: isCompact ? 168 : 256,
    maxHeight: isCompact ? 180 : 256,
    padding: isCompact ? 10 : 14,
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
    background: raTheme.surface.interactive,
    color: raTheme.color.textPrimary,
    ...raRecipes.text("fullscreen", "title"),
    fontWeight: raTheme.type.weight.strong,
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
