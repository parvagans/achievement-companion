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
import {
  DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN,
  DECKY_GAME_PAGE_ACHIEVEMENT_URL_ROUTE_PREFIX,
  detectDeckyGamePageAchievementRouteFromUrl,
  resolveDeckyGamePageAchievementAppId,
  type DeckyGamePageAchievementRouteDetectionState,
} from "./decky-game-page-achievement-route";
import { hasVisibleDeckyGamePageModal } from "./decky-game-page-achievement-modal-visibility";
import {
  formatDeckyGamePageAchievementBadgeLabel,
  type GamePageAchievementSummary,
  useGamePageAchievementSummary,
} from "./decky-game-page-achievement-summary";
import { openDeckyFullScreenGameFromLibraryGamePage } from "./decky-navigation";
import {
  markAchievementCompanionGamePageBadgeActivated,
  markAchievementCompanionGamePageAchievementBadgeClicked,
  markAchievementCompanionGamePageAchievementBadgeRendered,
  markAchievementCompanionGamePageGlobalComponentRegistered,
  markAchievementCompanionGamePageGlobalComponentRemoved,
  markAchievementCompanionGamePageGlobalComponentRendered,
  markAchievementCompanionGamePageGlobalFallbackSuppressed,
  markAchievementCompanionGamePageRouteBadgeInserted,
  markAchievementCompanionGamePageRouteBadgePatchCallback,
  markAchievementCompanionGamePageRouteBadgePatchHandlerFired,
  markAchievementCompanionGamePageRouteBadgePlacement,
  markAchievementCompanionGamePageRouteBadgePatchRegistered,
  markAchievementCompanionGamePageRouteBadgePatchRemoved,
  markAchievementCompanionGamePageRouteBadgeRenderFuncPatched,
  markAchievementCompanionGamePageRouteBadgeRendered,
  reportAchievementCompanionGamePageBadgeNavigationError,
  reportAchievementCompanionGamePageGlobalComponentError,
  resolveAchievementCompanionRuntimeDebugHostContext,
} from "./decky-runtime-debug";

const ACHIEVEMENT_COMPANION_GAME_PAGE_BADGE_GLOBAL_COMPONENT_NAME =
  "AchievementCompanionGamePageBadge";
const ACHIEVEMENT_COMPANION_GAME_PAGE_ROUTE_BADGE_ELEMENT_KEY =
  "achievement-companion-game-page-badge-route";
const GAME_PAGE_BADGE_ROUTE_POLL_INTERVAL_MS = 750;
const GAME_PAGE_BADGE_MODAL_POLL_INTERVAL_MS = 500;
const ROUTE_BADGE_FALLBACK_SUPPRESSION_WINDOW_MS = 2_000;
const DECKY_GAME_PAGE_ROUTE_BADGE_COLLISION_PADDING = 12;
const DECKY_GAME_PAGE_ROUTE_BADGE_DEFAULT_WIDTH = 180;
const DECKY_GAME_PAGE_ROUTE_BADGE_DEFAULT_HEIGHT = 44;
const DECKY_GAME_PAGE_ROUTE_BADGE_MAX_OBSTACLE_WIDTH = 360;
const DECKY_GAME_PAGE_ROUTE_BADGE_MAX_OBSTACLE_HEIGHT = 120;
const DECKY_GAME_PAGE_ROUTE_BADGE_MIN_OBSTACLE_WIDTH = 32;
const DECKY_GAME_PAGE_ROUTE_BADGE_MIN_OBSTACLE_HEIGHT = 24;
const DECKY_GAME_PAGE_ROUTE_BADGE_MAX_HERO_REGION_TOP = 460;

let deckyGamePageAchievementGlobalComponentCleanup: (() => void) | undefined;
let deckyGamePageAchievementRoutePatchCleanup: (() => void) | undefined;
let lastRouteBadgeActivityAppId: string | undefined;
let lastRouteBadgeActivityAt = 0;

interface DeckyGamePageAchievementBadgeProps {
  readonly appId?: string | undefined;
  readonly ariaLabel: string;
  readonly label: string;
  readonly marker: "global" | "route";
  readonly style: CSSProperties;
  readonly elementRef?: ((element: HTMLDivElement | null) => void) | undefined;
  readonly onActivate?: (() => void) | undefined;
}

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

