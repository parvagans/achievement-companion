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
} as const;

const themedDocuments = new Set<Document>();

export function applyAchievementCompanionTheme(ownerDocument: Document, theme: AchievementCompanionTheme): void {
  themedDocuments.add(ownerDocument);
  const rootStyle = ownerDocument.documentElement.style;
  for (const [name, value] of Object.entries(AC_NEON_THEME_VARIABLES)) {
    if (theme === "ac-neon") rootStyle.setProperty(name, value);
    else rootStyle.removeProperty(name);
  }
  ownerDocument.documentElement.dataset["acTheme"] = theme;
}

export function clearAchievementCompanionThemes(): void {
  for (const ownerDocument of themedDocuments) {
    if (ownerDocument.documentElement.dataset["acTheme"] !== "ac-blue" && ownerDocument.documentElement.dataset["acTheme"] !== "ac-neon") continue;
    for (const name of Object.keys(AC_NEON_THEME_VARIABLES)) ownerDocument.documentElement.style.removeProperty(name);
    delete ownerDocument.documentElement.dataset["acTheme"];
  }
  themedDocuments.clear();
}
