import {
  detectDeckyGamePageAchievementRouteFromUrl,
  type DeckyGamePageAchievementRouteDetectionState,
} from "./decky-game-page-achievement-route";
import type { GamePageAchievementSummary } from "./decky-game-page-achievement-summary";

export type AchievementCompanionRuntimeDebugAccessMode =
  | "host-top-window"
  | "current-window"
  | "unavailable";

export interface AchievementCompanionRuntimeDebugState {
  readonly versionMarker: string;
  readonly bundleMarker: string;
  readonly buildMarker: string;
  readonly startedAt: string;
  readonly hostAccessMode: AchievementCompanionRuntimeDebugAccessMode;
  readonly hostIsTopWindow: boolean;
  readonly hostWindowAvailable: boolean;
  readonly hostDocumentAvailable: boolean;
  readonly currentRouteUrl: string | undefined;
  readonly gamePageDetected: boolean;
  readonly appId: string | undefined;
  readonly routeDetectionReason: string | undefined;
  readonly routeBadgePatchRegistered: boolean;
  readonly routeBadgePatchPath: string | undefined;
  readonly routeBadgePatchCallbackCount: number;
  readonly routeBadgeRenderFuncPatchedCount: number;
  readonly routeBadgePatchHandlerFiredCount: number;
  readonly routeBadgeInsertedCount: number;
  readonly routeBadgeRenderedCount: number;
  readonly lastRouteBadgeAppId: string | undefined;
  readonly lastRouteBadgeRenderedAt: string | undefined;
  readonly routeBadgePlacementSlot: string | undefined;
  readonly routeBadgePlacementCollisionCount: number;
  readonly routeBadgePlacementCandidateCount: number;
  readonly routeBadgePlacementFallbackUsed: boolean;
  readonly routeBadgePlacementUpdatedAt: string | undefined;
  readonly gamePageBadgeActivatedCount: number;
  readonly lastGamePageBadgeActivatedAppId: string | undefined;
  readonly lastGamePageBadgeActivatedAt: string | undefined;
  readonly lastGamePageBadgeNavigationTarget: string | undefined;
  readonly lastGamePageBadgeSourceRoute: string | undefined;
  readonly lastGamePageBadgeBackRoute: string | undefined;
  readonly lastGamePageBadgeNavigationError: string | undefined;
  readonly lastGamePageBadgeSystemIconProvider: string | undefined;
  readonly lastGamePageBadgeSystemIconPlatform: string | undefined;
  readonly lastGamePageBadgeSystemIconUrl: string | undefined;
  readonly lastGamePageBadgeSystemIconRendered: boolean;
  readonly badgeRendered: boolean;
  readonly badgeRenderCount: number;
  readonly lastBadgeRenderAt: string | undefined;
  readonly lastBadgeRenderAppId: string | undefined;
  readonly lastBadgeClickAt: string | undefined;
  readonly lastSummaryStatus: GamePageAchievementSummary["status"] | undefined;
  readonly lastSummaryProvider: "steam" | "retroachievements" | undefined;
  readonly lastSummaryEarned: number | undefined;
  readonly lastSummaryTotal: number | undefined;
  readonly lastSummaryUnavailableReason: string | undefined;
  readonly lastSummaryFetchStartedAt: string | undefined;
  readonly lastSummaryFetchCompletedAt: string | undefined;
  readonly lastRetroAchievementsShortcutAppId: string | undefined;
  readonly lastRetroAchievementsShortcutTitle: string | undefined;
  readonly lastRetroAchievementsShortcutPlatform: string | undefined;
  readonly lastRetroAchievementsMappingStatus: "mapped" | "unavailable" | "error" | undefined;
  readonly lastRetroAchievementsMappingReason: string | undefined;
  readonly lastRetroAchievementsGameId: string | undefined;
  readonly lastRetroAchievementsTitle: string | undefined;
  readonly lastRetroAchievementsEarned: number | undefined;
  readonly lastRetroAchievementsTotal: number | undefined;
  readonly lastRetroAchievementsSource: string | undefined;
  readonly lastRetroAchievementsConfidence: string | undefined;
  readonly lastRetroAchievementsError: string | undefined;
  readonly lastRetroAchievementsResolutionSource: string | undefined;
  readonly lastRetroAchievementsResolutionReason: string | undefined;
  readonly lastRetroAchievementsMatchedTitle: string | undefined;
  readonly lastRetroAchievementsMatchedPlatform: string | undefined;
  readonly lastRetroAchievementsMatchedGameId: string | undefined;
  readonly lastRetroAchievementsCandidateCount: number | undefined;
  readonly lastError: string | undefined;
}

