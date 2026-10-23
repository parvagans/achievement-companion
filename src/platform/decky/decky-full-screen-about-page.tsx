import { Focusable, GamepadButton, type GamepadEvent } from "@decky/ui";
import { useLayoutEffect, useRef, useState } from "react";
import { DeckyFocusStyles } from "./decky-focus-styles";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";
import { DeckyUpdateSettingsPanel } from "./decky-update-settings-panel";
import { DeckySharedAppearanceSettings } from "./decky-shared-appearance-settings";
import { scrollDeckySettingsFocusControl } from "./decky-settings-section";
import { steamRecipes, steamTheme } from "./steam-theme";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import externalLinkIconUrl from "./assets/external-link.svg";
import infoIconUrl from "./assets/info.svg";

const RELEASES_URL = "https://github.com/parvagans/achievement-companion/releases";
const REPOSITORY_URL = "https://github.com/parvagans/achievement-companion";
const ISSUES_URL = "https://github.com/parvagans/achievement-companion/issues";
let generalExternalLinkReturnTarget: string | undefined;

const GENERAL_CONTROL_SELECTOR = "[data-settings-general-sections] .ac-settings-action[tabindex='0'], [data-achievement-companion-update-settings] .ac-steam-settings-input input";

function getGeneralSettingsControls(page: HTMLElement): HTMLElement[] {
  return [...page.querySelectorAll<HTMLElement>(GENERAL_CONTROL_SELECTOR)]
    .filter((control) => control.getClientRects().length > 0 && control.getAttribute("aria-disabled") !== "true" && !control.hasAttribute("disabled"));
}

function scrollGeneralSettingsControl(page: HTMLElement, target: HTMLElement): void {
  const viewport = page.querySelector<HTMLElement>("[data-settings-general-sections]");
  if (viewport === null) return;
  scrollDeckySettingsFocusControl(viewport, target, getGeneralSettingsControls(page)[0] === target);
}

function AboutLink({ title, icon, url, onOpenExternalUrl, onGamepadDirection }: {
  readonly title: string;
  readonly icon: string;
  readonly url: string;
  readonly onOpenExternalUrl: (url: string) => void;
  readonly onGamepadDirection: (event: GamepadEvent) => void;
}): JSX.Element {
  const openLink = (): void => {
    generalExternalLinkReturnTarget = title;
    onOpenExternalUrl(url);
  };
  return <Focusable
    className="ac-settings-action"
    data-ac-general-external-link={title}
    noFocusRing
    role="button"
    tabIndex={0}
    aria-label={title}
    onActivate={openLink}
    onClick={openLink}
    onGamepadDirection={onGamepadDirection}
    style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "8px 12px", boxSizing: "border-box", border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.small, background: steamTheme.surface.contentStat, color: steamTheme.color.textPrimary, fontSize: steamTheme.type.fullscreen.body, fontWeight: steamTheme.type.weight.strong, scrollMargin: "12px 0 24px" }}
  >
    <img alt="" aria-hidden="true" src={icon} style={{ width: 17, height: 17, flexShrink: 0, filter: steamTheme.iconFilter.accent }} />
    <span style={{ flex: "1 1 auto" }}>{title}</span>
    <img alt="" aria-hidden="true" src={chevronRightIconUrl} style={{ width: 15, height: 15, flexShrink: 0, filter: steamTheme.iconFilter.accent }} />
  </Focusable>;
}

