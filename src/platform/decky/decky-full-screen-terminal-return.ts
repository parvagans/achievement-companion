import type { DeckyFullScreenSessionRoot } from "./decky-full-screen-session";

/**
 * Current Decky Loader sources defer reopening the Decky QAM for 250ms after
 * completing a UI transition. Pop the native full-screen route first, then
 * use the same delay so Steam can finish changing its visible surface.
 */
export const DECKY_COMPACT_ORIGIN_QAM_REOPEN_DELAY_MS = 250;

interface DeckyFullScreenTerminalReturnDependencies {
  readonly consumeSession: (rootRoute: DeckyFullScreenSessionRoot) => boolean;
  readonly clearSession: () => void;
  readonly navigateBack: () => void;
  readonly openDeckyQuickAccessMenu: () => void;
  readonly schedule: (callback: () => void, delayMs: number) => unknown;
  readonly cancel: (handle: unknown) => void;
}

export interface DeckyFullScreenTerminalReturn {
  /** Performs native Back and reopens QAM only for a matching compact origin. */
  handleRootBack(rootRoute: DeckyFullScreenSessionRoot): boolean;
  /** Cancels an outstanding QAM reopen and drops session-local origin state. */
  clear(): void;
  /** Replacing a compact session must not leave an older reopen timer alive. */
  cancelPendingReopen(): void;
}

export function createDeckyFullScreenTerminalReturn(
  dependencies: DeckyFullScreenTerminalReturnDependencies,
): DeckyFullScreenTerminalReturn {
  let pendingReopen: unknown | undefined;

  const cancelPendingReopen = (): void => {
    if (pendingReopen === undefined) {
      return;
    }

    dependencies.cancel(pendingReopen);
    pendingReopen = undefined;
  };

  return {
    handleRootBack(rootRoute) {
      const returnToCompactOrigin = dependencies.consumeSession(rootRoute);
      // Native Decky/Steam routing remains authoritative for every root exit.
      dependencies.navigateBack();

      if (!returnToCompactOrigin) {
        return false;
      }

      cancelPendingReopen();
      pendingReopen = dependencies.schedule(() => {
        pendingReopen = undefined;
        dependencies.openDeckyQuickAccessMenu();
      }, DECKY_COMPACT_ORIGIN_QAM_REOPEN_DELAY_MS);
      return true;
    },
    clear() {
      cancelPendingReopen();
      dependencies.clearSession();
    },
    cancelPendingReopen,
  };
}
