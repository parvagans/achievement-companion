import type { GamepadEvent } from "@decky/ui";

/**
 * `GamepadButton` is a runtime export, but importing the @decky/ui entry point
 * makes this pure event helper depend on Steam's module-discovery environment.
 * Keep the two public GamepadUI enum values isolated here instead.
 */
export const STEAM_GAMEPAD_UI_SHOULDER_BUTTON = {
  left: 5,
  right: 6,
} as const;

export interface SteamGameShoulderNavigationActions {
  readonly onPreviousSection: () => void;
  readonly onNextSection: () => void;
}

type CancelableGamepadButtonEvent = Pick<
  GamepadEvent,
  "detail" | "preventDefault" | "stopImmediatePropagation" | "stopPropagation"
>;

/**
 * Owns a GamepadUI shoulder press for the mounted Steam game route. Steam's
 * event is cancelable; consuming it before changing sections prevents the same
 * press from reaching global UI such as the search field.
 */
export function handleSteamGameShoulderButtonDown(
  event: CancelableGamepadButtonEvent,
  actions: SteamGameShoulderNavigationActions,
): boolean {
  const navigate = event.detail.button === STEAM_GAMEPAD_UI_SHOULDER_BUTTON.left
    ? actions.onPreviousSection
    : event.detail.button === STEAM_GAMEPAD_UI_SHOULDER_BUTTON.right
      ? actions.onNextSection
      : undefined;

  if (navigate === undefined) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  if (event.detail.is_repeat !== true) {
    navigate();
  }
  return true;
}
