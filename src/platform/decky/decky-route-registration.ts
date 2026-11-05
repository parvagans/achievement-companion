import { runDeckyCleanup } from "./decky-cleanup";
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
  const acquired: DeckyRouteDefinition[] = [];
  const unregister = () => {
    registered = false;
    runDeckyCleanup(acquired.splice(0).reverse().map(route => () => routeHook.removeRoute(route.path)));
  };

  return {
    register() {
      if (registered) {
        return;
      }

      try {
        for (const route of routes) {
          routeHook.addRoute(route.path, route.component);
          acquired.push(route);
        }
        registered = true;
      } catch (cause) {
        unregister();
        throw cause;
      }
    },
    unregister,
    isRegistered() {
      return registered;
    },
  };
}
