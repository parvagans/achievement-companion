import { routerHook } from "@decky/api";
import {
  afterPatch,
  appDetailsClasses,
  createReactTreePatcher,
  findInReactTree,
} from "@decky/ui";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from "react";
import { DeckyGamePageAchievementBadge } from "./decky-game-page-achievement-badge";
import { type GamePageAchievementBadgePosition } from "@core/settings";
import { useDeckySettings } from "./decky-settings";
import {
  DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN,
  DECKY_GAME_PAGE_ACHIEVEMENT_URL_ROUTE_PREFIX,
  detectDeckyGamePageAchievementRouteFromUrl,
  resolveDeckyGamePageAchievementAppId,
  type DeckyGamePageAchievementRouteDetectionState,
} from "./decky-game-page-achievement-route";
import {
  formatDeckyGamePageAchievementBadgeLabel,
  type GamePageAchievementSummary,
  useGamePageAchievementSummary,
} from "./decky-game-page-achievement-summary";
import { openDeckyFullScreenGameFromLibraryGamePage } from "./decky-navigation";
import {
  resolveDeckyGamePageAchievementBadgeProviderIconUrl,
} from "./decky-game-page-achievement-badge-theme";
import { resolveDeckyGamePageAchievementBadgePresentation } from "./decky-game-page-achievement-badge-presentation";
import {
  createDeckyGamePageRoutePatchLifetime,
  shouldReleaseDeckyGamePageRoutePatchOnBadgeUnmount,
} from "./decky-game-page-achievement-lifecycle";
import {
  markAchievementCompanionGamePageBadgeActivated,
  markAchievementCompanionGamePageBadgeHidden,
  markAchievementCompanionGamePageBadgeStatus,
  markAchievementCompanionGamePageRouteBadgeInserted,
  markAchievementCompanionGamePageRouteBadgePatchCallback,
  markAchievementCompanionGamePageRouteBadgePatchHandlerFired,
  markAchievementCompanionGamePageRouteBadgePlacement,
  markAchievementCompanionGamePageRouteBadgePatchRegistered,
  markAchievementCompanionGamePageRouteBadgePatchRemoved,
  markAchievementCompanionGamePageRouteBadgeRenderFuncPatched,
  markAchievementCompanionGamePageRouteBadgeRendered,
  markAchievementCompanionGamePageBadgeSystemIcon,
  reportAchievementCompanionGamePageBadgeNavigationError,
  resolveAchievementCompanionRuntimeDebugHostContext,
} from "./decky-runtime-debug";

const ACHIEVEMENT_COMPANION_GAME_PAGE_ROUTE_BADGE_ELEMENT_KEY =
  "achievement-companion-game-page-badge-route";
const DECKY_GAME_PAGE_ROUTE_BADGE_COLLISION_PADDING = 12;
const DECKY_GAME_PAGE_ROUTE_BADGE_DEFAULT_WIDTH = 292;
const DECKY_GAME_PAGE_ROUTE_BADGE_DEFAULT_HEIGHT = 74;
const DECKY_GAME_PAGE_ROUTE_BADGE_MAX_OBSTACLE_WIDTH = 360;
const DECKY_GAME_PAGE_ROUTE_BADGE_MAX_OBSTACLE_HEIGHT = 120;
const DECKY_GAME_PAGE_ROUTE_BADGE_MIN_OBSTACLE_WIDTH = 32;
const DECKY_GAME_PAGE_ROUTE_BADGE_MIN_OBSTACLE_HEIGHT = 24;
const DECKY_GAME_PAGE_ROUTE_BADGE_MAX_HERO_REGION_TOP = 460;
const DECKY_GAME_PAGE_ROUTE_BADGE_BOTTOM_TOP = 360;

let deckyGamePageAchievementRoutePatchCleanup: (() => void) | undefined;

interface DeckyGamePageAchievementRouteState {
  readonly currentRouteUrl: string | undefined;
  readonly detection: DeckyGamePageAchievementRouteDetectionState;
}

interface DeckyGamePageAchievementTargetContext {
  readonly targetDocument: Document;
  readonly targetWindow: Window;
}

interface DeckyGamePageAchievementBadgeNavigationTarget {
  readonly providerId: string;
  readonly gameId: string;
}

