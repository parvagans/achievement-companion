const CANCEL_EVENT_TYPE = "vgp_oncancel";
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

const compactProviderCancelBridgeListeners = new Map<Window, EventListener>();
const compactAchievementCancelBridgeListeners = new Map<Window, EventListener>();
const compactGameDetailCancelBridgeListeners = new Map<Window, EventListener>();
const compactGameDetailCancelCallbacks = new Map<Window, () => void>();

function removeCancelBridgeListeners(listeners: Map<Window, EventListener>): void {
  for (const [bridgeWindow, listener] of listeners.entries()) {
    bridgeWindow.removeEventListener(CANCEL_EVENT_TYPE, listener, true);
  }

  listeners.clear();
}

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
  const callback = doc?.defaultView === null || doc?.defaultView === undefined
    ? undefined
    : compactGameDetailCancelCallbacks.get(doc.defaultView);
  if (callback !== undefined) {
    const cancelEvent = event as BridgeCancelableEvent;
    cancelEvent.preventDefault?.();
    cancelEvent.stopPropagation?.();
    cancelEvent.stopImmediatePropagation?.();
    callback();
    return;
  }

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

/**
 * Registers B for a compact game layout that deliberately has no visible Back
 * action. The callback is scoped to the mounted Steam game view and is removed
 * on unmount, while legacy game layouts continue using their marked Back pill.
 */
export function registerCompactGameDetailCancelCallback(
  element: Element | null | undefined,
  onCancel: () => void,
): () => void {
  if (element === null || element === undefined) {
    return () => undefined;
  }

  const ownerDocument = element.ownerDocument;
  const ownerWindow = ownerDocument?.defaultView;
  if (ownerDocument === undefined || ownerWindow === undefined || ownerWindow === null) {
    return () => undefined;
  }

  registerCancelBridgeForWindow(
    ownerWindow,
    ownerDocument,
    compactGameDetailCancelBridgeListeners,
    handleCompactGameDetailCancelBridge,
  );
  compactGameDetailCancelCallbacks.set(ownerWindow, onCancel);

  return () => {
    if (compactGameDetailCancelCallbacks.get(ownerWindow) === onCancel) {
      compactGameDetailCancelCallbacks.delete(ownerWindow);
    }
  };
}

export function resetCompactProviderCancelBridgeForTests(): void {
  removeCancelBridgeListeners(compactProviderCancelBridgeListeners);
}

export function resetCompactAchievementCancelBridgeForTests(): void {
  removeCancelBridgeListeners(compactAchievementCancelBridgeListeners);
}

export function resetCompactGameDetailCancelBridgeForTests(): void {
  removeCancelBridgeListeners(compactGameDetailCancelBridgeListeners);
  compactGameDetailCancelCallbacks.clear();
}

export function removeDeckyCompactCancelBridges(): void {
  removeCancelBridgeListeners(compactProviderCancelBridgeListeners);
  removeCancelBridgeListeners(compactAchievementCancelBridgeListeners);
  removeCancelBridgeListeners(compactGameDetailCancelBridgeListeners);
}
