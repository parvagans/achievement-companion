import { ConfirmModal, showModal } from "@decky/ui";
import { createRef, type CSSProperties, type ReactNode } from "react";
import { steamTheme } from "./steam-theme";
import { registerDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";
import { beginDeckyCompactPopup } from "./decky-compact-popup-state";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";

/** The native dialog shell used by Achievement Companion's focused detail modals. */
export function getDeckyStandardModalContentStyle(): CSSProperties {
  return { width: "min(100%, 780px)" };
}

export function getDeckyStandardModalTabStyle(): CSSProperties {
  return {
    flex: "1 1 0",
    minWidth: 0,
    minHeight: 38,
    display: "grid",
    placeItems: "center",
    border: `1px solid ${steamTheme.color.borderSubtle}`,
    borderRadius: steamTheme.radius.pill,
    color: steamTheme.color.textPrimary,
    fontSize: steamTheme.type.fullscreen.body,
    fontWeight: steamTheme.type.weight.strong,
    cursor: "pointer",
  };
}

export function openDeckyStandardModal({
  title,
  renderTitle,
  renderContent,
  onClose,
  viewportSafe = false,
  preserveCompactSession = false,
}: {
  readonly title: string;
  readonly renderTitle?: (closeModal: () => void) => ReactNode;
  readonly renderContent: (closeModal: () => void, focusCloseButton: () => boolean) => ReactNode;
  readonly onClose?: () => void;
  readonly viewportSafe?: boolean;
  readonly preserveCompactSession?: boolean;
}): void {
  let modal: ReturnType<typeof showModal> | undefined;
  let unregisterPopupCancel: (() => void) | undefined;
  let releaseCompactPopup = preserveCompactSession ? beginDeckyCompactPopup() : undefined;
  let closed = false;
  const closeLabelRef = createRef<HTMLSpanElement>();
  const focusCloseButton = (): boolean => {
    // Resolve only the native action containing our own label, never another dialog.
    const button = closeLabelRef.current?.closest<HTMLElement>("button, [role='button'], [tabindex]");
    return takeDeckySteamGamepadFocus(button);
  };
  const closeModal = (): void => {
    if (closed) return;
    closed = true;
    unregisterPopupCancel?.();
    modal?.Close();
    releaseCompactPopup?.();
    releaseCompactPopup = undefined;
    onClose?.();
  };
  try {
    modal = showModal(
      <ConfirmModal
        strTitle={renderTitle?.(closeModal) ?? title}
        strOKButtonText={<span ref={closeLabelRef}>Close</span>}
        bAlertDialog
        closeModal={closeModal}
        onOK={closeModal}
        onCancel={closeModal}
      >
        {renderContent(closeModal, focusCloseButton)}
      </ConfirmModal>,
      undefined,
      {
        strTitle: title,
        bHideMainWindowForPopouts: false,
        ...(viewportSafe ? { bNeverPopOut: true, popupWidth: 720, popupHeight: 420 } : {}),
      },
    );
  } catch (error) {
    releaseCompactPopup?.();
    releaseCompactPopup = undefined;
    throw error;
  }
  if (!closed) unregisterPopupCancel = registerDeckyFullscreenPopupCancel(closeModal);
}
