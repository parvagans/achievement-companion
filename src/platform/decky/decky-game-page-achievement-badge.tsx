import { Focusable } from "@decky/ui";
import { useCallback, useEffect, type CSSProperties, type ReactNode } from "react";
import {
  markAchievementCompanionGamePageAchievementBadgeClicked,
  markAchievementCompanionGamePageAchievementBadgeRendered,
} from "./decky-runtime-debug";

export interface DeckyGamePageAchievementBadgeProps {
  readonly appId?: string | undefined;
  readonly ariaLabel: string;
  readonly content: ReactNode;
  readonly marker: "route";
  readonly style: CSSProperties;
  readonly routeUrl: string | undefined;
  readonly elementRef?: ((element: HTMLDivElement | null) => void) | undefined;
  readonly onActivate?: (() => void) | undefined;
}

export function DeckyGamePageAchievementBadge({
  appId,
  ariaLabel,
  content,
  marker,
  style,
  routeUrl,
  elementRef,
  onActivate,
}: DeckyGamePageAchievementBadgeProps): JSX.Element {
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
      style={style}
      tabIndex={0}
      onActivate={activateBadge}
      onClick={activateBadge}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateBadge();
        }
      }}
    >
      {content}
    </Focusable>
  );
}
