import { Focusable } from "@decky/ui";
import {
  useCallback,
  type ComponentProps,
  type CSSProperties,
  type FocusEventHandler,
  type JSX,
  type ReactNode,
} from "react";
import {
  DECKY_FULLSCREEN_ACTION_ROW_CLASS,
  DECKY_FULLSCREEN_ACTION_ROW_CENTERED_CLASS,
  DECKY_FULLSCREEN_CHIP_CLASS,
  DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS,
  DECKY_FULLSCREEN_CHIP_SELECTED_CLASS,
} from "./decky-focus-styles";
import { getDeckyFullscreenActionStylesCss } from "./decky-full-screen-action-styles";
import { ensureFullscreenCancelBridgeRegisteredForBackButtonElement } from "./decky-full-screen-cancel-bridge";
import { markDeckyFullscreenReturnRequested } from "./decky-full-screen-return-context";

function DeckyFullscreenActionStyles(): JSX.Element {
  if (
    typeof document !== "undefined" &&
    document.querySelector('style[data-achievement-companion-fullscreen-action-styles="true"]') !== null
  ) {
    return <></>;
  }

  return <style data-achievement-companion-fullscreen-action-styles="true">{getDeckyFullscreenActionStylesCss()}</style>;
}

export interface DeckyFullscreenActionButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly icon?: ReactNode;
  readonly isFullscreenBackAction?: boolean | undefined;
}

function getFullscreenActionRowStyle(centered: boolean): CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: centered ? "center" : "flex-start",
    gap: "8px 8px",
    minWidth: 0,
    width: "100%",
  };
}

function getFullscreenChipContentStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "max-content",
    minWidth: "max-content",
    overflow: "visible",
    whiteSpace: "nowrap",
  };
}

function getFullscreenChipStyle(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    width: "max-content",
    minWidth: "max-content",
    maxWidth: "none",
    overflow: "visible",
    whiteSpace: "nowrap",
    opacity: disabled ? 0.62 : 1,
    cursor: disabled ? "default" : "pointer",
  };
}

function getFullscreenChipIconStyle(): CSSProperties {
  return {
    display: "inline-flex",
    flexShrink: 0,
    lineHeight: 0,
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

export function DeckyFullscreenActionRow({
  children,
  centered = false,
}: {
  readonly children: ReactNode;
  readonly centered?: boolean;
}): JSX.Element {
  return (
    <>
      <DeckyFullscreenActionStyles />
      <Focusable
        flow-children="left-right"
        noFocusRing
        className={`${DECKY_FULLSCREEN_ACTION_ROW_CLASS} ${centered ? DECKY_FULLSCREEN_ACTION_ROW_CENTERED_CLASS : ""}`.trim()}
        style={getFullscreenActionRowStyle(centered)}
      >
        {children}
      </Focusable>
    </>
  );
}

export function DeckyFullscreenActionButton({
  label,
  onClick,
  selected = false,
  disabled = false,
  icon,
  isFullscreenBackAction = false,
}: DeckyFullscreenActionButtonProps): JSX.Element {
  const fullscreenBackButtonRef = useCallback((node: HTMLDivElement | null) => {
    if (isFullscreenBackAction) {
      ensureFullscreenCancelBridgeRegisteredForBackButtonElement(node);
    }
  }, [isFullscreenBackAction]);
  const handleClick = useCallback(() => {
    if (disabled) {
      return;
    }

    if (isFullscreenBackAction) {
      markDeckyFullscreenReturnRequested();
    }

    onClick();
  }, [disabled, isFullscreenBackAction, onClick]);

  return (
    <Focusable
      className={`${DECKY_FULLSCREEN_CHIP_CLASS} ${selected ? DECKY_FULLSCREEN_CHIP_SELECTED_CLASS : ""}`.trim()}
      focusClassName={DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS}
      focusWithinClassName={DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS}
      noFocusRing
      role="button"
      aria-label={label}
      aria-pressed={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onActivate={handleClick}
      onClick={handleClick}
      onFocus={scrollFocusedElementIntoView}
      onGamepadFocus={scrollFocusedGamepadElementIntoView}
      {...(isFullscreenBackAction ? { onCancel: handleClick } : {})}
      {...(isFullscreenBackAction ? { ref: fullscreenBackButtonRef } : {})}
      {...(isFullscreenBackAction ? { "data-achievement-companion-fullscreen-back": "true" as const } : {})}
      style={getFullscreenChipStyle(disabled)}
    >
      <span style={getFullscreenChipContentStyle()}>
        {icon !== undefined ? <span style={getFullscreenChipIconStyle()}>{icon}</span> : null}
        <span style={{ whiteSpace: "nowrap" }}>{label}</span>
      </span>
    </Focusable>
  );
}
