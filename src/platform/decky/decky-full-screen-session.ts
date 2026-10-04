/**
 * The compact/full-screen bridge tracks only which Decky route is the root of
 * the current compact-origin visit. Compact provider/game/achievement state
 * belongs exclusively to decky-compact-navigation.
 */
export type DeckyFullScreenSessionRoot =
  | "profile"
  | "game"
  | "achievement-history"
  | "completion-progress"
  | "settings";

interface DeckyCompactOriginFullScreenSession {
  readonly source: "compact";
  readonly rootRoute: DeckyFullScreenSessionRoot;
}

let activeFullScreenSession: DeckyCompactOriginFullScreenSession | undefined;

export function beginDeckyCompactOriginFullScreenSession(
  rootRoute: DeckyFullScreenSessionRoot,
): void {
  activeFullScreenSession = { source: "compact", rootRoute };
}

export function isDeckyCompactOriginFullScreenSessionRoot(
  rootRoute: DeckyFullScreenSessionRoot,
): boolean {
  return activeFullScreenSession?.source === "compact" &&
    activeFullScreenSession.rootRoute === rootRoute;
}

export function hasDeckyCompactOriginFullScreenSession(): boolean {
  return activeFullScreenSession?.source === "compact";
}

/** Consume before the native pop so a repeated B cannot reopen QAM twice. */
export function consumeDeckyCompactOriginFullScreenSession(
  rootRoute: DeckyFullScreenSessionRoot,
): boolean {
  if (!isDeckyCompactOriginFullScreenSessionRoot(rootRoute)) {
    return false;
  }

  activeFullScreenSession = undefined;
  return true;
}

export function clearDeckyFullScreenSession(): void {
  activeFullScreenSession = undefined;
}
