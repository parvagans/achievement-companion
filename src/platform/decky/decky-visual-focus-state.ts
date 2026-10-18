import { useLayoutEffect, type Dispatch, type RefObject, type SetStateAction } from "react";

/** Decky can move .gpfocus without dispatching a browser blur event. Keep visual state in sync. */
export function useDeckyVisualFocusState(
  elementRef: RefObject<HTMLElement>,
  setFocused: Dispatch<SetStateAction<boolean>>,
): void {
  useLayoutEffect(() => {
    const element = elementRef.current;
    const Observer = element?.ownerDocument.defaultView?.MutationObserver;
    if (element === null || Observer === undefined) return;
    let hadGamepadFocus = element.classList.contains("gpfocus") || element.classList.contains("gpfocuswithin");
    if (hadGamepadFocus) setFocused(true);
    const observer = new Observer(() => {
      const focused = element.classList.contains("gpfocus") || element.classList.contains("gpfocuswithin");
      if (focused || hadGamepadFocus) setFocused((current) => current === focused ? current : focused);
      hadGamepadFocus = focused;
    });
    observer.observe(element, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [elementRef, setFocused]);
}
