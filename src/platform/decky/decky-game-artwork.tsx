import { useEffect, useRef, useState, type CSSProperties } from "react";
import { loadBlankSteamHeaderStatus } from "./decky-steam-header-placeholder";
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
  const [failedSources, setFailedSources] = useState<ReadonlySet<string>>(() => new Set());
  const [storeFallbackSrc, setStoreFallbackSrc] = useState<string | undefined>(undefined);
  const latestSrc = useRef(src);
  latestSrc.current = src;
  useEffect(() => { setFailedSources(new Set()); setStoreFallbackSrc(undefined); }, [src, steamAppId]);

  useEffect(() => {
    if (src !== undefined || fallbackSrc !== undefined || steamAppId === undefined) return;
    let active = true;
    void loadSteamStoreHeaderArtwork(steamAppId).then((url) => {
      if (active) setStoreFallbackSrc(url);
    });
    return () => { active = false; };
  }, [src, fallbackSrc, steamAppId]);

  if (src === undefined && fallbackSrc === undefined && steamAppId === undefined) {
    return null;
  }

  const candidates = [src, fallbackSrc, storeFallbackSrc]
    .filter((candidate): candidate is string => candidate !== undefined);
  const displayedSource = candidates.find((candidate) => !failedSources.has(candidate));

  return (
    <span aria-hidden="true" style={{ ...getArtworkFrameStyle(width, height, compact), ...(fluid ? { width: "100%", height: "100%", minWidth: 0, flexShrink: 1 } : {}), ...(frameless ? { border: "none", borderRadius: 0 } : {}) }}>
      {displayedSource === undefined ? (
        <span style={getArtworkFallbackStyle()}>{getFallbackInitials(title)}</span>
      ) : (
        <img
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          src={displayedSource}
          onLoad={() => {
            if (displayedSource !== src) return;
            void loadBlankSteamHeaderStatus(displayedSource).then((isBlank) => {
              if (!isBlank || latestSrc.current !== displayedSource) return;
              setFailedSources((current) => new Set([...current, displayedSource]));
              if (fallbackSrc === undefined && steamAppId !== undefined) {
                void loadSteamStoreHeaderArtwork(steamAppId).then((url) => {
                  if (url !== undefined) setStoreFallbackSrc(url);
                });
              }
            });
          }}
          onError={() => {
            setFailedSources((current) => new Set([...current, displayedSource]));
            if (steamAppId !== undefined && storeFallbackSrc === undefined
              && !candidates.some((candidate) => candidate !== displayedSource && !failedSources.has(candidate))) {
              void loadSteamStoreHeaderArtwork(steamAppId).then((url) => {
                if (url !== undefined) setStoreFallbackSrc(url);
              });
            }
          }}
          style={{ ...getArtworkImageStyle(), objectFit: fit }}
        />
      )}
    </span>
  );
}
