import type { CSSProperties } from "react";
import { steamTheme } from "./steam-theme";

/** RetroAchievements presentation roles. Keep provider meaning here; Steam owns steam-theme.ts. */
export const raTheme = {
  color: {
    background: steamTheme.color.background,
    surface: steamTheme.color.surface,
    surfaceRaised: steamTheme.color.surfaceRaised,
    surfaceInteractive: steamTheme.color.surfaceInteractive,
    textPrimary: steamTheme.color.textPrimary,
    textSecondary: steamTheme.color.textSecondary,
    textMuted: steamTheme.color.textMuted,
    borderSubtle: steamTheme.color.borderSubtle,
    borderStrong: steamTheme.color.borderStrong,
    accent: steamTheme.color.accent,
    accentStrong: steamTheme.color.accentStrong,
    hardcore: "rgba(232, 201, 102, 0.96)",
    softcore: "rgba(220, 225, 233, 0.94)",
    mastered: "rgba(242, 216, 127, 0.98)",
    beaten: "rgba(230, 235, 242, 0.96)",
    unlocked: "rgba(102, 214, 255, 0.9)",
    locked: "rgba(185, 195, 207, 0.72)",
    points: "rgba(255, 211, 88, 0.98)",
    retroPoints: "rgba(102, 214, 255, 0.98)",
    success: steamTheme.color.success,
    warning: steamTheme.color.warning,
    danger: steamTheme.color.danger,
    rarity: {
      common: "rgba(82, 242, 156, 0.98)",
      uncommon: "rgba(102, 214, 255, 0.98)",
      rare: "rgba(192, 132, 252, 0.98)",
      veryRare: "rgba(243, 91, 213, 0.98)",
    },
  },
  surface: {
    page: steamTheme.surface.page,
    card: steamTheme.surface.card,
    raised: steamTheme.surface.raised,
    interactive: steamTheme.surface.interactive,
    selected: steamTheme.surface.selected,
    hardcore: "rgba(214, 178, 74, 0.12)",
    softcore: "rgba(214, 221, 232, 0.08)",
    locked: "rgba(255, 255, 255, 0.035)",
    error: steamTheme.status.danger.surface,
    success: steamTheme.status.success.surface,
    warning: "rgba(214, 158, 46, 0.12)",
  },
  type: {
    weight: steamTheme.type.weight,
    compact: steamTheme.type.compact,
    fullscreen: steamTheme.type.fullscreen,
  },
  space: steamTheme.space,
  radius: steamTheme.radius,
  density: {
    compact: { cardPadding: 10, rowGap: 8, artwork: 40, metricMinHeight: 44 },
    fullscreen: { cardPadding: 16, rowGap: 14, artwork: 72, metricMinHeight: 54 },
  },
  iconFilter: {
    primary: "brightness(0) saturate(100%) invert(78%) sepia(42%) saturate(1326%) hue-rotate(166deg) brightness(102%) contrast(101%)",
    muted: "grayscale(1) opacity(0.72)",
    hardcore: "brightness(0) saturate(100%) invert(83%) sepia(35%) saturate(674%) hue-rotate(2deg) brightness(105%) contrast(95%)",
    softcore: "brightness(0) saturate(100%) invert(91%) sepia(7%) saturate(326%) hue-rotate(183deg) brightness(96%) contrast(92%)",
    success: "brightness(0) saturate(100%) invert(79%) sepia(79%) saturate(493%) hue-rotate(91deg) brightness(105%) contrast(94%)",
  },
  focus: {
    border: steamTheme.focus.border,
    background: steamTheme.focus.background,
    shadow: steamTheme.focus.shadow,
    insetShadow: steamTheme.focus.insetShadow,
  },
  selection: { border: steamTheme.color.borderStrong, background: steamTheme.surface.selected },
} as const;

type RaDensity = "compact" | "fullscreen";
type RaTextRole = "hero" | "heading" | "title" | "body" | "metadata" | "caption";

