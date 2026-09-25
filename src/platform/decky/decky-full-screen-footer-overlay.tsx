import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { GamepadEvent } from "@decky/ui";
import { consumeDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";
import { markDeckyFullscreenReturnRequested } from "./decky-full-screen-return-context";
import {
  measureSteamGameFooterLayout,
  STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX,
} from "./decky-steam-game-footer-layout";

const COMPACT_FOOTER_REDUCTION_PX = 4;
const COMPACT_FOOTER_MINIMUM_HEIGHT_PX = 40;
const STEAM_TAB_TRANSITION_SOUND_URL = "/sounds/deck_ui_tab_transition_01.wav";
const mountedFooterOverlayOwners: symbol[] = [];

function isTopFooterOverlayOwner(owner: symbol): boolean {
  return mountedFooterOverlayOwners[mountedFooterOverlayOwners.length - 1] === owner;
}

function releaseFooterOverlayOwner(owner: symbol): void {
  const index = mountedFooterOverlayOwners.indexOf(owner);
  if (index >= 0) mountedFooterOverlayOwners.splice(index, 1);
}

export const DECKY_FULLSCREEN_FOOTER_SHOULDER_BUTTON = {
  left: 5,
  right: 6,
} as const;

export interface DeckyFullScreenFooterNavigationItem {
  readonly id: string;
  readonly label: string;
}

export const STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS = [
  { id: "profile", label: "Profile" },
  { id: "games", label: "Games" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
] as const satisfies readonly DeckyFullScreenFooterNavigationItem[];

interface DeckyFullScreenFooterNavigationActions {
  readonly onPrevious?: () => void;
  readonly onNext?: () => void;
}

type CancelableGamepadEvent = Event & {
  readonly preventDefault?: () => void;
  readonly stopPropagation?: () => void;
  readonly stopImmediatePropagation?: () => void;
};

type CancelableGamepadButtonEvent = Pick<
  GamepadEvent,
  "detail" | "preventDefault" | "stopImmediatePropagation" | "stopPropagation"
>;

/**
 * Owns a GamepadUI shoulder press for a mounted full-screen footer. Consuming
 * a handled event prevents the same press reaching Steam's global chrome.
 */
export function handleDeckyFullScreenFooterShoulderButtonDown(
  event: CancelableGamepadButtonEvent,
  actions: DeckyFullScreenFooterNavigationActions,
): boolean {
  const navigate = event.detail.button === DECKY_FULLSCREEN_FOOTER_SHOULDER_BUTTON.left
    ? actions.onPrevious
    : event.detail.button === DECKY_FULLSCREEN_FOOTER_SHOULDER_BUTTON.right
      ? actions.onNext
      : undefined;

  if (navigate === undefined) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  if (event.detail.is_repeat !== true) {
    navigate();
  }
  return true;
}

function getFooterStyle(height: number, zIndex: number): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    height,
    padding: "3px 12px",
    minWidth: 0,
    boxSizing: "border-box",
    borderTop: "1px solid rgba(125, 190, 255, 0.24)",
    background: "linear-gradient(180deg, #09151f, #050e16)",
    fontSize: 14,
    boxShadow: "0 -10px 28px rgba(0, 0, 0, 0.3)",
    position: "fixed",
    right: 0,
    bottom: 0,
    left: 0,
    zIndex,
    // Footer navigation is controller-only; its labels are not mouse controls.
    pointerEvents: "none",
  };
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (target === null || typeof target !== "object" || !("tagName" in target)) {
    return false;
  }
  const element = target as { readonly tagName?: unknown; readonly isContentEditable?: unknown };
  return element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.isContentEditable === true;
}

function getSectionTabsStyle(): CSSProperties {
  return {
    display: "flex",
    flex: "1 1 auto",
    gap: 6,
    justifyContent: "center",
    minWidth: 0,
  };
}

