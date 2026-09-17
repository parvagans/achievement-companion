import { useEffect, useRef } from "react";
import type { ControllerInputGamepadButton } from "@decky/ui/dist/globals/steam-client/Input";

/**
 * @decky/ui declares the enum in its shipped Input.d.ts, but does not export
 * an executable enum from its public package entry point. Keep that bridge in
 * one place rather than reaching for an untyped Steam global at call sites.
 */
const STEAM_GAMEPAD_BUTTON = {
  leftShoulder: 30 as ControllerInputGamepadButton,
  rightShoulder: 31 as ControllerInputGamepadButton,
} as const;

export interface SteamGameShoulderNavigationOptions {
  readonly enabled: boolean;
  readonly onPreviousSection: () => void;
  readonly onNextSection: () => void;
}

/**
 * Registers one native Steam controller-input listener for the mounted Steam
 * game route. Callback refs prevent ordinary page rerenders from registering
 * duplicate listeners or using stale section-navigation state.
 */
export function useSteamGameShoulderNavigation({
  enabled,
  onPreviousSection,
  onNextSection,
}: SteamGameShoulderNavigationOptions): void {
  const previousSectionRef = useRef(onPreviousSection);
  const nextSectionRef = useRef(onNextSection);
  previousSectionRef.current = onPreviousSection;
  nextSectionRef.current = onNextSection;

  useEffect(() => {
    if (!enabled || typeof SteamClient === "undefined") {
      return;
    }

    const subscription = SteamClient.Input.RegisterForControllerInputMessages(
      (_controllerIndex, gamepadButton, isButtonPressed) => {
        if (!isButtonPressed) {
          return;
        }

        if (gamepadButton === STEAM_GAMEPAD_BUTTON.leftShoulder) {
          previousSectionRef.current();
        } else if (gamepadButton === STEAM_GAMEPAD_BUTTON.rightShoulder) {
          nextSectionRef.current();
        }
      },
    );

    return () => {
      subscription.unregister();
    };
  }, [enabled]);
}
