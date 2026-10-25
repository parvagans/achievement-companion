import { useEffect, useRef, useState, type CSSProperties } from "react";
import { loadBlankSteamHeaderStatus } from "./decky-steam-header-placeholder";
import { steamTheme } from "./steam-theme";

export function getDeckySteamFullscreenArtworkFrameStyle(compact: boolean, dense: boolean, overview = false): CSSProperties {
  const base: CSSProperties = {
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
    background: steamTheme.surface.contentStat,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 4px 16px rgba(0, 0, 0, 0.2)",
    boxSizing: "border-box",
    overflow: "hidden",
  };
  return overview ? {
    ...base,
    height: 64,
    maxHeight: 64,
    padding: 0,
    borderRadius: steamTheme.radius.medium,
    border: "none",
    background: "transparent",
    boxShadow: "none",
  } : base;
}

export function getDeckySteamFullscreenArtworkImageStyle(
  fit: "cover" | "contain",
  preserveSourceSize: boolean,
): CSSProperties {
  return {
    display: "block",
    width: preserveSourceSize ? "auto" : "100%",
    height: preserveSourceSize ? "auto" : "100%",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: fit,
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
    background: steamTheme.surface.contentCard,
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: "1em",
    fontWeight: 700,
    letterSpacing: "0.06em",
  };
}

export interface DeckySteamFullscreenGameArtworkProps {
  readonly src: string;
  readonly fallbackLabel: string;
  readonly fallbackSrc?: string;
  readonly compact?: boolean;
  readonly dense?: boolean;
  readonly overview?: boolean;
  readonly imageFit?: "cover" | "contain";
  readonly preserveSourceSize?: boolean;
  readonly fallbackImageFit?: "cover" | "contain";
  readonly preserveFallbackSourceSize?: boolean;
}

export function DeckySteamFullscreenGameArtwork({
  src,
  fallbackLabel,
  fallbackSrc,
  compact = false,
  dense = false,
  overview = false,
  imageFit = "cover",
  preserveSourceSize = false,
  fallbackImageFit = imageFit,
  preserveFallbackSourceSize = preserveSourceSize,
}: DeckySteamFullscreenGameArtworkProps): JSX.Element {
  const [hasImageError, setHasImageError] = useState(false);
  const [failedPrimary, setFailedPrimary] = useState(false);
  const latestSrc = useRef(src);
  latestSrc.current = src;
  useEffect(() => { setHasImageError(false); setFailedPrimary(false); }, [src]);
  useEffect(() => { if (fallbackSrc !== undefined) setHasImageError(false); }, [fallbackSrc]);

  return (
    <span data-ac-steam-overview-artwork={overview ? "fill" : undefined} aria-hidden="true" style={getDeckySteamFullscreenArtworkFrameStyle(compact, dense, overview)}>
      {hasImageError ? (
        <span style={getArtworkFallbackStyle()}>{fallbackLabel}</span>
      ) : (
        <img
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          src={failedPrimary ? fallbackSrc ?? src : src}
          onLoad={() => {
            if (failedPrimary || fallbackSrc === undefined) return;
            void loadBlankSteamHeaderStatus(src).then((isBlank) => {
              if (isBlank && latestSrc.current === src) setFailedPrimary(true);
            });
          }}
          onError={() => {
            if (!failedPrimary && fallbackSrc !== undefined && fallbackSrc !== src) setFailedPrimary(true);
            else setHasImageError(true);
          }}
          style={getDeckySteamFullscreenArtworkImageStyle(
            failedPrimary ? fallbackImageFit : imageFit,
            failedPrimary ? preserveFallbackSourceSize : preserveSourceSize,
          )}
        />
      )}
    </span>
  );
}
