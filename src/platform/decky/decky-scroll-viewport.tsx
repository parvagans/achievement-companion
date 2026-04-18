import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

const DECKY_SCROLL_RESET_EVENT = "achievement-companion:decky-scroll-reset";
interface DeckyScrollResetEventDetail {
  readonly scrollKey: string;
}

function getAnchorStyle(): CSSProperties {
  return {
    display: "contents",
  };
}

function isScrollableElement(element: HTMLElement): boolean {
  const style = globalThis.getComputedStyle(element);

  if (
    style.overflowY !== "auto" &&
    style.overflowY !== "scroll" &&
    style.overflowY !== "overlay"
  ) {
    return false;
  }

  return element.scrollHeight > element.clientHeight + 1;
}

function findScrollableAncestor(anchor: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = anchor.parentElement;

  while (current !== null) {
    if (isScrollableElement(current)) {
      return current;
    }

    current = current.parentElement;
  }

  const scrollingElement = document.scrollingElement;
  if (scrollingElement instanceof HTMLElement) {
    return scrollingElement;
  }

  return document.documentElement;
}

function resetScrollPosition(target: HTMLElement): void {
  target.scrollTop = 0;
  target.scrollLeft = 0;

  const resetFrame = globalThis.requestAnimationFrame(() => {
    if (!target.isConnected) {
      return;
    }

    target.scrollTop = 0;
    target.scrollLeft = 0;
  });

  void resetFrame;
}

function resetRealDeckyScrollContainer(anchor: HTMLElement): void {
  const target = findScrollableAncestor(anchor);
  if (target === null) {
    return;
  }

  resetScrollPosition(target);
}


export function dispatchDeckyScrollReset(scrollKey: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<DeckyScrollResetEventDetail>(DECKY_SCROLL_RESET_EVENT, {
      detail: {
        scrollKey,
      },
    }),
  );
}

export interface TopAlignedScrollViewportProps {
  readonly children: ReactNode;
  readonly resetNonce?: number;
  readonly scrollKey: string;
}

export function TopAlignedScrollViewport({
  children,
  resetNonce = 0,
  scrollKey,
}: TopAlignedScrollViewportProps): JSX.Element {
  const anchorRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (anchor === null) {
      return;
    }

    resetRealDeckyScrollContainer(anchor);
  }, [resetNonce, scrollKey]);

  useLayoutEffect(() => {
    const handleScrollReset = (event: Event): void => {
      const scrollResetEvent = event as CustomEvent<DeckyScrollResetEventDetail>;
      if (scrollResetEvent.detail?.scrollKey !== scrollKey) {
        return;
      }

      const anchor = anchorRef.current;
      if (anchor === null) {
        return;
      }

      resetRealDeckyScrollContainer(anchor);
    };

    window.addEventListener(DECKY_SCROLL_RESET_EVENT, handleScrollReset);

    return () => {
      window.removeEventListener(DECKY_SCROLL_RESET_EVENT, handleScrollReset);
    };
  }, [scrollKey]);

  return (
    <div ref={anchorRef} style={getAnchorStyle()}>
      {children}
    </div>
  );
}
