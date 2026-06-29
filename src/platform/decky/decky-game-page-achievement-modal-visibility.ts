function resolveDeckyGamePageModalTargetDocument(targetDocument?: Document): Document | undefined {
  if (targetDocument !== undefined) {
    return targetDocument;
  }

  try {
    if (typeof window !== "undefined" && window.top?.document !== undefined) {
      void window.top.document.body;
      return window.top.document;
    }
  } catch {
    // Ignore cross-frame access failures and fall back to the local document.
  }

  if (typeof document !== "undefined") {
    return document;
  }

  return undefined;
}

export function isVisibleDeckyGamePageModalElement(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 100 || rect.height <= 100) {
    return false;
  }

  const targetWindow = element.ownerDocument?.defaultView;
  if (targetWindow === null || targetWindow === undefined) {
    return false;
  }

  const computedStyle = targetWindow.getComputedStyle(element);
  if (computedStyle.display === "none" || computedStyle.visibility === "hidden") {
    return false;
  }

  return computedStyle.opacity !== "0";
}

export function hasVisibleDeckyGamePageModal(targetDocument?: Document): boolean {
  const resolvedDocument = resolveDeckyGamePageModalTargetDocument(targetDocument);
  if (resolvedDocument === undefined) {
    return false;
  }

  return Array.from(
    resolvedDocument.querySelectorAll('[role="dialog"], [aria-modal="true"]'),
  ).some((element) => isVisibleDeckyGamePageModalElement(element));
}
