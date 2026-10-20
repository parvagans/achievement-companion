import { routerHook } from "@decky/api";
import { afterPatch, appDetailsClasses, applyHookStubs, callOriginal, createModuleMapping, createReactTreePatcher, findInReactTree, findModuleByExport, findModuleExport, Navigation, removeHookStubs, replacePatch, type Patch } from "@decky/ui";
import { createElement, useLayoutEffect, useRef, type ReactElement } from "react";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN } from "./decky-game-page-achievement-route";
import {
  disposeDeckyNativeRetroAchievementsProjection,
  invalidateDeckyNativeRetroAchievementsProjection,
  loadDeckyNativeRetroAchievementsProjection,
  readDeckyNativeRetroAchievementsProjection,
  type NativeRetroAchievementsProjection,
} from "./decky-native-retroachievements-projection";
import {
  toNativeSteamAchievements,
  type NativeSteamAchievements,
} from "./decky-native-steam-achievement-conversion";
import {
  isNativeSteamShortcutOverview,
  toNativeSteamAchievementProgressPercentage,
  toNativeSteamGlobalAchievementResponse,
  toNativeSteamPersonalAchievementResponse,
  withNativeSteamAchievementsSection,
  withNativeSteamCommunitySection,
  withNativeSteamRecentActivitySection,
} from "./decky-native-steam-achievement-contract";
import { getNativeRetroAchievementsActivityItems } from "./decky-native-retroachievements-activity-model";
import { DeckyNativeRetroAchievementsActivity, type NativeSteamActivityStyles } from "./decky-native-retroachievements-activity";
import { DeckyNativeRetroAchievementsCommunity, type NativeSteamCommunitySectionPrimitives } from "./decky-native-retroachievements-community";
import { renderDeckyNativeRetroAchievementsGameInfo } from "./decky-native-retroachievements-game-info";
import { buildNativeRetroAchievementsCommunityModels } from "./decky-native-retroachievements-community-model";
import { subscribeDeckyRaNativeAchievementInvalidation } from "./decky-ra-native-achievement-invalidation";
import { readDeckySettings } from "./decky-settings";

interface SteamAppOverview {
  readonly appid?: number;
  readonly app_type?: number;
  readonly display_name?: string;
  readonly m_setStoreTags?: Iterable<unknown>;
  readonly m_setStoreCategories?: Iterable<unknown>;
}

interface SteamAppDetailsStore {
  GetAchievements(appId: number): unknown;
}

interface SteamAchievementProgressCache {
  BGameHasAchievements(appId: number): boolean;
  GetAchievementProgress(appId: number): unknown;
}

interface SteamPersonalAchievementsStore {
  GetMyAchievements(appId: number): unknown;
  GetGlobalAchievements(appId: number): unknown;
}

interface SteamLibraryPageInstance {
  forceUpdate?: () => void;
}

interface SteamLibraryPageClass {
  readonly prototype: SteamLibraryPageInstance & {
    GetSections(overview: SteamAppOverview, details: unknown): Set<string>;
  };
}

interface SteamActivityFeedClass {
  readonly prototype: {
    render(): unknown;
    ShowMoreContent(): void;
    OnPostStatusClicked(value: string): Promise<void>;
  };
}

interface SteamCommunityFeedClass {
  readonly prototype: {
    render(): unknown;
    BindInnerContainer(value: unknown): void;
    AutoLoadAdditionalContent(): void;
    LoadAdditionalContent(): void;
  };
}

interface SteamReactFiber {
  readonly type?: unknown;
  readonly stateNode?: HTMLElement;
  readonly child?: SteamReactFiber | null;
  readonly sibling?: SteamReactFiber | null;
}

function findSteamFiber(
  start: SteamReactFiber | null | undefined,
  predicate: (fiber: SteamReactFiber) => boolean,
): SteamReactFiber | undefined {
  const visited = new Set<SteamReactFiber>();
  const visit = (fiber: SteamReactFiber | null | undefined, depth: number): SteamReactFiber | undefined => {
    if (fiber === undefined || fiber === null || depth > 100 || visited.has(fiber)) return undefined;
    visited.add(fiber);
    if (predicate(fiber)) return fiber;
    return visit(fiber.child, depth + 1) ?? visit(fiber.sibling, depth);
  };
  return visit(start, 0);
}

