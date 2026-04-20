const FULLSCREEN_CANCEL_EVENT_TYPE = "vgp_oncancel";
const FULLSCREEN_BACK_BUTTON_SELECTOR =
  'button[data-achievement-companion-fullscreen-back="true"]';

type BridgeCancelableEvent = Event & {
  readonly preventDefault?: (() => void) | undefined;
  readonly stopPropagation?: (() => void) | undefined;
  readonly stopImmediatePropagation?: (() => void) | undefined;
};

type BridgeWindow = Window;

type BridgeFullscreenBackButton = {
  readonly click: () => void;
  readonly disabled?: boolean | undefined;
  readonly innerText?: string | undefined;
  readonly isConnected?: boolean | undefined;
  readonly getClientRects?: (() => ArrayLike<unknown>) | undefined;
};

const fullscreenCancelBridgeListeners = new Map<Window, EventListener>();

function getVisibleMarkedFullscreenBackButton(
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
): BridgeFullscreenBackButton | undefined {
  if (doc === undefined) {
    return undefined;
  }

  const buttons = Array.from(doc.querySelectorAll(FULLSCREEN_BACK_BUTTON_SELECTOR));
  for (const button of buttons) {
    const candidate = button as unknown as BridgeFullscreenBackButton;
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

function registerFullscreenCancelBridgeForWindow(
  ownerWindow: Window,
  ownerDocument: Document,
): void {
  const existingListener = fullscreenCancelBridgeListeners.get(ownerWindow);
  if (existingListener !== undefined) {
    return;
  }

  const listener: EventListener = (event) => {
    handleFullscreenCancelBridge(event, ownerDocument);
  };

  ownerWindow.addEventListener(FULLSCREEN_CANCEL_EVENT_TYPE, listener, true);
  fullscreenCancelBridgeListeners.set(ownerWindow, listener);
}

export function handleFullscreenCancelBridge(
  event: Event,
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
): void {
  const cancelEvent = event as BridgeCancelableEvent;
  const backButton = getVisibleMarkedFullscreenBackButton(doc);
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

  registerFullscreenCancelBridgeForWindow(ownerWindow, ownerDocument);
}

export function resetFullscreenCancelBridgeForTests(): void {
  for (const [bridgeWindow, listener] of fullscreenCancelBridgeListeners.entries()) {
    bridgeWindow.removeEventListener(FULLSCREEN_CANCEL_EVENT_TYPE, listener, true);
  }

  fullscreenCancelBridgeListeners.clear();
}