export interface AchievementCompanionRuntimeDebugApi {
  readonly versionMarker: string;
  readonly bundleMarker: string;
  readonly buildMarker: string;
  readonly startedAt: string;
  readonly getState: () => AchievementCompanionRuntimeDebugState;
}

export interface AchievementCompanionRuntimeDebugHostContext {
  readonly hostWindow: Window;
  readonly hostDocument: Document;
  readonly hostIsTopWindow: boolean;
}

export interface AchievementCompanionRuntimeDebugInstallOptions {
  readonly doc?: Document | undefined;
  readonly win?: Window | undefined;
}

export const ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_GLOBAL_NAME =
  "__achievementCompanionRuntimeDebug";
export const ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_VERSION_MARKER = "0.3.0-runtime";
export const ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_BUNDLE_MARKER = "decky-game-page-bubble";

interface RuntimeDebugRootLike {
  [ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_GLOBAL_NAME]?: AchievementCompanionRuntimeDebugApi;
}

declare global {
  interface Window {
    __achievementCompanionRuntimeDebug?: AchievementCompanionRuntimeDebugApi;
  }
}

let runtimeDebugApi: AchievementCompanionRuntimeDebugApi | undefined;
let runtimeDebugHostContext: AchievementCompanionRuntimeDebugHostContext | undefined;
let runtimeDebugRouteBadgePatchRegistered = false;
let runtimeDebugRouteBadgePatchPath: string | undefined;
let runtimeDebugRouteBadgePatchCallbackCount = 0;
let runtimeDebugRouteBadgeRenderFuncPatchedCount = 0;
let runtimeDebugRouteBadgePatchHandlerFiredCount = 0;
let runtimeDebugRouteBadgeInsertedCount = 0;
let runtimeDebugRouteBadgeRenderedCount = 0;
let runtimeDebugLastRouteBadgeAppId: string | undefined;
let runtimeDebugLastRouteBadgeRenderedAt: string | undefined;
let runtimeDebugRouteBadgePlacementSlot: string | undefined;
let runtimeDebugRouteBadgePlacementCollisionCount = 0;
let runtimeDebugRouteBadgePlacementCandidateCount = 0;
let runtimeDebugRouteBadgePlacementFallbackUsed = false;
let runtimeDebugRouteBadgePlacementUpdatedAt: string | undefined;
let runtimeDebugGamePageBadgeActivatedCount = 0;
let runtimeDebugLastGamePageBadgeActivatedAppId: string | undefined;
let runtimeDebugLastGamePageBadgeActivatedAt: string | undefined;
let runtimeDebugLastGamePageBadgeNavigationTarget: string | undefined;
let runtimeDebugLastGamePageBadgeSourceRoute: string | undefined;
let runtimeDebugLastGamePageBadgeBackRoute: string | undefined;
let runtimeDebugLastGamePageBadgeNavigationError: string | undefined;
let runtimeDebugLastGamePageBadgeSystemIconProvider: string | undefined;
let runtimeDebugLastGamePageBadgeSystemIconPlatform: string | undefined;
let runtimeDebugLastGamePageBadgeSystemIconUrl: string | undefined;
let runtimeDebugLastGamePageBadgeSystemIconRendered = false;
let runtimeDebugBadgeRenderCount = 0;
let runtimeDebugLastBadgeRenderAt: string | undefined;
let runtimeDebugLastBadgeRenderAppId: string | undefined;
let runtimeDebugLastBadgeClickAt: string | undefined;
let runtimeDebugLastSummaryStatus: GamePageAchievementSummary["status"] | undefined;
let runtimeDebugLastSummaryProvider: "steam" | "retroachievements" | undefined;
let runtimeDebugLastSummaryEarned: number | undefined;
let runtimeDebugLastSummaryTotal: number | undefined;
let runtimeDebugLastSummaryUnavailableReason: string | undefined;
let runtimeDebugLastSummaryFetchStartedAt: string | undefined;
let runtimeDebugLastSummaryFetchCompletedAt: string | undefined;
let runtimeDebugLastRetroAchievementsShortcutAppId: string | undefined;
let runtimeDebugLastRetroAchievementsShortcutTitle: string | undefined;
let runtimeDebugLastRetroAchievementsShortcutPlatform: string | undefined;
let runtimeDebugLastRetroAchievementsMappingStatus: "mapped" | "unavailable" | "error" | undefined;
let runtimeDebugLastRetroAchievementsMappingReason: string | undefined;
let runtimeDebugLastRetroAchievementsGameId: string | undefined;
let runtimeDebugLastRetroAchievementsTitle: string | undefined;
let runtimeDebugLastRetroAchievementsEarned: number | undefined;
let runtimeDebugLastRetroAchievementsTotal: number | undefined;
let runtimeDebugLastRetroAchievementsSource: string | undefined;
let runtimeDebugLastRetroAchievementsConfidence: string | undefined;
let runtimeDebugLastRetroAchievementsError: string | undefined;
let runtimeDebugLastRetroAchievementsResolutionSource: string | undefined;
let runtimeDebugLastRetroAchievementsResolutionReason: string | undefined;
let runtimeDebugLastRetroAchievementsMatchedTitle: string | undefined;
let runtimeDebugLastRetroAchievementsMatchedPlatform: string | undefined;
let runtimeDebugLastRetroAchievementsMatchedGameId: string | undefined;
let runtimeDebugLastRetroAchievementsCandidateCount: number | undefined;
let runtimeDebugLastObservedRouteUrl: string | undefined;
let runtimeDebugLastObservedDetection: DeckyGamePageAchievementRouteDetectionState | undefined;
let runtimeDebugLastError: string | undefined;