type DeckyGamePageAchievementRouteBadgeSlotId = GamePageAchievementBadgePosition;

interface DeckyGamePageAchievementRouteBadgeCandidateSlot {
  readonly id: DeckyGamePageAchievementRouteBadgeSlotId;
  readonly top?: number | undefined;
  readonly bottom?: number | undefined;
  readonly left?: number | undefined;
  readonly right?: number | undefined;
  readonly isCentered?: boolean | undefined;
}

interface DeckyGamePageAchievementRouteBadgePlacementState {
  readonly slotId: DeckyGamePageAchievementRouteBadgeSlotId;
  readonly collisionCount: number;
  readonly candidateCount: number;
  readonly fallbackUsed: boolean;
  readonly rejectedReasons: readonly string[];
}

interface DeckyGamePageAchievementRelativeRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

const DECKY_GAME_PAGE_ROUTE_BADGE_CANDIDATE_SLOTS: readonly DeckyGamePageAchievementRouteBadgeCandidateSlot[] =
  [
    {
      id: "top-left",
      top: 56,
      left: 32,
    },
    {
      id: "top-center",
      top: 56,
      isCentered: true,
    },
    {
      id: "top-right",
      top: 56,
      right: 32,
    },
    {
      id: "bottom-left",
      top: DECKY_GAME_PAGE_ROUTE_BADGE_BOTTOM_TOP,
      left: 32,
    },
    {
      id: "bottom-center",
      top: DECKY_GAME_PAGE_ROUTE_BADGE_BOTTOM_TOP,
      isCentered: true,
    },
    {
      id: "bottom-right",
      top: DECKY_GAME_PAGE_ROUTE_BADGE_BOTTOM_TOP,
      right: 32,
    },
  ];

function getDeckyGamePageAchievementRouteBadgePrimarySlot():
  DeckyGamePageAchievementRouteBadgeCandidateSlot {
  return DECKY_GAME_PAGE_ROUTE_BADGE_CANDIDATE_SLOTS[0] as DeckyGamePageAchievementRouteBadgeCandidateSlot;
}


function resolveDeckyGamePageAchievementBadgeCompletionStatus(
  summary: GamePageAchievementSummary | undefined,
): "beaten" | "mastered" | undefined {
  if (summary?.status !== "ready" || summary.provider !== "retroachievements") {
    return undefined;
  }

  return summary.completionStatus === "beaten" || summary.completionStatus === "mastered"
    ? summary.completionStatus
    : undefined;
}

function getDeckyGamePageAchievementRouteBadgeStyle(
  slotId: DeckyGamePageAchievementRouteBadgeSlotId,
): CSSProperties {
  const slot =
    DECKY_GAME_PAGE_ROUTE_BADGE_CANDIDATE_SLOTS.find((candidate) => candidate.id === slotId) ??
    getDeckyGamePageAchievementRouteBadgePrimarySlot();

  return {
    position: "absolute",
    top: slot.top,
    bottom: slot.bottom,
    left: slot.left,
    right: slot.right,
    ...(slot.isCentered === true
      ? {
          left: "50%",
          transform: "translateX(-50%)",
        }
      : {}),
    width: "fit-content",
    height: "fit-content",
    display: "inline-flex",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    padding: 0,
    border: "0 solid transparent",
    borderRadius: 0,
    background: "transparent",
    boxShadow: "none",
    margin: 0,
    zIndex: 1000,
  };
}

function getDeckyGamePageAchievementRouteBadgePlacementDefault():
  DeckyGamePageAchievementRouteBadgePlacementState {
  return {
    slotId: "top-left",
    collisionCount: 0,
    candidateCount: DECKY_GAME_PAGE_ROUTE_BADGE_CANDIDATE_SLOTS.length,
    fallbackUsed: false,
    rejectedReasons: [],
  };
}

function resolveDeckyGamePageAchievementBadgeNavigationTarget(
  summary: GamePageAchievementSummary | undefined,
): DeckyGamePageAchievementBadgeNavigationTarget | undefined {
  if (summary?.status !== "ready") {
    return undefined;
  }

  if (summary.provider === "steam") {
    return {
      providerId: "steam",
      gameId: summary.gameId ?? summary.appId,
    };
  }

  if (summary.gameId === undefined || summary.gameId.trim().length === 0) {
    return undefined;
  }

  return {
    providerId: "retroachievements",
    gameId: summary.gameId,
  };
}

