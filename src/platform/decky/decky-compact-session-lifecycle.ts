import { resetDeckyCompactAchievementPageState } from "./decky-compact-achievement-page-state";
import { resetDeckyCompactNavigation } from "./decky-compact-navigation";
import { resetDeckyProviderMenuSessionState } from "./decky-provider-menu-session-state";
import { clearDeckyCompactSessionResources } from "./decky-compact-session-resources";
import { resetDeckySteamCompactFocusState } from "./decky-steam-compact-focus-state";
import { resetDeckySteamCompactActivityState } from "./decky-steam-compact-activity-state";
import { resetDeckyRetroAchievementsCompactFocusState } from "./decky-retroachievements-compact-focus-state";
import { resetDeckyRetroAchievementsCompactActivityState } from "./decky-retroachievements-compact-activity-state";
import {
  removeDeckyCompactCancelBridges,
  setDeckyCompactCancelBridgesEnabled,
} from "./decky-full-screen-cancel-bridge";

interface DeckyCompactSessionLifecycleDependencies {
  readonly setCancelEnabled: (enabled: boolean) => void;
  readonly endSession: () => void;
  readonly shouldPreserveHiddenSession?: () => boolean;
}

/** Clear state when a compact surface session really ends. */
export function endDeckyCompactSession(): void {
  removeDeckyCompactCancelBridges();
  setDeckyCompactCancelBridgesEnabled(false);
  resetDeckyCompactNavigation();
  resetDeckyProviderMenuSessionState();
  resetDeckyCompactAchievementPageState();
  resetDeckySteamCompactFocusState();
  resetDeckySteamCompactActivityState();
  resetDeckyRetroAchievementsCompactFocusState();
  resetDeckyRetroAchievementsCompactActivityState();
  clearDeckyCompactSessionResources();
}

/** Hidden handoffs/popups preserve the visit; an ordinary QAM close ends it. */
export function createDeckyCompactSessionLifecycle({
  setCancelEnabled,
  endSession,
  shouldPreserveHiddenSession = () => false,
}: DeckyCompactSessionLifecycleDependencies): {
  readonly setVisible: (visible: boolean) => void;
  readonly end: () => void;
} {
  let disposed = false;
  let sessionActive = true;

  return {
    setVisible(visible) {
      if (disposed) {
        return;
      }

      setCancelEnabled(visible);
      if (visible) {
        sessionActive = true;
      } else if (sessionActive && !shouldPreserveHiddenSession()) {
        sessionActive = false;
        endSession();
      }
    },
    end() {
      if (disposed) {
        return;
      }
      disposed = true;
      setCancelEnabled(false);
      if (sessionActive) {
        sessionActive = false;
        endSession();
      }
    },
  };
}
