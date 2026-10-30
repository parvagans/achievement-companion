import type { CSSProperties } from "react";
import { steamTheme } from "./steam-theme";

/** Same responsive control column for dropdowns and toggles; labels own the remaining space. */
export function getAppearanceSettingsRowStyle(): CSSProperties {
  return { display: "grid", gridTemplateColumns: "minmax(0, 1fr) min(8.375em, 60%)", alignItems: "center", gap: 10,
    minWidth: 0, minHeight: 44, padding: "10px 12px", boxSizing: "border-box" };
}

export function getNativeAppearanceSettingsRowsCss(fieldClass: string): string {
  // Field is Decky's exported native class, not a guessed Steam hash or a global override.
  const field = `[data-ac-appearance-row] .${fieldClass}`;
  return `
${field} { display:grid; grid-template-columns:minmax(0,1fr) min(8.375em,60%); align-items:center; column-gap:10px;
  width:100%; min-width:0; min-height:44px; padding:10px 0; margin:0; box-sizing:border-box; border-bottom:1px solid ${steamTheme.color.borderSubtle}; }
${field} > :first-child { min-width:0; width:auto; margin:0; }
${field} > :last-child, ${field} > :last-child > div, ${field} > :last-child > div > div {
  min-width:0; width:100%; max-width:100%; margin:0; display:flex; align-items:center; justify-content:flex-end; }
/* Native ToggleField does not forward the grow preset; override only its owned column cap. */
${field} > :last-child { max-width:100% !important; }
${field} button[role="combobox"] { width:100%; min-width:0; max-width:100%; box-sizing:border-box; }
[data-ac-appearance-row] .ac-appearance-value { display:block; min-width:0; white-space:normal; overflow-wrap:anywhere; line-height:1.25; }
[data-ac-appearance-row] .DialogDropDown_CurrentDisplay { min-width:0; white-space:normal; overflow:visible; text-overflow:clip; }
${field} > :first-child { overflow-wrap:anywhere; }
`;
}

/** Compact native buttons keep their option text and stored values; only resting labels shorten. */
export function getCompactAppearanceValueLabel(value: string): string {
  return value === "Always Show" ? "Always" : value === "Blue (Default)" ? "Blue" : value;
}
