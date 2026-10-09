import type { CSSProperties } from "react";

/** Shared Achievement Companion visual foundations for QAM and full-screen. */
const contentCardGradient = "radial-gradient(circle at 18% 50%, rgba(43, 195, 242, 0.13), transparent 54%), linear-gradient(110deg, #071b29, #081824)";
const contentStatGradient = "radial-gradient(circle at 18% 50%, rgba(43, 195, 242, 0.1), transparent 54%), linear-gradient(110deg, #0a2638, #071c2c)";
const contentFocusOverlay = "linear-gradient(180deg, rgba(63, 149, 211, 0.26), rgba(31, 92, 141, 0.21))";
const contentSelectionOverlay = "linear-gradient(180deg,rgba(74,138,204,.4),rgba(34,79,124,.34))";

export const qamActivityCalendarColors = ["#1d3c51", "#21546f", "#267da9", "#2fb9ef", "#50d5ff"] as const;
export type QamActivityCalendarIntensity = 0 | 1 | 2 | 3 | 4;

export function getQamActivityCalendarLegendStyle(): CSSProperties {
  return {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
    marginTop: 7, color: achievementCompanionQamTheme.color.textMuted, fontSize: 8,
  };
}

export function getQamActivityCalendarLegendCellStyle(intensity: QamActivityCalendarIntensity): CSSProperties {
  return {
    width: 10, height: 10, borderRadius: 2,
    background: qamActivityCalendarColors[intensity],
  };
}

export const achievementCompanionQamTheme = {
  color: {
    background: "#06111a", surface: "#071b29", surfaceRaised: "#092334",
    surfaceInteractive: "#0b293d", textPrimary: "#f2f7fb", textSecondary: "#b7cad8",
    textMuted: "#8fa9bd", accent: "#2bc3f2", accentStrong: "#25bfff",
    borderSubtle: "rgba(68,151,204,.25)", borderStrong: "rgba(44,185,255,.75)",
    success: "#72e0a8", warning: "#f5d276", danger: "#ff7182", locked: "#9ba8b4",
  },
  surface: {
    page: "linear-gradient(120deg,#06111a,#071724 55%,#06121c)",
    card: "rgba(7,27,41,.88)", raised: "linear-gradient(90deg,rgba(9,35,52,.95),rgba(7,29,44,.9))",
    interactive: "rgba(9,39,58,.72)",
    contentCard: contentCardGradient,
    contentStat: contentStatGradient,
    focusedContentCard: `${contentFocusOverlay}, ${contentCardGradient}`,
    focusedContentStat: `${contentFocusOverlay}, ${contentStatGradient}`,
    selectedContentCard: `${contentSelectionOverlay}, ${contentCardGradient}`,
    focusedSelectedContentCard: `${contentFocusOverlay}, ${contentSelectionOverlay}, ${contentCardGradient}`,
    selectedContentStat: `${contentSelectionOverlay}, ${contentStatGradient}`,
    focusedSelectedContentStat: `${contentFocusOverlay}, ${contentSelectionOverlay}, ${contentStatGradient}`,
    selected: contentSelectionOverlay,
    primaryAction: "linear-gradient(180deg,rgba(34,155,232,.82),rgba(15,91,162,.88))",
    secondaryAction: "linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.045))",
    compactPrimaryAction: "linear-gradient(180deg,rgba(10,63,96,.82),rgba(7,43,67,.92))",
    compactRow: "linear-gradient(150deg,rgba(9,35,51,.88),rgba(7,27,41,.94))",
  },
  status: {
    danger: { text: "#ffc0c8", border: "rgba(255,67,91,.5)", surface: "linear-gradient(90deg,rgba(89,17,31,.56),rgba(57,15,27,.45))" },
    success: { text: "#a9e9c6", border: "rgba(49,226,142,.55)", surface: "rgba(10,57,43,.48)" },
  },
  loading: {
    spinnerSurface: "rgba(7,25,40,.96)",
    spinnerBorder: "rgba(151,225,255,.16)",
    spinnerGlow: "rgba(25,178,241,.18)",
    infoBorder: "rgba(72,155,222,.28)",
    infoSurface: "linear-gradient(135deg,rgba(17,37,57,.9),rgba(12,27,43,.78))",
  },
  type: {
    compact: { hero: 24, heading: 16, title: 14, body: 13, metadata: 11, caption: 10 },
    fullscreen: { hero: 28, heading: 20, title: 16, body: 14, metadata: 12, caption: 11 },
    weight: { regular: 400, medium: 600, strong: 700 },
    fontFamily: '"Motiva Sans", Arial, sans-serif',
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { small: 8, medium: 10, large: 14, panel: 20, pill: 999 },
  focus: {
    border: "rgba(105,176,255,.8)", background: "linear-gradient(180deg,rgba(74,138,204,.34),rgba(34,79,124,.3))",
    shadow: "0 0 0 2px rgba(73,155,255,.72),0 0 18px rgba(39,124,226,.35),inset 0 1px 0 rgba(255,255,255,.14)",
    insetShadow: "inset 0 0 0 1px rgba(125,190,255,.7),inset 0 0 0 999px rgba(73,155,255,.07)",
    primaryBorder: "rgba(255,255,255,.98)",
    primaryBackground: "linear-gradient(180deg,rgba(34,155,232,.92),rgba(15,91,162,.96))",
    primaryShadow: "0 0 0 3px rgba(255,255,255,.96),0 0 20px rgba(42,145,230,.52),inset 0 1px 0 rgba(255,255,255,.28)",
    compactBorder: "rgba(54,185,255,.92)",
    compactBackground: "linear-gradient(180deg,rgba(17,91,139,.78),rgba(8,53,82,.9))",
    compactShadow: "0 0 0 1px rgba(54,185,255,.72),0 0 13px rgba(54,185,255,.38),inset 0 1px 0 rgba(255,255,255,.1)",
  },
  selection: {
    compactText: "#69cfff",
    compactUnderline: "inset 0 -3px 0 rgba(54,185,255,.82)",
  },
} as const;

/** The compact action focus state used by Steam and provider-specific QAM actions. */
export function getQamCompactFocusControlStyle(): CSSProperties {
  return {
    border: `1px solid ${achievementCompanionQamTheme.focus.compactBorder}`,
    background: achievementCompanionQamTheme.focus.compactBackground,
    boxShadow: achievementCompanionQamTheme.focus.compactShadow,
    transition: "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
  };
}

/** A focus glow for controls whose own background and semantic border must remain visible. */
export function getQamCompactFocusRingStyle(focused: boolean): CSSProperties {
  return { boxShadow: focused ? achievementCompanionQamTheme.focus.compactShadow : "none" };
}

/** Quiet focus for informational cards that are controller stops but not actions. */
export function getQamPassiveCardFocusStyle(focused: boolean): CSSProperties {
  return { boxShadow: focused ? "inset 0 0 0 1px rgba(54, 185, 255, 0.09)" : "none" };
}

/** Shared row focus semantics, scoped to each provider's own theme root. */
export function getQamFocusStylesCss(themeAttribute: "data-ac-steam-theme" | "data-ac-ra-theme"): string {
  const root = `[${themeAttribute}]`;
  return `${root} .achievement-companion-focus-nav-row:focus-within,
  ${root} .achievement-companion-focus-achievement-row:focus-within,
  ${root} .achievement-companion-focus-nav-row.gpfocus,
  ${root} .achievement-companion-focus-achievement-row.gpfocus {
    box-shadow: ${achievementCompanionQamTheme.focus.insetShadow};
  }`;
}
