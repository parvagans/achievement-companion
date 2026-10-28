const stylesByDocument = new WeakMap<Document, Map<string, { style: HTMLStyleElement; owners: number }>>();

/** Retained routes share a sheet, but never insert it into another Steam document. */
export function retainDeckyDocumentStyles(ownerDocument: Document, key: string, css: string): () => void {
  let styles = stylesByDocument.get(ownerDocument);
  if (styles === undefined) {
    styles = new Map();
    stylesByDocument.set(ownerDocument, styles);
  }
  let entry = styles.get(key);
  if (entry === undefined) {
    const style = ownerDocument.createElement("style");
    style.dataset["achievementCompanionStyles"] = key;
    style.textContent = css;
    ownerDocument.head.appendChild(style);
    entry = { style, owners: 0 };
    styles.set(key, entry);
  }
  entry.owners += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    entry.owners -= 1;
    if (entry.owners === 0) {
      entry.style.remove();
      styles.delete(key);
      if (styles.size === 0) stylesByDocument.delete(ownerDocument);
    }
  };
}
