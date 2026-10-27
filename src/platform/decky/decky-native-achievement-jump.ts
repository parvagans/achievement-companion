import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { getNativeAchievementListIndex } from "./decky-native-achievement-jump-model";

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
    const achievement = props?.["achievement"] as SteamAchievementIdentity | undefined;
    if (id === undefined && typeof achievement?.strID === "string") id = achievement.strID;
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
  return [...document.querySelectorAll<HTMLElement>(ROW_SELECTOR)].filter((row) =>
    row.parentElement?.style.position === "relative" && rowIdentityAndList(row) !== undefined,
  );
}

export function cancelNativeAchievementJump(): void {
  generation += 1;
  if (pendingJump !== undefined) pendingJump.window.clearTimeout(pendingJump.timer);
  pendingJump = undefined;
}

/** Focus an achievement inside Steam's virtualized Your Stuff achievement list. */
export function focusNativeAchievementAfterNavigation(document: Document, achievementId: string): void {
  cancelNativeAchievementJump();
  const ownerWindow = document.defaultView;
  if (ownerWindow === null) return;
  const currentGeneration = generation;
  const targetId = `ra:${achievementId}`;
  let attempts = 0;
  let scrolled = false;

  const attempt = (): void => {
    if (generation !== currentGeneration) return;
    attempts += 1;
    const rows = nativeRows(document);
    const target = rows.find((row) => rowIdentityAndList(row)?.id === targetId);
    if (target !== undefined) {
      target.scrollIntoView({ block: "center" });
      requestDeckySteamGamepadFocusAfterMount(target.querySelector<HTMLElement>(".Focusable") ?? target, 6);
      pendingJump = undefined;
      return;
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
