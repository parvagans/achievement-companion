import { Focusable } from "@decky/ui";
import { useState } from "react";
import type {
  CSSProperties,
  ComponentProps,
  ComponentPropsWithoutRef,
  FocusEventHandler,
  JSX,
  ReactNode,
} from "react";
import {
  DECKY_FOCUS_PILL_ACTIVE_CLASS,
  DECKY_FOCUS_PILL_CLASS,
} from "./decky-focus-styles";

export interface DeckyCompactPillActionItemProps {
  readonly iconSrc?: string | undefined;
  readonly iconAlt?: string | undefined;
  readonly label: string;
  readonly onClick: () => void;
  readonly onFocus?: FocusEventHandler<HTMLElement>;
  readonly onGamepadFocus?: DeckyGamepadFocusHandler;
  readonly selected?: boolean;
  readonly role?: "button" | "radio";
  readonly ariaLabel?: string;
  readonly ariaChecked?: boolean;
}

function getPillStyle(selected: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    maxWidth: "100%",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    boxSizing: "border-box",
    color: "rgba(255, 255, 255, 0.9)",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.15,
    textAlign: "center",
    whiteSpace: "nowrap",
    transition:
      "background-color 120ms ease, color 120ms ease, box-shadow 120ms ease, transform 120ms ease",
    ...(selected
      ? {
          backgroundColor: "rgba(255, 255, 255, 0.18)",
          color: "rgba(255, 255, 255, 0.98)",
          boxShadow: "inset 0 0 0 2px rgba(255, 255, 255, 0.24)",
        }
      : {}),
  };
}

function getFocusedPillStyle(): CSSProperties {
  return {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    color: "rgba(255, 255, 255, 0.98)",
    boxShadow: "inset 0 0 0 2px rgba(255, 255, 255, 0.24)",
  };
}

function getPillGroupStyle(): CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: "8px 10px",
    minWidth: 0,
    width: "100%",
  };
}

function getPillContentStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minWidth: 0,
  };
}

function getPillIconFrameStyle(): CSSProperties {
  return {
    display: "inline-flex",
    width: 24,
    height: 24,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: 6,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  };
}

function getPillIconStyle(): CSSProperties {
  return {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };
}

type DeckyGamepadFocusHandler = NonNullable<ComponentProps<typeof Focusable>["onGamepadFocus"]>;

const scrollFocusedElementIntoView: FocusEventHandler<HTMLElement> = (event) => {
  event.currentTarget.scrollIntoView({
    block: "nearest",
    inline: "nearest",
  });
};

const scrollFocusedGamepadElementIntoView: DeckyGamepadFocusHandler = (event) => {
  const target = event.currentTarget;

  if (target instanceof HTMLElement) {
    target.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }
};

export function DeckyCompactPillActionItem({
  iconSrc,
  iconAlt,
  label,
  onClick,
  selected = false,
  role = "button",
  ariaLabel,
  ariaChecked,
  onFocus = scrollFocusedElementIntoView,
  onGamepadFocus = scrollFocusedGamepadElementIntoView,
}: DeckyCompactPillActionItemProps): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const isActive = isFocused;

  return (
    <Focusable
      className={`${DECKY_FOCUS_PILL_CLASS} ${isActive ? DECKY_FOCUS_PILL_ACTIVE_CLASS : ""}`.trim()}
      noFocusRing
      role={role}
      aria-label={ariaLabel ?? label}
      aria-checked={ariaChecked}
      onActivate={onClick}
      onClick={onClick}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus(event);
      }}
      onGamepadFocus={(event) => {
        setIsFocused(true);
        onGamepadFocus(event);
      }}
      onBlur={() => {
        setIsFocused(false);
      }}
      style={{
        ...getPillStyle(selected),
        ...(isFocused ? getFocusedPillStyle() : {}),
      }}
    >
      <span style={getPillContentStyle()}>
        {iconSrc !== undefined ? (
          <span aria-hidden="true" style={getPillIconFrameStyle()}>
            <img alt={iconAlt ?? label} loading="lazy" src={iconSrc} style={getPillIconStyle()} />
          </span>
        ) : null}
        <span>{label}</span>
      </span>
    </Focusable>
  );
}

export interface DeckyCompactPillActionGroupProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  readonly children: ReactNode;
  readonly flowChildren?: "row" | "column";
}

export function DeckyCompactPillActionGroup({
  children,
  className,
  flowChildren = "row",
  style,
  ...props
}: DeckyCompactPillActionGroupProps): JSX.Element {
  return (
    <div
      {...props}
      {...({ "flow-children": flowChildren } as Record<string, string>)}
      className={className}
      style={{
        ...getPillGroupStyle(),
        ...(style ?? {}),
      }}
    >
      {children}
    </div>
  );
}
