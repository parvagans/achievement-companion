import type { CSSProperties } from "react";
import type { GameOverviewSuggestion } from "./decky-game-overview-recommendations";
import { NATIVE_BADGE_SURFACE as surface } from "./decky-native-badge-surface";
import { DeckyUpNextPinIcon } from "./decky-up-next-pin-icon";
import { DeckyAchievementArtwork } from "./decky-achievement-artwork";

export const NATIVE_UP_NEXT_PREVIEW_LAYOUT = {
  preview: { icon: 24, padding: 5 },
  companion: { icon: 24, padding: 5 },
} as const;
export type NativeUpNextPresentation = keyof typeof NATIVE_UP_NEXT_PREVIEW_LAYOUT;
const clamp = (lines: number): CSSProperties => ({ display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" });

/** Page-local, noninteractive presentation; sizes track Steam's logical viewport rather than fullscreen cards. */
export function DeckyNativeUpNextPreviewCard({ target, presentation, elementRef, style }: {
  readonly target: GameOverviewSuggestion;
  readonly presentation: NativeUpNextPresentation;
  readonly elementRef?: ((element: HTMLDivElement | null) => void) | undefined;
  readonly style?: CSSProperties;
}): JSX.Element {
  const layout = NATIVE_UP_NEXT_PREVIEW_LAYOUT[presentation];
  const { achievement } = target;
  return <div ref={elementRef} data-ac-native-up-next-preview={target.pinned ? "pinned" : "automatic"} data-ac-up-next-presentation={presentation}
    role="note" aria-label={`${target.pinned ? "Pinned · Up Next" : "Up Next"}: ${achievement.title}`}
    style={{ width: "100%", padding: layout.padding, boxSizing: "border-box", pointerEvents: "none", userSelect: "none",
      borderRadius: surface.radius, border: `1px solid ${surface.border}`, background: surface.background, color: surface.color, fontFamily: surface.fontFamily, ...style }}>
    <div style={{ display: "grid", gridTemplateColumns: `${layout.icon}px minmax(0,1fr)`, alignItems: "center", gap: 7 }}>
      {achievement.badgeImageUrl ? <DeckyAchievementArtwork src={achievement.badgeImageUrl} size={layout.icon} />
        : <span aria-hidden="true" data-ac-up-next-artwork-fallback style={{ width: layout.icon, height: layout.icon, background: surface.background }} />}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", height: 10, gap: 5, marginBottom: 3, fontSize: 8, lineHeight: 1, fontWeight: 800, color: surface.color, letterSpacing: ".04em" }}>
          <span>UP NEXT</span>{target.pinned ? <DeckyUpNextPinIcon size={10} /> : null}
        </div>
        <strong style={{ ...clamp(2), fontSize: 12, lineHeight: 1.12 }}>{achievement.title}</strong>
      </div>
    </div>
    {presentation === "preview" && achievement.description?.trim() ? <div data-ac-up-next-description style={{ marginTop: 5, fontSize: 10, lineHeight: 1.2, color: surface.color, opacity: .78, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{achievement.description}</div> : null}
  </div>;
}