interface SteamObservableBox {
  get(): number;
  set(value: number): void;
}

interface SteamObservableFactory {
  box(value: number): SteamObservableBox;
  map: (...args: unknown[]) => unknown;
}

interface NativeSteamRuntimeWindow {
  appStore?: {
    GetAppOverviewByAppID(appId: number): SteamAppOverview | null;
  };
  appDetailsStore?: SteamAppDetailsStore;
  appAchievementProgressCache?: SteamAchievementProgressCache;
  SteamClient?: {
    GameSessions?: {
      RegisterForAppLifetimeNotifications(callback: (event: { unAppID?: number; bRunning?: boolean }) => void): { unregister(): void };
    };
  };
}

function toAppId(value: unknown): number | undefined {
  const appId = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(appId) && appId > 0 ? appId : undefined;
}

function isShortcutAppId(runtime: NativeSteamRuntimeWindow, appId: number): boolean {
  const overview = runtime.appStore?.GetAppOverviewByAppID(appId);
  return isNativeSteamShortcutOverview(overview, appId);
}

function currentMode(): RetroAchievementsAchievementMode {
  return readDeckySettings().retroAchievementsAchievementMode;
}

function findSteamLibraryPageClass(): SteamLibraryPageClass | undefined {
  return findModuleExport((value: unknown) => {
    if (typeof value !== "function") return false;
    const prototype = (value as SteamLibraryPageClass).prototype as unknown as Record<string, unknown>;
    return typeof prototype?.["GetSections"] === "function"
      && typeof prototype["RegisterSection"] === "function"
      && typeof prototype["SeekToSection"] === "function"
      && typeof prototype["onGameInfoToggle"] === "function";
  }) as SteamLibraryPageClass | undefined;
}

function findSteamActivityFeedClass(): SteamActivityFeedClass | undefined {
  const wrapper = findModuleExport((value: unknown) => typeof value === "function"
    && String(value).includes("AppDetailsActivitySectionDays")
    && String(value).includes("nDaysToDisplay")) as ((props: { appid: number }) => ReactElement) | undefined;
  if (wrapper === undefined) return undefined;
  try {
    applyHookStubs({
      useContext: (context: { _currentValue?: unknown }) => context?._currentValue ?? { location: window.location },
    });
    const feedClass = wrapper({ appid: 0 })?.type as SteamActivityFeedClass | undefined;
    if (typeof feedClass?.prototype?.render === "function"
      && typeof feedClass.prototype.ShowMoreContent === "function"
      && typeof feedClass.prototype.OnPostStatusClicked === "function") {
      return feedClass;
    }
  } catch {
    // Steam may change the wrapper's hooks or component; leave its native feed intact.
  } finally {
    removeHookStubs();
  }
  return undefined;
}

function findSteamCommunityFeedClass(): SteamCommunityFeedClass | undefined {
  const wrapperModules = createModuleMapping((module: unknown) => {
    if (typeof module !== "object" || module === null) return false;
    return Object.values(module as Record<string, unknown>).some((value) => {
      if (typeof value !== "function") return false;
      const source = String(value);
      return source.includes("useId()") && source.includes("labelId") && source.includes("..." );
    });
  });
  for (const module of wrapperModules.values()) {
    if (typeof module !== "object" || module === null) continue;
    for (const value of Object.values(module as Record<string, unknown>)) {
      if (typeof value !== "function") continue;
      const source = String(value);
      if (!source.includes("useId()") || !source.includes("labelId") || !source.includes("...")) continue;
      try {
        applyHookStubs({ useId: () => "achievement-companion-community" });
        const feedClass = (value as (props: { appid: number }) => ReactElement)({ appid: 0 })?.type as SteamCommunityFeedClass | undefined;
        if (typeof feedClass?.prototype?.render === "function"
          && typeof feedClass.prototype.BindInnerContainer === "function"
          && typeof feedClass.prototype.AutoLoadAdditionalContent === "function"
          && typeof feedClass.prototype.LoadAdditionalContent === "function") {
          return feedClass;
        }
      } catch {
        // Continue through the other small useId wrappers until the Community feed class is found.
      } finally {
        removeHookStubs();
      }
    }
  }
  return undefined;
}

