import assert from "node:assert/strict";
import test from "node:test";
import { cloneElement, createElement, Fragment, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeRetroAchievementsGameDetail } from "../src/providers/retroachievements/mappers/normalize";
import { components } from "./helpers/decky-component-declarations";

test("Guides reuses the native running-game row for a verified RA shortcut", async () => {
  function renderRoot({ navID, navTreeRef, parentEmbeddedNavTree, children }: Record<string, unknown>) {
    void navTreeRef;
    void parentEmbeddedNavTree;
    return createElement("nav", { "data-nav-id": navID }, children as ReactElement);
  }
  const root = { render: renderRoot };
  const styles = { NavigationBox: "NativeNavBox" };
  const { mapNativeChildren, wrapNativeRenderer } = await components("decky-native-achievement-actions.tsx",
    ["mapNativeChildren", "wrapNativeRenderer"], { cloneElement, createElement, isValidElement });
  let verified: unknown;
  let opened: { title: string } | undefined;
  const { installNativeRaOverlayGuides } = await components("decky-native-ra-overlay-guides.tsx",
    ["isRunningShortcut", "isMenuNavigationRoot", "insertNativeRaGuidesRow", "installNativeRaOverlayGuides", "openRaGuides"], {
      cloneElement, createElement, Fragment, isValidElement, mapNativeChildren, wrapNativeRenderer,
      GUIDES_KEY: "ac-guides", getNativeRaGuideLinks: () => [],
      openDeckyStandardModal: (options: { title: string }) => { opened = options; },
      useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
      findModuleExport: () => root,
      beforePatch: (target: typeof root, _property: string, handler: (args: unknown[]) => void) => {
        target.render = props => {
          const args = [props];
          handler(args);
          return renderRoot(args[0]!);
        };
        return { unpatch: () => { target.render = renderRoot; } };
      },
    });
  const patch = installNativeRaOverlayGuides({ readProjection: (id: number) => id === 7 ? verified : undefined, subscribe: () => () => {} });
  const observedActions: Array<() => void> = [];
  function NativeRow({ text, onActivate }: { text: string; onActivate: () => void }) {
    if (text === "Guides") observedActions.push(onActivate);
    return createElement("button", null, text);
  }
  const native = (key: string, text: string) => createElement(NativeRow, { key, text, onActivate: () => {} });
  function NavigationBox({ children }: { children: React.ReactNode }) {
    return createElement("div", { className: styles.NavigationBox }, children);
  }
  function Column() {
    return createElement(NavigationBox, {
      children: [
        [native("resume", "Resume"), native("achievements", "Achievements"), native("notes", "Notes")],
        createElement("hr", { key: "separator" }),
      ],
    });
  }
  function RunningControls({ app }: { app: unknown }) {
    return createElement(Column, { app, collapsible: true, navRef: {} } as {});
  }
  function App({ app }: { app: unknown }) {
    return createElement(RunningControls, { app, collapsible: true, instance: {} } as { app: unknown });
  }
  const menu = (appid: number, BIsShortcut: () => boolean, navID = "MainNavMenuContainer") => {
    const app = { appid, BIsShortcut };
    return renderToStaticMarkup(root.render({ navID, children: createElement(App, { app, visible: true, ownerWindow: {} } as { app: unknown }) }));
  };

  assert.doesNotMatch(menu(7, () => true), />Guides</u);
  verified = { raGameId: "17", title: "Verified RA game" };
  assert.doesNotMatch(menu(7, () => false), />Guides</u);
  assert.doesNotMatch(menu(8, () => true), />Guides</u);
  assert.doesNotMatch(menu(7, () => true, "OtherNavigationRoot"), />Guides</u);
  assert.match(menu(7, () => true), /Achievements<\/button><button>Guides<\/button><button>Notes/u);
  const activate = observedActions.at(-1);
  assert.ok(activate);
  verified = { raGameId: "19", title: "New ROM" };
  activate();
  assert.equal(opened?.title, "New ROM Guides");
  verified = undefined;
  opened = undefined;
  activate();
  assert.equal(opened, undefined);
  patch.unpatch();
  verified = { raGameId: "21", title: "Verified after unload" };
  assert.doesNotMatch(menu(7, () => true), />Guides</u);
});

