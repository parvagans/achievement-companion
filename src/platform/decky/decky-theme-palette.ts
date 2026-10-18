import type { AchievementCompanionTheme } from "@core/settings";
import { DECKY_LOADING_COLORS, DECKY_LOADING_PAGE_BACKGROUND } from "./decky-brand-colors";

/** Only shared AC chrome is themed. Provider awards, unlock states, and native Steam projections retain their own colors. */
export const AC_NEON_THEME_VARIABLES = {
  "--ac-background": DECKY_LOADING_COLORS.navy,
  "--ac-surface": "#0b1428",
  "--ac-surface-raised": "#151b36",
  "--ac-surface-interactive": "#182044",
  "--ac-text-primary": DECKY_LOADING_COLORS.text,
  "--ac-text-secondary": DECKY_LOADING_COLORS.muted,
  "--ac-text-muted": "#9ba8c8",
  "--ac-accent": DECKY_LOADING_COLORS.cyan,
  "--ac-accent-strong": DECKY_LOADING_COLORS.magenta,
  "--ac-border-subtle": "rgba(133, 106, 222, 0.32)",
  "--ac-border-strong": "rgba(239, 56, 213, 0.78)",
  "--ac-primary-action-border": "rgba(133, 106, 222, 0.48)",
  "--ac-page": DECKY_LOADING_PAGE_BACKGROUND,
  "--ac-card": "rgba(11, 20, 40, 0.9)",
  "--ac-raised": "linear-gradient(90deg, rgba(24, 29, 58, 0.96), rgba(11, 20, 42, 0.94))",
  "--ac-interactive": "rgba(22, 31, 64, 0.82)",
  "--ac-content-card": "radial-gradient(circle at 12% 45%, rgba(8, 213, 245, 0.11), transparent 48%), radial-gradient(circle at 94% 8%, rgba(239, 56, 213, 0.1), transparent 42%), linear-gradient(110deg, #0b1930, #15132d)",
  "--ac-content-stat": "radial-gradient(circle at 12% 50%, rgba(20, 123, 255, 0.13), transparent 50%), linear-gradient(110deg, #121d3a, #17152f)",
  "--ac-progress-track": "rgba(155, 168, 200, 0.21)",
  "--ac-progress-fill": "linear-gradient(90deg, #147bff, #08d5f5)",
  "--ac-xp-fill": "linear-gradient(90deg, #713dff, #08d5f5)",
  "--ac-focus-overlay": "linear-gradient(180deg, rgba(113, 61, 255, 0.26), rgba(239, 56, 213, 0.14))",
  "--ac-selection-overlay": "linear-gradient(180deg, rgba(113, 61, 255, 0.38), rgba(20, 123, 255, 0.23))",
  "--ac-primary-action": "linear-gradient(110deg, rgba(20, 123, 255, 0.88), rgba(113, 61, 255, 0.9))",
  "--ac-activity-trend-fill": "linear-gradient(180deg, #f38be8, #713dff)",
  "--ac-activity-trend-empty": "#292b53",
  "--ac-compact-primary-action": "linear-gradient(110deg, rgba(19, 39, 76, 0.88), rgba(39, 27, 71, 0.9))",
  "--ac-compact-row": "linear-gradient(150deg, rgba(18, 30, 57, 0.92), rgba(21, 18, 47, 0.95))",
  "--ac-focus-border": "rgba(196, 112, 255, 0.88)",
  "--ac-focus-background": "linear-gradient(180deg, rgba(113, 61, 255, 0.34), rgba(64, 45, 145, 0.3))",
  "--ac-focus-shadow": "0 0 0 2px rgba(183, 98, 255, 0.78), 0 0 18px rgba(239, 56, 213, 0.34), inset 0 1px 0 rgba(255,255,255,0.14)",
  "--ac-focus-inset-shadow": "inset 0 0 0 1px rgba(196, 112, 255, 0.75), inset 0 0 0 999px rgba(113, 61, 255, 0.09)",
  "--ac-focus-primary-background": "linear-gradient(110deg, rgba(20, 123, 255, 0.94), rgba(113, 61, 255, 0.97))",
  "--ac-focus-primary-border": "rgba(239, 56, 213, 0.96)",
  "--ac-focus-primary-shadow": "0 0 0 3px rgba(239,56,213,0.96), 0 0 20px rgba(175,74,255,0.52), inset 0 1px 0 rgba(255,255,255,0.28)",
  "--ac-focus-calendar-day-shadow": "inset 0 0 0 1px rgba(243,139,232,.95), 0 0 6px rgba(239,56,213,.7)",
  "--ac-focus-compact-border": "rgba(239, 56, 213, 0.92)",
  "--ac-focus-compact-background": "linear-gradient(110deg, rgba(42, 70, 148, 0.82), rgba(89, 42, 142, 0.9))",
  "--ac-focus-compact-shadow": "0 0 0 1px rgba(239, 56, 213, 0.74), 0 0 13px rgba(239, 56, 213, 0.38), inset 0 1px 0 rgba(255,255,255,0.1)",
  "--ac-focus-passive-shadow": "inset 0 0 0 1px rgba(239,56,213,.14)",
  "--ac-selection-text": "#f38be8",
  "--ac-selection-underline": "inset 0 -3px 0 rgba(239, 56, 213, 0.88)",
  "--ac-calendar-0": "#25274d",
  "--ac-calendar-1": "#39377e",
  "--ac-calendar-2": "#6550b5",
  "--ac-calendar-3": "#a54ad6",
  "--ac-calendar-4": DECKY_LOADING_COLORS.magenta,
  "--ac-chooser-border": "rgba(133, 106, 222, 0.35)",
  "--ac-chooser-focus-border": "rgba(196, 112, 255, 0.82)",
  "--ac-chooser-focus-shadow": "0 0 0 1px rgba(196, 112, 255, 0.84), 0 0 15px rgba(239, 56, 213, 0.42)",
  "--ac-chooser-chevron": DECKY_LOADING_COLORS.magenta,
  "--ac-icon-filter": "brightness(0) saturate(100%) invert(78%) sepia(42%) saturate(1326%) hue-rotate(166deg) brightness(102%) contrast(101%)",
  "--ac-avatar-background": "linear-gradient(145deg, rgba(20, 123, 255, 0.22), rgba(5, 13, 24, 0.96))",
  "--ac-avatar-glow": "0 0 18px rgba(8, 213, 245, 0.26)",
  "--ac-accent-glow": "0 0 12px rgba(8, 213, 245, 0.22)",
  "--ac-accent-text-glow": "0 0 22px rgba(8, 213, 245, 0.24)",
  "--ac-primary-chip-shadow": "0 0 0 1px rgba(113, 61, 255, 0.52), 0 0 16px rgba(239, 56, 213, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
  "--ac-settings-save-border": "rgba(113, 61, 255, 0.68)",
  "--ac-settings-save-background": "rgba(50, 34, 107, 0.72)",
  "--ac-footer-background": "linear-gradient(180deg, #0b1428, #050d18)",
  "--ac-progress-glow-rgb": "8, 213, 245",
  "--ac-loading-page": DECKY_LOADING_PAGE_BACKGROUND,
  "--ac-loading-info-background": "linear-gradient(145deg, rgba(7, 24, 40, 0.96), rgba(6, 14, 27, 0.96)) padding-box, linear-gradient(112deg, #08d5f594, #147bff6e 54%, #ef38d57a) border-box",
  "--ac-loading-info-shadow": "0 8px 26px rgba(0, 0, 0, 0.18), 0 0 24px rgba(15, 156, 239, 0.055)",
  "--ac-loading-mark-background": "radial-gradient(circle at 36% 24%, rgba(22, 50, 76, 0.98), #050d18 73%)",
  "--ac-loading-mark-shadow": "0 0 34px rgba(12, 177, 238, 0.19), 0 0 48px rgba(190, 43, 221, 0.07), inset 0 0 0 1px rgba(158, 229, 255, 0.16)",
  "--ac-loading-ring": "conic-gradient(from -28deg, #08d5f5 0deg, #147bff 112deg, #713dff 214deg, #ef38d5 280deg, rgba(27, 58, 107, 0.78) 281deg, rgba(27, 58, 107, 0.78) 360deg)",
  "--ac-loading-well": "radial-gradient(circle at 38% 24%, #10253a, #050b14 74%)",
  "--ac-loading-well-border": "rgba(136, 202, 241, 0.19)",
  "--ac-loading-deck-icon-filter": "brightness(0) saturate(100%) invert(75%) sepia(90%) saturate(1724%) hue-rotate(151deg) brightness(103%) contrast(104%) drop-shadow(0 0 7px rgba(8, 213, 245, 0.32))",
  "--ac-loading-badge-background": "linear-gradient(145deg, #13243a, #07101d)",
  "--ac-loading-badge-border": "rgba(202, 230, 255, 0.62)",
  "--ac-loading-badge-shadow": "0 0 0 2px rgba(20, 123, 255, 0.46), 0 0 15px rgba(239, 56, 213, 0.2)",
  "--ac-loading-provider-icon-filter": "brightness(0) invert(1) drop-shadow(0 0 4px rgba(8, 213, 245, 0.2))",
} as const;