const runtimeDebugStartedAt = new Date().toISOString();

function canReadTopDocument(win: Window): win is Window {
  try {
    const topWindow = win.top;
    if (topWindow === undefined || topWindow === null) {
      return false;
    }

    void topWindow.document.body;
    return true;
  } catch {
    return false;
  }
}

function getTargetWindows(win: Window): Window[] {
  const targets = new Set<Window>();
  targets.add(win);

  if (typeof globalThis === "object" && globalThis !== null) {
    targets.add(globalThis as unknown as Window);
  }

  if (canReadTopDocument(win)) {
    targets.add(win.top as Window);
  }

  return Array.from(targets);
}

function readTargetDocumentUrl(targetDocument: Document | undefined): string | undefined {
  if (targetDocument === undefined) {
    return undefined;
  }

  try {
    return targetDocument.location?.href;
  } catch {
    return undefined;
  }
}

export function reportAchievementCompanionRuntimeDebugError(
  error: unknown,
  context: string,
): string {
  let errorMessage: string;
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "string") {
    errorMessage = error;
  } else {
    try {
      errorMessage = JSON.stringify(error);
    } catch {
      errorMessage = String(error);
    }
  }

  runtimeDebugLastError = `${context}: ${errorMessage}`;
  console.error("[Achievement Companion] Runtime debug error", {
    context,
    error: errorMessage,
  });
  return runtimeDebugLastError;
}

export function resolveAchievementCompanionRuntimeDebugHostContext(
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
  win: Window | undefined = typeof window === "undefined" ? undefined : window,
): AchievementCompanionRuntimeDebugHostContext | undefined {
  if (doc === undefined || win === undefined || doc.body === undefined) {
    return undefined;
  }

  if (canReadTopDocument(win)) {
    const topWindow = win.top;
    if (topWindow === undefined || topWindow === null) {
      return undefined;
    }

    return {
      hostWindow: topWindow as Window,
      hostDocument: topWindow.document,
      hostIsTopWindow: true,
    };
  }

  return {
    hostWindow: win,
    hostDocument: doc,
    hostIsTopWindow: false,
  };
}

function readCurrentRouteDetectionState(): {
  readonly currentRouteUrl: string | undefined;
  readonly detection: DeckyGamePageAchievementRouteDetectionState;
} {
  const targetDocument = runtimeDebugHostContext?.hostDocument;
  const currentRouteUrl = readTargetDocumentUrl(targetDocument) ?? runtimeDebugLastObservedRouteUrl;
  const detection = detectDeckyGamePageAchievementRouteFromUrl(currentRouteUrl);
  return {
    currentRouteUrl,
    detection,
  };
}

