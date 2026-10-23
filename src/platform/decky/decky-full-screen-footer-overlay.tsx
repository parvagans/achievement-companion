import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { GamepadEvent } from "@decky/ui";
import { consumeDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";
import { handleDeckyFullscreenSubviewButtonDown } from "./decky-full-screen-subview-navigation";
import { achievementCompanionQamTheme as qamTheme } from "./decky-qam-theme";
import {
  measureSteamGameFooterLayout,
  STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX,
} from "./decky-steam-game-footer-layout";

const COMPACT_FOOTER_REDUCTION_PX = 4;
const COMPACT_FOOTER_MINIMUM_HEIGHT_PX = 40;
const STEAM_TAB_TRANSITION_SOUND_URL = "/sounds/deck_ui_tab_transition_01.wav";
const DECKY_FULLSCREEN_FOOTER_TOP_BUTTON = 4;
const mountedFooterOverlayOwners: symbol[] = [];
const DECKY_FULLSCREEN_ONSCREEN_KEYBOARD_OPEN_ATTRIBUTE = "data-achievement-companion-onscreen-keyboard-open";
const STEAM_FULL_SCREEN_VIDEO_OVERLAY_SELECTOR = ".FullModalOverlay video";
const yieldedDeckyFullscreenKeyboardCancelEvents = new WeakSet<Event>();
const deckyFullscreenKeyboardStateListeners = new WeakMap<Document, Set<() => void>>();

function notifyDeckyFullscreenKeyboardStateChanged(document: Document): void {
  for (const listener of deckyFullscreenKeyboardStateListeners.get(document) ?? []) {
    listener();
  }
}

/**
 * Steam delivers vgp_oncancel to the full-screen footer during text entry.
 * Remember that an AC credential field opened the on-screen keyboard so that
 * the next B press is yielded to Steam instead of closing the full-screen session.
 */
export function markDeckyFullscreenOnScreenKeyboardOpen(document: Document): void {
  document.documentElement.setAttribute(DECKY_FULLSCREEN_ONSCREEN_KEYBOARD_OPEN_ATTRIBUTE, "true");
  notifyDeckyFullscreenKeyboardStateChanged(document);
}

export function clearDeckyFullscreenOnScreenKeyboardOpen(document: Document): void {
  document.documentElement.removeAttribute(DECKY_FULLSCREEN_ONSCREEN_KEYBOARD_OPEN_ATTRIBUTE);
  notifyDeckyFullscreenKeyboardStateChanged(document);
}

export function isDeckyFullscreenOnScreenKeyboardOpen(document: Document): boolean {
  return document.documentElement.getAttribute(DECKY_FULLSCREEN_ONSCREEN_KEYBOARD_OPEN_ATTRIBUTE) === "true";
}

/**
 * Steam owns dismissal of its on-screen keyboard.  Pages only mark the one
 * activation that opened text editing, then clear that mark when Steam reports
 * dismissal.  This lets the shared B owner yield exactly one cancel without
 * turning it into route navigation.
 */
export function useDeckyFullscreenOnScreenKeyboardLifecycle(
  rootRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const document = rootRef.current?.ownerDocument;
    const keyboardDismissSubscription = globalThis.SteamClient?.Input?.RegisterForUserDismissKeyboardMessages?.(() => {
      if (document !== undefined) {
        clearDeckyFullscreenOnScreenKeyboardOpen(document);
      }
    });

    return () => {
      keyboardDismissSubscription?.unregister();
      if (document !== undefined) {
        clearDeckyFullscreenOnScreenKeyboardOpen(document);
      }
    };
  }, [rootRef]);
}

function consumeDeckyFullscreenOnScreenKeyboardCancel(document: Document): boolean {
  if (!isDeckyFullscreenOnScreenKeyboardOpen(document)) {
    return false;
  }
  clearDeckyFullscreenOnScreenKeyboardOpen(document);
  return true;
}

