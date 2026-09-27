import * as deckyUi from "@decky/ui";

export function readDeckyGamepadNavigationTrees(): unknown {
  const module = deckyUi as unknown as {
    readonly default?: { readonly getGamepadNavigationTrees?: () => unknown };
    readonly getGamepadNavigationTrees?: () => unknown;
  };
  const getTrees = module.getGamepadNavigationTrees ?? module.default?.getGamepadNavigationTrees;
  return getTrees?.();
}
