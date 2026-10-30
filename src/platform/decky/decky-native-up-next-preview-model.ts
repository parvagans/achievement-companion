import type { GameDetailSnapshot } from "@core/domain";
import type { ResourceState } from "@core/cache";
import type { GamePageUpNextPreview } from "@core/settings";
import type { GamePageAchievementSummary } from "./decky-game-page-achievement-summary";

export interface NativeUpNextIdentity { readonly providerId: "steam" | "retroachievements"; readonly gameId: string }
export function nativeUpNextIdentity(summary: GamePageAchievementSummary | undefined, appId: string): NativeUpNextIdentity | undefined {
  if (summary?.status !== "ready" || summary.appId !== appId) return undefined;
  const gameId = summary.provider === "steam" ? appId : summary.gameId;
  return gameId !== undefined && /^[1-9]\d*$/.test(gameId) ? { providerId: summary.provider, gameId } : undefined;
}

export function shouldShowNativeUpNextPreview(mode: GamePageUpNextPreview, focused: boolean, hovered: boolean,
  surface?: { readonly pageVisible: boolean; readonly badgeEnabled: boolean }): boolean {
  if (surface && (!surface.pageVisible || !surface.badgeEnabled)) return false;
  return mode === "always" || mode === "focus" && (focused || hovered);
}

/** Description visibility never grants eligibility to the owning preview. */
export function nativeUpNextPresentation(mode: GamePageUpNextPreview, focused: boolean, hovered: boolean): "preview" | "companion" {
  return mode === "always" || mode === "focus" && (focused || hovered) ? "preview" : "companion";
}

/** One bounded attempt per visible route/revision. Shared resources own deduplication. */
export function createNativeUpNextPreviewSession(dependencies: {
  readonly read: () => ResourceState<GameDetailSnapshot> | undefined;
  readonly load: () => Promise<ResourceState<GameDetailSnapshot>>;
}) {
  let attempt: Promise<ResourceState<GameDetailSnapshot>> | undefined;
  let requested = false;
  return {
    read: dependencies.read,
    requested: () => requested,
    load(): Promise<ResourceState<GameDetailSnapshot>> {
      requested = true;
      const cached = dependencies.read();
      if (cached?.data !== undefined && !cached.isStale && cached.status === "success") return Promise.resolve(cached);
      attempt ??= Promise.resolve().then(dependencies.load);
      return attempt;
    },
  };
}

export interface PreviewRect { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

/** Retry the existing placement with a compact card if the whole description cannot fit. */
export function measureNativeUpNextPreviewPlacement(card: HTMLElement, place: (size: { width: number; height: number }) => PreviewRect | undefined): PreviewRect | undefined {
  const description = card.querySelector<HTMLElement>("[data-ac-up-next-description]");
  if (description) description.hidden = false;
  let placement = place(card.getBoundingClientRect());
  if (placement === undefined && description) {
    description.hidden = true;
    placement = place(card.getBoundingClientRect());
  }
  return placement;
}
function overlaps(a: PreviewRect, b: PreviewRect): boolean {
  return a.left < b.right + 6 && a.right > b.left - 6 && a.top < b.bottom + 6 && a.bottom > b.top - 6;
}

/** Prefer an adjacent slot in the measured hero; suppress if every slot covers a control. */
export function placeNativeUpNextPreview(badge: PreviewRect, hero: PreviewRect, viewport: { width: number; height: number }, size: { width: number; height: number }, obstacles: readonly PreviewRect[]): PreviewRect | undefined {
  const bounds = { left: Math.max(8, hero.left + 8), top: Math.max(8, hero.top + 8), right: Math.min(viewport.width - 8, hero.right - 8), bottom: Math.min(viewport.height - 8, hero.bottom - 8) };
  const { width, height } = size;
  // Prefer the coordinated stack before trying side slots for collision recovery.
  const lefts = [badge.left, badge.right - width, badge.right + 10, badge.left - width - 10];
  const tops = [badge.bottom + 10, badge.top - height - 10, badge.top, badge.bottom - height];
  for (const top of tops) for (const left of lefts) {
    const x = Math.max(bounds.left, Math.min(bounds.right - width, left));
    const y = Math.max(bounds.top, Math.min(bounds.bottom - height, top));
    const rect = { left: x, top: y, right: x + width, bottom: y + height };
    if (rect.right > bounds.right || rect.bottom > bounds.bottom || overlaps(rect, badge) || obstacles.some((obstacle) => overlaps(rect, obstacle))) continue;
    return rect;
  }
  return undefined;
}