function computeRuntimeDebugState(): AchievementCompanionRuntimeDebugState {
  const { currentRouteUrl, detection } = readCurrentRouteDetectionState();

  return {
    versionMarker: ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_VERSION_MARKER,
    bundleMarker: ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_BUNDLE_MARKER,
    buildMarker: `${ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_BUNDLE_MARKER}:${runtimeDebugStartedAt}`,
    startedAt: runtimeDebugApi?.startedAt ?? runtimeDebugStartedAt,
    hostAccessMode:
      runtimeDebugHostContext?.hostIsTopWindow === true
        ? "host-top-window"
        : runtimeDebugHostContext !== undefined
          ? "current-window"
          : "unavailable",
    hostIsTopWindow: runtimeDebugHostContext?.hostIsTopWindow ?? false,
    hostWindowAvailable: runtimeDebugHostContext !== undefined,
    hostDocumentAvailable: runtimeDebugHostContext?.hostDocument !== undefined,
    currentRouteUrl,
    gamePageDetected: detection.isGamePage,
    appId: detection.appId ?? runtimeDebugLastObservedDetection?.appId,
    routeDetectionReason: detection.reason,
    routeBadgePatchRegistered: runtimeDebugRouteBadgePatchRegistered,
    routeBadgePatchPath: runtimeDebugRouteBadgePatchPath,
    routeBadgePatchCallbackCount: runtimeDebugRouteBadgePatchCallbackCount,
    routeBadgeRenderFuncPatchedCount: runtimeDebugRouteBadgeRenderFuncPatchedCount,
    routeBadgePatchHandlerFiredCount: runtimeDebugRouteBadgePatchHandlerFiredCount,
    routeBadgeInsertedCount: runtimeDebugRouteBadgeInsertedCount,
    routeBadgeRenderedCount: runtimeDebugRouteBadgeRenderedCount,
    lastRouteBadgeAppId: runtimeDebugLastRouteBadgeAppId,
    lastRouteBadgeRenderedAt: runtimeDebugLastRouteBadgeRenderedAt,
    routeBadgePlacementSlot: runtimeDebugRouteBadgePlacementSlot,
    routeBadgePlacementCollisionCount: runtimeDebugRouteBadgePlacementCollisionCount,
    routeBadgePlacementCandidateCount: runtimeDebugRouteBadgePlacementCandidateCount,
    routeBadgePlacementFallbackUsed: runtimeDebugRouteBadgePlacementFallbackUsed,
    routeBadgePlacementUpdatedAt: runtimeDebugRouteBadgePlacementUpdatedAt,
    gamePageBadgeActivatedCount: runtimeDebugGamePageBadgeActivatedCount,
    lastGamePageBadgeActivatedAppId: runtimeDebugLastGamePageBadgeActivatedAppId,
    lastGamePageBadgeActivatedAt: runtimeDebugLastGamePageBadgeActivatedAt,
    lastGamePageBadgeNavigationTarget: runtimeDebugLastGamePageBadgeNavigationTarget,
    lastGamePageBadgeSourceRoute: runtimeDebugLastGamePageBadgeSourceRoute,
    lastGamePageBadgeBackRoute: runtimeDebugLastGamePageBadgeBackRoute,
    lastGamePageBadgeNavigationError: runtimeDebugLastGamePageBadgeNavigationError,
    lastGamePageBadgeSystemIconProvider: runtimeDebugLastGamePageBadgeSystemIconProvider,
    lastGamePageBadgeSystemIconPlatform: runtimeDebugLastGamePageBadgeSystemIconPlatform,
    lastGamePageBadgeSystemIconUrl: runtimeDebugLastGamePageBadgeSystemIconUrl,
    lastGamePageBadgeSystemIconRendered: runtimeDebugLastGamePageBadgeSystemIconRendered,
    badgeRendered: runtimeDebugBadgeRenderCount > 0,
    badgeRenderCount: runtimeDebugBadgeRenderCount,
    lastBadgeRenderAt: runtimeDebugLastBadgeRenderAt,
    lastBadgeRenderAppId: runtimeDebugLastBadgeRenderAppId,
    lastBadgeClickAt: runtimeDebugLastBadgeClickAt,
    lastSummaryStatus: runtimeDebugLastSummaryStatus,
    lastSummaryProvider: runtimeDebugLastSummaryProvider,
    lastSummaryEarned: runtimeDebugLastSummaryEarned,
    lastSummaryTotal: runtimeDebugLastSummaryTotal,
    lastSummaryUnavailableReason: runtimeDebugLastSummaryUnavailableReason,
    lastSummaryFetchStartedAt: runtimeDebugLastSummaryFetchStartedAt,
    lastSummaryFetchCompletedAt: runtimeDebugLastSummaryFetchCompletedAt,
    lastRetroAchievementsShortcutAppId: runtimeDebugLastRetroAchievementsShortcutAppId,
    lastRetroAchievementsShortcutTitle: runtimeDebugLastRetroAchievementsShortcutTitle,
    lastRetroAchievementsShortcutPlatform: runtimeDebugLastRetroAchievementsShortcutPlatform,
    lastRetroAchievementsMappingStatus: runtimeDebugLastRetroAchievementsMappingStatus,
    lastRetroAchievementsMappingReason: runtimeDebugLastRetroAchievementsMappingReason,
    lastRetroAchievementsGameId: runtimeDebugLastRetroAchievementsGameId,
    lastRetroAchievementsTitle: runtimeDebugLastRetroAchievementsTitle,
    lastRetroAchievementsEarned: runtimeDebugLastRetroAchievementsEarned,
    lastRetroAchievementsTotal: runtimeDebugLastRetroAchievementsTotal,
    lastRetroAchievementsSource: runtimeDebugLastRetroAchievementsSource,
    lastRetroAchievementsConfidence: runtimeDebugLastRetroAchievementsConfidence,
    lastRetroAchievementsError: runtimeDebugLastRetroAchievementsError,
    lastRetroAchievementsResolutionSource: runtimeDebugLastRetroAchievementsResolutionSource,
    lastRetroAchievementsResolutionReason: runtimeDebugLastRetroAchievementsResolutionReason,
    lastRetroAchievementsMatchedTitle: runtimeDebugLastRetroAchievementsMatchedTitle,
    lastRetroAchievementsMatchedPlatform: runtimeDebugLastRetroAchievementsMatchedPlatform,
    lastRetroAchievementsMatchedGameId: runtimeDebugLastRetroAchievementsMatchedGameId,
    lastRetroAchievementsCandidateCount: runtimeDebugLastRetroAchievementsCandidateCount,
    lastError: runtimeDebugLastError,
  };
}