function getSectionTabStyle(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "1 1 0",
    width: "auto",
    minWidth: 0,
    minHeight: 28,
    padding: "2px 8px",
    boxSizing: "border-box",
    border: `1px solid ${active ? "rgba(105, 176, 255, 0.72)" : "rgba(255, 255, 255, 0.12)"}`,
    borderRadius: 999,
    background: active
      ? "linear-gradient(180deg, rgba(74, 138, 204, 0.34), rgba(34, 79, 124, 0.3))"
      : "rgba(255, 255, 255, 0.035)",
    boxShadow: active ? "0 0 0 1px rgba(73, 155, 255, 0.32)" : "none",
    color: active ? "rgba(255, 255, 255, 0.98)" : "rgba(255, 255, 255, 0.68)",
    fontSize: 12,
    fontWeight: active ? 800 : 700,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
  };
}

function getShoulderHintStyle(): CSSProperties {
  return {
    flex: "0 0 auto",
    padding: "3px 5px",
    border: "1px solid rgba(255, 255, 255, 0.26)",
    borderRadius: 6,
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: "0.76em",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
}

function getActionLegendStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: "0 0 auto",
    minWidth: 0,
  };
}

function getActionHintStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    color: "rgba(255, 255, 255, 0.86)",
    fontSize: "0.76em",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
}

function getActionButtonHintStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.9)",
    color: "rgba(8, 18, 27, 1)",
    fontSize: "0.8em",
    fontWeight: 900,
  };
}

function DeckyFullScreenFooterActionHint({ button, label }: {
  readonly button: string;
  readonly label: string;
}): JSX.Element {
  return (
    <span style={getActionHintStyle()}>
      <span style={getActionButtonHintStyle()}>{button}</span>
      <span>{label}</span>
    </span>
  );
}

