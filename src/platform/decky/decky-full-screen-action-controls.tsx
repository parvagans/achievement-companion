import { ButtonItem, type ButtonItemProps } from "@decky/ui";
import type { CSSProperties, JSX, ReactNode } from "react";
import {
  DECKY_FULLSCREEN_CHIP_CLASS,
  DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS,
  DECKY_FULLSCREEN_CHIP_SELECTED_CLASS,
} from "./decky-focus-styles";

export interface DeckyFullscreenActionButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly selected?: boolean;
  readonly icon?: ReactNode;
}

function getFullscreenActionRowStyle(): CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
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
  },
) => JSX.Element;

const ButtonItemWithChildrenContainerWidth =
  ButtonItem as unknown as ButtonItemWithChildrenContainerWidthType;

export function DeckyFullscreenActionRow({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return <div style={getFullscreenActionRowStyle()}>{children}</div>;
}

export function DeckyFullscreenActionButton({
  label,
  onClick,
  selected = false,
  icon,
}: DeckyFullscreenActionButtonProps): JSX.Element {
  return (
    <ButtonItemWithChildrenContainerWidth
      className={`${DECKY_FULLSCREEN_CHIP_CLASS} ${selected ? DECKY_FULLSCREEN_CHIP_SELECTED_CLASS : ""}`.trim()}
      childrenContainerWidth="min"
      focusClassName={DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS}
      focusWithinClassName={DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS}
      highlightOnFocus
      label={undefined}
      onClick={onClick}
    >
      <span style={getFullscreenChipContentStyle()}>
        {icon !== undefined ? <span style={getFullscreenChipIconStyle()}>{icon}</span> : null}
        <span>{label}</span>
      </span>
    </ButtonItemWithChildrenContainerWidth>
  );
}