/**
 * Gives AC-owned transient UI priority over a terminal route return. Keyboard
 * cancel deliberately remains unconsumed so Steam can dismiss the keyboard.
 */
export function consumeDeckyFullscreenTransientCancel(
  event: Event,
  document: Document,
): boolean {
  if (yieldedDeckyFullscreenKeyboardCancelEvents.has(event)) {
    return true;
  }

  if (consumeDeckyFullscreenOnScreenKeyboardCancel(document)) {
    // The terminal root bridge and the shared footer can both receive the
    // capture event. Mark this one B as yielded so the second listener cannot
    // turn a keyboard dismissal into a route exit.
    yieldedDeckyFullscreenKeyboardCancelEvents.add(event);
    return true;
  }

  if (!consumeDeckyFullscreenPopupCancel()) {
    return false;
  }

  const cancelEvent = event as CancelableGamepadEvent;
  cancelEvent.preventDefault?.();
  cancelEvent.stopPropagation?.();
  cancelEvent.stopImmediatePropagation?.();
  return true;
}

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

export const RETROACHIEVEMENTS_PROFILE_FOOTER_NAVIGATION_ITEMS = [
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
    borderTop: `1px solid ${qamTheme.color.borderSubtle}`,
    background: qamTheme.decorative.footerBackground,
    fontFamily: qamTheme.type.fontFamily,
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
    border: `1px solid ${active ? qamTheme.focus.border : "rgba(255, 255, 255, 0.12)"}`,
    borderRadius: 999,
    background: active
      ? qamTheme.focus.background
      : "rgba(255, 255, 255, 0.035)",
    boxShadow: active ? qamTheme.focus.insetShadow : "none",
    color: active ? "rgba(255, 255, 255, 0.98)" : "rgba(255, 255, 255, 0.68)",
    fontSize: 12,
    fontWeight: active ? 800 : 700,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
  };
}

function getControllerHintStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    boxSizing: "border-box",
    border: `1px solid ${qamTheme.color.borderStrong}`,
    background: qamTheme.surface.contentStat,
    color: qamTheme.color.textPrimary,
    fontWeight: qamTheme.type.weight.strong,
    lineHeight: 1,
  };
}

