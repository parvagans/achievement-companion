import { Focusable } from "@decky/ui";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import {
  achievementCompanionQamTheme,
} from "./decky-qam-theme";
import {
  DECKY_LOADING_COLORS,
  DeckyLoadingBrandMark,
} from "./decky-loading-brand";
import { getDeckyFullScreenLoadingPageStyle } from "./decky-full-screen-loading-state";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { raTheme } from "./ra-theme";

const pageStyle: CSSProperties = {
  ...getDeckyFullScreenLoadingPageStyle(),
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  padding: "clamp(12px, 2vh, 24px) clamp(16px, 5vw, 72px) 50px",
  boxSizing: "border-box",
  color: raTheme.color.textPrimary,
  fontFamily: achievementCompanionQamTheme.type.fontFamily,
};

const contentStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 20,
  width: "100%",
  maxWidth: 840,
  outline: "none",
  textAlign: "center",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: DECKY_LOADING_COLORS.text,
  fontSize: 34,
  fontWeight: 800,
  letterSpacing: "0.11em",
  lineHeight: 1.05,
  textShadow: "0 0 22px rgba(8, 213, 245, 0.24)",
};

export function DeckyRetroAchievementsSystemsComingSoon({
  isActive,
}: {
  readonly isActive: boolean;
}): JSX.Element {
  const focusRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isActive) return undefined;
    return requestDeckySteamGamepadFocusAfterMount(focusRef.current);
  }, [isActive]);

  return (
    <section
      data-ac-ra-theme="fullscreen"
      data-achievement-companion-ra-systems-coming-soon="true"
      style={pageStyle}
    >
      <Focusable
        ref={focusRef}
        autoFocus
        noFocusRing
        onActivate={() => undefined}
        preferredFocus
        role="status"
        tabIndex={0}
        aria-label="Systems, coming soon"
        data-achievement-companion-focus-target="ra-systems-coming-soon"
        style={contentStyle}
      >
        <DeckyLoadingBrandMark providerId="retroachievements" />
        <h1 style={titleStyle}>COMING SOON...</h1>
      </Focusable>
    </section>
  );
}
