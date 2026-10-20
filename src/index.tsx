import { definePlugin } from "@decky/api";
import { DeckyBootstrap } from "@platform/decky/bootstrap";
import { DeckyCompactSession } from "@platform/decky/decky-compact-session";
import { removeDeckyCompactCancelBridges } from "@platform/decky/decky-full-screen-cancel-bridge";
import { resetDeckyCompactNavigation } from "@platform/decky/decky-compact-navigation";
import { resetDeckyCompactAchievementPageState } from "@platform/decky/decky-compact-achievement-page-state";
import { ensureDeckyGamePageAchievementRoutePatchRegistered } from "@platform/decky/decky-game-page-achievement-bubble";
import { ensureDeckyNativeSteamAchievementsRegistered } from "@platform/decky/decky-native-steam-achievements";
import {
  closeDeckyFullScreenSettingsOnDismount,
  clearDeckyCompactOriginFullScreenSession,
  openDeckyUpdatesFromNotification,
  registerDeckyFullScreenRoutes,
} from "@platform/decky/decky-navigation";
import {
  installAchievementCompanionRuntimeDebug,
  removeAchievementCompanionRuntimeDebug,
} from "@platform/decky/decky-runtime-debug";
import { achievementCompanionQamTheme } from "@platform/decky/decky-qam-theme";
import { clearAchievementCompanionThemes } from "@platform/decky/decky-theme-palette";
import { initializeDeckyUpdateSystem } from "./platform/decky/decky-update-service";

function AchievementCompanionIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="achievement-companion-picker-icon"
      viewBox="0 0 24 24"
      focusable="false"
      style={{ width: "1em", height: "1em", verticalAlign: "-0.125em", overflow: "visible" }}
    >
      {/* The star is a cutout, so the trophy follows Decky's native text color on focus. */}
      <path
        d="M5 2 Q4 9 6.5 13 Q8.5 17 12 18 Q15.5 17 17.5 13 Q20 9 19 2 Z M12 5 L13 8 L16 8 L13.5 10 L14.5 13 L12 11 L9.5 13 L10.5 10 L8 8 L11 8 Z"
        fill="currentColor"
        fillRule="evenodd"
      />

      {/* Handles */}
      <path d="M5 4 Q1 4 1 9 Q1 13 5 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M19 4 Q23 4 23 9 Q23 13 19 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>

      {/* Stem */}
      <rect x="10.5" y="18" width="3" height="3" rx="0.5" fill="currentColor"/>

      {/* Base */}
      <path d="M7 21 Q12 23 17 21 L16.5 23 Q12 24.5 7.5 23 Z" fill="currentColor"/>

    </svg>
  );
}

export default definePlugin(() => {
  installAchievementCompanionRuntimeDebug();
  const removeDeckyGamePageAchievementRoutePatch =
    ensureDeckyGamePageAchievementRoutePatchRegistered();
  const removeDeckyNativeSteamAchievements = ensureDeckyNativeSteamAchievementsRegistered();
  const removeDeckyFullScreenRoutes = registerDeckyFullScreenRoutes();
  const stopDeckyUpdateSystem = initializeDeckyUpdateSystem(openDeckyUpdatesFromNotification);

  return {
    name: "Achievement Companion",
    titleView: (
      <span style={{
        display: "block",
        color: achievementCompanionQamTheme.color.textPrimary,
        fontFamily: achievementCompanionQamTheme.type.fontFamily,
        fontSize: achievementCompanionQamTheme.type.compact.title,
        fontWeight: achievementCompanionQamTheme.type.weight.strong,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}>Achievement Companion</span>
    ),
    alwaysRender: true,
    content: <DeckyCompactSession><DeckyBootstrap /></DeckyCompactSession>,
    icon: <AchievementCompanionIcon />,
    onDismount() {
      clearAchievementCompanionThemes();
      closeDeckyFullScreenSettingsOnDismount();
      stopDeckyUpdateSystem();
      removeDeckyCompactCancelBridges();
      resetDeckyCompactNavigation();
      resetDeckyCompactAchievementPageState();
      clearDeckyCompactOriginFullScreenSession();
      removeDeckyFullScreenRoutes();
      removeDeckyNativeSteamAchievements();
      removeDeckyGamePageAchievementRoutePatch();
      removeAchievementCompanionRuntimeDebug();
    },
  };
});
