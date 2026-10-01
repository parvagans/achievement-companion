import { resetDeckyCompactAchievementPageState } from "./decky-compact-achievement-page-state";
import { resetDeckyCompactNavigation } from "./decky-compact-navigation";
import { clearDeckyCompactSessionResources } from "./decky-compact-session-resources";
import {
  removeDeckyCompactCancelBridges,
  setDeckyCompactCancelBridgesEnabled,
} from "./decky-full-screen-cancel-bridge";

interface DeckyCompactSessionLifecycleDependencies {
  readonly setCancelEnabled: (enabled: boolean) => void;
  readonly endSession: () => void;
}

/** Clear session-owned state only when Decky removes the active plugin root. */
export function endDeckyCompactSession(): void {
  removeDeckyCompactCancelBridges();
  setDeckyCompactCancelBridgesEnabled(false);
  resetDeckyCompactNavigation();
  resetDeckyCompactAchievementPageState();
  clearDeckyCompactSessionResources();
}

/** Visibility suspends a visit; only removal from Decky's active-plugin slot ends it. */
export function createDeckyCompactSessionLifecycle({
  setCancelEnabled,
  endSession,
}: DeckyCompactSessionLifecycleDependencies): {
  readonly setVisible: (visible: boolean) => void;
  readonly end: () => void;
} {
  let ended = false;

  return {
    setVisible(visible) {
      if (!ended) {
        setCancelEnabled(visible);
      }
    },
    end() {
      if (ended) {
        return;
      }
      ended = true;
      setCancelEnabled(false);
      endSession();
    },
  };
}
