import {
  DECKY_FOOTER_SCROLL_MARGIN_BOTTOM_PX,
  DECKY_HEADER_SCROLL_MARGIN_TOP_PX,
} from "./decky-focus-styles";

function isScrollableElement(element: HTMLElement): boolean {
  const style = globalThis.getComputedStyle(element);

  return (
    (style.overflowY === "auto" || style.overflowY === "scroll" || style.overflowY === "overlay") &&
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

  const scrollingElement = document.scrollingElement;
  return scrollingElement instanceof HTMLElement ? scrollingElement : null;
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
  const visibleBottom = Math.min(window.innerHeight, viewport.bottom) - DECKY_FOOTER_SCROLL_MARGIN_BOTTOM_PX;

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

export function scrollDeckyFocusTargetIntoView(target: EventTarget | null): void {
  if (!(target instanceof HTMLElement)) {
    return;
  }

  target.scrollIntoView({
    // "nearest" leaves partially-visible cards in place, which puts their
    // leading edge behind Steam's fixed header when navigating upward.
    block: "center",
    inline: "nearest",
  });

  keepTargetClearOfDeckyChrome(target);
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (target.isConnected) {
        keepTargetClearOfDeckyChrome(target);
      }
    });
  });
}
