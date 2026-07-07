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
  readonly lastGamePageBadgeCompletionStatus: "beaten" | "mastered" | undefined;
  readonly lastGamePageBadgeStatusVariant: "plain" | "beaten" | "mastered" | undefined;
  readonly lastGamePageBadgeStatusRendered: boolean;
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
  readonly lastGamePageShortcutDetectedAppId: string | undefined;
  readonly lastGamePageShortcutTitle: string | undefined;
  readonly lastGamePageShortcutPlatform: string | undefined;
  readonly lastGamePageShortcutDetectionReason: string | undefined;
  readonly lastGamePageShortcutNextPath: string | undefined;
  readonly lastRetroAchievementsShortcutAppId: string | undefined;
  readonly lastRetroAchievementsShortcutTitle: string | undefined;
  readonly lastRetroAchievementsShortcutPlatform: string | undefined;
  readonly lastRetroAchievementsNormalizedPlatform: string | undefined;
  readonly lastRetroAchievementsMappingStatus: "mapped" | "unavailable" | "error" | undefined;
  readonly lastRetroAchievementsMappingReason: string | undefined;
  readonly lastRetroAchievementsHashResolverAttempted: boolean;
  readonly lastRetroAchievementsHashResolverSkippedReason: string | undefined;
  readonly lastRetroAchievementsShortcutRomPathDetected: boolean;
  readonly lastRetroAchievementsShortcutRomPathSource: string | undefined;
  readonly lastRetroAchievementsRomHashAttempted: boolean;
  readonly lastRetroAchievementsRomHashStatus: string | undefined;
  readonly lastRetroAchievementsRomHashAlgorithm: string | undefined;
  readonly lastRetroAchievementsRomHashPrefix: string | undefined;
  readonly lastRetroAchievementsRaHashLookupAttempted: boolean;
  readonly lastRetroAchievementsRaHashLookupStatus: string | undefined;
  readonly lastRetroAchievementsRaHashMatchedGameId: string | undefined;
  readonly lastRetroAchievementsRaHashMatchedTitle: string | undefined;
  readonly lastRetroAchievementsRaHashMatchedConsoleId: string | undefined;
  readonly lastRetroAchievementsRaHashMatchedConsoleName: string | undefined;
  readonly lastRetroAchievementsHashRejectedReason: string | undefined;
  readonly lastRetroAchievementsFinalResolverSource: "hash" | "title" | "completion-progress" | "unavailable" | undefined;
  readonly lastRetroAchievementsGameId: string | undefined;
  readonly lastRetroAchievementsTitle: string | undefined;
  readonly lastRetroAchievementsEarned: number | undefined;
  readonly lastRetroAchievementsTotal: number | undefined;
  readonly lastRetroAchievementsSource: string | undefined;
  readonly lastRetroAchievementsConfidence: string | undefined;
  readonly lastRetroAchievementsError: string | undefined;
  readonly lastRetroAchievementsResolutionSource: string | undefined;
  readonly lastRetroAchievementsResolutionReason: string | undefined;
  readonly lastRetroAchievementsResolvedSystemName: string | undefined;
  readonly lastRetroAchievementsResolvedConsoleId: string | undefined;
  readonly lastRetroAchievementsMatchedTitle: string | undefined;
  readonly lastRetroAchievementsMatchedPlatform: string | undefined;
  readonly lastRetroAchievementsMatchedGameId: string | undefined;
  readonly lastRetroAchievementsCandidateCount: number | undefined;
  readonly lastRetroAchievementsDetailLoadStatus: string | undefined;
  readonly lastRetroAchievementsDetailLoadReason: string | undefined;
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
export const ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_VERSION_MARKER = "0.3.2-runtime";
export const ACHIEVEMENT_COMPANION_RUNTIME_DEBUG_BUNDLE_MARKER = "decky-game-page-bubble";
export const ACHIEVEMENT_COMPANION_LAST_GAME_PAGE_BADGE_DEBUG_STORAGE_KEY =
  "achievement-companion:decky:last-game-page-badge-debug";
export const ACHIEVEMENT_COMPANION_LAST_RA_SHORTCUT_RESOLUTION_DEBUG_STORAGE_KEY =
  "achievement-companion:decky:last-ra-shortcut-resolution-debug";

export interface AchievementCompanionGamePageBadgePipelineDebugRecord {
  readonly timestamp: string;
  readonly routeAppId?: string;
  readonly routePatternMatched: boolean;
  readonly routePatchHandlerFired: boolean;
  readonly routeBadgeInserted: boolean;
  readonly routeBadgeRendered: boolean;
  readonly summaryLoadStarted: boolean;
  readonly summaryLoadFinished: boolean;
  readonly summaryStatus?: GamePageAchievementSummary["status"];
  readonly summaryProvider?: "steam" | "retroachievements";
  readonly summaryGameId?: string;
  readonly summaryTitle?: string;
  readonly summaryEarned?: number;
  readonly summaryTotal?: number;
  readonly summaryCompletionStatus?: "beaten" | "mastered";
  readonly summaryReason?: string;
  readonly placementAttempted: boolean;
  readonly placementSlot?: string;
  readonly placementRejectedReasons: readonly string[];
  readonly placementFallbackUsed: boolean;
  readonly badgeCompletionStatus?: "beaten" | "mastered";
  readonly badgeStatusVariant?: "plain" | "beaten" | "mastered";
  readonly nativeBadgeStatusRendered?: boolean;
  readonly badgeHiddenReason?: string;
  readonly thrownErrorMessage?: string;
}

