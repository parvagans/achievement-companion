import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("runtime adapter leaves Steam games untouched and fully unpatches on teardown", () => {
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
    const personalStore = {
      m_mapMyAchievements: new Map(),
      m_mapGlobalAchievements: new Map(),
      GetMyAchievements(appId) { return "original-my-" + appId; },
      GetGlobalAchievements(appId) { return "original-global-" + appId; },
      GetMyAchievementsByID(appId) { return "original-by-id-" + appId; },
    };
    const detailsStore = {
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
    const exportsToFind = [LibraryPage, activityWrapper, personalStore, observable];
    const findModuleExport = (predicate) => exportsToFind.find(predicate);
    const originalMethods = [
      [LibraryPage.prototype, "GetSections"],
      [ActivityFeed.prototype, "render"],
      [personalStore, "GetMyAchievements"],
      [personalStore, "GetGlobalAchievements"],
      [detailsStore, "GetAchievements"],
      [progressCache, "GetAchievementProgress"],
      [progressCache, "BGameHasAchievements"],
    ].map(([target, name]) => ({ target, name, original: target[name] }));

    const steam = { appid: 620, app_type: 1, display_name: "Steam Game" };
    const highSteamId = 2_590_000_000;
    const highSteam = { appid: highSteamId, app_type: 1, display_name: "High ID Steam Game" };
    const shortcutId = 2_580_000_000;
    const shortcut = { appid: shortcutId, app_type: 1073741824, display_name: "Shortcut" };
    const overviews = new Map([[620, steam], [highSteamId, highSteam], [shortcutId, shortcut]]);
    const achievement = {
      achievementId: "123", providerId: "retroachievements", gameId: "456",
      title: "RA achievement", description: "Earned in RA", badgeImageUrl: "ra-image",
      isUnlocked: true, unlockedAt: 1_760_000_000_000, metrics: [],
    };
    const projectionFor = (appId) => ({
      status: "ready", appId: String(appId), raGameId: "456", title: "RA Game",
      mode: "both", achievements: [achievement], earned: 1, total: 1,
    });
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
        createReactTreePatcher: (_selectors, callback) => callback,
        findInReactTree: (node, predicate) => predicate(node) ? node : undefined,
        findModuleExport,
        applyHookStubs() {},
        removeHookStubs() {},
        Focusable: () => null,
        Navigation: { Navigate() {} },
        afterPatch: (target, name, handler) => patch(target, name, handler, "after"),
        replacePatch: (target, name, handler) => patch(target, name, handler, "replace"),
      },
    });
    mock.module(pathToFileURL(resolve("src/platform/decky/decky-native-retroachievements-projection.ts")).href, {
      exports: {
        readDeckyNativeRetroAchievementsProjection(appId, mode) {
          projectionReads.push([appId, mode]);
          return projectionFor(appId);
        },
        async loadDeckyNativeRetroAchievementsProjection(appId) {
          projectionLoads.push(appId);
          const next = queuedProjectionLoads.shift();
          if (next instanceof Error) throw next;
          return typeof next === "function" ? next(appId) : next ?? projectionFor(appId);
        },
        invalidateDeckyNativeRetroAchievementsProjection(appId) { projectionInvalidations.push(appId); },
        disposeDeckyNativeRetroAchievementsProjection() { projectionDisposals += 1; },
      },
    });
    mock.module(pathToFileURL(resolve("src/platform/decky/decky-native-retroachievements-activity.tsx")).href, {
      exports: {
        DeckyNativeRetroAchievementsActivity() { return null; },
      },
    });

    const { ensureDeckyNativeSteamAchievementsRegistered } = await import("./src/platform/decky/decky-native-steam-achievements.ts");
    const { publishDeckyRaNativeAchievementInvalidation } = await import("./src/platform/decky/decky-ra-native-achievement-invalidation.ts");
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
    if (!shortcutSections.has("achievements")) {
      await new Promise((resolve) => setImmediate(resolve));
      shortcutSections = shortcutPage.GetSections(shortcut, { unAppID: shortcutId });
    }
    assert.deepEqual([...shortcutSections], ["notes", "achievements", "activity"]);
    const routeProps = {
      renderFunc() { return { props: { className: "inner-container", children: [] } }; },
    };
    const originalRouteRender = routeProps.renderFunc;
    routeRecords[0].callback(routeProps);
    const raRouteChildren = routeProps.renderFunc().props.children;
    assert.equal(raRouteChildren.length, 1);
    assert.equal(raRouteChildren[0].props["data-achievement-companion-native-ra-spacing"], "true");
    assert.match(raRouteChildren[0].props.children, /padding-inline-start: 46px !important/u);
    window.location.pathname = "/library/app/620";
    assert.deepEqual(routeProps.renderFunc().props.children, []);
    window.location.pathname = "/library/app/" + shortcutId;
    const activityContent = new ActivityFeed({ appid: shortcutId }).render();
    assert.equal(activityContent.type.name, "DeckyNativeRetroAchievementsActivity");
    assert.equal(activityContent.props.appId, shortcutId);
    assert.equal(activityContent.props.items[0].achievement.achievementId, "123");
    assert.equal(new ActivityFeed({ appid: 620 }).render(), "original-activity-620");
    assert.equal(new ActivityFeed({ appid: highSteamId }).render(), "original-activity-" + highSteamId);
    assert.equal(detailsStore.GetAchievements(shortcutId).vecHighlight[0].strID, "ra:123");
    assert.deepEqual(Object.keys(personalStore.GetMyAchievements(shortcutId).data.achieved), ["ra:123"]);
    assert.equal(progressCache.BGameHasAchievements(shortcutId), true);
    assert.equal(observableBoxes.length, 1);
    assert.equal(observableBoxes[0].reads > 0, true);
    const revisionWritesBeforeRefresh = observableBoxes[0].writes;
    publishDeckyRaNativeAchievementInvalidation("provider-refreshed");
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
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual([...shortcutPage.GetSections(shortcut, { unAppID: shortcutId })], ["notes", "achievements", "activity"]);
      publishDeckyRaNativeAchievementInvalidation("provider-refreshed");
    }

    let releaseNewPageLoad;
    queuedProjectionLoads.push(() => new Promise((resolve) => { releaseNewPageLoad = resolve; }));
    const newlyMountedPage = new LibraryPage();
    const loadsBeforeNewPage = projectionLoads.length;
    assert.deepEqual([...newlyMountedPage.GetSections(shortcut, { unAppID: shortcutId })], ["notes"]);
    assert.equal(projectionLoads.length, loadsBeforeNewPage + 1);
    assert.equal(typeof releaseNewPageLoad, "function");
    assert.notEqual(detailsStore.GetAchievements(shortcutId)?.vecHighlight?.[0]?.strID, "ra:123");
    releaseNewPageLoad(projectionFor(shortcutId));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual([...newlyMountedPage.GetSections(shortcut, { unAppID: shortcutId })], ["notes", "achievements", "activity"]);

    const updatesBeforeCleanup = newlyMountedPage.forceUpdates;
    cleanup();
    assert.equal(routeRecords[0].removed, true);
    assert.equal(lifetimeUnregisters, 1);
    assert.equal(newlyMountedPage.forceUpdates, updatesBeforeCleanup + 1);
    assert.equal(patchRecords.every((record) => record.unpatched), true);
    assert.equal(routeProps.renderFunc, originalRouteRender);
    assert.equal(projectionDisposals, 1);
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
