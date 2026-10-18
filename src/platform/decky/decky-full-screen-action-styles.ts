import {
  DECKY_FULLSCREEN_ACTION_ROW_CLASS,
  DECKY_FULLSCREEN_ACTION_ROW_CENTERED_CLASS,
  DECKY_FULLSCREEN_CHIP_CLASS,
  DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS,
  DECKY_FULLSCREEN_CHIP_SELECTED_CLASS,
  DECKY_FOOTER_SCROLL_MARGIN_BOTTOM_PX,
  DECKY_HEADER_SCROLL_MARGIN_TOP_PX,
} from "./decky-focus-styles";
import { getSteamActionStylesCss } from "./steam-theme";
import { achievementCompanionQamTheme as qamTheme } from "./decky-qam-theme";

export function getDeckyFullscreenActionStylesCss(): string {
  return `
.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 8px 8px;
  min-width: 0;
  width: 100%;
}

.${DECKY_FULLSCREEN_ACTION_ROW_CENTERED_CLASS} {
  justify-content: center;
}

.${DECKY_FULLSCREEN_CHIP_CLASS} {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: 0 0 auto !important;
  width: max-content !important;
  min-width: max-content !important;
  max-width: none !important;
  scroll-margin-top: ${DECKY_HEADER_SCROLL_MARGIN_TOP_PX}px;
  scroll-margin-bottom: ${DECKY_FOOTER_SCROLL_MARGIN_BOTTOM_PX}px;
  min-height: 40px !important;
  padding: 0 14px !important;
  border: 1px solid rgba(255, 255, 255, 0.16) !important;
  border-radius: 999px !important;
  background: ${qamTheme.surface.contentStat} !important;
  color: rgba(255, 255, 255, 0.94) !important;
  box-sizing: border-box !important;
  font-size: 13px !important;
  font-weight: 700 !important;
  line-height: 1.15 !important;
  letter-spacing: 0.01em !important;
  user-select: none !important;
  white-space: nowrap !important;
  overflow: visible !important;
  text-overflow: clip !important;
  outline: none !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 2px 10px rgba(0, 0, 0, 0.22) !important;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    box-shadow 120ms ease,
    color 120ms ease;
}

.${DECKY_FULLSCREEN_CHIP_CLASS}.${DECKY_FULLSCREEN_CHIP_SELECTED_CLASS} {
  border-color: ${qamTheme.focus.border} !important;
  background: ${qamTheme.surface.selectedContentStat} !important;
  color: rgba(255, 255, 255, 0.99) !important;
  box-shadow: ${qamTheme.focus.insetShadow} !important;
}

.${DECKY_FULLSCREEN_CHIP_CLASS}.achievement-companion-fullscreen-chip-full-width {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  border-radius: 10px !important;
}

.${DECKY_FULLSCREEN_CHIP_CLASS}.achievement-companion-fullscreen-chip-overview-action {
  justify-content: flex-start !important;
  padding: 0 16px !important;
  font-size: 14px !important;
}

/* The Steam section footer shares the native footer's narrow CSS-pixel height. */
.${DECKY_FULLSCREEN_CHIP_CLASS}.achievement-companion-fullscreen-chip-compact {
  min-height: 32px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
}

.${DECKY_FULLSCREEN_CHIP_CLASS}.achievement-companion-fullscreen-chip-primary {
  border-color: ${qamTheme.color.borderStrong} !important;
  background: ${qamTheme.surface.primaryAction} !important;
  box-shadow:
    0 0 0 1px rgba(74, 189, 255, 0.52),
    0 0 16px rgba(42, 145, 230, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
}

.${DECKY_FULLSCREEN_CHIP_CLASS}.${DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS},
.${DECKY_FULLSCREEN_CHIP_CLASS}.gpfocus,
.${DECKY_FULLSCREEN_CHIP_CLASS}.gpfocuswithin,
.${DECKY_FULLSCREEN_CHIP_CLASS}:focus,
.${DECKY_FULLSCREEN_CHIP_CLASS}:focus-visible,
.${DECKY_FULLSCREEN_CHIP_CLASS}:focus-within {
  border-color: ${qamTheme.focus.border} !important;
  background: ${qamTheme.surface.focusedContentStat} !important;
  color: #fff !important;
  outline: none !important;
  box-shadow: ${qamTheme.focus.shadow} !important;
}

.${DECKY_FULLSCREEN_CHIP_CLASS}.${DECKY_FULLSCREEN_CHIP_SELECTED_CLASS}:is(.${DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS},.gpfocus,.gpfocuswithin,:focus,:focus-visible,:focus-within) {
  background: ${qamTheme.surface.focusedSelectedContentStat} !important;
}

/* The primary action keeps its theme color; focus is not a white Steam overlay. */
.${DECKY_FULLSCREEN_CHIP_CLASS}.achievement-companion-fullscreen-chip-primary.${DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS},
.${DECKY_FULLSCREEN_CHIP_CLASS}.achievement-companion-fullscreen-chip-primary.gpfocus,
.${DECKY_FULLSCREEN_CHIP_CLASS}.achievement-companion-fullscreen-chip-primary.gpfocuswithin,
.${DECKY_FULLSCREEN_CHIP_CLASS}.achievement-companion-fullscreen-chip-primary:focus,
.${DECKY_FULLSCREEN_CHIP_CLASS}.achievement-companion-fullscreen-chip-primary:focus-visible,
.${DECKY_FULLSCREEN_CHIP_CLASS}.achievement-companion-fullscreen-chip-primary:focus-within {
  border-color: ${qamTheme.focus.primaryBorder} !important;
  background: ${qamTheme.focus.primaryBackground} !important;
  box-shadow: ${qamTheme.focus.primaryShadow} !important;
}

.${DECKY_FULLSCREEN_CHIP_CLASS} > span {
  display: inline-flex !important;
  width: max-content !important;
  min-width: max-content !important;
  white-space: nowrap !important;
  overflow: visible !important;
  text-overflow: clip !important;
}

.${DECKY_FULLSCREEN_CHIP_CLASS}.achievement-companion-fullscreen-chip-overview-action > span {
  justify-content: flex-start !important;
}

.${DECKY_FULLSCREEN_CHIP_CLASS}::before,
.${DECKY_FULLSCREEN_CHIP_CLASS}::after {
  content: none !important;
  background: transparent !important;
  box-shadow: none !important;
}
` + getSteamActionStylesCss();
}
