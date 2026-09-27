import type { DeckyCompactNavigationDestination } from "./decky-compact-navigation";

interface DeckyNavigationNode {
  readonly BTakeFocus?: () => boolean | undefined;
  readonly Element?: unknown;
  readonly Root?: unknown;
  readonly children?: readonly unknown[];
  readonly m_Children?: readonly unknown[];
  readonly m_Root?: unknown;
  readonly m_element?: unknown;
  readonly m_rgChildren?: readonly unknown[];
}

export interface DeckyProviderInitialFocusNavigation {
  readonly getNavigationTrees: () => unknown;
}

export interface DeckyProviderInitialFocusRequestResult {
  readonly status: "focused" | "missing-target" | "node-not-found" | "focus-rejected";
}

export interface DeckyProviderInitialFocusAttempt {
  readonly cancel: () => void;
  readonly getState: () => "idle" | "pending" | "complete" | "exhausted";
  readonly start: (target: HTMLElement | null) => void;
}

export interface DeckyProviderInitialFocusAttemptDependencies {
  readonly cancelAnimationFrame: (handle: number) => void;
  readonly requestAnimationFrame: (callback: FrameRequestCallback) => number;
  readonly requestFocus: (target: HTMLElement | null) => DeckyProviderInitialFocusRequestResult;
}

export const DECKY_PROVIDER_INITIAL_FOCUS_MAX_ATTEMPTS = 3;

const navigationChildKeys = ["m_rgChildren", "m_Children", "children"] as const;
const navigationRootKeys = ["m_Root", "Root"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNodeElement(node: DeckyNavigationNode): unknown {
  return node.m_element ?? node.Element;
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
  if (getNodeElement(node) === target && typeof node.BTakeFocus === "function") {
    return node;
  }

  for (const key of navigationChildKeys) {
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

function findFocusableNavigationNode(navigationTrees: unknown, target: HTMLElement): DeckyNavigationNode | undefined {
  if (!Array.isArray(navigationTrees)) {
    return undefined;
  }

  const visited = new Set<object>();
  for (const navigationTree of navigationTrees) {
    if (!isRecord(navigationTree)) {
      continue;
    }

    for (const key of navigationRootKeys) {
      const match = findNavigationNode(navigationTree[key], target, visited);
      if (match !== undefined) {
        return match;
      }
    }
  }

  return undefined;
}

function logProviderFocus(event: string, detail?: Readonly<Record<string, string>>): void {
  if ((globalThis as { __achievementCompanionProviderFocusDebug?: boolean }).__achievementCompanionProviderFocusDebug) {
    console.debug(`[Achievement Companion][provider-focus] ${event}`, detail);
  }
}

export function shouldRequestDeckyProviderInitialFocus(
  destination: DeckyCompactNavigationDestination,
): boolean {
  return destination.kind === "provider-chooser";
}

/**
 * Decky's active-plugin Focusable owns the title Back button and plugin content
 * as sibling children. A plugin-local preferred child cannot select across that
 * boundary, so this deliberately takes focus through the matching native node.
 */
export function requestDeckyProviderInitialFocus(
  target: HTMLElement | null,
  navigation: DeckyProviderInitialFocusNavigation,
): DeckyProviderInitialFocusRequestResult {
  if (target === null) {
    logProviderFocus("skipped", { reason: "missing-target" });
    return { status: "missing-target" };
  }

  const navigationNode = findFocusableNavigationNode(navigation.getNavigationTrees(), target);
  if (navigationNode === undefined) {
    logProviderFocus("node-not-found");
    return { status: "node-not-found" };
  }

  logProviderFocus("node-found");
  const result = navigationNode.BTakeFocus?.();
  logProviderFocus(`BTakeFocus result=${String(result)}`);
  return result === true ? { status: "focused" } : { status: "focus-rejected" };
}

export function createDeckyProviderInitialFocusAttempt(
  dependencies: DeckyProviderInitialFocusAttemptDependencies,
): DeckyProviderInitialFocusAttempt {
  let state: ReturnType<DeckyProviderInitialFocusAttempt["getState"]> = "idle";
  let target: HTMLElement | null = null;
  let frameHandle: number | undefined;
  let attempts = 0;

  const scheduleAttempt = (): void => {
    frameHandle = dependencies.requestAnimationFrame(() => {
      frameHandle = undefined;
      if (state !== "pending") {
        return;
      }

      attempts += 1;
      logProviderFocus(`frame attempt=${attempts}`);
      const result = dependencies.requestFocus(target);
      if (result.status === "focused") {
        state = "complete";
        logProviderFocus("complete");
        return;
      }

      if (attempts >= DECKY_PROVIDER_INITIAL_FOCUS_MAX_ATTEMPTS) {
        state = "exhausted";
        logProviderFocus(`exhausted attempts=${attempts}`);
        return;
      }

      scheduleAttempt();
    });
  };

  return {
    cancel() {
      if (frameHandle !== undefined) {
        dependencies.cancelAnimationFrame(frameHandle);
        frameHandle = undefined;
      }

      if (state === "pending") {
        state = "idle";
      }
    },
    getState: () => state,
    start(nextTarget) {
      if (state !== "idle" || nextTarget === null) {
        return;
      }

      target = nextTarget;
      attempts = 0;
      state = "pending";
      logProviderFocus("entry-requested");
      logProviderFocus("pending");
      logProviderFocus("ref-attached");
      scheduleAttempt();
    },
  };
}
