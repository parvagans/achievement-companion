export type DeckySteamCompactFocusTarget =
  | { readonly kind: "profile" }
  | { readonly kind: "calendar-entry" }
  | { readonly kind: "calendar"; readonly day: number }
  | { readonly kind: "achievement"; readonly gameId: string; readonly achievementId: string }
  | { readonly kind: "activity" }
  | { readonly kind: "game"; readonly gameId: string }
  | { readonly kind: "games" }
  | { readonly kind: "settings" };

interface DeckySteamCompactFocusState {
  readonly scrollTop: number;
  readonly target: DeckySteamCompactFocusTarget;
}

let focusState: DeckySteamCompactFocusState = {
  scrollTop: 0,
  target: { kind: "profile" },
};
let restorationRequestVersion = 0;
const restorationRequestListeners = new Set<() => void>();

export function getDeckySteamCompactFocusTargetKey(target: DeckySteamCompactFocusTarget): string {
  switch (target.kind) {
    case "calendar":
      return `calendar:${target.day}`;
    case "achievement":
      return `achievement:${target.gameId}:${target.achievementId}`;
    case "game":
      return `game:${target.gameId}`;
    default:
      return target.kind;
  }
}

export function readDeckySteamCompactFocusTarget(): DeckySteamCompactFocusTarget {
  return focusState.target;
}

export function readDeckySteamCompactFocusScrollTop(): number {
  return focusState.scrollTop;
}

export function setDeckySteamCompactFocusTarget(
  target: DeckySteamCompactFocusTarget,
  scrollTop = 0,
): void {
  focusState = { scrollTop, target };
}

export function requestDeckySteamCompactFocusRestore(): void {
  restorationRequestVersion += 1;
  for (const listener of restorationRequestListeners) {
    listener();
  }
}

export function readDeckySteamCompactFocusRestoreRequest(): number {
  return restorationRequestVersion;
}

export function subscribeToDeckySteamCompactFocusRestore(listener: () => void): () => void {
  restorationRequestListeners.add(listener);
  return () => restorationRequestListeners.delete(listener);
}

export function resetDeckySteamCompactFocusState(): void {
  focusState = { scrollTop: 0, target: { kind: "profile" } };
  restorationRequestVersion = 0;
}

export function resetDeckySteamCompactFocusTargetForTests(): void {
  resetDeckySteamCompactFocusState();
}
