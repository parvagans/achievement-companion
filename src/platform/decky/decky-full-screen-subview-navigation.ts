import type { GamepadEvent } from "@decky/ui";
import { isDeckyFullscreenPopupOpen } from "./decky-full-screen-popup-state";

interface SubviewNavigationActions {
  readonly onLeft: () => void;
  readonly onRight: () => void;
}

// GamepadUI TRIGGER_LEFT/TRIGGER_RIGHT, kept independent of the UI runtime.
const TRIGGER_LEFT = 7;
const TRIGGER_RIGHT = 8;
const activeSubviewNavigation = new WeakMap<Document, SubviewNavigationActions>();

export function registerDeckyFullscreenSubviewNavigation(
  document: Document,
  actions: SubviewNavigationActions,
): () => void {
  activeSubviewNavigation.set(document, actions);
  return () => {
    if (activeSubviewNavigation.get(document) === actions) {
      activeSubviewNavigation.delete(document);
    }
  };
}

/** Called by the existing fullscreen input owner, regardless of content focus. */
export function handleDeckyFullscreenSubviewButtonDown(
  event: Pick<GamepadEvent, "detail" | "preventDefault" | "stopPropagation" | "stopImmediatePropagation">,
  document: Document,
): boolean {
  if (isDeckyFullscreenPopupOpen()) return false;
  const actions = activeSubviewNavigation.get(document);
  const navigate = event.detail.button === TRIGGER_LEFT ? actions?.onLeft
    : event.detail.button === TRIGGER_RIGHT ? actions?.onRight : undefined;
  if (navigate === undefined) return false;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  if (event.detail.is_repeat !== true) navigate();
  return true;
}
