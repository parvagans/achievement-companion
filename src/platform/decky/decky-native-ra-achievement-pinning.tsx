import { afterPatch, beforePatch, findModuleExport, type Patch } from "@decky/ui";
import { cloneElement, isValidElement, useEffect, useSyncExternalStore, type ReactElement, type ReactNode } from "react";
import { pinAchievement, readPinnedAchievement, unpinAchievement, useSavedPinnedAchievements } from "./decky-game-overview-preferences";
import type { NativeAchievementPinTarget, NativeAchievementRow } from "./decky-native-achievement-actions";
import { nativeRaPinSetter } from "./decky-native-achievement-navigation-node";
import type { NativeRetroAchievementsProjection } from "./decky-native-retroachievements-projection";
import type { NativeRaAchievementSet } from "./decky-native-ra-achievement-sets";

const MY_ACHIEVEMENTS_PATH = "/library/app/:appid/achievements/my";
const EMPTY_SETS: readonly NativeRaAchievementSet[] = [];
type Element = ReactElement<Record<string, unknown>>;

interface PinningOptions {
  isShortcut(appId: number): boolean;
  readAccountRevision(): number;
  readProjection(appId: number, viewer: string): NativeRetroAchievementsProjection | undefined;
  readSubsets?(base: NativeRetroAchievementsProjection): readonly NativeRaAchievementSet[] | undefined;
  onOpen?(base: NativeRetroAchievementsProjection, viewer: string): void;
  resolveTarget(appId: number, row: NativeAchievementRow): NativeAchievementPinTarget | undefined;
  subscribe(listener: () => void): () => void;
}

function isReactRouterRoute(value: unknown): value is { prototype: { render(): unknown } } {
  if (typeof value !== "function" || typeof value.prototype?.render !== "function") return false;
  const source = String(value.prototype.render);
  return source.includes("computedMatch") && source.includes(".Consumer") && source.includes(".Provider");
}

function createNativeRaPinPanel(options: PinningOptions) {
  function RaPinPanel({ panel, appId, viewer }: { panel: Element; appId: number; viewer: string }): ReactElement {
    const readProjection = () => options.readProjection(appId, viewer);
    const projection = useSyncExternalStore(options.subscribe, readProjection, readProjection);
    const { pins } = useSavedPinnedAchievements();
    const readSubsets = () => projection === undefined ? EMPTY_SETS : options.readSubsets?.(projection) ?? EMPTY_SETS;
    const subsets = useSyncExternalStore(options.subscribe, readSubsets, readSubsets);
    const accountRevision = options.readAccountRevision();
    useEffect(() => {
      if (projection !== undefined) options.onOpen?.(projection, viewer);
    }, [projection, viewer]);
    if (projection === undefined) return panel;

    const displayedGameIds = new Set([projection.raGameId, ...subsets.map(set => set.projection.raGameId)]);
    const relevantPins = pins.filter(pin => pin.providerId === "retroachievements" && displayedGameIds.has(pin.gameId));
    const displayedPins = new Map<string, NativeAchievementPinTarget>();
    for (const pin of relevantPins) {
      const apiName = "ra:" + pin.achievementId;
      const target = options.resolveTarget(appId, { strID: apiName, bAchieved: false });
      if (target?.providerId === pin.providerId && target.gameId === pin.gameId && target.accountId === pin.accountId) {
        displayedPins.set(apiName, target);
      }
    }

    const pinnedNames = Array.from(displayedPins.keys());
    const setPinnedAchievements = Object.assign((names: readonly string[]) => {
      if (options.readAccountRevision() !== accountRevision || readProjection() !== projection || readSubsets() !== subsets
        || !Array.isArray(names)) return;

      const added = names.filter(name => !displayedPins.has(name));
      if (added.length === 1 && typeof added[0] === "string") {
        const target = options.resolveTarget(appId, { strID: added[0], bAchieved: false });
        if (target?.providerId !== "retroachievements" || !displayedGameIds.has(target.gameId)) return;
        const expectedPin = relevantPins.find(pin => pin.gameId === target.gameId && pin.accountId === target.accountId);
        if (readPinnedAchievement(target)?.achievementId === expectedPin?.achievementId) {
          pinAchievement(target, target.achievementId, target.mode);
        }
      } else if (added.length === 0) {
        const removed = pinnedNames.filter(name => !names.includes(name));
        const target = removed.length === 1 ? displayedPins.get(removed[0]!) : undefined;
        if (target !== undefined) unpinAchievement(target, target.achievementId);
      }
    }, { [nativeRaPinSetter]: true });
    return cloneElement(panel, { pinnedAchievements: pinnedNames, setPinnedAchievements });
  }

  return (panel: Element): Element => {
    const { appid, targetsteamid, setPinnedAchievements, setShowPinning } = panel.props;
    if (typeof appid !== "number" || typeof targetsteamid !== "string" || typeof setPinnedAchievements !== "function"
      || typeof setShowPinning !== "function" || !options.isShortcut(appid)) return panel;
    return <RaPinPanel panel={panel} appId={appid} viewer={targetsteamid} />;
  };
}

