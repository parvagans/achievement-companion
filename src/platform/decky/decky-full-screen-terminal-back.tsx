import { useLayoutEffect, useRef } from "react";
import { consumeDeckyFullscreenTransientCancel } from "./decky-full-screen-footer-overlay";

/**
 * Narrow compatibility boundary for the one compact-origin terminal route.
 * It is mounted only while that root route is visible and consumes exactly one
 * B event before Steam's normal route handler sees it. Nested full-screen
 * routes never mount this bridge and retain native Back behavior.
 */
export function DeckyFullScreenTerminalBackBridge({
  onBack,
}: {
  readonly onBack: () => void;
}): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const onBackRef = useRef(onBack);

  useLayoutEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useLayoutEffect(() => {
    const ownerWindow = anchorRef.current?.ownerDocument.defaultView;
    if (ownerWindow === undefined || ownerWindow === null) {
      return;
    }

    let handled = false;
    const onCancel = (event: Event): void => {
      if (handled || consumeDeckyFullscreenTransientCancel(event, ownerWindow.document)) {
        return;
      }

      const cancelEvent = event as Event & {
        readonly preventDefault?: () => void;
        readonly stopPropagation?: () => void;
        readonly stopImmediatePropagation?: () => void;
      };
      cancelEvent.preventDefault?.();
      cancelEvent.stopPropagation?.();
      cancelEvent.stopImmediatePropagation?.();
      const activeLoader = ownerWindow.document.querySelector(
        '[data-achievement-companion-full-screen-loading-state="true"][aria-busy="true"]',
      );
      if (activeLoader !== null) {
        return;
      }

      handled = true;
      onBackRef.current();
    };

    ownerWindow.addEventListener("vgp_oncancel", onCancel, true);
    return () => {
      ownerWindow.removeEventListener("vgp_oncancel", onCancel, true);
    };
  }, []);

  return <span ref={anchorRef} hidden aria-hidden="true" />;
}
