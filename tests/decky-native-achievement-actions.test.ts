import assert from "node:assert/strict";
import test from "node:test";
import { cloneElement, createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadLocalComponent } from "./helpers/render-decky-component";

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
