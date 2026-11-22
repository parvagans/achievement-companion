import { routerHook } from "@decky/api";
import { afterPatch, appDetailsClasses, applyHookStubs, beforePatch, callOriginal, createModuleMapping, createReactTreePatcher, findInReactTree, findModuleByExport, findModuleExport, Navigation, removeHookStubs, replacePatch, Tabs, type Patch } from "@decky/ui";
import { createElement, useLayoutEffect, useRef, type ReactElement } from "react";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN } from "./decky-game-page-achievement-route";
import {
  disposeDeckyNativeRetroAchievementsProjection,
  invalidateDeckyNativeRetroAchievementsProjection,
  loadDeckyNativeRetroAchievementsProjection,
  readDeckyNativeRetroAchievementsProjection,
  verifyNativeProjectionLaunch,
  projectNativeRetroAchievementsDetail,
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
import type { NativeSteamCommunitySectionPrimitives } from "./decky-native-retroachievements-community";
import { DeckyRetroAchievementsCommunityResource } from "./decky-retroachievements-community-resource";
import { renderDeckyNativeRetroAchievementsGameInfo } from "./decky-native-retroachievements-game-info";
import { subscribeDeckyRaNativeAchievementInvalidation } from "./decky-ra-native-achievement-invalidation";
import { invalidateDeckyRaShortcutHashMatch } from "./decky-ra-shortcut-hash-cache";
import { invalidateDeckyRetroAchievementsMasteredGameDetail } from "./decky-retroachievements-mastered-detail-cache";
import { invalidateDeckyRetroAchievementsGameProgress, loadDeckyGameDetailState, readDeckyRetroAchievementsVerifiedSubsets } from "./decky-app-services";
import { getDeckyAccountRevision } from "./decky-account-revision";
import { corroborateDeckyRaPresenceLaunch, deckyRaPresence, notifyDeckyRaPresenceLifecycle, stopDeckyRaPresence } from "./decky-retroachievements-presence";
import { readDeckySettings } from "./decky-settings";
import { DeckyNativeUpNext, NATIVE_UP_NEXT_TAB_ID, withNativeUpNextTab } from "./decky-native-up-next";
import { cancelNativeAchievementJump, readNativeAchievementJumpReturn } from "./decky-native-achievement-jump";
import { observeNativeAchievementClassifications } from "./decky-native-achievement-classifications";
import { createNativeMyAchievementsEnhancer, installNativeYourStuffAchievementActions, observeNativeQueryAchievementActions, type NativeAchievementPinTarget, type NativeAchievementRow } from "./decky-native-achievement-actions";
import { isAchievementCompleteForPin } from "./decky-game-overview-recommendations";
import { loadDeckyProviderConfigs, readDeckyProviderConfigs } from "./providers/provider-config-store";
import { createSteamAchievementQueryProjection, isSteamAchievementQueryClient } from "./decky-native-steam-achievement-queries";
import { installNativeRaAchievementPinning, installNativeRaOverlayAchievementPinning } from "./decky-native-ra-achievement-pinning";
import { installNativeRaPlayBarAchievementAction, isNativeRaPlayBarRenderer } from "./decky-native-ra-play-bar";
import { buildNativeRaAchievementSets, type NativeRaAchievementSet } from "./decky-native-ra-achievement-sets";
import { installNativeRaOverlayGuides } from "./decky-native-ra-overlay-guides";

interface SteamAppOverview {
  readonly appid?: number;
  readonly app_type?: number;
  readonly display_name?: string;
  readonly m_setStoreTags?: Iterable<unknown>;
  readonly m_setStoreCategories?: Iterable<unknown>;
}

interface SteamAppDetailsStore {
  GetAppDetails?(appId: number): unknown;
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
  SteamUIStore?: {
    GetFocusedWindowInstance?(): { readonly RunningApps?: readonly SteamAppOverview[] } | undefined;
  };
  appAchievementProgressCache?: SteamAchievementProgressCache;
  friendStore?: { readonly currentUserSteamID?: { GetAccountID?(): number; ConvertTo64BitString?(): string } };
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

function isCurrentLibraryAchievementListPage(appId: number): boolean {
  const match = window.location.pathname.match(/^\/(?:routes\/)?library\/app\/(\d+)\/achievements\/my\/individual\/?$/u);
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
  upNextSelected?: boolean;
  nativeTabOnUpNextSelect?: string | undefined;
}

const unavailableAchievementsResponse = { error: 2 };
const nativeAchievementSpacingStyleKey = "achievement-companion-native-achievement-spacing";
const nativeGamePageBackBoundaryKey = "achievement-companion-native-game-page-back-boundary";
// Steam's AllAchieved row needs medal clearance even if Activity CSS loads later.
const nativeAchievementSpacingCss = "._2YS0EBJmY2Rvs07zZ90UIJ { padding-inline-start: 46px !important; }";

export function registerDeckyNativeGamePageBackBoundary(anchor: HTMLElement | null, onBack: () => void): (() => void) | undefined {
  const document = anchor?.ownerDocument;
  const ownerWindow = document?.defaultView;
  if (document === undefined || ownerWindow == null) return undefined;

  const onCancel = (event: Event): void => {
    if (event.defaultPrevented) return;
    const tab = document.querySelector<HTMLElement>(".gpfocus")?.closest('[role="tab"]');
    if (tab == null || tab.closest('[role="dialog"]') !== null) return;
    // A pinned dialog owns Back even if GamepadUI still reports the library tab
    // as focused while the portal opens or hands off to Achievement Details.
    if (document.querySelector("[data-ac-native-pinned-modal], [data-ac-native-pinned-details]") !== null) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    onBack();
  };

  ownerWindow.addEventListener("vgp_oncancel", onCancel, true);
  return () => { ownerWindow.removeEventListener("vgp_oncancel", onCancel, true); };
}

function DeckyNativeGamePageBackBoundary(): ReactElement {
  const anchorRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => registerDeckyNativeGamePageBackBoundary(anchorRef.current, () => Navigation.NavigateBack()), []);

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
  const achievementQueries = createSteamAchievementQueryProjection();
  let libraryQueryAppId: number | undefined;
  let librarySets: {
    readonly base: NativeRetroAchievementsProjection;
    readonly viewer: string;
    readonly accountRevision: number;
    sets: readonly NativeRaAchievementSet[];
  } | undefined;
  interface RunningAchievements {
    readonly queries: ReturnType<typeof createSteamAchievementQueryProjection>;
    request?: { gameId: string | undefined };
    projection?: NativeRetroAchievementsProjection;
    viewer?: string;
    accountRevision?: number;
  }
  const runningAchievements = new Map<number, RunningAchievements>();
  const gameLifetimeStates = new Map<number, boolean>();
  const pendingRunningStarts = new Set<number>();
  let overlayDetailsPatched = false;
  let queryClient: ReturnType<typeof findAchievementQueryClient>;
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
  let upNextPatched = false;
  let yourStuffActionsPatched = false;
  let nativeRaPinningPatched = false;
  let raPlayBarPatched = false;
  let overlayPinningPatched = false;
  let overlayGuidesPatched = false;
  const nativeRaPinningListeners = new Set<() => void>();
  let gameInfoMount: { readonly native: HTMLElement; readonly host: HTMLElement; readonly originalDisplay: string; projection: NativeRetroAchievementsProjection } | undefined;
  let gameInfoSyncTimer: ReturnType<typeof setTimeout> | undefined;
  let gameInfoSyncAttempts = 0;
  let gameInfoObservedDocument: Document | undefined;
  let gameInfoObserver: MutationObserver | undefined;
  let stopNativeAchievementClassifications: (() => void) | undefined;
  let stopNativeQueryAchievementActions: (() => void) | undefined;
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
    for (const listener of nativeRaPinningListeners) listener();
  }

  function notifyAllRevisions(): void {
    for (const revision of revisions.values()) revision.set(revision.get() + 1);
    for (const listener of nativeRaPinningListeners) listener();
  }

  function getProjection(appId: number): NativeRetroAchievementsProjection | undefined {
    if (disposed || !isShortcutAppId(runtime, appId)) return undefined;
    if (activePage?.appId === appId && !activePage.verified) return undefined;
    return readDeckyNativeRetroAchievementsProjection(String(appId), currentMode());
  }

  function resolveNativePinTarget(appId: number, row: NativeAchievementRow, running?: NativeRetroAchievementsProjection): NativeAchievementPinTarget | undefined {
    if (disposed || row.bAchieved) return undefined;
    const overview = runtime.appStore?.GetAppOverviewByAppID(appId);
    if (overview?.appid !== appId) return undefined;
    const configs = readDeckyProviderConfigs();
    if (isNativeSteamShortcutOverview(overview, appId)) {
      const account = configs.retroAchievements;
      const projection = running ?? getProjection(appId);
      if (!account?.hasApiKey || projection === undefined || !row.strID.startsWith("ra:")) return undefined;
      const achievementId = row.strID.slice(3);
      const libraryChildren = running === undefined && isCurrentLibraryAchievementListPage(appId)
        ? (readLibraryAchievementSets(projection) ?? []).map(set => set.projection) : [];
      for (const owner of [projection, ...libraryChildren]) {
        const achievement = owner.achievements.find(candidate => candidate.achievementId === achievementId);
        if (achievement !== undefined && !isAchievementCompleteForPin(achievement, owner.mode)) {
          return { providerId: "retroachievements", accountId: account.username.toLowerCase(), gameId: owner.raGameId, achievementId, mode: owner.mode };
        }
      }
      return undefined;
    }
    const account = configs.steam;
    if (row.strID.startsWith("ra:") || !account?.hasApiKey || !/^\d{17}$/u.test(account.steamId64)) return undefined;
    // Native Steam rows describe the signed-in Steam user, while AC can be configured for another account.
    const accountId = runtime.friendStore?.currentUserSteamID?.GetAccountID?.();
    if (accountId !== Number(BigInt(account.steamId64) & 0xffffffffn)) return undefined;
    return { providerId: "steam", accountId: account.steamId64, gameId: String(appId), achievementId: row.strID, mode: "both" };
  }

  function installNativeRaPinning(): void {
    if (nativeRaPinningPatched) return;
    try {
      const patch = installNativeRaAchievementPinning({
        isShortcut: (appId) => !disposed && isShortcutAppId(runtime, appId),
        readAccountRevision: () => getDeckyAccountRevision("retroachievements"),
        readProjection: (appId, viewer) => activePage?.appId === appId && activePage.verified
          && isCurrentLibraryAchievementListPage(appId)
          && runtime.friendStore?.currentUserSteamID?.ConvertTo64BitString?.() === viewer
          ? getProjection(appId) : undefined,
        resolveTarget: resolveNativePinTarget,
        readSubsets: readLibraryAchievementSets,
        onOpen: loadLibraryAchievementSets,
        subscribe: (listener) => {
          nativeRaPinningListeners.add(listener);
          return () => nativeRaPinningListeners.delete(listener);
        },
      });
      if (patch !== undefined) {
        patches.push(patch);
        nativeRaPinningPatched = true;
      }
    } catch {
      // Leave Steam's original panel intact if the optional route integration is unavailable.
    }
  }

  function installRaPlayBar(pageFiber: SteamReactFiber | undefined): boolean {
    if (raPlayBarPatched || pageFiber === undefined) return false;
    try {
      const renderer = findSteamFiber(pageFiber.child, (fiber) => isNativeRaPlayBarRenderer(fiber.type))?.type;
      const patch = installNativeRaPlayBarAchievementAction(renderer, (appId) =>
        activePage?.appId === appId && activePage.verified && isCurrentLibraryRootPage(appId)
        && (getModel(appId)?.nTotal ?? 0) > 0);
      if (patch !== undefined) {
        patches.push(patch);
        raPlayBarPatched = true;
        return true;
      }
    } catch {
      // Keep Steam's own play bar if its internal renderer is unavailable.
    }
    return false;
  }

  function installNativeOverlayPinning(): void {
    if (overlayPinningPatched) return;
    try {
      const patch = installNativeRaOverlayAchievementPinning({
        isShortcut: (appId) => !disposed && runningAchievements.has(appId),
        readAccountRevision: () => getDeckyAccountRevision("retroachievements"),
        readProjection: (appId, viewer) => viewer === runtime.friendStore?.currentUserSteamID?.ConvertTo64BitString?.()
          ? readRunningProjection(appId) : undefined,
        resolveTarget: (appId, row) => {
          const projection = readRunningProjection(appId);
          return projection === undefined ? undefined : resolveNativePinTarget(appId, row, projection);
        },
        subscribe: (listener) => {
          nativeRaPinningListeners.add(listener);
          return () => nativeRaPinningListeners.delete(listener);
        },
      });
      if (patch !== undefined) {
        patches.push(patch);
        overlayPinningPatched = true;
      }
    } catch {
      // Steam can still show its native achievement list if this layout is unavailable.
    }
  }

  function installNativeOverlayGuides(): void {
    if (overlayGuidesPatched) return;
    try {
      const patch = installNativeRaOverlayGuides({
        readProjection: (appId) => disposed ? undefined : readRunningProjection(appId),
        subscribe: (listener) => {
          nativeRaPinningListeners.add(listener);
          return () => nativeRaPinningListeners.delete(listener);
        },
      });
      if (patch !== undefined) {
        patches.push(patch);
        overlayGuidesPatched = true;
      }
    } catch {
      // A changed menu must never stop Steam's original running-game controls.
    }
  }

  const enhanceMyAchievements = createNativeMyAchievementsEnhancer(resolveNativePinTarget);

  function installYourStuffActions(): void {
    if (yourStuffActionsPatched) return;
    try {
      const installed = installNativeYourStuffAchievementActions(resolveNativePinTarget);
      patches.push(...installed);
      yourStuffActionsPatched = installed.length > 0;
    } catch {
      // Optional Steam renderer discovery must never stop native data registration.
    }
  }

  function getModel(appId: number): NativeSteamAchievements | undefined {
    const projection = getProjection(appId);
    return projection === undefined ? undefined : modelForProjection(projection);
  }

  function modelForProjection(projection: NativeRetroAchievementsProjection): NativeSteamAchievements {
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

  function findAchievementQueryClient() {
    const candidate: unknown = findModuleExport(isSteamAchievementQueryClient);
    return isSteamAchievementQueryClient(candidate) ? candidate : undefined;
  }

  function clearLibraryAchievementQueries(): void {
    libraryQueryAppId = undefined;
    librarySets = undefined;
    achievementQueries.clear();
  }

  function publishAchievementQueries(appId: number, projection: NativeRetroAchievementsProjection): void {
    if (runningAchievements.has(appId)) return;
    try {
      const viewer = runtime.friendStore?.currentUserSteamID?.ConvertTo64BitString?.();
      if (viewer === undefined || !/^\d{17}$/u.test(viewer)) return;
      const model = getModel(appId);
      if (model === undefined || model.nTotal === 0) return;
      queryClient ??= findAchievementQueryClient();
      if (queryClient === undefined) return;
      const accountRevision = getDeckyAccountRevision("retroachievements");
      libraryQueryAppId = appId;
      void achievementQueries.publish(queryClient, appId, viewer, model, () => !disposed
        && !runningAchievements.has(appId)
        && activePage?.appId === appId
        && accountRevision === getDeckyAccountRevision("retroachievements")
        && runtime.friendStore?.currentUserSteamID?.ConvertTo64BitString?.() === viewer
        && getProjection(appId) === projection);
    } catch {
      // Older clients still use the patched achievement stores.
    }
  }

  function readLibraryAchievementSets(base: NativeRetroAchievementsProjection): readonly NativeRaAchievementSet[] | undefined {
    return librarySets?.base === base
      && librarySets.accountRevision === getDeckyAccountRevision("retroachievements")
      && librarySets.viewer === runtime.friendStore?.currentUserSteamID?.ConvertTo64BitString?.()
      ? librarySets.sets : undefined;
  }

  function loadLibraryAchievementSets(base: NativeRetroAchievementsProjection, viewer: string): void {
    const game = base.detailSnapshot?.game;
    const appId = toAppId(base.appId);
    const client = queryClient;
    if (game === undefined || appId === undefined || client === undefined || libraryQueryAppId !== appId
      || !isCurrentLibraryAchievementListPage(appId) || runningAchievements.has(appId)
      || activePage?.appId !== appId || getProjection(appId) !== base
      || viewer !== runtime.friendStore?.currentUserSteamID?.ConvertTo64BitString?.()) return;

    const accountRevision = getDeckyAccountRevision("retroachievements");
    if (librarySets?.base === base && librarySets.viewer === viewer && librarySets.accountRevision === accountRevision) return;
    const request = { base, viewer, accountRevision, sets: [] as readonly NativeRaAchievementSet[] };
    librarySets = request;
    const isCurrent = () => !disposed && librarySets === request && !runningAchievements.has(appId)
      && activePage?.appId === appId && getProjection(appId) === base
      && getDeckyAccountRevision("retroachievements") === accountRevision
      && runtime.friendStore?.currentUserSteamID?.ConvertTo64BitString?.() === viewer;
    const isViewingList = () => isCurrent() && isCurrentLibraryAchievementListPage(appId);

    void (async () => {
      // Only use relationships already verified by the RA provider. Opening this
      // panel never starts a console catalogue scan.
      const relationships = await readDeckyRetroAchievementsVerifiedSubsets(game);
      const verifiedDetails = [];
      for (const relationship of relationships) {
        if (!isViewingList()) return;
        const state = await loadDeckyGameDetailState("retroachievements", relationship.gameId, { entryPoint: "native-achievement-sets" });
        if (state.data !== undefined) verifiedDetails.push({ relationship, snapshot: state.data });
      }
      if (!isViewingList()) return;
      const sets = buildNativeRaAchievementSets(base, verifiedDetails);
      if (sets.length === 0) return;
      if (await achievementQueries.publish(client, appId, viewer, modelForProjection(base), isCurrent, sets) && isCurrent()) {
        request.sets = sets;
        notifyRevision(appId);
      }
    })().catch(() => undefined).finally(() => {
      if (librarySets === request && request.sets.length === 0) librarySets = undefined;
    });
  }

  function readRunningProjection(appId: number): NativeRetroAchievementsProjection | undefined {
    const session = runningAchievements.get(appId);
    return session?.accountRevision === getDeckyAccountRevision("retroachievements")
      && session.viewer === runtime.friendStore?.currentUserSteamID?.ConvertTo64BitString?.()
      ? session.projection : undefined;
  }

  function clearRunningProjection(appId: number, session: RunningAchievements): void {
    const wasVisible = session.projection !== undefined;
    delete session.request;
    delete session.projection;
    delete session.viewer;
    delete session.accountRevision;
    session.queries.clear();
    if (wasVisible) notifyRevision(appId);
  }

  function refreshRunningAchievements(appId: number, session: RunningAchievements): void {
    const gameId = deckyRaPresence.runningGameId(String(appId));
    if ((session.projection !== undefined && (gameId === undefined || gameId === session.projection.raGameId))
      || (session.request !== undefined && session.request.gameId === gameId)) return;

    clearRunningProjection(appId, session);
    if (readDeckyProviderConfigs().retroAchievements?.hasApiKey !== true) return;
    const viewer = runtime.friendStore?.currentUserSteamID?.ConvertTo64BitString?.();
    if (viewer === undefined || !/^\d{17}$/u.test(viewer)) return;
    const mode = currentMode();
    const account = getDeckyAccountRevision("retroachievements");
    const request = { gameId };
    session.request = request;
    const isCurrent = () => !disposed && runningAchievements.get(appId) === session && session.request === request
      && currentMode() === mode && getDeckyAccountRevision("retroachievements") === account
      && runtime.friendStore?.currentUserSteamID?.ConvertTo64BitString?.() === viewer;
    void (async () => {
      let projection;
      if (gameId === undefined) {
        projection = await loadDeckyNativeRetroAchievementsProjection(String(appId), mode);
      } else {
        const detail = await loadDeckyGameDetailState("retroachievements", gameId);
        if ((detail.status === "success" || detail.status === "stale") && detail.data !== undefined) {
          projection = projectNativeRetroAchievementsDetail(String(appId), gameId, mode, detail.data);
        }
      }
      if (projection?.status !== "ready" || !isCurrent()) return;
      const publishedGameId = projection.raGameId;
      const observed = deckyRaPresence.runningGameId(String(appId));
      if (observed !== undefined && observed !== publishedGameId) return;
      queryClient ??= findAchievementQueryClient();
      if (queryClient === undefined) return;
      const published = await session.queries.publish(queryClient, appId, viewer, modelForProjection(projection), isCurrent);
      if (published && isCurrent()) {
        const firstMatch = session.projection === undefined && gameId === undefined;
        session.projection = projection;
        session.viewer = viewer;
        session.accountRevision = account;
        notifyRevision(appId);
        if (firstMatch) corroborateDeckyRaPresenceLaunch(String(appId), publishedGameId);
      }
    })().catch(() => undefined);
  }

  function startRunningAchievements(appId: number): void {
    if (!overlayDetailsPatched || !isShortcutAppId(runtime, appId) || runningAchievements.has(appId)) return;
    installNativeOverlayPinning();
    installNativeOverlayGuides();
    const session: RunningAchievements = { queries: createSteamAchievementQueryProjection() };
    runningAchievements.set(appId, session);
    if (libraryQueryAppId === appId) clearLibraryAchievementQueries();
    if (readDeckyProviderConfigs().retroAchievements?.hasApiKey === true) {
      refreshRunningAchievements(appId, session);
    } else {
      void loadDeckyProviderConfigs().then(() => {
        if (!disposed && runningAchievements.get(appId) === session) refreshRunningAchievements(appId, session);
      }).catch(() => undefined);
    }
  }

  function findRunningShortcut(appId: number): boolean {
    if (disposed || gameLifetimeStates.get(appId) === false || !isShortcutAppId(runtime, appId)) return false;
    try {
      return runtime.SteamUIStore?.GetFocusedWindowInstance?.()?.RunningApps?.some((app) => app.appid === appId) === true;
    } catch {
      return false;
    }
  }

  function restoreRunningAchievements(appId: number): void {
    if (pendingRunningStarts.has(appId) || !findRunningShortcut(appId)) return;
    pendingRunningStarts.add(appId);
    queueMicrotask(() => {
      pendingRunningStarts.delete(appId);
      if (findRunningShortcut(appId)) startRunningAchievements(appId);
    });
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
    if (page?.verified && isCurrentLibraryRootPage(page.appId) && installRaPlayBar(pageFiber?._reactInternals)) {
      page.instance.forceUpdate?.();
    }
    if (ownerDocument !== undefined && ownerDocument !== gameInfoObservedDocument && ownerDocument.body !== null) {
      gameInfoObserver?.disconnect();
      stopNativeAchievementClassifications?.();
      stopNativeQueryAchievementActions?.();
      gameInfoObservedDocument = ownerDocument;
      gameInfoObserver = new MutationObserver(() => {
        if (/\/tab\/GameInfo\/?$/u.test(window.location.pathname) || gameInfoMount !== undefined) scheduleGameInfoSync();
      });
      gameInfoObserver.observe(ownerDocument.body, { childList: true, subtree: true });
      stopNativeAchievementClassifications = observeNativeAchievementClassifications(ownerDocument, () => {
        const currentPage = activePage;
        return currentPage?.verified === true && isCurrentLibraryAchievementListPage(currentPage.appId)
          ? getProjection(currentPage.appId)?.achievements : undefined;
      });
      stopNativeQueryAchievementActions = observeNativeQueryAchievementActions(ownerDocument, () => {
        const currentPage = activePage;
        if (!currentPage?.verified) return undefined;
        const appId = currentPage.appId;
        return isCurrentLibraryAchievementListPage(appId)
          || window.location.pathname.endsWith(`/app/${appId}/tab/YourStuff`) ? appId : undefined;
      }, resolveNativePinTarget);
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

  function loadForPage(appId: number, revalidateOnEntry = false): void {
    const mode = currentMode();
    if (attempts.get(appId)?.mode === mode) return;
    const attempt = { mode };
    attempts.set(appId, attempt);
    unavailableAppIds.delete(appId);
    const page = activePage?.appId === appId ? activePage : undefined;
    void loadDeckyNativeRetroAchievementsProjection(
      String(appId),
      mode,
      revalidateOnEntry ? { revalidateOnEntry: true } : undefined,
    ).then((result) => {
      if (disposed || currentMode() !== mode || attempts.get(appId) !== attempt) return;
      if (result.status === "ready" && result.appId === String(appId)) {
        managedAppIds.add(appId);
        if (page !== undefined && activePage === page) {
          page.verified = true;
          const projection = getProjection(appId);
          if (projection !== undefined) publishAchievementQueries(appId, projection);
        }
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
    const detailsStore = runtime.appDetailsStore;
    if (!overlayDetailsPatched && detailsStore !== undefined && typeof detailsStore.GetAppDetails === "function") {
      try {
        patches.push(afterPatch(detailsStore, "GetAppDetails", ([rawAppId], nativeDetails: unknown) => {
          const appId = toAppId(rawAppId);
          if (appId === undefined || typeof nativeDetails !== "object" || nativeDetails === null) return nativeDetails;
          if (!runningAchievements.has(appId)) {
            restoreRunningAchievements(appId);
            if (!pendingRunningStarts.has(appId)) return nativeDetails;
          }
          revisionFor(appId)?.get();
          const projection = readRunningProjection(appId);
          return projection === undefined ? nativeDetails : { ...nativeDetails, achievements: modelForProjection(projection) };
        }));
        overlayDetailsPatched = true;
      } catch {
        // An unsupported Steam overlay must leave the library integrations usable.
      }
    }
    if (detailsPatched && personalPatched && progressPatched) return;
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
        if (activePage !== undefined && (activePage.instance === this || (appId !== undefined && isCurrentLibraryRootPage(appId)))) {
          clearLibraryAchievementQueries();
          activePage = undefined;
        }
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
        invalidateDeckyRaShortcutHashMatch(String(appId));
        const previousGameId = readDeckyNativeRetroAchievementsProjection(String(appId), currentMode())?.raGameId;
        if (previousGameId !== undefined) invalidateDeckyRetroAchievementsMasteredGameDetail(previousGameId);
        invalidateDeckyNativeRetroAchievementsProjection(String(appId));
        attempts.delete(appId);
        unavailableAppIds.delete(appId);
        notifyRevision(appId);
      }
      shortcutIdentities.set(appId, identity);
      const mode = currentMode();
      const newPageVisit = activePage?.appId !== appId || activePage.instance !== this;
      if (activePage?.appId !== appId || activePage.instance !== this || activePage.identity !== identity || activePage.mode !== mode) {
        clearLibraryAchievementQueries();
        attempts.delete(appId);
        unavailableAppIds.delete(appId);
        activePage = { appId, instance: this, identity, mode, verified: false };
      }
      if (!activePage.verified) {
        // The backend shortcut identity includes platform tags that are absent from app details.
        // Recheck it on each page mount before showing any previously committed projection.
        loadForPage(appId, newPageVisit);
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
      return withNativeSteamCommunitySection(
        activitySections,
        overview,
        appId,
        communityPrimitives !== undefined && projection.detailSnapshot !== undefined,
      );
    }));
    pagePatched = true;
  }

  function installUpNextPatch(): void {
    if (upNextPatched) return;
    // Decky's Tabs export is Steam's native tab component. This patch changes
    // its props only for verified RA shortcuts and is removed on unload.
    patches.push(beforePatch(Tabs, "type", (args) => {
      const props = args[0] as {
        readonly tabs?: readonly { readonly id: string; readonly title: string }[];
        readonly activeTab?: string;
        readonly onShowTab?: (tabId: string) => void;
      } | undefined;
      if (Array.isArray(props?.tabs) && props.tabs.some((tab) => tab.id === "achievements")) {
        args[0] = { ...props, tabs: enhanceMyAchievements(props.tabs) };
        return;
      }
      const page = activePage;
      if (!page?.verified || !isCurrentLibraryRootPage(page.appId) || !Array.isArray(props?.tabs)) return;
      const projection = getProjection(page.appId);
      if (projection === undefined || projection.detailSnapshot === undefined) return;
      const tabs = withNativeUpNextTab(
        props.tabs,
        createElement(DeckyNativeUpNext, { projection }),
      );
      if (tabs !== props.tabs) {
        if (page.upNextSelected && page.nativeTabOnUpNextSelect !== props.activeTab) {
          page.upNextSelected = false;
        }
        if (readNativeAchievementJumpReturn(page.appId, "up-next") !== undefined) {
          page.upNextSelected = true;
          page.nativeTabOnUpNextSelect = props.activeTab;
        }
        // Steam's route hook has no registered destination for this injected
        // tab. Keep the underlying route on its current valid native tab,
        // while the native Tabs control selects Up Next locally. Sending its ID
        // into Steam's route hook leaves selection and route out of sync.
        args[0] = {
          ...props,
          tabs,
          ...(page.upNextSelected ? { activeTab: NATIVE_UP_NEXT_TAB_ID } : {}),
          onShowTab: (tabId: string) => {
            if (tabId === NATIVE_UP_NEXT_TAB_ID) {
              page.upNextSelected = true;
              page.nativeTabOnUpNextSelect = props.activeTab;
            } else {
              page.upNextSelected = false;
              page.nativeTabOnUpNextSelect = undefined;
              props.onShowTab?.(tabId);
            }
            rerenderActivePage(page.appId);
          },
        };
      }
    }));
    upNextPatched = true;
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
       if (projection.detailSnapshot === undefined) return callOriginal;
       return createElement(DeckyRetroAchievementsCommunityResource, {
         snapshot: projection.detailSnapshot,
        primitives: communityPrimitives,
         ...(projection.achievementsAvailableSince !== undefined ? { achievementsAvailableSince: projection.achievementsAvailableSince } : {}),
      });
    }));
    communityPatched = true;
  }

  const routePatch = routerHook.addPatch(DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN, (tree) => {
    installStorePatches();
    installPagePatch();
    installUpNextPatch();
    installYourStuffActions();
    installNativeRaPinning();
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
  installUpNextPatch();
  installYourStuffActions();
  installNativeRaPinning();
  installActivityPatch();
  installCommunityPatch();
  scheduleGameInfoSync();
  const syncRunningAchievements = (): void => {
    for (const [appId, session] of runningAchievements) refreshRunningAchievements(appId, session);
  };
  let unsubscribeRunningPresence = deckyRaPresence.subscribe(syncRunningAchievements);
  const unsubscribeInvalidation = subscribeDeckyRaNativeAchievementInvalidation((event) => {
    if (event.reason === "provider-refreshed") return;
    cancelNativeAchievementJump();
    clearLibraryAchievementQueries();
    invalidateDeckyNativeRetroAchievementsProjection();
    attempts.clear();
    shortcutIdentities.clear();
    unavailableAppIds.clear();
    if (activePage !== undefined) activePage.verified = false;
    notifyAllRevisions();
    if (activePage !== undefined) {
      rerenderActivePage(activePage.appId);
    }
    for (const [appId, session] of runningAchievements) clearRunningProjection(appId, session);
    if (event.reason === "account-changed") {
      unsubscribeRunningPresence();
      unsubscribeRunningPresence = deckyRaPresence.subscribe(syncRunningAchievements);
    }
    syncRunningAchievements();
  });

  const launchTokens = new Map<number, object>();
  const gameLifetimeHandle = runtime.SteamClient?.GameSessions?.RegisterForAppLifetimeNotifications((event) => {
    const appId = toAppId(event.unAppID);
    if (appId === undefined || typeof event.bRunning !== "boolean") return;
    const emulator = /\b(?:retroarch|emulationstation|pcsx2|duckstation|dolphin|rpcs3|ppsspp|melonDS|mupen|ares|mednafen)\b/iu
      .test(runtime.appStore?.GetAppOverviewByAppID(appId)?.display_name ?? "");
    if (!isShortcutAppId(runtime, appId) && !emulator) return;
    if (gameLifetimeStates.get(appId) === event.bRunning) return;
    gameLifetimeStates.set(appId, event.bRunning);
    const projection = readDeckyNativeRetroAchievementsProjection(String(appId), currentMode());
    const token = {}; launchTokens.set(appId, token);
    const account = getDeckyAccountRevision("retroachievements");
    notifyDeckyRaPresenceLifecycle(String(appId), event.bRunning, undefined, emulator ? "emulator" : "unknown");
    if (event.bRunning) void verifyNativeProjectionLaunch(projection).then(gameId => {
      if (gameId !== undefined && !disposed && launchTokens.get(appId) === token &&
          account === getDeckyAccountRevision("retroachievements")) corroborateDeckyRaPresenceLaunch(String(appId), gameId);
    }).catch(() => undefined);
    if (projection?.raGameId !== undefined) invalidateDeckyRetroAchievementsGameProgress(projection.raGameId);
    if (projection?.detailSnapshot?.game.status !== "mastered" && projection?.raGameId !== undefined) {
      invalidateDeckyRetroAchievementsMasteredGameDetail(projection.raGameId);
    }
    invalidateDeckyNativeRetroAchievementsProjection(String(appId), { refreshIncompleteOnly: true });
    attempts.delete(appId);
    unavailableAppIds.delete(appId);
    if (activePage?.appId === appId) {
      clearLibraryAchievementQueries();
      activePage.verified = false;
    }
    if (event.bRunning) startRunningAchievements(appId);
    else {
      const session = runningAchievements.get(appId);
      if (session !== undefined) {
        runningAchievements.delete(appId);
        clearRunningProjection(appId, session);
      }
    }
    notifyRevision(appId);
    rerenderActivePage(appId);
  });

  // Decky may reload while an already-running game remains open.
  try {
    for (const app of runtime.SteamUIStore?.GetFocusedWindowInstance?.()?.RunningApps ?? []) {
      const appId = toAppId(app.appid);
      if (appId === undefined || !isShortcutAppId(runtime, appId) || gameLifetimeStates.get(appId) === true) continue;
      restoreRunningAchievements(appId);
    }
  } catch {
    // A Steam build without a readable running-game list still uses lifetime notifications.
  }

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    if (registeredCleanup === cleanup) registeredCleanup = undefined;
    clearLibraryAchievementQueries();
    unsubscribeInvalidation();
    unsubscribeRunningPresence();
    for (const [appId, session] of runningAchievements) clearRunningProjection(appId, session);
    runningAchievements.clear();
    gameLifetimeHandle?.unregister();
    stopDeckyRaPresence();
    routerHook.removePatch(DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN, routePatch);
    routeRenderPatch?.unpatch();
    routeRenderPatch = undefined;
    routeRenderOwner = undefined;
    cancelNativeAchievementJump();
    stopNativeAchievementClassifications?.();
    stopNativeQueryAchievementActions?.();
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
    nativeRaPinningListeners.clear();
    const lastPage = activePage;
    activePage = undefined;
    lastPage?.instance.forceUpdate?.();
    disposeDeckyNativeRetroAchievementsProjection();
  };
  registeredCleanup = cleanup;
  return cleanup;
}
