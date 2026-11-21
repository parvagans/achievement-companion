import { afterPatch, createModuleMapping, GamepadButton, type GamepadEvent, type Patch } from "@decky/ui";
import { cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { pinAchievement, readPinnedAchievement, subscribeToPinnedAchievementChanges, unpinAchievement, useDeckyGameOverviewPreferences } from "./decky-game-overview-preferences";
import { createUpNextPinToggleAction } from "./decky-up-next-pin-action";
import { nativeRaPinSetter, readNativeRowNavigationNode } from "./decky-native-achievement-navigation-node";

export interface NativeAchievementRow {
  readonly strID: string;
  readonly bAchieved: boolean;
}

export interface NativeAchievementPinTarget {
  readonly providerId: "steam" | "retroachievements";
  readonly accountId: string;
  readonly gameId: string;
  readonly achievementId: string;
  readonly mode: RetroAchievementsAchievementMode;
}

type ResolvePinTarget = (appId: number, row: NativeAchievementRow) => NativeAchievementPinTarget | undefined;
type NativeElement = ReactElement<Record<string, unknown>>;

function lockedAchievement(row: unknown): row is NativeAchievementRow {
  if (typeof row !== "object" || row === null) return false;
  const candidate = row as Partial<NativeAchievementRow>;
  return candidate.bAchieved === false && typeof candidate.strID === "string" && candidate.strID.length > 0;
}

function NativeAchievementPinControl({ control, target, validate }: {
  readonly control: NativeElement;
  readonly target: NativeAchievementPinTarget;
  readonly validate: () => boolean;
}): ReactElement {
  const preferences = useDeckyGameOverviewPreferences(target.providerId, target.gameId);
  if (!preferences.canPin || control.props["onOptionsButton"] != null || control.props["onOptionsActionDescription"] != null) return control;
  const pinned = preferences.pinnedAchievement?.achievementId === target.achievementId;
  const action = createUpNextPinToggleAction(target.achievementId, pinned, (id) => {
    if (validate()) preferences.togglePinnedAchievement(id, target.mode);
  });
  return cloneElement(control, { onOptionsButton: action.onOptionsButton, onOptionsActionDescription: action.label });
}

function withPinControl(control: NativeElement, resolveTarget: ResolvePinTarget, appId: number, row: NativeAchievementRow): ReactElement {
  const target = resolveTarget(appId, row);
  if (target === undefined) return control;
  return <NativeAchievementPinControl {...(control.key !== null ? { key: control.key } : {})} control={control} target={target} validate={() => {
    const current = resolveTarget(appId, row);
    return current?.providerId === target.providerId && current.accountId === target.accountId
      && current.gameId === target.gameId && current.achievementId === target.achievementId && current.mode === target.mode;
  }} />;
}

/** Map the JSX emitted by Steam without walking fibers or changing the navigation nodes. */
function mapNativeChildren(node: ReactNode, transform: (element: NativeElement) => ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map((child) => mapNativeChildren(child, transform));
  if (!isValidElement<Record<string, unknown>>(node)) return node;
  const transformed = transform(node);
  if (transformed !== node) return transformed;
  const children = node.props["children"] as ReactNode;
  return children === undefined ? node : cloneElement(node, {}, mapNativeChildren(children, transform));
}

type SteamRenderer = (props: Record<string, unknown>) => ReactNode;

/** Keep the wrapped component type stable so Steam retains its focus and scroll state on rerender. */
function wrapNativeRenderer(transform: (rendered: ReactNode, props: Record<string, unknown>) => ReactNode) {
  const wrappers = new WeakMap<SteamRenderer, SteamRenderer>();
  return (node: NativeElement): ReactNode => {
    if (typeof node.type !== "function" || node.type.prototype?.isReactComponent) return node;
    const render = node.type as SteamRenderer;
    let wrapper = wrappers.get(render);
    if (wrapper === undefined) {
      wrapper = (props) => transform(render(props), props);
      wrappers.set(render, wrapper);
    }
    return createElement(wrapper, { ...node.props, ...(node.key !== null ? { key: node.key } : {}) });
  };
}

interface NativeAchievementTab {
  readonly id: string;
  readonly content?: ReactNode;
}

export function createNativeMyAchievementsEnhancer(resolveTarget: ResolvePinTarget) {
  const wrapMyAchievements = wrapNativeRenderer((rendered, props) => {
    const appId = props["appid"];
    if (typeof appId !== "number") return rendered;
    return <>
      {mapNativeChildren(rendered, (node) => {
        const renderAchievement = node.props["fnRenderAchievement"];
        if (!Array.isArray(node.props["rgUnachieved"]) || !Array.isArray(node.props["rgAchieved"]) || typeof renderAchievement !== "function") return node;
        return cloneElement(node, { fnRenderAchievement: (row: unknown) => {
          const control: unknown = renderAchievement(row);
          if (!lockedAchievement(row) || !isValidElement<Record<string, unknown>>(control)) return control;
          // Steam clones the row and supplies its virtualized style after this callback.
          return <NativeMyAchievementRow {...(control.key !== null ? { key: control.key } : {})} control={control} row={row} appId={appId} resolveTarget={resolveTarget} />;
        } });
      })}
      <style>{"[data-ac-native-locked-achievement] > div:first-child > div:first-child img { filter: grayscale(1); }"}</style>
    </>;
  });
  return (tabs: readonly NativeAchievementTab[]): readonly NativeAchievementTab[] => tabs.map((tab) => {
    if (tab.id !== "achievements" || !isValidElement<Record<string, unknown>>(tab.content)) return tab;
    const appId = tab.content.props["appid"];
    if (typeof appId !== "number" || tab.content.props["bPinnedView"] === true || !("accountIDToCompare" in tab.content.props)) return tab;
    return { ...tab, content: wrapMyAchievements(tab.content) };
  });
}

function NativeMyAchievementRow({ control, row, appId, resolveTarget, style }: {
  readonly control: NativeElement;
  readonly row: NativeAchievementRow;
  readonly appId: number;
  readonly resolveTarget: ResolvePinTarget;
  readonly style?: unknown;
}): ReactElement {
  return withPinControl(cloneElement(control, { style, "data-ac-native-locked-achievement": true }), resolveTarget, appId, row);
}

export function installNativeYourStuffAchievementActions(resolveTarget: ResolvePinTarget): Patch[] {
  const wrapTile = wrapNativeRenderer((rendered, props) => {
    const appId = props["appid"];
    const row = props["achievement"];
    return typeof appId === "number" && lockedAchievement(row)
      && isValidElement<Record<string, unknown>>(rendered) && rendered.props["focusable"] === true
      ? withPinControl(rendered, resolveTarget, appId, row) : rendered;
  });
  const wrapCarousel = wrapNativeRenderer((rendered) => mapNativeChildren(rendered, (node) =>
    typeof node.props["onFocus"] === "function" && typeof node.props["detailed"] === "boolean" && lockedAchievement(node.props["achievement"])
      ? wrapTile(node) : node));

  // The native achievement section, hover tile and remainder action share this module.
  const modules = createModuleMapping((module: unknown) => typeof module === "object" && module !== null
    && Object.values(module).some((value) => typeof value === "function" && String(value).includes(".RemainderContainer") && String(value).includes("nRemaining")));
  const memoRenderers = new Set<{ type: SteamRenderer }>();
  modules.forEach((module) => {
    for (const value of Object.values(module as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null) continue;
      const candidate = value as { type?: SteamRenderer };
      if (typeof candidate.type === "function") memoRenderers.add(candidate as { type: SteamRenderer });
    }
  });
  const patches: Patch[] = [];
  for (const component of Array.from(memoRenderers)) {
    if (Object.getOwnPropertyDescriptor(component, "type")?.writable !== true) continue;
    patches.push(afterPatch(component, "type", ([props], rendered: ReactNode) => {
      const appId = props?.details?.unAppID;
      if (typeof appId !== "number") return rendered;
      return mapNativeChildren(rendered, (node) => Array.isArray(node.props["achievements"])
        && typeof node.props["onRequestPriority"] === "function" ? wrapCarousel(node) : node);
    }));
  }
  return patches;
}

interface NavigationProperties {
  readonly actionDescriptionMap?: Readonly<Record<number, { readonly value: string }>>;
}

interface NavigationNode {
  readonly m_Properties?: NavigationProperties;
  SetProperties(properties: NavigationProperties): void;
  GetActiveActionDescriptions(): Readonly<Record<number, unknown>>;
}

interface SteamAchievementFiber {
  readonly memoizedProps?: {
    readonly appid?: unknown;
    readonly achievement?: { readonly api_name?: unknown };
    readonly unlocked?: boolean;
    readonly unlockedForSelf?: boolean;
    readonly setPinnedAchievements?: { readonly [nativeRaPinSetter]?: true };
    readonly progress?: { readonly unlocked?: boolean };
  };
  readonly return?: SteamAchievementFiber | null;
}

/** Current Steam rows are plain functions, with no memo or Tabs.type to patch. */
export function observeNativeQueryAchievementActions(document: Document, getAppId: () => number | undefined, resolveTarget: ResolvePinTarget): () => void {
  const owner = document.defaultView;
  if (owner === null) return () => undefined;
  const button = GamepadButton.OPTIONS;
  let frame: number | undefined;
  let installed: { node: NavigationNode; target: NativeAchievementPinTarget; previous: NavigationProperties; next: NavigationProperties } | undefined;

  function focusedTarget() {
    const appId = getAppId();
    const focus = document.querySelector<HTMLElement>(".gpfocus") ?? document.activeElement?.closest<HTMLElement>("[data-tableindex]");
    if (appId === undefined || focus == null) return undefined;
    const focusNode = readNativeRowNavigationNode(focus);
    if (focusNode?.BHasFocus() !== true) return undefined;
    const node = focusNode as typeof focusNode & NavigationNode;
    if (typeof node.SetProperties !== "function" || typeof node.GetActiveActionDescriptions !== "function") return undefined;
    const fiberKey = Object.keys(focus).find(key => key.startsWith("__reactFiber$"));
    if (fiberKey === undefined) return undefined;
    let fiber: SteamAchievementFiber | null | undefined = (focus as unknown as Record<string, SteamAchievementFiber>)[fiberKey];
    for (let depth = 0; fiber != null && depth < 16; depth++, fiber = fiber.return) {
      const props = fiber.memoizedProps;
      const id = props?.achievement?.api_name;
      const locked = props?.unlocked === false || (props?.unlockedForSelf === false && props.progress?.unlocked === false);
      if (props?.appid !== appId || typeof id !== "string" || !locked) continue;
      const target = resolveTarget(appId, { strID: id, bAchieved: false });
      if (target === undefined) continue;
      // The current All Achievements panel supplies Steam's X action and pinning toggle.
      for (let panel = fiber.return, ancestors = 0; panel != null && ancestors < 36; panel = panel.return, ancestors++) {
        if (panel.memoizedProps?.setPinnedAchievements?.[nativeRaPinSetter] === true) return undefined;
      }
      return { node, target };
    }
    return undefined;
  }

  function clear() {
    const current = installed;
    installed = undefined;
    if (current !== undefined && current.node.m_Properties === current.next) current.node.SetProperties(current.previous);
  }

  function sync() {
    frame = undefined;
    clear();
    const focused = focusedTarget();
    const previous = focused?.node.m_Properties;
    if (focused === undefined || previous === undefined || focused.node.GetActiveActionDescriptions()?.[button] != null) return;
    const description = readPinnedAchievement(focused.target)?.achievementId === focused.target.achievementId ? "Unpin" : "Pin";
    const next = { ...previous, actionDescriptionMap: { ...previous.actionDescriptionMap, [button]: { value: description } } };
    focused.node.SetProperties(next);
    installed = { node: focused.node, target: focused.target, previous, next };
  }

  function schedule() {
    if (owner !== null && frame === undefined) frame = owner.requestAnimationFrame(sync);
  }

  function onButton(event: Event) {
    const press = event as GamepadEvent;
    if (press.defaultPrevented || press.detail?.button !== button || installed === undefined) return;
    const focused = focusedTarget();
    if (focused?.node !== installed.node || focused.node.m_Properties !== installed.next) return;
    const { target } = focused;
    const previous = installed.target;
    if (target.providerId !== previous.providerId || target.accountId !== previous.accountId || target.gameId !== previous.gameId
      || target.achievementId !== previous.achievementId || target.mode !== previous.mode) return;
    const pinned = readPinnedAchievement(target)?.achievementId === target.achievementId;
    createUpNextPinToggleAction(target.achievementId, pinned, id => {
      if (pinned) unpinAchievement(target, id);
      else pinAchievement(target, id, target.mode);
    }).onOptionsButton(press);
  }

  document.addEventListener("focusin", schedule, true);
  document.addEventListener("vgp_onfocus", schedule, true);
  owner.addEventListener("vgp_onbuttondown", onButton, true);
  const unsubscribe = subscribeToPinnedAchievementChanges(schedule);
  schedule();
  return () => {
    document.removeEventListener("focusin", schedule, true);
    document.removeEventListener("vgp_onfocus", schedule, true);
    owner.removeEventListener("vgp_onbuttondown", onButton, true);
    unsubscribe();
    if (frame !== undefined) owner.cancelAnimationFrame(frame);
    clear();
  };
}
