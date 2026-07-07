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
  type ReactNode,
  type CSSProperties,
  type JSX,
} from "react";
import type { DashboardSnapshot, NormalizedGame, RecentlyPlayedGame } from "@core/domain";
import {
  DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN,
  DECKY_GAME_PAGE_ACHIEVEMENT_URL_ROUTE_PREFIX,
  detectDeckyGamePageAchievementRouteFromUrl,
  resolveDeckyGamePageAchievementAppId,
  type DeckyGamePageAchievementRouteDetectionState,
} from "./decky-game-page-achievement-route";
import {
  formatDeckyGamePageAchievementBadgeLoadingText,
  formatDeckyGamePageAchievementBadgeLabel,
  type GamePageAchievementSummary,
  useGamePageAchievementSummary,
} from "./decky-game-page-achievement-summary";
import { readDeckyDashboardSnapshotCacheEntry } from "./decky-dashboard-snapshot-cache";
import { openDeckyFullScreenGameFromLibraryGamePage } from "./decky-navigation";
import { getDeckyProviderIconSrc } from "./providers/provider-branding";
import { DeckySystemIcon } from "./decky-system-pill";
import {
  markAchievementCompanionGamePageBadgeActivated,
  markAchievementCompanionGamePageAchievementBadgeClicked,
  markAchievementCompanionGamePageAchievementBadgeRendered,
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
  getAchievementCompanionRuntimeDebugState,
  reportAchievementCompanionGamePageBadgeNavigationError,
  resolveAchievementCompanionRuntimeDebugHostContext,
} from "./decky-runtime-debug";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";

const ACHIEVEMENT_COMPANION_GAME_PAGE_ROUTE_BADGE_ELEMENT_KEY =
  "achievement-companion-game-page-badge-route";
const GAME_PAGE_BADGE_ROUTE_POLL_INTERVAL_MS = 750;
const DECKY_GAME_PAGE_ROUTE_BADGE_COLLISION_PADDING = 12;
const DECKY_GAME_PAGE_ROUTE_BADGE_DEFAULT_WIDTH = 180;
const DECKY_GAME_PAGE_ROUTE_BADGE_DEFAULT_HEIGHT = 44;
const DECKY_GAME_PAGE_ROUTE_BADGE_MAX_OBSTACLE_WIDTH = 360;
const DECKY_GAME_PAGE_ROUTE_BADGE_MAX_OBSTACLE_HEIGHT = 120;
const DECKY_GAME_PAGE_ROUTE_BADGE_MIN_OBSTACLE_WIDTH = 32;
const DECKY_GAME_PAGE_ROUTE_BADGE_MIN_OBSTACLE_HEIGHT = 24;
const DECKY_GAME_PAGE_ROUTE_BADGE_MAX_HERO_REGION_TOP = 460;

let deckyGamePageAchievementRoutePatchCleanup: (() => void) | undefined;

interface DeckyGamePageAchievementBadgeProps {
  readonly appId?: string | undefined;
  readonly ariaLabel: string;
  readonly content: ReactNode;
  readonly marker: "route";
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

interface DeckyGamePageAchievementBadgeVisualState {
  readonly ariaLabel: string;
  readonly content: ReactNode;
}

interface DeckyGamePageRetroSystemIconMetadata {
  readonly platformLabel?: string | undefined;
  readonly systemIconUrl?: string | undefined;
}

interface DeckyGamePageRetroSystemIconCandidate extends DeckyGamePageRetroSystemIconMetadata {
  readonly gameId: string;
  readonly title: string;
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

function getDeckyGamePageAchievementBadgeContentStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  };
}

function getDeckyGamePageAchievementBadgeTrophyStyle(): CSSProperties {
  return {
    flexShrink: 0,
    lineHeight: 1,
  };
}

function getDeckyGamePageAchievementBadgeCountStyle(): CSSProperties {
  return {
    whiteSpace: "nowrap",
  };
}

type DeckyGamePageAchievementBadgeStatusVariant = "plain" | "beaten" | "mastered";

function resolveDeckyGamePageAchievementBadgeCompletionStatus(
  summary: GamePageAchievementSummary | undefined,
): "beaten" | "mastered" | undefined {
  if (summary?.status !== "ready" || summary.provider !== "retroachievements") {
    return undefined;
  }

  return summary.completionStatus;
}