export interface AchievementCompanionRaShortcutResolutionDebugRecord {
  readonly timestamp: string;
  readonly appId?: string;
  readonly shortcutMetadataLoaded: boolean;
  readonly shortcutTitle?: string;
  readonly shortcutPlatform?: string;
  readonly normalizedPlatform?: string;
  readonly steamSkippedBecauseShortcut: boolean;
  readonly resolverStage?: string;
  readonly dashboardSummaryCandidateCount?: number;
  readonly completionProgressCandidateCount?: number;
  readonly completionProgressRelevantCandidates: readonly {
    readonly id?: string;
    readonly title?: string;
    readonly console?: string;
  }[];
  readonly completionProgressAmbiguousCandidateTitles: readonly string[];
  readonly dashboardIdentityCandidateCount?: number;
  readonly apiSystemsResolvedConsoleId?: string;
  readonly apiSystemsResolvedConsoleName?: string;
  readonly apiGameListRequestConsoleId?: string;
  readonly apiGameListCandidateCount?: number;
  readonly apiGameListRelevantCandidates: readonly {
    readonly id?: string;
    readonly title?: string;
    readonly console?: string;
  }[];
  readonly apiMatchedGameId?: string;
  readonly apiMatchedTitle?: string;
  readonly apiAmbiguousCandidateTitles: readonly string[];
  readonly detailLoadAttempted: boolean;
  readonly detailLoadStatus?: string;
  readonly detailLoadReason?: string;
  readonly detailGameId?: string;
  readonly detailTitle?: string;
  readonly detailPlatformLabel?: string;
  readonly detailEarned?: number;
  readonly detailEarnedHardcore?: number;
  readonly detailTotal?: number;
  readonly hashResolverAttempted?: boolean;
  readonly hashResolverSkippedReason?: string;
  readonly shortcutRomPathDetected?: boolean;
  readonly shortcutRomPathSource?: string;
  readonly romHashAttempted?: boolean;
  readonly romHashStatus?: string;
  readonly romHashAlgorithm?: string;
  readonly romHashPrefix?: string;
  readonly raHashLookupAttempted?: boolean;
  readonly raHashLookupStatus?: string;
  readonly raHashMatchedGameId?: string;
  readonly raHashMatchedTitle?: string;
  readonly raHashMatchedConsoleId?: string;
  readonly raHashMatchedConsoleName?: string;
  readonly hashRejectedReason?: string;
  readonly finalResolverSource?: "hash" | "title" | "completion-progress" | "unavailable";
  readonly finalStatus?: "mapped" | "unavailable" | "error";
  readonly finalReason?: string;
  readonly returnedSummaryProvider?: "steam" | "retroachievements";
  readonly returnedSummaryEarned?: number;
  readonly returnedSummaryTotal?: number;
  readonly thrownErrorMessage?: string;
}

type AchievementCompanionGamePageBadgePipelineDebugUpdate = {
  [K in keyof AchievementCompanionGamePageBadgePipelineDebugRecord]?:
    | AchievementCompanionGamePageBadgePipelineDebugRecord[K]
    | undefined;
};

type AchievementCompanionRaShortcutResolutionDebugUpdate = {
  [K in keyof AchievementCompanionRaShortcutResolutionDebugRecord]?:
    | AchievementCompanionRaShortcutResolutionDebugRecord[K]
    | undefined;
} & {
  readonly clearKeys?:
    | readonly AchievementCompanionRaShortcutResolutionDebugClearKey[]
    | undefined;
};

type AchievementCompanionGamePageBadgePipelineDebugClearKey =
  keyof AchievementCompanionGamePageBadgePipelineDebugRecord;
