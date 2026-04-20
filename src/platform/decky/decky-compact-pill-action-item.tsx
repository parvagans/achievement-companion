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
  readonly statusLabel?: string | undefined;
  readonly emphasis?: "default" | "primary";
  readonly onClick: () => void;
  readonly onFocus?: FocusEventHandler<HTMLElement>;
  readonly onGamepadFocus?: DeckyGamepadFocusHandler;
  readonly onCancelButton?: DeckyGamepadCancelHandler;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly role?: "button" | "radio";
  readonly ariaLabel?: string;
  readonly ariaChecked?: boolean;
  readonly stretch?: boolean;
}

function getPillStyle(
  selected: boolean,
  stretch: boolean,
  emphasis: "default" | "primary",
  disabled: boolean,
): CSSProperties {
  const isPrimary = emphasis === "primary";

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: stretch ? "100%" : "auto",
    minWidth: 0,
    maxWidth: "100%",
    padding: "8px 12px",
    borderRadius: 999,
    border: `1px solid ${isPrimary ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.08)"}`,
    background: isPrimary
      ? "linear-gradient(180deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.045))"
      : "rgba(255, 255, 255, 0.05)",
    boxSizing: "border-box",
    color: isPrimary ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.9)",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.15,
    textAlign: "center",
    whiteSpace: "nowrap",
    opacity: disabled ? 0.62 : 1,
    cursor: disabled ? "default" : "pointer",
    transition:
      "background 120ms ease, background-color 120ms ease, color 120ms ease, box-shadow 120ms ease, transform 120ms ease",
    boxShadow: isPrimary
      ? "inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 12px rgba(0, 0, 0, 0.24)"
      : "none",
    ...(selected
      ? {
          backgroundColor: "rgba(255, 255, 255, 0.14)",
          color: "rgba(255, 255, 255, 0.97)",
          boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.18)",
        }
      : {}),
  };
}

function getFocusedPillStyle(): CSSProperties {
  return {};
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

function getPillStackStyle(stretch: boolean): CSSProperties {
  return {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    width: stretch ? "100%" : "auto",
    minWidth: 0,
  };
}

function getPillStatusStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    lineHeight: 1.15,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
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
type DeckyGamepadCancelHandler = NonNullable<ComponentProps<typeof Focusable>["onCancel"]>;

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
  emphasis = "default",
  role = "button",
  ariaLabel,
  ariaChecked,
  stretch = false,
  statusLabel,
  disabled = false,
  onFocus = scrollFocusedElementIntoView,
  onGamepadFocus = scrollFocusedGamepadElementIntoView,
  onCancelButton,
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
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      onActivate={disabled ? () => undefined : onClick}
      onClick={disabled ? () => undefined : onClick}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus(event);
      }}
      onGamepadFocus={(event) => {
        setIsFocused(true);
        onGamepadFocus(event);
      }}
      {...(onCancelButton !== undefined ? { onCancel: onCancelButton } : {})}
      onBlur={() => {
        setIsFocused(false);
      }}
      style={{
        ...getPillStyle(selected, stretch, emphasis, disabled),
        ...(isFocused ? getFocusedPillStyle() : {}),
      }}
    >
      <span style={getPillStackStyle(stretch)}>
        <span style={getPillContentStyle()}>
          {iconSrc !== undefined ? (
            <span aria-hidden="true" style={getPillIconFrameStyle()}>
              <img alt={iconAlt ?? label} loading="lazy" src={iconSrc} style={getPillIconStyle()} />
            </span>
          ) : null}
          <span>{label}</span>
        </span>
        {statusLabel !== undefined ? <span style={getPillStatusStyle()}>{statusLabel}</span> : null}
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