function findSteamCommunitySectionPrimitives(): NativeSteamCommunitySectionPrimitives | undefined {
  const module = findModuleByExport((value: unknown) => {
    if (typeof value !== "function") return false;
    const source = String(value);
    return source.includes("BodyGutter") && source.includes("spacing") && source.includes("children");
  }) as Record<string, unknown> | undefined;
  if (module === undefined) return undefined;
  const exports = Object.values(module);
  const Body = exports.find((value) => {
    if (typeof value !== "function") return false;
    const source = String(value);
    return source.includes("BodyGutter") && source.includes("spacing") && source.includes("children");
  });
  const Section = exports.find((value) => {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as { readonly $$typeof?: unknown; readonly type?: unknown };
    return candidate.$$typeof !== undefined && typeof candidate.type === "function";
  });
  return Body !== undefined && Section !== undefined
    ? { Body, Section } as NativeSteamCommunitySectionPrimitives
    : undefined;
}

function findSteamPersonalAchievementsStore(): SteamPersonalAchievementsStore | undefined {
  return findModuleExport((value: unknown) => {
    if (typeof value !== "object" || value === null) return false;
    const record = value as Record<string, unknown>;
    return typeof record["GetMyAchievements"] === "function"
      && typeof record["GetGlobalAchievements"] === "function"
      && typeof record["GetMyAchievementsByID"] === "function"
      && typeof (record["m_mapMyAchievements"] as { get?: unknown } | undefined)?.get === "function"
      && typeof (record["m_mapGlobalAchievements"] as { get?: unknown } | undefined)?.get === "function";
  }) as SteamPersonalAchievementsStore | undefined;
}

function isCurrentLibraryRootPage(appId: number): boolean {
  const match = window.location.pathname.match(/^\/(?:routes\/)?library\/app\/(\d+)(?:\/tab\/[^/]+)?\/?$/u);
  return match?.[1] === String(appId);
}

function identityValues(value: unknown): readonly string[] {
  if (typeof value !== "object" || value === null || typeof (value as Iterable<unknown>)[Symbol.iterator] !== "function") {
    return [];
  }
  try {
    return Array.from(value as Iterable<unknown>, String).sort();
  } catch {
    return [];
  }
}

interface ActivePage {
  readonly appId: number;
  readonly instance: SteamLibraryPageInstance;
  readonly identity: string;
  readonly mode: RetroAchievementsAchievementMode;
  verified: boolean;
}

const unavailableAchievementsResponse = { error: 2 };
const nativeAchievementSpacingStyleKey = "achievement-companion-native-achievement-spacing";
const nativeGamePageBackBoundaryKey = "achievement-companion-native-game-page-back-boundary";
// Steam's AllAchieved row needs medal clearance even if Activity CSS loads later.
const nativeAchievementSpacingCss = "._2YS0EBJmY2Rvs07zZ90UIJ { padding-inline-start: 46px !important; }";

function DeckyNativeGamePageBackBoundary(): ReactElement {
  const anchorRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const ownerWindow = anchorRef.current?.ownerDocument.defaultView;
    if (ownerWindow === undefined || ownerWindow === null) return;

    const onCancel = (event: Event): void => {
      const focused = ownerWindow.document.querySelector<HTMLElement>(".gpfocus");
      const tab = focused?.matches('[role="tab"]') === true ? focused : focused?.closest('[role="tab"]');
      if (tab === undefined || tab === null) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      Navigation.NavigateBack();
    };

    ownerWindow.addEventListener("vgp_oncancel", onCancel, true);
    return () => { ownerWindow.removeEventListener("vgp_oncancel", onCancel, true); };
  }, []);

  return createElement("span", { ref: anchorRef, hidden: true, "aria-hidden": "true" });
}

let registeredCleanup: (() => void) | undefined;

