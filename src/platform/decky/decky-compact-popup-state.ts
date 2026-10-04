let activeCompactPopupCount = 0;

export function beginDeckyCompactPopup(): () => void {
  activeCompactPopupCount += 1;
  let released = false;

  return () => {
    if (released) {
      return;
    }
    released = true;
    activeCompactPopupCount = Math.max(0, activeCompactPopupCount - 1);
  };
}

export function hasActiveDeckyCompactPopup(): boolean {
  return activeCompactPopupCount > 0;
}

export function resetDeckyCompactPopupStateForTests(): void {
  activeCompactPopupCount = 0;
}