function attachRuntimeDebugApi(api: AchievementCompanionRuntimeDebugApi): void {
  if (runtimeDebugHostContext === undefined) {
    return;
  }

  for (const targetWindow of getTargetWindows(runtimeDebugHostContext.hostWindow)) {
    const target = targetWindow as RuntimeDebugRootLike;
    target[ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_GLOBAL_NAME] = api;
  }
}

export function getAchievementCompanionRuntimeDebugApi(): AchievementCompanionRuntimeDebugApi | undefined {
  return runtimeDebugApi;
}

export function getAchievementCompanionRuntimeDebugState(): AchievementCompanionRuntimeDebugState {
  return getAchievementCompanionRuntimeDebugApi()?.getState() ?? computeRuntimeDebugState();
}

export function installAchievementCompanionRuntimeDebug(
  options?: AchievementCompanionRuntimeDebugInstallOptions,
): AchievementCompanionRuntimeDebugApi | undefined {
  const hostContext = resolveAchievementCompanionRuntimeDebugHostContext(options?.doc, options?.win);
  if (hostContext === undefined) {
    return undefined;
  }

  runtimeDebugHostContext = hostContext;

  if (runtimeDebugApi === undefined) {
    runtimeDebugApi = {
      versionMarker: ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_VERSION_MARKER,
      bundleMarker: ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_BUNDLE_MARKER,
      buildMarker: `${ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_BUNDLE_MARKER}:${runtimeDebugStartedAt}`,
      startedAt: runtimeDebugStartedAt,
      getState: () => computeRuntimeDebugState(),
    };
    console.debug("[Achievement Companion] Runtime debug initialized", {
      hostIsTopWindow: hostContext.hostIsTopWindow,
    });
  }

  attachRuntimeDebugApi(runtimeDebugApi);
  return runtimeDebugApi;
}

