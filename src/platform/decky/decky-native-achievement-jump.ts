import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { getNativeAchievementListIndex, getNativeAchievementVirtualIndex } from "./decky-native-achievement-jump-model";
import { readNativeRowNavigationNode } from "./decky-native-achievement-navigation-node";
import { buildDeckyNativeSteamAchievementsRoute } from "./decky-game-page-achievement-route";

interface SteamAchievementIdentity {
  readonly strID: string;
}

interface SteamAchievementListProps {
  readonly rgAchieved: readonly SteamAchievementIdentity[];
  readonly rgUnachieved: readonly SteamAchievementIdentity[];
}

interface SteamFiber {
  readonly memoizedProps?: unknown;
  readonly return?: SteamFiber | null;
}

const ROW_SELECTOR = "div[style*='position: absolute']";
let pendingJump: { readonly window: Window; readonly timer: number; readonly generation: number } | undefined;
let generation = 0;

type NativeAchievementJumpSurface = "activity" | "up-next";

let returnFocus: {
  readonly appId: number;
  readonly sourcePath: string;
  readonly surface: NativeAchievementJumpSurface;
  readonly key: string;
  visitedList: boolean;
} | undefined;

function currentNativePath(): string {
  return globalThis.location.pathname.replace(/^\/routes\//u, "/");
}

export function readNativeAchievementJumpReturn(appId: number, surface: NativeAchievementJumpSurface): string | undefined {
  return returnFocus?.visitedList && returnFocus.appId === appId && returnFocus.surface === surface
    && returnFocus.sourcePath === currentNativePath() ? returnFocus.key : undefined;
}

export function restoreNativeAchievementJumpReturn(
  target: HTMLElement | null | undefined,
  appId: number,
  surface: NativeAchievementJumpSurface,
  key: string,
): (() => void) | undefined {
  if (target == null || readNativeAchievementJumpReturn(appId, surface) !== key) return;
  returnFocus = undefined;
  return requestDeckySteamGamepadFocusAfterMount(target, 6);
}

function nativeFiber(element: HTMLElement): SteamFiber | undefined {
  const key = Object.keys(element).find((name) => name.startsWith("__reactFiber$"));
  return key === undefined ? undefined : (element as unknown as Record<string, SteamFiber>)[key];
}

function rowIdentityAndList(row: HTMLElement): { readonly id: string; readonly list?: SteamAchievementListProps } | undefined {
  let fiber = nativeFiber(row);
  let id: string | undefined;
  let list: SteamAchievementListProps | undefined;
  for (let depth = 0; fiber !== undefined && fiber !== null && depth < 16; depth += 1, fiber = fiber.return ?? undefined) {
    const props = fiber.memoizedProps as Record<string, unknown> | undefined;
    const achievement = props?.["achievement"] as (SteamAchievementIdentity & { readonly api_name?: string }) | undefined;
    const rowId = achievement?.strID ?? achievement?.api_name;
    if (id === undefined && typeof rowId === "string") id = rowId;
    if (list === undefined && Array.isArray(props?.["rgAchieved"]) && Array.isArray(props?.["rgUnachieved"])) {
      list = props as unknown as SteamAchievementListProps;
    }
  }
  return id === undefined ? undefined : { id, ...(list !== undefined ? { list } : {}) };
}

/** Read the identity already supplied to Steam's native achievement card. */
export function nativeAchievementId(element: HTMLElement): string | undefined {
  return rowIdentityAndList(element)?.id;
}

function nativeRows(document: Document): readonly HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`${ROW_SELECTOR}, [data-tableindex]`)].filter(row =>
    (row.hasAttribute("data-tableindex") || row.parentElement?.style.position === "relative")
      && rowIdentityAndList(row) !== undefined);
}

interface SteamAchievementVirtualizer {
  readonly options?: { readonly count?: number; getItemKey?(index: number): unknown };
  scrollToIndex?(index: number, options: { readonly align: "center" }): void;
}

