import { Focusable, PanelSectionRow } from "@decky/ui";
import { useState } from "react";
import type {
  CSSProperties,
  ComponentProps,
  FocusEventHandler,
  JSX,
  ReactNode,
} from "react";
import {
  DECKY_PROVIDER_SETTINGS_ACTION_PILL_CLASS,
  DECKY_PROVIDER_SETTINGS_ACTION_ROW_ACTIVE_CLASS,
  DECKY_PROVIDER_SETTINGS_ACTION_ROW_CLASS,
} from "./decky-focus-styles";

export interface DeckyProviderSettingsActionRowProps {
  readonly label: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}

export interface DeckyProviderSettingsActionGroupProps {
  readonly children: ReactNode;
}

type DeckyGamepadFocusHandler = NonNullable<ComponentProps<typeof Focusable>["onGamepadFocus"]>;

function getActionGroupStyle(): CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px 10px",
    width: "100%",
    minWidth: 0,
  };
}

function getRowStyle(disabled: boolean, focused: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
    minWidth: 0,
    padding: "12px 14px",
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.028))",
    boxSizing: "border-box",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.62 : 1,
    margin: "5px 0",
    scrollMarginBlock: 10,
    ...(focused
      ? {
          borderColor: "rgba(105, 176, 255, 0.8)",
          background:
            "linear-gradient(180deg, rgba(255, 255, 255, 0.105), rgba(255, 255, 255, 0.048))",
          boxShadow:
            "0 0 0 2px rgba(73, 155, 255, 0.72), 0 0 18px rgba(39, 124, 226, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.14)",
        }
      : {}),
  };
}

function getTextStackStyle(): CSSProperties {
  return {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  };
}

function getLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.96)",
    fontSize: "0.94em",
    fontWeight: 750,
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getDescriptionStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.66)",
    fontSize: "0.82em",
    lineHeight: 1.32,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getActionPillStyle(focused: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    maxWidth: "44%",
    minWidth: 0,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.14)",
    background: "rgba(255, 255, 255, 0.055)",
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: "0.78em",
    fontWeight: 800,
    letterSpacing: "0.02em",
    lineHeight: 1.15,
    overflow: "hidden",
    textOverflow: "ellipsis",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    transition:
      "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease, color 120ms ease",
    ...(focused
      ? {
          borderColor: "rgba(105, 176, 255, 0.82)",
          background:
            "linear-gradient(180deg, rgba(74, 138, 204, 0.44), rgba(34, 79, 124, 0.36))",
          color: "#fff",
          boxShadow:
            "0 0 0 1px rgba(73, 155, 255, 0.72), 0 0 12px rgba(39, 124, 226, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.14)",
        }
      : {}),
  };
}

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

export function DeckyProviderSettingsActionGroup({
  children,
}: DeckyProviderSettingsActionGroupProps): JSX.Element {
  return (
    <Focusable
      flow-children="left-right"
      noFocusRing
      style={getActionGroupStyle()}
    >
      {children}
    </Focusable>
  );
}

export function DeckyProviderSettingsActionRow({
  label,
  description,
  actionLabel = "Change",
  disabled = false,
  onClick,
}: DeckyProviderSettingsActionRowProps): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <PanelSectionRow>
      <Focusable
        className={`${DECKY_PROVIDER_SETTINGS_ACTION_ROW_CLASS} ${
          isFocused ? DECKY_PROVIDER_SETTINGS_ACTION_ROW_ACTIVE_CLASS : ""
        }`.trim()}
        focusClassName={DECKY_PROVIDER_SETTINGS_ACTION_ROW_ACTIVE_CLASS}
        focusWithinClassName={DECKY_PROVIDER_SETTINGS_ACTION_ROW_ACTIVE_CLASS}
        noFocusRing
        role="button"
        aria-label={`${label}. ${description}`}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : undefined}
        onActivate={disabled ? () => undefined : onClick}
        onClick={disabled ? () => undefined : onClick}
        onFocus={(event) => {
          setIsFocused(true);
          scrollFocusedElementIntoView(event);
        }}
        onGamepadFocus={(event) => {
          setIsFocused(true);
          scrollFocusedGamepadElementIntoView(event);
        }}
        onBlur={() => {
          setIsFocused(false);
        }}
        style={getRowStyle(disabled, isFocused)}
      >
        <span style={getTextStackStyle()}>
          <span style={getLabelStyle()}>{label}</span>
          <span style={getDescriptionStyle()}>{description}</span>
        </span>
        <span
          aria-hidden="true"
          className={DECKY_PROVIDER_SETTINGS_ACTION_PILL_CLASS}
          style={getActionPillStyle(isFocused)}
        >
          {actionLabel}
        </span>
      </Focusable>
    </PanelSectionRow>
  );
}
