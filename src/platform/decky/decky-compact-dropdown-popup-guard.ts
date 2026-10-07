import { useCallback, useEffect, useRef } from "react";
import { useQuickAccessVisible } from "@decky/ui";
import { beginDeckyCompactPopup } from "./decky-compact-popup-state";

/** Keeps the compact plugin session alive while Decky's native dropdown owns QAM. */
export function useDeckyCompactDropdownPopupGuard(): (showMenu: () => void) => void {
  const isQuickAccessVisible = useQuickAccessVisible();
  const releasePopupRef = useRef<(() => void) | undefined>(undefined);
  const popupWasHiddenRef = useRef(false);

  useEffect(() => {
    if (releasePopupRef.current === undefined) return;
    if (!isQuickAccessVisible) {
      popupWasHiddenRef.current = true;
      return;
    }
    if (popupWasHiddenRef.current) {
      releasePopupRef.current();
      releasePopupRef.current = undefined;
      popupWasHiddenRef.current = false;
    }
  }, [isQuickAccessVisible]);

  useEffect(() => () => {
    releasePopupRef.current?.();
    releasePopupRef.current = undefined;
  }, []);

  return useCallback((showMenu: () => void) => {
    releasePopupRef.current?.();
    popupWasHiddenRef.current = false;
    releasePopupRef.current = beginDeckyCompactPopup();
    showMenu();
  }, []);
}
