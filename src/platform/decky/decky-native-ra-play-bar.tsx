import { afterPatch, createModuleMapping, findModuleExport, Navigation, type Patch } from "@decky/ui";
import { cloneElement, isValidElement, useLayoutEffect, useRef, type ComponentType, type HTMLAttributes, type ReactNode, type RefAttributes } from "react";
import { mapNativeChildren } from "./decky-native-achievement-actions";
import { buildDeckyNativeSteamAchievementsRoute } from "./decky-game-page-achievement-route";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";

interface PlayBarProps {
  readonly overview?: { readonly appid?: number };
  readonly details?: { readonly unAppID?: number };
}

interface NativePlayBar {
  render(props: PlayBarProps, ref: unknown): ReactNode;
}

interface GamepadPlayBarStyles {
  readonly ActionButtonAndStatusPanel: string;
  readonly AppButtons: string;
}

interface NativeMenuStyles {
  readonly MenuButton: string;
  readonly MiniAchievements: string;
  readonly ControllerConfigButton: string;
}

interface NativeButtonProps extends HTMLAttributes<HTMLDivElement> {
  readonly focusable: boolean;
  readonly onActivate: () => void;
  readonly onOKActionDescription: string;
}

const SLOT_KEY = "achievement-companion-native-play-bar-achievements";

export function isNativeRaPlayBarRenderer(value: unknown): value is NativePlayBar {
  if (typeof value !== "object" || value === null) return false;
  const render = Object.getOwnPropertyDescriptor(value, "render");
  if (render?.writable !== true || typeof render.value !== "function") return false;
  const source = String(render.value);
  return source.includes(".ActionRow") && source.includes(".ActionButtonAndStatusPanel") && source.includes(".AppButtons");
}

function isGamepadPlayBarStyles(value: unknown): value is GamepadPlayBarStyles {
  if (typeof value !== "object" || value === null) return false;
  const styles = value as Partial<GamepadPlayBarStyles>;
  return typeof styles.ActionButtonAndStatusPanel === "string" && typeof styles.AppButtons === "string";
}

function isNativeMenuStyles(value: unknown): value is NativeMenuStyles {
  if (typeof value !== "object" || value === null) return false;
  const styles = value as Partial<NativeMenuStyles>;
  return typeof styles.MenuButton === "string" && typeof styles.MiniAchievements === "string"
    && typeof styles.ControllerConfigButton === "string";
}

/** Patch Gaming Mode's mounted action row. Leave its Play and management controls in place. */
export function installNativeRaPlayBarAchievementAction(playBar: unknown, isEligible: (appId: number) => boolean): Patch | undefined {
  if (!isNativeRaPlayBarRenderer(playBar)) return undefined;
  const rowStyles = createModuleMapping(isGamepadPlayBarStyles).values().next().value;
  const menuStyles = createModuleMapping(isNativeMenuStyles).values().next().value;
  const OverlayAchievements = findModuleExport((value, name) => name === "OverlayAchievements"
    && typeof value === "function") as ComponentType | undefined;
  if (!isGamepadPlayBarStyles(rowStyles) || !isNativeMenuStyles(menuStyles) || OverlayAchievements === undefined) return undefined;

  const NativeIcon = OverlayAchievements;
  const { MenuButton, MiniAchievements } = menuStyles;
  let activatedFrom: { readonly appId: number; readonly pathname: string } | undefined;

  function PlayBarAchievementButton({ appId, NativeButton }: {
    readonly appId: number;
    readonly NativeButton: ComponentType<NativeButtonProps & RefAttributes<HTMLDivElement>>;
  }) {
    const buttonRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
      if (activatedFrom?.appId !== appId || activatedFrom.pathname !== globalThis.location?.pathname) return;
      activatedFrom = undefined;
      return requestDeckySteamGamepadFocusAfterMount(buttonRef.current, 6);
    }, [appId]);

    const openAchievements = (): void => {
      if (!isEligible(appId)) return;
      const pathname = globalThis.location?.pathname;
      activatedFrom = pathname === undefined ? undefined : { appId, pathname };
      Navigation.Navigate(buildDeckyNativeSteamAchievementsRoute(appId));
    };
    return (
      <NativeButton ref={buttonRef} className={MenuButton} role="button" aria-label="Achievements" focusable
        onOKActionDescription="View My Achievements" onActivate={openAchievements} onClick={openAchievements}>
        <NativeIcon />
      </NativeButton>
    );
  }

  return afterPatch(playBar, "render", ([props], rendered: ReactNode) => {
    const appId = props.overview?.appid;
    if (appId === undefined || props.details?.unAppID !== appId || !isEligible(appId)
      || !isValidElement(rendered) || typeof rendered.type === "string" || typeof rendered.type === "symbol") return rendered;
    const NativeButton = rendered.type as ComponentType<NativeButtonProps & RefAttributes<HTMLDivElement>>;

    return mapNativeChildren(rendered, (node) => {
      const className = node.props["className"];
      if (typeof className !== "string" || !className.split(/\s+/u).includes(rowStyles.AppButtons)) return node;
      const nativeChildren = node.props["children"] as ReactNode;
      const children = Array.isArray(nativeChildren) ? nativeChildren : [nativeChildren];
      let alreadyHasAchievements = false;
      mapNativeChildren(children, (child) => {
        const nativeClass = child.props["className"];
        if (String(child.key).endsWith(SLOT_KEY) || child.props["aria-label"] === "Achievements"
          || (typeof nativeClass === "string" && nativeClass.split(/\s+/u).includes(MiniAchievements))) {
          alreadyHasAchievements = true;
        }
        return child;
      });
      if (alreadyHasAchievements) return node;

      return cloneElement(node, { children: [
        <PlayBarAchievementButton key={SLOT_KEY} appId={appId} NativeButton={NativeButton} />,
        ...children,
      ] });
    });
  });
}
