// Fallback only: the native footer is measured in the route's CSS-pixel viewport.
export const STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX = 72;
// Steam Gaming Mode currently renders a 41.67 CSS-pixel footer at 1.5x scale.
// Keep enough room for the compact controls without making our bar taller.
const MINIMUM_FOOTER_HEIGHT_PX = 40;
const BASE_OVERLAY_Z_INDEX = 20;
const MAX_OVERLAY_Z_INDEX = 2_147_483_647;

export interface SteamGameFooterLayout {
  readonly height: number;
  readonly zIndex: number;
}

export function measureSteamGameFooterLayout(
  ownerDocument: Document,
  overlayHost?: HTMLElement,
): SteamGameFooterLayout {
  const ownerWindow = ownerDocument.defaultView;
  if (ownerWindow === null) {
    return { height: STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX, zIndex: BASE_OVERLAY_Z_INDEX };
  }

  // Verified on Gaming Mode's visible document, not the 1x1 SharedJSContext.
  // Read Steam's existing element only; never change its styles or children.
  const nativeFooter = ownerDocument.getElementById("Footer");
  const bounds = nativeFooter?.getBoundingClientRect();
  const hasVisibleFooter = bounds !== undefined && bounds.height > 0 &&
    bounds.width >= ownerWindow.innerWidth / 2 &&
    Math.abs(bounds.bottom - ownerWindow.innerHeight) <= 2;
  const height = hasVisibleFooter
    ? Math.max(MINIMUM_FOOTER_HEIGHT_PX, Math.ceil(bounds.height))
    : STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX;
  const elements = ownerDocument.elementsFromPoint(
    ownerWindow.innerWidth / 2,
    ownerWindow.innerHeight - (hasVisibleFooter ? bounds.height : height) / 2,
  );
  if (hasVisibleFooter && nativeFooter !== null) {
    elements.push(nativeFooter);
  }
  let highestZIndex = BASE_OVERLAY_Z_INDEX - 1;
  for (const element of elements) {
    if (overlayHost?.contains(element)) {
      continue;
    }
    // Cross-window instanceof HTMLElement rejects valid Gaming Mode elements.
    for (let current: Element | null = element; current !== null; current = current.parentElement) {
      const zIndex = Number.parseInt(ownerWindow.getComputedStyle(current).zIndex, 10);
      if (Number.isFinite(zIndex)) {
        highestZIndex = Math.max(highestZIndex, zIndex);
      }
    }
  }
  // Real Deck: native Footer = 7000; 7001 was confirmed above it by hit testing.
  return { height, zIndex: Math.min(MAX_OVERLAY_Z_INDEX, highestZIndex + 1) };
}