export function removeAchievementCompanionRuntimeDebug(): void {
  if (runtimeDebugHostContext !== undefined) {
    for (const targetWindow of getTargetWindows(runtimeDebugHostContext.hostWindow)) {
      const target = targetWindow as RuntimeDebugRootLike;
      if (target[ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_GLOBAL_NAME] === runtimeDebugApi) {
        delete target[ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_GLOBAL_NAME];
      }
    }
  }

  runtimeDebugRouteBadgePatchRegistered = false;
  runtimeDebugRouteBadgePatchPath = undefined;
  runtimeDebugRouteBadgePlacementSlot = undefined;
  runtimeDebugRouteBadgePlacementCollisionCount = 0;
  runtimeDebugRouteBadgePlacementCandidateCount = 0;
  runtimeDebugRouteBadgePlacementFallbackUsed = false;
  runtimeDebugRouteBadgePlacementUpdatedAt = undefined;
  runtimeDebugGamePageBadgeActivatedCount = 0;
  runtimeDebugLastGamePageBadgeActivatedAppId = undefined;
  runtimeDebugLastGamePageBadgeActivatedAt = undefined;
  runtimeDebugLastGamePageBadgeNavigationTarget = undefined;
  runtimeDebugLastGamePageBadgeSourceRoute = undefined;
  runtimeDebugLastGamePageBadgeBackRoute = undefined;
  runtimeDebugLastGamePageBadgeNavigationError = undefined;
  runtimeDebugLastGamePageBadgeSystemIconProvider = undefined;
  runtimeDebugLastGamePageBadgeSystemIconPlatform = undefined;
  runtimeDebugLastGamePageBadgeSystemIconUrl = undefined;
  runtimeDebugLastGamePageBadgeSystemIconRendered = false;
  runtimeDebugLastRetroAchievementsShortcutAppId = undefined;
  runtimeDebugLastRetroAchievementsShortcutTitle = undefined;
  runtimeDebugLastRetroAchievementsShortcutPlatform = undefined;
  runtimeDebugLastRetroAchievementsMappingStatus = undefined;
  runtimeDebugLastRetroAchievementsMappingReason = undefined;
  runtimeDebugLastRetroAchievementsGameId = undefined;
  runtimeDebugLastRetroAchievementsTitle = undefined;
  runtimeDebugLastRetroAchievementsEarned = undefined;
  runtimeDebugLastRetroAchievementsTotal = undefined;
  runtimeDebugLastRetroAchievementsSource = undefined;
  runtimeDebugLastRetroAchievementsConfidence = undefined;
  runtimeDebugLastRetroAchievementsError = undefined;
  runtimeDebugLastRetroAchievementsResolutionSource = undefined;
  runtimeDebugLastRetroAchievementsResolutionReason = undefined;
  runtimeDebugLastRetroAchievementsMatchedTitle = undefined;
  runtimeDebugLastRetroAchievementsMatchedPlatform = undefined;
  runtimeDebugLastRetroAchievementsMatchedGameId = undefined;
  runtimeDebugLastRetroAchievementsCandidateCount = undefined;
  runtimeDebugHostContext = undefined;
}

export function markAchievementCompanionGamePageRouteBadgePatchRegistered(path: string): void {
  runtimeDebugRouteBadgePatchRegistered = true;
  runtimeDebugRouteBadgePatchPath = path;
}

export function markAchievementCompanionGamePageRouteBadgePatchRemoved(): void {
  runtimeDebugRouteBadgePatchRegistered = false;
  runtimeDebugRouteBadgePatchPath = undefined;
}

export function markAchievementCompanionGamePageRouteBadgePatchCallback(appId?: string): void {
  runtimeDebugRouteBadgePatchCallbackCount += 1;
  if (appId !== undefined) {
    runtimeDebugLastRouteBadgeAppId = appId;
  }
}

export function markAchievementCompanionGamePageRouteBadgeRenderFuncPatched(): void {
  runtimeDebugRouteBadgeRenderFuncPatchedCount += 1;
}

