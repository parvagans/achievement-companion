import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import {
  DEFAULT_GAME_PAGE_ACHIEVEMENT_BADGE_COLORS,
  type GamePageAchievementBadgeColors,
  type GamePageAchievementBadgeSize,
} from "@core/settings";
import steamIconUrl from "./assets/steam.svg";
import infoIconUrl from "./assets/info.svg";
import { DeckyGameStatusIcon } from "./decky-game-status-icon";
import { RETROACHIEVEMENTS_PROVIDER_ICON_SRC } from "./providers/retroachievements/icon";
import type {
  DeckyGamePageAchievementBadgePresentation,
  DeckyGamePageAchievementBadgeProvider,
  DeckyGamePageAchievementBadgeVariant,
} from "./decky-game-page-achievement-badge-presentation";
import {
  resolveDeckyGamePageAchievementBadgePalette,
  type DeckyGamePageAchievementBadgePalette,
} from "./decky-game-page-achievement-badge-colors";

export const GAME_PAGE_BADGE_DIMENSIONS = {
  small: {
    width: 232, height: 58, medallion: 52, steamIcon: 32, providerIcon: 40,
    divider: 38, dividerMargin: 5, statusSlot: 38, statusIcon: 34, barsIcon: 32,
    textPadding: 3, textGap: 3, labelFont: 10, loadingFont: 10, countFont: 13,
    ring: 42, ringPadding: 5,
  },
  medium: {
    width: 264, height: 66, medallion: 60, steamIcon: 37, providerIcon: 46,
    divider: 43, dividerMargin: 6, statusSlot: 45, statusIcon: 41, barsIcon: 38,
    textPadding: 4, textGap: 3, labelFont: 12, loadingFont: 11, countFont: 15,
    ring: 48, ringPadding: 6,
  },
  large: {
    width: 292, height: 74, medallion: 68, steamIcon: 42, providerIcon: 52,
    divider: 48, dividerMargin: 7, statusSlot: 52, statusIcon: 48, barsIcon: 44,
    textPadding: 4, textGap: 4, labelFont: 13, loadingFont: 12, countFont: 17,
    ring: 54, ringPadding: 7,
  },
} as const;
type BadgeDimensions = typeof GAME_PAGE_BADGE_DIMENSIONS[GamePageAchievementBadgeSize];
const PROGRESS_RING_STROKE_WIDTH = 7.5;
const PROGRESS_RING_RADIUS = 21;
const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RING_RADIUS;


export function resolveDeckyGamePageAchievementBadgeProviderIconUrl(
  provider: DeckyGamePageAchievementBadgeProvider | undefined,
  variant?: DeckyGamePageAchievementBadgeVariant,
): string {
  if (variant === "loading" || provider === undefined) return infoIconUrl;
  return provider === "steam" ? steamIconUrl : RETROACHIEVEMENTS_PROVIDER_ICON_SRC;
}

function getBadgeShellStyle(palette: DeckyGamePageAchievementBadgePalette, focused: boolean, dimensions: BadgeDimensions): CSSProperties {
  return {
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: dimensions.width,
    height: dimensions.height,
    overflow: "hidden",
    boxSizing: "border-box",
    border: `2px solid ${palette.border}`,
    borderRadius: dimensions.height / 2,
    background: [
      "radial-gradient(120% 90% at 42% -24%, rgba(255,255,255,.36) 0%, rgba(255,255,255,.13) 34%, transparent 60%)",
      "linear-gradient(180deg, rgba(255,255,255,.18) 0%, rgba(255,255,255,.045) 43%, rgba(0,0,0,.18) 100%)",
      `linear-gradient(100deg, ${palette.surfaceDeep} 0%, ${palette.surface} 68%, ${palette.surfaceDeep} 100%)`,
    ].join(", "),
    // Keep the glow inside the rounded shell. Steam's focused compositing layer
    // clips exterior shadows to a rectangle, which makes a square halo appear
    // around an otherwise pill-shaped control on physical Deck hardware.
    boxShadow: focused
      ? `inset 0 0 0 2px rgba(255,255,255,.98), inset 0 3px 3px rgba(255,255,255,.42), inset 0 -9px 16px rgba(0,0,0,.27), inset 0 0 22px ${palette.glow}`
      : `inset 0 0 0 1px rgba(0,0,0,.72), inset 0 3px 3px rgba(255,255,255,.3), inset 0 -8px 15px rgba(0,0,0,.25), inset 0 0 17px ${palette.glow}`,
    color: "#f8fbff",
    fontFamily: '"Motiva Sans", Arial, sans-serif',
    pointerEvents: "none",
    transform: focused ? "translateY(-1px) scale(1.018)" : "translateY(0) scale(1)",
    filter: focused ? "brightness(1.14) saturate(1.08)" : "none",
    transition: "transform 120ms ease-out, filter 120ms ease-out, box-shadow 120ms ease-out",
  };
}

