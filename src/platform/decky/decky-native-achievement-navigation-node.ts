interface NativeRowNavigationNode {
  readonly m_element?: HTMLElement;
  BTakeFocus(): boolean;
  BHasFocus(): boolean;
}

interface SteamFiber {
  readonly memoizedProps?: { readonly value?: NativeRowNavigationNode; readonly node?: NativeRowNavigationNode };
  readonly return?: SteamFiber | null;
}

/** Steam exposes the native row focus node through context or its panel props. */
export function readNativeRowNavigationNode(element: HTMLElement): NativeRowNavigationNode | undefined {
  const key = Object.keys(element).find(name => name.startsWith("__reactFiber$"));
  let fiber = key === undefined ? undefined : (element as unknown as Record<string, SteamFiber>)[key];
  for (let depth = 0; fiber != null && depth < 6; depth++, fiber = fiber.return ?? undefined) {
    const node = fiber.memoizedProps?.node ?? fiber.memoizedProps?.value;
    if (node?.m_element === element && typeof node.BTakeFocus === "function" && typeof node.BHasFocus === "function") return node;
  }
  return undefined;
}
