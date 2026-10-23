import {
  DECKY_FOOTER_SCROLL_MARGIN_BOTTOM_PX,
  DECKY_HEADER_SCROLL_MARGIN_TOP_PX,
} from "./decky-focus-styles";
import { getCenteredViewportScrollTop } from "./decky-focus-scroll-model";

function isOwnerHTMLElement(target: EventTarget | null): target is HTMLElement {
  const element = target as HTMLElement | null;
  const ownerWindow = element?.ownerDocument?.defaultView;
  return ownerWindow !== undefined && ownerWindow !== null && target instanceof ownerWindow.HTMLElement;
}

function isScrollableElement(element: HTMLElement): boolean {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);

  return (
    (style?.overflowY === "auto" || style?.overflowY === "scroll" || style?.overflowY === "overlay") &&
    element.scrollHeight > element.clientHeight + 1
  );
}

function findScrollableAncestor(target: HTMLElement): HTMLElement | null {
  let ancestor = target.parentElement;

  while (ancestor !== null) {
    if (isScrollableElement(ancestor)) {
      return ancestor;
    }

    ancestor = ancestor.parentElement;
  }

  const scrollingElement = target.ownerDocument.scrollingElement;
  return isOwnerHTMLElement(scrollingElement) ? scrollingElement : null;
}

function keepTargetClearOfDeckyChrome(target: HTMLElement): void {
  const scrollableAncestor = findScrollableAncestor(target);
  if (scrollableAncestor === null || typeof scrollableAncestor.scrollBy !== "function") {
    return;
  }

  const viewport = scrollableAncestor.getBoundingClientRect();
  if (viewport.height <= 0) {
    return;
  }

  const targetBounds = target.getBoundingClientRect();
  const visibleTop = Math.max(0, viewport.top) + DECKY_HEADER_SCROLL_MARGIN_TOP_PX;
  const visibleBottom = Math.min(target.ownerDocument.defaultView?.innerHeight ?? viewport.bottom, viewport.bottom) - DECKY_FOOTER_SCROLL_MARGIN_BOTTOM_PX;

  if (visibleBottom <= visibleTop) {
    return;
  }

  const scrollOffset = targetBounds.top < visibleTop
    ? targetBounds.top - visibleTop
    : targetBounds.bottom > visibleBottom
      ? targetBounds.bottom - visibleBottom
      : 0;

  if (scrollOffset !== 0) {
    scrollableAncestor.scrollBy({ top: scrollOffset, behavior: "auto" });
  }
}

export function scrollDeckyFocusTargetIntoView(
  target: EventTarget | null,
  viewport?: HTMLElement | null,
  isStillFocused: () => boolean = () => true,
): void {
  if (!isOwnerHTMLElement(target)) {
    return;
  }

  // Fullscreen lists already reserve space for chrome. Center only their own
  // viewport, without scrolling ancestors or adding the QAM chrome margins.
  if (viewport !== undefined && viewport !== null) {
    const center = (): void => {
      if (!target.isConnected || !isStillFocused()) return;
      const bounds = target.getBoundingClientRect();
      viewport.scrollTop = getCenteredViewportScrollTop(viewport.scrollTop,
        viewport.getBoundingClientRect().top + viewport.clientTop, viewport.clientHeight,
        viewport.scrollHeight, bounds.top, bounds.height);
    };
    center();
    const ownerWindow = target.ownerDocument.defaultView;
    ownerWindow?.requestAnimationFrame(() => ownerWindow.requestAnimationFrame(center));
    return;
  }

  target.scrollIntoView({
    // "nearest" leaves partially-visible cards in place, which puts their
    // leading edge behind Steam's fixed header when navigating upward.
    block: "center",
    inline: "nearest",
  });

  keepTargetClearOfDeckyChrome(target);
  const ownerWindow = target.ownerDocument.defaultView;
  ownerWindow?.requestAnimationFrame(() => {
    ownerWindow.requestAnimationFrame(() => {
      if (target.isConnected && isStillFocused()) {
        keepTargetClearOfDeckyChrome(target);
      }
    });
  });
}

/** Reset the owning scroll viewport when its first content target receives focus. */
export function scrollDeckyFocusTargetToTop(
  target: EventTarget | null,
  isStillFocused: () => boolean = () => true,
  viewport?: HTMLElement | null,
): void {
  if (!isOwnerHTMLElement(target)) {
    return;
  }

  const scrollable = viewport ?? findScrollableAncestor(target);
  if (scrollable === null) {
    return;
  }

  const resetScroll = (): void => {
    if (target.isConnected && isStillFocused()) {
      scrollable.scrollTop = 0;
    }
  };

  resetScroll();
  // Decky may apply its own focus scroll after the focus callback.
  const ownerWindow = target.ownerDocument.defaultView;
  ownerWindow?.requestAnimationFrame(() => {
    ownerWindow.requestAnimationFrame(resetScroll);
  });
}