function getBadgeGlossOverlayStyle(dimensions: BadgeDimensions): CSSProperties {
  return {
    position: "absolute",
    zIndex: 1,
    inset: 2,
    borderRadius: dimensions.height / 2,
    background: [
      "radial-gradient(70% 58% at 44% 0%, rgba(255,255,255,.42) 0%, rgba(255,255,255,.16) 37%, transparent 72%)",
      "linear-gradient(180deg, rgba(255,255,255,.27) 0%, rgba(255,255,255,.09) 28%, transparent 52%)",
      "linear-gradient(116deg, transparent 0%, transparent 15%, rgba(255,255,255,.24) 20%, transparent 27%, transparent 69%, rgba(255,255,255,.13) 77%, transparent 85%)",
    ].join(", "),
    pointerEvents: "none",
  };
}

const getBadgeContentStyle = (style: CSSProperties): CSSProperties => ({
  position: "relative",
  zIndex: 2,
  ...style,
});

function getPlatformMedallionStyle(palette: DeckyGamePageAchievementBadgePalette, dimensions: BadgeDimensions): CSSProperties {
  return {
    position: "relative",
    zIndex: 2,
    width: dimensions.medallion,
    height: dimensions.medallion,
    marginLeft: 1,
    flex: `0 0 ${dimensions.medallion}px`,
    display: "grid",
    placeItems: "center",
    boxSizing: "border-box",
    border: `2px solid ${palette.accentBright}`,
    borderRadius: "50%",
    background: [
      "radial-gradient(circle at 35% 20%, rgba(255,255,255,.52) 0%, rgba(255,255,255,.18) 18%, transparent 41%)",
      `radial-gradient(circle at 38% 30%, ${palette.surface} 0%, ${palette.surfaceDeep} 72%)`,
    ].join(", "),
    boxShadow: `0 0 16px ${palette.glow}, inset 0 3px 3px rgba(255,255,255,.46), inset 0 -9px 13px rgba(0,0,0,.29), inset 0 0 13px ${palette.glow}`,
  };
}

function getProviderIconStyle(
  provider: DeckyGamePageAchievementBadgeProvider | undefined,
  variant: DeckyGamePageAchievementBadgeVariant,
  dimensions: BadgeDimensions,
): CSSProperties {
  return {
    display: "block",
    width: provider === "steam" ? dimensions.steamIcon : dimensions.providerIcon,
    height: provider === "steam" ? dimensions.steamIcon : dimensions.providerIcon,
    objectFit: "contain",
    ...(variant === "loading" || provider !== "retroachievements" ? { filter: "brightness(0) invert(1)" } : {}),
  };
}

