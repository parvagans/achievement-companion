import type { RouterHook } from "@decky/api";
import type { ComponentType } from "react";

export interface DeckyRouteDefinition {
  readonly path: string;
  readonly component: ComponentType;
}

export interface DeckyRouteRegistration {
  readonly register: () => void;
  readonly unregister: () => void;
  readonly isRegistered: () => boolean;
}

type DeckyRouteHook = Pick<RouterHook, "addRoute" | "removeRoute">;

export function createDeckyRouteRegistration(
  routeHook: DeckyRouteHook,
  routes: readonly DeckyRouteDefinition[],
): DeckyRouteRegistration {
  let registered = false;

  return {
    register() {
      if (registered) {
        return;
      }

      for (const route of routes) {
        routeHook.addRoute(route.path, route.component);
      }
      registered = true;
    },
    unregister() {
      if (!registered) {
        return;
      }

      for (const route of [...routes].reverse()) {
        routeHook.removeRoute(route.path);
      }
      registered = false;
    },
    isRegistered() {
      return registered;
    },
  };
}