function resolveDeckyGamePageAchievementBadgeStatusVariant(
  summary: GamePageAchievementSummary | undefined,
): DeckyGamePageAchievementBadgeStatusVariant {
  return resolveDeckyGamePageAchievementBadgeCompletionStatus(summary) ?? "plain";
}

function formatDeckyGamePageAchievementBadgeStatusLabel(
  status: "beaten" | "mastered" | undefined,
): string | undefined {
  if (status === "beaten") {
    return "BEATEN";
  }

  if (status === "mastered") {
    return "MASTERED";
  }

  return undefined;
}

function getDeckyGamePageAchievementBadgeStatusAccentStyle(
  statusVariant: DeckyGamePageAchievementBadgeStatusVariant,
): CSSProperties {
  if (statusVariant === "mastered") {
    return {
      borderColor: "rgba(248, 225, 148, 0.98)",
      boxShadow:
        "0 0 0 1px rgba(168, 126, 20, 0.98), 0 0 0 3px rgba(248, 225, 148, 0.18), 0 8px 24px rgba(0, 0, 0, 0.36)",
      background: "rgba(34, 26, 9, 0.98)",
    };
  }

  if (statusVariant === "beaten") {
    return {
      borderColor: "rgba(238, 242, 248, 0.98)",
      boxShadow:
        "0 0 0 1px rgba(130, 142, 157, 0.98), 0 0 0 3px rgba(238, 242, 248, 0.14), 0 8px 24px rgba(0, 0, 0, 0.36)",
      background: "rgba(15, 20, 28, 0.98)",
    };
  }

  return {};
}

function getDeckyGamePageAchievementBadgeStatusShellStyle(
  statusVariant: DeckyGamePageAchievementBadgeStatusVariant,
): CSSProperties {
  return {
    ...getDeckyGamePageAchievementBadgeBaseStyle(),
    ...(statusVariant === "plain"
      ? {}
      : {
          minHeight: 42,
          padding: "0 13px",
          borderWidth: 2,
        }),
    ...getDeckyGamePageAchievementBadgeStatusAccentStyle(statusVariant),
  };
}

function getDeckyGamePageAchievementBadgeStatusStackStyle(): CSSProperties {
  return {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    overflow: "visible",
  };
}

function getDeckyGamePageAchievementBadgeLoadingShellStyle(): CSSProperties {
  return {
    ...getDeckyGamePageAchievementBadgeBaseStyle(),
    minHeight: 34,
    padding: "0 12px",
    borderWidth: 1,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.02em",
    background: "rgba(12, 18, 28, 0.94)",
    boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.48), 0 8px 22px rgba(0, 0, 0, 0.42)",
  };
}

function getDeckyGamePageAchievementBadgeStatusPillStyle(
  statusVariant: Exclude<DeckyGamePageAchievementBadgeStatusVariant, "plain">,
): CSSProperties {
  const isMastered = statusVariant === "mastered";
  const accentColor = isMastered ? "rgba(248, 225, 148, 0.98)" : "rgba(240, 244, 250, 0.98)";
  const accentTint = isMastered ? "rgba(79, 60, 15, 0.98)" : "rgba(34, 42, 52, 0.98)";
  const glowTint = isMastered ? "rgba(248, 225, 148, 0.44)" : "rgba(240, 244, 250, 0.34)";
  const outerGlow = isMastered ? "rgba(125, 92, 18, 0.5)" : "rgba(111, 123, 137, 0.46)";

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 25,
    padding: "4px 12px",
    borderRadius: 999,
    border: `1px solid ${accentColor}`,
    background: accentTint,
    color: accentColor,
    boxShadow: `0 0 0 1px rgba(0, 0, 0, 0.48), 0 0 0 2px ${outerGlow}, 0 0 16px ${glowTint}`,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.1em",
    lineHeight: 1,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
}