function renderStatusIcon(
  variant: DeckyGamePageAchievementBadgeVariant,
  palette: DeckyGamePageAchievementBadgePalette,
  dimensions: BadgeDimensions,
): ReactNode {
  if (variant === "perfected" || variant === "mastered") {
    return <span data-ac-game-page-badge-status-icon="crown-laurel"><DeckyGameStatusIcon kind={variant} size={dimensions.statusIcon} color={palette.accent} accentColor={palette.accentBright} glow={palette.glow} /></span>;
  }

  if (variant === "beaten") {
    return <span data-ac-game-page-badge-status-icon="flag"><DeckyGameStatusIcon kind="beaten" size={dimensions.statusIcon} color={palette.accent} /></span>;
  }

  const shared = { color: palette.accent, filter: `drop-shadow(0 0 5px ${palette.glow})` } satisfies CSSProperties;

  return (
    <svg data-ac-game-page-badge-status-icon="bars" height={dimensions.barsIcon} viewBox="0 0 54 54" width={dimensions.barsIcon} style={shared}>
      <rect fill="currentColor" height="14" rx="1" width="8" x="5" y="35" />
      <rect fill="currentColor" height="24" rx="1" width="8" x="17" y="25" />
      <rect fill="currentColor" height="34" rx="1" width="8" x="29" y="15" />
      <rect fill="currentColor" height="44" rx="1" width="8" x="41" y="5" />
    </svg>
  );
}

