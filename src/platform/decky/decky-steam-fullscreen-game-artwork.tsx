import { useState, type CSSProperties } from "react";

function getArtworkFrameStyle(compact: boolean, dense: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxWidth: compact ? 230 : 520,
    aspectRatio: compact ? "2 / 1" : "460 / 215",
    maxHeight: dense ? 154 : undefined,
    padding: compact ? 8 : dense ? 10 : 14,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background:
      "radial-gradient(circle at top, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02) 52%, rgba(0, 0, 0, 0.18))",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 4px 16px rgba(0, 0, 0, 0.2)",
    boxSizing: "border-box",
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
    objectFit: "cover",
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

export interface DeckySteamFullscreenGameArtworkProps {
  readonly src: string;
  readonly fallbackLabel: string;
  readonly compact?: boolean;
  readonly dense?: boolean;
}

export function DeckySteamFullscreenGameArtwork({
  src,
  fallbackLabel,
  compact = false,
  dense = false,
}: DeckySteamFullscreenGameArtworkProps): JSX.Element {
  const [hasImageError, setHasImageError] = useState(false);

  return (
    <span aria-hidden="true" style={getArtworkFrameStyle(compact, dense)}>
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
