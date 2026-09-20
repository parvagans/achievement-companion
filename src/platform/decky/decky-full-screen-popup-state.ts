let activeDeckyFullscreenPopupCancel: (() => void) | undefined;

export function registerDeckyFullscreenPopupCancel(handler: () => void): () => void {
  activeDeckyFullscreenPopupCancel = handler;
  return () => {
    if (activeDeckyFullscreenPopupCancel === handler) {
      activeDeckyFullscreenPopupCancel = undefined;
    }
  };
}

export function consumeDeckyFullscreenPopupCancel(): boolean {
  const handler = activeDeckyFullscreenPopupCancel;
  if (handler === undefined) {
    return false;
  }

  activeDeckyFullscreenPopupCancel = undefined;
  handler();
  return true;
}