export function markAchievementCompanionGamePageRouteBadgePatchHandlerFired(appId?: string): void {
  runtimeDebugRouteBadgePatchHandlerFiredCount += 1;
  if (appId !== undefined) {
    runtimeDebugLastRouteBadgeAppId = appId;
  }
}

export function markAchievementCompanionGamePageRouteBadgeInserted(appId?: string): void {
  runtimeDebugRouteBadgeInsertedCount += 1;
  if (appId !== undefined) {
    runtimeDebugLastRouteBadgeAppId = appId;
  }
}

export function markAchievementCompanionGamePageRouteBadgeRendered(appId?: string): void {
  runtimeDebugRouteBadgeRenderedCount += 1;
  runtimeDebugLastRouteBadgeRenderedAt = new Date().toISOString();
  if (appId !== undefined) {
    runtimeDebugLastRouteBadgeAppId = appId;
  }
}

export function markAchievementCompanionGamePageRouteBadgePlacement(
  slotId: string,
  collisionCount: number,
  candidateCount: number,
  fallbackUsed: boolean,
): void {
  runtimeDebugRouteBadgePlacementSlot = slotId;
  runtimeDebugRouteBadgePlacementCollisionCount = collisionCount;
  runtimeDebugRouteBadgePlacementCandidateCount = candidateCount;
  runtimeDebugRouteBadgePlacementFallbackUsed = fallbackUsed;
  runtimeDebugRouteBadgePlacementUpdatedAt = new Date().toISOString();
}

export function markAchievementCompanionGamePageBadgeActivated(args: {
  readonly appId: string | undefined;
  readonly navigationTarget: string | undefined;
  readonly sourceRoute: string | undefined;
  readonly backRoute: string | undefined;
}): void {
  runtimeDebugGamePageBadgeActivatedCount += 1;
  runtimeDebugLastGamePageBadgeActivatedAt = new Date().toISOString();
  runtimeDebugLastGamePageBadgeActivatedAppId = args.appId;
  runtimeDebugLastGamePageBadgeNavigationTarget = args.navigationTarget;
  runtimeDebugLastGamePageBadgeSourceRoute = args.sourceRoute;
  runtimeDebugLastGamePageBadgeBackRoute = args.backRoute;
  runtimeDebugLastGamePageBadgeNavigationError = undefined;
}

export function reportAchievementCompanionGamePageBadgeNavigationError(
  error: unknown,
  context: string,
): string {
  const message = reportAchievementCompanionRuntimeDebugError(error, context);
  runtimeDebugLastGamePageBadgeNavigationError = message;
  return message;
}

export function markAchievementCompanionGamePageBadgeSystemIcon(args: {
  readonly providerId: string | undefined;
  readonly platformLabel: string | undefined;
  readonly iconUrl: string | undefined;
  readonly rendered: boolean;
}): void {
  runtimeDebugLastGamePageBadgeSystemIconProvider = args.providerId;
  runtimeDebugLastGamePageBadgeSystemIconPlatform = args.platformLabel;
  runtimeDebugLastGamePageBadgeSystemIconUrl = args.iconUrl;
  runtimeDebugLastGamePageBadgeSystemIconRendered = args.rendered;
}

export function markAchievementCompanionGamePageAchievementBadgeRendered(
  currentRouteUrl: string | undefined,
  appId: string | undefined,
): void {
  runtimeDebugBadgeRenderCount += 1;
  runtimeDebugLastBadgeRenderAt = new Date().toISOString();
  runtimeDebugLastBadgeRenderAppId = appId ?? runtimeDebugLastBadgeRenderAppId;
  runtimeDebugLastObservedRouteUrl = currentRouteUrl ?? runtimeDebugLastObservedRouteUrl;
  runtimeDebugLastObservedDetection = detectDeckyGamePageAchievementRouteFromUrl(
    runtimeDebugLastObservedRouteUrl,
  );
  console.debug("[Achievement Companion] Game-page achievement badge rendered", {
    appId: runtimeDebugLastBadgeRenderAppId,
    currentRouteUrl: runtimeDebugLastObservedRouteUrl,
  });
}

