import type { CSSProperties, FocusEventHandler, ReactNode } from "react";
import { Focusable, type FocusableProps } from "@decky/ui";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { raRecipes, raTheme } from "./ra-theme";

function getCardStyle(themeVariant: "default" | "ra"): CSSProperties {
  if (themeVariant === "ra") {
    return { ...raRecipes.card("fullscreen", true), display: "flex", flexDirection: "column", gap: 8, width: "100%", minWidth: 0, padding: 10 };
  }
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: 10,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.02))",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 2px 10px rgba(0, 0, 0, 0.18)",
  };
}

function getHeaderStyle(alignment: "center" | "left", themeVariant: "default" | "ra"): CSSProperties {
  return {
    color: themeVariant === "ra" ? raTheme.color.accent : "rgba(255, 255, 255, 0.6)",
    fontSize: "0.8em",
    fontWeight: 800,
    letterSpacing: "0.12em",
    lineHeight: 1.1,
    textAlign: alignment,
    textTransform: "uppercase",
  };
}

export interface DeckyFullScreenGameSpotlightCardProps {
  readonly title: ReactNode;
  readonly children: ReactNode;
  readonly style?: CSSProperties;
  readonly headerAlignment?: "center" | "left";
  readonly focusTargetId?: string;
  /**
   * Passive stat cards are controller focus targets. Cards that contain an
   * interactive action row opt out so Decky can route focus to the buttons.
   */
  readonly focusable?: boolean;
  readonly themeVariant?: "default" | "ra";
}

export function DeckyFullScreenGameSpotlightFocusTarget({
  children,
  style,
  focusTargetId,
}: {
  readonly children: ReactNode;
  readonly style?: CSSProperties;
  readonly focusTargetId?: string;
}): JSX.Element {
  const onFocus: FocusEventHandler<HTMLElement> = (event) => {
    scrollDeckyFocusTargetIntoView(event.currentTarget);
  };
  const onGamepadFocus: NonNullable<FocusableProps["onGamepadFocus"]> = (event) => {
    scrollDeckyFocusTargetIntoView(event.currentTarget);
  };

  return (
    <Focusable
      noFocusRing
      onActivate={() => {}}
      onFocus={onFocus}
      onGamepadFocus={onGamepadFocus}
      style={style}
      {...(focusTargetId !== undefined
        ? { "data-achievement-companion-focus-target": focusTargetId }
        : {})}
    >
      {children}
    </Focusable>
  );
}

export function getDeckyFullScreenGameSpotlightFillStyle(): CSSProperties {
  return {
    flex: "1 1 auto",
    minHeight: 0,
    height: "100%",
  };
}

export function DeckyFullScreenGameSpotlightCard({
  title,
  children,
  style,
  headerAlignment = "center",
  focusable = true,
  themeVariant = "default",
  focusTargetId,
}: DeckyFullScreenGameSpotlightCardProps): JSX.Element {
  const cardStyle = { ...getCardStyle(themeVariant), ...style };
  const content = <>
    <div style={getHeaderStyle(headerAlignment, themeVariant)}>{title}</div>
    {children}
  </>;

  if (!focusable) {
    return <div style={cardStyle}>{content}</div>;
  }

  return (
    <DeckyFullScreenGameSpotlightFocusTarget
      style={cardStyle}
      {...(focusTargetId !== undefined ? { focusTargetId } : {})}
    >
      {content}
    </DeckyFullScreenGameSpotlightFocusTarget>
  );
}