export const raRecipes = {
  text(density: RaDensity, role: RaTextRole): CSSProperties {
    return {
      color: role === "hero" || role === "heading" ? raTheme.color.accent : role === "metadata" || role === "caption" ? raTheme.color.textMuted : raTheme.color.textPrimary,
      fontSize: raTheme.type[density][role],
      fontWeight: role === "hero" || role === "heading" || role === "title" ? raTheme.type.weight.strong : raTheme.type.weight.regular,
      lineHeight: role === "caption" ? 1.15 : 1.25,
    };
  },
  card(density: RaDensity, raised = false): CSSProperties {
    return {
      padding: raTheme.density[density].cardPadding,
      border: `1px solid ${raTheme.color.borderSubtle}`,
      borderRadius: raTheme.radius[density === "compact" ? "medium" : "large"],
      background: raised ? raTheme.surface.raised : raTheme.surface.card,
      boxSizing: "border-box",
    };
  },
  raisedCard(density: RaDensity): CSSProperties {
    return this.card(density, true);
  },
  row(density: RaDensity, focused = false): CSSProperties {
    return {
      ...this.card(density, true),
      display: "flex",
      alignItems: "center",
      gap: raTheme.space.md,
      borderColor: focused ? raTheme.focus.border : raTheme.color.borderSubtle,
      background: focused ? raTheme.focus.background : raTheme.surface.interactive,
      boxShadow: focused ? raTheme.focus.shadow : "none",
      outline: "none",
    };
  },
  metric(density: RaDensity): CSSProperties {
    return {
      ...this.card(density, true),
      minHeight: raTheme.density[density].metricMinHeight,
      display: "flex",
      alignItems: "center",
      gap: raTheme.space.md,
    };
  },
  action(density: RaDensity, primary = false, focused = false): CSSProperties {
    const compact = density === "compact";
    return {
      ...this.card(density, true),
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: raTheme.space.sm,
      width: "100%",
      minWidth: 0,
      minHeight: compact ? (primary ? 38 : undefined) : 48,
      padding: compact ? (primary ? "8px 12px" : 8) : "12px 16px",
      border: `1px solid ${focused ? steamTheme.focus.compactBorder : primary ? raTheme.color.borderStrong : raTheme.color.borderSubtle}`,
      borderRadius: raTheme.radius[compact ? "medium" : "large"],
      background: focused ? steamTheme.focus.compactBackground : primary ? steamTheme.surface.compactPrimaryAction : steamTheme.surface.compactRow,
      boxShadow: focused ? steamTheme.focus.compactShadow : primary ? "inset 0 1px 0 rgba(125, 211, 252, 0.08), 0 4px 12px rgba(0, 0, 0, 0.16)" : "inset 0 1px 0 rgba(255, 255, 255, 0.025)",
      color: raTheme.color.textPrimary,
      cursor: "pointer",
      outline: "none",
      boxSizing: "border-box",
    };
  },
  filter(selected: boolean, focused: boolean): CSSProperties {
    const surface = this.action("compact", false, focused);
    return {
      ...surface,
      flex: "1 1 0",
      minHeight: 32,
      padding: "7px 3px",
      borderRadius: raTheme.radius.small,
      fontSize: 11,
      fontWeight: selected ? raTheme.type.weight.strong : raTheme.type.weight.medium,
      lineHeight: 1.15,
      textAlign: "center",
      whiteSpace: "normal",
      overflowWrap: "anywhere",
      color: selected ? steamTheme.selection.compactText : raTheme.color.textSecondary,
      boxShadow: selected ? `${String(surface.boxShadow)}, ${steamTheme.selection.compactUnderline}` : surface.boxShadow,
    };
  },
  badge(kind: "default" | "hardcore" | "softcore" | "beaten" | "mastered" | "points" | "retroPoints" | "warning"): CSSProperties {
    const color = kind === "hardcore" ? raTheme.color.hardcore
      : kind === "softcore" ? raTheme.color.softcore
        : kind === "beaten" ? raTheme.color.beaten
          : kind === "mastered" ? raTheme.color.mastered
            : kind === "points" ? raTheme.color.points
                : kind === "retroPoints" ? raTheme.color.retroPoints
                  : kind === "warning" ? raTheme.color.warning : raTheme.color.textSecondary;
    const semanticSurface = kind === "hardcore" ? raTheme.surface.hardcore
      : kind === "softcore" ? raTheme.surface.softcore
        : kind === "beaten" ? raRecipes.gameAward.beaten.surface
        : kind === "mastered" ? raRecipes.gameAward.mastered.surface
          : kind === "warning" ? raTheme.surface.warning : raTheme.surface.interactive;
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: raTheme.space.xs,
      padding: "4px 8px",
      border: `1px solid ${color}`,
      borderRadius: raTheme.radius.pill,
      background: semanticSurface,
      color,
      fontSize: raTheme.type.compact.caption,
      fontWeight: raTheme.type.weight.strong,
      lineHeight: 1.15,
    };
  },
  artwork(variant: "compact" | "fullscreen"): CSSProperties {
    return {
      border: `1px solid ${raTheme.color.borderSubtle}`,
      borderRadius: raTheme.radius[variant === "compact" ? "medium" : "large"],
      background: raTheme.surface.raised,
      boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 4px 16px rgba(0, 0, 0, 0.2)",
      overflow: "hidden",
    };
  },
  completionIndicator(state: "beaten" | "mastered", hardcore: boolean): CSSProperties {
    const color = state === "mastered" ? raTheme.color.mastered : raTheme.color.beaten;
    return {
      border: `2px solid ${color}`,
      backgroundColor: hardcore ? color : "transparent",
      boxShadow: hardcore ? `0 0 10px ${state === "mastered" ? "rgba(242, 216, 127, 0.32)" : "rgba(230, 235, 242, 0.3)"}`
        : `inset 0 0 0 1px rgba(0, 0, 0, 0.34), 0 0 8px ${state === "mastered" ? "rgba(242, 216, 127, 0.16)" : "rgba(230, 235, 242, 0.16)"}`,
    };
  },
  progressTrack: { background: "rgba(185, 195, 207, 0.18)", borderRadius: 999, overflow: "hidden" } satisfies CSSProperties,
  progressFill: {
    completion: `linear-gradient(90deg, ${raTheme.color.accentStrong}, ${raTheme.color.accent})`,
    xp: `linear-gradient(90deg, ${raTheme.color.retroPoints}, ${raTheme.color.accent})`,
    beaten: `linear-gradient(90deg, ${raTheme.color.beaten}, rgba(223, 230, 239, 0.98))`,
    mastered: `linear-gradient(90deg, ${raTheme.color.mastered}, rgba(232, 201, 102, 0.98))`,
  },
  achievementState: {
    locked: { color: raTheme.color.locked, artworkFilter: "grayscale(1) contrast(1.08) brightness(0.9)" },
    unlocked: { color: raTheme.color.unlocked, artworkFilter: "none" },
    hardcore: { color: raTheme.color.hardcore, surface: raTheme.surface.hardcore },
    softcore: { color: raTheme.color.softcore, surface: raTheme.surface.softcore },
  },
  gameAward: {
    beaten: { color: raTheme.color.beaten, border: "rgba(214, 221, 232, 0.42)", surface: "rgba(214, 221, 232, 0.1)" },
    mastered: { color: raTheme.color.mastered, border: "rgba(232, 201, 102, 0.52)", surface: "rgba(214, 178, 74, 0.16)" },
  },
  profileSection: {
    card(variant: "softcore" | "hardcore" | "retroachievements" | "completion" | "default"): CSSProperties {
      const color = variant === "softcore" ? raTheme.color.softcore : variant === "hardcore" ? raTheme.color.hardcore : variant === "default" ? raTheme.color.borderSubtle : raTheme.color.accent;
      const surface = variant === "softcore" ? raTheme.surface.softcore : variant === "hardcore" ? raTheme.surface.hardcore : variant === "default" ? raTheme.surface.card : raTheme.surface.interactive;
      return { ...raRecipes.card("fullscreen", true), gap: 10, padding: 12, borderLeft: `4px solid ${color}`, background: surface };
    },
    title(variant: "softcore" | "hardcore" | "retroachievements" | "completion" | "default"): CSSProperties {
      const color = variant === "softcore" ? raTheme.color.softcore : variant === "hardcore" ? raTheme.color.hardcore : variant === "default" ? raTheme.color.textMuted : raTheme.color.accent;
      return { color, fontSize: raTheme.type.fullscreen.caption, fontWeight: raTheme.type.weight.strong, letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1.2 };
    },
    accent(variant: "softcore" | "hardcore" | "retroachievements" | "completion" | "default"): CSSProperties {
      const color = variant === "softcore" ? raTheme.color.softcore : variant === "hardcore" ? raTheme.color.hardcore : variant === "default" ? raTheme.color.borderSubtle : raTheme.color.accent;
      return { position: "absolute", inset: "10px auto 10px 0", width: 4, borderTopLeftRadius: 999, borderBottomLeftRadius: 999, background: `linear-gradient(180deg, ${color}, transparent)` };
    },
  },
  reward: { points: raTheme.color.points, retroPoints: raTheme.color.retroPoints },
  inputFrame: { border: `1px solid ${raTheme.color.borderSubtle}`, borderRadius: raTheme.radius.small, background: raTheme.color.surfaceInteractive } satisfies CSSProperties,
  state(kind: "loading" | "empty" | "error"): CSSProperties {
    return { textAlign: "center", color: kind === "error" ? raTheme.color.danger : raTheme.color.textSecondary, padding: raTheme.space.lg };
  },
} as const;