function readNativeVirtualizers(rows: readonly HTMLElement[]): readonly SteamAchievementVirtualizer[] {
  const virtualizers = new Set<SteamAchievementVirtualizer>();
  for (const row of rows) {
    for (let fiber: SteamFiber | null | undefined = nativeFiber(row); fiber != null; fiber = fiber.return) {
      const virtualizer = (fiber.memoizedProps as { virtualizer?: SteamAchievementVirtualizer } | undefined)?.virtualizer;
      if (typeof virtualizer?.options?.getItemKey === "function" && typeof virtualizer.scrollToIndex === "function") {
        virtualizers.add(virtualizer);
        break;
      }
    }
  }
  return Array.from(virtualizers);
}

export function cancelNativeAchievementJump(): void {
  returnFocus = undefined;
  generation += 1;
  if (pendingJump !== undefined) pendingJump.window.clearTimeout(pendingJump.timer);
  pendingJump = undefined;
}

/** Focus an achievement inside Steam's virtualized Your Stuff achievement list. */
export function focusNativeAchievementAfterNavigation(
  document: Document,
  appId: number,
  achievementId: string,
  surface: NativeAchievementJumpSurface,
  originKey: string,
): void {
  cancelNativeAchievementJump();
  const ownerWindow = document.defaultView;
  if (ownerWindow === null) return;
  const currentGeneration = generation;
  const route = buildDeckyNativeSteamAchievementsRoute(appId);
  const origin = { appId, sourcePath: currentNativePath(), surface, key: originKey, visitedList: false };
  returnFocus = origin;
  let scrollRequest: { readonly virtualizer: SteamAchievementVirtualizer; readonly index: number } | undefined;
  const targetId = `ra:${achievementId}`;
  let attempts = 0;
  let scrolled = false;

  const attempt = (): void => {
    if (generation !== currentGeneration) return;
    attempts += 1;
    const pathname = currentNativePath();
    if (pathname === route) origin.visitedList = true;
    if (pathname !== route && (origin.visitedList || pathname !== origin.sourcePath || attempts >= 50)) {
      pendingJump = undefined;
      if (pathname !== origin.sourcePath && returnFocus === origin) returnFocus = undefined;
      return;
    }
    const rows = pathname === route ? nativeRows(document) : [];
    const target = rows.find((row) => rowIdentityAndList(row)?.id === targetId);
    if (target !== undefined) {
      target.scrollIntoView({ block: "center" });
      const node = readNativeRowNavigationNode(target);
      const focus = node === undefined ? target.querySelector<HTMLElement>(".Focusable") ?? target : target;
      requestDeckySteamGamepadFocusAfterMount(focus, 6);
      pendingJump = undefined;
      return;
    }
    for (const virtualizer of readNativeVirtualizers(rows)) {
      const options = virtualizer.options;
      if (options === undefined || options.count === undefined || options.getItemKey === undefined) continue;
      const index = getNativeAchievementVirtualIndex(options.count, position => options.getItemKey?.(position), achievementId);
      if (index === undefined) continue;
      if (scrollRequest?.virtualizer !== virtualizer || scrollRequest.index !== index) {
        virtualizer.scrollToIndex?.(index, { align: "center" });
        scrollRequest = { virtualizer, index };
      }
      break;
    }
    const first = rows[0];
    const list = first === undefined ? undefined : rowIdentityAndList(first)?.list;
    const wrapper = first?.parentElement;
    const scroller = wrapper?.parentElement?.parentElement;
    if (list !== undefined && wrapper !== undefined && wrapper !== null && scroller !== undefined && scroller !== null && !scrolled) {
      const index = getNativeAchievementListIndex(list.rgAchieved, list.rgUnachieved, achievementId);
      if (index === undefined) { pendingJump = undefined; return; }
      const count = list.rgAchieved.length + list.rgUnachieved.length + (list.rgUnachieved.length > 0 ? 1 : 0);
      const estimatedCenter = wrapper.clientHeight * (index + 0.5) / Math.max(1, count);
      scroller.scrollTop = Math.max(0, estimatedCenter - scroller.clientHeight / 2);
      scrolled = true;
    }
    if (attempts >= 50) { pendingJump = undefined; return; }
    pendingJump = { window: ownerWindow, timer: ownerWindow.setTimeout(attempt, 100), generation: currentGeneration };
  };
  pendingJump = { window: ownerWindow, timer: ownerWindow.setTimeout(attempt, 100), generation: currentGeneration };
}
