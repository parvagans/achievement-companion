import { afterPatch, findModuleExport, type Patch } from "@decky/ui";
import { cloneElement, isValidElement, useMemo, useSyncExternalStore, type ReactElement } from "react";
import { pinAchievement, readPinnedAchievement, unpinAchievement, useDeckyGameOverviewPreferences } from "./decky-game-overview-preferences";
import type { NativeAchievementPinTarget, NativeAchievementRow } from "./decky-native-achievement-actions";
import { nativeRaPinSetter } from "./decky-native-achievement-navigation-node";
import type { NativeRetroAchievementsProjection } from "./decky-native-retroachievements-projection";

const MY_ACHIEVEMENTS_PATH = "/library/app/:appid/achievements/my";
const EMPTY_PINS: readonly string[] = [];
type Element = ReactElement<Record<string, unknown>>;

interface PinningOptions {
  isShortcut(appId: number): boolean;
  readAccountRevision(): number;
  readProjection(appId: number, viewer: string): NativeRetroAchievementsProjection | undefined;
  resolveTarget(appId: number, row: NativeAchievementRow): NativeAchievementPinTarget | undefined;
  subscribe(listener: () => void): () => void;
}

function isReactRouterRoute(value: unknown): value is { prototype: { render(): unknown } } {
  if (typeof value !== "function" || typeof value.prototype?.render !== "function") return false;
  const source = String(value.prototype.render);
  return source.includes("computedMatch") && source.includes(".Consumer") && source.includes(".Provider");
}

export function installNativeRaAchievementPinning(options: PinningOptions): Patch | undefined {
  const route = findModuleExport(isReactRouterRoute);
  if (!isReactRouterRoute(route)) return undefined;

  function RaPinPanel({ panel, appId, viewer }: { panel: Element; appId: number; viewer: string }): ReactElement {
    const readProjection = () => options.readProjection(appId, viewer);
    const projection = useSyncExternalStore(options.subscribe, readProjection, readProjection);
    const { pinnedAchievement } = useDeckyGameOverviewPreferences("retroachievements", projection?.raGameId ?? "");
    const pinnedId = pinnedAchievement?.achievementId;
    const accountRevision = options.readAccountRevision();
    const pinnedNames = useMemo(() => {
      if (pinnedId === undefined || projection === undefined) return EMPTY_PINS;
      const apiName = "ra:" + pinnedId;
      return options.resolveTarget(appId, { strID: apiName, bAchieved: false }) === undefined ? EMPTY_PINS : [apiName];
    }, [accountRevision, appId, pinnedId, projection]);

    if (projection === undefined) return panel;

    const expectedPin = pinnedNames[0];
    const owner = expectedPin === undefined ? undefined : options.resolveTarget(appId, { strID: expectedPin, bAchieved: false });
    const setPinnedAchievements = Object.assign((names: readonly string[]) => {
      if (options.readAccountRevision() !== accountRevision || readProjection() !== projection || !Array.isArray(names)) return;
      if (names.length === 0) {
        if (owner !== undefined) unpinAchievement(owner, owner.achievementId);
        return;
      }
      // Steam appends the newest pin. Up Next keeps one active target per game.
      const requested = names.at(-1);
      if (typeof requested !== "string" || requested === expectedPin) return;
      const target = options.resolveTarget(appId, { strID: requested, bAchieved: false });
      if (target?.providerId === "retroachievements"
        && readPinnedAchievement(target)?.achievementId === pinnedId) {
        pinAchievement(target, target.achievementId, target.mode);
      }
    }, { [nativeRaPinSetter]: true });
    return cloneElement(panel, { pinnedAchievements: pinnedNames, setPinnedAchievements });
  }

  return afterPatch(route.prototype, "render", function (this: { props?: { path?: unknown } }, _args, consumer: unknown) {
    if (this.props?.path !== MY_ACHIEVEMENTS_PATH || !isValidElement<Record<string, unknown>>(consumer)) return consumer;
    const renderRoute = consumer.props["children"];
    if (typeof renderRoute !== "function") return consumer;

    return cloneElement(consumer, { children: (context: unknown) => {
      const provider: unknown = renderRoute(context);
      if (!isValidElement<Record<string, unknown>>(provider)) return provider;
      const panel = provider.props["children"];
      if (!isValidElement<Record<string, unknown>>(panel)) return provider;
      const { appid, targetsteamid, setPinnedAchievements, setShowPinning } = panel.props;
      if (typeof appid !== "number" || typeof targetsteamid !== "string" || typeof setPinnedAchievements !== "function"
        || typeof setShowPinning !== "function" || !options.isShortcut(appid)) return provider;

      return cloneElement(provider, { children: <RaPinPanel panel={panel} appId={appid} viewer={targetsteamid} /> });
    } });
  });
}