/** Low-glare graphite chrome with a pale steel focus cue; provider status colors remain untouched. */
export const AC_CARBON_THEME_VARIABLES = {
  "--ac-background": "#08090b",
  "--ac-surface": "#111316",
  "--ac-surface-raised": "#1b1f23",
  "--ac-surface-interactive": "#24282d",
  "--ac-text-primary": "#f4f6f7",
  "--ac-text-secondary": "#c2cbd0",
  "--ac-text-muted": "#a0acb3",
  "--ac-accent": "#d8e5ec",
  "--ac-accent-strong": "#f3f9fc",
  "--ac-border-subtle": "rgba(170, 190, 200, 0.28)",
  "--ac-border-strong": "rgba(224, 238, 245, 0.82)",
  "--ac-primary-action-border": "rgba(224, 238, 245, 0.78)",
  "--ac-page": "linear-gradient(120deg, #08090b, #14171a 55%, #0b0d0f)",
  "--ac-card": "rgba(17, 19, 22, 0.94)",
  "--ac-raised": "linear-gradient(90deg, rgba(30, 34, 38, 0.96), rgba(18, 21, 24, 0.94))",
  "--ac-interactive": "rgba(36, 40, 45, 0.88)",
  "--ac-content-card": "radial-gradient(circle at 15% 45%, rgba(190, 215, 229, 0.07), transparent 52%), linear-gradient(110deg, #13171a, #1d2226)",
  "--ac-content-stat": "radial-gradient(circle at 15% 50%, rgba(190, 215, 229, 0.08), transparent 50%), linear-gradient(110deg, #1c2226, #272d32)",
  "--ac-progress-track": "rgba(173, 194, 205, 0.22)",
  "--ac-progress-fill": "linear-gradient(90deg, #879eaa, #d8e5ec)",
  "--ac-xp-fill": "linear-gradient(90deg, #718b99, #e8f5fa)",
  "--ac-focus-overlay": "linear-gradient(180deg, rgba(220, 237, 246, 0.18), rgba(175, 203, 218, 0.12))",
  "--ac-selection-overlay": "linear-gradient(180deg, rgba(185, 208, 220, 0.25), rgba(122, 151, 168, 0.18))",
  "--ac-primary-action": "linear-gradient(110deg, #4b5a64, #27353e)",
  "--ac-activity-trend-fill": "linear-gradient(180deg, #e5f2f8, #91adbd)",
  "--ac-activity-trend-empty": "#303b42",
  "--ac-compact-primary-action": "linear-gradient(110deg, rgba(45, 55, 62, 0.96), rgba(27, 34, 39, 0.98))",
  "--ac-compact-row": "linear-gradient(150deg, rgba(25, 30, 34, 0.95), rgba(18, 22, 25, 0.97))",
  "--ac-focus-border": "rgba(232, 244, 250, 0.96)",
  "--ac-focus-background": "linear-gradient(180deg, rgba(179, 207, 222, 0.27), rgba(110, 142, 159, 0.2))",
  "--ac-focus-shadow": "0 0 0 2px rgba(232, 244, 250, 0.9), 0 0 16px rgba(193, 220, 234, 0.3), inset 0 1px 0 rgba(255,255,255,0.17)",
  "--ac-focus-inset-shadow": "inset 0 0 0 1px rgba(232, 244, 250, 0.82), inset 0 0 0 999px rgba(198, 222, 235, 0.08)",
  "--ac-focus-primary-background": "linear-gradient(110deg, #5b6e7a, #344751)",
  "--ac-focus-primary-border": "rgba(246, 251, 253, 0.98)",
  "--ac-focus-primary-shadow": "0 0 0 3px rgba(246, 251, 253, 0.96), 0 0 19px rgba(201, 225, 237, 0.43), inset 0 1px 0 rgba(255,255,255,0.23)",
  "--ac-focus-calendar-day-shadow": "inset 0 0 0 1px #f4fbfe, 0 0 6px rgba(216, 235, 245, 0.7)",
  "--ac-focus-compact-border": "rgba(232, 244, 250, 0.96)",
  "--ac-focus-compact-background": "linear-gradient(110deg, rgba(70, 87, 97, 0.92), rgba(39, 52, 59, 0.95))",
  "--ac-focus-compact-shadow": "0 0 0 1px rgba(232, 244, 250, 0.86), 0 0 13px rgba(193, 220, 234, 0.38), inset 0 1px 0 rgba(255,255,255,0.13)",
  "--ac-focus-passive-shadow": "inset 0 0 0 1px rgba(216, 235, 245, 0.24)",
  "--ac-selection-text": "#eff8fc",
  "--ac-selection-underline": "inset 0 -3px 0 rgba(216, 235, 245, 0.91)",
  "--ac-calendar-0": "#30373c",
  "--ac-calendar-1": "#4b5962",
  "--ac-calendar-2": "#718b99",
  "--ac-calendar-3": "#a5c0cd",
  "--ac-calendar-4": "#e8f5fa",
  "--ac-chooser-border": "rgba(170, 190, 200, 0.32)",
  "--ac-chooser-focus-border": "rgba(232, 244, 250, 0.9)",
  "--ac-chooser-focus-shadow": "0 0 0 1px rgba(232, 244, 250, 0.9), 0 0 15px rgba(193, 220, 234, 0.34)",
  "--ac-chooser-chevron": "#d8e5ec",
  "--ac-icon-filter": "brightness(0) invert(90%)",
  "--ac-avatar-background": "linear-gradient(145deg, rgba(190, 215, 229, 0.2), rgba(17, 19, 22, 0.96))",
  "--ac-avatar-glow": "0 0 18px rgba(190, 215, 229, 0.22)",
  "--ac-accent-glow": "0 0 12px rgba(190, 215, 229, 0.2)",
  "--ac-accent-text-glow": "0 0 22px rgba(190, 215, 229, 0.2)",
  "--ac-primary-chip-shadow": "0 0 0 1px rgba(216, 235, 245, 0.55), 0 0 16px rgba(190, 215, 229, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
  "--ac-settings-save-border": "rgba(216, 235, 245, 0.65)",
  "--ac-settings-save-background": "rgba(64, 78, 87, 0.78)",
  "--ac-footer-background": "linear-gradient(180deg, #171b1e, #0b0d0f)",
  "--ac-progress-glow-rgb": "190, 215, 229",
  "--ac-loading-page": "radial-gradient(ellipse at 20% 8%, rgba(190, 215, 229, 0.1), transparent 42%), linear-gradient(145deg, #08090b, #14171a 54%, #0b0d0f)",
  "--ac-loading-info-background": "linear-gradient(145deg, #1c2226, #111316) padding-box, linear-gradient(112deg, #a5c0cd94, #718b996e 54%, #e8f5fa7a) border-box",
  "--ac-loading-info-shadow": "0 8px 26px rgba(0, 0, 0, 0.2), 0 0 24px rgba(190, 215, 229, 0.07)",
  "--ac-loading-mark-background": "radial-gradient(circle at 36% 24%, #303c43, #08090b 73%)",
  "--ac-loading-mark-shadow": "0 0 34px rgba(190, 215, 229, 0.18), inset 0 0 0 1px rgba(216, 235, 245, 0.18)",
  "--ac-loading-ring": "conic-gradient(from -28deg, #e8f5fa 0deg, #a5c0cd 112deg, #718b99 214deg, #4b5962 280deg, #303b42 281deg, #303b42 360deg)",
  "--ac-loading-well": "radial-gradient(circle at 38% 24%, #27343c, #090c0e 74%)",
  "--ac-loading-well-border": "rgba(216, 235, 245, 0.2)",
  "--ac-loading-deck-icon-filter": "brightness(0) invert(90%) drop-shadow(0 0 7px rgba(190, 215, 229, 0.3))",
  "--ac-loading-badge-background": "linear-gradient(145deg, #26323a, #101418)",
  "--ac-loading-badge-border": "rgba(216, 235, 245, 0.62)",
  "--ac-loading-badge-shadow": "0 0 0 2px rgba(165, 192, 205, 0.46), 0 0 15px rgba(190, 215, 229, 0.18)",
  "--ac-loading-provider-icon-filter": "brightness(0) invert(1) drop-shadow(0 0 4px rgba(190, 215, 229, 0.2))",
} as const;

