import { Focusable, type FocusableProps, type GamepadEvent } from "@decky/ui";
import {
  useCallback,
  useLayoutEffect,
  useRef,
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
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";

const actionStylesByDocument = new WeakMap<Document, { style: HTMLStyleElement; owners: number }>();

function DeckyFullscreenActionStyles(): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const ownerDocument = anchorRef.current?.ownerDocument;
    if (ownerDocument === undefined) {
      return;
    }
    // Each button owns its presentation even outside an action row. Share one
    // stylesheet per Steam document while any row or standalone button is mounted.
    let entry = actionStylesByDocument.get(ownerDocument);
    if (entry === undefined) {
      const style = ownerDocument.createElement("style");
      style.dataset["achievementCompanionFullscreenActionStyles"] = "true";
      style.textContent = getDeckyFullscreenActionStylesCss();
      ownerDocument.head.appendChild(style);
      entry = { style, owners: 0 };
      actionStylesByDocument.set(ownerDocument, entry);
    }
    entry.owners += 1;
    return () => {
      entry.owners -= 1;
      if (entry.owners === 0) {
        entry.style.remove();
        actionStylesByDocument.delete(ownerDocument);
      }
    };
  }, []);
  return <span ref={anchorRef} hidden aria-hidden="true" />;
}

export interface DeckyFullscreenActionButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly compact?: boolean;
  readonly fullWidth?: boolean;
  readonly icon?: ReactNode;
  readonly isFullscreenBackAction?: boolean | undefined;
  readonly primary?: boolean;
  readonly contentAlign?: "center" | "left";
  readonly scrollToTopOnFocus?: boolean | undefined;
  readonly focusClassName?: string | undefined;
  readonly onGamepadDirection?: ((event: GamepadEvent) => void) | undefined;
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

function getFullscreenChipContentStyle(contentAlign: "center" | "left"): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: contentAlign === "left" ? "flex-start" : "center",
    gap: 6,
    width: contentAlign === "left" ? "100%" : "max-content",
    minWidth: contentAlign === "left" ? 0 : "max-content",
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

type DeckyGamepadFocusHandler = NonNullable<FocusableProps["onGamepadFocus"]>;

const scrollFocusedElementIntoView: FocusEventHandler<HTMLElement> = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
};

const scrollFocusedGamepadElementIntoView: DeckyGamepadFocusHandler = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
};

function scrollNearestScrollableAncestorToTop(element: HTMLElement): void {
  let node: HTMLElement | null = element.parentElement;

  while (node !== null) {
    const overflowY = window.getComputedStyle(node).overflowY;
    const isScrollable =
      (overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight;

    if (isScrollable) {
      node.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    node = node.parentElement;
  }
}

const scrollFullscreenBackButtonIntoView: FocusEventHandler<HTMLElement> = (event) => {
  scrollNearestScrollableAncestorToTop(event.currentTarget);
};

const scrollFullscreenBackButtonGamepadIntoView: DeckyGamepadFocusHandler = (event) => {
  const target = event.currentTarget;

  if (target instanceof HTMLElement) {
    scrollNearestScrollableAncestorToTop(target);
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
        // This groups the action buttons for horizontal navigation, but is not an action itself.
        // Leaving it tabbable creates an invisible stop between the visible buttons and the next section.
        tabIndex={-1}
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
  compact = false,
  fullWidth = false,
  icon,
  isFullscreenBackAction = false,
  primary = false,
  contentAlign = "center",
  scrollToTopOnFocus = false,
  focusClassName,
  onGamepadDirection,
}: DeckyFullscreenActionButtonProps): JSX.Element {
  const handleClick = useCallback(() => {
    if (disabled) {
      return;
    }

    onClick();
  }, [disabled, onClick]);
  const shouldScrollToTopOnFocus = isFullscreenBackAction || scrollToTopOnFocus;

  return (
    <>
    <DeckyFullscreenActionStyles />
    <Focusable
      className={`${DECKY_FULLSCREEN_CHIP_CLASS} ${selected ? DECKY_FULLSCREEN_CHIP_SELECTED_CLASS : ""} ${compact ? "achievement-companion-fullscreen-chip-compact" : ""} ${fullWidth ? "achievement-companion-fullscreen-chip-full-width" : ""} ${primary ? "achievement-companion-fullscreen-chip-primary" : ""} ${contentAlign === "left" ? "achievement-companion-fullscreen-chip-overview-action" : ""}`.trim()}
      focusClassName={`${DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS} ${focusClassName ?? ""}`.trim()}
      focusWithinClassName={`${DECKY_FULLSCREEN_CHIP_FOCUSED_CLASS} ${focusClassName ?? ""}`.trim()}
      noFocusRing
      role="button"
      aria-label={label}
      aria-pressed={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onActivate={handleClick}
      onClick={handleClick}
      {...(onGamepadDirection === undefined ? {} : { onGamepadDirection })}
      onFocus={shouldScrollToTopOnFocus ? scrollFullscreenBackButtonIntoView : scrollFocusedElementIntoView}
      onGamepadFocus={
        shouldScrollToTopOnFocus
          ? scrollFullscreenBackButtonGamepadIntoView
          : scrollFocusedGamepadElementIntoView
      }
      style={getFullscreenChipStyle(disabled)}
    >
      <span style={getFullscreenChipContentStyle(contentAlign)}>
        {icon !== undefined ? <span style={getFullscreenChipIconStyle()}>{icon}</span> : null}
        <span style={{ whiteSpace: "nowrap" }}>{label}</span>
      </span>
    </Focusable>
    </>
  );
}