function getShoulderHintStyle(): CSSProperties {
  return {
    ...getControllerHintStyle(),
    width: 24,
    height: 24,
    borderRadius: 6,
    fontSize: qamTheme.type.fullscreen.caption,
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

function getActionHintStyle(hidden: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: 24,
    gap: 5,
    color: qamTheme.color.textSecondary,
    fontSize: qamTheme.type.fullscreen.caption,
    fontWeight: qamTheme.type.weight.strong,
    lineHeight: 1,
    whiteSpace: "nowrap",
    visibility: hidden ? "hidden" : "visible",
  };
}

function getActionButtonHintStyle(): CSSProperties {
  return {
    ...getControllerHintStyle(),
    width: 18,
    height: 18,
    borderRadius: "50%",
    fontSize: 10,
  };
}

function DeckyFullScreenFooterActionHint({ button, label, hidden = false }: {
  readonly button: string;
  readonly label: string;
  readonly hidden?: boolean;
}): JSX.Element {
  return (
    <span aria-hidden={hidden || undefined} style={getActionHintStyle(hidden)}>
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
  onHeightChange,
  secondaryActionLabel,
  onSecondaryAction,
  playNavigationSound = true,
  isActive = true,
}: {
  readonly ariaLabel: string;
  readonly activeNavigationItemId: string;
  readonly navigationItems: readonly DeckyFullScreenFooterNavigationItem[];
  readonly onPreviousNavigationItem: () => void;
  readonly onNextNavigationItem: () => void;
  readonly onHeightChange?: (height: number) => void;
  readonly secondaryActionLabel?: string;
  readonly onSecondaryAction?: (document: Document) => void;
  /** Provider-neutral opt-in for the native tab transition cue. */
  readonly playNavigationSound?: boolean;
  /** A retained full-screen tab must not own the footer or controller input. */
  readonly isActive?: boolean;
}): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const onPreviousNavigationItemRef = useRef(onPreviousNavigationItem);
  const onNextNavigationItemRef = useRef(onNextNavigationItem);
  const onHeightChangeRef = useRef(onHeightChange);
  const onSecondaryActionRef = useRef(onSecondaryAction);
  const tabTransitionSoundRef = useRef<HTMLAudioElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [isOnScreenKeyboardOpen, setIsOnScreenKeyboardOpen] = useState(false);
  const [isSteamFullScreenVideoOverlayVisible, setIsSteamFullScreenVideoOverlayVisible] = useState(false);
  const [layout, setLayout] = useState({ height: STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX, zIndex: 20 });

  useLayoutEffect(() => {
    onPreviousNavigationItemRef.current = onPreviousNavigationItem;
    onNextNavigationItemRef.current = onNextNavigationItem;
    onHeightChangeRef.current = onHeightChange;
    onSecondaryActionRef.current = onSecondaryAction;
  }, [onHeightChange, onNextNavigationItem, onPreviousNavigationItem, onSecondaryAction]);

  useLayoutEffect(() => {
    // Use the visible Gaming Mode document, not SharedJSContext, just as the
    // Steam game-page section footer does.
    if (!isActive || !playNavigationSound) {
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
  }, [isActive, playNavigationSound]);

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
      setLayout((current) => current.height === compactHeight && current.zIndex === measured.zIndex
        ? current : { ...measured, height: compactHeight });
      onHeightChangeRef.current?.(compactHeight);
    };

    updateLayout();
    ownerDocument.body.appendChild(target);
    setPortalTarget(target);
    ownerWindow.addEventListener("resize", updateLayout);

    // Steam can replace its native footer while an external browser page is
    // active. Measure again after returning, once the native route has painted.
    const pendingFrames = new Set<number>();
    const cancelPendingFrames = (): void => {
      for (const frame of pendingFrames) ownerWindow.cancelAnimationFrame(frame);
      pendingFrames.clear();
    };
    const scheduleLayoutAfterReturn = (): void => {
      cancelPendingFrames();
      if (ownerDocument.visibilityState !== "visible") {
        return;
      }
      const first = ownerWindow.requestAnimationFrame(() => {
        pendingFrames.delete(first);
        const second = ownerWindow.requestAnimationFrame(() => {
          pendingFrames.delete(second);
          updateLayout();
        });
        pendingFrames.add(second);
      });
      pendingFrames.add(first);
    };

    // Steam owns suspend/resume with a full-screen video modal. Because this
    // portal is mounted directly under body, it otherwise renders above that
    // modal. Hide synchronously when the native overlay appears and release
    // controller ownership until Steam removes it.
    const updateSteamFullScreenVideoOverlayState = (): void => {
      const overlayVisible = [...ownerDocument.querySelectorAll<HTMLElement>(STEAM_FULL_SCREEN_VIDEO_OVERLAY_SELECTOR)]
        .some((element) => {
          const rect = element.getBoundingClientRect();
          const style = ownerWindow.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        });
      const targetIsHidden = target.dataset["achievementCompanionSteamVideoOverlayHidden"] === "true";
      if (overlayVisible && !targetIsHidden) {
        target.style.setProperty("display", "none", "important");
        target.dataset["achievementCompanionSteamVideoOverlayHidden"] = "true";
      } else if (!overlayVisible && targetIsHidden) {
        target.style.removeProperty("display");
        delete target.dataset["achievementCompanionSteamVideoOverlayHidden"];
        updateLayout();
      }
      setIsSteamFullScreenVideoOverlayVisible((current) => current === overlayVisible ? current : overlayVisible);
    };
    const steamOverlayObserver = new ownerWindow.MutationObserver(updateSteamFullScreenVideoOverlayState);
    steamOverlayObserver.observe(ownerDocument.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    updateSteamFullScreenVideoOverlayState();
    ownerWindow.addEventListener("popstate", scheduleLayoutAfterReturn);
    ownerWindow.addEventListener("focus", scheduleLayoutAfterReturn);
    ownerWindow.addEventListener("pageshow", scheduleLayoutAfterReturn);
    ownerDocument.addEventListener("visibilitychange", scheduleLayoutAfterReturn);
    scheduleLayoutAfterReturn();

    return () => {
      ownerWindow.removeEventListener("resize", updateLayout);
      ownerWindow.removeEventListener("popstate", scheduleLayoutAfterReturn);
      ownerWindow.removeEventListener("focus", scheduleLayoutAfterReturn);
      ownerWindow.removeEventListener("pageshow", scheduleLayoutAfterReturn);
      ownerDocument.removeEventListener("visibilitychange", scheduleLayoutAfterReturn);
      steamOverlayObserver.disconnect();
      cancelPendingFrames();
      target.remove();
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      setIsOnScreenKeyboardOpen(false);
      return;
    }
    const ownerDocument = anchorRef.current?.ownerDocument;
    if (ownerDocument === undefined) {
      return;
    }
    const updateKeyboardState = (): void => {
      setIsOnScreenKeyboardOpen(isDeckyFullscreenOnScreenKeyboardOpen(ownerDocument));
    };
    const listeners = deckyFullscreenKeyboardStateListeners.get(ownerDocument) ?? new Set<() => void>();
    listeners.add(updateKeyboardState);
    deckyFullscreenKeyboardStateListeners.set(ownerDocument, listeners);
    updateKeyboardState();
    return () => {
      listeners.delete(updateKeyboardState);
      if (listeners.size === 0) {
        deckyFullscreenKeyboardStateListeners.delete(ownerDocument);
      }
    };
  }, [isActive]);

  useLayoutEffect(() => {
    if (!isActive || isSteamFullScreenVideoOverlayVisible) {
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
      if (isDeckyFullscreenOnScreenKeyboardOpen(ownerWindow.document)) return;
      const gamepadEvent = event as GamepadEvent;
      if (handleDeckyFullscreenSubviewButtonDown(gamepadEvent, ownerWindow.document)) return;
      if (gamepadEvent.detail.button === DECKY_FULLSCREEN_FOOTER_TOP_BUTTON && onSecondaryActionRef.current !== undefined) {
        gamepadEvent.preventDefault();
        gamepadEvent.stopPropagation();
        gamepadEvent.stopImmediatePropagation();
        if (gamepadEvent.detail.is_repeat !== true) onSecondaryActionRef.current(ownerWindow.document);
        return;
      }
      handleDeckyFullScreenFooterShoulderButtonDown(gamepadEvent, {
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
      if (consumeDeckyFullscreenTransientCancel(event, ownerWindow.document)) {
        // Keyboard cancel is deliberately left for Steam; popup cancel is
        // consumed by the shared helper above.
        return;
      }
      // Ordinary B remains unconsumed so Steam/Decky can unwind its native
      // route stack. Only AC-owned transient UI consumes cancel above.
    };
    ownerWindow.addEventListener("vgp_oncancel", onCancel, true);
    return () => {
      ownerWindow.removeEventListener("vgp_onbuttondown", onButtonDown, true);
      ownerWindow.removeEventListener("vgp_oncancel", onCancel, true);
      releaseFooterOverlayOwner(owner);
    };
  }, [isActive, isSteamFullScreenVideoOverlayVisible]);

  return (
    <>
      <span ref={anchorRef} hidden aria-hidden="true" />
      {isActive && !isSteamFullScreenVideoOverlayVisible && !isOnScreenKeyboardOpen && portalTarget !== null ? createPortal(
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
            <DeckyFullScreenFooterActionHint button="Y" label={secondaryActionLabel ?? "Top"} hidden={secondaryActionLabel === undefined} />
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
