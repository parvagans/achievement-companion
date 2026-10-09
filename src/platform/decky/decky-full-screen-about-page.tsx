import { Focusable, GamepadButton, type GamepadEvent } from "@decky/ui";
import { useLayoutEffect, useRef, useState } from "react";
import { DeckyFocusStyles } from "./decky-focus-styles";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";
import { DeckyUpdateSettingsPanel } from "./decky-update-settings-panel";
import { steamRecipes, steamTheme } from "./steam-theme";
import brandCompactLogoUrl from "./assets/brand/AC_decky_compact_logo.png";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import externalLinkIconUrl from "./assets/external-link.svg";
import infoIconUrl from "./assets/info.svg";

const RELEASES_URL = "https://github.com/parvagans/achievement-companion/releases";
const REPOSITORY_URL = "https://github.com/parvagans/achievement-companion";
const ISSUES_URL = "https://github.com/parvagans/achievement-companion/issues";

function AboutLink({ title, icon, url, onOpenExternalUrl, onGamepadDirection }: {
  readonly title: string;
  readonly icon: string;
  readonly url: string;
  readonly onOpenExternalUrl: (url: string) => void;
  readonly onGamepadDirection: (event: GamepadEvent) => void;
}): JSX.Element {
  return <Focusable
    className="ac-settings-action"
    noFocusRing
    role="button"
    tabIndex={0}
    aria-label={title}
    onActivate={() => onOpenExternalUrl(url)}
    onClick={() => onOpenExternalUrl(url)}
    onGamepadDirection={onGamepadDirection}
    style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "8px 12px", boxSizing: "border-box", border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.small, background: steamTheme.surface.interactive, color: steamTheme.color.textPrimary, fontSize: steamTheme.type.fullscreen.body, fontWeight: steamTheme.type.weight.strong }}
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
    const frame = ownerWindow.requestAnimationFrame(() => {
      takeDeckySteamGamepadFocus(page.querySelector<HTMLElement>(".ac-settings-action[role='button']"));
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, []);
  const handleCardDirection = (event: GamepadEvent): void => {
    const button = event.detail.button;
    if (button !== GamepadButton.DIR_LEFT && button !== GamepadButton.DIR_RIGHT
      && button !== GamepadButton.DIR_UP && button !== GamepadButton.DIR_DOWN) return;
    const page = pageRef.current;
    if (page === null) return;
    const ownerWindow = page.ownerDocument.defaultView;
    const HTMLElementConstructor = ownerWindow?.HTMLElement;
    const active = page.querySelector<HTMLElement>(".gpfocus")
      ?? (HTMLElementConstructor !== undefined && event.currentTarget instanceof HTMLElementConstructor ? event.currentTarget : null);
    if (active === null) return;
    const aboutCard = active.closest<HTMLElement>("[data-ac-provider-about-card]");
    const updateCard = active.closest<HTMLElement>("[data-achievement-companion-update-settings]");
    const focusAndConsume = (target: HTMLElement): boolean => {
      if (!takeDeckySteamGamepadFocus(target)) return false;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      target.scrollIntoView({ block: "nearest" });
      playDeckySteamNavigationSound(page.ownerDocument);
      return true;
    };
    if (updateCard !== null && (button === GamepadButton.DIR_UP || button === GamepadButton.DIR_DOWN)) {
      const controls = [...updateCard.querySelectorAll<HTMLElement>(".ac-settings-action[tabindex='0']")]
        .filter((control) => control.getClientRects().length > 0 && control.getAttribute("aria-disabled") !== "true");
      const index = controls.indexOf(active);
      if (index >= 0) {
        const target = controls[index + (button === GamepadButton.DIR_DOWN ? 1 : -1)];
        if (target !== undefined) focusAndConsume(target);
        else {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
        return;
      }
    }
    const targetCard = button === GamepadButton.DIR_RIGHT && aboutCard !== null
      ? page.querySelector<HTMLElement>("[data-achievement-companion-update-settings]")
      : button === GamepadButton.DIR_LEFT && updateCard !== null
        ? page.querySelector<HTMLElement>("[data-ac-provider-about-card]")
        : null;
    if (targetCard === null) return;
    const activeCenter = active.getBoundingClientRect().top + active.getBoundingClientRect().height / 2;
    const targets = [...targetCard.querySelectorAll<HTMLElement>(".ac-settings-action[tabindex='0']")]
      .filter((target) => target.getClientRects().length > 0 && target.getAttribute("aria-disabled") !== "true");
    const target = targets.reduce<HTMLElement | undefined>((nearest, candidate) => {
      if (nearest === undefined) return candidate;
      const nearestCenter = nearest.getBoundingClientRect().top + nearest.getBoundingClientRect().height / 2;
      const candidateCenter = candidate.getBoundingClientRect().top + candidate.getBoundingClientRect().height / 2;
      return Math.abs(candidateCenter - activeCenter) < Math.abs(nearestCenter - activeCenter) ? candidate : nearest;
    }, undefined);
    if (target !== undefined) focusAndConsume(target);
  };
  return <div ref={pageRef} className="ac-provider-about-page" data-ac-steam-theme="fullscreen" style={{ position: "relative", height: pageHeight ?? "100vh", flexShrink: 0, minHeight: 0, overflow: "hidden", padding: "calc(env(safe-area-inset-top, 0px) + 43px) 12px 50px", boxSizing: "border-box", color: steamTheme.color.textPrimary, background: steamTheme.surface.page }}>
    <DeckyFocusStyles />
    <style>{`.ac-provider-about-page .ac-settings-action{outline:none!important}.ac-provider-about-page .ac-settings-action:not(.gpfocus):not(.gpfocuswithin):not(:focus):not(:focus-within){box-shadow:none!important}.ac-provider-about-page .ac-settings-action:is(.gpfocus,.gpfocuswithin,:focus,:focus-within){border-color:${steamTheme.focus.border}!important;box-shadow:${steamTheme.focus.shadow}!important;background:${steamTheme.focus.background}!important}`}</style>
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", minHeight: 31, color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.metadata, fontWeight: steamTheme.type.weight.strong, letterSpacing: ".1em" }}>ACHIEVEMENT COMPANION ABOUT</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12, flex: "1 1 auto", minHeight: 0 }}>
        <div data-ac-provider-about-card="true" style={{ ...steamRecipes.card("fullscreen"), padding: 16, display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
          <div style={{ color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.metadata, fontWeight: steamTheme.type.weight.strong, letterSpacing: ".1em" }}>ABOUT</div>
          <div style={{ display: "flex", alignItems: "center", padding: "4px 4px 8px" }}><img alt="" src={brandCompactLogoUrl} style={{ width: 160, height: 64, objectFit: "contain" }} /></div>
          <AboutLink title="Changelog" icon={externalLinkIconUrl} url={RELEASES_URL} onOpenExternalUrl={onOpenExternalUrl} onGamepadDirection={handleCardDirection} />
          <AboutLink title="GitHub" icon={externalLinkIconUrl} url={REPOSITORY_URL} onOpenExternalUrl={onOpenExternalUrl} onGamepadDirection={handleCardDirection} />
          <AboutLink title="Report Issue" icon={infoIconUrl} url={ISSUES_URL} onOpenExternalUrl={onOpenExternalUrl} onGamepadDirection={handleCardDirection} />
        </div>
        <DeckyUpdateSettingsPanel onGamepadDirection={handleCardDirection} />
      </div>
    </div>
  </div>;
}
