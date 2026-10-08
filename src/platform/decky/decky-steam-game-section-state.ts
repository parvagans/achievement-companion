/** Backwards-compatible Steam names for the provider-neutral full-screen state store. */
export {
  readFullScreenGameSectionPageState as readSteamGameSectionPageState,
  updateFullScreenGameSectionPageState as updateSteamGameSectionPageState,
  resetFullScreenGameSectionActiveSection as resetSteamGameSectionActiveSection,
  resetFullScreenGameSectionPageStates as resetSteamGameSectionPageStates,
  requestFullScreenGameSectionRestoration as requestSteamGameSectionRestoration,
  consumeFullScreenGameSectionRestoration as consumeSteamGameSectionRestoration,
  selectFullScreenGameAchievementRestorationTarget as selectSteamAchievementRestorationTarget,
  resetFullScreenGameSectionPageStatesForTests as resetSteamGameSectionPageStatesForTests,
} from "./decky-full-screen-game-section-state";
export type {
  FullScreenGameSectionState as SteamGameSectionState,
  FullScreenGameAchievementSectionState as SteamGameAchievementSectionState,
  FullScreenGameAchievementGroupsSectionState as SteamGameAchievementGroupsSectionState,
  FullScreenGameSubsetsSectionState as SteamGameSubsetsSectionState,
  FullScreenGameSectionPageState as SteamGameSectionPageState,
} from "./decky-full-screen-game-section-state";
