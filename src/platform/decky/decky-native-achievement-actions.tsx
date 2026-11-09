import { afterPatch, createModuleMapping, type Patch } from "@decky/ui";
import { cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { useDeckyGameOverviewPreferences } from "./decky-game-overview-preferences";
import { createUpNextPinToggleAction } from "./decky-up-next-pin-action";

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
  return Array.from(memoRenderers, (component) => afterPatch(component, "type", ([props], rendered: ReactNode) => {
    const appId = props?.details?.unAppID;
    if (typeof appId !== "number") return rendered;
    return mapNativeChildren(rendered, (node) => Array.isArray(node.props["achievements"])
      && typeof node.props["onRequestPriority"] === "function" ? wrapCarousel(node) : node);
  }));
}
