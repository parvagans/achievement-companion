import type { CSSProperties } from "react";
import {
  achievementCompanionQamTheme as qamTheme,
  getQamActivityCalendarLegendCellStyle,
  getQamActivityCalendarLegendStyle,
  getQamCompactFocusControlStyle,
  getQamCompactFocusRingStyle,
  getQamCompactProfileListCardStyle,
  getQamFocusStylesCss,
  getQamPassiveCardFocusStyle,
  qamActivityCalendarColors,
} from "./decky-qam-theme";
import { getDeckyCompactPrimaryActionStyle } from "./decky-compact-primary-action-style";

/** RetroAchievements semantic roles layered on the provider-neutral visual system. */
export const raTheme = {
  color: {
    background: qamTheme.color.background,
    surface: qamTheme.color.surface,
    surfaceRaised: qamTheme.color.surfaceRaised,
    surfaceInteractive: qamTheme.color.surfaceInteractive,
    textPrimary: qamTheme.color.textPrimary,
    textSecondary: qamTheme.color.textSecondary,
    textMuted: qamTheme.color.textMuted,
    borderSubtle: qamTheme.color.borderSubtle,
    borderStrong: qamTheme.color.borderStrong,
    accent: qamTheme.color.accent,
    accentStrong: qamTheme.color.accentStrong,
    hardcore: "rgba(232, 201, 102, 0.96)",
    softcore: "rgba(220, 225, 233, 0.94)",
    hardcoreSubtleBorder: "rgba(232, 201, 102, 0.34)",
    softcoreSubtleBorder: "rgba(220, 225, 233, 0.33)",
    mastered: "rgba(242, 216, 127, 0.98)",
    beaten: "rgba(230, 235, 242, 0.96)",
    beatenFlagWhite: "#ffffff",
    beatenFlagBlack: "#000000",
    unlocked: "rgba(102, 214, 255, 0.9)",
    locked: "rgba(185, 195, 207, 0.72)",
    points: "rgba(255, 211, 88, 0.98)",
    retroPoints: qamTheme.color.accent,
    success: qamTheme.color.success,
    warning: qamTheme.color.warning,
    danger: qamTheme.color.danger,
    rarity: {
      common: "rgba(82, 242, 156, 0.98)",
      uncommon: qamTheme.color.accent,
      rare: "rgba(192, 132, 252, 0.98)",
      veryRare: "rgba(243, 91, 213, 0.98)",
    },
  },
  surface: {
    page: qamTheme.surface.page,
    card: qamTheme.surface.card,
    raised: qamTheme.surface.raised,
    contentCard: qamTheme.surface.contentCard,
    contentStat: qamTheme.surface.contentStat,
    focusedContentCard: qamTheme.surface.focusedContentCard,
    focusedContentStat: qamTheme.surface.focusedContentStat,
    selectedContentCard: qamTheme.surface.selectedContentCard,
    focusedSelectedContentCard: qamTheme.surface.focusedSelectedContentCard,
    selectedContentStat: qamTheme.surface.selectedContentStat,
    focusedSelectedContentStat: qamTheme.surface.focusedSelectedContentStat,
    interactive: qamTheme.surface.interactive,
    selected: qamTheme.surface.selected,
    hardcore: "rgba(214, 178, 74, 0.12)",
    softcore: "rgba(214, 221, 232, 0.08)",
    locked: "rgba(255, 255, 255, 0.035)",
    error: qamTheme.status.danger.surface,
    success: qamTheme.status.success.surface,
    warning: "rgba(214, 158, 46, 0.12)",
  },
  type: {
    weight: qamTheme.type.weight,
    compact: qamTheme.type.compact,
    fullscreen: qamTheme.type.fullscreen,
  },
  space: qamTheme.space,
  radius: qamTheme.radius,
  density: {
    compact: { cardPadding: 10, rowGap: 8, artwork: 40, metricMinHeight: 44 },
    fullscreen: { cardPadding: 16, rowGap: 14, artwork: 72, metricMinHeight: 54 },
  },
  iconFilter: {
    primary: qamTheme.decorative.iconFilter,
    muted: "grayscale(1) opacity(0.72)",
    hardcore: "brightness(0) saturate(100%) invert(83%) sepia(35%) saturate(674%) hue-rotate(2deg) brightness(105%) contrast(95%)",
    softcore: "brightness(0) saturate(100%) invert(91%) sepia(7%) saturate(326%) hue-rotate(183deg) brightness(96%) contrast(92%)",
    success: "brightness(0) saturate(100%) invert(79%) sepia(79%) saturate(493%) hue-rotate(91deg) brightness(105%) contrast(94%)",
  },
  focus: {
    ...qamTheme.focus,
  },
  selection: { border: qamTheme.color.borderStrong, background: qamTheme.surface.selected },
} as const;

/** Tuned against the RA game-icon prestige-frame visual reference. */
export const RA_GAME_ICON_PRESTIGE_MOTION = {
  circuitSeconds: 2.5,
  glowMultiplier: 2.5,
  sweepWidthMultiplier: 1.8,
} as const;

type RaDensity = "compact" | "fullscreen";
type RaTextRole = "hero" | "heading" | "title" | "body" | "metadata" | "caption";