function renderProgressRing(
  presentation: DeckyGamePageAchievementBadgePresentation,
  palette: DeckyGamePageAchievementBadgePalette,
  loadingRingRef: RefObject<SVGCircleElement>,
  dimensions: BadgeDimensions,
): ReactNode {
  const circumference = PROGRESS_RING_CIRCUMFERENCE;
  const loading = presentation.variant === "loading";
  const dashOffset = circumference * (1 - presentation.progress);
  const completed = presentation.variant === "perfected" || presentation.variant === "mastered";
  const ringGradientId = `ac-game-page-badge-ring-${presentation.variant}`;
  const ringCenterGradientId = `ac-game-page-badge-ring-center-${presentation.variant}`;

  return (
    <svg aria-hidden="true" height={dimensions.ring} viewBox="0 0 54 54" width={dimensions.ring} style={{ flex: `0 0 ${dimensions.ring}px`, overflow: "visible" }}>
      <defs>
        <linearGradient id={ringGradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={palette.accentBright} />
          <stop offset="0.42" stopColor={palette.accent} />
          <stop offset="1" stopColor={palette.accentBright} stopOpacity="0.78" />
        </linearGradient>
        <radialGradient cx="36%" cy="27%" id={ringCenterGradientId} r="72%">
          <stop offset="0" stopColor="rgba(255,255,255,.3)" />
          <stop offset="0.42" stopColor="rgba(10,20,34,.78)" />
          <stop offset="1" stopColor="rgba(3,8,15,.92)" />
        </radialGradient>
      </defs>
      <circle cx="27" cy="27" fill={`url(#${ringCenterGradientId})`} r="21" stroke={palette.track} strokeWidth={PROGRESS_RING_STROKE_WIDTH} />
      <circle
        ref={loadingRingRef}
        data-ac-game-page-badge-loading-ring={loading ? "true" : undefined}
        cx="27"
        cy="27"
        fill="none"
        r={PROGRESS_RING_RADIUS}
        stroke={`url(#${ringGradientId})`}
        strokeDasharray={loading ? `${circumference * presentation.progress} ${circumference * (1 - presentation.progress)}` : circumference}
        strokeDashoffset={loading ? 0 : dashOffset}
        strokeLinecap="butt"
        strokeWidth={PROGRESS_RING_STROKE_WIDTH}
        style={{ filter: `drop-shadow(0 0 4px ${palette.glow})` }}
        transform="rotate(-90 27 27)"
      />
      <path d="M15.5 17.5a18 18 0 0 1 22-5.2" fill="none" stroke="rgba(255,255,255,.54)" strokeLinecap="round" strokeWidth="1.35" />
      {completed ? (
        <path d="m18 27 6 6 13-14" fill="none" stroke={palette.accentBright} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      ) : null}
    </svg>
  );
}

export function DeckyGamePageAchievementBadgeVisual({
  presentation,
  colors = DEFAULT_GAME_PAGE_ACHIEVEMENT_BADGE_COLORS,
  focused = false,
  size = "large",
}: {
  readonly presentation: DeckyGamePageAchievementBadgePresentation;
  readonly colors?: GamePageAchievementBadgeColors | undefined;
  readonly focused?: boolean | undefined;
  readonly size?: GamePageAchievementBadgeSize | undefined;
}): JSX.Element {
  const loadingRingRef = useRef<SVGCircleElement>(null);
  useEffect(() => {
    if (presentation.variant !== "loading") return;
    const ring = loadingRingRef.current;
    const ownerWindow = ring?.ownerDocument.defaultView;
    if (ring === null || ownerWindow === null || ownerWindow === undefined) return;

    const reducedMotion = ownerWindow.matchMedia("(prefers-reduced-motion: reduce)");
    let animation: Animation | undefined;
    const updateAnimation = (): void => {
      animation?.cancel();
      animation = reducedMotion.matches
        ? undefined
        : ring.animate(
          [{ strokeDashoffset: "0px" }, { strokeDashoffset: `${-PROGRESS_RING_CIRCUMFERENCE}px` }],
          { duration: 1_650, easing: "linear", iterations: Infinity },
        );
    };

    updateAnimation();
    reducedMotion.addEventListener("change", updateAnimation);
    return () => {
      reducedMotion.removeEventListener("change", updateAnimation);
      animation?.cancel();
    };
  }, [presentation.variant]);

  const palette = resolveDeckyGamePageAchievementBadgePalette(presentation.variant, colors);
  const dimensions = GAME_PAGE_BADGE_DIMENSIONS[size];
  const providerIconUrl = resolveDeckyGamePageAchievementBadgeProviderIconUrl(presentation.provider, presentation.variant);

  return (
    <span
      aria-hidden="true"
      data-ac-game-page-badge-variant={presentation.variant}
      data-ac-game-page-badge-size={size}
      style={getBadgeShellStyle(palette, focused, dimensions)}
    >
      <span data-ac-game-page-badge-gloss="true" style={getBadgeGlossOverlayStyle(dimensions)} />
      <span style={getPlatformMedallionStyle(palette, dimensions)}>
        <img alt="" src={providerIconUrl} style={getProviderIconStyle(presentation.provider, presentation.variant, dimensions)} />
      </span>
      <span style={getBadgeContentStyle({ width: 1, height: dimensions.divider, marginLeft: dimensions.dividerMargin, background: "rgba(255,255,255,.16)", boxShadow: `0 0 8px ${palette.glow}` })} />
      <span style={getBadgeContentStyle({ width: dimensions.statusSlot, flex: `0 0 ${dimensions.statusSlot}px`, display: "grid", placeItems: "center" })}>
        {renderStatusIcon(presentation.variant, palette, dimensions)}
      </span>
      <span style={getBadgeContentStyle({ minWidth: 0, flex: "1 1 auto", display: "flex", flexDirection: "column", justifyContent: "center", gap: dimensions.textGap, paddingLeft: dimensions.textPadding })}>
        <span style={{ color: "#ffffff", fontSize: presentation.variant === "loading" ? dimensions.loadingFont : dimensions.labelFont, fontWeight: 800, letterSpacing: "0.025em", lineHeight: 1, whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(0,0,0,.9)" }}>
          {presentation.statusLabel}
        </span>
        <span style={{ color: "#dcecff", fontSize: dimensions.countFont, fontWeight: 700, letterSpacing: "0.01em", lineHeight: 1, whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(0,0,0,.9)" }}>
          {presentation.countLabel}
        </span>
      </span>
      <span style={getBadgeContentStyle({ display: "grid", placeItems: "center", paddingRight: dimensions.ringPadding })}>
        {renderProgressRing(presentation, palette, loadingRingRef, dimensions)}
      </span>
    </span>
  );
}