/** Scoped visual focus only. GamepadUI continues to own focus and navigation. */
export function getRaFocusStylesCss(): string {
  return `[data-ac-ra-theme] .achievement-companion-focus-nav-row.gpfocus,
  [data-ac-ra-theme] .achievement-companion-focus-achievement-row.gpfocus,
  [data-ac-ra-theme] .achievement-companion-focus-nav-row:focus-within,
  [data-ac-ra-theme] .achievement-companion-focus-achievement-row:focus-within {
    box-shadow: ${raTheme.focus.insetShadow};
  }
  [data-ac-ra-theme] .Panel.Focusable.gpfocus {
    border-color: ${raTheme.focus.border} !important;
    background: ${raTheme.focus.background} !important;
    box-shadow: ${raTheme.focus.shadow} !important;
  }
  [data-ac-ra-theme] .achievement-companion-achievement-filter-option.achievement-companion-achievement-filter-option--selected {
    border-color: ${raTheme.selection.border}; background: ${raTheme.selection.background};
  }
  [data-ac-ra-theme] .achievement-companion-achievement-filter-option:is(.achievement-companion-achievement-filter-option--focused,.gpfocus,.gpfocuswithin,:focus,:focus-within) {
    border-color: ${raTheme.focus.border}; box-shadow: ${raTheme.focus.shadow};
  }`;
}
