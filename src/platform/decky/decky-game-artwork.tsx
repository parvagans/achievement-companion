import { useState, type CSSProperties } from "react";

export interface DeckyGameArtworkProps {
  readonly src?: string;
  readonly title: string;
  readonly size: number;
  readonly compact?: boolean;
}

function getFallbackInitials(title: string): string {
  const words = title
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "AC";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
    .trim() || "AC";
}

function getArtworkFrameStyle(size: number, compact: boolean): CSSProperties {
  return {
    width: size,
    height: size,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: compact ? 8 : 10,
    border: compact ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(255, 255, 255, 0.12)",
    backgroundColor: compact ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.05)",
  };
}

function getArtworkImageStyle(): CSSProperties {
  return {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
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
    fontSize: "0.9em",
    fontWeight: 700,
    letterSpacing: "0.06em",
  };
}

export function DeckyGameArtwork({
  src,
  title,
  size,
  compact = false,
}: DeckyGameArtworkProps): JSX.Element | null {
  const [hasImageError, setHasImageError] = useState(false);

  if (src === undefined) {
    return null;
  }

  return (
    <span aria-hidden="true" style={getArtworkFrameStyle(size, compact)}>
      {hasImageError ? (
        <span style={getArtworkFallbackStyle()}>{getFallbackInitials(title)}</span>
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