type DeckyGamePageAchievementRouteBadgeSlotId =
  | "top-left"
  | "top-right"
  | "upper-left-below-buttons"
  | "lower-right"
  | "lower-left";

interface DeckyGamePageAchievementRouteBadgeCandidateSlot {
  readonly id: DeckyGamePageAchievementRouteBadgeSlotId;
  readonly top: number;
  readonly left?: number | undefined;
  readonly right?: number | undefined;
}

interface DeckyGamePageAchievementRouteBadgePlacementState {
  readonly slotId: DeckyGamePageAchievementRouteBadgeSlotId;
  readonly collisionCount: number;
  readonly candidateCount: number;
  readonly fallbackUsed: boolean;
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
      id: "top-right",
      top: 84,
      right: 32,
    },
    {
      id: "upper-left-below-buttons",
      top: 128,
      left: 32,
    },
    {
      id: "lower-right",
      top: 360,
      right: 144,
    },
    {
      id: "lower-left",
      top: 360,
      left: 32,
    },
  ];

const DECKY_GAME_PAGE_ROUTE_BADGE_FALLBACK_SLOT_IDS = new Set<DeckyGamePageAchievementRouteBadgeSlotId>([
  "lower-right",
  "lower-left",
]);

function getDeckyGamePageAchievementRouteBadgePrimarySlot():
  DeckyGamePageAchievementRouteBadgeCandidateSlot {
  return DECKY_GAME_PAGE_ROUTE_BADGE_CANDIDATE_SLOTS[0] as DeckyGamePageAchievementRouteBadgeCandidateSlot;
}

function getDeckyGamePageAchievementRouteBadgeFallbackSlot():
  DeckyGamePageAchievementRouteBadgeCandidateSlot {
  return (
    DECKY_GAME_PAGE_ROUTE_BADGE_CANDIDATE_SLOTS.find((candidate) => candidate.id === "lower-right") ??
    getDeckyGamePageAchievementRouteBadgePrimarySlot()
  );
}

function getDeckyGamePageAchievementBadgeBaseStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 8,
    border: "1px solid rgba(255, 255, 255, 0.18)",
    background: "rgba(12, 18, 28, 0.88)",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.36)",
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: "0.01em",
    lineHeight: 1.1,
    pointerEvents: "auto",
    userSelect: "none",
  };
}

function getDeckyGamePageAchievementGlobalBadgeStyle(): CSSProperties {
  return {
    ...getDeckyGamePageAchievementBadgeBaseStyle(),
    position: "fixed",
    top: 90,
    left: 32,
    zIndex: 7002,
  };
}

