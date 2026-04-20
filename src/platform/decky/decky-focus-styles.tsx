import { type JSX } from "react";

export const DECKY_FOCUS_NAV_ROW_CLASS = "achievement-companion-focus-nav-row";
export const DECKY_FOCUS_ACTION_ROW_CLASS = "achievement-companion-focus-action-row";
export const DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS = "achievement-companion-focus-achievement-row";
export const DECKY_FOCUS_PILL_CLASS = "achievement-companion-focus-pill";
export const DECKY_FOCUS_PILL_ACTIVE_CLASS = "achievement-companion-focus-pill--focused";
export const DECKY_FOCUS_PILL_ACTIVE_WITHIN_CLASS = "achievement-companion-focus-pill--focus-within";
export const DECKY_FULLSCREEN_ACTION_ROW_CLASS = "achievement-companion-fullscreen-action-controls";
export const DECKY_FULLSCREEN_ACTION_ROW_CENTERED_CLASS =
  "achievement-companion-fullscreen-action-controls--centered";
export const DECKY_FULLSCREEN_CHIP_CLASS = "achievement-companion-fullscreen-chip";
export const DECKY_FULLSCREEN_CHIP_SELECTED_CLASS = "achievement-companion-fullscreen-chip--selected";
export const DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS = "achievement-companion-fullscreen-chip--focused";
export const DECKY_ACHIEVEMENT_FILTER_GROUP_CLASS = "achievement-companion-achievement-filter-group";
export const DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS = "achievement-companion-achievement-filter-option";
export const DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS =
  "achievement-companion-achievement-filter-option--selected";
export const DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS =
  "achievement-companion-achievement-filter-option--focused";

export function getDeckyFocusStylesCss(): string {
  return `
.${DECKY_FOCUS_NAV_ROW_CLASS}:focus-visible,
.${DECKY_FOCUS_NAV_ROW_CLASS}:focus-within {
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.16),
    inset 0 0 0 999px rgba(255, 255, 255, 0.03);
  border-radius: 12px;
}

.${DECKY_FOCUS_ACTION_ROW_CLASS}:focus-visible,
.${DECKY_FOCUS_ACTION_ROW_CLASS}:focus-within {
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.22),
    inset 0 0 0 999px rgba(255, 255, 255, 0.035);
  background-color: rgba(255, 255, 255, 0.055);
  border-radius: 999px;
}

.${DECKY_FOCUS_ACTION_ROW_CLASS} {
  display: block;
  width: 100%;
  overflow: hidden;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.02);
}

.${DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS} {
  display: block;
  width: 100%;
  scroll-margin-block: 10px;
  border-radius: 14px;
  overflow: hidden;
  transition:
    background-color 120ms ease,
    box-shadow 120ms ease,
    transform 120ms ease;
}

.${DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}:focus-visible,
.${DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}:focus-within {
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.32),
    inset 0 0 0 999px rgba(255, 255, 255, 0.07),
    0 0 0 1px rgba(0, 0, 0, 0.14);
  background-color: rgba(255, 255, 255, 0.05);
}

.achievement-companion-focus-pill.Panel.Focusable[role="button"] {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.085), rgba(255, 255, 255, 0.035)) !important;
  border: 1px solid rgba(255, 255, 255, 0.16) !important;
  border-radius: 999px !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 2px 10px rgba(0, 0, 0, 0.22) !important;
  color: rgba(255, 255, 255, 0.94) !important;
  transform: none !important;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    box-shadow 120ms ease !important;
}

.achievement-companion-focus-pill.Panel.Focusable[role="button"].achievement-companion-focus-pill--focused,
.achievement-companion-focus-pill.Panel.Focusable[role="button"].gpfocus,
.achievement-companion-focus-pill.Panel.Focusable[role="button"].gpfocuswithin,
.achievement-companion-focus-pill.Panel.Focusable[role="button"]:focus,
.achievement-companion-focus-pill.Panel.Focusable[role="button"]:focus-within {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.065)) !important;
  border-color: rgba(125, 190, 255, 0.7) !important;
  box-shadow:
    0 0 0 1px rgba(96, 165, 250, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 2px 12px rgba(0, 0, 0, 0.28) !important;
}

.achievement-companion-focus-pill.Panel.Focusable[role="button"]::before,
.achievement-companion-focus-pill.Panel.Focusable[role="button"]::after {
  box-shadow: none !important;
  background: transparent !important;
  opacity: 0 !important;
}

.${DECKY_ACHIEVEMENT_FILTER_GROUP_CLASS} {
  display: flex;
  gap: 4px;
  width: 100%;
  padding: 4px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.024);
  box-sizing: border-box;
}

.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS} {
  flex: 1 1 0;
  min-width: 0;
  min-height: 30px;
  padding: 7px 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.028), rgba(255, 255, 255, 0.02));
  color: rgba(255, 255, 255, 0.78);
  box-shadow: none;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.15;
  text-align: center;
  white-space: nowrap;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    box-shadow 120ms ease,
    color 120ms ease;
  -webkit-appearance: none;
  appearance: none;
}

.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS}.${DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS} {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.07));
  border-color: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.98);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  font-weight: 700;
}

.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS}.${DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS},
.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS}.gpfocus,
.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS}.gpfocuswithin,
.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS}:focus,
.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS}:focus-within {
  border-color: rgba(125, 190, 255, 0.62);
  box-shadow:
    0 0 0 1px rgba(96, 165, 250, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 2px 10px rgba(0, 0, 0, 0.24);
  color: rgba(255, 255, 255, 0.96);
  outline: none;
}

.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS}.${DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS}.${DECKY_ACHIEVEMENT_FILTER_OPTION_FOCUSED_CLASS},
.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS}.${DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS}.gpfocus,
.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS}.${DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS}.gpfocuswithin,
.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS}.${DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS}:focus,
.${DECKY_ACHIEVEMENT_FILTER_OPTION_CLASS}.${DECKY_ACHIEVEMENT_FILTER_OPTION_SELECTED_CLASS}:focus-within {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.075));
  border-color: rgba(125, 190, 255, 0.7);
  box-shadow:
    0 0 0 1px rgba(96, 165, 250, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 2px 12px rgba(0, 0, 0, 0.28),
    inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.98);
}

`; 
}

export function DeckyFocusStyles(): JSX.Element {
  return <style>{getDeckyFocusStylesCss()}</style>;
}