type ThemeVariables = Readonly<Record<keyof typeof AC_CARBON_THEME_VARIABLES, string>>;

/** One palette drives shared chrome, focus, charts, icons, and loading screens. */
interface ThemePaletteSpec {
  readonly background: string;
  readonly surface: string;
  readonly raised: string;
  readonly border: string;
  readonly primary: string;
  readonly secondary: string;
  readonly text: string;
  readonly muted: string;
  readonly iconFilter: string;
  readonly providerIconFilter?: string;
  readonly glow: number;
  readonly progressEnd?: string;
}

function rgb(color: string): readonly [number, number, number] {
  const value = color.slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgba(color: string, alpha: number): string {
  return "rgba(" + [...rgb(color), Number(alpha.toFixed(3))].join(", ") + ")";
}

function mix(color: string, base: string, weight: number): string {
  const foreground = rgb(color);
  const background = rgb(base);
  return "#" + foreground.map((channel, index) =>
    Math.round(channel * weight + background[index]! * (1 - weight)).toString(16).padStart(2, "0"),
  ).join("");
}

function linear(from: string, to: string, angle = 110): string {
  return "linear-gradient(" + angle + "deg, " + from + ", " + to + ")";
}

function createPaletteTheme(spec: ThemePaletteSpec): ThemeVariables {
  const { background, surface, raised, border, primary, secondary, text, muted, iconFilter, glow } = spec;
  const [red, green, blue] = rgb(primary);
  const accentGlow = glow > 0 ? "0 0 16px " + rgba(primary, glow) : "none";
  const extraGlow = glow > 0 ? ", 0 0 18px " + rgba(primary, glow) : "";
  const subtleGlow = glow > 0 ? ", 0 0 8px " + rgba(primary, glow * 0.7) : "";
  const actionStart = mix(primary, raised, 0.58);
  const actionEnd = mix(primary, surface, 0.42);
  const contentGlow = rgba(primary, 0.06 + glow * 0.13);
  return {
    ...AC_CARBON_THEME_VARIABLES,
    "--ac-background": background,
    "--ac-surface": surface,
    "--ac-surface-raised": raised,
    "--ac-surface-interactive": raised,
    "--ac-text-primary": text,
    "--ac-text-secondary": muted,
    "--ac-text-muted": muted,
    "--ac-accent": primary,
    "--ac-accent-strong": secondary,
    "--ac-border-subtle": border,
    "--ac-border-strong": primary,
    "--ac-primary-action-border": primary,
    "--ac-page": linear(background, surface, 120),
    "--ac-card": rgba(surface, 0.94),
    "--ac-raised": linear(raised, surface, 90),
    "--ac-interactive": rgba(raised, 0.88),
    "--ac-content-card": "radial-gradient(circle at 15% 45%, " + contentGlow + ", transparent 52%), " + linear(surface, raised),
    "--ac-content-stat": "radial-gradient(circle at 15% 50%, " + rgba(primary, 0.06 + glow * 0.08) + ", transparent 50%), " + linear(raised, mix(raised, surface, 0.7)),
    "--ac-progress-track": rgba(muted, 0.22),
    "--ac-progress-fill": linear(primary, spec.progressEnd ?? secondary, 90),
    "--ac-xp-fill": linear(secondary, primary, 90),
    "--ac-focus-overlay": linear(rgba(primary, 0.23), rgba(secondary, 0.11), 180),
    "--ac-selection-overlay": linear(rgba(primary, 0.29), rgba(primary, 0.16), 180),
    "--ac-primary-action": linear(actionStart, actionEnd),
    "--ac-activity-trend-fill": linear(secondary, primary, 180),
    "--ac-activity-trend-empty": mix(raised, surface, 0.7),
    "--ac-compact-primary-action": linear(mix(primary, raised, 0.23), raised),
    "--ac-compact-row": linear(surface, mix(raised, surface, 0.7), 150),
    "--ac-focus-border": primary,
    "--ac-focus-background": linear(rgba(primary, 0.27), rgba(primary, 0.13), 180),
    "--ac-focus-shadow": "0 0 0 2px " + rgba(primary, 0.86) + extraGlow + ", inset 0 1px 0 rgba(255, 255, 255, 0.12)",
    "--ac-focus-inset-shadow": "inset 0 0 0 1px " + rgba(primary, 0.78) + ", inset 0 0 0 999px " + rgba(primary, 0.08),
    "--ac-focus-primary-background": linear(mix(primary, raised, 0.7), actionStart),
    "--ac-focus-primary-border": primary,
    "--ac-focus-primary-shadow": "0 0 0 3px " + rgba(primary, 0.94) + extraGlow + ", inset 0 1px 0 rgba(255, 255, 255, 0.18)",
    "--ac-focus-calendar-day-shadow": "inset 0 0 0 1px " + primary + subtleGlow,
    "--ac-focus-compact-border": primary,
    "--ac-focus-compact-background": linear(mix(primary, raised, 0.31), raised),
    "--ac-focus-compact-shadow": "0 0 0 1px " + rgba(primary, 0.82) + subtleGlow,
    "--ac-focus-passive-shadow": "inset 0 0 0 1px " + rgba(primary, 0.18),
    "--ac-selection-text": primary,
    "--ac-selection-underline": "inset 0 -3px 0 " + rgba(primary, 0.88),
    "--ac-calendar-0": mix(raised, background, 0.62),
    "--ac-calendar-1": mix(primary, raised, 0.22),
    "--ac-calendar-2": mix(primary, raised, 0.46),
    "--ac-calendar-3": mix(primary, raised, 0.72),
    "--ac-calendar-4": primary,
    "--ac-chooser-border": border,
    "--ac-chooser-focus-border": primary,
    "--ac-chooser-focus-shadow": "0 0 0 1px " + rgba(primary, 0.88) + extraGlow,
    "--ac-chooser-chevron": primary,
    "--ac-icon-filter": iconFilter,
    "--ac-avatar-background": linear(rgba(primary, 0.22), background, 145),
    "--ac-avatar-glow": accentGlow,
    "--ac-accent-glow": accentGlow,
    "--ac-accent-text-glow": glow > 0 ? "0 0 22px " + rgba(primary, glow * 0.65) : "none",
    "--ac-primary-chip-shadow": "0 0 0 1px " + rgba(primary, 0.6) + extraGlow + ", inset 0 1px 0 rgba(255, 255, 255, 0.12)",
    "--ac-settings-save-border": rgba(primary, 0.68),
    "--ac-settings-save-background": rgba(mix(primary, raised, 0.3), 0.82),
    "--ac-footer-background": linear(surface, background, 180),
    "--ac-progress-glow-rgb": [red, green, blue].join(", "),
    "--ac-loading-page": "radial-gradient(ellipse at 20% 8%, " + rgba(primary, 0.08 + glow * 0.09) + ", transparent 42%), " + linear(background, surface, 145),
    "--ac-loading-info-background": linear(raised, surface, 145) + " padding-box, " + linear(rgba(primary, 0.58), rgba(secondary, 0.44)) + " border-box",
    "--ac-loading-info-shadow": "0 8px 26px rgba(0, 0, 0, 0.2)" + extraGlow,
    "--ac-loading-mark-background": "radial-gradient(circle at 36% 24%, " + raised + ", " + background + " 73%)",
    "--ac-loading-mark-shadow": "inset 0 0 0 1px " + rgba(border, 0.7) + extraGlow,
    "--ac-loading-ring": "conic-gradient(from -28deg, " + secondary + " 0deg, " + primary + " 112deg, " + mix(primary, secondary, 0.5) + " 214deg, " + mix(primary, raised, 0.55) + " 280deg, " + raised + " 281deg, " + raised + " 360deg)",
    "--ac-loading-well": "radial-gradient(circle at 38% 24%, " + raised + ", " + background + " 74%)",
    "--ac-loading-well-border": rgba(border, 0.75),
    "--ac-loading-deck-icon-filter": iconFilter + (glow > 0 ? " drop-shadow(0 0 7px " + rgba(primary, glow) + ")" : ""),
    "--ac-loading-badge-background": linear(raised, surface, 145),
    "--ac-loading-badge-border": rgba(primary, 0.62),
    "--ac-loading-badge-shadow": "0 0 0 2px " + rgba(primary, 0.42) + extraGlow,
    "--ac-loading-provider-icon-filter": (spec.providerIconFilter ?? "brightness(0) invert(1)") + (glow > 0 ? " drop-shadow(0 0 4px " + rgba(primary, glow * 0.7) + ")" : ""),
  };
}

/** Arcade is a distinct violet/pink palette; saved Neon selections keep the original palette. */
export const AC_ARCADE_THEME_VARIABLES = createPaletteTheme({
  background: "#100B20", surface: "#1D1434", raised: "#30234D", border: "#574474",
  primary: "#FF4DCC", secondary: "#3DEBFF", text: "#F6F0FF", muted: "#BCAED0",
  iconFilter: "brightness(0) saturate(100%) invert(61%) sepia(99%) saturate(2825%) hue-rotate(277deg) brightness(104%) contrast(102%)",
  glow: 0.42,
});

/** Midnight northern-lights chrome with mint-teal and restrained lavender accents. */
export const AC_AURORA_THEME_VARIABLES = createPaletteTheme({
  background: "#0C1720", surface: "#12242B", raised: "#1B3540", border: "#31505B",
  primary: "#52E0C4", secondary: "#AD91F3", text: "#EAF6F5", muted: "#A3B9BC",
  iconFilter: "brightness(0) saturate(100%) invert(85%) sepia(33%) saturate(927%) hue-rotate(111deg) brightness(92%) contrast(91%)",
  glow: 0.12,
});

/** Warm sandstone and sage chrome with dark text for a distinct light theme. */
export const AC_DUNE_THEME_VARIABLES = createPaletteTheme({
  background: "#F7F0E2", surface: "#EFE2CC", raised: "#E4D2B5", border: "#BFA98B",
  primary: "#986141", secondary: "#52736C", text: "#30271E", muted: "#726253",
  iconFilter: "brightness(0) saturate(100%) invert(39%) sepia(28%) saturate(1000%) hue-rotate(341deg) brightness(91%) contrast(88%)",
  providerIconFilter: "brightness(0) saturate(100%) invert(13%) sepia(13%) saturate(1005%) hue-rotate(348deg) brightness(94%) contrast(88%)",
  glow: 0,
});

/** Ember keeps its content panels charcoal, with restrained orange and amber emphasis. */
export const AC_EMBER_THEME_VARIABLES = createPaletteTheme({
  background: "#111315", surface: "#1D2023", raised: "#2C3032", border: "#414345",
  primary: "#FF743D", secondary: "#FFC05A", text: "#F5F0EA", muted: "#B8B1A9",
  iconFilter: "brightness(0) saturate(100%) invert(62%) sepia(81%) saturate(2225%) hue-rotate(331deg) brightness(102%) contrast(102%)",
  glow: 0.12,
});

/** Near-black green with bright phosphor controls and a soft CRT-like focus glow. */
export const AC_TERMINAL_THEME_VARIABLES = createPaletteTheme({
  background: "#080D09", surface: "#111914", raised: "#1C2A1F", border: "#34523A",
  primary: "#78EE8A", secondary: "#C0F77B", text: "#E4F5E5", muted: "#9DC7A4",
  iconFilter: "brightness(0) saturate(100%) invert(85%) sepia(35%) saturate(826%) hue-rotate(66deg) brightness(100%) contrast(93%)",
  glow: 0.18,
});

/** Refined graphite and champagne gold with almost no decorative glow. */
export const AC_ONYX_THEME_VARIABLES = createPaletteTheme({
  background: "#0D0D0F", surface: "#1A1A1D", raised: "#29282B", border: "#403A32",
  primary: "#D9B66E", secondary: "#A88B58", text: "#F4F0E8", muted: "#B9AFA0",
  iconFilter: "brightness(0) saturate(100%) invert(78%) sepia(25%) saturate(834%) hue-rotate(355deg) brightness(96%) contrast(87%)",
  glow: 0,
});

/** Olive monochrome handheld chrome with dark LCD text and controls. */
export const AC_POCKET_LCD_THEME_VARIABLES = createPaletteTheme({
  background: "#D7E2A5", surface: "#BACB84", raised: "#9FB66C", border: "#708252",
  primary: "#405A3A", secondary: "#66763F", text: "#253421", muted: "#526B48",
  iconFilter: "brightness(0) saturate(100%) invert(32%) sepia(17%) saturate(862%) hue-rotate(63deg) brightness(89%) contrast(86%)",
  providerIconFilter: "brightness(0) saturate(100%) invert(18%) sepia(18%) saturate(882%) hue-rotate(63deg) brightness(89%) contrast(89%)",
  glow: 0,
});

/** Functional RA-inspired dark chrome: blue navigation, gold kept as a secondary accent. */
export const AC_RA_CLASSIC_THEME_VARIABLES = createPaletteTheme({
  background: "#151515", surface: "#222222", raised: "#313131", border: "#444444",
  primary: "#58A6E7", secondary: "#DDB63E", text: "#F0F0EF", muted: "#B8B8B8",
  iconFilter: "brightness(0) saturate(100%) invert(66%) sepia(30%) saturate(1368%) hue-rotate(172deg) brightness(96%) contrast(87%)",
  glow: 0,
  progressEnd: "#8AC4F1",
});

/** Sophisticated burgundy chrome with dusty rose and soft pink accents. */
export const AC_ROSEWOOD_THEME_VARIABLES = createPaletteTheme({
  background: "#1B1118", surface: "#2C1B25", raised: "#3A2532", border: "#644152",
  primary: "#DE879F", secondary: "#C9A0AE", text: "#FFF1F4", muted: "#C7A9B5",
  iconFilter: "brightness(0) saturate(100%) invert(68%) sepia(22%) saturate(1029%) hue-rotate(294deg) brightness(93%) contrast(87%)",
  glow: 0.06,
});

/** Solarized-inspired blue-green chrome with mustard and subdued cyan accents. */
export const AC_SOLARIZED_THEME_VARIABLES = createPaletteTheme({
  background: "#002B36", surface: "#073642", raised: "#155164", border: "#586E75",
  primary: "#B58900", secondary: "#2AA198", text: "#EEE8D5", muted: "#93A1A1",
  iconFilter: "brightness(0) saturate(100%) invert(55%) sepia(65%) saturate(1634%) hue-rotate(13deg) brightness(91%) contrast(101%)",
  glow: 0,
});

/** Slate-blue native-Steam-inspired chrome without added glow. */
export const AC_STEAM_THEME_VARIABLES = createPaletteTheme({
  background: "#171A21", surface: "#1B2838", raised: "#2A475E", border: "#3A5368",
  primary: "#66C0F4", secondary: "#1A9FFF", text: "#E6F0F7", muted: "#A9BCCB",
  iconFilter: "brightness(0) saturate(100%) invert(75%) sepia(39%) saturate(1037%) hue-rotate(169deg) brightness(101%) contrast(91%)",
  glow: 0,
});
/** Deep evergreen chrome with moss and sage accents; provider status colors stay semantic. */
export const AC_GROVE_THEME_VARIABLES = {
  "--ac-background": "#0b1511",
  "--ac-surface": "#10221a",
  "--ac-surface-raised": "#193327",
  "--ac-surface-interactive": "#204031",
  "--ac-text-primary": "#f1f8ee",
  "--ac-text-secondary": "#c5d9c6",
  "--ac-text-muted": "#a4bba8",
  "--ac-accent": "#a4d68f",
  "--ac-accent-strong": "#c8e7a6",
  "--ac-border-subtle": "rgba(139, 189, 135, 0.3)",
  "--ac-border-strong": "rgba(174, 222, 151, 0.82)",
  "--ac-primary-action-border": "rgba(174, 222, 151, 0.72)",
  "--ac-page": "linear-gradient(120deg, #0b1511, #14291d 55%, #0c1913)",
  "--ac-card": "rgba(16, 34, 26, 0.94)",
  "--ac-raised": "linear-gradient(90deg, rgba(28, 54, 39, 0.96), rgba(17, 39, 29, 0.94))",
  "--ac-interactive": "rgba(32, 64, 49, 0.86)",
  "--ac-content-card": "radial-gradient(circle at 15% 46%, rgba(159, 210, 136, 0.1), transparent 51%), linear-gradient(110deg, #14271c, #1b3022)",
  "--ac-content-stat": "radial-gradient(circle at 15% 50%, rgba(164, 214, 143, 0.11), transparent 50%), linear-gradient(110deg, #1c3628, #203a2d)",
  "--ac-progress-track": "rgba(160, 192, 155, 0.23)",
  "--ac-progress-fill": "linear-gradient(90deg, #4b966a, #a4d68f)",
  "--ac-xp-fill": "linear-gradient(90deg, #5c8d5f, #c8e7a6)",
  "--ac-focus-overlay": "linear-gradient(180deg, rgba(170, 218, 143, 0.23), rgba(100, 154, 99, 0.15))",
  "--ac-selection-overlay": "linear-gradient(180deg, rgba(170, 218, 143, 0.29), rgba(76, 130, 84, 0.21))",
  "--ac-primary-action": "linear-gradient(110deg, #387655, #4f8d5b)",
  "--ac-activity-trend-fill": "linear-gradient(180deg, #d1eaa5, #6ab276)",
  "--ac-activity-trend-empty": "#2c4937",
  "--ac-compact-primary-action": "linear-gradient(110deg, rgba(52, 104, 69, 0.91), rgba(33, 70, 48, 0.96))",
  "--ac-compact-row": "linear-gradient(150deg, rgba(30, 57, 39, 0.94), rgba(19, 40, 29, 0.97))",
  "--ac-focus-border": "rgba(198, 235, 161, 0.96)",
  "--ac-focus-background": "linear-gradient(180deg, rgba(165, 214, 139, 0.29), rgba(86, 142, 91, 0.21))",
  "--ac-focus-shadow": "0 0 0 2px rgba(198, 235, 161, 0.88), 0 0 17px rgba(121, 188, 112, 0.34), inset 0 1px 0 rgba(255,255,255,0.14)",
  "--ac-focus-inset-shadow": "inset 0 0 0 1px rgba(198, 235, 161, 0.8), inset 0 0 0 999px rgba(162, 211, 136, 0.08)",
  "--ac-focus-primary-background": "linear-gradient(110deg, #42825b, #5c9b64)",
  "--ac-focus-primary-border": "rgba(216, 243, 180, 0.98)",
  "--ac-focus-primary-shadow": "0 0 0 3px rgba(216, 243, 180, 0.95), 0 0 20px rgba(133, 196, 118, 0.44), inset 0 1px 0 rgba(255,255,255,0.22)",
  "--ac-focus-calendar-day-shadow": "inset 0 0 0 1px #e0f3bb, 0 0 6px rgba(164, 214, 143, 0.72)",
  "--ac-focus-compact-border": "rgba(198, 235, 161, 0.96)",
  "--ac-focus-compact-background": "linear-gradient(110deg, rgba(71, 128, 79, 0.9), rgba(40, 84, 56, 0.94))",
  "--ac-focus-compact-shadow": "0 0 0 1px rgba(198, 235, 161, 0.84), 0 0 13px rgba(121, 188, 112, 0.39), inset 0 1px 0 rgba(255,255,255,0.11)",
  "--ac-focus-passive-shadow": "inset 0 0 0 1px rgba(164, 214, 143, 0.22)",
  "--ac-selection-text": "#d4efb8",
  "--ac-selection-underline": "inset 0 -3px 0 rgba(164, 214, 143, 0.9)",
  "--ac-calendar-0": "#294436",
  "--ac-calendar-1": "#386c4e",
  "--ac-calendar-2": "#57965f",
  "--ac-calendar-3": "#83bf79",
  "--ac-calendar-4": "#c5e8a0",
  "--ac-chooser-border": "rgba(139, 189, 135, 0.34)",
  "--ac-chooser-focus-border": "rgba(198, 235, 161, 0.9)",
  "--ac-chooser-focus-shadow": "0 0 0 1px rgba(198, 235, 161, 0.88), 0 0 15px rgba(121, 188, 112, 0.35)",
  "--ac-chooser-chevron": "#a4d68f",
  "--ac-icon-filter": "brightness(0) saturate(100%) invert(83%) sepia(24%) saturate(592%) hue-rotate(57deg) brightness(97%) contrast(91%)",
  "--ac-avatar-background": "linear-gradient(145deg, rgba(164, 214, 143, 0.22), rgba(16, 34, 26, 0.96))",
  "--ac-avatar-glow": "0 0 18px rgba(164, 214, 143, 0.24)",
  "--ac-accent-glow": "0 0 12px rgba(164, 214, 143, 0.22)",
  "--ac-accent-text-glow": "0 0 22px rgba(164, 214, 143, 0.23)",
  "--ac-primary-chip-shadow": "0 0 0 1px rgba(198, 235, 161, 0.55), 0 0 16px rgba(121, 188, 112, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
  "--ac-settings-save-border": "rgba(198, 235, 161, 0.68)",
  "--ac-settings-save-background": "rgba(54, 105, 67, 0.76)",
  "--ac-footer-background": "linear-gradient(180deg, #152a1e, #0a1610)",
  "--ac-progress-glow-rgb": "164, 214, 143",
  "--ac-loading-page": "radial-gradient(ellipse at 20% 8%, rgba(164, 214, 143, 0.12), transparent 42%), linear-gradient(145deg, #0b1511, #14291d 54%, #0c1913)",
  "--ac-loading-info-background": "linear-gradient(145deg, #1c3628, #10221a) padding-box, linear-gradient(112deg, #a4d68f94, #83bf796e 54%, #c8e7a67a) border-box",
  "--ac-loading-info-shadow": "0 8px 26px rgba(0, 0, 0, 0.2), 0 0 24px rgba(164, 214, 143, 0.07)",
  "--ac-loading-mark-background": "radial-gradient(circle at 36% 24%, #31563b, #0b1511 73%)",
  "--ac-loading-mark-shadow": "0 0 34px rgba(164, 214, 143, 0.2), inset 0 0 0 1px rgba(198, 235, 161, 0.18)",
  "--ac-loading-ring": "conic-gradient(from -28deg, #c8e7a6 0deg, #a4d68f 112deg, #83bf79 214deg, #57965f 280deg, #2c4937 281deg, #2c4937 360deg)",
  "--ac-loading-well": "radial-gradient(circle at 38% 24%, #294a34, #0b1511 74%)",
  "--ac-loading-well-border": "rgba(198, 235, 161, 0.2)",
  "--ac-loading-deck-icon-filter": "brightness(0) saturate(100%) invert(83%) sepia(24%) saturate(592%) hue-rotate(57deg) brightness(97%) contrast(91%) drop-shadow(0 0 7px rgba(164, 214, 143, 0.32))",
  "--ac-loading-badge-background": "linear-gradient(145deg, #294a34, #10221a)",
  "--ac-loading-badge-border": "rgba(216, 243, 180, 0.62)",
  "--ac-loading-badge-shadow": "0 0 0 2px rgba(164, 214, 143, 0.46), 0 0 15px rgba(121, 188, 112, 0.2)",
  "--ac-loading-provider-icon-filter": "brightness(0) invert(1) drop-shadow(0 0 4px rgba(164, 214, 143, 0.22))",
} as const satisfies ThemeVariables;

/** Ink-dark parchment chrome with cream and antique-brass accents for legible shared surfaces. */
export const AC_PAPER_THEME_VARIABLES = {
  "--ac-background": "#15130f",
  "--ac-surface": "#211d17",
  "--ac-surface-raised": "#302a20",
  "--ac-surface-interactive": "#3a3226",
  "--ac-text-primary": "#faf4e5",
  "--ac-text-secondary": "#ded2b9",
  "--ac-text-muted": "#b9ab90",
  "--ac-accent": "#e5cca0",
  "--ac-accent-strong": "#f3dfb6",
  "--ac-border-subtle": "rgba(199, 173, 127, 0.29)",
  "--ac-border-strong": "rgba(235, 210, 164, 0.82)",
  "--ac-primary-action-border": "rgba(235, 210, 164, 0.72)",
  "--ac-page": "linear-gradient(120deg, #15130f, #262016 55%, #19150f)",
  "--ac-card": "rgba(33, 29, 23, 0.94)",
  "--ac-raised": "linear-gradient(90deg, rgba(51, 44, 31, 0.96), rgba(35, 31, 24, 0.94))",
  "--ac-interactive": "rgba(58, 50, 38, 0.86)",
  "--ac-content-card": "radial-gradient(circle at 15% 46%, rgba(229, 204, 160, 0.09), transparent 51%), linear-gradient(110deg, #292319, #332b1f)",
  "--ac-content-stat": "radial-gradient(circle at 15% 50%, rgba(229, 204, 160, 0.1), transparent 50%), linear-gradient(110deg, #332b20, #3b3225)",
  "--ac-progress-track": "rgba(197, 174, 132, 0.24)",
  "--ac-progress-fill": "linear-gradient(90deg, #9d8052, #e5cca0)",
  "--ac-xp-fill": "linear-gradient(90deg, #a58c62, #f3dfb6)",
  "--ac-focus-overlay": "linear-gradient(180deg, rgba(238, 212, 163, 0.22), rgba(169, 134, 81, 0.15))",
  "--ac-selection-overlay": "linear-gradient(180deg, rgba(229, 204, 160, 0.27), rgba(147, 112, 66, 0.2))",
  "--ac-primary-action": "linear-gradient(110deg, #74603d, #8c7247)",
  "--ac-activity-trend-fill": "linear-gradient(180deg, #f3dfb6, #b99863)",
  "--ac-activity-trend-empty": "#49402f",
  "--ac-compact-primary-action": "linear-gradient(110deg, rgba(99, 80, 48, 0.91), rgba(67, 55, 36, 0.96))",
  "--ac-compact-row": "linear-gradient(150deg, rgba(53, 45, 31, 0.94), rgba(39, 34, 26, 0.97))",
  "--ac-focus-border": "rgba(249, 228, 183, 0.96)",
  "--ac-focus-background": "linear-gradient(180deg, rgba(229, 204, 160, 0.27), rgba(153, 121, 72, 0.2))",
  "--ac-focus-shadow": "0 0 0 2px rgba(249, 228, 183, 0.89), 0 0 17px rgba(207, 171, 109, 0.34), inset 0 1px 0 rgba(255,255,255,0.14)",
  "--ac-focus-inset-shadow": "inset 0 0 0 1px rgba(249, 228, 183, 0.8), inset 0 0 0 999px rgba(229, 204, 160, 0.08)",
  "--ac-focus-primary-background": "linear-gradient(110deg, #866c44, #9a7d4c)",
  "--ac-focus-primary-border": "rgba(255, 239, 203, 0.98)",
  "--ac-focus-primary-shadow": "0 0 0 3px rgba(255, 239, 203, 0.95), 0 0 20px rgba(219, 182, 117, 0.44), inset 0 1px 0 rgba(255,255,255,0.22)",
  "--ac-focus-calendar-day-shadow": "inset 0 0 0 1px #fff0c8, 0 0 6px rgba(229, 204, 160, 0.72)",
  "--ac-focus-compact-border": "rgba(249, 228, 183, 0.96)",
  "--ac-focus-compact-background": "linear-gradient(110deg, rgba(126, 101, 61, 0.9), rgba(78, 64, 41, 0.94))",
  "--ac-focus-compact-shadow": "0 0 0 1px rgba(249, 228, 183, 0.84), 0 0 13px rgba(207, 171, 109, 0.39), inset 0 1px 0 rgba(255,255,255,0.11)",
  "--ac-focus-passive-shadow": "inset 0 0 0 1px rgba(229, 204, 160, 0.22)",
  "--ac-selection-text": "#f3dfb6",
  "--ac-selection-underline": "inset 0 -3px 0 rgba(229, 204, 160, 0.9)",
  "--ac-calendar-0": "#42392a",
  "--ac-calendar-1": "#68563a",
  "--ac-calendar-2": "#9a7950",
  "--ac-calendar-3": "#cfab73",
  "--ac-calendar-4": "#f3dfb6",
  "--ac-chooser-border": "rgba(199, 173, 127, 0.34)",
  "--ac-chooser-focus-border": "rgba(249, 228, 183, 0.9)",
  "--ac-chooser-focus-shadow": "0 0 0 1px rgba(249, 228, 183, 0.88), 0 0 15px rgba(207, 171, 109, 0.35)",
  "--ac-chooser-chevron": "#e5cca0",
  "--ac-icon-filter": "brightness(0) saturate(100%) invert(86%) sepia(17%) saturate(513%) hue-rotate(348deg) brightness(98%) contrast(92%)",
  "--ac-avatar-background": "linear-gradient(145deg, rgba(229, 204, 160, 0.22), rgba(33, 29, 23, 0.96))",
  "--ac-avatar-glow": "0 0 18px rgba(229, 204, 160, 0.24)",
  "--ac-accent-glow": "0 0 12px rgba(229, 204, 160, 0.22)",
  "--ac-accent-text-glow": "0 0 22px rgba(229, 204, 160, 0.23)",
  "--ac-primary-chip-shadow": "0 0 0 1px rgba(249, 228, 183, 0.55), 0 0 16px rgba(207, 171, 109, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
  "--ac-settings-save-border": "rgba(249, 228, 183, 0.68)",
  "--ac-settings-save-background": "rgba(106, 86, 51, 0.76)",
  "--ac-footer-background": "linear-gradient(180deg, #262016, #15120e)",
  "--ac-progress-glow-rgb": "229, 204, 160",
  "--ac-loading-page": "radial-gradient(ellipse at 20% 8%, rgba(229, 204, 160, 0.11), transparent 42%), linear-gradient(145deg, #15130f, #262016 54%, #19150f)",
  "--ac-loading-info-background": "linear-gradient(145deg, #332b20, #211d17) padding-box, linear-gradient(112deg, #e5cca094, #cfab736e 54%, #f3dfb67a) border-box",
  "--ac-loading-info-shadow": "0 8px 26px rgba(0, 0, 0, 0.2), 0 0 24px rgba(229, 204, 160, 0.07)",
  "--ac-loading-mark-background": "radial-gradient(circle at 36% 24%, #554832, #15130f 73%)",
  "--ac-loading-mark-shadow": "0 0 34px rgba(229, 204, 160, 0.2), inset 0 0 0 1px rgba(249, 228, 183, 0.18)",
  "--ac-loading-ring": "conic-gradient(from -28deg, #f3dfb6 0deg, #e5cca0 112deg, #cfab73 214deg, #9a7950 280deg, #49402f 281deg, #49402f 360deg)",
  "--ac-loading-well": "radial-gradient(circle at 38% 24%, #403725, #15130f 74%)",
  "--ac-loading-well-border": "rgba(249, 228, 183, 0.2)",
  "--ac-loading-deck-icon-filter": "brightness(0) saturate(100%) invert(86%) sepia(17%) saturate(513%) hue-rotate(348deg) brightness(98%) contrast(92%) drop-shadow(0 0 7px rgba(229, 204, 160, 0.32))",
  "--ac-loading-badge-background": "linear-gradient(145deg, #403725, #211d17)",
  "--ac-loading-badge-border": "rgba(255, 239, 203, 0.62)",
  "--ac-loading-badge-shadow": "0 0 0 2px rgba(229, 204, 160, 0.46), 0 0 15px rgba(207, 171, 109, 0.2)",
  "--ac-loading-provider-icon-filter": "brightness(0) invert(1) drop-shadow(0 0 4px rgba(229, 204, 160, 0.22))",
} as const satisfies ThemeVariables;

/** Burgundy and warm ivory chrome with muted rose focus; provider states remain semantic. */
export const AC_VELVET_THEME_VARIABLES = {
  ...AC_EMBER_THEME_VARIABLES,
  "--ac-background": "#140b12",
  "--ac-surface": "#21131d",
  "--ac-surface-raised": "#321d2b",
  "--ac-surface-interactive": "#442638",
  "--ac-text-primary": "#fff1e9",
  "--ac-text-secondary": "#e2c6cb",
  "--ac-text-muted": "#bea2aa",
  "--ac-accent": "#e3a6b6",
  "--ac-accent-strong": "#f2c2cb",
  "--ac-border-subtle": "rgba(193, 113, 142, 0.33)",
  "--ac-border-strong": "rgba(232, 166, 188, 0.84)",
  "--ac-primary-action-border": "rgba(232, 166, 188, 0.76)",
  "--ac-page": "linear-gradient(120deg, #140b12, #291321 55%, #190c16)",
  "--ac-card": "rgba(35, 19, 31, 0.94)",
  "--ac-raised": "linear-gradient(90deg, #3b2031, #261622)",
  "--ac-interactive": "rgba(68, 38, 56, 0.88)",
  "--ac-content-card": "radial-gradient(circle at 15% 46%, rgba(229, 158, 184, 0.1), transparent 51%), linear-gradient(110deg, #281624, #361c2e)",
  "--ac-content-stat": "linear-gradient(110deg, #361d2d, #442638)",
  "--ac-progress-track": "rgba(197, 134, 159, 0.25)",
  "--ac-progress-fill": "linear-gradient(90deg, #8e3d66, #e3a6b6)",
  "--ac-xp-fill": "linear-gradient(90deg, #9c4c76, #f2c2cb)",
  "--ac-focus-overlay": "linear-gradient(180deg, rgba(224, 136, 170, 0.24), rgba(151, 70, 112, 0.16))",
  "--ac-selection-overlay": "linear-gradient(180deg, rgba(224, 136, 170, 0.29), rgba(128, 54, 96, 0.21))",
  "--ac-primary-action": "linear-gradient(110deg, #743252, #9d4c72)",
  "--ac-activity-trend-fill": "linear-gradient(180deg, #f2c2cb, #ae5b83)",
  "--ac-activity-trend-empty": "#4b293e",
  "--ac-compact-primary-action": "linear-gradient(110deg, #67304c, #442238)",
  "--ac-compact-row": "linear-gradient(150deg, #391f30, #261622)",
  "--ac-focus-border": "rgba(245, 194, 210, 0.96)",
  "--ac-focus-background": "linear-gradient(180deg, rgba(218, 129, 164, 0.31), rgba(133, 55, 102, 0.22))",
  "--ac-focus-shadow": "0 0 0 2px rgba(245, 194, 210, 0.9), 0 0 17px rgba(204, 103, 149, 0.35)",
  "--ac-focus-inset-shadow": "inset 0 0 0 1px rgba(245, 194, 210, 0.82), inset 0 0 0 999px rgba(218, 129, 164, 0.09)",
  "--ac-focus-primary-background": "linear-gradient(110deg, #8a3b60, #a95179)",
  "--ac-focus-primary-border": "rgba(255, 213, 223, 0.98)",
  "--ac-focus-primary-shadow": "0 0 0 3px rgba(255, 213, 223, 0.95), 0 0 20px rgba(204, 103, 149, 0.44)",
  "--ac-focus-calendar-day-shadow": "inset 0 0 0 1px #ffcfdf, 0 0 6px rgba(224, 136, 170, 0.72)",
  "--ac-focus-compact-border": "rgba(245, 194, 210, 0.96)",
  "--ac-focus-compact-background": "linear-gradient(110deg, #864061, #5f2c4a)",
  "--ac-focus-compact-shadow": "0 0 0 1px rgba(245, 194, 210, 0.86), 0 0 13px rgba(204, 103, 149, 0.38)",
  "--ac-focus-passive-shadow": "inset 0 0 0 1px rgba(224, 136, 170, 0.24)",
  "--ac-selection-text": "#f5c2d2",
  "--ac-selection-underline": "inset 0 -3px 0 rgba(224, 136, 170, 0.9)",
  "--ac-calendar-0": "#43263a",
  "--ac-calendar-1": "#6c3654",
  "--ac-calendar-2": "#9d4c72",
  "--ac-calendar-3": "#cf7da0",
  "--ac-calendar-4": "#f2c2cb",
  "--ac-chooser-border": "rgba(193, 113, 142, 0.36)",
  "--ac-chooser-focus-border": "rgba(245, 194, 210, 0.9)",
  "--ac-chooser-focus-shadow": "0 0 0 1px rgba(245, 194, 210, 0.88), 0 0 15px rgba(204, 103, 149, 0.35)",
  "--ac-chooser-chevron": "#e3a6b6",
  "--ac-icon-filter": "brightness(0) saturate(100%) invert(79%) sepia(17%) saturate(577%) hue-rotate(295deg)",
  "--ac-avatar-background": "linear-gradient(145deg, rgba(227, 166, 182, 0.22), #21131d)",
  "--ac-avatar-glow": "0 0 18px rgba(227, 166, 182, 0.24)",
  "--ac-accent-glow": "0 0 12px rgba(227, 166, 182, 0.22)",
  "--ac-accent-text-glow": "0 0 22px rgba(227, 166, 182, 0.22)",
  "--ac-primary-chip-shadow": "0 0 0 1px rgba(245, 194, 210, 0.55), 0 0 16px rgba(204, 103, 149, 0.25)",
  "--ac-settings-save-border": "rgba(245, 194, 210, 0.68)",
  "--ac-settings-save-background": "#67304c",
  "--ac-footer-background": "linear-gradient(180deg, #281724, #120a10)",
  "--ac-progress-glow-rgb": "227, 166, 182",
  "--ac-loading-page": "radial-gradient(ellipse at 20% 8%, rgba(227, 166, 182, 0.12), transparent 42%), linear-gradient(145deg, #140b12, #291321 54%, #190c16)",
  "--ac-loading-info-background": "linear-gradient(145deg, #361d2d, #21131d) padding-box, linear-gradient(112deg, #e3a6b694, #cf7da06e 54%, #f2c2cb7a) border-box",
  "--ac-loading-info-shadow": "0 8px 26px rgba(0, 0, 0, 0.2), 0 0 24px rgba(227, 166, 182, 0.07)",
  "--ac-loading-mark-background": "radial-gradient(circle at 36% 24%, #512c42, #140b12 73%)",
  "--ac-loading-mark-shadow": "0 0 34px rgba(227, 166, 182, 0.2), inset 0 0 0 1px rgba(245, 194, 210, 0.18)",
  "--ac-loading-ring": "conic-gradient(from -28deg, #f2c2cb 0deg, #e3a6b6 112deg, #cf7da0 214deg, #9d4c72 280deg, #4b293e 281deg, #4b293e 360deg)",
  "--ac-loading-well": "radial-gradient(circle at 38% 24%, #46283b, #140b12 74%)",
  "--ac-loading-well-border": "rgba(245, 194, 210, 0.2)",
  "--ac-loading-deck-icon-filter": "brightness(0) saturate(100%) invert(79%) sepia(17%) saturate(577%) hue-rotate(295deg) drop-shadow(0 0 7px rgba(227, 166, 182, 0.32))",
  "--ac-loading-badge-background": "linear-gradient(145deg, #46283b, #21131d)",
  "--ac-loading-badge-border": "rgba(255, 213, 223, 0.62)",
  "--ac-loading-badge-shadow": "0 0 0 2px rgba(227, 166, 182, 0.46), 0 0 15px rgba(204, 103, 149, 0.2)",
  "--ac-loading-provider-icon-filter": "brightness(0) invert(1) drop-shadow(0 0 4px rgba(227, 166, 182, 0.22))",
} as const satisfies ThemeVariables;

const THEME_VARIABLES: Partial<Record<AchievementCompanionTheme, ThemeVariables>> = {
  "ac-neon": AC_NEON_THEME_VARIABLES,
  "ac-arcade": AC_ARCADE_THEME_VARIABLES,
  "ac-aurora": AC_AURORA_THEME_VARIABLES,
  "ac-carbon": AC_CARBON_THEME_VARIABLES,
  "ac-dune": AC_DUNE_THEME_VARIABLES,
  "ac-ember": AC_EMBER_THEME_VARIABLES,
  "ac-grove": AC_GROVE_THEME_VARIABLES,
  "ac-onyx": AC_ONYX_THEME_VARIABLES,
  "ac-paper": AC_PAPER_THEME_VARIABLES,
  "ac-pocket-lcd": AC_POCKET_LCD_THEME_VARIABLES,
  "ac-ra-classic": AC_RA_CLASSIC_THEME_VARIABLES,
  "ac-rosewood": AC_ROSEWOOD_THEME_VARIABLES,
  "ac-solarized": AC_SOLARIZED_THEME_VARIABLES,
  "ac-steam": AC_STEAM_THEME_VARIABLES,
  "ac-terminal": AC_TERMINAL_THEME_VARIABLES,
  "ac-velvet": AC_VELVET_THEME_VARIABLES,
};

export function achievementCompanionThemeUsesDarkText(theme: AchievementCompanionTheme): boolean {
  const text = THEME_VARIABLES[theme]?.["--ac-text-primary"];
  if (text === undefined) return false;
  const [red, green, blue] = rgb(text);
  return (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255 < 0.5;
}

const themedThemeIds = new Set<string>(["ac-blue", "ac-glacier", ...Object.keys(THEME_VARIABLES)]);

const themedDocuments = new Set<Document>();

export function applyAchievementCompanionTheme(ownerDocument: Document, theme: AchievementCompanionTheme): void {
  themedDocuments.add(ownerDocument);
  const rootStyle = ownerDocument.documentElement.style;
  // Clear the retired light-theme text role during hot reloads.
  rootStyle.removeProperty("--ac-foreground-rgb");
  for (const name of Object.keys(AC_NEON_THEME_VARIABLES)) rootStyle.removeProperty(name);
  for (const [name, value] of Object.entries(THEME_VARIABLES[theme] ?? {})) rootStyle.setProperty(name, value);
  ownerDocument.documentElement.dataset["acTheme"] = theme;
}

export function clearAchievementCompanionThemes(): void {
  for (const ownerDocument of themedDocuments) {
    const theme = ownerDocument.documentElement.dataset["acTheme"];
    if (theme === undefined || !themedThemeIds.has(theme)) continue;
    for (const name of Object.keys(AC_NEON_THEME_VARIABLES)) ownerDocument.documentElement.style.removeProperty(name);
    ownerDocument.documentElement.style.removeProperty("--ac-foreground-rgb");
    delete ownerDocument.documentElement.dataset["acTheme"];
  }
  themedDocuments.clear();
}
