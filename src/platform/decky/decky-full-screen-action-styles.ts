import {
  DECKY_FULLSCREEN_ACTION_ROW_CLASS,
  DECKY_FULLSCREEN_ACTION_ROW_CENTERED_CLASS,
  DECKY_FULLSCREEN_CHIP_CLASS,
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
  background: transparent;
  border: 0;
  box-shadow: none;
}

.${DECKY_FULLSCREEN_ACTION_ROW_CENTERED_CLASS} {
  justify-content: center;
}

.${DECKY_FULLSCREEN_CHIP_CLASS},
.${DECKY_FULLSCREEN_CHIP_CLASS}.DialogButton,
button.${DECKY_FULLSCREEN_CHIP_CLASS},
button.${DECKY_FULLSCREEN_CHIP_CLASS}.DialogButton {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: 0 0 auto !important;
  width: auto !important;
  min-width: 0 !important;
  max-width: 100% !important;
  min-height: 40px !important;
  padding: 0 14px !important;
  border-radius: 999px !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.055)) !important;
  color: rgba(255, 255, 255, 0.94) !important;
  cursor: pointer !important;
  font-size: 13px !important;
  font-weight: 700 !important;
  line-height: 1.15 !important;
  letter-spacing: 0.01em !important;
  user-select: none !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  box-sizing: border-box !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 2px 12px rgba(0, 0, 0, 0.24) !important;
  outline: none !important;
  transition:
    background-color 120ms ease,
    background 120ms ease,
    border-color 120ms ease,
    box-shadow 120ms ease,
    color 120ms ease,
    transform 120ms ease;
}

.Panel.Focusable.gpfocus:has(.${DECKY_FULLSCREEN_CHIP_CLASS}),
.Panel.Focusable.gpfocuswithin:has(.${DECKY_FULLSCREEN_CHIP_CLASS}),
.Focusable.gpfocus:has(.${DECKY_FULLSCREEN_CHIP_CLASS}),
.Focusable.gpfocuswithin:has(.${DECKY_FULLSCREEN_CHIP_CLASS}) {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
  filter: none !important;
  backdrop-filter: none !important;
  outline: none !important;
}

.Panel.Focusable.gpfocus:has(.${DECKY_FULLSCREEN_CHIP_CLASS})::before,
.Panel.Focusable.gpfocuswithin:has(.${DECKY_FULLSCREEN_CHIP_CLASS})::before,
.Focusable.gpfocus:has(.${DECKY_FULLSCREEN_CHIP_CLASS})::before,
.Focusable.gpfocuswithin:has(.${DECKY_FULLSCREEN_CHIP_CLASS})::before,
.Panel.Focusable.gpfocus:has(.${DECKY_FULLSCREEN_CHIP_CLASS})::after,
.Panel.Focusable.gpfocuswithin:has(.${DECKY_FULLSCREEN_CHIP_CLASS})::after,
.Focusable.gpfocus:has(.${DECKY_FULLSCREEN_CHIP_CLASS})::after,
.Focusable.gpfocuswithin:has(.${DECKY_FULLSCREEN_CHIP_CLASS})::after {
  content: none !important;
  background: none !important;
  background-image: none !important;
  box-shadow: none !important;
}

.${DECKY_FULLSCREEN_CHIP_CLASS} {
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    box-shadow 120ms ease,
    color 120ms ease,
    transform 120ms ease;
}

.${DECKY_FULLSCREEN_CHIP_CLASS}--selected {
  border-color: rgba(255, 255, 255, 0.22) !important;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.12)) !important;
  color: rgba(255, 255, 255, 0.98) !important;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
}

.${DECKY_FULLSCREEN_CHIP_CLASS}--focused,
.${DECKY_FULLSCREEN_CHIP_CLASS}:focus-visible,
.${DECKY_FULLSCREEN_CHIP_CLASS}:focus-within {
  outline: none !important;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.075)) !important;
  border-color: rgba(125, 190, 255, 0.62) !important;
  box-shadow:
    0 0 0 1px rgba(96, 165, 250, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
  0 2px 10px rgba(0, 0, 0, 0.24) !important;
  transform: none !important;
}

.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} > div::after,
.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} > .Panel::after,
.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} > div.Panel::after,
.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} > div[class*="Panel"]::after,
.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} > div[class]::after {
  content: "" !important;
  display: block !important;
  visibility: hidden !important;
  opacity: 0 !important;
  height: 0 !important;
  min-height: 0 !important;
  max-height: 0 !important;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  border: 0 !important;
  border-bottom: 0 !important;
  box-shadow: none !important;
  transform: scaleY(0) !important;
}

.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} > div:focus-within .${DECKY_FULLSCREEN_CHIP_CLASS},
.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} > .Panel:focus-within .${DECKY_FULLSCREEN_CHIP_CLASS},
.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} > div.Panel:focus-within .${DECKY_FULLSCREEN_CHIP_CLASS},
.${DECKY_FULLSCREEN_ACTION_ROW_CLASS} > div[class]:focus-within .${DECKY_FULLSCREEN_CHIP_CLASS},
.${DECKY_FULLSCREEN_CHIP_CLASS}:focus,
.${DECKY_FULLSCREEN_CHIP_CLASS}:focus-within {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.075)) !important;
  border-color: rgba(125, 190, 255, 0.62) !important;
  box-shadow:
    0 0 0 1px rgba(96, 165, 250, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 2px 10px rgba(0, 0, 0, 0.24) !important;
  transform: none !important;
}
`;
}