type AchievementCompanionRaShortcutResolutionDebugClearKey =
  keyof AchievementCompanionRaShortcutResolutionDebugRecord;

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
let runtimeDebugLastGamePageBadgeCompletionStatus: "beaten" | "mastered" | undefined;
let runtimeDebugLastGamePageBadgeStatusVariant: "plain" | "beaten" | "mastered" | undefined;
let runtimeDebugLastGamePageBadgeStatusRendered = false;
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
let runtimeDebugLastGamePageShortcutDetectedAppId: string | undefined;
let runtimeDebugLastGamePageShortcutTitle: string | undefined;
let runtimeDebugLastGamePageShortcutPlatform: string | undefined;
let runtimeDebugLastGamePageShortcutDetectionReason: string | undefined;
let runtimeDebugLastGamePageShortcutNextPath: string | undefined;
let runtimeDebugLastRetroAchievementsShortcutAppId: string | undefined;
let runtimeDebugLastRetroAchievementsShortcutTitle: string | undefined;
let runtimeDebugLastRetroAchievementsShortcutPlatform: string | undefined;
let runtimeDebugLastRetroAchievementsNormalizedPlatform: string | undefined;
let runtimeDebugLastRetroAchievementsMappingStatus: "mapped" | "unavailable" | "error" | undefined;
let runtimeDebugLastRetroAchievementsMappingReason: string | undefined;
let runtimeDebugLastRetroAchievementsHashResolverAttempted = false;
let runtimeDebugLastRetroAchievementsHashResolverSkippedReason: string | undefined;
let runtimeDebugLastRetroAchievementsShortcutRomPathDetected = false;
let runtimeDebugLastRetroAchievementsShortcutRomPathSource: string | undefined;
let runtimeDebugLastRetroAchievementsRomHashAttempted = false;
let runtimeDebugLastRetroAchievementsRomHashStatus: string | undefined;
let runtimeDebugLastRetroAchievementsRomHashAlgorithm: string | undefined;
let runtimeDebugLastRetroAchievementsRomHashPrefix: string | undefined;
let runtimeDebugLastRetroAchievementsRaHashLookupAttempted = false;
let runtimeDebugLastRetroAchievementsRaHashLookupStatus: string | undefined;
let runtimeDebugLastRetroAchievementsRaHashMatchedGameId: string | undefined;
let runtimeDebugLastRetroAchievementsRaHashMatchedTitle: string | undefined;
let runtimeDebugLastRetroAchievementsRaHashMatchedConsoleId: string | undefined;
let runtimeDebugLastRetroAchievementsRaHashMatchedConsoleName: string | undefined;
let runtimeDebugLastRetroAchievementsHashRejectedReason: string | undefined;
let runtimeDebugLastRetroAchievementsFinalResolverSource: "hash" | "title" | "completion-progress" | "unavailable" | undefined;
let runtimeDebugLastRetroAchievementsGameId: string | undefined;
let runtimeDebugLastRetroAchievementsTitle: string | undefined;
let runtimeDebugLastRetroAchievementsEarned: number | undefined;
let runtimeDebugLastRetroAchievementsTotal: number | undefined;
let runtimeDebugLastRetroAchievementsSource: string | undefined;
let runtimeDebugLastRetroAchievementsConfidence: string | undefined;
let runtimeDebugLastRetroAchievementsError: string | undefined;
let runtimeDebugLastRetroAchievementsResolutionSource: string | undefined;
let runtimeDebugLastRetroAchievementsResolutionReason: string | undefined;
let runtimeDebugLastRetroAchievementsResolvedSystemName: string | undefined;
let runtimeDebugLastRetroAchievementsResolvedConsoleId: string | undefined;
let runtimeDebugLastRetroAchievementsMatchedTitle: string | undefined;
let runtimeDebugLastRetroAchievementsMatchedPlatform: string | undefined;
let runtimeDebugLastRetroAchievementsMatchedGameId: string | undefined;
let runtimeDebugLastRetroAchievementsCandidateCount: number | undefined;
let runtimeDebugLastRetroAchievementsDetailLoadStatus: string | undefined;
let runtimeDebugLastRetroAchievementsDetailLoadReason: string | undefined;
let runtimeDebugLastObservedRouteUrl: string | undefined;
let runtimeDebugLastObservedDetection: DeckyGamePageAchievementRouteDetectionState | undefined;
let runtimeDebugLastError: string | undefined;
let runtimeDebugLastGamePageBadgeDiagnostic: AchievementCompanionGamePageBadgePipelineDebugRecord = {
  timestamp: new Date().toISOString(),
  routePatternMatched: false,
  routePatchHandlerFired: false,
  routeBadgeInserted: false,
  routeBadgeRendered: false,
  summaryLoadStarted: false,
  summaryLoadFinished: false,
  placementAttempted: false,
  placementRejectedReasons: [],
  placementFallbackUsed: false,
};
let runtimeDebugLastRaShortcutResolutionDiagnostic: AchievementCompanionRaShortcutResolutionDebugRecord = {
  timestamp: new Date().toISOString(),
  shortcutMetadataLoaded: false,
  steamSkippedBecauseShortcut: false,
  completionProgressRelevantCandidates: [],
  completionProgressAmbiguousCandidateTitles: [],
  apiGameListRelevantCandidates: [],
  apiAmbiguousCandidateTitles: [],
  detailLoadAttempted: false,
};

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

function writeAchievementCompanionRuntimeDebugStorage(
  key: string,
  value: unknown,
): void {
  try {
    const storage = globalThis.localStorage;
    if (storage === undefined) {
      return;
    }

    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write failures in Steam/Decky runtime.
  }
}

export function getAchievementCompanionLastGamePageBadgeDebug():
  AchievementCompanionGamePageBadgePipelineDebugRecord {
  return runtimeDebugLastGamePageBadgeDiagnostic;
}

export function getAchievementCompanionLastRaShortcutResolutionDebug():
  AchievementCompanionRaShortcutResolutionDebugRecord {
  return runtimeDebugLastRaShortcutResolutionDiagnostic;
}

function omitUndefinedObjectValues<T extends Record<string, unknown>>(value: T): Partial<T> {
  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined);
  return Object.fromEntries(entries) as Partial<T>;
}

export function updateAchievementCompanionGamePageBadgeDebug(
  update: AchievementCompanionGamePageBadgePipelineDebugUpdate,
  options?: {
    readonly clearKeys?: readonly AchievementCompanionGamePageBadgePipelineDebugClearKey[];
  },
): AchievementCompanionGamePageBadgePipelineDebugRecord {
  const nextDiagnostic = {
    ...runtimeDebugLastGamePageBadgeDiagnostic,
    ...omitUndefinedObjectValues(update),
    timestamp: new Date().toISOString(),
  } as Record<string, unknown>;
  for (const clearKey of options?.clearKeys ?? []) {
    delete nextDiagnostic[clearKey];
  }
  runtimeDebugLastGamePageBadgeDiagnostic = omitUndefinedObjectValues(nextDiagnostic) as unknown as AchievementCompanionGamePageBadgePipelineDebugRecord;
  writeAchievementCompanionRuntimeDebugStorage(
    ACHIEVEMENT_COMPANION_LAST_GAME_PAGE_BADGE_DEBUG_STORAGE_KEY,
    runtimeDebugLastGamePageBadgeDiagnostic,
  );
  console.debug("[Achievement Companion][Game Page Badge]", runtimeDebugLastGamePageBadgeDiagnostic);
  return runtimeDebugLastGamePageBadgeDiagnostic;
}

