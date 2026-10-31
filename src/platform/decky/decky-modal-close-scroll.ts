/** Keep an already-visible native Close action from re-centering its outer dialog.
 * Content viewports are not ancestors of Close and remain independently scrollable.
 */
export interface ModalCloseScrollGuard { readonly restore: () => void; readonly release: () => void }
export function preserveModalAncestorScrollWhileFocused(button: HTMLElement | null | undefined): ModalCloseScrollGuard {
  const inactive = { restore: () => {}, release: () => {} };
  const ownerWindow = button?.ownerDocument?.defaultView;
  if (!button || !ownerWindow || typeof button.getBoundingClientRect !== "function") return inactive;
  const bounds = button.getBoundingClientRect();
  // An offscreen action must still be revealed by native navigation.
  if (bounds.top < 0 || bounds.bottom > ownerWindow.innerHeight || bounds.left < 0 || bounds.right > ownerWindow.innerWidth) return inactive;
  const positions: { node: HTMLElement; top: number; left: number }[] = [];
  for (let node = button.parentElement; node; node = node.parentElement) {
    positions.push({ node, top: node.scrollTop, left: node.scrollLeft });
  }
  let released = false;
  const restore = (): void => {
    if (released) return;
    for (const { node, top, left } of positions) {
      if (node.scrollTop !== top) node.scrollTop = top;
      if (node.scrollLeft !== left) node.scrollLeft = left;
    }
  };
  const observer = new ownerWindow.MutationObserver(() => {
    if (!button.matches(".gpfocus, .gpfocuswithin")) release();
  });
  const release = (): void => {
    if (released) return;
    released = true;
    observer.disconnect();
    for (const { node } of positions) node.removeEventListener("scroll", restore);
  };
  for (const { node } of positions) node.addEventListener("scroll", restore, { passive: true });
  observer.observe(button, { attributes: true, attributeFilter: ["class"] });
  // Native focus may scroll synchronously, before the browser's scroll event.
  return { release, restore };
}
