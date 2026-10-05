import { Focusable } from "@decky/ui";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  markAchievementCompanionGamePageAchievementBadgeClicked,
  markAchievementCompanionGamePageAchievementBadgeRendered,
} from "./decky-runtime-debug";
import {
  DeckyGamePageAchievementBadgeVisual,
} from "./decky-game-page-achievement-badge-theme";
import type { DeckyGamePageAchievementBadgePresentation } from "./decky-game-page-achievement-badge-presentation";

export interface DeckyGamePageAchievementBadgeProps {
  readonly appId?: string | undefined;
  readonly ariaLabel: string;
  readonly presentation: DeckyGamePageAchievementBadgePresentation;
  readonly marker: "route";
  readonly style: CSSProperties;
  readonly routeUrl: string | undefined;
  readonly elementRef?: ((element: HTMLDivElement | null) => void) | undefined;
  readonly onActivate?: (() => void) | undefined;
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
}`;

export function DeckyGamePageAchievementBadge({
  appId,
  ariaLabel,
  presentation,
  marker,
  style,
  routeUrl,
  elementRef,
  onActivate,
}: DeckyGamePageAchievementBadgeProps): JSX.Element {
  const [focused, setFocused] = useState(false);

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
      ref={elementRef}
      role="button"
      noFocusRing
      style={style}
      tabIndex={0}
      onActivate={activateBadge}
      onBlur={() => setFocused(false)}
      onClick={activateBadge}
      onFocus={() => setFocused(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateBadge();
        }
      }}
    >
      <style>{GAME_PAGE_ACHIEVEMENT_BADGE_FOCUS_CSS}</style>
      <DeckyGamePageAchievementBadgeVisual focused={focused} presentation={presentation} />
    </Focusable>
  );
}
