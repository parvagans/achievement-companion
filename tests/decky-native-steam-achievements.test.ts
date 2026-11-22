import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("runtime adapter preserves Steam data, gives dialogs Back priority, and unpatches on teardown", () => {
  const script = String.raw`
    import assert from "node:assert/strict";
    import { mock } from "node:test";
    import { resolve } from "node:path";
    import { pathToFileURL } from "node:url";

    const callOriginal = Symbol("callOriginal");
    const patchRecords = [];
    const routeRecords = [];
    let lifetimeUnregisters = 0;
    let lifetimeListener;

    const routerHook = {
      addPatch(route, callback) {
        const record = { route, callback, removed: false };
        routeRecords.push(record);
        return record;
      },
      removePatch(route, record) {
        assert.equal(record.route, route);
        assert.equal(record.removed, false);
        record.removed = true;
      },
    };

    function patch(target, name, handler, kind) {
      const original = target[name];
      target[name] = function (...args) {
        if (kind === "after") {
          return handler.call(this, args, original.apply(this, args));
        }
        if (kind === "before") {
          handler.call(this, args);
          return original.apply(this, args);
        }
        const replacement = handler.call(this, args);
        return replacement === callOriginal ? original.apply(this, args) : replacement;
      };
      const record = { target, name, original, unpatched: false };
      patchRecords.push(record);
      return {
        unpatch() {
          assert.equal(record.unpatched, false);
          assert.equal(target[name] !== original, true);
          target[name] = original;
          record.unpatched = true;
        },
      };
    }

    class LibraryPage {
      constructor() { this.forceUpdates = 0; }
      GetSections() { return new Set(["notes"]); }
      RegisterSection() {}
      SeekToSection() {}
      onGameInfoToggle() {}
      forceUpdate() { this.forceUpdates += 1; }
    }
    class ActivityFeed {
      constructor(props) { this.props = props; }
      render() { return "original-activity-" + this.props.appid; }
      ShowMoreContent() {}
      async OnPostStatusClicked() {}
    }
    function activityWrapper() { return { type: ActivityFeed }; }
    activityWrapper.toString = () => "function fr(){AppDetailsActivitySectionDays;nDaysToDisplay}";
    class CommunityFeed {
      constructor(props) { this.props = props; }
      render() { return "original-community-" + this.props.appid; }
      BindInnerContainer() {}
      AutoLoadAdditionalContent() {}
      LoadAdditionalContent() {}
    }
    function communityWrapper() { return { type: CommunityFeed }; }
    communityWrapper.toString = () => "function rt(ot){const ht=a.useId();return jsx(ut,{labelId:ht,...ot})}";
    const tabsPrimitive = { type(props) { return props; } };
    const queries = new Map();
    const queryListeners = new Set();
    const queryClient = {
      getQueryData: (key) => queries.get(JSON.stringify(key)),
      setQueryData(key, value) { queries.set(JSON.stringify(key), value); return value; },
      async cancelQueries() {},
      async resetQueries({ queryKey }) { queries.delete(JSON.stringify(queryKey)); },
      getQueryCache() { return { subscribe(listener) {
        queryListeners.add(listener);
        return () => queryListeners.delete(listener);
      } }; },
    };
    const steamViewer = "76561198000000000";
    const personalStore = {
      m_mapMyAchievements: new Map(),
      m_mapGlobalAchievements: new Map(),
      GetMyAchievements(appId) { return "original-my-" + appId; },
      GetGlobalAchievements(appId) { return "original-global-" + appId; },
      GetMyAchievementsByID(appId) { return "original-by-id-" + appId; },
    };
    const appDetails = new Map();
    const detailsStore = {
      GetAppDetails(appId) {
        if (!appDetails.has(appId)) appDetails.set(appId, { unAppID: appId, launchState: "original", achievements: { nTotal: appId === 620 ? 72 : 0 } });
        return appDetails.get(appId);
      },
      GetAchievements(appId) { return "original-details-" + appId; },
    };
    const progressCache = {
      GetAchievementProgress(appId) { return "original-progress-" + appId; },
      BGameHasAchievements(appId) { return appId === 620; },
    };
    const observableBoxes = [];
    function observable() {}
    observable.box = (initial) => {
      let value = initial;
      const box = {
        get() { box.reads += 1; return value; },
        set(next) { value = next; box.writes += 1; },
        reads: 0,
        writes: 0,
      };
      observableBoxes.push(box);
      return box;
    };
    observable.map = () => new Map();
    function NativeCommunityBody() { return null; }
    NativeCommunityBody.toString = () => "function I(){BodyGutter;spacing;children}";
    const NativeCommunitySection = { $$typeof: Symbol.for("react.memo"), type() { return null; } };
    const nativeCommunityModule = { body: NativeCommunityBody, section: NativeCommunitySection };
    const exportsToFind = [LibraryPage, activityWrapper, personalStore, observable, queryClient];
    const findModuleExport = (predicate) => exportsToFind.find(predicate);
    const findModuleByExport = (predicate) => predicate(NativeCommunityBody) ? nativeCommunityModule : undefined;
    const createModuleMapping = (predicate) => {
      const module = { communityWrapper };
      return predicate(module) ? new Map([["community", module]]) : new Map();
    };
    const originalMethods = [
      [LibraryPage.prototype, "GetSections"],
      [ActivityFeed.prototype, "render"],
      [CommunityFeed.prototype, "render"],
      [personalStore, "GetMyAchievements"],
      [personalStore, "GetGlobalAchievements"],
      [detailsStore, "GetAchievements"],
      [detailsStore, "GetAppDetails"],
      [progressCache, "GetAchievementProgress"],
      [progressCache, "BGameHasAchievements"],
    ].map(([target, name]) => ({ target, name, original: target[name] }));

    const steam = { appid: 620, app_type: 1, display_name: "Steam Game" };
    const highSteamId = 2_590_000_000;
    const highSteam = { appid: highSteamId, app_type: 1, display_name: "High ID Steam Game" };
    const shortcutId = 2_580_000_000;
    const shortcut = { appid: shortcutId, app_type: 1073741824, display_name: "Shortcut" };
    const unmatched = { ...shortcut, appid: shortcutId + 1 };
    const overviews = new Map([[620, steam], [highSteamId, highSteam], [shortcutId, shortcut], [unmatched.appid, unmatched]]);
    const achievement = {
      achievementId: "123", providerId: "retroachievements", gameId: "456",
      title: "RA achievement", description: "Earned in RA", badgeImageUrl: "ra-image",
      isUnlocked: true, unlockedAt: 1_760_000_000_000, metrics: [],
    };
    const projections = new Map();
    const projectionFor = (appId) => {
      if (projections.has(appId)) return projections.get(appId);
      const projection = {
      status: "ready", appId: String(appId), raGameId: "456", title: "RA Game",
      mode: "both", achievements: [achievement, {
        ...achievement, achievementId: "124", title: "Locked RA achievement", isUnlocked: false, unlockedAt: undefined,
        badgeImageUrl: "https://i.retroachievements.org/Badge/201677.png",
      }, {
        ...achievement, achievementId: "125", title: "Another locked RA achievement", isUnlocked: false, unlockedAt: undefined,
      }], earned: 1, total: 3, detailSnapshot: { game: { status: "in-progress" } },
      communityStats: {
        totalPlayers: 100, masteredPlayers: 25, masteryPercent: 25,
        beatenHardcoreSamples: 40, medianBeatSeconds: 3600, medianMasterySeconds: 7200,
        latestMasters: [{ rank: 25, username: "TempoBlues", userUlid: "01ABC", masteredAt: "2026-10-14T12:00:00.000Z" }],
      },
      achievementsAvailableSince: "2020-01-01",
      };
      projections.set(appId, projection);
      return projection;
    };
    const projectionReads = [];
    const projectionLoads = [];
    const queuedProjectionLoads = [];
    const projectionInvalidations = [];
    let projectionDisposals = 0;
    globalThis.window = {
      location: { pathname: "/library/app/620" },
      appStore: { GetAppOverviewByAppID: (appId) => overviews.get(appId) ?? null },
      appDetailsStore: detailsStore,
      appAchievementProgressCache: progressCache,
      friendStore: { currentUserSteamID: { ConvertTo64BitString: () => steamViewer } },
      SteamClient: {
        GameSessions: {
          RegisterForAppLifetimeNotifications(callback) {
            lifetimeListener = callback;
            return { unregister() { lifetimeUnregisters += 1; } };
          },
        },
      },
    };

    mock.module("@decky/api", {
      exports: { routerHook, call: async () => undefined },
    });
    mock.module("@decky/ui", {
      exports: {
        callOriginal,
        appDetailsClasses: { InnerContainer: "inner-container" },
        createModuleMapping,
        createReactTreePatcher: (_selectors, callback) => callback,
        findInReactTree: (node, predicate) => predicate(node) ? node : undefined,
        findModuleByExport,
        findModuleExport,
        applyHookStubs() {},
        removeHookStubs() {},
        Focusable: () => null,
        DialogButton: () => null,
        DialogControlsSection: () => null,
        ConfirmModal: () => null,
        showModal: () => ({ Close() {} }),
        GamepadButton: { OPTIONS: 4 },
        Navigation: { Navigate() {} },
        afterPatch: (target, name, handler) => patch(target, name, handler, "after"),
        beforePatch: (target, name, handler) => patch(target, name, handler, "before"),
        replacePatch: (target, name, handler) => patch(target, name, handler, "replace"),
        Tabs: tabsPrimitive,
      },
    });
    mock.module(pathToFileURL(resolve("src/platform/decky/decky-native-retroachievements-projection.ts")).href, {
      exports: {
        async verifyNativeProjectionLaunch() { return undefined; },
        projectNativeRetroAchievementsDetail(_appId, _gameId, _mode, detail) { return detail; },
        readDeckyNativeRetroAchievementsProjection(appId, mode) {
          projectionReads.push([appId, mode]);
          return projectionFor(appId);
        },
        async loadDeckyNativeRetroAchievementsProjection(appId, mode, options) {
          projectionLoads.push({ appId, mode, forceRefresh: options?.forceRefresh === true, revalidateOnEntry: options?.revalidateOnEntry === true });
          const next = queuedProjectionLoads.shift();
          if (next instanceof Error) throw next;
          return typeof next === "function" ? next(appId) : next ?? projectionFor(appId);
        },
        invalidateDeckyNativeRetroAchievementsProjection(appId) { projectionInvalidations.push(appId); },
        disposeDeckyNativeRetroAchievementsProjection() { projectionDisposals += 1; },
      },
    });
    let observedGame;
    const runningListeners = new Set();
    mock.module(pathToFileURL(resolve("src/platform/decky/decky-retroachievements-presence.ts")).href, {
      exports: {
        deckyRaPresence: {
          runningGameId: () => observedGame,
          subscribe(listener) { runningListeners.add(listener); return () => runningListeners.delete(listener); },
        },
        corroborateDeckyRaPresenceLaunch() {},
        notifyDeckyRaPresenceLifecycle() {},
        stopDeckyRaPresence() {},
      },
    });
    mock.module(pathToFileURL(resolve("src/platform/decky/decky-native-retroachievements-activity.tsx")).href, {
      exports: {
        DeckyNativeRetroAchievementsActivity() { return null; },
      },
    });
    mock.module(pathToFileURL(resolve("src/platform/decky/decky-retroachievements-community-resource.tsx")).href, {
      exports: {
        DeckyRetroAchievementsCommunityResource() { return null; },
      },
    });
    mock.module(pathToFileURL(resolve("src/platform/decky/decky-native-up-next.tsx")).href, {
      exports: {
        DeckyNativeUpNext() { return null; },
        NATIVE_UP_NEXT_TAB_ID: "AchievementCompanionUpNext",
        withNativeUpNextTab(tabs, content) {
          const activityIndex = tabs.findIndex((tab) => tab.id === "WhatsNew");
          return activityIndex < 0 || !tabs.some((tab) => tab.id === "YourStuff")
            ? tabs : [...tabs.slice(0, activityIndex + 1), { id: "AchievementCompanionUpNext", title: "Up Next", content }, ...tabs.slice(activityIndex + 1)];
        },
      },
    });

    const { ensureDeckyNativeSteamAchievementsRegistered, registerDeckyNativeGamePageBackBoundary } = await import("./src/platform/decky/decky-native-steam-achievements.ts");
    const { publishDeckyRaNativeAchievementInvalidation } = await import("./src/platform/decky/decky-ra-native-achievement-invalidation.ts");

    const dialog = {};
    function tabElement(dialogOwner) {
      return {
        closest(selector) {
          if (selector === '[role="tab"]') return this;
          return selector === '[role="dialog"]' ? dialogOwner : null;
        },
      };
    }
    const pageTab = tabElement(null);
    const providerTab = tabElement(dialog);
    let focused = providerTab;
    let activeDialogSelector;
    let cancelListener;
    let navigatedBack = 0;
    const ownerWindow = {
      document: {
        querySelector(selector) {
          if (selector === ".gpfocus") return focused;
          return activeDialogSelector && selector.includes(activeDialogSelector) ? dialog : null;
        },
      },
      addEventListener(name, listener, capture) {
        assert.equal(name, "vgp_oncancel");
        assert.equal(capture, true);
        assert.equal(cancelListener, undefined);
        cancelListener = listener;
      },
      removeEventListener(name, listener, capture) {
        assert.equal(name, "vgp_oncancel");
        assert.equal(capture, true);
        assert.equal(listener, cancelListener);
        cancelListener = undefined;
      },
    };
    ownerWindow.document.defaultView = ownerWindow;
    const removeBackBoundary = registerDeckyNativeGamePageBackBoundary({ ownerDocument: ownerWindow.document }, () => navigatedBack++);
    const pressBack = (defaultPrevented = false) => {
      const consumed = [];
      cancelListener({
        defaultPrevented,
        preventDefault: () => consumed.push("prevent"),
        stopPropagation: () => consumed.push("stop"),
        stopImmediatePropagation: () => consumed.push("stop immediately"),
      });
      return consumed;
    };
    assert.deepEqual(pressBack(), [], "a dialog provider tab retains native Cancel");
    focused = pageTab;
    for (activeDialogSelector of ["[data-ac-native-pinned-modal]", "[data-ac-native-pinned-details]"]) {
      assert.deepEqual(pressBack(), [], "a retained game-page focus cannot steal Cancel from the native dialog");
    }
    activeDialogSelector = undefined;
    assert.deepEqual(pressBack(true), [], "a canceled event cannot navigate a second time");
    assert.equal(navigatedBack, 0);
    assert.deepEqual(pressBack(), ["prevent", "stop", "stop immediately"]);
    assert.equal(navigatedBack, 1, "a genuine game-page tab still navigates back");
    removeBackBoundary();
    assert.equal(cancelListener, undefined);

    const cleanup = ensureDeckyNativeSteamAchievementsRegistered();
    assert.equal(routeRecords.length, 1);
    assert.equal(routeRecords[0].route, "/library/app/:appid");
    const initialPatchCount = patchRecords.length;
    assert.equal(initialPatchCount >= originalMethods.length, true);

    for (const overview of [steam, highSteam]) {
      const appId = overview.appid;
      const page = new LibraryPage();
      const sections = page.GetSections(overview, { unAppID: appId });
      assert.deepEqual([...sections], ["notes"]);
      assert.equal(detailsStore.GetAchievements(appId), "original-details-" + appId);
      assert.equal(personalStore.GetMyAchievements(appId), "original-my-" + appId);
      assert.equal(personalStore.GetGlobalAchievements(appId), "original-global-" + appId);
      assert.equal(progressCache.GetAchievementProgress(appId), "original-progress-" + appId);
      assert.equal(progressCache.BGameHasAchievements(appId), appId === 620);
      assert.equal(page.forceUpdates, 0);
      lifetimeListener({ unAppID: appId, bRunning: false });
      assert.equal(page.forceUpdates, 0);
    }
    assert.deepEqual(projectionReads, []);
    assert.equal(observableBoxes.length, 0);

    const shortcutPage = new LibraryPage();
    window.location.pathname = "/library/app/" + shortcutId;
    let shortcutSections = shortcutPage.GetSections(shortcut, { unAppID: shortcutId });
    assert.deepEqual(projectionLoads[0], { appId: String(shortcutId), mode: "both", forceRefresh: false, revalidateOnEntry: true });
    if (!shortcutSections.has("achievements")) {
      await new Promise((resolve) => setImmediate(resolve));
      shortcutSections = shortcutPage.GetSections(shortcut, { unAppID: shortcutId });
    }
    assert.deepEqual([...shortcutSections], ["notes", "achievements", "activity", "community"]);
    assert.equal(projectionLoads.length, 1);
    const originalTabs = [{ id: "WhatsNew", title: "Activity" }, { id: "YourStuff", title: "Your Stuff" }];
    const nativeSelections = [];
    const nativeTabProps = { tabs: originalTabs, activeTab: "WhatsNew", onShowTab: (id) => nativeSelections.push(id) };
    const insertedTabs = tabsPrimitive.type(nativeTabProps);
    assert.deepEqual(insertedTabs.tabs.map((tab) => tab.id), ["WhatsNew", "AchievementCompanionUpNext", "YourStuff"]);
    insertedTabs.onShowTab("AchievementCompanionUpNext");
    assert.deepEqual(nativeSelections, []);
    assert.equal(tabsPrimitive.type(nativeTabProps).activeTab, "AchievementCompanionUpNext");
    tabsPrimitive.type(nativeTabProps).onShowTab("YourStuff");
    assert.deepEqual(nativeSelections, ["YourStuff"]);
    assert.equal(tabsPrimitive.type({ ...nativeTabProps, activeTab: "YourStuff" }).activeTab, "YourStuff");
    const routeProps = {
      renderFunc() { return { props: { className: "inner-container", children: [] } }; },
    };
    const originalRouteRender = routeProps.renderFunc;
    routeRecords[0].callback(routeProps);
    const raRoute = routeProps.renderFunc();
    const raRouteChildren = raRoute.props.children;
    assert.equal(raRouteChildren.length, 2);
    assert.equal(raRouteChildren[0].props["data-achievement-companion-native-achievement-spacing"], "true");
    assert.match(raRouteChildren[0].props.children, /padding-inline-start: 46px !important/u);
    assert.equal(raRouteChildren[1].type.name, "DeckyNativeGamePageBackBoundary");
    window.location.pathname = "/library/app/620";
    const steamRouteChildren = routeProps.renderFunc().props.children;
    assert.equal(steamRouteChildren.length, 1);
    assert.equal(steamRouteChildren[0].props["data-achievement-companion-native-achievement-spacing"], "true");
    assert.equal(steamRouteChildren[0].props.children, raRouteChildren[0].props.children);
    window.location.pathname = "/library/app/" + shortcutId;
    const activityContent = new ActivityFeed({ appid: shortcutId }).render();
    assert.equal(activityContent.type.name, "DeckyNativeRetroAchievementsActivity");
    assert.equal(activityContent.props.appId, shortcutId);
    assert.equal(activityContent.props.items[0].achievement.achievementId, "123");
    const communityContent = new CommunityFeed({ appid: shortcutId }).render();
    assert.equal(communityContent.type.name, "DeckyRetroAchievementsCommunityResource");
    assert.deepEqual(communityContent.props.snapshot, projectionFor(shortcutId).detailSnapshot);
    assert.equal(communityContent.props.achievementsAvailableSince, "2020-01-01");
    assert.ok(communityContent.props.primitives.Section);
    assert.equal(new ActivityFeed({ appid: 620 }).render(), "original-activity-620");
    assert.equal(new ActivityFeed({ appid: highSteamId }).render(), "original-activity-" + highSteamId);
    assert.equal(new CommunityFeed({ appid: 620 }).render(), "original-community-620");
    assert.equal(new CommunityFeed({ appid: highSteamId }).render(), "original-community-" + highSteamId);
    assert.equal(detailsStore.GetAchievements(shortcutId).vecHighlight[0].strID, "ra:123");
    assert.deepEqual(Object.keys(personalStore.GetMyAchievements(shortcutId).data.achieved), ["ra:123"]);
    const schemaKey = ["achievements", shortcutId, "schema"];
    const progressKey = ["achievements", shortcutId, "user_achievements", steamViewer];
    const readNativeRows = () => {
      const schema = queryClient.getQueryData(schemaKey);
      const progress = queryClient.getQueryData(progressKey);
      return (schema?.groups ?? []).flatMap(group => group.achievements.map(row => [
        row.api_name, progress?.achievements[row.internal_key]?.unlocked,
      ]));
    };
    assert.deepEqual(readNativeRows(), [["ra:123", true], ["ra:124", false], ["ra:125", false]],
      "current Your Stuff reads the query schema and progress instead of the legacy details API");
    assert.equal(detailsStore.GetAchievements(shortcutId).nTotal, 3);
    const lockedArt = queryClient.getQueryData(schemaKey).groups[0].achievements.find(row => row.api_name === "ra:124");
    assert.equal(lockedArt.icon_achieved, "https://i.retroachievements.org/Badge/201677.png");
    assert.equal(lockedArt.icon_unachieved, "https://i.retroachievements.org/Badge/201677_lock.png");
    assert.equal(Object.keys(personalStore.GetGlobalAchievements(shortcutId).data).length, 3);
    assert.equal(queryClient.getQueryData(["achievements", 620, "schema"]), undefined);
    assert.equal(queryListeners.size, 1);
    queries.set(JSON.stringify(schemaKey), { groups: [] });
    for (const listener of queryListeners) listener({ type: "updated", query: { queryKey: schemaKey }, action: { type: "success" } });
    assert.equal(readNativeRows().length, 3, "a finished empty Steam request cannot overwrite a verified RA schema");
    window.location.pathname = "/library/app/" + shortcutId + "/achievements/my/individual";
    assert.equal(readNativeRows().length, 3, "the native full list uses the same schema after navigating");
    assert.equal(queryClient.getQueryData(["achievements", shortcutId, "user_achievements", "76561198000000001"]), undefined);
    window.location.pathname = "/library/app/" + shortcutId;
    assert.equal(progressCache.BGameHasAchievements(shortcutId), true);
    assert.equal(observableBoxes.length, 1);
    assert.equal(observableBoxes[0].reads > 0, true);
    const revisionWritesBeforeRefresh = observableBoxes[0].writes;
    publishDeckyRaNativeAchievementInvalidation("provider-refreshed");
    assert.equal(observableBoxes[0].writes, revisionWritesBeforeRefresh);
    assert.equal(new ActivityFeed({ appid: shortcutId }).render().type.name, "DeckyNativeRetroAchievementsActivity");
    publishDeckyRaNativeAchievementInvalidation("account-changed");
    assert.deepEqual(readNativeRows(), [], "account invalidation clears the native query projection");
    assert.equal(observableBoxes[0].writes > revisionWritesBeforeRefresh, true);
    assert.equal(new ActivityFeed({ appid: shortcutId }).render(), "original-activity-" + shortcutId);

    for (const failure of [
      { status: "unavailable", appId: String(shortcutId), reason: "detail-unavailable" },
      new Error("temporary detail failure"),
    ]) {
      queuedProjectionLoads.push(failure);
      const loadsBeforeFailure = projectionLoads.length;
      assert.deepEqual([...shortcutPage.GetSections(shortcut, { unAppID: shortcutId })], ["notes"]);
      assert.equal(projectionLoads.length, loadsBeforeFailure + 1);
      await new Promise((resolve) => setImmediate(resolve));
      const loadsBeforeRetry = projectionLoads.length;
      assert.deepEqual([...shortcutPage.GetSections(shortcut, { unAppID: shortcutId })], ["notes"]);
      assert.equal(projectionLoads.length, loadsBeforeRetry + 1);
      assert.equal(projectionLoads.at(-1).forceRefresh, false);
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual([...shortcutPage.GetSections(shortcut, { unAppID: shortcutId })], ["notes", "achievements", "activity", "community"]);
      publishDeckyRaNativeAchievementInvalidation("account-changed");
    }

    let releaseNewPageLoad;
    queuedProjectionLoads.push(() => new Promise((resolve) => { releaseNewPageLoad = resolve; }));
    const newlyMountedPage = new LibraryPage();
    const loadsBeforeNewPage = projectionLoads.length;
    assert.deepEqual([...newlyMountedPage.GetSections(shortcut, { unAppID: shortcutId })], ["notes"]);
    assert.equal(projectionLoads.length, loadsBeforeNewPage + 1);
    assert.deepEqual(projectionLoads.at(-1), { appId: String(shortcutId), mode: "both", forceRefresh: false, revalidateOnEntry: true });
    assert.equal(typeof releaseNewPageLoad, "function");
    assert.notEqual(detailsStore.GetAchievements(shortcutId)?.vecHighlight?.[0]?.strID, "ra:123");
    releaseNewPageLoad(projectionFor(shortcutId));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual([...newlyMountedPage.GetSections(shortcut, { unAppID: shortcutId })], ["notes", "achievements", "activity", "community"]);

    const updatesBeforeCleanup = newlyMountedPage.forceUpdates;
    cleanup();
    assert.equal(routeRecords[0].removed, true);
    assert.equal(lifetimeUnregisters, 1);
    assert.equal(newlyMountedPage.forceUpdates, updatesBeforeCleanup + 1);
    assert.equal(patchRecords.every((record) => record.unpatched), true);
    assert.equal(routeProps.renderFunc, originalRouteRender);
    assert.equal(projectionDisposals, 1);
    assert.deepEqual(readNativeRows(), [], "unload drops projected progress from the native queries");
    assert.equal(queryListeners.size, 0);
    assert.equal(projectionInvalidations.includes(undefined), true);
    for (const { target, name, original } of originalMethods) assert.equal(target[name], original);
    cleanup();
    assert.equal(lifetimeUnregisters, 1);
    const revisionWritesAfterCleanup = observableBoxes[0].writes;
    publishDeckyRaNativeAchievementInvalidation("provider-refreshed");
    assert.equal(newlyMountedPage.forceUpdates, updatesBeforeCleanup + 1);
    assert.equal(observableBoxes[0].writes, revisionWritesAfterCleanup);

    const cleanupReloaded = ensureDeckyNativeSteamAchievementsRegistered();
    const reloadedPatchCount = patchRecords.length;
    assert.equal(ensureDeckyNativeSteamAchievementsRegistered(), cleanupReloaded);
    assert.equal(routeRecords.length, 2);
    assert.equal(patchRecords.length, reloadedPatchCount);
    assert.equal(reloadedPatchCount, initialPatchCount * 2 + 1);
    window.location.pathname = "/library/app/" + unmatched.appid;
    const unmatchedPage = new LibraryPage();
    queuedProjectionLoads.push({ status: "unavailable", appId: String(unmatched.appid), reason: "unmatched" });
    assert.deepEqual([...unmatchedPage.GetSections(unmatched, { unAppID: unmatched.appid })], ["notes"]);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(queryClient.getQueryData(["achievements", unmatched.appid, "schema"]), undefined);
    window.location.pathname = "/library/app/" + shortcutId;
    const reloadedPage = new LibraryPage();
    reloadedPage.GetSections(shortcut, { unAppID: shortcutId });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(readNativeRows().length, 3, "reload can verify and project the same shortcut again");

    const { updateDeckyProviderConfigCache } = await import("./src/platform/decky/providers/provider-config-store.ts");
    updateDeckyProviderConfigCache("retroachievements", { username: "fixture", hasApiKey: true });
    window.location.pathname = "/routes/apprunning";
    const nativeShortcutDetails = detailsStore.GetAppDetails(shortcutId);
    const nativeSteamDetails = detailsStore.GetAppDetails(620);
    window.SteamUIStore = { GetFocusedWindowInstance: () => ({ RunningApps: [shortcut] }) };
    assert.equal(detailsStore.GetAppDetails(shortcutId), nativeShortcutDetails, "initial read waits on verification");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(detailsStore.GetAppDetails(shortcutId).achievements.nTotal, 3, "lazy startup recovers a running shortcut");
    window.SteamUIStore = undefined;
    lifetimeListener({ unAppID: shortcutId, bRunning: false });
    assert.equal(nativeShortcutDetails.achievements.nTotal, 0, "Steam's running menu starts with no shortcut achievements");
    lifetimeListener({ unAppID: shortcutId, bRunning: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(detailsStore.GetAppDetails(shortcutId).achievements.nTotal, 3);
    assert.equal(detailsStore.GetAppDetails(shortcutId).launchState, "original");
    assert.equal(nativeShortcutDetails.achievements.nTotal, 0, "the host's stored record is never modified");
    assert.equal(detailsStore.GetAppDetails(620), nativeSteamDetails);
    assert.equal(readNativeRows().length, 3, "the native overlay renders the verified query data");
    lifetimeListener({ unAppID: shortcutId, bRunning: false });
    assert.equal(detailsStore.GetAppDetails(shortcutId), nativeShortcutDetails);
    assert.deepEqual(readNativeRows(), [], "exit clears the running game's native data");

    let finishLaunch;
    queuedProjectionLoads.push(() => new Promise(resolve => { finishLaunch = resolve; }));
    lifetimeListener({ unAppID: shortcutId, bRunning: true });
    lifetimeListener({ unAppID: shortcutId, bRunning: false });
    finishLaunch(projectionFor(shortcutId));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(detailsStore.GetAppDetails(shortcutId), nativeShortcutDetails);
    assert.deepEqual(readNativeRows(), [], "an exited launch cannot publish late results");

    queuedProjectionLoads.push({ status: "unavailable", appId: String(unmatched.appid), reason: "unmatched" });
    lifetimeListener({ unAppID: unmatched.appid, bRunning: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(detailsStore.GetAppDetails(unmatched.appid).achievements.nTotal, 0);
    assert.equal(queryClient.getQueryData(["achievements", unmatched.appid, "schema"]), undefined);
    cleanupReloaded();
    assert.equal(routeRecords[1].removed, true);
    assert.equal(lifetimeUnregisters, 2);
    for (const { target, name, original } of originalMethods) assert.equal(target[name], original);
  `;

  const result = spawnSync(
    process.execPath,
    ["--experimental-test-module-mocks", "--import", "tsx", "--input-type=module", "-e", script],
    { cwd: process.cwd(), encoding: "utf8", timeout: 30_000 },
  );
  assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join("\n"));
});