export function DeckyFullScreenFooterOverlay({
  ariaLabel,
  activeNavigationItemId,
  navigationItems,
  onPreviousNavigationItem,
  onNextNavigationItem,
  onBack,
  onHeightChange,
  isActive = true,
}: {
  readonly ariaLabel: string;
  readonly activeNavigationItemId: string;
  readonly navigationItems: readonly DeckyFullScreenFooterNavigationItem[];
  readonly onPreviousNavigationItem: () => void;
  readonly onNextNavigationItem: () => void;
  readonly onBack: () => void;
  readonly onHeightChange?: (height: number) => void;
  /** A retained full-screen tab must not own the footer or controller input. */
  readonly isActive?: boolean;
}): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const onBackRef = useRef(onBack);
  const onPreviousNavigationItemRef = useRef(onPreviousNavigationItem);
  const onNextNavigationItemRef = useRef(onNextNavigationItem);
  const tabTransitionSoundRef = useRef<HTMLAudioElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [isTextEntryFocused, setIsTextEntryFocused] = useState(false);
  const [layout, setLayout] = useState({ height: STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX, zIndex: 20 });

  useLayoutEffect(() => {
    onBackRef.current = onBack;
    onPreviousNavigationItemRef.current = onPreviousNavigationItem;
    onNextNavigationItemRef.current = onNextNavigationItem;
  }, [onBack, onNextNavigationItem, onPreviousNavigationItem]);

  useLayoutEffect(() => {
    // Use the visible Gaming Mode document, not SharedJSContext, just as the
    // Steam game-page section footer does.
    if (!isActive || !ariaLabel.startsWith("Steam ")) {
      return;
    }
    const ownerDocument = anchorRef.current?.ownerDocument;
    if (ownerDocument === undefined) {
      return;
    }
    const sound = ownerDocument.createElement("audio");
    sound.preload = "auto";
    sound.src = STEAM_TAB_TRANSITION_SOUND_URL;
    tabTransitionSoundRef.current = sound;
    return () => {
      sound.pause();
      sound.removeAttribute("src");
      sound.load();
      tabTransitionSoundRef.current = null;
    };
  }, [ariaLabel, isActive]);

  useLayoutEffect(() => {
    if (!isActive) {
      return;
    }
    // SharedJSContext is not the visible Gaming Mode document. The anchor is.
    const ownerDocument = anchorRef.current?.ownerDocument;
    const ownerWindow = ownerDocument?.defaultView;
    if (ownerDocument === undefined || ownerWindow === undefined || ownerWindow === null) {
      return;
    }

    const target = ownerDocument.createElement("div");
    target.dataset["achievementCompanionFullscreenFooterOverlay"] = "true";
    const updateLayout = (): void => {
      const measured = measureSteamGameFooterLayout(ownerDocument, target);
      const compactHeight = Math.max(
        COMPACT_FOOTER_MINIMUM_HEIGHT_PX,
        measured.height - COMPACT_FOOTER_REDUCTION_PX,
      );
      setLayout({ ...measured, height: compactHeight });
      onHeightChange?.(compactHeight);
    };

    updateLayout();
    ownerDocument.body.appendChild(target);
    setPortalTarget(target);
    ownerWindow.addEventListener("resize", updateLayout);

    const updateTextEntryFocus = (): void => {
      setIsTextEntryFocused(isTextEntryTarget(ownerDocument.activeElement));
    };
    ownerDocument.addEventListener("focusin", updateTextEntryFocus, true);
    ownerDocument.addEventListener("focusout", updateTextEntryFocus, true);

    return () => {
      ownerWindow.removeEventListener("resize", updateLayout);
      ownerDocument.removeEventListener("focusin", updateTextEntryFocus, true);
      ownerDocument.removeEventListener("focusout", updateTextEntryFocus, true);
      target.remove();
    };
  }, [isActive, onHeightChange]);

  useLayoutEffect(() => {
    if (!isActive) {
      return;
    }
    const ownerWindow = anchorRef.current?.ownerDocument.defaultView;
    if (ownerWindow === undefined || ownerWindow === null) {
      return;
    }
    const owner = Symbol("decky-full-screen-footer-overlay");
    mountedFooterOverlayOwners.push(owner);

    const onButtonDown = (event: Event): void => {
      if (!isTopFooterOverlayOwner(owner)) return;
      handleDeckyFullScreenFooterShoulderButtonDown(event as GamepadEvent, {
        onPrevious: () => {
          onPreviousNavigationItemRef.current();
          playSteamTabTransitionSound(tabTransitionSoundRef.current);
        },
        onNext: () => {
          onNextNavigationItemRef.current();
          playSteamTabTransitionSound(tabTransitionSoundRef.current);
        },
      });
    };
    ownerWindow.addEventListener("vgp_onbuttondown", onButtonDown, true);

    // The overlay replaces Steam's Back legend for the mounted full-screen route.
    const onCancel = (event: Event): void => {
      if (!isTopFooterOverlayOwner(owner)) return;
      const cancelEvent = event as CancelableGamepadEvent;
      if (consumeDeckyFullscreenPopupCancel()) {
        cancelEvent.preventDefault?.();
        cancelEvent.stopPropagation?.();
        cancelEvent.stopImmediatePropagation?.();
        return;
      }
      cancelEvent.preventDefault?.();
      cancelEvent.stopPropagation?.();
      cancelEvent.stopImmediatePropagation?.();
      markDeckyFullscreenReturnRequested();
      onBackRef.current();
    };
    ownerWindow.addEventListener("vgp_oncancel", onCancel, true);
    return () => {
      ownerWindow.removeEventListener("vgp_onbuttondown", onButtonDown, true);
      ownerWindow.removeEventListener("vgp_oncancel", onCancel, true);
      releaseFooterOverlayOwner(owner);
    };
  }, [isActive]);

  return (
    <>
      <span ref={anchorRef} hidden aria-hidden="true" />
      {isActive && portalTarget !== null && !isTextEntryFocused ? createPortal(
        <div aria-label={ariaLabel} style={getFooterStyle(layout.height, layout.zIndex)}>
          <span style={getShoulderHintStyle()}>L1</span>
          <div style={getSectionTabsStyle()}>
            {navigationItems.map((item) => (
              <span key={item.id} style={getSectionTabStyle(activeNavigationItemId === item.id)}>
                {item.label}
              </span>
            ))}
          </div>
          <span style={getShoulderHintStyle()}>R1</span>
          <span style={getActionLegendStyle()}>
            <DeckyFullScreenFooterActionHint button="A" label="Select" />
            <DeckyFullScreenFooterActionHint button="B" label="Back" />
          </span>
        </div>,
        portalTarget,
      ) : null}
    </>
  );
}

function playSteamTabTransitionSound(sound: HTMLAudioElement | null): void {
  if (sound === null) {
    return;
  }
  sound.currentTime = 0;
  void sound.play().catch(() => undefined);
}
