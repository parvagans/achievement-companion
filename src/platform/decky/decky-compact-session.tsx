import { useQuickAccessVisible } from "@decky/api";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import {
  createDeckyCompactSessionLifecycle,
  endDeckyCompactSession,
} from "./decky-compact-session-lifecycle";
import { setDeckyCompactCancelBridgesEnabled } from "./decky-full-screen-cancel-bridge";

/**
 * Decky 3.2.9 keeps alwaysRender content mounted while QAM is hidden, but removes
 * it when closeActivePlugin returns to the plugin list. Keep only this shell
 * alive: hidden loaders/focus trees must still unmount and release their work.
 */
export function DeckyCompactSession({ children }: { readonly children: ReactNode }): JSX.Element {
  const isVisible = useQuickAccessVisible();
  const lifecycleRef = useRef<ReturnType<typeof createDeckyCompactSessionLifecycle>>();

  useLayoutEffect(() => {
    const lifecycle = createDeckyCompactSessionLifecycle({
      setCancelEnabled: setDeckyCompactCancelBridgesEnabled,
      endSession: endDeckyCompactSession,
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

  return <>{isVisible ? children : null}</>;
}
