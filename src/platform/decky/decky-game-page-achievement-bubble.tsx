import { routerHook } from "@decky/api";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type JSX } from "react";
import {
  DECKY_GAME_PAGE_ACHIEVEMENT_URL_ROUTE_PREFIX,
  detectDeckyGamePageAchievementRouteFromUrl,
  type DeckyGamePageAchievementRouteDetectionState,
} from "./decky-game-page-achievement-route";
import { hasVisibleDeckyGamePageModal } from "./decky-game-page-achievement-modal-visibility";
import {
  formatDeckyGamePageAchievementBadgeLabel,
  useGamePageAchievementSummary,
} from "./decky-game-page-achievement-summary";
import {
  markAchievementCompanionGamePageAchievementBadgeClicked,
  markAchievementCompanionGamePageAchievementBadgeRendered,
  markAchievementCompanionGamePageGlobalComponentRegistered,
  markAchievementCompanionGamePageGlobalComponentRemoved,
  markAchievementCompanionGamePageGlobalComponentRendered,
  reportAchievementCompanionGamePageGlobalComponentError,
  resolveAchievementCompanionRuntimeDebugHostContext,
} from "./decky-runtime-debug";

const ACHIEVEMENT_COMPANION_GAME_PAGE_BADGE_GLOBAL_COMPONENT_NAME =
  "AchievementCompanionGamePageBadge";
const GAME_PAGE_BADGE_ROUTE_POLL_INTERVAL_MS = 750;
const GAME_PAGE_BADGE_MODAL_POLL_INTERVAL_MS = 500;

let deckyGamePageAchievementGlobalComponentCleanup: (() => void) | undefined;

interface DeckyGamePageAchievementBadgeProps {
  readonly appId?: string | undefined;
  readonly label: string;
  readonly elementRef?: ((element: HTMLDivElement | null) => void) | undefined;
}

interface DeckyGamePageAchievementRouteState {
  readonly currentRouteUrl: string | undefined;
  readonly detection: DeckyGamePageAchievementRouteDetectionState;
}

interface DeckyGamePageAchievementTargetContext {
  readonly targetDocument: Document;
  readonly targetWindow: Window;
}

function getDeckyGamePageAchievementBadgeStyle(): CSSProperties {
  return {
    position: "fixed",
    top: 90,
    left: 32,
    zIndex: 7002,
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

export function DeckyGamePageAchievementBadge({
  appId,
  label,
  elementRef,
}: DeckyGamePageAchievementBadgeProps): JSX.Element {
  useEffect(() => {
    const routeState = readDeckyGamePageAchievementRouteState();
    markAchievementCompanionGamePageAchievementBadgeRendered(routeState.currentRouteUrl, appId);
  }, [appId]);

  return (
    <div
      aria-label={appId !== undefined ? `Achievement bubble for app ${appId}` : "Achievement bubble"}
      className="ac-game-page-achievement-badge"
      data-achievement-companion-game-page-badge="true"
      ref={elementRef}
      role="button"
      style={getDeckyGamePageAchievementBadgeStyle()}
      tabIndex={0}
      onClick={() => {
        markAchievementCompanionGamePageAchievementBadgeClicked(appId);
        console.debug("[Achievement Companion] Game-page achievement bubble clicked", {
          appId,
        });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          markAchievementCompanionGamePageAchievementBadgeClicked(appId);
          console.debug("[Achievement Companion] Game-page achievement bubble clicked", {
            appId,
          });
        }
      }}
    >
      {label}
    </div>
  );
}

export function DeckyGamePageAchievementGlobalBadge(): JSX.Element | null {
  const [routeState, setRouteState] = useState<DeckyGamePageAchievementRouteState>(() =>
    readDeckyGamePageAchievementRouteState(),
  );
  const badgeElementRef = useRef<HTMLDivElement | null>(null);
  const badgeOwnerDocumentRef = useRef<Document | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState<boolean>(() => readDeckyGamePageModalOpenState());

  const setBadgeElement = useCallback((element: HTMLDivElement | null) => {
    badgeElementRef.current = element;

    if (element?.ownerDocument !== undefined) {
      badgeOwnerDocumentRef.current = element.ownerDocument;
    }
  }, []);

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

  const refreshModalState = useCallback(() => {
    try {
      setModalOpen((previousState) => {
        const badgeDocument = badgeElementRef.current?.ownerDocument ?? badgeOwnerDocumentRef.current;
        const nextState = readDeckyGamePageModalOpenState(badgeDocument);
        return previousState === nextState ? previousState : nextState;
      });
    } catch (error) {
      reportAchievementCompanionGamePageGlobalComponentError(error, "game-page-global-component:modal");
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

  useEffect(() => {
    refreshModalState();
    const timer = window.setInterval(refreshModalState, GAME_PAGE_BADGE_MODAL_POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [refreshModalState]);

  const appId = routeState.detection.appId;
  const visible = routeState.detection.isGamePage;
  const summary = useGamePageAchievementSummary(visible ? appId : undefined);
  const badgeLabel = formatDeckyGamePageAchievementBadgeLabel(summary);

  useEffect(() => {
    markAchievementCompanionGamePageGlobalComponentRendered(
      routeState.currentRouteUrl,
      routeState.detection,
    );
  }, [routeState]);

  if (!visible || badgeLabel === undefined || modalOpen) {
    return null;
  }

  return <DeckyGamePageAchievementBadge appId={appId} elementRef={setBadgeElement} label={badgeLabel} />;
}

function AchievementCompanionGamePageBadgeGlobalComponent(): JSX.Element | null {
  return <DeckyGamePageAchievementGlobalBadge />;
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
    markAchievementCompanionGamePageGlobalComponentRemoved();
    deckyGamePageAchievementGlobalComponentCleanup = undefined;
  };

  return deckyGamePageAchievementGlobalComponentCleanup;
}