export function updateAchievementCompanionRaShortcutResolutionDebug(
  update: AchievementCompanionRaShortcutResolutionDebugUpdate,
  options?: {
    readonly clearKeys?: readonly AchievementCompanionRaShortcutResolutionDebugClearKey[];
  },
): AchievementCompanionRaShortcutResolutionDebugRecord {
  const { clearKeys: updateClearKeys, ...updateWithoutClearKeys } = update;
  const nextDiagnostic = {
    ...runtimeDebugLastRaShortcutResolutionDiagnostic,
    ...omitUndefinedObjectValues(updateWithoutClearKeys),
    timestamp: new Date().toISOString(),
  } as Record<string, unknown>;
  for (const clearKey of updateClearKeys ?? options?.clearKeys ?? []) {
    delete nextDiagnostic[clearKey];
  }
  runtimeDebugLastRaShortcutResolutionDiagnostic = omitUndefinedObjectValues(nextDiagnostic) as unknown as AchievementCompanionRaShortcutResolutionDebugRecord;
  writeAchievementCompanionRuntimeDebugStorage(
    ACHIEVEMENT_COMPANION_LAST_RA_SHORTCUT_RESOLUTION_DEBUG_STORAGE_KEY,
    runtimeDebugLastRaShortcutResolutionDiagnostic,
  );
  console.debug(
    "[Achievement Companion][RA Shortcut Resolver]",
    runtimeDebugLastRaShortcutResolutionDiagnostic,
  );
  return runtimeDebugLastRaShortcutResolutionDiagnostic;
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
    lastGamePageBadgeCompletionStatus: runtimeDebugLastGamePageBadgeCompletionStatus,
    lastGamePageBadgeStatusVariant: runtimeDebugLastGamePageBadgeStatusVariant,
    lastGamePageBadgeStatusRendered: runtimeDebugLastGamePageBadgeStatusRendered,
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
    lastGamePageShortcutDetectedAppId: runtimeDebugLastGamePageShortcutDetectedAppId,
    lastGamePageShortcutTitle: runtimeDebugLastGamePageShortcutTitle,
    lastGamePageShortcutPlatform: runtimeDebugLastGamePageShortcutPlatform,
    lastGamePageShortcutDetectionReason: runtimeDebugLastGamePageShortcutDetectionReason,
    lastGamePageShortcutNextPath: runtimeDebugLastGamePageShortcutNextPath,
    lastRetroAchievementsShortcutAppId: runtimeDebugLastRetroAchievementsShortcutAppId,
    lastRetroAchievementsShortcutTitle: runtimeDebugLastRetroAchievementsShortcutTitle,
    lastRetroAchievementsShortcutPlatform: runtimeDebugLastRetroAchievementsShortcutPlatform,
    lastRetroAchievementsNormalizedPlatform: runtimeDebugLastRetroAchievementsNormalizedPlatform,
    lastRetroAchievementsMappingStatus: runtimeDebugLastRetroAchievementsMappingStatus,
    lastRetroAchievementsMappingReason: runtimeDebugLastRetroAchievementsMappingReason,
    lastRetroAchievementsHashResolverAttempted: runtimeDebugLastRetroAchievementsHashResolverAttempted,
    lastRetroAchievementsHashResolverSkippedReason: runtimeDebugLastRetroAchievementsHashResolverSkippedReason,
    lastRetroAchievementsShortcutRomPathDetected: runtimeDebugLastRetroAchievementsShortcutRomPathDetected,
    lastRetroAchievementsShortcutRomPathSource: runtimeDebugLastRetroAchievementsShortcutRomPathSource,
    lastRetroAchievementsRomHashAttempted: runtimeDebugLastRetroAchievementsRomHashAttempted,
    lastRetroAchievementsRomHashStatus: runtimeDebugLastRetroAchievementsRomHashStatus,
    lastRetroAchievementsRomHashAlgorithm: runtimeDebugLastRetroAchievementsRomHashAlgorithm,
    lastRetroAchievementsRomHashPrefix: runtimeDebugLastRetroAchievementsRomHashPrefix,
    lastRetroAchievementsRaHashLookupAttempted: runtimeDebugLastRetroAchievementsRaHashLookupAttempted,
    lastRetroAchievementsRaHashLookupStatus: runtimeDebugLastRetroAchievementsRaHashLookupStatus,
    lastRetroAchievementsRaHashMatchedGameId: runtimeDebugLastRetroAchievementsRaHashMatchedGameId,
    lastRetroAchievementsRaHashMatchedTitle: runtimeDebugLastRetroAchievementsRaHashMatchedTitle,
    lastRetroAchievementsRaHashMatchedConsoleId: runtimeDebugLastRetroAchievementsRaHashMatchedConsoleId,
    lastRetroAchievementsRaHashMatchedConsoleName: runtimeDebugLastRetroAchievementsRaHashMatchedConsoleName,
    lastRetroAchievementsHashRejectedReason: runtimeDebugLastRetroAchievementsHashRejectedReason,
    lastRetroAchievementsFinalResolverSource: runtimeDebugLastRetroAchievementsFinalResolverSource,
    lastRetroAchievementsGameId: runtimeDebugLastRetroAchievementsGameId,
    lastRetroAchievementsTitle: runtimeDebugLastRetroAchievementsTitle,
    lastRetroAchievementsEarned: runtimeDebugLastRetroAchievementsEarned,
    lastRetroAchievementsTotal: runtimeDebugLastRetroAchievementsTotal,
    lastRetroAchievementsSource: runtimeDebugLastRetroAchievementsSource,
    lastRetroAchievementsConfidence: runtimeDebugLastRetroAchievementsConfidence,
    lastRetroAchievementsError: runtimeDebugLastRetroAchievementsError,
    lastRetroAchievementsResolutionSource: runtimeDebugLastRetroAchievementsResolutionSource,
    lastRetroAchievementsResolutionReason: runtimeDebugLastRetroAchievementsResolutionReason,
    lastRetroAchievementsResolvedSystemName: runtimeDebugLastRetroAchievementsResolvedSystemName,
    lastRetroAchievementsResolvedConsoleId: runtimeDebugLastRetroAchievementsResolvedConsoleId,
    lastRetroAchievementsMatchedTitle: runtimeDebugLastRetroAchievementsMatchedTitle,
    lastRetroAchievementsMatchedPlatform: runtimeDebugLastRetroAchievementsMatchedPlatform,
    lastRetroAchievementsMatchedGameId: runtimeDebugLastRetroAchievementsMatchedGameId,
    lastRetroAchievementsCandidateCount: runtimeDebugLastRetroAchievementsCandidateCount,
    lastRetroAchievementsDetailLoadStatus: runtimeDebugLastRetroAchievementsDetailLoadStatus,
    lastRetroAchievementsDetailLoadReason: runtimeDebugLastRetroAchievementsDetailLoadReason,
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
  runtimeDebugLastGamePageBadgeCompletionStatus = undefined;
  runtimeDebugLastGamePageBadgeStatusVariant = undefined;
  runtimeDebugLastGamePageBadgeStatusRendered = false;
  runtimeDebugLastGamePageShortcutDetectedAppId = undefined;
  runtimeDebugLastGamePageShortcutTitle = undefined;
  runtimeDebugLastGamePageShortcutPlatform = undefined;
  runtimeDebugLastGamePageShortcutDetectionReason = undefined;
  runtimeDebugLastGamePageShortcutNextPath = undefined;
  runtimeDebugLastRetroAchievementsShortcutAppId = undefined;
  runtimeDebugLastRetroAchievementsShortcutTitle = undefined;
  runtimeDebugLastRetroAchievementsShortcutPlatform = undefined;
  runtimeDebugLastRetroAchievementsMappingStatus = undefined;
  runtimeDebugLastRetroAchievementsMappingReason = undefined;
  runtimeDebugLastRetroAchievementsHashResolverAttempted = false;
  runtimeDebugLastRetroAchievementsHashResolverSkippedReason = undefined;
  runtimeDebugLastRetroAchievementsShortcutRomPathDetected = false;
  runtimeDebugLastRetroAchievementsShortcutRomPathSource = undefined;
  runtimeDebugLastRetroAchievementsRomHashAttempted = false;
  runtimeDebugLastRetroAchievementsRomHashStatus = undefined;
  runtimeDebugLastRetroAchievementsRomHashAlgorithm = undefined;
  runtimeDebugLastRetroAchievementsRomHashPrefix = undefined;
  runtimeDebugLastRetroAchievementsRaHashLookupAttempted = false;
  runtimeDebugLastRetroAchievementsRaHashLookupStatus = undefined;
  runtimeDebugLastRetroAchievementsRaHashMatchedGameId = undefined;
  runtimeDebugLastRetroAchievementsRaHashMatchedTitle = undefined;
  runtimeDebugLastRetroAchievementsRaHashMatchedConsoleId = undefined;
  runtimeDebugLastRetroAchievementsRaHashMatchedConsoleName = undefined;
  runtimeDebugLastRetroAchievementsHashRejectedReason = undefined;
  runtimeDebugLastRetroAchievementsFinalResolverSource = undefined;
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
  runtimeDebugLastGamePageBadgeDiagnostic = {
    timestamp: new Date().toISOString(),
    routePatternMatched: false,
    routePatchHandlerFired: false,
    routeBadgeInserted: false,
    routeBadgeRendered: false,
    summaryLoadStarted: false,
    summaryLoadFinished: false,
    placementAttempted: false,
    placementRejectedReasons: [],
    placementFallbackUsed: false,
  };
  runtimeDebugLastRaShortcutResolutionDiagnostic = {
    timestamp: new Date().toISOString(),
    shortcutMetadataLoaded: false,
    steamSkippedBecauseShortcut: false,
    completionProgressRelevantCandidates: [],
    completionProgressAmbiguousCandidateTitles: [],
    apiGameListRelevantCandidates: [],
    apiAmbiguousCandidateTitles: [],
    detailLoadAttempted: false,
  };
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
  updateAchievementCompanionGamePageBadgeDebug({
    ...(appId !== undefined ? { routeAppId: appId } : {}),
    routePatternMatched: true,
  });
}

