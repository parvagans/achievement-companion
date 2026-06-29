import {
  detectDeckyGamePageAchievementRouteFromUrl,
  type DeckyGamePageAchievementRouteDetectionState,
} from "./decky-game-page-achievement-route";

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
  readonly globalComponentRegistered: boolean;
  readonly globalComponentName: string | undefined;
  readonly globalComponentRenderCount: number;
  readonly globalComponentVisibleRenderCount: number;
  readonly globalComponentHiddenRenderCount: number;
  readonly globalComponentLastRouteUrl: string | undefined;
  readonly globalComponentLastDetectedAppId: string | undefined;
  readonly globalComponentLastDetectionReason: string | undefined;
  readonly globalComponentLastRenderAt: string | undefined;
  readonly globalComponentLastError: string | undefined;
  readonly badgeRendered: boolean;
  readonly badgeRenderCount: number;
  readonly lastBadgeRenderAt: string | undefined;
  readonly lastBadgeRenderAppId: string | undefined;
  readonly lastBadgeClickAt: string | undefined;
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
let runtimeDebugGlobalComponentRegistered = false;
let runtimeDebugGlobalComponentName: string | undefined;
let runtimeDebugGlobalComponentRenderCount = 0;
let runtimeDebugGlobalComponentVisibleRenderCount = 0;
let runtimeDebugGlobalComponentHiddenRenderCount = 0;
let runtimeDebugGlobalComponentLastRouteUrl: string | undefined;
let runtimeDebugGlobalComponentLastDetectedAppId: string | undefined;
let runtimeDebugGlobalComponentLastDetectionReason: string | undefined;
let runtimeDebugGlobalComponentLastRenderAt: string | undefined;
let runtimeDebugGlobalComponentLastError: string | undefined;
let runtimeDebugBadgeRenderCount = 0;
let runtimeDebugLastBadgeRenderAt: string | undefined;
let runtimeDebugLastBadgeRenderAppId: string | undefined;
let runtimeDebugLastBadgeClickAt: string | undefined;
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
    globalComponentRegistered: runtimeDebugGlobalComponentRegistered,
    globalComponentName: runtimeDebugGlobalComponentName,
    globalComponentRenderCount: runtimeDebugGlobalComponentRenderCount,
    globalComponentVisibleRenderCount: runtimeDebugGlobalComponentVisibleRenderCount,
    globalComponentHiddenRenderCount: runtimeDebugGlobalComponentHiddenRenderCount,
    globalComponentLastRouteUrl: runtimeDebugGlobalComponentLastRouteUrl,
    globalComponentLastDetectedAppId: runtimeDebugGlobalComponentLastDetectedAppId,
    globalComponentLastDetectionReason: runtimeDebugGlobalComponentLastDetectionReason,
    globalComponentLastRenderAt: runtimeDebugGlobalComponentLastRenderAt,
    globalComponentLastError: runtimeDebugGlobalComponentLastError,
    badgeRendered: runtimeDebugBadgeRenderCount > 0,
    badgeRenderCount: runtimeDebugBadgeRenderCount,
    lastBadgeRenderAt: runtimeDebugLastBadgeRenderAt,
    lastBadgeRenderAppId: runtimeDebugLastBadgeRenderAppId,
    lastBadgeClickAt: runtimeDebugLastBadgeClickAt,
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

  runtimeDebugGlobalComponentRegistered = false;
  runtimeDebugGlobalComponentName = undefined;
  runtimeDebugHostContext = undefined;
}

export function markAchievementCompanionGamePageGlobalComponentRegistered(name: string): void {
  runtimeDebugGlobalComponentRegistered = true;
  runtimeDebugGlobalComponentName = name;
  console.debug("[Achievement Companion] Game-page achievement badge global component registered", {
    name,
  });
}

export function markAchievementCompanionGamePageGlobalComponentRemoved(): void {
  runtimeDebugGlobalComponentRegistered = false;
  runtimeDebugGlobalComponentName = undefined;
  console.debug("[Achievement Companion] Game-page achievement badge global component removed");
}

export function markAchievementCompanionGamePageGlobalComponentRendered(
  currentRouteUrl: string | undefined,
  detection: DeckyGamePageAchievementRouteDetectionState,
): void {
  runtimeDebugGlobalComponentRenderCount += 1;
  runtimeDebugGlobalComponentLastRenderAt = new Date().toISOString();
  runtimeDebugGlobalComponentLastRouteUrl = currentRouteUrl;
  runtimeDebugGlobalComponentLastDetectedAppId = detection.appId;
  runtimeDebugGlobalComponentLastDetectionReason = detection.reason;
  runtimeDebugLastObservedRouteUrl = currentRouteUrl ?? runtimeDebugLastObservedRouteUrl;
  runtimeDebugLastObservedDetection = detection;
  if (detection.isGamePage) {
    runtimeDebugGlobalComponentVisibleRenderCount += 1;
  } else {
    runtimeDebugGlobalComponentHiddenRenderCount += 1;
  }
  console.debug("[Achievement Companion] global component render", {
    appId: detection.appId,
    currentRouteUrl,
    detectionReason: detection.reason,
    visible: detection.isGamePage,
  });
}

export function reportAchievementCompanionGamePageGlobalComponentError(
  error: unknown,
  context: string,
): string {
  const message = reportAchievementCompanionRuntimeDebugError(error, context);
  runtimeDebugGlobalComponentLastError = message;
  return message;
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
