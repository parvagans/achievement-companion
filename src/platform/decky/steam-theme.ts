import type { CSSProperties } from "react";

/** Steam visual roles only. Shared components must opt in; RA retains its defaults. */
export const steamTheme = {
  color: {
    background: "#06111a", surface: "#071b29", surfaceRaised: "#092334",
    surfaceInteractive: "#0b293d", textPrimary: "#f2f7fb", textSecondary: "#b7cad8",
    textMuted: "#8fa9bd", accent: "#2bc3f2", accentStrong: "#25bfff",
    borderSubtle: "rgba(68,151,204,.25)", borderStrong: "rgba(44,185,255,.75)",
    success: "#72e0a8", warning: "#f5d276", danger: "#ff7182", locked: "#9ba8b4",
    unlocked: "#5ee0a0", rewardGold: "#ffd36a", conditional: "#f5d276", unobtainable: "#ff7182",
  },
  surface: {
    page: "linear-gradient(120deg,#06111a,#071724 55%,#06121c)",
    card: "rgba(7,27,41,.88)", raised: "linear-gradient(90deg,rgba(9,35,52,.95),rgba(7,29,44,.9))",
    interactive: "rgba(9,39,58,.72)",
    selected: "linear-gradient(180deg,rgba(74,138,204,.4),rgba(34,79,124,.34))",
    primaryAction: "linear-gradient(180deg,rgba(34,155,232,.82),rgba(15,91,162,.88))",
    secondaryAction: "linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.045))",
    compactPrimaryAction: "linear-gradient(180deg,rgba(10,63,96,.82),rgba(7,43,67,.92))",
    compactRow: "linear-gradient(150deg,rgba(9,35,51,.88),rgba(7,27,41,.94))",
  },
  status: {
    danger: { text: "#ffc0c8", border: "rgba(255,67,91,.5)", surface: "linear-gradient(90deg,rgba(89,17,31,.56),rgba(57,15,27,.45))" },
    success: { text: "#a9e9c6", border: "rgba(49,226,142,.55)", surface: "rgba(10,57,43,.48)" },
  },
  type: {
    compact: { hero: 24, heading: 16, title: 14, body: 13, metadata: 11, caption: 10 },
    fullscreen: { hero: 28, heading: 20, title: 16, body: 14, metadata: 12, caption: 11 },
    weight: { regular: 400, medium: 600, strong: 700 },
    fontFamily: '"Motiva Sans", Arial, sans-serif',
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { small: 8, medium: 10, large: 14, panel: 20, pill: 999 },
  density: {
    compact: { gutter: 8, cardPadding: 10, rowGap: 6, controlHeight: 30, iconSize: 18 },
    fullscreen: { gutter: 16, cardPadding: 16, rowGap: 10, controlHeight: 40, iconSize: 22 },
  },
  iconFilter: {
    primary: "brightness(0) invert(1)", muted: "brightness(0) saturate(100%) invert(72%) sepia(12%) saturate(486%) hue-rotate(164deg) brightness(91%) contrast(87%)",
    accent: "brightness(0) saturate(100%) invert(63%) sepia(89%) saturate(1795%) hue-rotate(166deg) brightness(103%) contrast(103%)",
    reward: "brightness(0) saturate(100%) invert(84%) sepia(56%) saturate(731%) hue-rotate(343deg) brightness(103%) contrast(101%)",
    locked: "grayscale(1)",
    danger: "brightness(0) saturate(100%) invert(49%) sepia(92%) saturate(2856%) hue-rotate(324deg) brightness(102%) contrast(101%)",
    success: "brightness(0) saturate(100%) invert(76%) sepia(82%) saturate(465%) hue-rotate(93deg) brightness(94%) contrast(95%)",
    rarityPurple: "brightness(0) saturate(100%) invert(41%) sepia(93%) saturate(1444%) hue-rotate(249deg) brightness(95%) contrast(96%)",
  },
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

export type SteamDensity = "compact" | "fullscreen";
export type SteamSurface = "card" | "raised" | "interactive";
export type SteamTypographyRole = "hero" | "heading" | "title" | "body" | "metadata" | "caption";

export const steamRecipes = {
  text(density: SteamDensity, role: SteamTypographyRole): CSSProperties {
    return { fontFamily: steamTheme.type.fontFamily, fontSize: steamTheme.type[density][role], fontWeight: role === "hero" || role === "heading" || role === "title" ? 700 : 400, lineHeight: 1.3, color: role === "metadata" || role === "caption" ? steamTheme.color.textSecondary : steamTheme.color.textPrimary };
  },
  card(density: SteamDensity, variant: SteamSurface = "card"): CSSProperties {
    return { background: steamTheme.surface[variant], border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.large, padding: steamTheme.density[density].cardPadding, color: steamTheme.color.textPrimary };
  },
  metricTile(density: SteamDensity): CSSProperties { return steamRecipes.card(density, "raised"); },
  interactiveRow(density: SteamDensity): CSSProperties { return { ...steamRecipes.card(density, "interactive"), display: "flex", alignItems: "center", gap: steamTheme.density[density].rowGap }; },
  action(density: SteamDensity, primary = false): CSSProperties { return { ...steamRecipes.text(density, "body"), minHeight: steamTheme.density[density].controlHeight, padding: `0 ${steamTheme.space.md}px`, borderRadius: steamTheme.radius.pill, border: `1px solid ${primary ? steamTheme.color.borderStrong : steamTheme.color.borderSubtle}`, background: primary ? steamTheme.surface.primaryAction : steamTheme.surface.secondaryAction, fontWeight: 700 }; },
  filter(density: SteamDensity, selected = false): CSSProperties { return { ...steamRecipes.action(density), background: selected ? steamTheme.surface.selected : steamTheme.surface.secondaryAction, borderColor: selected ? steamTheme.color.borderStrong : steamTheme.color.borderSubtle }; },
  filterTab(density: SteamDensity, selected = false): CSSProperties { return { ...steamRecipes.text(density, "metadata"), display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: density === "compact" ? 28 : 32, padding: density === "compact" ? "4px 8px" : "5px 10px", border: "1px solid transparent", borderRadius: 0, background: "transparent", color: selected ? steamTheme.selection.compactText : steamTheme.color.textSecondary, boxShadow: selected ? steamTheme.selection.compactUnderline : "none", fontWeight: selected ? 700 : 600, whiteSpace: "nowrap" }; },
  badge(color: string = steamTheme.color.accent): CSSProperties { return { color, border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.pill, padding: "2px 8px", fontSize: steamTheme.type.compact.caption, fontWeight: 600 }; },
  progressTrack: { background: "rgba(143,169,189,.18)", borderRadius: 999, overflow: "hidden" } satisfies CSSProperties,
  progressFill: { completion: "linear-gradient(90deg,#159ccb,#2bc3f2)", xp: "linear-gradient(90deg,#3a96df,#76c7ff)" },
  achievementState: {
    locked: { color: steamTheme.color.locked, artworkFilter: "grayscale(1)" },
    unlocked: { color: steamTheme.color.unlocked, artworkFilter: "none" },
    perfected: { color: steamTheme.color.rewardGold }, reward: { color: steamTheme.color.rewardGold },
    obtainable: { color: steamTheme.color.success }, conditional: { color: steamTheme.color.conditional }, unobtainable: { color: steamTheme.color.unobtainable },
  },
  inputFrame: { border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.small, background: steamTheme.surface.interactive } satisfies CSSProperties,
  state(kind: "loading" | "empty" | "error"): CSSProperties { return { textAlign: "center", color: kind === "error" ? steamTheme.color.danger : steamTheme.color.textSecondary, padding: steamTheme.space.lg }; },
} as const;

/** Only visual rules: GamepadUI continues to own focus and navigation. */
export function getSteamFocusStylesCss(): string {
  return `[data-ac-steam-theme] .achievement-companion-focus-nav-row:focus-within,
  [data-ac-steam-theme] .achievement-companion-focus-achievement-row:focus-within,
  [data-ac-steam-theme] .achievement-companion-focus-nav-row.gpfocus,
  [data-ac-steam-theme] .achievement-companion-focus-achievement-row.gpfocus {
    box-shadow: ${steamTheme.focus.insetShadow};
  }
  [data-ac-steam-theme] .achievement-companion-focus-pill:is(.achievement-companion-focus-pill--focused,.gpfocus,.gpfocuswithin,:focus,:focus-within),
  [data-ac-steam-theme] .achievement-companion-provider-settings-action-row:is(.achievement-companion-provider-settings-action-row--focused,.gpfocus,.gpfocuswithin,:focus,:focus-within) {
    border-color: ${steamTheme.focus.border} !important;
    background: ${steamTheme.focus.background} !important;
    box-shadow: ${steamTheme.focus.shadow} !important;
  }
  [data-ac-steam-theme] .achievement-companion-achievement-filter-option.achievement-companion-achievement-filter-option--selected {
    border-color: ${steamTheme.color.borderStrong};
    background: ${steamTheme.surface.selected};
  }
  [data-ac-steam-theme] .achievement-companion-achievement-filter-option:is(.achievement-companion-achievement-filter-option--focused,.gpfocus,.gpfocuswithin,:focus,:focus-within) {
    border-color: ${steamTheme.focus.border};
    box-shadow: ${steamTheme.focus.shadow};
  }`;
}

export function getSteamActionStylesCss(): string {
  const chip = '[data-ac-steam-theme] .achievement-companion-fullscreen-chip';
  const focused = ':is(.achievement-companion-fullscreen-chip--focused,.gpfocus,.gpfocuswithin,:focus,:focus-within)';
  return `${chip} { background: ${steamTheme.surface.secondaryAction} !important; color: ${steamTheme.color.textPrimary} !important; }
  ${chip}.achievement-companion-fullscreen-chip--selected { background: ${steamTheme.surface.selected} !important; }
  ${chip}.achievement-companion-fullscreen-chip-primary { background: ${steamTheme.surface.primaryAction} !important; }
  ${chip}${focused} { border-color: ${steamTheme.focus.border} !important; background: ${steamTheme.focus.background} !important; box-shadow: ${steamTheme.focus.shadow} !important; }
  ${chip}.achievement-companion-fullscreen-chip-primary${focused} { border-color: ${steamTheme.focus.primaryBorder} !important; background: ${steamTheme.focus.primaryBackground} !important; box-shadow: ${steamTheme.focus.primaryShadow} !important; }`;
}
