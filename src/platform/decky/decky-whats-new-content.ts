/** Bundled notes for the current update. Keep these in sync with the release notes. */
export const WHATS_NEW_SECTIONS = [
  {
    title: "RetroAchievements",
    items: [
      "RetroAchievements Profile system cards now open Games filtered to that system. A new Games dropdown lets you switch systems or show them all. The Systems tab is hidden while it is being reworked.",
    ],
  },
  {
    title: "Game pages",
    items: [
      "RetroAchievements game-page badges and details now refresh when you reopen a game page, including newly earned achievements.",
      "RetroAchievements game-page badges now stay visible while their data refreshes, without flashing a loading state.",
    ],
  },
] as const;
