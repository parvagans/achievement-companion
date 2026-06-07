import {
  DECKY_FULLSCREEN_ACTION_ROW_CLASS,
  DECKY_FULLSCREEN_ACTION_ROW_CENTERED_CLASS,
  DECKY_FULLSCREEN_CHIP_CLASS,
  DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS,
  DECKY_FULLSCREEN_CHIP_SELECTED_CLASS,
} from "./decky-focus-styles";

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

.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} > .${DECKY_FULLSCREEN_CHIP_CLASS} {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: 0 0 auto !important;
  width: max-content !important;
  min-width: max-content !important;
  max-width: none !important;
  min-height: 40px !important;
  padding: 0 14px !important;
  border: 1px solid rgba(255, 255, 255, 0.16) !important;
  border-radius: 999px !important;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.045)) !important;
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
  border-color: rgba(255, 255, 255, 0.24) !important;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.09)) !important;
  color: rgba(255, 255, 255, 0.99) !important;
}

.${DECKY_FULLSCREEN_CHIP_CLASS}.${DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS},
.${DECKY_FULLSCREEN_CHIP_CLASS}.gpfocus,
.${DECKY_FULLSCREEN_CHIP_CLASS}.gpfocuswithin,
.${DECKY_FULLSCREEN_CHIP_CLASS}:focus,
.${DECKY_FULLSCREEN_CHIP_CLASS}:focus-visible,
.${DECKY_FULLSCREEN_CHIP_CLASS}:focus-within {
  border-color: rgba(105, 176, 255, 0.8) !important;
  background: linear-gradient(180deg, rgba(74, 138, 204, 0.34), rgba(34, 79, 124, 0.3)) !important;
  color: #fff !important;
  outline: none !important;
  box-shadow:
    0 0 0 2px rgba(73, 155, 255, 0.72),
    0 0 18px rgba(39, 124, 226, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.14) !important;
}

.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} > .${DECKY_FULLSCREEN_CHIP_CLASS} > span {
  display: inline-flex !important;
  width: max-content !important;
  min-width: max-content !important;
  white-space: nowrap !important;
  overflow: visible !important;
  text-overflow: clip !important;
}

.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} > .${DECKY_FULLSCREEN_CHIP_CLASS}::before,
.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} > .${DECKY_FULLSCREEN_CHIP_CLASS}::after {
  content: none !important;
  background: transparent !important;
  box-shadow: none !important;
}
`;
}
