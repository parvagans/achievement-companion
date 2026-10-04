import { useQuickAccessVisible } from "@decky/api";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import {
  createDeckyCompactSessionLifecycle,
  endDeckyCompactSession,
} from "./decky-compact-session-lifecycle";
import { setDeckyCompactCancelBridgesEnabled } from "./decky-full-screen-cancel-bridge";
import { hasDeckyCompactOriginFullScreenSession } from "./decky-full-screen-session";
import { hasActiveDeckyCompactPopup } from "./decky-compact-popup-state";

/**
 * Keep only this lifecycle shell alive while QAM is hidden. Ordinary QAM closes
 * end the compact session; compact-to-full-screen handoffs and native modal
 * menus preserve the owning tree until control returns.
 */
export function DeckyCompactSession({ children }: { readonly children: ReactNode }): JSX.Element {
  const isVisible = useQuickAccessVisible();
  const lifecycleRef = useRef<ReturnType<typeof createDeckyCompactSessionLifecycle>>();

  useLayoutEffect(() => {
    const lifecycle = createDeckyCompactSessionLifecycle({
      setCancelEnabled: setDeckyCompactCancelBridgesEnabled,
      endSession: endDeckyCompactSession,
      shouldPreserveHiddenSession: () =>
        hasDeckyCompactOriginFullScreenSession() || hasActiveDeckyCompactPopup(),
    });
    lifecycleRef.current = lifecycle;
    return () => {
      lifecycle.end();
      lifecycleRef.current = undefined;
    };
  }, []);

  useLayoutEffect(() => {
    lifecycleRef.current?.setVisible(isVisible);
  }, [isVisible]);

  // Native modal menus temporarily report QAM as not visible. Keep their
  // owning tree mounted so Steam can return focus to the original trigger.
  return <>{isVisible || hasActiveDeckyCompactPopup() ? children : null}</>;
}
