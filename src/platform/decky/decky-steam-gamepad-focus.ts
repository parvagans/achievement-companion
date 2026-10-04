import { readDeckyGamepadNavigationTrees } from "./decky-gamepad-navigation";

interface DeckyNavigationContext {
  readonly BIsActive?: () => boolean;
  readonly SetActive?: (active: boolean, ownerWindow: Window | undefined) => void;
}

interface DeckyNavigationTree {
  readonly Activate?: (takeFocus?: boolean) => void;
  readonly BIsActive?: () => boolean;
  readonly m_context?: DeckyNavigationContext;
  readonly m_window?: Window;
}

interface DeckyNavigationNode {
  readonly BTakeFocus?: () => boolean | undefined;
  readonly Element?: unknown;
  readonly Root?: unknown;
  readonly children?: readonly unknown[];
  readonly m_Children?: readonly unknown[];
  readonly m_Root?: unknown;
  readonly m_element?: unknown;
  readonly m_rgChildren?: readonly unknown[];
  readonly m_Tree?: DeckyNavigationTree;
}

const CHILD_KEYS = ["m_rgChildren", "m_Children", "children"] as const;
const ROOT_KEYS = ["m_Root", "Root"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function findNavigationNode(
  current: unknown,
  target: HTMLElement,
  visited: Set<object>,
): DeckyNavigationNode | undefined {
  if (!isRecord(current) || visited.has(current)) {
    return undefined;
  }

  visited.add(current);
  const node = current as DeckyNavigationNode;
  if ((node.m_element ?? node.Element) === target && typeof node.BTakeFocus === "function") {
    return node;
  }

  for (const key of CHILD_KEYS) {
    const children = node[key];
    if (!Array.isArray(children)) {
      continue;
    }

    for (const child of children) {
      const match = findNavigationNode(child, target, visited);
      if (match !== undefined) {
        return match;
      }
    }
  }

  return undefined;
}

/**
 * Give a Steam-owned focus node controller focus through GamepadUI itself.
 * Callers schedule this once after their target has mounted; this helper does
 * not retry and never falls back to DOM focus.
 */
export function takeDeckySteamGamepadFocus(target: HTMLElement | null | undefined): boolean {
  if (target === null || target === undefined || !target.isConnected) {
    return false;
  }

  const trees = readDeckyGamepadNavigationTrees();
  if (!Array.isArray(trees)) {
    return false;
  }

  const visited = new Set<object>();
  for (const tree of trees) {
    if (!isRecord(tree)) {
      continue;
    }

    for (const key of ROOT_KEYS) {
      const node = findNavigationNode(tree[key], target, visited);
      if (node !== undefined) {
        const owningTree = node.m_Tree;
        if (owningTree?.m_context?.BIsActive?.() === false) {
          owningTree.m_context.SetActive?.(true, owningTree.m_window);
        }
        if (owningTree?.BIsActive?.() === false) {
          owningTree.Activate?.(true);
        }
        return node.BTakeFocus?.() === true;
      }
    }
  }

  return false;
}

/**
 * Wait at most three render frames for GamepadUI to register a newly mounted
 * Steam-owned focus target. Each attempt uses the native navigation node and
 * stops as soon as GamepadUI accepts focus.
 */
export function requestDeckySteamGamepadFocusAfterMount(
  target: HTMLElement | null | undefined,
): () => void {
  const ownerWindow = target?.ownerDocument.defaultView;
  if (target === null || target === undefined || ownerWindow === null || ownerWindow === undefined) {
    return () => undefined;
  }

  let cancelled = false;
  let frame: number | undefined;
  let attempts = 0;
  const requestFocus = (): void => {
    frame = ownerWindow.requestAnimationFrame(() => {
      frame = undefined;
      if (cancelled) {
        return;
      }
      attempts += 1;
      if (!takeDeckySteamGamepadFocus(target) && attempts < 3) {
        requestFocus();
      }
    });
  };
  requestFocus();

  return () => {
    cancelled = true;
    if (frame !== undefined) {
      ownerWindow.cancelAnimationFrame(frame);
    }
  };
}