export const raRecipes = {
  text(density: RaDensity, role: RaTextRole): CSSProperties {
    return {
      fontFamily: qamTheme.type.fontFamily,
      color: role === "metadata" || role === "caption" ? raTheme.color.textSecondary : raTheme.color.textPrimary,
      fontSize: raTheme.type[density][role],
      fontWeight: role === "hero" || role === "heading" || role === "title" ? raTheme.type.weight.strong : raTheme.type.weight.regular,
      lineHeight: 1.3,
    };
  },
  card(density: RaDensity, raised = false): CSSProperties {
    return {
      padding: raTheme.density[density].cardPadding,
      border: `1px solid ${raTheme.color.borderSubtle}`,
      borderRadius: raTheme.radius.large,
      background: raised ? raTheme.surface.contentStat : raTheme.surface.contentCard,
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
      borderColor: focused ? raTheme.focus.compactBorder : raTheme.color.borderSubtle,
      background: focused ? raTheme.surface.focusedContentCard : raTheme.surface.contentCard,
      boxShadow: focused ? raTheme.focus.compactShadow : "none",
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
    if (density === "compact" && primary) return getDeckyCompactPrimaryActionStyle(focused);
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
      border: `1px solid ${primary ? raTheme.color.borderStrong : raTheme.color.borderSubtle}`,
      borderRadius: raTheme.radius[compact ? "medium" : "large"],
      background: primary ? qamTheme.surface.compactPrimaryAction : qamTheme.surface.contentStat,
      boxShadow: primary ? "inset 0 1px 0 rgba(125, 211, 252, 0.08), 0 4px 12px rgba(0, 0, 0, 0.16)" : "inset 0 1px 0 rgba(255, 255, 255, 0.025)",
      color: raTheme.color.textPrimary,
      cursor: "pointer",
      outline: "none",
      boxSizing: "border-box",
      transition: "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
      ...(focused ? { ...getQamCompactFocusControlStyle(), background: primary ? qamTheme.focus.primaryBackground : qamTheme.surface.focusedContentStat } : {}),
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
      color: selected ? qamTheme.selection.compactText : raTheme.color.textSecondary,
      boxShadow: selected ? `${String(surface.boxShadow)}, ${qamTheme.selection.compactUnderline}` : surface.boxShadow,
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
  progressTrack: { background: qamTheme.surface.progressTrack, borderRadius: 999, overflow: "hidden" } satisfies CSSProperties,
  progressFill: {
    completion: qamTheme.surface.progressFill,
    xp: qamTheme.surface.xpFill,
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
    beaten: {
      color: raTheme.color.beaten, border: "rgba(230, 235, 242, 0.9)", surface: "rgba(230, 235, 242, 0.2)",
      metalDark: "#4a5966", metalMid: "#a6b5c2", metalLight: "#f5f9ff",
      innerHighlight: "rgba(238, 247, 255, 0.72)", bloom: "rgba(216, 236, 255, 0.58)",
    },
    mastered: {
      color: raTheme.color.mastered, border: "rgba(242, 216, 127, 0.96)", surface: "rgba(242, 216, 127, 0.27)",
      metalDark: "#6b4814", metalMid: "#d3a43f", metalLight: "#fff0b6",
      innerHighlight: "rgba(255, 229, 151, 0.88)", bloom: "rgba(255, 207, 86, 0.78)",
    },
  },
  gameIcon: {
    frameWidth(size: number, kind: "beaten" | "mastered" | undefined): number {
      if (kind === undefined) return 1;
      if (size < 48) return kind === "mastered" ? 3 : 2.5;
      if (size < 96) return kind === "mastered" ? 4 : 3;
      return kind === "mastered" ? 5 : 4;
    },
    radius(size: number): number {
      return size < 48 ? raTheme.radius.small : size < 96 ? raTheme.radius.medium : raTheme.radius.large;
    },
    frame(size: number, kind: "beaten" | "mastered" | undefined): CSSProperties {
      const edge = this.frameWidth(size, kind);
      const radius = this.radius(size);
      const tone = kind === undefined ? undefined : raRecipes.gameAward[kind];
      const baseFrameGlow = kind === "mastered" ? 8 : 5;
      const baseBloomRadius = size < 48 ? 2 : size < 96 ? 3 : 5;
      return {
        position: "relative", isolation: "isolate", display: "inline-block",
        width: size, height: size, flex: `0 0 ${size}px`, boxSizing: "border-box",
        borderRadius: radius, overflow: "visible",
        border: `1px solid ${tone?.metalDark ?? raTheme.color.borderSubtle}`,
        background: tone === undefined ? raTheme.surface.raised :
          `linear-gradient(135deg, ${tone.metalDark} 0%, ${tone.metalMid} 12%, ${tone.metalLight} 24%, ${tone.metalMid} 33%, ${tone.metalDark} 51%, ${tone.metalMid} 68%, ${tone.metalLight} 81%, ${tone.metalMid} 90%, ${tone.metalDark} 100%)`,
        boxShadow: tone === undefined
          ? "inset 0 1px 0 rgba(255, 255, 255, 0.04)"
          : `0 0 0 1px ${tone.metalDark}, 0 0 ${baseFrameGlow * RA_GAME_ICON_PRESTIGE_MOTION.glowMultiplier}px ${tone.surface}, inset 0 1px 0 ${tone.innerHighlight}`,
        "--ac-ra-game-icon-sweep-width": `${edge * RA_GAME_ICON_PRESTIGE_MOTION.sweepWidthMultiplier}px`,
        "--ac-ra-game-icon-frame-width": `${edge}px`,
        "--ac-ra-game-icon-sweep-color": tone?.metalLight,
        "--ac-ra-game-icon-sweep-mid": tone?.metalMid,
        "--ac-ra-game-icon-metal-dark": tone?.metalDark,
        "--ac-ra-game-icon-bloom-color": tone?.bloom,
        "--ac-ra-game-icon-bloom-radius": `${baseBloomRadius * RA_GAME_ICON_PRESTIGE_MOTION.glowMultiplier}px`,
        "--ac-ra-game-icon-corner-size": `${size < 48 ? 5 : size < 96 ? 7 : 10}px`,
        "--ac-ra-game-icon-corner-opacity": kind === "mastered" ? "0.95" : "0.72",
      } as CSSProperties;
    },
    artwork(size: number, kind: "beaten" | "mastered" | undefined): CSSProperties {
      const inset = kind === undefined ? 0 : this.frameWidth(size, kind);
      return {
        position: "absolute", zIndex: 1, inset, display: "block", overflow: "hidden",
        borderRadius: Math.max(3, this.radius(size) - inset), background: raTheme.surface.raised,
        ...(kind === undefined ? {} : { boxShadow: `0 0 0 1px ${raRecipes.gameAward[kind].innerHighlight}` }),
      };
    },
    fallback(size: number): CSSProperties {
      return {
        display: "grid", placeItems: "center", width: "100%", height: "100%",
        color: raTheme.color.textPrimary, fontSize: Math.max(10, Math.round(size * 0.28)),
        fontWeight: raTheme.type.weight.strong,
      };
    },
  },
  compactGame: {
    root: { display: "flex", flexDirection: "column", gap: 8, width: "100%", minWidth: 0, padding: "0 16px 4px", boxSizing: "border-box", color: raTheme.color.textPrimary, fontFamily: qamTheme.type.fontFamily } satisfies CSSProperties,
    hero(): CSSProperties { return { display: "flex", justifyContent: "center", width: "100%", height: 124, minWidth: 0, overflow: "hidden", padding: 0, background: "transparent", boxSizing: "border-box" }; },
    title: { minWidth: 0, color: raTheme.color.textPrimary, fontSize: 16, fontWeight: 850, lineHeight: 1.16, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } satisfies CSSProperties,
    provider: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", color: raTheme.color.textSecondary, fontSize: raTheme.type.compact.body, fontWeight: 750, lineHeight: 1 } satisfies CSSProperties,
    providerContent: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minWidth: 0 } satisfies CSSProperties,
    actionLabel: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minWidth: 0, color: raTheme.color.textPrimary, fontSize: raTheme.type.compact.body, fontWeight: 800, lineHeight: 1.15 } satisfies CSSProperties,
    actionIcon: { width: 17, height: 17, filter: raTheme.iconFilter.primary } satisfies CSSProperties,
    section(focused: boolean): CSSProperties { return { ...raRecipes.card("compact"), display: "flex", flexDirection: "column", gap: 6, width: "100%", minWidth: 0, padding: "9px 10px", ...getQamPassiveCardFocusStyle(focused), boxSizing: "border-box" }; },
    sectionLabel: { color: raTheme.color.accent, fontSize: raTheme.type.compact.metadata, fontWeight: 850, letterSpacing: "0.055em", lineHeight: 1.1, textTransform: "uppercase" } satisfies CSSProperties,
    progress: { display: "flex", alignItems: "center", gap: 6, color: raTheme.color.textPrimary, fontSize: 12, fontWeight: 800, lineHeight: 1.1 } satisfies CSSProperties,
    metricGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, width: "100%" } satisfies CSSProperties,
    metric(): CSSProperties { return { ...raRecipes.metric("compact"), display: "grid", gridTemplateColumns: "26px minmax(0, 1fr)", alignItems: "center", gap: 6, minWidth: 0, minHeight: 48, padding: "7px 8px", boxSizing: "border-box" }; },
    statMetric(): CSSProperties { return { ...raRecipes.metric("compact"), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, minWidth: 0, minHeight: 48, padding: "6px 4px", boxSizing: "border-box", textAlign: "center" }; },
    statGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 5, width: "100%" } satisfies CSSProperties,
    metricText: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, minWidth: 0, textAlign: "center" } satisfies CSSProperties,
    metricLabel: { color: raTheme.color.textSecondary, fontSize: raTheme.type.compact.caption, fontWeight: 800, letterSpacing: "0.04em", lineHeight: 1.1, textTransform: "uppercase" } satisfies CSSProperties,
    metricValue: { minWidth: 0, overflow: "hidden", color: raTheme.color.textPrimary, fontSize: 12, fontWeight: 800, lineHeight: 1.15, textOverflow: "ellipsis", whiteSpace: "nowrap" } satisfies CSSProperties,
    metricSecondary: { color: raTheme.color.textMuted, fontSize: raTheme.type.compact.caption, lineHeight: 1.12 } satisfies CSSProperties,
    mode(mode: "hardcore" | "softcore"): CSSProperties { return { display: "grid", gridTemplateColumns: "22px minmax(0, 1fr)", alignItems: "center", gap: 6, minWidth: 0, minHeight: 48, padding: "7px 8px", border: `1px solid ${raTheme.color.borderSubtle}`, borderLeft: `3px solid ${mode === "hardcore" ? raTheme.color.hardcore : raTheme.color.softcore}`, borderRadius: raTheme.radius.small, background: raTheme.surface.contentStat, boxSizing: "border-box" }; },
    modeText: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 } satisfies CSSProperties,
    modeLabel: { fontSize: raTheme.type.compact.caption, fontWeight: 800, lineHeight: 1, textTransform: "uppercase" } satisfies CSSProperties,
    modeValue: { color: raTheme.color.textPrimary, fontSize: raTheme.type.compact.body, fontWeight: 800, lineHeight: 1.12, whiteSpace: "nowrap" } satisfies CSSProperties,
    status(kind: "beaten" | "mastered", surface: "profile" | "game" = "profile"): CSSProperties {
      const mastered = kind === "mastered";
      const accent = mastered ? raTheme.color.mastered : surface === "game" ? raRecipes.gameAward.beaten.border : raTheme.color.beaten;
      return {
        position: "relative", isolation: "isolate", display: "grid", gridTemplateColumns: "62px minmax(0, 1fr)",
        alignItems: "center", gap: 10, minWidth: 0, minHeight: 90, overflow: "hidden", padding: "9px 11px",
        border: `2px solid ${accent}`, borderRadius: raTheme.radius.medium, boxSizing: "border-box",
        background: `${mastered ? "radial-gradient(circle at 11% 50%, rgba(242, 216, 127, 0.15), transparent 48%)" : "radial-gradient(circle at 11% 50%, rgba(214, 221, 232, 0.12), transparent 48%)"}, ${raTheme.surface.contentCard}`,
        boxShadow: `0 0 12px ${mastered ? "rgba(242, 216, 127, 0.16)" : raRecipes.gameAward.beaten.surface}, inset 0 1px 0 rgba(255, 255, 255, 0.07)`,
      };
    },
    statusEmblem(kind: "beaten" | "mastered", surface: "profile" | "game" = "profile"): CSSProperties {
      const color = kind === "mastered" ? raTheme.color.mastered : surface === "game" ? raRecipes.gameAward.beaten.border : raTheme.color.beaten;
      const background = surface === "profile"
        ? kind === "mastered"
          ? "radial-gradient(circle at 50% 42%, rgba(242, 216, 127, 0.30), rgba(68, 49, 20, 0.92) 78%)"
          : "radial-gradient(circle at 50% 42%, rgba(178, 201, 215, 0.40), rgba(34, 53, 67, 0.96) 78%)"
        : "rgba(3, 13, 21, 0.68)";
      return { position: "relative", zIndex: 1, display: "grid", placeItems: "center", width: 60, height: 60, flex: "0 0 60px", border: `2px solid ${color}`, borderRadius: "50%", background, boxShadow: `0 0 11px ${kind === "mastered" ? "rgba(242, 216, 127, 0.37)" : raRecipes.gameAward.beaten.surface}`, boxSizing: "border-box" };
    },
    statusContent: { position: "relative", zIndex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, minWidth: 0 } satisfies CSSProperties,
    statusEyebrow: { color: raTheme.color.accent, fontSize: raTheme.type.compact.caption, fontWeight: 800, letterSpacing: "0.06em", lineHeight: 1.1, textTransform: "uppercase" } satisfies CSSProperties,
    statusTitle(kind: "beaten" | "mastered"): CSSProperties { return { color: kind === "mastered" ? raTheme.color.mastered : raTheme.color.textPrimary, fontSize: 20, fontWeight: 850, lineHeight: 1.04 }; },
    statusDate: { color: raTheme.color.textSecondary, fontSize: raTheme.type.compact.metadata, lineHeight: 1.2, overflowWrap: "anywhere" } satisfies CSSProperties,
    statusWatermark: { position: "absolute", zIndex: 0, top: -18, right: -8, opacity: 0.08, pointerEvents: "none" } satisfies CSSProperties,
    info: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "5px 10px", width: "100%", paddingTop: 2 } satisfies CSSProperties,
    infoLabel: { color: raTheme.color.textSecondary, fontSize: raTheme.type.compact.caption, lineHeight: 1.2 } satisfies CSSProperties,
    infoValue: { minWidth: 0, overflow: "hidden", color: raTheme.color.textPrimary, fontSize: raTheme.type.compact.caption, fontWeight: 700, lineHeight: 1.2, textAlign: "right", textOverflow: "ellipsis", whiteSpace: "nowrap" } satisfies CSSProperties,
  },
  gameStatusBanner: {
    root(kind: "in-progress" | "beaten" | "mastered"): CSSProperties {
      const base = kind === "in-progress"
        ? {
            border: `2px solid ${raTheme.color.accentStrong}`,
            background: raTheme.surface.contentCard,
            boxShadow: `${qamTheme.decorative.accentGlow}, inset 0 1px 0 rgba(255, 255, 255, 0.07)`,
          }
        : raRecipes.compactGame.status(kind, "game");
      return {
        ...base,
        position: "relative",
        isolation: "isolate",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.55fr) minmax(0, 1.15fr)",
        alignItems: "stretch",
        gap: 10,
        width: "100%",
        minWidth: 0,
        minHeight: 113,
        padding: "8px 11px 8px 21px",
        borderRadius: raTheme.radius.large,
        overflow: "hidden",
        boxSizing: "border-box",
      };
    },
    accent(kind: "in-progress" | "beaten" | "mastered"): CSSProperties {
      const color = kind === "mastered" ? raTheme.color.mastered : kind === "beaten" ? raRecipes.gameAward.beaten.border : raTheme.color.accentStrong;
      return {
        position: "absolute", top: 8, bottom: 8, left: 8, width: 4,
        borderRadius: raTheme.radius.pill, background: color,
        boxShadow: kind === "mastered" ? "0 0 10px rgba(242, 216, 127, 0.45)" : kind === "beaten" ? `0 0 10px ${raRecipes.gameAward.beaten.surface}` : qamTheme.decorative.accentGlow,
        pointerEvents: "none",
      };
    },
    main: {
      position: "relative", zIndex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
      gap: 4, minWidth: 0,
    } satisfies CSSProperties,
    modeChip: {
      display: "inline-flex", alignItems: "center", alignSelf: "flex-start", gap: 5,
      minHeight: 20, padding: "2px 7px", border: `1px solid ${raTheme.color.accentStrong}`,
      borderRadius: raTheme.radius.pill, background: "rgba(3, 22, 35, 0.78)",
      color: raTheme.color.accentStrong, fontSize: 11, fontWeight: 800,
      lineHeight: 1, textTransform: "uppercase", boxSizing: "border-box",
    } satisfies CSSProperties,
    points: {
      display: "inline-flex", alignItems: "center", alignSelf: "flex-start", gap: 5,
      minHeight: 20, padding: "2px 7px", border: `1px solid ${raTheme.color.points}`,
      borderRadius: raTheme.radius.pill, background: "rgba(3, 20, 31, 0.84)",
      color: raTheme.color.points, fontSize: 11, fontWeight: 800, lineHeight: 1,
      boxSizing: "border-box",
    } satisfies CSSProperties,
    statusPanel: {
      position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
      gap: 7, minWidth: 0, paddingLeft: 9,
      borderLeft: `1px solid ${raTheme.color.borderStrong}`, overflow: "hidden",
    } satisfies CSSProperties,
    statusText: {
      position: "relative", zIndex: 1, display: "flex", flex: "1 1 auto",
      flexDirection: "column", justifyContent: "center", gap: 3, minWidth: 0,
    } satisfies CSSProperties,
    eyebrow: {
      color: raTheme.color.textSecondary, fontSize: 10, fontWeight: 800,
      letterSpacing: "0.08em", lineHeight: 1.1, textTransform: "uppercase",
    } satisfies CSSProperties,
    remaining: {
      color: raTheme.color.textPrimary, fontSize: 16, fontWeight: 750,
      lineHeight: 1.16, overflowWrap: "anywhere",
    } satisfies CSSProperties,
    awardDate: {
      color: raTheme.color.textSecondary, fontSize: 10,
      lineHeight: 1.2, overflowWrap: "anywhere",
    } satisfies CSSProperties,
    neutralWatermark: {
      position: "absolute", top: 23, right: -8, width: 126, height: 55,
      opacity: 0.045, filter: raTheme.iconFilter.primary, pointerEvents: "none",
    } satisfies CSSProperties,
    awardWatermark: {
      position: "absolute", top: -14, right: -10, opacity: 0.08, pointerEvents: "none",
    } satisfies CSSProperties,
  },
  compactAchievementCommunity: {
    track: { display: "flex", width: "calc(100% - 16px)", height: 10, marginTop: 5, overflow: "hidden", border: "1px solid rgba(144, 184, 208, 0.48)", borderRadius: 999, background: "rgba(2, 9, 15, 0.96)", boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.55)", boxSizing: "border-box" } satisfies CSSProperties,
    segment(mode: "hardcore" | "softcore", percent: number): CSSProperties {
      return { flex: `0 0 ${Math.max(0, Math.min(100, percent))}%`, height: "100%", background: mode === "hardcore" ? raTheme.color.hardcore : raTheme.color.softcore, boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.42)" };
    },
  },
  compactProfile: {
    root: {
      display: "flex", flexDirection: "column", gap: qamTheme.compactProfileSpacing.section, width: "100%", minWidth: 0,
      padding: "0 16px 4px", boxSizing: "border-box", color: raTheme.color.textPrimary,
      fontFamily: qamTheme.type.fontFamily,
    } satisfies CSSProperties,
    section: { display: "flex", flexDirection: "column", gap: qamTheme.compactProfileSpacing.content, minWidth: 0 } satisfies CSSProperties,
    sectionTitle: {
      color: raTheme.color.accent, fontSize: raTheme.type.compact.heading, fontWeight: 850,
      letterSpacing: "0.055em", lineHeight: 1, textTransform: "uppercase",
    } satisfies CSSProperties,
    profileCard: {
      display: "flex", flexDirection: "column", gap: qamTheme.compactProfileSpacing.content, padding: qamTheme.compactProfileSpacing.cardPadding,
      border: `1px solid ${raTheme.color.borderSubtle}`, borderRadius: raTheme.radius.large,
      background: raTheme.surface.contentCard, color: raTheme.color.textPrimary,
      boxShadow: "inset 0 1px 0 rgba(125, 211, 252, 0.035)", boxSizing: "border-box",
    } satisfies CSSProperties,
    identity: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 } satisfies CSSProperties,
    avatarFrame: {
      width: 54, height: 54, flex: "0 0 54px", display: "grid", placeItems: "center",
      overflow: "hidden", padding: 2, border: `2px solid ${raTheme.color.borderStrong}`,
      borderRadius: raTheme.radius.medium,
      background: qamTheme.decorative.avatarBackground,
      boxShadow: qamTheme.decorative.accentGlow, boxSizing: "border-box",
    } satisfies CSSProperties,
    avatarFallback: {
      display: "grid", placeItems: "center", width: "100%", height: "100%",
      color: raTheme.color.textPrimary, fontSize: 18, fontWeight: 850,
    } satisfies CSSProperties,
    identityText: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 } satisfies CSSProperties,
    profileName: {
      minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      color: raTheme.color.textPrimary, fontSize: 13, fontWeight: 800, lineHeight: 1.1,
    } satisfies CSSProperties,
    profileMeta: { color: raTheme.color.textSecondary, fontSize: raTheme.type.compact.metadata, fontWeight: raTheme.type.weight.regular, lineHeight: 1.25 } satisfies CSSProperties,
    gameActivityCard: {
      display: "flex", flexDirection: "column", gap: qamTheme.compactProfileSpacing.content, padding: qamTheme.compactProfileSpacing.cardPadding, minWidth: 0,
      border: `1px solid ${raTheme.color.borderSubtle}`, borderRadius: raTheme.radius.medium,
      background: raTheme.surface.contentCard, boxSizing: "border-box",
    } satisfies CSSProperties,
    gameActivityStatus(inGame: boolean): CSSProperties {
      return {
        display: "flex", alignItems: "center", gap: 6,
        color: inGame ? raTheme.color.success : raTheme.color.textSecondary,
        fontSize: raTheme.type.compact.caption, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase",
      };
    },
    gameActivityIdentityRow: {
      display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", alignItems: "center", gap: 8, minWidth: 0,
    } satisfies CSSProperties,
    gameActivityIdentity: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 } satisfies CSSProperties,
    gameActivityTitle: { color: raTheme.color.textPrimary, fontSize: raTheme.type.compact.body, fontWeight: 750, lineHeight: 1.2 } satisfies CSSProperties,
    gameActivityMeta: { color: raTheme.color.textSecondary, fontSize: raTheme.type.compact.caption, fontWeight: 600, lineHeight: 1.2 } satisfies CSSProperties,
    gameActivityPresence: {
      color: raTheme.color.accent, fontSize: raTheme.type.compact.body, fontWeight: 650, lineHeight: 1.25,
      minWidth: 0, overflow: "hidden", overflowWrap: "anywhere", display: "-webkit-box",
      WebkitBoxOrient: "vertical", WebkitLineClamp: 2,
    } satisfies CSSProperties,
    rankGrid(count: number): CSSProperties {
      return { display: "grid", gridTemplateColumns: `repeat(${Math.min(2, Math.max(1, count))}, minmax(0, 1fr))`, gap: 8, minWidth: 0 };
    },
    rank: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 } satisfies CSSProperties,
    rankLabel: {
      color: raTheme.color.textMuted, fontSize: raTheme.type.compact.caption, fontWeight: 800, lineHeight: 1.3,
      letterSpacing: "0.07em", textTransform: "uppercase",
    } satisfies CSSProperties,
    rankValue: { color: raTheme.color.textPrimary, fontSize: raTheme.type.compact.title, fontWeight: 850, lineHeight: 1.05 } satisfies CSSProperties,
    metricGrid(count: number): CSSProperties {
      return { display: "grid", gridTemplateColumns: `repeat(${Math.min(2, Math.max(1, count))}, minmax(0, 1fr))`, gap: qamTheme.compactProfileSpacing.item, minWidth: 0 };
    },
    metric(_mode: "hardcore" | "softcore" | "shared", wide = false): CSSProperties {
      return {
        minHeight: 49, minWidth: 0, padding: "8px 8px", display: "flex", alignItems: "center", gap: raTheme.space.md,
        gridColumn: wide ? "1 / -1" : undefined,
        border: `1px solid ${raTheme.color.borderSubtle}`,
        borderRadius: raTheme.radius.medium,
        background: raTheme.surface.contentStat, boxSizing: "border-box",
      };
    },
    metricText: { display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, minWidth: 0 } satisfies CSSProperties,
    focusableMetric(focused: boolean): CSSProperties {
      return {
        outline: "none",
        ...getQamPassiveCardFocusStyle(focused),
      };
    },
    metricLabel(mode: "hardcore" | "softcore" | "shared"): CSSProperties {
      return {
        color: mode === "hardcore" ? raTheme.color.hardcore : mode === "softcore" ? raTheme.color.softcore : raTheme.color.accent,
        fontSize: raTheme.type.compact.caption, fontWeight: 800, lineHeight: 1.12, letterSpacing: "0.035em", overflowWrap: "anywhere",
      };
    },
    metricValue: { color: raTheme.color.textPrimary, fontSize: 14, fontWeight: 850, lineHeight: 1.05 } satisfies CSSProperties,
    metricDetail: { color: raTheme.color.textSecondary, fontSize: 9, lineHeight: 1.1 } satisfies CSSProperties,
    completionGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: qamTheme.compactProfileSpacing.item, minWidth: 0 } satisfies CSSProperties,
    completionCard(kind: "beaten" | "mastered"): CSSProperties {
      const color = kind === "beaten" ? raTheme.color.beaten : raTheme.color.mastered;
      const border = raRecipes.gameAward[kind].border;
      return {
        display: "flex", alignItems: "center", gap: 8, minWidth: 0, minHeight: 54, padding: "8px 8px",
        border: `2px solid ${border}`, borderRadius: raTheme.radius.medium,
        background: raTheme.surface.contentStat, color, boxSizing: "border-box",
      };
    },
    completionText: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 } satisfies CSSProperties,
    completionLabel(kind: "beaten" | "mastered"): CSSProperties {
      return { color: kind === "beaten" ? raTheme.color.beaten : raTheme.color.mastered, fontSize: raTheme.type.compact.caption, fontWeight: 850, letterSpacing: "0.05em", lineHeight: 1.3, textTransform: "uppercase" };
    },
    completionValue: { color: raTheme.color.textPrimary, fontSize: 17, fontWeight: 850, lineHeight: 1 } satisfies CSSProperties,
    progressCard: { display: "flex", flexDirection: "column", gap: qamTheme.compactProfileSpacing.content, padding: qamTheme.compactProfileSpacing.cardPadding, border: `1px solid ${raTheme.color.borderSubtle}`, borderRadius: raTheme.radius.medium, background: raTheme.surface.contentCard } satisfies CSSProperties,
    progressHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 } satisfies CSSProperties,
    progressLabel: { color: raTheme.color.textSecondary, fontSize: raTheme.type.compact.metadata, fontWeight: 650 } satisfies CSSProperties,
    progressValue: { color: raTheme.color.textPrimary, fontSize: raTheme.type.compact.metadata, fontWeight: 850 } satisfies CSSProperties,
    calendar(focused: boolean): CSSProperties {
      return {
        display: "block", padding: qamTheme.compactProfileSpacing.listPadding, minWidth: 0, background: raTheme.surface.contentCard,
        border: `1px solid ${focused ? qamTheme.focus.border : raTheme.color.borderSubtle}`,
        borderRadius: raTheme.radius.medium, boxSizing: "border-box", outline: "none",
        ...getQamCompactFocusRingStyle(focused),
      };
    },
    calendarGrid(weeks: number): CSSProperties { return { display: "grid", gridTemplateColumns: `18px repeat(${weeks}, minmax(0, 1fr))`, gridTemplateRows: "repeat(7, minmax(0, 1fr))", width: "100%", height: 164, gap: 3, marginTop: 7 }; },
    calendarCell(intensity: 0 | 1 | 2 | 3 | 4, selected = false, focused = false): CSSProperties {
      return {
        display: "block", width: "100%", height: "100%", minWidth: 0, minHeight: 0,
        padding: 0, border: selected ? `2px solid ${qamTheme.selection.compactText}` : "2px solid transparent",
        borderRadius: 4, outline: "none", background: qamActivityCalendarColors[intensity], boxSizing: "border-box",
        ...getQamCompactFocusRingStyle(focused),
      };
    },
    calendarLegend: getQamActivityCalendarLegendStyle(),
    calendarLegendCell(intensity: 0 | 1 | 2 | 3 | 4): CSSProperties {
      return getQamActivityCalendarLegendCellStyle(intensity);
    },
    calendarHint: { display: "flex", alignItems: "center", gap: 4, minHeight: 15, color: raTheme.color.textMuted, fontSize: 8.5, fontWeight: 700 } satisfies CSSProperties,
    calendarHintButton: { display: "inline-grid", placeItems: "center", width: 14, height: 14, borderRadius: "50%", background: raTheme.color.textPrimary, color: raTheme.color.background, fontSize: 8, fontWeight: 900 } satisfies CSSProperties,
    listCard: getQamCompactProfileListCardStyle(),
    listRows: { display: "flex", flexDirection: "column", gap: qamTheme.compactProfileSpacing.item, minWidth: 0 } satisfies CSSProperties,
    row(focused: boolean): CSSProperties {
      return {
        display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", alignItems: "center",
        gap: 8, minHeight: 50, padding: `${qamTheme.compactProfileSpacing.rowPaddingBlock}px 8px`, border: `1px solid ${raTheme.color.borderSubtle}`,
        borderRadius: raTheme.radius.medium, background: focused ? raTheme.surface.focusedContentStat : raTheme.surface.contentStat,
        outline: "none", boxSizing: "border-box",
        transition: "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
        ...(focused ? { ...getQamCompactFocusControlStyle(), background: raTheme.surface.focusedContentStat } : {}),
      };
    },
    rowArtwork: {
      width: 40, height: 40, flex: "0 0 40px", display: "grid", placeItems: "center", overflow: "hidden",
      border: `1px solid ${raTheme.color.borderSubtle}`, borderRadius: raTheme.radius.small,
      background: raTheme.surface.raised, boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)", boxSizing: "border-box",
    } satisfies CSSProperties,
    rowText: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 } satisfies CSSProperties,
    rowTitle: { color: raTheme.color.textPrimary, fontSize: raTheme.type.compact.metadata, fontWeight: 800, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } satisfies CSSProperties,
    rowMeta: { color: raTheme.color.textMuted, fontSize: 9, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } satisfies CSSProperties,
    rowTrailing: { display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", gap: 4, minWidth: 0 } satisfies CSSProperties,
    modeBadge(mode: "hardcore" | "softcore"): CSSProperties {
      const color = mode === "hardcore" ? raTheme.color.hardcore : raTheme.color.softcore;
      const surface = mode === "hardcore" ? raTheme.surface.hardcore : raTheme.surface.softcore;
      const borderColor = mode === "hardcore" ? raTheme.color.hardcoreSubtleBorder : raTheme.color.softcoreSubtleBorder;
      return { display: "inline-flex", alignItems: "center", gap: 4, color, background: surface, border: `1px solid ${borderColor}`, borderRadius: raTheme.radius.pill, padding: "2px 6px", fontSize: 9, fontWeight: 800, lineHeight: 1.1 };
    },
    settingsIcon: {
      display: "grid", placeItems: "center", width: 28, height: 28, flex: "0 0 28px",
      border: `1px solid ${raTheme.color.borderSubtle}`, borderRadius: raTheme.radius.small,
      background: raTheme.surface.interactive, color: raTheme.color.accent,
    } satisfies CSSProperties,
    footer: { color: raTheme.color.textMuted, fontSize: raTheme.type.compact.caption, textAlign: "center", padding: "6px 8px", lineHeight: 1.2 } satisfies CSSProperties,
  },
  compactSettings: {
    root: {
      display: "flex", flexDirection: "column", gap: 10, width: "100%", minWidth: 0,
      padding: "0 16px 4px", boxSizing: "border-box", color: raTheme.color.textPrimary,
      fontFamily: qamTheme.type.fontFamily,
    } satisfies CSSProperties,
    section: { display: "flex", flexDirection: "column", gap: 6, minWidth: 0 } satisfies CSSProperties,
    sectionTitle: {
      color: raTheme.color.accent, fontSize: raTheme.type.compact.heading, fontWeight: 850,
      letterSpacing: "0.055em", lineHeight: 1, textTransform: "uppercase",
    } satisfies CSSProperties,
    action(isFocused: boolean): CSSProperties {
      return {
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        width: "100%", minWidth: 0, minHeight: 42, padding: "8px 12px",
        border: `1px solid ${raTheme.color.borderSubtle}`,
        borderRadius: raTheme.radius.small,
        background: qamTheme.surface.compactPrimaryAction,
        boxShadow: "inset 0 1px 0 rgba(125, 211, 252, 0.05), 0 4px 12px rgba(0, 0, 0, 0.14)",
        boxSizing: "border-box", color: raTheme.color.textPrimary, outline: "none",
        transition: "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
        ...(isFocused ? getQamCompactFocusControlStyle() : {}),
      };
    },
    actionText: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 } satisfies CSSProperties,
    actionTitle: { color: raTheme.color.textPrimary, fontSize: raTheme.type.compact.body, fontWeight: 800, lineHeight: 1.1 } satisfies CSSProperties,
    actionDescription: { color: raTheme.color.textSecondary, fontSize: raTheme.type.compact.metadata, lineHeight: 1.2 } satisfies CSSProperties,
    chevron: { width: 17, height: 17, flexShrink: 0, filter: raTheme.iconFilter.primary } satisfies CSSProperties,
    dropdownLabel: { color: raTheme.color.textPrimary, fontSize: raTheme.type.compact.body, fontWeight: 750, lineHeight: 1.2 } satisfies CSSProperties,
    dropdownDescription: { color: raTheme.color.textSecondary, fontSize: raTheme.type.compact.metadata, lineHeight: 1.25 } satisfies CSSProperties,
  },
  profileSection: {
    card(variant: "softcore" | "hardcore" | "retroachievements" | "completion" | "default"): CSSProperties {
      const color = variant === "softcore" ? raTheme.color.softcore : variant === "hardcore" ? raTheme.color.hardcore : variant === "default" ? raTheme.color.borderSubtle : raTheme.color.accent;
      return { ...raRecipes.card("fullscreen", true), gap: 10, padding: 12, borderLeft: `4px solid ${color}` };
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
  const circuitDuration = `${RA_GAME_ICON_PRESTIGE_MOTION.circuitSeconds}s`;
  const bottomRightDelay = `${-(RA_GAME_ICON_PRESTIGE_MOTION.circuitSeconds * 0.75)}s`;
  const bottomLeftDelay = `${-(RA_GAME_ICON_PRESTIGE_MOTION.circuitSeconds * 0.5)}s`;
  const topLeftDelay = `${-(RA_GAME_ICON_PRESTIGE_MOTION.circuitSeconds * 0.25)}s`;
  return `${getQamFocusStylesCss("data-ac-ra-theme")}
  @keyframes ac-ra-game-icon-tail { from { stroke-dashoffset: 122; } to { stroke-dashoffset: 22; } }
  @keyframes ac-ra-game-icon-body { from { stroke-dashoffset: 114; } to { stroke-dashoffset: 14; } }
  @keyframes ac-ra-game-icon-front { from { stroke-dashoffset: 106; } to { stroke-dashoffset: 6; } }
  @keyframes ac-ra-game-icon-head { from { stroke-dashoffset: 101.5; } to { stroke-dashoffset: 1.5; } }
  @keyframes ac-ra-game-icon-corner-catch {
    0%, 18%, 28%, 100% { opacity: 0; transform: scale(0.65); }
    23% { opacity: var(--ac-ra-game-icon-corner-opacity); transform: scale(1); }
  }
  @keyframes ac-ra-game-icon-reveal {
    0% { opacity: 0; background-position: 125% 0; filter: drop-shadow(0 0 0 transparent); }
    16% { opacity: 0.48; }
    46% { opacity: 1; filter: drop-shadow(0 0 8px var(--ac-ra-game-icon-bloom-color)); }
    78% { opacity: 0.7; }
    100% { opacity: 0; background-position: -125% 0; filter: drop-shadow(0 0 0 transparent); }
  }
  .ac-ra-game-icon__reveal {
    position: absolute; z-index: 4; inset: 0; padding: var(--ac-ra-game-icon-frame-width);
    border-radius: inherit; box-sizing: border-box; pointer-events: none;
    background: linear-gradient(115deg,
      transparent 19%, var(--ac-ra-game-icon-metal-dark) 31%,
      var(--ac-ra-game-icon-sweep-mid) 42%, var(--ac-ra-game-icon-sweep-color) 50%,
      var(--ac-ra-game-icon-sweep-mid) 58%, var(--ac-ra-game-icon-metal-dark) 69%, transparent 81%);
    background-size: 260% 100%;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: exclude;
    opacity: 0;
    animation: ac-ra-game-icon-reveal 1.65s cubic-bezier(0.23, 0.5, 0.3, 1) 1 both;
  }
  .ac-ra-game-icon__sweep {
    position: absolute; z-index: 2; inset: 0; width: 100%; height: 100%; overflow: visible;
    pointer-events: none;
    filter: drop-shadow(0 0 var(--ac-ra-game-icon-bloom-radius) var(--ac-ra-game-icon-bloom-color));
  }
  .ac-ra-game-icon__sweep rect {
    fill: none; stroke-width: var(--ac-ra-game-icon-sweep-width);
    stroke-linecap: butt;
  }
  .ac-ra-game-icon__sweep-tail {
    stroke: var(--ac-ra-game-icon-sweep-mid); opacity: 0.3;
    stroke-dasharray: 22 78; animation: ac-ra-game-icon-tail ${circuitDuration} linear infinite;
  }
  .ac-ra-game-icon__sweep-body {
    stroke: var(--ac-ra-game-icon-sweep-mid); opacity: 0.52;
    stroke-dasharray: 14 86; animation: ac-ra-game-icon-body ${circuitDuration} linear infinite;
  }
  .ac-ra-game-icon__sweep-front {
    stroke: var(--ac-ra-game-icon-sweep-color); opacity: 0.82;
    stroke-dasharray: 6 94; animation: ac-ra-game-icon-front ${circuitDuration} linear infinite;
  }
  .ac-ra-game-icon__sweep-head {
    stroke: var(--ac-ra-game-icon-sweep-color); opacity: 1; stroke-linecap: round;
    stroke-dasharray: 1.5 98.5; animation: ac-ra-game-icon-head ${circuitDuration} linear infinite;
  }
  .ac-ra-game-icon__corner {
    position: absolute; z-index: 3; width: var(--ac-ra-game-icon-corner-size); height: var(--ac-ra-game-icon-corner-size);
    border-radius: 50%; pointer-events: none; opacity: 0;
    background: radial-gradient(circle, var(--ac-ra-game-icon-sweep-color) 0%, var(--ac-ra-game-icon-bloom-color) 32%, transparent 72%);
    box-shadow: 0 0 3px var(--ac-ra-game-icon-bloom-color);
    animation: ac-ra-game-icon-corner-catch ${circuitDuration} linear infinite;
  }
  .ac-ra-game-icon__corner--top-right { top: -2px; right: -2px; }
  .ac-ra-game-icon__corner--bottom-right { bottom: -2px; right: -2px; animation-delay: ${bottomRightDelay}; }
  .ac-ra-game-icon__corner--bottom-left { bottom: -2px; left: -2px; animation-delay: ${bottomLeftDelay}; }
  .ac-ra-game-icon__corner--top-left { top: -2px; left: -2px; animation-delay: ${topLeftDelay}; }
  @media (prefers-reduced-motion: reduce) {
    .ac-ra-game-icon__sweep, .ac-ra-game-icon__corner, .ac-ra-game-icon__reveal {
      display: none;
    }
  }
  [data-ac-ra-theme="fullscreen"] .Panel.Focusable.gpfocus:not(.achievement-companion-fullscreen-chip):not([data-achievement-companion-focus-target="ra-community-summary"]):not([data-achievement-companion-focus-target="ra-systems-coming-soon"]) {
    border-color: ${raTheme.focus.border} !important;
    background: ${raTheme.surface.focusedContentCard} !important;
    box-shadow: ${raTheme.focus.shadow} !important;
  }
  [data-ac-ra-theme="fullscreen"] .Panel.Focusable.gpfocus[data-ra-fullscreen-game-achievement-row="true"] {
    background: ${raTheme.surface.focusedContentCard} !important;
  }
  [data-ac-ra-theme="fullscreen"] .Panel.Focusable.gpfocus[data-steam-activity-row="true"] {
    background: ${raTheme.surface.focusedContentCard} !important;
  }
  [data-ac-ra-theme="fullscreen"] .Panel.Focusable.gpfocus[data-ra-fullscreen-game-achievement-row="true"][data-ra-fullscreen-game-achievement-tone="hardcore"] {
    border-left-color: ${raTheme.color.hardcore} !important;
  }
  [data-ac-ra-theme="fullscreen"] .Panel.Focusable.gpfocus[data-ra-fullscreen-game-achievement-row="true"][data-ra-fullscreen-game-achievement-tone="softcore"] {
    border-left-color: ${raTheme.color.softcore} !important;
  }
  [data-ac-ra-theme="fullscreen"] .Panel.Focusable.gpfocus[data-ra-fullscreen-game-achievement-row="true"][data-ra-fullscreen-game-achievement-tone="locked"] {
    border-left-color: ${raTheme.color.locked} !important;
  }
  /* A selected filter keeps its underline while the shared focus ring is added. */
  [data-ac-ra-theme="fullscreen"] .Panel.Focusable.gpfocus[data-achievement-companion-steam-filter-control="true"][aria-pressed="true"] {
    background: ${raTheme.surface.focusedSelectedContentCard} !important;
    box-shadow: ${raTheme.focus.shadow}, ${qamTheme.selection.compactUnderline} !important;
  }
  [data-ac-ra-theme="fullscreen"] .Panel.Focusable.gpfocus[data-achievement-companion-steam-filter-control="true"][data-achievement-filter-selected="true"] {
    background: ${raTheme.surface.focusedSelectedContentCard} !important;
    box-shadow: ${raTheme.focus.shadow}, ${qamTheme.selection.compactUnderline} !important;
  }
  [data-ac-ra-theme="fullscreen"] .achievement-companion-ra-profile-system--focused {
    border-color: ${raTheme.focus.border} !important;
    background: ${raTheme.surface.focusedContentStat} !important;
    box-shadow: ${raTheme.focus.shadow} !important;
  }
  [data-ac-ra-theme="fullscreen"] .achievement-companion-ra-profile-avatar--focused {
    border-color: ${raTheme.focus.border} !important;
    box-shadow: ${raTheme.focus.shadow} !important;
  }
  [data-ac-ra-theme] .achievement-companion-achievement-filter-option.achievement-companion-achievement-filter-option--selected {
    border-color: ${raTheme.selection.border}; background: ${raTheme.surface.selectedContentCard};
  }
  [data-ac-ra-theme] .achievement-companion-achievement-filter-option:is(.achievement-companion-achievement-filter-option--focused,.gpfocus,.gpfocuswithin,:focus,:focus-within) {
    border-color: ${raTheme.focus.border}; box-shadow: ${raTheme.focus.shadow};
  }
  [data-ac-ra-theme="compact"] [data-ac-ra-achievement-tone="hardcore"] {
    border-left-width: 3px !important;
    border-left-color: ${raTheme.color.hardcore} !important;
  }
  [data-ac-ra-theme="compact"] [data-ac-ra-achievement-tone="softcore"] {
    border-left-width: 3px !important;
    border-left-color: ${raTheme.color.softcore} !important;
  }
  [data-ac-ra-theme="compact"] [data-ac-ra-achievement-tone="locked"] {
    border-left-width: 3px !important;
    border-left-color: ${raTheme.color.locked} !important;
  }`;
}
