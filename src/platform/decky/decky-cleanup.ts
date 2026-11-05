/** A host teardown failure must not strand the remaining plugin resources. */
export function runDeckyCleanup(actions: readonly (() => void)[]): void {
  for (const action of actions) {
    try { action(); } catch { console.warn("[Achievement Companion] A host cleanup operation failed."); }
  }
}

