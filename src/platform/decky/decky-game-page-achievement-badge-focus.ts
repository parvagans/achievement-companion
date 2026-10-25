export type DeckyGamePageAchievementBadgeHorizontalDirection = "left" | "right";

export interface DeckyGamePageAchievementBadgeFocusRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface DeckyGamePageAchievementBadgeFocusCandidate<T> {
  readonly target: T;
  readonly rect: DeckyGamePageAchievementBadgeFocusRect;
}

const GAME_PAGE_BADGE_FOCUS_TARGET_SELECTOR =
  '[tabindex]:not([tabindex="-1"]), button, a[href], [role="button"], [role="link"]';
const GAME_PAGE_BADGE_FOCUS_MIN_WIDTH = 16;
const GAME_PAGE_BADGE_FOCUS_MAX_WIDTH = 480;
const GAME_PAGE_BADGE_FOCUS_MIN_HEIGHT = 16;
const GAME_PAGE_BADGE_FOCUS_MAX_HEIGHT = 160;

function getRectCenterX(rect: DeckyGamePageAchievementBadgeFocusRect): number {
  return rect.left + (rect.right - rect.left) / 2;
}

function getRectCenterY(rect: DeckyGamePageAchievementBadgeFocusRect): number {
  return rect.top + (rect.bottom - rect.top) / 2;
}

export function selectDeckyGamePageAchievementBadgeHorizontalFocusTarget<T>(
  sourceRect: DeckyGamePageAchievementBadgeFocusRect,
  candidates: readonly DeckyGamePageAchievementBadgeFocusCandidate<T>[],
  direction: DeckyGamePageAchievementBadgeHorizontalDirection,
): T | undefined {
  const sourceCenterX = getRectCenterX(sourceRect);
  const sourceCenterY = getRectCenterY(sourceRect);
  const directionalCandidates = candidates
    .filter(({ rect }) => direction === "left"
      ? getRectCenterX(rect) < sourceCenterX - 1
      : getRectCenterX(rect) > sourceCenterX + 1);
  const sameColumnCandidates = candidates.filter(
    ({ rect }) => Math.abs(getRectCenterX(rect) - sourceCenterX) <= 1,
  );
  return (directionalCandidates.length > 0 ? directionalCandidates : sameColumnCandidates)
    .sort((first, second) => {
      const firstHorizontalDistance = Math.abs(getRectCenterX(first.rect) - sourceCenterX);
      const secondHorizontalDistance = Math.abs(getRectCenterX(second.rect) - sourceCenterX);
      return firstHorizontalDistance - secondHorizontalDistance ||
        Math.abs(getRectCenterY(first.rect) - sourceCenterY) -
          Math.abs(getRectCenterY(second.rect) - sourceCenterY);
    })[0]?.target;
}

function isVisiblePositionedBadgeRoot(element: HTMLElement, ownerWindow: Window): boolean {
  const style = ownerWindow.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.opacity === "0" ||
    !["absolute", "fixed", "relative", "sticky"].includes(style.position)
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width >= GAME_PAGE_BADGE_FOCUS_MIN_WIDTH &&
    rect.width <= GAME_PAGE_BADGE_FOCUS_MAX_WIDTH &&
    rect.height >= GAME_PAGE_BADGE_FOCUS_MIN_HEIGHT &&
    rect.height <= GAME_PAGE_BADGE_FOCUS_MAX_HEIGHT;
}

function resolveBadgeRootFocusTarget(root: HTMLElement): HTMLElement | null {
  return root.matches(GAME_PAGE_BADGE_FOCUS_TARGET_SELECTOR)
    ? root
    : root.querySelector<HTMLElement>(GAME_PAGE_BADGE_FOCUS_TARGET_SELECTOR);
}

export function findDeckyGamePageAchievementBadgeHorizontalFocusTarget(
  source: HTMLElement,
  direction: DeckyGamePageAchievementBadgeHorizontalDirection,
): HTMLElement | undefined {
  const offsetParent = source.offsetParent;
  const container = offsetParent !== null && offsetParent.nodeType === 1
    ? offsetParent as HTMLElement
    : source.parentElement;
  const ownerWindow = source.ownerDocument.defaultView;
  if (container === null || ownerWindow === null) return undefined;

  const candidates: DeckyGamePageAchievementBadgeFocusCandidate<HTMLElement>[] = [];
  for (const child of Array.from(container.children)) {
    if (child.nodeType !== 1) continue;
    const root = child as HTMLElement;
    if (root === source || root.contains(source) || source.contains(root)) continue;
    if (!isVisiblePositionedBadgeRoot(root, ownerWindow)) continue;

    const target = resolveBadgeRootFocusTarget(root);
    if (target === null || target === source || target.getAttribute("aria-disabled") === "true") continue;
    const targetStyle = ownerWindow.getComputedStyle(target);
    const rect = target.getBoundingClientRect();
    if (
      targetStyle.display === "none" ||
      targetStyle.visibility === "hidden" ||
      targetStyle.opacity === "0" ||
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      continue;
    }
    candidates.push({ target, rect });
  }

  return selectDeckyGamePageAchievementBadgeHorizontalFocusTarget(
    source.getBoundingClientRect(),
    candidates,
    direction,
  );
}
