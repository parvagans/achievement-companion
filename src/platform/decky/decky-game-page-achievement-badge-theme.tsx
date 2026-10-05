import type { CSSProperties, ReactNode } from "react";
import steamIconUrl from "./assets/steam.svg";
import crownIconUrl from "./assets/achievement-badge/crown.svg";
import laurelIconUrl from "./assets/achievement-badge/laurel.svg";
import { RETROACHIEVEMENTS_PROVIDER_ICON_SRC } from "./providers/retroachievements/icon";
import type {
  DeckyGamePageAchievementBadgePresentation,
  DeckyGamePageAchievementBadgeProvider,
  DeckyGamePageAchievementBadgeVariant,
} from "./decky-game-page-achievement-badge-presentation";

interface DeckyGamePageAchievementBadgePalette {
  readonly accent: string;
  readonly accentBright: string;
  readonly border: string;
  readonly surface: string;
  readonly surfaceDeep: string;
  readonly track: string;
  readonly glow: string;
}

const BADGE_WIDTH = 292;
const BADGE_HEIGHT = 74;
const PROGRESS_RING_STROKE_WIDTH = 7.5;

const badgePalettes: Readonly<Record<DeckyGamePageAchievementBadgeVariant, DeckyGamePageAchievementBadgePalette>> = {
  perfected: {
    accent: "#d633ff",
    accentBright: "#f2a2ff",
    border: "#f4dcff",
    surface: "#5c067f",
    surfaceDeep: "#19002f",
    track: "rgba(104, 25, 137, 0.78)",
    glow: "rgba(207, 44, 255, 0.76)",
  },
  beaten: {
    accent: "#00b7ff",
    accentBright: "#85e8ff",
    border: "#e0f8ff",
    surface: "#004ea5",
    surfaceDeep: "#001438",
    track: "rgba(0, 53, 115, 0.88)",
    glow: "rgba(0, 184, 255, 0.72)",
  },
  mastered: {
    accent: "#28ef72",
    accentBright: "#a0ffc1",
    border: "#ddffe8",
    surface: "#00743b",
    surfaceDeep: "#002918",
    track: "rgba(0, 82, 42, 0.86)",
    glow: "rgba(39, 244, 112, 0.72)",
  },
  "in-progress": {
    accent: "#b5d8f6",
    accentBright: "#edf7ff",
    border: "#eef8ff",
    surface: "#26394f",
    surfaceDeep: "#0d1726",
    track: "rgba(53, 72, 94, 0.9)",
    glow: "rgba(190, 221, 247, 0.42)",
  },
  loading: {
    accent: "#b5d8f6",
    accentBright: "#edf7ff",
    border: "#eef8ff",
    surface: "#26394f",
    surfaceDeep: "#0d1726",
    track: "rgba(53, 72, 94, 0.9)",
    glow: "rgba(190, 221, 247, 0.42)",
  },
};

export function resolveDeckyGamePageAchievementBadgeProviderIconUrl(
  provider: DeckyGamePageAchievementBadgeProvider,
): string {
  return provider === "steam" ? steamIconUrl : RETROACHIEVEMENTS_PROVIDER_ICON_SRC;
}