function toDeckyGamePageAchievementRelativeRect(
  rect: DOMRect,
  containerRect: DOMRect,
): DeckyGamePageAchievementRelativeRect {
  return {
    left: rect.left - containerRect.left,
    top: rect.top - containerRect.top,
    right: rect.right - containerRect.left,
    bottom: rect.bottom - containerRect.top,
    width: rect.width,
    height: rect.height,
  };
}

function isDeckyGamePageAchievementRelativeRectVisible(
  rect: DeckyGamePageAchievementRelativeRect,
): boolean {
  return rect.width > 0 && rect.height > 0;
}

function doDeckyGamePageAchievementRectsOverlap(
  firstRect: DeckyGamePageAchievementRelativeRect,
  secondRect: DeckyGamePageAchievementRelativeRect,
  padding: number,
): boolean {
  return !(
    firstRect.right + padding <= secondRect.left ||
    secondRect.right + padding <= firstRect.left ||
    firstRect.bottom + padding <= secondRect.top ||
    secondRect.bottom + padding <= firstRect.top
  );
}

function isDeckyGamePageAchievementRouteBadgeObstacle(
  element: HTMLElement,
  containerRect: DOMRect,
): boolean {
  const elementWindow = element.ownerDocument?.defaultView;
  if (elementWindow == null) {
    return false;
  }

  const computedStyle = elementWindow.getComputedStyle(element);
  if (
    computedStyle.display === "none" ||
    computedStyle.visibility === "hidden" ||
    computedStyle.opacity === "0"
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (
    rect.width < DECKY_GAME_PAGE_ROUTE_BADGE_MIN_OBSTACLE_WIDTH ||
    rect.height < DECKY_GAME_PAGE_ROUTE_BADGE_MIN_OBSTACLE_HEIGHT ||
    rect.width > DECKY_GAME_PAGE_ROUTE_BADGE_MAX_OBSTACLE_WIDTH ||
    rect.height > DECKY_GAME_PAGE_ROUTE_BADGE_MAX_OBSTACLE_HEIGHT
  ) {
    return false;
  }

  const relativeRect = toDeckyGamePageAchievementRelativeRect(rect, containerRect);
  if (
    !isDeckyGamePageAchievementRelativeRectVisible(relativeRect) ||
    relativeRect.bottom < 0 ||
    relativeRect.top > DECKY_GAME_PAGE_ROUTE_BADGE_MAX_HERO_REGION_TOP
  ) {
    return false;
  }

  const role = element.getAttribute("role");
  const tagName = element.tagName.toLowerCase();
  const isInteractiveLike =
    role === "button" ||
    role === "link" ||
    tagName === "button" ||
    tagName === "a" ||
    tagName === "input" ||
    tagName === "form" ||
    element.tabIndex >= 0;
  const isPositionedLike =
    computedStyle.position === "absolute" ||
    computedStyle.position === "fixed" ||
    computedStyle.position === "sticky" ||
    computedStyle.position === "relative";

  return isInteractiveLike || isPositionedLike;
}

function collectDeckyGamePageAchievementRouteBadgeObstacleRects(
  containerElement: HTMLElement,
  badgeElement: HTMLElement,
): DeckyGamePageAchievementRelativeRect[] {
  const containerRect = containerElement.getBoundingClientRect();
  return Array.from(containerElement.querySelectorAll<HTMLElement>("*"))
    .filter((element) => {
      if (
        element === badgeElement ||
        badgeElement.contains(element) ||
        element.contains(badgeElement)
      ) {
        return false;
      }

      return isDeckyGamePageAchievementRouteBadgeObstacle(element, containerRect);
    })
    .map((element) =>
      toDeckyGamePageAchievementRelativeRect(element.getBoundingClientRect(), containerRect),
    );
}

function resolveDeckyGamePageAchievementRouteBadgeContainer(
  badgeElement: HTMLElement,
): HTMLElement | null {
  if (badgeElement.offsetParent instanceof HTMLElement) {
    return badgeElement.offsetParent;
  }

  return badgeElement.parentElement;
}

function createDeckyGamePageAchievementRouteBadgeCandidateRect(
  slot: DeckyGamePageAchievementRouteBadgeCandidateSlot,
  containerRect: DOMRect,
  badgeRect: DOMRect,
): DeckyGamePageAchievementRelativeRect {
  const width =
    badgeRect.width > 0 ? badgeRect.width : DECKY_GAME_PAGE_ROUTE_BADGE_DEFAULT_WIDTH;
  const height =
    badgeRect.height > 0 ? badgeRect.height : DECKY_GAME_PAGE_ROUTE_BADGE_DEFAULT_HEIGHT;
  const left =
    slot.isCentered === true
      ? Math.max((containerRect.width - width) / 2, DECKY_GAME_PAGE_ROUTE_BADGE_COLLISION_PADDING)
      : slot.left ??
        Math.max(containerRect.width - (slot.right ?? 0) - width, DECKY_GAME_PAGE_ROUTE_BADGE_COLLISION_PADDING);
  const top =
    slot.top ??
    Math.max(
      containerRect.height - (slot.bottom ?? 0) - height,
      DECKY_GAME_PAGE_ROUTE_BADGE_COLLISION_PADDING,
    );

  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

function chooseDeckyGamePageAchievementRouteBadgePlacement(
  containerElement: HTMLElement,
  badgeElement: HTMLElement,
  selectedPosition: GamePageAchievementBadgePosition,
): DeckyGamePageAchievementRouteBadgePlacementState {
  const containerRect = containerElement.getBoundingClientRect();
  const badgeRect = badgeElement.getBoundingClientRect();
  const obstacleRects = collectDeckyGamePageAchievementRouteBadgeObstacleRects(
    containerElement,
    badgeElement,
  );
  const selectedSlot =
    DECKY_GAME_PAGE_ROUTE_BADGE_CANDIDATE_SLOTS.find((slot) => slot.id === selectedPosition) ??
    getDeckyGamePageAchievementRouteBadgePrimarySlot();
  const selectedRect = createDeckyGamePageAchievementRouteBadgeCandidateRect(
    selectedSlot,
    containerRect,
    badgeRect,
  );
  const collisionCount = obstacleRects.filter((obstacleRect) =>
    doDeckyGamePageAchievementRectsOverlap(
      selectedRect,
      obstacleRect,
      DECKY_GAME_PAGE_ROUTE_BADGE_COLLISION_PADDING,
    ),
  ).length;

  return {
    slotId: selectedSlot.id,
    collisionCount,
    candidateCount: 1,
    fallbackUsed: false,
    rejectedReasons: collisionCount > 0 ? [`${selectedSlot.id}:collision-${collisionCount}`] : [],
  };
}

function getDeckyGamePageAchievementRouteUrls(): readonly (string | undefined)[] {
  const targetContext = resolveDeckyGamePageAchievementTargetContext();
  const hostUrl = targetContext?.targetDocument.location?.href;
  const currentHref = typeof window === "undefined" ? undefined : window.location?.href;
  const currentPathname =
    typeof window === "undefined" || typeof window.location?.pathname !== "string"
      ? undefined
      : `https://steamloopback.host${window.location.pathname}`;
  return [currentPathname, currentHref, hostUrl];
}

function resolveDeckyGamePageAchievementTargetContext():
  | DeckyGamePageAchievementTargetContext
  | undefined {
  const hostContext = resolveAchievementCompanionRuntimeDebugHostContext();
  if (hostContext !== undefined) {
    return {
      targetDocument: hostContext.hostDocument,
      targetWindow: hostContext.hostWindow,
    };
  }

  if (typeof document === "undefined" || typeof window === "undefined") {
    return undefined;
  }

  return {
    targetDocument: document,
    targetWindow: window,
  };
}

function readDeckyGamePageAchievementRouteState(): DeckyGamePageAchievementRouteState {
  const routeUrls = getDeckyGamePageAchievementRouteUrls();
  const detectedRouteUrl =
    routeUrls.find(
      (candidate) =>
        typeof candidate === "string" &&
        candidate.includes(DECKY_GAME_PAGE_ACHIEVEMENT_URL_ROUTE_PREFIX),
    ) ??
    routeUrls.find((candidate) => detectDeckyGamePageAchievementRouteFromUrl(candidate).isGamePage) ??
    routeUrls.find((candidate) => candidate !== undefined);
  const detection = detectDeckyGamePageAchievementRouteFromUrl(detectedRouteUrl);
  return {
    currentRouteUrl: detectedRouteUrl,
    detection,
  };
}

function getRouteListenerWindows(): Window[] {
  const windows = new Set<Window>();
  if (typeof window !== "undefined") {
    windows.add(window);
  }

  const hostContext = resolveAchievementCompanionRuntimeDebugHostContext();
  if (hostContext !== undefined) {
    windows.add(hostContext.hostWindow);
  }

  return Array.from(windows);
}

function isAchievementCompanionRouteBadgeChild(child: unknown): boolean {
  if (typeof child !== "object" || child === null) {
    return false;
  }

  const childRecord = child as {
    readonly key?: unknown;
  };
  return String(childRecord.key ?? "").includes(ACHIEVEMENT_COMPANION_GAME_PAGE_ROUTE_BADGE_ELEMENT_KEY);
}

function useDeckyGamePageAchievementRouteBadgePlacement(): {
  readonly style: CSSProperties;
  readonly setBadgeElement: (element: HTMLDivElement | null) => void;
} {
  const settings = useDeckySettings();
  const selectedPosition = settings.gamePageAchievementBadgePosition;
  const badgeElementRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const [placement, setPlacement] = useState<DeckyGamePageAchievementRouteBadgePlacementState>(
    () => getDeckyGamePageAchievementRouteBadgePlacementDefault(),
  );

  const refreshPlacement = useCallback(() => {
    const badgeElement = badgeElementRef.current;
    if (badgeElement === null) {
      return;
    }

    const containerElement = resolveDeckyGamePageAchievementRouteBadgeContainer(badgeElement);
    if (containerElement === null) {
      return;
    }

    const nextPlacement = chooseDeckyGamePageAchievementRouteBadgePlacement(
      containerElement,
      badgeElement,
      selectedPosition,
    );

    setPlacement((previousPlacement) => {
      if (
        previousPlacement.slotId === nextPlacement.slotId &&
        previousPlacement.collisionCount === nextPlacement.collisionCount &&
        previousPlacement.candidateCount === nextPlacement.candidateCount &&
        previousPlacement.fallbackUsed === nextPlacement.fallbackUsed &&
        previousPlacement.rejectedReasons.join("|") === nextPlacement.rejectedReasons.join("|")
      ) {
        return previousPlacement;
      }

      return nextPlacement;
    });

    markAchievementCompanionGamePageRouteBadgePlacement(
      nextPlacement.slotId,
      nextPlacement.collisionCount,
      nextPlacement.candidateCount,
      nextPlacement.fallbackUsed,
      nextPlacement.rejectedReasons,
    );
  }, [selectedPosition]);

  const setBadgeElement = useCallback(
    (element: HTMLDivElement | null) => {
      badgeElementRef.current = element;
      if (animationFrameRef.current !== undefined) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }

      if (element !== null) {
        refreshPlacement();
        animationFrameRef.current = window.requestAnimationFrame(() => {
          animationFrameRef.current = undefined;
          refreshPlacement();
        });
      }
    },
    [refreshPlacement],
  );

  useLayoutEffect(() => {
    refreshPlacement();
  }, [refreshPlacement]);

  useEffect(() => {
    const handleResize = () => {
      refreshPlacement();
    };

    const routeWindows = getRouteListenerWindows();
    for (const routeWindow of routeWindows) {
      routeWindow.addEventListener("resize", handleResize);
    }

    return () => {
      for (const routeWindow of routeWindows) {
        routeWindow.removeEventListener("resize", handleResize);
      }

      if (animationFrameRef.current !== undefined) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [refreshPlacement]);

  return {
    style: getDeckyGamePageAchievementRouteBadgeStyle(placement.slotId),
    setBadgeElement,
  };
}

function useDeckyGamePageAchievementBadgeActivation(
  appId: string | undefined,
  summary: GamePageAchievementSummary | undefined,
): {
  readonly onActivate: () => void;
} {
  const navigationTarget = useMemo(
    () => resolveDeckyGamePageAchievementBadgeNavigationTarget(summary),
    [summary],
  );

  const onActivate = useCallback(() => {
    const routeState = readDeckyGamePageAchievementRouteState();
    const sourceRoute = routeState.currentRouteUrl;

    if (navigationTarget === undefined) {
      reportAchievementCompanionGamePageBadgeNavigationError(
        `Navigation target unavailable for app ${appId ?? "unknown"}.`,
        "game-page-badge:navigate:missing-target",
      );
      return;
    }

    try {
      const route = openDeckyFullScreenGameFromLibraryGamePage(
        navigationTarget.providerId,
        navigationTarget.gameId,
      );
      markAchievementCompanionGamePageBadgeActivated({
        appId,
        navigationTarget: route,
        sourceRoute,
        backRoute: sourceRoute,
      });
    } catch (error) {
      reportAchievementCompanionGamePageBadgeNavigationError(
        error,
        "game-page-badge:navigate",
      );
    }
  }, [appId, navigationTarget]);

  return {
    onActivate,
  };
}

function createDeckyGamePageAchievementRouteBadgeElement(
  appId: string,
  onRouteUnmount: () => void,
): JSX.Element {
  return (
    <DeckyGamePageAchievementRouteBadge
      key={ACHIEVEMENT_COMPANION_GAME_PAGE_ROUTE_BADGE_ELEMENT_KEY}
      appId={appId}
      onRouteUnmount={onRouteUnmount}
    />
  );
}

export function DeckyGamePageAchievementRouteBadge({
  appId,
  onRouteUnmount,
}: {
  readonly appId: string;
  readonly onRouteUnmount: () => void;
}): JSX.Element | null {
  const settings = useDeckySettings();

  useEffect(() => onRouteUnmount, [onRouteUnmount]);

  if (!settings.showGamePageAchievementBadge) {
    return null;
  }

  return <DeckyGamePageAchievementRouteBadgeEnabled appId={appId} />;
}

function DeckyGamePageAchievementRouteBadgeEnabled({
  appId,
}: {
  readonly appId: string;
}): JSX.Element | null {
  const settings = useDeckySettings();
  const { style, setBadgeElement } = useDeckyGamePageAchievementRouteBadgePlacement();
  const summary = useGamePageAchievementSummary(appId);
  const badgeCompletionStatus = resolveDeckyGamePageAchievementBadgeCompletionStatus(summary);
  const presentation = useMemo(
    () => resolveDeckyGamePageAchievementBadgePresentation(summary),
    [summary],
  );
  const badgeStatusVariant = presentation?.variant ?? "loading";
  const badgeLabel = formatDeckyGamePageAchievementBadgeLabel(summary);
  const { onActivate } = useDeckyGamePageAchievementBadgeActivation(appId, summary);

  useEffect(() => {
    if (badgeLabel === undefined) {
      markAchievementCompanionGamePageBadgeHidden(
        summary === undefined
          ? "summary-unset"
          : summary.status === "unavailable"
            ? summary.reason
            : summary.status === "error"
              ? summary.message
              : "badge-label-unavailable",
      );
      return;
    }

    markAchievementCompanionGamePageRouteBadgeRendered(appId);
  }, [appId, badgeLabel, summary]);

  useEffect(() => {
    const iconUrl =
      presentation === undefined
        ? undefined
        : resolveDeckyGamePageAchievementBadgeProviderIconUrl(presentation.provider, presentation.variant);
    markAchievementCompanionGamePageBadgeSystemIcon({
      providerId: presentation?.provider,
      platformLabel: presentation?.variant === "loading" ? undefined
        : presentation?.provider === "retroachievements" ? "RetroAchievements" : "Steam",
      iconUrl,
      rendered: presentation !== undefined && iconUrl !== undefined,
    });
  }, [presentation]);

  useEffect(() => {
    const summaryCompletionStatus =
      summary?.status === "ready" && summary.provider === "retroachievements"
        ? summary.completionStatus
        : undefined;
    markAchievementCompanionGamePageBadgeStatus({
      summaryCompletionStatus,
      badgeCompletionStatus,
      badgeStatusVariant,
      nativeBadgeStatusRendered: presentation !== undefined,
      clearKeys:
        summaryCompletionStatus === undefined && badgeCompletionStatus === undefined
          ? ["summaryCompletionStatus", "badgeCompletionStatus"]
          : undefined,
    });
  }, [badgeCompletionStatus, badgeStatusVariant, presentation, summary]);

  if (badgeLabel === undefined || presentation === undefined) {
    return null;
  }

  return (
    <DeckyGamePageAchievementBadge
      appId={appId}
      ariaLabel={presentation.ariaLabel}
      colors={settings.gamePageAchievementBadgeColors}
      elementRef={setBadgeElement}
      marker="route"
      onActivate={onActivate}
      presentation={presentation}
      routeUrl={readDeckyGamePageAchievementRouteState().currentRouteUrl}
      style={style}
    />
  );
}

export function ensureDeckyGamePageAchievementRoutePatchRegistered(): () => void {
  if (deckyGamePageAchievementRoutePatchCleanup !== undefined) {
    return deckyGamePageAchievementRoutePatchCleanup;
  }

  const routePatches = createDeckyGamePageRoutePatchLifetime<object>();

  const patchFn = (tree: unknown) => {
    const routeProps = findInReactTree(tree, (node) => !!node?.renderFunc);
    const routeAppId = resolveDeckyGamePageAchievementAppId(
      routeProps,
      getDeckyGamePageAchievementRouteUrls(),
    );
    markAchievementCompanionGamePageRouteBadgePatchCallback(routeAppId);

    if (
      typeof routeProps === "object" &&
      routeProps !== null &&
      !routePatches.has(routeProps as object)
    ) {
      routePatches.install(routeProps as object, (releaseRoutePatch) => {
        let renderedAppId = routeAppId;
        const releaseWhenRouteLeaves = () => {
          if (
            renderedAppId !== undefined &&
            shouldReleaseDeckyGamePageRoutePatchOnBadgeUnmount(
              renderedAppId,
              readDeckyGamePageAchievementRouteState().detection,
            )
          ) {
            releaseRoutePatch();
          }
        };
        const patchHandler = createReactTreePatcher(
        [
          (node) =>
            findInReactTree(node, (entry) => !!entry?.props?.children?.props?.overview)?.props
              ?.children,
        ],
        (_args, ret) => {
          const currentAppId = resolveDeckyGamePageAchievementAppId(
            routeProps,
            getDeckyGamePageAchievementRouteUrls(),
          );
          markAchievementCompanionGamePageRouteBadgePatchHandlerFired(currentAppId);

          const container = findInReactTree(
            ret,
            (entry) =>
              Array.isArray(entry?.props?.children) &&
              entry?.props?.className?.includes(appDetailsClasses.InnerContainer),
          ) as { props?: { children?: unknown[] } } | undefined;
          if (container?.props?.children === undefined || !Array.isArray(container.props.children)) {
            return ret;
          }

          if (currentAppId === undefined) {
            return ret;
          }
          renderedAppId = currentAppId;

          const nextChildren = container.props.children.filter(
            (child) => !isAchievementCompanionRouteBadgeChild(child),
          );
          nextChildren.splice(
            1,
            0,
            createDeckyGamePageAchievementRouteBadgeElement(currentAppId, releaseWhenRouteLeaves),
          );
          container.props.children = nextChildren;
          markAchievementCompanionGamePageRouteBadgeInserted(currentAppId);
          return ret;
        },
        "achievement-companion-game-page-badge-route",
        );

        return afterPatch(routeProps, "renderFunc", patchHandler);
      });
      markAchievementCompanionGamePageRouteBadgeRenderFuncPatched();
    }

    return tree as never;
  };

  const registeredPatch = routerHook.addPatch(DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN, patchFn);
  markAchievementCompanionGamePageRouteBadgePatchRegistered(
    DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN,
  );

  deckyGamePageAchievementRoutePatchCleanup = () => {
    routerHook.removePatch(DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN, registeredPatch);
    routePatches.dispose();
    markAchievementCompanionGamePageRouteBadgePatchRemoved();
    deckyGamePageAchievementRoutePatchCleanup = undefined;
  };

  return deckyGamePageAchievementRoutePatchCleanup;
}
