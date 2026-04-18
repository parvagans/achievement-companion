import { ButtonItem, type ButtonItemProps } from "@decky/ui";
import type { CSSProperties, JSX, ReactNode } from "react";

type DeckyActionButtonItemProps = ButtonItemProps & {
  readonly childrenContainerWidth?: "min" | "max" | "fixed";
  readonly children?: ReactNode;
  readonly className?: string;
  readonly focusClassName?: string;
  readonly focusWithinClassName?: string;
  readonly showCue?: boolean;
};

type ButtonItemWithChildrenContainerWidthType = (
  props: DeckyActionButtonItemProps,
) => JSX.Element;

const ButtonItemWithChildrenContainerWidth =
  ButtonItem as unknown as ButtonItemWithChildrenContainerWidthType;

function getButtonCueStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255, 255, 255, 0.78)",
    lineHeight: 1,
    minWidth: 16,
    opacity: 1,
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    flexShrink: 0,
  };
}

function getButtonCueChevronStyle(): CSSProperties {
  return {
    display: "block",
    width: 5,
    height: 5,
    borderTop: "1.5px solid currentColor",
    borderRight: "1.5px solid currentColor",
    transform: "translateX(-0.5px) rotate(45deg)",
  };
}

export function DeckyActionButtonItem({
  children,
  childrenContainerWidth = "min",
  className,
  focusClassName,
  focusWithinClassName,
  showCue = true,
  ...props
}: DeckyActionButtonItemProps): JSX.Element {
  const actionCue = showCue
    ? children ?? (
        <span aria-hidden="true" style={getButtonCueStyle()}>
          <span style={getButtonCueChevronStyle()} />
        </span>
      )
    : undefined;
  const buttonItemProps: DeckyActionButtonItemProps = {
    ...props,
    children: actionCue,
    childrenContainerWidth,
    ...(className !== undefined ? { className } : {}),
    ...(focusClassName !== undefined ? { focusClassName } : {}),
    ...(focusWithinClassName !== undefined ? { focusWithinClassName } : {}),
  };

  return (
    <ButtonItemWithChildrenContainerWidth {...buttonItemProps} />
  );
}
