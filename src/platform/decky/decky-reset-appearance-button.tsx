import { ConfirmModal, DialogButton, showModal, type GamepadEvent } from "@decky/ui";
import { useRef, useState } from "react";
import { resetDeckyAppearanceSettings } from "./decky-settings";
import { beginDeckyCompactPopup } from "./decky-compact-popup-state";
import { registerDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";

export function AppearanceResetConfirmation({ closeModal }: { readonly closeModal: () => void }): JSX.Element {
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  return <ConfirmModal strTitle="Reset appearance settings?"
    strDescription="This will restore the theme and game-page badge settings to their defaults. Your accounts, pinned achievements, and game progress will not be affected."
    strOKButtonText="Reset to Defaults" strCancelButtonText="Cancel" bOKDisabled={saving} bCancelDisabled={saving}
    closeModal={closeModal} onCancel={() => { if (!savingRef.current) closeModal(); }}
    onOK={async () => {
      if (savingRef.current) return;
      savingRef.current = true; setSaving(true); setError(false);
      const saved = await resetDeckyAppearanceSettings();
      savingRef.current = false; setSaving(false);
      if (saved) closeModal(); else setError(true);
    }}>
    {error ? <div role="alert">Unable to save appearance settings. Your previous settings are unchanged.</div> : null}
  </ConfirmModal>;
}

export function openAppearanceResetConfirmation(compact: boolean): void {
  let modal: ReturnType<typeof showModal> | undefined;
  let unregister: (() => void) | undefined;
  const release = compact ? beginDeckyCompactPopup() : undefined;
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true; unregister?.(); modal?.Close(); release?.();
  };
  try {
    // Match the existing detail dialogs: Steam resolves the owning modal window.
    // A trigger element is not a native modal window (especially while QAM is open).
    modal = showModal(<AppearanceResetConfirmation closeModal={close} />, undefined, { strTitle: "Reset appearance settings?", bHideMainWindowForPopouts: false, bNeverPopOut: true });
    if (!closed) unregister = registerDeckyFullscreenPopupCancel(close);
  } catch (error) { close(); throw error; }
}

export function DeckyResetAppearanceButton({ compact = false, onGamepadDirection }: {
  readonly compact?: boolean; readonly onGamepadDirection?: (event: GamepadEvent) => void;
}): JSX.Element {
  return <DialogButton {...(!compact ? { className: "ac-settings-action" } : {})} data-ac-reset-appearance onClick={() => openAppearanceResetConfirmation(compact)}
    {...(onGamepadDirection ? { onGamepadDirection } : {})}
    style={{ width: "100%", minHeight: 40, marginTop: 8, whiteSpace: "normal" }}>
    Reset Appearance to Defaults
  </DialogButton>;
}
