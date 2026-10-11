export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1_000;
export const UPDATE_RECONNECT_COOLDOWN_MS = 60_000;

export interface AutomaticUpdateCheckSnapshot {
  readonly enabled: boolean;
  readonly productionSource: boolean;
  readonly lastCheckedAt?: number;
  readonly busy: boolean;
}

export class AutomaticUpdateChecks {
  private connection: "unknown" | "online" | "offline" = "unknown";
  private lastReconnectAttemptAt: number | undefined;

  constructor(
    private readonly snapshot: () => AutomaticUpdateCheckSnapshot,
    private readonly check: () => Promise<unknown>,
    private readonly now: () => number = Date.now,
  ) {}

  checkIfDue(): void {
    const now = this.now();
    const state = this.snapshot();
    if (!state.enabled || !state.productionSource || state.busy) return;
    if (state.lastCheckedAt !== undefined && now - state.lastCheckedAt < UPDATE_CHECK_INTERVAL_MS) return;
    this.runCheck();
  }

  observeSteamConnectivity(result: number, checking: boolean): void {
    if (checking) return;
    if (result === 1) {
      const reconnected = this.connection === "offline";
      this.connection = "online";
      if (reconnected) this.checkOnReconnect();
    } else if (result >= 2 && result <= 6) {
      this.connection = "offline";
    }
  }

  observeBrowserOffline(): void {
    this.connection = "offline";
  }

  observeBrowserOnline(): void {
    this.connection = "online";
    this.checkOnReconnect();
  }

  private checkOnReconnect(): void {
    const now = this.now();
    const state = this.snapshot();
    if (!state.enabled || !state.productionSource || state.busy) return;
    const lastCheck = Math.max(state.lastCheckedAt ?? -Infinity, this.lastReconnectAttemptAt ?? -Infinity);
    if (now - lastCheck < UPDATE_RECONNECT_COOLDOWN_MS) return;
    this.lastReconnectAttemptAt = now;
    this.runCheck();
  }

  private runCheck(): void {
    try {
      void this.check().catch((error: unknown) => console.warn("[Achievement Companion][Updater] Automatic check failed", error));
    } catch (error) {
      console.warn("[Achievement Companion][Updater] Automatic check failed", error);
    }
  }
}