export function markAchievementCompanionGamePageAchievementBadgeClicked(appId?: string): void {
  runtimeDebugLastBadgeClickAt = new Date().toISOString();
  if (appId !== undefined) {
    runtimeDebugLastBadgeRenderAppId = appId;
  }
}

export function markAchievementCompanionGamePageAchievementSummaryFetchStarted(appId: string): void {
  runtimeDebugLastSummaryFetchStartedAt = new Date().toISOString();
  runtimeDebugLastObservedRouteUrl = runtimeDebugLastObservedRouteUrl;
  runtimeDebugLastObservedDetection = {
    ...(runtimeDebugLastObservedDetection ?? {
      isGamePage: true,
      appId,
      reason: "target-url-route" as const,
    }),
    appId,
  };
}

export function markAchievementCompanionGamePageAchievementSummaryFetchCompleted(
  summary: GamePageAchievementSummary,
): void {
  runtimeDebugLastSummaryFetchCompletedAt = new Date().toISOString();
  runtimeDebugLastSummaryStatus = summary.status;
  runtimeDebugLastSummaryProvider = summary.status === "ready" ? summary.provider : undefined;
  runtimeDebugLastSummaryEarned = summary.status === "ready" ? summary.earned : undefined;
  runtimeDebugLastSummaryTotal = summary.status === "ready" ? summary.total : undefined;
  runtimeDebugLastSummaryUnavailableReason =
    summary.status === "unavailable"
      ? summary.reason
      : summary.status === "error"
        ? summary.message
        : undefined;
}

export function reportAchievementCompanionGamePageAchievementSummaryError(
  appId: string,
  error: unknown,
  context: string,
): string {
  const message = reportAchievementCompanionRuntimeDebugError(error, context);
  runtimeDebugLastSummaryStatus = "error";
  runtimeDebugLastSummaryProvider = undefined;
  runtimeDebugLastSummaryEarned = undefined;
  runtimeDebugLastSummaryTotal = undefined;
  runtimeDebugLastSummaryUnavailableReason = message;
  runtimeDebugLastSummaryFetchCompletedAt = new Date().toISOString();
  runtimeDebugLastBadgeRenderAppId = appId;
  return message;
}

export function markAchievementCompanionRetroAchievementsShortcutResolution(args: {
  readonly appId: string;
  readonly status: "mapped" | "unavailable" | "error";
  readonly reason?: string;
  readonly gameId?: string;
  readonly title?: string;
  readonly earned?: number;
  readonly total?: number;
  readonly source?: string;
  readonly confidence?: string;
  readonly error?: string;
  readonly shortcutTitle?: string;
  readonly shortcutPlatform?: string;
  readonly resolutionSource?: string;
  readonly resolutionReason?: string;
  readonly matchedTitle?: string;
  readonly matchedPlatform?: string;
  readonly matchedGameId?: string;
  readonly candidateCount?: number;
}): void {
  runtimeDebugLastRetroAchievementsShortcutAppId = args.appId;
  runtimeDebugLastRetroAchievementsShortcutTitle = args.shortcutTitle;
  runtimeDebugLastRetroAchievementsShortcutPlatform = args.shortcutPlatform;
  runtimeDebugLastRetroAchievementsMappingStatus = args.status;
  runtimeDebugLastRetroAchievementsMappingReason = args.reason;
  runtimeDebugLastRetroAchievementsGameId = args.gameId;
  runtimeDebugLastRetroAchievementsTitle = args.title;
  runtimeDebugLastRetroAchievementsEarned = args.earned;
  runtimeDebugLastRetroAchievementsTotal = args.total;
  runtimeDebugLastRetroAchievementsSource = args.source;
  runtimeDebugLastRetroAchievementsConfidence = args.confidence;
  runtimeDebugLastRetroAchievementsError = args.error;
  runtimeDebugLastRetroAchievementsResolutionSource = args.resolutionSource;
  runtimeDebugLastRetroAchievementsResolutionReason = args.resolutionReason;
  runtimeDebugLastRetroAchievementsMatchedTitle = args.matchedTitle;
  runtimeDebugLastRetroAchievementsMatchedPlatform = args.matchedPlatform;
  runtimeDebugLastRetroAchievementsMatchedGameId = args.matchedGameId;
  runtimeDebugLastRetroAchievementsCandidateCount = args.candidateCount;
}
