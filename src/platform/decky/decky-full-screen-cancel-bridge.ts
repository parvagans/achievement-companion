const CANCEL_EVENT_TYPE = "vgp_oncancel";
const FULLSCREEN_BACK_BUTTON_SELECTOR =
  '[data-achievement-companion-fullscreen-back="true"][role="button"]';
const COMPACT_PROVIDER_BACK_BUTTON_SELECTOR =
  '[data-achievement-companion-compact-provider-back="true"][role="button"]';
const COMPACT_ACHIEVEMENT_BACK_BUTTON_SELECTOR =
  '[data-achievement-companion-compact-achievement-back="true"][role="button"]';
const COMPACT_GAME_DETAIL_BACK_BUTTON_SELECTOR =
  '[data-achievement-companion-compact-game-detail-back="true"][role="button"]';

type BridgeCancelableEvent = Event & {
  readonly preventDefault?: (() => void) | undefined;
  readonly stopPropagation?: (() => void) | undefined;
  readonly stopImmediatePropagation?: (() => void) | undefined;
};

type BridgeMarkedBackButton = {
  readonly click: () => void;
  readonly disabled?: boolean | undefined;
  readonly innerText?: string | undefined;
  readonly isConnected?: boolean | undefined;
  readonly getClientRects?: (() => ArrayLike<unknown>) | undefined;
};

const fullscreenCancelBridgeListeners = new Map<Window, EventListener>();
const compactProviderCancelBridgeListeners = new Map<Window, EventListener>();
const compactAchievementCancelBridgeListeners = new Map<Window, EventListener>();
const compactGameDetailCancelBridgeListeners = new Map<Window, EventListener>();

function getVisibleMarkedBackButton(
  selector: string,
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
): BridgeMarkedBackButton | undefined {
  if (doc === undefined) {
    return undefined;
  }

  const buttons = Array.from(doc.querySelectorAll(selector));
  for (const button of buttons) {
    const candidate = button as unknown as BridgeMarkedBackButton;
    if (
      candidate.disabled !== true &&
      candidate.isConnected !== false &&
      (candidate.getClientRects?.().length ?? 0) > 0
    ) {
      return candidate;
    }
  }

  return undefined;
}

function registerCancelBridgeForWindow(
  ownerWindow: Window,
  ownerDocument: Document,
  listeners: Map<Window, EventListener>,
  bridgeHandler: (event: Event, doc: Document | undefined) => void,
): void {
  const existingListener = listeners.get(ownerWindow);
  if (existingListener !== undefined) {
    return;
  }

  const listener: EventListener = (event) => {
    bridgeHandler(event, ownerDocument);
  };

  ownerWindow.addEventListener(CANCEL_EVENT_TYPE, listener, true);
  listeners.set(ownerWindow, listener);
}

export function handleFullscreenCancelBridge(
  event: Event,
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
): void {
  const cancelEvent = event as BridgeCancelableEvent;
  const backButton = getVisibleMarkedBackButton(FULLSCREEN_BACK_BUTTON_SELECTOR, doc);
  if (backButton === undefined) {
    return;
  }

  cancelEvent.preventDefault?.();
  cancelEvent.stopPropagation?.();
  cancelEvent.stopImmediatePropagation?.();
  backButton.click();
}

export function handleCompactAchievementCancelBridge(
  event: Event,
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
): void {
  const cancelEvent = event as BridgeCancelableEvent;
  const backButton = getVisibleMarkedBackButton(COMPACT_ACHIEVEMENT_BACK_BUTTON_SELECTOR, doc);
  if (backButton === undefined) {
    return;
  }

  cancelEvent.preventDefault?.();
  cancelEvent.stopPropagation?.();
  cancelEvent.stopImmediatePropagation?.();
  backButton.click();
}

export function handleCompactProviderCancelBridge(
  event: Event,
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
): void {
  const cancelEvent = event as BridgeCancelableEvent;
  const backButton = getVisibleMarkedBackButton(COMPACT_PROVIDER_BACK_BUTTON_SELECTOR, doc);
  if (backButton === undefined) {
    return;
  }

  cancelEvent.preventDefault?.();
  cancelEvent.stopPropagation?.();
  cancelEvent.stopImmediatePropagation?.();
  backButton.click();
}