export function markAchievementCompanionGamePageRouteBadgeRenderFuncPatched(): void {
  runtimeDebugRouteBadgeRenderFuncPatchedCount += 1;
}

export function markAchievementCompanionGamePageRouteBadgePatchHandlerFired(appId?: string): void {
  runtimeDebugRouteBadgePatchHandlerFiredCount += 1;
  if (appId !== undefined) {
    runtimeDebugLastRouteBadgeAppId = appId;
  }
  updateAchievementCompanionGamePageBadgeDebug({
    ...(appId !== undefined ? { routeAppId: appId } : {}),
    routePatchHandlerFired: true,
  });
}

export function markAchievementCompanionGamePageRouteBadgeInserted(appId?: string): void {
  runtimeDebugRouteBadgeInsertedCount += 1;
  if (appId !== undefined) {
    runtimeDebugLastRouteBadgeAppId = appId;
  }
  updateAchievementCompanionGamePageBadgeDebug({
    ...(appId !== undefined ? { routeAppId: appId } : {}),
    routeBadgeInserted: true,
  });
}

export function markAchievementCompanionGamePageRouteBadgeRendered(appId?: string): void {
  runtimeDebugRouteBadgeRenderedCount += 1;
  runtimeDebugLastRouteBadgeRenderedAt = new Date().toISOString();
  if (appId !== undefined) {
    runtimeDebugLastRouteBadgeAppId = appId;
  }
  updateAchievementCompanionGamePageBadgeDebug({
    ...(appId !== undefined ? { routeAppId: appId } : {}),
    routeBadgeRendered: true,
  });
}

