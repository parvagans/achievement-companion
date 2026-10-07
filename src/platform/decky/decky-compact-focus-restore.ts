let restorationRequestVersion = 0;
const restorationRequestListeners = new Set<() => void>();

export function requestDeckyCompactFocusRestore(): void {
  restorationRequestVersion += 1;
  for (const listener of restorationRequestListeners) listener();
}

export function readDeckyCompactFocusRestoreRequest(): number {
  return restorationRequestVersion;
}

export function subscribeToDeckyCompactFocusRestore(listener: () => void): () => void {
  restorationRequestListeners.add(listener);
  return () => restorationRequestListeners.delete(listener);
}

export function resetDeckyCompactFocusRestore(): void {
  restorationRequestVersion = 0;
}
