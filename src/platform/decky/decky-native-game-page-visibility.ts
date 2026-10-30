import { useEffect, useState } from "react";
import { detectDeckyGamePageAchievementRouteFromUrl } from "./decky-game-page-achievement-route";

interface CallbackList {
  Register(callback: () => void): { Unregister(): void };
}
interface NativeContext {
  readonly FocusChangedCallbacks?: CallbackList;
  readonly NavTreeActivatedOrReactivatedCallbacks?: CallbackList;
}
interface NativeNavigation {
  readonly ContextSetChangedCallbacks?: CallbackList;
  readonly m_rgAllContexts?: Iterable<NativeContext>;
}

/** Native navigation changes wake the shared-route check; they never veto page ownership. */
export function subscribeNativeGamePageVisibility(navigation: NativeNavigation | undefined, changed: () => void): () => void {
  let contextSubscriptions: { Unregister(): void }[] = [];
  const bind = (): void => {
    contextSubscriptions.forEach((subscription) => subscription.Unregister());
    contextSubscriptions = Array.from(navigation?.m_rgAllContexts ?? []).flatMap((context) =>
      [context.FocusChangedCallbacks, context.NavTreeActivatedOrReactivatedCallbacks].flatMap((callbacks) => callbacks ? [callbacks.Register(changed)] : []));
    changed();
  };
  const contexts = navigation?.ContextSetChangedCallbacks?.Register(bind);
  bind();
  return () => { contexts?.Unregister(); contextSubscriptions.forEach((subscription) => subscription.Unregister()); };
}

export function isNativeGamePageSurfaceVisible(badge: HTMLElement, appId: string, routeUrl = badge.ownerDocument.location.href): boolean {
  if (!badge.isConnected) return false;
  const route = detectDeckyGamePageAchievementRouteFromUrl(routeUrl);
  // Menus/dialogs may own focus or obscure this document without leaving its
  // game page. Native ancestors own that visibility, just as for the badge.
  return route.isGamePage && route.appId === appId;
}

export function useNativeGamePageSurfaceVisible(badge: HTMLElement, appId: string): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const navigation = (globalThis as { FocusNavController?: NativeNavigation }).FocusNavController;
    // Steam routes live in SharedJSContext; a retained browser view can keep an older URL.
    const routeWindow = globalThis.window ?? badge.ownerDocument.defaultView;
    const update = (): void => setVisible(isNativeGamePageSurfaceVisible(badge, appId, routeWindow?.location.href));
    const unsubscribe = subscribeNativeGamePageVisibility(navigation, update);
    routeWindow?.addEventListener("popstate", update);
    return () => { unsubscribe(); routeWindow?.removeEventListener("popstate", update); };
  }, [badge, appId]);
  return visible;
}
