import { Focusable, GamepadButton, type GamepadEvent } from "@decky/ui";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type {
  GamePageAchievementBadgeColors,
  GamePageAchievementBadgeSize,
  GamePageAchievementBadgeStyle,
} from "@core/settings";
import {
  markAchievementCompanionGamePageAchievementBadgeClicked,
  markAchievementCompanionGamePageAchievementBadgeRendered,
} from "./decky-runtime-debug";
import {
  DeckyGamePageAchievementBadgeVisual,
} from "./decky-game-page-achievement-badge-theme";
import { DeckyGamePageAchievementBadgeMinimal } from "./decky-game-page-achievement-badge-minimal";
import type { DeckyGamePageAchievementBadgePresentation } from "./decky-game-page-achievement-badge-presentation";
import { findDeckyGamePageAchievementBadgeHorizontalFocusTarget } from "./decky-game-page-achievement-badge-focus";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";
import { DeckyNativeUpNextPreview } from "./decky-native-up-next-preview";
import type { NativeUpNextIdentity } from "./decky-native-up-next-preview-model";

export interface DeckyGamePageAchievementBadgeProps {
  readonly appId?: string | undefined;
  readonly ariaLabel: string;
  readonly badgeStyle: GamePageAchievementBadgeStyle;
  readonly colors: GamePageAchievementBadgeColors;
  readonly size: GamePageAchievementBadgeSize;
  readonly presentation: DeckyGamePageAchievementBadgePresentation;
  readonly marker: "route";
  readonly style: CSSProperties;
  readonly routeUrl: string | undefined;
  readonly elementRef?: ((element: HTMLDivElement | null) => void) | undefined;
  readonly onActivate?: (() => void) | undefined;
  readonly upNextIdentity?: NativeUpNextIdentity | undefined;
}

const GAME_PAGE_ACHIEVEMENT_BADGE_FOCUS_CSS = `
.ac-game-page-achievement-badge,
.ac-game-page-achievement-badge:is(.gpfocus,.gpfocuswithin,:focus,:focus-within) {
  outline: none !important;
  border: 0 solid transparent !important;
  background: transparent !important;
  box-shadow: none !important;
}
.ac-game-page-achievement-badge::before,
.ac-game-page-achievement-badge::after {
  display: none !important;
}
`;

function handleDeckyGamePageAchievementBadgeButtonDown(event: GamepadEvent): void {
  const direction = event.detail.button === GamepadButton.DIR_LEFT
    ? "left"
    : event.detail.button === GamepadButton.DIR_RIGHT
      ? "right"
      : undefined;
  if (direction === undefined) return;

  const source = event.currentTarget as HTMLElement;
  const target = findDeckyGamePageAchievementBadgeHorizontalFocusTarget(source, direction);
  if (target === undefined || !takeDeckySteamGamepadFocus(target)) return;

  event.preventDefault();
  event.stopPropagation();
  playDeckySteamNavigationSound(source.ownerDocument);
}

export function DeckyGamePageAchievementBadge({
  appId,
  ariaLabel,
  badgeStyle,
  colors,
  size,
  presentation,
  marker,
  style,
  routeUrl,
  elementRef,
  onActivate,
  upNextIdentity,
}: DeckyGamePageAchievementBadgeProps): JSX.Element {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [badge, setBadge] = useState<HTMLDivElement | null>(null);
  const setElement = useCallback((element: HTMLDivElement | null) => { setBadge(element); elementRef?.(element); }, [elementRef]);

  useEffect(() => {
    markAchievementCompanionGamePageAchievementBadgeRendered(routeUrl, appId);
  }, [appId, routeUrl]);

  const activateBadge = useCallback(() => {
    markAchievementCompanionGamePageAchievementBadgeClicked(appId);
    console.debug("[Achievement Companion] Game-page achievement badge activated", {
      appId,
    });
    onActivate?.();
  }, [appId, onActivate]);

  return (
    <Focusable
      aria-label={ariaLabel}
      className="ac-game-page-achievement-badge"
      data-achievement-companion-game-page-badge={marker}
      ref={setElement}
      role="button"
      noFocusRing
      style={style}
      tabIndex={0}
      onActivate={activateBadge}
      onBlur={() => setFocused(false)}
      onButtonDown={handleDeckyGamePageAchievementBadgeButtonDown}
      onClick={activateBadge}
      onFocus={() => setFocused(true)}
      onGamepadBlur={() => setFocused(false)}
      onGamepadFocus={() => setFocused(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateBadge();
        }
      }}
    >
      <style>{GAME_PAGE_ACHIEVEMENT_BADGE_FOCUS_CSS}</style>
      {badgeStyle === "minimal" ? (
        <DeckyGamePageAchievementBadgeMinimal
          focused={focused}
          presentation={presentation}
          size={size}
        />
      ) : (
        <DeckyGamePageAchievementBadgeVisual
          colors={colors}
          focused={focused}
          presentation={presentation}
          size={size}
        />
      )}
      {badge !== null && upNextIdentity !== undefined && appId !== undefined ? <DeckyNativeUpNextPreview key={`${appId}:${upNextIdentity.providerId}:${upNextIdentity.gameId}`} identity={upNextIdentity} appId={appId} badge={badge} focused={focused} hovered={hovered} /> : null}
    </Focusable>
  );
}
