import { type JSX } from "react";

export const DECKY_FOCUS_NAV_ROW_CLASS = "achievement-companion-focus-nav-row";
export const DECKY_FOCUS_ACTION_ROW_CLASS = "achievement-companion-focus-action-row";
export const DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS = "achievement-companion-focus-achievement-row";
export const DECKY_FOCUS_PILL_CLASS = "achievement-companion-focus-pill";
export const DECKY_FOCUS_PILL_ACTIVE_CLASS = "achievement-companion-focus-pill--focused";
export const DECKY_FOCUS_PILL_ACTIVE_WITHIN_CLASS = "achievement-companion-focus-pill--focus-within";
export const DECKY_FULLSCREEN_CHIP_CLASS = "achievement-companion-fullscreen-chip";
export const DECKY_FULLSCREEN_CHIP_SELECTED_CLASS = "achievement-companion-fullscreen-chip--selected";
export const DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS = "achievement-companion-fullscreen-chip--focused";

const deckyFocusStyles = `
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

.${DECKY_FOCUS_PILL_ACTIVE_CLASS},
.${DECKY_FOCUS_PILL_ACTIVE_WITHIN_CLASS},
.${DECKY_FOCUS_PILL_CLASS}.${DECKY_FOCUS_PILL_ACTIVE_CLASS},
.${DECKY_FOCUS_PILL_CLASS}.${DECKY_FOCUS_PILL_ACTIVE_WITHIN_CLASS},
.${DECKY_FOCUS_PILL_CLASS}:focus-visible,
.${DECKY_FOCUS_PILL_CLASS}:focus-within {
  outline: none;
  outline: 1px solid rgba(255, 255, 255, 0.38);
  outline-offset: 1px;
  background-color: rgba(255, 255, 255, 0.24) !important;
  box-shadow:
    inset 0 0 0 2px rgba(255, 255, 255, 0.28),
    0 0 0 1px rgba(0, 0, 0, 0.18),
    0 6px 18px rgba(0, 0, 0, 0.14);
  transform: translateY(-1px);
}

.${DECKY_FULLSCREEN_CHIP_CLASS} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: auto;
  min-width: 0;
  max-width: 100%;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.065), rgba(255, 255, 255, 0.04));
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: 0.01em;
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-sizing: border-box;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    box-shadow 120ms ease,
    color 120ms ease,
    transform 120ms ease;
}

.${DECKY_FULLSCREEN_CHIP_SELECTED_CLASS} {
  border-color: rgba(255, 255, 255, 0.22);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.12));
  color: rgba(255, 255, 255, 0.98);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.${DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS},
.${DECKY_FULLSCREEN_CHIP_CLASS}:focus-visible,
.${DECKY_FULLSCREEN_CHIP_CLASS}:focus-within {
  outline: 2px solid rgba(255, 255, 255, 0.56);
  outline-offset: 2px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.2));
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.28),
    0 0 0 1px rgba(0, 0, 0, 0.18),
    0 8px 24px rgba(0, 0, 0, 0.18);
  transform: translateY(-1px);
}
`;

export function DeckyFocusStyles(): JSX.Element {
  return <style>{deckyFocusStyles}</style>;
}