export function markAchievementCompanionGamePageRouteBadgePlacement(
  slotId: string,
  collisionCount: number,
  candidateCount: number,
  fallbackUsed: boolean,
  rejectedReasons: readonly string[] = [],
): void {
  runtimeDebugRouteBadgePlacementSlot = slotId;
  runtimeDebugRouteBadgePlacementCollisionCount = collisionCount;
  runtimeDebugRouteBadgePlacementCandidateCount = candidateCount;
  runtimeDebugRouteBadgePlacementFallbackUsed = fallbackUsed;
  runtimeDebugRouteBadgePlacementUpdatedAt = new Date().toISOString();
  updateAchievementCompanionGamePageBadgeDebug({
    placementAttempted: true,
    placementSlot: slotId,
    placementRejectedReasons: [...rejectedReasons],
    placementFallbackUsed: fallbackUsed,
  });
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

export function markAchievementCompanionGamePageBadgeStatus(args: {
  readonly summaryCompletionStatus: "beaten" | "mastered" | undefined;
  readonly badgeCompletionStatus: "beaten" | "mastered" | undefined;
  readonly badgeStatusVariant: "plain" | "beaten" | "mastered";
  readonly nativeBadgeStatusRendered: boolean;
  readonly clearKeys?:
    | readonly AchievementCompanionGamePageBadgePipelineDebugClearKey[]
    | undefined;
}): void {
  runtimeDebugLastGamePageBadgeCompletionStatus = args.badgeCompletionStatus;
  runtimeDebugLastGamePageBadgeStatusVariant = args.badgeStatusVariant;
  runtimeDebugLastGamePageBadgeStatusRendered = args.nativeBadgeStatusRendered;
  updateAchievementCompanionGamePageBadgeDebug(
    {
      ...(args.summaryCompletionStatus !== undefined
        ? { summaryCompletionStatus: args.summaryCompletionStatus }
        : {}),
      ...(args.badgeCompletionStatus !== undefined
        ? { badgeCompletionStatus: args.badgeCompletionStatus }
        : {}),
      badgeStatusVariant: args.badgeStatusVariant,
      nativeBadgeStatusRendered: args.nativeBadgeStatusRendered,
    },
    args.clearKeys === undefined ? undefined : { clearKeys: args.clearKeys },
  );
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
  updateAchievementCompanionGamePageBadgeDebug({
    ...(appId !== undefined ? { routeAppId: appId } : {}),
    routeBadgeRendered: true,
  });
}

export function markAchievementCompanionGamePageAchievementBadgeClicked(appId?: string): void {
  runtimeDebugLastBadgeClickAt = new Date().toISOString();
  if (appId !== undefined) {
    runtimeDebugLastBadgeRenderAppId = appId;
  }
}

export function markAchievementCompanionGamePageBadgeHidden(reason: string): void {
  updateAchievementCompanionGamePageBadgeDebug({
    badgeHiddenReason: reason,
  });
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
  updateAchievementCompanionGamePageBadgeDebug({
    routeAppId: appId,
    summaryLoadStarted: true,
    summaryLoadFinished: false,
  });
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
  const clearKeys: readonly AchievementCompanionGamePageBadgePipelineDebugClearKey[] =
    summary.status === "ready"
      ? [
          "summaryReason",
          "thrownErrorMessage",
          ...(summary.provider === "retroachievements" && summary.completionStatus !== undefined
            ? []
            : (["summaryCompletionStatus"] as const)),
        ]
      : [
          "summaryProvider",
          "summaryGameId",
          "summaryTitle",
          "summaryEarned",
          "summaryTotal",
          "summaryCompletionStatus",
          "badgeCompletionStatus",
          "badgeStatusVariant",
          "nativeBadgeStatusRendered",
        ];
  updateAchievementCompanionGamePageBadgeDebug({
    routeAppId: summary.appId,
    summaryLoadFinished: true,
    summaryStatus: summary.status,
    ...(summary.status === "ready"
      ? {
          summaryProvider: summary.provider,
          ...(summary.gameId !== undefined ? { summaryGameId: summary.gameId } : {}),
          ...(summary.title !== undefined ? { summaryTitle: summary.title } : {}),
          summaryEarned: summary.earned,
          summaryTotal: summary.total,
          ...(summary.provider === "retroachievements" && summary.completionStatus !== undefined
            ? { summaryCompletionStatus: summary.completionStatus }
            : {}),
        }
      : summary.status === "unavailable"
        ? {
            summaryReason: summary.reason,
          }
          : summary.status === "error"
            ? {
                summaryReason: summary.message,
              }
          : {}),
  }, { clearKeys });
}

export function markAchievementCompanionGamePageShortcutDetected(args: {
  readonly appId: string;
  readonly title: string;
  readonly platform: string | undefined;
  readonly reason: string;
  readonly nextPath: string;
}): void {
  runtimeDebugLastGamePageShortcutDetectedAppId = args.appId;
  runtimeDebugLastGamePageShortcutTitle = args.title;
  runtimeDebugLastGamePageShortcutPlatform = args.platform;
  runtimeDebugLastGamePageShortcutDetectionReason = args.reason;
  runtimeDebugLastGamePageShortcutNextPath = args.nextPath;
  console.debug("[Achievement Companion] Game-page shortcut detected", {
    appId: args.appId,
    title: args.title,
    platform: args.platform,
    reason: args.reason,
    nextPath: args.nextPath,
  });
  updateAchievementCompanionRaShortcutResolutionDebug({
    appId: args.appId,
    shortcutMetadataLoaded: true,
    shortcutTitle: args.title,
    ...(args.platform !== undefined ? { shortcutPlatform: args.platform } : {}),
    steamSkippedBecauseShortcut: args.reason === "steam-shortcut-detected",
    resolverStage: args.nextPath,
  });
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
  updateAchievementCompanionGamePageBadgeDebug({
    routeAppId: appId,
    summaryLoadFinished: true,
    summaryStatus: "error",
    summaryReason: message,
    thrownErrorMessage: message,
  });
  return message;
}

export function markAchievementCompanionRetroAchievementsShortcutResolution(args: {
  readonly appId: string;
  readonly status: "mapped" | "unavailable" | "error";
  readonly reason?: string | undefined;
  readonly gameId?: string | undefined;
  readonly title?: string | undefined;
  readonly earned?: number | undefined;
  readonly total?: number | undefined;
  readonly source?: string | undefined;
  readonly confidence?: string | undefined;
  readonly error?: string | undefined;
  readonly shortcutTitle?: string | undefined;
  readonly shortcutPlatform?: string | undefined;
  readonly normalizedPlatform?: string | undefined;
  readonly resolutionSource?: string | undefined;
  readonly resolutionReason?: string | undefined;
  readonly resolvedSystemName?: string | undefined;
  readonly resolvedConsoleId?: string | undefined;
  readonly matchedTitle?: string | undefined;
  readonly matchedPlatform?: string | undefined;
  readonly matchedGameId?: string | undefined;
  readonly candidateCount?: number | undefined;
  readonly detailLoadStatus?: string | undefined;
  readonly detailLoadReason?: string | undefined;
  readonly hashResolverAttempted?: boolean | undefined;
  readonly hashResolverSkippedReason?: string | undefined;
  readonly shortcutRomPathDetected?: boolean | undefined;
  readonly shortcutRomPathSource?: string | undefined;
  readonly romHashAttempted?: boolean | undefined;
  readonly romHashStatus?: string | undefined;
  readonly romHashAlgorithm?: string | undefined;
  readonly romHashPrefix?: string | undefined;
  readonly raHashLookupAttempted?: boolean | undefined;
  readonly raHashLookupStatus?: string | undefined;
  readonly raHashMatchedGameId?: string | undefined;
  readonly raHashMatchedTitle?: string | undefined;
  readonly raHashMatchedConsoleId?: string | undefined;
  readonly raHashMatchedConsoleName?: string | undefined;
  readonly hashRejectedReason?: string | undefined;
  readonly finalResolverSource?: "hash" | "title" | "completion-progress" | "unavailable" | undefined;
  readonly clearKeys?: readonly AchievementCompanionRaShortcutResolutionDebugClearKey[];
}): void {
  runtimeDebugLastRetroAchievementsShortcutAppId = args.appId;
  runtimeDebugLastRetroAchievementsShortcutTitle = args.shortcutTitle;
  runtimeDebugLastRetroAchievementsShortcutPlatform = args.shortcutPlatform;
  runtimeDebugLastRetroAchievementsNormalizedPlatform = args.normalizedPlatform;
  runtimeDebugLastRetroAchievementsMappingStatus = args.status;
  runtimeDebugLastRetroAchievementsMappingReason = args.reason;
  if (args.hashResolverAttempted !== undefined) {
    runtimeDebugLastRetroAchievementsHashResolverAttempted = args.hashResolverAttempted;
  }
  if (args.hashResolverSkippedReason !== undefined) {
    runtimeDebugLastRetroAchievementsHashResolverSkippedReason = args.hashResolverSkippedReason;
  }
  if (args.shortcutRomPathDetected !== undefined) {
    runtimeDebugLastRetroAchievementsShortcutRomPathDetected = args.shortcutRomPathDetected;
  }
  if (args.shortcutRomPathSource !== undefined) {
    runtimeDebugLastRetroAchievementsShortcutRomPathSource = args.shortcutRomPathSource;
  }
  if (args.romHashAttempted !== undefined) {
    runtimeDebugLastRetroAchievementsRomHashAttempted = args.romHashAttempted;
  }
  if (args.romHashStatus !== undefined) {
    runtimeDebugLastRetroAchievementsRomHashStatus = args.romHashStatus;
  }
  if (args.romHashAlgorithm !== undefined) {
    runtimeDebugLastRetroAchievementsRomHashAlgorithm = args.romHashAlgorithm;
  }
  if (args.romHashPrefix !== undefined) {
    runtimeDebugLastRetroAchievementsRomHashPrefix = args.romHashPrefix;
  }
  if (args.raHashLookupAttempted !== undefined) {
    runtimeDebugLastRetroAchievementsRaHashLookupAttempted = args.raHashLookupAttempted;
  }
  if (args.raHashLookupStatus !== undefined) {
    runtimeDebugLastRetroAchievementsRaHashLookupStatus = args.raHashLookupStatus;
  }
  if (args.raHashMatchedGameId !== undefined) {
    runtimeDebugLastRetroAchievementsRaHashMatchedGameId = args.raHashMatchedGameId;
  }
  if (args.raHashMatchedTitle !== undefined) {
    runtimeDebugLastRetroAchievementsRaHashMatchedTitle = args.raHashMatchedTitle;
  }
  if (args.raHashMatchedConsoleId !== undefined) {
    runtimeDebugLastRetroAchievementsRaHashMatchedConsoleId = args.raHashMatchedConsoleId;
  }
  if (args.raHashMatchedConsoleName !== undefined) {
    runtimeDebugLastRetroAchievementsRaHashMatchedConsoleName = args.raHashMatchedConsoleName;
  }
  if (args.hashRejectedReason !== undefined) {
    runtimeDebugLastRetroAchievementsHashRejectedReason = args.hashRejectedReason;
  }
  if (args.finalResolverSource !== undefined) {
    runtimeDebugLastRetroAchievementsFinalResolverSource = args.finalResolverSource;
  }
  runtimeDebugLastRetroAchievementsGameId = args.gameId;
  runtimeDebugLastRetroAchievementsTitle = args.title;
  runtimeDebugLastRetroAchievementsEarned = args.earned;
  runtimeDebugLastRetroAchievementsTotal = args.total;
  runtimeDebugLastRetroAchievementsSource = args.source;
  runtimeDebugLastRetroAchievementsConfidence = args.confidence;
  runtimeDebugLastRetroAchievementsError = args.error;
  runtimeDebugLastRetroAchievementsResolutionSource = args.resolutionSource;
  runtimeDebugLastRetroAchievementsResolutionReason = args.resolutionReason;
  runtimeDebugLastRetroAchievementsResolvedSystemName = args.resolvedSystemName;
  runtimeDebugLastRetroAchievementsResolvedConsoleId = args.resolvedConsoleId;
  runtimeDebugLastRetroAchievementsMatchedTitle = args.matchedTitle;
  runtimeDebugLastRetroAchievementsMatchedPlatform = args.matchedPlatform;
  runtimeDebugLastRetroAchievementsMatchedGameId = args.matchedGameId;
  runtimeDebugLastRetroAchievementsCandidateCount = args.candidateCount;
  runtimeDebugLastRetroAchievementsDetailLoadStatus = args.detailLoadStatus;
  runtimeDebugLastRetroAchievementsDetailLoadReason = args.detailLoadReason;
  updateAchievementCompanionRaShortcutResolutionDebug({
    appId: args.appId,
    ...(args.shortcutTitle !== undefined ? { shortcutTitle: args.shortcutTitle } : {}),
    ...(args.shortcutPlatform !== undefined ? { shortcutPlatform: args.shortcutPlatform } : {}),
    ...(args.normalizedPlatform !== undefined ? { normalizedPlatform: args.normalizedPlatform } : {}),
    finalStatus: args.status,
    finalReason: args.reason ?? args.error,
    resolverStage: args.resolutionSource,
    ...(args.resolvedConsoleId !== undefined ? { apiSystemsResolvedConsoleId: args.resolvedConsoleId } : {}),
    ...(args.resolvedSystemName !== undefined ? { apiSystemsResolvedConsoleName: args.resolvedSystemName } : {}),
    ...(args.candidateCount !== undefined ? { apiGameListCandidateCount: args.candidateCount } : {}),
    ...(args.matchedGameId !== undefined ? { apiMatchedGameId: args.matchedGameId } : {}),
    ...(args.matchedTitle !== undefined ? { apiMatchedTitle: args.matchedTitle } : {}),
    ...(args.hashResolverAttempted !== undefined ? { hashResolverAttempted: args.hashResolverAttempted } : {}),
    ...(args.hashResolverSkippedReason !== undefined
      ? { hashResolverSkippedReason: args.hashResolverSkippedReason }
      : {}),
    ...(args.shortcutRomPathDetected !== undefined
      ? { shortcutRomPathDetected: args.shortcutRomPathDetected }
      : {}),
    ...(args.shortcutRomPathSource !== undefined ? { shortcutRomPathSource: args.shortcutRomPathSource } : {}),
    ...(args.romHashAttempted !== undefined ? { romHashAttempted: args.romHashAttempted } : {}),
    ...(args.romHashStatus !== undefined ? { romHashStatus: args.romHashStatus } : {}),
    ...(args.romHashAlgorithm !== undefined ? { romHashAlgorithm: args.romHashAlgorithm } : {}),
    ...(args.romHashPrefix !== undefined ? { romHashPrefix: args.romHashPrefix } : {}),
    ...(args.raHashLookupAttempted !== undefined
      ? { raHashLookupAttempted: args.raHashLookupAttempted }
      : {}),
    ...(args.raHashLookupStatus !== undefined ? { raHashLookupStatus: args.raHashLookupStatus } : {}),
    ...(args.raHashMatchedGameId !== undefined ? { raHashMatchedGameId: args.raHashMatchedGameId } : {}),
    ...(args.raHashMatchedTitle !== undefined ? { raHashMatchedTitle: args.raHashMatchedTitle } : {}),
    ...(args.raHashMatchedConsoleId !== undefined
      ? { raHashMatchedConsoleId: args.raHashMatchedConsoleId }
      : {}),
    ...(args.raHashMatchedConsoleName !== undefined
      ? { raHashMatchedConsoleName: args.raHashMatchedConsoleName }
      : {}),
    ...(args.hashRejectedReason !== undefined ? { hashRejectedReason: args.hashRejectedReason } : {}),
    ...(args.finalResolverSource !== undefined ? { finalResolverSource: args.finalResolverSource } : {}),
    detailLoadAttempted:
      args.detailLoadStatus === "success" ||
      args.detailLoadStatus === "error" ||
      args.detailLoadStatus === "unavailable",
    ...(args.detailLoadStatus !== undefined ? { detailLoadStatus: args.detailLoadStatus } : {}),
    ...(args.detailLoadReason !== undefined ? { detailLoadReason: args.detailLoadReason } : {}),
    ...(args.gameId !== undefined ? { detailGameId: args.gameId } : {}),
    ...(args.title !== undefined ? { detailTitle: args.title } : {}),
    ...(args.earned !== undefined ? { detailEarned: args.earned } : {}),
    ...(args.total !== undefined ? { detailTotal: args.total } : {}),
    ...(args.status === "mapped"
      ? {
          returnedSummaryProvider: "retroachievements",
          returnedSummaryEarned: args.earned,
          returnedSummaryTotal: args.total,
        }
      : {}),
    ...(args.error !== undefined ? { thrownErrorMessage: args.error } : {}),
  }, args.clearKeys === undefined ? undefined : { clearKeys: args.clearKeys });
}
