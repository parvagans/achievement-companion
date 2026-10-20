export interface DeckyGamePageRoutePatchHandle {
  unpatch(): void;
}

/** A badge can remount while its game page stays active; that is not route disposal. */
export function shouldReleaseDeckyGamePageRoutePatchOnBadgeUnmount(
  ownerAppId: string,
  currentRoute: { readonly appId: string | undefined; readonly reason: string },
): boolean {
  return currentRoute.reason !== "url-unavailable" && currentRoute.appId !== ownerAppId;
}

/** Keep only the render-function patch owned by the current library route. */
export function createDeckyGamePageRoutePatchLifetime<Owner extends object>() {
  let active: { readonly owner: Owner; readonly patch: DeckyGamePageRoutePatchHandle } | undefined;

  function releaseCurrent(): void {
    if (active === undefined) {
      return;
    }

    const previous = active;
    active = undefined;
    previous.patch.unpatch();
  }

  return {
    has(owner: Owner): boolean {
      return active?.owner === owner;
    },
    install(owner: Owner, createPatch: (release: () => void) => DeckyGamePageRoutePatchHandle): void {
      if (active?.owner === owner) {
        return;
      }

      releaseCurrent();

      let entry: { readonly owner: Owner; readonly patch: DeckyGamePageRoutePatchHandle };
      const release = () => {
        // An old badge may unmount after a later route has already installed its patch.
        if (active === entry) {
          releaseCurrent();
        }
      };
      entry = { owner, patch: createPatch(release) };
      active = entry;
    },
    dispose(): void {
      releaseCurrent();
    },
  };
}

/** A revision exists only while an app has a mounted subscriber. */
export function createDeckyGamePageSummaryRevisionStore() {
  const subscriptions = new Map<string, { revision: number; preserveVisibleRevision: number | undefined; listeners: Set<() => void> }>();

  return {
    snapshot(appId: string): number {
      return subscriptions.get(appId)?.revision ?? 0;
    },
    preservesVisibleSummary(appId: string, revision: number): boolean {
      return subscriptions.get(appId)?.preserveVisibleRevision === revision;
    },
    subscribe(appId: string, listener: () => void): () => void {
      let subscription = subscriptions.get(appId);
      if (subscription === undefined) {
        subscription = { revision: 0, preserveVisibleRevision: undefined, listeners: new Set() };
        subscriptions.set(appId, subscription);
      }
      subscription.listeners.add(listener);

      return () => {
        subscription.listeners.delete(listener);
        if (subscription.listeners.size === 0 && subscriptions.get(appId) === subscription) {
          subscriptions.delete(appId);
        }
      };
    },
    invalidate(appId: string, options?: { readonly preserveVisible?: boolean }): void {
      const subscription = subscriptions.get(appId);
      if (subscription === undefined) {
        return;
      }
      subscription.revision += 1;
      subscription.preserveVisibleRevision = options?.preserveVisible === true ? subscription.revision : undefined;
      for (const listener of [...subscription.listeners]) {
        listener();
      }
    },
    subscribedAppIds(): readonly string[] {
      return [...subscriptions.keys()];
    },
  };
}
