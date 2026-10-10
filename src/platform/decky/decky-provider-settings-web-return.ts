import { useLayoutEffect, type RefObject } from "react";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";

type AccountProvider = "retroachievements" | "steam";
let pendingAccountReturn: AccountProvider | undefined;

export function markDeckyProviderSettingsWebReturn(provider: AccountProvider): void {
  pendingAccountReturn = provider;
}

export function isDeckyProviderSettingsWebReturnPending(provider: AccountProvider): boolean {
  return pendingAccountReturn === provider;
}

/** Restore the API-key control after Steam's external browser returns to settings. */
export function useDeckyProviderSettingsWebReturnFocus(
  rootRef: RefObject<HTMLElement | null>,
  provider: AccountProvider,
): void {
  useLayoutEffect(() => {
    const root = rootRef.current;
    const ownerWindow = root?.ownerDocument.defaultView;
    if (root === null || ownerWindow === null || ownerWindow === undefined) return;

    let frame: number | undefined;
    let attempts = 0;
    const attemptFocus = (): void => {
      frame = ownerWindow.requestAnimationFrame(() => {
        frame = undefined;
        if (pendingAccountReturn !== provider) return;
        const input = root.querySelectorAll<HTMLInputElement>("[data-settings-section-content] input")[1];
        if (input !== undefined && takeDeckySteamGamepadFocus(input)) {
          pendingAccountReturn = undefined;
          return;
        }
        attempts += 1;
        if (attempts < 3) attemptFocus();
      });
    };
    const restore = (): void => {
      if (pendingAccountReturn !== provider || root.getClientRects().length === 0 || !ownerWindow.location.pathname.includes("achievement-companion/full-screen")) return;
      if (frame !== undefined) ownerWindow.cancelAnimationFrame(frame);
      attempts = 0;
      attemptFocus();
    };

    restore();
    ownerWindow.addEventListener("popstate", restore);
    ownerWindow.addEventListener("focus", restore);
    root.ownerDocument.addEventListener("visibilitychange", restore);
    return () => {
      if (frame !== undefined) ownerWindow.cancelAnimationFrame(frame);
      ownerWindow.removeEventListener("popstate", restore);
      ownerWindow.removeEventListener("focus", restore);
      root.ownerDocument.removeEventListener("visibilitychange", restore);
    };
  }, [provider, rootRef]);
}
