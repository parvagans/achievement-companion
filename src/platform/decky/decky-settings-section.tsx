import { GamepadButton, type GamepadEvent } from "@decky/ui";
import type { CSSProperties, ReactNode } from "react";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";
import { steamRecipes, steamTheme } from "./steam-theme";

/** The same bounded card and scroll inset for both provider settings pages. */
export function DeckySettingsSection({ children }: { readonly children: ReactNode }): JSX.Element {
  return <div data-settings-section-content style={{ ...steamRecipes.card("fullscreen"), display: "flex", flex: "1 1 auto", flexDirection: "column", minHeight: 0, width: "100%", boxSizing: "border-box", overflow: "hidden", padding: "12px 16px" }}>{children}</div>;
}

export const settingsScrollStyle: CSSProperties = {
  width: "100%", minHeight: 0, overflowY: "auto", scrollPadding: "12px 0 24px", padding: "0 4px 18px 0", boxSizing: "border-box",
};

/** Compact account action; the scroll inset above keeps its focus ring in view. */
export const settingsSaveButtonStyle: CSSProperties = {
  alignSelf: "flex-end",
  minHeight: 30,
  boxSizing: "border-box",
  padding: "3px 9px",
  borderRadius: steamTheme.radius.pill,
  border: "1px solid rgba(56,177,241,.55)",
  background: "rgba(11,80,121,.6)",
  color: steamTheme.color.textPrimary,
  fontSize: steamTheme.type.fullscreen.metadata,
  fontWeight: steamTheme.type.weight.strong,
  lineHeight: 1.1,
  scrollMarginBottom: 20,
};

// Native Decky credential inputs expose tabIndex through their DOM property,
// but do not always render a tabindex attribute.
const CONTROL_SELECTOR = "[data-settings-section-content] [tabindex], [data-settings-section-content] input, [data-settings-section-content] button";

export function handleDeckySettingsDirection(page: HTMLElement | null, event: GamepadEvent): void {
  const button = event.detail.button;
  if (page === null || (button !== GamepadButton.DIR_LEFT && button !== GamepadButton.DIR_RIGHT && button !== GamepadButton.DIR_DOWN && button !== GamepadButton.DIR_UP)) return;
  const active = page.querySelector<HTMLElement>(".gpfocus") ?? page.ownerDocument.activeElement;
  const HTMLElementConstructor = page.ownerDocument.defaultView?.HTMLElement;
  if (HTMLElementConstructor === undefined || !(active instanceof HTMLElementConstructor)) return;
  const pills = [...page.querySelectorAll<HTMLElement>("[data-settings-section-pill]")];
  const content = page.querySelector<HTMLElement>("[data-settings-section-content]");
  const controls = [...page.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)].filter((control) => {
    if (control.tabIndex !== 0 || control.getClientRects().length === 0 || control.getAttribute("aria-disabled") === "true") return false;
    for (let parent = control.parentElement; parent !== null && parent !== content; parent = parent.parentElement) {
      if (parent.matches(CONTROL_SELECTOR) && parent.tabIndex === 0) return false;
    }
    return true;
  });
  const focus = (target: HTMLElement | undefined): void => {
    if (target === undefined) return;
    if (!takeDeckySteamGamepadFocus(target)) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    target.scrollIntoView({ block: "nearest" });
    playDeckySteamNavigationSound(page.ownerDocument);
  };
  const pillIndex = pills.indexOf(active);
  if (pillIndex >= 0) {
    if (button === GamepadButton.DIR_DOWN) focus(controls[0]);
    else if (button === GamepadButton.DIR_LEFT) focus(pills[pillIndex - 1]);
    else if (button === GamepadButton.DIR_RIGHT) focus(pills[pillIndex + 1]);
    return;
  }
  if (button !== GamepadButton.DIR_UP && button !== GamepadButton.DIR_DOWN) return;
  const controlIndex = controls.findIndex((control) => control === active || control.contains(active));
  if (controlIndex < 0) return;
  if (button === GamepadButton.DIR_UP) focus(controlIndex === 0 ? pills.find((pill) => pill.getAttribute("aria-pressed") === "true") : controls[controlIndex - 1]);
  else focus(controls[controlIndex + 1]);
}
