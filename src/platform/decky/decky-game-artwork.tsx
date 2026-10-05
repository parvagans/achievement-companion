import { useEffect, useState, type CSSProperties } from "react";
import { loadSteamStoreHeaderArtwork } from "./decky-steam-store-artwork";

export interface DeckyGameArtworkProps {
  readonly src?: string;
  readonly fallbackSrc?: string | undefined;
  readonly steamAppId?: number;
  readonly title: string;
  readonly size: number;
  readonly width?: number;
  readonly height?: number;
  readonly compact?: boolean;
  readonly fit?: "cover" | "contain";
  readonly fluid?: boolean;
  readonly frameless?: boolean;
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

function getArtworkFrameStyle(width: number, height: number, compact: boolean): CSSProperties {
  return {
    width,
    height,
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
  fallbackSrc,
  steamAppId,
  title,
  size,
  width = size,
  height = size,
  compact = false,
  fit = "cover",
  fluid = false,
  frameless = false,
}: DeckyGameArtworkProps): JSX.Element | null {
  const [failedSource, setFailedSource] = useState<string | undefined>(undefined);
  const [hasImageError, setHasImageError] = useState(false);
  const [storeFallbackSrc, setStoreFallbackSrc] = useState<string | undefined>(undefined);
  useEffect(() => { setFailedSource(undefined); setHasImageError(false); setStoreFallbackSrc(undefined); }, [src, fallbackSrc, steamAppId]);

  if (src === undefined && fallbackSrc === undefined) {
    return null;
  }

  const resolvedFallbackSrc = fallbackSrc ?? storeFallbackSrc;
  const displayedSource = failedSource === src ? resolvedFallbackSrc : src ?? resolvedFallbackSrc;

  return (
    <span aria-hidden="true" style={{ ...getArtworkFrameStyle(width, height, compact), ...(fluid ? { width: "100%", height: "100%", minWidth: 0, flexShrink: 1 } : {}), ...(frameless ? { border: "none", borderRadius: 0 } : {}) }}>
      {hasImageError ? (
        <span style={getArtworkFallbackStyle()}>{getFallbackInitials(title)}</span>
      ) : (
        <img
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          src={displayedSource}
          onError={() => {
            if (displayedSource === src && resolvedFallbackSrc !== undefined && resolvedFallbackSrc !== src) {
              setFailedSource(src);
            } else if (displayedSource === src && steamAppId !== undefined && storeFallbackSrc === undefined) {
              void loadSteamStoreHeaderArtwork(steamAppId).then((url) => {
                if (url !== undefined && url !== src) { setStoreFallbackSrc(url); setFailedSource(src); }
                else setHasImageError(true);
              });
            } else setHasImageError(true);
          }}
          style={{ ...getArtworkImageStyle(), objectFit: fit }}
        />
      )}
    </span>
  );
}
