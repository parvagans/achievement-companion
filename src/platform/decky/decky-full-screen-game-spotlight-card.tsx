import type { CSSProperties, FocusEventHandler, ReactNode } from "react";
import { Focusable, type FocusableProps } from "@decky/ui";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";

function getCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.02))",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 2px 10px rgba(0, 0, 0, 0.18)",
  };
}

function getHeaderStyle(alignment: "center" | "left"): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: "0.8em",
    fontWeight: 800,
    letterSpacing: "0.12em",
    lineHeight: 1.1,
    textAlign: alignment,
    textTransform: "uppercase",
  };
}

export interface DeckyFullScreenGameSpotlightCardProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly style?: CSSProperties;
  readonly headerAlignment?: "center" | "left";
  /**
   * Passive stat cards are controller focus targets. Cards that contain an
   * interactive action row opt out so Decky can route focus to the buttons.
   */
  readonly focusable?: boolean;
}

export function DeckyFullScreenGameSpotlightFocusTarget({
  children,
  style,
}: {
  readonly children: ReactNode;
  readonly style?: CSSProperties;
}): JSX.Element {
  const onFocus: FocusEventHandler<HTMLElement> = (event) => {
    scrollDeckyFocusTargetIntoView(event.currentTarget);
  };
  const onGamepadFocus: NonNullable<FocusableProps["onGamepadFocus"]> = (event) => {
    scrollDeckyFocusTargetIntoView(event.currentTarget);
  };

  return (
    <Focusable noFocusRing onActivate={() => {}} onFocus={onFocus} onGamepadFocus={onGamepadFocus} style={style}>
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
}: DeckyFullScreenGameSpotlightCardProps): JSX.Element {
  const cardStyle = { ...getCardStyle(), ...style };
  const content = <>
    <div style={getHeaderStyle(headerAlignment)}>{title}</div>
    {children}
  </>;

  if (!focusable) {
    return <div style={cardStyle}>{content}</div>;
  }

  return (
    <DeckyFullScreenGameSpotlightFocusTarget style={cardStyle}>
      {content}
    </DeckyFullScreenGameSpotlightFocusTarget>
  );
}
