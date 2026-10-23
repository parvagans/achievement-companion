import { GamepadButton, type GamepadEvent } from "@decky/ui";
import { type CSSProperties, type FocusEvent, type ReactNode } from "react";
import { scrollDeckyFocusTargetIntoView, scrollDeckyFocusTargetToTop } from "./decky-focus-scroll";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";
import { steamRecipes, steamTheme } from "./steam-theme";
import { achievementCompanionQamTheme as qamTheme } from "./decky-qam-theme";

/** The same bounded card and scroll inset for both provider settings pages. */
export function DeckySettingsSection({ children }: { readonly children: ReactNode; readonly themeVariant?: "steam" | "ra" }): JSX.Element {
  return <div data-settings-section-content onFocusCapture={handleSettingsFocusCapture} style={{ ...steamRecipes.card("fullscreen"), display: "flex", flex: "1 1 auto", flexDirection: "column", minHeight: 0, width: "100%", boxSizing: "border-box", overflow: "hidden", padding: "12px 16px" }}>{children}</div>;
}

export const settingsScrollStyle: CSSProperties = {
  width: "100%", minHeight: 0, overflowY: "auto", scrollPadding: "10px 0 20px", padding: "10px 18px 18px", boxSizing: "border-box",
};

/** Compact account action; the scroll inset above keeps its focus ring in view. */
export const settingsSaveButtonStyle: CSSProperties = {
  alignSelf: "flex-end",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  minHeight: 38,
  boxSizing: "border-box",
  padding: "7px 14px",
  borderRadius: steamTheme.radius.pill,
  border: `1px solid ${qamTheme.decorative.settingsSaveBorder}`,
  background: qamTheme.decorative.settingsSaveBackground,
  color: steamTheme.color.textPrimary,
  fontSize: steamTheme.type.fullscreen.metadata,
  fontWeight: steamTheme.type.weight.strong,
  lineHeight: 1.1,
  scrollMarginBottom: 20,
};

export function getSettingsSaveButtonStyle(saved: boolean): CSSProperties {
  return saved
    ? {
        ...settingsSaveButtonStyle,
        borderColor: steamTheme.status.success.border,
        background: steamTheme.status.success.surface,
        color: steamTheme.status.success.text,
      }
    : settingsSaveButtonStyle;
}

// Native Decky credential inputs expose tabIndex through their DOM property,
// but do not always render a tabindex attribute.
const CONTROL_SELECTOR = "[data-settings-general-link='true'], [data-settings-section-content] [tabindex], [data-settings-section-content] input, [data-settings-section-content] button";

function getSettingsControls(page: HTMLElement, content: HTMLElement): HTMLElement[] {
  return [...page.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)].filter((control) => {
    if (control.tabIndex !== 0 || control.getClientRects().length === 0 || control.getAttribute("aria-disabled") === "true") return false;
    for (let parent = control.parentElement; parent !== null && parent !== content; parent = parent.parentElement) {
      if (parent.matches(CONTROL_SELECTOR) && parent.tabIndex === 0) return false;
    }
    return true;
  });
}

/** Keep Settings focus in its own scrollport instead of scrolling the page. */
export function scrollDeckySettingsFocusControl(viewport: HTMLElement, target: HTMLElement, restoreTop: boolean): void {
  const HTMLElementConstructor = viewport.ownerDocument.defaultView?.HTMLElement;
  if (HTMLElementConstructor === undefined) return;
  const activeFocus = (): boolean => {
    const isTarget = (active: Element | null): boolean =>
      active === target || (active instanceof HTMLElementConstructor && (target.contains(active) || active.contains(target)));
    return isTarget(viewport.querySelector<HTMLElement>(".gpfocus")) || isTarget(viewport.ownerDocument.activeElement);
  };
  if (restoreTop) scrollDeckyFocusTargetToTop(target, activeFocus, viewport);
  else scrollDeckyFocusTargetIntoView(target, viewport, activeFocus);
}

function scrollSettingsControlIntoView(content: HTMLElement, target: HTMLElement, controls: readonly HTMLElement[]): void {
  const viewport = content.firstElementChild;
  const HTMLElementConstructor = content.ownerDocument.defaultView?.HTMLElement;
  if (HTMLElementConstructor === undefined || !(viewport instanceof HTMLElementConstructor)) return;
  // The first credential field is the first account setting even when the
  // General shortcut precedes it. Returning to either top stop restores the
  // complete card heading and field label instead of leaving them clipped.
  const firstAccountInput = content.querySelector("input");
  scrollDeckySettingsFocusControl(viewport, target, target === controls[0] || target === firstAccountInput);
}

function handleSettingsFocusCapture(event: FocusEvent<HTMLDivElement>): void {
  const content = event.currentTarget;
  const controls = getSettingsControls(content, content);
  const target = controls.find((control) => control === event.target || control.contains(event.target));
  if (target !== undefined) scrollSettingsControlIntoView(content, target, controls);
}

export function handleDeckySettingsDirection(page: HTMLElement | null, event: GamepadEvent): void {
  const button = event.detail.button;
  if (page === null || (button !== GamepadButton.DIR_DOWN && button !== GamepadButton.DIR_UP)) return;
  const active = page.querySelector<HTMLElement>(".gpfocus") ?? page.ownerDocument.activeElement;
  const HTMLElementConstructor = page.ownerDocument.defaultView?.HTMLElement;
  if (HTMLElementConstructor === undefined || !(active instanceof HTMLElementConstructor)) return;
  const content = page.querySelector<HTMLElement>("[data-settings-section-content]");
  if (content === null) return;
  const controls = getSettingsControls(page, content);
  const focus = (target: HTMLElement | undefined): void => {
    if (target === undefined) return;
    if (!takeDeckySteamGamepadFocus(target)) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    scrollSettingsControlIntoView(content, target, controls);
    playDeckySteamNavigationSound(page.ownerDocument);
  };
  const controlIndex = controls.findIndex((control) => control === active || control.contains(active));
  if (controlIndex < 0) return;
  if (button === GamepadButton.DIR_UP) focus(controls[controlIndex - 1]);
  else focus(controls[controlIndex + 1]);
}