function getBadgeShellStyle(palette: DeckyGamePageAchievementBadgePalette, focused: boolean): CSSProperties {
  return {
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
    overflow: "hidden",
    boxSizing: "border-box",
    border: `2px solid ${palette.border}`,
    borderRadius: BADGE_HEIGHT / 2,
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

function getBadgeGlossOverlayStyle(): CSSProperties {
  return {
    position: "absolute",
    zIndex: 1,
    inset: 2,
    borderRadius: BADGE_HEIGHT / 2,
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

function getPlatformMedallionStyle(palette: DeckyGamePageAchievementBadgePalette): CSSProperties {
  return {
    position: "relative",
    zIndex: 2,
    width: 68,
    height: 68,
    marginLeft: 1,
    flex: "0 0 68px",
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

function getProviderIconStyle(provider: DeckyGamePageAchievementBadgeProvider): CSSProperties {
  return {
    display: "block",
    width: provider === "steam" ? 42 : 52,
    height: provider === "steam" ? 42 : 52,
    objectFit: "contain",
    ...(provider === "steam" ? { filter: "brightness(0) invert(1)" } : {}),
  };
}

function getMaskedStatusAssetStyle(
  assetUrl: string,
  color: string,
  placement: Pick<CSSProperties, "width" | "height" | "top" | "left">,
): CSSProperties {
  const maskUrl = `url("${assetUrl}")`;

  return {
    position: "absolute",
    ...placement,
    backgroundColor: color,
    maskImage: maskUrl,
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "100% 100%",
    WebkitMaskImage: maskUrl,
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "100% 100%",
  };
}

function renderStatusIcon(
  variant: DeckyGamePageAchievementBadgeVariant,
  palette: DeckyGamePageAchievementBadgePalette,
): ReactNode {
  const shared = {
    color: palette.accent,
    filter: `drop-shadow(0 0 5px ${palette.glow})`,
  } satisfies CSSProperties;

  if (variant === "perfected" || variant === "mastered") {
    return (
      <span
        data-ac-game-page-badge-status-icon="crown-laurel"
        style={{ ...shared, position: "relative", display: "block", width: 48, height: 48 }}
      >
        <span style={getMaskedStatusAssetStyle(laurelIconUrl, palette.accent, { width: 48, height: 46, top: 1, left: 0 })} />
        <span style={getMaskedStatusAssetStyle(crownIconUrl, palette.accentBright, { width: 27, height: 27, top: 10, left: 10.5 })} />
      </span>
    );
  }

  if (variant === "beaten") {
    return (
      <svg data-ac-game-page-badge-status-icon="flag" height="48" viewBox="0 0 64 64" width="48" style={shared}>
        <defs>
          <clipPath id="ac-badge-checker-flag">
            <path d="M20 10c10-5 20 7 34 0v29c-14 7-24-7-34 0V10Z" />
          </clipPath>
        </defs>
        <path d="M17 57 21 7" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
        <g clipPath="url(#ac-badge-checker-flag)">
          <path d="M20 10c10-5 20 7 34 0v29c-14 7-24-7-34 0V10Z" fill={palette.accentBright} />
          <path d="M20 10h9v9h-9zM38 10h9v9h-9zM29 19h9v9h-9zM47 19h9v9h-9zM20 28h9v9h-9zM38 28h9v9h-9zM29 37h9v9h-9zM47 37h9v9h-9z" fill="currentColor" />
        </g>
        <path d="M20 10c10-5 20 7 34 0v29c-14 7-24-7-34 0V10Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg data-ac-game-page-badge-status-icon="bars" height="44" viewBox="0 0 54 54" width="44" style={shared}>
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
): ReactNode {
  const radius = 21;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - presentation.progress);
  const completed = presentation.variant === "perfected" || presentation.variant === "mastered";
  const ringGradientId = `ac-game-page-badge-ring-${presentation.variant}`;
  const ringCenterGradientId = `ac-game-page-badge-ring-center-${presentation.variant}`;

  return (
    <svg aria-hidden="true" height="54" viewBox="0 0 54 54" width="54" style={{ flex: "0 0 54px", overflow: "visible" }}>
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
        cx="27"
        cy="27"
        fill="none"
        r={radius}
        stroke={`url(#${ringGradientId})`}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
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
  focused = false,
}: {
  readonly presentation: DeckyGamePageAchievementBadgePresentation;
  readonly focused?: boolean | undefined;
}): JSX.Element {
  const palette = badgePalettes[presentation.variant];
  const providerIconUrl = resolveDeckyGamePageAchievementBadgeProviderIconUrl(presentation.provider);

  return (
    <span
      aria-hidden="true"
      data-ac-game-page-badge-variant={presentation.variant}
      style={getBadgeShellStyle(palette, focused)}
    >
      <span data-ac-game-page-badge-gloss="true" style={getBadgeGlossOverlayStyle()} />
      <span style={getPlatformMedallionStyle(palette)}>
        <img alt="" src={providerIconUrl} style={getProviderIconStyle(presentation.provider)} />
      </span>
      <span style={getBadgeContentStyle({ width: 1, height: 48, marginLeft: 7, background: "rgba(255,255,255,.16)", boxShadow: `0 0 8px ${palette.glow}` })} />
      <span style={getBadgeContentStyle({ width: 52, flex: "0 0 52px", display: "grid", placeItems: "center" })}>
        {renderStatusIcon(presentation.variant, palette)}
      </span>
      <span style={getBadgeContentStyle({ minWidth: 0, flex: "1 1 auto", display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, paddingLeft: 4 })}>
        <span style={{ color: "#ffffff", fontSize: presentation.variant === "loading" ? 12 : 13, fontWeight: 800, letterSpacing: "0.025em", lineHeight: 1, whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(0,0,0,.9)" }}>
          {presentation.statusLabel}
        </span>
        <span style={{ color: "#dcecff", fontSize: 17, fontWeight: 700, letterSpacing: "0.01em", lineHeight: 1, whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(0,0,0,.9)" }}>
          {presentation.countLabel}
        </span>
      </span>
      <span style={getBadgeContentStyle({ display: "grid", placeItems: "center", paddingRight: 7 })}>
        {renderProgressRing(presentation, palette)}
      </span>
    </span>
  );
}