export function DeckyFullScreenAboutPage({ onOpenExternalUrl }: {
  readonly onOpenExternalUrl: (url: string) => void;
}): JSX.Element {
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number>();
  useLayoutEffect(() => {
    const page = pageRef.current;
    const ownerWindow = page?.ownerDocument.defaultView;
    if (page === null || ownerWindow === null || ownerWindow === undefined) return;
    setPageHeight(ownerWindow.innerHeight);
    let frame: number | undefined;
    let attempts = 0;
    const attemptRestore = (): void => {
      frame = ownerWindow.requestAnimationFrame(() => {
        frame = undefined;
        if (generalExternalLinkReturnTarget === undefined) return;
        const returnTarget = [...page.querySelectorAll<HTMLElement>("[data-ac-general-external-link]")]
          .find((link) => link.getAttribute("data-ac-general-external-link") === generalExternalLinkReturnTarget);
        if (returnTarget !== undefined && takeDeckySteamGamepadFocus(returnTarget)) {
          scrollGeneralSettingsControl(page, returnTarget);
          generalExternalLinkReturnTarget = undefined;
          return;
        }
        attempts += 1;
        if (attempts < 3) attemptRestore();
      });
    };
    const restore = (): void => {
      if (generalExternalLinkReturnTarget === undefined || page.getClientRects().length === 0 || !ownerWindow.location.pathname.includes("achievement-companion/full-screen")) return;
      if (frame !== undefined) ownerWindow.cancelAnimationFrame(frame);
      attempts = 0;
      attemptRestore();
    };

    restore();
    if (generalExternalLinkReturnTarget === undefined) {
      frame = ownerWindow.requestAnimationFrame(() => {
        frame = undefined;
        if (!page.contains(page.ownerDocument.activeElement)) {
          takeDeckySteamGamepadFocus(page.querySelector<HTMLElement>("[data-settings-general-sections] .ac-settings-action[tabindex='0']"));
        }
      });
    }
    ownerWindow.addEventListener("popstate", restore);
    ownerWindow.addEventListener("focus", restore);
    page.ownerDocument.addEventListener("visibilitychange", restore);
    return () => {
      if (frame !== undefined) ownerWindow.cancelAnimationFrame(frame);
      ownerWindow.removeEventListener("popstate", restore);
      ownerWindow.removeEventListener("focus", restore);
      page.ownerDocument.removeEventListener("visibilitychange", restore);
    };
  }, []);
  const handleCardDirection = (event: GamepadEvent): void => {
    const button = event.detail.button;
    if (button !== GamepadButton.DIR_UP && button !== GamepadButton.DIR_DOWN) return;
    const page = pageRef.current;
    if (page === null) return;
    const ownerWindow = page.ownerDocument.defaultView;
    const HTMLElementConstructor = ownerWindow?.HTMLElement;
    const active = page.querySelector<HTMLElement>(".gpfocus")
      ?? (HTMLElementConstructor !== undefined && event.currentTarget instanceof HTMLElementConstructor ? event.currentTarget : null);
    if (active === null) return;
    const controls = getGeneralSettingsControls(page);
    const index = controls.findIndex((control) => control === active || control.contains(active));
    const target = index < 0 ? undefined : controls[index + (button === GamepadButton.DIR_DOWN ? 1 : -1)];
    if (target === undefined || !takeDeckySteamGamepadFocus(target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    scrollGeneralSettingsControl(page, target);
    playDeckySteamNavigationSound(page.ownerDocument);
  };
  return <div ref={pageRef} className="ac-provider-about-page" data-ac-steam-theme="fullscreen" style={{ position: "relative", height: pageHeight ?? "100vh", flexShrink: 0, minHeight: 0, overflow: "hidden", padding: "calc(env(safe-area-inset-top, 0px) + 43px) 12px 50px", boxSizing: "border-box", color: steamTheme.color.textPrimary, background: steamTheme.surface.page, fontFamily: steamTheme.type.fontFamily }}>
    <DeckyFocusStyles />
    <style>{`.ac-provider-about-page :is([data-ac-general-appearance-card],[data-ac-provider-about-card],[data-achievement-companion-update-settings]) .ac-settings-action{outline:none!important}.ac-provider-about-page :is([data-ac-general-appearance-card],[data-ac-provider-about-card],[data-achievement-companion-update-settings]) .ac-settings-action:not(.gpfocus):not(.gpfocuswithin):not(:focus):not(:focus-within){box-shadow:none!important}.ac-provider-about-page :is([data-ac-general-appearance-card],[data-ac-provider-about-card],[data-achievement-companion-update-settings]) .ac-settings-action:is(.gpfocus,.gpfocuswithin,:focus,:focus-within){border-color:${steamTheme.focus.border}!important;box-shadow:${steamTheme.focus.shadow}!important;background:${steamTheme.surface.focusedContentStat}!important}`}</style>
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", minHeight: 31, color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.metadata, fontWeight: steamTheme.type.weight.strong, letterSpacing: ".1em" }}>GENERAL SETTINGS</div>
      <div data-settings-general-sections="true" onFocusCapture={(event) => {
        const target = getGeneralSettingsControls(pageRef.current ?? event.currentTarget)
          .find((control) => control === event.target || control.contains(event.target));
        if (target !== undefined) scrollGeneralSettingsControl(pageRef.current ?? event.currentTarget, target);
      }} style={{ display: "flex", flex: "1 1 auto", minHeight: 0, flexDirection: "column", gap: 12, overflowY: "auto", overflowX: "hidden", scrollPadding: "8px 0 20px", padding: "8px 10px 16px", boxSizing: "border-box" }}>
        <div data-ac-general-appearance-card="true" style={{ ...steamRecipes.card("fullscreen"), padding: 14, display: "flex", flex: "0 0 auto", flexDirection: "column", gap: 8, minWidth: 0 }}>
          <div style={{ color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.metadata, fontWeight: steamTheme.type.weight.strong, letterSpacing: ".1em" }}>APPEARANCE · SHARED</div>
          <DeckySharedAppearanceSettings onGamepadDirection={handleCardDirection} />
        </div>
        <DeckyUpdateSettingsPanel onGamepadDirection={handleCardDirection} />
        <div data-ac-provider-about-card="true" style={{ ...steamRecipes.card("fullscreen"), padding: 14, display: "flex", flex: "0 0 auto", flexDirection: "column", gap: 8, minWidth: 0 }}>
          <div style={{ color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.metadata, fontWeight: steamTheme.type.weight.strong, letterSpacing: ".1em" }}>HELP &amp; LINKS</div>
          <AboutLink title="Changelog" icon={externalLinkIconUrl} url={RELEASES_URL} onOpenExternalUrl={onOpenExternalUrl} onGamepadDirection={handleCardDirection} />
          <AboutLink title="GitHub" icon={externalLinkIconUrl} url={REPOSITORY_URL} onOpenExternalUrl={onOpenExternalUrl} onGamepadDirection={handleCardDirection} />
          <AboutLink title="Report Issue" icon={infoIconUrl} url={ISSUES_URL} onOpenExternalUrl={onOpenExternalUrl} onGamepadDirection={handleCardDirection} />
        </div>
      </div>
    </div>
  </div>;
}
