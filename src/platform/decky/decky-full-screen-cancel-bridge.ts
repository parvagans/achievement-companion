const CANCEL_EVENT_TYPE = "vgp_oncancel";
type CompactCancelScope = "provider" | "achievement" | "game-detail";

const BACK_BUTTON_SELECTORS: Record<CompactCancelScope, string> = {
  provider: '[data-achievement-companion-compact-provider-back="true"][role="button"]',
  achievement: '[data-achievement-companion-compact-achievement-back="true"][role="button"]',
  "game-detail": '[data-achievement-companion-compact-game-detail-back="true"][role="button"]',
};

interface CompactCancelRegistration {
  readonly element: Element;
  readonly onCancel: () => void;
}

interface CompactCancelBridge {
  readonly document: Document;
  readonly listener: EventListener;
  readonly callbacks: Map<CompactCancelScope, CompactCancelRegistration>;
  readonly legacyScopes: Set<CompactCancelScope>;
}

// Exactly one capture listener owns compact Back in each Steam UI window.
// Loader/detail transitions may briefly overlap effects; latest live scope wins.
const compactCancelBridges = new Map<Window, CompactCancelBridge>();
let compactCancelEnabled = true;

function isVisible(element: Element): boolean {
  return element.isConnected !== false && (element.getClientRects?.().length ?? 0) > 0;
}

function getVisibleLegacyBackAction(
  bridge: CompactCancelBridge,
  scope?: CompactCancelScope,
): (() => void) | undefined {
  for (const registeredScope of [...bridge.legacyScopes].reverse()) {
    if (scope !== undefined && registeredScope !== scope) {
      continue;
    }
    for (const element of bridge.document.querySelectorAll(BACK_BUTTON_SELECTORS[registeredScope])) {
      // Legacy RA layouts already mark their actual Back control. Preserve this
      // compatibility path without making callback-driven Steam views query DOM.
      const button = element as HTMLElement & { readonly disabled?: boolean };
      if (button.disabled !== true && isVisible(button)) {
        return () => button.click();
      }
    }
  }
  return undefined;
}

function handleCompactCancel(
  event: Event,
  doc: Document | undefined,
  scope?: CompactCancelScope,
): void {
  if (!compactCancelEnabled || event.defaultPrevented || doc?.defaultView == null) {
    return;
  }
  const bridge = compactCancelBridges.get(doc.defaultView);
  if (bridge === undefined) {
    return;
  }

  let onCancel: (() => void) | undefined;
  for (const [registeredScope, registration] of [...bridge.callbacks].reverse()) {
    if ((scope === undefined || registeredScope === scope) && isVisible(registration.element)) {
      onCancel = registration.onCancel;
      break;
    }
  }
  onCancel ??= getVisibleLegacyBackAction(bridge, scope);
  if (onCancel === undefined) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  onCancel();
}

function ensureBridge(element: Element | null | undefined): CompactCancelBridge | undefined {
  const doc = element?.ownerDocument;
  const ownerWindow = doc?.defaultView;
  if (doc === undefined || ownerWindow == null) {
    return undefined;
  }
  let bridge = compactCancelBridges.get(ownerWindow);
  if (bridge === undefined) {
    const listener: EventListener = (event) => handleCompactCancel(event, doc);
    bridge = { document: doc, listener, callbacks: new Map(), legacyScopes: new Set() };
    compactCancelBridges.set(ownerWindow, bridge);
    ownerWindow.addEventListener(CANCEL_EVENT_TYPE, listener, true);
  }
  return bridge;
}

function removeUnusedBridge(bridge: CompactCancelBridge): void {
  const ownerWindow = bridge.document.defaultView;
  if (ownerWindow == null || bridge.callbacks.size > 0 || bridge.legacyScopes.size > 0) {
    return;
  }
  ownerWindow.removeEventListener(CANCEL_EVENT_TYPE, bridge.listener, true);
  if (compactCancelBridges.get(ownerWindow) === bridge) {
    compactCancelBridges.delete(ownerWindow);
  }
}

function registerCompactCancelCallback(
  scope: CompactCancelScope,
  element: Element | null | undefined,
  onCancel: () => void,
): () => void {
  const bridge = ensureBridge(element);
  if (bridge === undefined || element == null) {
    return () => undefined;
  }
  const registration = { element, onCancel };
  bridge.callbacks.delete(scope);
  bridge.callbacks.set(scope, registration);
  return () => {
    if (bridge.callbacks.get(scope) === registration) {
      bridge.callbacks.delete(scope);
      removeUnusedBridge(bridge);
    }
  };
}

export function setDeckyCompactCancelBridgesEnabled(enabled: boolean): void {
  // The lightweight alwaysRender session shell gates the entire compatibility
  // bridge before passive effect cleanup can leave a hidden callback eligible.
  compactCancelEnabled = enabled;
}

export function ensureCompactProviderCancelBridgeRegisteredForBackButtonElement(
  element: Element | null | undefined,
): void {
  ensureBridge(element)?.legacyScopes.add("provider");
}

export function ensureCompactAchievementCancelBridgeRegisteredForBackButtonElement(
  element: Element | null | undefined,
): void {
  ensureBridge(element)?.legacyScopes.add("achievement");
}

export function ensureCompactGameDetailCancelBridgeRegisteredForBackButtonElement(
  element: Element | null | undefined,
): void {
  ensureBridge(element)?.legacyScopes.add("game-detail");
}

/** Loading screens can own Back without adding an invisible focus stop. */
export function registerCompactProviderCancelCallback(
  element: Element | null | undefined,
  onCancel: () => void,
): () => void {
  return registerCompactCancelCallback("provider", element, onCancel);
}

export function registerCompactAchievementCancelCallback(
  element: Element | null | undefined,
  onCancel: () => void,
): () => void {
  return registerCompactCancelCallback("achievement", element, onCancel);
}

export function registerCompactGameDetailCancelCallback(
  element: Element | null | undefined,
  onCancel: () => void,
): () => void {
  return registerCompactCancelCallback("game-detail", element, onCancel);
}

export function handleCompactProviderCancelBridge(event: Event, doc?: Document): void {
  handleCompactCancel(event, doc, "provider");
}

export function handleCompactAchievementCancelBridge(event: Event, doc?: Document): void {
  handleCompactCancel(event, doc, "achievement");
}

export function handleCompactGameDetailCancelBridge(event: Event, doc?: Document): void {
  handleCompactCancel(event, doc, "game-detail");
}

function resetScopeForTests(scope: CompactCancelScope): void {
  for (const bridge of compactCancelBridges.values()) {
    bridge.callbacks.delete(scope);
    bridge.legacyScopes.delete(scope);
    removeUnusedBridge(bridge);
  }
  compactCancelEnabled = true;
}

export function resetCompactProviderCancelBridgeForTests(): void {
  resetScopeForTests("provider");
}

export function resetCompactAchievementCancelBridgeForTests(): void {
  resetScopeForTests("achievement");
}

export function resetCompactGameDetailCancelBridgeForTests(): void {
  resetScopeForTests("game-detail");
}

export function removeDeckyCompactCancelBridges(): void {
  for (const [ownerWindow, bridge] of compactCancelBridges) {
    ownerWindow.removeEventListener(CANCEL_EVENT_TYPE, bridge.listener, true);
    bridge.callbacks.clear();
    bridge.legacyScopes.clear();
  }
  compactCancelBridges.clear();
}
