import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import {
  DECKY_FOOTER_SCROLL_MARGIN_BOTTOM_PX,
  DECKY_HEADER_SCROLL_MARGIN_TOP_PX,
} from "./decky-focus-styles";

const DECKY_SCROLL_RESET_EVENT = "achievement-companion:decky-scroll-reset";
interface DeckyScrollResetEventDetail {
  readonly scrollKey: string;
}

function getAnchorStyle(fillHeight: boolean): CSSProperties {
  if (fillHeight) {
    return {
      display: "flex",
      flex: "1 1 auto",
      flexDirection: "column",
      minHeight: 0,
    };
  }

  return {
    display: "contents",
  };
}

function supportsVerticalScrolling(element: HTMLElement): boolean {
  const ownerWindow = element.ownerDocument.defaultView;
  if (ownerWindow === null || ownerWindow === undefined) {
    return false;
  }

  const style = ownerWindow.getComputedStyle(element);

  return style.overflowY === "auto" || style.overflowY === "scroll" || style.overflowY === "overlay";
}

function isScrollableElement(element: HTMLElement): boolean {
  if (!supportsVerticalScrolling(element)) {
    return false;
  }

  return element.scrollHeight > element.clientHeight + 1;
}

/**
 * Finds the native vertical viewport even when short content does not yet
 * overflow. Loading layouts use this to fill the currently visible QAM lane.
 */
export function findDeckyScrollContainerAncestor(anchor: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = anchor.parentElement;

  while (current !== null) {
    if (supportsVerticalScrolling(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

export function findDeckyScrollableAncestor(anchor: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = anchor.parentElement;

  while (current !== null) {
    if (isScrollableElement(current)) {
      return current;
    }

    current = current.parentElement;
  }

  const scrollingElement = anchor.ownerDocument.scrollingElement;
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
  const target = findDeckyScrollableAncestor(anchor);
  if (target === null) {
    return;
  }

  resetScrollPosition(target);
}

function configureDeckyScrollInsets(anchor: HTMLElement): () => void {
  const target = findDeckyScrollableAncestor(anchor);
  if (target === null) {
    return () => undefined;
  }

  const previousScrollPaddingTop = target.style.scrollPaddingTop;
  const previousScrollPaddingBottom = target.style.scrollPaddingBottom;
  target.style.scrollPaddingTop = `${DECKY_HEADER_SCROLL_MARGIN_TOP_PX}px`;
  target.style.scrollPaddingBottom = `${DECKY_FOOTER_SCROLL_MARGIN_BOTTOM_PX}px`;

  return () => {
    target.style.scrollPaddingTop = previousScrollPaddingTop;
    target.style.scrollPaddingBottom = previousScrollPaddingBottom;
  };
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
  readonly fillHeight?: boolean;
  readonly onRestoreAfterLayoutComplete?: () => void;
  readonly restoreAfterLayout?: boolean;
  readonly restoreScrollTop?: number | undefined;
  readonly resetNonce?: number;
  readonly scrollKey: string;
}

export function TopAlignedScrollViewport({
  children,
  fillHeight = false,
  onRestoreAfterLayoutComplete,
  restoreAfterLayout = false,
  restoreScrollTop,
  resetNonce = 0,
  scrollKey,
}: TopAlignedScrollViewportProps): JSX.Element {
  const anchorRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    return anchor === null ? undefined : configureDeckyScrollInsets(anchor);
  }, [fillHeight]);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (anchor === null) {
      return;
    }

    if (restoreAfterLayout && restoreScrollTop !== undefined && restoreScrollTop > 0) {
      return;
    }

    resetRealDeckyScrollContainer(anchor);
  }, [resetNonce, restoreAfterLayout, restoreScrollTop, scrollKey]);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (anchor === null || restoreScrollTop === undefined || restoreScrollTop <= 0) {
      return;
    }

    const ownerWindow = anchor.ownerDocument.defaultView;
    if (ownerWindow === null || ownerWindow === undefined) {
      return;
    }

    if (!restoreAfterLayout) {
      const target = findDeckyScrollableAncestor(anchor);
      if (target === null) {
        return;
      }

      target.scrollTop = restoreScrollTop;
      const restoreFrame = ownerWindow.requestAnimationFrame(() => {
        if (target.isConnected) {
          target.scrollTop = restoreScrollTop;
        }
      });
      return () => ownerWindow.cancelAnimationFrame(restoreFrame);
    }

    const restoreFrame = ownerWindow.requestAnimationFrame(() => {
      const target = findDeckyScrollableAncestor(anchor);
      if (target?.isConnected) {
        target.scrollTop = restoreScrollTop;
        onRestoreAfterLayoutComplete?.();
      }
    });
    return () => ownerWindow.cancelAnimationFrame(restoreFrame);
  }, [onRestoreAfterLayoutComplete, restoreAfterLayout, restoreScrollTop, scrollKey]);

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
    <div ref={anchorRef} style={getAnchorStyle(fillHeight)}>
      {children}
    </div>
  );
}