export function installNativeRaAchievementPinning(options: PinningOptions): Patch | undefined {
  const route = findModuleExport(isReactRouterRoute);
  if (!isReactRouterRoute(route)) return undefined;
  const wrapPinPanel = createNativeRaPinPanel(options);

  return afterPatch(route.prototype, "render", function (this: { props?: { path?: unknown } }, _args, consumer: unknown) {
    if (this.props?.path !== MY_ACHIEVEMENTS_PATH || !isValidElement<Record<string, unknown>>(consumer)) return consumer;
    const renderRoute = consumer.props["children"];
    if (typeof renderRoute !== "function") return consumer;

    return cloneElement(consumer, { children: (context: unknown) => {
      const provider: unknown = renderRoute(context);
      if (!isValidElement<Record<string, unknown>>(provider)) return provider;
      const panel = provider.props["children"];
      if (!isValidElement<Record<string, unknown>>(panel)) return provider;
      const wrapped = wrapPinPanel(panel);
      return wrapped === panel ? provider : cloneElement(provider, { children: wrapped });
    } });
  });
}

function isSteamOverlayPage(value: unknown): value is { render: (...args: unknown[]) => unknown } {
  if (typeof value !== "object" || value === null) return false;
  const component = value as { $$typeof?: symbol; render?: unknown };
  if (component.$$typeof !== Symbol.for("react.forward_ref") || typeof component.render !== "function") return false;
  const source = String(component.render);
  return source.includes("padForHeader") && source.includes("padForFooter") && source.includes("contentMaxWidth")
    && source.includes("GamepadPage") && Object.getOwnPropertyDescriptor(component, "render")?.writable === true;
}

/** Steam's in-game page passes the compact achievement panel through its native layout. */
export function installNativeRaOverlayAchievementPinning(options: PinningOptions): Patch | undefined {
  const layout = findModuleExport(isSteamOverlayPage);
  if (!isSteamOverlayPage(layout)) return undefined;
  const wrapPinPanel = createNativeRaPinPanel(options);

  function wrapOverlayPanel(node: ReactNode, depth = 0): ReactNode {
    if (depth > 6 || !isValidElement<Record<string, unknown>>(node)) return node;
    if (node.props["asPanel"] === true && node.props["headerVariant"] === "compact") return wrapPinPanel(node);
    const children = node.props["children"] as ReactNode;
    const wrapped = wrapOverlayPanel(children, depth + 1);
    return children === wrapped ? node : cloneElement(node, { children: wrapped });
  }

  return beforePatch(layout, "render", (args: Record<string, unknown>[]) => {
    const [props] = args;
    if (props?.["padForHeader"] !== false || props["padForFooter"] !== false || props["scrollable"] !== false) return;
    const children = props["children"] as ReactNode;
    const wrapped = wrapOverlayPanel(children);
    if (wrapped !== children) args[0] = { ...props, children: wrapped };
  });
}