export function handleCompactGameDetailCancelBridge(
  event: Event,
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
): void {
  const cancelEvent = event as BridgeCancelableEvent;
  const backButton = getVisibleMarkedBackButton(COMPACT_GAME_DETAIL_BACK_BUTTON_SELECTOR, doc);
  if (backButton === undefined) {
    return;
  }

  cancelEvent.preventDefault?.();
  cancelEvent.stopPropagation?.();
  cancelEvent.stopImmediatePropagation?.();
  backButton.click();
}

export function ensureFullscreenCancelBridgeRegisteredForBackButtonElement(
  element: Element | null | undefined,
): void {
  if (element === null || element === undefined) {
    return;
  }

  const ownerDocument = element.ownerDocument;
  const ownerWindow = ownerDocument?.defaultView;
  if (ownerDocument === undefined || ownerWindow === undefined || ownerWindow === null) {
    return;
  }

  registerCancelBridgeForWindow(
    ownerWindow,
    ownerDocument,
    fullscreenCancelBridgeListeners,
    handleFullscreenCancelBridge,
  );
}

export function ensureCompactProviderCancelBridgeRegisteredForBackButtonElement(
  element: Element | null | undefined,
): void {
  if (element === null || element === undefined) {
    return;
  }

  const ownerDocument = element.ownerDocument;
  const ownerWindow = ownerDocument?.defaultView;
  if (ownerDocument === undefined || ownerWindow === undefined || ownerWindow === null) {
    return;
  }

  registerCancelBridgeForWindow(
    ownerWindow,
    ownerDocument,
    compactProviderCancelBridgeListeners,
    handleCompactProviderCancelBridge,
  );
}

export function ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement(
  element: Element | null | undefined,
): void {
  if (element === null || element === undefined) {
    return;
  }

  const ownerDocument = element.ownerDocument;
  const ownerWindow = ownerDocument?.defaultView;
  if (ownerDocument === undefined || ownerWindow === undefined || ownerWindow === null) {
    return;
  }

  registerCancelBridgeForWindow(
    ownerWindow,
    ownerDocument,
    compactAchievementCancelBridgeListeners,
    handleCompactAchievementCancelBridge,
  );
}

export function ensureCompactGameDetailCancelBridgeRegisteredForBackButtonElement(
  element: Element | null | undefined,
): void {
  if (element === null || element === undefined) {
    return;
  }

  const ownerDocument = element.ownerDocument;
  const ownerWindow = ownerDocument?.defaultView;
  if (ownerDocument === undefined || ownerWindow === undefined || ownerWindow === null) {
    return;
  }

  registerCancelBridgeForWindow(
    ownerWindow,
    ownerDocument,
    compactGameDetailCancelBridgeListeners,
    handleCompactGameDetailCancelBridge,
  );
}

export function resetFullscreenCancelBridgeForTests(): void {
  for (const [bridgeWindow, listener] of fullscreenCancelBridgeListeners.entries()) {
    bridgeWindow.removeEventListener(CANCEL_EVENT_TYPE, listener, true);
  }

  fullscreenCancelBridgeListeners.clear();
}

export function resetCompactProviderCancelBridgeForTests(): void {
  for (const [bridgeWindow, listener] of compactProviderCancelBridgeListeners.entries()) {
    bridgeWindow.removeEventListener(CANCEL_EVENT_TYPE, listener, true);
  }

  compactProviderCancelBridgeListeners.clear();
}

export function resetCompactAchievementCancelBridgeForTests(): void {
  for (const [bridgeWindow, listener] of compactAchievementCancelBridgeListeners.entries()) {
    bridgeWindow.removeEventListener(CANCEL_EVENT_TYPE, listener, true);
  }

  compactAchievementCancelBridgeListeners.clear();
}

export function resetCompactGameDetailCancelBridgeForTests(): void {
  for (const [bridgeWindow, listener] of compactGameDetailCancelBridgeListeners.entries()) {
    bridgeWindow.removeEventListener(CANCEL_EVENT_TYPE, listener, true);
  }

  compactGameDetailCancelBridgeListeners.clear();
}
