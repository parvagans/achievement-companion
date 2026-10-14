
export type DeckySteamCompactFocusTarget =
  | { readonly kind: "profile" }
  | { readonly kind: "steamhunters-points" }
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
  requestDeckyCompactFocusRestore();
}

export function readDeckySteamCompactFocusRestoreRequest(): number {
  return readDeckyCompactFocusRestoreRequest();
}

export function subscribeToDeckySteamCompactFocusRestore(listener: () => void): () => void {
  return subscribeToDeckyCompactFocusRestore(listener);
}

export function resetDeckySteamCompactFocusState(): void {
  focusState = { scrollTop: 0, target: { kind: "profile" } };
  resetDeckyCompactFocusRestore();
}

export function resetDeckySteamCompactFocusTargetForTests(): void {
  resetDeckySteamCompactFocusState();
}
import {
  readDeckyCompactFocusRestoreRequest,
  requestDeckyCompactFocusRestore,
  resetDeckyCompactFocusRestore,
  subscribeToDeckyCompactFocusRestore,
} from "./decky-compact-focus-restore";
