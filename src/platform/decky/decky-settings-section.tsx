import { GamepadButton, type GamepadEvent } from "@decky/ui";
import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";
import { steamRecipes, steamTheme } from "./steam-theme";
import { achievementCompanionQamTheme as qamTheme } from "./decky-qam-theme";

/** The same bounded card and scroll inset for both provider settings pages. */
export function DeckySettingsSection({ children }: { readonly children: ReactNode; readonly themeVariant?: "steam" | "ra" }): JSX.Element {
  return <div data-settings-section-content style={{ ...steamRecipes.card("fullscreen"), display: "flex", flex: "1 1 auto", flexDirection: "column", minHeight: 0, width: "100%", boxSizing: "border-box", overflow: "hidden", padding: "12px 16px" }}>{children}</div>;
}

export const settingsScrollStyle: CSSProperties = {
  width: "100%", minHeight: 0, overflowY: "auto", scrollPadding: "12px 0 24px", padding: "0 4px 18px 0", boxSizing: "border-box",
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

export function SettingsSectionTriggerHints({ side }: { readonly side: "left" | "right" }): JSX.Element {
  return <span aria-hidden="true" style={{ flex: "0 0 auto", color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.metadata, fontWeight: 700, whiteSpace: "nowrap" }}>{side === "left" ? "LT ◀" : "▶ RT"}</span>;
}

/** Keep trigger navigation scoped to the visible settings page and its focused controls. */
export function useDeckySettingsSectionTriggers<T extends string>(pageRef: RefObject<HTMLElement | null>, sections: readonly T[], selected: T, onSelect: (section: T) => void): void {
  const stateRef = useRef({ sections, selected, onSelect });
  stateRef.current = { sections, selected, onSelect };
  useEffect(() => {
    const page = pageRef.current;
    const document = page?.ownerDocument;
    if (page === null || document === undefined) return;
    const onButtonDown = (rawEvent: Event): void => {
      const event = rawEvent as GamepadEvent;
      const button = event.detail?.button;
      if (button !== GamepadButton.TRIGGER_LEFT && button !== GamepadButton.TRIGGER_RIGHT) return;
      if (page.getClientRects().length === 0 || page.querySelector(".gpfocus") === null) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      if (event.detail.is_repeat === true) return;
      const { sections, selected, onSelect } = stateRef.current;
      const index = sections.indexOf(selected);
      const next = sections[index + (button === GamepadButton.TRIGGER_LEFT ? -1 : 1)];
      if (next !== undefined) {
        const target = page.querySelectorAll<HTMLElement>("[data-settings-section-pill]")[sections.indexOf(next)];
        if (target !== undefined) takeDeckySteamGamepadFocus(target);
        onSelect(next);
        playDeckySteamNavigationSound(document);
      }
    };
    document.addEventListener("vgp_onbuttondown", onButtonDown, true);
    return () => document.removeEventListener("vgp_onbuttondown", onButtonDown, true);
  }, [pageRef]);
}

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
