import assert from "node:assert/strict";
import test from "node:test";
import { cloneElement, createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadLocalComponent } from "./helpers/render-decky-component";
import { nativeRaPinSetter } from "../src/platform/decky/decky-native-achievement-navigation-node";

const locked = { strID: "ra:12", bAchieved: false };
const earned = { strID: "ra:13", bAchieved: true };
const style = { position: "absolute", top: 96 };

function fixture() {
  const controls: Record<string, any>[] = [];
  const toggles: unknown[][] = [];
  let pinned = false;
  let accountId = "first";
  const resolveTarget = (appId: number, row: typeof locked) => appId === 1 && row === locked ? {
    accountId, providerId: "retroachievements", gameId: "42", achievementId: "12", mode: "hardcore",
  } : undefined;
  const activate = () => {};
  function Control(props: Record<string, any>) {
    controls.push(props);
    return createElement("div", null, props.achievement.strID);
  }
  function Tile({ achievement, onFocus }: Record<string, any>) {
    return createElement(Control, { achievement, onFocus, onActivate: activate, focusable: true });
  }
  function Rail({ achievements, appid }: Record<string, any>) {
    return createElement("div", null, achievements.map((achievement: typeof locked) => createElement(Tile, {
      achievement, appid, detailed: false, onFocus: () => {}, key: achievement.strID,
    })));
  }
  const section = { type: () => createElement(Rail, { achievements: [locked, earned], appid: 1, onRequestPriority: () => {} }) };
  const harness = loadLocalComponent("src/platform/decky/decky-native-achievement-actions.tsx", {
    "@decky/ui": {
      GamepadButton: { OPTIONS: 4 },
      createModuleMapping: (matches: (module: unknown) => boolean) => {
        const remainder = Object.assign(() => {}, { toString: () => "function({nRemaining}){return css().RemainderContainer}" });
        const candidate = { section, remainder };
        return new Map(matches(candidate) ? [["native", candidate]] : []);
      },
      afterPatch: (component: typeof section, key: "type", handler: (args: unknown[], result: ReactElement) => ReactElement) => {
        const original = component[key];
        component[key] = (...args: unknown[]) => handler(args, original());
        return { unpatch: () => { component[key] = original; } };
      },
    },
    "./decky-game-overview-preferences": {
      useDeckyGameOverviewPreferences: (provider: string, gameId: string) => ({
        canPin: true, pinnedAchievement: pinned ? { achievementId: "12" } : undefined,
        togglePinnedAchievement: (id: string, mode: string) => { toggles.push([provider, gameId, id, mode]); pinned = !pinned; },
      }),
    },
  });
  return { ...harness.exports, controls, toggles, activate, resolveTarget, Control, section, switchAccount: () => { accountId = "second"; } };
}

function pressY(control: Record<string, any>, is_repeat = false): void {
  control.onOptionsButton({ detail: { is_repeat }, preventDefault() {}, stopPropagation() {} });
}

test("My Achievements grays only locked artwork and adds Y without changing native row positioning", () => {
  const f = fixture();
  function List({ fnRenderAchievement }: { fnRenderAchievement: (row: typeof locked) => ReactElement }) {
    return createElement("div", null, [locked, earned].map((row) => cloneElement(fnRenderAchievement(row), { key: row.strID, style })));
  }
  const page = () => createElement(List, {
    rgUnachieved: [locked], rgAchieved: [earned], fnRenderAchievement: (achievement: typeof locked) => createElement(f.Control, { achievement, onActivate: f.activate }),
  } as React.ComponentProps<typeof List>);
  const content = createElement(page, { appid: 1, accountIDToCompare: 0 } as Record<string, unknown>);
  const global = { id: "global", content };
  const enhance = f.createNativeMyAchievementsEnhancer(f.resolveTarget);
  const tabs = enhance([{ id: "achievements", content }, global]);
  assert.equal(tabs[1], global);
  assert.match(renderToStaticMarkup(tabs[0].content), /filter: grayscale\(1\)/u);
  assert.equal(f.controls[0]?.["data-ac-native-locked-achievement"], true);
  assert.equal(f.controls[0]?.style, style);
  assert.equal(f.controls[0]?.onActivate, f.activate);
  assert.equal(f.controls[0]?.onOptionsActionDescription, "Pin");
  assert.equal(f.controls[1]?.["data-ac-native-locked-achievement"], undefined);
  assert.equal(f.controls[1]?.onOptionsButton, undefined);
  pressY(f.controls[0]!);
  pressY(f.controls[0]!, true);
  assert.deepEqual(f.toggles, [["retroachievements", "42", "12", "hardcore"]]);
  renderToStaticMarkup(tabs[0].content);
  assert.equal(f.controls[2]?.onOptionsActionDescription, "Unpin");
  f.switchAccount();
  pressY(f.controls[2]!);
  assert.equal(f.toggles.length, 1);
});

