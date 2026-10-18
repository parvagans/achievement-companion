import type { CSSProperties } from "react";
import { DECKY_LOADING_COLORS, DECKY_LOADING_PAGE_BACKGROUND } from "./decky-brand-colors";

/** Shared Achievement Companion visual foundations for QAM and full-screen. */
const themeValue = (name: string, blue: string): string => `var(--ac-${name}, ${blue})`;
const contentCardGradient = themeValue("content-card", "radial-gradient(circle at 18% 50%, rgba(43, 195, 242, 0.13), transparent 54%), linear-gradient(110deg, #071b29, #081824)");
const contentStatGradient = themeValue("content-stat", "radial-gradient(circle at 18% 50%, rgba(43, 195, 242, 0.1), transparent 54%), linear-gradient(110deg, #0a2638, #071c2c)");
const contentFocusOverlay = themeValue("focus-overlay", "linear-gradient(180deg, rgba(63, 149, 211, 0.26), rgba(31, 92, 141, 0.21))");
const contentSelectionOverlay = themeValue("selection-overlay", "linear-gradient(180deg,rgba(74,138,204,.4),rgba(34,79,124,.34))");

export const qamActivityCalendarColors = [
  themeValue("calendar-0", "#1d3c51"), themeValue("calendar-1", "#21546f"),
  themeValue("calendar-2", "#267da9"), themeValue("calendar-3", "#2fb9ef"),
  themeValue("calendar-4", "#50d5ff"),
] as const;
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
    background: themeValue("background", "#06111a"), surface: themeValue("surface", "#071b29"), surfaceRaised: themeValue("surface-raised", "#092334"),
    surfaceInteractive: themeValue("surface-interactive", "#0b293d"), textPrimary: themeValue("text-primary", "#f2f7fb"), textSecondary: themeValue("text-secondary", "#b7cad8"),
    textMuted: themeValue("text-muted", "#8fa9bd"), accent: themeValue("accent", "#2bc3f2"), accentStrong: themeValue("accent-strong", "#25bfff"),
    borderSubtle: themeValue("border-subtle", "rgba(68,151,204,.25)"), borderStrong: themeValue("border-strong", "rgba(44,185,255,.75)"),
    primaryActionBorder: themeValue("primary-action-border", "rgba(44,185,255,.75)"),
    success: "#72e0a8", warning: "#f5d276", danger: "#ff7182", locked: "#9ba8b4",
  },
  surface: {
    page: themeValue("page", "linear-gradient(120deg,#06111a,#071724 55%,#06121c)"),
    card: themeValue("card", "rgba(7,27,41,.88)"), raised: themeValue("raised", "linear-gradient(90deg,rgba(9,35,52,.95),rgba(7,29,44,.9))"),
    interactive: themeValue("interactive", "rgba(9,39,58,.72)"),
    contentCard: contentCardGradient,
    contentStat: contentStatGradient,
    progressTrack: themeValue("progress-track", "rgba(143, 169, 189, 0.18)"),
    progressFill: themeValue("progress-fill", "linear-gradient(90deg,#159ccb,#2bc3f2)"),
    xpFill: themeValue("xp-fill", "linear-gradient(90deg,#3a96df,#76c7ff)"),
    focusedContentCard: `${contentFocusOverlay}, ${contentCardGradient}`,
    focusedContentStat: `${contentFocusOverlay}, ${contentStatGradient}`,
    selectedContentCard: `${contentSelectionOverlay}, ${contentCardGradient}`,
    focusedSelectedContentCard: `${contentFocusOverlay}, ${contentSelectionOverlay}, ${contentCardGradient}`,
    selectedContentStat: `${contentSelectionOverlay}, ${contentStatGradient}`,
    focusedSelectedContentStat: `${contentFocusOverlay}, ${contentSelectionOverlay}, ${contentStatGradient}`,
    selected: contentSelectionOverlay,
    primaryAction: themeValue("primary-action", "linear-gradient(180deg,rgba(34,155,232,.82),rgba(15,91,162,.88))"),
    activityTrendFill: themeValue("activity-trend-fill", "linear-gradient(#55d7ff, #1489c8)"),
    activityTrendEmpty: themeValue("activity-trend-empty", "#244258"),
    secondaryAction: "linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.045))",
    compactPrimaryAction: themeValue("compact-primary-action", "linear-gradient(180deg,rgba(10,63,96,.82),rgba(7,43,67,.92))"),
    compactRow: themeValue("compact-row", "linear-gradient(150deg,rgba(9,35,51,.88),rgba(7,27,41,.94))"),
  },
  status: {
    danger: { text: "#ffc0c8", border: "rgba(255,67,91,.5)", surface: "linear-gradient(90deg,rgba(89,17,31,.56),rgba(57,15,27,.45))" },
    success: { text: "#a9e9c6", border: "rgba(49,226,142,.55)", surface: "rgba(10,57,43,.48)" },
  },
  decorative: {
    iconFilter: themeValue("icon-filter", "brightness(0) saturate(100%) invert(78%) sepia(42%) saturate(1326%) hue-rotate(166deg) brightness(102%) contrast(101%)"),
    avatarBackground: themeValue("avatar-background", "linear-gradient(145deg, rgba(54, 185, 255, 0.2), rgba(5, 22, 34, 0.96))"),
    avatarGlow: themeValue("avatar-glow", "0 0 18px rgba(54, 185, 255, 0.26)"),
    accentGlow: themeValue("accent-glow", "0 0 12px rgba(54, 185, 255, 0.22)"),
    accentTextGlow: themeValue("accent-text-glow", "0 0 22px rgba(8, 213, 245, 0.24)"),
    primaryChipShadow: themeValue("primary-chip-shadow", "0 0 0 1px rgba(74, 189, 255, 0.52), 0 0 16px rgba(42, 145, 230, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.2)"),
    settingsSaveBorder: themeValue("settings-save-border", "rgba(56,177,241,.55)"),
    settingsSaveBackground: themeValue("settings-save-background", "rgba(11,80,121,.6)"),
    footerBackground: themeValue("footer-background", "linear-gradient(180deg, #09151f, #050e16)"),
    progressGlowRgb: themeValue("progress-glow-rgb", "54, 185, 255"),
  },
  loading: {
    page: themeValue("loading-page", DECKY_LOADING_PAGE_BACKGROUND),
    infoBackground: themeValue("loading-info-background", `linear-gradient(145deg, rgba(7, 24, 40, 0.96), rgba(6, 14, 27, 0.96)) padding-box, linear-gradient(112deg, ${DECKY_LOADING_COLORS.cyan}94, ${DECKY_LOADING_COLORS.blue}6e 54%, ${DECKY_LOADING_COLORS.magenta}7a) border-box`),
    infoShadow: themeValue("loading-info-shadow", "0 8px 26px rgba(0, 0, 0, 0.18), 0 0 24px rgba(15, 156, 239, 0.055)"),
    markBackground: themeValue("loading-mark-background", `radial-gradient(circle at 36% 24%, rgba(22, 50, 76, 0.98), ${DECKY_LOADING_COLORS.navy} 73%)`),
    markShadow: themeValue("loading-mark-shadow", "0 0 34px rgba(12, 177, 238, 0.19), 0 0 48px rgba(190, 43, 221, 0.07), inset 0 0 0 1px rgba(158, 229, 255, 0.16)"),
    ring: themeValue("loading-ring", `conic-gradient(from -28deg, ${DECKY_LOADING_COLORS.cyan} 0deg, ${DECKY_LOADING_COLORS.blue} 112deg, ${DECKY_LOADING_COLORS.violet} 214deg, ${DECKY_LOADING_COLORS.magenta} 280deg, rgba(27, 58, 107, 0.78) 281deg, rgba(27, 58, 107, 0.78) 360deg)`),
    well: themeValue("loading-well", "radial-gradient(circle at 38% 24%, #10253a, #050b14 74%)"),
    wellBorder: themeValue("loading-well-border", "rgba(136, 202, 241, 0.19)"),
    deckIconFilter: themeValue("loading-deck-icon-filter", "brightness(0) saturate(100%) invert(75%) sepia(90%) saturate(1724%) hue-rotate(151deg) brightness(103%) contrast(104%) drop-shadow(0 0 7px rgba(8, 213, 245, 0.32))"),
    badgeBackground: themeValue("loading-badge-background", "linear-gradient(145deg, #13243a, #07101d)"),
    badgeBorder: themeValue("loading-badge-border", "rgba(202, 230, 255, 0.62)"),
    badgeShadow: themeValue("loading-badge-shadow", "0 0 0 2px rgba(20, 123, 255, 0.46), 0 0 15px rgba(239, 56, 213, 0.2)"),
    providerIconFilter: themeValue("loading-provider-icon-filter", "brightness(0) invert(1) drop-shadow(0 0 4px rgba(8, 213, 245, 0.2))"),
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
  compactProfileSpacing: {
    section: 16,
    content: 10,
    item: 8,
    cardPadding: 12,
    listPadding: 10,
    rowPaddingBlock: 8,
  },
  radius: { small: 8, medium: 10, large: 14, panel: 20, pill: 999 },
  focus: {
    border: themeValue("focus-border", "rgba(105,176,255,.8)"), background: themeValue("focus-background", "linear-gradient(180deg,rgba(74,138,204,.34),rgba(34,79,124,.3))"),
    shadow: themeValue("focus-shadow", "0 0 0 2px rgba(73,155,255,.72),0 0 18px rgba(39,124,226,.35),inset 0 1px 0 rgba(255,255,255,.14)"),
    insetShadow: themeValue("focus-inset-shadow", "inset 0 0 0 1px rgba(125,190,255,.7),inset 0 0 0 999px rgba(73,155,255,.07)"),
    primaryBorder: themeValue("focus-primary-border", "rgba(83,193,255,.96)"),
    primaryBackground: themeValue("focus-primary-background", "linear-gradient(180deg,rgba(34,155,232,.92),rgba(15,91,162,.96))"),
    primaryShadow: themeValue("focus-primary-shadow", "0 0 0 3px rgba(83,193,255,.96),0 0 20px rgba(42,145,230,.52),inset 0 1px 0 rgba(255,255,255,.28)"),
    calendarDayShadow: themeValue("focus-calendar-day-shadow", "inset 0 0 0 1px #a9e9ff,0 0 5px rgba(80,213,255,.7)"),
    compactBorder: themeValue("focus-compact-border", "rgba(54,185,255,.92)"),
    compactBackground: themeValue("focus-compact-background", "linear-gradient(180deg,rgba(17,91,139,.78),rgba(8,53,82,.9))"),
    compactShadow: themeValue("focus-compact-shadow", "0 0 0 1px rgba(54,185,255,.72),0 0 13px rgba(54,185,255,.38),inset 0 1px 0 rgba(255,255,255,.1)"),
    passiveShadow: themeValue("focus-passive-shadow", "inset 0 0 0 1px rgba(54,185,255,.09)"),
  },
  selection: {
    compactText: themeValue("selection-text", "#69cfff"),
    compactUnderline: themeValue("selection-underline", "inset 0 -3px 0 rgba(54,185,255,.82)"),
  },
} as const;