function getDeckyGamePageAchievementBadgeStatusLabelStyle(): CSSProperties {
  return {
    textShadow: "0 1px 0 rgba(0, 0, 0, 0.35)",
  };
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
    left: slot.left,
    right: slot.right,
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

function collectDeckyGamePageRetroSystemIconCandidates(
  snapshot: DashboardSnapshot,
): readonly DeckyGamePageRetroSystemIconCandidate[] {
  const candidates: DeckyGamePageRetroSystemIconCandidate[] = [];
  const pushCandidate = (
    game:
      | Pick<NormalizedGame, "platformLabel" | "systemIconUrl" | "gameId" | "title">
      | Pick<RecentlyPlayedGame, "platformLabel" | "systemIconUrl" | "gameId" | "title">,
  ) => {
    candidates.push({
      gameId: game.gameId,
      title: game.title,
      ...(game.platformLabel !== undefined ? { platformLabel: game.platformLabel } : {}),
      ...(game.systemIconUrl !== undefined ? { systemIconUrl: game.systemIconUrl } : {}),
    });
  };

  for (const game of snapshot.recentlyPlayedGames) {
    pushCandidate(game);
  }

  for (const game of snapshot.featuredGames) {
    pushCandidate(game);
  }

  for (const game of snapshot.profile.featuredGames ?? []) {
    pushCandidate(game);
  }

  return candidates;
}

function resolveDeckyGamePageRetroSystemIconMetadata(
  summary: GamePageAchievementSummary | undefined,
): DeckyGamePageRetroSystemIconMetadata | undefined {
  if (summary?.status !== "ready" || summary.provider !== "retroachievements") {
    return undefined;
  }

  if (summary.platformLabel !== undefined || summary.systemIconUrl !== undefined) {
    return {
      ...(summary.platformLabel !== undefined ? { platformLabel: summary.platformLabel } : {}),
      ...(summary.systemIconUrl !== undefined ? { systemIconUrl: summary.systemIconUrl } : {}),
    };
  }

  const snapshot = readDeckyDashboardSnapshotCacheEntry(RETROACHIEVEMENTS_PROVIDER_ID)?.snapshot;
  if (snapshot === undefined) {
    return undefined;
  }

  const candidates = collectDeckyGamePageRetroSystemIconCandidates(snapshot);

  const matchingByGameId =
    summary.gameId !== undefined
      ? candidates.find((candidate) => candidate.gameId === summary.gameId)
      : undefined;
  if (matchingByGameId !== undefined) {
    return matchingByGameId;
  }

  return summary.title !== undefined
    ? candidates.find((candidate) => candidate.title === summary.title)
    : undefined;
}

function resolveDeckyGamePageAchievementBadgeIconUrl(
  summary: GamePageAchievementSummary | undefined,
  retroSystemIconMetadata: DeckyGamePageRetroSystemIconMetadata | undefined,
): string | undefined {
  if (summary?.status !== "ready") {
    return undefined;
  }

  if (summary.provider === "retroachievements") {
    return retroSystemIconMetadata?.systemIconUrl;
  }

  if (summary.provider === "steam") {
    return getDeckyProviderIconSrc(summary.provider);
  }

  return undefined;
}

function renderDeckyGamePageAchievementBadgeContent(
  summary: GamePageAchievementSummary | undefined,
  retroSystemIconMetadata: DeckyGamePageRetroSystemIconMetadata | undefined,
): DeckyGamePageAchievementBadgeVisualState {
  if (summary?.status === "loading") {
    const loadingLabel = formatDeckyGamePageAchievementBadgeLoadingText(
      summary,
      getAchievementCompanionRuntimeDebugState(),
    );
    const loadingText = loadingLabel.replace(/^\u{1f3c6}\s*/u, "");
    return {
      ariaLabel: loadingText,
      content: (
        <span style={getDeckyGamePageAchievementBadgeStatusStackStyle()}>
          <span style={getDeckyGamePageAchievementBadgeLoadingShellStyle()}>
            <span style={getDeckyGamePageAchievementBadgeContentStyle()}>
              <span aria-hidden="true" style={getDeckyGamePageAchievementBadgeTrophyStyle()}>
                {"\u{1f3c6}"}
              </span>
              <span style={getDeckyGamePageAchievementBadgeCountStyle()}>{loadingText}</span>
            </span>
          </span>
        </span>
      ),
    };
  }


  if (summary?.status !== "ready") {
    return {
      ariaLabel: "Open Achievement Companion details",
      content: "",
    };
  }

  const iconUrl =
    resolveDeckyGamePageAchievementBadgeIconUrl(summary, retroSystemIconMetadata);
  const platformLabel =
    summary.provider === "retroachievements" ? retroSystemIconMetadata?.platformLabel : undefined;
  const badgeCompletionStatus =
    summary.provider === "retroachievements"
      ? resolveDeckyGamePageAchievementBadgeCompletionStatus(summary)
      : undefined;
  const badgeStatusVariant =
    summary.provider === "retroachievements"
      ? resolveDeckyGamePageAchievementBadgeStatusVariant(summary)
      : "plain";
  const badgeStatusLabel = formatDeckyGamePageAchievementBadgeStatusLabel(badgeCompletionStatus);
  const countText = `${String(summary.earned)} / ${String(summary.total)}`;

  return {
    ariaLabel:
      summary.provider === "retroachievements" && platformLabel !== undefined
        ? `Open Achievement Companion details for app ${summary.appId}, ${platformLabel}, ${countText}`
        : `Open Achievement Companion details for app ${summary.appId}, ${countText}`,
    content: (
      <span style={getDeckyGamePageAchievementBadgeStatusStackStyle()}>
        <span style={getDeckyGamePageAchievementBadgeStatusShellStyle(badgeStatusVariant)}>
          <span style={getDeckyGamePageAchievementBadgeContentStyle()}>
            <span aria-hidden="true" style={getDeckyGamePageAchievementBadgeTrophyStyle()}>
              🏆
            </span>
            {iconUrl !== undefined ? (
              <DeckySystemIcon iconSize={20} iconUrl={iconUrl} />
            ) : null}
            <span style={getDeckyGamePageAchievementBadgeCountStyle()}>{countText}</span>
          </span>
        </span>
        {badgeStatusVariant !== "plain" && badgeStatusLabel !== undefined ? (
          <span style={getDeckyGamePageAchievementBadgeStatusPillStyle(badgeStatusVariant)}>
            <span style={getDeckyGamePageAchievementBadgeStatusLabelStyle()}>
              {badgeStatusLabel}
            </span>
          </span>
        ) : null}
      </span>
    ),
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
  const rejectedReasons: string[] = [];

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
        rejectedReasons,
      };
    }

    rejectedReasons.push(`${candidateSlot.id}:collision-${collisionCount}`);

    if (candidateSlot.id === fallbackSlot.id) {
      fallbackCollisionCount = collisionCount;
    }
  }

  return {
    slotId: fallbackSlot.id,
    collisionCount: fallbackCollisionCount,
    candidateCount: DECKY_GAME_PAGE_ROUTE_BADGE_CANDIDATE_SLOTS.length,
    fallbackUsed: true,
    rejectedReasons,
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
  content,
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
      {content}
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
  const badgeCompletionStatus = resolveDeckyGamePageAchievementBadgeCompletionStatus(summary);
  const badgeStatusVariant = resolveDeckyGamePageAchievementBadgeStatusVariant(summary);
  const badgeLabel = formatDeckyGamePageAchievementBadgeLabel(summary);
  const retroSystemIconMetadata = useMemo(
    () => resolveDeckyGamePageRetroSystemIconMetadata(summary),
    [summary],
  );
  const { ariaLabel, content } = useMemo(
    () => renderDeckyGamePageAchievementBadgeContent(summary, retroSystemIconMetadata),
    [retroSystemIconMetadata, summary],
  );
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
    const iconUrl = resolveDeckyGamePageAchievementBadgeIconUrl(summary, retroSystemIconMetadata);
    markAchievementCompanionGamePageBadgeSystemIcon({
      providerId: summary?.status === "ready" ? summary.provider : undefined,
      platformLabel: retroSystemIconMetadata?.platformLabel,
      iconUrl,
      rendered:
        summary?.status === "ready" && iconUrl !== undefined,
    });
  }, [retroSystemIconMetadata, summary]);

  useEffect(() => {
    const summaryCompletionStatus =
      summary?.status === "ready" && summary.provider === "retroachievements"
        ? summary.completionStatus
        : undefined;
    markAchievementCompanionGamePageBadgeStatus({
      summaryCompletionStatus,
      badgeCompletionStatus,
      badgeStatusVariant,
      nativeBadgeStatusRendered: badgeStatusVariant !== "plain",
      clearKeys:
        summaryCompletionStatus === undefined && badgeCompletionStatus === undefined
          ? ["summaryCompletionStatus", "badgeCompletionStatus"]
          : undefined,
    });
  }, [badgeCompletionStatus, badgeStatusVariant, summary]);

  if (badgeLabel === undefined) {
    return null;
  }

  return (
    <DeckyGamePageAchievementBadge
      appId={appId}
      ariaLabel={ariaLabel}
      content={content}
      elementRef={setBadgeElement}
      marker="route"
      onActivate={onActivate}
      style={style}
    />
  );
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
    markAchievementCompanionGamePageRouteBadgePatchRemoved();
    deckyGamePageAchievementRoutePatchCleanup = undefined;
  };

  return deckyGamePageAchievementRoutePatchCleanup;
}
