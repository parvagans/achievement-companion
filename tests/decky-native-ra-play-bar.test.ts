import assert from "node:assert/strict";
import test from "node:test";
import { createElement, forwardRef, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadLocalComponent } from "./helpers/render-decky-component";

test("Gaming Mode adds an achievement action to verified RA shortcuts and preserves Steam's actions", () => {
  const actions = loadLocalComponent("src/platform/decky/decky-native-achievement-actions.tsx");
  const rowStyles = { ActionRow: "action-row", ActionButtonAndStatusPanel: "play", AppButtons: "steam-controls" };
  const menuStyles = { MenuButton: "steam-button", MiniAchievements: "steam-achievements", ControllerConfigButton: "steam-controller" };
  const routes: string[] = [];
  const buttons: Record<string, unknown>[] = [];
  let eligible = true;

  interface RowProps {
    overview: { appid: number };
    details: { unAppID: number };
    hasNative?: boolean;
  }
  const NativePanel = (props: Record<string, unknown>) => {
    if (props["focusable"]) buttons.push(props);
    return createElement(props["role"] === "button" ? "button" : "div", {
      className: props["className"], "aria-label": props["aria-label"],
    }, props["children"] as ReactNode);
  };
  const playBar = forwardRef<HTMLElement, RowProps>((props, _ref) => createElement(NativePanel, { className: rowStyles.ActionRow }, [
    createElement("button", { key: "play", className: rowStyles.ActionButtonAndStatusPanel }, "Play"),
    createElement("div", { key: "controls", className: rowStyles.AppButtons }, [
      createElement("button", { key: "manage" }, "Manage"),
      props.hasNative ? createElement("button", { key: "steam", className: menuStyles.MiniAchievements }, "Steam achievements") : null,
    ]),
  ])) as unknown as { render(props: RowProps, ref: null): ReactNode };
  const overlayIcon = () => createElement("span", null, "Steam trophy");
  const { exports } = loadLocalComponent("src/platform/decky/decky-native-ra-play-bar.tsx", {
    "@decky/ui": {
      findModuleExport: (predicate: (value: unknown, name: string) => boolean) =>
        predicate(overlayIcon, "OverlayAchievements") ? overlayIcon : undefined,
      createModuleMapping: (predicate: (value: unknown) => boolean) =>
        new Map([rowStyles, menuStyles].filter(predicate).map((styles, index) => [index, styles])),
      Navigation: { Navigate: (route: string) => routes.push(route) },
      afterPatch: (target: typeof playBar, name: "render", handler: (args: unknown[], native: ReactNode) => ReactNode) => {
        const original = target[name];
        target[name] = (props, ref) => handler([props, ref], original(props, ref));
        return { unpatch: () => { target[name] = original; } };
      },
    },
    "./decky-native-achievement-actions": actions.exports,
    "./decky-steam-gamepad-focus": { requestDeckySteamGamepadFocusAfterMount: () => undefined },
  });

  const render = (appId: number, detailsAppId = appId, hasNative = false) =>
    renderToStaticMarkup(playBar.render({ overview: { appid: appId }, details: { unAppID: detailsAppId }, hasNative }, null));
  const isEligible = (appId: number) => eligible && appId === 77;
  assert.equal(exports.installNativeRaPlayBarAchievementAction({ render: () => null }, isEligible), undefined);
  const patch = exports.installNativeRaPlayBarAchievementAction(playBar, isEligible);
  assert.ok(patch);
  assert.match(render(77), /Play.*aria-label="Achievements".*Steam trophy.*Manage/u);
  assert.doesNotMatch(render(620), /Steam trophy/u);
  assert.doesNotMatch(render(77, 620), /Steam trophy/u);
  assert.match(render(77, 77, true), /Steam achievements/u);
  assert.doesNotMatch(render(77, 77, true), /Steam trophy/u);
  assert.equal(buttons[0]?.["focusable"], true, "Steam must be able to land on the shortcut with the D-pad");
  const activate = buttons[0]?.["onActivate"] as () => void;
  assert.equal(buttons[0]?.["onClick"], activate, "controller and pointer open the same Steam route");
  activate();
  assert.deepEqual(routes, ["/library/app/77/achievements/my/individual"]);
  eligible = false;
  activate();
  assert.equal(routes.length, 1, "stale actions cannot open another game's route");
  eligible = true;
  patch.unpatch();
  assert.doesNotMatch(render(77), /Steam trophy/u);
});
