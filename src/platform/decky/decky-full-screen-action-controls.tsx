import { ButtonItem, type ButtonItemProps } from "@decky/ui";
import { useCallback, type CSSProperties, type JSX, type ReactNode } from "react";
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
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getFullscreenChipIconStyle(): CSSProperties {
  return {
    display: "inline-flex",
    flexShrink: 0,
    lineHeight: 0,
  };
}

type ButtonItemWithChildrenContainerWidthType = (
  props: ButtonItemProps & {
    readonly childrenContainerWidth?: "min" | "max" | "fixed";
    readonly className?: string;
    readonly focusClassName?: string;
    readonly focusWithinClassName?: string;
    readonly highlightOnFocus?: boolean;
    readonly "data-achievement-companion-fullscreen-back"?: "true";
    readonly ref?: ((instance: HTMLElement | null) => void) | null;
  },
) => JSX.Element;

const ButtonItemWithChildrenContainerWidth =
  ButtonItem as unknown as ButtonItemWithChildrenContainerWidthType;

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
      <div
        className={`${DECKY_FULLSCREEN_ACTION_ROW_CLASS} ${centered ? DECKY_FULLSCREEN_ACTION_ROW_CENTERED_CLASS : ""}`.trim()}
        style={getFullscreenActionRowStyle(centered)}
      >
        {children}
      </div>
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
  const fullscreenBackButtonRef = useCallback((node: HTMLElement | null) => {
    if (isFullscreenBackAction) {
      ensureFullscreenCancelBridgeRegisteredForBackButtonElement(node);
    }
  }, [isFullscreenBackAction]);
  const handleClick = useCallback(() => {
    if (isFullscreenBackAction) {
      markDeckyFullscreenReturnRequested();
    }

    onClick();
  }, [isFullscreenBackAction, onClick]);

  return (
    <ButtonItemWithChildrenContainerWidth
      className={`${DECKY_FULLSCREEN_CHIP_CLASS} ${selected ? DECKY_FULLSCREEN_CHIP_SELECTED_CLASS : ""}`.trim()}
      childrenContainerWidth="min"
      focusClassName={DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS}
      focusWithinClassName={DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS}
      highlightOnFocus
      disabled={disabled}
      label={undefined}
      onClick={handleClick}
      {...(isFullscreenBackAction ? { ref: fullscreenBackButtonRef } : {})}
      {...(isFullscreenBackAction ? { "data-achievement-companion-fullscreen-back": "true" as const } : {})}
    >
      <span style={getFullscreenChipContentStyle()}>
        {icon !== undefined ? <span style={getFullscreenChipIconStyle()}>{icon}</span> : null}
        <span>{label}</span>
      </span>
    </ButtonItemWithChildrenContainerWidth>
  );
}