test("Your Stuff adds Y to the existing locked tile without changing Select or earned tiles", () => {
  const f = fixture();
  const [patch] = f.installNativeYourStuffAchievementActions(f.resolveTarget);
  assert.ok(patch);
  renderToStaticMarkup((f.section.type as (props: unknown) => ReactElement)({ details: { unAppID: 1 } }));
  assert.equal(f.controls[0]?.onActivate, f.activate);
  assert.equal(f.controls[0]?.onOptionsActionDescription, "Pin");
  assert.equal(f.controls[1]?.onOptionsButton, undefined);
  pressY(f.controls[0]!);
  assert.deepEqual(f.toggles, [["retroachievements", "42", "12", "hardcore"]]);
  patch.unpatch();
  renderToStaticMarkup(f.section.type());
  assert.equal(f.controls[2]?.onOptionsButton, undefined);
});

test("current native list adds Y through the focused Steam node and preserves its existing actions", () => {
  const game = { providerId: "retroachievements", gameId: "42", accountId: "alice", achievementId: "12", mode: "hardcore" };
  const original = { actionDescriptionMap: { 1: { value: "Select" } } };
  let saved: { achievementId: string } | undefined;
  let notifyPinChanged = () => {};
  let resolve = () => game;
  const windowEvents = new Map<string, (event: unknown) => void>();
  const documentEvents = new Map<string, () => void>();
  let frame: (() => void) | undefined;
  const pinPanel = { memoizedProps: { setPinnedAchievements: Object.assign(() => {}, { [nativeRaPinSetter]: true }) } };
  const achievementFiber = { memoizedProps: {
    appid: 1, achievement: { api_name: "ra:12" }, unlockedForSelf: false, progress: { unlocked: false }, compareTo: {},
  }, return: undefined as typeof pinPanel | undefined };
  const row = { closest: () => row, __reactFiber$fixture: undefined as unknown };
  const node = {
    m_element: row, m_Properties: original,
    BTakeFocus: () => true, BHasFocus: () => true,
    GetActiveActionDescriptions() { return this.m_Properties.actionDescriptionMap; },
    SetProperties(props: typeof original) { this.m_Properties = props; },
  };
  row.__reactFiber$fixture = { return: { memoizedProps: { value: node }, return: achievementFiber } };
  const document = {
    activeElement: row, querySelector: () => null,
    addEventListener: (name: string, callback: () => void) => documentEvents.set(name, callback),
    removeEventListener: (name: string) => documentEvents.delete(name),
    defaultView: {
      addEventListener: (name: string, callback: (event: unknown) => void) => windowEvents.set(name, callback),
      removeEventListener: (name: string) => windowEvents.delete(name),
      requestAnimationFrame(callback: () => void) { frame = callback; return 1; },
      cancelAnimationFrame() { frame = undefined; },
    },
  };
  const { exports } = loadLocalComponent("src/platform/decky/decky-native-achievement-actions.tsx", {
    "@decky/ui": { GamepadButton: { OPTIONS: 4 } },
    "./decky-game-overview-preferences": {
      readPinnedAchievement: () => saved,
      pinAchievement(_target: unknown, achievementId: string) { saved = { achievementId }; notifyPinChanged(); },
      unpinAchievement() { saved = undefined; notifyPinChanged(); },
      subscribeToPinnedAchievementChanges(callback: () => void) { notifyPinChanged = callback; return () => {}; },
    },
  });
  const cleanup = exports.observeNativeQueryAchievementActions(document, () => 1, () => resolve());
  const description = () => (node.m_Properties.actionDescriptionMap as Record<number, { value: string }>)[4]?.value;
  const press = () => windowEvents.get("vgp_onbuttondown")!({ detail: { button: 4 }, preventDefault() {}, stopPropagation() {} });
  frame!();
  assert.equal(description(), "Pin");
  assert.equal(node.m_Properties.actionDescriptionMap[1].value, "Select");
  press(); frame!();
  assert.equal(saved?.achievementId, "12"); assert.equal(description(), "Unpin");
  resolve = () => ({ ...game, accountId: "other" });
  press(); assert.ok(saved, "an account switch invalidates the previously shown action");
  resolve = () => game;
  press(); frame!();
  assert.equal(saved, undefined); assert.equal(description(), "Pin");
  achievementFiber.return = pinPanel;
  documentEvents.get("vgp_onfocus")!(); frame!();
  assert.equal(description(), undefined, "Steam's integrated panel owns the pin action");
  press();
  assert.equal(saved, undefined);
  achievementFiber.return = undefined;
  documentEvents.get("vgp_onfocus")!(); frame!();
  assert.equal(description(), "Pin", "other native rows keep the fallback action");
  cleanup();
  assert.equal(node.m_Properties, original);
  assert.equal(windowEvents.size + documentEvents.size, 0);
});
