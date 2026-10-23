import { ConfirmModal, showModal } from "@decky/ui";
import type { CSSProperties, ReactNode } from "react";
import { steamTheme } from "./steam-theme";
import { registerDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";

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
  renderContent,
  onClose,
}: {
  readonly title: string;
  readonly renderContent: (closeModal: () => void) => ReactNode;
  readonly onClose?: () => void;
}): void {
  let modal: ReturnType<typeof showModal> | undefined;
  let unregisterPopupCancel: (() => void) | undefined;
  let closed = false;
  const closeModal = (): void => {
    if (closed) return;
    closed = true;
    unregisterPopupCancel?.();
    modal?.Close();
    onClose?.();
  };
  modal = showModal(
    <ConfirmModal
      strTitle={title}
      strOKButtonText="Close"
      bAlertDialog
      closeModal={closeModal}
      onOK={closeModal}
      onCancel={closeModal}
    >
      {renderContent(closeModal)}
    </ConfirmModal>,
    undefined,
    { strTitle: title, bHideMainWindowForPopouts: false },
  );
  if (!closed) unregisterPopupCancel = registerDeckyFullscreenPopupCancel(closeModal);
}