function getDeckyGamePageAchievementRouteBadgeStyle(
  slotId: DeckyGamePageAchievementRouteBadgeSlotId,
): CSSProperties {
  const slot =
    DECKY_GAME_PAGE_ROUTE_BADGE_CANDIDATE_SLOTS.find((candidate) => candidate.id === slotId) ??
    getDeckyGamePageAchievementRouteBadgePrimarySlot();

  return {
    ...getDeckyGamePageAchievementBadgeBaseStyle(),
    position: "absolute",
    top: slot.top,
    left: slot.left,
    right: slot.right,
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
    slot.left ??
    Math.max(containerRect.width - (slot.right ?? 0) - width, DECKY_GAME_PAGE_ROUTE_BADGE_COLLISION_PADDING);

  return {
    left,
    top: slot.top,
    right: left + width,
    bottom: slot.top + height,
    width,
    height,
  };
}

function chooseDeckyGamePageAchievementRouteBadgePlacement(
  containerElement: HTMLElement,
  badgeElement: HTMLElement,
): DeckyGamePageAchievementRouteBadgePlacementState {
  const containerRect = containerElement.getBoundingClientRect();
  const badgeRect = badgeElement.getBoundingClientRect();
  const obstacleRects = collectDeckyGamePageAchievementRouteBadgeObstacleRects(
    containerElement,
    badgeElement,
  );
  const fallbackSlot = getDeckyGamePageAchievementRouteBadgeFallbackSlot();

  let fallbackCollisionCount = obstacleRects.filter((obstacleRect) =>
    doDeckyGamePageAchievementRectsOverlap(
      createDeckyGamePageAchievementRouteBadgeCandidateRect(
        fallbackSlot,
        containerRect,
        badgeRect,
      ),
      obstacleRect,
      DECKY_GAME_PAGE_ROUTE_BADGE_COLLISION_PADDING,
    ),
  ).length;

  for (const candidateSlot of DECKY_GAME_PAGE_ROUTE_BADGE_CANDIDATE_SLOTS) {
    const candidateRect = createDeckyGamePageAchievementRouteBadgeCandidateRect(
      candidateSlot,
      containerRect,
      badgeRect,
    );
    const collisionCount = obstacleRects.filter((obstacleRect) =>
      doDeckyGamePageAchievementRectsOverlap(
        candidateRect,
        obstacleRect,
        DECKY_GAME_PAGE_ROUTE_BADGE_COLLISION_PADDING,
      ),
    ).length;

    if (collisionCount === 0) {
      return {
        slotId: candidateSlot.id,
        collisionCount,
        candidateCount: DECKY_GAME_PAGE_ROUTE_BADGE_CANDIDATE_SLOTS.length,
        fallbackUsed: DECKY_GAME_PAGE_ROUTE_BADGE_FALLBACK_SLOT_IDS.has(candidateSlot.id),
      };
    }

    if (candidateSlot.id === fallbackSlot.id) {
      fallbackCollisionCount = collisionCount;
    }
  }

  return {
    slotId: fallbackSlot.id,
    collisionCount: fallbackCollisionCount,
    candidateCount: DECKY_GAME_PAGE_ROUTE_BADGE_CANDIDATE_SLOTS.length,
    fallbackUsed: true,
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

function readDeckyGamePageModalOpenState(badgeDocument?: Document): boolean {
  const hostDocument = resolveDeckyGamePageAchievementTargetContext()?.targetDocument;
  return (
    hasVisibleDeckyGamePageModal(badgeDocument) ||
    hasVisibleDeckyGamePageModal(hostDocument) ||
    hasVisibleDeckyGamePageModal()
  );
}

function markRouteBadgeActivity(appId?: string): void {
  if (appId === undefined || appId.trim().length === 0) {
    return;
  }

  lastRouteBadgeActivityAppId = appId;
  lastRouteBadgeActivityAt = Date.now();
}

function clearRouteBadgeActivity(): void {
  lastRouteBadgeActivityAppId = undefined;
  lastRouteBadgeActivityAt = 0;
}

function shouldSuppressGlobalFallback(appId?: string): boolean {
  if (
    appId === undefined ||
    appId !== lastRouteBadgeActivityAppId ||
    lastRouteBadgeActivityAt <= 0
  ) {
    return false;
  }

  return Date.now() - lastRouteBadgeActivityAt <= ROUTE_BADGE_FALLBACK_SUPPRESSION_WINDOW_MS;
}

function useDeckyGamePageBadgeModalState(): {
  readonly modalOpen: boolean;
  readonly setBadgeElement: (element: HTMLDivElement | null) => void;
} {
  const badgeElementRef = useRef<HTMLDivElement | null>(null);
  const badgeOwnerDocumentRef = useRef<Document | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState<boolean>(() => readDeckyGamePageModalOpenState());

  const setBadgeElement = useCallback((element: HTMLDivElement | null) => {
    badgeElementRef.current = element;

    if (element?.ownerDocument !== undefined) {
      badgeOwnerDocumentRef.current = element.ownerDocument;
    }
  }, []);

  const refreshModalState = useCallback(() => {
    try {
      setModalOpen((previousState) => {
        const badgeDocument = badgeElementRef.current?.ownerDocument ?? badgeOwnerDocumentRef.current;
        const nextState = readDeckyGamePageModalOpenState(badgeDocument);
        return previousState === nextState ? previousState : nextState;
      });
    } catch (error) {
      reportAchievementCompanionGamePageGlobalComponentError(error, "game-page-badge:modal");
    }
  }, []);

  useEffect(() => {
    refreshModalState();
    const timer = window.setInterval(refreshModalState, GAME_PAGE_BADGE_MODAL_POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [refreshModalState]);

  return {
    modalOpen,
    setBadgeElement,
  };
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
    );

    setPlacement((previousPlacement) => {
      if (
        previousPlacement.slotId === nextPlacement.slotId &&
        previousPlacement.collisionCount === nextPlacement.collisionCount &&
        previousPlacement.candidateCount === nextPlacement.candidateCount &&
        previousPlacement.fallbackUsed === nextPlacement.fallbackUsed
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
    );
  }, []);

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
  readonly ariaLabel: string;
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
    ariaLabel:
      appId !== undefined
        ? `Open Achievement Companion details for app ${appId}`
        : "Open Achievement Companion details",
    onActivate,
  };
}

function createDeckyGamePageAchievementRouteBadgeElement(appId: string): JSX.Element {
  return (
    <DeckyGamePageAchievementRouteBadge
      key={ACHIEVEMENT_COMPANION_GAME_PAGE_ROUTE_BADGE_ELEMENT_KEY}
      appId={appId}
    />
  );
}

export function DeckyGamePageAchievementBadge({
  appId,
  ariaLabel,
  label,
  marker,
  style,
  elementRef,
  onActivate,
}: DeckyGamePageAchievementBadgeProps): JSX.Element {
  useEffect(() => {
    const routeState = readDeckyGamePageAchievementRouteState();
    markAchievementCompanionGamePageAchievementBadgeRendered(routeState.currentRouteUrl, appId);
  }, [appId]);

  return (
    <div
      aria-label={ariaLabel}
      className="ac-game-page-achievement-badge"
      data-achievement-companion-game-page-badge={marker}
      ref={elementRef}
      role="button"
      style={style}
      tabIndex={0}
      onClick={() => {
        markAchievementCompanionGamePageAchievementBadgeClicked(appId);
        console.debug("[Achievement Companion] Game-page achievement bubble clicked", {
          appId,
        });
        onActivate?.();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          markAchievementCompanionGamePageAchievementBadgeClicked(appId);
          console.debug("[Achievement Companion] Game-page achievement bubble clicked", {
            appId,
          });
          onActivate?.();
        }
      }}
    >
      {label}
    </div>
  );
}

export function DeckyGamePageAchievementRouteBadge({
  appId,
}: {
  readonly appId: string;
}): JSX.Element | null {
  const { style, setBadgeElement } = useDeckyGamePageAchievementRouteBadgePlacement();
  const summary = useGamePageAchievementSummary(appId);
  const badgeLabel = formatDeckyGamePageAchievementBadgeLabel(summary);
  const { ariaLabel, onActivate } = useDeckyGamePageAchievementBadgeActivation(appId, summary);

  useEffect(() => {
    if (badgeLabel === undefined) {
      return;
    }

    markRouteBadgeActivity(appId);
    markAchievementCompanionGamePageRouteBadgeRendered(appId);
  }, [appId, badgeLabel]);

  if (badgeLabel === undefined) {
    return null;
  }

  return (
    <DeckyGamePageAchievementBadge
      appId={appId}
      ariaLabel={ariaLabel}
      label={badgeLabel}
      elementRef={setBadgeElement}
      marker="route"
      onActivate={onActivate}
      style={style}
    />
  );
}

export function DeckyGamePageAchievementGlobalBadge(): JSX.Element | null {
  const [routeState, setRouteState] = useState<DeckyGamePageAchievementRouteState>(() =>
    readDeckyGamePageAchievementRouteState(),
  );
  const { modalOpen, setBadgeElement } = useDeckyGamePageBadgeModalState();

  const refreshRouteState = useCallback(() => {
    try {
      setRouteState((previousState) => {
        const nextState = readDeckyGamePageAchievementRouteState();
        if (
          previousState.currentRouteUrl === nextState.currentRouteUrl &&
          previousState.detection.isGamePage === nextState.detection.isGamePage &&
          previousState.detection.appId === nextState.detection.appId &&
          previousState.detection.reason === nextState.detection.reason
        ) {
          return previousState;
        }

        return nextState;
      });
    } catch (error) {
      reportAchievementCompanionGamePageGlobalComponentError(error, "game-page-global-component:refresh");
    }
  }, []);

  useEffect(() => {
    refreshRouteState();
    const listenerWindows = getRouteListenerWindows();
    const handleRouteSignal = () => {
      refreshRouteState();
    };

    for (const targetWindow of listenerWindows) {
      targetWindow.addEventListener("popstate", handleRouteSignal);
      targetWindow.addEventListener("hashchange", handleRouteSignal);
    }

    const timer = window.setInterval(handleRouteSignal, GAME_PAGE_BADGE_ROUTE_POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      for (const targetWindow of listenerWindows) {
        targetWindow.removeEventListener("popstate", handleRouteSignal);
        targetWindow.removeEventListener("hashchange", handleRouteSignal);
      }
    };
  }, [refreshRouteState]);

  const appId = routeState.detection.appId;
  const visible = routeState.detection.isGamePage;
  const summary = useGamePageAchievementSummary(visible ? appId : undefined);
  const badgeLabel = formatDeckyGamePageAchievementBadgeLabel(summary);
  const suppressGlobalFallback = shouldSuppressGlobalFallback(appId);
  const { ariaLabel, onActivate } = useDeckyGamePageAchievementBadgeActivation(appId, summary);

  useEffect(() => {
    markAchievementCompanionGamePageGlobalComponentRendered(
      routeState.currentRouteUrl,
      routeState.detection,
    );
  }, [routeState]);

  useEffect(() => {
    markAchievementCompanionGamePageGlobalFallbackSuppressed(appId, suppressGlobalFallback);
  }, [appId, suppressGlobalFallback]);

  if (!visible || badgeLabel === undefined || modalOpen || suppressGlobalFallback) {
    return null;
  }

  return (
    <DeckyGamePageAchievementBadge
      appId={appId}
      ariaLabel={ariaLabel}
      elementRef={setBadgeElement}
      label={badgeLabel}
      marker="global"
      onActivate={onActivate}
      style={getDeckyGamePageAchievementGlobalBadgeStyle()}
    />
  );
}

function AchievementCompanionGamePageBadgeGlobalComponent(): JSX.Element | null {
  return <DeckyGamePageAchievementGlobalBadge />;
}

export function ensureDeckyGamePageAchievementRoutePatchRegistered(): () => void {
  if (deckyGamePageAchievementRoutePatchCleanup !== undefined) {
    return deckyGamePageAchievementRoutePatchCleanup;
  }

  const patchedRouteProps = new WeakSet<object>();
  const renderFuncPatches: Array<{ readonly unpatch: () => void }> = [];

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
      !patchedRouteProps.has(routeProps as object)
    ) {
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

          const nextChildren = container.props.children.filter(
            (child) => !isAchievementCompanionRouteBadgeChild(child),
          );
          nextChildren.splice(1, 0, createDeckyGamePageAchievementRouteBadgeElement(currentAppId));
          container.props.children = nextChildren;
          markRouteBadgeActivity(currentAppId);
          markAchievementCompanionGamePageRouteBadgeInserted(currentAppId);
          return ret;
        },
        "achievement-companion-game-page-badge-route",
      );

      renderFuncPatches.push(afterPatch(routeProps, "renderFunc", patchHandler));
      patchedRouteProps.add(routeProps as object);
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
    for (const renderFuncPatch of renderFuncPatches) {
      renderFuncPatch.unpatch();
    }
    renderFuncPatches.length = 0;
    clearRouteBadgeActivity();
    markAchievementCompanionGamePageRouteBadgePatchRemoved();
    deckyGamePageAchievementRoutePatchCleanup = undefined;
  };

  return deckyGamePageAchievementRoutePatchCleanup;
}

export function ensureDeckyGamePageAchievementGlobalComponentRegistered(): () => void {
  if (deckyGamePageAchievementGlobalComponentCleanup !== undefined) {
    return deckyGamePageAchievementGlobalComponentCleanup;
  }

  routerHook.addGlobalComponent(
    ACHIEVEMENT_COMPANION_GAME_PAGE_BADGE_GLOBAL_COMPONENT_NAME,
    AchievementCompanionGamePageBadgeGlobalComponent,
  );
  markAchievementCompanionGamePageGlobalComponentRegistered(
    ACHIEVEMENT_COMPANION_GAME_PAGE_BADGE_GLOBAL_COMPONENT_NAME,
  );

  deckyGamePageAchievementGlobalComponentCleanup = () => {
    routerHook.removeGlobalComponent(ACHIEVEMENT_COMPANION_GAME_PAGE_BADGE_GLOBAL_COMPONENT_NAME);
    clearRouteBadgeActivity();
    markAchievementCompanionGamePageGlobalComponentRemoved();
    deckyGamePageAchievementGlobalComponentCleanup = undefined;
  };

  return deckyGamePageAchievementGlobalComponentCleanup;
}