export type AchievementCompanionAchievementRowDensity = "compact" | "fullscreen";

/** Shared achievement-row structure; providers supply only semantic colors, icons, and sourced values. */
export const achievementCompanionAchievementRowRecipes = {
  surface(density: AchievementCompanionAchievementRowDensity, accentColor: string, focused = false): CSSProperties {
    return {
      border: `1px solid ${achievementCompanionQamTheme.color.borderSubtle}`,
      borderLeft: `${density === "compact" ? 3 : 5}px solid ${accentColor}`,
      borderLeftColor: accentColor,
      background: focused ? achievementCompanionQamTheme.surface.focusedContentCard : achievementCompanionQamTheme.surface.contentCard,
      boxShadow: focused
        ? achievementCompanionQamTheme.focus.shadow
        : "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 2px 8px rgba(0, 0, 0, 0.16)",
    };
  },
  rail(density: AchievementCompanionAchievementRowDensity): CSSProperties {
    return {
      display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center",
      gap: density === "compact" ? 3 : 5, minWidth: density === "compact" ? 42 : 150,
      color: achievementCompanionQamTheme.color.textPrimary,
    };
  },
  railHeader: { display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 8 } satisfies CSSProperties,
  status(density: AchievementCompanionAchievementRowDensity, color: string): CSSProperties {
    return {
      color, fontSize: achievementCompanionQamTheme.type[density].caption,
      fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap",
    };
  },
  points(density: AchievementCompanionAchievementRowDensity): CSSProperties {
    return {
      display: "inline-flex", alignItems: "center", gap: density === "compact" ? 4 : 5,
      color: achievementCompanionQamTheme.color.textPrimary,
      fontSize: achievementCompanionQamTheme.type[density].metadata,
      fontWeight: 750, lineHeight: 1.1, whiteSpace: "nowrap",
    };
  },
  rarity: {
    root(density: AchievementCompanionAchievementRowDensity): CSSProperties {
      return {
        display: "flex", flexDirection: "column", alignItems: "flex-end",
        gap: density === "compact" ? 2 : 3, width: density === "compact" ? 68 : 132, minWidth: 0,
      };
    },
    track(density: AchievementCompanionAchievementRowDensity): CSSProperties {
      return {
        width: "100%", height: density === "compact" ? 3 : 4, overflow: "hidden",
        borderRadius: 999, background: "rgba(144, 184, 208, 0.28)",
      };
    },
    fill(percent: number): CSSProperties {
      return {
        height: "100%", width: `${Math.max(0, Math.min(100, percent))}%`,
        borderRadius: 999, background: achievementCompanionQamTheme.color.accent,
      };
    },
    label(density: AchievementCompanionAchievementRowDensity): CSSProperties {
      return {
        color: achievementCompanionQamTheme.color.textSecondary,
        fontSize: achievementCompanionQamTheme.type[density].caption,
        fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap",
      };
    },
  },
  date: {
    color: achievementCompanionQamTheme.color.textSecondary,
    fontSize: achievementCompanionQamTheme.type.fullscreen.caption,
    fontWeight: 600,
  } satisfies CSSProperties,
} as const;

/** A single surface for each compact profile activity list and its final action. */
export function getQamCompactProfileListCardStyle(): CSSProperties {
  const theme = achievementCompanionQamTheme;
  return {
    display: "flex",
    flexDirection: "column",
    gap: theme.compactProfileSpacing.content,
    minWidth: 0,
    padding: theme.compactProfileSpacing.listPadding,
    border: `1px solid ${theme.color.borderSubtle}`,
    borderRadius: theme.radius.large,
    background: theme.surface.contentCard,
    boxSizing: "border-box",
  };
}

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
  return { boxShadow: focused ? achievementCompanionQamTheme.focus.passiveShadow : "none" };
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