export function ensureDeckyNativeSteamAchievementsRegistered(): () => void {
  if (registeredCleanup !== undefined) return registeredCleanup;
  const runtime = window as unknown as NativeSteamRuntimeWindow;
  const patches: Patch[] = [];
  const attempts = new Map<number, { readonly mode: RetroAchievementsAchievementMode }>();
  const shortcutIdentities = new Map<number, string>();
  const models = new WeakMap<NativeRetroAchievementsProjection, NativeSteamAchievements>();
  const managedAppIds = new Set<number>();
  const unavailableAppIds = new Set<number>();
  const revisions = new Map<number, SteamObservableBox>();
  const communityPrimitives = findSteamCommunitySectionPrimitives();
  let activePage: ActivePage | undefined;
  let observableFactory: SteamObservableFactory | undefined;
  let pagePatched = false;
  let detailsPatched = false;
  let personalPatched = false;
  let progressPatched = false;
  let activityPatched = false;
  let communityPatched = false;
  let gameInfoMount: { readonly native: HTMLElement; readonly host: HTMLElement; readonly originalDisplay: string; projection: NativeRetroAchievementsProjection } | undefined;
  let gameInfoSyncTimer: ReturnType<typeof setTimeout> | undefined;
  let gameInfoSyncAttempts = 0;
  let gameInfoObservedDocument: Document | undefined;
  let gameInfoObserver: MutationObserver | undefined;
  let routeRenderPatch: Patch | undefined;
  let routeRenderOwner: object | undefined;
  let disposed = false;

  function revisionFor(appId: number): SteamObservableBox | undefined {
    let revision = revisions.get(appId);
    if (revision !== undefined) return revision;
    observableFactory ??= findModuleExport((value: unknown) =>
      typeof value === "function"
      && typeof (value as unknown as SteamObservableFactory).box === "function"
      && typeof (value as unknown as SteamObservableFactory).map === "function",
    ) as SteamObservableFactory | undefined;
    revision = observableFactory?.box(0);
    if (revision !== undefined) revisions.set(appId, revision);
    return revision;
  }

  function notifyRevision(appId: number): void {
    const revision = revisions.get(appId);
    if (revision !== undefined) revision.set(revision.get() + 1);
  }

  function notifyAllRevisions(): void {
    for (const appId of revisions.keys()) notifyRevision(appId);
  }

  function getProjection(appId: number): NativeRetroAchievementsProjection | undefined {
    if (disposed || !isShortcutAppId(runtime, appId)) return undefined;
    if (activePage?.appId === appId && !activePage.verified) return undefined;
    return readDeckyNativeRetroAchievementsProjection(String(appId), currentMode());
  }

  function getModel(appId: number): NativeSteamAchievements | undefined {
    const projection = getProjection(appId);
    if (projection === undefined) return undefined;
    let model = models.get(projection);
    if (model === undefined) {
      model = toNativeSteamAchievements(
        projection.achievements,
        projection.mode,
        projection.totalPlayers,
      );
      models.set(projection, model);
    }
    return model;
  }

  function rerenderActivePage(appId: number): void {
    if (!disposed && activePage?.appId === appId && isCurrentLibraryRootPage(appId)) {
      activePage.instance.forceUpdate?.();
      scheduleGameInfoSync();
    }
  }

  function clearGameInfoMount(): void {
    const mount = gameInfoMount;
    if (mount === undefined) return;
    gameInfoMount = undefined;
    mount.host.remove();
    mount.native.style.display = mount.originalDisplay;
  }

  function syncGameInfo(): void {
    if (disposed) return;
    const page = activePage;
    const appId = page?.appId;
    const pageFiber = page?.instance as (SteamLibraryPageInstance & { readonly _reactInternals?: SteamReactFiber }) | undefined;
    const pageHost = findSteamFiber(pageFiber?._reactInternals, (fiber) => fiber.stateNode?.nodeType === 1)?.stateNode;
    const ownerDocument = pageHost?.ownerDocument;
    if (ownerDocument !== undefined && ownerDocument !== gameInfoObservedDocument && ownerDocument.body !== null) {
      gameInfoObserver?.disconnect();
      gameInfoObservedDocument = ownerDocument;
      gameInfoObserver = new MutationObserver(() => {
        if (/\/tab\/GameInfo\/?$/u.test(window.location.pathname) || gameInfoMount !== undefined) scheduleGameInfoSync();
      });
      gameInfoObserver.observe(ownerDocument.body, { childList: true, subtree: true });
    }
    const projection = appId !== undefined && page?.verified === true && /\/tab\/GameInfo\/?$/u.test(window.location.pathname)
      ? getProjection(appId)
      : undefined;
    if (projection === undefined) {
      clearGameInfoMount();
      return;
    }
    // The native cover component owns the non-Steam notice and portrait.
    // Its siblings are Quick Links and Steam's collection section, which stay intact.
    const gameInfoFiber = findSteamFiber(pageFiber?._reactInternals, (fiber) =>
      typeof fiber.type === "function" && String(fiber.type).includes("GetCollectionListForAppID"),
    );
    const coverFiber = findSteamFiber(gameInfoFiber?.child, (fiber) =>
      typeof fiber.type === "function"
      && typeof (fiber.type as { readonly prototype?: { readonly setBoxHeight?: unknown } }).prototype?.setBoxHeight === "function",
    );
    const native = findSteamFiber(coverFiber?.child, (fiber) => fiber.stateNode?.nodeType === 1)?.stateNode;
    if (native === undefined || native.parentElement === null) {
      clearGameInfoMount();
      if (gameInfoSyncAttempts < 20) {
        gameInfoSyncAttempts += 1;
        scheduleGameInfoSync();
      }
      return;
    }
    gameInfoSyncAttempts = 0;
    if (gameInfoMount?.native === native && gameInfoMount.host.isConnected) {
      if (gameInfoMount.projection !== projection) {
        gameInfoMount.projection = projection;
        renderDeckyNativeRetroAchievementsGameInfo(gameInfoMount.host, projection);
      }
      return;
    }
    clearGameInfoMount();
    const host = native.ownerDocument.createElement("div");
    host.dataset["achievementCompanionNativeGameInfoHost"] = "true";
    native.parentElement.insertBefore(host, native);
    const originalDisplay = native.style.display;
    native.style.display = "none";
    gameInfoMount = { native, host, originalDisplay, projection };
    renderDeckyNativeRetroAchievementsGameInfo(host, projection);
  }

  function scheduleGameInfoSync(): void {
    if (disposed || gameInfoSyncTimer !== undefined) return;
    gameInfoSyncTimer = setTimeout(() => {
      gameInfoSyncTimer = undefined;
      syncGameInfo();
    }, 80);
  }

  function loadForPage(appId: number): void {
    const mode = currentMode();
    if (attempts.get(appId)?.mode === mode) return;
    const attempt = { mode };
    attempts.set(appId, attempt);
    unavailableAppIds.delete(appId);
    const page = activePage?.appId === appId ? activePage : undefined;
    void loadDeckyNativeRetroAchievementsProjection(String(appId), mode).then((result) => {
      if (disposed || currentMode() !== mode || attempts.get(appId) !== attempt) return;
      if (result.status === "ready" && result.appId === String(appId)) {
        managedAppIds.add(appId);
        if (page !== undefined && activePage === page) page.verified = true;
        notifyRevision(appId);
        rerenderActivePage(appId);
      } else {
        attempts.delete(appId);
        unavailableAppIds.add(appId);
        notifyRevision(appId);
      }
    }).catch(() => {
      if (disposed || attempts.get(appId) !== attempt) return;
      attempts.delete(appId);
      unavailableAppIds.add(appId);
      notifyRevision(appId);
    });
  }

  function installStorePatches(): void {
    if (detailsPatched && personalPatched && progressPatched) return;
    const detailsStore = runtime.appDetailsStore;
    const progressCache = runtime.appAchievementProgressCache;
    const personalStore = findSteamPersonalAchievementsStore();
    if (!detailsPatched && detailsStore !== undefined && typeof detailsStore.GetAchievements === "function") {
      patches.push(replacePatch(detailsStore, "GetAchievements", ([rawAppId]) => {
        const appId = toAppId(rawAppId);
        if (appId === undefined || !isShortcutAppId(runtime, appId)) return callOriginal;
        return getModel(appId) ?? callOriginal;
      }));
      detailsPatched = true;
    }
    if (!personalPatched && personalStore !== undefined) {
      patches.push(replacePatch(personalStore, "GetMyAchievements", ([rawAppId]) => {
        const appId = toAppId(rawAppId);
        if (appId === undefined || !isShortcutAppId(runtime, appId)) return callOriginal;
        revisionFor(appId)?.get();
        const model = getModel(appId);
        if (model === undefined) {
          if (!managedAppIds.has(appId)) return callOriginal;
          if (!unavailableAppIds.has(appId)) {
            loadForPage(appId);
            return { loading: true };
          }
          return unavailableAchievementsResponse;
        }
        return toNativeSteamPersonalAchievementResponse(model);
      }));
      patches.push(replacePatch(personalStore, "GetGlobalAchievements", ([rawAppId]) => {
        const appId = toAppId(rawAppId);
        if (appId === undefined || !isShortcutAppId(runtime, appId)) return callOriginal;
        revisionFor(appId)?.get();
        const model = getModel(appId);
        if (model === undefined) {
          if (!managedAppIds.has(appId)) return callOriginal;
          if (!unavailableAppIds.has(appId)) {
            loadForPage(appId);
            return { loading: true };
          }
          return unavailableAchievementsResponse;
        }
        return toNativeSteamGlobalAchievementResponse(model);
      }));
      personalPatched = true;
    }
    if (!progressPatched && progressCache !== undefined && typeof progressCache.GetAchievementProgress === "function") {
      patches.push(replacePatch(progressCache, "GetAchievementProgress", ([rawAppId]) => {
        const appId = toAppId(rawAppId);
        if (appId === undefined || !isShortcutAppId(runtime, appId)) return callOriginal;
        const model = getModel(appId);
        if (model !== undefined) return toNativeSteamAchievementProgressPercentage(model);
        return callOriginal;
      }));
      if (typeof progressCache.BGameHasAchievements === "function") {
        patches.push(replacePatch(progressCache, "BGameHasAchievements", ([rawAppId]) => {
          const appId = toAppId(rawAppId);
          if (appId === undefined || !isShortcutAppId(runtime, appId)) return callOriginal;
          const model = getModel(appId);
          if (model !== undefined) return model.nTotal > 0;
          return managedAppIds.has(appId) ? false : callOriginal;
        }));
      }
      progressPatched = true;
    }
  }

  function installPagePatch(): void {
    if (pagePatched) return;
    const pageClass = findSteamLibraryPageClass();
    if (pageClass === undefined) return;
    patches.push(afterPatch(pageClass.prototype, "GetSections", function (this: SteamLibraryPageInstance, [rawOverview, rawDetails], originalSections) {
      installStorePatches();
      const overview = rawOverview as SteamAppOverview;
      const appId = toAppId(overview?.appid);
      if (appId === undefined || !isNativeSteamShortcutOverview(overview, appId)) {
        if (activePage?.instance === this) activePage = undefined;
        return originalSections;
      }
      const details = rawDetails as { unAppID?: number } | undefined;
      if (details?.unAppID !== appId) return originalSections;
      const shortcutDetails = rawDetails as {
        strShortcutExe?: string;
        strShortcutStartDir?: string;
        strShortcutLaunchOptions?: string;
      };
      const identity = JSON.stringify([
        overview.display_name,
        shortcutDetails.strShortcutExe,
        shortcutDetails.strShortcutStartDir,
        shortcutDetails.strShortcutLaunchOptions,
        identityValues(overview.m_setStoreTags),
        identityValues(overview.m_setStoreCategories),
      ]);
      const previousIdentity = shortcutIdentities.get(appId);
      if (previousIdentity !== undefined && previousIdentity !== identity) {
        invalidateDeckyNativeRetroAchievementsProjection(String(appId));
        attempts.delete(appId);
        unavailableAppIds.delete(appId);
        notifyRevision(appId);
      }
      shortcutIdentities.set(appId, identity);
      const mode = currentMode();
      if (activePage?.appId !== appId || activePage.instance !== this || activePage.identity !== identity || activePage.mode !== mode) {
        attempts.delete(appId);
        unavailableAppIds.delete(appId);
        activePage = { appId, instance: this, identity, mode, verified: false };
      }
      if (!activePage.verified) {
        // The backend shortcut identity includes platform tags that are absent from app details.
        // Recheck it on each page mount before showing any previously committed projection.
        loadForPage(appId);
        return originalSections;
      }
      const projection = getProjection(appId);
      if (projection === undefined) {
        loadForPage(appId);
        return originalSections;
      }
      const model = getModel(appId);
      if (!detailsPatched || !personalPatched || model === undefined) {
        return originalSections;
      }
      const achievementSections = withNativeSteamAchievementsSection(originalSections, overview, appId, model);
      const activitySections = withNativeSteamRecentActivitySection(
        achievementSections,
        overview,
        appId,
        getNativeRetroAchievementsActivityItems(projection.achievements).length > 0,
      );
      const communityModels = buildNativeRetroAchievementsCommunityModels({
        stats: projection.communityStats,
        ...(projection.achievementsAvailableSince !== undefined
          ? { achievementsAvailableSince: projection.achievementsAvailableSince }
          : {}),
      });
      return withNativeSteamCommunitySection(
        activitySections,
        overview,
        appId,
        communityPrimitives !== undefined && communityModels !== undefined,
      );
    }));
    pagePatched = true;
  }

  function installActivityPatch(): void {
    if (activityPatched) return;
    const feedClass = findSteamActivityFeedClass();
    if (feedClass === undefined) return;
    const friendStore = findModuleExport((value: unknown) => {
      if (typeof value !== "object" || value === null) return false;
      const record = value as Record<string, unknown>;
      return record["currentUserSteamID"] !== undefined && typeof record["GetFriendState"] === "function";
    }) as {
      currentUserSteamID?: unknown;
      GetFriendState(id: unknown): {
        persona?: { m_strPlayerName?: string; avatar_url?: string };
      } | undefined;
    } | undefined;
    const activityStyles = findModuleExport((value: unknown) => {
      if (typeof value !== "object" || value === null) return false;
      const record = value as Record<string, unknown>;
      return typeof record["AppActivityDay"] === "string"
        && typeof record["EventHeadline"] === "string"
        && typeof record["ActivityAchievementUnlocked"] === "string"
        && typeof record["PrimaryAchievement"] === "string";
    }) as NativeSteamActivityStyles | undefined;
    const tileStyles = findModuleExport((value: unknown) => {
      if (typeof value !== "object" || value === null) return false;
      const record = value as Record<string, unknown>;
      return typeof record["Featured"] === "string"
        && typeof record["AchievementHoverContainer"] === "string"
        && typeof record["TextSection"] === "string"
        && typeof record["Achieved"] === "string";
    }) as NativeSteamActivityStyles | undefined;
    const styles = { ...activityStyles, ...tileStyles };
    patches.push(replacePatch(feedClass.prototype, "render", function (this: { props?: { appid?: number } }) {
      const appId = toAppId(this.props?.appid);
      const page = activePage;
      if (appId === undefined || page?.appId !== appId || !page.verified || !isCurrentLibraryRootPage(appId)) return callOriginal;
      const projection = getProjection(appId);
      if (projection === undefined) return callOriginal;
      const items = getNativeRetroAchievementsActivityItems(projection.achievements);
      if (items.length === 0) return callOriginal;
      const friend = friendStore?.currentUserSteamID === undefined
        ? undefined
        : friendStore.GetFriendState(friendStore.currentUserSteamID);
      return createElement(DeckyNativeRetroAchievementsActivity, {
        items,
        appId,
        actorName: friend?.persona?.m_strPlayerName,
        actorAvatarUrl: friend?.persona?.avatar_url,
        styles,
      });
    }));
    activityPatched = true;
  }

  function installCommunityPatch(): void {
    if (communityPatched || communityPrimitives === undefined) return;
    const feedClass = findSteamCommunityFeedClass();
    if (feedClass === undefined) return;
    patches.push(replacePatch(feedClass.prototype, "render", function (this: { props?: { appid?: number } }) {
      const appId = toAppId(this.props?.appid);
      const page = activePage;
      if (appId === undefined || page?.appId !== appId || !page.verified || !isCurrentLibraryRootPage(appId)) return callOriginal;
      const projection = getProjection(appId);
      if (projection === undefined) return callOriginal;
      const models = buildNativeRetroAchievementsCommunityModels({
        stats: projection.communityStats,
        ...(projection.achievementsAvailableSince !== undefined
          ? { achievementsAvailableSince: projection.achievementsAvailableSince }
          : {}),
      });
      if (models === undefined) return callOriginal;
      return createElement(DeckyNativeRetroAchievementsCommunity, {
        models,
        primitives: communityPrimitives,
      });
    }));
    communityPatched = true;
  }

  const routePatch = routerHook.addPatch(DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN, (tree) => {
    installStorePatches();
    installPagePatch();
    installActivityPatch();
    installCommunityPatch();
    scheduleGameInfoSync();
    const routeProps = findInReactTree(tree, (node) => !!node?.renderFunc);
    if (routeProps !== routeRenderOwner) {
      routeRenderPatch?.unpatch();
      routeRenderPatch = undefined;
      routeRenderOwner = undefined;
      if (typeof routeProps === "object" && routeProps !== null && typeof routeProps.renderFunc === "function") {
        routeRenderPatch = afterPatch(routeProps, "renderFunc", createReactTreePatcher(
          [(node) => findInReactTree(node, (entry) => !!entry?.props?.children?.props?.overview)?.props?.children],
          (_args, ret) => {
            const appId = toAppId(window.location.pathname.match(/^\/(?:routes\/)?library\/app\/(\d+)/u)?.[1]);
            const container = findInReactTree(ret, (entry) =>
              Array.isArray(entry?.props?.children)
              && entry?.props?.className?.includes(appDetailsClasses.InnerContainer),
            ) as { props?: { children?: unknown[] } } | undefined;
            const children = container?.props?.children;
            if (container?.props === undefined || !Array.isArray(children)) return ret;
            const withoutSpacing = children.filter((child) =>
              ![nativeAchievementSpacingStyleKey, nativeGamePageBackBoundaryKey].includes(
                String((child as { key?: unknown } | null)?.key),
              ),
            );
            if (appId !== undefined) {
              withoutSpacing.push(createElement("style", {
                key: nativeAchievementSpacingStyleKey,
                "data-achievement-companion-native-achievement-spacing": "true",
                children: nativeAchievementSpacingCss,
              }));
              if (activePage?.appId === appId && activePage.verified) {
                withoutSpacing.push(createElement(DeckyNativeGamePageBackBoundary, {
                  key: nativeGamePageBackBoundaryKey,
                }));
              }
            }
            container.props.children = withoutSpacing;
            return ret;
          },
          nativeAchievementSpacingStyleKey,
        ));
        routeRenderOwner = routeProps;
      }
    }
    return tree as never;
  });
  installStorePatches();
  installPagePatch();
  installActivityPatch();
  installCommunityPatch();
  scheduleGameInfoSync();
  const unsubscribeInvalidation = subscribeDeckyRaNativeAchievementInvalidation(() => {
    invalidateDeckyNativeRetroAchievementsProjection();
    attempts.clear();
    shortcutIdentities.clear();
    unavailableAppIds.clear();
    if (activePage !== undefined) activePage.verified = false;
    notifyAllRevisions();
    if (activePage !== undefined) {
      rerenderActivePage(activePage.appId);
    }
  });
  const gameLifetimeHandle = runtime.SteamClient?.GameSessions?.RegisterForAppLifetimeNotifications((event) => {
    const appId = toAppId(event.unAppID);
    if (appId === undefined || event.bRunning !== false || !isShortcutAppId(runtime, appId)) return;
    invalidateDeckyNativeRetroAchievementsProjection(String(appId));
    attempts.delete(appId);
    unavailableAppIds.delete(appId);
    if (activePage?.appId === appId) activePage.verified = false;
    notifyRevision(appId);
    rerenderActivePage(appId);
  });

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    if (registeredCleanup === cleanup) registeredCleanup = undefined;
    unsubscribeInvalidation();
    gameLifetimeHandle?.unregister();
    routerHook.removePatch(DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN, routePatch);
    routeRenderPatch?.unpatch();
    routeRenderPatch = undefined;
    routeRenderOwner = undefined;
    invalidateDeckyNativeRetroAchievementsProjection();
    attempts.clear();
    shortcutIdentities.clear();
    unavailableAppIds.clear();
    managedAppIds.clear();
    gameInfoObserver?.disconnect();
    if (gameInfoSyncTimer !== undefined) clearTimeout(gameInfoSyncTimer);
    clearGameInfoMount();
    for (const patch of patches.reverse()) patch.unpatch();
    notifyAllRevisions();
    revisions.clear();
    const lastPage = activePage;
    activePage = undefined;
    lastPage?.instance.forceUpdate?.();
    disposeDeckyNativeRetroAchievementsProjection();
  };
  registeredCleanup = cleanup;
  return cleanup;
}
