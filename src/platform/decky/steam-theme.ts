import type { CSSProperties } from "react";
import { achievementCompanionQamTheme as qamTheme, getQamFocusStylesCss } from "./decky-qam-theme";

/** Steam semantic roles layered on the provider-neutral visual system. */
export const steamTheme = {
  color: {
    ...qamTheme.color,
    unlocked: "#5ee0a0", rewardGold: "#ffd36a", conditional: "#f5d276", unobtainable: "#ff7182",
  },
  surface: {
    ...qamTheme.surface,
  },
  status: qamTheme.status,
  type: qamTheme.type,
  space: qamTheme.space,
  radius: qamTheme.radius,
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
  focus: qamTheme.focus,
  selection: qamTheme.selection,
} as const;

export type SteamDensity = "compact" | "fullscreen";
export type SteamSurface = "card" | "raised" | "interactive";
export type SteamTypographyRole = "hero" | "heading" | "title" | "body" | "metadata" | "caption";

export const steamRecipes = {
  text(density: SteamDensity, role: SteamTypographyRole): CSSProperties {
    return { fontFamily: steamTheme.type.fontFamily, fontSize: steamTheme.type[density][role], fontWeight: role === "hero" || role === "heading" || role === "title" ? 700 : 400, lineHeight: 1.3, color: role === "metadata" || role === "caption" ? steamTheme.color.textSecondary : steamTheme.color.textPrimary };
  },
  card(density: SteamDensity, variant: SteamSurface = "card"): CSSProperties {
    return { background: variant === "raised" ? steamTheme.surface.contentStat : steamTheme.surface.contentCard, border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.large, padding: steamTheme.density[density].cardPadding, color: steamTheme.color.textPrimary };
  },
  metricTile(density: SteamDensity): CSSProperties { return steamRecipes.card(density, "raised"); },
  interactiveRow(density: SteamDensity): CSSProperties { return { ...steamRecipes.card(density, "interactive"), display: "flex", alignItems: "center", gap: steamTheme.density[density].rowGap }; },
  action(density: SteamDensity, primary = false): CSSProperties { return { ...steamRecipes.text(density, "body"), minHeight: steamTheme.density[density].controlHeight, padding: `0 ${steamTheme.space.md}px`, borderRadius: steamTheme.radius.pill, border: `1px solid ${primary ? steamTheme.color.borderStrong : steamTheme.color.borderSubtle}`, background: primary ? steamTheme.surface.primaryAction : steamTheme.surface.contentStat, fontWeight: 700 }; },
  filter(density: SteamDensity, selected = false): CSSProperties { return { ...steamRecipes.action(density), background: selected ? steamTheme.surface.selectedContentCard : steamTheme.surface.contentCard, borderColor: selected ? steamTheme.color.borderStrong : steamTheme.color.borderSubtle }; },
  badge(color: string = steamTheme.color.accent): CSSProperties { return { color, border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.pill, padding: "2px 8px", fontSize: steamTheme.type.compact.caption, fontWeight: 600 }; },
  progressTrack: { background: qamTheme.surface.progressTrack, borderRadius: 999, overflow: "hidden" } satisfies CSSProperties,
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
  return `${getQamFocusStylesCss("data-ac-steam-theme")}
  [data-ac-steam-theme] .achievement-companion-focus-pill:is(.achievement-companion-focus-pill--focused,.gpfocus,.gpfocuswithin,:focus,:focus-within),
  [data-ac-steam-theme] .achievement-companion-provider-settings-action-row:is(.achievement-companion-provider-settings-action-row--focused,.gpfocus,.gpfocuswithin,:focus,:focus-within) {
    border-color: ${steamTheme.focus.border} !important;
    background: ${steamTheme.focus.background} !important;
    box-shadow: ${steamTheme.focus.shadow} !important;
  }
  [data-ac-steam-theme] .achievement-companion-provider-settings-action-row:is(.achievement-companion-provider-settings-action-row--focused,.gpfocus,.gpfocuswithin,:focus,:focus-within) {
    background: ${steamTheme.surface.focusedContentCard} !important;
  }
  [data-ac-steam-theme] .achievement-companion-achievement-filter-option.achievement-companion-achievement-filter-option--selected {
    border-color: ${steamTheme.color.borderStrong};
    background: ${steamTheme.surface.selectedContentCard};
  }
  [data-ac-steam-theme] .achievement-companion-achievement-filter-option:is(.achievement-companion-achievement-filter-option--focused,.gpfocus,.gpfocuswithin,:focus,:focus-within) {
    border-color: ${steamTheme.focus.border};
    box-shadow: ${steamTheme.focus.shadow};
  }`;
}

export function getSteamActionStylesCss(): string {
  const chip = '[data-ac-steam-theme] .achievement-companion-fullscreen-chip';
  const focused = ':is(.achievement-companion-fullscreen-chip--focused,.gpfocus,.gpfocuswithin,:focus,:focus-within)';
  return `${chip} { background: ${steamTheme.surface.contentStat} !important; color: ${steamTheme.color.textPrimary} !important; }
  ${chip}.achievement-companion-fullscreen-chip--selected { background: ${steamTheme.surface.selectedContentStat} !important; }
  ${chip}.achievement-companion-fullscreen-chip-primary { background: ${steamTheme.surface.primaryAction} !important; }
  ${chip}${focused} { border-color: ${steamTheme.focus.border} !important; background: ${steamTheme.surface.focusedContentStat} !important; box-shadow: ${steamTheme.focus.shadow} !important; }
  ${chip}.achievement-companion-fullscreen-chip--selected${focused} { background: ${steamTheme.surface.focusedSelectedContentStat} !important; }
  ${chip}.achievement-companion-fullscreen-chip-primary${focused} { border-color: ${steamTheme.focus.primaryBorder} !important; background: ${steamTheme.focus.primaryBackground} !important; box-shadow: ${steamTheme.focus.primaryShadow} !important; }`;
}