test("RA guide links stay with the verified set and omit invalid external links", async () => {
  const requests: unknown[] = [];
  const { getNativeRaGuideLinks } = await components("decky-native-ra-overlay-guides.tsx",
    ["getNativeRaGuideLinks", "httpsGuideUrl", "COMMUNITY_GUIDE_BY_GAME_ID"], {
      RA_SITE: "https://retroachievements.org",
      readDeckyProviderConfigs: () => ({ retroAchievements: { username: "Player" } }),
      readPinnedAchievement: (scope: unknown) => { requests.push(scope); return { achievementId: "45" }; },
    });
  const detailSnapshot = normalizeRetroAchievementsGameDetail({
    ID: 17,
    Title: "Fixture",
    GuideURL: "https://github.com/RetroAchievements/guides/wiki/Game",
    ForumTopicID: 99,
    Achievements: { "45": { ID: 45, Title: "Find the map", Description: "Find the dungeon map", Points: 5 } },
  });
  const projection = {
    raGameId: "17",
    achievements: [{ achievementId: "45", title: "Find the map" }],
    detailSnapshot,
  };
  assert.deepEqual(getNativeRaGuideLinks(projection), [
    { label: "Pinned Achievement · Find the map", url: "https://retroachievements.org/achievement/45" },
    { label: "Mastery Guide", url: "https://github.com/RetroAchievements/guides/wiki/Game" },
    { label: "Game Discussion", url: "https://retroachievements.org/forums/topic/99" },
  ]);
  assert.deepEqual(requests, [{ providerId: "retroachievements", gameId: "17", accountId: "player" }]);
  assert.deepEqual(getNativeRaGuideLinks({
    raGameId: "21", achievements: [], detailSnapshot: { game: { metrics: [
      { key: "guide-url", value: "https://user@example.com/invalid" },
      { key: "forum-topic-id", value: "../99" },
    ] } },
  }), [{ label: "RetroAchievements Game Page", url: "https://retroachievements.org/game/21" }]);
  const zelda = getNativeRaGuideLinks({
    raGameId: "10113", achievements: [], detailSnapshot: { game: { metrics: [] } },
  });
  assert.equal(zelda[0]?.label, "Mastery Guide");
  assert.match(zelda[0]?.url ?? "", /Ocarina-of-Time/u);
});


test("the Guides dialog delegates layout and activation to Steam's dialog controls", async () => {
  const opened: string[] = [];
  const activated: unknown[] = [];
  const firstNativeButton = {};
  const firstRef = { current: firstNativeButton };
  const { RaGuidesLinks } = await components("decky-native-ra-overlay-guides.tsx", ["RaGuidesLinks"], {
    createElement,
    DialogControlsSection: "native-controls-section",
    DialogButton: "native-dialog-button",
    useRef: () => firstRef,
    useLayoutEffect: (effect: () => void) => effect(),
    requestDeckySteamGamepadFocusAfterMount: (element: unknown) => activated.push(element),
  });
  const links = [
    { label: "Mastery Guide", url: "https://example.com/guide" },
    { label: "Game Discussion", url: "https://example.com/forum" },
  ];
  const tree = RaGuidesLinks({ links, open: (url: string) => opened.push(url) });
  assert.equal(tree.type, "native-controls-section");
  assert.deepEqual(activated, [firstNativeButton]);
  for (const [index, button] of tree.props.children.entries()) {
    assert.equal(button.type, "native-dialog-button");
    assert.equal(button.props.children, links[index]?.label);
    button.props.onClick();
  }
  assert.deepEqual(opened, links.map(({ url }) => url));
});
